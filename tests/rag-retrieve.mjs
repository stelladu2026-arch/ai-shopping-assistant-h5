import "../tests/register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answerStoreDoc } from "../lib/guide/product-decision.ts";
import { guideAct } from "../lib/guide/session.ts";
import { readCallCounts, resetCallBudgets } from "../lib/guide/db.ts";
import { DEMO_METHOD, EMBED_BATCH, REMOTE_METHOD, rankByRemote, remoteReady } from "../lib/guide/rag.ts";
import { retrieve } from "../lib/guide/knowledge.ts";

const catalogPath = new URL("../data/catalog.json", import.meta.url);
const beforeCatalog = readFileSync(catalogPath, "utf8");
const sofaPrice = JSON.parse(beforeCatalog).find((item) => item.id === "S01").price_cny;
assert.equal(sofaPrice, 2699);

const ragSource = readFileSync(new URL("../lib/guide/rag.ts", import.meta.url), "utf8");
assert.equal(/https?:\/\//.test(ragSource), false);
assert.equal(ragSource.includes("rankByDemo"), true);
const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
assert.match(example, /GUIDE_RAG_EMBED_BASE=\s*$/m);
assert.match(example, /GUIDE_RAG_EMBED_API_KEY=\s*$/m);
assert.match(example, /GUIDE_RAG_RERANK_BASE=\s*$/m);
assert.match(example, /GUIDE_RAG_RERANK_API_KEY=\s*$/m);
assert.match(example, /GUIDE_RAG_REMOTE_CONFIRMED=false/);
assert.match(example, /GUIDE_RAG_EMBED_MODEL=qwen3\.7-text-embedding/);
assert.match(example, /GUIDE_RAG_RERANK_MODEL=qwen3\.7-text-rerank/);
assert.match(example, /\/api\/v1\/services\/rerank\/text-rerank\/text-rerank/);
assert.match(example, /GUIDE_IMAGE_ENABLED=false/);
assert.equal(example.includes("sk-"), false);

const partial = {
  GUIDE_RAG_EMBED_BASE: "http://embed.test.local/compatible-mode/v1",
  GUIDE_RAG_EMBED_API_KEY: "",
  GUIDE_RAG_RERANK_BASE: "http://rerank.test.local/rerank",
  GUIDE_RAG_RERANK_API_KEY: "rerank-test",
  GUIDE_RAG_REMOTE_CONFIRMED: "true",
};
assert.equal(remoteReady(partial), false);
let partialCalls = 0;
const partialHit = await retrieve("坏了怎么办", undefined, {
  env: partial,
  fetcher: async () => {
    partialCalls += 1;
    throw new Error("should not request");
  },
});
assert.equal(partialCalls, 0);
assert.equal(partialHit.title, "售后说明");
assert.equal(partialHit.section, "售后说明");
assert.equal(partialHit.source, "售后说明.md");
assert.match(partialHit.excerpt, /现行售后/);

const remoteEnv = {
  GUIDE_RAG_EMBED_BASE: "http://embed.test.local/compatible-mode/v1",
  GUIDE_RAG_EMBED_API_KEY: "embed-test",
  GUIDE_RAG_RERANK_BASE: "http://rerank.test.local/rerank",
  GUIDE_RAG_RERANK_API_KEY: "rerank-test",
  GUIDE_RAG_REMOTE_CONFIRMED: "true",
};
assert.equal(remoteReady(remoteEnv), true);
globalThis.__guideChunkEmbedCache = new Map();
resetCallBudgets("rag_remote_fixture");
const remoteCalls = [];
const remote = await answerStoreDoc("rag_remote_fixture", "坏了怎么办", {
  env: remoteEnv,
  fetcher: async (url, init) => {
    const body = JSON.parse(init.body);
    remoteCalls.push({ url: String(url), body, authorization: init.headers.authorization });
    if (String(url).endsWith("/embeddings")) {
      assert.ok(body.input.length <= EMBED_BATCH);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: body.input.map((_, index) => ({ index, embedding: [1, index === 0 ? 1 : 0.2] })),
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        output: {
          results: body.input.documents.map((_, index) => ({ index, relevance_score: 1 - index * 0.01 })),
        },
      }),
    };
  },
});
const embedCalls = remoteCalls.filter((call) => call.url.endsWith("/embeddings"));
const rerankCalls = remoteCalls.filter((call) => call.url.includes("/text-rerank/text-rerank"));
assert.equal(embedCalls.length, 1);
assert.equal(rerankCalls.length, 1);
assert.equal(remoteCalls.length, 2);
assert.equal(embedCalls[0].url, "http://embed.test.local/compatible-mode/v1/embeddings");
assert.equal(embedCalls[0].body.model, "qwen3.7-text-embedding");
assert.equal(embedCalls[0].authorization, "Bearer embed-test");
assert.ok(Array.isArray(embedCalls[0].body.input));
assert.ok(embedCalls[0].body.input.length <= EMBED_BATCH);
assert.equal(rerankCalls[0].url, "http://embed.test.local/api/v1/services/rerank/text-rerank/text-rerank");
assert.equal(rerankCalls[0].url.includes("rerank.test.local"), false);
assert.equal(rerankCalls[0].body.model, "qwen3.7-text-rerank");
assert.equal(rerankCalls[0].body.input.query, "坏了怎么办");
assert.ok(Array.isArray(rerankCalls[0].body.input.documents));
assert.deepEqual(rerankCalls[0].body.parameters, {});
assert.equal(rerankCalls[0].authorization, "Bearer rerank-test");
assert.equal(remote.found, true);
assert.equal(remote.title, "售后说明");
assert.equal(remote.section, "售后说明");
assert.equal(remote.source, "售后说明.md");
assert.equal(remote.trace.methodLabel, REMOTE_METHOD);
assert.equal(readCallCounts("rag_remote_fixture").retrieve, 1);

globalThis.__guideChunkEmbedCache = new Map();
const fallbackCalls = [];
const fallbackEnv = {
  GUIDE_RAG_EMBED_BASE: "http://embed.test.local/compatible-mode/v1/chat/completions",
  GUIDE_RAG_EMBED_API_KEY: "embed-test",
  GUIDE_RAG_RERANK_API_KEY: "",
  GUIDE_RAG_REMOTE_CONFIRMED: "true",
};
assert.equal(remoteReady(fallbackEnv), true);
const fallbackRanked = await rankByRemote("问", [
  { title: "甲", section: "甲", source: "甲.md", text: "甲" },
  { title: "乙", section: "乙", source: "乙.md", text: "乙" },
], fallbackEnv, async (url, init) => {
  const body = JSON.parse(init.body);
  fallbackCalls.push({ url: String(url), body, authorization: init.headers.authorization });
  if (String(url).endsWith("/embeddings")) {
    assert.ok(body.input.length <= EMBED_BATCH);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: body.input.map((text, index) => ({
          index,
          embedding: String(text).includes("问") || String(text).includes("乙") ? [1, 0] : [0, 1],
        })),
      }),
    };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      output: {
        results: [
          { index: 0, relevance_score: 0.1 },
          { index: 1, relevance_score: 0.9 },
        ],
      },
    }),
  };
});
assert.equal(fallbackCalls[0].url, "http://embed.test.local/compatible-mode/v1/embeddings");
assert.equal(fallbackCalls[1].url, "http://embed.test.local/api/v1/services/rerank/text-rerank/text-rerank");
assert.equal(fallbackCalls[1].authorization, "Bearer embed-test");
assert.deepEqual(fallbackCalls[1].body.parameters, {});
assert.equal(fallbackCalls[1].body.input.query, "问");
assert.deepEqual(fallbackCalls[1].body.input.documents, ["乙", "甲"]);
assert.equal(fallbackRanked[0].text, "甲");

globalThis.__guideChunkEmbedCache = new Map();
const batchCalls = [];
const batchEnv = {
  ...remoteEnv,
  GUIDE_RAG_EMBED_MODEL: "batch-embed-fixture",
};
const many = Array.from({ length: 25 }, (_, index) => ({
  title: `片段${index}`,
  section: "片段",
  source: "片段.md",
  text: `片段${index}`,
}));
await rankByRemote("问句", many, batchEnv, async (url, init) => {
  const body = JSON.parse(init.body);
  batchCalls.push({ url: String(url), body });
  if (String(url).endsWith("/embeddings")) {
    assert.ok(body.input.length <= EMBED_BATCH);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: body.input.map((_, index) => ({ index, embedding: [1, index] })),
      }),
    };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      output: {
        results: body.input.documents.map((_, index) => ({ index, relevance_score: 1 - index * 0.01 })),
      },
    }),
  };
});
const batchEmbeds = batchCalls.filter((call) => call.url.endsWith("/embeddings"));
assert.equal(batchEmbeds.length, 2);
assert.equal(batchEmbeds[0].body.input.length, 20);
assert.equal(batchEmbeds[1].body.input.length, 6);
assert.equal(batchEmbeds[0].body.input.includes("问句"), true);
assert.equal(batchCalls.filter((call) => call.url.includes("/text-rerank/")).length, 1);

const savedRemote = {};
for (const name of ["GUIDE_RAG_EMBED_BASE", "GUIDE_RAG_EMBED_API_KEY", "GUIDE_RAG_EMBED_MODEL", "GUIDE_RAG_RERANK_BASE", "GUIDE_RAG_RERANK_API_KEY", "GUIDE_RAG_RERANK_MODEL", "GUIDE_RAG_REMOTE_CONFIRMED"]) {
  savedRemote[name] = process.env[name];
  delete process.env[name];
}
const originalFetch = globalThis.fetch;
let liveCalls = 0;
globalThis.fetch = async () => {
  liveCalls += 1;
  throw new Error("offline");
};
let demo;
try {
  demo = await guideAct({ action: "reset", sessionId: "rag_demo_fixture" });
  demo = await guideAct({ action: "turn", sessionId: "rag_demo_fixture", text: "坏了怎么办" });
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(liveCalls, 0);
assert.equal(demo.ok, true);
assert.equal(demo.graph.modelCalled, false);
assert.equal(demo.structured.confirmedId, null);
assert.equal((demo.structured.candidateIds || []).length, 0);
assert.match(demo.leadText, /售后说明/);
assert.match(demo.leadText, /章节/);
assert.match(demo.leadText, /售后说明\.md/);
assert.match(demo.leadText, /现行售后/);
assert.equal(demo.leadText.includes("资料缺失"), false);
assert.equal(demo.structured.process.rag.method, DEMO_METHOD);
assert.match(demo.structured.process.rag.excerpt, /召回|现行售后|章节/);
assert.match(demo.structured.process.rag.method, /召回/);
assert.match(demo.structured.process.rag.method, /重排序/);
assert.equal(demo.structured.process.usage.retrieve.used, 1);
assert.equal(readCallCounts("rag_demo_fixture").retrieve, 1);

const policySid = "rag_policy_aside_fixture";
await guideAct({ action: "reset", sessionId: policySid });
const tables = await guideAct({ action: "turn", sessionId: policySid, text: "只看餐桌，预算3000元" });
const tableId = tables.structured.candidateIds[0];
await guideAct({ action: "confirm", sessionId: policySid, productId: tableId });
const beforePolicy = readCallCounts(policySid);
const warranty = await guideAct({ action: "turn", sessionId: policySid, text: "沙发质保多久" });
assert.equal(warranty.ok, true);
assert.equal(warranty.structured.confirmedId, tableId);
assert.deepEqual(warranty.structured.candidateIds, tables.structured.candidateIds);
assert.equal(warranty.structured.constraints.category, "餐桌");
assert.equal(warranty.structured.constraints.budget_max_cny, 3000);
assert.equal(warranty.structured.pendingQuestion, null);
assert.match(warranty.leadText, /售后说明/);
assert.equal(warranty.leadText.includes("资料缺失"), false);
assert.equal(readCallCounts(policySid).retrieve, beforePolicy.retrieve);
assert.equal(readCallCounts(policySid).policy, 1);

const picked = await guideAct({
  action: "turn",
  sessionId: "rag_price_fixture",
  text: "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质",
});
assert.equal(picked.structured.products.find((item) => item.id === "S01").price_cny, 2699);
assert.equal(readFileSync(catalogPath, "utf8"), beforeCatalog);
for (const name of Object.keys(savedRemote)) {
  if (savedRemote[name] == null) delete process.env[name];
  else process.env[name] = savedRemote[name];
}

console.log("ok rag retrieve");
