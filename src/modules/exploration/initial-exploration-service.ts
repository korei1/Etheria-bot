import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  INITIAL_QUEST_KEY,
  recordQuestMilestoneInTransaction
} from "../quests/quest-service.js";

export type InitialExplorationScene =
  | "awakening"
  | "wind_perceived"
  | "cliff_overlook";

export type InitialExplorationAction =
  | "listen_wind"
  | "observe_surroundings"
  | "follow_wind";

export interface InitialExplorationState {
  scene: InitialExplorationScene;
  updatedAt: Date;
}

interface ExplorationRow {
  current_scene_key: InitialExplorationScene;
  updated_at: Date;
}

export class CharacterNotFoundForExplorationError extends Error {
  constructor() {
    super("Aucun personnage actif correspondant à cette exploration n'a été trouvé.");
    this.name = "CharacterNotFoundForExplorationError";
  }
}

export class InvalidExplorationActionError extends Error {
  constructor(message = "Cette action n'est pas disponible à ce stade de l'exploration.") {
    super(message);
    this.name = "InvalidExplorationActionError";
  }
}

async function ensureProgress(
  client: PoolClient,
  characterId: string
): Promise<ExplorationRow> {
  await client.query(
    `INSERT INTO character_exploration_progress (character_id, current_scene_key)
     VALUES ($1, 'awakening')
     ON CONFLICT (character_id) DO NOTHING`,
    [characterId]
  );

  const result = await client.query<ExplorationRow>(
    `SELECT current_scene_key, updated_at
     FROM character_exploration_progress
     WHERE character_id = $1
     FOR UPDATE`,
    [characterId]
  );

  const row = result.rows[0];
  if (!row) throw new Error("La progression d'exploration n'a pas pu être initialisée.");
  return row;
}

export async function getInitialExplorationState(
  pool: Pool,
  accountId: string,
  characterId: string
): Promise<InitialExplorationState> {
  const result = await pool.query<ExplorationRow>(
    `SELECT p.current_scene_key, p.updated_at
     FROM character_exploration_progress p
     JOIN characters c ON c.id = p.character_id
     WHERE p.character_id = $1
       AND c.account_id = $2
       AND c.status = 'active'`,
    [characterId, accountId]
  );

  const row = result.rows[0];
  if (!row) throw new CharacterNotFoundForExplorationError();

  return { scene: row.current_scene_key, updatedAt: row.updated_at };
}

/**
 * Applique une action de la première séquence d'exploration.
 * L'identifiant Discord de l'interaction sert de clé d'idempotence.
 * Le lieu de départ n'est jamais lu ni retourné par ce module.
 */
export async function performInitialExplorationAction(
  pool: Pool,
  input: {
    interactionId: string;
    accountId: string;
    characterId: string;
    action: InitialExplorationAction;
  }
): Promise<InitialExplorationState> {
  const interactionId = input.interactionId.trim();
  if (!interactionId) throw new Error("L'identifiant de l'interaction est obligatoire.");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const character = await client.query(
      `SELECT id
       FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, input.accountId]
    );
    if (!character.rowCount) throw new CharacterNotFoundForExplorationError();

    const priorEvent = await client.query<{
      scene_after: InitialExplorationScene;
    }>(
      `SELECT scene_after
       FROM character_exploration_events
       WHERE event_id = $1 AND character_id = $2`,
      [interactionId, input.characterId]
    );

    if (priorEvent.rows[0]) {
      const current = await ensureProgress(client, input.characterId);
      await client.query("COMMIT");
      return { scene: current.current_scene_key, updatedAt: current.updated_at };
    }

    const progress = await ensureProgress(client, input.characterId);
    let nextScene = progress.current_scene_key;

    switch (input.action) {
      case "observe_surroundings":
        // L'observation est libre et n'impose pas de progression.
        break;
      case "listen_wind":
        if (progress.current_scene_key !== "awakening") {
          throw new InvalidExplorationActionError();
        }
        nextScene = "wind_perceived";
        break;
      case "follow_wind":
        if (progress.current_scene_key !== "wind_perceived") {
          throw new InvalidExplorationActionError("Il faut d'abord prendre le temps de percevoir le vent.");
        }
        nextScene = "cliff_overlook";
        break;
      default:
        throw new InvalidExplorationActionError();
    }

    const updated = await client.query<ExplorationRow>(
      `UPDATE character_exploration_progress
       SET current_scene_key = $2, updated_at = NOW()
       WHERE character_id = $1
       RETURNING current_scene_key, updated_at`,
      [input.characterId, nextScene]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error("La progression d'exploration n'a pas pu être enregistrée.");

    await client.query(
      `INSERT INTO character_exploration_events (
         event_id, character_id, action_key, scene_before, scene_after
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        interactionId,
        input.characterId,
        input.action,
        progress.current_scene_key,
        nextScene
      ]
    );

    if (input.action === "listen_wind" && nextScene === "wind_perceived") {
      await recordQuestMilestoneInTransaction(client, {
        eventId: randomUUID(),
        characterId: input.characterId,
        questKey: INITIAL_QUEST_KEY,
        milestoneKey: "vent_percu",
        sourceKey: "initial_exploration"
      });
    }

    if (input.action === "follow_wind" && nextScene === "cliff_overlook") {
      await recordQuestMilestoneInTransaction(client, {
        eventId: randomUUID(),
        characterId: input.characterId,
        questKey: INITIAL_QUEST_KEY,
        milestoneKey: "point_de_vue_atteint",
        sourceKey: "initial_exploration"
      });
    }

    await client.query("COMMIT");
    return { scene: updatedRow.current_scene_key, updatedAt: updatedRow.updated_at };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
