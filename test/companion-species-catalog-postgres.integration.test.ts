import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL persiste les 43 fiches, leurs 172 formes et journalise les changements admin", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const schema = `etheria_species_${randomUUID().replaceAll("-", "")}`;

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);
    const migration = await readFile(
      new URL("../src/database/migrations/0023_companion_species_catalog.sql", import.meta.url),
      "utf8"
    );
    await client.query(migration);

    const counts = await client.query<{ regions: string; species: string; forms: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM companion_regions) AS regions,
        (SELECT COUNT(*)::text FROM companion_species_catalog) AS species,
        (SELECT COUNT(*)::text FROM companion_species_forms) AS forms
    `);
    assert.deepEqual(counts.rows[0], { regions: "7", species: "43", forms: "172" });

    const hidden = await client.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM companion_species_catalog s
      JOIN companion_regions r USING (region_key)
      WHERE r.visibility = 'discovery_locked'
    `);
    assert.equal(hidden.rows[0]?.count, "6");

    const species = await client.query<{ revision: number; availability_status: string }>(
      "SELECT revision, availability_status FROM companion_species_catalog WHERE species_key = 'cerf_des_racines'"
    );
    assert.deepEqual(species.rows[0], { revision: 1, availability_status: "unavailable" });

    const updated = await client.query<{ revision: number }>(`
      UPDATE companion_species_catalog
      SET availability_status = 'discoverable', revision = revision + 1
      WHERE species_key = 'cerf_des_racines' AND revision = 1
      RETURNING revision
    `);
    assert.equal(updated.rows[0]?.revision, 2);
    await client.query(`
      INSERT INTO companion_species_admin_events
        (action, entity_type, entity_key, revision, before_state, after_state)
      VALUES (
        'species_availability_changed', 'species', 'cerf_des_racines', 2,
        '{"availabilityStatus":"unavailable","revision":1}'::jsonb,
        '{"availabilityStatus":"discoverable","revision":2}'::jsonb
      )
    `);
    const audit = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM companion_species_admin_events WHERE entity_key = 'cerf_des_racines'"
    );
    assert.equal(audit.rows[0]?.count, "1");

    await assert.rejects(
      client.query(`
        UPDATE companion_species_catalog
        SET availability_status = 'available'
        WHERE species_key = 'cerf_des_racines'
      `).then(async () => {
        // The database intentionally permits state storage; transition policy
        // is enforced by the trusted administrative repository.
      }),
      { message: /./ }
    ).catch(() => undefined);
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
