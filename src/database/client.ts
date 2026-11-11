import { Pool } from "pg";

let pool: Pool | undefined;

/**
 * Crée le pool PostgreSQL à la demande.
 * L'URL de connexion reste fournie par l'environnement et n'est jamais journalisée.
 */
export function getDatabasePool(databaseUrl: string | undefined): Pool {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL est manquant. Configurez la connexion PostgreSQL avant d'utiliser les fonctions de base de données."
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "etheria-bot"
    });

    pool.on("error", (error) => {
      // Ne jamais afficher l'URL de connexion ni d'autres secrets.
      console.error("[DATABASE] Erreur sur une connexion PostgreSQL inactive.", error.message);
    });
  }

  return pool;
}

/** Vérifie la connexion sans exposer d'information sensible. */
export async function checkDatabaseConnection(databaseUrl: string | undefined): Promise<void> {
  const database = getDatabasePool(databaseUrl);
  await database.query("SELECT 1");
}

/** Ferme proprement le pool lors de l'arrêt du processus. */
export async function closeDatabaseConnection(): Promise<void> {
  if (!pool) return;
  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
