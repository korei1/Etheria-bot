import assert from "node:assert/strict";
import testRunner from "node:test";
import {
  INITIAL_FANTASY_BESTIARY,
  INITIAL_FANTASY_BESTIARY_REGIONS,
  listVisibleInitialFantasyBestiary
} from "../src/modules/companions/initial-fantasy-bestiary.js";

testRunner("le catalogue initial contient exactement les 43 espèces réparties dans les sept régions", () => {
  assert.equal(INITIAL_FANTASY_BESTIARY_REGIONS.length, 7);
  assert.equal(INITIAL_FANTASY_BESTIARY.length, 43);
  const counts = new Map<string, number>();
  for (const entry of INITIAL_FANTASY_BESTIARY) {
    counts.set(entry.regionKey, (counts.get(entry.regionKey) ?? 0) + 1);
  }
  assert.deepEqual([...counts.values()], [6, 6, 6, 6, 7, 6, 6]);
});

testRunner("toutes les clés sont uniques et chaque espèce possède ses quatre formes et un élément", () => {
  const keys = INITIAL_FANTASY_BESTIARY.map((entry) => entry.key);
  assert.equal(new Set(keys).size, 43);
  for (const entry of INITIAL_FANTASY_BESTIARY) {
    assert.ok(entry.initialForm.trim());
    assert.ok(entry.youngForm.trim());
    assert.ok(entry.adultForm.trim());
    assert.ok(entry.elementalEvolution.trim());
    assert.ok(entry.element.trim());
  }
});

testRunner("les six espèces d'Umbrelune restent invisibles avant découverte", () => {
  assert.equal(
    listVisibleInitialFantasyBestiary(new Set()).length,
    37
  );
  assert.equal(
    listVisibleInitialFantasyBestiary(new Set(["umbrelune"])).length,
    43
  );
  assert.equal(
    listVisibleInitialFantasyBestiary(new Set()).some((entry) => entry.regionKey === "umbrelune"),
    false
  );
});

testRunner("les noms et éléments canoniques des espèces Sylvaria sont conservés", () => {
  const sylvaria = INITIAL_FANTASY_BESTIARY.filter((entry) => entry.regionKey === "sylvaria");
  assert.deepEqual(sylvaria.map((entry) => [entry.name, entry.element]), [
    ["Cerf des Racines", "terre"],
    ["Renard d'Ambre", "terre"],
    ["Hibou de Sylve", "terre"],
    ["Lièvre des Brumes", "air"],
    ["Lynx de Morcant", "ombre"],
    ["Biche aux Ramures Claires", "magie"]
  ]);
});

testRunner("les données de gameplay non définies ne sont pas inventées dans le catalogue éditorial", () => {
  for (const entry of INITIAL_FANTASY_BESTIARY) {
    assert.equal("rarity" in entry, false);
    assert.equal("acquisitionMethods" in entry, false);
    assert.equal("habitats" in entry, false);
    assert.equal("abilities" in entry, false);
  }
});
