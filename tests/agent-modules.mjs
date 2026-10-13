import assert from 'node:assert/strict';
import {reflect} from '../server/reflect.mjs';
import {executeImage, imageRequest} from '../server/image.mjs';
import {createState} from '../server/guide.mjs';

const state = createState();
state.constraints = {budget_max_cny: 3000, width_max_cm: 180, category: '沙发', color: '浅色', exclude_material: '皮质'};
state.candidate_ids = ['S01', 'S02'];
const ok = reflect(state);
assert.equal(ok.passed, true);
assert.equal(ok.used_prior_conclusion, false);
assert.equal(ok.blind, true);

const bad = createState();
bad.constraints = {budget_max_cny: 2000, width_max_cm: null, category: '沙发', color: null, exclude_material: null};
bad.candidate_ids = ['S01'];
const failed = reflect(bad);
assert.equal(failed.pending_review, true);
assert.equal(failed.passed, false);
assert.ok(failed.failed_targets.includes('S01'));

const stacked = createState();
stacked.confirmed_product_id = 'S01';
stacked.card = {promotions: [
  {id: 'A', stack_with: ['B']},
  {id: 'B', stack_with: ['A', 'C']},
  {id: 'C', stack_with: ['B']}
], text: '云朵双人沙发'};
const stack = reflect(stacked);
assert.equal(stack.checks.some(item => item.name === '活动叠加' && item.ok === false), true);
assert.equal(stack.pending_review, true);

const prior = reflect({...state, candidate_ids: ['S03']});
assert.equal(prior.passed, false);
const again = reflect(state);
assert.equal(again.passed, true);

let called = 0;
const image = await executeImage({id: 'S01', name: '云朵双人沙发', color: '米白', material: '布艺', model: 'YD-180'}, {}, async () => { called += 1; });
assert.equal(image.called, false);
assert.equal(image.simulation, true);
assert.equal(called, 0);
assert.equal(imageRequest({name: '云朵', color: '米白', material: '布艺', model: 'YD'}).body.n, 1);
assert.equal(JSON.stringify(image.request).includes('IMAGE_API_KEY'), false);
console.log('ok memory reflection and image stay offline');
