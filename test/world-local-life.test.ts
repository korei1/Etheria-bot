import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTINENT_CULTURAL_IDENTITIES,
  listVisibleLocalContent,
  validateLocalContent,
  type LocalContentDefinition
} from "../src/modules/world/local-life.js";

const context = {
  settlementKeys: new Set(["oak_archive", "ember_arena", "hidden_hamlet"]),
  settlementContinents: new Map([
    ["oak_archive", "sylvaria" as const],
    ["ember_arena", "igneria" as const],
    ["hidden_hamlet", "umbrelune" as const]
  ])
};

const archiveActivity: LocalContentDefinition = {
  key: "historical_reenactment",
  name: "Reconstitution historique",
  settlementKey: "oak_archive",
  continentKey: "sylvaria",
  kind: "activity",
  status: "approved",
  visibility: "public",
  description: "Une représentation d'un événement historique connu.",
  culturalTags: ["mémoire collective", "récits"],
  culturalRationale: "La représentation transmet l'histoire connue et peut donner des indices sur les archives.",
};

test("les sept identités continentales et les fêtes canoniques sont présentes", () => {
  assert.equal(CONTINENT_CULTURAL_IDENTITIES.length, 7);
  assert.equal(CONTINENT_CULTURAL_IDENTITIES.find((item) => item.key === "sylvaria")?.festivalName, "Souvenance");
  assert.equal(CONTINENT_CULTURAL_IDENTITIES.find((item) => item.key === "igneria")?.festivalName, "Ardence");
  assert.equal(CONTINENT_CULTURAL_IDENTITIES.find((item) => item.key === "umbrelune")?.publicByDefault, false);
});

test("un contenu local doit justifier son lien culturel et correspondre au continent de la localité", () => {
  assert.deepEqual(validateLocalContent([archiveActivity], context), []);
  const wrongContinent = validateLocalContent([{
    ...archiveActivity,
    continentKey: "igneria"
  }], context);
  assert.ok(wrongContinent.some((issue) => issue.includes("continent ne correspond pas")));
  const missingRationale = validateLocalContent([{
    ...archiveActivity,
    culturalRationale: " "
  }], context);
  assert.ok(missingRationale.some((issue) => issue.includes("justification culturelle")));
});

test("les événements utilisent le calendrier Etheria de 120 jours", () => {
  const festival: LocalContentDefinition = {
    ...archiveActivity,
    key: "ardence",
    name: "Ardence",
    settlementKey: "ember_arena",
    continentKey: "igneria",
    kind: "event",
    culturalTags: ["puissance", "courage"],
    culturalRationale: "La fête célèbre la maîtrise et le courage démontrés par les actes.",
    startDay: 60,
    endDay: 61
  };
  assert.deepEqual(validateLocalContent([festival], context), []);
  assert.ok(validateLocalContent([{
    ...festival,
    startDay: 120,
    endDay: 121
  }], context).some((issue) => issue.includes("jours 1 et 120")));
});

test("Umbrelune ne peut jamais publier un contenu public", () => {
  const secret: LocalContentDefinition = {
    ...archiveActivity,
    key: "hidden_story",
    name: "Récit caché",
    settlementKey: "hidden_hamlet",
    continentKey: "umbrelune",
    visibility: "public"
  };
  assert.ok(validateLocalContent([secret], context).some((issue) => issue.includes("Umbrelune")));
});

test("seuls les contenus approuvés et visibles dans la localité découverte sont listés", () => {
  const locked = { ...archiveActivity, key: "secret_archive", visibility: "discovery_locked" as const };
  const draft = { ...archiveActivity, key: "draft_activity", status: "draft" as const };
  assert.deepEqual(listVisibleLocalContent(
    [archiveActivity, locked, draft],
    { settlementKey: "oak_archive", discoveredSettlementKeys: new Set(["oak_archive"]) }
  ), [archiveActivity]);
  assert.deepEqual(listVisibleLocalContent(
    [locked],
    {
      settlementKey: "oak_archive",
      discoveredSettlementKeys: new Set(["oak_archive"]),
      discoveredContentKeys: new Set(["secret_archive"])
    }
  ), [locked]);
});
