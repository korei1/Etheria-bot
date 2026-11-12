-- Etheria - migration 0010
-- Progression persistante de la première séquence d'exploration.

BEGIN;

CREATE TABLE character_exploration_progress (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  current_scene_key TEXT NOT NULL DEFAULT 'awakening'
    CHECK (current_scene_key IN ('awakening', 'wind_perceived', 'cliff_overlook')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE character_exploration_events (
  event_id TEXT PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  scene_before TEXT NOT NULL,
  scene_after TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_exploration_event_id_not_empty
    CHECK (length(btrim(event_id)) > 0),
  CONSTRAINT character_exploration_action_not_empty
    CHECK (length(btrim(action_key)) > 0)
);

INSERT INTO character_exploration_progress (character_id, current_scene_key)
SELECT c.id, 'awakening'
FROM characters c
JOIN character_quest_progress q
  ON q.character_id = c.id
 AND q.quest_key = 'suivre_le_vent'
 AND q.current_step_key = 'reveil'
WHERE c.status = 'active'
ON CONFLICT (character_id) DO NOTHING;

CREATE INDEX character_exploration_events_history_idx
  ON character_exploration_events(character_id, occurred_at);

COMMIT;
