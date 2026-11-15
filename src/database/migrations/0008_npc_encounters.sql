-- Etheria - migration 0008
-- Enregistre les rencontres PNJ et identifie la toute première rencontre.

BEGIN;

ALTER TABLE characters
  ADD COLUMN first_npc_key TEXT,
  ADD COLUMN first_npc_encounter_at TIMESTAMPTZ;

CREATE TABLE npc_encounters (
  encounter_id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  character_id UUID NOT NULL,
  npc_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_first_for_character BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT npc_encounters_npc_key_not_empty
    CHECK (length(btrim(npc_key)) > 0),
  CONSTRAINT npc_encounters_character_account_fk
    FOREIGN KEY (account_id, character_id)
    REFERENCES characters(account_id, id)
    ON DELETE CASCADE
);

CREATE INDEX npc_encounters_character_history_idx
  ON npc_encounters(character_id, occurred_at DESC);

CREATE UNIQUE INDEX npc_encounters_one_first_per_character_idx
  ON npc_encounters(character_id)
  WHERE is_first_for_character = TRUE;

CREATE INDEX characters_first_npc_encounter_idx
  ON characters(first_npc_encounter_at)
  WHERE first_npc_encounter_at IS NOT NULL;

COMMIT;
