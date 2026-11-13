import test from "node:test";
import assert from "node:assert/strict";
import { getNpcTravelPhase } from "../src/modules/npc/npc-travel-service.js";

test("un voyage reste planifié avant sa minute de départ", () => {
  assert.equal(getNpcTravelPhase(100, 145, 99), "scheduled");
});

test("le PNJ est en transit à partir du départ et avant l'arrivée", () => {
  assert.equal(getNpcTravelPhase(100, 145, 100), "in_transit");
  assert.equal(getNpcTravelPhase(100, 145, 144), "in_transit");
});

test("le PNJ arrive exactement à la minute d'arrivée", () => {
  assert.equal(getNpcTravelPhase(100, 145, 145), "arrived");
  assert.equal(getNpcTravelPhase(100, 145, 500), "arrived");
});

test("les bornes temporelles invalides sont refusées", () => {
  assert.throws(() => getNpcTravelPhase(10, 10, 10));
  assert.throws(() => getNpcTravelPhase(-1, 10, 0));
  assert.throws(() => getNpcTravelPhase(10, 20, Number.NaN));
});
