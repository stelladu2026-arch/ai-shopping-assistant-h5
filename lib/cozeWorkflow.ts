import {
  findPreviousMomentsResult,
  getLatestUserInstruction,
} from "@/lib/chat/momentsMockRevise";
import type { AgentChatRequestBody, AgentChatResponseBody, AgentStructuredBlock } from "@/types/agent";

const DEFAULT_WORKFLOW_URL = "https://vkpkbmtz48.coze.site/run";

/** 使用括号读取；空字符串视为未设置（避免 .env 里写了 POLICY_API_TOKEN= 导致 ?? 无法回退） */
function envStr(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

function getWorkflowUrl(): string | null {
  const u = envStr("COZE_WORKFLOW_RUN_URL");
  if (u) return u;
  /** 未配置 env 时使用内置演示地址（可在 .env.local 覆盖） */
  return DEFAULT_WORKFLOW_URL;
}

/** 是否尝试调用远程工作流（设 COZE_WORKFLOW_USE_MOCK=1 则仅用 Mock） */
export function shouldTryCozeWorkflow(): boolean {
  const mock = envStr("COZE_WORKFLOW_USE_MOCK");
  return mock !== "1" && mock !== "true";
}

/**
 * Coze 工作流常见必填：意图节点需要 `user_message`。
 * - 政策：取最近一条 user 气泡正文（含附件说明）。
 * - 朋友圈：用户气泡常为空，用 momentsInput 拼成一段说明。
 */
export function deriveUserMessageForCoze(body: AgentChatRequestBody): string {
  const msgs = body.messages ?? [];
  const instruction = getLatestUserInstruction(msgs);

  if (body.scene === "moments_marketing" && body.momentsInput) {
    const mi = body.momentsInput;
    const kindLabel =
      mi.outputKind === "copy_only" ? "仅文案" : mi.outputKind === "image_only" ? "仅配图" : "图文";
    const pts = (mi.sellingPoints ?? []).filter(Boolean).join("、") || "未选卖点";
    const configLine = `【配置】${kindLabel}｜产品：${mi.productName}｜卖点：${pts}｜文案风格：${mi.copyStyle}｜客群：${mi.audience}`;

    if (instruction) {
      const previous = findPreviousMomentsResult(msgs, mi.outputKind);
      const prevLines: string[] = [];
      if (previous?.bodyTitle) prevLines.push(`标题：${previous.bodyTitle}`);
      if (previous?.bodyText) prevLines.push(`正文：${previous.bodyText}`);
      if (previous?.hashtags?.length) prevLines.push(`话题：${previous.hashtags.join(" ")}`);
      if (previous?.commentThreadScript) prevLines.push(`评论区：${previous.commentThreadScript}`);
      const prevBlock = prevLines.length ? prevLines.join("\n") : "（无上一版正文，请按配置重新生成）";
      return `【修改要求】${instruction}\n${configLine}\n【上一版内容】\n${prevBlock}`;
    }

    return `【朋友圈营销】${configLine.replace("【配置】", "")}`;
  }

  if (instruction) return instruction;
  return "（无用户输入）";
}

/**
 * 尝试将工作流 HTTP 返回解析为前端已有的 structured。
 * 支持：
 * - Coze Open API：`{ code, msg, data }`，且 `data` 常为**整段 JSON 字符串**（需先 parse）
 * - 直连 structured、包一层 `{ structured }`、`{ data: { output: string|object } }`
 */
export function parseWorkflowStructured(raw: unknown): AgentStructuredBlock | null {
  if (raw && typeof raw === "object") {
    const outer = raw as Record<string, unknown>;
    /** 官方工作流：顶层 `data` 有时是序列化后的 JSON 字符串 */
    if (typeof outer.data === "string") {
      try {
        return parseWorkflowStructured(JSON.parse(outer.data));
      } catch {
        return null;
      }
    }
  }

  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const asBlock = (x: unknown): AgentStructuredBlock | null => {
    if (!x || typeof x !== "object") return null;
    const s = x as Record<string, unknown>;
    if (s.scene === "moments_marketing" || s.scene === "store_rag_query") {
      return x as AgentStructuredBlock;
    }
    return null;
  };

  const direct = asBlock(raw);
  if (direct) return direct;

  if (o.structured !== undefined) {
    const b = asBlock(o.structured);
    if (b) return b;
  }

  /** 工作流结束节点常导出为根级 `output`（与 `data.output` 同义） */
  if (o.output !== undefined) {
    if (typeof o.output === "string") {
      try {
        const parsed = JSON.parse(o.output) as unknown;
        const inner = parseWorkflowStructured(parsed);
        if (inner) return inner;
        const ob = asBlock(parsed);
        if (ob) return ob;
      } catch {
        /* ignore */
      }
    } else {
      const b = asBlock(o.output);
      if (b) return b;
      const nested = parseWorkflowStructured(o.output);
      if (nested) return nested;
    }
  }

  const data = o.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.output !== undefined) {
      if (typeof d.output === "string") {
        try {
          const parsed = JSON.parse(d.output) as unknown;
          const inner = parseWorkflowStructured(parsed);
          if (inner) return inner;
        } catch {
          /* ignore */
        }
      } else {
        const b = asBlock(d.output);
        if (b) return b;
        const nested = parseWorkflowStructured(d.output);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/** 与 Coze 工作流 / Python 约定的 policy 密钥字段名（网关若过滤含 TOKEN 的 key，可改成例如 policy_api_key 并同步改 Coze 节点） */
const DEFAULT_POLICY_FIELD = "POLICY_API_TOKEN";

function buildCozeHttpPayload(
  reqBody: AgentChatRequestBody,
  policyApiTokenForBody: string | undefined,
): Record<string, unknown> {
  const policyField = envStr("COZE_POLICY_TOKEN_FIELD") ?? DEFAULT_POLICY_FIELD;
  const inner: Record<string, unknown> = {
    ...reqBody,
    user_message: deriveUserMessageForCoze(reqBody),
  };
  if (policyApiTokenForBody) {
    inner[policyField] = policyApiTokenForBody;
    /** 兼容仍写死 POLICY_API_TOKEN 的节点：自定义别名之外仍带默认键 */
    if (policyField !== DEFAULT_POLICY_FIELD) {
      inner[DEFAULT_POLICY_FIELD] = policyApiTokenForBody;
    }
    /** 部分 Coze 映射使用小写或其它别名 */
    inner.policy_api_token = policyApiTokenForBody;
  }

  const mode = envStr("COZE_WORKFLOW_BODY_MODE") ?? "flat";
  /**
   * parameters / input：托管侧可能只读嵌套对象里的 POLICY 等字段；
   * 意图节点往往在「图顶层」读 user_message，若只有 { parameters: {...} } 会得到 input_value={}。
   * 因此在嵌套之外始终再打一层根字段（与 both 一致）。
   */
  if (mode === "parameters") {
    return { ...inner, parameters: inner };
  }
  if (mode === "both") {
    return { ...inner, parameters: inner };
  }
  if (mode === "input") {
    return { ...inner, input: inner };
  }
  /**
   * max：多路径嵌套同一 inner；若托管只合并某一键（variables / workflow_input 等）进 state，可提高命中率。
   * 若仍报缺 POLICY_API_TOKEN：多为 LangGraph State 未声明该字段，节点间被丢弃——须在 Coze 声明 state 字段或让 Python 读 Authorization Bearer。
   */
  if (mode === "max") {
    return {
      ...inner,
      parameters: inner,
      input: inner,
      workflow_input: inner,
      variables: inner,
      graph_inputs: inner,
    };
  }
  return inner;
}

/** POST 到发布的工作流 URL，返回解析后的 Agent 响应或 null（调用失败或无法解析） */
export async function callCozeWorkflow(reqBody: AgentChatRequestBody): Promise<AgentChatResponseBody | null> {
  const url = getWorkflowUrl();
  if (!url) return null;

  const token = envStr("COZE_WORKFLOW_TOKEN");
  /** 与工作流 body 字段 POLICY_API_TOKEN 同源：仅配 COZE_WORKFLOW_TOKEN 时自动填入 */
  const policyApiTokenForBody = envStr("POLICY_API_TOKEN") ?? token;

  if (process.env.NODE_ENV === "development") {
    if (!token) {
      console.warn(
        "[cozeWorkflow] COZE_WORKFLOW_TOKEN 未读取到：请在项目根目录 .env.local 写一行 COZE_WORKFLOW_TOKEN=你的令牌（不要 export 前缀），保存后重启 npm run dev；若仍不行请删掉 .next 再启动",
      );
    }
    if (reqBody.scene === "store_rag_query" && !policyApiTokenForBody) {
      console.warn(
        "[cozeWorkflow] 政策查询未读到令牌：请在 .env.local 配置 COZE_WORKFLOW_TOKEN（如需单独政策 Key 可再设 POLICY_API_TOKEN 覆盖）",
      );
    }
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  /** 若 Coze 运行时不把任意 JSON 字段传入 Python，可从该 Header 读同一密钥（与 body 中 POLICY_API_TOKEN 一致） */
  if (policyApiTokenForBody) {
    headers.set("X-Policy-API-Token", policyApiTokenForBody);
  }

  try {
    const payload = buildCozeHttpPayload(reqBody, policyApiTokenForBody);
    if (process.env.NODE_ENV === "development" && reqBody.scene === "store_rag_query") {
      const raw = JSON.stringify(payload);
      console.info("[cozeWorkflow] POST 是否携带 policy 令牌:", Boolean(policyApiTokenForBody));
      console.info(
        "[cozeWorkflow] BODY_MODE=",
        envStr("COZE_WORKFLOW_BODY_MODE") ?? "flat",
        " JSON含 POLICY_API_TOKEN 字面:",
        raw.includes(`"${DEFAULT_POLICY_FIELD}"`),
      );
      console.info("[cozeWorkflow] payload 顶层 keys:", Object.keys(payload));
    }
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      120_000,
    );

    if (process.env.NODE_ENV === "development" && res.url !== url) {
      console.warn("[cozeWorkflow] 请求被重定向", url, "→", res.url, "（若 401，可能是跟随后跳转丢 Authorization）");
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      console.warn("[cozeWorkflow] Non-JSON response", res.status, text.slice(0, 200));
      return null;
    }

    if (!res.ok) {
      console.warn("[cozeWorkflow] HTTP error", res.status, json);
      if (res.status === 500 && JSON.stringify(json).includes("POLICY_API_TOKEN")) {
        console.warn(
          "[cozeWorkflow] HTTP 已带 POLICY_API_TOKEN 仍失败：多为意图等上游节点未把该字段合并进 LangGraph state。请在 Coze 检查节点输出/Reducer；或在托管环境配置 POLICY_API_TOKEN；或改 customer_service_node 读取 Authorization Bearer",
        );
      }
      if (res.status === 401) {
        if (!token) {
          console.warn(
            "[cozeWorkflow] 401：仍未读到 COZE_WORKFLOW_TOKEN（见上方提示）；确认 .env.local 在项目根且变量名完全一致",
          );
        } else {
          console.warn(
            "[cozeWorkflow] 401：令牌已发送但被服务端拒绝（过期、错误或类型不匹配），请在 Coze 重新生成令牌",
          );
        }
      }
      return null;
    }

    /** 若工作流直接返回与前端一致的 envelope */
    const env = json as Record<string, unknown>;
    if (typeof env.code === "number" && env.code !== 0) {
      console.warn("[cozeWorkflow] workflow returned code", env.code, env.msg ?? env.message, json);
      return null;
    }
    if (env.messageId && env.done !== undefined) {
      const structured = env.structured !== undefined ? parseWorkflowStructured(env.structured) : undefined;
      return {
        messageId: String(env.messageId),
        done: Boolean(env.done),
        leadText: typeof env.leadText === "string" ? env.leadText : undefined,
        structured: structured ?? undefined,
      };
    }

    const structured = parseWorkflowStructured(json);
    if (!structured) {
      console.warn("[cozeWorkflow] Could not map response to structured block", json);
      return null;
    }

    return {
      messageId: `wf_${Date.now()}`,
      done: true,
      structured,
    };
  } catch (e) {
    console.warn("[cozeWorkflow] fetch failed", e);
    return null;
  }
}
