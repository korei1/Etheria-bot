-- Etheria - migration 0007
-- Le lieu d'apparition reste caché jusqu'à la première rencontre avec un PNJ.

BEGIN;

ALTER TABLE characters
  ADD COLUMN spawn_location_revealed_at TIMESTAMPTZ;

COMMIT;
