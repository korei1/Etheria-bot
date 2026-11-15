-- Etheria - migration 0033
-- Calendriers hebdomadaires de présence des PNJ par placement.
-- NULL signifie présence sans restriction horaire ; aucun horaire n'est inventé.

BEGIN;

ALTER TABLE npc_spawn_locations
  ADD COLUMN presence_schedule JSONB,
  ADD CONSTRAINT npc_spawn_presence_schedule_object
    CHECK (presence_schedule IS NULL OR jsonb_typeof(presence_schedule) = 'object');

ALTER TABLE npc_settlement_locations
  ADD COLUMN presence_schedule JSONB,
  ADD CONSTRAINT npc_settlement_presence_schedule_object
    CHECK (presence_schedule IS NULL OR jsonb_typeof(presence_schedule) = 'object');

COMMENT ON COLUMN npc_spawn_locations.presence_schedule IS
  'Calendrier hebdomadaire local au lieu ; NULL signifie présence sans restriction.';

COMMENT ON COLUMN npc_settlement_locations.presence_schedule IS
  'Calendrier hebdomadaire local à la localité ; NULL signifie présence sans restriction.';

COMMIT;
