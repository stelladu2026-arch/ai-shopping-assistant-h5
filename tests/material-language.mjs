import assert from 'node:assert/strict';
import {absorbDemand, createState, resolveConstraintSearch} from '../lib/guide/engine.ts';
import {materialMatches, parseMaterialDemand} from '../lib/guide/materials.ts';
const run = (text, interpretation=null) => absorbDemand(createState(),text,0,interpretation);
for (const term of ['木质','木头','木制','木材']) {
 for (const interpretation of [null,{clauses:[{attribute:'material',value:term,polarity:'exclude',span:`不要${term}`}],unresolved:[]}]) {
  const result=run(`浅色沙发，预算3000元，宽度不超过3米，不要${term}`, interpretation);
  assert.equal(result.state.pending_question,null);
  assert.equal(result.state.constraints.exclude_material,'木质');
  assert.equal(result.state.constraints.width_max_cm,300);
  assert.deepEqual(resolveConstraintSearch(result.state.constraints,result.state.constraint_roles).officialIds,['S01','S02']);
 }
}
for (const term of ['皮革','皮料','皮面']) assert.equal(run(`沙发，不要${term}`).state.constraints.exclude_material,'皮质');
assert.equal(parseMaterialDemand('不要木质和皮质').ambiguous.length,2);
assert.equal(parseMaterialDemand('取消排除木质').clear,true);
assert.equal(parseMaterialDemand('原木色沙发'),null);
assert.equal(materialMatches('板材','木质'),true);
assert.equal(materialMatches('板材','实木'),false);
for (const term of ['橡木','松木','胡桃木']) assert.equal(materialMatches(term,'实木'),true);
for (const term of ['金属','藤编','星空紫']) {
 const result=run(`沙发，预算3000元，不要${term}`);
 assert.match(result.state.pending_question,/尚未识别条件/);
 assert.doesNotMatch(result.state.pending_question,/没有找到/);
 assert.equal(result.needsResearch,false);
}
const unresolved=run('浅色沙发，预算3000元，不要木质',{clauses:[{attribute:'color',value:'浅色',polarity:'include',span:'浅色'}],unresolved:['木质']});
assert.equal(unresolved.state.pending_question,null);
assert.equal(run('实木餐桌').state.constraints.material,'实木');
assert.equal(run('不要木质脚架的沙发').needsResearch,false);
console.log('ok material language');
