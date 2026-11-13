import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFreeRation,
  applyPurchasedFood,
  calculateRestRecovery,
  canClaimFreeRation,
  canFeedWithFoodRarity,
  canSwitchCompanion,
  assertCanSwitchCompanion,
  getFoodPrice,
  FREE_RATION_COOLDOWN_MS,
  REST_RECOVERY_INTERVAL_MS,
  CompanionCareRuleError
} from "../src/modules/companions/companion-care-rules.js";

const date = (milliseconds: number) => new Date(milliseconds);

test("la ration gratuite est disponible toutes les 48 heures", () => {
  const claimedAt = date(1_000_000);
  assert.equal(canClaimFreeRation(null, claimedAt), true);
  assert.equal(canClaimFreeRation(claimedAt, date(claimedAt.getTime() + FREE_RATION_COOLDOWN_MS - 1)), false);
  assert.equal(canClaimFreeRation(claimedAt, date(claimedAt.getTime() + FREE_RATION_COOLDOWN_MS)), true);
});

test("une date future ou invalide ne permet pas de réclamer une ration", () => {
  const now = date(1_000_000);
  assert.equal(canClaimFreeRation(date(1_000_001), now), false);
  assert.throws(() => canClaimFreeRation(null, new Date(Number.NaN)), CompanionCareRuleError);
});

test("la ration remplit la faim sauf en cas de troubles digestifs", () => {
  assert.equal(applyFreeRation({ currentHunger: 20, hasDigestiveDisorder: false }), 100);
  assert.equal(applyFreeRation({ currentHunger: 20, hasDigestiveDisorder: true }), 70);
  assert.equal(applyFreeRation({ currentHunger: 80, hasDigestiveDisorder: true }), 100);
});

test("un aliment acheté restaure la faim à 100 %", () => {
  assert.equal(applyPurchasedFood(0), 100);
  assert.equal(applyPurchasedFood(75), 100);
});

test("les aliments respectent la rareté autorisée et leurs prix canoniques", () => {
  assert.equal(canFeedWithFoodRarity({ foodRarity: "rare", allowedFoodRarity: "rare" }), true);
  assert.equal(canFeedWithFoodRarity({ foodRarity: "rare", allowedFoodRarity: "epique" }), false);
  assert.deepEqual(
    ["commun", "peu_commun", "rare", "epique", "exclusif"].map(getFoodPrice),
    [50, 100, 200, 350, 500]
  );
});

test("le repos récupère 10 énergie toutes les 30 minutes", () => {
  const start = date(0);
  const result = calculateRestRecovery({
    currentEnergy: 20,
    lastProcessedAt: start,
    now: date(REST_RECOVERY_INTERVAL_MS * 3),
    hasChronicFatigue: false
  });
  assert.equal(result.energy, 50);
  assert.equal(result.processedIntervals, 3);
  assert.equal(result.nextRecoveryAt.getTime(), REST_RECOVERY_INTERVAL_MS * 3);
});

test("la fatigue chronique réduit la récupération à 5 énergie par intervalle", () => {
  const result = calculateRestRecovery({
    currentEnergy: 20,
    lastProcessedAt: date(0),
    now: date(REST_RECOVERY_INTERVAL_MS * 2),
    hasChronicFatigue: true
  });
  assert.equal(result.energy, 30);
  assert.equal(result.processedIntervals, 2);
});

test("le repos hors ligne rattrape les intervalles complets et conserve le reliquat", () => {
  const result = calculateRestRecovery({
    currentEnergy: 40,
    lastProcessedAt: date(0),
    now: date(REST_RECOVERY_INTERVAL_MS * 2 + 12_000),
    hasChronicFatigue: false
  });
  assert.equal(result.energy, 60);
  assert.equal(result.processedIntervals, 2);
  assert.equal(result.nextRecoveryAt.getTime(), REST_RECOVERY_INTERVAL_MS * 2);
});

test("l'énergie ne dépasse jamais 100", () => {
  const result = calculateRestRecovery({
    currentEnergy: 95,
    lastProcessedAt: date(0),
    now: date(REST_RECOVERY_INTERVAL_MS * 4),
    hasChronicFatigue: false
  });
  assert.equal(result.energy, 100);
});

test("un temps inversé ou une énergie invalide est refusé", () => {
  assert.throws(() => calculateRestRecovery({
    currentEnergy: 20,
    lastProcessedAt: date(10),
    now: date(0),
    hasChronicFatigue: false
  }), CompanionCareRuleError);
  assert.throws(() => calculateRestRecovery({
    currentEnergy: 101,
    lastProcessedAt: date(0),
    now: date(REST_RECOVERY_INTERVAL_MS),
    hasChronicFatigue: false
  }), CompanionCareRuleError);
});

test("un compagnon en repos ne peut pas être remplacé", () => {
  assert.equal(canSwitchCompanion(false), true);
  assert.equal(canSwitchCompanion(true), false);
  assert.throws(() => assertCanSwitchCompanion(true), CompanionCareRuleError);
});
