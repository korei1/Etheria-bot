-- Etheria - migration 0015
-- Stockage physique des objets trouvés non fabriqués dans le camp temporaire.
-- Le contenu n'est accessible que lorsque le personnage est effectivement au camp.

BEGIN;

CREATE TABLE character_temporary_camp_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES character_temporary_camps(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  deposited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_temporary_camp_storage_item_not_empty
    CHECK (length(btrim(item_code)) > 0),
  CONSTRAINT character_temporary_camp_storage_item_unique
    UNIQUE (camp_id, item_code)
);

CREATE INDEX character_temporary_camp_storage_camp_idx
  ON character_temporary_camp_storage(camp_id, deposited_at);

COMMIT;
