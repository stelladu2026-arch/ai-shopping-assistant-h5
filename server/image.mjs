/** Paid requests need BOTH operator opt-in and a per-operation reviewed plan.
 * Existing UI callers supply no authorization and therefore stay offline.
 */
export function imageStatus(env = process.env) {
  const base=String(env.IMAGE_API_BASE||'').trim();
  const model=String(env.IMAGE_MODEL||'').trim();
  const key=String(env.IMAGE_API_KEY||'').trim();
  let validBase=false;
  try { const u=new URL(base); validBase=u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash; } catch {}
  const keyConfigured=Boolean(key)&&!/[\s"'“”‘’`]/.test(key);
  const configured=Boolean(validBase&&model&&keyConfigured);
  const liveRequested=env.GUIDE_IMAGE_LIVE_ENABLED==='true';
  return {ready:configured&&liveRequested,configured,liveRequested,baseConfigured:validBase,model:model||null,keyConfigured};
}
export function imageRequest(product,env=process.env) {
  const status=imageStatus(env);
  return {method:'POST',url:(status.baseConfigured?env.IMAGE_API_BASE.trim().replace(/\/$/,''):'')+'/images/generations',
    body:{model:String(env.IMAGE_MODEL||'').trim(),prompt:`家具示意。保持资料中的名称、颜色和材质，不要改成另一种商品。${product.name}，${product.color}${product.material}，型号${product.model}。`,size:'1024x1024',n:1,response_format:'url'}};
}
export async function executeImage(product,env=process.env,fetcher=fetch,authorization=null) {
  const status=imageStatus(env),request=imageRequest(product,env);
  // Authorization is a server-created reviewed request, not a frontend boolean.
  const authorized=authorization?.confirmed===true && authorization?.productId===product.id &&
    authorization?.maxImages===1 && authorization?.requestJson===JSON.stringify(request.body);
  if(!status.ready||!authorized)return {simulation:true,called:false,requiresConfirmation:true,pending_human:true,label:'仅预览：生图确认与额度核验尚未接通，未调用付费接口',request};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
  try {
    const response=await fetcher(request.url,{method:'POST',redirect:'manual',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+String(env.IMAGE_API_KEY).trim()},body:JSON.stringify(request.body)});
    if(!response.ok)return {simulation:false,called:true,ok:false,error:'IMAGE_HTTP_'+response.status,pending_human:true,label:'生成失败，请核对用量；未自动重试',request};
    const data=await response.json();
    const urls=(data.data||[]).map(x=>x.url).filter(u=>typeof u==='string'&&/^https:\/\//.test(u));
    if(!urls.length)return {simulation:false,called:true,ok:false,error:'IMAGE_RESPONSE_INVALID',pending_human:true,label:'没有可用图片地址，请核对用量；未自动重试',request};
    return {simulation:false,called:true,ok:true,generatedImageUrl:urls[0],generatedImageUrls:[urls[0]],pending_human:true,label:'生成结果待核对',request};
  } catch {
    return {simulation:false,called:true,ok:false,network:true,error:'IMAGE_RESULT_UNKNOWN',pending_human:true,label:'结果与费用需核对，未自动重试',request};
  } finally {clearTimeout(timer);}
}
