import type { ItemCode } from "./item-catalog.js";
import { createItemStack, InvalidItemStackError, type ItemContainer } from "./item-model.js";
import { validateItemInstanceState, type ItemInstanceState } from "./item-properties.js";

/**
 * Lot traçable d'objets identiques partageant exactement le même état connu.
 * Aucun regroupement automatique n'est effectué : les règles de gameplay
 * d'empilement restent à définir par le catalogue.
 */
export interface ItemLot {
  readonly lotId: string;
  readonly itemCode: ItemCode;
  readonly quantity: number;
  readonly container: ItemContainer;
  readonly state?: ItemInstanceState;
}

export class InvalidItemLotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidItemLotError";
  }
}

function validateContainer(container: ItemContainer): void {
  if (container.kind === "character_bag" &&
      (!container.containerId.trim() || !Number.isSafeInteger(container.slotNumber) || container.slotNumber <= 0)) {
    throw new InvalidItemLotError("Le contenant sac ou son emplacement est invalide.");
  }
  if (container.kind === "temporary_camp_storage" && !container.containerId.trim()) {
    throw new InvalidItemLotError("Le contenant de stockage du camp est invalide.");
  }
}

export function createItemLot(input: ItemLot): ItemLot {
  if (!input.lotId.trim()) throw new InvalidItemLotError("Un lot doit posséder un identifiant stable.");
  const stack = createItemStack(input.itemCode, input.quantity);
  validateContainer(input.container);
  if (input.state) {
    const issues = validateItemInstanceState(input.state);
    if (issues.length) throw new InvalidItemLotError("État du lot invalide : " + issues.join(" "));
  }
  return {
    lotId: input.lotId,
    itemCode: stack.itemCode,
    quantity: stack.quantity,
    container: input.container,
    ...(input.state ? { state: input.state } : {})
  };
}

/**
 * Sépare une quantité d'un lot en conservant l'état et la provenance.
 * L'identifiant du nouveau lot est fourni par l'appelant (UUID côté service).
 */
export function splitItemLot(
  lot: ItemLot,
  quantity: number,
  newLotId: string
): { remaining: ItemLot | null; separated: ItemLot } {
  const validLot = createItemLot(lot);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > validLot.quantity) {
    throw new InvalidItemLotError("La quantité à séparer doit être comprise dans le lot.");
  }
  if (!newLotId.trim() || newLotId === validLot.lotId) {
    throw new InvalidItemLotError("Le nouveau lot doit posséder un identifiant distinct.");
  }

  const separated = createItemLot({ ...validLot, lotId: newLotId, quantity });
  const remainingQuantity = validLot.quantity - quantity;
  return {
    remaining: remainingQuantity > 0
      ? createItemLot({ ...validLot, quantity: remainingQuantity })
      : null,
    separated
  };
}

/** Déplace un lot entier sans modifier son identité, son état ou sa provenance. */
export function moveItemLot(lot: ItemLot, destination: ItemContainer): ItemLot {
  validateContainer(destination);
  return createItemLot({ ...lot, container: destination });
}

/** Refuse toute tentative de fusion tant que les règles d'empilement ne sont pas décidées. */
export function mergeItemLots(): never {
  throw new InvalidItemLotError(
    "La fusion des lots nécessite une règle d'empilement explicitement définie pour cet objet."
  );
}
