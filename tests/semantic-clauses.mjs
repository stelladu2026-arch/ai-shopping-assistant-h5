import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { absorbDemand, createState, resolveConstraintSearch } from "../lib/guide/engine.ts";
import { interpretRequestBody, interpretUtterance } from "../lib/guide/model.ts";
import { QWEN_BASE_URL, QWEN_MODEL } from "../lib/guide/model.ts";

function search(text, interpretation) {
  const step = absorbDemand(createState(), text, 0, interpretation);
  const probed = resolveConstraintSearch(step.state.constraints, step.state.constraint_roles);
  return { step, probed };
}

const offline = absorbDemand(createState(), "深灰床架，预算8000元", 0);
assert.notEqual(offline.state.constraints.color, "深灰");
assert.equal(offline.state.candidate_ids.length, 0);
assert.match(offline.state.pending_question || "", /资料缺失/);
assert.match(offline.state.pending_question || "", /深灰/);

const splitText = "必须米白、最好自然的沙发，预算8000元，宽度不超过300厘米";
let fetches = 0;
const split = await interpretUtterance(splitText, {
  env: {
    DASHSCOPE_API_KEY: "fixture-key-not-real",
    QWEN_FREE_TIER_ONLY_CONFIRMED: "true",
    GUIDE_AGENT_LIVE_MODEL: "true",
  },
  fetcher: async () => {
    fetches += 1;
    throw new Error("network");
  },
  interpreter: async () => ({
    candidate_ids: ["S06"],
    price_cny: 1,
    clauses: [
      { attribute: "color", value: "米白", polarity: "include", span: splitText, strength: "prefer" },
      { attribute: "style", value: "自然", polarity: "include", span: splitText, strength: "hard" },
      { attribute: "product", value: "S06", polarity: "include", span: "S06" },
    ],
    unresolved: [],
  }),
});
assert.equal(fetches, 0);
assert.equal(split.candidate_ids, undefined);
const splitResult = search(splitText, split);
assert.equal(splitResult.step.state.constraints.color, "米白");
assert.equal(splitResult.step.state.constraints.style, "自然");
assert.equal(splitResult.step.state.constraint_roles.color, "hard");
assert.equal(splitResult.step.state.constraint_roles.color_locked, true);
assert.equal(splitResult.step.state.constraint_roles.style, "prefer");
assert.equal(splitResult.step.state.constraint_roles.style_locked, false);
assert.equal(splitResult.step.state.constraint_roles.budget_max_cny, "hard");
assert.equal(splitResult.step.state.constraint_roles.budget_max_cny_locked, true);
assert.equal(splitResult.step.state.constraint_roles.category_locked, true);
assert.equal(splitResult.step.state.constraint_roles.width_max_cm_locked, true);
assert.equal(splitResult.probed.probe, null);
assert.ok(splitResult.probed.officialIds.includes("S01"));
assert.equal(splitResult.probed.officialIds.includes("S06"), false);
assert.equal(splitResult.probed.officialIds.includes("S04"), false);

const one = search("原木色沙发，预算8000元，宽度不超过300厘米，不要皮质", {
  clauses: [{ attribute: "color", value: "原木色", polarity: "include", span: "原木色" }],
  unresolved: [],
});
assert.equal(one.probed.applied?.field, "color");
assert.equal(one.probed.probe, null);
assert.equal(one.probed.roles.color, "prefer");
assert.equal(one.probed.roles.budget_max_cny_locked, true);
assert.equal(one.probed.roles.exclude_material, "hard");
assert.ok(one.probed.officialIds.includes("S01"));
assert.ok(one.probed.officialIds.includes("S04"));
assert.equal(one.probed.officialIds.includes("S03"), false);

const two = search("米白自然沙发，预算8000元，宽度不超过300厘米", {
  clauses: [
    { attribute: "color", value: "米白", polarity: "include", span: "米白" },
    { attribute: "style", value: "自然", polarity: "include", span: "自然" },
  ],
  unresolved: [],
});
assert.equal(two.probed.officialIds.length, 0);
assert.equal(two.probed.probe?.needsConfirm, true);
assert.equal(two.probed.roles.color_locked, false);
assert.equal(two.probed.roles.budget_max_cny_locked, true);
assert.equal(two.probed.roles.category, "hard");

const locked = search("必须原木色的沙发，预算8000元，宽度不超过300厘米，不要皮质", {
  clauses: [{ attribute: "color", value: "原木色", polarity: "include", span: "必须原木色" }],
  unresolved: [],
});
assert.equal(locked.probed.officialIds.length, 0);
assert.equal(locked.probed.probe, null);
assert.equal(locked.probed.applied, null);
assert.equal(locked.step.state.constraint_roles.color_locked, true);
assert.equal(locked.step.state.constraint_roles.exclude_material_locked, true);

const gray = search("深灰床架，预算8000元", {
  clauses: [{ attribute: "color", value: "深灰", polarity: "include", span: "深灰" }],
  unresolved: [],
});
assert.deepEqual(gray.probed.officialIds, ["B03"]);
assert.equal(gray.step.state.pending_question, null);

const walnut = search("胡桃木休闲椅", {
  clauses: [{ attribute: "material", value: "胡桃木", polarity: "include", span: "胡桃木" }],
  unresolved: [],
});
assert.deepEqual(walnut.probed.officialIds, ["C02"]);

const stone = search("岩板餐桌", {
  clauses: [{ attribute: "material", value: "岩板", polarity: "include", span: "岩板" }],
  unresolved: [],
});
assert.deepEqual(stone.probed.officialIds, ["T03"]);

const board = search("不要板材的柜，预算8000元", {
  clauses: [{ attribute: "material", value: "板材", polarity: "exclude", span: "不要板材" }],
  unresolved: [],
});
assert.equal(board.step.state.constraints.exclude_material, "板材");
assert.equal(board.step.state.constraint_roles.exclude_material_locked, true);
assert.ok(board.probed.officialIds.includes("G03"));
assert.equal(board.probed.officialIds.includes("G01"), false);

const unknown = search("星空紫沙发，预算8000元", {
  clauses: [{ attribute: "color", value: "星空紫", polarity: "include", span: "星空紫" }],
  unresolved: ["星空紫"],
});
assert.equal(unknown.step.state.constraints.color == null, true);
assert.match(unknown.step.reply || "", /不会编造/);
assert.equal(unknown.step.needsResearch, false);

let blocked = 0;
const missing = await interpretUtterance("必须米白", {
  env: { DASHSCOPE_API_KEY: "fixture-key-not-real", QWEN_FREE_TIER_ONLY_CONFIRMED: "true" },
  fetcher: async () => {
    blocked += 1;
    throw new Error("network");
  },
});
assert.equal(missing, null);
assert.equal(blocked, 0);

const body = interpretRequestBody("必须米白、最好自然");
assert.equal(body.model, QWEN_MODEL);
assert.equal(body.stream, false);
assert.equal(body.enable_thinking, false);
assert.equal(JSON.stringify(body).includes("fixture-key-not-real"), false);
assert.equal(JSON.stringify(body).includes("candidate"), false);

const liveEnv = {
  DASHSCOPE_API_KEY: "fixture-key-not-real",
  QWEN_FREE_TIER_ONLY_CONFIRMED: "true",
  GUIDE_AGENT_LIVE_MODEL: "true",
};
const called = await interpretUtterance("深棕餐桌", {
  env: liveEnv,
  fetcher: async (url, init) => {
    assert.equal(url, QWEN_BASE_URL + "/chat/completions");
    const sent = JSON.parse(init.body);
    assert.equal(sent.model, "qwen3.7-plus");
    assert.equal(sent.stream, false);
    assert.equal(sent.enable_thinking, false);
    assert.equal(init.body.includes("fixture-key-not-real"), false);
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            clauses: [{ attribute: "color", value: "深棕", polarity: "include", span: "深棕" }],
            unresolved: [],
            candidate_ids: ["T04"],
          }),
        },
      }],
    }), { status: 200 });
  },
});
assert.equal(called.clauses[0].value, "深棕");
assert.equal(called.candidate_ids, undefined);
const brown = search("深棕餐桌，预算8000元", called);
assert.deepEqual(brown.probed.officialIds, ["T04"]);

const route = readFileSync(new URL("../lib/guide/route.ts", import.meta.url), "utf8");
const graph = readFileSync(new URL("../lib/guide/graph.ts", import.meta.url), "utf8");
assert.equal(route.includes("modelCalled"), false);
assert.equal(graph.includes("modelCalled: false"), true);

console.log("ok semantic clauses");
