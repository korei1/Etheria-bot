-- Etheria - migration 0020
-- Compagnons persistants et état durable de leurs besoins/repos.
-- Les Teas et transactions économiques restent dans Sweet Tea Economy (SCNX).

BEGIN;

CREATE TABLE companion_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  species_key TEXT NOT NULL CHECK (length(btrim(species_key)) > 0),
  display_name TEXT,
  rarity TEXT NOT NULL CHECK (rarity IN (
    'commun', 'peu_commun', 'rare', 'tres_rare', 'epique', 'legendaire', 'mythique'
  )),
  element TEXT NOT NULL CHECK (element IN (
    'eau', 'feu', 'electrique', 'terre', 'air', 'magie', 'psy', 'ombre'
  )),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  experience BIGINT NOT NULL DEFAULT 0 CHECK (experience >= 0),
  acquisition_method TEXT NOT NULL CHECK (acquisition_method IN (
    'discord_shop', 'wild_encounter', 'adoption', 'breeding', 'quest',
    'event', 'discovery', 'reward', 'trade', 'gift'
  )),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  selected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companion_species_key_not_empty CHECK (length(btrim(species_key)) > 0)
);

CREATE INDEX companion_instances_owner_species_idx
  ON companion_instances(owner_account_id, species_key, created_at);

CREATE INDEX companion_instances_owner_idx
  ON companion_instances(owner_account_id, created_at DESC);

-- Un seul compagnon sélectionné à la fois par compte.
CREATE UNIQUE INDEX companion_instances_one_selected_per_account
  ON companion_instances(owner_account_id)
  WHERE selected_at IS NOT NULL;

CREATE TABLE companion_care_states (
  companion_id UUID PRIMARY KEY
    REFERENCES companion_instances(id) ON DELETE CASCADE,
  hunger_percent SMALLINT NOT NULL CHECK (hunger_percent BETWEEN 0 AND 100),
  thirst_percent SMALLINT NOT NULL CHECK (thirst_percent BETWEEN 0 AND 100),
  energy SMALLINT NOT NULL CHECK (energy BETWEEN 0 AND 100),
  has_digestive_disorder BOOLEAN NOT NULL DEFAULT FALSE,
  has_chronic_fatigue BOOLEAN NOT NULL DEFAULT FALSE,
  last_free_ration_at TIMESTAMPTZ,
  rest_started_at TIMESTAMPTZ,
  rest_last_processed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companion_rest_timestamps_consistent CHECK (
    (rest_started_at IS NULL)
    OR (rest_last_processed_at >= rest_started_at)
  )
);

CREATE TABLE companion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id UUID NOT NULL
    REFERENCES companion_instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (length(btrim(event_type)) > 0),
  idempotency_key UUID UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX companion_events_companion_date_idx
  ON companion_events(companion_id, created_at DESC);

COMMIT;
