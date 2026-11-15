/**
 * Horloge mondiale et fuseaux locaux d'Etheria.
 *
 * Un seul compteur absolu fait avancer le monde. Les fuseaux ne changent que
 * l'heure civile affichée dans une localité, jamais le temps simulé commun.
 * Aucun fuseau, méridien ou rythme d'écoulement n'est présumé.
 */

import type { WorldDate } from "./local-life-simulation.js";
import { toWorldDayOrdinal } from "./local-life-simulation.js";

export const WORLD_MINUTES_PER_DAY = 1440;
export const WORLD_DAYS_PER_YEAR = 120;
export const WORLD_MINUTES_PER_YEAR = WORLD_MINUTES_PER_DAY * WORLD_DAYS_PER_YEAR;

export interface WorldClockState {
  /** Minutes Etheria écoulées depuis le début du jour 1, année 1. */
  worldMinute: number;
  /** Date réelle UTC du dernier ancrage de progression. */
  anchoredAt: Date;
  /** Minutes Etheria écoulées par minute réelle. */
  worldMinutesPerRealMinute: number;
  paused: boolean;
}

export interface WorldTimeZone {
  key: string;
  displayName: string;
  /** Décalage local en minutes par rapport au méridien de référence Etheria. */
  utcOffsetMinutes: number;
  /** Longitude facultative, en degrés est/ouest, pour documentation et calcul initial. */
  longitudeDegrees?: number | null;
  /** Règle d'heure saisonnière non prise en charge en V1. */
  seasonalClockChange: false;
}

export interface LocalWorldDate extends WorldDate {
  minuteOfDay: number;
  weekday: number;
  cycle: number;
  dayOfCycle: number;
  utcOffsetMinutes: number;
  timeZoneKey: string;
}

export function validateWorldTimeZone(zone: WorldTimeZone): string[] {
  const issues: string[] = [];
  if (!/^[a-z][a-z0-9_]*$/.test(zone.key) || !zone.displayName.trim()) {
    issues.push("Le fuseau doit avoir une clé et un nom valides.");
  }
  if (!Number.isInteger(zone.utcOffsetMinutes) ||
      zone.utcOffsetMinutes < -12 * 60 || zone.utcOffsetMinutes > 14 * 60) {
    issues.push("Le décalage doit être compris entre -12 h et +14 h.");
  }
  if (zone.longitudeDegrees !== undefined && zone.longitudeDegrees !== null &&
      (!Number.isFinite(zone.longitudeDegrees) ||
       zone.longitudeDegrees < -180 || zone.longitudeDegrees > 180)) {
    issues.push("La longitude doit être comprise entre -180° et +180°.");
  }
  if (zone.seasonalClockChange !== false) {
    issues.push("Les changements saisonniers d'heure ne sont pas pris en charge en V1.");
  }
  return issues;
}

/** Estime le fuseau solaire terrestre par bandes de 15° ; le résultat doit être validé. */
export function estimateOffsetFromLongitude(longitudeDegrees: number): number {
  if (!Number.isFinite(longitudeDegrees) ||
      longitudeDegrees < -180 || longitudeDegrees > 180) {
    throw new Error("Longitude invalide.");
  }
  return Math.max(-12 * 60, Math.min(14 * 60,
    Math.round(longitudeDegrees / 15) * 60));
}

/** Projette l'horloge réelle vers un instant Etheria sans modifier l'état persistant. */
export function projectWorldMinute(state: WorldClockState, now: Date): number {
  if (!Number.isSafeInteger(state.worldMinute) || state.worldMinute < 0 ||
      !Number.isFinite(state.worldMinutesPerRealMinute) ||
      state.worldMinutesPerRealMinute < 0 ||
      !Number.isFinite(state.anchoredAt.getTime()) ||
      !Number.isFinite(now.getTime())) {
    throw new Error("État de l'horloge Etheria invalide.");
  }
  if (state.paused || now.getTime() <= state.anchoredAt.getTime()) {
    return state.worldMinute;
  }
  const elapsedRealMinutes = (now.getTime() - state.anchoredAt.getTime()) / 60_000;
  const elapsedWorldMinutes = Math.floor(elapsedRealMinutes * state.worldMinutesPerRealMinute);
  const result = state.worldMinute + elapsedWorldMinutes;
  if (!Number.isSafeInteger(result)) throw new Error("L'horloge Etheria dépasse sa capacité.");
  return result;
}

export function getLocalWorldDate(
  worldMinute: number,
  zone: WorldTimeZone
): LocalWorldDate {
  const issues = validateWorldTimeZone(zone);
  if (issues.length) throw new Error(issues.join(" "));
  if (!Number.isSafeInteger(worldMinute) || worldMinute < 0) {
    throw new Error("Minute absolue Etheria invalide.");
  }

  const localAbsoluteMinute = worldMinute + zone.utcOffsetMinutes;
  const localDayOrdinal = Math.floor(localAbsoluteMinute / WORLD_MINUTES_PER_DAY) + 1;
  const minuteOfDay = ((localAbsoluteMinute % WORLD_MINUTES_PER_DAY) +
    WORLD_MINUTES_PER_DAY) % WORLD_MINUTES_PER_DAY;
  if (localDayOrdinal < 1) {
    throw new Error("Le fuseau place l'heure avant le début du calendrier Etheria.");
  }

  const year = Math.floor((localDayOrdinal - 1) / WORLD_DAYS_PER_YEAR) + 1;
  const dayOfYear = ((localDayOrdinal - 1) % WORLD_DAYS_PER_YEAR) + 1;
  const date: WorldDate = { year, dayOfYear };
  const dayOrdinal = toWorldDayOrdinal(date);

  return {
    ...date,
    minuteOfDay,
    weekday: ((dayOrdinal - 1) % 7) + 1,
    cycle: Math.floor((dayOfYear - 1) / 24) + 1,
    dayOfCycle: ((dayOfYear - 1) % 24) + 1,
    utcOffsetMinutes: zone.utcOffsetMinutes,
    timeZoneKey: zone.key
  };
}

export function formatLocalWorldTime(date: LocalWorldDate): string {
  const hours = Math.floor(date.minuteOfDay / 60).toString().padStart(2, "0");
  const minutes = (date.minuteOfDay % 60).toString().padStart(2, "0");
  return `Année ${date.year}, jour ${date.dayOfYear} · ${hours}:${minutes}`;
}
