import type { Pool, PoolClient } from "pg";

export interface DiscoveredSpawnLocation {
  countryName: string;
  regionName: string;
  localityName: string | null;
  biomeName: string;
  terrainDescription: string;
  settlementProximity: "nearby" | "moderate" | "remote";
  discoveredAt: Date;
}

export interface NpcEncounterResult {
  encounterId: string;
  npcKey: string;
  encounteredAt: Date;
  isFirstEncounter: boolean;
  wasAlreadyRecorded: boolean;
  discoveredSpawnLocation: DiscoveredSpawnLocation | null;
}

interface CharacterEncounterRow {
  spawn_zone_id: string | null;
  first_npc_key: string | null;
  first_npc_encounter_at: Date | null;
  spawn_location_revealed_at: Date | null;
}

interface EncounterRow {
  encounter_id: string;
  npc_key: string;
  occurred_at: Date;
  is_first_for_character: boolean;
  character_id: string;
  account_id: string;
}

interface SpawnLocationRow {
  country_name: string;
  region_name: string;
  locality_name: string | null;
  biome_name: string;
  terrain_description: string;
  settlement_proximity: "nearby" | "moderate" | "remote";
  discovered_at: Date;
}

export class CharacterNotFoundForEncounterError extends Error {
  constructor() {
    super("Aucun personnage actif correspondant à cette rencontre n'a été trouvé.");
    this.name = "CharacterNotFoundForEncounterError";
  }
}

export class SpawnLocationNotFoundError extends Error {
  constructor() {
    super("Le lieu d'apparition de ce personnage est introuvable.");
    this.name = "SpawnLocationNotFoundError";
  }
}

export class EncounterIdConflictError extends Error {
  constructor() {
    super("Cet identifiant de rencontre est déjà associé à un autre personnage.");
    this.name = "EncounterIdConflictError";
  }
}

async function getDiscoveredSpawnLocation(
  client: PoolClient,
  spawnZoneId: string,
  discoveredAt: Date
): Promise<DiscoveredSpawnLocation> {
  const result = await client.query<SpawnLocationRow>(
    `SELECT
       c.display_name AS country_name,
       z.region_name,
       z.locality_name,
       z.biome_name,
       z.terrain_description,
       z.settlement_proximity,
       $2::timestamptz AS discovered_at
     FROM starting_spawn_zones z
     JOIN countries c ON c.id = z.country_id
     WHERE z.id = $1
     LIMIT 1`,
    [spawnZoneId, discoveredAt]
  );

  const row = result.rows[0];
  if (!row) throw new SpawnLocationNotFoundError();

  return {
    countryName: row.country_name,
    regionName: row.region_name,
    localityName: row.locality_name,
    biomeName: row.biome_name,
    terrainDescription: row.terrain_description,
    settlementProximity: row.settlement_proximity,
    discoveredAt: row.discovered_at
  };
}

/**
 * Enregistre une rencontre PNJ validée par le système de jeu.
 *
 * Le gestionnaire de quête/exploration doit appeler cette fonction uniquement
 * lorsque le personnage a réellement rencontré le PNJ. La fonction ne crée
 * pas elle-même de rencontre et ne doit pas être exposée comme un bouton libre.
 *
 * La première rencontre, son horodatage et la révélation du lieu sont
 * enregistrés dans une transaction unique. encounterId sert de clé
 * d'idempotence afin qu'une relance technique ne crée pas une seconde rencontre.
 */
export async function recordNpcEncounter(
  pool: Pool,
  input: {
    encounterId: string;
    accountId: string;
    characterId: string;
    npcKey: string;
  }
): Promise<NpcEncounterResult> {
  const encounterId = input.encounterId.trim();
  const accountId = input.accountId.trim();
  const characterId = input.characterId.trim();
  const npcKey = input.npcKey.trim();

  if (!encounterId || !accountId || !characterId || !npcKey) {
    throw new Error("L'identifiant de rencontre, le compte, le personnage et le PNJ sont obligatoires.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const characterResult = await client.query<CharacterEncounterRow>(
      `SELECT
         spawn_zone_id,
         first_npc_key,
         first_npc_encounter_at,
         spawn_location_revealed_at
       FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [characterId, accountId]
    );

    const character = characterResult.rows[0];
    if (!character) throw new CharacterNotFoundForEncounterError();

    const existingResult = await client.query<EncounterRow>(
      `SELECT encounter_id, npc_key, occurred_at, is_first_for_character,
              character_id, account_id
       FROM npc_encounters
       WHERE encounter_id = $1
       LIMIT 1`,
      [encounterId]
    );

    const existing = existingResult.rows[0];
    if (existing) {
      if (existing.character_id !== characterId || existing.account_id !== accountId) {
        throw new EncounterIdConflictError();
      }

      let discoveredSpawnLocation: DiscoveredSpawnLocation | null = null;
      if (existing.is_first_for_character) {
        if (!character.spawn_zone_id || !character.spawn_location_revealed_at) {
          throw new SpawnLocationNotFoundError();
        }
        discoveredSpawnLocation = await getDiscoveredSpawnLocation(
          client,
          character.spawn_zone_id,
          character.spawn_location_revealed_at
        );
      }

      await client.query("COMMIT");
      return {
        encounterId: existing.encounter_id,
        npcKey: existing.npc_key,
        encounteredAt: existing.occurred_at,
        isFirstEncounter: existing.is_first_for_character,
        wasAlreadyRecorded: true,
        discoveredSpawnLocation
      };
    }

    const isFirstEncounter = character.first_npc_encounter_at === null;

    let encounteredAt: Date;
    let discoveredSpawnLocation: DiscoveredSpawnLocation | null = null;

    if (isFirstEncounter) {
      if (!character.spawn_zone_id) throw new SpawnLocationNotFoundError();

      const updated = await client.query<{
        first_npc_encounter_at: Date;
        spawn_location_revealed_at: Date;
      }>(
        `UPDATE characters
         SET first_npc_key = $3,
             first_npc_encounter_at = NOW(),
             spawn_location_revealed_at = COALESCE(spawn_location_revealed_at, NOW())
         WHERE id = $1 AND account_id = $2
         RETURNING first_npc_encounter_at, spawn_location_revealed_at`,
        [characterId, accountId, npcKey]
      );

      const updatedRow = updated.rows[0];
      if (!updatedRow) throw new CharacterNotFoundForEncounterError();

      encounteredAt = updatedRow.first_npc_encounter_at;
      discoveredSpawnLocation = await getDiscoveredSpawnLocation(
        client,
        character.spawn_zone_id,
        updatedRow.spawn_location_revealed_at
      );
    } else {
      encounteredAt = new Date();
    }

    await client.query(
      `INSERT INTO npc_encounters (
         encounter_id, account_id, character_id, npc_key, occurred_at, is_first_for_character
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [encounterId, accountId, characterId, npcKey, encounteredAt, isFirstEncounter]
    );

    await client.query("COMMIT");

    return {
      encounterId,
      npcKey,
      encounteredAt,
      isFirstEncounter,
      wasAlreadyRecorded: false,
      discoveredSpawnLocation
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
