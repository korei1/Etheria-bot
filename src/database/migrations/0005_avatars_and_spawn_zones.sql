-- Etheria - migration 0005
-- Catalogue des avatars prédéfinis et zones de départ validées.
-- Les modèles et les zones sont alimentés avec les véritables données visuelles
-- et géographiques ; aucune entrée fictive n'est créée ici.

BEGIN;

CREATE TABLE avatar_models (
  model_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT avatar_models_key_valid CHECK (length(btrim(model_key)) BETWEEN 1 AND 60),
  CONSTRAINT avatar_models_name_valid CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  CONSTRAINT avatar_models_image_url_https CHECK (image_url ~ '^https://[^[:space:]]+
);

ALTER TABLE characters
  ADD CONSTRAINT characters_avatar_model_fk
  FOREIGN KEY (avatar_model_key) REFERENCES avatar_models(model_key)
  ON DELETE RESTRICT;

CREATE TABLE starting_spawn_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  zone_key TEXT NOT NULL UNIQUE,
  region_name TEXT NOT NULL,
  locality_name TEXT,
  biome_name TEXT NOT NULL,
  terrain_description TEXT NOT NULL,
  settlement_proximity TEXT NOT NULL
    CHECK (settlement_proximity IN ('nearby', 'moderate', 'remote')),
  is_natural BOOLEAN NOT NULL DEFAULT TRUE,
  is_safe_for_new_character BOOLEAN NOT NULL DEFAULT FALSE,
  is_accessible_for_new_character BOOLEAN NOT NULL DEFAULT FALSE,
  spawn_weight INTEGER NOT NULL DEFAULT 1 CHECK (spawn_weight > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT spawn_zone_key_not_empty CHECK (length(btrim(zone_key)) > 0),
  CONSTRAINT spawn_zone_region_not_empty CHECK (length(btrim(region_name)) > 0),
  CONSTRAINT spawn_zone_biome_not_empty CHECK (length(btrim(biome_name)) > 0),
  CONSTRAINT spawn_zone_terrain_not_empty CHECK (length(btrim(terrain_description)) > 0)
);

ALTER TABLE characters
  ADD COLUMN spawn_zone_id UUID
  REFERENCES starting_spawn_zones(id) ON DELETE RESTRICT;

CREATE INDEX starting_spawn_zones_country_eligible_idx
  ON starting_spawn_zones(country_id, is_active, spawn_weight)
  WHERE is_natural = TRUE
    AND is_safe_for_new_character = TRUE
    AND is_accessible_for_new_character = TRUE;

CREATE INDEX characters_spawn_zone_idx
  ON characters(spawn_zone_id)
  WHERE spawn_zone_id IS NOT NULL;

COMMIT;
)
);

ALTER TABLE characters
  ADD CONSTRAINT characters_avatar_model_fk
  FOREIGN KEY (avatar_model_key) REFERENCES avatar_models(model_key)
  ON DELETE RESTRICT;

CREATE TABLE starting_spawn_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  zone_key TEXT NOT NULL UNIQUE,
  region_name TEXT NOT NULL,
  locality_name TEXT,
  biome_name TEXT NOT NULL,
  terrain_description TEXT NOT NULL,
  settlement_proximity TEXT NOT NULL
    CHECK (settlement_proximity IN ('nearby', 'moderate', 'remote')),
  is_natural BOOLEAN NOT NULL DEFAULT TRUE,
  is_safe_for_new_character BOOLEAN NOT NULL DEFAULT FALSE,
  is_accessible_for_new_character BOOLEAN NOT NULL DEFAULT FALSE,
  spawn_weight INTEGER NOT NULL DEFAULT 1 CHECK (spawn_weight > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT spawn_zone_key_not_empty CHECK (length(btrim(zone_key)) > 0),
  CONSTRAINT spawn_zone_region_not_empty CHECK (length(btrim(region_name)) > 0),
  CONSTRAINT spawn_zone_biome_not_empty CHECK (length(btrim(biome_name)) > 0),
  CONSTRAINT spawn_zone_terrain_not_empty CHECK (length(btrim(terrain_description)) > 0)
);

ALTER TABLE characters
  ADD COLUMN spawn_zone_id UUID
  REFERENCES starting_spawn_zones(id) ON DELETE RESTRICT;

CREATE INDEX starting_spawn_zones_country_eligible_idx
  ON starting_spawn_zones(country_id, is_active, spawn_weight)
  WHERE is_natural = TRUE
    AND is_safe_for_new_character = TRUE
    AND is_accessible_for_new_character = TRUE;

CREATE INDEX characters_spawn_zone_idx
  ON characters(spawn_zone_id)
  WHERE spawn_zone_id IS NOT NULL;

COMMIT;
