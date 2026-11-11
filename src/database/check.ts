import "dotenv/config";
import {
  checkDatabaseConnection,
  closeDatabaseConnection
} from "./client.js";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("[DATABASE] DATABASE_URL est absent des variables d'environnement.");
  process.exitCode = 1;
} else {
  try {
    await checkDatabaseConnection(databaseUrl);
    console.log("[DATABASE] Connexion PostgreSQL réussie.");
  } catch {
    console.error(
      "[DATABASE] Connexion impossible. Vérifiez DATABASE_URL, le pooler Supabase et l'accès réseau."
    );
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnection().catch(() => {
      console.error("[DATABASE] La fermeture du pool a rencontré une erreur.");
      process.exitCode = 1;
    });
  }
}
