import {
  getLocalWorldDate,
  WORLD_MINUTES_PER_DAY,
  type WorldTimeZone
} from "../world/world-clock.js";

export interface NpcWeeklyTravelSchedule {
  /** Jours locaux Etheria : 1 à 7, selon le calendrier hebdomadaire commun. */
  weekdays: readonly number[];
  /** Minute locale de départ, entre 0 et 1439. */
  departureMinute: number;
  routeKey: string;
}

export function validateNpcWeeklyTravelSchedule(
  schedule: NpcWeeklyTravelSchedule
): string[] {
  const issues: string[] = [];
  if (!Array.isArray(schedule.weekdays) ||
      schedule.weekdays.length === 0 ||
      schedule.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    issues.push("Le calendrier doit contenir au moins un jour local compris entre 1 et 7.");
  } else if (new Set(schedule.weekdays).size !== schedule.weekdays.length) {
    issues.push("Un jour ne peut apparaître qu'une seule fois dans le calendrier.");
  }
  if (!Number.isInteger(schedule.departureMinute) ||
      schedule.departureMinute < 0 ||
      schedule.departureMinute >= WORLD_MINUTES_PER_DAY) {
    issues.push("La minute locale de départ doit être comprise entre 0 et 1439.");
  }
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(schedule.routeKey)) {
    issues.push("La clé de l'itinéraire est invalide.");
  }
  return issues;
}

/**
 * Calcule la prochaine occurrence hebdomadaire en heure locale, puis la
 * convertit en minute absolue Etheria. Le calendrier ne crée ni route ni
 * déplacement : l'itinéraire doit être validé séparément par le service.
 */
export function getNextNpcTravelOccurrence(
  currentWorldMinute: number,
  zone: WorldTimeZone,
  schedule: NpcWeeklyTravelSchedule
): number {
  const issues = validateNpcWeeklyTravelSchedule(schedule);
  if (issues.length) throw new Error(issues.join(" "));
  if (!Number.isSafeInteger(currentWorldMinute) || currentWorldMinute < 0) {
    throw new Error("Minute mondiale courante invalide.");
  }

  const localNow = getLocalWorldDate(currentWorldMinute, zone);
  const currentLocalDayOrdinal =
    (localNow.year - 1) * 120 + localNow.dayOfYear;

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const localDayOrdinal = currentLocalDayOrdinal + dayOffset;
    const weekday = ((localDayOrdinal - 1) % 7) + 1;
    if (!schedule.weekdays.includes(weekday)) continue;

    const candidate =
      (localDayOrdinal - 1) * WORLD_MINUTES_PER_DAY +
      schedule.departureMinute -
      zone.utcOffsetMinutes;

    if (candidate >= currentWorldMinute && candidate >= 0) return candidate;
  }

  throw new Error("Aucune prochaine occurrence hebdomadaire valide n'a été trouvée.");
}
