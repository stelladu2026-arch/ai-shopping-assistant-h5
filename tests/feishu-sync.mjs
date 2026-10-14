import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { feishuReady, syncFeishuKnowledge } from "../lib/guide/feishu-sync.ts";
import { retrieve, storeExcerptConflicts } from "../lib/guide/knowledge.ts";
import { productById } from "../lib/guide/engine.ts";

const disabledDir = path.join(tmpdir(), "feishu-disabled-should-not-exist");
const disabled = syncFeishuKnowledge(
  { FEISHU_SYNC_ENABLED: "false", FEISHU_APP_ID: "", FEISHU_APP_SECRET: "", FEISHU_WIKI_SPACE_ID: "" },
  [{ title: "不该写入", section: "商品资料", sourceUrl: "https://example.invalid/doc", updatedAt: "2026-10-13", version: "1", body: "正文" }],
  { dir: disabledDir },
);
assert.deepEqual(disabled, { ok: true, synced: false, written: 0 });
assert.equal(existsSync(disabledDir), false);

const partial = syncFeishuKnowledge({
  FEISHU_SYNC_ENABLED: "true",
  FEISHU_APP_ID: "fixture-feishu-not-real",
  FEISHU_APP_SECRET: "",
  FEISHU_WIKI_SPACE_ID: "space",
});
assert.equal(partial.synced, false);
assert.equal(partial.written, 0);
assert.equal(feishuReady({}), false);

const source = readFileSync(new URL("../lib/guide/feishu-sync.ts", import.meta.url), "utf8");
assert.equal(/open\.feishu\.cn|feishu\.cn\/open-apis/.test(source), false);
assert.match(source, /商品资料/);
assert.match(source, /禁止承诺/);

const dir = mkdtempSync(path.join(tmpdir(), "feishu-sync-"));
try {
  const ready = {
    FEISHU_SYNC_ENABLED: "true",
    FEISHU_APP_ID: "fixture-feishu-not-real",
    FEISHU_APP_SECRET: "fixture-feishu-not-real",
    FEISHU_WIKI_SPACE_ID: "fixture-space",
  };
  const written = syncFeishuKnowledge(ready, [{
    title: "同步样例",
    section: "商品资料",
    sourceUrl: "https://example.invalid/wiki",
    updatedAt: "2026-10-13",
    version: "3",
    body: "已发布文档里的可核对摘录。",
  }], { dir });
  assert.equal(written.synced, true);
  assert.equal(written.written, 1);
  const hit = await retrieve("可核对摘录", dir);
  assert.equal(hit.title, "同步样例");
  assert.equal(hit.section, "商品资料");
  assert.equal(hit.sourceUrl, "https://example.invalid/wiki");
  assert.equal(hit.updatedAt, "2026-10-13");
  assert.equal(hit.version, "3");
  assert.match(hit.excerpt, /可核对摘录/);
  assert.equal(hit.excerpt.includes("source_url"), false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const sofa = productById("S01");
const local = readFileSync(new URL("../data/knowledge/云朵双人沙发.md", import.meta.url), "utf8");
assert.equal(storeExcerptConflicts(local, sofa), false);
assert.equal(storeExcerptConflicts("标价 1 元", sofa), true);
assert.equal(storeExcerptConflicts("终身保修十年", sofa), true);
assert.equal(storeExcerptConflicts("A和C可以一起使用", sofa), true);

const content = readFileSync(new URL("../lib/guide/content-node.ts", import.meta.url), "utf8");
assert.equal(content.includes("retrieve("), false);
assert.equal(content.includes("syncFeishu"), false);
assert.match(content, /不检索门店资料/);

const missed = await retrieve("星河沙发");
assert.equal(missed, null);

console.log("ok feishu sync stays off");
