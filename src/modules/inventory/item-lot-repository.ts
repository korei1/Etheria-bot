import type { Pool } from "pg";
import { createItemLot, type ItemLot } from "./item-lots.js";
import type { ItemInstanceState, ItemOriginType } from "./item-properties.js";

interface ItemLotRow {
  id: string;
  item_code: string;
  quantity: number;
  container_kind: "character_bag" | "temporary_camp_storage";
  bag_id: string | null;
  slot_number: number | null;
  camp_id: string | null;
  instance_state: ItemInstanceState | null;
  origin_type: ItemOriginType | null;
  origin_reference: string | null;
  origin_occurred_at: Date | null;
}

export class ItemLotRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemLotRepositoryError";
  }
}

/**
 * Lit les lots actuellement présents dans les contenants du personnage.
 * La migration 0018 doit être appliquée avant d'appeler ce dépôt.
 * Les lots rétrocompatibles ont volontairement une provenance inconnue.
 */
export async function listCharacterItemLots(
  pool: Pool,
  input: { accountId: string; characterId: string }
): Promise<ItemLot[]> {
  const result = await pool.query<ItemLotRow>(
    `SELECT
       l.id,
       l.item_code,
       l.quantity,
       l.container_kind,
       b.id AS bag_id,
       s.slot_number,
       c.id AS camp_id,
       l.instance_state,
       l.origin_type,
       l.origin_reference,
       l.origin_occurred_at
     FROM character_item_lots l
     LEFT JOIN character_inventory_slots s ON s.id = l.inventory_slot_id
     LEFT JOIN character_inventory_bags b ON b.id = s.bag_id
     LEFT JOIN character_temporary_camp_storage cs ON cs.id = l.camp_storage_entry_id
     LEFT JOIN character_temporary_camps c ON c.id = cs.camp_id
     LEFT JOIN characters ch ON ch.id = COALESCE(b.character_id, c.character_id)
     WHERE ch.id = $1
       AND ch.account_id = $2
       AND ch.status = 'active'
     ORDER BY l.created_at ASC, l.id ASC`,
    [input.characterId, input.accountId]
  );

  return result.rows.map((row) => {
    const state: ItemInstanceState | undefined = row.instance_state
      ? row.instance_state
      : row.origin_type
        ? {
            provenance: {
              originType: row.origin_type,
              ...(row.origin_reference ? { sourceReference: row.origin_reference } : {}),
              ...(row.origin_occurred_at
                ? { occurredAt: row.origin_occurred_at.toISOString() }
                : {})
            }
          }
        : undefined;

    if (row.container_kind === "character_bag") {
      if (!row.bag_id || row.slot_number === null) {
        throw new ItemLotRepositoryError("Un lot de sac ne possède plus son emplacement associé.");
      }
      return createItemLot({
        lotId: row.id,
        itemCode: row.item_code,
        quantity: Number(row.quantity),
        container: {
          kind: "character_bag",
          containerId: row.bag_id,
          slotNumber: Number(row.slot_number)
        },
        ...(state ? { state } : {})
      });
    }

    if (!row.camp_id) {
      throw new ItemLotRepositoryError("Un lot de camp ne possède plus son contenant associé.");
    }
    return createItemLot({
      lotId: row.id,
      itemCode: row.item_code,
      quantity: Number(row.quantity),
      container: {
        kind: "temporary_camp_storage",
        containerId: row.camp_id
      },
      ...(state ? { state } : {})
    });
  });
}
