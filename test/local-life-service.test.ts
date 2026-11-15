import assert from "node:assert/strict";
import test from "node:test";
import { formatLocalOpeningSchedule } from "../src/modules/world/local-life-service.js";

test("les horaires locaux sont présentés sans supposer le statut ouvert ou fermé", () => {
  assert.equal(formatLocalOpeningSchedule(null), "Horaires non renseignés");
  assert.equal(formatLocalOpeningSchedule({ days: [] }), "Fermé toute la semaine");
  assert.equal(
    formatLocalOpeningSchedule({ days: [
      { weekday: 2, intervals: [{ opensAtMinute: 13 * 60, closesAtMinute: 17 * 60 + 30 }] },
      { weekday: 1, intervals: [
        { opensAtMinute: 9 * 60, closesAtMinute: 12 * 60 },
        { opensAtMinute: 13 * 60, closesAtMinute: 18 * 60 }
      ] }
    ] }),
    "Jour 1 : 09:00–12:00, 13:00–18:00 · Jour 2 : 13:00–17:30"
  );
});
