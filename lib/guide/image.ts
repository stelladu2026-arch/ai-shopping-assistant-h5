// @ts-nocheck
import { executeImage as requestImage, imageRequest, imageStatus } from '../../server/image.mjs';
export { imageRequest, imageStatus };

export async function executeImage(product, env=process.env, fetcher=fetch, sessionId=null, authorization=null) {
  const request=imageRequest(product,env);
  const authorized=authorization?.confirmed===true && authorization?.productId===product.id &&
    authorization?.maxImages===1 && authorization?.requestJson===JSON.stringify(request.body);
  if (sessionId && imageStatus(env).ready && authorized) {
    const {consumeCall}=await import('./db');
    const {LIMITS,capText}=await import('./limits');
    const gate=consumeCall(sessionId,'image',LIMITS.image);
    if(!gate.ok)return {simulation:true,called:false,capped:true,pending_human:true,label:capText('image'),request};
  }
  return requestImage(product,env,fetcher,authorization);
}
