import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import test from "node:test";
import {
  getPersistedDiscoveryState,
  recordPersistedWorldDiscovery
} from "../src/modules/world/discovery-repository.js";
import type { DiscoveryTargetDefinition } from "../src/modules/world/discovery.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL conserve les découvertes par compte et journalise les événements de façon idempotente", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const schema = `etheria_discovery_${randomUUID().replaceAll("-", "")}`;
  let repositoryPool: Pool | undefined;
  const accountOne = randomUUID();
  const accountTwo = randomUUID();
  const discoveredAt = "2026-11-13T12:00:00.000Z";

  const publicSettlement: DiscoveryTargetDefinition = {
    key: "settlement_alpha",
    kind: "settlement",
    editorialStatus: "approved",
    visibility: "public"
  };
  const lockedCountry: DiscoveryTargetDefinition = {
    key: "country_hidden",
    kind: "country",
    editorialStatus: "approved",
    visibility: "discovery_locked",
    prerequisiteKeys: ["first_npc_encounter"]
  };
  const prerequisite: DiscoveryTargetDefinition = {
    key: "first_npc_encounter",
    kind: "geographic_feature",
    editorialStatus: "approved",
    visibility: "public"
  };

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query("CREATE TABLE accounts (id UUID PRIMARY KEY)");
    await client.query("INSERT INTO accounts (id) VALUES ($1), ($2)", [accountOne, accountTwo]);

    const migration = await readFile(
      new URL("../src/database/migrations/0026_world_discoveries.sql", import.meta.url),
      "utf8"
    );
    await client.query(migration);

    repositoryPool = new Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schema},public`,
      max: 4
    });

    const first = await recordPersistedWorldDiscovery(repositoryPool, {
      accountId: accountOne,
      target: publicSettlement,
      method: "exploration",
      discoveredAt,
      eventId: "discord-interaction-1001"
    });
    assert.equal(first.status, "discovered");

    const repeatedTarget = await recordPersistedWorldDiscovery(repositoryPool, {
      accountId: accountOne,
      target: publicSettlement,
      method: "quest",
      discoveredAt,
      eventId: "discord-interaction-1002"
    });
    assert.equal(repeatedTarget.status, "already_discovered");

    const repeatedEvent = await recordPersistedWorldDiscovery(repositoryPool, {
      accountId: accountOne,
      target: { ...publicSettlement, key: "another_place" },
      method: "exploration",
      discoveredAt,
      eventId: "discord-interaction-1001"
    });
    assert.equal(repeatedEvent.status, "duplicate_event");

    const missingPrerequisite = await recordPersistedWorldDiscovery(repositoryPool, {
      accountId: accountOne,
      target: lockedCountry,
      method: "exploration",
      discoveredAt,
      eventId: "discord-interaction-1003"
    });
    assert.equal(missingPrerequisite.status, "rejected");

    const prerequisiteResult = await recordPersistedWorldDiscovery(repositoryPool, {
      accountId: accountOne,
      target: prerequisite,
      method: "first_encounter",
      discoveredAt,
      eventId: "discord-interaction-1004"
    });
    assert.equal(prerequisiteResult.status, "discovered");

    const unlocked = await recordPersistedWorldDiscovery(repositoryPool, {
      accountId: accountOne,
      target: lockedCountry,
      method: "first_encounter",
      discoveredAt,
      eventId: "discord-interaction-1005"
    });
    assert.equal(unlocked.status, "discovered");

    const isolated = await recordPersistedWorldDiscovery(repositoryPool, {
      accountId: accountTwo,
      target: publicSettlement,
      method: "exploration",
      discoveredAt,
      eventId: "discord-interaction-2001"
    });
    assert.equal(isolated.status, "discovered");

    const raceTarget: DiscoveryTargetDefinition = {
      key: "settlement_race",
      kind: "settlement",
      editorialStatus: "approved",
      visibility: "public"
    };
    const concurrent = await Promise.all([
      recordPersistedWorldDiscovery(repositoryPool, {
        accountId: accountOne,
        target: raceTarget,
        method: "exploration",
        discoveredAt,
        eventId: "discord-interaction-3001"
      }),
      recordPersistedWorldDiscovery(repositoryPool, {
        accountId: accountOne,
        target: raceTarget,
        method: "quest",
        discoveredAt,
        eventId: "discord-interaction-3002"
      })
    ]);
    assert.deepEqual(
      concurrent.map((entry) => entry.status).sort(),
      ["already_discovered", "discovered"]
    );

    const stateOne = await getPersistedDiscoveryState(repositoryPool, accountOne);
    const stateTwo = await getPersistedDiscoveryState(repositoryPool, accountTwo);
    assert.equal(stateOne.records.length, 4);
    assert.equal(stateOne.eventIds.size, 6);
    assert.equal(stateTwo.records.length, 1);
    assert.equal(stateTwo.eventIds.size, 1);
    assert.equal(stateOne.records.some((record) => record.targetKey === "country_hidden"), true);

    const outcomes = await repositoryPool.query<{ outcome: string; count: string }>(
      `SELECT outcome, COUNT(*)::text AS count
       FROM world_discovery_events
       WHERE account_id = $1
       GROUP BY outcome
       ORDER BY outcome`,
      [accountOne]
    );
    assert.deepEqual(outcomes.rows, [
      { outcome: "already_discovered", count: "2" },
      { outcome: "discovered", count: "4" }
    ]);

    await assert.rejects(
      repositoryPool.query("DELETE FROM accounts WHERE id = $1", [accountOne]),
      /world_discover/
    );
  } finally {
    await repositoryPool?.end();
    await client.query("ROLLBACK").catch(() => undefined);
    await client.query("RESET search_path").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
    await pool.end();
  }
});
