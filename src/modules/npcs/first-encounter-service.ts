import type { Pool } from "pg";

export interface DiscoveredSpawnLocation {
  countryName: string;
  regionName: string;
  localityName: string | null;
  biomeName: string;
  terrainDescription: string;
  settlementProximity: "nearby" | "moderate" | "remote";
  discoveredAt: Date;
  wasAlreadyRevealed: boolean;
}

interface SpawnLocationRow {
  country_name: string;
  region_name: string;
  locality_name: string | null;
  biome_name: string;
  terrain_description: string;
  settlement_proximity: "nearby" | "moderate" | "remote";
  spawn_location_revealed_at: Date;
}

export class SpawnLocationNotFoundError extends Error {
  constructor() {
    super("Le lieu d'apparition de ce personnage est introuvable.");
    this.name = "SpawnLocationNotFoundError";
  }
}

export class CharacterNotFoundForEncounterError extends Error {
  constructor() {
    super("Aucun personnage actif correspondant à cette rencontre n'a été trouvé.");
    this.name = "CharacterNotFoundForEncounterError";
  }
}

/**
 * À appeler exclusivement après l'enregistrement effectif de la première
 * rencontre avec un PNJ. Cette fonction révèle alors le lieu de départ.
 *
 * Le lieu reste absent des interfaces de création et des réponses ordinaires
 * du personnage. La première révélation est persistée et les appels suivants
 * renvoient la même découverte sans créer une nouvelle révélation.
 */
export async function revealSpawnLocationAfterFirstNpcEncounter(
  pool: Pool,
  input: { accountId: string; characterId: string }
): Promise<DiscoveredSpawnLocation> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const character = await client.query<{
      spawn_zone_id: string | null;
      spawn_location_revealed_at: Date | null;
    }>(
      `SELECT spawn_zone_id, spawn_location_revealed_at
       FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, input.accountId]
    );

    const characterRow = character.rows[0];
    if (!characterRow) throw new CharacterNotFoundForEncounterError();
    if (!characterRow.spawn_zone_id) throw new SpawnLocationNotFoundError();

    let discoveredAt = characterRow.spawn_location_revealed_at;
    const wasAlreadyRevealed = discoveredAt !== null;

    if (!discoveredAt) {
      const updated = await client.query<{ spawn_location_revealed_at: Date }>(
        `UPDATE characters
         SET spawn_location_revealed_at = NOW()
         WHERE id = $1 AND account_id = $2
         RETURNING spawn_location_revealed_at`,
        [input.characterId, input.accountId]
      );
      discoveredAt = updated.rows[0]?.spawn_location_revealed_at ?? null;
    }

    if (!discoveredAt) throw new Error("La découverte du lieu n'a pas pu être enregistrée.");

    const location = await client.query<SpawnLocationRow>(
      `SELECT
         c.display_name AS country_name,
         z.region_name,
         z.locality_name,
         z.biome_name,
         z.terrain_description,
         z.settlement_proximity,
         $3::timestamptz AS spawn_location_revealed_at
       FROM starting_spawn_zones z
       JOIN countries c ON c.id = z.country_id
       WHERE z.id = $1
         AND c.is_secret = FALSE
       LIMIT 1`,
      [characterRow.spawn_zone_id, input.characterId, discoveredAt]
    );

    const row = location.rows[0];
    if (!row) throw new SpawnLocationNotFoundError();

    await client.query("COMMIT");

    return {
      countryName: row.country_name,
      regionName: row.region_name,
      localityName: row.locality_name,
      biomeName: row.biome_name,
      terrainDescription: row.terrain_description,
      settlementProximity: row.settlement_proximity,
      discoveredAt: row.spawn_location_revealed_at,
      wasAlreadyRevealed
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
