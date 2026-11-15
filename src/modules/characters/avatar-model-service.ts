import type { Pool } from "pg";
import type { CharacterGender } from "./character-draft-service.js";

export interface AvatarModel {
  modelKey: string;
  displayName: string;
  description: string | null;
  imageUrl: string;
  genderIdentity: CharacterGender;
  sortOrder: number;
}

interface AvatarModelRow {
  model_key: string;
  display_name: string;
  description: string | null;
  image_url: string;
  gender_identity: CharacterGender;
  sort_order: number;
}

/** Retourne uniquement les modèles publiés correspondant au genre choisi. */
export async function listActiveAvatarModels(
  pool: Pool,
  genderIdentity: CharacterGender
): Promise<AvatarModel[]> {
  const result = await pool.query<AvatarModelRow>(
    `SELECT model_key, display_name, description, image_url, gender_identity, sort_order
     FROM avatar_models
     WHERE is_active = TRUE AND gender_identity = $1
     ORDER BY sort_order ASC, display_name ASC
     LIMIT 25`,
    [genderIdentity]
  );

  return result.rows.map((row) => ({
    modelKey: row.model_key,
    displayName: row.display_name,
    description: row.description,
    imageUrl: row.image_url,
    genderIdentity: row.gender_identity,
    sortOrder: row.sort_order
  }));
}
