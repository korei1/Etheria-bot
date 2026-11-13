import assert from "node:assert/strict";
import testCase from "node:test";
import {
  createDiscoveryState,
  getDiscoveredTargetKeys,
  getPersonalMapProgress,
  isTargetDiscoveredForAccount,
  recordWorldDiscovery,
  type DiscoveryTargetDefinition
} from "../src/modules/world/discovery.js";

const capital: DiscoveryTargetDefinition = {
  key: "aureval",
  kind: "settlement",
  editorialStatus: "approved",
  visibility: "public"
};
const hiddenRegion: DiscoveryTargetDefinition = {
  key: "umbrelune_hidden",
  kind: "country",
  editorialStatus: "approved",
  visibility: "discovery_locked",
  prerequisiteKeys: ["first_npc_encounter"]
};

function discover(state: ReturnType<typeof createDiscoveryState>, target: DiscoveryTargetDefinition, eventId: string) {
  return recordWorldDiscovery(state, {
    accountId: "account_one",
    target,
    method: "exploration",
    discoveredAt: "2026-11-13T12:00:00.000Z",
    eventId
  });
}

testCase("une découverte approuvée est enregistrée une seule fois par compte", () => {
  const first = discover(createDiscoveryState(), capital, "event_1");
  assert.equal(first.status, "discovered");
  if (first.status !== "discovered") return;
  assert.equal(isTargetDiscoveredForAccount(first.state, "account_one", "aureval"), true);
  assert.equal(isTargetDiscoveredForAccount(first.state, "account_two", "aureval"), false);
  assert.equal(discover(first.state, capital, "event_2").status, "already_discovered");
});

testCase("les événements idempotents ne créent pas de doublons", () => {
  const first = discover(createDiscoveryState(), capital, "event_1");
  assert.equal(first.status, "discovered");
  if (first.status !== "discovered") return;
  assert.equal(discover(first.state, { ...capital, key: "liorea" }, "event_1").status, "duplicate_event");
});

testCase("une découverte verrouillée exige ses prérequis", () => {
  const missing = discover(createDiscoveryState(), hiddenRegion, "event_2");
  assert.equal(missing.status, "rejected");
  const prerequisite = discover(createDiscoveryState(), {
    key: "first_npc_encounter",
    kind: "geographic_feature",
    editorialStatus: "approved",
    visibility: "public"
  }, "event_3");
  assert.equal(prerequisite.status, "discovered");
  if (prerequisite.status !== "discovered") return;
  assert.equal(discover(prerequisite.state, hiddenRegion, "event_4").status, "discovered");
});

testCase("les brouillons ne peuvent pas être découverts", () => {
  const result = discover(createDiscoveryState(), {
    ...capital,
    editorialStatus: "draft"
  }, "event_5");
  assert.equal(result.status, "rejected");
});

testCase("les zones de départ révélées ont leur propre catégorie de progression", () => {
  const state = createDiscoveryState([{
    accountId: "account_one",
    targetKey: "spawn_zone_alpha",
    targetKind: "spawn_zone",
    method: "first_encounter",
    discoveredAt: "2026-11-13T12:00:00.000Z",
    eventId: "first_npc_spawn_zone"
  }]);
  const progress = getPersonalMapProgress(state, "account_one");
  assert.equal(progress.discoveredCount, 1);
  assert.equal(progress.byKind.spawn_zone, 1);
});

testCase("la carte personnelle conserve les découvertes et sépare les comptes", () => {
  const first = discover(createDiscoveryState(), capital, "event_1");
  assert.equal(first.status, "discovered");
  if (first.status !== "discovered") return;
  const progress = getPersonalMapProgress(first.state, "account_one");
  assert.equal(progress.discoveredCount, 1);
  assert.equal(progress.byKind.settlement, 1);
  assert.deepEqual([...getDiscoveredTargetKeys(first.state, "account_one", "settlement")], ["aureval"]);
  assert.equal(getPersonalMapProgress(first.state, "account_two").discoveredCount, 0);
});
