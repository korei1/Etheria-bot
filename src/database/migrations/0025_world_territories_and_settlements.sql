-- Etheria - migration 0025
-- Territoires administratifs et localités.
-- Les capitales publiques sont reprises des données canoniques existantes.
-- Aucune subdivision administrative ou ville secondaire n'est inventée.
-- À appliquer uniquement après revue et approbation explicites.

BEGIN;

CREATE TABLE world_administrative_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_key TEXT NOT NULL UNIQUE CHECK (area_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  area_type TEXT NOT NULL CHECK (area_type IN (
    'region', 'province', 'department', 'district', 'county', 'municipality', 'territory'
  )),
  parent_area_id UUID REFERENCES world_administrative_areas(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'discovery_locked')),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft', 'approved', 'retired')),
  description TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_area_not_own_parent CHECK (parent_area_id IS NULL OR parent_area_id <> id)
);

CREATE INDEX world_administrative_areas_country_idx
  ON world_administrative_areas(country_id, area_type);
CREATE INDEX world_administrative_areas_parent_idx
  ON world_administrative_areas(parent_area_id);

CREATE TABLE world_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_key TEXT NOT NULL UNIQUE CHECK (settlement_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  settlement_type TEXT NOT NULL CHECK (settlement_type IN (
    'capital', 'city', 'town', 'village', 'hamlet', 'isolated_site'
  )),
  administrative_area_id UUID REFERENCES world_administrative_areas(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  parent_settlement_id UUID REFERENCES world_settlements(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  is_capital BOOLEAN NOT NULL DEFAULT FALSE,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'discovery_locked')),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft', 'approved', 'retired')),
  description TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_settlement_not_own_parent
    CHECK (parent_settlement_id IS NULL OR parent_settlement_id <> id),
  CONSTRAINT world_capital_type_consistent
    CHECK ((is_capital AND settlement_type = 'capital') OR (NOT is_capital AND settlement_type <> 'capital'))
);

CREATE UNIQUE INDEX world_one_capital_per_country
  ON world_settlements(country_id) WHERE is_capital = TRUE;
CREATE INDEX world_settlements_country_idx
  ON world_settlements(country_id, settlement_type);
CREATE INDEX world_settlements_area_idx
  ON world_settlements(administrative_area_id);
CREATE INDEX world_settlements_parent_idx
  ON world_settlements(parent_settlement_id);
CREATE INDEX world_settlements_visibility_idx
  ON world_settlements(visibility, editorial_status);

-- Les capitales déjà renseignées dans le catalogue pays sont les seules localités
-- créées automatiquement. Les quatre pays secrets d'Umbrelune restent sans nom public.
INSERT INTO world_settlements (
  settlement_key, display_name, country_id, settlement_type, is_capital,
  visibility, editorial_status
)
SELECT
  countries.slug || '_capital',
  countries.capital_name,
  countries.id,
  'capital',
  TRUE,
  'public',
  'approved'
FROM countries
WHERE countries.is_secret = FALSE
  AND countries.capital_name IS NOT NULL
  AND length(btrim(countries.capital_name)) > 0;

ALTER TABLE world_administrative_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_settlements ENABLE ROW LEVEL SECURITY;

COMMIT;
