-- Etheria - migration 0011
-- Descente initiale, découverte du sac et premier échantillon de baies locales.

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
    'berries_collected'
  ));

CREATE TABLE character_inventory_bags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  bag_code TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
  found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_inventory_bag_code_not_empty CHECK (length(btrim(bag_code)) > 0),
  CONSTRAINT character_inventory_bag_character_code_unique UNIQUE (character_id, bag_code)
);

CREATE UNIQUE INDEX character_inventory_one_equipped_bag_idx
  ON character_inventory_bags(character_id)
  WHERE is_equipped = TRUE;

CREATE TABLE character_inventory_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id UUID NOT NULL REFERENCES character_inventory_bags(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number > 0),
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_inventory_slot_item_not_empty CHECK (length(btrim(item_code)) > 0),
  CONSTRAINT character_inventory_slot_number_unique UNIQUE (bag_id, slot_number),
  CONSTRAINT character_inventory_slot_item_unique UNIQUE (bag_id, item_code)
);

CREATE INDEX character_inventory_bags_character_idx
  ON character_inventory_bags(character_id, is_equipped);

COMMIT;
