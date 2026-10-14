function imageEnabled(env) {
  const flag = String(env?.GUIDE_IMAGE_ENABLED ?? '').trim().toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'off';
}

function isQuotaFailure(status, payload, raw) {
  if (status === 402 || status === 429) return true;
  const code = String(payload?.code || payload?.error?.code || payload?.error?.type || '');
  const message = String(payload?.message || payload?.error?.message || payload?.msg || '');
  const blob = `${code}\n${message}\n${raw || ''}`.toLowerCase();
  return /quota|billing|arrearage|insufficient|balance|欠费|额度|余额|allocationquota|unpurchased|free tier|freetier/.test(blob);
}

async function responseQuota(response) {
  const status = Number(response?.status || 0);
  let raw = '';
  if (typeof response?.text === 'function') {
    try { raw = await response.text(); } catch { raw = ''; }
  } else if (typeof response?.json === 'function') {
    try { raw = JSON.stringify(await response.json()); } catch { raw = ''; }
  }
  let payload = null;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  return isQuotaFailure(status, payload, raw);
}

function placeholder(request) {
  return {simulation: true, called: false, pending_human: true, quota: true, label: '演示回放、待核对', request};
}

export function imageStatus(env = process.env) {
  const base = typeof env.IMAGE_API_BASE === 'string' ? env.IMAGE_API_BASE.trim() : '';
  const model = typeof env.IMAGE_MODEL === 'string' ? env.IMAGE_MODEL.trim() : '';
  const raw = env.IMAGE_API_KEY;
  const key = typeof raw === 'string' ? raw.trim() : '';
  const keyConfigured = key.length > 0 && !/\s/.test(key);
  const enabled = imageEnabled(env);
  const ready = Boolean(enabled && base && model && keyConfigured);
  return {ready, enabled, baseConfigured: Boolean(base), model: model || null, keyConfigured};
}

export function imageRequest(product, env = process.env) {
  const status = imageStatus(env);
  return {
    method: 'POST',
    url: (status.baseConfigured ? env.IMAGE_API_BASE.trim().replace(/\/$/, '') : '') + '/images/generations',
    body: {
      model: env.IMAGE_MODEL?.trim() || '',
      prompt: `家具示意。保持资料中的名称、颜色和材质，不要改成另一种商品。${product.name}，${product.color}${product.material}，型号${product.model}。`,
      size: '1024x1024',
      n: 1,
      response_format: 'url'
    }
  };
}

export async function executeImage(product, env = process.env, fetcher = fetch) {
  const status = imageStatus(env);
  const request = imageRequest(product, env);
  if (!status.ready) {
    return {simulation: true, called: false, pending_human: true, label: '演示回放、待核对', request};
  }
  try {
    const response = await fetcher(request.url, {
      method: 'POST',
      redirect: 'manual',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + String(env.IMAGE_API_KEY).trim()},
      body: JSON.stringify(request.body)
    });
    if (!response.ok && await responseQuota(response)) return {...placeholder(request), quota: true};
    return {simulation: false, called: true, pending_human: true, ok: response.ok, label: '待核对', request};
  } catch (error) {
    if (isQuotaFailure(0, null, String(error?.message || error))) return {...placeholder(request), quota: true};
    throw error;
  }
}
