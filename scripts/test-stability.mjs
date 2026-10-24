import { spawnSync } from 'node:child_process';
const tests = [
  'request-deadlines', 'session-isolation', 'shared-storage', 'image-call', 'image-quota', 'image-config', 'image-set', 'edit-constraints',
  'semantic-clauses', 'demand-clarification', 'new-copy-quota', 'reset-copy-on-product', 'blank-copy-card',
  'h5-sessions', 'guide-rules', 'model-config', 'agent-modules', 'promotion-dates',
];
const env = { ...process.env, GUIDE_DATABASE_URL: '', GUIDE_DATABASE_AUTH_TOKEN: '', GUIDE_AGENT_LIVE_MODEL: 'false', GUIDE_RAG_REMOTE_CONFIRMED: 'false', GUIDE_IMAGE_ENABLED: 'false', FEISHU_SYNC_ENABLED: 'false' };
for (const test of tests) {
  const result = spawnSync(process.execPath, ['--import', './tests/register-ts.mjs', `tests/${test}.mjs`], {stdio:'inherit', env});
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`ok stability: ${tests.length} suites (real providers disabled)`);
