// @ts-nocheck
// 与产品机会研究 source/lib/research/provider-config.ts 保持同一套公开连接信息。
// 密钥不是本文件的一部分，只从环境变量读取。
import { withDeadline } from "../request-deadline";
import { normalizeInterpretation } from "./clauses";
export const QWEN_MODEL = 'qwen3.7-plus';
export const QWEN_BASE_URL = 'https://llm-feayjgruj6xxgtqa.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
export const QWEN_TIMEOUT_MS = 45000;
export const INTERPRET_TIMEOUT_MS = 12000;
export const QWEN_MAX_OUTPUT_TOKENS = 2400;

const RESEARCH_CONFIG = 'source/lib/research/provider-config.ts';

export function modelEndpoint() {
  return QWEN_BASE_URL + '/chat/completions';
}

export function modelStatus(env = process.env) {
  const raw = env.DASHSCOPE_API_KEY;
  const key = typeof raw === 'string' ? raw.trim() : '';
  const keyConfigured = key.length > 0 && !/\s/.test(key) && !/["'“”‘’`]/.test(key);
  const freeTierOnlyConfirmed = env.QWEN_FREE_TIER_ONLY_CONFIRMED === 'true';
  const liveRequested = env.GUIDE_AGENT_LIVE_MODEL === 'true';
  const ready = keyConfigured && freeTierOnlyConfirmed && liveRequested;
  return {
    mode: ready ? 'live' : 'simulation',
    model: QWEN_MODEL,
    baseUrl: QWEN_BASE_URL,
    endpoint: modelEndpoint(),
    region: '北京',
    interface: 'openai-compatible-chat-completions',
    researchConfig: RESEARCH_CONFIG,
    keyConfigured,
    freeTierOnlyConfirmed,
    liveRequested,
    ready
  };
}

export function requireLiveCredentials(env = process.env) {
  const status = modelStatus(env);
  if (!status.ready) return null;
  const key = String(env.DASHSCOPE_API_KEY).trim();
  return {key, status};
}

export function copyRequestBody(facts) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'used_fact_ids', 'refused_claims'],
    properties: {
      text: {type: 'string', minLength: 1, maxLength: facts.maxChars || 200},
      used_fact_ids: {
        type: 'array',
        items: {type: 'string', enum: facts.factIds}
      },
      refused_claims: {type: 'array', items: {type: 'string'}}
    }
  };
  return {
    model: QWEN_MODEL,
    stream: false,
    enable_thinking: false,
    max_tokens: QWEN_MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: {name: 'guide_copy', strict: true, schema}
    },
    messages: [
      {
        role: 'system',
        content: '你是导购文案助手。只使用给定商品事实。没有资料的卖点、保修和送装承诺必须拒绝，不能写成确定事实。只返回 JSON。'
      },
      {role: 'user', content: JSON.stringify(facts)}
    ]
  };
}

export async function executeLiveCopy(facts, env = process.env, fetcher = fetch, timeoutMs = QWEN_TIMEOUT_MS) {
  const credentials = requireLiveCredentials(env);
  if (!credentials) {
    return {mode: 'simulation', called: false};
  }
  const body = copyRequestBody(facts);
  try {
    return await withDeadline(async (signal) => {
      const response = await fetcher(credentials.status.endpoint, {
        method: 'POST',
        redirect: 'manual',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + credentials.key
        },
        body: JSON.stringify(body)
      });
      if (response.status >= 300 && response.status < 400) {
        return {mode: 'live', called: true, error: 'PROVIDER_REDIRECT_REJECTED'};
      }
      if (!response.ok) {
        return {mode: 'live', called: true, error: 'PROVIDER_HTTP_' + response.status};
      }
      const payload = await response.json();
      return {mode: 'live', called: true, payload};
    }, timeoutMs);
  } catch (error) {
    return {mode: 'live', called: true, error: ['TimeoutError', 'AbortError'].includes(error?.name) ? 'MODEL_TIMEOUT' : 'PROVIDER_NETWORK_ERROR'};
  }
}

export function interpretRequestBody(text) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['clauses', 'unresolved'],
    properties: {
      clauses: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['attribute', 'value', 'polarity', 'span'],
          properties: {
            attribute: {type: 'string', enum: ['color', 'material', 'style', 'category', 'budget', 'width']},
            value: {type: 'string'},
            polarity: {type: 'string', enum: ['include', 'exclude']},
            span: {type: 'string'}
          }
        }
      },
      unresolved: {type: 'array', items: {type: 'string'}}
    }
  };
  return {
    model: QWEN_MODEL,
    stream: false,
    enable_thinking: false,
    max_tokens: QWEN_MAX_OUTPUT_TOKENS,
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {name: 'guide_clauses', strict: true, schema}
    },
    messages: [
      {
        role: 'system',
        content: '你只把顾客原话拆成约束分句。每句给出 attribute、value、polarity（include 或 exclude）和原话 span。看不懂的短语放进 unresolved。不要输出商品编号、候选、价格、尺寸、型号、活动叠加、送装或质保，也不要决定筛选结果。只返回 JSON。'
      },
      {role: 'user', content: String(text || '')}
    ]
  };
}

export async function executeInterpret(text, env = process.env, fetcher = fetch, timeoutMs = INTERPRET_TIMEOUT_MS) {
  const credentials = requireLiveCredentials(env);
  if (!credentials) return {mode: 'simulation', called: false, interpretation: null};
  const body = interpretRequestBody(text);
  try {
    return await withDeadline(async (signal) => {
      const response = await fetcher(credentials.status.endpoint, {
        method: 'POST',
        redirect: 'manual',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + credentials.key
        },
        body: JSON.stringify(body)
      });
      if (response.status >= 300 && response.status < 400) {
        return {mode: 'live', called: true, error: 'PROVIDER_REDIRECT_REJECTED', interpretation: null};
      }
      if (!response.ok) {
        return {mode: 'live', called: true, error: 'PROVIDER_HTTP_' + response.status, interpretation: null};
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        return {mode: 'live', called: true, error: 'PROVIDER_BAD_RESPONSE', interpretation: null};
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        return {mode: 'live', called: true, error: 'PROVIDER_BAD_RESPONSE', interpretation: null};
      }
      try {
        return {mode: 'live', called: true, interpretation: normalizeInterpretation(JSON.parse(content))};
      } catch {
        return {mode: 'live', called: true, error: 'PROVIDER_BAD_RESPONSE', interpretation: null};
      }
    }, timeoutMs);
  } catch (error) {
    return {
      mode: 'live',
      called: true,
      error: ['TimeoutError', 'AbortError'].includes(error?.name) ? 'MODEL_TIMEOUT' : 'PROVIDER_NETWORK_ERROR',
      interpretation: null
    };
  }
}

export async function interpretUtterance(text, options = {}) {
  if (!String(text || '').trim()) return null;
  if (typeof options.interpreter === 'function') {
    return normalizeInterpretation(await options.interpreter(text));
  }
  const env = options.env || process.env;
  const result = await executeInterpret(text, env, options.fetcher || fetch);
  return result?.interpretation || null;
}
