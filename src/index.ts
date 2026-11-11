import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error(
    "DISCORD_TOKEN est manquant. Configurez-le dans les variables d'environnement."
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Etheria est connecté en tant que ${readyClient.user.tag}.`);
});

client.on(Events.Error, (error) => {
  console.error("Erreur du client Discord :", error);
});

await client.login(token);
