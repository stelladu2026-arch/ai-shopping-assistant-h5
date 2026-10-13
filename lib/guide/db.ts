// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const file = path.join(process.cwd(), "data", "guide.sqlite");

function database() {
  if (!globalThis.__guideSqlite) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    globalThis.__guideSqlite = new DatabaseSync(file);
    globalThis.__guideSqlite.exec("PRAGMA journal_mode = WAL;");
  }
  globalThis.__guideSqlite.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        record_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        session_id TEXT,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        verified INTEGER NOT NULL,
        promoted INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        source_message_id TEXT,
        session_id TEXT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        content_plain TEXT NOT NULL,
        payload_json TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS steps (
        session_id TEXT NOT NULL,
        step_key TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT,
        output_json TEXT,
        error TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, step_key)
      );
      CREATE TABLE IF NOT EXISTS call_counts (
        session_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        used INTEGER NOT NULL,
        PRIMARY KEY (session_id, kind)
      );
      CREATE TABLE IF NOT EXISTS clarify_counts (
        session_id TEXT NOT NULL,
        doubt TEXT NOT NULL,
        rounds INTEGER NOT NULL,
        PRIMARY KEY (session_id, doubt)
      );
  `);
  return globalThis.__guideSqlite;
}

export function dbFile() {
  return file;
}

export function loadSession(id) {
  const row = database().prepare("SELECT record_json FROM sessions WHERE id = ?").get(id);
  if (!row) return null;
  try {
    return JSON.parse(row.record_json);
  } catch {
    return null;
  }
}

export function saveSession(id, record) {
  database()
    .prepare(
      `INSERT INTO sessions (id, record_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, updated_at = excluded.updated_at`,
    )
    .run(id, JSON.stringify(record), Date.now());
}

export function loadMemory() {
  const rows = database().prepare("SELECT * FROM memories ORDER BY created_at, id").all();
  const memory = { guide: [], sessions: {} };
  for (const row of rows) {
    const item = {
      id: row.id,
      scope: row.scope,
      customer_id: row.scope === "guide" ? null : row.session_id,
      session_id: row.session_id,
      key: row.key,
      value: row.value,
      status: "remembered",
      verified: Boolean(row.verified),
      promoted: Boolean(row.promoted),
      note: row.note,
    };
    if (row.scope === "guide") memory.guide.push(item);
    else {
      const bucket = row.session_id || "session";
      if (!memory.sessions[bucket]) memory.sessions[bucket] = [];
      memory.sessions[bucket].push(item);
    }
  }
  return memory;
}

export function saveMemory(memory) {
  const db = database();
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM memories");
    const insert = db.prepare(
      `INSERT INTO memories (id, scope, session_id, key, value, verified, promoted, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const write = (item, scope, sessionId) => {
      insert.run(
        item.id,
        scope,
        sessionId,
        item.key,
        item.value,
        item.verified ? 1 : 0,
        item.promoted ? 1 : 0,
        item.note || "",
        Date.now(),
      );
    };
    for (const item of memory.guide || []) write(item, "guide", null);
    for (const [sessionId, list] of Object.entries(memory.sessions || {})) {
      for (const item of list) write(item, "customer", sessionId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function nextMemoryId() {
  const row = database().prepare("SELECT id FROM memories").all();
  let max = 0;
  for (const item of row) {
    const n = Number(String(item.id).replace(/\D/g, ""));
    if (n > max) max = n;
  }
  return "m" + (max + 1);
}

export function saveFavorite(row) {
  database()
    .prepare(
      `INSERT INTO favorites (id, source_message_id, session_id, kind, title, content_plain, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         content_plain = excluded.content_plain,
         payload_json = excluded.payload_json`,
    )
    .run(
      row.id,
      row.source_message_id || "",
      row.session_id || "",
      row.kind,
      row.title,
      row.content_plain,
      row.payload_json || "",
      row.created_at || Date.now(),
    );
}

export function deleteFavorite(id) {
  database().prepare("DELETE FROM favorites WHERE id = ? OR source_message_id = ?").run(id, id);
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadStep(sessionId, stepKey) {
  const row = database().prepare("SELECT * FROM steps WHERE session_id = ? AND step_key = ?").get(sessionId, stepKey);
  if (!row) return null;
  return {
    stepKey: row.step_key,
    status: row.status,
    input: parseJson(row.input_json),
    output: parseJson(row.output_json),
    error: row.error || null,
    updatedAt: row.updated_at,
  };
}

export function loadSteps(sessionId) {
  const keys = ["route", "product_decision", "content", "coordinate", "research"];
  return Object.fromEntries(keys.map((key) => [key, loadStep(sessionId, key)]));
}

export function saveStep(sessionId, stepKey, patch) {
  const previous = loadStep(sessionId, stepKey);
  const status = patch.status || previous?.status || "pending";
  const input = patch.input === undefined ? previous?.input ?? null : patch.input;
  const output = patch.keepOutput ? previous?.output ?? null : patch.output === undefined ? previous?.output ?? null : patch.output;
  const error = patch.error === undefined ? null : patch.error;
  database()
    .prepare(
      `INSERT INTO steps (session_id, step_key, status, input_json, output_json, error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, step_key) DO UPDATE SET
         status = excluded.status,
         input_json = excluded.input_json,
         output_json = excluded.output_json,
         error = excluded.error,
         updated_at = excluded.updated_at`,
    )
    .run(sessionId, stepKey, status, JSON.stringify(input), JSON.stringify(output), error, Date.now());
  return loadStep(sessionId, stepKey);
}

export function deleteSteps(sessionId) {
  database().prepare("DELETE FROM steps WHERE session_id = ?").run(sessionId);
}

export function resetCallBudgets(sessionId) {
  const db = database();
  db.prepare("DELETE FROM call_counts WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM clarify_counts WHERE session_id = ?").run(sessionId);
}

export function readCallCounts(sessionId) {
  const rows = database().prepare("SELECT kind, used FROM call_counts WHERE session_id = ?").all(sessionId);
  return Object.fromEntries(rows.map((row) => [row.kind, row.used]));
}

export function readClarifyCounts(sessionId) {
  return database().prepare("SELECT doubt, rounds FROM clarify_counts WHERE session_id = ?").all(sessionId);
}

export function consumeCall(sessionId, kind, limit) {
  const db = database();
  const row = db.prepare("SELECT used FROM call_counts WHERE session_id = ? AND kind = ?").get(sessionId, kind);
  const used = row?.used || 0;
  if (used >= limit) return { ok: false, used, limit };
  const next = used + 1;
  db.prepare(
    `INSERT INTO call_counts (session_id, kind, used) VALUES (?, ?, ?)
     ON CONFLICT(session_id, kind) DO UPDATE SET used = excluded.used`,
  ).run(sessionId, kind, next);
  return { ok: true, used: next, limit };
}

export function noteClarify(sessionId, doubt) {
  const db = database();
  const row = db.prepare("SELECT rounds FROM clarify_counts WHERE session_id = ? AND doubt = ?").get(sessionId, doubt);
  const rounds = (row?.rounds || 0) + 1;
  db.prepare(
    `INSERT INTO clarify_counts (session_id, doubt, rounds) VALUES (?, ?, ?)
     ON CONFLICT(session_id, doubt) DO UPDATE SET rounds = excluded.rounds`,
  ).run(sessionId, doubt, rounds);
  return rounds;
}

export function listFavorites() {
  return database()
    .prepare("SELECT * FROM favorites ORDER BY created_at DESC")
    .all()
    .map((row) => ({
      id: row.id,
      sourceMessageId: row.source_message_id,
      sessionId: row.session_id,
      type: row.kind,
      title: row.title,
      contentPlain: row.content_plain,
      createdAt: row.created_at,
    }));
}
