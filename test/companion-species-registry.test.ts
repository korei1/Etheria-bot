import assert from "node:assert/strict";
import testRunner from "node:test";
import {
  addCompanionSpecies,
  createCompanionSpeciesRegistry,
  getRegisteredCompanionSpecies,
  listPublicCompanionSpecies,
  transitionCompanionSpeciesStatus,
  CompanionSpeciesRegistryError,
  type RegisteredCompanionSpecies
} from "../src/modules/companions/companion-species-registry.js";

const region = { key: "sylvaria", name: "Sylvaria", visibility: "public" as const };
const secretRegion = {
  key: "umbrelune",
  name: "Umbrelune",
  visibility: "discovery_locked" as const
};

function species(
  key: string,
  status: RegisteredCompanionSpecies["status"] = "draft",
  regionKey = "sylvaria"
): RegisteredCompanionSpecies {
  return {
    definition: {
      key,
      name: `Espèce ${key}`,
      origin: "fantasy",
      category: "fantastic",
      rarity: "commun",
      acquisitionMethods: ["wild_encounter", "discovery"],
      discordShopElementChoice: false,
      fixedElement: "terre",
      individualTraits: []
    },
    regionKey,
    status,
    evolutionForms: [
      { key: "initial", name: "Forme initiale", order: 0 },
      { key: "young", name: "Forme jeune", order: 1 },
      { key: "adult", name: "Forme adulte", order: 2 },
      { key: "elemental_evolution", name: "Évolution élémentaire", order: 3 }
    ]
  };
}

testRunner("le registre accepte un nombre d'espèces supérieur au catalogue initial", () => {
  const registry = createCompanionSpeciesRegistry([region], []);
  let expanded = registry;
  for (let index = 0; index < 60; index += 1) {
    expanded = addCompanionSpecies(expanded, species(`species_${index}`));
  }
  assert.equal(expanded.species.size, 60);
  assert.equal(registry.species.size, 0);
});

testRunner("les clés d'espèce sont permanentes et ne peuvent pas être réutilisées", () => {
  const registry = createCompanionSpeciesRegistry([region], [species("first_species")]);
  assert.throws(
    () => addCompanionSpecies(registry, species("first_species")),
    CompanionSpeciesRegistryError
  );
});

testRunner("les régions secrètes ne révèlent aucune espèce avant leur découverte", () => {
  const registry = createCompanionSpeciesRegistry(
    [region, secretRegion],
    [species("secret_species", "discovery_locked", "umbrelune")]
  );
  assert.deepEqual(listPublicCompanionSpecies(registry, new Set()), []);
  assert.equal(
    listPublicCompanionSpecies(registry, new Set(["umbrelune"])).length,
    1
  );
});

testRunner("les statuts suivent un cycle explicite et refusent les transitions invalides", () => {
  let registry = createCompanionSpeciesRegistry([region], [species("lifecycle_species")]);
  registry = transitionCompanionSpeciesStatus(registry, "lifecycle_species", "approved");
  registry = transitionCompanionSpeciesStatus(registry, "lifecycle_species", "discoverable");
  registry = transitionCompanionSpeciesStatus(registry, "lifecycle_species", "available");
  assert.equal(getRegisteredCompanionSpecies(registry, "lifecycle_species")?.status, "available");
  assert.throws(
    () => transitionCompanionSpeciesStatus(registry, "lifecycle_species", "draft"),
    CompanionSpeciesRegistryError
  );
});

testRunner("une espèce retirée reste enregistrée mais sort du catalogue d'acquisition", () => {
  let registry = createCompanionSpeciesRegistry([region], [species("retired_species", "available")]);
  registry = transitionCompanionSpeciesStatus(registry, "retired_species", "retired");
  assert.equal(getRegisteredCompanionSpecies(registry, "retired_species")?.status, "retired");
  assert.deepEqual(listPublicCompanionSpecies(registry, new Set()), []);
});

testRunner("les formes évolutives sont extensibles sans imposer un nombre fixe de stades", () => {
  const extended = species("many_forms");
  extended.evolutionForms = [
    ...extended.evolutionForms,
    { key: "ascended", name: "Forme transcendée", order: 4 },
    { key: "ancient", name: "Forme ancestrale", order: 5 }
  ];
  const registry = createCompanionSpeciesRegistry([region], [extended]);
  assert.equal(registry.species.get("many_forms")?.evolutionForms.length, 6);
});
