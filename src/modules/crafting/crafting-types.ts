/**
 * Contrat de données de l'artisanat Etheria.
 * Les recettes concrètes restent absentes tant que leurs ingrédients,
 * quantités et conditions n'ont pas été validés dans le canon.
 */
export interface CraftingIngredient {
  readonly itemCode: string;
  readonly quantity: number;
}

export interface CraftingSkillRequirement {
  readonly skillKey: string;
  readonly minimumLevel: number;
}

export interface CraftingRecipe {
  readonly key: string;
  readonly ingredients: readonly CraftingIngredient[];
  readonly output: { readonly itemCode: string; readonly quantity: number };
  readonly requiredFeatureKey?: string;
  readonly requiredSkill?: CraftingSkillRequirement;
  readonly requiredSceneKey?: string;
  readonly progressionReward?: { readonly skillKey: string; readonly experience: number };
}

export interface CraftingRecipeValidationIssue {
  readonly recipeKey: string;
  readonly message: string;
}

/** Vérifie la structure sans inventer de ressources ni de règles. */
export function validateCraftingRecipe(recipe: CraftingRecipe): CraftingRecipeValidationIssue[] {
  const issues: CraftingRecipeValidationIssue[] = [];
  const add = (message: string): void => {
    issues.push({ recipeKey: recipe.key || "(sans identifiant)", message });
  };

  if (!recipe.key.trim()) add("La recette doit posséder une clé.");
  if (recipe.ingredients.length === 0) add("La recette doit déclarer au moins un ingrédient.");

  const ingredientCodes = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    if (!ingredient.itemCode.trim()) add("Un ingrédient possède un code vide.");
    if (!Number.isInteger(ingredient.quantity) || ingredient.quantity <= 0) {
      add("La quantité de l'ingrédient " + ingredient.itemCode + " doit être un entier positif.");
    }
    if (ingredientCodes.has(ingredient.itemCode)) {
      add("L'ingrédient " + ingredient.itemCode + " est déclaré plusieurs fois.");
    }
    ingredientCodes.add(ingredient.itemCode);
  }

  if (!recipe.output.itemCode.trim()) add("L'objet produit doit posséder un code.");
  if (!Number.isInteger(recipe.output.quantity) || recipe.output.quantity <= 0) {
    add("La quantité produite doit être un entier positif.");
  }
  if (recipe.requiredSceneKey !== undefined && !recipe.requiredSceneKey.trim()) {
    add("La scène requise doit posséder une clé.");
  }
  if (recipe.progressionReward) {
    if (!recipe.progressionReward.skillKey.trim()) add("La compétence récompensée doit posséder une clé.");
    if (!Number.isSafeInteger(recipe.progressionReward.experience) || recipe.progressionReward.experience <= 0) {
      add("L'expérience attribuée doit être un entier positif sûr.");
    }
  }
  if (recipe.requiredSkill) {
    if (!recipe.requiredSkill.skillKey.trim()) add("La compétence requise doit posséder une clé.");
    if (!Number.isInteger(recipe.requiredSkill.minimumLevel) || recipe.requiredSkill.minimumLevel <= 0) {
      add("Le niveau de compétence requis doit être un entier positif.");
    }
  }
  return issues;
}
