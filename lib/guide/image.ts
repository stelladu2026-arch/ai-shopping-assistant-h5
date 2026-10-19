// @ts-nocheck
function imageEnabled(env) {
  const flag = String(env?.GUIDE_IMAGE_ENABLED ?? '').trim().toLowerCase();
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

function imageSize(model) {
  if (dashscopeImageModel(model)) return '1328*1328';
  return '1024x1024'.replace(/x/gi, '*');
}

function furniturePrompt(product) {
  const name = product?.name || '';
  const color = product?.color || '';
  const material = product?.material || '';
  const model = product?.model || '';
  return `家具示意。保持资料中的名称、颜色和材质，不要改成另一种商品。${name}，${color}${material}，型号${model}。`;
}

function dashscopeHost(hostname) {
  return /(^|\.)dashscope(?:-[a-z0-9]+)?\.aliyuncs\.com$/i.test(String(hostname || ''))
    || /\.maas\.aliyuncs\.com$/i.test(String(hostname || ''));
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
  if (parsed && /\/images\/generations$/i.test(path)) {
    return {url: parsed.origin + path + parsed.search, native: false, kind: 'openai'};
  }
  if (!parsed && /\/images\/generations$/i.test(trimmed)) return {url: trimmed, native: false, kind: 'openai'};
  const compatible = /compatible-mode/i.test(parsed ? path : trimmed);
  if (compatible) {
    const source = parsed ? path : trimmed;
    const suffix = /\/compatible-mode$/i.test(source) ? '/v1/images/generations' : '/images/generations';
    if (parsed) return {url: parsed.origin + path + suffix + parsed.search, native: false, kind: 'openai'};
    return {url: trimmed + suffix, native: false, kind: 'openai'};
  }
  if (parsed && dashscopeHost(parsed.hostname)) {
    if (path === '/api/v1' || path.startsWith('/api/v1/')) {
      if (qwenImageModel(model)) {
        return {url: parsed.origin + '/api/v1/services/aigc/multimodal-generation/generation', native: false, kind: 'multimodal'};
      }
      return {url: parsed.origin + '/api/v1/services/aigc/text2image/image-synthesis', native: true, kind: 'async'};
    }
    if (path === '') return {url: parsed.origin + '/compatible-mode/v1/images/generations', native: false, kind: 'openai'};
  }
  if (parsed) return {url: parsed.origin + (path || '') + '/images/generations' + parsed.search, native: false, kind: 'openai'};
  return {url: trimmed + '/images/generations', native: false, kind: 'openai'};
}

function imageBody(product, model, kind) {
  const prompt = furniturePrompt(product);
  const size = imageSize(model);
  if (kind === 'multimodal') {
    return {model, input: {messages: [{role: 'user', content: [{text: prompt}]}]}, parameters: {size, n: 1, watermark: false}};
  }
  if (kind === 'async') return {model, input: {prompt}, parameters: {size, n: 1}};
  return {model, prompt, size, n: 1};
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

function skipped(request) {
  return {simulation: true, called: false, pending_human: true, url: '', label: '没有调用生图接口', request};
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
    const label = status > 0 ? httpFailureLabel(status, payload, secret, endpoint || request?.url) : '返回里没有图片地址';
    return failedCall(request, label, {quota});
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
  if (isTransportError(error)) return failedCall(request, '网络错误', {network: true});
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
  return failedCall(request, '返回里没有图片地址');
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
  const key = cleanEnv(env.IMAGE_API_KEY);
  const headers = {'Content-Type': 'application/json', Authorization: 'Bearer ' + key};
  if (request.native) headers['X-DashScope-Async'] = 'enable';
  const response = await fetcher(request.url, {
    method: 'POST',
    redirect: 'manual',
    headers,
    body: JSON.stringify(request.body)
  });
  if (!request.native) return finishImage(response, request, key);
  return readNative(response, request, key, fetcher);
}

export function imageStatus(env = process.env) {
  const base = cleanEnv(env.IMAGE_API_BASE);
  const model = cleanEnv(env.IMAGE_MODEL);
  const key = cleanEnv(env.IMAGE_API_KEY);
  const keyConfigured = key.length > 0 && !/\s/.test(key);
  const enabled = imageEnabled(env);
  const ready = Boolean(enabled && base && model && keyConfigured);
  return {ready, enabled, baseConfigured: Boolean(base), model: model || null, keyConfigured};
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
    body: imageBody(product, model, endpoint.kind),
  };
}

function producedImage(result) {
  return Boolean(result?.url) && !result.simulation && !result.quota && !result.capped && !result.network;
}

export async function executeImage(product, env = process.env, fetcher = fetch, sessionId = null, options = {}) {
  const status = imageStatus(env);
  const request = imageRequest(product, env);
  if (!status.ready) return skipped(request);
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
    result = await requestImage(request, env, fetcher);
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
