import test from "node:test";
import assert from "node:assert/strict";
import { isNpcWithinPresenceSchedule } from "../src/modules/npc/npc-dialogue-service.js";

test("un PNJ sans calendrier reste présent sans restriction horaire", () => {
  assert.equal(isNpcWithinPresenceSchedule(null, 1, 0), true);
  assert.equal(isNpcWithinPresenceSchedule(null, 7, 1439), true);
});

test("un PNJ programmé est présent uniquement dans ses intervalles locaux", () => {
  const schedule = {
    days: [{
      weekday: 3,
      intervals: [
        { opensAtMinute: 8 * 60, closesAtMinute: 12 * 60 },
        { opensAtMinute: 14 * 60, closesAtMinute: 18 * 60 }
      ]
    }]
  };
  assert.equal(isNpcWithinPresenceSchedule(schedule, 3, 8 * 60), true);
  assert.equal(isNpcWithinPresenceSchedule(schedule, 3, 11 * 60 + 59), true);
  assert.equal(isNpcWithinPresenceSchedule(schedule, 3, 12 * 60), false);
  assert.equal(isNpcWithinPresenceSchedule(schedule, 3, 13 * 60), false);
  assert.equal(isNpcWithinPresenceSchedule(schedule, 3, 14 * 60), true);
  assert.equal(isNpcWithinPresenceSchedule(schedule, 4, 15 * 60), false);
});

test("un calendrier vide signifie aucune présence planifiée", () => {
  assert.equal(isNpcWithinPresenceSchedule({ days: [] }, 1, 12 * 60), false);
});

test("un calendrier invalide ne rend jamais le PNJ présent", () => {
  const invalid = {
    days: [{
      weekday: 2,
      intervals: [
        { opensAtMinute: 900, closesAtMinute: 1000 },
        { opensAtMinute: 800, closesAtMinute: 850 }
      ]
    }]
  };
  assert.equal(isNpcWithinPresenceSchedule(invalid, 2, 920), false);
});
