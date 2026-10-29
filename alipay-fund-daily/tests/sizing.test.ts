import assert from "node:assert/strict";
import test from "node:test";
import { allocatePurchase, parseBudget } from "../bot/lib/sizing.ts";

test("no qualifying fund means the suggested purchase is zero", () => {
  const plan = allocatePurchase(20_000, 0);
  assert.equal(plan.amountEachYuan, 0);
  assert.equal(plan.totalYuan, 0);
  assert.match(plan.note, /建议购买金额是 0 元/);
});

test("a missing budget does not invent an amount", () => {
  const plan = allocatePurchase(null, 2);
  assert.equal(plan.amountEachYuan, null);
  assert.equal(plan.totalYuan, null);
  assert.match(plan.note, /不会假设一个数字/);
  assert.equal(parseBudget(undefined), null);
  assert.equal(parseBudget({ capitalYuan: 0 }), null);
});

test("two funds each take ten percent of the stated capital", () => {
  const plan = allocatePurchase(20_000, 2);
  assert.equal(plan.amountEachYuan, 2000);
  assert.equal(plan.totalYuan, 4000);
});

test("a single fund is capped at ten percent", () => {
  const plan = allocatePurchase(100_000, 1);
  assert.equal(plan.amountEachYuan, 10_000);
  assert.equal(plan.totalYuan, 10_000);
});

test("several funds stay inside the thirty percent daily cap", () => {
  const plan = allocatePurchase(20_000, 4);
  assert.equal(plan.amountEachYuan, 1500);
  assert.equal(plan.totalYuan, 6000);
});

test("a budget below one 10 yuan lot rounds to zero", () => {
  const plan = allocatePurchase(50, 1);
  assert.equal(plan.amountEachYuan, 0);
  assert.equal(plan.totalYuan, 0);
});
