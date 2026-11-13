import type { Pool } from "pg";

export interface NpcTravelPlanResult {
  planId: string;
  npcKey: string;
  routeKey: string;
  departureWorldMinute: number;
  arrivalWorldMinute: number;
}

export interface NpcTravelSyncResult {
  departed: number;
  arrived: number;
}

export type NpcTravelPhase = "scheduled" | "in_transit" | "arrived";

export function getNpcTravelPhase(
  departureWorldMinute: number,
  arrivalWorldMinute: number,
  currentWorldMinute: number
): NpcTravelPhase {
  if (!Number.isSafeInteger(departureWorldMinute) ||
      !Number.isSafeInteger(arrivalWorldMinute) ||
      !Number.isSafeInteger(currentWorldMinute) ||
      departureWorldMinute < 0 ||
      arrivalWorldMinute <= departureWorldMinute ||
      currentWorldMinute < 0) {
    throw new Error("Bornes temporelles du voyage PNJ invalides.");
  }
  if (currentWorldMinute < departureWorldMinute) return "scheduled";
  if (currentWorldMinute < arrivalWorldMinute) return "in_transit";
  return "arrived";
}

/** Lit l'instant courant de l'horloge Etheria sans créer une horloge parallèle. */
export async function getCurrentNpcWorldMinute(pool: Pool): Promise<number> {
  const result = await pool.query<{ world_minute: string }>(
    `SELECT (
       world_minute +
       CASE WHEN is_paused THEN 0
         ELSE floor(
           extract(epoch FROM (NOW() - anchored_at)) / 60
           * world_minutes_per_real_minute
         )::BIGINT
       END
     )::TEXT AS world_minute
     FROM world_clock
     WHERE singleton = TRUE`
  );
  const value = result.rows[0]?.world_minute;
  const minute = value === undefined ? NaN : Number(value);
  if (!Number.isSafeInteger(minute) || minute < 0) {
    throw new Error("L'horloge mondiale Etheria est absente ou invalide.");
  }
  return minute;
}

/**
 * Matérialise les départs et arrivées échus. Les déplacements sont globaux :
 * le PNJ quitte son placement d'origine pendant le trajet, puis rejoint la
 * localité de destination à l'instant d'arrivée. Aucun trajet n'est inventé.
 */
export async function advanceNpcTravelPlans(
  pool: Pool,
  nowWorldMinute?: number
): Promise<NpcTravelSyncResult> {
  const currentMinute = nowWorldMinute ?? await getCurrentNpcWorldMinute(pool);
  if (!Number.isSafeInteger(currentMinute) || currentMinute < 0) {
    throw new Error("Minute mondiale invalide pour la simulation des voyages PNJ.");
  }

  const client = await pool.connect();
  let departed = 0;
  let arrived = 0;
  try {
    await client.query("BEGIN");
    const due = await client.query<{
      id: string;
      npc_key: string;
      origin_settlement_id: string;
      destination_settlement_id: string;
      departure_world_minute: string;
      arrival_world_minute: string;
      status: "planned" | "in_transit";
    }>(
      `SELECT id, npc_key, origin_settlement_id, destination_settlement_id,
              departure_world_minute::TEXT, arrival_world_minute::TEXT, status
       FROM npc_travel_plans
       WHERE status IN ('planned', 'in_transit')
         AND departure_world_minute <= $1
       ORDER BY departure_world_minute, id
       FOR UPDATE SKIP LOCKED
       LIMIT 50`,
      [currentMinute]
    );

    for (const plan of due.rows) {
      const phase = getNpcTravelPhase(
        Number(plan.departure_world_minute),
        Number(plan.arrival_world_minute),
        currentMinute
      );

      if (plan.status === "planned" && phase !== "scheduled") {
        await client.query(
          `UPDATE npc_settlement_locations
           SET is_active = FALSE
           WHERE npc_key = $1 AND settlement_id = $2 AND is_active = TRUE`,
          [plan.npc_key, plan.origin_settlement_id]
        );
        await client.query(
          `INSERT INTO npc_travel_events (plan_id, event_type, world_minute)
           VALUES ($1, 'departed', $2)
           ON CONFLICT (plan_id, event_type) DO NOTHING`,
          [plan.id, plan.departure_world_minute]
        );
        await client.query(
          `UPDATE npc_travel_plans
           SET status = 'in_transit', updated_at = NOW()
           WHERE id = $1 AND status = 'planned'`,
          [plan.id]
        );
        departed += 1;
      }

      if (phase === "arrived") {
        await client.query(
          `INSERT INTO npc_settlement_locations (npc_key, settlement_id, is_active)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (npc_key, settlement_id)
           DO UPDATE SET is_active = TRUE`,
          [plan.npc_key, plan.destination_settlement_id]
        );
        await client.query(
          `INSERT INTO npc_travel_events (plan_id, event_type, world_minute)
           VALUES ($1, 'arrived', $2)
           ON CONFLICT (plan_id, event_type) DO NOTHING`,
          [plan.id, plan.arrival_world_minute]
        );
        await client.query(
          `UPDATE npc_travel_plans
           SET status = 'completed', updated_at = NOW()
           WHERE id = $1 AND status IN ('planned', 'in_transit')`,
          [plan.id]
        );
        arrived += 1;
      }
    }
    await client.query("COMMIT");
    return { departed, arrived };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Programme un trajet unique sur une liaison directe approuvée et chronométrée. */
export async function planNpcTravel(
  pool: Pool,
  input: {
    npcKey: string;
    routeKey: string;
    departureWorldMinute: number;
  }
): Promise<NpcTravelPlanResult> {
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(input.npcKey) ||
      !/^[a-z][a-z0-9_]{1,79}$/.test(input.routeKey) ||
      !Number.isSafeInteger(input.departureWorldMinute) ||
      input.departureWorldMinute < 0) {
    throw new Error("Les paramètres du voyage PNJ sont invalides.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const npc = await client.query(
      `SELECT 1 FROM npc_definitions
       WHERE npc_key = $1 AND editorial_status = 'approved' AND is_active = TRUE
       FOR SHARE`,
      [input.npcKey]
    );
    if (!npc.rowCount) throw new Error("PNJ introuvable, inactif ou non approuvé.");

    const route = await client.query<{
      from_settlement_id: string;
      to_settlement_id: string;
      estimated_duration_minutes: number;
    }>(
      `SELECT l.from_settlement_id, l.to_settlement_id, l.estimated_duration_minutes
       FROM world_travel_links l
       JOIN world_settlements origin
         ON origin.id = l.from_settlement_id AND origin.editorial_status = 'approved'
       JOIN world_settlements destination
         ON destination.id = l.to_settlement_id AND destination.editorial_status = 'approved'
       WHERE l.link_key = $1 AND l.editorial_status = 'approved'
         AND l.from_settlement_id IS NOT NULL
         AND cardinality(l.access_requirements) = 0
       FOR SHARE OF l`,
      [input.routeKey]
    );
    const selectedRoute = route.rows[0];
    if (!selectedRoute || !selectedRoute.estimated_duration_minutes) {
      throw new Error("L'itinéraire doit être approuvé, relier deux localités et posséder une durée validée.");
    }

    const placement = await client.query<{ active_count: number; at_origin: boolean }>(
      `SELECT COUNT(*)::INTEGER AS active_count,
              COALESCE(BOOL_OR(settlement_id = $2), FALSE) AS at_origin
       FROM npc_settlement_locations
       WHERE npc_key = $1 AND is_active = TRUE`,
      [input.npcKey, selectedRoute.from_settlement_id]
    );
    if (placement.rows[0]?.active_count !== 1 || !placement.rows[0]?.at_origin) {
      throw new Error("Le PNJ doit avoir exactement un placement actif, à l'origine de cet itinéraire.");
    }

    const activePlan = await client.query(
      `SELECT 1 FROM npc_travel_plans
       WHERE npc_key = $1 AND status IN ('planned', 'in_transit')
       FOR UPDATE`,
      [input.npcKey]
    );
    if (activePlan.rowCount) throw new Error("Ce PNJ possède déjà un voyage planifié ou en cours.");

    const duration = selectedRoute.estimated_duration_minutes;
    const arrivalWorldMinute = input.departureWorldMinute + duration;
    if (!Number.isSafeInteger(arrivalWorldMinute)) {
      throw new Error("La date d'arrivée dépasse la capacité de l'horloge Etheria.");
    }

    const created = await client.query<{ id: string }>(
      `INSERT INTO npc_travel_plans
       (npc_key, route_key, origin_settlement_id, destination_settlement_id,
        departure_world_minute, arrival_world_minute)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [input.npcKey, input.routeKey, selectedRoute.from_settlement_id,
        selectedRoute.to_settlement_id, input.departureWorldMinute, arrivalWorldMinute]
    );
    const planId = created.rows[0]?.id;
    if (!planId) throw new Error("Le voyage PNJ n'a pas pu être créé.");
    await client.query("COMMIT");
    return {
      planId,
      npcKey: input.npcKey,
      routeKey: input.routeKey,
      departureWorldMinute: input.departureWorldMinute,
      arrivalWorldMinute
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
