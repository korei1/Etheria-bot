import type { Pool, PoolClient } from "pg";
import { getItemDefinition } from "./item-catalog.js";
import { createItemStack, type ItemStack } from "./item-model.js";
import { addInventoryItemLot } from "./item-lot-persistence.js";

export interface AddCollectedResourceInput {
  accountId: string;
  characterId: string;
  /** UUID stable de l'interaction Discord, normalisé par l'interface. */
  interactionId: string;
  /** Identifiant stable fourni par le futur résolveur du monde, jamais par le joueur. */
  sourceKey: string;
  itemCode: string;
  quantity: number;
}

export interface AddCollectedResourceResult extends ItemStack {
  replayed: boolean;
  slotNumber: number;
}

export class ResourceCollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceCollectionError";
  }
}

export class ResourceCollectionIdempotencyError extends ResourceCollectionError {
  constructor() {
    super("Cette interaction a déjà servi à enregistrer une autre collecte.");
    this.name = "ResourceCollectionIdempotencyError";
  }
}

/**
 * Enregistre dans le sac porté une quantité de ressource déjà validée par
 * le futur moteur du monde. Ce service ne décide ni où la ressource existe,
 * ni si elle est récoltable, ni combien le nœud contient ou quand il revient.
 */
export async function addCollectedResourceToInventory(
  pool: Pool,
  input: AddCollectedResourceInput
): Promise<AddCollectedResourceResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await addCollectedResourceToInventoryInTransaction(client, input);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Variante sans BEGIN/COMMIT. Le futur moteur du monde pourra verrouiller
 * et consommer une source dans la même transaction que l'ajout au sac.
 * L'appelant possède et termine la transaction.
 */
export async function addCollectedResourceToInventoryInTransaction(
  client: PoolClient,
  input: AddCollectedResourceInput
): Promise<AddCollectedResourceResult> {
  const sourceKey = input.sourceKey.trim();
  const itemCode = input.itemCode.trim();
  const postgresIntegerMax = 2_147_483_647;

  if (!sourceKey) throw new ResourceCollectionError("La source de collecte est invalide.");
  if (!itemCode) throw new ResourceCollectionError("Le code de ressource est invalide.");
  if (!getItemDefinition(itemCode)) {
    throw new ResourceCollectionError("Cette ressource ne figure pas dans le catalogue des objets Etheria.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > postgresIntegerMax) {
    throw new ResourceCollectionError("La quantité collectée doit être un entier positif pris en charge.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.interactionId)) {
    throw new ResourceCollectionError("L'identifiant de l'interaction doit être un UUID valide.");
  }

  const character = await client.query<{ id: string }>(
    `SELECT id FROM characters
     WHERE id = $1 AND account_id = $2 AND status = 'active'
     FOR UPDATE`,
    [input.characterId, input.accountId]
  );
  if (!character.rows[0]) {
    throw new ResourceCollectionError("Aucun personnage actif ne correspond à cette collecte.");
  }

  const prior = await client.query<{
    character_id: string;
    source_key: string;
    item_code: string;
    quantity: number;
    slot_number: number;
  }>(
    `SELECT character_id, source_key, item_code, quantity, slot_number
     FROM character_resource_collection_events
     WHERE interaction_id = $1`,
    [input.interactionId]
  );
  if (prior.rows[0]) {
    const event = prior.rows[0];
    if (
      event.character_id !== input.characterId ||
      event.source_key !== sourceKey ||
      event.item_code !== itemCode ||
      Number(event.quantity) !== input.quantity
    ) {
      throw new ResourceCollectionIdempotencyError();
    }
    return {
      ...createItemStack(event.item_code, Number(event.quantity)),
      replayed: true,
      slotNumber: Number(event.slot_number)
    };
  }

  const bagResult = await client.query<{ id: string; capacity: number }>(
    `SELECT id, capacity FROM character_inventory_bags
     WHERE character_id = $1 AND is_equipped = TRUE
     FOR UPDATE`,
    [input.characterId]
  );
  const bag = bagResult.rows[0];
  if (!bag) throw new ResourceCollectionError("Aucun sac n'est actuellement équipé.");

  const existing = await client.query<{ id: string; slot_number: number; quantity: number }>(
    `SELECT id, slot_number, quantity
     FROM character_inventory_slots
     WHERE bag_id = $1 AND item_code = $2
     FOR UPDATE`,
    [bag.id, itemCode]
  );

  let slotNumber: number;
  if (existing.rows[0]) {
    const stack = existing.rows[0];
    const nextQuantity = Number(stack.quantity) + input.quantity;
    if (!Number.isSafeInteger(nextQuantity) || nextQuantity > postgresIntegerMax) {
      throw new ResourceCollectionError("La quantité totale de cette ressource est trop élevée.");
    }
    await client.query(
      "UPDATE character_inventory_slots SET quantity = quantity + $2 WHERE id = $1",
      [stack.id, input.quantity]
    );
    await addInventoryItemLot(client, {
      inventorySlotId: stack.id,
      itemCode,
      quantity: input.quantity,
      origin: { originType: "collection", sourceReference: sourceKey, occurredAt: new Date() }
    });
    slotNumber = Number(stack.slot_number);
  } else {
    const occupied = await client.query<{ slot_number: number }>(
      "SELECT slot_number FROM character_inventory_slots WHERE bag_id = $1 FOR UPDATE",
      [bag.id]
    );
    const used = new Set(occupied.rows.map((row) => Number(row.slot_number)));
    const free = Array.from({ length: bag.capacity }, (_, index) => index + 1)
      .find((candidate) => !used.has(candidate));
    if (!free) throw new ResourceCollectionError("Ton sac est plein.");
    slotNumber = free;
    const insertedSlot = await client.query<{ id: string }>(
      `INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [bag.id, slotNumber, itemCode, input.quantity]
    );
    const slotId = insertedSlot.rows[0]?.id;
    if (!slotId) throw new ResourceCollectionError("L'emplacement de collecte n'a pas été créé.");
    await addInventoryItemLot(client, {
      inventorySlotId: slotId,
      itemCode,
      quantity: input.quantity,
      origin: { originType: "collection", sourceReference: sourceKey, occurredAt: new Date() }
    });
  }

  await client.query(
    `INSERT INTO character_resource_collection_events (
       interaction_id, character_id, source_key, item_code, quantity, slot_number
     )
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.interactionId, input.characterId, sourceKey, itemCode, input.quantity, slotNumber]
  );

  return { ...createItemStack(itemCode, input.quantity), replayed: false, slotNumber };
}
