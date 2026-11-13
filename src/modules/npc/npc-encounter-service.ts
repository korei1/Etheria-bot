import { createHash } from "node:crypto";
import type { Pool } from "pg";

export interface RevealedSpawnLocation {
  countryName: string;
  countryKey: string;
  regionName: string;
  localityName: string | null;
  biomeName: string;
}

export interface NpcEncounterResult {
  recorded: boolean;
  firstEncounter: boolean;
  npcKey: string;
  occurredAt: string | null;
  revealedLocation: RevealedSpawnLocation | null;
}

interface EncounterContextRow {
  first_npc_key: string | null;
  first_npc_encounter_at: Date | null;
  origin_country_id: string;
  spawn_zone_id: string;
  country_key: string;
  country_name: string | null;
  region_name: string;
  locality_name: string | null;
  biome_name: string;
}

function interactionUuid(interactionId: string): string {
  const bytes = createHash("sha256")
    .update("etheria:npc-encounter:" + interactionId)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class NpcEncounterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NpcEncounterError";
  }
}

function mapLocation(row: EncounterContextRow): RevealedSpawnLocation {
  if (!row.country_name) {
    throw new NpcEncounterError("Le lieu d'origine n'est pas encore publiable.");
  }
  return {
    countryName: row.country_name,
    countryKey: row.country_key,
    regionName: row.region_name,
    localityName: row.locality_name,
    biomeName: row.biome_name
  };
}

/**
 * Enregistre une rencontre PNJ. La toute première rencontre révèle le pays
 * d'origine et la zone exacte d'apparition, jamais avant cet événement.
 *
 * À appeler depuis le futur parcours d'interaction PNJ après validation
 * métier de la rencontre. Cette fonction n'est pas un déclencheur public.
 */
export async function recordNpcEncounter(
  pool: Pool,
  input: {
    interactionId: string;
    accountId: string;
    characterId: string;
    npcKey: string;
    occurredAt?: Date;
  }
): Promise<NpcEncounterResult> {
  const interactionId = input.interactionId.trim();
  const npcKey = input.npcKey.trim();
  if (!interactionId || !input.accountId.trim() || !input.characterId.trim() || !npcKey) {
    throw new NpcEncounterError("Les informations de rencontre sont incomplètes.");
  }
  const occurredAt = input.occurredAt ?? new Date();
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new NpcEncounterError("La date de rencontre est invalide.");
  }

  const encounterId = interactionUuid(interactionId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const context = await client.query<EncounterContextRow>(
      `SELECT c.first_npc_key, c.first_npc_encounter_at,
              c.origin_country_id, c.spawn_zone_id,
              co.slug AS country_key, co.display_name AS country_name,
              z.region_name, z.locality_name, z.biome_name
       FROM characters c
       JOIN countries co ON co.id = c.origin_country_id
       JOIN starting_spawn_zones z ON z.id = c.spawn_zone_id
       WHERE c.id = $1 AND c.account_id = $2 AND c.status = 'active'
       FOR UPDATE OF c`,
      [input.characterId, input.accountId]
    );
    const row = context.rows[0];
    if (!row) {
      throw new NpcEncounterError("Personnage actif ou lieu d'origine introuvable.");
    }

    const duplicate = await client.query(
      "SELECT 1 FROM npc_encounters WHERE encounter_id = $1",
      [encounterId]
    );
    if (duplicate.rowCount) {
      const first = row.first_npc_encounter_at !== null;
      await client.query("COMMIT");
      return {
        recorded: false,
        firstEncounter: first,
        npcKey: row.first_npc_key ?? npcKey,
        occurredAt: row.first_npc_encounter_at?.toISOString() ?? null,
        revealedLocation: first ? mapLocation(row) : null
      };
    }

    const isFirst = row.first_npc_encounter_at === null;
    await client.query(
      `INSERT INTO npc_encounters
       (encounter_id, account_id, character_id, npc_key, occurred_at, is_first_for_character)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [encounterId, input.accountId, input.characterId, npcKey, occurredAt, isFirst]
    );

    if (!isFirst) {
      const isOriginalFirstNpc = row.first_npc_key === npcKey;
      await client.query("COMMIT");
      return {
        recorded: true,
        firstEncounter: false,
        npcKey,
        occurredAt: occurredAt.toISOString(),
        revealedLocation: isOriginalFirstNpc ? mapLocation(row) : null
      };
    }

    const revealedLocation = mapLocation(row);
    await client.query(
      `UPDATE characters
       SET first_npc_key = $2,
           first_npc_encounter_at = $3,
           spawn_location_revealed_at = $3
       WHERE id = $1`,
      [input.characterId, npcKey, occurredAt]
    );

    const discoveryEvents = [
      {
        suffix: "country",
        kind: "country",
        key: row.country_key
      },
      {
        suffix: "spawn-zone",
        kind: "spawn_zone",
        key: (await client.query<{ zone_key: string }>(
          "SELECT zone_key FROM starting_spawn_zones WHERE id = $1",
          [row.spawn_zone_id]
        )).rows[0]?.zone_key
      }
    ];
    for (const discovery of discoveryEvents) {
      if (!discovery.key) {
        throw new NpcEncounterError("La zone d'apparition ne possède pas de clé stable.");
      }
      const eventId = `npc-first:${input.characterId}:${discovery.suffix}`;
      const event = await client.query<{ id: string }>(
        `INSERT INTO world_discovery_events
         (account_id, event_id, target_kind, target_key, discovery_method, outcome, occurred_at)
         VALUES ($1, $2, $3, $4, 'first_encounter', 'discovered', $5)
         ON CONFLICT (account_id, event_id) DO NOTHING
         RETURNING id`,
        [input.accountId, eventId, discovery.kind, discovery.key, occurredAt]
      );
      if (!event.rows[0]) {
        throw new NpcEncounterError("Cet événement de première découverte a déjà été utilisé.");
      }
      const discoveryInsert = await client.query(
        `INSERT INTO world_discoveries
         (account_id, target_kind, target_key, discovery_method, discovered_at, first_event_id)
         VALUES ($1, $2, $3, 'first_encounter', $4, $5)
         ON CONFLICT (account_id, target_kind, target_key) DO NOTHING
         RETURNING account_id`,
        [input.accountId, discovery.kind, discovery.key, occurredAt, event.rows[0].id]
      );
      if (discoveryInsert.rowCount === 0) {
        await client.query(
          "UPDATE world_discovery_events SET outcome = 'already_discovered' WHERE id = $1",
          [event.rows[0].id]
        );
      }
    }

    await client.query("COMMIT");
    return {
      recorded: true,
      firstEncounter: true,
      npcKey,
      occurredAt: occurredAt.toISOString(),
      revealedLocation
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
