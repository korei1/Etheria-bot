import type { Pool } from "pg";
import { getItemDefinition } from "../inventory/item-catalog.js";

const INITIAL_CAVE_CAMP_CODE = "initial_cave_camp";

export interface CampStorageEntry {
  itemCode: string;
  quantity: number;
  depositedAt: Date;
}

export class CampStorageUnavailableError extends Error {
  constructor(message = "Le stockage du camp n'est accessible que lorsque ton personnage s'y trouve.") {
    super(message);
    this.name = "CampStorageUnavailableError";
  }
}

export class CampStorageItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampStorageItemError";
  }
}

/**
 * Le stockage est physique : aucune lecture ou modification n'est possible
 * lorsque le personnage n'est pas dans la scène de son camp.
 * Seuls les objets trouvés et non fabriqués sont acceptés.
 */
export async function listTemporaryCampStorage(
  pool: Pool,
  input: { accountId: string; characterId: string }
): Promise<CampStorageEntry[]> {
  const presence = await pool.query(
    `SELECT 1
     FROM character_temporary_camps c
     JOIN characters ch ON ch.id = c.character_id
     JOIN character_exploration_progress p ON p.character_id = ch.id
     WHERE ch.id = $1 AND ch.account_id = $2 AND ch.status = 'active'
       AND c.camp_code = $3 AND c.status = 'temporary'
       AND p.current_scene_key = 'temporary_camp_established'`,
    [input.characterId, input.accountId, INITIAL_CAVE_CAMP_CODE]
  );
  if (!presence.rowCount) throw new CampStorageUnavailableError();

  const result = await pool.query<{
    item_code: string;
    quantity: number;
    deposited_at: Date;
  }>(
    `SELECT s.item_code, s.quantity, s.deposited_at
     FROM character_temporary_camp_storage s
     JOIN character_temporary_camps c ON c.id = s.camp_id
     JOIN characters ch ON ch.id = c.character_id
     JOIN character_exploration_progress p ON p.character_id = ch.id
     WHERE ch.id = $1
       AND ch.account_id = $2
       AND ch.status = 'active'
       AND c.camp_code = $3
       AND c.status = 'temporary'
       AND p.current_scene_key = 'temporary_camp_established'
     ORDER BY s.deposited_at ASC, s.item_code ASC`,
    [input.characterId, input.accountId, INITIAL_CAVE_CAMP_CODE]
  );

  return result.rows.map((row) => ({
    itemCode: row.item_code,
    quantity: row.quantity,
    depositedAt: row.deposited_at
  }));
}

export async function depositFoundItemAtTemporaryCamp(
  pool: Pool,
  input: {
    accountId: string;
    characterId: string;
    itemCode: string;
  }
): Promise<void> {
  const itemCode = input.itemCode.trim();
  if (getItemDefinition(itemCode)?.temporaryCampStorage !== true) {
    throw new CampStorageItemError("Seuls les objets trouvés et non fabriqués peuvent être déposés ici.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const camp = await client.query<{ id: string }>(
      `SELECT c.id
       FROM character_temporary_camps c
       JOIN characters ch ON ch.id = c.character_id
       JOIN character_exploration_progress p ON p.character_id = ch.id
       WHERE ch.id = $1 AND ch.account_id = $2 AND ch.status = 'active'
         AND c.camp_code = $3 AND c.status = 'temporary'
         AND p.current_scene_key = 'temporary_camp_established'
       FOR UPDATE OF c`,
      [input.characterId, input.accountId, INITIAL_CAVE_CAMP_CODE]
    );
    const campId = camp.rows[0]?.id;
    if (!campId) throw new CampStorageUnavailableError();

    const bag = await client.query<{ id: string }>(
      `SELECT id FROM character_inventory_bags
       WHERE character_id = $1 AND is_equipped = TRUE
       FOR UPDATE`,
      [input.characterId]
    );
    const bagId = bag.rows[0]?.id;
    if (!bagId) throw new CampStorageItemError("Aucun sac n'est actuellement équipé.");

    const item = await client.query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM character_inventory_slots
       WHERE bag_id = $1 AND item_code = $2
       FOR UPDATE`,
      [bagId, itemCode]
    );
    const carried = item.rows[0];
    if (!carried) throw new CampStorageItemError("Cet objet ne se trouve pas dans ton sac porté.");

    await client.query(
      `INSERT INTO character_temporary_camp_storage (camp_id, item_code, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (camp_id, item_code) DO UPDATE
         SET quantity = character_temporary_camp_storage.quantity + EXCLUDED.quantity,
             updated_at = NOW()`,
      [campId, itemCode, carried.quantity]
    );
    await client.query("DELETE FROM character_inventory_slots WHERE id = $1", [carried.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function withdrawFoundItemFromTemporaryCamp(
  pool: Pool,
  input: {
    accountId: string;
    characterId: string;
    itemCode: string;
  }
): Promise<void> {
  const itemCode = input.itemCode.trim();
  if (!NON_CRAFTABLE_FOUND_ITEMS.has(itemCode)) {
    throw new CampStorageItemError("Cet objet ne fait pas partie des objets trouvés stockables.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const camp = await client.query<{ id: string }>(
      `SELECT c.id
       FROM character_temporary_camps c
       JOIN characters ch ON ch.id = c.character_id
       JOIN character_exploration_progress p ON p.character_id = ch.id
       WHERE ch.id = $1 AND ch.account_id = $2 AND ch.status = 'active'
         AND c.camp_code = $3 AND c.status = 'temporary'
         AND p.current_scene_key = 'temporary_camp_established'
       FOR UPDATE OF c`,
      [input.characterId, input.accountId, INITIAL_CAVE_CAMP_CODE]
    );
    const campId = camp.rows[0]?.id;
    if (!campId) throw new CampStorageUnavailableError();

    const bag = await client.query<{ id: string; capacity: number }>(
      `SELECT id, capacity FROM character_inventory_bags
       WHERE character_id = $1 AND is_equipped = TRUE
       FOR UPDATE`,
      [input.characterId]
    );
    const equippedBag = bag.rows[0];
    if (!equippedBag) throw new CampStorageItemError("Aucun sac n'est actuellement équipé.");

    const used = await client.query<{ slot_number: number }>(
      "SELECT slot_number FROM character_inventory_slots WHERE bag_id = $1",
      [equippedBag.id]
    );
    const occupiedSlots = new Set(used.rows.map((row) => Number(row.slot_number)));
    const existingItem = await client.query<{ id: string }>(
      "SELECT id FROM character_inventory_slots WHERE bag_id = $1 AND item_code = $2 FOR UPDATE",
      [equippedBag.id, itemCode]
    );
    const freeSlot = Array.from(
      { length: equippedBag.capacity },
      (_, index) => index + 1
    ).find((slotNumber) => !occupiedSlots.has(slotNumber));
    if (!existingItem.rows[0] && !freeSlot) {
      throw new CampStorageItemError("Ton sac porté est plein.");
    }

    const stored = await client.query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM character_temporary_camp_storage
       WHERE camp_id = $1 AND item_code = $2
       FOR UPDATE`,
      [campId, itemCode]
    );
    const entry = stored.rows[0];
    if (!entry) throw new CampStorageItemError("Cet objet n'est pas stocké dans le camp.");

    if (existingItem.rows[0]) {
      await client.query(
        "UPDATE character_inventory_slots SET quantity = quantity + 1 WHERE id = $1",
        [existingItem.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO character_inventory_slots (bag_id, slot_number, item_code, quantity)
         VALUES ($1, $2, $3, 1)`,
        [equippedBag.id, freeSlot, itemCode]
      );
    }
    if (entry.quantity === 1) {
      await client.query("DELETE FROM character_temporary_camp_storage WHERE id = $1", [entry.id]);
    } else {
      await client.query(
        `UPDATE character_temporary_camp_storage
         SET quantity = quantity - 1, updated_at = NOW()
         WHERE id = $1`,
        [entry.id]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
