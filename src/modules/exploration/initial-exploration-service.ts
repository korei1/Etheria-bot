import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { addCraftedItemLot, addInventoryItemLot, consumeInventoryItemLots } from "../inventory/item-lot-persistence.js";
import {
  INITIAL_QUEST_KEY,
  recordQuestMilestoneInTransaction
} from "../quests/quest-service.js";

export type InitialExplorationScene =
  | "awakening"
  | "wind_perceived"
  | "cliff_overlook"
  | "cliff_foot"
  | "berries_collected"
  | "water_source_found"
  | "thirst_restored"
  | "plants_gathered"
  | "canteen_crafted"
  | "cave_found"
  | "cave_shelter"
  | "campfire_lit"
  | "berries_roasted"
  | "morning_outside_cave"
  | "ruins_found"
  | "ruins_explored"
  | "temporary_camp_established";

export type InitialExplorationAction =
  | "listen_wind"
  | "observe_surroundings"
  | "follow_wind"
  | "inspect_path"
  | "descend_path"
  | "collect_local_berries"
  | "discover_water_source"
  | "drink_from_hands"
  | "gather_canteen_plants"
  | "craft_initial_canteen"
  | "seek_shelter"
  | "enter_cave"
  | "light_campfire"
  | "roast_local_berries"
  | "wake_after_first_night"
  | "discover_nearby_ruins"
  | "explore_ruins"
  | "return_to_cave";

export interface InitialExplorationState {
  scene: InitialExplorationScene;
  updatedAt: Date;
  bagCapacity: number | null;
  bagUsedSlots: number;
  thirstPercent: number;
  hungerPercent: number;
}

interface ExplorationRow {
  current_scene_key: InitialExplorationScene;
  updated_at: Date;
}

interface BagSummaryRow {
  capacity: number | null;
  used_slots: number | string;
}

interface NeedsRow {
  thirst_percent: number;
  hunger_percent: number;
}

export class CharacterNotFoundForExplorationError extends Error {
  constructor() {
    super("Aucun personnage actif correspondant à cette exploration n'a été trouvé.");
    this.name = "CharacterNotFoundForExplorationError";
  }
}

export class InvalidExplorationActionError extends Error {
  constructor(message = "Cette action n'est pas disponible à ce stade de l'exploration.") {
    super(message);
    this.name = "InvalidExplorationActionError";
  }
}

export async function initializeInitialExploration(
  client: PoolClient,
  characterId: string
): Promise<void> {
  await client.query(
    `INSERT INTO character_exploration_progress (character_id, current_scene_key)
     VALUES ($1, 'awakening')
     ON CONFLICT (character_id) DO NOTHING`,
    [characterId]
  );
  await client.query(
    `INSERT INTO character_needs (character_id, thirst_percent, hunger_percent)
     VALUES ($1, 100, 100)
     ON CONFLICT (character_id) DO NOTHING`,
    [characterId]
  );
  await client.query(
    `INSERT INTO character_survival_progress (character_id)
     VALUES ($1)
     ON CONFLICT (character_id) DO NOTHING`,
    [characterId]
  );
}

async function ensureProgress(
  client: PoolClient,
  characterId: string
): Promise<ExplorationRow> {
  await client.query(
    `INSERT INTO character_exploration_progress (character_id, current_scene_key)
     VALUES ($1, 'awakening')
     ON CONFLICT (character_id) DO NOTHING`,
    [characterId]
  );

  const result = await client.query<ExplorationRow>(
    `SELECT current_scene_key, updated_at
     FROM character_exploration_progress
     WHERE character_id = $1
     FOR UPDATE`,
    [characterId]
  );

  const row = result.rows[0];
  if (!row) throw new Error("La progression d'exploration n'a pas pu être initialisée.");
  return row;
}

async function getBagSummary(
  client: PoolClient,
  characterId: string
): Promise<{ capacity: number | null; usedSlots: number }> {
  const result = await client.query<BagSummaryRow>(
    `SELECT b.capacity,
            COUNT(s.id)::integer AS used_slots
     FROM character_inventory_bags b
     LEFT JOIN character_inventory_slots s ON s.bag_id = b.id
     WHERE b.character_id = $1 AND b.is_equipped = TRUE
     GROUP BY b.id, b.capacity
     LIMIT 1`,
    [characterId]
  );

  const row = result.rows[0];
  return row
    ? { capacity: row.capacity, usedSlots: Number(row.used_slots) }
    : { capacity: null, usedSlots: 0 };
}

export async function getInitialExplorationState(
  pool: Pool,
  accountId: string,
  characterId: string
): Promise<InitialExplorationState> {
  const result = await pool.query<ExplorationRow>(
    `SELECT p.current_scene_key, p.updated_at
     FROM character_exploration_progress p
     JOIN characters c ON c.id = p.character_id
     WHERE p.character_id = $1
       AND c.account_id = $2
       AND c.status = 'active'`,
    [characterId, accountId]
  );

  const row = result.rows[0];
  if (!row) throw new CharacterNotFoundForExplorationError();

  const bag = await pool.query<BagSummaryRow>(
    `SELECT b.capacity, COUNT(s.id)::integer AS used_slots
     FROM character_inventory_bags b
     LEFT JOIN character_inventory_slots s ON s.bag_id = b.id
     WHERE b.character_id = $1 AND b.is_equipped = TRUE
     GROUP BY b.id, b.capacity
     LIMIT 1`,
    [characterId]
  );
  const needs = await pool.query<NeedsRow>(
    `SELECT thirst_percent, hunger_percent FROM character_needs WHERE character_id = $1`,
    [characterId]
  );
  const values = needs.rows[0] ?? { thirst_percent: 100, hunger_percent: 100 };

  return {
    scene: row.current_scene_key,
    updatedAt: row.updated_at,
    bagCapacity: bag.rows[0]?.capacity ?? null,
    bagUsedSlots: Number(bag.rows[0]?.used_slots ?? 0),
    thirstPercent: values.thirst_percent,
    hungerPercent: values.hunger_percent
  };
}

/**
 * Applique une action validée de la première séquence d'exploration.
 * Le lieu de départ n'est jamais lu ni retourné par ce module.
 */
export async function performInitialExplorationAction(
  pool: Pool,
  input: {
    interactionId: string;
    accountId: string;
    characterId: string;
    action: InitialExplorationAction;
  }
): Promise<InitialExplorationState> {
  const interactionId = input.interactionId.trim();
  if (!interactionId) throw new Error("L'identifiant de l'interaction est obligatoire.");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const character = await client.query(
      `SELECT id
       FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, input.accountId]
    );
    if (!character.rowCount) throw new CharacterNotFoundForExplorationError();

    const priorEvent = await client.query(
      `SELECT 1
       FROM character_exploration_events
       WHERE event_id = $1 AND character_id = $2`,
      [interactionId, input.characterId]
    );

    if (priorEvent.rows[0]) {
      const current = await ensureProgress(client, input.characterId);
      const bag = await getBagSummary(client, input.characterId);
      const needs = await client.query<NeedsRow>(
        `SELECT thirst_percent, hunger_percent FROM character_needs WHERE character_id = $1`,
        [input.characterId]
      );
      const values = needs.rows[0] ?? { thirst_percent: 100, hunger_percent: 100 };
      await client.query("COMMIT");
      return {
        scene: current.current_scene_key,
        updatedAt: current.updated_at,
        bagCapacity: bag.capacity,
        bagUsedSlots: bag.usedSlots,
        thirstPercent: values.thirst_percent,
        hungerPercent: values.hunger_percent
      };
    }

    const progress = await ensureProgress(client, input.characterId);
    let nextScene = progress.current_scene_key;

    switch (input.action) {
      case "observe_surroundings":
        break;
      case "listen_wind":
        if (progress.current_scene_key !== "awakening") throw new InvalidExplorationActionError();
        nextScene = "wind_perceived";
        break;
      case "follow_wind":
        if (progress.current_scene_key !== "wind_perceived") {
          throw new InvalidExplorationActionError("Il faut d'abord prendre le temps de percevoir le vent.");
        }
        nextScene = "cliff_overlook";
        break;
      case "inspect_path":
        if (progress.current_scene_key !== "cliff_overlook") throw new InvalidExplorationActionError();
        break;
      case "descend_path":
        if (progress.current_scene_key !== "cliff_overlook") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir atteint le bord de la falaise.");
        }
        nextScene = "cliff_foot";
        await client.query(
          `INSERT INTO character_inventory_bags (character_id, bag_code, capacity, is_equipped)
           VALUES ($1, 'initial_woven_bag', 5, TRUE)
           ON CONFLICT (character_id, bag_code) DO NOTHING`,
          [input.characterId]
        );
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "sac_initial_trouve",
          sourceKey: "initial_exploration"
        });
        break;
      case "discover_water_source":
        if (progress.current_scene_key !== "berries_collected") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir exploré les environs après la découverte des baies.");
        }
        nextScene = "water_source_found";
        await client.query(
          `INSERT INTO character_survival_progress (character_id, first_water_source_discovered_at)
           VALUES ($1, NOW())
           ON CONFLICT (character_id) DO UPDATE
             SET first_water_source_discovered_at = COALESCE(character_survival_progress.first_water_source_discovered_at, NOW()),
                 updated_at = NOW()`,
          [input.characterId]
        );
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "source_eau_decouverte",
          sourceKey: "initial_survival"
        });
        break;
      case "drink_from_hands":
        if (progress.current_scene_key !== "water_source_found") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir trouvé une source d'eau.");
        }
        await client.query(
          `UPDATE character_needs
           SET thirst_percent = 100, updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        await client.query(
          `UPDATE character_survival_progress
           SET first_drink_at = COALESCE(first_drink_at, NOW()), updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        nextScene = "thirst_restored";
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premiere_eau_bue",
          sourceKey: "initial_survival"
        });
        break;
      case "gather_canteen_plants":
        if (progress.current_scene_key !== "thirst_restored") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir bu à la source.");
        }
        const plantBagResult = await client.query<{ id: string; capacity: number }>(
          `SELECT id, capacity FROM character_inventory_bags
           WHERE character_id = $1 AND is_equipped = TRUE FOR UPDATE`,
          [input.characterId]
        );
        const plantBag = plantBagResult.rows[0];
        if (!plantBag) throw new InvalidExplorationActionError("Tu n'as pas de sac équipé.");
        const plantCount = await client.query<{ count: number }>(
          `SELECT COUNT(*)::integer AS count FROM character_inventory_slots WHERE bag_id = $1`,
          [plantBag.id]
        );
        const plantSlots = Number(plantCount.rows[0]?.count ?? 0);
        if (plantSlots >= plantBag.capacity) throw new InvalidExplorationActionError("Ton sac est plein.");
        const gatheredFibers = await client.query<{ id: string }>(
          `INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity)
           VALUES ($1, $2, 'braiding_plant_fibers', 1)
           RETURNING id`,
          [plantBag.id, plantSlots + 1]
        );
        const gatheredFiberSlotId = gatheredFibers.rows[0]?.id;
        if (!gatheredFiberSlotId) throw new InvalidExplorationActionError("Les fibres n'ont pas pu être ajoutées au sac.");
        await addInventoryItemLot(client, {
          inventorySlotId: gatheredFiberSlotId,
          itemCode: "braiding_plant_fibers",
          quantity: 1,
          origin: { originType: "collection", sourceReference: "initial_canteen_plants", occurredAt: new Date() }
        });
        await client.query(
          `UPDATE character_survival_progress
           SET initial_canteen_recipe_unlocked_at = COALESCE(initial_canteen_recipe_unlocked_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        nextScene = "plants_gathered";
        break;
      case "craft_initial_canteen":
        if (progress.current_scene_key !== "plants_gathered") {
          throw new InvalidExplorationActionError("Tu dois d'abord rassembler les plantes nécessaires.");
        }
        const craftBagResult = await client.query<{ id: string; capacity: number }>(
          `SELECT id, capacity FROM character_inventory_bags
           WHERE character_id = $1 AND is_equipped = TRUE FOR UPDATE`,
          [input.characterId]
        );
        const craftBag = craftBagResult.rows[0];
        if (!craftBag) throw new InvalidExplorationActionError("Tu n'as pas de sac équipé.");
        const fiberResult = await client.query<{ id: string; slot_number: number }>(
          `SELECT id, slot_number FROM character_inventory_slots
           WHERE bag_id = $1 AND item_code = 'braiding_plant_fibers' FOR UPDATE`,
          [craftBag.id]
        );
        const fibers = fiberResult.rows[0];
        if (!fibers) throw new InvalidExplorationActionError("Il te manque les plantes nécessaires à la fabrication.");
        await consumeInventoryItemLots(client, {
          inventorySlotId: fibers.id,
          itemCode: "braiding_plant_fibers",
          quantity: 1
        });
        await client.query(
          `UPDATE character_inventory_slots
           SET item_code = 'woven_canteen_level_1', quantity = 1, created_at = NOW()
           WHERE id = $1`,
          [fibers.id]
        );
        await addCraftedItemLot(client, {
          inventorySlotId: fibers.id,
          itemCode: "woven_canteen_level_1",
          quantity: 1,
          recipeKey: "initial_canteen"
        });
        await client.query(
          `UPDATE character_survival_progress
           SET initial_canteen_crafted_at = COALESCE(initial_canteen_crafted_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        nextScene = "canteen_crafted";
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premiere_gourde_fabriquee",
          sourceKey: "initial_survival"
        });
        break;
      case "seek_shelter":
        if (progress.current_scene_key !== "canteen_crafted") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir fabriqué ta première gourde.");
        }
        nextScene = "cave_found";
        await client.query(
          `UPDATE character_survival_progress
           SET first_cave_discovered_at = COALESCE(first_cave_discovered_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "grotte_decouverte",
          sourceKey: "initial_survival"
        });
        break;
      case "enter_cave":
        if (progress.current_scene_key !== "cave_found") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir repéré la grotte.");
        }
        nextScene = "cave_shelter";
        await client.query(
          `UPDATE character_survival_progress
           SET first_cave_shelter_at = COALESCE(first_cave_shelter_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "abri_grotte_installe",
          sourceKey: "initial_survival"
        });
        break;
      case "light_campfire":
        if (progress.current_scene_key !== "cave_shelter") {
          throw new InvalidExplorationActionError("Tu dois d'abord être à l'abri dans la grotte.");
        }
        nextScene = "campfire_lit";
        await client.query(
          `UPDATE character_survival_progress
           SET first_campfire_lit_at = COALESCE(first_campfire_lit_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        await client.query(
          `INSERT INTO character_skill_progress (character_id, skill_key, level, experience)
           VALUES ($1, 'fire_mastery', 1, 0)
           ON CONFLICT (character_id, skill_key) DO UPDATE
             SET level = GREATEST(character_skill_progress.level, 1),
                 updated_at = NOW()`,
          [input.characterId]
        );
        await client.query(
          `INSERT INTO character_unlocked_features (character_id, feature_key)
           VALUES ($1, 'cooking')
           ON CONFLICT (character_id, feature_key) DO NOTHING`,
          [input.characterId]
        );
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premier_feu_allume",
          sourceKey: "initial_survival"
        });
        break;
      case "roast_local_berries":
        if (progress.current_scene_key !== "campfire_lit") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir allumé le feu.");
        }
        const cookingBagResult = await client.query<{ id: string }>(
          `SELECT id FROM character_inventory_bags
           WHERE character_id = $1 AND is_equipped = TRUE FOR UPDATE`,
          [input.characterId]
        );
        const cookingBag = cookingBagResult.rows[0];
        if (!cookingBag) throw new InvalidExplorationActionError("Tu n'as pas de sac équipé.");
        const berriesResult = await client.query<{ id: string }>(
          `SELECT id FROM character_inventory_slots
           WHERE bag_id = $1 AND item_code = 'unidentified_local_berries' FOR UPDATE`,
          [cookingBag.id]
        );
        const berries = berriesResult.rows[0];
        if (!berries) {
          throw new InvalidExplorationActionError("Tu n'as plus de baies locales dans ton sac à faire cuire.");
        }
        await consumeInventoryItemLots(client, {
          inventorySlotId: berries.id,
          itemCode: "unidentified_local_berries",
          quantity: 1
        });
        await client.query(
          `UPDATE character_inventory_slots
           SET item_code = 'roasted_local_berries', created_at = NOW()
           WHERE id = $1`,
          [berries.id]
        );
        await addInventoryItemLot(client, {
          inventorySlotId: berries.id,
          itemCode: "roasted_local_berries",
          quantity: 1,
          origin: { originType: "crafting", sourceReference: "initial_berry_roasting", occurredAt: new Date() }
        });
        await client.query(
          `UPDATE character_survival_progress
           SET first_food_cooked_at = COALESCE(first_food_cooked_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        nextScene = "berries_roasted";
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premieres_baies_cuites",
          sourceKey: "initial_survival"
        });
        break;
      case "wake_after_first_night":
        if (progress.current_scene_key !== "berries_roasted") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir passé ta première nuit dans la grotte.");
        }
        nextScene = "morning_outside_cave";
        await client.query(
          `UPDATE character_survival_progress
           SET first_morning_after_shelter_at = COALESCE(first_morning_after_shelter_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premier_matin_apres_nuit",
          sourceKey: "initial_survival"
        });
        break;
      case "discover_nearby_ruins":
        if (progress.current_scene_key !== "morning_outside_cave") {
          throw new InvalidExplorationActionError("Tu dois d'abord être sorti de la grotte au matin.");
        }
        nextScene = "ruins_found";
        await client.query(
          `UPDATE character_survival_progress
           SET first_ruins_discovered_at = COALESCE(first_ruins_discovered_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premieres_ruines_decouvertes",
          sourceKey: "initial_exploration"
        });
        break;
      case "explore_ruins":
        if (progress.current_scene_key !== "ruins_found") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir découvert les ruines.");
        }
        const ruinsBagResult = await client.query<{ id: string; capacity: number }>(
          `SELECT id, capacity FROM character_inventory_bags
           WHERE character_id = $1 AND is_equipped = TRUE FOR UPDATE`,
          [input.characterId]
        );
        const ruinsBag = ruinsBagResult.rows[0];
        if (!ruinsBag) throw new InvalidExplorationActionError("Tu n'as pas de sac équipé.");
        const ruinsSlotsResult = await client.query<{ count: number }>(
          `SELECT COUNT(*)::integer AS count FROM character_inventory_slots WHERE bag_id = $1`,
          [ruinsBag.id]
        );
        const ruinsUsedSlots = Number(ruinsSlotsResult.rows[0]?.count ?? 0);
        if (ruinsUsedSlots >= ruinsBag.capacity) {
          throw new InvalidExplorationActionError("Ton sac est plein. Tu ne peux pas emporter les fragments trouvés.");
        }
        const discoveredFragment = await client.query<{ id: string }>(
          `INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity)
           VALUES ($1, $2, 'unidentified_history_fragment', 1)
           RETURNING id`,
          [ruinsBag.id, ruinsUsedSlots + 1]
        );
        const fragmentSlotId = discoveredFragment.rows[0]?.id;
        if (!fragmentSlotId) throw new InvalidExplorationActionError("Le fragment n'a pas pu être ajouté au sac.");
        await addInventoryItemLot(client, {
          inventorySlotId: fragmentSlotId,
          itemCode: "unidentified_history_fragment",
          quantity: 1,
          origin: { originType: "discovery", sourceReference: "nearby_ruins", occurredAt: new Date() }
        });
        await client.query(
          `UPDATE character_survival_progress
           SET first_ruins_explored_at = COALESCE(first_ruins_explored_at, NOW()),
               first_history_fragments_collected_at = COALESCE(first_history_fragments_collected_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        nextScene = "ruins_explored";
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premiers_fragments_histoire_trouves",
          sourceKey: "initial_exploration"
        });
        break;
      case "return_to_cave":
        if (progress.current_scene_key !== "ruins_explored") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir exploré les ruines.");
        }
        await client.query(
          `INSERT INTO character_temporary_camps (character_id, camp_code, shelter_type, status)
           VALUES ($1, 'initial_cave_camp', 'cave', 'temporary')
           ON CONFLICT (character_id, camp_code) DO UPDATE
             SET status = 'temporary', updated_at = NOW()`,
          [input.characterId]
        );
        await client.query(
          `UPDATE character_survival_progress
           SET first_temporary_camp_established_at = COALESCE(first_temporary_camp_established_at, NOW()),
               updated_at = NOW()
           WHERE character_id = $1`,
          [input.characterId]
        );
        nextScene = "temporary_camp_established";
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premier_camp_temporaire_installe",
          sourceKey: "initial_survival"
        });
        break;
      case "collect_local_berries":
        if (progress.current_scene_key !== "cliff_foot") {
          throw new InvalidExplorationActionError("Tu dois d'abord avoir découvert les baies au pied de la falaise.");
        }
        const bagResult = await client.query<{ id: string; capacity: number }>(
          `SELECT id, capacity
           FROM character_inventory_bags
           WHERE character_id = $1 AND is_equipped = TRUE
           FOR UPDATE`,
          [input.characterId]
        );
        const bag = bagResult.rows[0];
        if (!bag) throw new InvalidExplorationActionError("Tu n'as pas encore trouvé de sac pour transporter les baies.");

        const existingBerry = await client.query(
          `SELECT 1 FROM character_inventory_slots
           WHERE bag_id = $1 AND item_code = 'unidentified_local_berries'`,
          [bag.id]
        );
        if (existingBerry.rowCount) {
          throw new InvalidExplorationActionError("Tu as déjà recueilli un premier échantillon de ces baies.");
        }

        const used = await client.query<{ count: number }>(
          `SELECT COUNT(*)::integer AS count
           FROM character_inventory_slots
           WHERE bag_id = $1`,
          [bag.id]
        );
        const usedSlots = Number(used.rows[0]?.count ?? 0);
        if (usedSlots >= bag.capacity) {
          throw new InvalidExplorationActionError("Ton sac est plein.");
        }

        const collectedBerries = await client.query<{ id: string }>(
          `INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity)
           VALUES ($1, $2, 'unidentified_local_berries', 1)
           RETURNING id`,
          [bag.id, usedSlots + 1]
        );
        const berrySlotId = collectedBerries.rows[0]?.id;
        if (!berrySlotId) throw new InvalidExplorationActionError("Les baies n'ont pas pu être ajoutées au sac.");
        await addInventoryItemLot(client, {
          inventorySlotId: berrySlotId,
          itemCode: "unidentified_local_berries",
          quantity: 1,
          origin: { originType: "collection", sourceReference: "initial_local_berries", occurredAt: new Date() }
        });
        nextScene = "berries_collected";
        await recordQuestMilestoneInTransaction(client, {
          eventId: randomUUID(),
          characterId: input.characterId,
          questKey: INITIAL_QUEST_KEY,
          milestoneKey: "premieres_baies_recoltees",
          sourceKey: "initial_exploration"
        });
        break;
      default:
        throw new InvalidExplorationActionError();
    }

    const updated = await client.query<ExplorationRow>(
      `UPDATE character_exploration_progress
       SET current_scene_key = $2, updated_at = NOW()
       WHERE character_id = $1
       RETURNING current_scene_key, updated_at`,
      [input.characterId, nextScene]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error("La progression d'exploration n'a pas pu être enregistrée.");

    await client.query(
      `INSERT INTO character_exploration_events (
         event_id, character_id, action_key, scene_before, scene_after
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [interactionId, input.characterId, input.action, progress.current_scene_key, nextScene]
    );

    if (input.action === "listen_wind" && nextScene === "wind_perceived") {
      await recordQuestMilestoneInTransaction(client, {
        eventId: randomUUID(),
        characterId: input.characterId,
        questKey: INITIAL_QUEST_KEY,
        milestoneKey: "vent_percu",
        sourceKey: "initial_exploration"
      });
    }

    if (input.action === "follow_wind" && nextScene === "cliff_overlook") {
      await recordQuestMilestoneInTransaction(client, {
        eventId: randomUUID(),
        characterId: input.characterId,
        questKey: INITIAL_QUEST_KEY,
        milestoneKey: "point_de_vue_atteint",
        sourceKey: "initial_exploration"
      });
    }

    const bag = await getBagSummary(client, input.characterId);
    const needs = await client.query<NeedsRow>(
      `SELECT thirst_percent, hunger_percent FROM character_needs WHERE character_id = $1`,
      [input.characterId]
    );
    const values = needs.rows[0] ?? { thirst_percent: 100, hunger_percent: 100 };
    await client.query("COMMIT");
    return {
      scene: updatedRow.current_scene_key,
      updatedAt: updatedRow.updated_at,
      bagCapacity: bag.capacity,
      bagUsedSlots: bag.usedSlots,
      thirstPercent: values.thirst_percent,
      hungerPercent: values.hunger_percent
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
