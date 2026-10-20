import './register-ts.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.GUIDE_SQLITE_FILE = path.join(mkdtempSync(path.join(tmpdir(), 'demand-clarify-')), 'guide.sqlite');
process.env.GUIDE_AGENT_LIVE_MODEL = 'false';
process.env.GUIDE_RAG_REMOTE_CONFIRMED = 'false';
process.env.FEISHU_SYNC_ENABLED = 'false';
const engine = await import('../lib/guide/engine.ts');
const legacy = await import('../server/guide.mjs');
const {guideAct, guideMaterial} = await import('../lib/guide/session.ts');

for (const run of [engine.absorbDemand, engine.applyTurn, legacy.applyTurn]) {
  const turn = (text, state = engine.createState(), interpretation = null) => run(state, text, state.revision, interpretation);
  for (const text of ['预算3千多桌子', '预算三千多桌子', '预算3000左右桌子', '预算3k多桌子', '预算三四千桌子', '桌子，三千多']) {
    const r = turn(text);
    assert.equal(r.state.constraints.budget_max_cny, null, text);
    assert.equal(r.state.constraints.category, null, text);
    assert.equal(r.state.candidate_ids.length, 0);
    assert.match(r.reply, /餐桌、书桌还是茶几/);
    assert.match(r.reply, /预算最高/);
    assert.doesNotMatch(r.reply, /资料缺失|多桌子/);
  }
  let r = turn('预算3千多桌子');
  r = turn('餐桌', r.state);
  assert.equal(r.state.constraints.category, '餐桌');
  assert.match(r.reply, /预算最高/);
  assert.doesNotMatch(r.reply, /还是茶几/);
  r = turn('3500', r.state);
  assert.equal(r.state.constraints.budget_max_cny, 3500);
  assert.equal(r.state.constraints.category, '餐桌');
  assert.equal(r.state.demand_clarification.budget, null);
  assert.equal(r.state.demand_clarification.category, null);
  r = turn('最多3500', turn('预算3千多桌子').state);
  assert.equal(r.state.constraints.budget_max_cny, 3500);
  assert.match(r.reply, /餐桌、书桌还是茶几/);
  r = turn('饭桌', r.state);
  assert.equal(r.state.constraints.category, '餐桌');
  assert.equal(r.state.constraints.budget_max_cny, 3500);
  r = turn('餐桌，预算3500', turn('预算3千多桌子').state);
  assert.equal(r.state.constraints.budget_max_cny, 3500);
  assert.equal(r.state.demand_clarification.budget, null);
  r = turn('预算不限，餐桌', turn('预算3千多桌子').state);
  assert.equal(r.state.constraints.budget_max_cny, null);
  assert.equal(r.state.demand_clarification.budget, null);
  r = turn('预算3000元餐桌');
  assert.equal(r.state.constraints.budget_max_cny, 3000);
  r = turn('预算3000元，宽度180厘米左右，餐桌');
  assert.equal(r.state.constraints.budget_max_cny, 3000, 'width must not replace budget');
  r = turn('预算3千多桌子', { ...engine.createState(), confirmed_product_id: 'S01', confirmed_product_version: 'v1', card: {} });
  assert.equal(r.state.confirmed_product_id, null, 'stale confirmation must be cleared before generating');
}
const wrongModel = engine.absorbDemand(engine.createState(), '预算3千多桌子', 0, {clauses:[], unresolved:['多桌子']});
assert.doesNotMatch(wrongModel.reply, /资料缺失/);
let pending = engine.absorbDemand(engine.createState(), '预算3千多桌子', 0).state;
let edited = engine.editConstraint(pending, {field:'budget_max_cny',value:'3500'},pending.revision);
assert.match(edited.state.pending_question,/餐桌/);
assert.equal(edited.needsResearch,false);
assert.equal(engine.editConstraint(pending,{field:'budget_max_cny',value:'3千多'},pending.revision).ok,false);
assert.match(engine.absorbDemand(engine.createState(), '火星牌XYZ',0).reply,/资料缺失/);

// Full request path: enable image capability, but only explicit material requests may call it.
Object.assign(process.env, { GUIDE_IMAGE_ENABLED:'true', IMAGE_API_BASE:'https://image.fixture.invalid/v1', IMAGE_MODEL:'qwen-image-3.0', IMAGE_API_KEY:'fixture-only' });
const originalFetch = globalThis.fetch;
let images = 0;
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), 'https://image.fixture.invalid/v1/images/generations');
  assert.equal(init.method, 'POST');
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'qwen-image-3.0');
  assert.equal(body.n, 1);
  images++;
  return new Response(JSON.stringify({data:[{url:'https://image.fixture.invalid/table.png'}]}),{status:200});
};
try {
  const sessionId = 'clarification-image-path';
  let result = await guideAct({action:'turn',sessionId,text:'预算3千多桌子'});
  assert.match(result.leadText,/餐桌、书桌还是茶几/);
  assert.equal(images,0);
  const blocked = await guideMaterial({outputKind:'image_only'},sessionId,{newPiece:true});
  assert.equal(blocked.generatedImageUrl,'');
  assert.equal(images,0);
  await guideAct({action:'turn',sessionId,text:'餐桌'});
  result = await guideAct({action:'turn',sessionId,text:'最多3500元'});
  assert.equal(result.graph.edge,'product_decision');
  assert.equal(images,0);
  const selected = result.structured.products[0];
  assert.ok(selected, 'clarification must resume recommendation');
  await guideAct({action:'confirm',sessionId,productId:selected.id});
  await guideMaterial({outputKind:'copy_only'},sessionId,{newPiece:true});
  assert.equal(images,0, 'copy-only must not spend image quota');
  const generated = await guideMaterial({outputKind:'image_only'},sessionId,{newPiece:true});
  assert.equal(generated.generatedImageUrl,'https://image.fixture.invalid/table.png');
  assert.equal(images,1);
  const rich = await guideMaterial({outputKind:'rich'},sessionId,{newPiece:true});
  assert.equal(rich.generatedImageUrl,'https://image.fixture.invalid/table.png');
  assert.equal(images,2);
  process.env.GUIDE_IMAGE_ENABLED = 'false';
  const disabled = await guideMaterial({outputKind:'image_only'},sessionId,{newPiece:true});
  assert.match(disabled.imagePlaceholder,/开关已关闭/);
  assert.equal(images,2,'disabled provider must not be contacted');
} finally { globalThis.fetch = originalFetch; }
console.log('ok demand clarification: vague budgets, table categories, multi-turn recovery, no accidental image calls, explicit image/rich calls');
