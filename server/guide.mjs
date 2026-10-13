import catalog from '../data/catalog.json' with { type: 'json' };
import promotions from '../data/promotions.json' with { type: 'json' };

const LIGHT_COLORS = ['米白', '浅灰'];
const CATEGORIES = ['沙发', '餐桌', '休闲椅', '床架'];
const FORBIDDEN = ['终身保修', '免费送装', '环保', '舒适', '终身质保'];

export function createState() {
  return {
    revision: 0,
    constraints: {
      budget_max_cny: null,
      width_max_cm: null,
      category: null,
      color: null,
      exclude_material: null
    },
    candidate_ids: [],
    confirmed_product_id: null,
    confirmed_product_version: null,
    pending_question: null,
    card: null,
    copy_requirement: null
  };
}

export function productById(id) {
  return catalog.find(item => item.id === id) || null;
}

export function searchProducts(constraints) {
  return catalog.filter(item => matches(item, constraints)).map(item => item.id);
}

function matches(item, constraints) {
  if (constraints.budget_max_cny != null && item.price_cny > constraints.budget_max_cny) return false;
  if (constraints.width_max_cm != null && item.width_cm > constraints.width_max_cm) return false;
  if (constraints.category && item.category !== constraints.category) return false;
  if (constraints.color === '浅色' && !LIGHT_COLORS.includes(item.color)) return false;
  if (constraints.color && constraints.color !== '浅色' && item.color !== constraints.color) return false;
  if (constraints.exclude_material && item.material === constraints.exclude_material) return false;
  return true;
}

function splitParts(text) {
  return text.split(/[，,。；;]/).map(part => part.trim()).filter(Boolean);
}

function parseWidth(text) {
  if (/尺寸不限|宽度不限|不限尺寸|不限宽度/.test(text)) return {clear: true};
  let found = null;
  for (const part of splitParts(text)) {
    if (!/宽|厘米|米/.test(part)) continue;
    if (/一米八/.test(part)) found = {value: 180};
    else if (/一米六/.test(part)) found = {value: 160};
    else if (/一米五/.test(part)) found = {value: 150};
    else if (/两米|二米/.test(part)) found = {value: 200};
    else {
      const matched = part.match(/(\d+(?:\.\d+)?)\s*(厘米|cm|米)/i);
      if (!matched) continue;
      if (/不是/.test(part) && !/还是|上限/.test(part)) continue;
      const amount = Number(matched[1]);
      found = {value: matched[2] === '米' ? Math.round(amount * 100) : amount};
    }
  }
  return found;
}

function parseBudget(text) {
  let found = null;
  for (const part of splitParts(text)) {
    if (!/预算|元/.test(part) || /厘米/.test(part)) continue;
    const digits = part.match(/(\d+(?:\.\d+)?)/);
    if (digits) found = Number(digits[1]);
    else if (/三千/.test(part)) found = 3000;
    else if (/两千/.test(part)) found = 2000;
    else if (/一千/.test(part)) found = 1000;
    else if (/五百/.test(part)) found = 500;
  }
  return found;
}

function parseCategory(text) {
  let found = null;
  for (const part of splitParts(text)) {
    if (/床架|床/.test(part)) found = '床架';
    else if (/休闲椅|椅子/.test(part)) found = '休闲椅';
    else if (/餐桌/.test(part)) found = '餐桌';
    else if (/沙发/.test(part)) found = '沙发';
    else {
      for (const category of CATEGORIES) {
        if (part.includes(category)) found = category;
      }
    }
  }
  return found;
}

function parseColor(text) {
  if (/颜色不限|不限颜色|颜色也可以/.test(text)) return {clear: true};
  let found = null;
  for (const part of splitParts(text)) {
    if (/浅色/.test(part)) found = {value: '浅色'};
    else if (/米白/.test(part)) found = {value: '米白'};
    else if (/浅灰/.test(part)) found = {value: '浅灰'};
    else if (/深绿/.test(part)) found = {value: '深绿'};
    else if (/原木/.test(part)) found = {value: '原木色'};
  }
  return found;
}

function parseMaterial(text) {
  if (/皮质也可以|可以皮质|材质不限/.test(text)) return {clear: true};
  const excluded = ['皮质', '布艺', '橡木', '松木'].filter(item => new RegExp('不要' + item).test(text));
  if (excluded.length > 1) return {ambiguous: excluded};
  if (excluded.length === 1) return {value: excluded[0]};
  return null;
}

function parseCopy(text) {
  const asked = /文案|话术|简洁|语气|缩短|字数|终身保修|免费送装|环保|舒适/.test(text);
  const chars = text.match(/最多\s*(\d+)\s*字/);
  let tone = null;
  if (/热情/.test(text)) tone = '热情';
  else if (/简洁/.test(text)) tone = '简洁';
  const refused = FORBIDDEN.filter(item => text.includes(item));
  return {asked, maxChars: chars ? Number(chars[1]) : null, tone, refused};
}

function activePromotions(productId, today = '2026-10-06') {
  return promotions.filter(item =>
    item.products.includes(productId) &&
    item.store_id === 'demo' &&
    item.start <= today &&
    item.end >= today
  );
}

function factLine(product) {
  return `${product.name}，${product.color}${product.material}，宽${product.width_cm}厘米，标价${product.price_cny}元`;
}

function buildCard(product, requirement, refused) {
  let text = factLine(product);
  if (requirement?.tone) text += `。语气说明：${requirement.tone}`;
  text += '。演示回放，只使用虚构商品资料。';
  if (requirement?.maxChars && text.length > requirement.maxChars) {
    text = factLine(product);
    if (text.length > requirement.maxChars) text = text.slice(0, requirement.maxChars);
  }
  for (const claim of FORBIDDEN) text = text.split(claim).join('');
  const promos = activePromotions(product.id).map(item => ({
    id: item.id,
    discount_cny: item.discount_cny,
    stack_with: item.stack_with
  }));
  return {
    product_id: product.id,
    product_version: product.version,
    text,
    simulation: true,
    pending_human: true,
    refused_claims: refused,
    promotions: promos
  };
}

function constraintsChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function applyTurn(state, text, clientRevision) {
  if (clientRevision != null && clientRevision !== state.revision) {
    return {ok: false, error: 'revision_conflict', state, searched: false, composed: false};
  }
  const next = structuredClone(state);
  const before = structuredClone(next.constraints);
  const width = parseWidth(text);
  const budget = parseBudget(text);
  const category = parseCategory(text);
  const color = parseColor(text);
  const material = parseMaterial(text);
  const copy = parseCopy(text);
  const cheaper = /便宜点/.test(text) && budget == null;
  const smallHome = /小户型/.test(text) && !(width && width.value);
  const switchProduct = /换一款|重新选|换一个/.test(text);

  if (width?.clear) next.constraints.width_max_cm = null;
  else if (width?.value != null) next.constraints.width_max_cm = width.value;
  if (budget != null) next.constraints.budget_max_cny = budget;
  if (category) next.constraints.category = category;
  if (color?.clear) next.constraints.color = null;
  else if (color?.value) next.constraints.color = color.value;
  if (material?.clear) next.constraints.exclude_material = null;
  else if (material?.value) next.constraints.exclude_material = material.value;

  if (copy.maxChars || copy.tone) {
    next.copy_requirement = {
      max_chars: copy.maxChars || next.copy_requirement?.max_chars || null,
      tone: copy.tone || next.copy_requirement?.tone || null
    };
  }

  if (switchProduct) {
    next.confirmed_product_id = null;
    next.confirmed_product_version = null;
    next.card = null;
  }

  const changed = constraintsChanged(before, next.constraints) || switchProduct;
  let searched = false;
  let composed = false;
  next.pending_question = null;

  if (material?.ambiguous) {
    next.pending_question = '当前只能排除一种材质，请指定要排除的那一种。';
    next.candidate_ids = [];
    next.card = null;
    next.revision += 1;
    return {ok: true, status: 'ask', reply: next.pending_question, state: next, searched, composed};
  }

  if (cheaper) {
    const current = next.constraints.budget_max_cny;
    next.pending_question = current == null
      ? '请直接给出预算上限（元）。我不会把“便宜点”换成一个百分比。'
      : `请给出新的预算上限（元）。当前预算仍是 ${current} 元，我不会自行降低。`;
  } else if (smallHome) {
    next.pending_question = '请给出宽度上限（厘米）。“小户型”不能直接换成尺寸，我不会自行填写。';
    next.candidate_ids = [];
    next.card = null;
    next.confirmed_product_id = null;
  }

  const blocking = Boolean(next.pending_question);
  if (!blocking && (changed || next.candidate_ids.length === 0 && !next.confirmed_product_id)) {
    if (!(copy.asked && next.confirmed_product_id && !changed)) {
      next.candidate_ids = searchProducts(next.constraints);
      searched = true;
      if (changed) {
        next.confirmed_product_id = null;
        next.confirmed_product_version = null;
        next.card = null;
      }
    }
  }

  if (copy.asked && next.confirmed_product_id && !changed && !blocking) {
    const product = productById(next.confirmed_product_id);
    next.card = buildCard(product, next.copy_requirement, copy.refused);
    composed = true;
    next.revision += 1;
    const refusal = copy.refused.length ? `资料没有“${copy.refused.join('、')}”，这些不会写成确定事实。` : '';
    return {
      ok: true,
      status: 'draft_review',
      reply: refusal + '已按已确认商品生成演示文案，仍需你在页面上核对。',
      state: next,
      searched: false,
      composed
    };
  }

  if (copy.asked && !next.confirmed_product_id) {
    next.card = null;
    composed = false;
  }

  next.revision += 1;
  if (blocking) {
    return {ok: true, status: 'ask', reply: next.pending_question, state: next, searched, composed: false};
  }
  if (!next.candidate_ids.length) {
    next.pending_question = '没有同时满足这些条件的商品。请选择要调整的条件，我不会自行放宽。';
    return {ok: true, status: 'ask', reply: next.pending_question, state: next, searched, composed: false};
  }
  if (!next.confirmed_product_id) {
    const refreshed = changed && (state.candidate_ids.length || state.confirmed_product_id) ? '条件已更新，正在按新条件重新筛选。' : '';
    const extra = copy.asked ? '聊天里不能代替点选确认，确认前不会生成商品文案。' : '请点选要确认的商品。';
    return {ok: true, status: 'await_confirm', reply: refreshed + extra, state: next, searched, composed: false};
  }
  return {ok: true, status: 'await_confirm', reply: '商品仍以页面确认为准。', state: next, searched, composed: false};
}

export function confirmProduct(state, productId, clientRevision) {
  if (clientRevision != null && clientRevision !== state.revision) {
    return {ok: false, error: 'revision_conflict', state, searched: false, composed: false};
  }
  const next = structuredClone(state);
  if (!next.candidate_ids.includes(productId)) {
    return {ok: false, error: 'product_not_in_candidates', state: next, searched: false, composed: false};
  }
  const product = productById(productId);
  next.confirmed_product_id = product.id;
  next.confirmed_product_version = product.version;
  next.pending_question = null;
  next.card = buildCard(product, next.copy_requirement, []);
  next.revision += 1;
  return {
    ok: true,
    status: 'draft_review',
    reply: '已记录页面确认。下面是演示回放文案，尚未视为已采用。',
    state: next,
    searched: false,
    composed: true
  };
}

export function publicCatalog() {
  return catalog.map(item => ({...item, image: null, synthetic: true}));
}
