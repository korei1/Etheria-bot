-- Etheria - migration 0002
-- Fondation des personnages et de leur continuité entre générations.
-- Les profils de compte existants sont conservés : ils représentent le compte,
-- tandis que cette table représente les personnages jouables successifs.

BEGIN;

CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  first_name TEXT NOT NULL,
  public_pseudonym TEXT NOT NULL,

  -- L'origine est attribuée par le jeu. La référence sera reliée à la table
  -- des pays lorsque le référentiel géographique sera implémenté.
  origin_country_id UUID,

  -- Tous les personnages commencent à 13 ans et au niveau 1.
  age_years INTEGER NOT NULL DEFAULT 13 CHECK (age_years >= 13),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deceased')),

  -- Continuité familiale après la mort d'un personnage.
  predecessor_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  relationship_to_predecessor TEXT,

  -- Clé technique d'un modèle d'avatar disponible, pas une image libre.
  avatar_model_key TEXT,
  gender_identity TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  died_at TIMESTAMPTZ,

  CONSTRAINT characters_first_name_not_empty
    CHECK (length(btrim(first_name)) > 0),
  CONSTRAINT characters_public_pseudonym_not_empty
    CHECK (length(btrim(public_pseudonym)) > 0),
  CONSTRAINT characters_relationship_requires_predecessor
    CHECK (
      relationship_to_predecessor IS NULL
      OR predecessor_character_id IS NOT NULL
    ),
  CONSTRAINT characters_lifecycle_consistency
    CHECK (
      (status = 'active' AND died_at IS NULL)
      OR (status = 'deceased' AND died_at IS NOT NULL)
    ),

  -- Permet de vérifier qu'un prédécesseur appartient au même compte.
  CONSTRAINT characters_account_id_id_unique
    UNIQUE (account_id, id)
);

-- Le pseudonyme public est unique à l'échelle de tout Etheria,
-- sans distinction de majuscules/minuscules ou d'espaces périphériques.
-- Les pseudonymes restent réservés même après le décès du personnage.
CREATE UNIQUE INDEX characters_public_pseudonym_global_unique
  ON characters (lower(btrim(public_pseudonym)));

-- Un compte ne peut avoir qu'un seul personnage actif à la fois.
CREATE UNIQUE INDEX characters_one_active_per_account
  ON characters (account_id)
  WHERE status = 'active';

CREATE INDEX characters_account_created_idx
  ON characters (account_id, created_at DESC);

CREATE INDEX characters_predecessor_idx
  ON characters (predecessor_character_id)
  WHERE predecessor_character_id IS NOT NULL;

ALTER TABLE characters
  ADD CONSTRAINT characters_predecessor_same_account_fk
  FOREIGN KEY (account_id, predecessor_character_id)
  REFERENCES characters (account_id, id)
  ON DELETE SET NULL;

COMMIT;
