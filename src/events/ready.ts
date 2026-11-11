import { Events, type ClientEvents } from "discord.js";
import { logger } from "../core/logger.js";

export default {
  name: Events.ClientReady,
  once: true,
  execute(...[client]: ClientEvents[typeof Events.ClientReady]) {
    logger.info(`Etheria est connecté en tant que ${client.user.tag}.`);
  }
};
