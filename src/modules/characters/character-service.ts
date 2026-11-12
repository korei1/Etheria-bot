import type { Pool } from "pg";
import { initializeInitialQuest } from "../quests/quest-service.js";
import type { CharacterGender } from "./character-draft-service.js";

export interface CreateCharacterInput {
  accountId: string;
  firstName: string;
  publicPseudonym: string;
  avatarModelKey?: string | null;
  genderIdentity?: CharacterGender | null;
  predecessorCharacterId?: string | null;
  relationshipToPredecessor?: string | null;
}

export interface EtheriaCharacter {
  id: string;
  accountId: string;
  firstName: string;
  publicPseudonym: string;
  originCountryId: string | null;
  spawnZoneId: string | null;
  ageYears: number;
  isOrphan: boolean;
  level: number;
  status: "active" | "deceased";
  predecessorCharacterId: string | null;
  relationshipToPredecessor: string | null;
  avatarModelKey: string | null;
  genderIdentity: string | null;
  createdAt: Date;
  confirmedAt: Date;
  diedAt: Date | null;
}

interface CharacterRow {
  id: string;
  account_id: string;
  first_name: string;
  public_pseudonym: string;
  origin_country_id: string | null;
  spawn_zone_id: string | null;
  age_years: number;
  is_orphan: boolean;
  level: number;
  status: "active" | "deceased";
  predecessor_character_id: string | null;
  relationship_to_predecessor: string | null;
  avatar_model_key: string | null;
  gender_identity: string | null;
  created_at: Date;
  confirmed_at: Date;
  died_at: Date | null;
}

export class CharacterAlreadyExistsError extends Error {
  constructor(message = "Ce compte possède déjà un personnage actif.") {
    super(message);
    this.name = "CharacterAlreadyExistsError";
  }
}

export class PseudonymUnavailableError extends Error {
  constructor() {
    super("Ce pseudonyme est déjà utilisé dans Etheria.");
    this.name = "PseudonymUnavailableError";
  }
}

export class InvalidCharacterLineageError extends Error {
  constructor() {
    super("Le personnage précédent doit appartenir au même compte et être décédé.");
    this.name = "InvalidCharacterLineageError";
  }
}

export class NoOriginCountryAvailableError extends Error {
  constructor() {
    super("Aucun pays n'est actuellement disponible pour attribuer une origine.");
    this.name = "NoOriginCountryAvailableError";
  }
}

export class AvatarModelUnavailableError extends Error {
  constructor() {
    super("Le modèle d'avatar choisi n'est plus disponible.");
    this.name = "AvatarModelUnavailableError";
  }
}

export class NoStartingSpawnAvailableError extends Error {
  constructor() {
    super("Aucun point de départ naturel, sûr et accessible n'est configuré dans ce pays.");
    this.name = "NoStartingSpawnAvailableError";
  }
}

function mapCharacter(row: CharacterRow): EtheriaCharacter {
  return {
    id: row.id,
    accountId: row.account_id,
    firstName: row.first_name,
    publicPseudonym: row.public_pseudonym,
    originCountryId: row.origin_country_id,
    spawnZoneId: row.spawn_zone_id,
    ageYears: row.age_years,
    isOrphan: row.is_orphan,
    level: row.level,
    status: row.status,
    predecessorCharacterId: row.predecessor_character_id,
    relationshipToPredecessor: row.relationship_to_predecessor,
    avatarModelKey: row.avatar_model_key,
    genderIdentity: row.gender_identity,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    diedAt: row.died_at
  };
}

/**
 * Crée un personnage confirmé.
 *
 * Le prénom et le pseudonyme sont indépendants de l'identité Discord.
 * Le pseudonyme est réservé mondialement, même après le décès du personnage.
 * Les brouillons modifiables avant confirmation seront gérés par le parcours Discord.
 */
export async function createCharacter(
  pool: Pool,
  input: CreateCharacterInput
): Promise<EtheriaCharacter> {
  const accountId = input.accountId.trim();
  const firstName = input.firstName.trim();
  const publicPseudonym = input.publicPseudonym.trim();
  const normalizedPseudonym = publicPseudonym.toLowerCase();

  if (!accountId || !firstName || !publicPseudonym) {
    throw new Error("Le compte, le prénom et le pseudonyme sont obligatoires.");
  }

  if (!input.genderIdentity || !["femme", "homme", "agenre"].includes(input.genderIdentity)) {
    throw new Error("Le genre du personnage doit être femme, homme ou agenre.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Sérialise les validations d'un même pseudonyme avant l'insertion.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`etheria:pseudonym:${normalizedPseudonym}`]
    );

    const existingPseudonym = await client.query(
      "SELECT 1 FROM characters WHERE lower(btrim(public_pseudonym)) = $1 LIMIT 1",
      [normalizedPseudonym]
    );

    if (existingPseudonym.rowCount) {
      throw new PseudonymUnavailableError();
    }

    const activeCharacter = await client.query(
      "SELECT 1 FROM characters WHERE account_id = $1 AND status = 'active' LIMIT 1",
      [accountId]
    );

    if (activeCharacter.rowCount) {
      throw new CharacterAlreadyExistsError();
    }

    let originCountryId: string | null = null;

    if (input.predecessorCharacterId) {
      const predecessor = await client.query<{ origin_country_id: string | null }>(
        `SELECT origin_country_id
         FROM characters
         WHERE id = $1 AND account_id = $2 AND status = 'deceased'
         LIMIT 1`,
        [input.predecessorCharacterId, accountId]
      );

      const predecessorRow = predecessor.rows[0];
      if (!predecessorRow) {
        throw new InvalidCharacterLineageError();
      }

      // Une nouvelle génération reste rattachée au pays d'origine de sa famille.
      if (
        originCountryId !== null &&
        predecessorRow.origin_country_id !== originCountryId
      ) {
        throw new InvalidCharacterLineageError();
      }
      originCountryId = predecessorRow.origin_country_id;
    } else if (input.relationshipToPredecessor) {
      throw new InvalidCharacterLineageError();
    }

    if (!originCountryId) {
      // Verrou global pour que deux créations simultanées ne déséquilibrent
      // pas la répartition entre pays. Umbrelune est exclue des origines publiques.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('etheria:origin-country-allocation', 0))"
      );

      const country = await client.query<{ id: string }>(
        `SELECT c.id
         FROM countries c
         WHERE c.is_origin_available = TRUE
           AND c.is_secret = FALSE
           AND EXISTS (
             SELECT 1
             FROM starting_spawn_zones z
             WHERE z.country_id = c.id
               AND z.is_active = TRUE
               AND z.is_natural = TRUE
               AND z.is_wilderness = TRUE
               AND z.is_safe_for_new_character = TRUE
               AND z.is_accessible_for_new_character = TRUE
           )
         ORDER BY (
           SELECT COUNT(*)
           FROM characters ch
           WHERE ch.origin_country_id = c.id
         ) ASC, random()
         LIMIT 1`
      );

      originCountryId = country.rows[0]?.id ?? null;
      if (!originCountryId) {
        throw new NoOriginCountryAvailableError();
      }
    }

    if (!input.avatarModelKey) {
      throw new AvatarModelUnavailableError();
    }

    const avatarModel = await client.query(
      "SELECT 1 FROM avatar_models WHERE model_key = $1 AND is_active = TRUE AND gender_identity = $2 LIMIT 1",
      [input.avatarModelKey, input.genderIdentity]
    );
    if (!avatarModel.rowCount) {
      throw new AvatarModelUnavailableError();
    }

    // Le point d'apparition est tiré uniquement parmi les zones naturelles
    // sûres et accessibles du pays attribué. Le poids permet de régler la
    // fréquence de chaque zone sans coder de lieu fictif dans l'application.
    const spawnZone = await client.query<{ id: string }>(
      `SELECT id
       FROM starting_spawn_zones
       WHERE country_id = $1
         AND is_active = TRUE
         AND is_natural = TRUE
         AND is_wilderness = TRUE
         AND is_safe_for_new_character = TRUE
         AND is_accessible_for_new_character = TRUE
       ORDER BY -ln(random()) / spawn_weight
       LIMIT 1`,
      [originCountryId]
    );

    const spawnZoneId = spawnZone.rows[0]?.id ?? null;
    if (!spawnZoneId) {
      throw new NoStartingSpawnAvailableError();
    }

    const result = await client.query<CharacterRow>(
      `INSERT INTO characters (
         account_id,
         first_name,
         public_pseudonym,
         origin_country_id,
         spawn_zone_id,
         predecessor_character_id,
         relationship_to_predecessor,
         avatar_model_key,
         gender_identity
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id,
         account_id,
         first_name,
         public_pseudonym,
         origin_country_id,
         spawn_zone_id,
         age_years,
         is_orphan,
         level,
         status,
         predecessor_character_id,
         relationship_to_predecessor,
         avatar_model_key,
         gender_identity,
         created_at,
         confirmed_at,
         died_at`,
      [
        accountId,
        firstName,
        publicPseudonym,
        originCountryId,
        spawnZoneId,
        input.predecessorCharacterId ?? null,
        input.relationshipToPredecessor ?? null,
        input.avatarModelKey ?? null,
        input.genderIdentity ?? null
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("La création du personnage n'a retourné aucune donnée.");
    }

    await initializeInitialQuest(client, row.id);

    await client.query("COMMIT");
    return mapCharacter(row);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      const constraint = "constraint" in error ? error.constraint : undefined;
      if (constraint === "characters_public_pseudonym_global_unique") {
        throw new PseudonymUnavailableError();
      }
      if (constraint === "characters_one_active_per_account") {
        throw new CharacterAlreadyExistsError();
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/** Récupère le personnage actuellement actif d'un compte. */
export async function getActiveCharacter(
  pool: Pool,
  accountId: string
): Promise<EtheriaCharacter | null> {
  const result = await pool.query<CharacterRow>(
    `SELECT
       id,
       account_id,
       first_name,
       public_pseudonym,
       origin_country_id,
       spawn_zone_id,
       age_years,
       is_orphan,
       level,
       status,
       predecessor_character_id,
       relationship_to_predecessor,
       avatar_model_key,
       gender_identity,
       created_at,
       confirmed_at,
       died_at
     FROM characters
     WHERE account_id = $1 AND status = 'active'
     LIMIT 1`,
    [accountId]
  );

  const row = result.rows[0];
  return row ? mapCharacter(row) : null;
}
