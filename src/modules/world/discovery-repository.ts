import type { Pool } from "pg";
import {
  createDiscoveryState,
  type DiscoveryMethod,
  type DiscoveryRecord,
  type DiscoveryResult,
  type DiscoveryState,
  type DiscoveryTargetDefinition,
  type DiscoveryTargetKind
} from "./discovery.js";

interface DiscoveryRow {
  account_id: string;
  target_key: string;
  target_kind: DiscoveryTargetKind;
  discovery_method: DiscoveryMethod;
  discovered_at: Date | string;
  event_id: string;
}

interface EventIdRow {
  event_id: string;
}

export class WorldDiscoveryRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldDiscoveryRepositoryError";
  }
}

function toDiscoveryRecord(row: DiscoveryRow): DiscoveryRecord {
  return {
    accountId: row.account_id,
    targetKey: row.target_key,
    targetKind: row.target_kind,
    method: row.discovery_method,
    discoveredAt: new Date(row.discovered_at).toISOString(),
    eventId: row.event_id
  };
}

/** Recharge l'état personnel et les identifiants d'événements déjà consommés. */
export async function getPersistedDiscoveryState(
  pool: Pool,
  accountId: string
): Promise<DiscoveryState> {
  if (!accountId.trim()) {
    throw new WorldDiscoveryRepositoryError("Compte joueur absent.");
  }
  const [discoveries, events] = await Promise.all([
    pool.query<DiscoveryRow>(
      `SELECT d.account_id, d.target_key, d.target_kind, d.discovery_method,
              d.discovered_at, e.event_id
       FROM world_discoveries d
       JOIN world_discovery_events e
         ON e.account_id = d.account_id AND e.id = d.first_event_id
       WHERE d.account_id = $1
       ORDER BY d.discovered_at, d.target_kind, d.target_key`,
      [accountId]
    ),
    pool.query<EventIdRow>(
      "SELECT event_id FROM world_discovery_events WHERE account_id = $1",
      [accountId]
    )
  ]);
  return createDiscoveryState(
    discoveries.rows.map(toDiscoveryRecord),
    new Set(events.rows.map((row) => row.event_id))
  );
}

/**
 * Enregistre une découverte et son événement dans une transaction unique.
 *
 * La clé d'idempotence est le couple compte/événement. La découverte elle-même
 * est unique par compte/type/cible. Les contraintes SQL arbitrent les courses
 * entre plusieurs processus Discord sans perdre le premier événement.
 */
export async function recordPersistedWorldDiscovery(
  pool: Pool,
  input: {
    accountId: string;
    target: DiscoveryTargetDefinition;
    method: DiscoveryMethod;
    discoveredAt: string;
    eventId: string;
  }
): Promise<DiscoveryResult> {
  if (!input.accountId.trim()) {
    throw new WorldDiscoveryRepositoryError("Compte joueur absent.");
  }
  if (!input.eventId.trim()) {
    throw new WorldDiscoveryRepositoryError("Identifiant d'événement absent.");
  }
  const occurredAt = new Date(input.discoveredAt);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new WorldDiscoveryRepositoryError("Date de découverte invalide.");
  }
  if (!input.target.key.trim()) {
    throw new WorldDiscoveryRepositoryError("Clé de cible absente.");
  }

  const client = await pool.connect();
  let result: DiscoveryResult | undefined;
  try {
    await client.query("BEGIN");

    const duplicate = await client.query<{ id: string }>(
      "SELECT id FROM world_discovery_events WHERE account_id = $1 AND event_id = $2",
      [input.accountId, input.eventId]
    );
    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      const state = await getPersistedDiscoveryState(pool, input.accountId);
      return { status: "duplicate_event", state };
    }

    const existing = await client.query<DiscoveryRow>(
      `SELECT d.account_id, d.target_key, d.target_kind, d.discovery_method,
              d.discovered_at, e.event_id
       FROM world_discoveries d
       JOIN world_discovery_events e
         ON e.account_id = d.account_id AND e.id = d.first_event_id
       WHERE d.account_id = $1 AND d.target_kind = $2 AND d.target_key = $3
       FOR UPDATE OF d`,
      [input.accountId, input.target.kind, input.target.key]
    );

    if (existing.rows[0]) {
      const repeated = await client.query<{ id: string }>(
        `INSERT INTO world_discovery_events
         (account_id, event_id, target_kind, target_key, discovery_method, outcome, occurred_at)
         VALUES ($1, $2, $3, $4, $5, 'already_discovered', $6)
         ON CONFLICT (account_id, event_id) DO NOTHING
         RETURNING id`,
        [input.accountId, input.eventId, input.target.kind, input.target.key, input.method, occurredAt]
      );
      if (!repeated.rows[0]) {
        await client.query("ROLLBACK");
        return {
          status: "duplicate_event",
          state: await getPersistedDiscoveryState(pool, input.accountId)
        };
      }
      await client.query("COMMIT");
      const state = await getPersistedDiscoveryState(pool, input.accountId);
      result = {
        status: "already_discovered",
        state,
        record: toDiscoveryRecord(existing.rows[0])
      };
      return result;
    }

    if (input.target.editorialStatus !== "approved") {
      await client.query("ROLLBACK");
      return {
        status: "rejected",
        state: await getPersistedDiscoveryState(pool, input.accountId),
        reason: "Cette découverte n'est pas approuvée."
      };
    }

    const prerequisites = input.target.prerequisiteKeys ?? [];
    if (prerequisites.length > 0) {
      const satisfied = await client.query<{ target_key: string }>(
        `SELECT target_key
         FROM world_discoveries
         WHERE account_id = $1
           AND target_key = ANY($2::text[])`,
        [input.accountId, prerequisites]
      );
      const found = new Set(satisfied.rows.map((row) => row.target_key));
      if (prerequisites.some((key) => !found.has(key))) {
        await client.query("ROLLBACK");
        return {
          status: "rejected",
          state: await getPersistedDiscoveryState(pool, input.accountId),
          reason: "Les prérequis de découverte ne sont pas remplis."
        };
      }
    }

    const event = await client.query<{ id: string }>(
      `INSERT INTO world_discovery_events
       (account_id, event_id, target_kind, target_key, discovery_method, outcome, occurred_at)
       VALUES ($1, $2, $3, $4, $5, 'discovered', $6)
       ON CONFLICT (account_id, event_id) DO NOTHING
       RETURNING id`,
      [input.accountId, input.eventId, input.target.kind, input.target.key, input.method, occurredAt]
    );
    if (!event.rows[0]) {
      await client.query("ROLLBACK");
      return {
        status: "duplicate_event",
        state: await getPersistedDiscoveryState(pool, input.accountId)
      };
    }

    const inserted = await client.query(
      `INSERT INTO world_discoveries
       (account_id, target_kind, target_key, discovery_method, discovered_at, first_event_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_id, target_kind, target_key) DO NOTHING
       RETURNING account_id`,
      [
        input.accountId,
        input.target.kind,
        input.target.key,
        input.method,
        occurredAt,
        event.rows[0].id
      ]
    );

    if (inserted.rows.length === 0) {
      await client.query(
        "UPDATE world_discovery_events SET outcome = 'already_discovered' WHERE id = $1",
        [event.rows[0].id]
      );
    }
    await client.query("COMMIT");

    const state = await getPersistedDiscoveryState(pool, input.accountId);
    const record = state.records.find((entry) =>
      entry.targetKind === input.target.kind && entry.targetKey === input.target.key
    );
    if (!record) {
      throw new WorldDiscoveryRepositoryError("La découverte a été validée mais son état est introuvable.");
    }
    result = inserted.rows.length > 0
      ? { status: "discovered", state, record }
      : { status: "already_discovered", state, record };
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
