import { analyzeFund, SCREEN_PAGES } from "./brief.ts";
import { fetchLargeEquityFunds, type FundProfile, type UniverseFund } from "./market.ts";
import { allocatePurchase, type PurchasePlan } from "./sizing.ts";
import { cutoffAt, DISCLAIMER, sellWatch, type Cutoff } from "./signal.ts";

const SCREEN_LIMIT = 16;
const SCREEN_CONCURRENCY = 4;

export type BuyCandidate = {
  code: string;
  name: string;
  endNavYi: number;
  latestDate: string;
  latestNav: number | null;
  actionLabel: string;
  reasons: string[];
  trailing1yPct: number | null;
  gapTo20PctPoints: number | null;
  reached20: boolean;
  beatBuyHold: boolean | null;
  backtestNote: string;
  amountYuan: number | null;
};

export type HeldSell = {
  code: string;
  name: string;
  actionLabel: string;
  sellDay: string | null;
  submitNote: string;
};

export type EntryScreen = {
  disclaimer: string;
  cutoff: Cutoff;
  universeSize: number;
  failed: number;
  ready: BuyCandidate[];
  ifHeldSellToday: HeldSell[];
  purchase: PurchasePlan;
  message: string;
};

export type HoldingReview = {
  code: string;
  name: string | null;
  actionLabel: string;
  triggered: boolean;
  sellDay: string | null;
  latestNav: number | null;
  ma60: number | null;
  ma120: number | null;
  sellNav: number | null;
  dropToSellNavPct: number | null;
  reached20: boolean;
  beatBuyHold: boolean | null;
  backtestNote: string;
  submitNote: string;
};

export async function screenEntries(now = new Date(), capitalYuan: number | null = null): Promise<EntryScreen> {
  const universe = await fetchLargeEquityFunds(SCREEN_LIMIT);
  const studies = await mapPool(universe, SCREEN_CONCURRENCY, async (fund) => ({
    fund,
    study: await analyzeFund(fund.code, { maxPages: SCREEN_PAGES, profile: asProfile(fund) }),
  }));
  const ready: BuyCandidate[] = [];
  const ifHeldSellToday: HeldSell[] = [];
  let failed = 0;
  for (const item of studies) {
    if (!item.study.ok) {
      failed += 1;
      continue;
    }
    const brief = item.study.brief;
    if (brief.decision.action === "buy_dip") {
      ready.push({
        code: brief.code,
        name: brief.name ?? item.fund.name,
        endNavYi: item.fund.endNavYi,
        latestDate: brief.latestDate,
        latestNav: brief.latestNav,
        actionLabel: brief.decision.actionLabel,
        reasons: brief.decision.reasons,
        trailing1yPct: brief.decision.metrics.trailing1yPct,
        gapTo20PctPoints: brief.decision.metrics.gapTo20PctPoints,
        reached20: brief.backtest.reached20,
        beatBuyHold: brief.backtest.beatBuyHold,
        backtestNote: brief.backtest.note,
        amountYuan: null,
      });
    }
    if (brief.decision.action === "reduce") {
      const watch = sellWatch({
        points: item.study.points,
        kind: brief.kind,
        now,
        redeemStatus: brief.redeemStatus,
      });
      ifHeldSellToday.push({
        code: brief.code,
        name: brief.name ?? item.fund.name,
        actionLabel: brief.decision.actionLabel,
        sellDay: watch.sellDay,
        submitNote: watch.submitNote,
      });
    }
  }
  const purchase = allocatePurchase(capitalYuan, ready.length);
  for (const fund of ready) fund.amountYuan = purchase.amountEachYuan;
  const selection =
    ready.length === 0
      ? "今天这批规模靠前、且可购买的股票和指数基金里，没有同时满足入手条件的。不要另外编一只基金。"
      : "ready 里的基金是今天可以分批入手的对照。这不是保证赚到年化 20%。历史没有达到 20% 的，必须照实说。";
  return {
    disclaimer: DISCLAIMER,
    cutoff: cutoffAt(now),
    universeSize: universe.length,
    failed,
    ready,
    ifHeldSellToday,
    purchase,
    message: `${selection}${purchase.note}`,
  };
}

export async function reviewHoldings(codes: string[], now = new Date()): Promise<{
  disclaimer: string;
  cutoff: Cutoff;
  holdingsEmpty: boolean;
  holdings: Array<HoldingReview | { ok: false; code: string; error: string }>;
  message: string;
}> {
  const holdings: Array<HoldingReview | { ok: false; code: string; error: string }> = [];
  for (const code of codes) {
    const study = await analyzeFund(code, { maxPages: SCREEN_PAGES });
    if (!study.ok) {
      holdings.push(study);
      continue;
    }
    const watch = sellWatch({
      points: study.points,
      kind: study.brief.kind,
      now,
      redeemStatus: study.brief.redeemStatus,
    });
    holdings.push({
      code,
      name: study.brief.name,
      actionLabel: study.brief.decision.actionLabel,
      triggered: watch.triggered,
      sellDay: watch.sellDay,
      latestNav: watch.latestNav,
      ma60: watch.ma60,
      ma120: watch.ma120,
      sellNav: watch.sellNav,
      dropToSellNavPct: watch.dropToSellNavPct,
      reached20: study.brief.backtest.reached20,
      beatBuyHold: study.brief.backtest.beatBuyHold,
      backtestNote: study.brief.backtest.note,
      submitNote: watch.submitNote,
    });
  }
  return {
    disclaimer: DISCLAIMER,
    cutoff: cutoffAt(now),
    holdingsEmpty: codes.length === 0,
    holdings,
    message:
      codes.length === 0
        ? "还没有记录持仓。把你已经买入的 6 位代码发来，才会给出卖出日。卖出日是条件成立的那个交易日，不会提前写成未来某一天。"
        : "triggered 为 true 时，sellDay 就是卖出日。triggered 为 false 时，卖出日还没到，不要编一个未来日期。",
  };
}

function asProfile(fund: UniverseFund): FundProfile {
  return { code: fund.code, name: fund.name, ftype: fund.ftype, kind: fund.kind };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
