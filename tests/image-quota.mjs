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
assert.equal(skipped.label, "演示回放、待核对");

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
assert.equal(quota.called, false);
assert.equal(quota.simulation, true);
assert.equal(quota.quota, true);
assert.equal(quota.label, "演示回放、待核对");

const names = ["IMAGE_API_BASE", "IMAGE_MODEL", "IMAGE_API_KEY", "GUIDE_IMAGE_ENABLED", "GUIDE_RAG_EMBED_BASE", "GUIDE_RAG_EMBED_API_KEY", "GUIDE_RAG_REMOTE_CONFIRMED", "DASHSCOPE_API_KEY", "GUIDE_AGENT_LIVE_MODEL"];
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
  assert.equal(billed.leadText.includes("素材没有生成"), false);
  assert.equal(materialBefore === "" || billed.moments.bodyText.length > 0, true);
} finally {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (saved[name] == null) delete process.env[name];
    else process.env[name] = saved[name];
  }
}
assert.equal(readFileSync(catalogPath, "utf8"), beforeCatalog);
console.log("ok image quota falls back");
