-- Etheria - migration 0019
-- Garantit que les quantités agrégées correspondent aux lots traçables.
-- Les vérifications sont différées à la fin de la transaction afin de permettre
-- les opérations atomiques qui mettent à jour les deux représentations.

BEGIN;

CREATE OR REPLACE FUNCTION assert_inventory_slot_lots_consistent(p_slot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  slot_item_code TEXT;
  slot_quantity INTEGER;
  lot_quantity BIGINT;
  lot_item_codes_match BOOLEAN;
BEGIN
  SELECT item_code, quantity
    INTO slot_item_code, slot_quantity
  FROM character_inventory_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM character_item_lots WHERE inventory_slot_id = p_slot_id
    ) THEN
      RAISE EXCEPTION 'Des lots restent rattachés à un emplacement de sac inexistant (%).', p_slot_id
        USING ERRCODE = '23514',
              CONSTRAINT = 'character_inventory_slot_lots_consistency';
    END IF;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(quantity), 0),
         COALESCE(BOOL_AND(item_code = slot_item_code), TRUE)
    INTO lot_quantity, lot_item_codes_match
  FROM character_item_lots
  WHERE inventory_slot_id = p_slot_id;

  IF lot_quantity <> slot_quantity OR NOT lot_item_codes_match THEN
    RAISE EXCEPTION
      'Incohérence des lots du sac % : quantité agrégée %, quantité des lots %, codes cohérents %.',
      p_slot_id, slot_quantity, lot_quantity, lot_item_codes_match
      USING ERRCODE = '23514',
            CONSTRAINT = 'character_inventory_slot_lots_consistency';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION assert_camp_storage_lots_consistent(p_entry_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  entry_item_code TEXT;
  entry_quantity INTEGER;
  lot_quantity BIGINT;
  lot_item_codes_match BOOLEAN;
BEGIN
  SELECT item_code, quantity
    INTO entry_item_code, entry_quantity
  FROM character_temporary_camp_storage
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM character_item_lots WHERE camp_storage_entry_id = p_entry_id
    ) THEN
      RAISE EXCEPTION 'Des lots restent rattachés à une entrée de camp inexistante (%).', p_entry_id
        USING ERRCODE = '23514',
              CONSTRAINT = 'character_camp_storage_lots_consistency';
    END IF;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(quantity), 0),
         COALESCE(BOOL_AND(item_code = entry_item_code), TRUE)
    INTO lot_quantity, lot_item_codes_match
  FROM character_item_lots
  WHERE camp_storage_entry_id = p_entry_id;

  IF lot_quantity <> entry_quantity OR NOT lot_item_codes_match THEN
    RAISE EXCEPTION
      'Incohérence des lots du stockage de camp % : quantité agrégée %, quantité des lots %, codes cohérents %.',
      p_entry_id, entry_quantity, lot_quantity, lot_item_codes_match
      USING ERRCODE = '23514',
            CONSTRAINT = 'character_camp_storage_lots_consistency';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_item_lot_container_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'character_item_lots' THEN
    IF TG_OP <> 'INSERT' THEN
      IF OLD.inventory_slot_id IS NOT NULL THEN
        PERFORM assert_inventory_slot_lots_consistent(OLD.inventory_slot_id);
      END IF;
      IF OLD.camp_storage_entry_id IS NOT NULL THEN
        PERFORM assert_camp_storage_lots_consistent(OLD.camp_storage_entry_id);
      END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
      IF NEW.inventory_slot_id IS NOT NULL THEN
        PERFORM assert_inventory_slot_lots_consistent(NEW.inventory_slot_id);
      END IF;
      IF NEW.camp_storage_entry_id IS NOT NULL THEN
        PERFORM assert_camp_storage_lots_consistent(NEW.camp_storage_entry_id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'character_inventory_slots' THEN
    IF TG_OP <> 'INSERT' THEN
      PERFORM assert_inventory_slot_lots_consistent(OLD.id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
      PERFORM assert_inventory_slot_lots_consistent(NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'character_temporary_camp_storage' THEN
    IF TG_OP <> 'INSERT' THEN
      PERFORM assert_camp_storage_lots_consistent(OLD.id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
      PERFORM assert_camp_storage_lots_consistent(NEW.id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER character_item_lots_consistency_trigger
AFTER INSERT OR UPDATE OR DELETE ON character_item_lots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_item_lot_container_consistency();

CREATE CONSTRAINT TRIGGER character_inventory_slots_lots_consistency_trigger
AFTER INSERT OR UPDATE OR DELETE ON character_inventory_slots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_item_lot_container_consistency();

CREATE CONSTRAINT TRIGGER character_camp_storage_lots_consistency_trigger
AFTER INSERT OR UPDATE OR DELETE ON character_temporary_camp_storage
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_item_lot_container_consistency();

COMMIT;
