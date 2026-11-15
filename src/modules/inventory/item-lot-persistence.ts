import type { PoolClient } from "pg";
import type { ItemOriginType } from "./item-properties.js";
import { createItemStack } from "./item-model.js";

export interface PersistedLotOrigin {
  originType: ItemOriginType;
  sourceReference?: string;
  occurredAt?: Date;
}

function validateLotInput(itemCode: string, quantity: number, ...references: string[]): void {
  createItemStack(itemCode, quantity);
  if (references.some((reference) => !reference.trim())) {
    throw new Error("Les références du lot doivent être renseignées.");
  }
}

/** Ajoute un lot distinct à une ligne agrégée de sac, dans la transaction appelante. */
export async function addInventoryItemLot(
  client: PoolClient,
  input: {
    inventorySlotId: string;
    itemCode: string;
    quantity: number;
    origin?: PersistedLotOrigin;
  }
): Promise<string> {
  validateLotInput(input.itemCode, input.quantity, input.inventorySlotId);
  if (input.origin?.sourceReference !== undefined && !input.origin.sourceReference.trim()) {
    throw new Error("La référence de provenance du lot est invalide.");
  }
  if (input.origin?.occurredAt && !Number.isFinite(input.origin.occurredAt.getTime())) {
    throw new Error("La date de provenance du lot est invalide.");
  }
  const result = await client.query<{ id: string }>(
    `INSERT INTO character_item_lots (
       item_code, quantity, container_kind, inventory_slot_id,
       origin_type, origin_reference, origin_occurred_at
     )
     VALUES ($1, $2, 'character_bag', $3, $4, $5, $6)
     RETURNING id`,
    [
      input.itemCode,
      input.quantity,
      input.inventorySlotId,
      input.origin?.originType ?? null,
      input.origin?.sourceReference ?? null,
      input.origin?.occurredAt ?? null
    ]
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("La création du lot d'inventaire a échoué.");
  return id;
}

/** Consomme des lots FIFO sans perdre la provenance des quantités restantes. */
export async function consumeInventoryItemLots(
  client: PoolClient,
  input: { inventorySlotId: string; itemCode: string; quantity: number }
): Promise<void> {
  validateLotInput(input.itemCode, input.quantity, input.inventorySlotId);
  const result = await client.query<{
    id: string;
    quantity: number;
  }>(
    `SELECT id, quantity
     FROM character_item_lots
     WHERE inventory_slot_id = $1
       AND item_code = $2
       AND container_kind = 'character_bag'
     ORDER BY created_at ASC, id ASC
     FOR UPDATE`,
    [input.inventorySlotId, input.itemCode]
  );

  const available = result.rows.reduce((sum, row) => sum + Number(row.quantity), 0);
  if (available < input.quantity) {
    throw new Error("Les lots persistés ne correspondent pas au stock disponible.");
  }

  let remaining = input.quantity;
  for (const lot of result.rows) {
    if (remaining === 0) break;
    const quantity = Number(lot.quantity);
    if (quantity <= remaining) {
      await client.query("DELETE FROM character_item_lots WHERE id = $1", [lot.id]);
      remaining -= quantity;
    } else {
      await client.query(
        "UPDATE character_item_lots SET quantity = quantity - $2, updated_at = NOW() WHERE id = $1",
        [lot.id, remaining]
      );
      remaining = 0;
    }
  }
}

/** Crée un lot de sortie de fabrication dans la ligne de sac nouvellement créée. */
export async function addCraftedItemLot(
  client: PoolClient,
  input: { inventorySlotId: string; itemCode: string; quantity: number; recipeKey: string }
): Promise<string> {
  return addInventoryItemLot(client, {
    ...input,
    origin: {
      originType: "crafting",
      sourceReference: input.recipeKey,
      occurredAt: new Date()
    }
  });
}

/** Déplace les lots d'une ligne de sac vers une ligne de stockage de camp. */
export async function moveInventoryLotsToCampStorage(
  client: PoolClient,
  input: { inventorySlotId: string; campStorageEntryId: string; itemCode: string; quantity: number }
): Promise<void> {
  validateLotInput(input.itemCode, input.quantity, input.inventorySlotId, input.campStorageEntryId);
  const result = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(quantity), 0)::text AS total
     FROM character_item_lots
     WHERE inventory_slot_id = $1 AND item_code = $2`,
    [input.inventorySlotId, input.itemCode]
  );
  if (Number(result.rows[0]?.total ?? 0) !== input.quantity) {
    throw new Error("Les lots persistés ne correspondent pas exactement au stock du sac.");
  }
  await client.query(
    `UPDATE character_item_lots
     SET inventory_slot_id = NULL,
         camp_storage_entry_id = $2,
         container_kind = 'temporary_camp_storage',
         updated_at = NOW()
     WHERE inventory_slot_id = $1 AND item_code = $3`,
    [input.inventorySlotId, input.campStorageEntryId, input.itemCode]
  );
}

/** Déplace les lots d'une ligne de stockage vers une ligne du sac. */
export async function moveCampStorageLotsToInventory(
  client: PoolClient,
  input: { campStorageEntryId: string; inventorySlotId: string; itemCode: string }
): Promise<void> {
  validateLotInput(input.itemCode, 1, input.campStorageEntryId, input.inventorySlotId);
  const result = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(quantity), 0)::text AS total
     FROM character_item_lots
     WHERE camp_storage_entry_id = $1 AND item_code = $2`,
    [input.campStorageEntryId, input.itemCode]
  );
  if (Number(result.rows[0]?.total ?? 0) <= 0) {
    throw new Error("Aucun lot traçable ne correspond à l'objet du camp.");
  }
  await client.query(
    `UPDATE character_item_lots
     SET camp_storage_entry_id = NULL,
         inventory_slot_id = $2,
         container_kind = 'character_bag',
         updated_at = NOW()
     WHERE camp_storage_entry_id = $1 AND item_code = $3`,
    [input.campStorageEntryId, input.inventorySlotId, input.itemCode]
  );
}

/** Retire une quantité précise du stockage et la rattache au sac sans perdre la provenance. */
export async function movePartialCampStorageLotsToInventory(
  client: PoolClient,
  input: { campStorageEntryId: string; inventorySlotId: string; itemCode: string; quantity: number }
): Promise<void> {
  validateLotInput(input.itemCode, input.quantity, input.campStorageEntryId, input.inventorySlotId);
  const lots = await client.query<{
    id: string;
    quantity: number;
    origin_type: ItemOriginType | null;
    origin_reference: string | null;
    origin_occurred_at: Date | null;
    instance_state: unknown;
  }>(
    `SELECT id, quantity, origin_type, origin_reference, origin_occurred_at, instance_state
     FROM character_item_lots
     WHERE camp_storage_entry_id = $1 AND item_code = $2
     ORDER BY created_at ASC, id ASC
     FOR UPDATE`,
    [input.campStorageEntryId, input.itemCode]
  );
  const total = lots.rows.reduce((sum, lot) => sum + Number(lot.quantity), 0);
  if (total < input.quantity) {
    throw new Error("Les lots du camp ne correspondent pas à la quantité à retirer.");
  }

  let remaining = input.quantity;
  for (const lot of lots.rows) {
    if (remaining === 0) break;
    const lotQuantity = Number(lot.quantity);
    const moved = Math.min(lotQuantity, remaining);
    if (moved === lotQuantity) {
      await client.query(
        `UPDATE character_item_lots
         SET camp_storage_entry_id = NULL,
             inventory_slot_id = $2,
             container_kind = 'character_bag',
             updated_at = NOW()
         WHERE id = $1`,
        [lot.id, input.inventorySlotId]
      );
    } else {
      await client.query(
        "UPDATE character_item_lots SET quantity = quantity - $2, updated_at = NOW() WHERE id = $1",
        [lot.id, moved]
      );
      await client.query(
        `INSERT INTO character_item_lots (
           item_code, quantity, container_kind, inventory_slot_id,
           instance_state, origin_type, origin_reference, origin_occurred_at
         )
         VALUES ($1, $2, 'character_bag', $3, $4::jsonb, $5, $6, $7)`,
        [
          input.itemCode, moved, input.inventorySlotId,
          lot.instance_state === null ? null : JSON.stringify(lot.instance_state),
          lot.origin_type, lot.origin_reference, lot.origin_occurred_at
        ]
      );
    }
    remaining -= moved;
  }
}
