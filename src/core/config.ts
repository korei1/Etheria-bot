export interface BotConfig {
  discordToken: string;
}

export function loadConfig(): BotConfig {
  const discordToken = process.env.DISCORD_TOKEN;

  if (!discordToken) {
    throw new Error(
      "DISCORD_TOKEN est manquant. Configurez-le dans les variables d'environnement."
    );
  }

  return { discordToken };
}
