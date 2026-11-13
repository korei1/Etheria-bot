-- Etheria - migration 0030
-- Catalogue éditorial des activités, services, commerces et événements locaux.
-- Aucun contenu concret n'est préchargé : chaque entrée doit être rédigée et approuvée.
-- À appliquer uniquement après revue et approbation explicites.

BEGIN;

CREATE TABLE world_local_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key TEXT NOT NULL UNIQUE
    CHECK (content_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  settlement_id UUID NOT NULL REFERENCES world_settlements(id) ON DELETE RESTRICT,
  content_kind TEXT NOT NULL
    CHECK (content_kind IN ('activity', 'service', 'shop', 'event')),
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'discovery_locked')),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft', 'approved', 'retired')),
  description TEXT NOT NULL CHECK (length(btrim(description)) > 0),
  cultural_tags TEXT[] NOT NULL,
  cultural_rationale TEXT NOT NULL CHECK (length(btrim(cultural_rationale)) > 0),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(payload) = 'object'),
  start_day SMALLINT,
  end_day SMALLINT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_local_content_tags_nonempty
    CHECK (cardinality(cultural_tags) > 0 AND array_position(cultural_tags, '') IS NULL),
  CONSTRAINT world_local_content_event_dates CHECK (
    (content_kind = 'event' AND
      ((start_day IS NULL AND end_day IS NULL) OR
       (start_day BETWEEN 1 AND 120 AND end_day BETWEEN start_day AND 120)))
    OR
    (content_kind <> 'event' AND start_day IS NULL AND end_day IS NULL)
  ),
);

CREATE FUNCTION enforce_local_content_continent_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $
BEGIN
  IF NEW.visibility = 'public' AND EXISTS (
    SELECT 1
    FROM world_settlements s
    JOIN countries c ON c.id = s.country_id
    WHERE s.id = NEW.settlement_id
      AND c.continent_key = 'umbrelune'
  ) THEN
    RAISE EXCEPTION 'Un contenu d''Umbrelune ne peut pas être public';
  END IF;
  RETURN NEW;
END;
$;

CREATE TRIGGER world_local_content_umbrelune_visibility
  BEFORE INSERT OR UPDATE OF settlement_id, visibility
  ON world_local_content
  FOR EACH ROW
  EXECUTE FUNCTION enforce_local_content_continent_visibility();

CREATE INDEX world_local_content_settlement_idx
  ON world_local_content(settlement_id, content_kind, editorial_status);
CREATE INDEX world_local_content_calendar_idx
  ON world_local_content(start_day, end_day)
  WHERE content_kind = 'event' AND editorial_status = 'approved';

ALTER TABLE world_local_content ENABLE ROW LEVEL SECURITY;

COMMIT;
