-- Etheria - migration 0013
-- Abri dans la grotte, premier feu et première cuisson.

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
    'berries_roasted'
  ));

ALTER TABLE character_survival_progress
  ADD COLUMN first_cave_discovered_at TIMESTAMPTZ,
  ADD COLUMN first_cave_shelter_at TIMESTAMPTZ,
  ADD COLUMN first_campfire_lit_at TIMESTAMPTZ,
  ADD COLUMN first_food_cooked_at TIMESTAMPTZ;

CREATE TABLE character_skill_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level > 0),
  experience BIGINT NOT NULL DEFAULT 0 CHECK (experience >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_skill_progress_unique UNIQUE (character_id, skill_key),
  CONSTRAINT character_skill_progress_key_not_empty CHECK (length(btrim(skill_key)) > 0)
);

CREATE TABLE character_unlocked_features (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, feature_key),
  CONSTRAINT character_unlocked_feature_key_not_empty CHECK (length(btrim(feature_key)) > 0)
);

COMMIT;
