-- Etheria - migration 0024
-- Fondation géographique indépendante des pays et des gouvernements.
-- Aucun lieu, biome, relief ou tracé cartographique non validé n'est inventé.
-- À appliquer uniquement après revue et approbation explicites.

BEGIN;

CREATE TABLE world_continents (
  continent_key TEXT PRIMARY KEY CHECK (continent_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL UNIQUE CHECK (length(btrim(display_name)) > 0),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'discovery_locked')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO world_continents (continent_key, display_name, visibility) VALUES
  ('sylvaria', 'Sylvaria', 'public'),
  ('niveria', 'Nivéria', 'public'),
  ('arcanthia', 'Arcanthia', 'public'),
  ('solmeria', 'Solméria', 'public'),
  ('thalassea', 'Thalasséa', 'public'),
  ('igneria', 'Ignéria', 'public'),
  ('umbrelune', 'Umbrelune', 'discovery_locked');

ALTER TABLE countries
  ADD COLUMN continent_key TEXT;

UPDATE countries
SET continent_key = CASE continent_name
  WHEN 'Sylvaria' THEN 'sylvaria'
  WHEN 'Nivéria' THEN 'niveria'
  WHEN 'Arcanthia' THEN 'arcanthia'
  WHEN 'Solméria' THEN 'solmeria'
  WHEN 'Thalasséa' THEN 'thalassea'
  WHEN 'Ignéria' THEN 'igneria'
  WHEN 'Umbrelune' THEN 'umbrelune'
  ELSE NULL
END;

ALTER TABLE countries
  ALTER COLUMN continent_key SET NOT NULL,
  ADD CONSTRAINT countries_continent_fk
    FOREIGN KEY (continent_key) REFERENCES world_continents(continent_key)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE INDEX countries_continent_idx ON countries(continent_key);

CREATE TABLE world_geographic_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE
    CHECK (feature_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  feature_type TEXT NOT NULL CHECK (feature_type IN (
    'landmass', 'island', 'archipelago', 'ocean', 'sea', 'gulf', 'strait',
    'coast', 'mountain_range', 'mountain', 'volcano', 'forest', 'woodland',
    'desert', 'plain', 'plateau', 'valley', 'river', 'lake', 'wetland',
    'reef', 'biome', 'habitat'
  )),
  continent_key TEXT REFERENCES world_continents(continent_key)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  parent_feature_id UUID REFERENCES world_geographic_features(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'discovery_locked')),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft', 'approved', 'retired')),
  description TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_feature_not_own_parent
    CHECK (parent_feature_id IS NULL OR parent_feature_id <> id)
);

CREATE INDEX world_geographic_features_continent_idx
  ON world_geographic_features(continent_key, feature_type);
CREATE INDEX world_geographic_features_parent_idx
  ON world_geographic_features(parent_feature_id);
CREATE INDEX world_geographic_features_visibility_idx
  ON world_geographic_features(visibility, editorial_status);

-- Accès réservé au backend de confiance. Aucun accès direct client n'est accordé.
ALTER TABLE world_continents ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_geographic_features ENABLE ROW LEVEL SECURITY;

COMMIT;
