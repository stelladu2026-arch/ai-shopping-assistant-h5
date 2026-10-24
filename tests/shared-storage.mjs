import "./register-ts.mjs";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

if (process.argv[2] === "lease-child") {
  const { acquireSharedLease } = await import("../lib/guide/shared-client.ts");
  const lease = await acquireSharedLease("session:cross-process");
  console.log(lease ? "acquired" : "busy");
  await lease?.release();
} else if (process.argv[2] === "read-child") {
  const { guideAct } = await import("../lib/guide/session.ts");
  const result = await guideAct({ action: "status", sessionId: "persisted" });
  console.log(result.structured.confirmedId);
} else {
  const directory = mkdtempSync(path.join(tmpdir(), "guide-shared-"));
  process.env.GUIDE_DATABASE_URL = `file:${path.join(directory, "shared.sqlite")}`;
  process.env.GUIDE_AGENT_LIVE_MODEL = "false";
  process.env.GUIDE_RAG_REMOTE_CONFIRMED = "false";
  process.env.GUIDE_IMAGE_ENABLED = "false";
  const { guideAct } = await import("../lib/guide/session.ts");
  const { consumeCall, readCallCounts, loadSession, saveSession, saveTranscript } = await import("../lib/guide/db.ts");
  const { acquireSharedLease } = await import("../lib/guide/shared-client.ts");
  async function child(file, args = [], env = {}) {
    return new Promise((resolve, reject) => {
      const processChild = spawn(process.execPath, ["--import", "./tests/register-ts.mjs", file, ...args], { env: { ...process.env, ...env } });
      let output = "", errors = "";
      processChild.stdout.on("data", data => { output += data; });
      processChild.stderr.on("data", data => { errors += data; });
      processChild.on("error", reject);
      processChild.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(errors + output)));
    });
  }
  await guideAct({ action: "confirm", sessionId: "persisted", source: "catalog", productId: "S01" });
  assert.equal(await child("tests/shared-storage.mjs", ["read-child"]), "S01", "new process must see the confirmed product");
  const lease = await acquireSharedLease("session:cross-process");
  assert.ok(lease);
  assert.equal(await child("tests/shared-storage.mjs", ["lease-child"]), "busy");
  await lease.release();
  assert.equal(await child("tests/shared-storage.mjs", ["lease-child"]), "acquired");
  const capped = await Promise.all(Array.from({ length: 12 }, () => consumeCall("atomic", "image", 2)));
  assert.equal(capped.filter(result => result.ok).length, 2);
  assert.equal((await readCallCounts("atomic")).image, 2);
  const stale = await loadSession("persisted");
  await saveTranscript("persisted", { ...stale, transcript: { latest: true }, customerName: "新备注" });
  await saveSession("persisted", stale, { preserveTranscript: true });
  assert.equal((await loadSession("persisted")).transcript.latest, true);
  const changed = { ...stale, state: { ...stale.state, confirmed_product_id: "S02" } };
  await saveSession("persisted", changed);
  await saveTranscript("persisted", { ...stale, transcript: { synced: true } });
  assert.equal((await loadSession("persisted")).state.confirmed_product_id, "S02", "stale transcript sync must not overwrite a changed product");
  await child("tests/session-isolation.mjs", [], { GUIDE_DATABASE_URL: `file:${path.join(directory, "isolation.sqlite")}` });
  // Missing credentials fail before any network request; never fall back to /tmp SQLite.
  process.env.GUIDE_DATABASE_URL = "libsql://not-contacted.example";
  delete process.env.GUIDE_DATABASE_AUTH_TOKEN;
  await assert.rejects(loadSession("persisted"), /GUIDE_DATABASE_AUTH_TOKEN/);
  console.log("ok shared storage: restart persistence, cross-process leases, atomic quota, transcript merges, shared-mode isolation and fail-closed configuration (local libSQL fixtures only)");
}
