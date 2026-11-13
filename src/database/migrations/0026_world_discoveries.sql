-- Etheria - migration 0026
-- Persistance des découvertes personnelles et de leur journal d'événements.
-- Les découvertes appartiennent au compte, pas à un personnage : elles survivent
-- donc aux changements de personnage et aux retraits éditoriaux du catalogue.
-- À appliquer uniquement après revue et approbation explicites.

BEGIN;

CREATE TABLE world_discovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL CHECK (length(btrim(event_id)) > 0),
  target_kind TEXT NOT NULL CHECK (target_kind IN (
    'continent', 'country', 'administrative_area', 'settlement',
    'geographic_feature', 'travel_link'
  )),
  target_key TEXT NOT NULL CHECK (length(btrim(target_key)) > 0),
  discovery_method TEXT NOT NULL CHECK (discovery_method IN (
    'first_encounter', 'exploration', 'quest', 'event',
    'map_fragment', 'administrative_grant'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN ('discovered', 'already_discovered')),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_discovery_event_idempotency_unique UNIQUE (account_id, event_id),
  CONSTRAINT world_discovery_event_account_id_unique UNIQUE (account_id, id),
  CONSTRAINT world_discovery_event_record_unique
    UNIQUE (account_id, id, target_kind, target_key, discovery_method, occurred_at)
);

CREATE INDEX world_discovery_events_account_date_idx
  ON world_discovery_events(account_id, recorded_at DESC);
CREATE INDEX world_discovery_events_target_idx
  ON world_discovery_events(target_kind, target_key, recorded_at DESC);

CREATE TABLE world_discoveries (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  target_kind TEXT NOT NULL CHECK (target_kind IN (
    'continent', 'country', 'administrative_area', 'settlement',
    'geographic_feature', 'travel_link'
  )),
  target_key TEXT NOT NULL CHECK (length(btrim(target_key)) > 0),
  discovery_method TEXT NOT NULL CHECK (discovery_method IN (
    'first_encounter', 'exploration', 'quest', 'event',
    'map_fragment', 'administrative_grant'
  )),
  discovered_at TIMESTAMPTZ NOT NULL,
  first_event_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, target_kind, target_key),
  CONSTRAINT world_discoveries_first_event_fk
    FOREIGN KEY (account_id, first_event_id, target_kind, target_key, discovery_method, discovered_at)
    REFERENCES world_discovery_events(account_id, id, target_kind, target_key, discovery_method, occurred_at)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX world_discoveries_account_kind_idx
  ON world_discoveries(account_id, target_kind);
CREATE INDEX world_discoveries_target_idx
  ON world_discoveries(target_kind, target_key);

-- Accès réservé au backend de confiance. Aucune politique client n'est créée.
ALTER TABLE world_discovery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_discoveries ENABLE ROW LEVEL SECURITY;

COMMIT;
