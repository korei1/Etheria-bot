-- Etheria - migration 0018
-- Lots d'inventaire traçables, avec rétrocompatibilité des stocks existants.
-- Les anciennes quantités sont reprises sans inventer leur provenance.

BEGIN;

CREATE TABLE character_item_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  container_kind TEXT NOT NULL
    CHECK (container_kind IN ('character_bag', 'temporary_camp_storage')),
  inventory_slot_id UUID UNIQUE
    REFERENCES character_inventory_slots(id) ON DELETE CASCADE,
  camp_storage_entry_id UUID UNIQUE
    REFERENCES character_temporary_camp_storage(id) ON DELETE CASCADE,
  instance_state JSONB,
  origin_type TEXT
    CHECK (origin_type IS NULL OR origin_type IN (
      'collection', 'crafting', 'discovery', 'purchase', 'trade', 'inheritance', 'gift'
    )),
  origin_reference TEXT,
  origin_occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_item_lots_container_source_check CHECK (
    (container_kind = 'character_bag'
      AND inventory_slot_id IS NOT NULL
      AND camp_storage_entry_id IS NULL)
    OR
    (container_kind = 'temporary_camp_storage'
      AND camp_storage_entry_id IS NOT NULL
      AND inventory_slot_id IS NULL)
  ),
  CONSTRAINT character_item_lots_origin_reference_check CHECK (
    origin_reference IS NULL OR length(btrim(origin_reference)) > 0
  )
);

CREATE INDEX character_item_lots_item_code_idx
  ON character_item_lots(item_code);
CREATE INDEX character_item_lots_origin_idx
  ON character_item_lots(origin_type, origin_occurred_at DESC)
  WHERE origin_type IS NOT NULL;

-- Chaque ligne historique devient un lot technique. L'origine reste inconnue.
INSERT INTO character_item_lots (
  item_code, quantity, container_kind, inventory_slot_id
)
SELECT item_code, quantity, 'character_bag', id
FROM character_inventory_slots;

INSERT INTO character_item_lots (
  item_code, quantity, container_kind, camp_storage_entry_id
)
SELECT item_code, quantity, 'temporary_camp_storage', id
FROM character_temporary_camp_storage;

COMMIT;
