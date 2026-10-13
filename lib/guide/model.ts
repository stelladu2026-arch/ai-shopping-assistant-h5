// @ts-nocheck
// 与产品机会研究 source/lib/research/provider-config.ts 保持同一套公开连接信息。
// 密钥不是本文件的一部分，只从环境变量读取。
export const QWEN_MODEL = 'qwen3.7-plus';
export const QWEN_BASE_URL = 'https://llm-feayjgruj6xxgtqa.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
export const QWEN_TIMEOUT_MS = 45000;
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

export async function executeLiveCopy(facts, env = process.env, fetcher = fetch) {
  const credentials = requireLiveCredentials(env);
  if (!credentials) {
    return {mode: 'simulation', called: false};
  }
  const body = copyRequestBody(facts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QWEN_TIMEOUT_MS);
  try {
    const response = await fetcher(credentials.status.endpoint, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
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
    return {mode: 'live', called: true, response};
  } catch (error) {
    return {mode: 'live', called: true, error: controller.signal.aborted ? 'MODEL_TIMEOUT' : 'PROVIDER_NETWORK_ERROR'};
  } finally {
    clearTimeout(timer);
  }
}
