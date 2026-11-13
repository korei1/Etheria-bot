/**
 * Modèle des territoires administratifs et des lieux habités.
 * Les données concrètes sont alimentées uniquement après validation éditoriale.
 */

export type TerritoryEditorialStatus = "draft" | "approved" | "retired";
export type TerritoryVisibility = "public" | "discovery_locked";

export type AdministrativeAreaType =
  | "region"
  | "province"
  | "department"
  | "district"
  | "county"
  | "municipality"
  | "territory";

export type SettlementType =
  | "capital"
  | "city"
  | "town"
  | "village"
  | "hamlet"
  | "isolated_site";

export interface AdministrativeAreaDefinition {
  key: string;
  name: string;
  countryKey: string;
  areaType: AdministrativeAreaType;
  parentAreaKey?: string;
  visibility: TerritoryVisibility;
  editorialStatus: TerritoryEditorialStatus;
  description?: string;
}

export interface SettlementDefinition {
  key: string;
  name: string;
  countryKey: string;
  settlementType: SettlementType;
  administrativeAreaKey?: string;
  parentSettlementKey?: string;
  isCapital: boolean;
  visibility: TerritoryVisibility;
  editorialStatus: TerritoryEditorialStatus;
  description?: string;
}

export interface TerritoryValidationContext {
  countryKeys: ReadonlySet<string>;
  secretCountryKeys?: ReadonlySet<string>;
}

const areaTypes = new Set<AdministrativeAreaType>([
  "region", "province", "department", "district", "county", "municipality", "territory"
]);
const settlementTypes = new Set<SettlementType>([
  "capital", "city", "town", "village", "hamlet", "isolated_site"
]);

function validKey(key: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(key);
}

function hasCycle<T extends { key: string; parentAreaKey?: string; parentSettlementKey?: string }>(
  entries: readonly T[],
  parentField: "parentAreaKey" | "parentSettlementKey"
): boolean {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  for (const entry of entries) {
    const visited = new Set<string>([entry.key]);
    let parentKey = entry[parentField];
    while (parentKey) {
      if (visited.has(parentKey)) return true;
      visited.add(parentKey);
      parentKey = byKey.get(parentKey)?.[parentField];
    }
  }
  return false;
}

export function validateAdministrativeAreas(
  entries: readonly AdministrativeAreaDefinition[],
  context: TerritoryValidationContext
): string[] {
  const issues: string[] = [];
  const byKey = new Map<string, AdministrativeAreaDefinition>();
  for (const entry of entries) {
    if (!validKey(entry.key) || !entry.name.trim()) issues.push(`[${entry.key}] Clé ou nom invalide.`);
    if (!context.countryKeys.has(entry.countryKey)) issues.push(`[${entry.key}] Pays inconnu : ${entry.countryKey}.`);
    if (!areaTypes.has(entry.areaType)) issues.push(`[${entry.key}] Type de territoire inconnu.`);
    if (byKey.has(entry.key)) issues.push(`[territoires] Clé dupliquée : ${entry.key}.`);
    byKey.set(entry.key, entry);
  }
  for (const entry of entries) {
    if (!entry.parentAreaKey) continue;
    const parent = byKey.get(entry.parentAreaKey);
    if (!parent) issues.push(`[${entry.key}] Territoire parent absent : ${entry.parentAreaKey}.`);
    else if (parent.countryKey !== entry.countryKey) issues.push(`[${entry.key}] Le parent doit appartenir au même pays.`);
    if (entry.parentAreaKey === entry.key) issues.push(`[${entry.key}] Un territoire ne peut pas être son propre parent.`);
  }
  if (hasCycle(entries, "parentAreaKey")) issues.push("[territoires] Cycle détecté dans la hiérarchie administrative.");
  return [...new Set(issues)];
}

export function validateSettlements(
  entries: readonly SettlementDefinition[],
  areas: readonly AdministrativeAreaDefinition[],
  context: TerritoryValidationContext
): string[] {
  const issues: string[] = [];
  const byKey = new Map<string, SettlementDefinition>();
  const areaByKey = new Map(areas.map((area) => [area.key, area]));
  const capitalsByCountry = new Set<string>();

  for (const entry of entries) {
    if (!validKey(entry.key) || !entry.name.trim()) issues.push(`[${entry.key}] Clé ou nom invalide.`);
    if (!context.countryKeys.has(entry.countryKey)) issues.push(`[${entry.key}] Pays inconnu : ${entry.countryKey}.`);
    if (!settlementTypes.has(entry.settlementType)) issues.push(`[${entry.key}] Type de localité inconnu.`);
    if (byKey.has(entry.key)) issues.push(`[localités] Clé dupliquée : ${entry.key}.`);
    byKey.set(entry.key, entry);

    if (entry.isCapital) {
      if (capitalsByCountry.has(entry.countryKey)) issues.push(`[${entry.countryKey}] Plusieurs capitales déclarées.`);
      capitalsByCountry.add(entry.countryKey);
      if (entry.settlementType !== "capital") issues.push(`[${entry.key}] Une capitale doit avoir le type capital.`);
    } else if (entry.settlementType === "capital") {
      issues.push(`[${entry.key}] Une localité de type capital doit être marquée comme capitale.`);
    }

    if (context.secretCountryKeys?.has(entry.countryKey) && entry.visibility === "public") {
      issues.push(`[${entry.key}] Une localité d'un pays secret ne peut pas être publique.`);
    }
    if (entry.administrativeAreaKey) {
      const area = areaByKey.get(entry.administrativeAreaKey);
      if (!area) issues.push(`[${entry.key}] Territoire administratif absent : ${entry.administrativeAreaKey}.`);
      else if (area.countryKey !== entry.countryKey) issues.push(`[${entry.key}] Le territoire administratif doit appartenir au même pays.`);
    }
  }

  for (const entry of entries) {
    if (!entry.parentSettlementKey) continue;
    const parent = byKey.get(entry.parentSettlementKey);
    if (!parent) issues.push(`[${entry.key}] Localité parente absente : ${entry.parentSettlementKey}.`);
    else if (parent.countryKey !== entry.countryKey) issues.push(`[${entry.key}] La localité parente doit appartenir au même pays.`);
  }
  if (hasCycle(entries, "parentSettlementKey")) issues.push("[localités] Cycle détecté dans la hiérarchie des localités.");
  return [...new Set(issues)];
}

export function listVisibleSettlements(
  entries: readonly SettlementDefinition[],
  discoveredCountryKeys: ReadonlySet<string>
): readonly SettlementDefinition[] {
  return entries.filter((entry) =>
    entry.editorialStatus === "approved" &&
    (entry.visibility === "public" || discoveredCountryKeys.has(entry.countryKey))
  );
}
