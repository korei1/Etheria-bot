import "dotenv/config";
import {
  baselineInitialMigration,
  getMigrationPlan,
  runMigrations
} from "./migration-runner.js";
import { closeDatabaseConnection, getDatabasePool } from "./client.js";

function printError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Erreur inconnue.";
  console.error(`[DATABASE] ${message}`);
}

const args = process.argv.slice(2);
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("[DATABASE] DATABASE_URL est absent des variables d'environnement.");
  process.exitCode = 1;
} else {
  const pool = getDatabasePool(databaseUrl);

  try {
    if (args.length === 1 && args[0] === "--status") {
      const plan = await getMigrationPlan(pool);
      console.log(`[DATABASE] Migrations enregistrées : ${plan.applied.length}`);
      for (const migration of plan.applied) {
        console.log(`  ✓ ${migration.migration_name}${migration.is_baseline ? " (baseline)" : ""}`);
      }
      console.log(`[DATABASE] Migrations en attente : ${plan.pending.length}`);
      for (const migration of plan.pending) console.log(`  • ${migration.name}`);
      if (plan.baselineRequired) {
        console.error(
          `[DATABASE] Baseline nécessaire : schéma existant détecté (${plan.existingCoreTables.join(", ")}).`
        );
        process.exitCode = 2;
      }
    } else if (args.length === 1 && args[0] === "--dry-run") {
      const plan = await runMigrations(pool, { dryRun: true });
      if ("baselineRequired" in plan && plan.baselineRequired) {
        console.error(
          `[DATABASE] Aucune modification effectuée. Baseline nécessaire pour le socle existant : ${plan.existingCoreTables.join(", ")}.`
        );
        process.exitCode = 2;
      } else {
        console.log("[DATABASE] Simulation uniquement : aucune requête de modification exécutée.");
        for (const migration of plan.pending) console.log(`  • À appliquer : ${migration.name}`);
        if (plan.pending.length === 0) console.log("[DATABASE] Aucune migration en attente.");
      }
    } else if (
      args.length === 2 &&
      args[0] === "--baseline" &&
      args[1] === "0001_initial_core.sql"
    ) {
      await baselineInitialMigration(pool);
      console.log(
        "[DATABASE] Baseline 0001 enregistrée après vérification du schéma. Aucun SQL de migration n'a été exécuté."
      );
    } else if (args.length === 0) {
      const result = await runMigrations(pool);
      console.log(`[DATABASE] Migrations appliquées : ${result.applied.length}`);
      for (const name of result.applied) console.log(`  ✓ ${name}`);
      if (result.applied.length === 0) console.log("[DATABASE] Aucune migration à appliquer.");
    } else {
      throw new Error(
        "Arguments invalides. Utilisez --status, --dry-run ou --baseline 0001_initial_core.sql."
      );
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnection().catch(() => {
      console.error("[DATABASE] La fermeture du pool a rencontré une erreur.");
      process.exitCode = 1;
    });
  }
}
