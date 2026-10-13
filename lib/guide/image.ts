// @ts-nocheck
export function imageStatus(env = process.env) {
  const base = typeof env.IMAGE_API_BASE === 'string' ? env.IMAGE_API_BASE.trim() : '';
  const model = typeof env.IMAGE_MODEL === 'string' ? env.IMAGE_MODEL.trim() : '';
  const raw = env.IMAGE_API_KEY;
  const key = typeof raw === 'string' ? raw.trim() : '';
  const keyConfigured = key.length > 0 && !/\s/.test(key);
  const ready = Boolean(base && model && keyConfigured);
  return {ready, baseConfigured: Boolean(base), model: model || null, keyConfigured};
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

export async function executeImage(product, env = process.env, fetcher = fetch, sessionId = null) {
  const status = imageStatus(env);
  const request = imageRequest(product, env);
  if (sessionId) {
    const { consumeCall } = await import("./db");
    const { LIMITS, capText, isTransportError } = await import("./limits");
    const gate = consumeCall(sessionId, "image", LIMITS.image);
    if (!gate.ok) {
      return {simulation: true, called: false, capped: true, pending_human: true, label: capText("image"), request};
    }
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
      return {simulation: false, called: true, pending_human: true, ok: response.ok, label: '待核对', request};
    } catch (error) {
      if (!isTransportError(error)) throw error;
      return {simulation: false, called: true, network: true, pending_human: true, label: '网络错误', request};
    }
  }
  if (!status.ready) {
    return {simulation: true, called: false, pending_human: true, label: '演示回放、待核对', request};
  }
  const response = await fetcher(request.url, {
    method: 'POST',
    redirect: 'manual',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + String(env.IMAGE_API_KEY).trim()},
    body: JSON.stringify(request.body)
  });
  return {simulation: false, called: true, pending_human: true, ok: response.ok, label: '待核对', request};
}
