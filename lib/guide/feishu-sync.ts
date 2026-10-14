// @ts-nocheck
// 运营步骤：使用一个知识库空间，里面只放四个文件夹：商品资料、活动、售后、禁止承诺。
// 只导出已发布文档。自建应用保持只读，用 tenant token 访问，并把应用加为该空间的阅读者。
// 未同时打开 FEISHU_SYNC_ENABLED，且填好应用、密钥和空间编号时，本模块不访问网络，继续用 data/knowledge 里的本地 markdown。
import fs from "node:fs";
import path from "node:path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "knowledge");

function filled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function feishuReady(env = process.env) {
  return env?.FEISHU_SYNC_ENABLED === "true"
    && filled(env.FEISHU_APP_ID)
    && filled(env.FEISHU_APP_SECRET)
    && filled(env.FEISHU_WIKI_SPACE_ID);
}

function safeTitle(title) {
  const cleaned = String(title || "未命名").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 80);
  return cleaned || "未命名";
}

function documentBody(document) {
  return [
    "---",
    `title: ${safeTitle(document?.title)}`,
    `section: ${String(document?.section || "").trim()}`,
    `source_url: ${String(document?.sourceUrl || document?.source_url || "").trim()}`,
    `updated_at: ${String(document?.updatedAt || document?.updated_at || "").trim()}`,
    `version: ${String(document?.version || "").trim()}`,
    "---",
    "",
    String(document?.body || "").trim(),
    "",
  ].join("\n");
}

export function syncFeishuKnowledge(env = process.env, documents = undefined, options = {}) {
  if (!feishuReady(env)) return { ok: true, synced: false, written: 0 };
  if (!Array.isArray(documents) || documents.length === 0) return { ok: true, synced: false, written: 0 };
  const dir = options.dir || KNOWLEDGE_DIR;
  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const document of documents) {
    const title = safeTitle(document?.title);
    fs.writeFileSync(path.join(dir, `${title}.md`), documentBody(document), "utf8");
    written += 1;
  }
  return { ok: true, synced: true, written };
}
