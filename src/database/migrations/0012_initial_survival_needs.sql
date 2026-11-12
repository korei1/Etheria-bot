-- Etheria - migration 0012
-- Besoins vitaux initiaux et découverte/consommation de la première source d'eau.
-- Les valeurs restent stables tant que le moteur temporel des besoins n'est pas raccordé.

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
    'canteen_crafted'
  ));

CREATE TABLE character_needs (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  thirst_percent SMALLINT NOT NULL DEFAULT 100
    CHECK (thirst_percent BETWEEN 0 AND 100),
  hunger_percent SMALLINT NOT NULL DEFAULT 100
    CHECK (hunger_percent BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO character_needs (character_id, thirst_percent, hunger_percent)
SELECT id, 100, 100
FROM characters
WHERE status = 'active'
ON CONFLICT (character_id) DO NOTHING;

CREATE TABLE character_survival_progress (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  first_water_source_discovered_at TIMESTAMPTZ,
  first_drink_at TIMESTAMPTZ,
  initial_canteen_recipe_unlocked_at TIMESTAMPTZ,
  initial_canteen_crafted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO character_survival_progress (character_id)
SELECT id FROM characters WHERE status = 'active'
ON CONFLICT (character_id) DO NOTHING;

COMMIT;
