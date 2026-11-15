/**
 * Règles pures d'alimentation et de repos des compagnons Etheria.
 *
 * Aucun taux de diminution de faim/soif, seuil de santé, durée de maladie
 * ou effet non validé n'est défini ici.
 */

export const COMPANION_ENERGY_MAX = 100;
export const REST_RECOVERY_INTERVAL_MS = 30 * 60 * 1000;
export const REST_ENERGY_PER_INTERVAL = 10;
export const CHRONIC_FATIGUE_ENERGY_PER_INTERVAL = 5;
export const FREE_RATION_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export const FOOD_RARITIES = [
  "commun",
  "peu_commun",
  "rare",
  "epique",
  "exclusif"
] as const;

export type FoodRarity = (typeof FOOD_RARITIES)[number];

export const FOOD_PRICES: Readonly<Record<FoodRarity, number>> = {
  commun: 50,
  peu_commun: 100,
  rare: 200,
  epique: 350,
  exclusif: 500
};

export class CompanionCareRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionCareRuleError";
  }
}

function assertPercentage(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new CompanionCareRuleError(label + " doit être compris entre 0 et 100.");
  }
}

function assertValidDate(value: Date, label: string): void {
  if (!Number.isFinite(value.getTime())) {
    throw new CompanionCareRuleError(label + " est invalide.");
  }
}

export function canClaimFreeRation(
  lastClaimAt: Date | null,
  now: Date
): boolean {
  assertValidDate(now, "La date actuelle");
  if (lastClaimAt === null) return true;
  assertValidDate(lastClaimAt, "La date de la dernière ration");
  const elapsed = now.getTime() - lastClaimAt.getTime();
  return elapsed >= FREE_RATION_COOLDOWN_MS;
}

/**
 * Une ration gratuite remplit normalement la jauge de faim.
 * Les troubles digestifs réduisent son efficacité de moitié.
 * La valeur désigne les points ajoutés à la jauge, avec plafond à 100.
 */
export function applyFreeRation(input: {
  currentHunger: number;
  hasDigestiveDisorder: boolean;
}): number {
  assertPercentage(input.currentHunger, "La faim");
  const restoration = input.hasDigestiveDisorder ? 50 : 100;
  return Math.min(100, input.currentHunger + restoration);
}

/** Un aliment acheté restaure toujours la jauge de faim à 100 %. */
export function applyPurchasedFood(currentHunger: number): number {
  assertPercentage(currentHunger, "La faim");
  return 100;
}

/**
 * Vérifie que l'aliment correspond à la catégorie de rareté alimentaire
 * autorisée pour ce compagnon. Le mapping espèce/rareté est fourni par
 * le catalogue et n'est pas inventé dans ce module.
 */
export function canFeedWithFoodRarity(input: {
  foodRarity: FoodRarity;
  allowedFoodRarity: FoodRarity;
}): boolean {
  return input.foodRarity === input.allowedFoodRarity;
}

export function getFoodPrice(rarity: FoodRarity): number {
  return FOOD_PRICES[rarity];
}

export interface RestRecoveryResult {
  energy: number;
  processedIntervals: number;
  nextRecoveryAt: Date;
}

/**
 * Calcule la récupération depuis le dernier instant déjà traité.
 * Les intervalles incomplets sont conservés : le prochain passage peut
 * reprendre exactement au même cycle, y compris après une période hors ligne.
 */
export function calculateRestRecovery(input: {
  currentEnergy: number;
  lastProcessedAt: Date;
  now: Date;
  hasChronicFatigue: boolean;
}): RestRecoveryResult {
  assertPercentage(input.currentEnergy, "L'énergie");
  assertValidDate(input.lastProcessedAt, "Le dernier instant traité");
  assertValidDate(input.now, "La date actuelle");

  if (input.now.getTime() < input.lastProcessedAt.getTime()) {
    throw new CompanionCareRuleError("La date actuelle ne peut pas précéder le dernier instant traité.");
  }

  const elapsed = input.now.getTime() - input.lastProcessedAt.getTime();
  const processedIntervals = Math.floor(elapsed / REST_RECOVERY_INTERVAL_MS);
  const energyPerInterval = input.hasChronicFatigue
    ? CHRONIC_FATIGUE_ENERGY_PER_INTERVAL
    : REST_ENERGY_PER_INTERVAL;

  return {
    energy: Math.min(
      COMPANION_ENERGY_MAX,
      input.currentEnergy + processedIntervals * energyPerInterval
    ),
    processedIntervals,
    nextRecoveryAt: new Date(
      input.lastProcessedAt.getTime() + processedIntervals * REST_RECOVERY_INTERVAL_MS
    )
  };
}

/** Un compagnon ne peut pas être changé tant que son repos est actif. */
export function canSwitchCompanion(isCurrentCompanionResting: boolean): boolean {
  return !isCurrentCompanionResting;
}

/**
 * Un refus de changement ne modifie pas l'état du repos.
 * Le service appelant conserve donc le dernier instant traité et le repos
 * continue normalement jusqu'à son arrêt explicite.
 */
export function assertCanSwitchCompanion(isCurrentCompanionResting: boolean): void {
  if (!canSwitchCompanion(isCurrentCompanionResting)) {
    throw new CompanionCareRuleError("Impossible de changer de compagnon pendant son repos.");
  }
}
