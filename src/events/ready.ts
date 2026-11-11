import { Events, type ClientEvents } from "discord.js";
import { logger } from "../core/logger.js";
import { etheriaCommand } from "../commands/etheria.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(...[client]: ClientEvents[typeof Events.ClientReady]) {
    try {
      const commands = await client.application.commands.fetch();
      const existingCommand = commands.find(
        (command) => command.name === etheriaCommand.name
      );

      if (existingCommand) {
        await client.application.commands.edit(existingCommand.id, etheriaCommand);
      } else {
        await client.application.commands.create(etheriaCommand);
      }

      logger.info("Commande Discord /etheria enregistrée.");
    } catch {
      logger.error("Impossible d'enregistrer la commande Discord /etheria.");
    }

    logger.info(`Etheria est connecté en tant que ${client.user.tag}.`);
  }
};
