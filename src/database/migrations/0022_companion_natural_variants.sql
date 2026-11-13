-- Variantes naturelles présentes chez chaque individu.
-- Les clés sont validées contre le catalogue de son espèce par la couche métier.
ALTER TABLE companion_instances
  ADD COLUMN natural_variant_keys TEXT[] NOT NULL DEFAULT '{}'::text[];
