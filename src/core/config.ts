export interface BotConfig {
  discordToken: string;
  databaseUrl?: string;
}

export function loadConfig(): BotConfig {
  const discordToken = process.env.DISCORD_TOKEN;
  const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;

  if (!discordToken) {
    throw new Error(
      "DISCORD_TOKEN est manquant. Configurez-le dans les variables d'environnement."
    );
  }

  if (
    databaseUrl &&
    !databaseUrl.startsWith("postgres://") &&
    !databaseUrl.startsWith("postgresql://")
  ) {
    throw new Error(
      "DATABASE_URL doit être une URL PostgreSQL valide (postgres:// ou postgresql://)."
    );
  }

  return { discordToken, databaseUrl };
}
