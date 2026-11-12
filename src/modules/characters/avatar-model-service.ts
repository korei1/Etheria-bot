import type { Pool } from "pg";

export interface AvatarModel {
  modelKey: string;
  displayName: string;
  description: string | null;
  imageUrl: string;
  sortOrder: number;
}

interface AvatarModelRow {
  model_key: string;
  display_name: string;
  description: string | null;
  image_url: string;
  sort_order: number;
}

/** Retourne les modèles réellement publiés dans le catalogue. */
export async function listActiveAvatarModels(pool: Pool): Promise<AvatarModel[]> {
  const result = await pool.query<AvatarModelRow>(
    `SELECT model_key, display_name, description, image_url, sort_order
     FROM avatar_models
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, display_name ASC
     LIMIT 25`
  );

  return result.rows.map((row) => ({
    modelKey: row.model_key,
    displayName: row.display_name,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order
  }));
}
