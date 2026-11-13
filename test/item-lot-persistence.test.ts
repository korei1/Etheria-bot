import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import {
  addInventoryItemLot,
  consumeInventoryItemLots,
  movePartialCampStorageLotsToInventory
} from "../src/modules/inventory/item-lot-persistence.js";

interface QueryCall {
  sql: string;
  values?: unknown[];
}

function createFakeClient(
  respond: (sql: string, values?: unknown[]) => unknown[] = () => []
) {
  const calls: QueryCall[] = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      const rows = respond(sql.replace(/\s+/g, " ").trim().toLowerCase(), values);
      return {
        rows,
        rowCount: rows.length,
        command: "SELECT",
        oid: 0,
        fields: []
      };
    }
  } as unknown as PoolClient;

  return { client, calls };
}

test("la création d'un lot conserve sa provenance dans les paramètres SQL", async () => {
  const db = createFakeClient((sql) =>
    sql.startsWith("insert into character_item_lots") ? [{ id: "lot-created" }] : []
  );

  const lotId = await addInventoryItemLot(db.client, {
    inventorySlotId: "slot-1",
    itemCode: "braiding_plant_fibers",
    quantity: 4,
    origin: {
      originType: "collection",
      sourceReference: "world-source-42",
      occurredAt: new Date("2026-11-13T10:00:00.000Z")
    }
  });

  assert.equal(lotId, "lot-created");
  assert.deepEqual(db.calls[0]?.values, [
    "braiding_plant_fibers",
    4,
    "slot-1",
    "collection",
    "world-source-42",
    new Date("2026-11-13T10:00:00.000Z")
  ]);
});

test("la consommation retire les lots FIFO et ne modifie que le reliquat du dernier lot", async () => {
  const db = createFakeClient((sql) => {
    if (sql.startsWith("select id, quantity from character_item_lots")) {
      return [
        { id: "lot-oldest", quantity: 2 },
        { id: "lot-next", quantity: 5 },
        { id: "lot-latest", quantity: 7 }
      ];
    }
    return [];
  });

  await consumeInventoryItemLots(db.client, {
    inventorySlotId: "slot-1",
    itemCode: "braiding_plant_fibers",
    quantity: 4
  });

  const deletes = db.calls.filter((call) => call.sql.trim().toLowerCase().startsWith("delete from character_item_lots"));
  const updates = db.calls.filter((call) => call.sql.trim().toLowerCase().startsWith("update character_item_lots"));
  assert.deepEqual(deletes.map((call) => call.values), [["lot-oldest"]]);
  assert.deepEqual(updates.map((call) => call.values), [["lot-next", 2]]);
  assert.equal(db.calls.length, 3);
});

test("la consommation refuse un stock de lots inférieur à la quantité demandée", async () => {
  const db = createFakeClient((sql) =>
    sql.startsWith("select id, quantity from character_item_lots")
      ? [{ id: "lot-only", quantity: 2 }]
      : []
  );

  await assert.rejects(
    consumeInventoryItemLots(db.client, {
      inventorySlotId: "slot-1",
      itemCode: "braiding_plant_fibers",
      quantity: 3
    }),
    /ne correspondent pas au stock disponible/
  );
  assert.equal(db.calls.length, 1);
});

test("un retrait partiel du camp déplace les lots entiers puis scinde le lot traversé", async () => {
  const db = createFakeClient((sql) => {
    if (sql.startsWith("select id, quantity, origin_type")) {
      return [
        {
          id: "lot-oldest",
          quantity: 2,
          origin_type: "discovery",
          origin_reference: "ruins-1",
          origin_occurred_at: new Date("2026-11-12T08:00:00.000Z"),
          instance_state: { qualityKey: "aged" }
        },
        {
          id: "lot-next",
          quantity: 3,
          origin_type: "collection",
          origin_reference: "source-2",
          origin_occurred_at: new Date("2026-11-12T09:00:00.000Z"),
          instance_state: { qualityKey: "fresh" }
        }
      ];
    }
    if (sql.startsWith("insert into character_item_lots")) {
      return [{ id: "lot-split" }];
    }
    return [];
  });

  await movePartialCampStorageLotsToInventory(db.client, {
    campStorageEntryId: "camp-entry-1",
    inventorySlotId: "slot-1",
    itemCode: "unidentified_history_fragment",
    quantity: 3
  });

  const moveWhole = db.calls.find((call) =>
    call.sql.includes("SET camp_storage_entry_id = NULL") &&
    call.sql.includes("WHERE id = $1")
  );
  const reducePartial = db.calls.find((call) =>
    call.sql.startsWith("update character_item_lots set quantity = quantity -")
  );
  const createSplit = db.calls.find((call) =>
    call.sql.startsWith("insert into character_item_lots")
  );

  assert.deepEqual(moveWhole?.values, ["lot-oldest", "slot-1"]);
  assert.deepEqual(reducePartial?.values, ["lot-next", 1]);
  assert.deepEqual(createSplit?.values, [
    "unidentified_history_fragment",
    1,
    "slot-1",
    JSON.stringify({ qualityKey: "fresh" }),
    "collection",
    "source-2",
    new Date("2026-11-12T09:00:00.000Z")
  ]);
});
