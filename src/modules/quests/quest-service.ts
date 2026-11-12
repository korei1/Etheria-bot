import type { Pool, PoolClient } from "pg";

export const INITIAL_QUEST_KEY = "suivre_le_vent";
export const INITIAL_QUEST_FIRST_STEP = "reveil";
export const INITIAL_QUEST_FIRST_NPC_MILESTONE = "premiere_rencontre_pnj";

export interface QuestProgress {
  questKey: string;
  currentStepKey: string;
  status: "active" | "completed" | "paused";
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

interface QuestProgressRow {
  quest_key: string;
  current_step_key: string;
  status: "active" | "completed" | "paused";
  started_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface RecordQuestMilestoneInput {
  eventId: string;
  characterId: string;
  questKey: string;
  milestoneKey: string;
  sourceKey: string;
}

/** Initialise la quête de départ une seule fois pour un personnage confirmé. */
export async function initializeInitialQuest(
  client: PoolClient,
  characterId: string
): Promise<void> {
  await client.query(
    `INSERT INTO character_quest_progress (
       character_id, quest_key, current_step_key, status
     )
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (character_id, quest_key) DO NOTHING`,
    [characterId, INITIAL_QUEST_KEY, INITIAL_QUEST_FIRST_STEP]
  );
}

/**
 * Enregistre un jalon déjà validé par le moteur de jeu.
 * Cette fonction ne décide jamais qu'une action du joueur constitue un jalon.
 * L'appelant doit avoir validé l'événement en amont.
 *
 * À utiliser avec la transaction métier qui valide l'événement afin d'éviter
 * qu'un événement de quête soit enregistré sans l'action correspondante.
 */
export async function recordQuestMilestoneInTransaction(
  client: PoolClient,
  input: RecordQuestMilestoneInput
): Promise<boolean> {
  const eventId = input.eventId.trim();
  const characterId = input.characterId.trim();
  const questKey = input.questKey.trim();
  const milestoneKey = input.milestoneKey.trim();
  const sourceKey = input.sourceKey.trim();

  if (!eventId || !characterId || !questKey || !milestoneKey || !sourceKey) {
    throw new Error("Les identifiants du jalon de quête sont obligatoires.");
  }

  const inserted = await client.query(
    `INSERT INTO character_quest_events (
       event_id, character_id, quest_key, milestone_key, source_key
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [eventId, characterId, questKey, milestoneKey, sourceKey]
  );

  if (inserted.rowCount === 0) return false;

  const updated = await client.query(
    `UPDATE character_quest_progress
     SET current_step_key = $3,
         updated_at = NOW()
     WHERE character_id = $1
       AND quest_key = $2
       AND status = 'active'`,
    [characterId, questKey, milestoneKey]
  );

  if (updated.rowCount === 0) {
    throw new Error("Aucune progression de quête active ne correspond à ce jalon.");
  }

  return true;
}

export async function getActiveQuestProgress(
  pool: Pool,
  characterId: string
): Promise<QuestProgress | null> {
  const result = await pool.query<QuestProgressRow>(
    `SELECT quest_key, current_step_key, status, started_at, updated_at, completed_at
     FROM character_quest_progress
     WHERE character_id = $1 AND status = 'active'
     ORDER BY started_at ASC
     LIMIT 1`,
    [characterId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    questKey: row.quest_key,
    currentStepKey: row.current_step_key,
    status: row.status,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}
