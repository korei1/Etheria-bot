import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateOffsetFromLongitude,
  formatLocalWorldTime,
  getLocalWorldDate,
  projectWorldMinute,
  validateWorldTimeZone,
  type WorldClockState,
  type WorldTimeZone
} from "../src/modules/world/world-clock.js";

const zone = (utcOffsetMinutes: number): WorldTimeZone => ({
  key: "test_zone",
  displayName: "Fuseau de test",
  utcOffsetMinutes,
  seasonalClockChange: false
});

describe("world clock and local time zones", () => {
  it("keeps one global instant while showing different local hours", () => {
    const west = getLocalWorldDate(12 * 60, zone(-300));
    const east = getLocalWorldDate(12 * 60, zone(180));
    assert.equal(west.minuteOfDay, 7 * 60);
    assert.equal(east.minuteOfDay, 15 * 60);
    assert.equal(west.dayOfYear, east.dayOfYear);
  });

  it("handles local midnight and year rollover", () => {
    const previousDay = getLocalWorldDate(120 * 1440 + 30, zone(-60));
    assert.equal(previousDay.dayOfYear, 120);
    assert.equal(previousDay.year, 1);
    assert.equal(previousDay.minuteOfDay, 23 * 60 + 30);

    const nextYear = getLocalWorldDate(120 * 1440 - 30, zone(60));
    assert.equal(nextYear.year, 2);
    assert.equal(nextYear.dayOfYear, 1);
    assert.equal(nextYear.minuteOfDay, 30);
  });

  it("derives the 5 cycles of 24 days and the 7-day week", () => {
    const date = getLocalWorldDate(59 * 1440, zone(0));
    assert.equal(date.cycle, 3);
    assert.equal(date.dayOfCycle, 12);
    assert.equal(date.weekday, 4);
  });

  it("estimates terrestrial offsets from 15-degree longitude bands", () => {
    assert.equal(estimateOffsetFromLongitude(-74), -300);
    assert.equal(estimateOffsetFromLongitude(2), 0);
    assert.equal(estimateOffsetFromLongitude(151), 600);
    assert.throws(() => estimateOffsetFromLongitude(181));
  });

  it("does not advance a paused clock and projects a running clock deterministically", () => {
    const base: WorldClockState = {
      worldMinute: 500,
      anchoredAt: new Date("2026-01-01T00:00:00.000Z"),
      worldMinutesPerRealMinute: 2,
      paused: false
    };
    assert.equal(projectWorldMinute(base, new Date("2026-01-01T00:10:00.000Z")), 520);
    assert.equal(projectWorldMinute({ ...base, paused: true },
      new Date("2026-01-01T00:10:00.000Z")), 500);
  });

  it("rejects invalid offsets and unsupported seasonal clock changes", () => {
    assert.notEqual(validateWorldTimeZone(zone(900)).length, 0);
    assert.notEqual(validateWorldTimeZone({
      ...zone(60),
      seasonalClockChange: true as false
    }).length, 0);
  });

  it("formats a local Etheria date and time", () => {
    assert.equal(formatLocalWorldTime(getLocalWorldDate(90, zone(0))),
      "Année 1, jour 1 · 01:30");
  });
});
