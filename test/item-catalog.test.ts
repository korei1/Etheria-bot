import assert from "node:assert/strict";
import test from "node:test";
import {
  ITEM_CATALOG,
  getItemDefinition,
  validateItemCatalog
} from "../src/modules/inventory/item-catalog.js";
import { validateCraftingCatalog } from "../src/modules/crafting/crafting-catalog.js";
import {
  createItemStack,
  createItemStackView,
  getItemDisplayName,
  InvalidItemStackError
} from "../src/modules/inventory/item-model.js";

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

test("un stock reprend un code catalogue et une quantité entière positive", () => {
  assert.deepEqual(createItemStack("braiding_plant_fibers", 3), {
    itemCode: "braiding_plant_fibers",
    quantity: 3
  });
});

test("le modèle refuse les codes inconnus et les quantités invalides", () => {
  assert.throws(() => createItemStack("unknown_item", 1), InvalidItemStackError);
  assert.throws(() => createItemStack("braiding_plant_fibers", 0), InvalidItemStackError);
  assert.throws(() => createItemStack("braiding_plant_fibers", 1.5), InvalidItemStackError);
});

test("une vue de stock relie définition, quantité et contenant sans inventer de propriété", () => {
  const view = createItemStackView("unidentified_history_fragment", 1, {
    kind: "character_bag",
    containerId: "bag-1",
    slotNumber: 2
  });
  assert.equal(view.definition.label, "Fragment historique non identifié");
  assert.deepEqual(view.stack, {
    itemCode: "unidentified_history_fragment",
    quantity: 1
  });
  assert.deepEqual(view.container, {
    kind: "character_bag",
    containerId: "bag-1",
    slotNumber: 2
  });
});

test("le nom d'affichage provient du catalogue central", () => {
  assert.equal(getItemDisplayName("woven_rope_level_1"), "Corde tissée N1");
});
