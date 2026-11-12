-- Etheria - migration 0009
-- Suivi persistant et événementiel de la quête initiale.

BEGIN;

CREATE TABLE character_quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_key TEXT NOT NULL,
  current_step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT character_quest_progress_character_quest_unique
    UNIQUE (character_id, quest_key),
  CONSTRAINT character_quest_progress_key_not_empty
    CHECK (length(btrim(quest_key)) > 0 AND length(btrim(current_step_key)) > 0),
  CONSTRAINT character_quest_progress_completion_consistency
    CHECK (
      (status = 'completed' AND completed_at IS NOT NULL)
      OR (status <> 'completed' AND completed_at IS NULL)
    )
);

INSERT INTO character_quest_progress (character_id, quest_key, current_step_key, status)
SELECT id, 'suivre_le_vent', 'reveil', 'active'
FROM characters
WHERE status = 'active'
ON CONFLICT (character_id, quest_key) DO NOTHING;

CREATE TABLE character_quest_events (
  event_id UUID PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_key TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  source_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_quest_events_keys_not_empty
    CHECK (
      length(btrim(quest_key)) > 0
      AND length(btrim(milestone_key)) > 0
      AND length(btrim(source_key)) > 0
    ),
  CONSTRAINT character_quest_events_milestone_unique
    UNIQUE (character_id, quest_key, milestone_key)
);

CREATE INDEX character_quest_progress_active_idx
  ON character_quest_progress(character_id, updated_at DESC)
  WHERE status = 'active';

CREATE INDEX character_quest_events_history_idx
  ON character_quest_events(character_id, occurred_at);

COMMIT;
