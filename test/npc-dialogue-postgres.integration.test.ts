import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import test from "node:test";
import {
  chooseNpcDialogueOption,
  listNpcEncountersAtCharacterSpawn,
  startNpcConversation
} from "../src/modules/npc/npc-dialogue-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("une première conversation PNJ révèle le lieu et persiste les choix", {
  skip: !databaseUrl
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const setupClient = await pool.connect();
  const schema = `etheria_npc_dialogue_${randomUUID().replaceAll("-", "")}`;
  let appPool: Pool | undefined;
  const accountId = randomUUID();
  const characterId = randomUUID();
  const countryId = randomUUID();
  const spawnZoneId = randomUUID();

  try {
    await setupClient.query(`CREATE SCHEMA "${schema}"`);
    await setupClient.query(`SET search_path TO "${schema}", public`);
    await setupClient.query("CREATE TABLE accounts (id UUID PRIMARY KEY)");
    await setupClient.query(
      `CREATE TABLE countries (
        id UUID PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL
      )`
    );
    await setupClient.query(
      `CREATE TABLE characters (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES accounts(id),
        status TEXT NOT NULL,
        origin_country_id UUID NOT NULL REFERENCES countries(id),
        spawn_zone_id UUID NOT NULL,
        first_npc_key TEXT,
        first_npc_encounter_at TIMESTAMPTZ,
        spawn_location_revealed_at TIMESTAMPTZ,
        UNIQUE (account_id, id)
      )`
    );
    await setupClient.query(
      `CREATE TABLE starting_spawn_zones (
        id UUID PRIMARY KEY,
        country_id UUID NOT NULL REFERENCES countries(id),
        zone_key TEXT NOT NULL UNIQUE,
        region_name TEXT NOT NULL,
        locality_name TEXT,
        biome_name TEXT NOT NULL
      )`
    );
    await setupClient.query(
      `CREATE TABLE npc_encounters (
        encounter_id UUID PRIMARY KEY,
        account_id UUID NOT NULL,
        character_id UUID NOT NULL,
        npc_key TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_first_for_character BOOLEAN NOT NULL DEFAULT FALSE,
        FOREIGN KEY (account_id, character_id)
          REFERENCES characters(account_id, id) ON DELETE CASCADE
      )`
    );
    await setupClient.query(
      "CREATE UNIQUE INDEX npc_encounters_one_first_per_character_idx ON npc_encounters(character_id) WHERE is_first_for_character = TRUE"
    );
    await setupClient.query(
      "INSERT INTO accounts (id) VALUES ($1)",
      [accountId]
    );
    await setupClient.query(
      "INSERT INTO countries (id, slug, display_name) VALUES ($1, 'country_alpha', 'Pays Alpha')",
      [countryId]
    );
    await setupClient.query(
      `INSERT INTO starting_spawn_zones
       (id, country_id, zone_key, region_name, locality_name, biome_name)
       VALUES ($1, $2, 'spawn_alpha', 'Région Alpha', 'Hameau Alpha', 'Forêt')`,
      [spawnZoneId, countryId]
    );
    await setupClient.query(
      `INSERT INTO characters
       (id, account_id, status, origin_country_id, spawn_zone_id)
       VALUES ($1, $2, 'active', $3, $4)`,
      [characterId, accountId, countryId, spawnZoneId]
    );

    const discoveryMigration = await readFile(
      new URL("../src/database/migrations/0026_world_discoveries.sql", import.meta.url),
      "utf8"
    );
    await setupClient.query(discoveryMigration);
    const dialogueMigration = await readFile(
      new URL("../src/database/migrations/0027_npc_dialogue_foundation.sql", import.meta.url),
      "utf8"
    );
    await setupClient.query(dialogueMigration);

    await setupClient.query("BEGIN");
    await setupClient.query(
      `INSERT INTO npc_definitions
       (npc_key, display_name, start_node_key, editorial_status)
       VALUES ('first_resident', 'Habitant', 'greeting', 'approved')`
    );
    await setupClient.query(
      `INSERT INTO npc_dialogue_nodes (npc_key, node_key, dialogue_text, is_terminal)
       VALUES
         ('first_resident', 'greeting', 'Bonjour. Tu sembles perdu.', FALSE),
         ('first_resident', 'farewell', 'Prends soin de toi.', TRUE)`
    );
    await setupClient.query(
      `INSERT INTO npc_dialogue_choices
       (npc_key, node_key, choice_key, choice_label, next_node_key)
       VALUES ('first_resident', 'greeting', 'ask_where', 'Où suis-je ?', 'farewell')`
    );
    await setupClient.query(
      `INSERT INTO npc_spawn_locations (npc_key, spawn_zone_id)
       VALUES ('first_resident', $1)`,
      [spawnZoneId]
    );
    await setupClient.query("COMMIT");

    appPool = new Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schema},public`,
      max: 4
    });

    const available = await listNpcEncountersAtCharacterSpawn(appPool, { accountId });
    assert.equal(available.length, 1);
    assert.equal(available[0]?.npcKey, "first_resident");

    const first = await startNpcConversation(appPool, {
      interactionId: "discord-interaction-first",
      accountId,
      characterId,
      npcKey: "first_resident"
    });
    assert.equal(first.firstEncounter, true);
    assert.equal(first.revealedLocation?.countryName, "Pays Alpha");
    assert.equal(first.revealedLocation?.regionName, "Région Alpha");
    assert.equal(first.dialogueText, "Bonjour. Tu sembles perdu.");
    assert.equal(first.choices.length, 1);

    const next = await chooseNpcDialogueOption(appPool, {
      interactionId: "discord-interaction-choice",
      accountId,
      characterId,
      conversationId: first.conversationId,
      choiceKey: "ask_where"
    });
    assert.equal(next.completed, true);
    assert.equal(next.dialogueText, "Prends soin de toi.");

    const repeated = await startNpcConversation(appPool, {
      interactionId: "discord-interaction-repeat",
      accountId,
      characterId,
      npcKey: "first_resident"
    });
    assert.equal(repeated.firstEncounter, false);
    assert.equal(repeated.revealedLocation?.countryName, "Pays Alpha");

    const discoveries = await appPool.query<{ target_kind: string; target_key: string }>(
      "SELECT target_kind, target_key FROM world_discoveries WHERE account_id = $1 ORDER BY target_kind",
      [accountId]
    );
    assert.deepEqual(
      discoveries.rows.map((row) => row.target_kind).sort(),
      ["country", "spawn_zone"]
    );
  } finally {
    await appPool?.end();
    await setupClient.query("RESET search_path").catch(() => undefined);
    await setupClient.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    setupClient.release();
    await pool.end();
  }
});
