import type { Pool } from "pg";
import {
  formatLocalWorldTime,
  getLocalWorldDate,
  projectWorldMinute,
  type LocalWorldDate,
  type WorldClockState,
  type WorldTimeZone
} from "./world-clock.js";

export type SettlementClockResult =
  | { status: "settlement_not_found" }
  | { status: "time_zone_not_configured" }
  | { status: "available"; localDate: LocalWorldDate; formatted: string; worldMinute: number };

interface SettlementClockRow {
  world_minute: string;
  anchored_at: Date;
  world_minutes_per_real_minute: string;
  is_paused: boolean;
  zone_key: string | null;
  zone_name: string | null;
  utc_offset_minutes: number | null;
  longitude_degrees: string | null;
}

/**
 * Calcule l'heure locale d'une localité depuis l'unique horloge mondiale.
 * Une localité sans fuseau approuvé ne reçoit volontairement aucune heure inventée.
 */
export async function getSettlementLocalTime(
  pool: Pool,
  settlementId: string,
  now: Date = new Date()
): Promise<SettlementClockResult> {
  if (!settlementId.trim()) throw new Error("Identifiant de localité absent.");

  const result = await pool.query<SettlementClockRow>(
    `SELECT wc.world_minute::TEXT, wc.anchored_at,
            wc.world_minutes_per_real_minute::TEXT,
            wc.is_paused,
            tz.zone_key, tz.display_name AS zone_name,
            tz.utc_offset_minutes, tz.longitude_degrees::TEXT
     FROM world_settlements s
     CROSS JOIN world_clock wc
     LEFT JOIN world_time_zones tz
       ON tz.id = s.time_zone_id
      AND tz.editorial_status = 'approved'
     WHERE s.id = $1
       AND s.editorial_status = 'approved'
       AND wc.singleton = TRUE
     LIMIT 1`,
    [settlementId]
  );

  const row = result.rows[0];
  if (!row) return { status: "settlement_not_found" };
  if (!row.zone_key || !row.zone_name || row.utc_offset_minutes === null) {
    return { status: "time_zone_not_configured" };
  }

  const worldMinute = Number(row.world_minute);
  const rate = Number(row.world_minutes_per_real_minute);
  if (!Number.isSafeInteger(worldMinute) || !Number.isFinite(rate)) {
    throw new Error("Les données persistées de l'horloge Etheria sont invalides.");
  }

  const state: WorldClockState = {
    worldMinute,
    anchoredAt: row.anchored_at,
    worldMinutesPerRealMinute: rate,
    paused: row.is_paused
  };
  const zone: WorldTimeZone = {
    key: row.zone_key,
    displayName: row.zone_name,
    utcOffsetMinutes: row.utc_offset_minutes,
    longitudeDegrees: row.longitude_degrees === null ? null : Number(row.longitude_degrees),
    seasonalClockChange: false
  };
  const projectedMinute = projectWorldMinute(state, now);
  const localDate = getLocalWorldDate(projectedMinute, zone);

  return {
    status: "available",
    localDate,
    formatted: formatLocalWorldTime(localDate),
    worldMinute: projectedMinute
  };
}
