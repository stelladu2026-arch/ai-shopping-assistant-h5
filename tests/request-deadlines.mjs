import './register-ts.mjs';
import assert from 'node:assert/strict';
import { withDeadline, fetchJsonResponse } from '../lib/request-deadline.ts';
import { rankByRemote } from '../lib/guide/rag.ts';
import { searchStore } from '../lib/guide/knowledge.ts';
import { executeLiveCopy, executeInterpret } from '../lib/guide/model.ts';
import { executeImage } from '../lib/guide/image.ts';

const never = () => new Promise(() => {});
const env = { GUIDE_RAG_REMOTE_CONFIRMED: 'true', GUIDE_RAG_EMBED_BASE: 'https://fixture.invalid/v1', GUIDE_RAG_EMBED_API_KEY: 'fixture' };
const chunks = [{ title: '售后说明', text: '售后请核对订单' }];
assert.equal(await withDeadline(async () => 'ok', 100), 'ok');
let signal;
await assert.rejects(withDeadline(async (s) => { signal = s; return never(); }, 20), { name: 'TimeoutError' });
assert.equal(signal.aborted, true);
// Response headers arriving must not disable the deadline for a stalled body.
await assert.rejects(fetchJsonResponse('/fixture', {}, 20, async (_, init) => {
  signal = init.signal;
  return { ok: true, json: never };
}), { name: 'TimeoutError' });
assert.equal(signal.aborted, true);

let calls = 0;
await assert.rejects(rankByRemote('售后', chunks, env, async (_, init) => {
  calls++; signal = init.signal; return never();
}, 20), { name: 'TimeoutError' });
assert.equal(calls, 1);
assert.equal(signal.aborted, true);

globalThis.__guideChunkEmbedCache = new Map();
calls = 0;
await assert.rejects(rankByRemote('售后', chunks, env, async (url, init) => {
  calls++; signal = init.signal;
  if (url.endsWith('/embeddings')) return { ok: true, status: 200, json: async () => ({ data: JSON.parse(init.body).input.map((_, index) => ({ index, embedding: [1, 1] })) }) };
  return { ok: true, status: 200, json: never };
}, 20), { name: 'TimeoutError' });
assert.equal(calls, 2);
assert.equal(signal.aborted, true);

const local = await searchStore('坏了怎么办', undefined, { env, deadlineAt: Date.now() + 20, fetcher: never });
assert.equal(local.method, 'demo_rerank');
assert.equal(local.hit.title, '售后说明');
assert.match(local.fallbackNote, /未完成|上限/);
calls = 0;
await searchStore('坏了怎么办', undefined, { env, deadlineAt: Date.now() - 1, fetcher: () => { calls++; return never(); } });
assert.equal(calls, 0, 'exhausted decision deadline must not start another paid request');

const modelEnv = { DASHSCOPE_API_KEY: 'fixture', QWEN_FREE_TIER_ONLY_CONFIRMED: 'true', GUIDE_AGENT_LIVE_MODEL: 'true' };
for (const operation of [
  (fetcher) => executeLiveCopy({ factIds: ['S01'] }, modelEnv, fetcher, 20),
  (fetcher) => executeInterpret('预算3千', modelEnv, fetcher, 20),
]) {
  calls = 0;
  const result = await operation(async (_, init) => {
    calls++; signal = init.signal; return { ok: true, status: 200, json: never };
  });
  assert.equal(result.error, 'MODEL_TIMEOUT');
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
}
const imageEnv = { GUIDE_IMAGE_ENABLED: 'true', IMAGE_API_BASE: 'https://fixture.invalid/v1', IMAGE_MODEL: 'fixture', IMAGE_API_KEY: 'fixture' };
calls = 0;
const image = await executeImage({ id: 'S01', name: '测试商品' }, imageEnv, async (_, init) => {
  calls++; signal = init.signal; return { ok: true, status: 200, text: never };
}, null, { timeoutMs: 20 });
assert.equal(image.network, true);
assert.match(image.label, /结果未知/);
assert.equal(signal.aborted, true);
assert.equal(calls, 1);
console.log('ok request deadlines: stalled fetch/body, rerank, local fallback, shared budget, model and image; no retries');
