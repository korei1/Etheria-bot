import { getItemDefinition, type ItemCode, type ItemDefinition } from "./item-catalog.js";

/**
 * Quantité agrégée d'un même code d'objet dans un contenant.
 * Ce contrat reflète le stockage actuel par code + quantité ; il ne crée
 * pas d'identifiant individuel pour chaque unité.
 */
export interface ItemStack {
  readonly itemCode: ItemCode;
  readonly quantity: number;
}

/** Contenants déjà présents dans les systèmes Etheria. */
export type ItemContainer =
  | { readonly kind: "character_bag"; readonly containerId: string; readonly slotNumber: number }
  | { readonly kind: "temporary_camp_storage"; readonly containerId: string };

/** Vue commune d'un stock et de sa définition catalogue. */
export interface ItemStackView {
  readonly definition: ItemDefinition;
  readonly stack: ItemStack;
  readonly container: ItemContainer;
}

export class InvalidItemStackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidItemStackError";
  }
}

/**
 * Construit un stock vérifié. Les limites correspondent au type PostgreSQL
 * INTEGER actuellement utilisé par les quantités, sans ajouter de règle
 * de taille maximale de pile propre au gameplay.
 */
export function createItemStack(itemCode: string, quantity: number): ItemStack {
  const definition = getItemDefinition(itemCode);
  if (!definition) {
    throw new InvalidItemStackError("Cet objet ne figure pas dans le catalogue Etheria.");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2_147_483_647) {
    throw new InvalidItemStackError("La quantité doit être un entier positif pris en charge.");
  }
  return { itemCode: definition.code as ItemCode, quantity };
}

export function createItemStackView(
  itemCode: string,
  quantity: number,
  container: ItemContainer
): ItemStackView {
  const stack = createItemStack(itemCode, quantity);
  const definition = getItemDefinition(stack.itemCode);
  if (!definition) {
    throw new InvalidItemStackError("La définition de cet objet est introuvable.");
  }
  if (container.kind === "character_bag" &&
      (!container.containerId.trim() || !Number.isSafeInteger(container.slotNumber) || container.slotNumber <= 0)) {
    throw new InvalidItemStackError("L'emplacement du sac est invalide.");
  }
  if (container.kind === "temporary_camp_storage" && !container.containerId.trim()) {
    throw new InvalidItemStackError("Le contenant de stockage est invalide.");
  }
  return { definition, stack, container };
}

export function getItemDisplayName(itemCode: string): string {
  return getItemDefinition(itemCode)?.label ?? itemCode;
}
