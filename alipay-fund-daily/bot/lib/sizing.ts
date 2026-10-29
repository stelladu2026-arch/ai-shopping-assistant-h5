export const BUDGET_KEY = "operator-budget";

const LOT_YUAN = 10;
const PER_FUND_SHARE = 0.1;
const POSITION_SLOTS = 8;
const DAY_SHARE = 0.3;

export type PurchasePlan = {
  capitalYuan: number | null;
  fundCount: number;
  amountEachYuan: number | null;
  totalYuan: number | null;
  note: string;
};

export function parseBudget(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("capitalYuan" in value)) return null;
  const amount = value.capitalYuan;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export function allocatePurchase(capitalYuan: number | null, fundCount: number): PurchasePlan {
  if (fundCount <= 0) {
    const recorded = capitalYuan === null ? "" : `已记录可投入 ${formatYuan(capitalYuan)} 元。`;
    const later = capitalYuan === null ? "之后出现可入手基金时，要先给出可投入金额，才会算出每只买多少。" : "";
    return {
      capitalYuan,
      fundCount: 0,
      amountEachYuan: 0,
      totalYuan: 0,
      note: `今天没有可入手的基金，建议购买金额是 0 元。${recorded}${later}金额是分批上限，不是预期利润。`,
    };
  }
  if (capitalYuan === null) {
    return {
      capitalYuan: null,
      fundCount,
      amountEachYuan: null,
      totalYuan: null,
      note: "还没有可投入金额，不会假设一个数字。请先说出可投入多少元。",
    };
  }

  const perFund = Math.min(capitalYuan * PER_FUND_SHARE, capitalYuan / POSITION_SLOTS);
  const dayCap = capitalYuan * DAY_SHARE;
  const raw = Math.min(perFund, dayCap / fundCount);
  const amountEachYuan = Math.floor(raw / LOT_YUAN) * LOT_YUAN;
  const totalYuan = amountEachYuan * fundCount;
  if (amountEachYuan < LOT_YUAN) {
    return {
      capitalYuan,
      fundCount,
      amountEachYuan: 0,
      totalYuan: 0,
      note: `可投入 ${formatYuan(capitalYuan)} 元，按 10 元取整后不足一笔。建议购买金额是 0 元。`,
    };
  }
  return {
    capitalYuan,
    fundCount,
    amountEachYuan,
    totalYuan,
    note:
      `可投入 ${formatYuan(capitalYuan)} 元。每只建议购买 ${formatYuan(amountEachYuan)} 元，今天合计 ${formatYuan(totalYuan)} 元。` +
      "单只不超过可投入资金的 10%，一天新买入不超过 30%，按 10 元向下取整。这是分批上限，不是预期利润，也不是建议借钱。",
  };
}

function formatYuan(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
