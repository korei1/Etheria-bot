-- Caractéristiques descriptives propres à chaque individu.
-- Les valeurs sont validées contre la fiche d'espèce par le catalogue applicatif.
-- Aucun effet de gameplay n'est associé automatiquement à ces champs.
ALTER TABLE companion_instances
  ADD COLUMN individual_traits JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE companion_instances
  ADD CONSTRAINT companion_instances_individual_traits_object
  CHECK (jsonb_typeof(individual_traits) = 'object');
