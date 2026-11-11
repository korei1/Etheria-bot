import { Events } from "discord.js";
import { logger } from "../core/logger.js";

export default {
  name: Events.Error,
  execute(error: Error) {
    logger.error("Erreur du client Discord.", error);
  }
};
