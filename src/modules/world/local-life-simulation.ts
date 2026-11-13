/**
 * Simulation déterministe de la vie quotidienne des localités.
 *
 * Les heures sont celles du calendrier fictif d'Etheria : aucune zone horaire
 * terrestre n'est imposée. Les horaires et stocks restent des données éditoriales.
 */

export interface OpeningInterval {
  /** Minute du jour, entre 0 et 1439. */
  opensAtMinute: number;
  /** Minute de fermeture, strictement supérieure à l'ouverture et au plus 1440. */
  closesAtMinute: number;
}

export interface WeeklyOpeningDay {
  /** Jour de semaine Etheria, de 1 à 7. */
  weekday: number;
  intervals: readonly OpeningInterval[];
}

export interface WeeklyOpeningSchedule {
  days: readonly WeeklyOpeningDay[];
}

export interface LocalStockItem {
  key: string;
  displayName: string;
  priceTeas: number;
  quantity: number;
  maximumQuantity: number;
  restockEveryDays: number | null;
  lastRestockOrdinal: number | null;
}

export interface WorldDate {
  year: number;
  dayOfYear: number;
}

export function validateOpeningSchedule(schedule: WeeklyOpeningSchedule): string[] {
  const issues: string[] = [];
  const seenDays = new Set<number>();
  for (const day of schedule.days) {
    if (!Number.isInteger(day.weekday) || day.weekday < 1 || day.weekday > 7) {
      issues.push("Un jour d'ouverture doit être compris entre 1 et 7.");
    }
    if (seenDays.has(day.weekday)) issues.push(`Le jour ${day.weekday} est défini plusieurs fois.`);
    seenDays.add(day.weekday);
    let previousClose = -1;
    for (const interval of day.intervals) {
      if (!Number.isInteger(interval.opensAtMinute) ||
          !Number.isInteger(interval.closesAtMinute) ||
          interval.opensAtMinute < 0 || interval.opensAtMinute >= 1440 ||
          interval.closesAtMinute > 1440 ||
          interval.closesAtMinute <= interval.opensAtMinute) {
        issues.push(`Intervalle horaire invalide pour le jour ${day.weekday}.`);
        continue;
      }
      if (interval.opensAtMinute < previousClose) {
        issues.push(`Les horaires du jour ${day.weekday} se chevauchent ou ne sont pas triés.`);
      }
      previousClose = interval.closesAtMinute;
    }
  }
  return issues;
}

/** Sans horaires renseignés, le contenu n'impose aucune fermeture horaire. */
export function isOpenAtLocalMinute(
  schedule: WeeklyOpeningSchedule | null | undefined,
  weekday: number,
  minuteOfDay: number
): boolean {
  if (!schedule) return true;
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 ||
      !Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= 1440) {
    return false;
  }
  const day = schedule.days.find((entry) => entry.weekday === weekday);
  return day?.intervals.some((interval) =>
    minuteOfDay >= interval.opensAtMinute && minuteOfDay < interval.closesAtMinute
  ) ?? false;
}

/** Convertit une date Etheria (année + jour 1..120) en compteur absolu de jours. */
export function toWorldDayOrdinal(date: WorldDate): number {
  if (!Number.isInteger(date.year) || date.year < 1 ||
      !Number.isInteger(date.dayOfYear) || date.dayOfYear < 1 || date.dayOfYear > 120) {
    throw new Error("Date Etheria invalide : une année positive et un jour de 1 à 120 sont requis.");
  }
  return (date.year - 1) * 120 + date.dayOfYear;
}

export function validateLocalStockItem(item: LocalStockItem): string[] {
  const issues: string[] = [];
  if (!/^[a-z][a-z0-9_]*$/.test(item.key) || !item.displayName.trim()) {
    issues.push("La clé et le nom de l'article sont obligatoires et doivent être valides.");
  }
  if (!Number.isSafeInteger(item.priceTeas) || item.priceTeas < 0) {
    issues.push("Le prix doit être un nombre entier de Teas positif ou nul.");
  }
  if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 ||
      !Number.isSafeInteger(item.maximumQuantity) || item.maximumQuantity < 0 ||
      item.quantity > item.maximumQuantity) {
    issues.push("Le stock doit être compris entre zéro et sa capacité maximale.");
  }
  if (item.restockEveryDays !== null &&
      (!Number.isInteger(item.restockEveryDays) || item.restockEveryDays < 1)) {
    issues.push("L'intervalle de réapprovisionnement doit être un nombre de jours positif.");
  }
  if (item.lastRestockOrdinal !== null &&
      (!Number.isSafeInteger(item.lastRestockOrdinal) || item.lastRestockOrdinal < 1)) {
    issues.push("La date du dernier réapprovisionnement est invalide.");
  }
  return issues;
}

export function restockLocalItem(item: LocalStockItem, currentOrdinal: number): LocalStockItem {
  if (!Number.isSafeInteger(currentOrdinal) || currentOrdinal < 1) {
    throw new Error("Le jour courant Etheria est invalide.");
  }
  if (item.restockEveryDays === null || item.lastRestockOrdinal === null ||
      currentOrdinal <= item.lastRestockOrdinal) return item;
  const elapsed = currentOrdinal - item.lastRestockOrdinal;
  const periods = Math.floor(elapsed / item.restockEveryDays);
  if (periods < 1) return item;
  return {
    ...item,
    quantity: item.maximumQuantity,
    lastRestockOrdinal: item.lastRestockOrdinal + periods * item.restockEveryDays
  };
}

/** Retire du stock sans jamais autoriser une quantité négative. */
export function consumeLocalStock(item: LocalStockItem, amount: number): LocalStockItem {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error("La quantité demandée doit être un entier positif.");
  }
  if (amount > item.quantity) throw new Error("Stock local insuffisant.");
  return { ...item, quantity: item.quantity - amount };
}
