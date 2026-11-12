-- Etheria - migration 0006
-- Genre du personnage et rattachement des modèles d'avatar prédéfinis.

BEGIN;

ALTER TABLE characters
  ADD CONSTRAINT characters_gender_identity_valid
  CHECK (gender_identity IS NULL OR gender_identity IN ('femme', 'homme', 'agenre'));

ALTER TABLE character_creation_drafts
  ADD COLUMN gender_identity TEXT
  CHECK (gender_identity IS NULL OR gender_identity IN ('femme', 'homme', 'agenre'));

ALTER TABLE avatar_models
  ADD COLUMN gender_identity TEXT NOT NULL
  CHECK (gender_identity IN ('femme', 'homme', 'agenre'));

CREATE INDEX avatar_models_gender_active_idx
  ON avatar_models(gender_identity, sort_order, display_name)
  WHERE is_active = TRUE;

COMMIT;
