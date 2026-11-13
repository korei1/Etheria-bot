import type { Pool, PoolClient } from "pg";
import {
  applyFreeRation,
  calculateRestRecovery,
  canClaimFreeRation,
  assertCanSwitchCompanion,
  CompanionCareRuleError
} from "./companion-care-rules.js";
import {
  isCompanionElement,
  isCompanionRarity,
  type CompanionElement,
  type CompanionRarity
} from "./companion-rules.js";

export type CompanionAcquisitionMethod =
  | "discord_shop"
  | "wild_encounter"
  | "adoption"
  | "breeding"
  | "quest"
  | "event"
  | "discovery"
  | "reward"
  | "trade"
  | "gift";

export interface CompanionRecord {
  id: string;
  ownerAccountId: string;
  speciesKey: string;
  displayName: string | null;
  rarity: CompanionRarity;
  element: CompanionElement;
  level: number;
  experience: number;
  acquisitionMethod: CompanionAcquisitionMethod;
  acquiredAt: Date;
  selectedAt: Date | null;
}

export interface CompanionCareState {
  companionId: string;
  hungerPercent: number;
  thirstPercent: number;
  energy: number;
  hasDigestiveDisorder: boolean;
  hasChronicFatigue: boolean;
  lastFreeRationAt: Date | null;
  restStartedAt: Date | null;
  restLastProcessedAt: Date;
}

interface CompanionRow {
  id: string;
  owner_account_id: string;
  species_key: string;
  display_name: string | null;
  rarity: string;
  element: string;
  level: number;
  experience: string | number;
  acquisition_method: CompanionAcquisitionMethod;
  acquired_at: Date;
  selected_at: Date | null;
}

interface CareRow {
  companion_id: string;
  hunger_percent: number;
  thirst_percent: number;
  energy: number;
  has_digestive_disorder: boolean;
  has_chronic_fatigue: boolean;
  last_free_ration_at: Date | null;
  rest_started_at: Date | null;
  rest_last_processed_at: Date;
}

export class CompanionRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionRepositoryError";
  }
}

function mapCompanion(row: CompanionRow): CompanionRecord {
  if (!isCompanionRarity(row.rarity) || !isCompanionElement(row.element)) {
    throw new CompanionRepositoryError("Le compagnon référence une rareté ou un élément inconnu.");
  }
  return {
    id: row.id,
    ownerAccountId: row.owner_account_id,
    speciesKey: row.species_key,
    displayName: row.display_name,
    rarity: row.rarity,
    element: row.element,
    level: row.level,
    experience: Number(row.experience),
    acquisitionMethod: row.acquisition_method,
    acquiredAt: row.acquired_at,
    selectedAt: row.selected_at
  };
}

function mapCare(row: CareRow): CompanionCareState {
  return {
    companionId: row.companion_id,
    hungerPercent: row.hunger_percent,
    thirstPercent: row.thirst_percent,
    energy: row.energy,
    hasDigestiveDisorder: row.has_digestive_disorder,
    hasChronicFatigue: row.has_chronic_fatigue,
    lastFreeRationAt: row.last_free_ration_at,
    restStartedAt: row.rest_started_at,
    restLastProcessedAt: row.rest_last_processed_at
  };
}

async function lockOwnedCompanion(
  client: PoolClient,
  accountId: string,
  companionId: string
): Promise<CompanionRow> {
  const result = await client.query<CompanionRow>(
    `SELECT id, owner_account_id, species_key, display_name, rarity, element,
            level, experience, acquisition_method, acquired_at, selected_at
     FROM companion_instances
     WHERE id = $1 AND owner_account_id = $2
     FOR UPDATE`,
    [companionId, accountId]
  );
  const row = result.rows[0];
  if (!row) throw new CompanionRepositoryError("Ce compagnon n'appartient pas à ce compte.");
  return row;
}

/**
 * Ajoute un compagnon et son état initial dans une seule transaction.
 * Les valeurs initiales des besoins sont explicites : aucun état de départ
 * non décidé n'est inventé par le dépôt.
 */
export async function createCompanion(
  pool: Pool,
  input: {
    accountId: string;
    speciesKey: string;
    displayName?: string | null;
    rarity: CompanionRarity;
    element: CompanionElement;
    acquisitionMethod: CompanionAcquisitionMethod;
    initialHungerPercent: number;
    initialThirstPercent: number;
    initialEnergy: number;
    now?: Date;
  }
): Promise<CompanionRecord> {
  const speciesKey = input.speciesKey.trim();
  if (!input.accountId.trim() || !speciesKey) {
    throw new CompanionRepositoryError("Le compte et la clé d'espèce sont obligatoires.");
  }
  if (!isCompanionRarity(input.rarity) || !isCompanionElement(input.element)) {
    throw new CompanionRepositoryError("La rareté ou l'élément du compagnon est invalide.");
  }
  for (const [label, value] of [
    ["La faim", input.initialHungerPercent],
    ["La soif", input.initialThirstPercent],
    ["L'énergie", input.initialEnergy]
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new CompanionRepositoryError(label + " initiale doit être comprise entre 0 et 100.");
    }
  }
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new CompanionRepositoryError("La date de création est invalide.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`etheria:companion-capacity:${input.accountId}:${speciesKey}`]
    );
    const count = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM companion_instances WHERE owner_account_id = $1 AND species_key = $2",
      [input.accountId, speciesKey]
    );
    if (Number(count.rows[0]?.count ?? 0) >= 4) {
      throw new CompanionRepositoryError("La limite de quatre compagnons de cette espèce est atteinte.");
    }

    const inserted = await client.query<CompanionRow>(
      `INSERT INTO companion_instances (
         owner_account_id, species_key, display_name, rarity, element, acquisition_method
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, owner_account_id, species_key, display_name, rarity, element,
                 level, experience, acquisition_method, acquired_at, selected_at`,
      [
        input.accountId,
        speciesKey,
        input.displayName?.trim() || null,
        input.rarity,
        input.element,
        input.acquisitionMethod
      ]
    );
    const companion = inserted.rows[0];
    if (!companion) throw new CompanionRepositoryError("La création du compagnon n'a retourné aucune donnée.");

    await client.query(
      `INSERT INTO companion_care_states (
         companion_id, hunger_percent, thirst_percent, energy, rest_last_processed_at
       ) VALUES ($1, $2, $3, $4, $5)`,
      [companion.id, input.initialHungerPercent, input.initialThirstPercent, input.initialEnergy, now]
    );
    await client.query("COMMIT");
    return mapCompanion(companion);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listCompanions(
  pool: Pool,
  accountId: string
): Promise<CompanionRecord[]> {
  const result = await pool.query<CompanionRow>(
    `SELECT id, owner_account_id, species_key, display_name, rarity, element,
            level, experience, acquisition_method, acquired_at, selected_at
     FROM companion_instances
     WHERE owner_account_id = $1
     ORDER BY acquired_at, id`,
    [accountId]
  );
  return result.rows.map(mapCompanion);
}

export async function getCompanionCareState(
  pool: Pool,
  input: { accountId: string; companionId: string }
): Promise<CompanionCareState> {
  const result = await pool.query<CareRow>(
    `SELECT s.companion_id, s.hunger_percent, s.thirst_percent, s.energy,
            s.has_digestive_disorder, s.has_chronic_fatigue,
            s.last_free_ration_at, s.rest_started_at, s.rest_last_processed_at
     FROM companion_care_states s
     JOIN companion_instances c ON c.id = s.companion_id
     WHERE c.id = $1 AND c.owner_account_id = $2`,
    [input.companionId, input.accountId]
  );
  const row = result.rows[0];
  if (!row) throw new CompanionRepositoryError("État de soin introuvable pour ce compagnon.");
  return mapCare(row);
}

/** Applique de manière transactionnelle le repos écoulé, y compris hors ligne. */
export async function processCompanionRest(
  pool: Pool,
  input: { accountId: string; companionId: string; now?: Date }
): Promise<CompanionCareState> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new CompanionRepositoryError("La date actuelle est invalide.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockOwnedCompanion(client, input.accountId, input.companionId);
    const result = await client.query<CareRow>(
      `SELECT companion_id, hunger_percent, thirst_percent, energy,
              has_digestive_disorder, has_chronic_fatigue,
              last_free_ration_at, rest_started_at, rest_last_processed_at
       FROM companion_care_states
       WHERE companion_id = $1
       FOR UPDATE`,
      [input.companionId]
    );
    const state = result.rows[0];
    if (!state) throw new CompanionRepositoryError("État de soin introuvable pour ce compagnon.");

    if (!state.rest_started_at) {
      await client.query("COMMIT");
      return mapCare(state);
    }

    const recovery = calculateRestRecovery({
      currentEnergy: state.energy,
      lastProcessedAt: state.rest_last_processed_at,
      now,
      hasChronicFatigue: state.has_chronic_fatigue
    });
    const updated = await client.query<CareRow>(
      `UPDATE companion_care_states
       SET energy = $2, rest_last_processed_at = $3, updated_at = $4
       WHERE companion_id = $1
       RETURNING companion_id, hunger_percent, thirst_percent, energy,
                 has_digestive_disorder, has_chronic_fatigue,
                 last_free_ration_at, rest_started_at, rest_last_processed_at`,
      [input.companionId, recovery.energy, recovery.nextRecoveryAt, now]
    );
    await client.query("COMMIT");
    return mapCare(updated.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Démarre un repos en enregistrant son point de départ persistant. */
export async function startCompanionRest(
  pool: Pool,
  input: { accountId: string; companionId: string; now?: Date }
): Promise<CompanionCareState> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new CompanionRepositoryError("La date actuelle est invalide.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockOwnedCompanion(client, input.accountId, input.companionId);
    const result = await client.query<CareRow>(
      `SELECT companion_id, hunger_percent, thirst_percent, energy,
              has_digestive_disorder, has_chronic_fatigue,
              last_free_ration_at, rest_started_at, rest_last_processed_at
       FROM companion_care_states WHERE companion_id = $1 FOR UPDATE`,
      [input.companionId]
    );
    const state = result.rows[0];
    if (!state) throw new CompanionRepositoryError("État de soin introuvable pour ce compagnon.");
    if (state.rest_started_at) throw new CompanionRepositoryError("Ce compagnon est déjà au repos.");
    const updated = await client.query<CareRow>(
      `UPDATE companion_care_states
       SET rest_started_at = $2, rest_last_processed_at = $2, updated_at = $2
       WHERE companion_id = $1
       RETURNING companion_id, hunger_percent, thirst_percent, energy,
                 has_digestive_disorder, has_chronic_fatigue,
                 last_free_ration_at, rest_started_at, rest_last_processed_at`,
      [input.companionId, now]
    );
    await client.query("COMMIT");
    return mapCare(updated.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Arrête le repos après avoir crédité tous les intervalles complets écoulés. */
export async function stopCompanionRest(
  pool: Pool,
  input: { accountId: string; companionId: string; now?: Date }
): Promise<CompanionCareState> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new CompanionRepositoryError("La date actuelle est invalide.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockOwnedCompanion(client, input.accountId, input.companionId);
    const result = await client.query<CareRow>(
      `SELECT companion_id, hunger_percent, thirst_percent, energy,
              has_digestive_disorder, has_chronic_fatigue,
              last_free_ration_at, rest_started_at, rest_last_processed_at
       FROM companion_care_states WHERE companion_id = $1 FOR UPDATE`,
      [input.companionId]
    );
    const state = result.rows[0];
    if (!state) throw new CompanionRepositoryError("État de soin introuvable pour ce compagnon.");
    if (!state.rest_started_at) throw new CompanionRepositoryError("Ce compagnon n'est pas au repos.");
    const recovery = calculateRestRecovery({
      currentEnergy: state.energy,
      lastProcessedAt: state.rest_last_processed_at,
      now,
      hasChronicFatigue: state.has_chronic_fatigue
    });
    const updated = await client.query<CareRow>(
      `UPDATE companion_care_states
       SET energy = $2, rest_last_processed_at = $3,
           rest_started_at = NULL, updated_at = $4
       WHERE companion_id = $1
       RETURNING companion_id, hunger_percent, thirst_percent, energy,
                 has_digestive_disorder, has_chronic_fatigue,
                 last_free_ration_at, rest_started_at, rest_last_processed_at`,
      [input.companionId, recovery.energy, recovery.nextRecoveryAt, now]
    );
    await client.query("COMMIT");
    return mapCare(updated.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Réclame une ration gratuite sans risque de double attribution concurrente. */
export async function claimFreeCompanionRation(
  pool: Pool,
  input: { accountId: string; companionId: string; now?: Date }
): Promise<CompanionCareState> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new CompanionRepositoryError("La date actuelle est invalide.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockOwnedCompanion(client, input.accountId, input.companionId);
    const result = await client.query<CareRow>(
      `SELECT companion_id, hunger_percent, thirst_percent, energy,
              has_digestive_disorder, has_chronic_fatigue,
              last_free_ration_at, rest_started_at, rest_last_processed_at
       FROM companion_care_states WHERE companion_id = $1 FOR UPDATE`,
      [input.companionId]
    );
    const state = result.rows[0];
    if (!state) throw new CompanionRepositoryError("État de soin introuvable pour ce compagnon.");
    if (!canClaimFreeRation(state.last_free_ration_at, now)) {
      throw new CompanionRepositoryError("La prochaine ration gratuite n'est pas encore disponible.");
    }
    const hunger = applyFreeRation({
      currentHunger: state.hunger_percent,
      hasDigestiveDisorder: state.has_digestive_disorder
    });
    const updated = await client.query<CareRow>(
      `UPDATE companion_care_states
       SET hunger_percent = $2, last_free_ration_at = $3, updated_at = $3
       WHERE companion_id = $1
       RETURNING companion_id, hunger_percent, thirst_percent, energy,
                 has_digestive_disorder, has_chronic_fatigue,
                 last_free_ration_at, rest_started_at, rest_last_processed_at`,
      [input.companionId, hunger, now]
    );
    await client.query("COMMIT");
    return mapCare(updated.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Sélectionne un compagnon ; le compagnon actuellement sélectionné doit pouvoir être quitté. */
export async function selectCompanion(
  pool: Pool,
  input: { accountId: string; companionId: string; now?: Date }
): Promise<CompanionRecord> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new CompanionRepositoryError("La date actuelle est invalide.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`etheria:companion-selection:${input.accountId}`]
    );
    const target = await lockOwnedCompanion(client, input.accountId, input.companionId);
    const currentResult = await client.query<{ id: string; rest_started_at: Date | null }>(
      `SELECT c.id, s.rest_started_at
       FROM companion_instances c
       JOIN companion_care_states s ON s.companion_id = c.id
       WHERE c.owner_account_id = $1 AND c.selected_at IS NOT NULL
       FOR UPDATE OF c, s`,
      [input.accountId]
    );
    const current = currentResult.rows[0];
    if (current && current.id !== input.companionId) {
      assertCanSwitchCompanion(current.rest_started_at !== null);
    }
    if (current?.id === input.companionId) {
      await client.query("COMMIT");
      return mapCompanion(target);
    }
    await client.query(
      "UPDATE companion_instances SET selected_at = NULL, updated_at = $2 WHERE owner_account_id = $1 AND selected_at IS NOT NULL",
      [input.accountId, now]
    );
    const selected = await client.query<CompanionRow>(
      `UPDATE companion_instances SET selected_at = $3, updated_at = $3
       WHERE id = $1 AND owner_account_id = $2
       RETURNING id, owner_account_id, species_key, display_name, rarity, element,
                 level, experience, acquisition_method, acquired_at, selected_at`,
      [input.companionId, input.accountId, now]
    );
    await client.query("COMMIT");
    return mapCompanion(selected.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof CompanionCareRuleError) {
      throw new CompanionRepositoryError(error.message);
    }
    throw error;
  } finally {
    client.release();
  }
}
