/**
 * Catalogue des espèces et profils individuels des compagnons Etheria.
 *
 * Le catalogue ne contient volontairement aucune espèce fictive par défaut :
 * les entrées sont ajoutées uniquement après validation de leurs données.
 * Les caractéristiques individuelles sont descriptives tant qu'un effet de
 * gameplay n'a pas été défini séparément.
 */
import {
  COMPANION_ELEMENTS,
  COMPANION_RARITIES,
  type CompanionElement,
  type CompanionRarity
} from "./companion-rules.js";

export const COMPANION_SPECIES_CATEGORIES = [
  "terrestrial",
  "aquatic",
  "flying",
  "reptile_amphibian",
  "insect_arthropod",
  "fantastic",
  "vegetal_elemental",
  "spirit_magical",
  "artificial",
  "hybrid"
] as const;

export type CompanionSpeciesCategory = (typeof COMPANION_SPECIES_CATEGORIES)[number];

export const COMPANION_ACQUISITION_METHODS = [
  "discord_shop",
  "wild_encounter",
  "adoption",
  "breeding",
  "quest",
  "event",
  "discovery",
  "reward",
  "trade",
  "gift"
] as const;

export type CompanionSpeciesAcquisitionMethod =
  (typeof COMPANION_ACQUISITION_METHODS)[number];

export type IndividualTraitDefinition =
  | {
      key: string;
      label: string;
      type: "text";
      description?: string;
    }
  | {
      key: string;
      label: string;
      type: "choice";
      values: readonly [string, ...string[]];
      description?: string;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      description?: string;
    };

export interface CompanionSpeciesDefinition {
  /** Identifiant technique stable, utilisé dans les sauvegardes. */
  key: string;
  /** Nom public de l'espèce. */
  name: string;
  category: CompanionSpeciesCategory;
  rarity: CompanionRarity;
  acquisitionMethods: readonly CompanionSpeciesAcquisitionMethod[];
  /** Seules les espèces vendues dans la boutique Discord autorisent ce choix. */
  discordShopElementChoice: boolean;
  /** Obligatoire pour une espèce dont l'élément n'est pas choisi en boutique. */
  fixedElement?: CompanionElement;
  /** Liste des caractéristiques descriptives pouvant varier entre individus. */
  individualTraits: readonly IndividualTraitDefinition[];
}

export type CompanionIndividualTraits = Readonly<Record<string, string | boolean>>;

export interface CompanionSpeciesCatalog {
  readonly species: ReadonlyMap<string, CompanionSpeciesDefinition>;
}

export class CompanionSpeciesCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionSpeciesCatalogError";
  }
}

const categorySet = new Set<string>(COMPANION_SPECIES_CATEGORIES);
const raritySet = new Set<string>(COMPANION_RARITIES);
const elementSet = new Set<string>(COMPANION_ELEMENTS);
const acquisitionSet = new Set<string>(COMPANION_ACQUISITION_METHODS);

export function validateCompanionSpeciesDefinition(
  definition: CompanionSpeciesDefinition
): string[] {
  const issues: string[] = [];
  const prefix = definition.key || "(espèce sans clé)";

  if (!/^[a-z][a-z0-9_]*$/.test(definition.key)) {
    issues.push(`[${prefix}] La clé doit être stable et au format snake_case.`);
  }
  if (!definition.name.trim()) {
    issues.push(`[${prefix}] Le nom public est obligatoire.`);
  }
  if (!categorySet.has(definition.category)) {
    issues.push(`[${prefix}] Catégorie inconnue.`);
  }
  if (!raritySet.has(definition.rarity)) {
    issues.push(`[${prefix}] Rareté inconnue.`);
  }
  if (definition.acquisitionMethods.length === 0) {
    issues.push(`[${prefix}] Au moins une méthode d'acquisition est nécessaire.`);
  }
  for (const method of definition.acquisitionMethods) {
    if (!acquisitionSet.has(method)) {
      issues.push(`[${prefix}] Méthode d'acquisition inconnue : ${method}.`);
    }
  }

  if (definition.discordShopElementChoice) {
    if (!definition.acquisitionMethods.includes("discord_shop")) {
      issues.push(`[${prefix}] Le choix d'élément exige une acquisition boutique Discord.`);
    }
    if (definition.fixedElement !== undefined) {
      issues.push(`[${prefix}] Une espèce à élément choisi ne peut pas imposer un élément fixe.`);
    }
  } else {
    if (!definition.fixedElement || !elementSet.has(definition.fixedElement)) {
      issues.push(`[${prefix}] Un élément fixe valide est obligatoire hors boutique Discord.`);
    }
  }

  const traitKeys = new Set<string>();
  for (const trait of definition.individualTraits) {
    if (!/^[a-z][a-z0-9_]*$/.test(trait.key)) {
      issues.push(`[${prefix}] Clé de caractéristique invalide : ${trait.key}.`);
    }
    if (!trait.label.trim()) {
      issues.push(`[${prefix}] Une caractéristique possède un libellé vide.`);
    }
    if (traitKeys.has(trait.key)) {
      issues.push(`[${prefix}] Caractéristique dupliquée : ${trait.key}.`);
    }
    traitKeys.add(trait.key);

    if (trait.type === "choice") {
      if (trait.values.length === 0 || trait.values.some((value) => !value.trim())) {
        issues.push(`[${prefix}] Les choix de ${trait.key} sont invalides.`);
      }
      if (new Set(trait.values).size !== trait.values.length) {
        issues.push(`[${prefix}] Les choix de ${trait.key} contiennent des doublons.`);
      }
    }
  }

  return issues;
}

export function createCompanionSpeciesCatalog(
  definitions: readonly CompanionSpeciesDefinition[]
): CompanionSpeciesCatalog {
  const issues: string[] = [];
  const species = new Map<string, CompanionSpeciesDefinition>();

  for (const definition of definitions) {
    issues.push(...validateCompanionSpeciesDefinition(definition));
    if (species.has(definition.key)) {
      issues.push(`[catalogue] Clé d'espèce dupliquée : ${definition.key}.`);
    } else {
      species.set(definition.key, definition);
    }
  }

  if (issues.length > 0) {
    throw new CompanionSpeciesCatalogError(issues.join("\n"));
  }
  return { species };
}

export function getCompanionSpecies(
  catalog: CompanionSpeciesCatalog,
  speciesKey: string
): CompanionSpeciesDefinition | undefined {
  return catalog.species.get(speciesKey);
}

/**
 * Valide les caractéristiques d'un individu contre les champs autorisés par
 * son espèce. Aucun effet de gameplay n'est déduit de ces valeurs.
 */
export function validateIndividualTraits(
  definition: CompanionSpeciesDefinition,
  traits: CompanionIndividualTraits
): string[] {
  const issues: string[] = [];
  const definitions = new Map(definition.individualTraits.map((trait) => [trait.key, trait]));

  for (const [key, value] of Object.entries(traits)) {
    const trait = definitions.get(key);
    if (!trait) {
      issues.push(`Caractéristique non autorisée pour ${definition.key} : ${key}.`);
      continue;
    }
    if (trait.type === "text" && (typeof value !== "string" || !value.trim())) {
      issues.push(`La caractéristique ${key} doit être un texte non vide.`);
    } else if (trait.type === "choice" &&
      (typeof value !== "string" || !trait.values.includes(value))) {
      issues.push(`Valeur non autorisée pour la caractéristique ${key}.`);
    } else if (trait.type === "boolean" && typeof value !== "boolean") {
      issues.push(`La caractéristique ${key} doit être booléenne.`);
    }
  }

  return issues;
}

export function assertValidIndividualTraits(
  definition: CompanionSpeciesDefinition,
  traits: CompanionIndividualTraits
): void {
  const issues = validateIndividualTraits(definition, traits);
  if (issues.length > 0) {
    throw new CompanionSpeciesCatalogError(issues.join("\n"));
  }
}
