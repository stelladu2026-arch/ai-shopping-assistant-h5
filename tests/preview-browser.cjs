const {spawn} = require('node:child_process');
const {mkdtempSync,writeFileSync,symlinkSync,rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createServer} = require('node:http');
const assert = require('node:assert/strict');
const projectRoot = path.resolve(__dirname,'..');
(async()=>{
 const cwd = mkdtempSync(path.join(tmpdir(),'guide-preview-'));
 for(const name of ['.next','node_modules','data']) symlinkSync(path.join(projectRoot,name),path.join(cwd,name),'dir');
 const imageModel = process.env.PREVIEW_IMAGE_MODEL || 'qwen-image-3.0';
 const wan = imageModel === 'wan2.6-image';
 let imageCalls = 0;
 const provider = createServer(async (req,res)=>{
  let raw='';for await(const chunk of req) raw+=chunk;
  try {
   if (req.method==='GET' && /^\/fixture-[1-4]\.png$/.test(req.url)) {
    res.writeHead(200,{'Content-Type':'image/png'});res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));return;
   }
   assert.equal(req.headers.authorization,'Bearer local-fixture-only');
   const imageUrls=Array.from({length:4},(_,i)=>`http://127.0.0.1:${provider.address().port}/fixture-${i+1}.png`);
   if (wan && req.method==='GET') {
    assert.equal(req.url,'/api/v1/tasks/wan-browser-fixture');
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{text:'四张商品图'},...imageUrls.map(image=>({image}))]}}]}}));return;
   }
   assert.equal(req.method,'POST');const body=JSON.parse(raw);assert.equal(body.model,imageModel);
   if (wan) {
    assert.equal(req.url,'/api/v1/services/aigc/image-generation/generation');
    assert.equal(req.headers['x-dashscope-async'],'enable');
    assert.equal(body.parameters.enable_interleave,true);assert.equal(body.parameters.max_images,4);assert.equal(body.parameters.n,1);
   } else {
    assert.equal(req.url,'/compatible-mode/v1/images/generations');assert.equal(body.n,4);assert.equal(body.size,'1024x1024');assert.equal(body.enable_thinking,false);
   }
   imageCalls++;res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify(wan ? {output:{task_id:'wan-browser-fixture',task_status:'PENDING'}} : {data:imageUrls.map(url=>({url}))}));
  }catch(error){res.writeHead(400);res.end(JSON.stringify({message:error.message}));}
 });
 await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
 writeFileSync(path.join(cwd,'.env'), `GUIDE_IMAGE_ENABLED=true\nIMAGE_API_BASE=http://127.0.0.1:${provider.address().port}${wan ? '/api/v1/services/aigc/image-generation/generation' : '/compatible-mode/v1'}\nIMAGE_MODEL=${imageModel}\nIMAGE_API_KEY=local-fixture-only\n`);
 const testEnv={...process.env,GUIDE_SQLITE_FILE:path.join(cwd,'test.sqlite'),GUIDE_AGENT_LIVE_MODEL:'false',GUIDE_RAG_REMOTE_CONFIRMED:'false',FEISHU_SYNC_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'};
 for(const key of ['GUIDE_IMAGE_ENABLED','IMAGE_API_BASE','IMAGE_MODEL','IMAGE_API_KEY','__NEXT_PROCESSED_ENV']) delete testEnv[key];
 const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3100'], {cwd,env:testEnv});
 let logs='';server.stdout.on('data',d=>{logs+=d;process.stdout.write(d)});server.stderr.on('data',d=>{logs+=d;process.stdout.write(d)});
 let browser;
 try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server startup timeout')),40000);const check=setInterval(()=>{if(logs.includes('Ready in')){clearInterval(check);clearTimeout(timer);resolve()}},200);});
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/api/'))console.log('API',r.status(),r.url());});
  await page.goto('http://127.0.0.1:3100/chat?sessionId=browser-clarification',{timeout:120000});
  const demandInput = page.getByPlaceholder('说说预算、宽度、颜色或材质');
  await demandInput.fill('预算3千多桌子');
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await page.getByText('你想找餐桌、书桌还是茶几？你说的“3千多”还不是明确上限，预算最高能接受多少元？',{exact:true}).first().waitFor();
  assert.equal(await page.getByText(/没有找到「多桌子」/).count(),0);
  await demandInput.fill('餐桌');
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await page.getByText('你说的“3千多”还不是明确上限，预算最高能接受多少元？',{exact:true}).first().waitFor();
  await demandInput.fill('3500');
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await page.getByRole('button',{name:'确认这件商品',exact:true}).first().waitFor();
  assert.equal(imageCalls,0,'clarification and recommendation must not call image provider');
  console.log('VAGUE BUDGET -> TABLE CLARIFICATION -> RECOMMENDATION OK');
  await page.goto('http://127.0.0.1:3100/chat?sessionId=browser-loading',{timeout:120000});
  await page.getByPlaceholder('说说预算、宽度、颜色或材质').fill('只看沙发，预算3千，不要皮质');
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await page.getByRole('button',{name:'确认这件商品',exact:true}).first().waitFor({timeout:90000});
  console.log('SEARCH',await page.getByRole('button',{name:'确认这件商品',exact:true}).count());
  await page.getByRole('button',{name:'确认这件商品',exact:true}).first().click();
  await page.getByRole('button',{name:'去生成素材',exact:true}).last().waitFor({timeout:60000});
  console.log('CONFIRM OK');
  await page.getByRole('button',{name:'去生成素材',exact:true}).last().click();
  await page.getByRole('button',{name:'生成文案',exact:true}).click();
  await page.getByRole('button',{name:'生成文案',exact:true}).last().click();
  await page.getByRole('button',{name:'一键复制',exact:true}).last().waitFor({timeout:60000});
  console.log('COPY OK');
  await page.getByRole('button',{name:'生成配图',exact:true}).first().click();
  await page.getByRole('button',{name:'生成配图',exact:true}).last().click();
  // Existing copy opens a fresh editor; generate from that editor.
  if (await page.locator('[data-copy-card="pending"]').count()) {
    await page.locator('[data-copy-card="pending"]').getByRole('button',{name:'生成配图',exact:true}).last().click();
  }
  await page.getByAltText('AI 生成配图',{exact:true}).last().waitFor({timeout:30000});
  await page.waitForFunction(()=>Array.from(document.images).some(img=>img.alt==='AI 生成配图' && img.complete && img.naturalWidth>0));
  assert.equal(imageCalls,1);
  assert.equal(await page.locator('[data-image-gallery] img').count(),4);
  await page.getByText('1. 使用场景全景',{exact:true}).last().waitFor();
  console.log('DOTENV -> IMAGE PROVIDER -> FOUR VISIBLE IMAGES OK (one generation task)');
  const diagnostics=await page.request.get('http://127.0.0.1:3100/api/diagnostics');
  const runtime=await diagnostics.json();assert.equal(runtime.runtimeVersion,'guide-wan26-four-images-20261020');
  assert.equal(runtime.protocol,wan ? 'multimodal-async' : 'compatible');
  assert.equal(JSON.stringify(runtime).includes('local-fixture-only'),false);
  console.log('ACTIVE RUNTIME DIAGNOSTICS OK');
  if(process.env.PREVIEW_GALLERY_SCREENSHOT) await page.locator('[data-image-gallery]').screenshot({path:process.env.PREVIEW_GALLERY_SCREENSHOT});
  await page.getByText('选品推荐',{exact:true}).click();
  // A failed confirmation must show feedback and release the global sending state.
  await page.getByPlaceholder('说说预算、宽度、颜色或材质').fill('预算改为2500');
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await page.getByRole('button',{name:'确认这件商品',exact:true}).first().waitFor({timeout:60000});
  await page.route('**/api/guide/act', async route=>{
    const body=route.request().postDataJSON();
    if(body?.action==='confirm') await route.abort('failed'); else await route.continue();
  });
  await page.getByRole('button',{name:'确认这件商品',exact:true}).first().click();
  await page.getByText('请求未完成，请检查本地服务和网络连接后再试。',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[aria-busy]')?.getAttribute('aria-busy')==='false');
  await page.unroute('**/api/guide/act');
  console.log('CONFIRM NETWORK ERROR RECOVERY OK');
  // A never-resolving chat request must end in the actual browser without a retry.
  await page.clock.install();
  let pendingCalls=0;
  await page.route('**/api/agent/chat', async route=>{ pendingCalls++; });
  await page.getByPlaceholder('说说预算、宽度、颜色或材质').fill('售后怎么办');
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-busy]')?.getAttribute('aria-busy')==='true');
  await page.clock.fastForward(61000);
  await page.getByText(/等待超过时限，已结束本次等待/).last().waitFor();
  await page.waitForFunction(()=>document.querySelector('[aria-busy]')?.getAttribute('aria-busy')==='false');
  if(pendingCalls!==1) throw Error('unexpected retry count '+pendingCalls);
  console.log('BROWSER TIMEOUT RECOVERY OK, requests='+pendingCalls);
  if(process.env.PREVIEW_SCREENSHOT) await page.screenshot({path:process.env.PREVIEW_SCREENSHOT,fullPage:true});
  console.log('PAGE ERRORS',JSON.stringify(errors)); if(errors.length) throw Error('unhandled page errors');
 }finally{if(browser)await browser.close();server.kill('SIGTERM');provider.close();rmSync(cwd,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
