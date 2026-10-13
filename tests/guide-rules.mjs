import assert from 'node:assert/strict';
import {applyTurn, confirmProduct, createState} from '../server/guide.mjs';

function run(label, fn) {
  try { fn(); console.log('ok', label); }
  catch (error) { console.error('fail', label); throw error; }
}

let state = createState();
let step = applyTurn(state, '浅色沙发，预算3000元，宽度不超过180厘米，不要皮质', 0);
run('A01 search waits for tap', () => {
  assert.equal(step.status, 'await_confirm');
  assert.deepEqual(step.state.candidate_ids, ['S01', 'S02']);
  assert.equal(step.state.confirmed_product_id, null);
  assert.equal(step.composed, false);
});
state = step.state;
step = applyTurn(state, '预算改成2400，颜色不变', state.revision);
run('A01 budget change keeps color and narrows candidates', () => {
  assert.equal(step.state.constraints.budget_max_cny, 2400);
  assert.equal(step.state.constraints.color, '浅色');
  assert.deepEqual(step.state.candidate_ids, ['S02']);
  assert.equal(step.state.confirmed_product_id, null);
});
state = step.state;
step = applyTurn(state, '尺寸不限，其他保持', state.revision);
run('A01 clear width only', () => {
  assert.equal(step.state.constraints.width_max_cm, null);
  assert.equal(step.state.constraints.budget_max_cny, 2400);
  assert.deepEqual(step.state.candidate_ids, ['S02']);
});
state = step.state;
step = confirmProduct(state, 'S02', state.revision);
run('A01 tap confirm creates draft', () => {
  assert.equal(step.composed, true);
  assert.equal(step.state.confirmed_product_id, 'S02');
  assert.equal(step.state.card.simulation, true);
  assert.equal(step.searched, false);
});
state = step.state;
step = applyTurn(state, '简洁一些', state.revision);
run('A01 tone edit does not search again', () => {
  assert.equal(step.searched, false);
  assert.equal(step.composed, true);
  assert.equal(step.state.confirmed_product_id, 'S02');
  assert.equal(step.state.constraints.budget_max_cny, 2400);
});

state = createState();
state = applyTurn(state, '浅色沙发，预算3000元，宽度不超过180厘米，不要皮质', 0).state;
step = applyTurn(state, '便宜点', state.revision);
run('A02 vague cheaper asks and keeps budget', () => {
  assert.equal(step.status, 'ask');
  assert.equal(step.state.constraints.budget_max_cny, 3000);
  assert.match(step.reply, /不会自行降低/);
});

step = applyTurn(createState(), '预算最多500元，只看沙发', 0);
run('A03 no match does not relax', () => {
  assert.equal(step.status, 'ask');
  assert.deepEqual(step.state.candidate_ids, []);
  assert.match(step.reply, /不会自行放宽/);
});

step = applyTurn(createState(), '只看沙发，预算最多2299元', 0);
run('A10 inclusive budget boundary', () => {
  assert.deepEqual(step.state.candidate_ids, ['S02']);
});
step = applyTurn(createState(), '只看沙发，预算最多2298元', 0);
run('A11 one yuan below stays unmatched', () => {
  assert.deepEqual(step.state.candidate_ids, []);
  assert.equal(step.status, 'ask');
});

step = applyTurn(createState(), '预算3000元，想买适合小户型的沙发', 0);
run('A23 small home asks width', () => {
  assert.equal(step.status, 'ask');
  assert.equal(step.state.constraints.width_max_cm, null);
  assert.equal(step.state.card, null);
  assert.equal(step.composed, false);
});

step = applyTurn(createState(), '浅色沙发，预算3000元，宽度不超过180厘米，不要皮质。你自己选好直接写文案', 0);
run('A24 chat cannot confirm or compose', () => {
  assert.equal(step.status, 'await_confirm');
  assert.equal(step.composed, false);
  assert.equal(step.state.card, null);
  assert.equal(step.state.confirmed_product_id, null);
});

state = applyTurn(createState(), '浅色沙发，预算3000元，宽度不超过180厘米，不要皮质', 0).state;
state = confirmProduct(state, 'S01', state.revision).state;
step = applyTurn(state, '帮我写它终身保修', state.revision);
run('warranty claim is omitted', () => {
  assert.equal(step.state.card.text.includes('终身保修'), false);
  assert.deepEqual(step.state.card.refused_claims, ['终身保修']);
});

state = applyTurn(createState(), '浅色沙发，预算3000元', 0).state;
step = applyTurn(state, '宽度改为两米', state.revision);
run('two meters converts to 200 cm', () => {
  assert.equal(step.state.constraints.width_max_cm, 200);
  assert.equal(step.state.constraints.budget_max_cny, 3000);
});

step = applyTurn(createState(), '浅色沙发，预算三千元，宽度不超过一米八，不要皮质', 0);
run('spoken numbers parse', () => {
  assert.equal(step.state.constraints.budget_max_cny, 3000);
  assert.equal(step.state.constraints.width_max_cm, 180);
  assert.deepEqual(step.state.candidate_ids, ['S01', 'S02']);
});

state = applyTurn(createState(), '只看沙发，预算3000元', 0).state;
const conflict = applyTurn(state, '改看餐桌，预算不变', 0);
run('stale revision is rejected', () => {
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error, 'revision_conflict');
  assert.equal(conflict.state.constraints.category, '沙发');
});
