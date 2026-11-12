import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient, QueryResult } from "pg";
import {
  collectWorldResource,
  NoCollectableWorldResourceError,
  type WorldResourceCollectionResolver
} from "../src/modules/world/resource-collection-contract.js";
import { ResourceCollectionError } from "../src/modules/inventory/resource-collection-service.js";

interface QueryCall {
  sql: string;
  values?: unknown[];
}

function createFakeDatabase(options?: {
  existingEvent?: {
    character_id: string;
    source_key: string;
    item_code: string;
    quantity: number;
    slot_number: number;
  };
}) {
  const calls: QueryCall[] = [];
  let released = false;
  const client = {
    async query<T extends QueryResult["rows"][number] = QueryResult["rows"][number]>(
      sql: string,
      values?: unknown[]
    ): Promise<QueryResult<T>> {
      calls.push({ sql, values });
      const normalized = sql.replace(/\\s+/g, " ").trim().toLowerCase();
      let rows: unknown[] = [];

      if (normalized.startsWith("select id from characters")) {
        rows = [{ id: "character-1" }];
      } else if (normalized.startsWith("select character_id, source_key")) {
        rows = options?.existingEvent ? [options.existingEvent] : [];
      } else if (normalized.startsWith("select id, capacity from character_inventory_bags")) {
        rows = [{ id: "bag-1", capacity: 5 }];
      } else if (normalized.startsWith("select id, slot_number, quantity from character_inventory_slots")) {
        rows = [];
      } else if (normalized.startsWith("select slot_number from character_inventory_slots")) {
        rows = [];
      }

      return { rows: rows as T[], command: "SELECT", rowCount: rows.length, oid: 0, fields: [] };
    },
    release() {
      released = true;
    }
  };

  return {
    calls,
    get released() { return released; },
    pool: {
      async connect() {
        return client;
      }
    } as unknown as Pool,
    client: client as unknown as PoolClient
  };
}

const validInput = {
  accountId: "account-1",
  characterId: "character-1",
  interactionId: "123e4567-e89b-42d3-a456-426614174000"
};

test("refuse un UUID invalide avant d'ouvrir une transaction", async () => {
  const db = createFakeDatabase();
  const resolver: WorldResourceCollectionResolver = {
    async resolveAndLockAvailableSource() {
      throw new Error("Le résolveur ne doit pas être appelé.");
    }
  };

  await assert.rejects(
    collectWorldResource(db.pool, resolver, { ...validInput, interactionId: "not-a-uuid" }),
    ResourceCollectionError
  );
  assert.equal(db.calls.length, 0);
  assert.equal(db.released, false);
});

test("annule la transaction lorsqu'aucune source récoltable n'est disponible", async () => {
  const db = createFakeDatabase();
  const resolver: WorldResourceCollectionResolver = {
    async resolveAndLockAvailableSource() {
      return null;
    }
  };

  await assert.rejects(
    collectWorldResource(db.pool, resolver, validInput),
    NoCollectableWorldResourceError
  );
  assert.ok(db.calls.some((call) => call.sql === "BEGIN"));
  assert.ok(db.calls.some((call) => call.sql === "ROLLBACK"));
  assert.ok(!db.calls.some((call) => call.sql === "COMMIT"));
  assert.equal(db.released, true);
});

test("crédite le sac et consomme la source dans la même transaction", async () => {
  const db = createFakeDatabase();
  let consumed = false;
  const resolver: WorldResourceCollectionResolver = {
    async resolveAndLockAvailableSource() {
      return {
        sourceKey: "world-source-42",
        itemCode: "canonical_resource_code",
        quantity: 2,
        async consume() {
          consumed = true;
        }
      };
    }
  };

  const result = await collectWorldResource(db.pool, resolver, validInput);

  assert.deepEqual(result, {
    sourceKey: "world-source-42",
    itemCode: "canonical_resource_code",
    quantity: 2,
    replayed: false,
    slotNumber: 1
  });
  assert.equal(consumed, true);
  assert.ok(db.calls.some((call) => call.sql === "BEGIN"));
  assert.ok(db.calls.some((call) => call.sql === "COMMIT"));
  assert.ok(!db.calls.some((call) => call.sql === "ROLLBACK"));
  assert.equal(db.released, true);
});

test("annule l'ajout au sac si la consommation de la source échoue", async () => {
  const db = createFakeDatabase();
  const resolver: WorldResourceCollectionResolver = {
    async resolveAndLockAvailableSource() {
      return {
        sourceKey: "world-source-42",
        itemCode: "canonical_resource_code",
        quantity: 2,
        async consume() {
          throw new Error("Échec simulé de consommation.");
        }
      };
    }
  };

  await assert.rejects(
    collectWorldResource(db.pool, resolver, validInput),
    /Échec simulé de consommation/
  );
  assert.ok(db.calls.some((call) => call.sql.startsWith("INSERT INTO character_inventory_slots")));
  assert.ok(db.calls.some((call) => call.sql === "ROLLBACK"));
  assert.ok(!db.calls.some((call) => call.sql === "COMMIT"));
  assert.equal(db.released, true);
});

test("une interaction déjà enregistrée ne consulte pas une seconde fois le monde", async () => {
  const db = createFakeDatabase({
    existingEvent: {
      character_id: "character-1",
      source_key: "world-source-42",
      item_code: "canonical_resource_code",
      quantity: 2,
      slot_number: 3
    }
  });
  let resolverCalled = false;
  const resolver: WorldResourceCollectionResolver = {
    async resolveAndLockAvailableSource() {
      resolverCalled = true;
      return null;
    }
  };

  const result = await collectWorldResource(db.pool, resolver, validInput);

  assert.deepEqual(result, {
    sourceKey: "world-source-42",
    itemCode: "canonical_resource_code",
    quantity: 2,
    replayed: true,
    slotNumber: 3
  });
  assert.equal(resolverCalled, false);
  assert.ok(db.calls.some((call) => call.sql === "COMMIT"));
  assert.ok(!db.calls.some((call) => call.sql.startsWith("INSERT INTO")));
});
