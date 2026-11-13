import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { startNpcTravelWorker } from "../src/modules/npc/npc-travel-worker.js";

test("le worker synchronise immédiatement puis s'arrête proprement", async () => {
  const poolQueries: string[] = [];
  const clientQueries: string[] = [];
  const client = {
    query: async (sql: string) => {
      clientQueries.push(sql);
      if (sql.includes("SELECT id, npc_key")) return { rows: [] };
      return { rows: [] };
    },
    release: () => undefined
  };
  const pool = {
    query: async (sql: string) => {
      poolQueries.push(sql);
      return { rows: [{ world_minute: "0" }] };
    },
    connect: async () => client
  } as unknown as Pool;

  const stop = startNpcTravelWorker(pool, { intervalMs: 60_000 });
  await stop();

  assert.equal(poolQueries.length, 1);
  assert.ok(clientQueries.includes("BEGIN"));
  assert.ok(clientQueries.includes("COMMIT"));
});

test("refuse un intervalle de synchronisation trop court", () => {
  const pool = {} as Pool;
  assert.throws(() => startNpcTravelWorker(pool, { intervalMs: 999 }));
});
