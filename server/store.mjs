import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sqliteFile() {
  if (process.env.GUIDE_SQLITE_FILE) return process.env.GUIDE_SQLITE_FILE;
  if (process.env.VERCEL) return path.join('/tmp', 'guide.sqlite');
  return path.join(root, 'data', 'guide.sqlite');
}

function database() {
  const file = sqliteFile();
  if (!globalThis.__guideSqlite || globalThis.__guideSqliteFile !== file) {
    globalThis.__guideSqliteFile = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    globalThis.__guideSqlite = new DatabaseSync(file);
    globalThis.__guideSqlite.exec('PRAGMA journal_mode = WAL;');
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
  `);
  return globalThis.__guideSqlite;
}

export function loadSession(id) {
  const row = database().prepare('SELECT record_json FROM sessions WHERE id = ?').get(id);
  if (!row) return null;
  try {
    return JSON.parse(row.record_json);
  } catch {
    return null;
  }
}

export function saveSession(id, record) {
  const updatedAt = Date.now();
  record.updatedAt = updatedAt;
  database()
    .prepare(
      `INSERT INTO sessions (id, record_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, updated_at = excluded.updated_at`,
    )
    .run(id, JSON.stringify(record), updatedAt);
}

export function listSessionRows() {
  return database()
    .prepare('SELECT id, record_json, updated_at FROM sessions ORDER BY updated_at DESC')
    .all()
    .map(row => {
      try {
        return {id: row.id, record: JSON.parse(row.record_json), updatedAt: row.updated_at};
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function nextSessionId() {
  let max = 0;
  for (const row of database().prepare('SELECT id FROM sessions').all()) {
    const matched = String(row.id).match(/^s(\d+)$/);
    if (matched) max = Math.max(max, Number(matched[1]));
  }
  return 's' + (max + 1);
}

export function loadMemory() {
  const rows = database().prepare('SELECT * FROM memories ORDER BY created_at, id').all();
  const memory = {guide: [], sessions: {}};
  for (const row of rows) {
    const item = {
      id: row.id,
      scope: row.scope,
      session_id: row.session_id,
      key: row.key,
      value: row.value,
      status: 'remembered',
      verified: Boolean(row.verified),
      promoted: Boolean(row.promoted),
      note: row.note,
    };
    if (row.scope === 'guide') memory.guide.push(item);
    else {
      const bucket = row.session_id || 'session';
      if (!memory.sessions[bucket]) memory.sessions[bucket] = [];
      memory.sessions[bucket].push(item);
    }
  }
  return memory;
}

export function saveMemory(memory) {
  const db = database();
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM memories');
    const insert = db.prepare(
      `INSERT INTO memories (id, scope, session_id, key, value, verified, promoted, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of memory.guide || []) {
      insert.run(item.id, 'guide', null, item.key, item.value, item.verified ? 1 : 0, item.promoted ? 1 : 0, item.note || '', Date.now());
    }
    for (const [sessionId, list] of Object.entries(memory.sessions || {})) {
      for (const item of list) {
        insert.run(item.id, 'session', sessionId, item.key, item.value, item.verified ? 1 : 0, item.promoted ? 1 : 0, item.note || '', Date.now());
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function nextMemoryId() {
  let max = 0;
  for (const row of database().prepare('SELECT id FROM memories').all()) {
    const n = Number(String(row.id).replace(/\D/g, ''));
    if (n > max) max = n;
  }
  return 'm' + (max + 1);
}

export function listFavorites() {
  return database()
    .prepare('SELECT * FROM favorites ORDER BY created_at DESC')
    .all()
    .map(row => ({
      id: row.id,
      source_id: row.source_message_id,
      session_id: row.session_id,
      kind: row.kind,
      title: row.title,
      content: row.content_plain,
      createdAt: row.created_at,
    }));
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
      row.source_id || '',
      row.session_id || '',
      row.kind,
      row.title,
      row.content,
      JSON.stringify({sessionTitle: row.session_title || ''}),
      row.createdAt || Date.now(),
    );
}

export function deleteFavorite(sourceOrId) {
  database().prepare('DELETE FROM favorites WHERE id = ? OR source_message_id = ?').run(sourceOrId, sourceOrId);
}
