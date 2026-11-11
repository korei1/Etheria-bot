import type { Pool, PoolClient } from "pg";

export interface GetOrCreateAccountInput {
  provider: string;
  providerUserId: string;
  displayName: string;
}

export interface EtheriaAccount {
  accountId: string;
  displayName: string;
  created: boolean;
}

async function ensureWallet(client: PoolClient, accountId: string): Promise<void> {
  await client.query(
    `INSERT INTO wallets (account_id, currency_code)
     VALUES ($1, 'TEAS')
     ON CONFLICT (account_id, currency_code) DO NOTHING`,
    [accountId]
  );
}

/**
 * Retrouve ou crée un compte Etheria pour une identité externe.
 * L'identifiant du fournisseur (Discord, web, etc.) reste séparé du compte central.
 */
export async function getOrCreateAccount(
  pool: Pool,
  input: GetOrCreateAccountInput
): Promise<EtheriaAccount> {
  const provider = input.provider.trim().toLowerCase();
  const providerUserId = input.providerUserId.trim();
  const displayName = input.displayName.trim();

  if (!provider || !providerUserId || !displayName) {
    throw new Error("Le fournisseur, son identifiant et le nom du joueur sont obligatoires.");
  }

  if (displayName.length > 32) {
    throw new Error("Le nom du joueur ne peut pas dépasser 32 caractères.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Sérialise les inscriptions simultanées pour une même identité.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${provider}:${providerUserId}`]
    );

    const existing = await client.query<{
      account_id: string;
      display_name: string;
    }>(
      `SELECT a.id AS account_id, p.display_name
       FROM account_identities AS i
       JOIN accounts AS a ON a.id = i.account_id
       JOIN player_profiles AS p ON p.account_id = a.id
       WHERE i.provider = $1 AND i.provider_user_id = $2
       LIMIT 1`,
      [provider, providerUserId]
    );

    if (existing.rowCount && existing.rows[0]) {
      const account = existing.rows[0];

      await client.query(
        `UPDATE player_profiles
         SET display_name = $2, updated_at = NOW()
         WHERE account_id = $1 AND display_name IS DISTINCT FROM $2`,
        [account.account_id, displayName]
      );

      await client.query(
        "UPDATE accounts SET last_seen_at = NOW() WHERE id = $1",
        [account.account_id]
      );

      await ensureWallet(client, account.account_id);
      await client.query("COMMIT");

      return {
        accountId: account.account_id,
        displayName,
        created: false
      };
    }

    const accountResult = await client.query<{ id: string }>(
      "INSERT INTO accounts DEFAULT VALUES RETURNING id"
    );
    const accountId = accountResult.rows[0]?.id;

    if (!accountId) {
      throw new Error("La création du compte Etheria n'a retourné aucun identifiant.");
    }

    await client.query(
      `INSERT INTO account_identities (account_id, provider, provider_user_id)
       VALUES ($1, $2, $3)`,
      [accountId, provider, providerUserId]
    );

    await client.query(
      "INSERT INTO player_profiles (account_id, display_name) VALUES ($1, $2)",
      [accountId, displayName]
    );

    await ensureWallet(client, accountId);
    await client.query("COMMIT");

    return { accountId, displayName, created: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
