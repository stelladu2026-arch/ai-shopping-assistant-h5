// @ts-nocheck
import { answerKnowledge } from './knowledge-core.mjs';
import { consumeCall, saveStep } from './db';
import { LIMITS, capText } from './limits';

export function runKnowledgeNode(session, request) {
  const gate=consumeCall(session.id, 'knowledge', LIMITS.retrieve);
  if(!gate.ok) return {ok:true,capped:true,reply:capText('retrieve')};
  const output=answerKnowledge(request.text, {
    confirmedProductId:session.record.state.confirmed_product_id,
    context:session.record.knowledgeContext,
    storeId:'demo',
  });
  session.record.knowledgeContext=output.context;
  session.record.knowledgeAnswer=output;
  saveStep(session.id,'knowledge',{status:'completed',input:{query:request.text},output,error:null});
  return {ok:true,output,reply:'已按本地演示资料核对，展开出处可查看原文。'};
}
