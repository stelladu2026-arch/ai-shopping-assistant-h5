// @ts-nocheck
import { sharedDatabase as database, sqlBatch, sqlQuery } from "./shared-client";
export async function dbFile() { return "shared-libsql"; }
export async function listSessionRecords() {
    return (await database()
        .prepare("SELECT id, record_json, updated_at FROM sessions ORDER BY updated_at DESC")
        .all()).map((row) => {
        let record = null;
        try {
            record = JSON.parse(row.record_json);
        }
        catch {
            record = null;
        }
        return record ? { id: row.id, record, updatedAt: row.updated_at } : null;
    })
        .filter(Boolean);
}
export async function loadSession(id) {
    const row = await database().prepare("SELECT record_json FROM sessions WHERE id = ?").get(id);
    if (!row)
        return null;
    try {
        return JSON.parse(row.record_json);
    }
    catch {
        return null;
    }
}
export async function saveSession(id, record, options = {}) {
    await sqlQuery(`INSERT INTO sessions (id, record_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET record_json = CASE WHEN ? THEN
         json_set(excluded.record_json, '$.transcript', json_extract(sessions.record_json,'$.transcript'),
           '$.customerName', json_extract(sessions.record_json,'$.customerName'))
         ELSE excluded.record_json END, updated_at = excluded.updated_at`,
       [id, JSON.stringify(record), Date.now(), options.preserveTranscript ? 1 : 0]);
}

export async function saveTranscript(id, record) {
  await sqlQuery(`INSERT INTO sessions (id, record_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET record_json = json_set(sessions.record_json,
      '$.transcript', json_extract(excluded.record_json,'$.transcript'),
      '$.customerName', json_extract(excluded.record_json,'$.customerName')), updated_at = excluded.updated_at`,
    [id, JSON.stringify(record), Date.now()]);
}
export async function loadMemory() {
    const rows = await database().prepare("SELECT * FROM memories ORDER BY created_at, id").all();
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
        if (row.scope === "guide")
            memory.guide.push(item);
        else {
            const bucket = row.session_id || "session";
            if (!memory.sessions[bucket])
                memory.sessions[bucket] = [];
            memory.sessions[bucket].push(item);
        }
    }
    return memory;
}
export async function saveMemory(memory) {
 const statements = [{sql: 'DELETE FROM memories', args: []}];
 const add = (item, scope, sessionId) => statements.push({sql: 'INSERT INTO memories (id,scope,session_id,key,value,verified,promoted,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)',args:[item.id,scope,sessionId,item.key,item.value,item.verified?1:0,item.promoted?1:0,item.note||'',Date.now()]});
 for(const item of memory.guide||[]) add(item,'guide',null);
 for(const [id,list] of Object.entries(memory.sessions||{})) for(const item of list) add(item,'customer',id);
 await sqlBatch(statements);
}

export async function nextMemoryId() {
    const row = await database().prepare("SELECT id FROM memories").all();
    let max = 0;
    for (const item of row) {
        const n = Number(String(item.id).replace(/\D/g, ""));
        if (n > max)
            max = n;
    }
    return "m" + (max + 1);
}
export async function saveFavorite(row) {
    await database()
        .prepare(`INSERT INTO favorites (id, source_message_id, session_id, kind, title, content_plain, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         content_plain = excluded.content_plain,
         payload_json = excluded.payload_json`)
        .run(row.id, row.source_message_id || "", row.session_id || "", row.kind, row.title, row.content_plain, row.payload_json || "", row.created_at || Date.now());
}
export async function deleteFavorite(id) {
    await database().prepare("DELETE FROM favorites WHERE id = ? OR source_message_id = ?").run(id, id);
}
function parseJson(raw) {
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function loadStep(sessionId, stepKey) {
    const row = await database().prepare("SELECT * FROM steps WHERE session_id = ? AND step_key = ?").get(sessionId, stepKey);
    if (!row)
        return null;
    return {
        stepKey: row.step_key,
        status: row.status,
        input: parseJson(row.input_json),
        output: parseJson(row.output_json),
        error: row.error || null,
        updatedAt: row.updated_at,
    };
}
export async function loadSteps(sessionId) {
    const keys = ["route", "product_decision", "content", "coordinate", "research"];
    const rows = (await sqlQuery("SELECT * FROM steps WHERE session_id=?", [sessionId])).rows;
    const mapped = new Map(rows.map(row => [row.step_key, {
      stepKey: row.step_key, status: row.status, input: parseJson(row.input_json),
      output: parseJson(row.output_json), error: row.error || null, updatedAt: row.updated_at,
    }]));
    return Object.fromEntries(keys.map(key => [key, mapped.get(key) || null]));
}
export async function saveStep(sessionId, stepKey, patch) {
    const previous = await loadStep(sessionId, stepKey);
    const status = patch.status || previous?.status || "pending";
    const input = patch.input === undefined ? previous?.input ?? null : patch.input;
    const output = patch.keepOutput ? previous?.output ?? null : patch.output === undefined ? previous?.output ?? null : patch.output;
    const error = patch.error === undefined ? null : patch.error;
    await database()
        .prepare(`INSERT INTO steps (session_id, step_key, status, input_json, output_json, error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, step_key) DO UPDATE SET
         status = excluded.status,
         input_json = excluded.input_json,
         output_json = excluded.output_json,
         error = excluded.error,
         updated_at = excluded.updated_at`)
        .run(sessionId, stepKey, status, JSON.stringify(input), JSON.stringify(output), error, Date.now());
    return await loadStep(sessionId, stepKey);
}
export async function deleteSteps(sessionId) {
    await database().prepare("DELETE FROM steps WHERE session_id = ?").run(sessionId);
}
export async function resetCallBudgets(sessionId) {
    const db = database();
    await db.prepare("DELETE FROM call_counts WHERE session_id = ?").run(sessionId);
    await db.prepare("DELETE FROM clarify_counts WHERE session_id = ?").run(sessionId);
}
export async function resetPieceCalls(sessionId) {
    await database()
        .prepare("DELETE FROM call_counts WHERE session_id = ? AND kind IN ('content', 'image')")
        .run(sessionId);
}
export async function releaseCall(sessionId, kind) {
 const result = await sqlQuery('UPDATE call_counts SET used=MAX(0,used-1) WHERE session_id=? AND kind=? RETURNING used',[sessionId,kind]);
 return {ok:true,used:Number(result.rows[0]?.used||0)};
}

export async function readCallCounts(sessionId) {
    const rows = await database().prepare("SELECT kind, used FROM call_counts WHERE session_id = ?").all(sessionId);
    return Object.fromEntries(rows.map((row) => [row.kind, row.used]));
}
export async function readClarifyCounts(sessionId) {
    return await database().prepare("SELECT doubt, rounds FROM clarify_counts WHERE session_id = ?").all(sessionId);
}
export async function consumeCall(sessionId, kind, limit) {
 const result = await sqlQuery(`INSERT INTO call_counts (session_id,kind,used) SELECT ?,?,1 WHERE ?>0
 ON CONFLICT(session_id,kind) DO UPDATE SET used=call_counts.used+1 WHERE call_counts.used < ? RETURNING used`,[sessionId,kind,limit,limit]);
 if(result.rows.length) return {ok:true,used:Number(result.rows[0].used),limit};
 const current = await readCallCounts(sessionId);
 return {ok:false,used:current[kind]||0,limit};
}

export async function noteClarify(sessionId, doubt) {
 const result = await sqlQuery(`INSERT INTO clarify_counts (session_id,doubt,rounds) VALUES (?,?,1)
 ON CONFLICT(session_id,doubt) DO UPDATE SET rounds=clarify_counts.rounds+1 RETURNING rounds`,[sessionId,doubt]);
 return Number(result.rows[0].rounds);
}

export async function listFavorites() {
    return (await database()
        .prepare("SELECT * FROM favorites ORDER BY created_at DESC")
        .all()).map((row) => {
        let payload = null;
        try {
            payload = row.payload_json ? JSON.parse(row.payload_json) : null;
        }
        catch {
            payload = null;
        }
        return {
            id: row.id,
            sourceMessageId: row.source_message_id,
            sessionId: row.session_id,
            type: row.kind,
            title: row.title,
            sessionTitle: payload?.sessionTitle || "",
            contentPlain: row.content_plain,
            createdAt: row.created_at,
        };
    });
}
