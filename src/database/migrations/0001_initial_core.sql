-- Etheria - migration 0001
-- Socle : comptes, identités, profils et économie.
-- À exécuter une seule fois sur une base PostgreSQL dédiée.
-- Cette migration ne crée aucun compte Neon et ne contacte aucun service distant.

BEGIN;

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE account_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT account_identities_provider_user_unique
    UNIQUE (provider, provider_user_id),
  CONSTRAINT account_identities_provider_not_empty
    CHECK (length(trim(provider)) > 0),
  CONSTRAINT account_identities_user_id_not_empty
    CHECK (length(trim(provider_user_id)) > 0)
);

CREATE INDEX account_identities_account_id_idx
  ON account_identities(account_id);

CREATE TABLE player_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  origin_country_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_profiles_display_name_length
    CHECK (char_length(trim(display_name)) BETWEEN 1 AND 32)
);

CREATE TABLE currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT currencies_code_format
    CHECK (code ~ '^[A-Z][A-Z0-9_]{1,15}$')
);

INSERT INTO currencies (code, name)
VALUES ('TEAS', 'Teas');

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  currency_code TEXT NOT NULL REFERENCES currencies(code) ON DELETE RESTRICT,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallets_account_currency_unique
    UNIQUE (account_id, currency_code)
);

CREATE TABLE currency_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount <> 0),
  reason_code TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT currency_transactions_reason_not_empty
    CHECK (length(trim(reason_code)) > 0)
);

CREATE INDEX currency_transactions_wallet_created_idx
  ON currency_transactions(wallet_id, created_at DESC);

COMMIT;
