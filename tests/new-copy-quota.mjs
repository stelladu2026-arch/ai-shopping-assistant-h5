import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guideAct, guideMaterial } from "../lib/guide/session.ts";
import { executeImage } from "../lib/guide/image.ts";
import { consumeCall, readCallCounts } from "../lib/guide/db.ts";
import { LIMITS } from "../lib/guide/limits.ts";

const catalogPath = new URL("../data/catalog.json", import.meta.url);
const beforeCatalog = readFileSync(catalogPath, "utf8");
const product = { id: "S01", name: "云朵双人沙发", color: "米白", material: "布艺", model: "YD-180" };
const imageEnv = {
  IMAGE_API_BASE: "http://image.test.local",
  IMAGE_MODEL: "image-fixture",
  IMAGE_API_KEY: "image-test",
};
const imageUrl = "https://img.example.test/new-piece.png";
const momentsInput = {
  outputKind: "rich",
  productName: "别的名字",
  sellingPoints: ["现货速发"],
  copyStyle: "warm",
  audience: "first_home",
};
const names = ["IMAGE_API_BASE", "IMAGE_MODEL", "IMAGE_API_KEY", "GUIDE_IMAGE_ENABLED", "DASHSCOPE_API_KEY", "GUIDE_AGENT_LIVE_MODEL", "QWEN_FREE_TIER_ONLY_CONFIRMED"];
const saved = {};
for (const name of names) {
  saved[name] = process.env[name];
  delete process.env[name];
}
const originalFetch = globalThis.fetch;

function counts(sessionId) {
  return readCallCounts(sessionId);
}

function assertGenerated(result, label) {
  const body = String(result.bodyText || "");
  const title = String(result.cardTitle || "");
  assert.equal(title.includes("已达本次上限"), false, label);
  assert.equal(body.includes("已达本次上限"), false, label);
  assert.equal(body.includes("本次已达上限"), false, label);
  assert.equal(result.generatedImageUrl, imageUrl, label);
  assert.match(body, /云朵双人沙发/);
  assert.match(body, /2699/);
  assert.equal(body.includes("演示回放、待核对"), false);
}

async function ready(sessionId) {
  await guideAct({ action: "reset", sessionId });
  await guideAct({
    action: "turn",
    sessionId,
    text: "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质",
  });
  const confirmed = await guideAct({ action: "confirm", sessionId, productId: "S01" });
  assert.equal(confirmed.structured.confirmedId, "S01");
}

function imageResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

try {
  process.env.IMAGE_API_BASE = imageEnv.IMAGE_API_BASE;
  process.env.IMAGE_MODEL = imageEnv.IMAGE_MODEL;
  process.env.IMAGE_API_KEY = imageEnv.IMAGE_API_KEY;
  delete process.env.GUIDE_IMAGE_ENABLED;
  delete process.env.DASHSCOPE_API_KEY;

  const page = readFileSync(new URL("../app/chat/ChatPageClient.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/agent/chat/route.ts", import.meta.url), "utf8");
  const label = readFileSync(new URL("../lib/chat/chatPageShared.ts", import.meta.url), "utf8");
  assert.match(label, /生成新图文/);
  assert.match(route, /newPiece: partial\.newPiece === true/);
  assert.match(page, /newPiece: true/);
  assert.match(page, /newPiece: false/);
  assert.match(page, /startNewPiece\(previous\?\.momentsSnapshot \?\? momentsForm\)/);

  globalThis.fetch = async () => {
    throw new Error("ready should not fetch");
  };

  const failedId = "new_copy_quota_failed";
  await ready(failedId);
  const shopping = counts(failedId);
  assert.equal(shopping.retrieve > 0, true);
  const imageBefore = shopping.image || 0;
  let failedCalls = 0;
  globalThis.fetch = async () => {
    failedCalls += 1;
    return imageResponse(429, { code: "Throttling.AllocationQuota", message: "quota exceeded" });
  };
  const failedImage = await executeImage(product, imageEnv, globalThis.fetch, failedId);
  assert.equal(failedCalls, 1);
  assert.equal(failedImage.called, true);
  assert.equal(failedImage.url || "", "");
  assert.equal(counts(failedId).image || 0, imageBefore);

  const imageOnly = { ...momentsInput, outputKind: "image_only" };
  for (let i = 0; i < LIMITS.image + 1; i += 1) {
    const missed = await guideMaterial(imageOnly, failedId, { newPiece: false });
    assert.equal(missed.cardTitle.includes("已达本次上限"), false);
    assert.equal(String(missed.bodyText || "").includes("已达本次上限"), false);
    assert.equal(missed.generatedImageUrl, "");
  }
  assert.equal(counts(failedId).content || 0, 0);
  assert.equal(counts(failedId).image || 0, 0);

  for (let i = 0; i < LIMITS.content; i += 1) consumeCall(failedId, "content", LIMITS.content);
  for (let i = 0; i < LIMITS.image; i += 1) consumeCall(failedId, "image", LIMITS.image);
  assert.equal(counts(failedId).content >= LIMITS.content, true);
  assert.equal(counts(failedId).image >= LIMITS.image, true);

  globalThis.fetch = async (url) => {
    assert.equal(String(url), "http://image.test.local/images/generations");
    return imageResponse(200, { data: [{ url: imageUrl }] });
  };
  const first = await guideMaterial(momentsInput, failedId, { newPiece: true });
  assertGenerated(first, "exhausted counter");
  assert.equal(counts(failedId).content, 1);
  assert.equal(counts(failedId).image, 1);
  assert.equal(counts(failedId).retrieve, shopping.retrieve);
  assert.equal(counts(failedId).product_decision, shopping.product_decision);
  assert.equal(counts(failedId).policy || 0, shopping.policy || 0);

  const pieceId = "new_copy_quota_piece";
  await ready(pieceId);
  globalThis.fetch = async () => imageResponse(402, { code: "Arrearage", message: "quota exceeded" });
  const previous = await guideMaterial(momentsInput, pieceId, { newPiece: true });
  assert.equal(previous.cardTitle.includes("已达本次上限"), false);
  assert.equal(String(previous.bodyText || "").includes("已达本次上限"), false);
  assert.equal(previous.generatedImageUrl, "");
  assert.equal(previous.imagePlaceholder, "生图接口返回 HTTP 402（/images/generations）：quota exceeded");
  assert.equal(counts(pieceId).image || 0, 0);
  assert.equal(counts(pieceId).content, 1);
  globalThis.fetch = async () => imageResponse(200, { data: [{ url: imageUrl }] });
  const followUp = await guideMaterial(momentsInput, pieceId, { newPiece: false });
  assertGenerated(followUp, "same piece regenerate");
  assert.equal(counts(pieceId).content, 2);
  const over = await guideMaterial(momentsInput, pieceId, { newPiece: false });
  assert.equal(over.cardTitle, "已达本次上限");
  assert.match(over.bodyText, /已达本次上限/);
  assert.match(over.imagePlaceholder, /已达本次上限/);
  assert.equal(over.generatedImageUrl, "");
  const restarted = await guideMaterial(momentsInput, pieceId, { newPiece: true });
  assertGenerated(restarted, "new piece after previous piece");
  assert.equal(counts(pieceId).content, 1);
  assert.equal(counts(pieceId).image, 1);

  console.log("visible-first", JSON.stringify({
    cardTitle: restarted.cardTitle,
    bodyText: restarted.bodyText,
    generatedImageUrl: restarted.generatedImageUrl,
    imagePlaceholder: restarted.imagePlaceholder || "",
  }));
  console.log("visible-over", JSON.stringify({
    cardTitle: over.cardTitle,
    bodyText: over.bodyText,
    generatedImageUrl: over.generatedImageUrl,
  }));
} finally {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (saved[name] == null) delete process.env[name];
    else process.env[name] = saved[name];
  }
}
assert.equal(readFileSync(catalogPath, "utf8"), beforeCatalog);
console.log("ok new copy quota");
