/**
 * Registre géographique indépendant des États et des gouvernements.
 *
 * Il ne contient que les continents canoniques et les contrats de validation.
 * Les lieux concrets ne sont ajoutés qu'après décision éditoriale.
 */

export type WorldVisibility = "public" | "discovery_locked";
export type WorldEditorialStatus = "draft" | "approved" | "retired";

export const WORLD_CONTINENTS = [
  { key: "sylvaria", name: "Sylvaria", visibility: "public" },
  { key: "niveria", name: "Nivéria", visibility: "public" },
  { key: "arcanthia", name: "Arcanthia", visibility: "public" },
  { key: "solmeria", name: "Solméria", visibility: "public" },
  { key: "thalassea", name: "Thalasséa", visibility: "public" },
  { key: "igneria", name: "Ignéria", visibility: "public" },
  { key: "umbrelune", name: "Umbrelune", visibility: "discovery_locked" }
] as const;

export type WorldContinentKey = (typeof WORLD_CONTINENTS)[number]["key"];

export type WorldGeographicFeatureType =
  | "landmass"
  | "island"
  | "archipelago"
  | "ocean"
  | "sea"
  | "gulf"
  | "strait"
  | "coast"
  | "mountain_range"
  | "mountain"
  | "volcano"
  | "forest"
  | "woodland"
  | "desert"
  | "plain"
  | "plateau"
  | "valley"
  | "river"
  | "lake"
  | "wetland"
  | "reef"
  | "biome"
  | "habitat";

export interface WorldGeographicFeatureDefinition {
  key: string;
  name: string;
  featureType: WorldGeographicFeatureType;
  continentKey?: WorldContinentKey;
  parentFeatureKey?: string;
  visibility: WorldVisibility;
  editorialStatus: WorldEditorialStatus;
  description?: string;
}

export interface WorldGeographyRegistry {
  readonly continents: ReadonlyMap<WorldContinentKey, (typeof WORLD_CONTINENTS)[number]>;
  readonly features: ReadonlyMap<string, WorldGeographicFeatureDefinition>;
}

export class WorldGeographyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldGeographyError";
  }
}

const featureTypes = new Set<WorldGeographicFeatureType>([
  "landmass", "island", "archipelago", "ocean", "sea", "gulf", "strait",
  "coast", "mountain_range", "mountain", "volcano", "forest", "woodland",
  "desert", "plain", "plateau", "valley", "river", "lake", "wetland",
  "reef", "biome", "habitat"
]);

export function validateWorldGeographicFeatures(
  entries: readonly WorldGeographicFeatureDefinition[],
  knownContinentKeys: ReadonlySet<string> = new Set(WORLD_CONTINENTS.map((entry) => entry.key))
): string[] {
  const issues: string[] = [];
  const byKey = new Map<string, WorldGeographicFeatureDefinition>();

  for (const entry of entries) {
    if (!/^[a-z][a-z0-9_]*$/.test(entry.key) || !entry.name.trim()) {
      issues.push(`[géographie] Identifiant ou nom invalide : ${entry.key}.`);
    }
    if (!featureTypes.has(entry.featureType)) {
      issues.push(`[${entry.key}] Type géographique inconnu.`);
    }
    if (entry.continentKey && !knownContinentKeys.has(entry.continentKey)) {
      issues.push(`[${entry.key}] Continent inconnu : ${entry.continentKey}.`);
    }
    if (byKey.has(entry.key)) {
      issues.push(`[géographie] Clé dupliquée : ${entry.key}.`);
    } else {
      byKey.set(entry.key, entry);
    }
  }

  for (const entry of entries) {
    if (!entry.parentFeatureKey) continue;
    if (entry.parentFeatureKey === entry.key) {
      issues.push(`[${entry.key}] Une caractéristique ne peut pas être son propre parent.`);
    } else if (!byKey.has(entry.parentFeatureKey)) {
      issues.push(`[${entry.key}] Caractéristique parente inconnue : ${entry.parentFeatureKey}.`);
    }
  }

  // Détecte les cycles dans la hiérarchie, y compris les cycles de plusieurs nœuds.
  for (const entry of entries) {
    const visited = new Set<string>();
    let cursor: WorldGeographicFeatureDefinition | undefined = entry;
    while (cursor?.parentFeatureKey) {
      if (visited.has(cursor.key)) {
        issues.push(`[${entry.key}] Cycle détecté dans la hiérarchie géographique.`);
        break;
      }
      visited.add(cursor.key);
      cursor = byKey.get(cursor.parentFeatureKey);
      if (!cursor) break;
      if (visited.has(cursor.key)) {
        issues.push(`[${entry.key}] Cycle détecté dans la hiérarchie géographique.`);
        break;
      }
    }
  }

  return [...new Set(issues)];
}

export function createWorldGeographyRegistry(
  entries: readonly WorldGeographicFeatureDefinition[] = []
): WorldGeographyRegistry {
  const issues = validateWorldGeographicFeatures(entries);
  if (issues.length > 0) throw new WorldGeographyError(issues.join("\n"));

  return {
    continents: new Map(WORLD_CONTINENTS.map((entry) => [entry.key, entry])),
    features: new Map(entries.map((entry) => [entry.key, entry]))
  };
}

/** Filtre les caractéristiques secrètes côté serveur avant toute exposition publique. */
export function listVisibleWorldGeographicFeatures(
  registry: WorldGeographyRegistry,
  discoveredContinentKeys: ReadonlySet<string>
): readonly WorldGeographicFeatureDefinition[] {
  return [...registry.features.values()].filter((entry) => {
    if (entry.editorialStatus !== "approved") return false;
    if (entry.visibility === "discovery_locked") {
      return Boolean(entry.continentKey && discoveredContinentKeys.has(entry.continentKey));
    }
    if (entry.continentKey === "umbrelune" && !discoveredContinentKeys.has("umbrelune")) {
      return false;
    }
    return true;
  });
}
