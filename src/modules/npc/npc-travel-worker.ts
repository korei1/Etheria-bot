import type { Pool } from "pg";
import { advanceNpcTravelPlans } from "./npc-travel-service.js";

export interface NpcTravelWorkerOptions {
  intervalMs?: number;
  onError?: (error: unknown) => void;
}

/**
 * Synchronise périodiquement les voyages échus sans attendre une interaction.
 * Le service métier relit l'horloge Etheria à chaque passage : une horloge en
 * pause ne fait donc pas avancer les trajets.
 */
export function startNpcTravelWorker(
  pool: Pool,
  options: NpcTravelWorkerOptions = {}
): () => Promise<void> {
  const intervalMs = options.intervalMs ?? 15_000;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000) {
    throw new Error("L'intervalle du worker de voyages PNJ doit être d'au moins 1000 ms.");
  }

  let stopped = false;
  let inFlight: Promise<void> | undefined;

  const run = (): void => {
    if (stopped || inFlight) return;
    inFlight = advanceNpcTravelPlans(pool)
      .then(() => undefined)
      .catch((error: unknown) => {
        try {
          options.onError?.(error);
        } catch {
          // Une erreur de journalisation ne doit pas tuer la boucle de synchronisation.
        }
      })
      .finally(() => {
        inFlight = undefined;
      });
  };

  const timer = setInterval(run, intervalMs);
  timer.unref();
  run();

  return async () => {
    stopped = true;
    clearInterval(timer);
    await inFlight;
  };
}
