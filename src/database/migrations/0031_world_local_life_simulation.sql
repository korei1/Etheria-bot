-- Etheria - migration 0031
-- Horaires hebdomadaires et stocks éditoriaux des commerces locaux.
-- Aucun horaire, article, prix ou stock n'est prérempli.
-- À appliquer uniquement après revue et approbation explicites.

BEGIN;

ALTER TABLE world_local_content
  ADD COLUMN opening_schedule JSONB,
  ADD CONSTRAINT world_local_content_opening_schedule_object
    CHECK (opening_schedule IS NULL OR jsonb_typeof(opening_schedule) = 'object');

CREATE TABLE world_local_shop_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_content_id UUID NOT NULL REFERENCES world_local_content(id) ON DELETE RESTRICT,
  stock_key TEXT NOT NULL CHECK (stock_key ~ '^[a-z][a-z0-9_]*$'),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  price_teas BIGINT NOT NULL CHECK (price_teas >= 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  maximum_quantity INTEGER NOT NULL CHECK (maximum_quantity >= 0),
  restock_every_days SMALLINT,
  last_restock_ordinal BIGINT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_local_shop_stock_quantity_limit
    CHECK (quantity <= maximum_quantity),
  CONSTRAINT world_local_shop_stock_restock_interval
    CHECK (restock_every_days IS NULL OR restock_every_days BETWEEN 1 AND 120),
  CONSTRAINT world_local_shop_stock_restock_date
    CHECK (last_restock_ordinal IS NULL OR last_restock_ordinal >= 1),
  CONSTRAINT world_local_shop_stock_unique_key
    UNIQUE (local_content_id, stock_key)
);

CREATE INDEX world_local_shop_stock_content_idx
  ON world_local_shop_stock(local_content_id, display_name);

CREATE FUNCTION enforce_local_shop_stock_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $local_stock$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM world_local_content c
    WHERE c.id = NEW.local_content_id
      AND c.content_kind = 'shop'
      AND c.editorial_status <> 'retired'
  ) THEN
    RAISE EXCEPTION 'Le stock doit appartenir à un commerce actif du catalogue';
  END IF;
  RETURN NEW;
END;
$local_stock$;

CREATE TRIGGER world_local_shop_stock_parent_guard
  BEFORE INSERT OR UPDATE OF local_content_id
  ON world_local_shop_stock
  FOR EACH ROW
  EXECUTE FUNCTION enforce_local_shop_stock_parent();

CREATE FUNCTION prevent_shop_kind_change_with_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $local_stock_kind$
BEGIN
  IF NEW.content_kind <> 'shop' AND EXISTS (
    SELECT 1 FROM world_local_shop_stock stock
    WHERE stock.local_content_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Un commerce possédant du stock ne peut pas changer de type';
  END IF;
  RETURN NEW;
END;
$local_stock_kind$;

CREATE TRIGGER world_local_content_shop_stock_guard
  BEFORE UPDATE OF content_kind
  ON world_local_content
  FOR EACH ROW
  EXECUTE FUNCTION prevent_shop_kind_change_with_stock();

ALTER TABLE world_local_shop_stock ENABLE ROW LEVEL SECURITY;

COMMIT;
