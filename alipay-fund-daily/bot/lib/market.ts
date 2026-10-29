import { classifyFund, type FundKind, type NavPoint } from "./signal.ts";

const HOSTS = new Set(["api.fund.eastmoney.com", "fundsuggest.eastmoney.com"]);
// The public history endpoint caps each page at 20 rows.
const PAGE_SIZE = 20;
const MAX_PAGES = 40;
const TARGET_POINTS = PAGE_SIZE * MAX_PAGES;

export type FundProfile = {
  code: string;
  name: string;
  ftype: string;
  kind: FundKind;
};

export type FundHistory = {
  points: NavPoint[];
  subscribeStatus: string | null;
  redeemStatus: string | null;
  latestAccumulated: number | null;
};

export type HistoryOptions = {
  maxPages?: number;
  fetchPage?: (page: number) => Promise<unknown>;
};

export type SearchHit = FundProfile;

export async function fetchProfile(code: string): Promise<FundProfile | null> {
  assertCode(code);
  const hits = await searchFunds(code);
  return hits.find((hit) => hit.code === code) ?? null;
}

export async function searchFunds(query: string): Promise<SearchHit[]> {
  const text = query.trim();
  if (text.length < 1 || text.length > 30 || text.includes("://")) {
    throw new Error("查询需要是 1 到 30 个字符的基金名称或 6 位代码。");
  }
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(text)}`;
  const body = await getJson(url);
  const rows = asRecord(body).Datas;
  if (!Array.isArray(rows)) return [];
  const hits: SearchHit[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (record.CATEGORY !== 700 && record.CATEGORYDESC !== "基金") continue;
    const code = typeof record.CODE === "string" ? record.CODE : "";
    const name = typeof record.NAME === "string" ? record.NAME : "";
    const info = asRecord(record.FundBaseInfo);
    const ftype = typeof info.FTYPE === "string" ? info.FTYPE : "";
    if (!/^\d{6}$/.test(code) || !name) continue;
    hits.push({ code, name, ftype, kind: classifyFund(ftype) });
    if (hits.length === 5) break;
  }
  return hits;
}

export async function fetchHistory(code: string, options: HistoryOptions = {}): Promise<FundHistory> {
  assertCode(code);
  const maxPages = options.maxPages ?? MAX_PAGES;
  const load = options.fetchPage ?? ((page: number) => {
    const url =
      `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}` +
      `&pageIndex=${page}&pageSize=${PAGE_SIZE}`;
    return getJson(url, `https://fund.eastmoney.com/${code}.html`);
  });
  const points: NavPoint[] = [];
  let subscribeStatus: string | null = null;
  let redeemStatus: string | null = null;
  let latestAccumulated: number | null = null;
  for (let page = 1; page <= maxPages && points.length < TARGET_POINTS; page += 1) {
    const body = await load(page);
    const root = asRecord(body);
    if (root.ErrCode !== 0) {
      throw new Error(typeof root.ErrMsg === "string" ? root.ErrMsg : "净值接口返回错误。");
    }
    const data = asRecord(root.Data);
    const list = data.LSJZList;
    if (!Array.isArray(list) || list.length === 0) break;
    for (const row of list) {
      const record = asRecord(row);
      const date = typeof record.FSRQ === "string" ? record.FSRQ : "";
      const nav = typeof record.DWJZ === "string" ? Number(record.DWJZ) : Number.NaN;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(nav) || nav <= 0) continue;
      points.push({ date, nav });
      if (latestAccumulated === null && typeof record.LJJZ === "string" && record.LJJZ !== "") {
        const accumulated = Number(record.LJJZ);
        latestAccumulated = Number.isFinite(accumulated) ? accumulated : null;
      }
      if (subscribeStatus === null && typeof record.SGZT === "string") subscribeStatus = record.SGZT;
      if (redeemStatus === null && typeof record.SHZT === "string") redeemStatus = record.SHZT;
    }
    if (list.length < PAGE_SIZE) break;
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  const deduped: NavPoint[] = [];
  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.date === point.date) deduped[deduped.length - 1] = point;
    else deduped.push(point);
  }
  if (deduped.length === 0) throw new Error("没有查到这只基金的公布净值。");
  return { points: deduped, subscribeStatus, redeemStatus, latestAccumulated };
}

function assertCode(code: string): void {
  if (!/^\d{6}$/.test(code)) throw new Error("基金代码需要是 6 位数字。");
}

async function getJson(url: string, referer = "https://fund.eastmoney.com/"): Promise<unknown> {
  const host = new URL(url).host;
  if (!HOSTS.has(host)) throw new Error("只允许读取公开基金行情域名。");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Referer: referer,
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`行情接口暂时不可用（${response.status}）。`);
  return response.json() as Promise<unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
