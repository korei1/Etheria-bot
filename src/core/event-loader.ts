import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import { logger } from "./logger.js";

interface EventModule {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => void | Promise<void>;
}

export async function loadEvents(client: Client): Promise<void> {
  const eventsDirectory = join(import.meta.dirname, "../events");
  const files = (await readdir(eventsDirectory))
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const file of files) {
    const fileUrl = pathToFileURL(join(eventsDirectory, file)).href;
    const importedModule = await import(fileUrl);
    const event = importedModule.default as EventModule | undefined;

    if (!event || typeof event.name !== "string" || typeof event.execute !== "function") {
      logger.warn(`Événement ignoré : ${file} (format invalide).`);
      continue;
    }

    const listener = (...args: any[]) => {
      void Promise.resolve(event.execute(...args)).catch((error: unknown) => {
        logger.error(`Erreur dans l'événement ${event.name}.`, error);
      });
    };

    if (event.once) {
      client.once(event.name as never, listener as never);
    } else {
      client.on(event.name as never, listener as never);
    }

    logger.info(`Événement chargé : ${event.name}`);
  }
}
