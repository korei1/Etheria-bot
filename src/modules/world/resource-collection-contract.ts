import type { Pool, PoolClient } from "pg";
import { createItemStack } from "../inventory/item-model.js";
import {
  addCollectedResourceToInventoryInTransaction,
  type AddCollectedResourceResult,
  ResourceCollectionError
} from "../inventory/resource-collection-service.js";

/**
 * Réservation temporaire d'une source déterminée par le monde.
 *
 * Le résolveur doit verrouiller la source et valider sa disponibilité dans
 * la transaction reçue. consume() applique ensuite la consommation réelle.
 * Si l'inventaire ou consume() échoue, toute la transaction est annulée.
 */
export interface LockedWorldResourceSource {
  /** Identifiant stable et interne de la source dans le monde. */
  sourceKey: string;
  /** Code d'objet canonique fourni par le résolveur du monde. */
  itemCode: string;
  /** Quantité déterminée par les règles du monde, jamais par le client Discord. */
  quantity: number;
  consume(client: PoolClient): Promise<void>;
}

/**
 * Contrat du futur moteur géographique et écologique.
 *
 * L'implémentation doit retrouver la position courante depuis les données
 * serveur du personnage. Elle ne reçoit aucune coordonnée ou zone du joueur.
 */
export interface WorldResourceCollectionResolver {
  resolveAndLockAvailableSource(input: {
    client: PoolClient;
    characterId: string;
  }): Promise<LockedWorldResourceSource | null>;
}

export interface CollectWorldResourceInput {
  accountId: string;
  characterId: string;
  interactionId: string;
}

export interface CollectWorldResourceResult extends AddCollectedResourceResult {
  sourceKey: string;
}

export class NoCollectableWorldResourceError extends ResourceCollectionError {
  constructor() {
    super("Aucune ressource récoltable n'est disponible ici pour le moment.");
    this.name = "NoCollectableWorldResourceError";
  }
}

/**
 * Orchestration transactionnelle entre le monde et le sac.
 *
 * Cette fonction ne choisit aucune ressource et ne contient aucune règle
 * écologique. Elle demande au résolveur de trouver/verrouiller une source,
 * crédite le sac, consomme la source et valide le tout en une transaction.
 */
export async function collectWorldResource(
  pool: Pool,
  resolver: WorldResourceCollectionResolver,
  input: CollectWorldResourceInput
): Promise<CollectWorldResourceResult> {
  const interactionId = input.interactionId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(interactionId)) {
    throw new ResourceCollectionError("L'identifiant de l'interaction doit être un UUID valide.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const character = await client.query<{ id: string }>(
      `SELECT id FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, input.accountId]
    );
    if (!character.rows[0]) {
      throw new ResourceCollectionError("Aucun personnage actif ne correspond à cette collecte.");
    }

    // Vérifier l'idempotence avant de consulter le monde : la source peut
    // avoir été épuisée par la première exécution de cette même interaction.
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
      [interactionId]
    );
    if (prior.rows[0]) {
      const event = prior.rows[0];
      if (event.character_id !== input.characterId) {
        throw new ResourceCollectionError("Cette interaction appartient à un autre personnage.");
      }
      await client.query("COMMIT");
      return {
        sourceKey: event.source_key,
        ...createItemStack(event.item_code, Number(event.quantity)),
        replayed: true,
        slotNumber: Number(event.slot_number)
      };
    }

    const source = await resolver.resolveAndLockAvailableSource({
      client,
      characterId: input.characterId
    });
    if (!source) throw new NoCollectableWorldResourceError();

    const added = await addCollectedResourceToInventoryInTransaction(client, {
      accountId: input.accountId,
      characterId: input.characterId,
      interactionId,
      sourceKey: source.sourceKey,
      itemCode: source.itemCode,
      quantity: source.quantity
    });

    await source.consume(client);
    await client.query("COMMIT");
    return { ...added, sourceKey: source.sourceKey };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
