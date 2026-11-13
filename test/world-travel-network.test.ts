import assert from "node:assert/strict";
import testCase from "node:test";
import {
  getWorldTravelNeighbors,
  listAvailableWorldTravelLinks,
  validateWorldTravelLinks,
  type WorldTravelLinkDefinition
} from "../src/modules/world/travel-network.js";

const context = {
  settlementKeys: new Set(["aureval", "liorea"]),
  geographicFeatureKeys: new Set(["north_pass", "blue_bay"])
};

const road: WorldTravelLinkDefinition = {
  key: "aureval_liorea_road",
  name: "Route entre deux villes",
  from: { key: "aureval", kind: "settlement" },
  to: { key: "liorea", kind: "settlement" },
  mode: "land",
  linkType: "road",
  bidirectional: true,
  visibility: "public",
  status: "approved"
};

testCase("les liaisons valident les points de départ, d'arrivée et le mode", () => {
  assert.deepEqual(validateWorldTravelLinks([road], context), []);
  assert.ok(validateWorldTravelLinks([{
    ...road,
    key: "bad_route",
    to: { key: "unknown_place", kind: "settlement" }
  }], context).some((issue) => issue.includes("Destination inconnue")));
  assert.ok(validateWorldTravelLinks([{
    ...road,
    key: "bad_mode",
    mode: "sea",
    linkType: "road"
  }], context).some((issue) => issue.includes("incompatible")));
});

testCase("les itinéraires refusent les extrémités identiques et les mesures invalides", () => {
  assert.ok(validateWorldTravelLinks([{
    ...road,
    to: road.from
  }], context).some((issue) => issue.includes("deux points distincts")));
  assert.ok(validateWorldTravelLinks([{
    ...road,
    distanceMeters: 0,
    estimatedDurationMinutes: -4
  }], context).some((issue) => issue.includes("distance")));
});

testCase("les liaisons secrètes restent indisponibles avant découverte des deux extrémités", () => {
  const secret: WorldTravelLinkDefinition = {
    ...road,
    key: "secret_passage",
    from: { key: "north_pass", kind: "geographic_feature" },
    to: { key: "blue_bay", kind: "geographic_feature" },
    mode: "land",
    linkType: "tunnel",
    visibility: "discovery_locked"
  };
  assert.equal(listAvailableWorldTravelLinks([secret], new Set()).length, 0);
  assert.equal(listAvailableWorldTravelLinks(
    [secret], new Set(["north_pass", "blue_bay"])
  ).length, 1);
  assert.deepEqual(
    getWorldTravelNeighbors([secret], secret.from),
    []
  );
  assert.deepEqual(
    getWorldTravelNeighbors([secret], secret.from, new Set(["north_pass", "blue_bay"])),
    [secret.to]
  );
});

testCase("les voisins respectent le sens et la validation éditoriale", () => {
  const oneWay: WorldTravelLinkDefinition = {
    ...road,
    bidirectional: false
  };
  assert.deepEqual(
    getWorldTravelNeighbors([oneWay], { key: "aureval", kind: "settlement" }),
    [{ key: "liorea", kind: "settlement" }]
  );
  assert.deepEqual(
    getWorldTravelNeighbors([oneWay], { key: "liorea", kind: "settlement" }),
    []
  );
  assert.deepEqual(
    getWorldTravelNeighbors([{ ...road, status: "draft" }], {
      key: "aureval", kind: "settlement"
    }),
    []
  );
});
