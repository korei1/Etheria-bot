-- Etheria - migration 0029
-- Itinéraires validés et journal transactionnel des déplacements.
-- Aucun itinéraire concret n'est préchargé.

BEGIN;

CREATE TABLE world_travel_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_key TEXT NOT NULL UNIQUE
    CHECK (link_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  from_spawn_zone_id UUID REFERENCES starting_spawn_zones(id) ON DELETE RESTRICT,
  from_settlement_id UUID REFERENCES world_settlements(id) ON DELETE RESTRICT,
  to_settlement_id UUID NOT NULL REFERENCES world_settlements(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL CHECK (mode IN ('land', 'sea', 'air')),
  link_type TEXT NOT NULL CHECK (link_type IN (
    'trail', 'road', 'bridge', 'tunnel', 'ferry', 'sea_lane', 'air_route'
  )),
  bidirectional BOOLEAN NOT NULL DEFAULT FALSE,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'discovery_locked')),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft', 'approved', 'retired')),
  access_requirements TEXT[] NOT NULL DEFAULT '{}',
  distance_meters NUMERIC(12, 2),
  estimated_duration_minutes INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_travel_one_origin CHECK (
    (from_spawn_zone_id IS NOT NULL)::INTEGER +
    (from_settlement_id IS NOT NULL)::INTEGER = 1
  ),
  CONSTRAINT world_travel_distinct_settlements CHECK (
    from_settlement_id IS NULL OR from_settlement_id <> to_settlement_id
  ),
  CONSTRAINT world_travel_mode_type_consistent CHECK (
    (mode = 'land' AND link_type IN ('trail', 'road', 'bridge', 'tunnel')) OR
    (mode = 'sea' AND link_type IN ('ferry', 'sea_lane')) OR
    (mode = 'air' AND link_type = 'air_route')
  ),
  CONSTRAINT world_travel_distance_positive CHECK (
    distance_meters IS NULL OR distance_meters > 0
  ),
  CONSTRAINT world_travel_duration_positive CHECK (
    estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
  ),
  CONSTRAINT world_travel_requirements_nonempty CHECK (
    array_position(access_requirements, '') IS NULL
  )
);

CREATE INDEX world_travel_links_from_spawn_idx
  ON world_travel_links(from_spawn_zone_id, editorial_status)
  WHERE from_spawn_zone_id IS NOT NULL;
CREATE INDEX world_travel_links_from_settlement_idx
  ON world_travel_links(from_settlement_id, editorial_status)
  WHERE from_settlement_id IS NOT NULL;
CREATE INDEX world_travel_links_to_settlement_idx
  ON world_travel_links(to_settlement_id, editorial_status);

CREATE TABLE world_travel_events (
  event_id TEXT PRIMARY KEY CHECK (length(btrim(event_id)) > 0),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  character_id UUID NOT NULL,
  link_key TEXT NOT NULL REFERENCES world_travel_links(link_key) ON DELETE RESTRICT,
  from_spawn_zone_id UUID REFERENCES starting_spawn_zones(id) ON DELETE RESTRICT,
  from_settlement_id UUID REFERENCES world_settlements(id) ON DELETE RESTRICT,
  to_spawn_zone_id UUID REFERENCES starting_spawn_zones(id) ON DELETE RESTRICT,
  to_settlement_id UUID REFERENCES world_settlements(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_travel_event_character_account_fk
    FOREIGN KEY (account_id, character_id)
    REFERENCES characters(account_id, id) ON DELETE RESTRICT,
  CONSTRAINT world_travel_event_one_origin CHECK (
    (from_spawn_zone_id IS NOT NULL)::INTEGER +
    (from_settlement_id IS NOT NULL)::INTEGER = 1
  ),
  CONSTRAINT world_travel_event_one_destination CHECK (
    (to_spawn_zone_id IS NOT NULL)::INTEGER +
    (to_settlement_id IS NOT NULL)::INTEGER = 1
  )
);

CREATE INDEX world_travel_events_character_date_idx
  ON world_travel_events(character_id, occurred_at DESC);
CREATE INDEX world_travel_events_account_date_idx
  ON world_travel_events(account_id, occurred_at DESC);

ALTER TABLE world_travel_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_travel_events ENABLE ROW LEVEL SECURITY;

COMMIT;
