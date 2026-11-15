-- Etheria - migration 0004
-- Référentiel des 28 pays et base de répartition des origines.
-- Les quatre pays d'Umbrelune possèdent des identifiants techniques internes :
-- leurs noms et capitales ne sont volontairement pas renseignés ici.

BEGIN;

CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  continent_name TEXT NOT NULL,
  display_name TEXT,
  capital_name TEXT,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  is_origin_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT countries_slug_not_empty CHECK (length(btrim(slug)) > 0),
  CONSTRAINT countries_continent_not_empty CHECK (length(btrim(continent_name)) > 0),
  CONSTRAINT countries_public_name_required
    CHECK (is_secret OR (display_name IS NOT NULL AND capital_name IS NOT NULL))
);

INSERT INTO countries (slug, continent_name, display_name, capital_name, is_secret)
VALUES
  ('elarion', 'Sylvaria', 'Elarion', 'Auréval', FALSE),
  ('virelune', 'Sylvaria', 'Virelune', 'Lioréa', FALSE),
  ('avelorne', 'Sylvaria', 'Avelorne', 'Sylvaré', FALSE),
  ('thyrea', 'Sylvaria', 'Thyréa', 'Thyrion', FALSE),
  ('brumefort', 'Sylvaria', 'Brumefort', 'Brumeciel', FALSE),
  ('caldris', 'Sylvaria', 'Caldris', 'Caldéria', FALSE),

  ('nivelle', 'Nivéria', 'Nivelle', 'Nivélys', FALSE),
  ('iskaria', 'Nivéria', 'Iskaria', 'Iskar', FALSE),
  ('valdoren', 'Nivéria', 'Valdoren', 'Valdoria', FALSE),
  ('crysalys', 'Nivéria', 'Crysalys', 'Cristéa', FALSE),

  ('astrelys', 'Arcanthia', 'Astrélys', 'Astréon', FALSE),
  ('oraciel', 'Arcanthia', 'Oraciel', 'Oracielis', FALSE),
  ('vespera', 'Arcanthia', 'Vespera', 'Vesperis', FALSE),

  ('soleane', 'Solméria', 'Soléane', 'Soléa', FALSE),
  ('dorvalis', 'Solméria', 'Dorvalis', 'Dorval', FALSE),
  ('meridia', 'Solméria', 'Méridia', 'Méridiane', FALSE),

  ('almaris', 'Thalasséa', 'Almaris', 'Almaréa', FALSE),
  ('corallune', 'Thalasséa', 'Corallune', 'Corallia', FALSE),
  ('pelagis', 'Thalasséa', 'Pelagis', 'Pélagor', FALSE),
  ('ondelia', 'Thalasséa', 'Ondélia', 'Ondélys', FALSE),
  ('nerelys', 'Thalasséa', 'Nérélys', 'Néréa', FALSE),
  ('thalor', 'Thalasséa', 'Thalor', 'Thalassar', FALSE),

  ('pyrrhane', 'Ignéria', 'Pyrrhane', 'Pyrrhésia', FALSE),
  ('cendral', 'Ignéria', 'Cendral', 'Cendria', FALSE),

  ('umbrelune-hidden-01', 'Umbrelune', NULL, NULL, TRUE),
  ('umbrelune-hidden-02', 'Umbrelune', NULL, NULL, TRUE),
  ('umbrelune-hidden-03', 'Umbrelune', NULL, NULL, TRUE),
  ('umbrelune-hidden-04', 'Umbrelune', NULL, NULL, TRUE);

UPDATE countries SET is_origin_available = FALSE WHERE is_secret = TRUE;

ALTER TABLE characters
  ADD CONSTRAINT characters_origin_country_fk
  FOREIGN KEY (origin_country_id) REFERENCES countries(id)
  ON DELETE RESTRICT;

CREATE INDEX characters_origin_country_idx
  ON characters(origin_country_id);

CREATE INDEX countries_origin_available_idx
  ON countries(is_origin_available)
  WHERE is_origin_available = TRUE;

COMMIT;
