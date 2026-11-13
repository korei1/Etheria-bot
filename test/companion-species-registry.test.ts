import assert from "node:assert/strict";
import testRunner from "node:test";
import {
  addCompanionSpecies,
  addEditorialCompanionSpecies,
  createCompanionSpeciesRegistry,
  createInitialFantasyBestiaryRegistry,
  listVisibleEditorialCompanionSpecies,
  getRegisteredCompanionSpecies,
  listPublicCompanionSpecies,
  transitionCompanionSpeciesAvailability,
  transitionCompanionSpeciesEditorialStatus,
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
  editorialStatus: RegisteredCompanionSpecies["editorialStatus"] = "draft",
  availabilityStatus: RegisteredCompanionSpecies["availabilityStatus"] = "unavailable",
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
    editorialStatus,
    availabilityStatus,
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

testRunner("la validation éditoriale est indépendante de la visibilité régionale", () => {
  const registry = createCompanionSpeciesRegistry(
    [region, secretRegion],
    [species("secret_species", "approved", "unavailable", "umbrelune")]
  );
  assert.equal(getRegisteredCompanionSpecies(registry, "secret_species")?.editorialStatus, "approved");
  assert.deepEqual(listPublicCompanionSpecies(registry, new Set()), []);
});

testRunner("une espèce approuvée d'Umbrelune reste cachée jusqu'à découverte", () => {
  let registry = createCompanionSpeciesRegistry(
    [region, secretRegion],
    [species("secret_species", "approved", "discoverable", "umbrelune")]
  );
  assert.deepEqual(listPublicCompanionSpecies(registry, new Set()), []);
  assert.equal(
    listPublicCompanionSpecies(registry, new Set(["umbrelune"])).length,
    1
  );
});

testRunner("une espèce non approuvée ne peut pas devenir disponible", () => {
  const registry = createCompanionSpeciesRegistry([region], [species("draft_species")]);
  assert.throws(
    () => transitionCompanionSpeciesAvailability(registry, "draft_species", "discoverable"),
    CompanionSpeciesRegistryError
  );
});

testRunner("les statuts éditorial et disponibilité suivent des transitions distinctes", () => {
  let registry = createCompanionSpeciesRegistry([region], [species("lifecycle_species")]);
  registry = transitionCompanionSpeciesEditorialStatus(registry, "lifecycle_species", "approved");
  assert.equal(getRegisteredCompanionSpecies(registry, "lifecycle_species")?.editorialStatus, "approved");
  assert.equal(getRegisteredCompanionSpecies(registry, "lifecycle_species")?.availabilityStatus, "unavailable");
  registry = transitionCompanionSpeciesAvailability(registry, "lifecycle_species", "discoverable");
  registry = transitionCompanionSpeciesAvailability(registry, "lifecycle_species", "available");
  assert.equal(getRegisteredCompanionSpecies(registry, "lifecycle_species")?.availabilityStatus, "available");
  assert.throws(
    () => transitionCompanionSpeciesAvailability(registry, "lifecycle_species", "unavailable"),
    CompanionSpeciesRegistryError
  );
});

testRunner("une espèce retirée reste enregistrée mais sort du catalogue d'acquisition", () => {
  let registry = createCompanionSpeciesRegistry(
    [region],
    [species("retired_species", "approved", "available")]
  );
  registry = transitionCompanionSpeciesAvailability(registry, "retired_species", "retired");
  assert.equal(getRegisteredCompanionSpecies(registry, "retired_species")?.availabilityStatus, "retired");
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

testRunner("les 43 fiches canoniques sont intégrées au registre extensible sans données gameplay inventées", () => {
  const registry = createInitialFantasyBestiaryRegistry();
  assert.equal(registry.editorialSpecies.size, 43);
  assert.equal(registry.species.size, 0);
  assert.equal(registry.regions.size, 7);
  for (const entry of registry.editorialSpecies.values()) {
    assert.equal(entry.editorialStatus, "approved");
    assert.equal(entry.forms.length, 4);
    assert.ok(entry.element);
  }
});

testRunner("le registre éditorial masque les six espèces d'Umbrelune avant découverte", () => {
  const registry = createInitialFantasyBestiaryRegistry();
  const visibleBeforeDiscovery = listVisibleEditorialCompanionSpecies(registry, new Set());
  assert.equal(visibleBeforeDiscovery.length, 37);
  assert.equal(visibleBeforeDiscovery.some((entry) => entry.regionKey === "umbrelune"), false);
  const visibleAfterDiscovery = listVisibleEditorialCompanionSpecies(
    registry,
    new Set(["umbrelune"])
  );
  assert.equal(visibleAfterDiscovery.length, 43);
});

testRunner("une fiche éditoriale peut être ajoutée sans rareté ni méthode d'acquisition", () => {
  const registry = createInitialFantasyBestiaryRegistry();
  const editorial = {
    key: "future_species",
    name: "Espèce future",
    regionKey: "sylvaria",
    element: "terre" as const,
    editorialStatus: "approved" as const,
    forms: [
      { key: "initial", name: "Forme initiale", order: 0 },
      { key: "adult", name: "Forme adulte", order: 1 }
    ]
  };
  const next = addEditorialCompanionSpecies(registry, editorial);
  assert.equal(next.editorialSpecies.size, 44);
});
