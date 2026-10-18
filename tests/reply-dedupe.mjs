import assert from "node:assert/strict";
import "./register-ts.mjs";
import { repeatsAssistantReply } from "../lib/chat/replyDedupe.ts";

const missing = "资料缺失。没有找到「我可以发相似款式来找类似吗」，不会编造。下一步：改用商品名称或型号，或说明预算和品类。";
const askNote = "还缺能往下筛的条件，先补问，不编造商品。";
const filterNote = "按这次接待里的预算、尺寸、品类、颜色和材质筛选。依据来自门店商品资料。";
const pick = "请点选要确认的商品。";
const noResult = "无结果。这些条件有效，但没有同时符合的商品。下一步：改预算、宽度、颜色或材质里的一项。我不会自行放宽。";
const width = "还缺宽度上限。下一步：直接回复厘米数。「小户型」不能直接换成尺寸，我不会自行填写。";
const stay = "商品已确认。下一步去生成素材。这里不会重新筛选。";
const blocked = "还没有确认商品，不能生成素材。";
const materialNote = "素材只使用已经确认的这件商品。";
const materialLead = "素材已重新生成，请核对后再复制发给顾客。";
const policy = "不能代为发布或下单。请先说明要看的商品条件。";

assert.equal(repeatsAssistantReply(missing, missing), true);
assert.equal(repeatsAssistantReply(`  ${missing}  `, missing), true);
assert.equal(repeatsAssistantReply(askNote, missing), true);
assert.equal(repeatsAssistantReply(width, askNote), true);
assert.equal(repeatsAssistantReply(askNote, width), true);
assert.equal(repeatsAssistantReply(noResult, noResult), true);
assert.equal(repeatsAssistantReply(filterNote, pick), false);
assert.equal(repeatsAssistantReply(filterNote, noResult), false);
assert.equal(repeatsAssistantReply(stay, stay), true);
assert.equal(repeatsAssistantReply(blocked, blocked), true);
assert.equal(repeatsAssistantReply(materialNote, materialLead), false);
assert.equal(repeatsAssistantReply(missing, policy), false);
assert.equal(repeatsAssistantReply(askNote, policy), false);
assert.equal(repeatsAssistantReply(missing, ""), false);
assert.equal(repeatsAssistantReply("", missing), false);

console.log("ok reply dedupe");
