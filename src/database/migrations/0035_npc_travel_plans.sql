-- Etheria - migration 0035
-- Déplacements planifiés des PNJ sur des itinéraires déjà approuvés.
-- Aucun trajet, horaire ou PNJ n'est créé automatiquement.

BEGIN;

CREATE TABLE npc_travel_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_key TEXT NOT NULL REFERENCES npc_definitions(npc_key) ON DELETE RESTRICT,
  route_key TEXT NOT NULL REFERENCES world_travel_links(link_key) ON DELETE RESTRICT,
  origin_settlement_id UUID NOT NULL REFERENCES world_settlements(id) ON DELETE RESTRICT,
  destination_settlement_id UUID NOT NULL REFERENCES world_settlements(id) ON DELETE RESTRICT,
  departure_world_minute BIGINT NOT NULL CHECK (departure_world_minute >= 0),
  arrival_world_minute BIGINT NOT NULL CHECK (arrival_world_minute > departure_world_minute),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_transit', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT npc_travel_plan_distinct_places
    CHECK (origin_settlement_id <> destination_settlement_id)
);

CREATE UNIQUE INDEX npc_one_active_travel_plan
  ON npc_travel_plans(npc_key)
  WHERE status IN ('planned', 'in_transit');

CREATE INDEX npc_travel_plans_due_idx
  ON npc_travel_plans(status, departure_world_minute, arrival_world_minute)
  WHERE status IN ('planned', 'in_transit');

CREATE TABLE npc_travel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES npc_travel_plans(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('departed', 'arrived')),
  world_minute BIGINT NOT NULL CHECK (world_minute >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, event_type)
);

ALTER TABLE npc_travel_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE npc_travel_events ENABLE ROW LEVEL SECURITY;

COMMIT;
