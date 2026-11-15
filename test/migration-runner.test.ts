import assert from "node:assert/strict";
import test from "node:test";
import {
  migrationChecksum,
  stripMigrationTransaction,
  validateMigrationNames
} from "../src/database/migration-runner.ts";

test("calcule un checksum SHA-256 stable sur le contenu exact", () => {
  const first = migrationChecksum("SELECT 1;");
  const second = migrationChecksum("SELECT 1;");
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, migrationChecksum("SELECT 2;"));
});

test("trie les migrations dans l'ordre et refuse les numéros dupliqués", () => {
  assert.deepEqual(
    validateMigrationNames(["0002_characters.sql", "0001_initial_core.sql"]),
    ["0001_initial_core.sql", "0002_characters.sql"]
  );
  assert.throws(
    () => validateMigrationNames(["0001_initial_core.sql", "0001_other.sql"]),
    /dupliqué/
  );
});

test("refuse les noms de fichiers SQL qui ne suivent pas le format du dépôt", () => {
  assert.throws(() => validateMigrationNames(["initial.sql"]), /invalide/);
});

test("retire l'enveloppe BEGIN/COMMIT des migrations historiques", () => {
  const sql = `-- migration de test
BEGIN;

CREATE TABLE example (id INTEGER);

COMMIT;
-- fin
`;
  assert.equal(
    stripMigrationTransaction(sql),
    "CREATE TABLE example (id INTEGER);"
  );
});

test("conserve les scripts sans enveloppe transactionnelle", () => {
  assert.equal(
    stripMigrationTransaction("-- simple migration\nSELECT 1;"),
    "-- simple migration\nSELECT 1;"
  );
});

test("refuse une enveloppe transactionnelle incomplète", () => {
  assert.throws(
    () => stripMigrationTransaction("BEGIN; SELECT 1;"),
    /incomplète/
  );
});


import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { runMigrations } from "../src/database/migration-runner.ts";

interface FakeHistoryRow {
  migration_name: string;
  checksum: string;
  applied_at: Date;
  execution_time_ms: number;
  is_baseline: boolean;
}

function createFakePool(coreTables: string[] = []) {
  let historyExists = false;
  const history: FakeHistoryRow[] = [];
  const statements: string[] = [];
  const migrationSql: string[] = [];

  const client = {
    async query(queryText: string, values: unknown[] = []) {
      const query = queryText.trim();

      if (query.includes("pg_advisory_lock") || query.includes("pg_advisory_unlock")) {
        statements.push(query);
        return { rows: [], rowCount: 1 };
      }
      if (query.includes("to_regclass")) {
        return { rows: [{ exists: historyExists }], rowCount: 1 };
      }
      if (query.includes("FROM information_schema.tables")) {
        return {
          rows: coreTables.map((table_name) => ({ table_name })),
          rowCount: coreTables.length
        };
      }
      if (
        query.startsWith("CREATE SCHEMA IF NOT EXISTS etheria_internal") ||
        query.startsWith("REVOKE ALL ON SCHEMA etheria_internal")
      ) {
        statements.push("CREATE PRIVATE SCHEMA");
        return { rows: [], rowCount: 0 };
      }
      if (query.startsWith("CREATE TABLE IF NOT EXISTS etheria_internal.schema_migrations")) {
        historyExists = true;
        statements.push("CREATE HISTORY");
        return { rows: [], rowCount: 0 };
      }
      if (query.includes("FROM etheria_internal.schema_migrations")) {
        return { rows: [...history], rowCount: history.length };
      }
      if (query === "BEGIN" || query === "COMMIT" || query === "ROLLBACK") {
        statements.push(query);
        return { rows: [], rowCount: 0 };
      }
      if (query.startsWith("INSERT INTO etheria_internal.schema_migrations")) {
        history.push({
          migration_name: String(values[0]),
          checksum: String(values[1]),
          applied_at: new Date(),
          execution_time_ms: Number(values[2] ?? 0),
          is_baseline: Boolean(values[3] ?? false)
        });
        statements.push("INSERT HISTORY");
        return { rows: [], rowCount: 1 };
      }

      migrationSql.push(query);
      statements.push("MIGRATION SQL");
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };

  const pool = {
    async connect() {
      return client;
    }
  } as unknown as Pool;

  return { pool, history, statements, migrationSql, get historyExists() { return historyExists; } };
}

async function createMigrationDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "etheria-migrations-"));
  await writeFile(
    join(directory, "0001_initial_core.sql"),
    "-- initial schema\nBEGIN;\nCREATE TABLE example (id INTEGER);\nCOMMIT;\n",
    "utf8"
  );
  return directory;
}

test("applique chaque migration et enregistre son checksum dans la même transaction", async (t) => {
  const directory = await createMigrationDirectory();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = createFakePool();

  const result = await runMigrations(database.pool, { directory });

  assert.deepEqual(result.applied, ["0001_initial_core.sql"]);
  assert.deepEqual(result.remaining, []);
  assert.equal(database.history.length, 1);
  assert.equal(database.history[0]?.is_baseline, false);
  assert.deepEqual(database.migrationSql, ["CREATE TABLE example (id INTEGER);"]);

  const beginIndex = database.statements.indexOf("BEGIN");
  const sqlIndex = database.statements.indexOf("MIGRATION SQL");
  const historyIndex = database.statements.indexOf("INSERT HISTORY");
  const commitIndex = database.statements.indexOf("COMMIT");
  assert.ok(beginIndex < sqlIndex);
  assert.ok(sqlIndex < historyIndex);
  assert.ok(historyIndex < commitIndex);
});

test("le mode simulation ne crée ni historique ni schéma", async (t) => {
  const directory = await createMigrationDirectory();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = createFakePool();

  const plan = await runMigrations(database.pool, { directory, dryRun: true });

  assert.equal(plan.pending.length, 1);
  assert.equal(database.historyExists, false);
  assert.equal(database.statements.length, 0);
  assert.equal(database.migrationSql.length, 0);
});

test("refuse de rejouer 0001 si le socle existe sans historique", async (t) => {
  const directory = await createMigrationDirectory();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = createFakePool([
    "accounts",
    "account_identities",
    "player_profiles",
    "currencies",
    "wallets",
    "currency_transactions"
  ]);

  await assert.rejects(
    () => runMigrations(database.pool, { directory }),
    /Baseline/
  );
  assert.equal(database.historyExists, false);
  assert.equal(database.migrationSql.length, 0);
});
