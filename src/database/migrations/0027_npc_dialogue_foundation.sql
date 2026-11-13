-- Etheria - migration 0027
-- Définitions de PNJ, placements dans les zones de départ et dialogues persistants.
-- Aucun PNJ ni dialogue fictif n'est préchargé : le contenu reste éditorial.

BEGIN;

CREATE TABLE npc_definitions (
  npc_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  start_node_key TEXT NOT NULL,
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft', 'approved', 'retired')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT npc_key_valid CHECK (length(btrim(npc_key)) BETWEEN 1 AND 80),
  CONSTRAINT npc_display_name_valid CHECK (length(btrim(display_name)) BETWEEN 1 AND 100),
  CONSTRAINT npc_start_node_valid CHECK (length(btrim(start_node_key)) BETWEEN 1 AND 80)
);

CREATE TABLE npc_dialogue_nodes (
  npc_key TEXT NOT NULL REFERENCES npc_definitions(npc_key) ON DELETE RESTRICT,
  node_key TEXT NOT NULL,
  dialogue_text TEXT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (npc_key, node_key),
  CONSTRAINT npc_dialogue_node_key_valid CHECK (length(btrim(node_key)) BETWEEN 1 AND 80),
  CONSTRAINT npc_dialogue_text_valid CHECK (length(btrim(dialogue_text)) BETWEEN 1 AND 4000)
);

ALTER TABLE npc_definitions
  ADD CONSTRAINT npc_start_node_fk
  FOREIGN KEY (npc_key, start_node_key)
  REFERENCES npc_dialogue_nodes(npc_key, node_key)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE npc_dialogue_choices (
  npc_key TEXT NOT NULL,
  node_key TEXT NOT NULL,
  choice_key TEXT NOT NULL,
  choice_label TEXT NOT NULL,
  next_node_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (npc_key, node_key, choice_key),
  FOREIGN KEY (npc_key, node_key)
    REFERENCES npc_dialogue_nodes(npc_key, node_key) ON DELETE RESTRICT,
  FOREIGN KEY (npc_key, next_node_key)
    REFERENCES npc_dialogue_nodes(npc_key, node_key) ON DELETE RESTRICT,
  CONSTRAINT npc_dialogue_choice_key_valid CHECK (length(btrim(choice_key)) BETWEEN 1 AND 80),
  CONSTRAINT npc_dialogue_choice_label_valid CHECK (length(btrim(choice_label)) BETWEEN 1 AND 100)
);

CREATE TABLE npc_spawn_locations (
  npc_key TEXT NOT NULL REFERENCES npc_definitions(npc_key) ON DELETE RESTRICT,
  spawn_zone_id UUID NOT NULL REFERENCES starting_spawn_zones(id) ON DELETE RESTRICT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (npc_key, spawn_zone_id)
);

CREATE INDEX npc_spawn_locations_zone_idx
  ON npc_spawn_locations(spawn_zone_id, priority DESC)
  WHERE is_active = TRUE;

CREATE TABLE npc_character_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  npc_key TEXT NOT NULL REFERENCES npc_definitions(npc_key) ON DELETE RESTRICT,
  current_node_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (npc_key, current_node_key)
    REFERENCES npc_dialogue_nodes(npc_key, node_key) ON DELETE RESTRICT,
  CONSTRAINT npc_conversation_completion_consistency CHECK (
    (status = 'active' AND completed_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX npc_one_active_conversation_per_character_idx
  ON npc_character_conversations(character_id, npc_key)
  WHERE status = 'active';

CREATE INDEX npc_character_conversations_history_idx
  ON npc_character_conversations(character_id, started_at DESC);

CREATE TABLE npc_conversation_events (
  event_id TEXT PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES npc_character_conversations(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  npc_key TEXT NOT NULL REFERENCES npc_definitions(npc_key) ON DELETE RESTRICT,
  node_key TEXT NOT NULL,
  choice_key TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (npc_key, node_key)
    REFERENCES npc_dialogue_nodes(npc_key, node_key) ON DELETE RESTRICT,
  CONSTRAINT npc_conversation_event_id_valid CHECK (length(btrim(event_id)) > 0)
);

CREATE INDEX npc_conversation_events_character_idx
  ON npc_conversation_events(character_id, occurred_at DESC);

COMMIT;
