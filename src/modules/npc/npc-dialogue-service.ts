import type { Pool } from "pg";
import { recordNpcEncounter, type RevealedSpawnLocation } from "./npc-encounter-service.js";
import { isOpenAtLocalMinute, validateOpeningSchedule, type WeeklyOpeningSchedule } from "../world/local-life-simulation.js";
import { getSettlementLocalTime } from "../world/world-clock-service.js";
import { advanceNpcTravelPlans } from "./npc-travel-service.js";

export interface NpcDialogueChoice {
  choiceKey: string;
  label: string;
}

export interface NpcDialogueView {
  conversationId: string;
  npcKey: string;
  npcName: string;
  dialogueText: string;
  choices: NpcDialogueChoice[];
  completed: boolean;
  firstEncounter: boolean;
  revealedLocation: RevealedSpawnLocation | null;
}

interface NpcDefinitionRow {
  npc_key: string;
  display_name: string;
  start_node_key: string;
  settlement_id: string | null;
  presence_schedule: WeeklyOpeningSchedule | null;
}

interface DialogueNodeRow {
  node_key: string;
  dialogue_text: string;
  is_terminal: boolean;
}

interface DialogueChoiceRow {
  choice_key: string;
  choice_label: string;
}


/** Un calendrier de PNJ est évalué dans le fuseau de sa localité.
 * Sans calendrier, le placement reste disponible. Avec un calendrier mais
 * sans heure locale connue (notamment en zone de départ), il n'est pas affiché.
 */
export function isNpcWithinPresenceSchedule(
  schedule: WeeklyOpeningSchedule | null,
  weekday: number,
  minuteOfDay: number
): boolean {
  if (schedule === null) return true;
  if (validateOpeningSchedule(schedule).length > 0) return false;
  return isOpenAtLocalMinute(schedule, weekday, minuteOfDay);
}

async function isNpcPresentAtLocalTime(
  pool: Pool,
  input: {
    settlementId: string | null;
    schedule: WeeklyOpeningSchedule | null;
    now?: Date;
  }
): Promise<boolean> {
  if (!input.schedule) return true;
  if (!input.settlementId) return false;
  const clock = await getSettlementLocalTime(pool, input.settlementId, input.now);
  if (clock.status !== "available") return false;
  return isNpcWithinPresenceSchedule(
    input.schedule,
    clock.localDate.weekday,
    clock.localDate.minuteOfDay
  );
}

export class NpcDialogueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NpcDialogueError";
  }
}

async function loadDialogueView(
  pool: Pool,
  input: {
    conversationId: string;
    accountId: string;
    characterId: string;
    npcKey: string;
    firstEncounter: boolean;
    revealedLocation: RevealedSpawnLocation | null;
  }
): Promise<NpcDialogueView> {
  const result = await pool.query<{
    npc_key: string;
    display_name: string;
    node_key: string;
    dialogue_text: string;
    is_terminal: boolean;
  }>(
    `SELECT n.npc_key, n.display_name, d.node_key, d.dialogue_text, d.is_terminal
     FROM npc_character_conversations c
     JOIN npc_definitions n ON n.npc_key = c.npc_key
     JOIN npc_dialogue_nodes d
       ON d.npc_key = c.npc_key AND d.node_key = c.current_node_key
     JOIN characters ch ON ch.id = c.character_id
     WHERE c.id = $1 AND c.character_id = $2
       AND ch.account_id = $3`,
    [input.conversationId, input.characterId, input.accountId]
  );
  const row = result.rows[0];
  if (!row) throw new NpcDialogueError("La conversation demandée est introuvable.");

  const choices = row.is_terminal
    ? { rows: [] as DialogueChoiceRow[] }
    : await pool.query<DialogueChoiceRow>(
        `SELECT choice_key, choice_label
         FROM npc_dialogue_choices
         WHERE npc_key = $1 AND node_key = $2
         ORDER BY sort_order, choice_key
         LIMIT 5`,
        [row.npc_key, row.node_key]
      );

  return {
    conversationId: input.conversationId,
    npcKey: row.npc_key,
    npcName: row.display_name,
    dialogueText: row.dialogue_text,
    choices: choices.rows.map((choice) => ({
      choiceKey: choice.choice_key,
      label: choice.choice_label
    })),
    completed: row.is_terminal,
    firstEncounter: input.firstEncounter,
    revealedLocation: input.revealedLocation
  };
}

/** Liste les PNJ approuvés présents dans le lieu actuel du personnage. */
export async function listNpcEncountersAtCharacterLocation(
  pool: Pool,
  input: { accountId: string }
): Promise<Array<{ npcKey: string; displayName: string; description: string | null; activityLabel: string | null }>> {
  await advanceNpcTravelPlans(pool);
  const result = await pool.query<{
    npc_key: string;
    display_name: string;
    description: string | null;
    activity_label: string | null;
    settlement_id: string | null;
    presence_schedule: WeeklyOpeningSchedule | null;
  }>(
    `SELECT DISTINCT n.npc_key, n.display_name, n.description,
            COALESCE(nl.activity_label, sl.activity_label) AS activity_label,
            c.current_settlement_id AS settlement_id,
            COALESCE(nl.presence_schedule, sl.presence_schedule) AS presence_schedule
     FROM characters c
     JOIN npc_definitions n ON n.editorial_status = 'approved' AND n.is_active = TRUE
     LEFT JOIN npc_spawn_locations sl
       ON c.current_settlement_id IS NULL
      AND sl.spawn_zone_id = c.spawn_zone_id
      AND sl.npc_key = n.npc_key AND sl.is_active = TRUE
     LEFT JOIN npc_settlement_locations nl
       ON c.current_settlement_id IS NOT NULL
      AND nl.settlement_id = c.current_settlement_id
      AND nl.npc_key = n.npc_key AND nl.is_active = TRUE
     LEFT JOIN world_settlements s ON s.id = c.current_settlement_id
     LEFT JOIN world_discoveries wd
       ON wd.account_id = c.account_id
      AND wd.target_kind = 'settlement'
      AND wd.target_key = s.settlement_key
     WHERE c.account_id = $1 AND c.status = 'active'
       AND (
         sl.npc_key IS NOT NULL
         OR (
           nl.npc_key IS NOT NULL
           AND s.editorial_status = 'approved'
           AND wd.account_id IS NOT NULL
         )
       )
     ORDER BY n.display_name`,
    [input.accountId]
  );
  const available = await Promise.all(result.rows.map(async (row) => ({
    row,
    present: await isNpcPresentAtLocalTime(pool, {
      settlementId: row.settlement_id,
      schedule: row.presence_schedule
    })
  })));
  return available.filter((entry) => entry.present).map(({ row }) => ({
    npcKey: row.npc_key,
    displayName: row.display_name,
    description: row.description,
    activityLabel: row.activity_label
  }));
}

/** Alias conservé pour les appels historiques : la recherche suit désormais le lieu actuel. */
export const listNpcEncountersAtCharacterSpawn = listNpcEncountersAtCharacterLocation;

/**
 * Démarre ou reprend une conversation avec un PNJ présent dans la zone de départ.
 * La première rencontre est enregistrée avant de renvoyer le premier dialogue.
 */
export async function startNpcConversation(
  pool: Pool,
  input: {
    interactionId: string;
    accountId: string;
    characterId: string;
    npcKey: string;
  }
): Promise<NpcDialogueView> {
  await advanceNpcTravelPlans(pool);
  const interactionId = input.interactionId.trim();
  const npcKey = input.npcKey.trim();
  if (!interactionId || !input.accountId.trim() || !input.characterId.trim() || !npcKey) {
    throw new NpcDialogueError("Les informations de conversation sont incomplètes.");
  }

  const npcResult = await pool.query<NpcDefinitionRow>(
    `SELECT n.npc_key, n.display_name, n.start_node_key,
            c.current_settlement_id AS settlement_id,
            COALESCE(nl.presence_schedule, sl.presence_schedule) AS presence_schedule
     FROM characters c
     JOIN npc_definitions n
       ON n.npc_key = $3
      AND n.editorial_status = 'approved'
      AND n.is_active = TRUE
     LEFT JOIN npc_spawn_locations sl
       ON c.current_settlement_id IS NULL
      AND sl.spawn_zone_id = c.spawn_zone_id
      AND sl.npc_key = n.npc_key
      AND sl.is_active = TRUE
     LEFT JOIN npc_settlement_locations nl
       ON c.current_settlement_id IS NOT NULL
      AND nl.settlement_id = c.current_settlement_id
      AND nl.npc_key = n.npc_key
      AND nl.is_active = TRUE
     LEFT JOIN world_settlements s ON s.id = c.current_settlement_id
     LEFT JOIN world_discoveries wd
       ON wd.account_id = c.account_id
      AND wd.target_kind = 'settlement'
      AND wd.target_key = s.settlement_key
     JOIN npc_dialogue_nodes d
       ON d.npc_key = n.npc_key AND d.node_key = n.start_node_key
     WHERE c.id = $1 AND c.account_id = $2 AND c.status = 'active'
       AND (
         sl.npc_key IS NOT NULL
         OR (
           nl.npc_key IS NOT NULL
           AND s.editorial_status = 'approved'
           AND wd.account_id IS NOT NULL
           AND (s.visibility = 'public' OR wd.account_id IS NOT NULL)
         )
       )
     LIMIT 1`,
    [input.characterId, input.accountId, npcKey]
  );
  const npc = npcResult.rows[0];
  if (!npc) {
    throw new NpcDialogueError("Ce personnage n'est pas disponible dans ton lieu actuel ou ce lieu n'a pas encore été découvert.");
  }
  const isPresent = await isNpcPresentAtLocalTime(pool, {
    settlementId: npc.settlement_id,
    schedule: npc.presence_schedule
  });
  if (!isPresent) {
    throw new NpcDialogueError("Ce personnage n'est pas présent à cette heure dans cette localité.");
  }

  const encounter = await recordNpcEncounter(pool, {
    interactionId,
    accountId: input.accountId,
    characterId: input.characterId,
    npcKey
  });

  const client = await pool.connect();
  let conversationId: string;
  try {
    await client.query("BEGIN");
    const character = await client.query(
      `SELECT id FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, input.accountId]
    );
    if (!character.rowCount) {
      throw new NpcDialogueError("Aucun personnage actif ne correspond à cette conversation.");
    }

    const active = await client.query<{ id: string }>(
      `SELECT id FROM npc_character_conversations
       WHERE character_id = $1 AND npc_key = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, npcKey]
    );
    if (active.rows[0]) {
      conversationId = active.rows[0].id;
    } else {
      const created = await client.query<{ id: string }>(
        `INSERT INTO npc_character_conversations
         (character_id, npc_key, current_node_key)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [input.characterId, npcKey, npc.start_node_key]
      );
      if (!created.rows[0]) {
        throw new NpcDialogueError("La conversation n'a pas pu être créée.");
      }
      conversationId = created.rows[0].id;
    }

    await client.query(
      `INSERT INTO npc_conversation_events
       (event_id, conversation_id, character_id, npc_key, node_key, choice_key)
       VALUES ($1, $2, $3, $4, $5, NULL)
       ON CONFLICT (event_id) DO NOTHING`,
      [`start:${interactionId}`, conversationId, input.characterId, npcKey, npc.start_node_key]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return loadDialogueView(pool, {
    conversationId,
    accountId: input.accountId,
    characterId: input.characterId,
    npcKey,
    firstEncounter: encounter.firstEncounter,
    revealedLocation: encounter.revealedLocation
  });
}

/** Enregistre un choix de dialogue et avance d'un seul nœud dans l'arbre validé. */
export async function chooseNpcDialogueOption(
  pool: Pool,
  input: {
    interactionId: string;
    accountId: string;
    characterId: string;
    conversationId: string;
    choiceKey: string;
  }
): Promise<NpcDialogueView> {
  const interactionId = input.interactionId.trim();
  const choiceKey = input.choiceKey.trim();
  if (!interactionId || !choiceKey) throw new NpcDialogueError("Le choix de dialogue est incomplet.");

  const client = await pool.connect();
  let npcKey = "";
  let nextNodeKey = "";
  try {
    await client.query("BEGIN");
    const conversation = await client.query<{
      npc_key: string;
      current_node_key: string;
      status: "active" | "completed";
    }>(
      `SELECT c.npc_key, c.current_node_key, c.status
       FROM npc_character_conversations c
       JOIN characters ch ON ch.id = c.character_id
       WHERE c.id = $1 AND c.character_id = $2 AND ch.account_id = $3
       FOR UPDATE OF c`,
      [input.conversationId, input.characterId, input.accountId]
    );
    const current = conversation.rows[0];
    if (!current) {
      throw new NpcDialogueError("Cette conversation est introuvable.");
    }
    npcKey = current.npc_key;

    const duplicateEvent = await client.query(
      "SELECT 1 FROM npc_conversation_events WHERE event_id = $1",
      [interactionId]
    );
    if (duplicateEvent.rowCount) {
      await client.query("COMMIT");
    } else {
      if (current.status !== "active") {
        throw new NpcDialogueError("Cette conversation n'est plus active.");
      }
      const choice = await client.query<{ next_node_key: string }>(
      `SELECT next_node_key
       FROM npc_dialogue_choices
       WHERE npc_key = $1 AND node_key = $2 AND choice_key = $3`,
      [npcKey, current.current_node_key, choiceKey]
    );
    nextNodeKey = choice.rows[0]?.next_node_key ?? "";
    if (!nextNodeKey) throw new NpcDialogueError("Ce choix n'est pas disponible dans cette étape du dialogue.");

    const nextNode = await client.query<{ is_terminal: boolean }>(
      "SELECT is_terminal FROM npc_dialogue_nodes WHERE npc_key = $1 AND node_key = $2",
      [npcKey, nextNodeKey]
    );
    const terminal = nextNode.rows[0]?.is_terminal;
    if (terminal === undefined) throw new NpcDialogueError("La suite de ce dialogue n'est pas configurée.");

    const event = await client.query(
      `INSERT INTO npc_conversation_events
       (event_id, conversation_id, character_id, npc_key, node_key, choice_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [interactionId, input.conversationId, input.characterId, npcKey, current.current_node_key, choiceKey]
    );
    if (!event.rowCount) {
      throw new NpcDialogueError("Ce choix a déjà été enregistré.");
    }

    await client.query(
      `UPDATE npc_character_conversations
       SET current_node_key = $2,
           status = $3,
           updated_at = NOW(),
           completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END
       WHERE id = $1`,
      [input.conversationId, nextNodeKey, terminal ? "completed" : "active"]
    );
    await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return loadDialogueView(pool, {
    conversationId: input.conversationId,
    accountId: input.accountId,
    characterId: input.characterId,
    npcKey,
    firstEncounter: false,
    revealedLocation: null
  });
}
