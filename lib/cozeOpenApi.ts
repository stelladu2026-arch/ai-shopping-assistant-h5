/**
 * Coze 开放平台 HTTP（中国区 api.coze.cn），仅供服务端 Route 调用。
 * @see https://www.coze.cn/open/docs
 */

function envStr(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function getPat(): string | undefined {
  return (
    envStr("COZE_WORKLOAD_API_TOKEN") ??
    envStr("COZE_WORKSPACE_API_TOKEN") ??
    /** 店长 / 工作流 C：与发布页 Token 区分，此处一般为开放平台 PAT（sat_/pat_） */
    envStr("COZE_WORKFLOW_C_TOKEN")
  );
}

/**
 * 开放平台域名；若误把「工作流 C 发布页」写在 COZE_WORKFLOW_C_URL（…coze.site/run），此处不使用。
 */
function openApiBaseFromWorkflowCUrl(): string | undefined {
  const u = envStr("COZE_WORKFLOW_C_URL");
  if (!u) return undefined;
  try {
    const { hostname, origin } = new URL(u);
    if (hostname === "api.coze.cn" || hostname.startsWith("api.") && hostname.endsWith("coze.cn")) {
      return origin.replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function getBaseUrl(): string {
  const base =
    envStr("COZE_LOOP_BASE_URL") ??
    envStr("COZE_API_BASE_URL") ??
    openApiBaseFromWorkflowCUrl() ??
    "https://api.coze.cn";
  return base.replace(/\/$/, "");
}

function getWorkspaceId(): string | undefined {
  return envStr("COZE_WORKSPACE_ID") ?? envStr("COZE_WORKFLOW_C_WORKSPACE_ID");
}

export interface CozePublishedBotBrief {
  bot_id: string;
  name: string;
}

export interface CozeWorkspaceSummaryOk {
  ok: true;
  workspaceId: string;
  botCount: number;
  bots: CozePublishedBotBrief[];
}

export interface CozeWorkspaceSummaryErr {
  ok: false;
  error: string;
  detail?: unknown;
  /** 不含密钥，便于确认缺 PAT 还是缺 Workspace ID */
  config?: { hasPat: boolean; hasWorkspaceId: boolean };
}

export type CozeWorkspaceSummary = CozeWorkspaceSummaryOk | CozeWorkspaceSummaryErr;

/** 是否配置了店长 / Coze 开放平台对接所需环境变量 */
export function hasCozeWorkspaceConfig(): boolean {
  return Boolean(getPat() && getWorkspaceId());
}

/**
 * 拉取空间内已发布 Bot 列表（用于店长看板验证 PAT 与 Workspace）。
 * GET /v1/space/published_bots_list
 */
export async function fetchPublishedBotsSummary(): Promise<CozeWorkspaceSummary> {
  const token = getPat();
  const workspaceId = getWorkspaceId();
  if (!token || !workspaceId) {
    const hasPat = Boolean(token);
    const hasWorkspaceId = Boolean(workspaceId);
    let msg: string;
    if (!hasPat && !hasWorkspaceId) {
      msg =
        "missing PAT and workspace id — set COZE_WORKFLOW_C_TOKEN (or COZE_WORKLOAD_API_TOKEN) and COZE_WORKSPACE_ID";
    } else if (!hasPat) {
      msg = "missing PAT — set COZE_WORKFLOW_C_TOKEN or COZE_WORKLOAD_API_TOKEN";
    } else {
      msg = "missing workspace id — set COZE_WORKSPACE_ID or COZE_WORKFLOW_C_WORKSPACE_ID";
    }
    return {
      ok: false,
      error: msg,
      config: { hasPat, hasWorkspaceId },
    };
  }

  const base = getBaseUrl();
  const url = new URL(`${base}/v1/space/published_bots_list`);
  /** 中国区开放平台当前版本要求 query 名为 space_id（与控制台「空间 ID」同一数值） */
  url.searchParams.set("space_id", workspaceId);
  url.searchParams.set("page_num", "1");
  url.searchParams.set("page_size", "50");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const raw = await res.text();
    let json: unknown;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      return { ok: false, error: `Coze 返回非 JSON（HTTP ${res.status})`, detail: raw.slice(0, 200) };
    }

    if (!res.ok) {
      return { ok: false, error: `Coze HTTP ${res.status}`, detail: json };
    }

    const o = json as Record<string, unknown>;
    if (typeof o.code === "number" && o.code !== 0) {
      return {
        ok: false,
        error: typeof o.msg === "string" ? o.msg : `Coze code=${o.code}`,
        detail: json,
      };
    }

    const data = o.data;
    const pickBotArray = (d: unknown): unknown[] | undefined => {
      if (!d || typeof d !== "object") return undefined;
      const rec = d as Record<string, unknown>;
      const keys = [
        "bots",
        "space_bots",
        "bot_list",
        "published_bots",
        "published_bots_list",
        "items",
        "space_bot_list",
        "bot_publish_list",
      ];
      for (const k of keys) {
        const v = rec[k];
        if (Array.isArray(v)) return v;
      }
      return undefined;
    };

    const botsRaw = pickBotArray(data) ?? (Array.isArray(data) ? data : undefined);

    const list = Array.isArray(botsRaw) ? botsRaw : [];
    const bots: CozePublishedBotBrief[] = list
      .map((b) => {
        if (!b || typeof b !== "object") return null;
        const r = b as Record<string, unknown>;
        const info = r.bot_info && typeof r.bot_info === "object" ? (r.bot_info as Record<string, unknown>) : null;
        const id = String(
          r.bot_id ?? r.id ?? info?.bot_id ?? info?.id ?? "",
        );
        const name = String(r.bot_name ?? r.name ?? info?.bot_name ?? info?.name ?? "未命名");
        if (!id) return null;
        return { bot_id: id, name };
      })
      .filter((x): x is CozePublishedBotBrief => x !== null);

    const totalHint =
      data && typeof data === "object"
        ? (data as Record<string, unknown>).total ??
          (data as Record<string, unknown>).total_count ??
          (data as Record<string, unknown>).total_num
        : undefined;

    const totalNum =
      typeof totalHint === "number" && Number.isFinite(totalHint)
        ? totalHint
        : typeof totalHint === "string"
          ? parseInt(totalHint, 10)
          : undefined;

    /** 能解析出列表则以列表为准；否则退回接口 total（兼容字段差异导致列表为空） */
    const count =
      bots.length > 0 ? bots.length : Number.isFinite(totalNum) && totalNum! >= 0 ? totalNum! : 0;

    return {
      ok: true,
      workspaceId,
      botCount: count,
      bots: bots.slice(0, 12),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
