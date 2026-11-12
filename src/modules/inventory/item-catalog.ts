/**
 * Catalogue central des identités d'objets déjà introduites dans Etheria.
 *
 * Il décrit uniquement leur identité technique et leur catégorie générale.
 * Il ne définit ni poids, valeur, empilabilité, durabilité, rareté, usages,
 * capacité, consommation ou disponibilité géographique.
 */
export type ItemCategory =
  | "resource"
  | "processed_item"
  | "crafted_object"
  | "discovery";

export interface ItemDefinition {
  readonly code: string;
  readonly label: string;
  readonly category: ItemCategory;
  /** Autorisation explicitement déjà définie pour le stockage du camp temporaire. */
  readonly temporaryCampStorage?: true;
}

export const ITEM_CATALOG: readonly ItemDefinition[] = [
  {
    code: "unidentified_local_berries",
    label: "Baies locales non identifiées",
    category: "resource"
  },
  {
    code: "roasted_local_berries",
    label: "Baies locales grillées",
    category: "processed_item"
  },
  {
    code: "braiding_plant_fibers",
    label: "Fibres végétales souples",
    category: "resource"
  },
  {
    code: "woven_canteen_level_1",
    label: "Gourde tressée N1",
    category: "crafted_object"
  },
  {
    code: "unidentified_history_fragment",
    label: "Fragment historique non identifié",
    category: "discovery",
    temporaryCampStorage: true
  },
  {
    code: "long_flexible_grass",
    label: "Herbes longues et souples",
    category: "resource"
  },
  {
    code: "large_resistant_leaves",
    label: "Grandes feuilles résistantes",
    category: "resource"
  },
  {
    code: "sturdy_wooden_branches",
    label: "Branches de bois solides",
    category: "resource"
  },
  {
    code: "grass_bedding_level_1",
    label: "Couchage d'herbe N1",
    category: "crafted_object"
  },
  {
    code: "woven_rope_level_1",
    label: "Corde tissée N1",
    category: "crafted_object"
  },
  {
    code: "fragile_wooden_barrier_level_1",
    label: "Barrière en bois fragile N1",
    category: "crafted_object"
  }
] as const;

const itemsByCode = new Map(ITEM_CATALOG.map((item) => [item.code, item]));

export function getItemDefinition(itemCode: string): ItemDefinition | undefined {
  return itemsByCode.get(itemCode);
}

export function validateItemCatalog(): string[] {
  const issues: string[] = [];
  const codes = new Set<string>();

  for (const item of ITEM_CATALOG) {
    if (!/^[a-z][a-z0-9_]*$/.test(item.code)) {
      issues.push("Code d'objet invalide : " + item.code);
    }
    if (!item.label.trim()) {
      issues.push("Nom affiché vide pour l'objet : " + item.code);
    }
    if (codes.has(item.code)) {
      issues.push("Code d'objet dupliqué : " + item.code);
    }
    codes.add(item.code);
  }

  return issues;
}
