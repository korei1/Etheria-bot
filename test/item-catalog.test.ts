import assert from "node:assert/strict";
import test from "node:test";
import {
  ITEM_CATALOG,
  getItemDefinition,
  validateItemCatalog
} from "../src/modules/inventory/item-catalog.js";
import { validateCraftingCatalog } from "../src/modules/crafting/crafting-catalog.js";

test("le catalogue central possède des codes uniques et valides", () => {
  assert.deepEqual(validateItemCatalog(), []);
  assert.equal(new Set(ITEM_CATALOG.map((item) => item.code)).size, ITEM_CATALOG.length);
});

test("toutes les ressources et sorties des recettes existent dans le catalogue", () => {
  assert.deepEqual(validateCraftingCatalog(), []);
});

test("seul le fragment historique a une autorisation de stockage du camp déjà définie", () => {
  const eligible = ITEM_CATALOG
    .filter((item) => item.temporaryCampStorage === true)
    .map((item) => item.code);

  assert.deepEqual(eligible, ["unidentified_history_fragment"]);
  assert.equal(getItemDefinition("unidentified_history_fragment")?.category, "discovery");
});

test("un code inconnu ne possède aucune définition", () => {
  assert.equal(getItemDefinition("not_an_etheria_item"), undefined);
});
