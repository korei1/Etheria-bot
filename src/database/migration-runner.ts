import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

const DEFAULT_MIGRATIONS_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);
const MIGRATION_LOCK_KEY = "etheria:postgres:migrations:v1";
const HISTORY_TABLE = "public.etheria_schema_migrations";
const CORE_TABLES = [
  "accounts",
  "account_identities",
  "player_profiles",
  "currencies",
  "wallets",
  "currency_transactions"
] as const;

export interface MigrationFile {
  name: string;
  checksum: string;
  sql: string;
}

export interface AppliedMigration {
  migration_name: string;
  checksum: string;
  applied_at: Date | string;
  execution_time_ms: number;
  is_baseline: boolean;
}

export interface MigrationPlan {
  applied: AppliedMigration[];
  pending: MigrationFile[];
  baselineRequired: boolean;
  existingCoreTables: string[];
}

export interface MigrationRunResult {
  applied: string[];
  remaining: string[];
}

const REQUIRED_CORE_COLUMNS: Record<(typeof CORE_TABLES)[number], string[]> = {
  accounts: ["id", "status", "created_at", "last_seen_at"],
  account_identities: [
    "id",
    "account_id",
    "provider",
    "provider_user_id",
    "created_at"
  ],
  player_profiles: [
    "account_id",
    "display_name",
    "origin_country_id",
    "created_at",
    "updated_at"
  ],
  currencies: ["code", "name", "is_active", "created_at"],
  wallets: [
    "id",
    "account_id",
    "currency_code",
    "balance",
    "created_at",
    "updated_at"
  ],
  currency_transactions: [
    "id",
    "wallet_id",
    "amount",
    "reason_code",
    "reference_type",
    "reference_id",
    "idempotency_key",
    "created_at"
  ]
};

const REQUIRED_CORE_CONSTRAINTS = [
  "account_identities_provider_user_unique",
  "account_identities_provider_not_empty",
  "account_identities_user_id_not_empty",
  "player_profiles_display_name_length",
  "currencies_code_format",
  "wallets_account_currency_unique",
  "currency_transactions_reason_not_empty"
];

export function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function validateMigrationNames(names: string[]): string[] {
  const sorted = [...names].sort();
  const versions = new Set<string>();

  for (const name of sorted) {
    const match = /^(\d{4})_[a-z0-9][a-z0-9_]*\.sql$/.exec(name);
    if (!match) {
      throw new Error(
        `Nom de migration invalide : ${name}. Format attendu : NNNN_description.sql.`
      );
    }

    const version = match[1];
    if (versions.has(version)) {
      throw new Error(`Numéro de migration dupliqué : ${version}.`);
    }
    versions.add(version);
  }

  return sorted;
}

/**
 * Les migrations historiques contiennent déjà BEGIN/COMMIT.
 * On retire uniquement cette enveloppe externe afin que le runner puisse
 * valider le SQL et sa ligne d'historique dans une seule transaction.
 */
export function stripMigrationTransaction(sql: string): string {
  const leadingTransaction =
    /^(?:\uFEFF)?\s*(?:(?:--[^\r\n]*(?:\r?\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*BEGIN\s*;\s*/i;
  const trailingTransaction =
    /\s*COMMIT\s*;\s*(?:(?:--[^\r\n]*(?:\r?\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*$/i;

  const hasLeadingTransaction = leadingTransaction.test(sql);
  const hasTrailingTransaction = trailingTransaction.test(sql);

  if (hasLeadingTransaction !== hasTrailingTransaction) {
    throw new Error(
      "Enveloppe transactionnelle SQL incomplète : BEGIN et COMMIT doivent être présents ensemble."
    );
  }

  if (!hasLeadingTransaction) {
    return sql.trim();
  }

  return sql
    .replace(leadingTransaction, "")
    .replace(trailingTransaction, "")
    .trim();
}

export async function loadMigrationFiles(
  directory = DEFAULT_MIGRATIONS_DIRECTORY
): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = validateMigrationNames(
    entries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
  );

  const migrations: MigrationFile[] = [];
  for (const name of names) {
    const sql = await readFile(join(directory, name), "utf8");
    if (!stripMigrationTransaction(sql)) {
      throw new Error(`La migration ${name} est vide.`);
    }
    migrations.push({ name, checksum: migrationChecksum(sql), sql });
  }

  return migrations;
}

async function migrationHistoryExists(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [HISTORY_TABLE]
  );
  return result.rows[0]?.exists === true;
}

async function readAppliedMigrations(
  client: PoolClient
): Promise<AppliedMigration[]> {
  if (!(await migrationHistoryExists(client))) return [];

  const result = await client.query<AppliedMigration>(
    `SELECT migration_name, checksum, applied_at, execution_time_ms, is_baseline
     FROM ${HISTORY_TABLE}
     ORDER BY migration_name`
  );
  return result.rows;
}

async function detectExistingCoreTables(
  client: PoolClient
): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [CORE_TABLES]
  );
  return result.rows.map((row) => row.table_name);
}

function validateAppliedHistory(
  migrations: MigrationFile[],
  applied: AppliedMigration[]
): void {
  const localByName = new Map(migrations.map((migration) => [migration.name, migration]));
  const appliedNames = new Set<string>();

  for (const record of applied) {
    const local = localByName.get(record.migration_name);
    if (!local) {
      throw new Error(
        `La base référence ${record.migration_name}, absent du dépôt local. Aucune migration ne sera exécutée.`
      );
    }
    if (local.checksum !== record.checksum) {
      throw new Error(
        `La migration appliquée ${record.migration_name} a changé (checksum différent). Restaurez le fichier historique ou créez une nouvelle migration.`
      );
    }
    appliedNames.add(record.migration_name);
  }

  let encounteredPending = false;
  for (const migration of migrations) {
    const isApplied = appliedNames.has(migration.name);
    if (!isApplied) encounteredPending = true;
    else if (encounteredPending) {
      throw new Error(
        `Historique incohérent : ${migration.name} est appliquée après une migration manquante.`
      );
    }
  }
}

export async function getMigrationPlan(
  pool: Pool,
  directory = DEFAULT_MIGRATIONS_DIRECTORY
): Promise<MigrationPlan> {
  const migrations = await loadMigrationFiles(directory);
  const client = await pool.connect();

  try {
    const applied = await readAppliedMigrations(client);
    validateAppliedHistory(migrations, applied);
    const existingCoreTables = await detectExistingCoreTables(client);
    const appliedNames = new Set(applied.map((record) => record.migration_name));

    return {
      applied,
      pending: migrations.filter((migration) => !appliedNames.has(migration.name)),
      baselineRequired: applied.length === 0 && existingCoreTables.length > 0,
      existingCoreTables
    };
  } finally {
    client.release();
  }
}

async function ensureHistoryTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      migration_name TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL
        CHECK (checksum ~ '^[0-9a-f]{64}$'),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER NOT NULL DEFAULT 0
        CHECK (execution_time_ms >= 0),
      is_baseline BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
}

async function acquireMigrationLock(client: PoolClient): Promise<void> {
  await client.query(
    "SELECT pg_advisory_lock(hashtextextended($1, 0))",
    [MIGRATION_LOCK_KEY]
  );
}

async function releaseMigrationLock(client: PoolClient): Promise<void> {
  await client.query(
    "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
    [MIGRATION_LOCK_KEY]
  );
}

export async function runMigrations(
  pool: Pool,
  options: {
    directory?: string;
    dryRun?: boolean;
  } = {}
): Promise<MigrationRunResult | MigrationPlan> {
  const directory = options.directory ?? DEFAULT_MIGRATIONS_DIRECTORY;
  if (options.dryRun) return getMigrationPlan(pool, directory);

  const migrations = await loadMigrationFiles(directory);
  const client = await pool.connect();
  let locked = false;

  try {
    await acquireMigrationLock(client);
    locked = true;

    const existingCoreTables = await detectExistingCoreTables(client);
    const appliedBeforeSetup = await readAppliedMigrations(client);

    if (appliedBeforeSetup.length === 0 && existingCoreTables.length > 0) {
      throw new Error(
        `Le schéma de base existe déjà (${existingCoreTables.join(", ")}), mais aucun historique de migration n'est enregistré. Exécutez explicitement la procédure de baseline après vérification du socle 0001.`
      );
    }

    await ensureHistoryTable(client);
    const applied = await readAppliedMigrations(client);
    validateAppliedHistory(migrations, applied);

    const appliedNames = new Set(applied.map((record) => record.migration_name));
    const pending = migrations.filter((migration) => !appliedNames.has(migration.name));
    const completed: string[] = [];

    for (const migration of pending) {
      const startedAt = Date.now();
      const executableSql = stripMigrationTransaction(migration.sql);

      await client.query("BEGIN");
      try {
        await client.query(executableSql);
        const executionTime = Math.max(0, Date.now() - startedAt);
        await client.query(
          `INSERT INTO ${HISTORY_TABLE}
             (migration_name, checksum, execution_time_ms, is_baseline)
           VALUES ($1, $2, $3, FALSE)`,
          [migration.name, migration.checksum, executionTime]
        );
        await client.query("COMMIT");
        completed.push(migration.name);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new Error(
          `Échec de la migration ${migration.name}. La transaction a été annulée.`,
          { cause: error }
        );
      }
    }

    return {
      applied: completed,
      remaining: migrations
        .filter((migration) => !appliedNames.has(migration.name) && !completed.includes(migration.name))
        .map((migration) => migration.name)
    };
  } finally {
    if (locked) await releaseMigrationLock(client).catch(() => undefined);
    client.release();
  }
}

async function assertInitialSchemaMatches(
  client: PoolClient
): Promise<void> {
  const existingTables = await detectExistingCoreTables(client);
  const missingTables = CORE_TABLES.filter((table) => !existingTables.includes(table));
  if (missingTables.length > 0) {
    throw new Error(
      `Baseline refusée : tables du socle absentes : ${missingTables.join(", ")}.`
    );
  }

  const columnsResult = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [CORE_TABLES]
  );
  const actualColumns = new Map<string, Set<string>>();
  for (const row of columnsResult.rows) {
    const columns = actualColumns.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    actualColumns.set(row.table_name, columns);
  }

  const missingColumns: string[] = [];
  for (const [table, requiredColumns] of Object.entries(REQUIRED_CORE_COLUMNS)) {
    for (const column of requiredColumns) {
      if (!actualColumns.get(table)?.has(column)) missingColumns.push(`${table}.${column}`);
    }
  }
  if (missingColumns.length > 0) {
    throw new Error(
      `Baseline refusée : colonnes du socle absentes : ${missingColumns.join(", ")}.`
    );
  }

  const constraintsResult = await client.query<{ conname: string }>(
    `SELECT c.conname
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND c.conname = ANY($1::text[])`,
    [REQUIRED_CORE_CONSTRAINTS]
  );
  const actualConstraints = new Set(constraintsResult.rows.map((row) => row.conname));
  const missingConstraints = REQUIRED_CORE_CONSTRAINTS.filter(
    (constraint) => !actualConstraints.has(constraint)
  );
  if (missingConstraints.length > 0) {
    throw new Error(
      `Baseline refusée : contraintes du socle absentes : ${missingConstraints.join(", ")}.`
    );
  }

  const rlsResult = await client.query<{ relname: string; relrowsecurity: boolean }>(
    `SELECT c.relname, c.relrowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = ANY($1::text[])`,
    [CORE_TABLES]
  );
  const rlsEnabled = new Set(
    rlsResult.rows.filter((row) => row.relrowsecurity).map((row) => row.relname)
  );
  const rlsMissing = CORE_TABLES.filter((table) => !rlsEnabled.has(table));
  if (rlsMissing.length > 0) {
    throw new Error(
      `Baseline refusée : RLS n'est pas activé sur : ${rlsMissing.join(", ")}.`
    );
  }

  const currencyResult = await client.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM public.currencies WHERE code = 'TEAS' AND name = 'Teas') AS exists"
  );
  if (currencyResult.rows[0]?.exists !== true) {
    throw new Error("Baseline refusée : la monnaie TEAS / Teas est absente.");
  }
}

/**
 * Enregistre explicitement 0001 comme baseline après comparaison du socle
 * existant. Cette opération n'exécute jamais le SQL de 0001.
 */
export async function baselineInitialMigration(
  pool: Pool,
  directory = DEFAULT_MIGRATIONS_DIRECTORY
): Promise<void> {
  const migrations = await loadMigrationFiles(directory);
  const initialMigration = migrations.find(
    (migration) => migration.name === "0001_initial_core.sql"
  );
  if (!initialMigration) {
    throw new Error("La migration 0001_initial_core.sql est introuvable.");
  }

  const client = await pool.connect();
  let locked = false;

  try {
    await acquireMigrationLock(client);
    locked = true;

    const alreadyApplied = await readAppliedMigrations(client);
    if (alreadyApplied.length > 0) {
      throw new Error(
        "Baseline refusée : l'historique des migrations contient déjà des entrées."
      );
    }

    await assertInitialSchemaMatches(client);
    await ensureHistoryTable(client);

    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO ${HISTORY_TABLE}
           (migration_name, checksum, execution_time_ms, is_baseline)
         VALUES ($1, $2, 0, TRUE)`,
        [initialMigration.name, initialMigration.checksum]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    if (locked) await releaseMigrationLock(client).catch(() => undefined);
    client.release();
  }
}
