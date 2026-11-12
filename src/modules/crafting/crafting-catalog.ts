import type { CraftingRecipe } from "./crafting-types.js";
import { validateCraftingRecipe } from "./crafting-types.js";
import { getItemDefinition } from "../inventory/item-catalog.js";

/**
 * Registre central des recettes canoniques.
 *
 * Les codes d'objets sont les identifiants persistés dans l'inventaire.
 * Les ressources déjà présentes dans le parcours initial conservent leur code.
 */
export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
  {
    key: "grass_bedding_level_1",
    ingredients: [
      { itemCode: "long_flexible_grass", quantity: 12 },
      { itemCode: "large_resistant_leaves", quantity: 4 }
    ],
    output: { itemCode: "grass_bedding_level_1", quantity: 1 },
    requiredSceneKey: "temporary_camp_established"
  },
  {
    key: "woven_rope_level_1",
    ingredients: [
      { itemCode: "braiding_plant_fibers", quantity: 8 }
    ],
    output: { itemCode: "woven_rope_level_1", quantity: 1 },
    requiredSceneKey: "temporary_camp_established"
  },
  {
    key: "fragile_wooden_barrier_level_1",
    ingredients: [
      { itemCode: "sturdy_wooden_branches", quantity: 10 },
      { itemCode: "woven_rope_level_1", quantity: 3 }
    ],
    output: { itemCode: "fragile_wooden_barrier_level_1", quantity: 1 },
    requiredSceneKey: "temporary_camp_established"
  }
];

export function getCraftingRecipe(recipeKey: string): CraftingRecipe | undefined {
  return CRAFTING_RECIPES.find((recipe) => recipe.key === recipeKey);
}

export function validateCraftingCatalog(): string[] {
  const issues: string[] = [];
  const recipeKeys = new Set<string>();
  for (const recipe of CRAFTING_RECIPES) {
    if (recipeKeys.has(recipe.key)) issues.push("Clé de recette dupliquée : " + recipe.key);
    recipeKeys.add(recipe.key);
    for (const issue of validateCraftingRecipe(recipe)) {
      issues.push(issue.recipeKey + ": " + issue.message);
    }
    for (const itemCode of [
      ...recipe.ingredients.map((ingredient) => ingredient.itemCode),
      recipe.output.itemCode
    ]) {
      if (!getItemDefinition(itemCode)) {
        issues.push(recipe.key + ": objet absent du catalogue : " + itemCode);
      }
    }
  }
  return issues;
}
