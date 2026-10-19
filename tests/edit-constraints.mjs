import "./register-ts.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.GUIDE_SQLITE_FILE = path.join(mkdtempSync(path.join(tmpdir(), "edit-filters-")), "guide.sqlite");

const { applyTurn, createState: h5Create, editConstraint: h5Edit } = await import("../server/guide.mjs");
const { guideAct } = await import("../lib/guide/session.ts");
const { appliedLead, probeLead } = await import("../lib/guide/engine.ts");

const tagsUi = readFileSync(new URL("../components/chat/guide/ConstraintTags.tsx", import.meta.url), "utf8");
for (const banned of ["必须满足", "优先满足", "优先考虑", "去除条件", "改为优先", "改为必须"]) {
  assert.equal(tagsUi.includes(banned), false, banned);
}
assert.match(tagsUi, /不要/);
assert.match(tagsUi, /保存/);
assert.match(tagsUi, /取消/);
assert.match(tagsUi, /去掉/);
assert.match(tagsUi, /编辑/);
assert.match(tagsUi, /可放宽/);
assert.match(tagsUi, /DialogContent/);
assert.match(tagsUi, /data-constraint-strip/);
assert.match(tagsUi, /action: "edit-constraint", changes, revision/);
assert.match(tagsUi, /\$\{fieldName\(tag\.field\)\} \$\{tag\.value\}`\)\.join\(" · "\)/);
assert.equal(/h-11 min-w-0 flex-1/.test(tagsUi), false);
assert.equal(tagsUi.includes(">元<"), false);
assert.equal(tagsUi.includes("厘米"), false);
assert.equal(tagsUi.includes("h-[34px]"), false);
const confirmLead = probeLead({ needsConfirm: true, options: [{ label: "颜色 浅色" }, { label: "风格 自然" }] });
assert.equal(confirmLead.includes("必须满足"), false);
assert.equal(confirmLead.includes("优先满足"), false);
const relaxed = appliedLead({ label: "颜色 浅色" });
assert.match(relaxed, /可放宽/);
assert.equal(relaxed.includes("优先考虑"), false);

function h5(text, state) {
  const step = applyTurn(state || h5Create(), text, state ? state.revision : 0);
  assert.equal(step.ok, true);
  return step.state;
}

let h5State = h5("只看沙发，预算3000元，不要皮质");
assert.equal(h5State.constraints.budget_max_cny, 3000);
assert.equal(h5State.constraints.exclude_material, "皮质");
assert.equal(h5State.candidate_ids.includes("S04"), false);
assert.equal(h5State.candidate_ids.includes("S03"), false);
h5State = h5("预算改成5000", h5State);
assert.equal(h5State.constraints.budget_max_cny, 5000);
assert.equal(h5State.constraints.exclude_material, "皮质");
assert.equal(h5State.candidate_ids.includes("S04"), true);
assert.equal(h5State.candidate_ids.includes("S03"), false);
h5State = h5("去掉不要皮质", h5State);
assert.equal(h5State.constraints.exclude_material, null);
assert.equal(h5State.constraints.budget_max_cny, 5000);
assert.equal(h5State.candidate_ids.includes("S03"), true);
h5State = h5("宽度改成160", h5State);
assert.equal(h5State.constraints.width_max_cm, 160);
assert.equal(h5State.constraints.budget_max_cny, 5000);
assert.equal(h5State.candidate_ids.includes("S02"), true);
assert.equal(h5State.candidate_ids.includes("S01"), false);

let cleared = h5("浅色沙发，预算3000元，宽度不超过180厘米，不要皮质");
cleared = h5("颜色不限", cleared);
assert.equal(cleared.constraints.color, null);
assert.equal(cleared.constraints.budget_max_cny, 3000);
assert.equal(cleared.constraints.width_max_cm, 180);
cleared = h5("预算不限", cleared);
assert.equal(cleared.constraints.budget_max_cny, null);
assert.equal(cleared.constraints.category, "沙发");
const priced = h5("只看沙发，预算3000元");
const vague = applyTurn(priced, "便宜点", priced.revision);
assert.equal(vague.state.constraints.budget_max_cny, 3000);
assert.match(vague.reply, /不会自行降低/);

const removed = h5Edit(h5State, { field: "width_max_cm", clear: true }, h5State.revision);
assert.equal(removed.ok, true);
assert.equal(removed.state.constraints.width_max_cm, null);
assert.equal(removed.state.constraints.budget_max_cny, 5000);
assert.equal(removed.state.candidate_ids.includes("S01"), true);
assert.equal(removed.state.candidate_ids.includes("S05"), false);

const sid = "edit_filters";
await guideAct({ action: "reset", sessionId: sid });
let turn = await guideAct({ action: "turn", sessionId: sid, text: "只看沙发，预算3000元，不要皮质" });
assert.equal(turn.structured.constraints.budget_max_cny, 3000);
assert.equal(turn.structured.constraints.exclude_material, "皮质");
assert.deepEqual(
  turn.structured.constraintTags.map((tag) => tag.label),
  ["预算 3000元", "品类 沙发", "不要 皮质"],
);
assert.equal(turn.structured.constraintTags.some((tag) => /必须|优先|去除/.test(tag.label)), false);
assert.equal(turn.structured.candidateIds.includes("S03"), false);
assert.equal(turn.structured.candidateIds.includes("S04"), false);
turn = await guideAct({ action: "turn", sessionId: sid, text: "预算改成5000", revision: turn.structured.revision });
assert.equal(turn.structured.constraints.budget_max_cny, 5000);
assert.equal(turn.structured.constraints.category, "沙发");
assert.equal(turn.structured.constraints.exclude_material, "皮质");
assert.equal(turn.structured.candidateIds.includes("S04"), true);
assert.equal(turn.structured.candidateIds.includes("S03"), false);
turn = await guideAct({ action: "turn", sessionId: sid, text: "去掉不要皮质", revision: turn.structured.revision });
assert.equal(turn.ok, true);
assert.equal(turn.structured.constraints.exclude_material, null);
assert.equal(turn.structured.constraints.budget_max_cny, 5000);
assert.equal(turn.structured.pendingQuestion, null);
assert.equal(turn.leadText.includes("资料缺失"), false);
assert.equal(turn.structured.candidateIds.includes("S03"), true);

const chipId = "edit_chip";
await guideAct({ action: "reset", sessionId: chipId });
let chip = await guideAct({ action: "turn", sessionId: chipId, text: "浅色沙发，预算3000元，不要皮质" });
chip = await guideAct({ action: "edit-constraint", sessionId: chipId, field: "budget_max_cny", value: "5000", revision: chip.structured.revision });
assert.equal(chip.structured.constraints.budget_max_cny, 5000);
assert.equal(chip.structured.constraints.color, "浅色");
assert.equal(chip.structured.constraints.exclude_material, "皮质");
assert.equal(chip.structured.candidateIds.includes("S03"), false);
chip = await guideAct({ action: "edit-constraint", sessionId: chipId, field: "color", clear: true, revision: chip.structured.revision });
assert.equal(chip.structured.constraints.color, null);
assert.equal(chip.structured.constraints.budget_max_cny, 5000);
assert.equal(chip.structured.constraints.exclude_material, "皮质");
assert.equal(chip.structured.candidateIds.includes("S04"), true);
assert.equal(chip.structured.candidateIds.includes("S03"), false);

const widthId = "edit_width";
await guideAct({ action: "reset", sessionId: widthId });
let width = await guideAct({ action: "turn", sessionId: widthId, text: "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质" });
assert.equal(width.structured.constraints.width_max_cm, 180);
assert.equal(width.structured.constraints.color, "浅色");
width = await guideAct({ action: "turn", sessionId: widthId, text: "宽度改成160", revision: width.structured.revision });
assert.equal(width.structured.constraints.width_max_cm, 160);
assert.equal(width.structured.constraints.budget_max_cny, 3000);
assert.equal(width.structured.constraints.color, "浅色");
assert.equal(width.structured.constraints.exclude_material, "皮质");
assert.equal(width.structured.candidateIds.includes("S02"), true);
assert.equal(width.structured.candidateIds.includes("S01"), false);
assert.equal(width.leadText.includes("参数错误"), false);
width = await guideAct({ action: "turn", sessionId: widthId, text: "颜色不限", revision: width.structured.revision });
assert.equal(width.structured.constraints.color, null);
assert.equal(width.structured.constraints.width_max_cm, 160);

const openId = "edit_open_budget";
await guideAct({ action: "reset", sessionId: openId });
let opened = await guideAct({ action: "turn", sessionId: openId, text: "只看沙发，预算3000元，宽度不超过180厘米" });
opened = await guideAct({ action: "turn", sessionId: openId, text: "预算不限", revision: opened.structured.revision });
assert.equal(opened.structured.constraints.budget_max_cny, null);
assert.equal(opened.structured.constraints.width_max_cm, 180);
assert.equal(opened.structured.constraints.category, "沙发");

const policyId = "edit_policy";
await guideAct({ action: "reset", sessionId: policyId });
const picked = await guideAct({ action: "turn", sessionId: policyId, text: "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质" });
const productId = picked.structured.candidateIds[0];
const confirmed = await guideAct({ action: "confirm", sessionId: policyId, productId, revision: picked.structured.revision });
assert.equal(confirmed.structured.confirmedId, productId);
const policy = await guideAct({ action: "turn", sessionId: policyId, text: "沙发质保多久", revision: confirmed.structured.revision });
assert.equal(policy.structured.confirmedId, productId);
assert.equal(policy.structured.constraints.category, "沙发");
assert.equal(policy.structured.constraints.width_max_cm, 180);
assert.equal(policy.structured.constraints.budget_max_cny, 3000);
assert.equal(policy.structured.constraints.color, "浅色");
assert.equal(policy.structured.constraints.exclude_material, "皮质");

const flowId = "edit_then_confirm";
await guideAct({ action: "reset", sessionId: flowId });
let flow = await guideAct({ action: "turn", sessionId: flowId, text: "只看沙发，预算3000元，不要皮质" });
flow = await guideAct({ action: "edit-constraint", sessionId: flowId, field: "budget_max_cny", value: "5000", revision: flow.structured.revision });
flow = await guideAct({ action: "edit-constraint", sessionId: flowId, field: "exclude_material", clear: true, revision: flow.structured.revision });
const pickedProduct = flow.structured.products.find((item) => item.name === "林间三人沙发");
assert.equal(pickedProduct.price_cny, 3299);
const chosen = await guideAct({ action: "confirm", sessionId: flowId, productId: pickedProduct.id, revision: flow.structured.revision });
assert.equal(chosen.structured.confirmedId, pickedProduct.id);
assert.equal(String(chosen.leadText || "").includes("已达本次上限"), false);
const asked = await guideAct({ action: "turn", sessionId: flowId, text: "沙发质保多久", revision: chosen.structured.revision });
assert.equal(asked.structured.confirmedId, pickedProduct.id);
assert.equal(asked.structured.constraints.category, "沙发");
assert.equal(asked.structured.constraints.budget_max_cny, 5000);
assert.equal(asked.structured.constraints.exclude_material, null);

const cheapId = "edit_cheap";
await guideAct({ action: "reset", sessionId: cheapId });
let cheap = await guideAct({ action: "turn", sessionId: cheapId, text: "只看沙发，预算3000元" });
cheap = await guideAct({ action: "turn", sessionId: cheapId, text: "便宜点", revision: cheap.structured.revision });
assert.equal(cheap.structured.constraints.budget_max_cny, 3000);
assert.match(cheap.leadText || "", /不会自行降低/);

const batchBase = h5("只看沙发，预算3000元，不要皮质");
const batchRev = batchBase.revision;
const batchFailed = h5Edit(batchBase, { changes: [{ field: "budget_max_cny", value: "5000" }, { field: "category", value: "" }] }, batchRev);
assert.equal(batchFailed.ok, false);
assert.equal(batchFailed.state.constraints.budget_max_cny, 3000);
assert.equal(batchFailed.state.constraints.exclude_material, "皮质");
assert.equal(batchFailed.state.revision, batchRev);
const batched = h5Edit(batchBase, {
  changes: [
    { field: "budget_max_cny", value: "5000" },
    { field: "exclude_material", clear: true },
  ],
}, batchRev);
assert.equal(batched.ok, true);
assert.equal(batched.state.revision, batchRev + 1);
assert.equal(batched.state.constraints.budget_max_cny, 5000);
assert.equal(batched.state.constraints.category, "沙发");
assert.equal(batched.state.constraints.exclude_material, null);
assert.equal(batched.state.candidate_ids.includes("S04"), true);
assert.equal(batched.state.candidate_ids.includes("S03"), true);

const batchId = "edit_batch";
await guideAct({ action: "reset", sessionId: batchId });
let batchTurn = await guideAct({ action: "turn", sessionId: batchId, text: "只看沙发，预算3000元，不要皮质" });
batchTurn = await guideAct({
  action: "edit-constraint",
  sessionId: batchId,
  changes: [
    { field: "budget_max_cny", value: "5000" },
    { field: "exclude_material", clear: true },
  ],
  revision: batchTurn.structured.revision,
});
assert.equal(batchTurn.structured.constraints.budget_max_cny, 5000);
assert.equal(batchTurn.structured.constraints.category, "沙发");
assert.equal(batchTurn.structured.constraints.exclude_material, null);
assert.equal(batchTurn.structured.candidateIds.includes("S04"), true);
assert.equal(batchTurn.structured.candidateIds.includes("S03"), true);

function collapsedLine(tags) {
  const names = {
    budget_max_cny: "预算",
    width_max_cm: "尺寸",
    category: "品类",
    color: "颜色",
    exclude_material: "不要",
    material: "材质",
    style: "风格",
  };
  return tags.map((tag) => `${names[tag.field] || "条件"} ${tag.value}`).join(" · ");
}

const spokenH5 = h5("预算3千，只看柜子");
assert.equal(spokenH5.constraints.budget_max_cny, 3000);
assert.equal(spokenH5.constraints.category, "柜子");
assert.equal(
  [`预算 ${spokenH5.constraints.budget_max_cny}`, `品类 ${spokenH5.constraints.category}`].join(" · "),
  "预算 3000 · 品类 柜子",
);
assert.equal(h5("预算3千元").constraints.budget_max_cny, 3000);
assert.equal(h5("预算三千").constraints.budget_max_cny, 3000);
assert.equal(h5("预算1万").constraints.budget_max_cny, 10000);
assert.equal(h5("预算1万元").constraints.budget_max_cny, 10000);
assert.equal(h5("预算一万").constraints.budget_max_cny, 10000);
assert.equal(h5("预算2百").constraints.budget_max_cny, 200);
assert.equal(h5("预算两百").constraints.budget_max_cny, 200);
assert.equal(h5("预算3k").constraints.budget_max_cny, 3000);
assert.equal(h5("预算3K").constraints.budget_max_cny, 3000);
assert.equal(h5("预算3000元").constraints.budget_max_cny, 3000);
assert.equal(h5("宽度不超过1.8米").constraints.width_max_cm, 180);
assert.equal(h5("宽度不超过180厘米").constraints.width_max_cm, 180);
const words = h5("浅色柜子，不要皮质");
assert.equal(words.constraints.color, "浅色");
assert.equal(words.constraints.exclude_material, "皮质");
assert.equal(words.constraints.category, "柜子");
const kept = h5Edit(spokenH5, {
  changes: [
    { field: "budget_max_cny", value: "3000" },
    { field: "category", value: "柜子" },
  ],
}, spokenH5.revision);
assert.equal(kept.ok, true);
assert.equal(kept.state.constraints.budget_max_cny, 3000);
assert.equal(kept.state.constraints.category, "柜子");
const sofaBase = h5("只看沙发");
const spokenEdit = h5Edit(sofaBase, { field: "budget_max_cny", value: "3千" }, sofaBase.revision);
assert.equal(spokenEdit.ok, true);
assert.equal(spokenEdit.state.constraints.budget_max_cny, 3000);
assert.equal(spokenEdit.state.constraints.category, "沙发");
const meterEdit = h5Edit(sofaBase, { field: "width_max_cm", value: "1.8米" }, sofaBase.revision);
assert.equal(meterEdit.state.constraints.width_max_cm, 180);

const amountId = "amount_qian";
await guideAct({ action: "reset", sessionId: amountId });
let amount = await guideAct({ action: "turn", sessionId: amountId, text: "预算3千，只看柜子" });
assert.equal(amount.structured.constraints.budget_max_cny, 3000);
assert.equal(amount.structured.constraints.category, "柜子");
assert.equal(amount.structured.constraints.color, null);
assert.equal(collapsedLine(amount.structured.constraintTags), "预算 3000 · 品类 柜子");
assert.equal(amount.structured.candidateIds.includes("K01"), true);
assert.equal(amount.structured.candidateIds.includes("S01"), false);
amount = await guideAct({
  action: "edit-constraint",
  sessionId: amountId,
  changes: [
    { field: "budget_max_cny", value: "3000" },
    { field: "category", value: "柜子" },
  ],
  revision: amount.structured.revision,
});
assert.equal(amount.structured.constraints.budget_max_cny, 3000);
assert.equal(amount.structured.constraints.category, "柜子");
assert.equal(collapsedLine(amount.structured.constraintTags), "预算 3000 · 品类 柜子");

const wanId = "amount_wan";
await guideAct({ action: "reset", sessionId: wanId });
const wan = await guideAct({ action: "turn", sessionId: wanId, text: "预算1万元" });
assert.equal(wan.structured.constraints.budget_max_cny, 10000);
assert.match(collapsedLine(wan.structured.constraintTags), /预算 10000/);

const meterId = "amount_meter";
await guideAct({ action: "reset", sessionId: meterId });
const meter = await guideAct({ action: "turn", sessionId: meterId, text: "宽度不超过1.8米，只看沙发，预算3000元" });
assert.equal(meter.structured.constraints.width_max_cm, 180);
assert.equal(meter.structured.constraints.budget_max_cny, 3000);
assert.equal(meter.structured.constraints.category, "沙发");
assert.match(collapsedLine(meter.structured.constraintTags), /预算 3000/);
assert.match(collapsedLine(meter.structured.constraintTags), /尺寸 180/);
assert.match(collapsedLine(meter.structured.constraintTags), /品类 沙发/);

console.log("ok edit constraints");
