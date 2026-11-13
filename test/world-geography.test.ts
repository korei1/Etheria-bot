import assert from "node:assert/strict";
import test from "node:test";
import {
  WORLD_CONTINENTS,
  WorldGeographyError,
  createWorldGeographyRegistry,
  listVisibleWorldGeographicFeatures,
  validateWorldGeographicFeatures,
  type WorldGeographicFeatureDefinition
} from "../src/modules/world/geography.js";

const publicForest: WorldGeographicFeatureDefinition = {
  key: "forest_test",
  name: "Forêt de test",
  featureType: "forest",
  continentKey: "sylvaria",
  visibility: "public",
  editorialStatus: "approved"
};

test("le registre reprend exactement les sept continents canoniques", () => {
  assert.deepEqual(
    WORLD_CONTINENTS.map(({ key }) => key),
    ["sylvaria", "niveria", "arcanthia", "solmeria", "thalassea", "igneria", "umbrelune"]
  );
  assert.equal(WORLD_CONTINENTS.find((entry) => entry.key === "umbrelune")?.visibility, "discovery_locked");
  assert.equal(createWorldGeographyRegistry().continents.size, 7);
});

test("une caractéristique géographique valide est enregistrée", () => {
  const registry = createWorldGeographyRegistry([publicForest]);
  assert.equal(registry.features.get("forest_test")?.name, "Forêt de test");
});

test("les clés dupliquées, continents inconnus et parents absents sont refusés", () => {
  const invalid = [
    publicForest,
    { ...publicForest },
    { ...publicForest, key: "bad_continent", continentKey: "unknown" as never },
    { ...publicForest, key: "bad_parent", parentFeatureKey: "missing" }
  ];
  assert.ok(validateWorldGeographicFeatures(invalid).length >= 3);
  assert.throws(() => createWorldGeographyRegistry(invalid), WorldGeographyError);
});

test("la hiérarchie géographique refuse les cycles", () => {
  const cyclic = [
    { ...publicForest, key: "feature_a", parentFeatureKey: "feature_b" },
    { ...publicForest, key: "feature_b", parentFeatureKey: "feature_a" }
  ];
  assert.ok(validateWorldGeographicFeatures(cyclic).some((issue) => issue.includes("Cycle")));
});

test("les éléments Umbrelune restent invisibles avant découverte", () => {
  const registry = createWorldGeographyRegistry([
    publicForest,
    {
      key: "hidden_feature",
      name: "Lieu secret",
      featureType: "valley",
      continentKey: "umbrelune",
      visibility: "discovery_locked",
      editorialStatus: "approved"
    },
    {
      key: "draft_feature",
      name: "Brouillon",
      featureType: "lake",
      continentKey: "sylvaria",
      visibility: "public",
      editorialStatus: "draft"
    }
  ]);

  assert.deepEqual(
    listVisibleWorldGeographicFeatures(registry, []).map((entry) => entry.key),
    ["forest_test"]
  );
  assert.deepEqual(
    listVisibleWorldGeographicFeatures(registry, new Set(["umbrelune"])).map((entry) => entry.key),
    ["forest_test", "hidden_feature"]
  );
});
