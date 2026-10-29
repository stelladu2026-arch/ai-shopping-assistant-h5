import { fetchHistory, fetchProfile, type FundProfile } from "./market.ts";
import type { NavPoint } from "./signal.ts";
import {
  cutoffAt,
  decide,
  DISCLAIMER,
  type Backtest,
  type Cutoff,
  type Decision,
  type FundKind,
} from "./signal.ts";

export const WATCHLIST_KEY = "operator-watchlist";
export const HOLDINGS_KEY = "operator-holdings";
export const MAX_FUNDS = 8;
export const SCREEN_PAGES = 14;

export type FundBrief = {
  ok: true;
  code: string;
  name: string | null;
  ftype: string | null;
  kind: FundKind;
  latestDate: string;
  latestNav: number | null;
  dailyChangePct: number | null;
  tenThousandYield: number | null;
  sevenDayAnnualizedPct: number | null;
  subscribeStatus: string | null;
  redeemStatus: string | null;
  decision: Decision;
  backtest: Backtest;
} | {
  ok: false;
  code: string;
  error: string;
};

export type DailyBrief = {
  disclaimer: string;
  cutoff: Cutoff;
  goal: { annualReturnPct: 20; meaning: string };
  watchlistEmpty: boolean;
  funds: FundBrief[];
};

export function parseWatchlist(value: unknown): string[] {
  if (typeof value !== "object" || value === null || !("codes" in value)) return [];
  const codes = value.codes;
  if (!Array.isArray(codes)) return [];
  const unique: string[] = [];
  for (const code of codes) {
    if (typeof code === "string" && /^\d{6}$/.test(code) && !unique.includes(code)) {
      unique.push(code);
    }
    if (unique.length === MAX_FUNDS) break;
  }
  return unique;
}

export function normalizeCodes(codes: string[]): string[] {
  const unique: string[] = [];
  for (const code of codes) {
    if (!/^\d{6}$/.test(code)) throw new Error(`基金代码 ${code} 不是 6 位数字。`);
    if (unique.includes(code)) continue;
    if (unique.length === MAX_FUNDS) break;
    unique.push(code);
  }
  return unique;
}

export type FundStudy =
  | { ok: false; code: string; error: string }
  | { ok: true; brief: Extract<FundBrief, { ok: true }>; points: NavPoint[] };

export async function analyzeFund(
  code: string,
  options: { maxPages?: number; profile?: FundProfile } = {},
): Promise<FundStudy> {
  try {
    const profile = options.profile ?? (await fetchProfile(code));
    const kind = profile?.kind ?? "unknown";
    const history = await fetchHistory(code, {
      maxPages: kind === "cash" || kind === "other" ? 1 : options.maxPages,
    });
    const { decision, backtest } = decide({
      points: history.points,
      kind,
      subscribeStatus: history.subscribeStatus,
      redeemStatus: history.redeemStatus,
    });
    const latest = history.points[history.points.length - 1];
    const previous = history.points[history.points.length - 2];
    const moneyMarket = kind === "cash";
    const dailyChangePct =
      moneyMarket || previous === undefined
        ? null
        : Math.round((latest.nav / previous.nav - 1) * 1000) / 10;
    return {
      ok: true,
      points: history.points,
      brief: {
        ok: true,
        code,
        name: profile?.name ?? null,
        ftype: profile?.ftype ?? null,
        kind,
        latestDate: latest.date,
        latestNav: moneyMarket ? null : latest.nav,
        dailyChangePct,
        tenThousandYield: moneyMarket ? latest.nav : null,
        sevenDayAnnualizedPct: moneyMarket ? history.latestAccumulated : null,
        subscribeStatus: history.subscribeStatus,
        redeemStatus: history.redeemStatus,
        decision,
        backtest,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code,
      error: error instanceof Error ? error.message : "这只基金暂时查不到。",
    };
  }
}

export async function buildDailyBrief(codes: string[], now = new Date()): Promise<DailyBrief> {
  const funds: FundBrief[] = [];
  for (const code of codes) {
    const study = await analyzeFund(code);
    funds.push(study.ok ? study.brief : study);
  }
  return {
    disclaimer: DISCLAIMER,
    cutoff: cutoffAt(now),
    goal: {
      annualReturnPct: 20,
      meaning: "对照目标，不是预期，也不是承诺。",
    },
    watchlistEmpty: codes.length === 0,
    funds,
  };
}

export function sameCodes(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((code, index) => code === right[index]);
}
