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

export const COMPANION_SPECIES_ORIGINS = ["real_world", "fantasy", "hybrid"] as const;
export type CompanionSpeciesOrigin = (typeof COMPANION_SPECIES_ORIGINS)[number];

export const IUCN_CONSERVATION_CATEGORIES = [
  "not_evaluated",
  "data_deficient",
  "least_concern",
  "near_threatened",
  "vulnerable",
  "endangered",
  "critically_endangered",
  "extinct_in_the_wild",
  "extinct"
] as const;
export type IucnConservationCategory = (typeof IUCN_CONSERVATION_CATEGORIES)[number];

export interface RealWorldConservationAssessment {
  system: "iucn_red_list";
  category: IucnConservationCategory;
  authority: string;
  sourceName: string;
  sourceUrl: string;
  assessedAt: string;
  /** Facultatif : une protection légale peut dépendre du pays ou de la région. */
  jurisdiction?: string;
}

export const ETHERIA_CONSERVATION_STATUSES = [
  "unassessed",
  "stable",
  "monitored",
  "protected",
  "vulnerable",
  "endangered",
  "critical",
  "extinct_in_the_wild"
] as const;
export type EtheriaConservationStatus = (typeof ETHERIA_CONSERVATION_STATUSES)[number];

export interface EtheriaConservationRecord {
  status: EtheriaConservationStatus;
  regionKey?: string;
  notes?: string;
}

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

/** Variantes naturelles acceptées pour les espèces qui les possèdent. */
export const COMPANION_NATURAL_VARIANT_TYPES = [
  "chromatic",
  "morphological",
  "regional",
  "climatic",
  "genetic"
] as const;

export type CompanionNaturalVariantType =
  (typeof COMPANION_NATURAL_VARIANT_TYPES)[number];

/**
 * La rareté d'une espèce peut varier selon la région et l'habitat.
 * Une entrée décrit une présence connue dans un contexte précis.
 */
export interface CompanionRegionalOccurrence {
  regionKey: string;
  habitatKey: string;
  rarity: CompanionRarity;
}

/** Variante naturelle documentée pour une espèce donnée. */
export interface CompanionNaturalVariantDefinition {
  key: string;
  name: string;
  type: CompanionNaturalVariantType;
  description?: string;
}

/**
 * Transmission explicite d'une combinaison de variantes parentales.
 * Les règles sont propres à l'espèce. Aucun taux, dominant/récessif ou
 * résultat n'est déduit automatiquement par le moteur.
 */
export interface CompanionVariantInheritanceRule {
  firstParentVariantKey: string;
  secondParentVariantKey: string;
  resultingVariantKey: string;
}

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
  origin: CompanionSpeciesOrigin;
  category: CompanionSpeciesCategory;
  rarity: CompanionRarity;
  acquisitionMethods: readonly CompanionSpeciesAcquisitionMethod[];
  /** Seules les espèces vendues dans la boutique Discord autorisent ce choix. */
  discordShopElementChoice: boolean;
  /** Obligatoire pour une espèce dont l'élément n'est pas choisi en boutique. */
  fixedElement?: CompanionElement;
  /** Répartition connue ; la rareté régionale prévaut en cas de correspondance. */
  regionalOccurrences?: readonly CompanionRegionalOccurrence[];
  /** Données réelles sourcées ; distinctes de la protection légale locale. */
  realWorldConservation?: RealWorldConservationAssessment;
  /** Statut de conservation dans l'univers Etheria, indépendant du réel. */
  etheriaConservation?: EtheriaConservationRecord;
  /** Variantes naturelles propres à cette espèce. */
  naturalVariants?: readonly CompanionNaturalVariantDefinition[];
  /** Règles de transmission explicites, propres à cette espèce. */
  variantInheritanceRules?: readonly CompanionVariantInheritanceRule[];
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
const originSet = new Set<string>(COMPANION_SPECIES_ORIGINS);
const iucnCategorySet = new Set<string>(IUCN_CONSERVATION_CATEGORIES);
const etheriaStatusSet = new Set<string>(ETHERIA_CONSERVATION_STATUSES);
const raritySet = new Set<string>(COMPANION_RARITIES);
const elementSet = new Set<string>(COMPANION_ELEMENTS);
const acquisitionSet = new Set<string>(COMPANION_ACQUISITION_METHODS);
const naturalVariantTypeSet = new Set<string>(COMPANION_NATURAL_VARIANT_TYPES);

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
  if (!originSet.has(definition.origin)) {
    issues.push(`[${prefix}] Origine d'espèce inconnue.`);
  }
  if (definition.origin === "fantasy" && definition.realWorldConservation) {
    issues.push(`[${prefix}] Une espèce purement fantastique ne peut pas avoir d'évaluation réelle IUCN.`);
  }
  if (definition.realWorldConservation) {
    const assessment = definition.realWorldConservation;
    if (!iucnCategorySet.has(assessment.category)) {
      issues.push(`[${prefix}] Catégorie IUCN inconnue.`);
    }
    if (!assessment.authority.trim() || !assessment.sourceName.trim() ||
      !/^https:\/\//.test(assessment.sourceUrl)) {
      issues.push(`[${prefix}] L'évaluation réelle exige une autorité, une source et une URL HTTPS.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assessment.assessedAt) ||
      !Number.isFinite(Date.parse(assessment.assessedAt))) {
      issues.push(`[${prefix}] Date d'évaluation réelle invalide.`);
    }
  }
  if (definition.etheriaConservation &&
    !etheriaStatusSet.has(definition.etheriaConservation.status)) {
    issues.push(`[${prefix}] Statut de conservation Etheria inconnu.`);
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

  const occurrenceKeys = new Set<string>();
  for (const occurrence of definition.regionalOccurrences ?? []) {
    const key = `${occurrence.regionKey}:${occurrence.habitatKey}`;
    if (!/^[a-z][a-z0-9_]*$/.test(occurrence.regionKey) ||
      !/^[a-z][a-z0-9_]*$/.test(occurrence.habitatKey)) {
      issues.push(`[${prefix}] Région ou habitat invalide : ${key}.`);
    }
    if (!raritySet.has(occurrence.rarity)) {
      issues.push(`[${prefix}] Rareté régionale inconnue pour ${key}.`);
    }
    if (occurrenceKeys.has(key)) {
      issues.push(`[${prefix}] Occurrence région/habitat dupliquée : ${key}.`);
    }
    occurrenceKeys.add(key);
  }

  const variantKeys = new Set<string>();
  for (const variant of definition.naturalVariants ?? []) {
    if (!/^[a-z][a-z0-9_]*$/.test(variant.key) || !variant.name.trim()) {
      issues.push(`[${prefix}] Définition de variante invalide : ${variant.key}.`);
    }
    if (!naturalVariantTypeSet.has(variant.type)) {
      issues.push(`[${prefix}] Type de variante inconnu : ${variant.type}.`);
    }
    if (variantKeys.has(variant.key)) {
      issues.push(`[${prefix}] Variante dupliquée : ${variant.key}.`);
    }
    variantKeys.add(variant.key);
  }

  const inheritanceRules = definition.variantInheritanceRules ?? [];
  const inheritanceRuleKeys = new Set<string>();
  for (const rule of inheritanceRules) {
    const key = [rule.firstParentVariantKey, rule.secondParentVariantKey].sort().join(":");
    if (!variantKeys.has(rule.firstParentVariantKey) ||
      !variantKeys.has(rule.secondParentVariantKey) ||
      !variantKeys.has(rule.resultingVariantKey)) {
      issues.push(`[${prefix}] Une règle héréditaire référence une variante inconnue : ${key}.`);
    }
    if (inheritanceRuleKeys.has(key)) {
      issues.push(`[${prefix}] Règle héréditaire parentale dupliquée : ${key}.`);
    }
    inheritanceRuleKeys.add(key);
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
 * Retourne la rareté déclarée pour une région et un habitat précis.
 * Sans correspondance exacte, la rareté générale de l'espèce est conservée.
 */
export function getCompanionRegionalRarity(
  definition: CompanionSpeciesDefinition,
  regionKey: string,
  habitatKey: string
): CompanionRarity {
  return definition.regionalOccurrences?.find(
    (occurrence) =>
      occurrence.regionKey === regionKey && occurrence.habitatKey === habitatKey
  )?.rarity ?? definition.rarity;
}

/** Résout uniquement les combinaisons héréditaires définies par l'espèce. */
export function resolveInheritedNaturalVariant(
  definition: CompanionSpeciesDefinition,
  firstParentVariantKey: string,
  secondParentVariantKey: string
): string | undefined {
  const parentKeys = [firstParentVariantKey, secondParentVariantKey].sort();
  return definition.variantInheritanceRules?.find((rule) => {
    const ruleKeys = [rule.firstParentVariantKey, rule.secondParentVariantKey].sort();
    return ruleKeys[0] === parentKeys[0] && ruleKeys[1] === parentKeys[1];
  })?.resultingVariantKey;
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
