import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidIndividualTraits,
  createCompanionSpeciesCatalog,
  getCompanionSpecies,
  getCompanionRegionalRarity,
  resolveInheritedNaturalVariant,
  validateCompanionSpeciesDefinition,
  validateIndividualTraits,
  CompanionSpeciesCatalogError,
  type CompanionSpeciesDefinition
} from "../src/modules/companions/companion-species-catalog.js";

const woodlandSpecies: CompanionSpeciesDefinition = {
  key: "woodland_companion",
  name: "Espèce forestière de test",
  origin: "real_world",
  category: "terrestrial",
  rarity: "commun",
  acquisitionMethods: ["wild_encounter", "adoption"],
  discordShopElementChoice: false,
  fixedElement: "terre",
  regionalOccurrences: [
    { regionKey: "north", habitatKey: "forest", rarity: "rare" },
    { regionKey: "south", habitatKey: "forest", rarity: "commun" }
  ],
  naturalVariants: [
    { key: "silver_coat", name: "Pelage argenté", type: "chromatic" },
    { key: "long_fur", name: "Fourrure longue", type: "climatic" },
    { key: "silver_long", name: "Pelage argenté long", type: "genetic" }
  ],
  variantInheritanceRules: [
    {
      firstParentVariantKey: "silver_coat",
      secondParentVariantKey: "long_fur",
      resultingVariantKey: "silver_long"
    }
  ],
  individualTraits: [
    { key: "coat_pattern", label: "Motif du pelage", type: "choice", values: ["uni", "tachete"] },
    { key: "temperament_note", label: "Tempérament", type: "text" },
    { key: "is_nocturnal", label: "Nocturne", type: "boolean" }
  ]
};

test("une espèce hors boutique doit imposer un élément valide", () => {
  assert.deepEqual(validateCompanionSpeciesDefinition(woodlandSpecies), []);
  assert.ok(validateCompanionSpeciesDefinition({
    ...woodlandSpecies,
    fixedElement: undefined
  }).some((issue) => issue.includes("élément fixe")));
});

test("une espèce de boutique autorise le choix d'élément sans élément fixe", () => {
  const shopSpecies: CompanionSpeciesDefinition = {
    ...woodlandSpecies,
    key: "shop_companion",
    acquisitionMethods: ["discord_shop"],
    discordShopElementChoice: true,
    fixedElement: undefined
  };
  assert.deepEqual(validateCompanionSpeciesDefinition(shopSpecies), []);
  assert.ok(validateCompanionSpeciesDefinition({
    ...shopSpecies,
    fixedElement: "feu"
  }).some((issue) => issue.includes("élément fixe")));
});

test("le catalogue refuse les clés dupliquées et les définitions invalides", () => {
  const catalog = createCompanionSpeciesCatalog([woodlandSpecies]);
  assert.equal(getCompanionSpecies(catalog, woodlandSpecies.key)?.name, woodlandSpecies.name);
  assert.equal(getCompanionSpecies(catalog, "missing_species"), undefined);
  assert.throws(
    () => createCompanionSpeciesCatalog([woodlandSpecies, woodlandSpecies]),
    CompanionSpeciesCatalogError
  );
  assert.throws(
    () => createCompanionSpeciesCatalog([{ ...woodlandSpecies, rarity: "unknown" as never }]),
    CompanionSpeciesCatalogError
  );
});

test("les caractéristiques individuelles doivent correspondre au modèle de l'espèce", () => {
  assert.deepEqual(validateIndividualTraits(woodlandSpecies, {
    coat_pattern: "tachete",
    temperament_note: "Curieux",
    is_nocturnal: false
  }), []);
  assertValidIndividualTraits(woodlandSpecies, { coat_pattern: "uni" });
});

test("les caractéristiques inconnues et les valeurs de mauvais type sont refusées", () => {
  assert.ok(validateIndividualTraits(woodlandSpecies, {
    coat_pattern: "rayures",
    temperament_note: 12,
    is_nocturnal: "oui",
    invented_power: true
  }).length >= 4);
  assert.throws(
    () => assertValidIndividualTraits(woodlandSpecies, { coat_pattern: "rayures" }),
    CompanionSpeciesCatalogError
  );
});


test("la rareté régionale dépend de la région et de l'habitat", () => {
  assert.equal(getCompanionRegionalRarity(woodlandSpecies, "north", "forest"), "rare");
  assert.equal(getCompanionRegionalRarity(woodlandSpecies, "south", "forest"), "commun");
  assert.equal(getCompanionRegionalRarity(woodlandSpecies, "north", "mountain"), "commun");
});

test("les variantes naturelles et leur transmission suivent les règles propres à l'espèce", () => {
  assert.equal(
    resolveInheritedNaturalVariant(woodlandSpecies, "silver_coat", "long_fur"),
    "silver_long"
  );
  assert.equal(
    resolveInheritedNaturalVariant(woodlandSpecies, "long_fur", "silver_coat"),
    "silver_long"
  );
  assert.equal(
    resolveInheritedNaturalVariant(woodlandSpecies, "silver_coat", "silver_coat"),
    undefined
  );
});

test("le catalogue refuse les règles héréditaires qui référencent une variante inconnue", () => {
  assert.ok(validateCompanionSpeciesDefinition({
    ...woodlandSpecies,
    variantInheritanceRules: [{
      firstParentVariantKey: "unknown",
      secondParentVariantKey: "long_fur",
      resultingVariantKey: "silver_long"
    }]
  }).some((issue) => issue.includes("variante inconnue")));
});


test("une évaluation réelle de conservation doit être sourcée et datée", () => {
  const sourced = {
    ...woodlandSpecies,
    realWorldConservation: {
      system: "iucn_red_list" as const,
      category: "least_concern" as const,
      authority: "Autorité de test",
      sourceName: "Évaluation de test",
      sourceUrl: "https://example.org/species",
      assessedAt: "2026-01-15"
    }
  };
  assert.deepEqual(validateCompanionSpeciesDefinition(sourced), []);
  assert.ok(validateCompanionSpeciesDefinition({
    ...sourced,
    realWorldConservation: {
      ...sourced.realWorldConservation,
      sourceUrl: "http://example.org/species"
    }
  }).some((issue) => issue.includes("source")));
});

test("une espèce fantastique ne reçoit pas une évaluation IUCN réelle", () => {
  assert.ok(validateCompanionSpeciesDefinition({
    ...woodlandSpecies,
    origin: "fantasy",
    realWorldConservation: {
      system: "iucn_red_list",
      category: "least_concern",
      authority: "Autorité",
      sourceName: "Source",
      sourceUrl: "https://example.org",
      assessedAt: "2026-01-15"
    }
  }).some((issue) => issue.includes("espèce purement fantastique")));
});

test("les statuts de conservation Etheria sont contrôlés séparément", () => {
  assert.deepEqual(validateCompanionSpeciesDefinition({
    ...woodlandSpecies,
    etheriaConservation: { status: "protected", regionKey: "north" }
  }), []);
  assert.ok(validateCompanionSpeciesDefinition({
    ...woodlandSpecies,
    etheriaConservation: { status: "unknown_status" as never }
  }).some((issue) => issue.includes("Statut de conservation Etheria")));
});


test("les dossiers documentaires réels sont sourcés et restent non jouables", async () => {
  const {
    COMPANION_SPECIES_RESEARCH_DOSSIERS,
    validateSpeciesResearchDossiers
  } = await import("../src/modules/companions/companion-species-research.js");

  assert.equal(COMPANION_SPECIES_RESEARCH_DOSSIERS.length, 4);
  assert.deepEqual(validateSpeciesResearchDossiers(), []);
  assert.ok(COMPANION_SPECIES_RESEARCH_DOSSIERS.every(
    (dossier) => dossier.gameplayStatus === "research_only"
  ));
  assert.ok(COMPANION_SPECIES_RESEARCH_DOSSIERS.every(
    (dossier) => dossier.assessment.scope === "global"
  ));
});

test("les dossiers refusent les sources non HTTPS et les identifiants dupliqués", async () => {
  const {
    COMPANION_SPECIES_RESEARCH_DOSSIERS,
    validateSpeciesResearchDossiers
  } = await import("../src/modules/companions/companion-species-research.js");

  const first = COMPANION_SPECIES_RESEARCH_DOSSIERS[0]!;
  assert.ok(validateSpeciesResearchDossiers([
    first,
    { ...first, key: "duplicate_key", assessment: { ...first.assessment, sourceUrl: "http://invalid.test" } }
  ]).some((issue) => issue.includes("Clé de dossier dupliquée")));
  assert.ok(validateSpeciesResearchDossiers([
    { ...first, assessment: { ...first.assessment, sourceUrl: "http://invalid.test" } }
  ]).some((issue) => issue.includes("Source IUCN HTTPS")));
});
