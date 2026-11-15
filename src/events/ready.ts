import { Events, type ClientEvents } from "discord.js";
import { logger } from "../core/logger.js";
import { etheriaCommand } from "../commands/etheria.js";
import { bestiaryAdminCommand } from "../commands/bestiary-admin.js";
import { startCommand } from "../commands/start.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(...[client]: ClientEvents[typeof Events.ClientReady]) {
    try {
      const commands = await client.application.commands.fetch();
      for (const definition of [etheriaCommand, bestiaryAdminCommand, startCommand]) {
        const existingCommand = commands.find((command) => command.name === definition.name);
        if (existingCommand) {
          await client.application.commands.edit(existingCommand.id, definition);
        } else {
          await client.application.commands.create(definition);
        }
      }

      logger.info("Commandes Discord /commencer, /etheria et /etheria-admin enregistrées.");
    } catch {
      logger.error("Impossible d'enregistrer la commande Discord /etheria.");
    }

    logger.info(`Etheria est connecté en tant que ${client.user.tag}.`);
  }
};
