import type { Pool } from "pg";
import { isOpenAtLocalMinute } from "./local-life-simulation.js";
import { getSettlementLocalTime, type SettlementClockResult } from "./world-clock-service.js";

export type LocalLifeKind = "activity" | "service" | "shop" | "event";

export interface LocalLifeStockView {
  key: string;
  displayName: string;
  priceTeas: string;
  quantity: number;
  maximumQuantity: number;
}

export interface LocalLifeEntryView {
  key: string;
  displayName: string;
  kind: LocalLifeKind;
  description: string;
  openingSchedule: { days: Array<{ weekday: number; intervals: Array<{ opensAtMinute: number; closesAtMinute: number }> }> } | null;
  startDay: number | null;
  endDay: number | null;
  isOpenNow: boolean | null;
  isHappeningNow: boolean | null;
  stock: LocalLifeStockView[];
}

export type CurrentLocalLifeResult =
  | { status: "no_active_character" }
  | { status: "not_in_settlement" }
  | { status: "settlement_not_discovered" }
  | {
      status: "available";
      settlementName: string;
      localClock: SettlementClockResult;
      entries: LocalLifeEntryView[];
    };

interface SettlementRow {
  settlement_id: string | null;
  settlement_name: string | null;
  settlement_key: string | null;
}

interface LocalLifeRow {
  content_key: string;
  display_name: string;
  content_kind: LocalLifeKind;
  description: string;
  opening_schedule: LocalLifeEntryView["openingSchedule"];
  start_day: number | null;
  end_day: number | null;
  stock_key: string | null;
  stock_name: string | null;
  price_teas: string | null;
  quantity: number | null;
  maximum_quantity: number | null;
}

/** Lit la vie locale et la confronte à l'heure réelle du fuseau de la localité. */
export async function getCurrentLocalLife(
  pool: Pool,
  accountId: string,
  now: Date = new Date()
): Promise<CurrentLocalLifeResult> {
  if (!accountId.trim()) throw new Error("Compte joueur absent.");

  const location = await pool.query<SettlementRow>(
    `SELECT c.current_settlement_id AS settlement_id,
            s.display_name AS settlement_name,
            s.settlement_key
     FROM characters c
     LEFT JOIN world_settlements s
       ON s.id = c.current_settlement_id
      AND s.editorial_status = 'approved'
     WHERE c.account_id = $1 AND c.status = 'active'
     LIMIT 1`,
    [accountId]
  );
  const character = location.rows[0];
  if (!character) return { status: "no_active_character" };
  if (!character.settlement_id || !character.settlement_name || !character.settlement_key) {
    return { status: "not_in_settlement" };
  }

  const discovered = await pool.query(
    `SELECT 1
     FROM world_discoveries
     WHERE account_id = $1
       AND target_kind = 'settlement'
       AND target_key = $2
     LIMIT 1`,
    [accountId, character.settlement_key]
  );
  if (!discovered.rowCount) return { status: "settlement_not_discovered" };

  const localClock = await getSettlementLocalTime(pool, character.settlement_id, now);
  const result = await pool.query<LocalLifeRow>(
    `SELECT c.content_key, c.display_name, c.content_kind, c.description,
            c.opening_schedule, c.start_day, c.end_day,
            st.stock_key, st.display_name AS stock_name,
            st.price_teas::TEXT, st.quantity, st.maximum_quantity
     FROM world_local_content c
     LEFT JOIN world_local_shop_stock st ON st.local_content_id = c.id
     WHERE c.settlement_id = $1
       AND c.editorial_status = 'approved'
       AND c.visibility = 'public'
     ORDER BY c.content_kind, c.display_name, st.display_name
     LIMIT 150`,
    [character.settlement_id]
  );

  const hasLocalDate = localClock.status === "available";
  const entries = new Map<string, LocalLifeEntryView>();
  for (const row of result.rows) {
    let entry = entries.get(row.content_key);
    if (!entry) {
      const isOpenNow = hasLocalDate && row.opening_schedule
        ? isOpenAtLocalMinute(
            row.opening_schedule,
            localClock.localDate.weekday,
            localClock.localDate.minuteOfDay
          )
        : null;
      const isHappeningNow = hasLocalDate && row.content_kind === "event" &&
        row.start_day !== null && row.end_day !== null
        ? localClock.localDate.dayOfYear >= row.start_day &&
          localClock.localDate.dayOfYear <= row.end_day
        : null;
      entry = {
        key: row.content_key,
        displayName: row.display_name,
        kind: row.content_kind,
        description: row.description,
        openingSchedule: row.opening_schedule,
        startDay: row.start_day,
        endDay: row.end_day,
        isOpenNow,
        isHappeningNow,
        stock: []
      };
      entries.set(row.content_key, entry);
    }
    if (row.stock_key && row.stock_name !== null && row.price_teas !== null &&
        row.quantity !== null && row.maximum_quantity !== null) {
      entry.stock.push({
        key: row.stock_key,
        displayName: row.stock_name,
        priceTeas: row.price_teas,
        quantity: row.quantity,
        maximumQuantity: row.maximum_quantity
      });
    }
  }

  return {
    status: "available",
    settlementName: character.settlement_name,
    localClock,
    entries: [...entries.values()]
  };
}

const WEEKDAY_LABELS = ["", "Jour 1", "Jour 2", "Jour 3", "Jour 4", "Jour 5", "Jour 6", "Jour 7"];

function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60).toString().padStart(2, "0");
  const minutes = (minute % 60).toString().padStart(2, "0");
  return hours + ":" + minutes;
}

/** Présentation des horaires configurés, sans inventer une heure actuelle ou un statut ouvert/fermé. */
export function formatLocalOpeningSchedule(
  schedule: LocalLifeEntryView["openingSchedule"]
): string {
  if (!schedule) return "Horaires non renseignés";
  if (schedule.days.length === 0) return "Fermé toute la semaine";
  return schedule.days
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((day) => {
      const label = WEEKDAY_LABELS[day.weekday] ?? ("Jour " + day.weekday);
      const intervals = day.intervals.map((interval) =>
        formatMinute(interval.opensAtMinute) + "–" + formatMinute(interval.closesAtMinute)
      );
      return label + " : " + (intervals.length ? intervals.join(", ") : "fermé");
    })
    .join(" · ");
}

export function formatLocalAvailability(entry: LocalLifeEntryView): string {
  if (entry.kind === "event") {
    if (entry.isHappeningNow === true) return "En cours actuellement";
    if (entry.isHappeningNow === false) return "Pas en cours actuellement";
  }
  if (entry.isOpenNow === true) return "Ouvert actuellement";
  if (entry.isOpenNow === false) return "Fermé actuellement";
  return entry.openingSchedule ? "Statut horaire indisponible" : "Horaires non renseignés";
}
