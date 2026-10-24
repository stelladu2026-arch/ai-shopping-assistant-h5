import "./register-ts.mjs";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.GUIDE_SQLITE_FILE = path.join(mkdtempSync(path.join(tmpdir(), "guide-isolation-")), "guide.sqlite");
process.env.GUIDE_AGENT_LIVE_MODEL = "false";
process.env.GUIDE_RAG_REMOTE_CONFIRMED = "false";
Object.assign(process.env, {
  GUIDE_IMAGE_ENABLED: "true", IMAGE_API_BASE: "http://image.test.local",
  IMAGE_MODEL: "image-fixture", IMAGE_API_KEY: "fixture-only",
});
const { guideAct, guideMaterial, guideMemoryBook } = await import("../lib/guide/session.ts");
const originalFetch = globalThis.fetch;
const input = { outputKind: "image_only", imageCount: 1, sellingPoints: [] };
const url = "https://img.example.test/kept.png";
const json = (status, body) => ({ ok: status === 200, status, text: async () => JSON.stringify(body) });
try {
  await guideAct({ action: "confirm", source: "catalog", productId: "S01", sessionId: "overlap" });
  let submitted;
  const started = new Promise(resolve => { submitted = resolve; });
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; submitted(); await waiting; return json(200, { data: [{ url }] }); };
  const pending = guideMaterial(input, "overlap", { newPiece: true });
  await started;
  const duplicate = await guideMaterial(input, "overlap", { newPiece: true });
  assert.equal(duplicate.cardTitle, "素材没有生成");
  assert.match(duplicate.bodyText, /仍在处理中/);
  const switching = await guideAct({ action: "confirm", source: "catalog", productId: "S02", sessionId: "overlap" });
  assert.equal(switching.error, "session_busy");
  const status = await guideAct({ action: "status", sessionId: "overlap" });
  assert.equal(status.structured.confirmedId, "S01");
  await guideAct({ action: "sync", sessionId: "overlap", transcript: { marker: "saved-during-generation" }, customerName: "新备注" });
  await guideAct({ action: "remember", sessionId: "another-session", scope: "guide", key: "独立记忆", value: "另一会话新记下的内容" });
  finish();
  const generated = await pending;
  assert.equal(generated.generatedImageUrl, url);
  assert.equal(calls, 1);
  const loaded = await guideAct({ action: "load", sessionId: "overlap" });
  assert.equal(loaded.transcript.marker, "saved-during-generation");
  assert.ok((await guideMemoryBook()).memory.guide.some(item => item.key === "独立记忆"));

  globalThis.fetch = async () => json(400, { code: "InvalidParameter", message: "fixture image failure" });
  const failed = await guideMaterial(input, "overlap", { newPiece: true });
  assert.equal(failed.cardTitle, "素材没有生成");
  assert.match(failed.bodyText, /fixture image failure/);
  const after = await guideAct({ action: "status", sessionId: "overlap" });
  assert.equal(after.structured.material.generatedImageUrl, url);
  assert.equal(after.structured.image.url, url);
  assert.equal(after.steps.content.status, "failed");

  globalThis.fetch = async () => json(200, { data: [{ url: "https://img.example.test/recovered.png" }] });
  const recovered = await guideMaterial(input, "overlap", { newPiece: true });
  assert.match(recovered.generatedImageUrl, /recovered/);
  await guideAct({ action: "reset", sessionId: "overlap" });
  assert.equal((await guideAct({ action: "load", sessionId: "overlap" })).transcript, null);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("ok session isolation: duplicate submission, transcript/memory preservation, failed image preservation, recovery");
