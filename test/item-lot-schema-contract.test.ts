import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../src/database/migrations/0019_enforce_item_lot_totals.sql", import.meta.url),
  "utf8"
);

test("la migration contrôle les totaux des lots du sac et du camp", () => {
  assert.match(migration, /assert_inventory_slot_lots_consistent/);
  assert.match(migration, /assert_camp_storage_lots_consistent/);
  assert.match(migration, /SUM\(quantity\)/);
  assert.match(migration, /BOOL_AND\(item_code = slot_item_code\)/);
  assert.match(migration, /BOOL_AND\(item_code = entry_item_code\)/);
});

test("les contrôles de cohérence sont différés jusqu'à la fin de transaction", () => {
  const triggers = migration.match(/CREATE CONSTRAINT TRIGGER[\s\S]*?DEFERRABLE INITIALLY DEFERRED[\s\S]*?EXECUTE FUNCTION enforce_item_lot_container_consistency\(\);/g) ?? [];
  assert.equal(triggers.length, 3);
  assert.match(migration, /ON character_item_lots/);
  assert.match(migration, /ON character_inventory_slots/);
  assert.match(migration, /ON character_temporary_camp_storage/);
});

test("les vérifications couvrent les anciens et nouveaux contenants lors d'un déplacement", () => {
  assert.match(migration, /OLD\.inventory_slot_id/);
  assert.match(migration, /NEW\.inventory_slot_id/);
  assert.match(migration, /OLD\.camp_storage_entry_id/);
  assert.match(migration, /NEW\.camp_storage_entry_id/);
});
