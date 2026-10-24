// @ts-nocheck
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { SHARED_SCHEMA } from "./shared-schema";

export const sharedStorageEnabled = () => Boolean(process.env.GUIDE_DATABASE_URL?.trim());
const tables = /\b(sessions|memories|favorites|steps|call_counts|clarify_counts)\b/g;
const prefixed = (sql) => sql.replace(tables, "guide_$1");
let cached;

function connection() {
  const url = process.env.GUIDE_DATABASE_URL?.trim();
  if (!url) throw new Error("GUIDE_DATABASE_URL is required");
  if (process.env.VERCEL && !/^(libsql|https):\/\//.test(url)) throw new Error("Shared storage requires a remote HTTPS/libSQL URL on Vercel");
  if (!/^(libsql|https|file):/.test(url)) throw new Error("Unsupported guide database URL");
  const authToken = process.env.GUIDE_DATABASE_AUTH_TOKEN?.trim();
  if (!url.startsWith("file:") && !authToken) throw new Error("GUIDE_DATABASE_AUTH_TOKEN is required");
  const key = `${url}\n${authToken || ""}`;
  if (!cached || cached.key !== key) {
    cached?.client.close();
    cached = { key, client: createClient({url, authToken}), ready: null };
  }
  return cached;
}

async function ready() {
  const c = connection();
  if (!c.ready) {
    const schema = SHARED_SCHEMA.split(";").map(sql => sql.trim()).filter(Boolean).map(sql => ({sql: prefixed(sql), args: []}));
    schema.push({sql: "CREATE TABLE IF NOT EXISTS guide_operation_leases (resource TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL)", args: []});
    c.ready = c.client.batch(schema, "write").catch(error => { c.ready = null; throw error; });
  }
  await c.ready;
  return c.client;
}

export async function sqlQuery(sql, args = []) {
  return (await ready()).execute({sql: prefixed(sql), args});
}

export async function sqlBatch(statements) {
  return (await ready()).batch(statements.map(s => ({sql: prefixed(s.sql), args: s.args || []})), "write");
}

export function sharedDatabase() {
  return {
    prepare: sql => ({
      all: async (...args) => (await sqlQuery(sql, args)).rows,
      get: async (...args) => (await sqlQuery(sql, args)).rows[0],
      run: async (...args) => sqlQuery(sql, args),
    }),
  };
}

// One atomic conditional upsert coordinates independent server processes.
// This is a lease, not an exactly-once guarantee for external model APIs.
export async function acquireSharedLease(resource) {
  if (!sharedStorageEnabled()) return { release: async () => {}, assertOwned: async () => {} };
  const owner = randomUUID();
  const ttl = 300000;
  const result = await sqlQuery(`INSERT INTO guide_operation_leases (resource,owner,expires_at) VALUES (?,?,?)
    ON CONFLICT(resource) DO UPDATE SET owner=excluded.owner, expires_at=excluded.expires_at
    WHERE guide_operation_leases.expires_at < ? RETURNING owner`, [resource, owner, Date.now() + ttl, Date.now()]);
  if (!result.rows.length) return null;
  let lost = false;
  let renewing = false;
  const timer = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try {
      const renewed = await sqlQuery("UPDATE guide_operation_leases SET expires_at=? WHERE resource=? AND owner=? RETURNING owner", [Date.now()+ttl, resource, owner]);
      if (!renewed.rows.length) lost = true;
    } catch { lost = true; }
    finally { renewing = false; }
  }, 60000);
  timer.unref?.();
  return {
    async assertOwned() {
      const checked = await sqlQuery("SELECT owner FROM guide_operation_leases WHERE resource=? AND owner=? AND expires_at>?", [resource, owner, Date.now()]);
      if (lost || !checked.rows.length) throw new Error("guide_storage_lease_lost");
    },
    async release() {
      clearInterval(timer);
      // An expired request must never delete another request's lease.
      try {
        await sqlQuery("DELETE FROM guide_operation_leases WHERE resource=? AND owner=?", [resource, owner]);
      } catch {
        console.error("Guide storage lease release failed; lease will expire.");
      }
    },
  };
}
