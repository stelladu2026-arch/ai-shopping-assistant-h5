import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {answerKnowledge,isKnowledgeQuery} from '../lib/guide/knowledge-core.mjs';
import {shanghaiDate} from '../lib/guide/business-date.mjs';
import {executeImage,imageRequest} from '../server/image.mjs';
import {buildPromoPlan} from '../lib/guide/promos';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'guide-integration-'));
process.env.GUIDE_DB_PATH=path.join(temp,'guide.sqlite');
process.env.GUIDE_AGENT_LIVE_MODEL='false';
process.env.GUIDE_IMAGE_LIVE_ENABLED='false';
const {guideAct,guideMaterial}=await import('../lib/guide/session');
const {POST}=await import('../app/api/agent/chat/route');
test.after(()=>{(globalThis as any).__guideSqlite?.close();delete (globalThis as any).__guideSqlite;fs.rmSync(temp,{recursive:true,force:true});});

test('knowledge route is separate from shopping and copy',()=>{
 assert.equal(isKnowledgeQuery('这款保修多久？'),true);
 assert.equal(isKnowledgeQuery('S01多少钱？'),true);
 assert.equal(isKnowledgeQuery('浅色沙发，预算3000元'),false);
 assert.equal(isKnowledgeQuery('帮我写免费送装的文案'),false);
});
test('natural question gets verbatim source and no invented warranty',()=>{
 const r=answerKnowledge('S01保修几年？');
 assert.equal(r.answerStatus,'found');assert.ok(r.sources.length);
 for(const [i,s] of r.sources.entries()){
  assert.ok(fs.readFileSync(path.join('data/knowledge',s.source),'utf8').includes(s.excerpt));
  assert.ok(r.suggestedScript.includes(`${s.excerpt} [${i+1}]`));
 }
 assert.equal(r.synthetic,true);
});
test('unknown facts and unknown SKU do not borrow another product',()=>{
 assert.equal(answerKnowledge('S02能机洗吗？').answerStatus,'not_found');
 assert.equal(answerKnowledge('S99保修几年？').answerStatus,'needs_clarification');
 assert.equal(answerKnowledge('尺寸多宽？').answerStatus,'needs_clarification');
});
test('product-specific follow-up stays scoped',()=>{
 const first=answerKnowledge('S01的材质是什么？');
 const next=answerKnowledge('那S02呢？',{context:first.context});
 assert.equal(next.context.productId,'S02');
 const follow=answerKnowledge('那它的材质呢？',{context:next.context,confirmedProductId:'S01'});
 assert.equal(follow.context.productId,'S02');
 assert.ok(next.sources.filter(s=>s.productIds.length).every(s=>s.productIds.includes('S02')));
});
test('expired, other-store and conflicting policy passages cannot answer',()=>{
 const root=path.join(temp,'fixture');fs.mkdirSync(path.join(root,'data/knowledge'),{recursive:true});
 fs.copyFileSync('data/catalog.json',path.join(root,'data/catalog.json'));
 const dir=path.join(root,'data/knowledge');
 fs.writeFileSync(path.join(dir,'one.md'),'# 保修说明\n\n测试保修规则一。');
 fs.writeFileSync(path.join(dir,'two.md'),'# 保修说明\n\n测试保修规则二。');
 const entry={file:'one.md',storeId:'demo',productIds:[],reviewStatus:'demo',claimKey:'warranty',validFrom:'2026-01-01',validTo:'2026-01-02'};
 const write=(rows:any[])=>fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify(rows));
 write([entry]);assert.equal(answerKnowledge('保修规则',{root,today:'2026-10-13'}).answerStatus,'not_found');
 write([{...entry,validTo:null,storeId:'other'}]);assert.equal(answerKnowledge('保修规则',{root}).answerStatus,'not_found');
 write([{...entry,validTo:null},{...entry,file:'two.md',validTo:null}]);assert.equal(answerKnowledge('保修规则',{root}).answerStatus,'conflict');
});
test('actual H5 chat endpoint returns knowledge block without product search',async()=>{
 const r=await POST(new Request('http://localhost/api/agent/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'knowledge-http',scene:'store_rag_query',text:'S01保修多久？'})}));
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.structured.scene,'store_rag_query');assert.ok(body.structured.sources.length);
 const after=await guideAct({action:'status',sessionId:'knowledge-http'});
 assert.equal(after.steps.product_decision,null);assert.deepEqual(after.steps.route.output.entered,['route','knowledge']);
 assert.equal(after.structured.confirmedId,null);
});
test('knowledge turn preserves confirmed product and permits later content',async()=>{
 const sid='flow';
 const search=await guideAct({action:'turn',sessionId:sid,text:'浅色沙发，预算3000元，宽度不超过180厘米，不要皮质'});
 const confirmed=await guideAct({action:'confirm',sessionId:sid,productId:'S01',revision:search.structured.revision});
 assert.equal(confirmed.structured.confirmedId,'S01');
 const answer=await guideAct({action:'turn',sessionId:sid,text:'这款保修多久？',revision:confirmed.structured.revision});
 assert.equal(answer.structured.scene,'store_rag_query');
 const after=await guideAct({action:'status',sessionId:sid});assert.equal(after.structured.confirmedId,'S01');
 assert.deepEqual(after.structured.constraints,confirmed.structured.constraints);
 const material=await guideMaterial({outputKind:'copy_only'},sid);assert.equal(material.usedProductId,'S01');
 const other=await guideAct({action:'turn',sessionId:'fresh',text:'这款尺寸多宽？'});
 assert.equal(other.structured.answerStatus,'needs_clarification');
 const stale=await guideAct({action:'turn',sessionId:sid,text:'这款保修多久？',revision:confirmed.structured.revision});
 assert.equal(stale.error,'revision_conflict');
});
test('credentials alone and operator flag do not spend image quota',async()=>{
 const env={IMAGE_API_BASE:'https://image.invalid/v1',IMAGE_MODEL:'fixture',IMAGE_API_KEY:'fixture-key',GUIDE_IMAGE_LIVE_ENABLED:'true'};
 let calls=0;const noCall=async()=>{calls++;throw new Error('must not call');};
 const r=await executeImage({id:'S01',name:'fixture'},env,noCall);
 assert.equal(r.called,false);assert.equal(r.requiresConfirmation,true);assert.equal(calls,0);
 const product={id:'S01',name:'fixture'};
 const request=imageRequest(product,env);
 const authorized={confirmed:true,productId:'S01',maxImages:1,requestJson:JSON.stringify(request.body)};
 const response=await executeImage(product,env,async()=>{calls++;return new Response(JSON.stringify({data:[{url:'https://image.invalid/one.png'}]}));},authorized);
 assert.equal(response.generatedImageUrl,'https://image.invalid/one.png');assert.equal(calls,1);
 const unknown=await executeImage(product,env,async()=>{calls++;throw new Error('network');},authorized);
 assert.equal(unknown.error,'IMAGE_RESULT_UNKNOWN');assert.equal(calls,2);
});
test('business date observes Shanghai midnight and excludes expired promotions',()=>{
 assert.equal(shanghaiDate(new Date('2026-10-12T16:00:00Z')),'2026-10-13');
 assert.equal(buildPromoPlan('S01','2099-01-01').use.length,0);
});


test('listing many products does not exhaust evidence before confirmation',async()=>{
 const sid='all-products';
 const picked=await guideAct({action:'turn',sessionId:sid,text:'只看沙发'});
 assert.ok(picked.structured.candidateIds.length>3);
 const selected=await guideAct({action:'confirm',sessionId:sid,productId:picked.structured.candidateIds.at(-1),revision:picked.structured.revision});
 assert.ok(selected.steps.product_decision.output.confirmedFacts.sourceExcerpt);
});

test('image-only H5 response cannot claim an image was generated',async()=>{
 const sid='image-endpoint';
 await guideAct({action:'confirm',sessionId:sid,source:'catalog',productId:'S01',revision:0});
 const r=await POST(new Request('http://localhost/api/agent/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid,scene:'moments_marketing',momentsInput:{outputKind:'image_only'}})}));
 const body=await r.json();assert.equal(body.structured.generatedImageUrl,'');assert.match(body.leadText,/未调用/);
});
