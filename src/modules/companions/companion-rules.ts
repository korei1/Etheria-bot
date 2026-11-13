/**
 * Règles métier communes des compagnons Etheria.
 *
 * Ce module reste indépendant de Discord et de PostgreSQL.
 * Les données propres à chaque espèce (élément imposé, conditions spéciales,
 * maturité et santé) sont fournies par le catalogue et les services appelants.
 */

export const COMPANION_RARITIES = [
  "commun",
  "peu_commun",
  "rare",
  "tres_rare",
  "epique",
  "legendaire",
  "mythique"
] as const;

export type CompanionRarity = (typeof COMPANION_RARITIES)[number];

export const COMPANION_ELEMENTS = [
  "eau",
  "feu",
  "electrique",
  "terre",
  "air",
  "magie",
  "psy",
  "ombre"
] as const;

export type CompanionElement = (typeof COMPANION_ELEMENTS)[number];

const rarityRank: Record<CompanionRarity, number> = {
  commun: 1,
  peu_commun: 2,
  rare: 3,
  tres_rare: 4,
  epique: 5,
  legendaire: 6,
  mythique: 7
};

/**
 * Relations de faiblesse validées pour le tableau élémentaire commun.
 * En reproduction, une paire liée par une relation de faiblesse est
 * incompatible pour les raretés soumises à cette règle.
 * Ombre/Psy n'est pas une relation de faiblesse.
 */
const incompatibleBreedingPairs = new Set<string>([
  "eau:feu",
  "feu:terre",
  "electrique:terre",
  "eau:electrique",
  "air:ombre",
  "magie:ombre",
  "magie:psy"
]);

function pairKey(first: CompanionElement, second: CompanionElement): string {
  return [first, second].sort().join(":");
}

export class CompanionRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionRuleError";
  }
}

export function isCompanionRarity(value: string): value is CompanionRarity {
  return (COMPANION_RARITIES as readonly string[]).includes(value);
}

export function isCompanionElement(value: string): value is CompanionElement {
  return (COMPANION_ELEMENTS as readonly string[]).includes(value);
}

/** Le seuil Rare correspond au troisième rang de rareté. */
export function isRareOrHigher(rarity: CompanionRarity): boolean {
  return rarityRank[rarity] >= rarityRank.rare;
}

/**
 * Les espèces achetables dans la boutique Discord sont les seules dont
 * l'élément peut être choisi. Pour toutes les autres, l'espèce l'impose.
 */
export function resolveCompanionElement(input: {
  isDiscordShopSpecies: boolean;
  speciesElement: CompanionElement;
  selectedElement?: CompanionElement | null;
}): CompanionElement {
  if (input.isDiscordShopSpecies) {
    if (!input.selectedElement) {
      throw new CompanionRuleError("Un élément doit être choisi pour cette espèce de la boutique Discord.");
    }
    return input.selectedElement;
  }

  if (input.selectedElement && input.selectedElement !== input.speciesElement) {
    throw new CompanionRuleError("L'élément de cette espèce est imposé et ne peut pas être modifié.");
  }
  return input.speciesElement;
}

/** Vrai si la paire ne présente aucune faiblesse élémentaire entre ses éléments. */
export function areBreedingElementsCompatible(
  first: CompanionElement,
  second: CompanionElement
): boolean {
  return !incompatibleBreedingPairs.has(pairKey(first, second));
}

/**
 * Vérifie la compatibilité élémentaire des parents.
 * L'exception des raretés importantes est transmise explicitement par l'appelant :
 * le seuil est validé, mais son application exacte aux deux parents ou à la
 * descendance n'est pas encore spécifiée dans les règles du projet.
 */
export function canBreedWithElementCombination(input: {
  firstElement: CompanionElement;
  secondElement: CompanionElement;
  freeCombinationAllowed: boolean;
}): boolean {
  return input.freeCombinationAllowed ||
    areBreedingElementsCompatible(input.firstElement, input.secondElement);
}

export interface BreedingParentState {
  speciesKey: string;
  healthSufficient: boolean;
  maturityReached: boolean;
  speciesConditionsSatisfied: boolean;
}

export type BreedingEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | "different_species"
        | "insufficient_health"
        | "not_mature"
        | "species_conditions_not_met"
        | "incompatible_elements";
    };

/** Contrôle les conditions communes sans inventer les seuils propres aux espèces. */
export function evaluateBreedingEligibility(input: {
  first: BreedingParentState;
  second: BreedingParentState;
  firstElement: CompanionElement;
  secondElement: CompanionElement;
  freeCombinationAllowed: boolean;
}): BreedingEligibility {
  if (!input.first.speciesKey || input.first.speciesKey !== input.second.speciesKey) {
    return { eligible: false, reason: "different_species" };
  }
  if (!input.first.healthSufficient || !input.second.healthSufficient) {
    return { eligible: false, reason: "insufficient_health" };
  }
  if (!input.first.maturityReached || !input.second.maturityReached) {
    return { eligible: false, reason: "not_mature" };
  }
  if (!input.first.speciesConditionsSatisfied || !input.second.speciesConditionsSatisfied) {
    return { eligible: false, reason: "species_conditions_not_met" };
  }
  if (!canBreedWithElementCombination({
    firstElement: input.firstElement,
    secondElement: input.secondElement,
    freeCombinationAllowed: input.freeCombinationAllowed
  })) {
    return { eligible: false, reason: "incompatible_elements" };
  }
  return { eligible: true };
}

/** Maximum validé : quatre compagnons d'une même espèce par joueur. */
export function canAcquireSpeciesCompanion(currentOwnedCount: number): boolean {
  return Number.isInteger(currentOwnedCount) &&
    currentOwnedCount >= 0 &&
    currentOwnedCount < 4;
}

export function assertSpeciesCompanionCapacity(currentOwnedCount: number): void {
  if (!canAcquireSpeciesCompanion(currentOwnedCount)) {
    throw new CompanionRuleError("La limite de quatre compagnons de cette espèce est atteinte.");
  }
}
