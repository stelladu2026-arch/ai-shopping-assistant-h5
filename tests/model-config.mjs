import assert from 'node:assert/strict';
import {copyRequestBody, executeLiveCopy, modelStatus, QWEN_BASE_URL, QWEN_MODEL} from '../server/model-config.mjs';

const next = await import('../lib/guide/model.ts');
assert.equal(next.QWEN_BASE_URL, QWEN_BASE_URL);
assert.equal(next.QWEN_MODEL, QWEN_MODEL);

const idle = modelStatus({});
assert.equal(idle.mode, 'simulation');
assert.equal(idle.ready, false);
assert.equal(idle.endpoint, QWEN_BASE_URL + '/chat/completions');
assert.equal(idle.model, QWEN_MODEL);

let calls = 0;
const skipped = await executeLiveCopy({product: {id: 'S01'}}, {}, async () => { calls += 1; throw new Error('should not call'); });
assert.equal(skipped.called, false);
assert.equal(calls, 0);

const key = 'fixture-key-not-real';
const env = {DASHSCOPE_API_KEY: key, QWEN_FREE_TIER_ONLY_CONFIRMED: 'true', GUIDE_AGENT_LIVE_MODEL: 'true'};
const bodySeen = await executeLiveCopy({maxChars: 80, factIds: ['S01'], product: {id: 'S01', name: '云朵双人沙发', price_cny: 2699}}, env, async (url, init) => {
  assert.equal(url, QWEN_BASE_URL + '/chat/completions');
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'manual');
  assert.equal(init.headers.Authorization, 'Bearer ' + key);
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'qwen3.7-plus');
  assert.equal(body.stream, false);
  assert.equal(body.enable_thinking, false);
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(init.body.includes(key), false);
  return new Response(JSON.stringify({choices: [{message: {content: '{"text":"ok"}'}}]}), {status: 200});
});
assert.equal(bodySeen.called, true);
assert.equal(JSON.stringify(copyRequestBody({maxChars: 80, factIds: ['S01']})).includes(key), false);
console.log('ok model config matches Next.js and legacy entrypoints');
