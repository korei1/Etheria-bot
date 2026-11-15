import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./core/config.js";
import { loadEvents } from "./core/event-loader.js";
import {
  checkDatabaseConnection,
  closeDatabaseConnection,
  getDatabasePool
} from "./database/client.js";
import { logger } from "./core/logger.js";
import { startNpcTravelWorker } from "./modules/npc/npc-travel-worker.js";

const config = loadConfig();

let stopNpcTravelWorker: (() => Promise<void>) | undefined;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

await loadEvents(client);

try {
  if (config.databaseUrl) {
    await checkDatabaseConnection(config.databaseUrl);
    logger.info("Connexion à la base PostgreSQL vérifiée.");
    stopNpcTravelWorker = startNpcTravelWorker(getDatabasePool(config.databaseUrl), {
      onError: (error) => logger.error("Échec de synchronisation des voyages PNJ.", error)
    });
    logger.info("Synchronisation autonome des voyages PNJ démarrée.");
  } else {
    logger.warn(
      "DATABASE_URL absent : le bot démarre sans accès aux fonctionnalités nécessitant la base de données."
    );
  }

  await client.login(config.discordToken);
} catch (error) {
  const message = error instanceof Error ? error.message : "Erreur inconnue";
  logger.error("Impossible de démarrer Etheria correctement.", message);
  await stopNpcTravelWorker?.().catch(() => undefined);
  stopNpcTravelWorker = undefined;
  await closeDatabaseConnection().catch(() => undefined);
  process.exitCode = 1;
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Arrêt demandé (${signal}).`);
  client.destroy();
  try {
    await stopNpcTravelWorker?.();
    stopNpcTravelWorker = undefined;
    await closeDatabaseConnection();
    logger.info("Connexions à la base de données fermées.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    logger.error("Erreur lors de la fermeture de la base de données.", message);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
