import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guideAct, guideMaterial } from "../lib/guide/session.ts";
import { readCallCounts } from "../lib/guide/db.ts";
import { LIMITS, capText } from "../lib/guide/limits.ts";

const catalogPath = new URL("../data/catalog.json", import.meta.url);
const beforeCatalog = readFileSync(catalogPath, "utf8");
const imageUrl = "https://img.example.test/after-switch.png";
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

function imageResponse(payload) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  };
}

try {
  assert.equal(LIMITS.retrieve, 3);
  assert.equal(LIMITS.product_decision, 3);
  assert.equal(LIMITS.policy, 3);
  assert.equal(LIMITS.clarify, 2);
  assert.equal(LIMITS.content, 2);
  assert.equal(LIMITS.image, 2);
  const sameProductCap = capText("content");
  assert.match(sameProductCap, /已达本次上限/);
  assert.match(sameProductCap, /这件商品的内容生成最多 2 次/);
  assert.match(sameProductCap, /更换商品后再生成/);
  assert.equal(sameProductCap.includes("内容生成这次接待最多"), false);
  assert.equal(sameProductCap.includes("这次接待"), false);
  assert.match(capText("retrieve"), /资料检索这次接待最多 3 次/);
  assert.match(capText("product_decision"), /商品决策这次接待最多 3 次/);
  assert.match(capText("image"), /生图这次接待最多 2 次/);

  process.env.IMAGE_API_BASE = "http://image.test.local";
  process.env.IMAGE_MODEL = "image-fixture";
  process.env.IMAGE_API_KEY = "image-test";
  globalThis.fetch = async () => imageResponse({ data: [{ url: imageUrl }] });

  const sessionId = "reset_copy_on_product";
  await guideAct({ action: "reset", sessionId });
  const listed = await guideAct({ action: "turn", sessionId, text: "只看沙发，预算5000元" });
  const candidates = listed.structured.candidateIds || [];
  assert.equal(candidates.length > 1, true, `candidates ${candidates.join(",")}`);
  const productA = candidates[0];
  const productB = candidates.find((id) => id !== productA);
  assert.ok(productB);

  const confirmedA = await guideAct({ action: "confirm", sessionId, productId: productA });
  assert.equal(confirmedA.structured.confirmedId, productA);
  const nameA = confirmedA.structured.confirmedName;
  const shopping = counts(sessionId);

  const first = await guideMaterial(momentsInput, sessionId, { newPiece: false });
  const second = await guideMaterial(momentsInput, sessionId, { newPiece: false });
  assert.equal(String(first.bodyText || "").includes("已达本次上限"), false);
  assert.equal(String(second.bodyText || "").includes("已达本次上限"), false);
  assert.equal(counts(sessionId).content, 2);
  const blocked = await guideMaterial(momentsInput, sessionId, { newPiece: false });
  assert.equal(blocked.cardTitle, "已达本次上限");
  assert.equal(blocked.bodyText, sameProductCap);
  assert.equal(blocked.bodyText.includes("内容生成这次接待最多"), false);
  assert.equal(counts(sessionId).content, 2);
  assert.equal(counts(sessionId).retrieve, shopping.retrieve);
  assert.equal(counts(sessionId).product_decision, shopping.product_decision);
  assert.equal(counts(sessionId).policy || 0, shopping.policy || 0);

  const confirmedB = await guideAct({
    action: "confirm",
    sessionId,
    productId: productB,
    source: "catalog",
    revision: confirmedA.structured.revision,
  });
  assert.equal(confirmedB.ok, true, confirmedB.error || confirmedB.leadText);
  assert.equal(confirmedB.structured.confirmedId, productB);
  assert.notEqual(confirmedB.structured.confirmedName, nameA);
  const cleared = counts(sessionId);
  assert.equal(cleared.content || 0, 0);
  assert.equal(cleared.image || 0, 0);
  assert.equal(cleared.product_decision, shopping.product_decision);
  assert.equal(cleared.policy || 0, shopping.policy || 0);
  assert.equal((cleared.retrieve || 0) >= (shopping.retrieve || 0), true);

  const opened = await guideMaterial(momentsInput, sessionId, { newPiece: false });
  const openedBody = String(opened.bodyText || "");
  assert.equal(opened.cardTitle.includes("已达本次上限"), false);
  assert.equal(openedBody.includes("已达本次上限"), false);
  assert.equal(openedBody.includes("内容生成这次接待最多"), false);
  assert.equal(openedBody.includes("这次接待"), false);
  assert.match(openedBody, new RegExp(confirmedB.structured.confirmedName));
  assert.equal(opened.generatedImageUrl, imageUrl);
  assert.equal(counts(sessionId).content, 1);
  assert.equal(counts(sessionId).image, 1);
  assert.equal(counts(sessionId).product_decision, shopping.product_decision);
  assert.equal(counts(sessionId).policy || 0, shopping.policy || 0);

  const follow = await guideMaterial(momentsInput, sessionId, { newPiece: false });
  assert.equal(String(follow.bodyText || "").includes("已达本次上限"), false);
  assert.equal(counts(sessionId).content, 2);
  const overB = await guideMaterial(momentsInput, sessionId, { newPiece: false });
  assert.equal(overB.cardTitle, "已达本次上限");
  assert.equal(overB.bodyText.includes("内容生成这次接待最多"), false);
  assert.match(overB.bodyText, /更换商品后再生成/);
  assert.equal(counts(sessionId).content, 2);

  const restarted = await guideMaterial(momentsInput, sessionId, { newPiece: true });
  assert.equal(String(restarted.bodyText || "").includes("已达本次上限"), false);
  assert.equal(counts(sessionId).content, 1);

  const sameId = "reset_copy_same_product";
  await guideAct({ action: "reset", sessionId: sameId });
  await guideAct({ action: "turn", sessionId: sameId, text: "只看沙发，预算5000元" });
  const again = await guideAct({ action: "confirm", sessionId: sameId, productId: productA });
  await guideMaterial(momentsInput, sameId, { newPiece: false });
  await guideMaterial(momentsInput, sameId, { newPiece: false });
  assert.equal(counts(sameId).content, 2);
  const reconfirmed = await guideAct({
    action: "confirm",
    sessionId: sameId,
    productId: productA,
    source: "catalog",
    revision: again.structured.revision,
  });
  assert.equal(reconfirmed.structured.confirmedId, productA);
  assert.equal(counts(sameId).content, 2);
  const stillBlocked = await guideMaterial(momentsInput, sameId, { newPiece: false });
  assert.equal(stillBlocked.cardTitle, "已达本次上限");
  assert.equal(stillBlocked.bodyText.includes("内容生成这次接待最多"), false);

  console.log("visible-after-switch", JSON.stringify({
    product: confirmedB.structured.confirmedName,
    cardTitle: opened.cardTitle,
    bodyText: opened.bodyText,
    generatedImageUrl: opened.generatedImageUrl,
  }));
  console.log("visible-same-product-cap", blocked.bodyText);
} finally {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (saved[name] == null) delete process.env[name];
    else process.env[name] = saved[name];
  }
}
assert.equal(readFileSync(catalogPath, "utf8"), beforeCatalog);
console.log("ok reset copy on product");
