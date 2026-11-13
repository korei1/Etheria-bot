/**
 * Registre évolutif des espèces et des régions d'Etheria.
 *
 * Le registre est piloté par les données : aucune limite globale d'espèces,
 * de régions ou de formes évolutives n'est codée ici. Les clés sont des
 * identifiants permanents et ne doivent jamais être recyclées.
 */
import {
  validateCompanionSpeciesDefinition,
  type CompanionSpeciesDefinition
} from "./companion-species-catalog.js";

export type CompanionRegionVisibility = "public" | "discovery_locked";

export interface CompanionRegionDefinition {
  /** Clé stable et permanente de la région. */
  key: string;
  name: string;
  visibility: CompanionRegionVisibility;
}

export type CompanionSpeciesLifecycleStatus =
  | "draft"
  | "approved"
  | "discovery_locked"
  | "discoverable"
  | "available"
  | "retired";

export interface CompanionEvolutionForm {
  /** Clé stable de la forme au sein de l'espèce. */
  key: string;
  name: string;
  /** Rang d'affichage et de progression, sans plafond imposé. */
  order: number;
}

export interface RegisteredCompanionSpecies {
  definition: CompanionSpeciesDefinition;
  regionKey: string;
  status: CompanionSpeciesLifecycleStatus;
  evolutionForms: readonly CompanionEvolutionForm[];
}

export interface CompanionSpeciesRegistry {
  readonly regions: ReadonlyMap<string, CompanionRegionDefinition>;
  readonly species: ReadonlyMap<string, RegisteredCompanionSpecies>;
}

export class CompanionSpeciesRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionSpeciesRegistryError";
  }
}

const allowedTransitions: Readonly<Record<
  CompanionSpeciesLifecycleStatus,
  readonly CompanionSpeciesLifecycleStatus[]
>> = {
  draft: ["approved"],
  approved: ["discovery_locked", "discoverable"],
  discovery_locked: ["discoverable"],
  discoverable: ["available"],
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
  if (!Object.hasOwn(allowedTransitions, entry.status)) {
    issues.push(`[${key}] Statut de cycle de vie inconnu.`);
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
  return { regions: regionMap, species: speciesMap };
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

/** Les transitions sont explicites ; une espèce retirée n'est pas réactivée. */
export function transitionCompanionSpeciesStatus(
  registry: CompanionSpeciesRegistry,
  speciesKey: string,
  nextStatus: CompanionSpeciesLifecycleStatus
): CompanionSpeciesRegistry {
  const current = registry.species.get(speciesKey);
  if (!current) {
    throw new CompanionSpeciesRegistryError(`Espèce inconnue : ${speciesKey}.`);
  }
  if (!allowedTransitions[current.status].includes(nextStatus)) {
    throw new CompanionSpeciesRegistryError(
      `Transition de statut interdite : ${current.status} → ${nextStatus} pour ${speciesKey}.`
    );
  }
  const species = new Map(registry.species);
  species.set(speciesKey, { ...current, status: nextStatus });
  return { regions: registry.regions, species };
}

/**
 * Le catalogue public ne révèle jamais une région secrète non découverte.
 * Une espèce retirée reste dans le registre pour préserver les références
 * des compagnons déjà possédés, mais n'est plus proposée à l'acquisition.
 */
export function listPublicCompanionSpecies(
  registry: CompanionSpeciesRegistry,
  discoveredRegionKeys: ReadonlySet<string>
): readonly RegisteredCompanionSpecies[] {
  return [...registry.species.values()].filter((entry) => {
    const region = registry.regions.get(entry.regionKey);
    if (!region) return false;
    const regionDiscovered =
      region.visibility === "public" || discoveredRegionKeys.has(region.key);
    const statusVisible =
      entry.status === "discoverable" ||
      entry.status === "available" ||
      (entry.status === "discovery_locked" && regionDiscovered);
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
