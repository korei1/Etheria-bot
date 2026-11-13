import type { Pool, PoolClient } from "pg";

export interface AvailableTravelRoute {
  linkKey: string;
  displayName: string;
  mode: "land" | "sea" | "air";
  linkType: string;
  destinationLabel: string;
  distanceMeters: number | null;
  estimatedDurationMinutes: number | null;
}

export interface CharacterTravelResult {
  status: "traveled" | "duplicate_event";
  routeName: string;
  destinationName: string;
  destinationSettlementKey: string | null;
}

interface TravelRouteRow {
  link_key: string;
  display_name: string;
  mode: "land" | "sea" | "air";
  link_type: string;
  destination_settlement_id: string | null;
  destination_settlement_key: string | null;
  destination_name: string | null;
  destination_visibility: "public" | "discovery_locked" | null;
  destination_discovered: boolean;
  distance_meters: string | null;
  estimated_duration_minutes: number | null;
}

export class CharacterTravelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterTravelError";
  }
}

const routeSelect = `
  SELECT l.link_key, l.display_name, l.mode, l.link_type,
         CASE
           WHEN c.current_settlement_id IS NOT NULL
             AND l.bidirectional
             AND l.to_settlement_id = c.current_settlement_id
             THEN l.from_settlement_id
           ELSE l.to_settlement_id
         END AS destination_settlement_id,
         dest.settlement_key AS destination_settlement_key,
         dest.display_name AS destination_name,
         dest.visibility AS destination_visibility,
         EXISTS (
           SELECT 1 FROM world_discoveries d
           WHERE d.account_id = c.account_id
             AND d.target_kind = 'settlement'
             AND d.target_key = dest.settlement_key
         ) AS destination_discovered,
         l.distance_meters::TEXT AS distance_meters,
         l.estimated_duration_minutes
  FROM characters c
  JOIN world_travel_links l
    ON l.editorial_status = 'approved'
   AND cardinality(l.access_requirements) = 0
  LEFT JOIN starting_spawn_zones origin_zone
    ON origin_zone.id = l.from_spawn_zone_id
   AND origin_zone.is_active = TRUE
  LEFT JOIN world_settlements origin_settlement
    ON origin_settlement.id = l.from_settlement_id
   AND origin_settlement.editorial_status = 'approved'
  LEFT JOIN world_settlements dest
    ON dest.id = CASE
      WHEN c.current_settlement_id IS NOT NULL
        AND l.bidirectional
        AND l.to_settlement_id = c.current_settlement_id
        THEN l.from_settlement_id
      ELSE l.to_settlement_id
    END
   AND dest.editorial_status = 'approved'
  WHERE c.account_id = $1
    AND c.status = 'active'
    AND (
      (c.current_settlement_id IS NULL
        AND l.from_spawn_zone_id = c.spawn_zone_id
        AND origin_zone.id IS NOT NULL)
      OR
      (c.current_settlement_id IS NOT NULL
        AND l.from_settlement_id = c.current_settlement_id
        AND origin_settlement.id IS NOT NULL)
      OR
      (c.current_settlement_id IS NOT NULL
        AND l.bidirectional
        AND l.to_settlement_id = c.current_settlement_id
        AND (l.from_settlement_id IS NULL OR origin_settlement.id IS NOT NULL))
    )
    AND (
      dest.id IS NOT NULL
      OR (
        c.current_settlement_id IS NOT NULL
        AND l.bidirectional
        AND l.to_settlement_id = c.current_settlement_id
        AND l.from_spawn_zone_id IS NOT NULL
        AND origin_zone.id IS NOT NULL
      )
    )
    AND (
      l.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM world_discoveries ld
        WHERE ld.account_id = c.account_id
          AND ld.target_kind = 'travel_link'
          AND ld.target_key = l.link_key
      )
    )
`;

function mapRoute(row: TravelRouteRow): AvailableTravelRoute {
  const hiddenDestination =
    row.destination_visibility === "discovery_locked" && !row.destination_discovered;
  return {
    linkKey: row.link_key,
    displayName: row.display_name,
    mode: row.mode,
    linkType: row.link_type,
    destinationLabel: row.destination_settlement_id === null
      ? "Ton lieu de départ"
      : hiddenDestination
        ? "Destination inconnue"
        : row.destination_name ?? "Destination indisponible",
    distanceMeters: row.distance_meters === null ? null : Number(row.distance_meters),
    estimatedDurationMinutes: row.estimated_duration_minutes
  };
}

/** Liste uniquement les itinéraires approuvés, accessibles depuis la position actuelle. */
export async function listAvailableCharacterTravelRoutes(
  pool: Pool,
  input: { accountId: string }
): Promise<AvailableTravelRoute[]> {
  if (!input.accountId.trim()) throw new CharacterTravelError("Compte joueur absent.");
  const result = await pool.query<TravelRouteRow>(
    `${routeSelect}
     ORDER BY l.display_name, l.link_key
     LIMIT 25`,
    [input.accountId]
  );
  return result.rows.map(mapRoute);
}

async function recordTravelDiscovery(
  client: PoolClient,
  input: {
    accountId: string;
    eventId: string;
    targetKind: "travel_link" | "settlement";
    targetKey: string;
    occurredAt: Date;
  }
): Promise<void> {
  const existing = await client.query(
    `SELECT 1 FROM world_discoveries
     WHERE account_id = $1 AND target_kind = $2 AND target_key = $3`,
    [input.accountId, input.targetKind, input.targetKey]
  );
  const outcome = existing.rowCount ? "already_discovered" : "discovered";
  const event = await client.query<{ id: string }>(
    `INSERT INTO world_discovery_events
     (account_id, event_id, target_kind, target_key, discovery_method, outcome, occurred_at)
     VALUES ($1, $2, $3, $4, 'exploration', $5, $6)
     ON CONFLICT (account_id, event_id) DO NOTHING
     RETURNING id`,
    [input.accountId, input.eventId, input.targetKind, input.targetKey, outcome, input.occurredAt]
  );
  if (!event.rows[0]) {
    throw new CharacterTravelError("Cet événement de découverte a déjà été traité.");
  }
  await client.query(
    `INSERT INTO world_discoveries
     (account_id, target_kind, target_key, discovery_method, discovered_at, first_event_id)
     VALUES ($1, $2, $3, 'exploration', $4, $5)
     ON CONFLICT (account_id, target_kind, target_key) DO NOTHING`,
    [input.accountId, input.targetKind, input.targetKey, input.occurredAt, event.rows[0].id]
  );
}

/**
 * Déplace le personnage et enregistre le voyage ainsi que les découvertes dans
 * une transaction unique. Les identifiants Discord rendent l'action idempotente.
 */
export async function travelCharacter(
  pool: Pool,
  input: {
    interactionId: string;
    accountId: string;
    characterId: string;
    linkKey: string;
  }
): Promise<CharacterTravelResult> {
  if (!input.interactionId.trim() || !input.accountId.trim() ||
      !input.characterId.trim() || !input.linkKey.trim()) {
    throw new CharacterTravelError("Les informations du voyage sont incomplètes.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const characterResult = await client.query<{
      id: string;
      spawn_zone_id: string | null;
      current_settlement_id: string | null;
    }>(
      `SELECT id, spawn_zone_id, current_settlement_id
       FROM characters
       WHERE id = $1 AND account_id = $2 AND status = 'active'
       FOR UPDATE`,
      [input.characterId, input.accountId]
    );
    const character = characterResult.rows[0];
    if (!character || !character.spawn_zone_id) {
      throw new CharacterTravelError("Aucun personnage actif avec un lieu de départ valide n'a été trouvé.");
    }

    const previousTravel = await client.query<{
      display_name: string;
      destination_name: string | null;
      destination_key: string | null;
      to_settlement_id: string | null;
    }>(
      `SELECT l.display_name, s.display_name AS destination_name,
              s.settlement_key AS destination_key, e.to_settlement_id
       FROM world_travel_events e
       JOIN world_travel_links l ON l.link_key = e.link_key
       LEFT JOIN world_settlements s ON s.id = e.to_settlement_id
       WHERE e.event_id = $1 AND e.account_id = $2 AND e.character_id = $3`,
      [input.interactionId, input.accountId, input.characterId]
    );
    if (previousTravel.rows[0]) {
      const previous = previousTravel.rows[0];
      await client.query("COMMIT");
      return {
        status: "duplicate_event",
        routeName: previous.display_name,
        destinationName: previous.to_settlement_id === null
          ? "Ton lieu de départ"
          : previous.destination_name ?? "Localité déjà visitée",
        destinationSettlementKey: previous.destination_key
      };
    }

    const routeResult = await client.query<TravelRouteRow & {
      destination_spawn_zone_id: string | null;
    }>(
      `${routeSelect.replace("WHERE c.account_id = $1", "WHERE c.id = $2 AND c.account_id = $1")}
       AND l.link_key = $3
       FOR SHARE OF l`,
      [input.accountId, input.characterId, input.linkKey]
    );
    const route = routeResult.rows[0];
    if (!route) {
      throw new CharacterTravelError("Cet itinéraire n'est pas accessible depuis ton lieu actuel.");
    }
    if (route.destination_settlement_id === null && character.current_settlement_id === null) {
      throw new CharacterTravelError("Cet itinéraire ne mène pas vers une autre localité.");
    }

    const destinationSettlementId = route.destination_settlement_id;
    const destinationSpawnZoneId = destinationSettlementId === null
      ? character.spawn_zone_id
      : null;
    const occurredAt = new Date();

    const travelEvent = await client.query(
      `INSERT INTO world_travel_events
       (event_id, account_id, character_id, link_key,
        from_spawn_zone_id, from_settlement_id,
        to_spawn_zone_id, to_settlement_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [
        input.interactionId,
        input.accountId,
        input.characterId,
        route.link_key,
        character.current_settlement_id === null ? character.spawn_zone_id : null,
        character.current_settlement_id,
        destinationSpawnZoneId,
        destinationSettlementId,
        occurredAt
      ]
    );
    if (!travelEvent.rowCount) {
      await client.query("COMMIT");
      return {
        status: "duplicate_event",
        routeName: route.display_name,
        destinationName: destinationSettlementId === null
          ? "Ton lieu de départ"
          : route.destination_name ?? "Localité déjà visitée",
        destinationSettlementKey: route.destination_settlement_key
      };
    }

    await client.query(
      "UPDATE characters SET current_settlement_id = $2 WHERE id = $1",
      [input.characterId, destinationSettlementId]
    );

    await recordTravelDiscovery(client, {
      accountId: input.accountId,
      eventId: `travel:${input.interactionId}:link`,
      targetKind: "travel_link",
      targetKey: route.link_key,
      occurredAt
    });
    if (destinationSettlementId && route.destination_settlement_key) {
      await recordTravelDiscovery(client, {
        accountId: input.accountId,
        eventId: `travel:${input.interactionId}:settlement`,
        targetKind: "settlement",
        targetKey: route.destination_settlement_key,
        occurredAt
      });
    }

    await client.query("COMMIT");
    return {
      status: "traveled",
      routeName: route.display_name,
      destinationName: destinationSettlementId === null
        ? "Ton lieu de départ"
        : route.destination_name ?? "Nouvelle localité",
      destinationSettlementKey: route.destination_settlement_key
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
