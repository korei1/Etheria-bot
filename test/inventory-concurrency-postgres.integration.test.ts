import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("un verrou de personnage sérialise deux retraits concurrents", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const setup = await pool.connect();
  const first = await pool.connect();
  const second = await pool.connect();
  const schema = `etheria_concurrency_${randomUUID().replaceAll("-", "")}`;

  try {
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.query(`SET search_path TO "${schema}", public`);
    await setup.query(`
      CREATE TABLE characters (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE inventory (
        character_id UUID PRIMARY KEY REFERENCES characters(id),
        quantity INTEGER NOT NULL CHECK (quantity >= 0)
      );
    `);
    const characterId = randomUUID();
    await setup.query(
      "INSERT INTO characters (id, account_id, status) VALUES ($1, $2, 'active')",
      [characterId, randomUUID()]
    );
    await setup.query(
      "INSERT INTO inventory (character_id, quantity) VALUES ($1, 1)",
      [characterId]
    );

    await first.query(`SET search_path TO "${schema}", public`);
    await second.query(`SET search_path TO "${schema}", public`);

    await first.query("BEGIN");
    await first.query(
      "SELECT id FROM characters WHERE id = $1 AND status = 'active' FOR UPDATE",
      [characterId]
    );

    await second.query("BEGIN");
    const secondAttempt = (async () => {
      await second.query(
        "SELECT id FROM characters WHERE id = $1 AND status = 'active' FOR UPDATE",
        [characterId]
      );
      const stock = await second.query<{ quantity: number }>(
        "SELECT quantity FROM inventory WHERE character_id = $1 FOR UPDATE",
        [characterId]
      );
      if (Number(stock.rows[0]?.quantity ?? 0) < 1) {
        await second.query("ROLLBACK");
        return false;
      }
      await second.query(
        "UPDATE inventory SET quantity = quantity - 1 WHERE character_id = $1",
        [characterId]
      );
      await second.query("COMMIT");
      return true;
    })();

    const firstStock = await first.query<{ quantity: number }>(
      "SELECT quantity FROM inventory WHERE character_id = $1 FOR UPDATE",
      [characterId]
    );
    assert.equal(firstStock.rows[0]?.quantity, 1);
    await first.query(
      "UPDATE inventory SET quantity = quantity - 1 WHERE character_id = $1",
      [characterId]
    );
    await first.query("COMMIT");

    assert.equal(await secondAttempt, false);
    const final = await setup.query<{ quantity: number }>(
      "SELECT quantity FROM inventory WHERE character_id = $1",
      [characterId]
    );
    assert.equal(final.rows[0]?.quantity, 0);
  } finally {
    await first.query("ROLLBACK").catch(() => undefined);
    await second.query("ROLLBACK").catch(() => undefined);
    await setup.query("RESET search_path").catch(() => undefined);
    await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    first.release();
    second.release();
    setup.release();
    await pool.end();
  }
});
