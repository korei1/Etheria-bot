-- Etheria - migration 0003
-- Brouillons du parcours de création Discord.
-- Un brouillon reste modifiable et ne réserve pas le pseudonyme.
-- Le pseudonyme n'est réservé qu'à la confirmation dans characters.

BEGIN;

CREATE TABLE character_creation_drafts (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  public_pseudonym TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_drafts_first_name_not_empty
    CHECK (length(btrim(first_name)) > 0),
  CONSTRAINT character_drafts_pseudonym_not_empty
    CHECK (length(btrim(public_pseudonym)) > 0)
);

COMMIT;
