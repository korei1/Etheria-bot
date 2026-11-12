import type { Pool } from "pg";

export interface CharacterCreationDraft {
  accountId: string;
  firstName: string;
  publicPseudonym: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DraftRow {
  account_id: string;
  first_name: string;
  public_pseudonym: string;
  created_at: Date;
  updated_at: Date;
}

/** Vérifie la disponibilité actuelle d'un pseudonyme sans le réserver. */
export async function isPseudonymAvailable(
  pool: Pool,
  publicPseudonym: string
): Promise<boolean> {
  const normalized = publicPseudonym.trim().toLowerCase();
  if (!normalized) return false;

  const result = await pool.query(
    `SELECT 1
     FROM characters
     WHERE lower(btrim(public_pseudonym)) = $1
     LIMIT 1`,
    [normalized]
  );

  return result.rowCount === 0;
}

/** Enregistre ou remplace le brouillon modifiable du compte. */
export async function saveCharacterDraft(
  pool: Pool,
  input: { accountId: string; firstName: string; publicPseudonym: string }
): Promise<CharacterCreationDraft> {
  const accountId = input.accountId.trim();
  const firstName = input.firstName.trim();
  const publicPseudonym = input.publicPseudonym.trim();

  if (!accountId || !firstName || !publicPseudonym) {
    throw new Error("Le prénom et le pseudonyme sont obligatoires.");
  }

  const result = await pool.query<DraftRow>(
    `INSERT INTO character_creation_drafts (
       account_id, first_name, public_pseudonym
     )
     VALUES ($1, $2, $3)
     ON CONFLICT (account_id)
     DO UPDATE SET
       first_name = EXCLUDED.first_name,
       public_pseudonym = EXCLUDED.public_pseudonym,
       updated_at = NOW()
     RETURNING account_id, first_name, public_pseudonym, created_at, updated_at`,
    [accountId, firstName, publicPseudonym]
  );

  const row = result.rows[0];
  if (!row) throw new Error("Impossible d'enregistrer le brouillon.");

  return {
    accountId: row.account_id,
    firstName: row.first_name,
    publicPseudonym: row.public_pseudonym,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Récupère le brouillon en cours d'un compte. */
export async function getCharacterDraft(
  pool: Pool,
  accountId: string
): Promise<CharacterCreationDraft | null> {
  const result = await pool.query<DraftRow>(
    `SELECT account_id, first_name, public_pseudonym, created_at, updated_at
     FROM character_creation_drafts
     WHERE account_id = $1
     LIMIT 1`,
    [accountId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    accountId: row.account_id,
    firstName: row.first_name,
    publicPseudonym: row.public_pseudonym,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Supprime le brouillon après confirmation définitive du personnage. */
export async function deleteCharacterDraft(
  pool: Pool,
  accountId: string
): Promise<void> {
  await pool.query(
    "DELETE FROM character_creation_drafts WHERE account_id = $1",
    [accountId]
  );
}
