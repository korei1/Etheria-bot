import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./core/config.js";
import { loadEvents } from "./core/event-loader.js";
import { logger } from "./core/logger.js";

const config = loadConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

await loadEvents(client);

try {
  await client.login(config.discordToken);
} catch (error) {
  logger.error("Impossible de connecter Etheria à Discord.", error);
  process.exitCode = 1;
}
