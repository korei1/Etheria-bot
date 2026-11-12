import type { Pool } from "pg";
import { getCraftingRecipe } from "./crafting-catalog.js";
import { validateCraftingRecipe, type CraftingIngredient, type CraftingRecipe } from "./crafting-types.js";

interface InventorySlotRow {
  id: string;
  slot_number: number;
  item_code: string;
  quantity: number;
}

export interface CraftItemInput {
  accountId: string;
  characterId: string;
  recipeKey: string;
  /** UUID stable fourni par l'interface pour rendre les répétitions idempotentes. */
  interactionId: string;
}

export interface CraftItemResult {
  recipeKey: string;
  outputItemCode: string;
  outputQuantity: number;
  replayed: boolean;
}

export class CraftingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CraftingError";
  }
}

export class CraftingRecipeUnavailableError extends CraftingError {
  constructor(message = "Cette recette n'est pas disponible.") {
    super(message);
    this.name = "CraftingRecipeUnavailableError";
  }
}

export class CraftingInventoryError extends CraftingError {
  constructor(message: string) {
    super(message);
    this.name = "CraftingInventoryError";
  }
}

export class CraftingRequirementError extends CraftingError {
  constructor(message: string) {
    super(message);
    this.name = "CraftingRequirementError";
  }
}

export class CraftingIdempotencyError extends CraftingError {
  constructor() {
    super("Cette référence d'action a déjà été utilisée pour une autre fabrication.");
    this.name = "CraftingIdempotencyError";
  }
}

function validateRecipeOrThrow(recipe: CraftingRecipe): void {
  const issues = validateCraftingRecipe(recipe);
  if (issues.length > 0) {
    throw new CraftingRecipeUnavailableError(
      "La recette est invalide : " + issues.map((issue) => issue.message).join(" ")
    );
  }
}

function sameIngredients(
  stored: unknown,
  expected: readonly CraftingIngredient[]
): boolean {
  if (!Array.isArray(stored) || stored.length !== expected.length) return false;
  return expected.every((ingredient, index) => {
    const candidate = stored[index] as { itemCode?: unknown; quantity?: unknown };
    return candidate?.itemCode === ingredient.itemCode && candidate?.quantity === ingredient.quantity;
  });
}

/**
 * Exécute une recette dans une transaction PostgreSQL unique.
 * Les ingrédients, le résultat, l'événement idempotent et l'expérience éventuelle
 * sont validés/écrits ensemble : aucune consommation partielle n'est possible.
 */
export async function craftItem(
  pool: Pool,
  input: CraftItemInput
): Promise<CraftItemResult> {
  const recipe = getCraftingRecipe(input.recipeKey);
  if (!recipe) throw new CraftingRecipeUnavailableError();
  validateRecipeOrThrow(recipe);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const character = await client.query<{ id: string }>(
      `SELECT id FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, input.accountId]
    );
    if (!character.rows[0]) {
      throw new CraftingRequirementError("Aucun personnage actif ne correspond à cette demande.");
    }

    const priorEvent = await client.query<{
      character_id: string;
      recipe_key: string;
      ingredients_snapshot: unknown;
      output_item_code: string;
      output_quantity: number;
    }>(
      `SELECT character_id, recipe_key, ingredients_snapshot, output_item_code, output_quantity
       FROM character_crafting_events
       WHERE interaction_id = $1`,
      [input.interactionId]
    );
    if (priorEvent.rows[0]) {
      const prior = priorEvent.rows[0];
      if (prior.character_id !== input.characterId || prior.recipe_key !== recipe.key) {
        throw new CraftingIdempotencyError();
      }
      await client.query("COMMIT");
      return {
        recipeKey: prior.recipe_key,
        outputItemCode: prior.output_item_code,
        outputQuantity: prior.output_quantity,
        replayed: true
      };
    }

    if (recipe.requiredFeatureKey) {
      const feature = await client.query(
        `SELECT 1 FROM character_unlocked_features
         WHERE character_id = $1 AND feature_key = $2`,
        [input.characterId, recipe.requiredFeatureKey]
      );
      if (!feature.rowCount) {
        throw new CraftingRequirementError("Cette fonctionnalité n'a pas encore été déverrouillée.");
      }
    }

    if (recipe.requiredSkill) {
      const skill = await client.query<{ level: number }>(
        `SELECT level FROM character_skill_progress
         WHERE character_id = $1 AND skill_key = $2`,
        [input.characterId, recipe.requiredSkill.skillKey]
      );
      if ((skill.rows[0]?.level ?? 0) < recipe.requiredSkill.minimumLevel) {
        throw new CraftingRequirementError("Le niveau de compétence requis n'est pas atteint.");
      }
    }

    if (recipe.requiredSceneKey) {
      const scene = await client.query<{ current_scene_key: string }>(
        `SELECT current_scene_key FROM character_exploration_progress
         WHERE character_id = $1
         FOR UPDATE`,
        [input.characterId]
      );
      if (scene.rows[0]?.current_scene_key !== recipe.requiredSceneKey) {
        throw new CraftingRequirementError("Ton personnage ne se trouve pas au lieu requis.");
      }
    }

    const bagResult = await client.query<{ id: string; capacity: number }>(
      `SELECT id, capacity FROM character_inventory_bags
       WHERE character_id = $1 AND is_equipped = TRUE
       FOR UPDATE`,
      [input.characterId]
    );
    const bag = bagResult.rows[0];
    if (!bag) throw new CraftingInventoryError("Aucun sac n'est actuellement équipé.");

    const slotsResult = await client.query<InventorySlotRow>(
      `SELECT id, slot_number, item_code, quantity
       FROM character_inventory_slots
       WHERE bag_id = $1
       ORDER BY slot_number
       FOR UPDATE`,
      [bag.id]
    );
    const slots = slotsResult.rows;
    const slotByCode = new Map(slots.map((slot) => [slot.item_code, slot]));

    for (const ingredient of recipe.ingredients) {
      const stack = slotByCode.get(ingredient.itemCode);
      if (!stack || stack.quantity < ingredient.quantity) {
        throw new CraftingInventoryError(
          "Ressources insuffisantes : " + ingredient.itemCode + "."
        );
      }
    }

    const eventInsert = await client.query(
      `INSERT INTO character_crafting_events (
         interaction_id, character_id, recipe_key, ingredients_snapshot,
         output_item_code, output_quantity
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (interaction_id) DO NOTHING
       RETURNING id`,
      [
        input.interactionId,
        input.characterId,
        recipe.key,
        JSON.stringify(recipe.ingredients),
        recipe.output.itemCode,
        recipe.output.quantity
      ]
    );
    if (!eventInsert.rowCount) {
      const collision = await client.query<{ character_id: string; recipe_key: string }>(
        "SELECT character_id, recipe_key FROM character_crafting_events WHERE interaction_id = $1",
        [input.interactionId]
      );
      const prior = collision.rows[0];
      if (prior?.character_id === input.characterId && prior.recipe_key === recipe.key) {
        await client.query("COMMIT");
        return {
          recipeKey: recipe.key,
          outputItemCode: recipe.output.itemCode,
          outputQuantity: recipe.output.quantity,
          replayed: true
        };
      }
      throw new CraftingIdempotencyError();
    }

    const consumedCompletely = new Set<string>();
    for (const ingredient of recipe.ingredients) {
      const stack = slotByCode.get(ingredient.itemCode);
      if (!stack) continue;
      if (stack.quantity === ingredient.quantity) {
        await client.query("DELETE FROM character_inventory_slots WHERE id = $1", [stack.id]);
        consumedCompletely.add(stack.item_code);
      } else {
        await client.query(
          "UPDATE character_inventory_slots SET quantity = quantity - $2 WHERE id = $1",
          [stack.id, ingredient.quantity]
        );
      }
    }

    const outputStack = slotByCode.get(recipe.output.itemCode);
    if (outputStack && !consumedCompletely.has(recipe.output.itemCode)) {
      await client.query(
        "UPDATE character_inventory_slots SET quantity = quantity + $2 WHERE id = $1",
        [outputStack.id, recipe.output.quantity]
      );
    } else {
      const occupied = new Set(
        slots
          .filter((slot) => !consumedCompletely.has(slot.item_code))
          .map((slot) => Number(slot.slot_number))
      );
      const freeSlot = Array.from({ length: bag.capacity }, (_, index) => index + 1)
        .find((slotNumber) => !occupied.has(slotNumber));
      if (!freeSlot) {
        throw new CraftingInventoryError("Ton sac est plein et ne peut pas accueillir le résultat.");
      }
      await client.query(
        `INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity)
         VALUES ($1, $2, $3, $4)`,
        [bag.id, freeSlot, recipe.output.itemCode, recipe.output.quantity]
      );
    }

    if (recipe.progressionReward) {
      await client.query(
        `INSERT INTO character_skill_progress (character_id, skill_key, experience)
         VALUES ($1, $2, $3)
         ON CONFLICT (character_id, skill_key) DO UPDATE
           SET experience = character_skill_progress.experience + EXCLUDED.experience,
               updated_at = NOW()`,
        [
          input.characterId,
          recipe.progressionReward.skillKey,
          recipe.progressionReward.experience
        ]
      );
    }

    await client.query("COMMIT");
    return {
      recipeKey: recipe.key,
      outputItemCode: recipe.output.itemCode,
      outputQuantity: recipe.output.quantity,
      replayed: false
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
