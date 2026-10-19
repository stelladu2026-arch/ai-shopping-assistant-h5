import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BLANK_COPY_STATUS,
  clearCopyReview,
  isGeneratedMomentsPiece,
  resetToBlankCopyCard,
} from "../lib/chat/momentsPiece.ts";

const snapshot = {
  outputKind: "rich",
  productName: "云朵双人沙发",
  sellingPoints: ["现货速发"],
  copyStyle: "warm",
  audience: "upgrade",
};

const previous = [
  {
    id: "u1",
    role: "user",
    text: "",
    momentsSnapshot: snapshot,
  },
  {
    id: "card-old",
    role: "assistant",
    leadText: "配图已返回，仍待核对。",
    structured: {
      scene: "moments_marketing",
      cardTitle: "待核对",
      bodyTitle: "旧标题",
      bodyText: "旧正文不要留",
      generatedImageUrl: "https://img.example.test/old.png",
      imagePlaceholder: "",
      hashtags: ["旧话题"],
    },
  },
  {
    id: "card-error",
    role: "assistant",
    leadText: "请求失败，请稍后重试。",
    structured: {
      scene: "moments_marketing",
      cardTitle: "待核对",
      bodyTitle: "错误标题",
      bodyText: "url error",
      imagePlaceholder: "url error, please check url",
      generatedImageUrl: "",
    },
  },
];

const review = {
  material: {
    bodyTitle: "旧标题",
    bodyText: "旧正文不要留",
    pendingReview: true,
    reviewNote: "上一套文案和配图待核对。",
    generatedImageUrl: "https://img.example.test/old.png",
  },
  image: { label: "待核对", called: true, url: "https://img.example.test/old.png" },
  confirmedFacts: { name: "云朵双人沙发" },
};

function sliceFn(source, name, nextName) {
  const start = source.indexOf(`const ${name} = useCallback`);
  const end = source.indexOf(`const ${nextName} = useCallback`);
  assert.equal(start >= 0, true, name);
  assert.equal(end > start, true, `${name} before ${nextName}`);
  return source.slice(start, end);
}

const originalFetch = globalThis.fetch;
let fetches = 0;
globalThis.fetch = async () => {
  fetches += 1;
  throw new Error("reset must not generate");
};

try {
  assert.equal(isGeneratedMomentsPiece(previous[1]), true);
  assert.equal(isGeneratedMomentsPiece(previous[2]), true);
  const next = resetToBlankCopyCard(previous, snapshot, "blank-1");
  const cleared = clearCopyReview(review);
  assert.equal(fetches, 0);
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "blank-1");
  assert.equal(next[0].momentsChoice, "pending");
  assert.equal(next[0].momentsInlineEditor, true);
  assert.equal(next[0].structured, undefined);
  assert.equal(next[0].leadText, "");
  assert.equal(next[0].momentsSnapshot.audience, "upgrade");
  assert.deepEqual(next[0].momentsSnapshot.sellingPoints, ["现货速发"]);
  const blob = JSON.stringify(next);
  assert.equal(blob.includes("旧标题"), false);
  assert.equal(blob.includes("旧正文"), false);
  assert.equal(blob.includes("url error"), false);
  assert.equal(blob.includes("待核对"), false);
  assert.equal(blob.includes("old.png"), false);
  assert.equal(blob.includes("错误标题"), false);
  assert.equal(cleared.material, null);
  assert.equal(cleared.image.url, "");
  assert.equal(cleared.image.label, "");
  assert.equal(cleared.confirmedFacts.name, "云朵双人沙发");
  assert.equal(JSON.stringify(cleared).includes("待核对"), false);
  assert.equal(JSON.stringify(cleared).includes("旧正文"), false);
} finally {
  globalThis.fetch = originalFetch;
}

const page = readFileSync(new URL("../app/chat/ChatPageClient.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../components/chat/moments/MomentsInputPanel.tsx", import.meta.url), "utf8");
const bubble = readFileSync(new URL("../components/chat/AssistantBubble.tsx", import.meta.url), "utf8");
const openBlank = sliceFn(page, "openBlankCopyCard", "handleContinueMomentsSetup");
const continueFn = sliceFn(page, "handleContinueMomentsSetup", "generateMoments");
const generateFn = sliceFn(page, "generateMoments", "sendMomentsFollowUp");

assert.match(openBlank, /resetToBlankCopyCard\(/);
assert.match(openBlank, /clearCopyReview\(/);
assert.equal(openBlank.includes("agentChatRequest"), false);
assert.equal(openBlank.includes("startNewPiece"), false);
assert.equal(openBlank.includes("appendMomentsPiece"), false);
assert.equal(openBlank.includes("fetch("), false);
assert.match(continueFn, /openBlankCopyCard\(/);
assert.equal(continueFn.includes("agentChatRequest"), false);
assert.equal(continueFn.includes("startNewPiece"), false);
assert.match(generateFn, /isGeneratedMomentsPiece\(item\)/);
assert.match(generateFn, /openBlankCopyCard\(/);
assert.match(page, /onContinueGenerate=\{handleContinueMomentsSetup\}/);
assert.match(page, /continueGenerateLabel/);
assert.match(page, /choiceStatus=\{m\.momentsChoice === "pending" \? BLANK_COPY_STATUS : null\}/);
assert.match(page, /!showingBlankCopyCard/);
assert.match(panel, /data-copy-card=\{choiceStatus \? "pending" : undefined\}/);
assert.match(bubble, /重新生成素材/);
assert.match(bubble, /onClick=\{onContinueGenerate \?\? onRegenerate\}/);
assert.equal(BLANK_COPY_STATUS, "待选择");

console.log("ok blank copy card");
