-- Etheria - migration 0017
-- Journal idempotent des ressources validées par le moteur du monde puis ajoutées au sac.

BEGIN;

CREATE TABLE character_resource_collection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL UNIQUE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  slot_number INTEGER NOT NULL CHECK (slot_number > 0),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_resource_collection_source_not_empty
    CHECK (length(btrim(source_key)) > 0),
  CONSTRAINT character_resource_collection_item_not_empty
    CHECK (length(btrim(item_code)) > 0)
);

CREATE INDEX character_resource_collection_character_date_idx
  ON character_resource_collection_events(character_id, collected_at DESC);

COMMIT;
