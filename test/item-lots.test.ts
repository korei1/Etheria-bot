import assert from "node:assert/strict";
import test from "node:test";
import {
  createItemLot,
  mergeItemLots,
  moveItemLot,
  splitItemLot,
  InvalidItemLotError
} from "../src/modules/inventory/item-lots.js";

const baseLot = () => createItemLot({
  lotId: "lot-original",
  itemCode: "braiding_plant_fibers",
  quantity: 8,
  container: { kind: "character_bag", containerId: "bag-1", slotNumber: 2 },
  state: {
    qualityKey: "quality-test",
    provenance: {
      originType: "collection",
      sourceReference: "collection-event-1",
      occurredAt: "2026-11-12T20:00:00.000Z"
    }
  }
});

test("un lot conserve code, quantité, contenant et provenance", () => {
  const lot = baseLot();
  assert.equal(lot.itemCode, "braiding_plant_fibers");
  assert.equal(lot.quantity, 8);
  assert.equal(lot.state?.provenance?.sourceReference, "collection-event-1");
});

test("un lot invalide est refusé", () => {
  assert.throws(() => createItemLot({
    lotId: " ",
    itemCode: "braiding_plant_fibers",
    quantity: 1,
    container: { kind: "character_bag", containerId: "bag-1", slotNumber: 1 }
  }), InvalidItemLotError);
});

test("la séparation conserve l'état et la provenance sur les deux lots", () => {
  const result = splitItemLot(baseLot(), 3, "lot-separated");
  assert.equal(result.remaining?.quantity, 5);
  assert.equal(result.separated.quantity, 3);
  assert.equal(result.separated.state?.provenance?.sourceReference, "collection-event-1");
  assert.equal(result.remaining?.state?.qualityKey, "quality-test");
  assert.notEqual(result.remaining?.lotId, result.separated.lotId);
});

test("la séparation de tout le lot ne laisse aucun reste", () => {
  const result = splitItemLot(baseLot(), 8, "lot-separated");
  assert.equal(result.remaining, null);
  assert.equal(result.separated.quantity, 8);
});

test("une séparation hors quantité est refusée", () => {
  assert.throws(() => splitItemLot(baseLot(), 9, "lot-separated"), InvalidItemLotError);
});

test("le déplacement conserve identité, état et provenance", () => {
  const moved = moveItemLot(baseLot(), {
    kind: "temporary_camp_storage",
    containerId: "camp-storage-1"
  });
  assert.equal(moved.lotId, "lot-original");
  assert.equal(moved.container.kind, "temporary_camp_storage");
  assert.equal(moved.state?.provenance?.sourceReference, "collection-event-1");
});

test("la fusion reste interdite sans règle canonique d'empilement", () => {
  assert.throws(() => mergeItemLots(), InvalidItemLotError);
});
