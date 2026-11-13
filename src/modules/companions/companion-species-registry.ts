/**
 * Registre évolutif des espèces et des régions d'Etheria.
 *
 * Les trois axes sont indépendants :
 * - editorialStatus : validation éditoriale de la fiche ;
 * - availabilityStatus : état de disponibilité dans le jeu ;
 * - region.visibility + discoveredRegionKeys : confidentialité géographique.
 *
 * Aucune limite globale d'espèces, de régions ou de formes n'est codée ici.
 */
import {
  validateCompanionSpeciesDefinition,
  type CompanionSpeciesDefinition
} from "./companion-species-catalog.js";
import {
  INITIAL_FANTASY_BESTIARY,
  INITIAL_FANTASY_BESTIARY_REGIONS,
  type InitialFantasyBestiaryElement
} from "./initial-fantasy-bestiary.js";

export type CompanionRegionVisibility = "public" | "discovery_locked";

export interface CompanionRegionDefinition {
  key: string;
  name: string;
  visibility: CompanionRegionVisibility;
}

export type CompanionSpeciesEditorialStatus = "draft" | "approved";
export type CompanionSpeciesAvailabilityStatus =
  | "unavailable"
  | "discoverable"
  | "available"
  | "retired";

export interface CompanionEvolutionForm {
  key: string;
  name: string;
  order: number;
}

export interface RegisteredEditorialCompanionSpecies {
  key: string;
  name: string;
  regionKey: string;
  element: InitialFantasyBestiaryElement;
  editorialStatus: "approved";
  forms: readonly CompanionEvolutionForm[];
}

export interface RegisteredCompanionSpecies {
  definition: CompanionSpeciesDefinition;
  regionKey: string;
  editorialStatus: CompanionSpeciesEditorialStatus;
  availabilityStatus: CompanionSpeciesAvailabilityStatus;
  evolutionForms: readonly CompanionEvolutionForm[];
}

export interface CompanionSpeciesRegistry {
  readonly regions: ReadonlyMap<string, CompanionRegionDefinition>;
  /** Fiches éditoriales approuvées, même si leurs paramètres de gameplay sont incomplets. */
  readonly editorialSpecies: ReadonlyMap<string, RegisteredEditorialCompanionSpecies>;
  /** Espèces entièrement configurées pour les systèmes de gameplay. */
  readonly species: ReadonlyMap<string, RegisteredCompanionSpecies>;
}

export class CompanionSpeciesRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionSpeciesRegistryError";
  }
}

const editorialTransitions: Readonly<Record<
  CompanionSpeciesEditorialStatus,
  readonly CompanionSpeciesEditorialStatus[]
>> = {
  draft: ["approved"],
  approved: []
};

const availabilityTransitions: Readonly<Record<
  CompanionSpeciesAvailabilityStatus,
  readonly CompanionSpeciesAvailabilityStatus[]
>> = {
  unavailable: ["discoverable", "retired"],
  discoverable: ["available", "retired"],
  available: ["retired"],
  retired: []
};

export function validateRegisteredCompanionSpecies(
  entry: RegisteredCompanionSpecies,
  knownRegionKeys: ReadonlySet<string>
): string[] {
  const issues = validateCompanionSpeciesDefinition(entry.definition);
  const key = entry.definition.key;

  if (!knownRegionKeys.has(entry.regionKey)) {
    issues.push(`[${key}] Région inconnue : ${entry.regionKey}.`);
  }
  if (!Object.hasOwn(editorialTransitions, entry.editorialStatus)) {
    issues.push(`[${key}] Statut éditorial inconnu.`);
  }
  if (!Object.hasOwn(availabilityTransitions, entry.availabilityStatus)) {
    issues.push(`[${key}] Statut de disponibilité inconnu.`);
  }

  const formKeys = new Set<string>();
  const formOrders = new Set<number>();
  for (const form of entry.evolutionForms) {
    if (!/^[a-z][a-z0-9_]*$/.test(form.key) || !form.name.trim()) {
      issues.push(`[${key}] Forme évolutive invalide : ${form.key}.`);
    }
    if (!Number.isInteger(form.order) || form.order < 0) {
      issues.push(`[${key}] Rang évolutif invalide pour ${form.key}.`);
    }
    if (formKeys.has(form.key)) {
      issues.push(`[${key}] Clé de forme dupliquée : ${form.key}.`);
    }
    if (formOrders.has(form.order)) {
      issues.push(`[${key}] Rang évolutif dupliqué : ${form.order}.`);
    }
    formKeys.add(form.key);
    formOrders.add(form.order);
  }

  if (entry.editorialStatus !== "approved" && entry.availabilityStatus !== "unavailable") {
    issues.push(`[${key}] Une espèce non approuvée doit rester indisponible.`);
  }
  return issues;
}

export function createCompanionSpeciesRegistry(
  regions: readonly CompanionRegionDefinition[],
  entries: readonly RegisteredCompanionSpecies[]
): CompanionSpeciesRegistry {
  const issues: string[] = [];
  const regionMap = new Map<string, CompanionRegionDefinition>();
  const speciesMap = new Map<string, RegisteredCompanionSpecies>();

  for (const region of regions) {
    if (!/^[a-z][a-z0-9_]*$/.test(region.key) || !region.name.trim()) {
      issues.push(`[région] Définition invalide : ${region.key}.`);
    }
    if (regionMap.has(region.key)) {
      issues.push(`[région] Clé dupliquée : ${region.key}.`);
    } else {
      regionMap.set(region.key, region);
    }
  }

  const knownRegionKeys = new Set(regionMap.keys());
  for (const entry of entries) {
    issues.push(...validateRegisteredCompanionSpecies(entry, knownRegionKeys));
    const key = entry.definition.key;
    if (speciesMap.has(key)) {
      issues.push(`[registre] Clé d'espèce dupliquée : ${key}.`);
    } else {
      speciesMap.set(key, entry);
    }
  }

  if (issues.length > 0) {
    throw new CompanionSpeciesRegistryError(issues.join("\n"));
  }
  return { regions: regionMap, editorialSpecies: new Map(), species: speciesMap };
}

/**
 * Ajoute une fiche éditoriale sans inventer sa rareté, ses habitats ou ses
 * méthodes d'acquisition. Elle peut être complétée en définition gameplay
 * dans une étape ultérieure.
 */
export function addEditorialCompanionSpecies(
  registry: CompanionSpeciesRegistry,
  entry: RegisteredEditorialCompanionSpecies
): CompanionSpeciesRegistry {
  if (registry.editorialSpecies.has(entry.key) || registry.species.has(entry.key)) {
    throw new CompanionSpeciesRegistryError(
      `La clé d'espèce existe déjà et ne peut pas être réutilisée : ${entry.key}.`
    );
  }
  if (!/^[a-z][a-z0-9_]*$/.test(entry.key) || !entry.name.trim()) {
    throw new CompanionSpeciesRegistryError(`Fiche éditoriale invalide : ${entry.key}.`);
  }
  if (!registry.regions.has(entry.regionKey)) {
    throw new CompanionSpeciesRegistryError(`Région inconnue : ${entry.regionKey}.`);
  }
  if (entry.editorialStatus !== "approved") {
    throw new CompanionSpeciesRegistryError(`Le bestiaire canonique initial doit être approuvé : ${entry.key}.`);
  }
  if (entry.forms.length < 2) {
    throw new CompanionSpeciesRegistryError(`Une fiche doit contenir au moins deux formes : ${entry.key}.`);
  }
  const formKeys = new Set<string>();
  const formOrders = new Set<number>();
  for (const form of entry.forms) {
    if (!/^[a-z][a-z0-9_]*$/.test(form.key) || !form.name.trim() ||
      !Number.isInteger(form.order) || form.order < 0 ||
      formKeys.has(form.key) || formOrders.has(form.order)) {
      throw new CompanionSpeciesRegistryError(`Formes éditoriales invalides : ${entry.key}.`);
    }
    formKeys.add(form.key);
    formOrders.add(form.order);
  }
  const editorialSpecies = new Map(registry.editorialSpecies);
  editorialSpecies.set(entry.key, entry);
  return { regions: registry.regions, editorialSpecies, species: registry.species };
}

/** Construit le registre initial avec les 43 fiches canoniques approuvées. */
export function createInitialFantasyBestiaryRegistry(): CompanionSpeciesRegistry {
  const regions: CompanionRegionDefinition[] = INITIAL_FANTASY_BESTIARY_REGIONS.map(
    (region) => ({ key: region.key, name: region.name, visibility: region.visibility })
  );
  let registry = createCompanionSpeciesRegistry(regions, []);
  for (const entry of INITIAL_FANTASY_BESTIARY) {
    registry = addEditorialCompanionSpecies(registry, {
      key: entry.key,
      name: entry.name,
      regionKey: entry.regionKey,
      element: entry.element,
      editorialStatus: "approved",
      forms: [
        { key: "initial", name: entry.initialForm, order: 0 },
        { key: "young", name: entry.youngForm, order: 1 },
        { key: "adult", name: entry.adultForm, order: 2 },
        { key: "elemental_evolution", name: entry.elementalEvolution, order: 3 }
      ]
    });
  }
  return registry;
}

/** Encyclopédie éditoriale visible selon la découverte des régions, sans condition d'acquisition. */
export function listVisibleEditorialCompanionSpecies(
  registry: CompanionSpeciesRegistry,
  discoveredRegionKeys: ReadonlySet<string>
): readonly RegisteredEditorialCompanionSpecies[] {
  return [...registry.editorialSpecies.values()].filter((entry) => {
    const region = registry.regions.get(entry.regionKey);
    return entry.editorialStatus === "approved" && region !== undefined &&
      (region.visibility === "public" || discoveredRegionKeys.has(region.key));
  });
}

/** Ajoute une espèce sans plafond global et sans modifier les entrées existantes. */
export function addCompanionSpecies(
  registry: CompanionSpeciesRegistry,
  entry: RegisteredCompanionSpecies
): CompanionSpeciesRegistry {
  if (registry.species.has(entry.definition.key)) {
    throw new CompanionSpeciesRegistryError(
      `La clé d'espèce existe déjà et ne peut pas être réutilisée : ${entry.definition.key}.`
    );
  }
  const issues = validateRegisteredCompanionSpecies(
    entry,
    new Set(registry.regions.keys())
  );
  if (issues.length > 0) {
    throw new CompanionSpeciesRegistryError(issues.join("\n"));
  }
  const species = new Map(registry.species);
  species.set(entry.definition.key, entry);
  return { regions: registry.regions, species };
}

export function transitionCompanionSpeciesEditorialStatus(
  registry: CompanionSpeciesRegistry,
  speciesKey: string,
  nextStatus: CompanionSpeciesEditorialStatus
): CompanionSpeciesRegistry {
  const current = registry.species.get(speciesKey);
  if (!current) {
    throw new CompanionSpeciesRegistryError(`Espèce inconnue : ${speciesKey}.`);
  }
  if (!editorialTransitions[current.editorialStatus].includes(nextStatus)) {
    throw new CompanionSpeciesRegistryError(
      `Transition éditoriale interdite : ${current.editorialStatus} → ${nextStatus} pour ${speciesKey}.`
    );
  }
  const species = new Map(registry.species);
  species.set(speciesKey, {
    ...current,
    editorialStatus: nextStatus,
    availabilityStatus: nextStatus === "draft" ? "unavailable" : current.availabilityStatus
  });
  return { regions: registry.regions, species };
}

export function transitionCompanionSpeciesAvailability(
  registry: CompanionSpeciesRegistry,
  speciesKey: string,
  nextStatus: CompanionSpeciesAvailabilityStatus
): CompanionSpeciesRegistry {
  const current = registry.species.get(speciesKey);
  if (!current) {
    throw new CompanionSpeciesRegistryError(`Espèce inconnue : ${speciesKey}.`);
  }
  if (current.editorialStatus !== "approved") {
    throw new CompanionSpeciesRegistryError(
      `Une espèce doit être approuvée avant toute disponibilité : ${speciesKey}.`
    );
  }
  if (!availabilityTransitions[current.availabilityStatus].includes(nextStatus)) {
    throw new CompanionSpeciesRegistryError(
      `Transition de disponibilité interdite : ${current.availabilityStatus} → ${nextStatus} pour ${speciesKey}.`
    );
  }
  const species = new Map(registry.species);
  species.set(speciesKey, { ...current, availabilityStatus: nextStatus });
  return { regions: registry.regions, species };
}

/**
 * Une espèce n'est visible que si sa fiche est approuvée, sa région révélée
 * et sa disponibilité permet sa découverte ou son acquisition.
 */
export function listPublicCompanionSpecies(
  registry: CompanionSpeciesRegistry,
  discoveredRegionKeys: ReadonlySet<string>
): readonly RegisteredCompanionSpecies[] {
  return [...registry.species.values()].filter((entry) => {
    const region = registry.regions.get(entry.regionKey);
    if (!region || entry.editorialStatus !== "approved") return false;
    const regionDiscovered =
      region.visibility === "public" || discoveredRegionKeys.has(region.key);
    const statusVisible =
      entry.availabilityStatus === "discoverable" ||
      entry.availabilityStatus === "available";
    return regionDiscovered && statusVisible;
  });
}

/** Recherche interne incluant les espèces retirées pour les sauvegardes existantes. */
export function getRegisteredCompanionSpecies(
  registry: CompanionSpeciesRegistry,
  speciesKey: string
): RegisteredCompanionSpecies | undefined {
  return registry.species.get(speciesKey);
}
