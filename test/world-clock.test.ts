import { describe, expect, it } from "vitest";
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
    expect(west.minuteOfDay).toBe(7 * 60);
    expect(east.minuteOfDay).toBe(15 * 60);
    expect(west.dayOfYear).toBe(east.dayOfYear);
  });

  it("handles local midnight and year rollover", () => {
    const previousDay = getLocalWorldDate(120 * 1440 + 30, zone(-60));
    expect(previousDay.dayOfYear).toBe(120);
    expect(previousDay.year).toBe(1);
    expect(previousDay.minuteOfDay).toBe(23 * 60 + 30);

    const nextYear = getLocalWorldDate(120 * 1440 - 30, zone(60));
    expect(nextYear.year).toBe(2);
    expect(nextYear.dayOfYear).toBe(1);
    expect(nextYear.minuteOfDay).toBe(30);
  });

  it("derives the 5 cycles of 24 days and the 7-day week", () => {
    const date = getLocalWorldDate(59 * 1440, zone(0));
    expect(date.cycle).toBe(3);
    expect(date.dayOfCycle).toBe(12);
    expect(date.weekday).toBe(4);
  });

  it("estimates terrestrial offsets from 15-degree longitude bands", () => {
    expect(estimateOffsetFromLongitude(-74)).toBe(-300);
    expect(estimateOffsetFromLongitude(2)).toBe(0);
    expect(estimateOffsetFromLongitude(151)).toBe(600);
    expect(() => estimateOffsetFromLongitude(181)).toThrow();
  });

  it("does not advance a paused clock and projects a running clock deterministically", () => {
    const base: WorldClockState = {
      worldMinute: 500,
      anchoredAt: new Date("2026-01-01T00:00:00.000Z"),
      worldMinutesPerRealMinute: 2,
      paused: false
    };
    expect(projectWorldMinute(base, new Date("2026-01-01T00:10:00.000Z"))).toBe(520);
    expect(projectWorldMinute({ ...base, paused: true },
      new Date("2026-01-01T00:10:00.000Z"))).toBe(500);
  });

  it("rejects invalid offsets and unsupported seasonal clock changes", () => {
    expect(validateWorldTimeZone(zone(900))).not.toHaveLength(0);
    expect(validateWorldTimeZone({
      ...zone(60),
      seasonalClockChange: true as false
    })).not.toHaveLength(0);
  });

  it("formats a local Etheria date and time", () => {
    expect(formatLocalWorldTime(getLocalWorldDate(90, zone(0))))
      .toBe("Année 1, jour 1 · 01:30");
  });
});
