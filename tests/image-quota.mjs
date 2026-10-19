import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guideAct } from "../lib/guide/session.ts";
import { executeImage } from "../lib/guide/image.ts";

const catalogPath = new URL("../data/catalog.json", import.meta.url);
const beforeCatalog = readFileSync(catalogPath, "utf8");
const product = { id: "S01", name: "云朵双人沙发", color: "米白", material: "布艺", model: "YD-180" };
const imageEnv = {
  IMAGE_API_BASE: "http://image.test.local",
  IMAGE_MODEL: "image-fixture",
  IMAGE_API_KEY: "image-test",
};

let skippedCalls = 0;
const skipped = await executeImage(product, { ...imageEnv, GUIDE_IMAGE_ENABLED: "false" }, async () => {
  skippedCalls += 1;
  throw new Error("should not request");
});
assert.equal(skippedCalls, 0);
assert.equal(skipped.called, false);
assert.equal(skipped.simulation, true);
assert.equal(skipped.label, "没有调用生图接口");

let quotaCalls = 0;
const quota = await executeImage(product, imageEnv, async (url) => {
  quotaCalls += 1;
  assert.equal(String(url), "http://image.test.local/images/generations");
  return {
    ok: false,
    status: 403,
    text: async () => JSON.stringify({ code: "Arrearage", message: "quota exceeded" }),
  };
});
assert.equal(quotaCalls, 1);
assert.equal(quota.called, true);
assert.equal(quota.simulation, false);
assert.equal(quota.quota, true);
assert.equal(quota.label, "生图接口返回 HTTP 403");
assert.equal(quota.label.includes("演示回放"), false);

const names = ["IMAGE_API_BASE", "IMAGE_MODEL", "IMAGE_API_KEY", "GUIDE_IMAGE_ENABLED", "GUIDE_RAG_EMBED_BASE", "GUIDE_RAG_EMBED_API_KEY", "GUIDE_RAG_EMBED_MODEL", "GUIDE_RAG_RERANK_BASE", "GUIDE_RAG_RERANK_API_KEY", "GUIDE_RAG_RERANK_MODEL", "GUIDE_RAG_REMOTE_CONFIRMED", "DASHSCOPE_API_KEY", "GUIDE_AGENT_LIVE_MODEL", "QWEN_FREE_TIER_ONLY_CONFIRMED", "FEISHU_SYNC_ENABLED"];
const saved = {};
for (const name of names) {
  saved[name] = process.env[name];
  delete process.env[name];
}
const originalFetch = globalThis.fetch;
const sessionId = "image_quota_fixture";
try {
  await guideAct({ action: "reset", sessionId });
  const turned = await guideAct({
    action: "turn",
    sessionId,
    text: "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质",
  });
  assert.equal(turned.graph.modelCalled, false);
  const confirmed = await guideAct({ action: "confirm", sessionId, productId: "S01" });
  assert.equal(confirmed.structured.confirmedId, "S01");
  const materialBefore = confirmed.structured.material?.bodyText || "";

  process.env.IMAGE_API_BASE = imageEnv.IMAGE_API_BASE;
  process.env.IMAGE_MODEL = imageEnv.IMAGE_MODEL;
  process.env.IMAGE_API_KEY = imageEnv.IMAGE_API_KEY;
  process.env.GUIDE_IMAGE_ENABLED = "false";
  let disabledCalls = 0;
  globalThis.fetch = async () => {
    disabledCalls += 1;
    throw new Error("should not request");
  };
  const disabled = await guideAct({
    action: "rerun-content",
    sessionId,
    momentsInput: { outputKind: "rich", productName: "别的名字", sellingPoints: ["现货速发"], copyStyle: "warm", audience: "first_home" },
  });
  assert.equal(disabledCalls, 0);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.confirmedId, "S01");
  assert.match(disabled.moments.bodyText, /现货速发/);
  assert.match(disabled.moments.bodyText, /演示回放、待核对/);
  assert.equal(disabled.moments.generatedImageUrl, "");
  assert.equal(disabled.moments.imagePlaceholder, "没有调用生图接口");
  assert.equal(disabled.structured.confirmedId, "S01");

  process.env.GUIDE_IMAGE_ENABLED = "true";
  let billedCalls = 0;
  globalThis.fetch = async (url) => {
    billedCalls += 1;
    assert.equal(String(url).includes("/chat/completions"), false);
    assert.equal(String(url).includes("/embeddings"), false);
    assert.equal(String(url).includes("text-rerank"), false);
    return {
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ code: "Throttling.AllocationQuota", message: "billing quota" }),
    };
  };
  const billed = await guideAct({
    action: "rerun-content",
    sessionId,
    momentsInput: { outputKind: "rich", productName: "别的名字", sellingPoints: ["现货速发"], copyStyle: "warm", audience: "first_home" },
  });
  assert.equal(billedCalls, 1);
  assert.equal(billed.ok, true);
  assert.equal(billed.confirmedId, "S01");
  assert.equal(billed.confirmedUnchanged, true);
  assert.match(billed.moments.bodyText, /现货速发/);
  assert.match(billed.moments.bodyText, /云朵双人沙发/);
  assert.match(billed.moments.bodyText, /演示回放、待核对/);
  assert.equal(billed.moments.generatedImageUrl, "");
  assert.equal(billed.moments.imagePlaceholder, "生图接口返回 HTTP 429");
  assert.equal(billed.moments.imagePlaceholder.includes("演示回放"), false);
  assert.equal(billed.leadText.includes("素材没有生成"), false);
  assert.equal(materialBefore === "" || billed.moments.bodyText.length > 0, true);

  const imageUrl = "https://img.example.test/sofa.png";
  const shown = await executeImage(product, imageEnv, async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: [{ url: imageUrl }] }),
  }));
  assert.equal(shown.url, imageUrl);
  assert.equal(shown.simulation, false);
  assert.equal(shown.called, true);

  const momentsInput = { outputKind: "rich", productName: "别的名字", sellingPoints: ["现货速发"], copyStyle: "warm", audience: "first_home" };
  async function readySession(sessionId) {
    await guideAct({ action: "reset", sessionId });
    await guideAct({
      action: "turn",
      sessionId,
      text: "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质",
    });
    const confirmed = await guideAct({ action: "confirm", sessionId, productId: "S01" });
    assert.equal(confirmed.structured.confirmedId, "S01");
  }

  process.env.IMAGE_API_BASE = imageEnv.IMAGE_API_BASE;
  process.env.IMAGE_MODEL = imageEnv.IMAGE_MODEL;
  process.env.IMAGE_API_KEY = imageEnv.IMAGE_API_KEY;
  delete process.env.GUIDE_IMAGE_ENABLED;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.GUIDE_AGENT_LIVE_MODEL;
  const offlineId = "image_url_offline";
  await readySession(offlineId);
  globalThis.fetch = async (url) => {
    const href = String(url);
    assert.equal(href.includes("/chat/completions"), false);
    assert.equal(href.includes("/embeddings"), false);
    assert.equal(href.includes("feishu"), false);
    assert.equal(href, "http://image.test.local/images/generations");
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ url: imageUrl }] }),
    };
  };
  const offline = await guideAct({ action: "rerun-content", sessionId: offlineId, momentsInput });
  assert.equal(offline.ok, true);
  assert.equal(offline.confirmedId, "S01");
  assert.equal(offline.confirmedUnchanged, true);
  assert.equal(offline.moments.generatedImageUrl, imageUrl);
  assert.equal(offline.moments.imagePlaceholder || "", "");
  assert.match(offline.moments.bodyText, /云朵双人沙发/);
  assert.match(offline.moments.bodyText, /现货速发/);
  assert.match(offline.moments.bodyText, /演示回放、待核对/);
  assert.equal(offline.moments.cardTitle, "演示回放、待核对");

  const liveId = "image_url_live_quota";
  await readySession(liveId);
  process.env.DASHSCOPE_API_KEY = "fixture-key";
  process.env.QWEN_FREE_TIER_ONLY_CONFIRMED = "true";
  process.env.GUIDE_AGENT_LIVE_MODEL = "true";
  const liveSentence = "云朵双人沙发，米白布艺，标价2699元。";
  let sawCopy = false;
  let sawImage = false;
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    assert.equal(href.includes("/embeddings"), false);
    assert.equal(href.includes("text-rerank"), false);
    assert.equal(href.includes("feishu"), false);
    if (href.includes("/chat/completions")) {
      sawCopy = true;
      const body = JSON.parse(String(init?.body || "{}"));
      const packed = JSON.stringify(body);
      assert.equal(packed.includes("S02"), false);
      assert.equal(packed.includes("云朵皮质沙发"), false);
      assert.match(packed, /S01/);
      assert.match(packed, /云朵双人沙发/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ text: liveSentence, used_fact_ids: ["S01"], refused_claims: [] }) } }],
        }),
      };
    }
    if (href.includes("/images/generations")) {
      sawImage = true;
      return {
        ok: false,
        status: 402,
        text: async () => JSON.stringify({ code: "Arrearage", message: "quota exceeded" }),
      };
    }
    throw new Error("unexpected url");
  };
  const liveQuota = await guideAct({ action: "rerun-content", sessionId: liveId, momentsInput });
  assert.equal(sawCopy, true);
  assert.equal(sawImage, true);
  assert.equal(liveQuota.ok, true);
  assert.equal(liveQuota.confirmedId, "S01");
  assert.equal(liveQuota.confirmedUnchanged, true);
  assert.equal(liveQuota.moments.generatedImageUrl, "");
  assert.equal(liveQuota.moments.imagePlaceholder, "生图接口返回 HTTP 402");
  assert.equal(liveQuota.moments.bodyText, liveSentence);
  assert.equal(liveQuota.moments.bodyText.includes("演示回放、待核对"), false);
  assert.equal(liveQuota.leadText.includes("素材没有生成"), false);
  assert.equal(liveQuota.moments.cardTitle, "待核对");
} finally {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (saved[name] == null) delete process.env[name];
    else process.env[name] = saved[name];
  }
}
assert.equal(readFileSync(catalogPath, "utf8"), beforeCatalog);
console.log("ok image quota falls back");
