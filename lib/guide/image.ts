// @ts-nocheck
import { withDeadline } from "../request-deadline";
export const IMAGE_TIMEOUT_MS = 90000;
function imageEnabled(env) {
  const flag = cleanEnv(env?.GUIDE_IMAGE_ENABLED).toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'off';
}

function cleanEnv(value) {
  if (typeof value !== 'string') return '';
  let text = value.trim();
  if (text.length >= 2) {
    const quote = text[0];
    if ((quote === '"' || quote === "'") && text[text.length - 1] === quote) {
      text = text.slice(1, -1).trim();
    }
  }
  return text;
}

function dashscopeImageModel(model) {
  return /qwen|dashscope/i.test(String(model || ''));
}

function wan26Image(model) {
  return /^wan2\.6-image(?:-|$)/i.test(String(model || ''));
}

function modernQwen(model) {
  return /^qwen-image-(3\.0|2\.1)(?:-|$)/i.test(String(model || ''));
}

function imageSize(model, kind) {
  if (kind === 'compatible' || kind === 'openai') return '1024x1024';
  if (modernQwen(model)) return '1024*1024';
  if (/^qwen-image(?:-plus|-max)?(?:-|$)/i.test(String(model || ''))) return '1328*1328';
  return '1024*1024';
}

function fastOptions(model) {
  // Text-only requests require interleaved mode; its default max_images is 5.
  if (wan26Image(model)) return { enable_interleave: true, max_images: 1 };
  return modernQwen(model) ? { enable_thinking: false, watermark: false } : {};
}

function stripImageRefs(text) {
  let value = String(text || '');
  value = value.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  value = value.replace(/https?:\/\/[^\s)\]>"']+/gi, ' ');
  value = value.replace(/\/(?:products|demo)\/[^\s)\]>"']+/gi, ' ');
  return value.replace(/\s+/g, ' ').trim();
}

function furniturePrompt(product) {
  const name = stripImageRefs(product?.name || '');
  const color = stripImageRefs(product?.color || '');
  const material = stripImageRefs(product?.material || '');
  const model = stripImageRefs(product?.model || '');
  const extra = stripImageRefs(product?.prompt || '');
  const sentence = `家具示意。保持资料中的名称、颜色和材质，不要改成另一种商品。${name}，${color}${material}，型号${model}。`;
  return stripImageRefs(extra ? `${sentence}${extra}` : sentence);
}

function dashscopeHost(hostname) {
  return /(^|\.)dashscope(?:-[a-z0-9]+)?\.aliyuncs\.com$/i.test(String(hostname || ''))
    || /\.maas\.aliyuncs\.com$/i.test(String(hostname || ''));
}

function sharedDashscopeImageHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'dashscope.aliyuncs.com' || host === 'dashscope-intl.aliyuncs.com';
}

function multimodalEndpoint(parsed) {
  return {
    url: parsed.origin + '/api/v1/services/aigc/multimodal-generation/generation',
    native: false,
    kind: 'multimodal',
  };
}

function asyncEndpoint(parsed) {
  return {
    url: parsed.origin + '/api/v1/services/aigc/text2image/image-synthesis',
    native: true,
    kind: 'async',
  };
}

function qwenImageModel(model) {
  const name = String(model || '');
  if (/wan/i.test(name)) return false;
  return /qwen-image|qwen/i.test(name);
}

function normalizeImageBase(base) {
  let text = String(base || '').trim();
  const chat = text.match(/\/chat\/completions/i);
  if (chat) text = text.slice(0, chat.index);
  return text.replace(/\/+$/, '');
}

function imageEndpoint(base, model) {
  const trimmed = normalizeImageBase(base);
  if (!trimmed) return {url: '/images/generations', native: false, kind: 'openai'};
  let parsed = null;
  try { parsed = new URL(trimmed); } catch { parsed = null; }
  const path = parsed ? parsed.pathname.replace(/\/+$/, '') : '';
  // Wan 2.6 Image has no OpenAI Images endpoint. With text-only input,
  // use its native async protocol to avoid the sync interleaved/SSE requirement.
  if (parsed && dashscopeHost(parsed.hostname) && wan26Image(model)) {
    return {url: parsed.origin + '/api/v1/services/aigc/image-generation/generation', native: true, kind: 'multimodal-async'};
  }
  // Respect explicitly supplied native endpoints, including the 3.0 async protocol.
  if (parsed && /\/api\/v1\/services\/aigc\/image-generation\/generation$/i.test(path)) {
    return {url: parsed.origin + path, native: true, kind: 'multimodal-async'};
  }
  if (parsed && /\/api\/v1\/services\/aigc\/multimodal-generation\/generation$/i.test(path)) {
    return {url: parsed.origin + path, native: false, kind: 'multimodal'};
  }
  if (parsed && sharedDashscopeImageHost(parsed.hostname)) {
    if ((path === '/api/v1' || path.startsWith('/api/v1/')) && !qwenImageModel(model)) return asyncEndpoint(parsed);
    return multimodalEndpoint(parsed);
  }
  if (parsed && /\/images\/generations$/i.test(path)) {
    const kind = /compatible-mode/i.test(path) ? 'compatible' : 'openai';
    return {url: parsed.origin + path + parsed.search, native: false, kind};
  }
  if (!parsed && /\/images\/generations$/i.test(trimmed)) {
    const kind = /compatible-mode/i.test(trimmed) ? 'compatible' : 'openai';
    return {url: trimmed, native: false, kind};
  }
  const compatible = /compatible-mode/i.test(parsed ? path : trimmed);
  if (compatible) {
    const source = parsed ? path : trimmed;
    const suffix = /\/compatible-mode$/i.test(source) ? '/v1/images/generations' : '/images/generations';
    if (parsed) return {url: parsed.origin + path + suffix + parsed.search, native: false, kind: 'compatible'};
    return {url: trimmed + suffix, native: false, kind: 'compatible'};
  }
  if (parsed && dashscopeHost(parsed.hostname)) {
    if (path === '/api/v1' || path.startsWith('/api/v1/')) {
      if (qwenImageModel(model)) return multimodalEndpoint(parsed);
      return asyncEndpoint(parsed);
    }
    if (path === '') return {url: parsed.origin + '/compatible-mode/v1/images/generations', native: false, kind: 'compatible'};
  }
  if (parsed) return {url: parsed.origin + (path || '') + '/images/generations' + parsed.search, native: false, kind: 'openai'};
  return {url: trimmed + '/images/generations', native: false, kind: 'openai'};
}

function imageBody(product, model, kind) {
  const prompt = furniturePrompt(product);
  const size = imageSize(model, kind);
  if (kind === 'multimodal' || kind === 'multimodal-async') {
    return {model, input: {messages: [{role: 'user', content: [{text: prompt}]}]}, parameters: {size, n: 1, watermark: false, ...fastOptions(model)}};
  }
  if (kind === 'async') return {model, input: {prompt}, parameters: {size, n: 1}};
  if (kind === 'compatible') return {model, prompt, size, n: 1, prompt_extend: true, ...fastOptions(model)};
  return {model, prompt, size, n: 1};
}

function outgoingBody(request) {
  const kind = request?.kind;
  const source = request?.body || {};
  const nested = source.input?.messages?.[0]?.content?.[0]?.text;
  const prompt = stripImageRefs(source.prompt || source.input?.prompt || nested || '');
  if (kind === 'multimodal' || kind === 'multimodal-async') {
    return {
      model: source.model,
      input: {messages: [{role: 'user', content: [{text: prompt}]}]},
      parameters: {size: source.parameters?.size, n: 1, watermark: false, ...fastOptions(source.model)},
    };
  }
  if (kind === 'async') {
    return {model: source.model, input: {prompt}, parameters: {size: source.parameters?.size, n: 1}};
  }
  if (kind === 'compatible') return {model: source.model, prompt, size: '1024x1024', n: 1, prompt_extend: true, ...fastOptions(source.model)};
  return {model: source.model, prompt, size: source.size, n: 1};
}

function taskEndpoint(endpoint, taskId) {
  const parsed = new URL(endpoint);
  return parsed.origin + '/api/v1/tasks/' + encodeURIComponent(taskId);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detailText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function redactDetail(text, secret) {
  let value = String(text || '');
  const key = String(secret || '');
  if (key.length >= 4) value = value.split(key).join('');
  value = value.replace(/Bearer\s+\S+/gi, '');
  value = value.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '');
  value = value.replace(/\b(?:api[_-]?key|access[_-]?token)\s*[:=]\s*\S+/gi, '');
  value = value.replace(/\s+/g, ' ').trim();
  if (value.length > 80) value = value.slice(0, 80).trim();
  return value;
}

function providerDetail(payload, secret) {
  const raw = detailText(payload?.error?.message)
    || detailText(payload?.message)
    || detailText(payload?.output?.message)
    || detailText(payload?.error?.code)
    || detailText(payload?.code)
    || detailText(payload?.output?.code);
  return redactDetail(raw, secret);
}

function requestPath(endpoint) {
  const text = String(endpoint || '').trim();
  if (!text) return '';
  try {
    const path = new URL(text).pathname || '';
    return path.replace(/\/+$/, '') || '/';
  } catch {
    const bare = text.split('?')[0].split('#')[0];
    if (!bare.startsWith('/')) return '';
    return bare.replace(/\/+$/, '') || '/';
  }
}

function capVisible(text, secret) {
  let value = String(text || '');
  const key = String(secret || '');
  if (key.length >= 4) value = value.split(key).join('');
  value = value.replace(/Bearer\s+\S+/gi, '');
  value = value.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '');
  value = value.replace(/\s+/g, ' ').trim();
  if (value.length > 160) value = value.slice(0, 160).trim();
  return value;
}

function httpFailureLabel(status, payload, secret, endpoint) {
  const detail = providerDetail(payload, secret);
  const path = requestPath(endpoint);
  const where = path ? `（${path}）` : '';
  const label = detail ? `生图接口返回 HTTP ${status}${where}：${detail}` : `生图接口返回 HTTP ${status}${where}`;
  return capVisible(label, secret);
}

function isQuotaFailure(status, payload, raw) {
  if (status === 402 || status === 429) return true;
  const code = String(payload?.code || payload?.error?.code || payload?.error?.type || '');
  const message = String(payload?.message || payload?.error?.message || payload?.msg || '');
  const blob = `${code}\n${message}\n${raw || ''}`.toLowerCase();
  return /quota|billing|arrearage|insufficient|balance|欠费|额度|余额|allocationquota|unpurchased|free tier|freetier/.test(blob);
}

function skipped(request, status) {
  return {simulation: true, called: false, pending_human: true, url: '', label: '没有调用生图接口：' + status.issues.join('；'), request};
}

function failedCall(request, label, extra = {}) {
  return {
    simulation: false,
    called: true,
    pending_human: true,
    ok: false,
    quota: Boolean(extra.quota),
    network: Boolean(extra.network),
    url: '',
    label,
    request,
  };
}

function httpUrl(value) {
  const text = String(value || '').trim();
  if (!/^https?:\/\//i.test(text)) return '';
  return text;
}

function dataImage(value) {
  const text = String(value || '').trim().replace(/\s+/g, '');
  if (!/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(text)) return '';
  return text;
}

function b64Image(value) {
  const text = String(value || '').replace(/\s+/g, '');
  if (text.length < 32 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return '';
  let mime = 'image/png';
  if (text.startsWith('/9j/')) mime = 'image/jpeg';
  else if (text.startsWith('R0lGOD')) mime = 'image/gif';
  else if (text.startsWith('UklGR')) mime = 'image/webp';
  return `data:${mime};base64,${text}`;
}

function nestedImage(value, depth) {
  if (value == null || depth > 3) return '';
  if (typeof value === 'string') return httpUrl(value) || dataImage(value);
  if (typeof value !== 'object') return '';
  return nestedImage(value.url, depth + 1)
    || nestedImage(value.image, depth + 1)
    || nestedImage(value.image_url, depth + 1)
    || b64Image(value.b64_json);
}

function imageUrlFrom(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const rows = [];
  if (Array.isArray(payload.data)) rows.push(...payload.data);
  else if (payload.data && typeof payload.data === 'object') rows.push(payload.data);
  if (Array.isArray(payload.output?.results)) rows.push(...payload.output.results);
  for (const item of rows) {
    const url = nestedImage(item, 0);
    if (url) return url;
  }
  const choices = []
    .concat(Array.isArray(payload.choices) ? payload.choices : [])
    .concat(Array.isArray(payload.output?.choices) ? payload.output.choices : []);
  for (const choice of choices) {
    const content = choice?.message?.content;
    const parts = Array.isArray(content) ? content : [content];
    for (const part of parts) {
      const url = nestedImage(part, 0);
      if (url) return url;
    }
  }
  return nestedImage(payload.output, 0) || nestedImage(payload.url, 0);
}

async function readPayload(response) {
  if (typeof response?.text === 'function') {
    let raw = '';
    try { raw = await response.text(); } catch { raw = ''; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (typeof response?.json === 'function') {
    try { return await response.json(); } catch { return null; }
  }
  return null;
}

async function finishImage(response, request, secret = '', known, endpoint) {
  const status = Number(response?.status || 0);
  const payload = known === undefined ? await readPayload(response) : known;
  const quota = isQuotaFailure(status, payload, '');
  if (!response?.ok) {
    let label = status > 0 ? httpFailureLabel(status, payload, secret, endpoint || request?.url) : '返回里没有图片地址';
    if (status === 400 && /url error,?\s*please check url/i.test(providerDetail(payload, secret))) {
      const model = redactDetail(request?.body?.model || '', secret);
      label = `生图接口返回 HTTP 400：模型与接口可能不匹配。当前模型「${model}」（${requestPath(endpoint || request?.url)}）。请核对 IMAGE_MODEL、接口协议和业务空间；运行 npm run doctor 查看生效配置。`;
    }
    const requestId = redactDetail(String(payload?.request_id || response?.headers?.get?.('x-request-id') || response?.headers?.get?.('x-dashscope-request-id') || ''), secret);
    const code = redactDetail(String(payload?.code || payload?.error?.code || ''), secret);
    return {...failedCall(request, label + (requestId ? `；请求编号：${requestId}` : ''), {quota}), httpStatus: status, code, requestId};
  }
  const url = imageUrlFrom(payload);
  if (!url) return failedCall(request, '返回里没有图片地址', {quota});
  return {simulation: false, called: true, pending_human: true, ok: true, url, label: '待核对', request};
}

async function failureFromThrow(error, request) {
  const { isTransportError } = await import("./limits");
  const message = String(error?.message || error || '');
  if (isQuotaFailure(0, null, message) && !isTransportError(error)) {
    return failedCall(request, '返回里没有图片地址', {quota: true});
  }
  if (isTransportError(error)) return failedCall(request, '网络异常或等待超时，生成结果未知。未自动重试，请先核对结果和用量。', {network: true});
  return failedCall(request, '返回里没有图片地址');
}

function taskFailure(response, payload, request, secret, endpoint) {
  const status = Number(response?.status || 0);
  const detail = providerDetail(payload, secret);
  const quota = isQuotaFailure(status, payload, '');
  const label = detail ? httpFailureLabel(status, payload, secret, endpoint || request?.url) : '返回里没有图片地址';
  return failedCall(request, label, {quota});
}

function producedUrl(url, request) {
  return {simulation: false, called: true, pending_human: true, ok: true, url, label: '待核对', request};
}

async function pollNative(endpoint, request, secret, fetcher) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (attempt > 0) await wait(1500);
    const response = await fetcher(endpoint, {
      method: 'GET',
      redirect: 'manual',
      headers: {Authorization: 'Bearer ' + secret},
    });
    const payload = await readPayload(response);
    if (!response?.ok) return finishImage(response, request, secret, payload, endpoint);
    const taskStatus = String(payload?.output?.task_status || '');
    const url = imageUrlFrom(payload);
    if (url && taskStatus !== 'PENDING' && taskStatus !== 'RUNNING') return producedUrl(url, request);
    if (taskStatus === 'SUCCEEDED') return failedCall(request, '返回里没有图片地址');
    if (taskStatus === 'FAILED' || taskStatus === 'CANCELED' || taskStatus === 'UNKNOWN') {
      return taskFailure(response, payload, request, secret, endpoint);
    }
  }
  return failedCall(request, '生成仍在处理中，结果未知。未重新提交，请先核对结果和用量。', {network: true});
}

async function readNative(response, request, secret, fetcher) {
  const payload = await readPayload(response);
  if (!response?.ok) return finishImage(response, request, secret, payload);
  const taskStatus = String(payload?.output?.task_status || '');
  const url = imageUrlFrom(payload);
  if (url && taskStatus !== 'PENDING' && taskStatus !== 'RUNNING') return producedUrl(url, request);
  if (taskStatus === 'FAILED' || taskStatus === 'CANCELED' || taskStatus === 'UNKNOWN') {
    return taskFailure(response, payload, request, secret);
  }
  const taskId = String(payload?.output?.task_id || payload?.task_id || '').trim();
  if (!taskId) return failedCall(request, '返回里没有图片地址');
  return pollNative(taskEndpoint(request.url, taskId), request, secret, fetcher);
}

async function requestImage(request, env, fetcher) {
  const key = imageKey(env);
  const headers = {'Content-Type': 'application/json', Authorization: 'Bearer ' + key};
  if (request.native) headers['X-DashScope-Async'] = 'enable';
  request.body = outgoingBody(request);
  const response = await fetcher(request.url, {
    method: 'POST',
    redirect: 'manual',
    headers,
    body: JSON.stringify(request.body)
  });
  if (!request.native) return finishImage(response, request, key);
  return readNative(response, request, key, fetcher);
}

function modelEndpointIssue(base, model) {
  let parsed;
  try { parsed = new URL(base); } catch { return ''; }
  if (!dashscopeHost(parsed.hostname)) return '';
  // Qwen chat/VL/embedding names cannot be used as text-to-image models.
  if (/^qwen(?!-image(?:-|$))/i.test(model) || /^(?:text-embedding|multimodal-embedding|gte-|deepseek|qwq|qvq)/i.test(model)) {
    return `IMAGE_MODEL「${model}」不是图像生成模型，请填写 qwen-image-3.0 或 qwen-image-3.0-pro 等生图模型`;
  }
  return '';
}

function imageKey(env) {
  const own = cleanEnv(env.IMAGE_API_KEY);
  if (own) return own;
  try {
    const parsed = new URL(cleanEnv(env.IMAGE_API_BASE));
    if (parsed.protocol === 'https:' && dashscopeHost(parsed.hostname)) return cleanEnv(env.DASHSCOPE_API_KEY);
  } catch { /* Invalid address is reported by imageStatus. */ }
  return '';
}

export function imageStatus(env = process.env) {
  const base = cleanEnv(env.IMAGE_API_BASE);
  const model = cleanEnv(env.IMAGE_MODEL);
  const key = imageKey(env);
  const keyConfigured = key.length > 0 && !/\s|[“”‘’]/.test(key);
  const enabled = imageEnabled(env);
  const issues = [];
  if (!enabled) issues.push('生图开关已关闭，请检查 GUIDE_IMAGE_ENABLED 和配置文件覆盖');
  if (!base) issues.push('缺少 IMAGE_API_BASE');
  else {
    try {
      const parsed = new URL(base);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || /[{}<>]/.test(base)) throw new Error('invalid');
    } catch { issues.push('IMAGE_API_BASE 不是有效接口地址，请填写控制台的完整地址'); }
  }
  if (!model) issues.push('缺少 IMAGE_MODEL');
  else if (/\s|[,，/]/.test(model)) issues.push('IMAGE_MODEL 只能填写一个模型名称');
  else { const issue = modelEndpointIssue(base, model); if (issue) issues.push(issue); }
  if (!keyConfigured) issues.push('生图密钥未配置或格式不正确');
  const ready = issues.length === 0;
  return {ready, enabled, baseConfigured: Boolean(base), model: model || null, keyConfigured,
    keySource: cleanEnv(env.IMAGE_API_KEY) ? 'IMAGE_API_KEY' : key ? 'DASHSCOPE_API_KEY' : null,
    issues};
}

export function imageRequest(product, env = process.env) {
  const status = imageStatus(env);
  const base = cleanEnv(env.IMAGE_API_BASE).replace(/\/+$/, '');
  const model = cleanEnv(env.IMAGE_MODEL);
  const endpoint = imageEndpoint(status.baseConfigured ? base : '', model);
  return {
    method: 'POST',
    url: endpoint.url,
    native: endpoint.native,
    kind: endpoint.kind,
    body: imageBody(product, model, endpoint.kind),
  };
}

function producedImage(result) {
  return Boolean(result?.url) && !result.simulation && !result.quota && !result.capped && !result.network;
}

export async function executeImage(product, env = process.env, fetcher = fetch, sessionId = null, options = {}) {
  const status = imageStatus(env);
  const request = imageRequest(product, env);
  if (!status.ready) return skipped(request, status);
  const withinPiece = Boolean(options.withinPiece);
  let charged = false;
  if (sessionId && !withinPiece) {
    const { consumeCall } = await import("./db");
    const { LIMITS, capText } = await import("./limits");
    const gate = consumeCall(sessionId, "image", LIMITS.image);
    if (!gate.ok) {
      return {simulation: true, called: false, capped: true, pending_human: true, label: capText("image"), request};
    }
    charged = true;
  }
  let result;
  try {
    result = await withDeadline(async (signal) => {
      const boundedFetch = (url, init) => {
        signal.throwIfAborted();
        return fetcher(url, { ...init, signal });
      };
      return requestImage(request, env, boundedFetch);
    }, options.timeoutMs ?? IMAGE_TIMEOUT_MS);
  } catch (error) {
    result = await failureFromThrow(error, request);
  }
  const produced = producedImage(result);
  if (charged && !produced) {
    const { releaseCall } = await import("./db");
    releaseCall(sessionId, "image");
  }
  if (withinPiece && sessionId && produced) {
    const { consumeCall } = await import("./db");
    const { LIMITS } = await import("./limits");
    consumeCall(sessionId, "image", LIMITS.image);
  }
  return result;
}
