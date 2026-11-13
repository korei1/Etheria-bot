-- Etheria - migration 0028
-- Présence des PNJ dans les localités découvertes et localisation actuelle du personnage.
-- Aucun lieu ni PNJ n'est créé automatiquement.

BEGIN;

ALTER TABLE characters
  ADD COLUMN current_settlement_id UUID
  REFERENCES world_settlements(id) ON DELETE RESTRICT;

CREATE INDEX characters_current_settlement_idx
  ON characters(current_settlement_id)
  WHERE current_settlement_id IS NOT NULL;

CREATE TABLE npc_settlement_locations (
  npc_key TEXT NOT NULL REFERENCES npc_definitions(npc_key) ON DELETE RESTRICT,
  settlement_id UUID NOT NULL REFERENCES world_settlements(id) ON DELETE RESTRICT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (npc_key, settlement_id)
);

CREATE INDEX npc_settlement_locations_settlement_idx
  ON npc_settlement_locations(settlement_id, priority DESC)
  WHERE is_active = TRUE;

ALTER TABLE npc_settlement_locations ENABLE ROW LEVEL SECURITY;

COMMIT;
