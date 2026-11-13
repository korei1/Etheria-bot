import assert from "node:assert/strict";
import test from "node:test";
import {
  areBreedingElementsCompatible,
  assertSpeciesCompanionCapacity,
  canAcquireSpeciesCompanion,
  canBreedWithElementCombination,
  evaluateBreedingEligibility,
  isRareOrHigher,
  resolveCompanionElement,
  CompanionRuleError
} from "../src/modules/companions/companion-rules.js";

test("seules les espèces de la boutique Discord autorisent le choix de l'élément", () => {
  assert.equal(resolveCompanionElement({
    isDiscordShopSpecies: true,
    speciesElement: "feu",
    selectedElement: "eau"
  }), "eau");
  assert.equal(resolveCompanionElement({
    isDiscordShopSpecies: false,
    speciesElement: "feu"
  }), "feu");
  assert.throws(() => resolveCompanionElement({
    isDiscordShopSpecies: false,
    speciesElement: "feu",
    selectedElement: "eau"
  }), CompanionRuleError);
  assert.throws(() => resolveCompanionElement({
    isDiscordShopSpecies: true,
    speciesElement: "feu"
  }), CompanionRuleError);
});

test("le seuil de rareté Rare est le troisième rang", () => {
  assert.equal(isRareOrHigher("commun"), false);
  assert.equal(isRareOrHigher("peu_commun"), false);
  assert.equal(isRareOrHigher("rare"), true);
  assert.equal(isRareOrHigher("mythique"), true);
});

test("les relations élémentaires incompatibles en reproduction sont communes et cohérentes", () => {
  assert.equal(areBreedingElementsCompatible("eau", "feu"), false);
  assert.equal(areBreedingElementsCompatible("feu", "terre"), false);
  assert.equal(areBreedingElementsCompatible("terre", "electrique"), false);
  assert.equal(areBreedingElementsCompatible("electrique", "eau"), false);
  assert.equal(areBreedingElementsCompatible("air", "ombre"), false);
  assert.equal(areBreedingElementsCompatible("magie", "ombre"), false);
  assert.equal(areBreedingElementsCompatible("psy", "magie"), false);
  assert.equal(areBreedingElementsCompatible("ombre", "psy"), true);
  assert.equal(areBreedingElementsCompatible("eau", "air"), true);
});

test("une combinaison normalement incompatible peut être autorisée explicitement", () => {
  assert.equal(canBreedWithElementCombination({
    firstElement: "eau",
    secondElement: "feu",
    freeCombinationAllowed: false
  }), false);
  assert.equal(canBreedWithElementCombination({
    firstElement: "eau",
    secondElement: "feu",
    freeCombinationAllowed: true
  }), true);
});

test("la reproduction exige la même espèce, une santé et une maturité suffisantes", () => {
  const validParent = {
    speciesKey: "species-a",
    healthSufficient: true,
    maturityReached: true,
    speciesConditionsSatisfied: true
  };
  assert.deepEqual(evaluateBreedingEligibility({
    first: validParent,
    second: { ...validParent },
    firstElement: "eau",
    secondElement: "air",
    freeCombinationAllowed: false
  }), { eligible: true });

  assert.deepEqual(evaluateBreedingEligibility({
    first: validParent,
    second: { ...validParent, speciesKey: "species-b" },
    firstElement: "eau",
    secondElement: "air",
    freeCombinationAllowed: false
  }), { eligible: false, reason: "different_species" });

  assert.deepEqual(evaluateBreedingEligibility({
    first: validParent,
    second: { ...validParent, maturityReached: false },
    firstElement: "eau",
    secondElement: "air",
    freeCombinationAllowed: false
  }), { eligible: false, reason: "not_mature" });
});

test("la limite de quatre compagnons s'applique à toutes les acquisitions", () => {
  assert.equal(canAcquireSpeciesCompanion(0), true);
  assert.equal(canAcquireSpeciesCompanion(3), true);
  assert.equal(canAcquireSpeciesCompanion(4), false);
  assert.equal(canAcquireSpeciesCompanion(-1), false);
  assert.equal(canAcquireSpeciesCompanion(1.5), false);
  assert.throws(() => assertSpeciesCompanionCapacity(4), CompanionRuleError);
});
