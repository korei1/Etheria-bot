import test from "node:test";
import assert from "node:assert/strict";
import {
  getNextNpcTravelOccurrence,
  validateNpcWeeklyTravelSchedule
} from "../src/modules/npc/npc-routine-schedule.js";
import { getLocalWorldDate, WORLD_MINUTES_PER_DAY } from "../src/modules/world/world-clock.js";

const zone = {
  key: "test_zone",
  displayName: "Fuseau de test",
  utcOffsetMinutes: 120,
  seasonalClockChange: false as const
};

test("valide un calendrier hebdomadaire de voyage", () => {
  assert.deepEqual(validateNpcWeeklyTravelSchedule({
    weekdays: [1, 4, 7],
    departureMinute: 8 * 60 + 30,
    routeKey: "route_test"
  }), []);
});

test("refuse les jours dupliqués, les minutes hors journée et les clés invalides", () => {
  assert.equal(validateNpcWeeklyTravelSchedule({
    weekdays: [2, 2],
    departureMinute: 1440,
    routeKey: "Bad Route"
  }).length, 3);
});

test("calcule le prochain départ dans le fuseau local et le reconvertit en temps mondial", () => {
  const current = 10 * WORLD_MINUTES_PER_DAY + 7 * 60;
  const currentLocal = getLocalWorldDate(current, zone);
  const schedule = {
    weekdays: [currentLocal.weekday],
    departureMinute: 8 * 60,
    routeKey: "route_test"
  };
  const next = getNextNpcTravelOccurrence(current, zone, schedule);
  assert.equal(next, current + 60);
  assert.equal(getLocalWorldDate(next, zone).minuteOfDay, 8 * 60);
});

test("si l'heure locale du jour est passée, choisit la prochaine semaine", () => {
  const current = 10 * WORLD_MINUTES_PER_DAY + 10 * 60;
  const currentLocal = getLocalWorldDate(current, zone);
  const next = getNextNpcTravelOccurrence(current, zone, {
    weekdays: [currentLocal.weekday],
    departureMinute: 8 * 60,
    routeKey: "route_test"
  });
  assert.equal(next, current + 7 * WORLD_MINUTES_PER_DAY);
});

test("le décalage de fuseau peut faire passer un départ au jour mondial précédent", () => {
  const current = 10 * WORLD_MINUTES_PER_DAY + 23 * 60;
  const next = getNextNpcTravelOccurrence(current, zone, {
    weekdays: [getLocalWorldDate(current, zone).weekday],
    departureMinute: 30,
    routeKey: "route_test"
  });
  assert.ok(next > current);
  assert.equal(getLocalWorldDate(next, zone).minuteOfDay, 30);
});
