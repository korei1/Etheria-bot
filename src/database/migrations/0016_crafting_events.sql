-- Etheria - migration 0016
-- Historique idempotent des fabrications et base du moteur transactionnel.

BEGIN;

CREATE TABLE character_crafting_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL UNIQUE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  recipe_key TEXT NOT NULL,
  ingredients_snapshot JSONB NOT NULL,
  output_item_code TEXT NOT NULL,
  output_quantity INTEGER NOT NULL CHECK (output_quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_crafting_recipe_key_not_empty
    CHECK (length(btrim(recipe_key)) > 0),
  CONSTRAINT character_crafting_output_code_not_empty
    CHECK (length(btrim(output_item_code)) > 0),
  CONSTRAINT character_crafting_ingredients_array
    CHECK (jsonb_typeof(ingredients_snapshot) = 'array')
);

CREATE INDEX character_crafting_events_character_created_idx
  ON character_crafting_events(character_id, created_at DESC);

COMMIT;
