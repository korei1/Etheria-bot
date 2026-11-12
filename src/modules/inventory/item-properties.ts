import type { ItemCode } from "./item-catalog.js";

/**
 * Contrats facultatifs pour les propriétés descriptives d'un type d'objet.
 * Les champs sont absents tant qu'une valeur n'a pas été décidée canoniquement.
 */
export interface ItemMeasurement {
  readonly value: number;
  readonly unit: string;
}

export interface ItemDimensions {
  readonly length: ItemMeasurement;
  readonly width: ItemMeasurement;
  readonly height: ItemMeasurement;
}

export interface ItemPhysicalProperties {
  readonly mass?: ItemMeasurement;
  readonly volume?: ItemMeasurement;
  readonly dimensions?: ItemDimensions;
}

export interface ItemDurabilityProperties {
  readonly current: number;
  readonly maximum: number;
}

export interface ItemEconomicProperties {
  readonly value: number;
  readonly currencyCode: string;
}

export interface ItemStackingProperties {
  readonly mode: "stackable" | "unique";
  readonly maximumQuantity?: number;
}

export interface ItemEquipmentProperties {
  readonly slotKey: string;
  readonly compatibleItemCodes?: readonly ItemCode[];
}

export interface ItemDefinitionProperties {
  readonly physical?: ItemPhysicalProperties;
  readonly durability?: ItemDurabilityProperties;
  readonly economic?: ItemEconomicProperties;
  readonly stacking?: ItemStackingProperties;
  readonly equipment?: ItemEquipmentProperties;
}

/** Origine d'une unité ou d'un lot, à renseigner par les événements métier. */
export type ItemOriginType =
  | "collection"
  | "crafting"
  | "discovery"
  | "purchase"
  | "trade"
  | "inheritance"
  | "gift";

export interface ItemProvenance {
  readonly originType: ItemOriginType;
  readonly sourceReference?: string;
  readonly occurredAt?: string;
}

/**
 * État propre à un objet détenu, distinct des propriétés communes de son type.
 * Ce contrat n'est pas encore persisté et ne modifie pas le stockage actuel.
 */
export interface ItemInstanceState {
  readonly conditionKey?: string;
  readonly qualityKey?: string;
  readonly durability?: ItemDurabilityProperties;
  readonly provenance?: ItemProvenance;
}

export function validateItemDefinitionProperties(
  properties: ItemDefinitionProperties
): string[] {
  const issues: string[] = [];
  const validateMeasurement = (measurement: ItemMeasurement, path: string): void => {
    if (!Number.isFinite(measurement.value) || measurement.value < 0) {
      issues.push(path + " doit être une valeur numérique positive ou nulle.");
    }
    if (!measurement.unit.trim()) issues.push(path + " doit préciser son unité.");
  };

  if (properties.physical?.mass) validateMeasurement(properties.physical.mass, "La masse");
  if (properties.physical?.volume) validateMeasurement(properties.physical.volume, "Le volume");
  if (properties.physical?.dimensions) {
    validateMeasurement(properties.physical.dimensions.length, "La longueur");
    validateMeasurement(properties.physical.dimensions.width, "La largeur");
    validateMeasurement(properties.physical.dimensions.height, "La hauteur");
  }
  if (properties.durability) {
    if (!Number.isFinite(properties.durability.current) ||
        !Number.isFinite(properties.durability.maximum) ||
        properties.durability.current < 0 ||
        properties.durability.maximum <= 0 ||
        properties.durability.current > properties.durability.maximum) {
      issues.push("La durabilité doit respecter 0 ≤ état actuel ≤ maximum positif.");
    }
  }
  if (properties.economic) {
    if (!Number.isFinite(properties.economic.value) || properties.economic.value < 0) {
      issues.push("La valeur économique doit être positive ou nulle.");
    }
    if (!properties.economic.currencyCode.trim()) {
      issues.push("La valeur économique doit préciser sa devise.");
    }
  }
  if (properties.stacking?.maximumQuantity !== undefined) {
    if (!Number.isSafeInteger(properties.stacking.maximumQuantity) ||
        properties.stacking.maximumQuantity <= 0) {
      issues.push("La quantité maximale d'une pile doit être un entier positif.");
    }
    if (properties.stacking.mode === "unique" && properties.stacking.maximumQuantity !== 1) {
      issues.push("Un objet unique ne peut pas avoir une pile maximale supérieure à un.");
    }
  }
  if (properties.equipment && !properties.equipment.slotKey.trim()) {
    issues.push("L'emplacement d'équipement doit posséder une clé.");
  }
  return issues;
}

export function validateItemInstanceState(state: ItemInstanceState): string[] {
  const issues: string[] = [];
  if (state.conditionKey !== undefined && !state.conditionKey.trim()) {
    issues.push("La clé d'état de l'objet ne peut pas être vide.");
  }
  if (state.qualityKey !== undefined && !state.qualityKey.trim()) {
    issues.push("La clé de qualité de l'objet ne peut pas être vide.");
  }
  if (state.durability) {
    const durabilityIssues = validateItemDefinitionProperties({ durability: state.durability });
    issues.push(...durabilityIssues);
  }
  if (state.provenance && !state.provenance.originType) {
    issues.push("L'origine de l'objet doit être précisée.");
  }
  if (state.provenance?.sourceReference !== undefined && !state.provenance.sourceReference.trim()) {
    issues.push("La référence de provenance ne peut pas être vide.");
  }
  return issues;
}
