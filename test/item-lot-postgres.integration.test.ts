import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL garantit la cohérence réelle des lots du sac et du camp", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const schema = `etheria_lots_${randomUUID().replaceAll("-", "")}`;

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);

    await client.query(`
      CREATE TABLE character_inventory_bags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
      CREATE TABLE character_inventory_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bag_id UUID NOT NULL REFERENCES character_inventory_bags(id) ON DELETE CASCADE,
        slot_number INTEGER NOT NULL,
        item_code TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        UNIQUE (bag_id, slot_number),
        UNIQUE (bag_id, item_code)
      );
      CREATE TABLE character_temporary_camps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
      CREATE TABLE character_temporary_camp_storage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        camp_id UUID NOT NULL REFERENCES character_temporary_camps(id) ON DELETE CASCADE,
        item_code TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        UNIQUE (camp_id, item_code)
      );
    `);

    const bag = await client.query<{ id: string }>(
      "INSERT INTO character_inventory_bags DEFAULT VALUES RETURNING id"
    );
    const slot = await client.query<{ id: string }>(
      "INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity) VALUES ($1, 1, 'braiding_plant_fibers', 5) RETURNING id",
      [bag.rows[0]!.id]
    );
    const camp = await client.query<{ id: string }>(
      "INSERT INTO character_temporary_camps DEFAULT VALUES RETURNING id"
    );
    const storage = await client.query<{ id: string }>(
      "INSERT INTO character_temporary_camp_storage (camp_id, item_code, quantity) VALUES ($1, 'long_grass', 4) RETURNING id",
      [camp.rows[0]!.id]
    );

    const migration18 = await readFile(
      new URL("../src/database/migrations/0018_traceable_item_lots.sql", import.meta.url),
      "utf8"
    );
    const migration19 = await readFile(
      new URL("../src/database/migrations/0019_enforce_item_lot_totals.sql", import.meta.url),
      "utf8"
    );
    await client.query(migration18);
    await client.query(migration19);

    const backfill = await client.query<{ bag_total: string; camp_total: string }>(`
      SELECT
        (SELECT SUM(quantity)::text FROM character_item_lots WHERE inventory_slot_id = $1) AS bag_total,
        (SELECT SUM(quantity)::text FROM character_item_lots WHERE camp_storage_entry_id = $2) AS camp_total
    `, [slot.rows[0]!.id, storage.rows[0]!.id]);
    assert.equal(backfill.rows[0]?.bag_total, "5");
    assert.equal(backfill.rows[0]?.camp_total, "4");

    await client.query("BEGIN");
    await client.query(
      "UPDATE character_inventory_slots SET quantity = 6 WHERE id = $1",
      [slot.rows[0]!.id]
    );
    await client.query(
      "UPDATE character_item_lots SET quantity = 6 WHERE inventory_slot_id = $1",
      [slot.rows[0]!.id]
    );
    await client.query("COMMIT");

    await client.query("BEGIN");
    await client.query(
      "UPDATE character_inventory_slots SET quantity = 7 WHERE id = $1",
      [slot.rows[0]!.id]
    );
    await assert.rejects(
      client.query("COMMIT"),
      (error: { code?: string }) => error.code === "23514"
    );
    await client.query("ROLLBACK");

    await client.query("BEGIN");
    await client.query(
      "UPDATE character_item_lots SET item_code = 'wrong_item' WHERE inventory_slot_id = $1",
      [slot.rows[0]!.id]
    );
    await assert.rejects(
      client.query("COMMIT"),
      (error: { code?: string }) => error.code === "23514"
    );
    await client.query("ROLLBACK");

    await client.query("BEGIN");
    await client.query(
      "UPDATE character_temporary_camp_storage SET quantity = 5 WHERE id = $1",
      [storage.rows[0]!.id]
    );
    await assert.rejects(
      client.query("COMMIT"),
      (error: { code?: string }) => error.code === "23514"
    );
    await client.query("ROLLBACK");

    const fiberStorage = await client.query<{ id: string }>(
      "INSERT INTO character_temporary_camp_storage (camp_id, item_code, quantity) VALUES ($1, 'braiding_plant_fibers', 6) RETURNING id",
      [camp.rows[0]!.id]
    );

    await client.query("BEGIN");
    await client.query(
      "UPDATE character_item_lots SET inventory_slot_id = NULL, camp_storage_entry_id = $2, container_kind = 'temporary_camp_storage' WHERE inventory_slot_id = $1",
      [slot.rows[0]!.id, fiberStorage.rows[0]!.id]
    );
    await client.query(
      "DELETE FROM character_inventory_slots WHERE id = $1",
      [slot.rows[0]!.id]
    );
    await client.query("COMMIT");

    const newSlot = await client.query<{ id: string }>(
      "INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity) VALUES ($1, 1, 'braiding_plant_fibers', 2) RETURNING id",
      [bag.rows[0]!.id]
    );
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO character_item_lots (item_code, quantity, container_kind, inventory_slot_id, origin_type, origin_reference) VALUES ('braiding_plant_fibers', 2, 'character_bag', $1, 'collection', 'test-source')",
      [newSlot.rows[0]!.id]
    );
    await client.query(
      "UPDATE character_temporary_camp_storage SET quantity = 5 WHERE id = $1",
      [fiberStorage.rows[0]!.id]
    );
    await client.query(
      "UPDATE character_inventory_slots SET quantity = 3 WHERE id = $1",
      [newSlot.rows[0]!.id]
    );
    await client.query(
      "UPDATE character_item_lots SET quantity = 5 WHERE camp_storage_entry_id = $1",
      [fiberStorage.rows[0]!.id]
    );
    await client.query(
      "INSERT INTO character_item_lots (item_code, quantity, container_kind, inventory_slot_id, origin_type, origin_reference) VALUES ('braiding_plant_fibers', 1, 'character_bag', $1, 'collection', 'test-source')",
      [newSlot.rows[0]!.id]
    );
    await client.query("COMMIT");

    const finalTotals = await client.query<{
      bag_quantity: number;
      bag_lots: string;
      camp_quantity: number;
      camp_lots: string;
    }>(`
      SELECT
        (SELECT quantity FROM character_inventory_slots WHERE id = $1) AS bag_quantity,
        (SELECT SUM(quantity)::text FROM character_item_lots WHERE inventory_slot_id = $1) AS bag_lots,
        (SELECT quantity FROM character_temporary_camp_storage WHERE id = $2) AS camp_quantity,
        (SELECT SUM(quantity)::text FROM character_item_lots WHERE camp_storage_entry_id = $2) AS camp_lots
    `, [newSlot.rows[0]!.id, fiberStorage.rows[0]!.id]);
    assert.equal(finalTotals.rows[0]?.bag_quantity, 3);
    assert.equal(finalTotals.rows[0]?.bag_lots, "3");
    assert.equal(finalTotals.rows[0]?.camp_quantity, 5);
    assert.equal(finalTotals.rows[0]?.camp_lots, "5");
  } finally {
    try {
      await client.query("ROLLBACK");
      await client.query("RESET search_path");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      client.release();
      await pool.end();
    }
  }
});
