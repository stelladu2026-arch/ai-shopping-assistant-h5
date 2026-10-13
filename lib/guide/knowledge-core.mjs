import { shanghaiDate } from "./business-date.mjs";
/** Local evidence retrieval. No external requests or generated claims. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TOPICS = {
  warranty: ['保修', '质保', '售后', '维修'],
  delivery: ['送装', '送货', '配送', '运费', '安装', '包邮'],
  certification: ['环保', '甲醛', '认证', '检测'],
  care: ['拆洗', '机洗', '清洗', '清洁', '保养', '洗衣机'],
  returns: ['退换', '退货', '换货', '退款'],
  specs: ['尺寸', '宽度', '多宽', '材质', '颜色', '型号', '多少钱', '价格'],
  promotion: ['活动', '优惠', '叠加', '折扣'],
};
export function queryTopics(text) {
  return Object.entries(TOPICS).filter(([,words])=>words.some(w=>String(text).includes(w))).map(([key])=>key);
}
export function isKnowledgeQuery(text, context = null) {
  const q=String(text).trim();
  // Explicit shopping constraints remain in the existing product workflow.
  if (/推荐|筛选|选一|找一|预算|改成|改为|不要|不超过|最多.*厘米/.test(q)) return false;
  if (/写.*(?:文案|话术)|生成.*(?:文案|海报)|朋友圈/.test(q)) return false;
  return queryTopics(q).length>0 || Boolean(context && /^(?:那|那么|它|这款|这件|[A-Z]\d{2}).*(?:呢|吗|？|\?)$/.test(q));
}
const topicMatches=(text,topic)=>TOPICS[topic]?.some(w=>text.includes(w));
export function answerKnowledge(query, options = {}) {
  const root=options.root || process.cwd();
  const dir=path.join(root,'data','knowledge');
  const today=options.today || shanghaiDate();
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'data','catalog.json'),'utf8'));
  const metadataPath=path.join(dir,'index.json');
  const metadata=fs.existsSync(metadataPath)?JSON.parse(fs.readFileSync(metadataPath,'utf8')):[];
  const q=String(query).trim().slice(0,2000);
  const mentioned=catalog.filter(p=>q.includes(p.name)||q.toLowerCase().includes(p.model.toLowerCase())||new RegExp(`(?<![a-zA-Z0-9])${p.id}(?![a-zA-Z0-9])`,'i').test(q));
  const explicitIds=q.match(/\b[A-Z]\d{2}\b/gi)||[];
  const unknownId=explicitIds.some(id=>!catalog.some(p=>p.id.toLowerCase()===id.toLowerCase()));
  const prior=options.context || {};
  const refersBack=/那|它|这款|这件/.test(q);
  const productId=mentioned.length===1?mentioned[0].id:refersBack?(prior.productId||options.confirmedProductId):null;
  let topics=queryTopics(q);
  if(!topics.length && (mentioned.length||refersBack)) topics=prior.topics||[];
  const base={scene:'store_rag_query',policyTitle:'门店知识查询',priceHighlights:[],conditions:['演示资料，不代表真实门店承诺'],activityDeadline:'未标注业务有效期',relatedProducts:[],
    sources:[],synthetic:true,retrievalMode:'local_keywords_extract',checkedOn:today,context:{productId,topics}};
  const finish=(status,text,sources=[])=>({...base,answerStatus:status,suggestedScript:text,sources});
  if(unknownId || mentioned.length>1) return finish('needs_clarification','请指定一件资料中存在的商品型号；不会把其他商品的资料套用到这里。');
  if(!topics.length) return finish('not_found','没有找到能回答这个问题的资料，请补充具体型号和问题。');
  if(topics.includes('promotion')) return finish('not_found','活动金额与叠加规则需按当前商品和日期计算，请先确认商品并查看活动核验结果；不把旧资料中的活动当作当前承诺。');
  const needsProduct=topics.some(t=>['specs','care'].includes(t));
  if(needsProduct&&!productId) return finish('needs_clarification','请补充商品名称或型号，例如 S01；不同商品的参数和护理要求不能混用。');
  const scoped=metadata.filter(m=>m.storeId===(options.storeId||'demo') && (!m.productIds?.length || m.productIds.includes(productId)));
  const eligible=scoped.filter(m=>(!m.validFrom||m.validFrom<=today)&&(!m.validTo||m.validTo>=today) && ['demo','approved'].includes(m.reviewStatus));
  const hits=[];
  for(const entry of eligible){
    if(path.basename(entry.file)!==entry.file || !entry.file.endsWith('.md'))continue;
    const file=path.join(dir,entry.file);if(!fs.existsSync(file))continue;
    const raw=fs.readFileSync(file,'utf8');
    const title=(raw.match(/^#\s+(.+)$/m)||[])[1]||entry.file;
    const digest=createHash('sha256').update(raw).digest('hex');
    for(const [index,part] of raw.split(/\n\s*\n/).entries()){
      const excerpt=part.trim();if(!excerpt||excerpt.startsWith('#'))continue;
      const matched=topics.filter(t=>topicMatches(excerpt,t));
      if(!matched.length)continue;
      hits.push({id:`${entry.file}:${digest.slice(0,16)}:${index}`,title,source:entry.file,section:`段落 ${index+1}`,excerpt,
        version:entry.version||digest.slice(0,12),contentHash:digest,validFrom:entry.validFrom||null,validTo:entry.validTo||null,
        productIds:entry.productIds||[],storeId:entry.storeId,synthetic:entry.reviewStatus==='demo',matchedTopics:matched,claimKey:entry.claimKey||entry.file});
    }
  }
  const grouped=new Map();
  for(const h of hits){const docs=grouped.get(h.claimKey)||new Map();docs.set(h.source,h.contentHash);grouped.set(h.claimKey,docs);}
  if([...grouped.values()].some(d=>new Set(d.values()).size>1))return finish('conflict','检索到了同一规则的不同有效版本，请先由资料负责人核对，暂不提供确定回答。');
  if(!hits.length)return finish('not_found','没有检索到适用且能直接支持回答的资料。请向门店核实，不据此承诺拆洗方式、送装或保修年限。');
  hits.sort((a,b)=>b.matchedTopics.length-a.matchedTopics.length || Number(Boolean(b.productIds.length))-Number(Boolean(a.productIds.length)) || a.source.localeCompare(b.source));
  const sources=hits.slice(0,5);
  const missing=topics.filter(t=>!sources.some(h=>h.matchedTopics.includes(t)));
  const answer=sources.map((h,i)=>`${h.excerpt} [${i+1}]`).join('\n\n')+(missing.length?'\n\n部分问题仍没有直接依据，请补充门店正式资料后核实。':'');
  return {...finish(missing.length?'partial':'found',answer,sources),synthetic:sources.some(s=>s.synthetic),
    policyTitle:productId?`${catalog.find(p=>p.id===productId).name} · 资料核对`:'门店服务资料核对'};
}
