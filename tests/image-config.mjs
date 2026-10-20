import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { imageStatus as status, executeImage as nextImage } from '../lib/guide/image.ts';
import { executeImage as legacyImage } from '../server/image.mjs';
const root = mkdtempSync(path.join(tmpdir(), 'image-env-'));
try {
  writeFileSync(path.join(root,'.env'), 'GUIDE_IMAGE_ENABLED=true\nIMAGE_MODEL=qwen-image-3.0\nIMAGE_API_KEY="fixture-only" # comment\n');
  writeFileSync(path.join(root,'.env.local'), 'GUIDE_IMAGE_ENABLED=false\n');
  const env = {...process.env};
  for (const name of ['GUIDE_IMAGE_ENABLED','IMAGE_MODEL','IMAGE_API_KEY','__NEXT_PROCESSED_ENV','NODE_ENV']) delete env[name];
  const code = `import {loadProjectEnv} from ${JSON.stringify(new URL('../server/env.mjs',import.meta.url).href)}; const {loadedEnvFiles}=loadProjectEnv(${JSON.stringify(root)},true); console.log(JSON.stringify({enabled:process.env.GUIDE_IMAGE_ENABLED,model:process.env.IMAGE_MODEL,key:process.env.IMAGE_API_KEY,files:loadedEnvFiles.map(f=>f.path)}));`;
  const child = spawnSync(process.execPath, ['--input-type=module','-e',code], {encoding:'utf8',env});
  assert.equal(child.status,0,child.stderr);
  const read = JSON.parse(child.stdout.trim());
  assert.equal(read.enabled,'false');
  assert.equal(read.model,'qwen-image-3.0');
  assert.equal(read.key,'fixture-only');
  assert.deepEqual(read.files,['.env.local','.env']);
} finally { rmSync(root,{recursive:true,force:true}); }
const base = { GUIDE_IMAGE_ENABLED:'true', IMAGE_API_BASE:'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', IMAGE_MODEL:'qwen-image-3.0', DASHSCOPE_API_KEY:'fixture-only' };
assert.equal(status(base).ready,true);
assert.equal(status(base).keySource,'DASHSCOPE_API_KEY');
assert.equal(status({...base,IMAGE_API_BASE:'https://other.invalid/v1'}).ready,false,'never send shared provider credentials to a third-party host');
assert.equal(status({...base,IMAGE_API_BASE:'not-an-address'}).ready,false);
assert.equal(status({...base,IMAGE_MODEL:'qwen-image-3.0/qwen-image-3.0-pro'}).ready,false);
for (const executeImage of [nextImage,legacyImage]) {
  for (const model of ['qwen-image-3.0','qwen-image-3.0-pro']) {
    let count=0;
    const image=await executeImage({name:'测试商品'}, {...base,IMAGE_MODEL:model}, async (url,init)=>{
      count++; assert.equal(String(url),base.IMAGE_API_BASE+'/images/generations');
      const body=JSON.parse(init.body);
      assert.equal(body.n,1);assert.equal(body.size,'1024x1024');assert.equal(body.enable_thinking,false);
      assert.equal(init.headers.Authorization,'Bearer fixture-only');
      return {ok:true,status:200,text:async()=>JSON.stringify({data:[{url:'https://fixture.invalid/test.png'}]})};
    });
    assert.equal(count,1);assert.equal(image.ok,true);
  }
  const rejected=await executeImage({name:'测试商品'},base,async()=>({ok:false,status:403,headers:new Headers({'x-request-id':'fixture-request-001'}),text:async()=>JSON.stringify({code:'AccessDenied',message:'fixture-only permission denied'})}));
  assert.equal(rejected.requestId,'fixture-request-001');
  assert.equal(rejected.code,'AccessDenied');
  assert.equal(JSON.stringify(rejected).includes('fixture-only'),false);
  let posts=0,gets=0;
  const native=await executeImage({name:'测试商品'}, {...base,IMAGE_API_BASE:'https://fixture.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/image-generation/generation'},async(url,init)=>{
    if(init.method==='POST') { posts++;assert.equal(init.headers['X-DashScope-Async'],'enable');assert.equal(JSON.parse(init.body).input.messages.length,1);return {ok:true,status:200,text:async()=>JSON.stringify({output:{task_id:'task-fixture',task_status:'PENDING'}})}; }
    gets++;return {ok:true,status:200,text:async()=>JSON.stringify({output:{task_status:'SUCCEEDED',results:[{url:'https://fixture.invalid/test.png'}]}})};
  });
  assert.equal(native.ok,true);assert.equal(posts,1);assert.equal(gets,1);
}
console.log('ok image config: dotenv priority, key isolation, Qwen 3.0/pro, async protocol and redacted error IDs');
