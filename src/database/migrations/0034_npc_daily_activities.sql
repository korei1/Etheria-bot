-- Etheria - migration 0034
-- Libellés d'activité associés aux placements quotidiens des PNJ.
-- Les textes restent éditoriaux et ne préjugent d'aucune activité canonique.

BEGIN;

ALTER TABLE npc_spawn_locations
  ADD COLUMN activity_label TEXT,
  ADD CONSTRAINT npc_spawn_activity_label_length
    CHECK (activity_label IS NULL OR length(btrim(activity_label)) BETWEEN 1 AND 120);

ALTER TABLE npc_settlement_locations
  ADD COLUMN activity_label TEXT,
  ADD CONSTRAINT npc_settlement_activity_label_length
    CHECK (activity_label IS NULL OR length(btrim(activity_label)) BETWEEN 1 AND 120);

COMMENT ON COLUMN npc_spawn_locations.activity_label IS
  'Activité affichée au joueur lorsque le PNJ est présent dans cette zone de départ.';

COMMENT ON COLUMN npc_settlement_locations.activity_label IS
  'Activité affichée au joueur lorsque le PNJ est présent dans cette localité.';

COMMIT;
