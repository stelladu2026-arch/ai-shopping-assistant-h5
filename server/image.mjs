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
    || detailText(payload?.error?.code)
    || detailText(payload?.code);
  return redactDetail(raw, secret);
}

function httpFailureLabel(status, payload, secret) {
  const detail = providerDetail(payload, secret);
  return detail ? `生图接口返回 HTTP ${status}：${detail}` : `生图接口返回 HTTP ${status}`;
}

function isQuotaFailure(status, payload, raw) {
  if (status === 402 || status === 429) return true;
  const code = String(payload?.code || payload?.error?.code || payload?.error?.type || '');
  const message = String(payload?.message || payload?.error?.message || payload?.msg || '');
  const blob = `${code}\n${message}\n${raw || ''}`.toLowerCase();
  return /quota|billing|arrearage|insufficient|balance|欠费|额度|余额|allocationquota|unpurchased|free tier|freetier/.test(blob);
}

function isTransportError(error) {
  if (!error) return false;
  const name = String(error.name || '');
  const message = String(error.message || error);
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  return /network|fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|timeout|socket|aborted/i.test(message);
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

async function finishImage(response, request, secret = '') {
  const status = Number(response?.status || 0);
  const payload = await readPayload(response);
  const quota = isQuotaFailure(status, payload, '');
  if (!response?.ok) {
    const label = status > 0 ? httpFailureLabel(status, payload, secret) : '返回里没有图片地址';
    return failedCall(request, label, {quota});
  }
  const url = imageUrlFrom(payload);
  if (!url) return failedCall(request, '返回里没有图片地址', {quota});
  return {simulation: false, called: true, pending_human: true, ok: true, url, label: '待核对', request};
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
  const base = cleanEnv(env.IMAGE_API_BASE).replace(/\/$/, '');
  const model = cleanEnv(env.IMAGE_MODEL);
  return {
    method: 'POST',
    url: (status.baseConfigured ? base : '') + '/images/generations',
    body: {
      model,
      prompt: `家具示意。保持资料中的名称、颜色和材质，不要改成另一种商品。${product.name}，${product.color}${product.material}，型号${product.model}。`,
      size: imageSize(model),
      n: 1
    }
  };
}

export async function executeImage(product, env = process.env, fetcher = fetch) {
  const status = imageStatus(env);
  const request = imageRequest(product, env);
  if (!status.ready) return skipped(request);
  const key = cleanEnv(env.IMAGE_API_KEY);
  try {
    const response = await fetcher(request.url, {
      method: 'POST',
      redirect: 'manual',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + key},
      body: JSON.stringify(request.body)
    });
    return finishImage(response, request, key);
  } catch (error) {
    const message = String(error?.message || error || '');
    if (isQuotaFailure(0, null, message) && !isTransportError(error)) {
      return failedCall(request, '返回里没有图片地址', {quota: true});
    }
    if (isTransportError(error)) return failedCall(request, '网络错误', {network: true});
    return failedCall(request, '返回里没有图片地址');
  }
}
