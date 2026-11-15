/**
 * Réseau de déplacement du monde Etheria.
 *
 * Les itinéraires décrivent des connexions entre lieux déjà enregistrés.
 * Ils ne définissent ni coordonnées, ni distances, ni durées, ni coûts :
 * ces données doivent être ajoutées uniquement après validation du monde.
 */

export type WorldTravelMode = "land" | "sea" | "air";
export type WorldTravelLinkType =
  | "trail"
  | "road"
  | "bridge"
  | "tunnel"
  | "ferry"
  | "sea_lane"
  | "air_route";
export type WorldTravelStatus = "draft" | "approved" | "retired";
export type WorldTravelVisibility = "public" | "discovery_locked";

export interface WorldTravelEndpoint {
  /** Identifiant stable d'une localité ou d'un point géographique. */
  key: string;
  kind: "settlement" | "geographic_feature";
}

export interface WorldTravelLinkDefinition {
  key: string;
  name: string;
  from: WorldTravelEndpoint;
  to: WorldTravelEndpoint;
  mode: WorldTravelMode;
  linkType: WorldTravelLinkType;
  bidirectional: boolean;
  visibility: WorldTravelVisibility;
  status: WorldTravelStatus;
  /** Conditions de passage explicites, sans règles implicites. */
  accessRequirements?: readonly string[];
  /** Durée ou distance uniquement si elles sont établies par des données validées. */
  distanceMeters?: number;
  estimatedDurationMinutes?: number;
  description?: string;
}

export interface WorldTravelValidationContext {
  settlementKeys: ReadonlySet<string>;
  geographicFeatureKeys: ReadonlySet<string>;
}

const linkTypesByMode: Readonly<Record<WorldTravelMode, ReadonlySet<WorldTravelLinkType>>> = {
  land: new Set(["trail", "road", "bridge", "tunnel"]),
  sea: new Set(["ferry", "sea_lane"]),
  air: new Set(["air_route"])
};

function validKey(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

function endpointExists(endpoint: WorldTravelEndpoint, context: WorldTravelValidationContext): boolean {
  return endpoint.kind === "settlement"
    ? context.settlementKeys.has(endpoint.key)
    : context.geographicFeatureKeys.has(endpoint.key);
}

export function validateWorldTravelLinks(
  links: readonly WorldTravelLinkDefinition[],
  context: WorldTravelValidationContext
): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();

  for (const link of links) {
    if (!validKey(link.key) || !link.name.trim()) {
      issues.push(`[${link.key}] Clé ou nom d'itinéraire invalide.`);
    }
    if (keys.has(link.key)) issues.push(`[itinéraires] Clé dupliquée : ${link.key}.`);
    keys.add(link.key);

    if (!endpointExists(link.from, context)) {
      issues.push(`[${link.key}] Origine inconnue : ${link.from.key}.`);
    }
    if (!endpointExists(link.to, context)) {
      issues.push(`[${link.key}] Destination inconnue : ${link.to.key}.`);
    }
    if (link.from.kind === link.to.kind && link.from.key === link.to.key) {
      issues.push(`[${link.key}] Un itinéraire doit relier deux points distincts.`);
    }
    if (!linkTypesByMode[link.mode]?.has(link.linkType)) {
      issues.push(`[${link.key}] Type de liaison incompatible avec le mode ${link.mode}.`);
    }
    if (link.distanceMeters !== undefined &&
        (!Number.isFinite(link.distanceMeters) || link.distanceMeters <= 0)) {
      issues.push(`[${link.key}] La distance doit être un nombre positif.`);
    }
    if (link.estimatedDurationMinutes !== undefined &&
        (!Number.isFinite(link.estimatedDurationMinutes) || link.estimatedDurationMinutes <= 0)) {
      issues.push(`[${link.key}] La durée estimée doit être un nombre positif.`);
    }
    if (link.accessRequirements?.some((requirement) => !requirement.trim())) {
      issues.push(`[${link.key}] Une condition d'accès ne peut pas être vide.`);
    }
  }

  return [...new Set(issues)];
}

export function listAvailableWorldTravelLinks(
  links: readonly WorldTravelLinkDefinition[],
  discoveredKeys: ReadonlySet<string>
): readonly WorldTravelLinkDefinition[] {
  return links.filter((link) =>
    link.status === "approved" &&
    (link.visibility === "public" || discoveredKeys.has(link.key))
  );
}

/** Renvoie les voisins accessibles depuis un point, en respectant le sens des liaisons. */
export function getWorldTravelNeighbors(
  links: readonly WorldTravelLinkDefinition[],
  endpoint: WorldTravelEndpoint,
  discoveredKeys: ReadonlySet<string> = new Set()
): WorldTravelEndpoint[] {
  const neighbors: WorldTravelEndpoint[] = [];
  for (const link of links) {
    if (link.status !== "approved") continue;
    if (link.visibility === "discovery_locked" && !discoveredKeys.has(link.key)) continue;
    if (link.from.kind === endpoint.kind && link.from.key === endpoint.key) {
      neighbors.push(link.to);
    } else if (link.bidirectional &&
      link.to.kind === endpoint.kind && link.to.key === endpoint.key) {
      neighbors.push(link.from);
    }
  }
  return neighbors;
}
