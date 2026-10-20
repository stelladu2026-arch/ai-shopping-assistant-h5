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
  for (const model of ['qwen3.7-plus','qwen-plus','qwen3-vl-plus','text-embedding-v4']) {
    let calls = 0;
    const wrong = await executeImage({name:'测试商品'}, {...base,IMAGE_MODEL:model}, async()=>{ calls++;throw Error('must not call'); });
    assert.equal(calls,0);
    assert.equal(wrong.called,false);
    assert.match(wrong.label,/不是图像生成模型/);
  }
  let mismatchCalls = 0;
  const mismatch = await executeImage({name:'测试商品'},base,async()=>{
    mismatchCalls++;
    return {ok:false,status:400,headers:new Headers({'x-request-id':'url-fixture-001'}),text:async()=>JSON.stringify({code:'InvalidParameter',message:'url error, please check url！ For details, see: https://www.alibabacloud.com/help'})};
  });
  assert.equal(mismatchCalls,1,'never retry a rejected generation through a second model or endpoint');
  assert.equal(mismatch.called,true);
  assert.equal(mismatch.requestId,'url-fixture-001');
  assert.match(mismatch.label,/模型与接口可能不匹配/);
  assert.match(mismatch.label,/qwen-image-3\.0/);
  assert.equal(JSON.stringify(mismatch).includes('fixture-only'),false);
  for (const address of [base.IMAGE_API_BASE, base.IMAGE_API_BASE+'/images/generations', 'https://dashscope.aliyuncs.com/api/v1', 'https://fixture.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation']) {
    let posts = 0, polls = 0;
    const wan = await executeImage({id:'S01',name:'测试商品',image:'/products/S01.png'}, {...base,IMAGE_MODEL:'wan2.6-image',IMAGE_API_BASE:address}, async (url,init)=>{
      const host = new URL(address).origin;
      if (init.method === 'POST') {
        posts++;
        assert.equal(String(url),host+'/api/v1/services/aigc/image-generation/generation');
        assert.equal(init.headers['X-DashScope-Async'],'enable');
        const body = JSON.parse(init.body);
        assert.equal(body.model,'wan2.6-image');
        assert.equal(body.prompt,undefined);
        assert.deepEqual(body.input.messages[0].content,[{text:'家具示意。保持资料中的名称、颜色和材质，不要改成另一种商品。测试商品，，型号。'}]);
        assert.equal(body.parameters.enable_interleave,true);
        assert.equal(body.parameters.max_images,1,'never use provider default of five images');
        assert.equal(body.parameters.n,1);
        assert.equal(body.parameters.size,'1024*1024');
        assert.equal(body.parameters.stream,undefined);
        return {ok:true,status:200,text:async()=>JSON.stringify({output:{task_id:'wan-task',task_status:'PENDING'}})};
      }
      polls++;
      assert.equal(String(url),host+'/api/v1/tasks/wan-task');
      return {ok:true,status:200,text:async()=>JSON.stringify({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{text:'已完成'},{image:'https://fixture.invalid/wan.png'}]}}]}})};
    });
    assert.equal(posts,1);assert.equal(polls,1);assert.equal(wan.url,'https://fixture.invalid/wan.png');
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
