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
