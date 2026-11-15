import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { getSettlementLocalTime } from "../src/modules/world/world-clock-service.js";

function poolReturning(row: Record<string, unknown> | undefined): Pool {
  return {
    query: async () => ({ rows: row ? [row] : [], rowCount: row ? 1 : 0 })
  } as unknown as Pool;
}

const baseRow = {
  world_minute: "720",
  anchored_at: new Date("2026-01-01T00:00:00.000Z"),
  world_minutes_per_real_minute: "1",
  is_paused: true,
  zone_key: "east",
  zone_name: "Fuseau oriental",
  utc_offset_minutes: 120,
  longitude_degrees: "30.000"
};

describe("settlement local clock service", () => {
  it("derives a local time from the shared world clock and approved zone", async () => {
    const result = await getSettlementLocalTime(
      poolReturning(baseRow),
      "settlement-id",
      new Date("2026-01-01T01:00:00.000Z")
    );
    assert.equal(result.status, "available");
    if (result.status !== "available") return;
    assert.equal(result.worldMinute, 720);
    assert.equal(result.localDate.minuteOfDay, 14 * 60);
    assert.equal(result.formatted, "Année 1, jour 1 · 14:00");
  });

  it("does not invent a time when no approved zone is assigned", async () => {
    const result = await getSettlementLocalTime(
      poolReturning({ ...baseRow, zone_key: null, zone_name: null, utc_offset_minutes: null }),
      "settlement-id"
    );
    assert.deepEqual(result, { status: "time_zone_not_configured" });
  });

  it("reports a missing or unapproved settlement without exposing a clock", async () => {
    const result = await getSettlementLocalTime(poolReturning(undefined), "settlement-id");
    assert.deepEqual(result, { status: "settlement_not_found" });
  });
});
