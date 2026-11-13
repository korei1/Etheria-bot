-- Etheria - migration 0032
-- Horloge mondiale persistante et fuseaux horaires locaux.
-- L'horloge est initialement en pause : aucun rythme d'écoulement n'est inventé.
-- Aucun fuseau n'est attribué automatiquement aux territoires.
-- À appliquer uniquement après revue et approbation explicites.

BEGIN;

CREATE TABLE world_clock (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  world_minute BIGINT NOT NULL DEFAULT 0 CHECK (world_minute >= 0),
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  world_minutes_per_real_minute NUMERIC(12, 6) NOT NULL DEFAULT 0
    CHECK (world_minutes_per_real_minute >= 0),
  is_paused BOOLEAN NOT NULL DEFAULT TRUE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO world_clock (singleton) VALUES (TRUE);

CREATE TABLE world_time_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_key TEXT NOT NULL UNIQUE CHECK (zone_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  utc_offset_minutes SMALLINT NOT NULL
    CHECK (utc_offset_minutes BETWEEN -720 AND 840),
  longitude_degrees NUMERIC(7, 3)
    CHECK (longitude_degrees BETWEEN -180 AND 180),
  seasonal_clock_change BOOLEAN NOT NULL DEFAULT FALSE
    CHECK (seasonal_clock_change = FALSE),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft', 'approved', 'retired')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une localité peut avoir son propre fuseau, même si d'autres localités du
-- même pays utilisent un autre fuseau. L'absence d'affectation reste explicite.
ALTER TABLE world_settlements
  ADD COLUMN time_zone_id UUID REFERENCES world_time_zones(id) ON DELETE RESTRICT;

CREATE INDEX world_settlements_time_zone_idx
  ON world_settlements(time_zone_id)
  WHERE time_zone_id IS NOT NULL;

ALTER TABLE world_clock ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_time_zones ENABLE ROW LEVEL SECURITY;

COMMIT;
