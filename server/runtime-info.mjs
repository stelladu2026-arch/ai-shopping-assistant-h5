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
  const expectedKeys = ['IMAGE_API_BASE','IMAGE_MODEL','IMAGE_API_KEY','GUIDE_IMAGE_ENABLED','DASHSCOPE_API_KEY','GUIDE_AGENT_LIVE_MODEL','QWEN_FREE_TIER_ONLY_CONFIRMED','GUIDE_DATABASE_URL','GUIDE_DATABASE_AUTH_TOKEN'];
  const recognized = expectedKeys.filter(key => Object.hasOwn(env, key));
  const unrecognized = Object.keys(env).filter(key => /^(IMAGE|IMA(?:\.|…)|GUIDE_A|GUIDE_IMAGE|DASHSCOPE|QWEN_FREE)/.test(key) && !expectedKeys.includes(key)).map(key => key.slice(0, 80)).slice(0, 20);
  return {
    runtimeVersion: GUIDE_RUNTIME_VERSION,
    diagnosticsVersion: 'configuration-keys-v1',
    deployment: {
      projectId: env.VERCEL_PROJECT_ID || null,
      environment: env.VERCEL_ENV || null,
      commit: env.VERCEL_GIT_COMMIT_SHA || null,
      host: env.VERCEL_URL || null,
    },
    configurationKeys: { recognized, unrecognized },
    storage: storageDiagnostics(env),
    image: status, endpoint, protocol,
  };
}

export function storageDiagnostics(env) {
  const configured = Boolean(env.GUIDE_DATABASE_URL?.trim());
  const localFixture = /^file:/.test(env.GUIDE_DATABASE_URL || '');
  const supported = /^(libsql|https):\/\//.test(env.GUIDE_DATABASE_URL || '') || (!env.VERCEL && localFixture);
  const credentialsConfigured = Boolean(env.GUIDE_DATABASE_AUTH_TOKEN?.trim()) || localFixture;
  return {
    mode: configured ? 'shared-libsql' : env.VERCEL ? 'temporary-sqlite' : 'local-sqlite',
    configured, credentialsConfigured,
    configurationReady: configured && supported && credentialsConfigured,
    connectivityChecked: false,
    note: configured ? '仅检查配置，未连接数据库；连接失败不会退回临时存储。'
      : env.VERCEL ? '当前使用临时 SQLite，不能保证跨实例共享或长期保存。' : '当前使用本地 SQLite。',
  };
}
