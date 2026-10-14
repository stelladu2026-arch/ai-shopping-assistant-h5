// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import catalog from "../../data/catalog.json";
import { DEGRADE_TEXT } from "./limits";
import { DEMO_METHOD, REMOTE_METHOD, rankByDemo, rankByRemote, remoteReady } from "./rag";

const dir = path.join(process.cwd(), "data", "knowledge");
const COLORS = [...new Set(catalog.map((item) => item.color))].sort((a, b) => b.length - a.length);
const MATERIALS = [...new Set(catalog.map((item) => item.material))].sort((a, b) => b.length - a.length);
const MODELS = [...new Set(catalog.map((item) => item.model))].sort((a, b) => b.length - a.length);

export const MISS_TEXT = "没有检索到门店资料，不能编造说明。";
const STORE_DOC_QUESTION = /售后|坏了|维修|退换|退货|换货|质保|保修多久|禁止承诺|不能承诺|活动叠加|能不能叠加|怎么叠加/;

function splitDocument(raw) {
  const matched = String(raw || "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!matched) return { meta: {}, body: String(raw || "") };
  const meta = {};
  for (const line of matched[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (pair) meta[pair[1]] = pair[2].trim();
  }
  return { meta, body: String(raw).slice(matched[0].length) };
}

function mentionedTokens(text, tokens) {
  let rest = String(text || "");
  const found = [];
  for (const token of tokens) {
    if (token && rest.includes(token)) {
      found.push(token);
      rest = rest.split(token).join(" ");
    }
  }
  return found;
}

export function storeExcerptConflicts(excerpt, product) {
  const text = String(excerpt || "");
  if (!text || !product) return false;
  const prices = [...text.matchAll(/(?:标价|售价|价格)\s*(\d+(?:\.\d+)?)\s*元/g)];
  if (prices.some((item) => Number(item[1]) !== Number(product.price_cny))) return true;
  const widths = [...text.matchAll(/宽\s*(\d+(?:\.\d+)?)\s*厘米/g)];
  if (widths.some((item) => Number(item[1]) !== Number(product.width_cm))) return true;
  const colors = mentionedTokens(text, COLORS);
  if (colors.some((item) => item !== product.color)) return true;
  const materials = mentionedTokens(text, MATERIALS);
  if (materials.some((item) => item !== product.material)) return true;
  const models = mentionedTokens(text, MODELS);
  if (models.some((item) => item !== product.model)) return true;
  if (/免费送装|包送装|送装上门免费|免费送货安装/.test(text)) return true;
  if (/终身保修|终身质保|质保无忧|\d+\s*年(?:质保|保修)/.test(text)) return true;
  if (/A\s*(?:和|与|、)\s*C/.test(text) && /叠加|一起使用|同时使用/.test(text)) return true;
  return false;
}

export function degradeStoreReason(title) {
  return `门店资料《${title}》与商品目录不一致。价格、尺寸、材质、颜色、型号、活动叠加、送装、质保：${DEGRADE_TEXT}`;
}

export function isDroppedStoreQuestion(text, pending) {
  return STORE_DOC_QUESTION.test(String(text || "")) && String(pending || "").startsWith("资料缺失");
}

function documentTitle(meta, body, file) {
  return meta.title || (String(body || "").match(/^#\s+(.+)$/m) || [, String(file || "").replace(/\.md$/, "")])[1];
}

function quoteOf(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

export function loadKnowledgeChunks(knowledgeDir = dir) {
  if (!fs.existsSync(knowledgeDir)) return [];
  const chunks = [];
  for (const file of fs.readdirSync(knowledgeDir)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
    const { meta, body } = splitDocument(raw);
    const title = documentTitle(meta, body, file);
    const sourceUrl = meta.source_url || null;
    const updatedAt = meta.updated_at || null;
    const version = meta.version || null;
    let section = meta.section || "";
    let buffer = [];
    const flush = () => {
      const text = buffer.join("\n").trim();
      buffer = [];
      if (!text) return;
      chunks.push({
        title,
        section: section || meta.section || title,
        source: file,
        sourceUrl,
        updatedAt,
        version,
        text,
      });
    };
    for (const line of String(body || "").split(/\r?\n/)) {
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      if (heading) {
        flush();
        section = meta.section || heading[1].trim();
        continue;
      }
      buffer.push(line);
    }
    flush();
  }
  return chunks;
}

function askedProduct(query) {
  return catalog.find((item) => item.name === query || item.model === query) || null;
}

function isCatalogSheet(chunk) {
  const title = String(chunk?.title || "");
  const source = String(chunk?.source || "").replace(/\.md$/, "");
  return catalog.some((item) => item.name === title || item.name === source);
}

function acceptsChunk(query, chunk) {
  const asked = askedProduct(query);
  if (asked) return chunk.title === asked.name || String(chunk.source || "").includes(asked.name);
  return !isCatalogSheet(chunk);
}

function keywordHit(query, knowledgeDir) {
  const needle = String(query || "").trim();
  if (!needle || !fs.existsSync(knowledgeDir)) return null;
  const hits = [];
  for (const file of fs.readdirSync(knowledgeDir)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
    const { meta, body } = splitDocument(raw);
    if (!body.includes(needle) && !String(meta.title || "").includes(needle)) continue;
    const title = documentTitle(meta, body, file);
    const lines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    const excerpt = (lines.find((line) => line.includes(needle)) || lines[0] || "").slice(0, 180);
    hits.push({
      title,
      source: file,
      excerpt,
      section: meta.section || null,
      sourceUrl: meta.source_url || null,
      updatedAt: meta.updated_at || null,
      version: meta.version || null,
    });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.source.length - b.source.length);
  return hits[0];
}

function pack(method, methodLabel, fallbackNote, chunks) {
  const excerpts = (chunks || []).slice(0, 3).map((chunk) => ({
    title: chunk.title,
    section: chunk.section || null,
    source: chunk.source,
    quote: quoteOf(chunk.text || chunk.excerpt),
    sourceUrl: chunk.sourceUrl || null,
    updatedAt: chunk.updatedAt || null,
  }));
  const top = excerpts[0];
  const hit = top
    ? {
        title: top.title,
        source: top.source,
        excerpt: top.quote,
        quote: top.quote,
        section: top.section,
        sourceUrl: top.sourceUrl,
        updatedAt: top.updatedAt,
        version: chunks[0]?.version || null,
        method,
        methodLabel,
        fallbackNote: fallbackNote || "",
        excerpts,
      }
    : null;
  return { hit, excerpts, method, methodLabel, fallbackNote: fallbackNote || "" };
}

export function formatStoreHit(hit) {
  if (!hit) return MISS_TEXT;
  const section = hit.section ? `章节 ${hit.section}` : "";
  const source = hit.source ? `来源 ${hit.source}` : "";
  const where = [section, source].filter(Boolean).join("，");
  return `《${hit.title}》${where ? `（${where}）` : ""}：${hit.excerpt || hit.quote || ""}`;
}

export async function searchStore(query, knowledgeDir = dir, options = {}) {
  const needle = String(query || "").trim();
  const folder = knowledgeDir || dir;
  if (!needle) return pack("demo_rerank", DEMO_METHOD, "", []);
  const env = options.env || process.env;
  const chunks = loadKnowledgeChunks(folder).filter((chunk) => acceptsChunk(needle, chunk));
  if (remoteReady(env)) {
    try {
      const ranked = chunks.length ? await rankByRemote(needle, chunks, env, options.fetcher || fetch) : [];
      return pack("embed_rerank", REMOTE_METHOD, "", ranked);
    } catch {
      // 远程没有完成时不再发请求，改用进程内演示检索。
    }
  }
  return pack("demo_rerank", DEMO_METHOD, "", rankByDemo(needle, chunks));
}

export async function retrieve(query, knowledgeDir = dir, options = {}) {
  const found = await searchStore(query, knowledgeDir, options);
  retrieve.lastTrace = {
    methodLabel: found.methodLabel,
    fallbackNote: found.fallbackNote || "",
    hit: Boolean(found.hit),
    title: found.hit?.title || "",
    excerpt: found.hit ? formatStoreHit(found.hit) : MISS_TEXT,
    section: found.hit?.section || null,
    source: found.hit?.source || null,
  };
  return found.hit;
}
