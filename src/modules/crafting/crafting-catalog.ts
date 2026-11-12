import type { CraftingRecipe } from "./crafting-types.js";
import { validateCraftingRecipe } from "./crafting-types.js";

/** Registre central des recettes canoniques. */
export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [];

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
  }
  return issues;
}
