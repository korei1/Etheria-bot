import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeLocalStock,
  isOpenAtLocalMinute,
  restockLocalItem,
  toWorldDayOrdinal,
  validateLocalStockItem,
  validateOpeningSchedule,
  type LocalStockItem,
  type WeeklyOpeningSchedule
} from "../src/modules/world/local-life-simulation.js";

const schedule: WeeklyOpeningSchedule = {
  days: [
    { weekday: 1, intervals: [
      { opensAtMinute: 9 * 60, closesAtMinute: 12 * 60 },
      { opensAtMinute: 13 * 60, closesAtMinute: 18 * 60 }
    ] }
  ]
};

const stock: LocalStockItem = {
  key: "herbal_tea",
  displayName: "Infusion aux herbes",
  priceTeas: 25,
  quantity: 2,
  maximumQuantity: 10,
  restockEveryDays: 3,
  lastRestockOrdinal: 120
};

test("les horaires hebdomadaires valident les jours et les intervalles", () => {
  assert.deepEqual(validateOpeningSchedule(schedule), []);
  assert.equal(isOpenAtLocalMinute(schedule, 1, 9 * 60), true);
  assert.equal(isOpenAtLocalMinute(schedule, 1, 12 * 60), false);
  assert.equal(isOpenAtLocalMinute(schedule, 1, 14 * 60), true);
  assert.equal(isOpenAtLocalMinute(schedule, 2, 10 * 60), false);
  assert.equal(isOpenAtLocalMinute(undefined, 7, 23 * 60), true);
  assert.ok(validateOpeningSchedule({ days: [
    { weekday: 1, intervals: [{ opensAtMinute: 600, closesAtMinute: 800 }] },
    { weekday: 1, intervals: [] }
  ] }).some((issue) => issue.includes("plusieurs fois")));
});

test("le calendrier Etheria convertit les années de 120 jours sans rupture", () => {
  assert.equal(toWorldDayOrdinal({ year: 1, dayOfYear: 120 }), 120);
  assert.equal(toWorldDayOrdinal({ year: 2, dayOfYear: 1 }), 121);
  assert.throws(() => toWorldDayOrdinal({ year: 0, dayOfYear: 1 }), /Date Etheria invalide/);
});

test("les stocks sont validés, consommés sans devenir négatifs et réapprovisionnés selon leur cycle", () => {
  assert.deepEqual(validateLocalStockItem(stock), []);
  assert.equal(consumeLocalStock(stock, 2).quantity, 0);
  assert.throws(() => consumeLocalStock(stock, 3), /Stock local insuffisant/);
  const unchanged = restockLocalItem(stock, 122);
  assert.equal(unchanged.quantity, 2);
  const replenished = restockLocalItem(stock, 126);
  assert.equal(replenished.quantity, 10);
  assert.equal(replenished.lastRestockOrdinal, 126);
  assert.equal(restockLocalItem({ ...stock, restockEveryDays: null }, 999).quantity, 2);
});

test("les stocks refusent prix, quantités et intervalles incohérents", () => {
  const issues = validateLocalStockItem({
    ...stock,
    priceTeas: -1,
    quantity: 11,
    restockEveryDays: 0
  });
  assert.equal(issues.length, 3);
});
