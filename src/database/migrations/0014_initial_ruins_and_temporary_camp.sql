-- Etheria - migration 0014
-- Découverte des ruines et installation du premier camp temporaire.

BEGIN;

ALTER TABLE character_exploration_progress
  DROP CONSTRAINT character_exploration_progress_current_scene_key_check;

ALTER TABLE character_exploration_progress
  ADD CONSTRAINT character_exploration_progress_current_scene_key_check
  CHECK (current_scene_key IN (
    'awakening',
    'wind_perceived',
    'cliff_overlook',
    'cliff_foot',
    'berries_collected',
    'water_source_found',
    'thirst_restored',
    'plants_gathered',
    'canteen_crafted',
    'cave_found',
    'cave_shelter',
    'campfire_lit',
    'berries_roasted',
    'morning_outside_cave',
    'ruins_found',
    'ruins_explored',
    'temporary_camp_established'
  ));

ALTER TABLE character_survival_progress
  ADD COLUMN first_morning_after_shelter_at TIMESTAMPTZ,
  ADD COLUMN first_ruins_discovered_at TIMESTAMPTZ,
  ADD COLUMN first_ruins_explored_at TIMESTAMPTZ,
  ADD COLUMN first_history_fragments_collected_at TIMESTAMPTZ,
  ADD COLUMN first_temporary_camp_established_at TIMESTAMPTZ;

CREATE TABLE character_temporary_camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  camp_code TEXT NOT NULL,
  shelter_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'temporary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_temporary_camps_character_code_unique
    UNIQUE (character_id, camp_code),
  CONSTRAINT character_temporary_camps_code_not_empty
    CHECK (length(btrim(camp_code)) > 0),
  CONSTRAINT character_temporary_camps_shelter_not_empty
    CHECK (length(btrim(shelter_type)) > 0),
  CONSTRAINT character_temporary_camps_status_not_empty
    CHECK (length(btrim(status)) > 0)
);

CREATE INDEX character_temporary_camps_character_status_idx
  ON character_temporary_camps(character_id, status);

COMMIT;
