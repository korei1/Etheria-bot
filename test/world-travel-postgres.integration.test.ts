import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import test from "node:test";
import {
  listAvailableCharacterTravelRoutes,
  travelCharacter
} from "../src/modules/world/travel-service.js";
import { getPersistedDiscoveryState } from "../src/modules/world/discovery-repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL déplace un personnage sur un itinéraire approuvé et révèle la destination à l'arrivée", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const setup = await pool.connect();
  const schema = `etheria_travel_${randomUUID().replaceAll("-", "")}`;
  let appPool: Pool | undefined;
  const accountId = randomUUID();
  const characterId = randomUUID();
  const spawnZoneId = randomUUID();
  const countryId = randomUUID();
  const hiddenSettlementId = randomUUID();
  const nextSettlementId = randomUUID();

  try {
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.query(`SET search_path TO "${schema}", public`);
    await setup.query("CREATE TABLE accounts (id UUID PRIMARY KEY)");
    await setup.query("CREATE TABLE countries (id UUID PRIMARY KEY, display_name TEXT NOT NULL)");
    await setup.query(`CREATE TABLE starting_spawn_zones (
      id UUID PRIMARY KEY,
      zone_key TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )`);
    await setup.query(`CREATE TABLE world_settlements (
      id UUID PRIMARY KEY,
      settlement_key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      visibility TEXT NOT NULL,
      editorial_status TEXT NOT NULL
    )`);
    await setup.query(`CREATE TABLE characters (
      id UUID PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id),
      spawn_zone_id UUID NOT NULL REFERENCES starting_spawn_zones(id),
      current_settlement_id UUID REFERENCES world_settlements(id),
      status TEXT NOT NULL
    )`);
    await setup.query("INSERT INTO accounts (id) VALUES ($1)", [accountId]);
    await setup.query("INSERT INTO countries (id, display_name) VALUES ($1, 'Pays de test')", [countryId]);
    await setup.query(
      "INSERT INTO starting_spawn_zones (id, zone_key, is_active) VALUES ($1, 'wild_start', TRUE)",
      [spawnZoneId]
    );
    await setup.query(
      `INSERT INTO world_settlements
       (id, settlement_key, display_name, visibility, editorial_status)
       VALUES
         ($1, 'hidden_village', 'Village caché', 'discovery_locked', 'approved'),
         ($2, 'known_town', 'Ville connue', 'public', 'approved')`,
      [hiddenSettlementId, nextSettlementId]
    );
    await setup.query(
      `INSERT INTO characters (id, account_id, spawn_zone_id, current_settlement_id, status)
       VALUES ($1, $2, $3, NULL, 'active')`,
      [characterId, accountId, spawnZoneId]
    );

    const discoveryMigration = await readFile(
      new URL("../src/database/migrations/0026_world_discoveries.sql", import.meta.url),
      "utf8"
    );
    await setup.query(discoveryMigration);
    const travelMigration = await readFile(
      new URL("../src/database/migrations/0029_world_travel_links.sql", import.meta.url),
      "utf8"
    );
    await setup.query(travelMigration);

    await setup.query(
      `INSERT INTO world_travel_links
       (link_key, display_name, from_spawn_zone_id, to_settlement_id,
        mode, link_type, bidirectional, visibility, editorial_status)
       VALUES ('wild_to_hidden', 'Sentier des voyageurs', $1, $2,
               'land', 'trail', FALSE, 'public', 'approved')`,
      [spawnZoneId, hiddenSettlementId]
    );
    await setup.query(
      `INSERT INTO world_travel_links
       (link_key, display_name, from_settlement_id, to_settlement_id,
        mode, link_type, bidirectional, visibility, editorial_status)
       VALUES ('hidden_to_town', 'Route des collines', $1, $2,
               'land', 'road', TRUE, 'public', 'approved')`,
      [hiddenSettlementId, nextSettlementId]
    );

    appPool = new Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schema},public`,
      max: 4
    });

    const initialRoutes = await listAvailableCharacterTravelRoutes(appPool, { accountId });
    assert.equal(initialRoutes.length, 1);
    assert.equal(initialRoutes[0]?.destinationLabel, "Destination inconnue");

    const firstTravel = await travelCharacter(appPool, {
      interactionId: "discord-travel-1001",
      accountId,
      characterId,
      linkKey: "wild_to_hidden"
    });
    assert.equal(firstTravel.status, "traveled");
    assert.equal(firstTravel.destinationName, "Village caché");

    const repeatedTravel = await travelCharacter(appPool, {
      interactionId: "discord-travel-1001",
      accountId,
      characterId,
      linkKey: "wild_to_hidden"
    });
    assert.equal(repeatedTravel.status, "duplicate_event");

    const afterArrival = await appPool.query<{ current_settlement_id: string | null }>(
      "SELECT current_settlement_id FROM characters WHERE id = $1",
      [characterId]
    );
    assert.equal(afterArrival.rows[0]?.current_settlement_id, hiddenSettlementId);

    const discoveries = await getPersistedDiscoveryState(appPool, accountId);
    assert.equal(discoveries.records.some((entry) =>
      entry.targetKind === "settlement" && entry.targetKey === "hidden_village"
    ), true);
    assert.equal(discoveries.records.some((entry) =>
      entry.targetKind === "travel_link" && entry.targetKey === "wild_to_hidden"
    ), true);

    const nextRoutes = await listAvailableCharacterTravelRoutes(appPool, { accountId });
    assert.equal(nextRoutes.length, 1);
    assert.equal(nextRoutes[0]?.destinationLabel, "Ville connue");

    const secondTravel = await travelCharacter(appPool, {
      interactionId: "discord-travel-1002",
      accountId,
      characterId,
      linkKey: "hidden_to_town"
    });
    assert.equal(secondTravel.destinationName, "Ville connue");
    assert.equal(secondTravel.status, "traveled");
  } finally {
    await appPool?.end();
    await setup.query("ROLLBACK").catch(() => undefined);
    await setup.query("RESET search_path").catch(() => undefined);
    await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    setup.release();
    await pool.end();
  }
});
