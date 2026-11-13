/**
 * Découverte progressive et cartographie personnelle d'Etheria.
 *
 * Ce module est volontairement indépendant de Discord et de la base SQL.
 * Il définit les invariants métier ; la persistance sera branchée séparément.
 */

export type DiscoveryTargetKind =
  | "continent"
  | "country"
  | "administrative_area"
  | "settlement"
  | "spawn_zone"
  | "geographic_feature"
  | "travel_link";

export type DiscoveryMethod =
  | "first_encounter"
  | "exploration"
  | "quest"
  | "event"
  | "map_fragment"
  | "administrative_grant";

export interface DiscoveryTargetDefinition {
  key: string;
  kind: DiscoveryTargetKind;
  editorialStatus: "draft" | "approved" | "retired";
  visibility: "public" | "discovery_locked";
  /** Clés des prérequis devant déjà être découverts. */
  prerequisiteKeys?: readonly string[];
}

export interface DiscoveryRecord {
  accountId: string;
  targetKey: string;
  targetKind: DiscoveryTargetKind;
  method: DiscoveryMethod;
  discoveredAt: string;
  eventId: string;
}

export interface DiscoveryState {
  readonly records: readonly DiscoveryRecord[];
  readonly eventIds: ReadonlySet<string>;
}

export interface RecordDiscoveryInput {
  accountId: string;
  target: DiscoveryTargetDefinition;
  method: DiscoveryMethod;
  discoveredAt: string;
  eventId: string;
}

export type DiscoveryResult =
  | { status: "discovered"; state: DiscoveryState; record: DiscoveryRecord }
  | { status: "already_discovered"; state: DiscoveryState; record: DiscoveryRecord }
  | { status: "duplicate_event"; state: DiscoveryState }
  | { status: "rejected"; state: DiscoveryState; reason: string };

export function createDiscoveryState(
  records: readonly DiscoveryRecord[] = [],
  eventIds: ReadonlySet<string> = new Set()
): DiscoveryState {
  return { records: [...records], eventIds: new Set(eventIds) };
}

export function isTargetDiscovered(
  state: DiscoveryState,
  targetKey: string
): boolean {
  return state.records.some((record) => record.targetKey === targetKey);
}

/** Une découverte est permanente : les changements éditoriaux ne l'effacent pas. */
export function recordWorldDiscovery(
  state: DiscoveryState,
  input: RecordDiscoveryInput
): DiscoveryResult {
  if (!input.accountId.trim()) {
    return { status: "rejected", state, reason: "Compte joueur absent." };
  }
  if (!input.eventId.trim()) {
    return { status: "rejected", state, reason: "Identifiant d'événement absent." };
  }
  if (!Number.isFinite(Date.parse(input.discoveredAt))) {
    return { status: "rejected", state, reason: "Date de découverte invalide." };
  }
  if (state.eventIds.has(input.eventId)) {
    return { status: "duplicate_event", state };
  }

  const existing = state.records.find((record) =>
    record.accountId === input.accountId && record.targetKey === input.target.key
  );
  if (existing) {
    const next = createDiscoveryState(state.records, new Set([...state.eventIds, input.eventId]));
    return { status: "already_discovered", state: next, record: existing };
  }

  if (input.target.editorialStatus !== "approved") {
    return { status: "rejected", state, reason: "Cette découverte n'est pas approuvée." };
  }
  if (input.target.prerequisiteKeys?.some((key) => !isTargetDiscoveredForAccount(
    state, input.accountId, key
  ))) {
    return { status: "rejected", state, reason: "Les prérequis de découverte ne sont pas remplis." };
  }
  if (input.target.visibility === "discovery_locked" &&
      input.method !== "exploration" &&
      input.method !== "first_encounter" &&
      input.method !== "quest" &&
      input.method !== "event" &&
      input.method !== "map_fragment" &&
      input.method !== "administrative_grant") {
    return { status: "rejected", state, reason: "Méthode de découverte non autorisée." };
  }

  const record: DiscoveryRecord = {
    accountId: input.accountId,
    targetKey: input.target.key,
    targetKind: input.target.kind,
    method: input.method,
    discoveredAt: input.discoveredAt,
    eventId: input.eventId
  };
  const next = createDiscoveryState(
    [...state.records, record],
    new Set([...state.eventIds, input.eventId])
  );
  return { status: "discovered", state: next, record };
}

export function isTargetDiscoveredForAccount(
  state: DiscoveryState,
  accountId: string,
  targetKey: string
): boolean {
  return state.records.some((record) =>
    record.accountId === accountId && record.targetKey === targetKey
  );
}

/** Retourne les clés découvertes d'un joueur pour alimenter les filtres de visibilité. */
export function getDiscoveredTargetKeys(
  state: DiscoveryState,
  accountId: string,
  kind?: DiscoveryTargetKind
): ReadonlySet<string> {
  return new Set(state.records
    .filter((record) => record.accountId === accountId && (!kind || record.targetKind === kind))
    .map((record) => record.targetKey));
}

/** Progression personnelle : les lieux visités restent acquis même après retrait éditorial. */
export function getPersonalMapProgress(
  state: DiscoveryState,
  accountId: string
): { discoveredCount: number; byKind: Readonly<Record<DiscoveryTargetKind, number>> } {
  const records = state.records.filter((record) => record.accountId === accountId);
  const kinds: DiscoveryTargetKind[] = [
    "continent", "country", "administrative_area", "settlement", "spawn_zone",
    "geographic_feature", "travel_link"
  ];
  const byKind = Object.fromEntries(kinds.map((kind) => [
    kind,
    records.filter((record) => record.targetKind === kind).length
  ])) as Record<DiscoveryTargetKind, number>;
  return { discoveredCount: records.length, byKind };
}
