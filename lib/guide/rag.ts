// @ts-nocheck
// 默认在进程内先召回、再重排序。演示编码器不发请求。
// 远程只在嵌入地址、嵌入密钥都非空，且 GUIDE_RAG_REMOTE_CONFIRMED=true 时才发请求。
// 重排序密钥留空时改用嵌入密钥。重排序地址由嵌入主机派生，不走 /rerank。
// 模型名只放进请求体。不下载权重，不使用本机 Python 或 ONNX。
import { withDeadline } from "../request-deadline";
export const RAG_TIMEOUT_MS = 12000;

export const EMBED_MODEL = "qwen3.7-text-embedding";
export const RERANK_MODEL = "qwen3.7-text-rerank";
export const EMBED_BATCH = 20;
export const RECALL_K = 20;
export const DEMO_METHOD = "演示检索：先召回，再重排序";
export const REMOTE_METHOD = "远程检索：qwen3.7-text-embedding 召回，qwen3.7-text-rerank 重排序";
export const METHOD_EMBED = REMOTE_METHOD;
export const METHOD_KEYWORD = DEMO_METHOD;
export const FALLBACK_NOTE = "";
export const REMOTE_FAILED_NOTE = "";

const INTENT_GROUPS = [
  ["坏了", "怎么办", "维修", "退换", "退货", "换货", "质保", "保修", "售后"],
  ["活动叠加", "能不能叠加", "怎么叠加", "叠加"],
  ["禁止承诺", "不能承诺", "承诺"],
];

function filled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function trimSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function embedRoot(value) {
  let root = trimSlash(value);
  root = root.replace(/\/chat\/completions$/i, "");
  root = root.replace(/\/embeddings$/i, "");
  return trimSlash(root);
}

export function ragConfig(env = process.env) {
  const embedBase = embedRoot(env?.GUIDE_RAG_EMBED_BASE);
  const embedKey = String(env?.GUIDE_RAG_EMBED_API_KEY || "").trim();
  const rerankKey = String(env?.GUIDE_RAG_RERANK_API_KEY || "").trim();
  const confirmed = env?.GUIDE_RAG_REMOTE_CONFIRMED === "true";
  return {
    ready: Boolean(confirmed && embedBase && embedKey),
    embedBase,
    embedKey,
    embedModel: filled(env?.GUIDE_RAG_EMBED_MODEL) ? env.GUIDE_RAG_EMBED_MODEL.trim() : EMBED_MODEL,
    rerankKey: rerankKey || embedKey,
    rerankModel: filled(env?.GUIDE_RAG_RERANK_MODEL) ? env.GUIDE_RAG_RERANK_MODEL.trim() : RERANK_MODEL,
  };
}

export function remoteReady(env = process.env) {
  return ragConfig(env).ready;
}

export function embeddingsUrl(config) {
  return `${config.embedBase}/embeddings`;
}

export function rerankUrl(config) {
  const parsed = new URL(config.embedBase);
  return `${parsed.origin}/api/v1/services/rerank/text-rerank/text-rerank`;
}

function httpFailure(response, payload) {
  const error = new Error("remote_http");
  error.status = Number(response?.status || 0);
  error.code = String(payload?.code || payload?.error?.code || payload?.error?.type || "");
  error.detail = String(payload?.message || payload?.error?.message || "");
  return error;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function cacheMap() {
  if (!globalThis.__guideChunkEmbedCache) globalThis.__guideChunkEmbedCache = new Map();
  return globalThis.__guideChunkEmbedCache;
}

export function cosine(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < n; i += 1) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    leftNorm += x * x;
    rightNorm += y * y;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function requestEmbeddingBatch(texts, config, fetcher) {
  config.signal?.throwIfAborted();
  const response = await fetcher(embeddingsUrl(config), {
    method: "POST",
    redirect: "manual",
    signal: config.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.embedKey}`,
    },
    body: JSON.stringify({ model: config.embedModel, input: texts }),
  });
  const payload = await readJson(response);
  if (!response?.ok) throw httpFailure(response, payload);
  const data = Array.isArray(payload?.data) ? payload.data : null;
  if (!data || data.length !== texts.length) throw new Error("embed_shape");
  const ordered = data.slice().sort((a, b) => Number(a?.index ?? 0) - Number(b?.index ?? 0));
  return {
    status: Number(response.status || 0),
    model: config.embedModel,
    vectors: ordered.map((row) => {
      if (!Array.isArray(row?.embedding)) throw new Error("embed_shape");
      return row.embedding;
    }),
  };
}

async function requestEmbeddings(texts, config, fetcher) {
  const vectors = [];
  let status = 0;
  for (let start = 0; start < texts.length; start += EMBED_BATCH) {
    const batch = await requestEmbeddingBatch(texts.slice(start, start + EMBED_BATCH), config, fetcher);
    status = batch.status;
    vectors.push(...batch.vectors);
  }
  return { status, model: config.embedModel, vectors };
}

export async function postEmbed(texts, env = process.env, fetcher = fetch) {
  const config = ragConfig(env);
  const list = Array.isArray(texts) ? texts.map((item) => String(item ?? "")) : [];
  if (!config.ready || !list.length) {
    const error = new Error("embed_not_ready");
    error.status = 0;
    throw error;
  }
  return withDeadline((signal) => requestEmbeddings(list, { ...config, signal }, fetcher), RAG_TIMEOUT_MS);
}

async function embeddingsFor(texts, config, fetcher) {
  const cache = cacheMap();
  const keys = texts.map((text) => `${config.embedModel}\n${text}`);
  const missing = [];
  for (let i = 0; i < texts.length; i += 1) {
    if (!cache.has(keys[i])) missing.push(texts[i]);
  }
  if (missing.length) {
    const embedded = await requestEmbeddings(missing, config, fetcher);
    missing.forEach((text, index) => cache.set(`${config.embedModel}\n${text}`, embedded.vectors[index]));
  }
  return keys.map((key) => cache.get(key));
}

async function requestRerank(query, documents, config, fetcher) {
  config.signal?.throwIfAborted();
  const response = await fetcher(rerankUrl(config), {
    method: "POST",
    redirect: "manual",
    signal: config.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.rerankKey}`,
    },
    body: JSON.stringify({
      model: config.rerankModel,
      input: { query, documents },
      parameters: {},
    }),
  });
  const payload = await readJson(response);
  if (!response?.ok) throw httpFailure(response, payload);
  const results = Array.isArray(payload?.output?.results) ? payload.output.results : null;
  if (!results) throw new Error("rerank_shape");
  return {
    status: Number(response.status || 0),
    model: config.rerankModel,
    results: results.map((row) => ({
      index: Number(row?.index),
      score: Number(row?.relevance_score) || 0,
    })).filter((row) => Number.isInteger(row.index) && row.index >= 0 && row.index < documents.length),
  };
}

export async function postRerank(query, documents, env = process.env, fetcher = fetch) {
  const config = ragConfig(env);
  const docs = Array.isArray(documents) ? documents.map((item) => String(item ?? "")) : [];
  if (!config.ready || !String(query || "").trim() || !docs.length) {
    const error = new Error("rerank_not_ready");
    error.status = 0;
    throw error;
  }
  return withDeadline((signal) => requestRerank(String(query), docs, { ...config, signal }, fetcher), RAG_TIMEOUT_MS);
}

function skipChar(ch) {
  return !ch || /\s|[，,。.;；、！!？?：:（）()《》]/.test(ch);
}

function addToken(counts, token) {
  if (!token) return;
  counts.set(token, (counts.get(token) || 0) + 1);
}

function bag(text, phrases = []) {
  const counts = new Map();
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (skipChar(ch)) continue;
    addToken(counts, ch);
    const next = source[i + 1];
    if (!skipChar(next)) addToken(counts, ch + next);
  }
  for (const phrase of phrases) addToken(counts, phrase);
  return counts;
}

function extrasFor(query) {
  const text = String(query || "");
  const extra = [];
  for (const group of INTENT_GROUPS) {
    if (group.some((word) => word && text.includes(word))) extra.push(...group);
  }
  return extra;
}

function cosineMap(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const [key, value] of left) {
    leftNorm += value * value;
    if (right.has(key)) dot += value * right.get(key);
  }
  for (const value of right.values()) rightNorm += value * value;
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function rerankScore(query, chunk) {
  const hay = `${chunk?.title || ""}\n${chunk?.section || ""}\n${chunk?.text || ""}`;
  const needle = String(query || "").trim();
  let score = 0;
  if (needle && hay.includes(needle)) score += 4;
  for (const phrase of extrasFor(needle)) {
    if (phrase && hay.includes(phrase)) score += 2;
  }
  const chars = [...needle].filter((ch) => /[\u4e00-\u9fff]/.test(ch));
  if (chars.length) score += chars.filter((ch) => hay.includes(ch)).length / chars.length;
  return score;
}

export function rankByDemo(query, chunks) {
  const list = Array.isArray(chunks) ? chunks : [];
  const needle = String(query || "").trim();
  if (!needle || !list.length) return [];
  const queryBag = bag(needle, extrasFor(needle));
  const recalled = list
    .map((chunk, index) => ({
      chunk,
      index,
      score: cosineMap(queryBag, bag(`${chunk?.title || ""}\n${chunk?.section || ""}\n${chunk?.text || ""}`)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, RECALL_K);
  return recalled
    .map((item) => ({ ...item, rerank: rerankScore(needle, item.chunk) }))
    .filter((item) => item.rerank > 0)
    .sort((a, b) => b.rerank - a.rerank || b.score - a.score || a.index - b.index)
    .map((item) => item.chunk);
}

export async function rankByRemote(query, chunks, env = process.env, fetcher = fetch, timeoutMs = RAG_TIMEOUT_MS) {
  return withDeadline((signal) => rankRemote(query, chunks, env, fetcher, signal), timeoutMs);
}

async function rankRemote(query, chunks, env, fetcher, signal) {
  const list = Array.isArray(chunks) ? chunks : [];
  const config = ragConfig(env);
  if (!config.ready || !String(query || "").trim() || !list.length) return [];
  config.signal = signal;
  const passages = list.map((chunk) => `${chunk?.title || ""}\n${chunk?.section || ""}\n${chunk?.text || ""}`);
  const vectors = await embeddingsFor([query, ...passages], config, fetcher);
  const recalled = list
    .map((chunk, index) => ({ chunk, score: cosine(vectors[0], vectors[index + 1] || []) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RECALL_K);
  const documents = recalled.map((item) => item.chunk?.text || "");
  const ranked = await requestRerank(query, documents, config, fetcher);
  const order = ranked.results.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const chunksOut = [];
  for (const row of order) {
    if (seen.has(row.index)) continue;
    seen.add(row.index);
    chunksOut.push(recalled[row.index].chunk);
  }
  return chunksOut;
}
