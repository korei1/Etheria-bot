import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import test from "node:test";
import {
  claimFreeCompanionRation,
  createCompanion,
  getCompanionCareState,
  listCompanions,
  processCompanionRest,
  selectCompanion,
  startCompanionRest,
  stopCompanionRest,
  CompanionRepositoryError
} from "../src/modules/companions/companion-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL conserve compagnons, soins et repos entre connexions", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  let clientReleased = false;
  const schema = `etheria_companions_${randomUUID().replaceAll("-", "")}`;
  const accountId = randomUUID();
  const now = new Date("2026-01-01T00:00:00.000Z");

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query("CREATE TABLE accounts (id UUID PRIMARY KEY)");
    await client.query("INSERT INTO accounts (id) VALUES ($1)", [accountId]);

    const migration = await readFile(
      new URL("../src/database/migrations/0020_companion_persistence.sql", import.meta.url),
      "utf8"
    );
    await client.query(migration);
    client.release();
    clientReleased = true;

    const baseInput = {
      accountId,
      speciesKey: "forest_fox",
      rarity: "commun" as const,
      element: "terre" as const,
      acquisitionMethod: "wild_encounter" as const,
      initialHungerPercent: 40,
      initialThirstPercent: 70,
      initialEnergy: 20,
      now
    };

    const created = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createCompanion(pool, { ...baseInput, displayName: `Renard ${index + 1}` })
      )
    );
    assert.equal(created.length, 4);
    assert.equal((await listCompanions(pool, accountId)).length, 4);

    await assert.rejects(
      createCompanion(pool, baseInput),
      (error: unknown) =>
        error instanceof CompanionRepositoryError &&
        error.message.includes("limite de quatre")
    );

    const first = created[0]!;
    const initialState = await getCompanionCareState(pool, {
      accountId,
      companionId: first.id
    });
    assert.equal(initialState.hungerPercent, 40);
    assert.equal(initialState.energy, 20);

    const fed = await claimFreeCompanionRation(pool, {
      accountId,
      companionId: first.id,
      now
    });
    assert.equal(fed.hungerPercent, 100);
    assert.equal(fed.lastFreeRationAt?.toISOString(), now.toISOString());

    await assert.rejects(
      claimFreeCompanionRation(pool, {
        accountId,
        companionId: first.id,
        now: new Date(now.getTime() + 1)
      }),
      CompanionRepositoryError
    );

    await selectCompanion(pool, {
      accountId,
      companionId: first.id,
      now
    });
    await startCompanionRest(pool, {
      accountId,
      companionId: first.id,
      now
    });

    await assert.rejects(
      selectCompanion(pool, {
        accountId,
        companionId: created[1]!.id,
        now: new Date(now.getTime() + 60_000)
      }),
      (error: unknown) =>
        error instanceof CompanionRepositoryError &&
        error.message.includes("repos")
    );

    const afterOffline = await processCompanionRest(pool, {
      accountId,
      companionId: first.id,
      now: new Date(now.getTime() + 60 * 60 * 1000 + 10_000)
    });
    assert.equal(afterOffline.energy, 40);
    assert.equal(afterOffline.restStartedAt?.toISOString(), now.toISOString());

    const stopped = await stopCompanionRest(pool, {
      accountId,
      companionId: first.id,
      now: new Date(now.getTime() + 60 * 60 * 1000 + 10_000)
    });
    assert.equal(stopped.energy, 40);
    assert.equal(stopped.restStartedAt, null);

    const persisted = await getCompanionCareState(pool, {
      accountId,
      companionId: first.id
    });
    assert.equal(persisted.energy, 40);
    assert.equal(persisted.hungerPercent, 100);
    assert.equal(persisted.restStartedAt, null);
  } finally {
    if (!clientReleased) {
      client.release();
    }
    const cleanup = await pool.connect();
    try {
      await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      cleanup.release();
      await pool.end();
    }
  }
});
