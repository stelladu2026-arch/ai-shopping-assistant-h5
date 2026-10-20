import './register-ts.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
process.env.GUIDE_SQLITE_FILE=path.join(mkdtempSync(path.join(tmpdir(),'image-set-')),'guide.sqlite');
Object.assign(process.env,{GUIDE_AGENT_LIVE_MODEL:'false',GUIDE_RAG_REMOTE_CONFIRMED:'false',FEISHU_SYNC_ENABLED:'false'});
const {executeImage:nextImage}=await import('../lib/guide/image.ts');
const {executeImage:legacyImage}=await import('../server/image.mjs');
const {guideAct,guideMaterial}=await import('../lib/guide/session.ts');
const env={GUIDE_IMAGE_ENABLED:'true',IMAGE_API_BASE:'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',IMAGE_MODEL:'wan2.6-image',IMAGE_API_KEY:'fixture-only'};
const urls=[1,2,3,4].map(i=>`https://fixture.invalid/shot-${i}.png`);
for(const executeImage of [nextImage,legacyImage]) {
 for(const output of [urls,urls.slice(0,2)]) {
  let posts=0,gets=0;
  const result=await executeImage({name:'测试餐桌',material:'橡木'},env,async(url,init)=>{
   if(init.method==='POST') {
    posts++;const body=JSON.parse(init.body);
    assert.equal(body.parameters.n,1);assert.equal(body.parameters.max_images,4);assert.equal(body.parameters.enable_interleave,true);
    const prompt=body.input.messages[0].content[0].text;
    for(const name of ['使用场景全景','材质纹理细节','外观造型细节','结构视角细节']) assert(prompt.includes(name));
    return new Response(JSON.stringify({output:{task_id:'one-task',task_status:'PENDING'}}),{status:200});
   }
   gets++;
   return new Response(JSON.stringify({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{text:'已生成'},...output.map(image=>({image}))]}}]}}),{status:200});
  },null,{imageCount:4});
  assert.equal(posts,1);assert.equal(gets,1);assert.deepEqual(result.urls,output);assert.equal(result.url,output[0]);
  assert.equal(result.partial,output.length<4);
  if(output.length<4) assert.match(result.label,/2\/4张，未自动补图/);
 }
 const qwen=await executeImage({name:'测试商品'},{...env,IMAGE_MODEL:'qwen-image-3.0'},async(url,init)=>{
  assert.equal(JSON.parse(init.body).n,4);
  return new Response(JSON.stringify({data:urls.map(url=>({url}))}),{status:200});
 },null,{imageCount:4});
 assert.deepEqual(qwen.urls,urls);
}
Object.assign(process.env,env);
const oldFetch=globalThis.fetch;
let posts=0;
globalThis.fetch=async(url,init)=>{
 if(init.method==='POST') {posts++;assert.equal(JSON.parse(init.body).parameters.max_images,4);return new Response(JSON.stringify({output:{task_id:'content-task',task_status:'PENDING'}}),{status:200});}
 return new Response(JSON.stringify({output:{task_status:'SUCCEEDED',results:urls.map(url=>({url}))}}),{status:200});
};
try {
 const sessionId='four-images';
 await guideAct({action:'turn',sessionId,text:'餐桌，预算3500元'});
 await guideAct({action:'confirm',source:'catalog',sessionId,productId:'S01'});
 const result=await guideMaterial({outputKind:'image_only'},sessionId,{newPiece:true});
 assert.equal(posts,1);assert.equal(result.generatedImageUrl,result.generatedImageUrls[0]);
 assert.deepEqual(result.generatedImageUrls,urls);assert.equal(result.images.length,4);assert.equal(result.requestedImageCount,4);
 assert.equal(result.image_urls_text,'配图地址：'+urls.join(' '));
 const copy=await guideMaterial({outputKind:'copy_only'},sessionId,{newPiece:true});
 assert.deepEqual(copy.generatedImageUrls,[]);assert.equal(copy.image_urls_text,'');assert.equal(posts,1);
} finally {globalThis.fetch=oldFetch;}
console.log('ok four-image set: one task, four shot prompts, partial results, main URL, arrays, copy-only and no automatic refill');
