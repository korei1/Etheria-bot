import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import test from "node:test";
import {
  advanceNpcTravelPlans,
  planNpcTravel
} from "../src/modules/npc/npc-travel-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL fait partir un PNJ puis l'installe à destination à la minute prévue", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const setup = await pool.connect();
  const schema = `etheria_npc_travel_${randomUUID().replaceAll("-", "")}`;
  let appPool: Pool | undefined;
  const npcKey = "traveler_test";
  const originId = randomUUID();
  const destinationId = randomUUID();

  try {
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.query(`SET search_path TO "${schema}", public`);
    await setup.query(`CREATE TABLE npc_definitions (
      npc_key TEXT PRIMARY KEY,
      editorial_status TEXT NOT NULL,
      is_active BOOLEAN NOT NULL
    )`);
    await setup.query(`CREATE TABLE world_settlements (
      id UUID PRIMARY KEY,
      editorial_status TEXT NOT NULL
    )`);
    await setup.query(`CREATE TABLE world_travel_links (
      link_key TEXT PRIMARY KEY,
      from_settlement_id UUID REFERENCES world_settlements(id),
      to_settlement_id UUID NOT NULL REFERENCES world_settlements(id),
      estimated_duration_minutes INTEGER,
      access_requirements TEXT[] NOT NULL DEFAULT '{}',
      editorial_status TEXT NOT NULL
    )`);
    await setup.query(`CREATE TABLE npc_settlement_locations (
      npc_key TEXT NOT NULL REFERENCES npc_definitions(npc_key),
      settlement_id UUID NOT NULL REFERENCES world_settlements(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY (npc_key, settlement_id)
    )`);
    await setup.query("INSERT INTO npc_definitions VALUES ($1, 'approved', TRUE)", [npcKey]);
    await setup.query(
      "INSERT INTO world_settlements (id, editorial_status) VALUES ($1, 'approved'), ($2, 'approved')",
      [originId, destinationId]
    );
    await setup.query(
      `INSERT INTO world_travel_links
       (link_key, from_settlement_id, to_settlement_id, estimated_duration_minutes, editorial_status)
       VALUES ('test_road', $1, $2, 45, 'approved')`,
      [originId, destinationId]
    );
    await setup.query(
      "INSERT INTO npc_settlement_locations (npc_key, settlement_id, is_active) VALUES ($1, $2, TRUE)",
      [npcKey, originId]
    );

    const migration = await readFile(
      new URL("../src/database/migrations/0035_npc_travel_plans.sql", import.meta.url),
      "utf8"
    );
    await setup.query(migration);
    appPool = new Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schema},public`,
      max: 4
    });

    const plan = await planNpcTravel(appPool, {
      npcKey,
      routeKey: "test_road",
      departureWorldMinute: 100
    });
    assert.equal(plan.arrivalWorldMinute, 145);

    assert.deepEqual(await advanceNpcTravelPlans(appPool, 99), { departed: 0, arrived: 0 });
    assert.deepEqual(await advanceNpcTravelPlans(appPool, 100), { departed: 1, arrived: 0 });

    const duringTrip = await appPool.query<{ is_active: boolean }>(
      "SELECT is_active FROM npc_settlement_locations WHERE npc_key = $1 AND settlement_id = $2",
      [npcKey, originId]
    );
    assert.equal(duringTrip.rows[0]?.is_active, false);

    assert.deepEqual(await advanceNpcTravelPlans(appPool, 144), { departed: 0, arrived: 0 });
    assert.deepEqual(await advanceNpcTravelPlans(appPool, 145), { departed: 0, arrived: 1 });

    const finalLocations = await appPool.query<{ settlement_id: string; is_active: boolean }>(
      "SELECT settlement_id, is_active FROM npc_settlement_locations WHERE npc_key = $1 ORDER BY settlement_id",
      [npcKey]
    );
    assert.equal(finalLocations.rows.find((row) => row.settlement_id === originId)?.is_active, false);
    assert.equal(finalLocations.rows.find((row) => row.settlement_id === destinationId)?.is_active, true);

    const events = await appPool.query<{ event_type: string }>(
      "SELECT event_type FROM npc_travel_events ORDER BY event_type"
    );
    assert.deepEqual(events.rows.map((row) => row.event_type), ["arrived", "departed"]);
  } finally {
    await appPool?.end();
    await setup.query("RESET search_path").catch(() => undefined);
    await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    setup.release();
    await pool.end();
  }
});
