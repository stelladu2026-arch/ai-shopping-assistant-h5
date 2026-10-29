// Deterministic fund stance. Numbers stay here so the model cannot invent a return.

export type FundKind = "cash" | "bond" | "equity" | "other" | "unknown";

export type Action =
  | "unsuitable"
  | "insufficient"
  | "reduce"
  | "buy_dip"
  | "hold"
  | "wait";

export const ACTION_LABEL: Record<Action, string> = {
  unsuitable: "不适合该目标",
  buy_dip: "参考分批买入",
  hold: "持有不动",
  reduce: "参考减仓",
  wait: "今天不操作",
  insufficient: "样本不足",
};

export const ANNUAL_GOAL_PCT = 20;

export const DISCLAIMER =
  "这不是投资建议，也不会连接支付宝或代你下单。年化 20% 只是对照目标，不是承诺。基金可能亏损。规则对照用的是公开净值，不是你的支付宝持仓。";

export type NavPoint = { date: string; nav: number };

export type Cutoff = {
  shanghaiTime: string;
  pastCutoff: boolean;
  weekend: boolean;
  note: string;
};

export type Metrics = {
  nav: number | null;
  ma60: number | null;
  ma120: number | null;
  drawdown60Pct: number | null;
  drawdown120Pct: number | null;
  return5dPct: number | null;
  return20dPct: number | null;
  trailing1yPct: number | null;
  gapTo20PctPoints: number | null;
};

export type Decision = {
  action: Action;
  actionLabel: string;
  reasons: string[];
  metrics: Metrics;
};

export type Backtest = {
  sampleEnough: boolean;
  startDate: string | null;
  endDate: string | null;
  years: number | null;
  ruleCagrPct: number | null;
  buyHoldCagrPct: number | null;
  ruleMaxDrawdownPct: number | null;
  tradeCount: number;
  reached20: boolean;
  beatBuyHold: boolean | null;
  note: string;
};

const SLOW = 120;
const MID = 60;
const ENTRY_COST = 0.0015;
const SHORT_HOLD_DAYS = 7;
const SHORT_HOLD_FEE = 0.005;

export function redemptionFeeRate(heldDays: number): number {
  return heldDays < SHORT_HOLD_DAYS ? SHORT_HOLD_FEE : ENTRY_COST;
}

export function classifyFund(ftype: string | null | undefined): FundKind {
  const text = ftype?.trim() ?? "";
  if (!text) return "unknown";
  if (text.includes("货币")) return "cash";
  if (/债券|纯债|短债|理财/.test(text)) return "bond";
  if (/REIT|Reit|reit|商品|黄金/.test(text)) return "other";
  if (/股票|混合|指数|QDII|FOF|联接|海外/.test(text)) return "equity";
  return "unknown";
}

export function cutoffAt(now: Date): Cutoff {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = pick("weekday");
  const hour = Number(pick("hour"));
  const weekend = weekday === "Sat" || weekday === "Sun";
  const pastCutoff = !weekend && hour >= 15;
  const shanghaiTime = `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
  const clock = `现在是北京时间 ${shanghaiTime}`;
  let note: string;
  if (weekend) {
    note = `${clock}，周末。这时在支付宝提交，一般要到下一个交易日才按净值确认。法定休市日同理，这里不判断假期。`;
  } else if (pastCutoff) {
    note = `${clock}，已过 15:00。这时在支付宝提交，通常按下一交易日净值确认，不是今天这份已公布净值。`;
  } else {
    note = `${clock}，还没到 15:00。若你自己在支付宝提交，通常按今天收盘后的净值确认。今天的官方净值还没公布，下面的动作用的是最近一个已公布净值。`;
  }
  return { shanghaiTime, pastCutoff, weekend, note };
}

export function decide(input: {
  points: NavPoint[];
  kind: FundKind;
  subscribeStatus?: string | null;
  redeemStatus?: string | null;
}): { decision: Decision; backtest: Backtest } {
  if (input.kind === "cash") {
    return {
      decision: {
        action: "unsuitable",
        actionLabel: ACTION_LABEL.unsuitable,
        reasons: ["货币基金的收益结构和年化 20% 对不上。它的份额净值通常保持在 1 附近，公开接口里的数字是万份收益，不是可以低买高卖的价格。"],
        metrics: emptyMetrics(),
      },
      backtest: emptyBacktest("货币基金不跑这套买卖规则。"),
    };
  }
  const points = input.points.filter((point) => point.nav > 0);
  const navs = points.map((point) => point.nav);
  const last = navs.length - 1;
  const technical = stanceAt(navs, last, input.kind);
  const gated = applyTradeStatus(
    technical,
    input.subscribeStatus ?? "",
    input.redeemStatus ?? "",
  );
  const metrics = metricsAt(navs, last);
  const reasons = reasonsFor(gated.action, input.kind, metrics, gated.extra);
  const decision: Decision = {
    action: gated.action,
    actionLabel: ACTION_LABEL[gated.action],
    reasons,
    metrics,
  };
  return { decision, backtest: runBacktest(points, input.kind) };
}

export function stanceAt(navs: number[], index: number, kind: FundKind): Action {
  if (kind === "cash" || kind === "bond" || kind === "other") return "unsuitable";
  if (kind === "unknown") return "wait";
  if (index < SLOW - 1 || index >= navs.length) return "insufficient";

  const nav = navs[index];
  const ma60 = average(navs, index, MID);
  const ma120 = average(navs, index, SLOW);
  if (ma60 === null || ma120 === null) return "insufficient";

  const drawdown60 = nav / highest(navs, index - MID + 1, index) - 1;
  const drawdown120 = nav / highest(navs, index - SLOW + 1, index) - 1;
  const return5 = index >= 5 ? nav / navs[index - 5] - 1 : 0;
  const return20 = index >= 20 ? nav / navs[index - 20] - 1 : 0;
  const return252 = index >= 252 ? nav / navs[index - 252] - 1 : null;

  if ((nav < ma60 && nav < ma120) || drawdown120 <= -0.15) return "reduce";

  const uptrend = nav > ma120 && ma60 > ma120;
  const dip =
    drawdown60 <= -0.03 &&
    drawdown60 >= -0.12 &&
    return5 < 0 &&
    return20 <= 0.08;
  const notExtended = return252 === null || return252 < 0.5;
  if (uptrend && dip && notExtended) return "buy_dip";
  if (nav >= ma60 && nav >= ma120) return "hold";
  return "wait";
}

function applyTradeStatus(
  action: Action,
  subscribeStatus: string,
  redeemStatus: string,
): { action: Action; extra: string | null } {
  if (action === "buy_dip" && /暂停|封闭/.test(subscribeStatus)) {
    return {
      action: "wait",
      extra: `申购状态是「${subscribeStatus}」，不能按买入处理。`,
    };
  }
  if (action === "reduce" && /暂停|封闭/.test(redeemStatus)) {
    return {
      action: "hold",
      extra: `赎回状态是「${redeemStatus}」，减仓可能做不到，今天按持有不动处理。`,
    };
  }
  return { action, extra: null };
}

function reasonsFor(
  action: Action,
  kind: FundKind,
  metrics: Metrics,
  extra: string | null,
): string[] {
  const reasons: string[] = [];
  if (action === "unsuitable") {
    reasons.push(
      kind === "other"
        ? "商品、黄金或 REIT 类产品不是用来博年化 20% 的。"
        : "货币基金和债券基金的收益结构和年化 20% 对不上，交易规则改变不了这一点。",
    );
  } else if (action === "insufficient") {
    reasons.push("已公布净值不足 120 个交易日，不给买卖对照。");
  } else if (kind === "unknown") {
    reasons.push("公开资料没有给出明确类型。类型不明时今天不给买入或卖出对照。请到支付宝基金详情核对。");
  } else if (action === "reduce") {
    const belowAverages =
      metrics.nav !== null &&
      metrics.ma60 !== null &&
      metrics.ma120 !== null &&
      metrics.nav < metrics.ma60 &&
      metrics.nav < metrics.ma120;
    const deepDrawdown = metrics.drawdown120Pct !== null && metrics.drawdown120Pct <= -15;
    if (belowAverages) {
      reasons.push(`净值 ${metrics.nav} 同时低于 60 日均线 ${metrics.ma60} 和 120 日均线 ${metrics.ma120}。`);
    }
    if (deepDrawdown) {
      reasons.push(`相对近 120 日高点的回撤是 ${metrics.drawdown120Pct}%。`);
    }
    reasons.push("这只对已经持有的份额有意义。还没买的，今天不要买。");
  } else if (action === "buy_dip") {
    reasons.push("长期均线仍向上，同时相对近 60 日高点出现了大约 3% 到 12% 的回撤，近 5 日收益为负。");
    reasons.push("参考分批买入只对应一小笔，不是一次把资金买完。");
  } else if (action === "hold") {
    reasons.push("净值仍在 60 日和 120 日均线之上，但没有出现规则里的回撤买点。今天不追加。");
  } else {
    reasons.push("趋势不明确，或回撤不在规则区间里。今天不操作。");
  }
  if (metrics.trailing1yPct !== null && metrics.gapTo20PctPoints !== null) {
    reasons.push(
      `近一年收益 ${formatPct(metrics.trailing1yPct)}，与年化 20% 对照目标相差 ${metrics.gapTo20PctPoints.toFixed(1)} 个百分点。`,
    );
  }
  if (extra) reasons.push(extra);
  return reasons;
}

function emptyMetrics(): Metrics {
  return {
    nav: null,
    ma60: null,
    ma120: null,
    drawdown60Pct: null,
    drawdown120Pct: null,
    return5dPct: null,
    return20dPct: null,
    trailing1yPct: null,
    gapTo20PctPoints: null,
  };
}

function metricsAt(navs: number[], index: number): Metrics {
  if (index < 0 || index >= navs.length) return emptyMetrics();
  const nav = navs[index];
  const ma60 = average(navs, index, MID);
  const ma120 = average(navs, index, SLOW);
  const trailing = index >= 252 ? nav / navs[index - 252] - 1 : null;
  return {
    nav: roundNav(nav),
    ma60: ma60 === null ? null : roundNav(ma60),
    ma120: ma120 === null ? null : roundNav(ma120),
    drawdown60Pct:
      index >= MID - 1 ? round1((nav / highest(navs, index - MID + 1, index) - 1) * 100) : null,
    drawdown120Pct:
      index >= SLOW - 1
        ? round1((nav / highest(navs, index - SLOW + 1, index) - 1) * 100)
        : null,
    return5dPct: index >= 5 ? round1((nav / navs[index - 5] - 1) * 100) : null,
    return20dPct: index >= 20 ? round1((nav / navs[index - 20] - 1) * 100) : null,
    trailing1yPct: trailing === null ? null : round1(trailing * 100),
    gapTo20PctPoints: trailing === null ? null : round1(ANNUAL_GOAL_PCT - trailing * 100),
  };
}

function emptyBacktest(note: string): Backtest {
  return {
    sampleEnough: false,
    startDate: null,
    endDate: null,
    years: null,
    ruleCagrPct: null,
    buyHoldCagrPct: null,
    ruleMaxDrawdownPct: null,
    tradeCount: 0,
    reached20: false,
    beatBuyHold: null,
    note,
  };
}

function runBacktest(points: NavPoint[], kind: FundKind): Backtest {
  const empty = emptyBacktest;

  if (kind === "bond" || kind === "other") {
    return empty("债券、商品、黄金和 REIT 不跑这套买卖规则。");
  }
  if (kind === "unknown") {
    return empty("类型不明，不做历史买卖对照。");
  }
  if (points.length < SLOW) {
    return empty("公布净值不足 120 个交易日，没有做历史对照。");
  }

  const navs = points.map((point) => point.nav);
  const start = SLOW - 1;
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  let position: 0 | 1 = 0;
  let entryIndex = -1;
  let tradeCount = 0;

  for (let index = start; index < navs.length; index += 1) {
    if (index > start && position === 1) {
      equity *= navs[index] / navs[index - 1];
    }
    const action = stanceAt(navs, index, kind);
    if (action === "buy_dip" && position === 0) {
      equity *= 1 - ENTRY_COST;
      position = 1;
      entryIndex = index;
      tradeCount += 1;
    } else if (action === "reduce" && position === 1) {
      const held = daysBetween(points[entryIndex].date, points[index].date);
      equity *= 1 - redemptionFeeRate(held);
      position = 0;
      entryIndex = -1;
      tradeCount += 1;
    }
    if (equity > peak) peak = equity;
    const drawdown = equity / peak - 1;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }

  const years = daysBetween(points[start].date, points[points.length - 1].date) / 365.25;
  const buyHold = (navs[navs.length - 1] / navs[start]) * (1 - ENTRY_COST);
  const ruleCagr = years > 0 ? equity ** (1 / years) - 1 : null;
  const buyHoldCagr = years > 0 ? buyHold ** (1 / years) - 1 : null;
  const ruleCagrPct = ruleCagr === null ? null : round1(ruleCagr * 100);
  const buyHoldCagrPct = buyHoldCagr === null ? null : round1(buyHoldCagr * 100);
  const reached20 = ruleCagrPct !== null && ruleCagrPct >= ANNUAL_GOAL_PCT;
  const beatBuyHold =
    ruleCagrPct !== null && buyHoldCagrPct !== null ? ruleCagrPct > buyHoldCagrPct : null;

  const reachText = reached20
    ? "这段历史里规则年化到了 20% 或以上，这仍然不是以后的结果。"
    : "这段历史里规则年化没有达到 20%。";
  const beatText =
    beatBuyHold === true
      ? "规则年化高于同一段的买入持有。"
      : "规则年化没有高于同一段的买入持有。不要为了 20% 的目标频繁换仓。";

  return {
    sampleEnough: true,
    startDate: points[start].date,
    endDate: points[points.length - 1].date,
    years: round1(years),
    ruleCagrPct,
    buyHoldCagrPct,
    ruleMaxDrawdownPct: round1(maxDrawdown * 100),
    tradeCount,
    reached20,
    beatBuyHold,
    note: `从 ${points[start].date} 到 ${points[points.length - 1].date}，规则年化 ${formatPct(ruleCagrPct)}，买入持有年化 ${formatPct(buyHoldCagrPct)}，规则最大回撤 ${formatPct(round1(maxDrawdown * 100))}。申购和普通赎回各按 0.15% 估算，持有不满 7 天赎回按 0.5%，空仓按收益 0 计算。回测只有满仓和空仓，不是分批买入。${reachText}${beatText}`,
  };
}

function average(navs: number[], end: number, window: number): number | null {
  const start = end - window + 1;
  if (start < 0) return null;
  let sum = 0;
  for (let index = start; index <= end; index += 1) sum += navs[index];
  return sum / window;
}

function highest(navs: number[], start: number, end: number): number {
  let high = navs[start];
  for (let index = start + 1; index <= end; index += 1) {
    if (navs[index] > high) high = navs[index];
  }
  return high;
}

function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundNav(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function formatPct(value: number | null): string {
  if (value === null) return "没有";
  return `${value.toFixed(1)}%`;
}
