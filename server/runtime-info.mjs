export const GUIDE_RUNTIME_VERSION = 'guide-wan26-four-images-20261020';

export function imageDiagnostics(env, imageStatus, imageRequest) {
  const status = imageStatus(env);
  let endpoint = null;
  let protocol = null;
  try {
    const request = imageRequest({name:'配置检查'}, env);
    const url = new URL(request.url);
    endpoint = url.origin + url.pathname;
    protocol = request.kind;
  } catch {}
  return { runtimeVersion: GUIDE_RUNTIME_VERSION, image: status, endpoint, protocol };
}
