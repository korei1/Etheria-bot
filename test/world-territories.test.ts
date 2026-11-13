import assert from "node:assert/strict";
import testCase from "node:test";
import {
  listVisibleSettlements,
  validateAdministrativeAreas,
  validateSettlements,
  type AdministrativeAreaDefinition,
  type SettlementDefinition
} from "../src/modules/world/territories.js";

const context = {
  countryKeys: new Set(["elarion", "virelune", "umbrelune_hidden_01"]),
  secretCountryKeys: new Set(["umbrelune_hidden_01"])
};

const province: AdministrativeAreaDefinition = {
  key: "province_nord",
  name: "Province du Nord",
  countryKey: "elarion",
  areaType: "province",
  visibility: "public",
  editorialStatus: "approved"
};

testCase("les territoires administratifs exigent un pays et une hiérarchie cohérente", () => {
  assert.deepEqual(validateAdministrativeAreas([province], context), []);
  assert.ok(validateAdministrativeAreas([
    province,
    { ...province, key: "district_nord", parentAreaKey: "missing" }
  ], context).some((issue) => issue.includes("parent absent")));
  assert.ok(validateAdministrativeAreas([
    province,
    { ...province, key: "district_nord", parentAreaKey: "province_nord", countryKey: "virelune" }
  ], context).some((issue) => issue.includes("même pays")));
});

testCase("les localités valident les capitales et leur rattachement administratif", () => {
  const capital: SettlementDefinition = {
    key: "aureval",
    name: "Auréval",
    countryKey: "elarion",
    settlementType: "capital",
    administrativeAreaKey: "province_nord",
    isCapital: true,
    visibility: "public",
    editorialStatus: "approved"
  };
  assert.deepEqual(validateSettlements([capital], [province], context), []);
  assert.ok(validateSettlements([
    capital,
    { ...capital, key: "another_capital", name: "Autre capitale" }
  ], [province], context).some((issue) => issue.includes("Plusieurs capitales")));
  assert.ok(validateSettlements([
    { ...capital, key: "wrong_area", administrativeAreaKey: "missing" }
  ], [province], context).some((issue) => issue.includes("absent")));
});

testCase("une localité d'un pays secret ne peut pas être exposée publiquement", () => {
  const hidden: SettlementDefinition = {
    key: "hidden_settlement",
    name: "Lieu caché",
    countryKey: "umbrelune_hidden_01",
    settlementType: "village",
    isCapital: false,
    visibility: "public",
    editorialStatus: "approved"
  };
  assert.ok(validateSettlements([hidden], [], context).some((issue) => issue.includes("pays secret")));
  assert.deepEqual(listVisibleSettlements([hidden], new Set()).length, 0);
});

testCase("les brouillons et localités secrètes restent masqués avant découverte", () => {
  const entries: SettlementDefinition[] = [
    {
      key: "aureval",
      name: "Auréval",
      countryKey: "elarion",
      settlementType: "capital",
      isCapital: true,
      visibility: "public",
      editorialStatus: "approved"
    },
    {
      key: "secret_village",
      name: "Village secret",
      countryKey: "umbrelune_hidden_01",
      settlementType: "village",
      isCapital: false,
      visibility: "discovery_locked",
      editorialStatus: "approved"
    },
    {
      key: "draft_town",
      name: "Bourg en projet",
      countryKey: "elarion",
      settlementType: "town",
      isCapital: false,
      visibility: "public",
      editorialStatus: "draft"
    }
  ];
  assert.deepEqual(listVisibleSettlements(entries, new Set()).map((entry) => entry.key), ["aureval"]);
  assert.deepEqual(
    listVisibleSettlements(entries, new Set(["umbrelune_hidden_01"])).map((entry) => entry.key),
    ["aureval", "secret_village"]
  );
});
