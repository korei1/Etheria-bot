import test from "node:test";

import type { Pool } from "pg";
import { getCurrentLocalLife, formatLocalAvailability } from "../src/modules/world/local-life-service.js";

function localLifePool(options: {
  zoneConfigured?: boolean;
  rows?: Array<Record<string, unknown>>;
} = {}): Pool {
  return {
    query: async (sql: string) => {
      if (sql.includes("FROM characters c")) {
        return { rows: [{ settlement_id: "settlement-1", settlement_name: "Ville de test", settlement_key: "test_town" }], rowCount: 1 };
      }
      if (sql.includes("FROM world_discoveries")) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      if (sql.includes("FROM world_settlements s") && sql.includes("CROSS JOIN world_clock")) {
        const configured = options.zoneConfigured !== false;
        return {
          rows: [{
            world_minute: "720",
            anchored_at: new Date("2026-01-01T00:00:00.000Z"),
            world_minutes_per_real_minute: "1",
            is_paused: true,
            zone_key: configured ? "east" : null,
            zone_name: configured ? "Fuseau oriental" : null,
            utc_offset_minutes: configured ? 120 : null,
            longitude_degrees: "30.000"
          }],
          rowCount: 1
        };
      }
      if (sql.includes("FROM world_local_content c")) return { rows: options.rows ?? [], rowCount: options.rows?.length ?? 0 };
      throw new Error("Requête inattendue dans le test : " + sql);
    }
  } as unknown as Pool;
}

test("la vie locale calcule l'ouverture avec le jour et l'heure du fuseau de la localité", async () => {
  const result = await getCurrentLocalLife(localLifePool({
    rows: [{
      content_key: "market",
      display_name: "Marché",
      content_kind: "shop",
      description: "Marché de test",
      opening_schedule: { days: [{ weekday: 1, intervals: [{ opensAtMinute: 13 * 60, closesAtMinute: 15 * 60 }] }] },
      start_day: null,
      end_day: null,
      stock_key: "apples",
      stock_name: "Pommes",
      price_teas: "5",
      quantity: 3,
      maximum_quantity: 10
    }]
  }), "account-1", new Date("2026-01-01T00:00:00.000Z"));

  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.localClock.status, "available");
  assert.equal(result.localClock.formatted, "Année 1, jour 1 · 14:00");
  assert.equal(result.entries[0]?.isOpenNow, true);
  assert.equal(result.entries[0]?.stock[0]?.quantity, 3);
});

test("un commerce est fermé en dehors de ses horaires locaux", async () => {
  const result = await getCurrentLocalLife(localLifePool({
    rows: [{
      content_key: "market",
      display_name: "Marché",
      content_kind: "shop",
      description: "Marché de test",
      opening_schedule: { days: [{ weekday: 1, intervals: [{ opensAtMinute: 9 * 60, closesAtMinute: 12 * 60 }] }] },
      start_day: null,
      end_day: null,
      stock_key: null,
      stock_name: null,
      price_teas: null,
      quantity: null,
      maximum_quantity: null
    }]
  }), "account-1");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.entries[0]?.isOpenNow, false);
  assert.equal(formatLocalAvailability(result.entries[0]!), "Fermé actuellement");
});

test("les événements datés sont marqués en cours selon le jour local", async () => {
  const result = await getCurrentLocalLife(localLifePool({
    rows: [{
      content_key: "festival",
      display_name: "Festival de test",
      content_kind: "event",
      description: "Événement",
      opening_schedule: null,
      start_day: 1,
      end_day: 2,
      stock_key: null,
      stock_name: null,
      price_teas: null,
      quantity: null,
      maximum_quantity: null
    }]
  }), "account-1");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.entries[0]?.isHappeningNow, true);
  assert.equal(formatLocalAvailability(result.entries[0]!), "En cours actuellement");
});

test("sans fuseau approuvé, le système n'invente ni heure ni statut d'ouverture", async () => {
  const result = await getCurrentLocalLife(localLifePool({
    zoneConfigured: false,
    rows: [{
      content_key: "market",
      display_name: "Marché",
      content_kind: "shop",
      description: "Marché de test",
      opening_schedule: { days: [{ weekday: 1, intervals: [{ opensAtMinute: 0, closesAtMinute: 1440 }] }] },
      start_day: null,
      end_day: null,
      stock_key: null,
      stock_name: null,
      price_teas: null,
      quantity: null,
      maximum_quantity: null
    }]
  }), "account-1");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.localClock.status, "time_zone_not_configured");
  assert.equal(result.entries[0]?.isOpenNow, null);
});
