import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyFund,
  cutoffAt,
  decide,
  redemptionFeeRate,
  sellWatch,
  type NavPoint,
} from "../bot/lib/signal.ts";

function points(navs: number[], start = "2024-01-01"): NavPoint[] {
  const [year, month, day] = start.split("-").map(Number);
  const origin = Date.UTC(year, month - 1, day);
  return navs.map((nav, index) => {
    const date = new Date(origin + index * 86_400_000).toISOString().slice(0, 10);
    return { date, nav };
  });
}

function climb(count: number, daily = 0.001): number[] {
  const navs = [1];
  for (let index = 1; index < count; index += 1) navs.push(navs[index - 1] * (1 + daily));
  return navs;
}

test("classifies cash, bond, and equity from the public type name", () => {
  assert.equal(classifyFund("货币型-普通货币"), "cash");
  assert.equal(classifyFund("债券型-混合一级"), "bond");
  assert.equal(classifyFund("指数型-债券"), "bond");
  assert.equal(classifyFund("指数型-股票"), "equity");
  assert.equal(classifyFund("混合型-灵活"), "equity");
  assert.equal(classifyFund("商品型"), "other");
  assert.equal(classifyFund(""), "unknown");
});

test("a money-market yield series is not treated as a price", () => {
  const result = decide({ points: points(Array(300).fill(0.3)), kind: "cash" });
  assert.equal(result.decision.action, "unsuitable");
  assert.equal(result.decision.metrics.trailing1yPct, null);
  assert.match(result.decision.reasons.join(""), /万份收益/);
});

test("a bond fund is unsuitable for a 20% goal even in an uptrend", () => {
  const result = decide({ points: points(climb(180)), kind: "bond" });
  assert.equal(result.decision.action, "unsuitable");
  assert.equal(result.decision.actionLabel, "不适合该目标");
  assert.equal(result.backtest.sampleEnough, false);
  assert.equal(result.backtest.reached20, false);
});

test("unknown type does not produce a buy or sell label", () => {
  const result = decide({ points: points(climb(180)), kind: "unknown" });
  assert.equal(result.decision.action, "wait");
  assert.match(result.decision.reasons.join(""), /类型不明/);
});

test("fewer than 120 published NAVs is insufficient", () => {
  const result = decide({ points: points(climb(80)), kind: "equity" });
  assert.equal(result.decision.action, "insufficient");
  assert.equal(result.backtest.reached20, false);
});

test("a steady climb is hold, and the rule does not beat buy-and-hold or reach 20%", () => {
  const result = decide({ points: points(climb(260, 0.0004)), kind: "equity" });
  assert.equal(result.decision.action, "hold");
  assert.equal(result.backtest.sampleEnough, true);
  assert.equal(result.backtest.tradeCount, 0);
  assert.equal(result.backtest.reached20, false);
  assert.equal(result.backtest.beatBuyHold, false);
  assert.ok((result.backtest.buyHoldCagrPct ?? 0) > 0);
  assert.doesNotMatch(result.decision.reasons.join(""), /% 个百分点/);
});

test("a break below both averages is a reduce reference", () => {
  const navs = [...Array(180).fill(1), ...Array.from({ length: 30 }, (_, index) => 1 * 0.985 ** (index + 1))];
  const result = decide({ points: points(navs), kind: "equity" });
  assert.equal(result.decision.action, "reduce");
  assert.match(result.decision.reasons.join(""), /还没买的，今天不要买/);
});

test("a pullback inside an uptrend is a small buy reference", () => {
  const navs = climb(200, 0.0015);
  for (let index = 0; index < 6; index += 1) navs.push(navs[navs.length - 1] * 0.99);
  const result = decide({ points: points(navs), kind: "equity" });
  assert.equal(result.decision.action, "buy_dip");
  assert.equal(result.decision.actionLabel, "参考分批买入");
  assert.equal(result.backtest.reached20, false);
});

test("a paused subscription turns a buy reference into no action today", () => {
  const navs = climb(200, 0.0015);
  for (let index = 0; index < 6; index += 1) navs.push(navs[navs.length - 1] * 0.99);
  const result = decide({
    points: points(navs),
    kind: "equity",
    subscribeStatus: "暂停申购",
  });
  assert.equal(result.decision.action, "wait");
  assert.match(result.decision.reasons.join(""), /暂停申购/);
});

test("a broken trend makes today the sell day before the 15:00 cutoff", () => {
  const navs = [...Array(180).fill(1), ...Array.from({ length: 30 }, (_, index) => 0.985 ** (index + 1))];
  const watch = sellWatch({
    points: points(navs),
    kind: "equity",
    now: new Date("2026-10-29T06:00:00Z"),
  });
  assert.equal(watch.triggered, true);
  assert.equal(watch.sellDay, "2026-10-29");
  assert.match(watch.submitNote, /15:00 前/);
  assert.ok((watch.sellNav ?? 0) > 0);
});

test("an intact trend has no sell day and does not invent one", () => {
  const watch = sellWatch({
    points: points(climb(260, 0.0004)),
    kind: "equity",
    now: new Date("2026-10-29T06:00:00Z"),
  });
  assert.equal(watch.triggered, false);
  assert.equal(watch.sellDay, null);
  assert.ok((watch.dropToSellNavPct ?? 0) > 0);
  assert.match(watch.submitNote, /卖出日还没到/);
  assert.match(watch.submitNote, /不能提前写成未来的某一天/);
});

test("a sell signal after 15:00 still names today but uses the next net value", () => {
  const navs = [...Array(180).fill(1), ...Array.from({ length: 30 }, (_, index) => 0.985 ** (index + 1))];
  const watch = sellWatch({
    points: points(navs),
    kind: "equity",
    now: new Date("2026-10-29T08:00:00Z"),
  });
  assert.equal(watch.sellDay, "2026-10-29");
  assert.match(watch.submitNote, /已过 15:00/);
});

test("holding under seven days uses the higher redemption fee", () => {
  assert.equal(redemptionFeeRate(6), 0.005);
  assert.equal(redemptionFeeRate(7), 0.0015);
});

test("15:00 Beijing time is the Alipay cutoff", () => {
  const before = cutoffAt(new Date("2026-10-29T06:59:00Z"));
  const atCutoff = cutoffAt(new Date("2026-10-29T07:00:00Z"));
  const weekend = cutoffAt(new Date("2026-10-31T03:00:00Z"));
  assert.equal(before.pastCutoff, false);
  assert.match(before.note, /还没到 15:00/);
  assert.equal(before.shanghaiTime, "2026-10-29 14:59");
  assert.equal(atCutoff.pastCutoff, true);
  assert.match(atCutoff.note, /已过 15:00/);
  assert.equal(weekend.weekend, true);
  assert.equal(weekend.pastCutoff, false);
});
