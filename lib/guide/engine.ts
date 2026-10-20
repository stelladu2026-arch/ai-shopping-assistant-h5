// @ts-nocheck
import catalog from "../../data/catalog.json";
import promotions from "../../data/promotions.json";
import { clausePatch } from "./clauses";
import { buildPromoPlan } from "./promos";
import { FAILURE_TEXT } from "./limits";
import { EXTRA_CATEGORY_PHRASES, tableCategoryAlias, resolveDemandLanguage, demandQuestion } from "../../server/demand-language.mjs";

const LIGHT_COLORS = ['米白', '浅灰'];
const CATEGORY_PHRASES = [...EXTRA_CATEGORY_PHRASES, "床头柜", "电视柜", "斗柜", "衣柜", "书柜", "鞋柜", "橱柜", "餐边柜", "柜子", "休闲椅", "床架", "椅子", "餐桌", "沙发", "床", "柜"];
const FORBIDDEN = ['终身保修', '免费送装', '环保', '舒适', '终身质保'];

const STYLES = ["北欧", "日式", "现代", "轻奢", "简约", "自然", "复古", "中式"];
const PROBE_FIELDS = ["color", "style"];

export function defaultRoles() {
  return {
    budget_max_cny: "hard",
    width_max_cm: "hard",
    category: "hard",
    color: "hard",
    exclude_material: "hard",
    style: "prefer",
    material: "hard",
    budget_max_cny_locked: true,
    width_max_cm_locked: true,
    category_locked: true,
    exclude_material_locked: true,
    color_locked: false,
    style_locked: false,
    material_locked: false,
  };
}

export function createState() {
  return {
    revision: 0,
    demand_clarification: { budget: null, category: null },
    constraints: {
      budget_max_cny: null,
      width_max_cm: null,
      category: null,
      color: null,
      exclude_material: null,
      style: null,
    },
    constraint_roles: defaultRoles(),
    probe: null,
    candidate_ids: [],
    confirmed_product_id: null,
    confirmed_product_version: null,
    pending_question: null,
    card: null,
    copy_requirement: null,
  };
}

export function productById(id) {
  return catalog.find(item => item.id === id) || null;
}

// 排序稳定、不随机。先筛出全部符合约束的商品，再重排：
// 1. 颜色、材质、风格命中更多的靠前（只给已经写出的条件计分，没写的不计）
// 2. 宽度更接近上限但不超过（差距更小靠前；没给宽度则这一项相同）
// 3. 价格更接近预算但不超过（差距更小靠前；没给预算则这一项相同）
// 4. 相同则价格从低到高
// 5. 再按型号
export const RANK_RULE = "先筛出全部符合的商品，再排序：尺寸更接近上限但不超过、价格更接近预算但不超过、颜色材质风格命中更多的靠前；相同则价格从低到高，再按型号。不随机。滑动区只放前 5 个。";

function fitHits(item, constraints) {
  let hits = 0;
  if (constraints.color === "浅色" && LIGHT_COLORS.includes(item.color)) hits += 1;
  else if (constraints.color && constraints.color !== "浅色" && item.color === constraints.color) hits += 1;
  if (constraints.exclude_material && item.material !== constraints.exclude_material) hits += 1;
  if (constraints.style && item.style === constraints.style) hits += 1;
  if (constraints.material && item.material === constraints.material) hits += 1;
  return hits;
}

function compareFit(left, right, constraints) {
  const hits = fitHits(right, constraints) - fitHits(left, constraints);
  if (hits) return hits;
  if (constraints.width_max_cm != null) {
    const widthGap = (constraints.width_max_cm - left.width_cm) - (constraints.width_max_cm - right.width_cm);
    if (widthGap) return widthGap;
  }
  if (constraints.budget_max_cny != null) {
    const priceGap = (constraints.budget_max_cny - left.price_cny) - (constraints.budget_max_cny - right.price_cny);
    if (priceGap) return priceGap;
  }
  if (left.price_cny !== right.price_cny) return left.price_cny - right.price_cny;
  return String(left.model).localeCompare(String(right.model), "zh");
}

function mergedRoles(roles) {
  return { ...defaultRoles(), ...(roles || {}) };
}

function isHard(roles, field) {
  return mergedRoles(roles)[field] !== "prefer";
}

export function searchProducts(constraints, roles) {
  return catalog.filter(item => matches(item, constraints, roles)).sort((left, right) => compareFit(left, right, constraints)).map(item => item.id);
}

function matches(item, constraints, roles) {
  if (isHard(roles, "budget_max_cny") && constraints.budget_max_cny != null && item.price_cny > constraints.budget_max_cny) return false;
  if (isHard(roles, "width_max_cm") && constraints.width_max_cm != null && item.width_cm > constraints.width_max_cm) return false;
  if (isHard(roles, "category") && constraints.category && !categoryFits(item, constraints.category)) return false;
  if (isHard(roles, "color") && constraints.color === "浅色" && !LIGHT_COLORS.includes(item.color)) return false;
  if (isHard(roles, "color") && constraints.color && constraints.color !== "浅色" && item.color !== constraints.color) return false;
  if (isHard(roles, "exclude_material") && constraints.exclude_material && item.material === constraints.exclude_material) return false;
  if (isHard(roles, "material") && constraints.material && item.material !== constraints.material) return false;
  if (isHard(roles, "style") && constraints.style && item.style !== constraints.style) return false;
  return true;
}

function tagText(field, value) {
  if (field === "budget_max_cny") return `预算 ${value}元`;
  if (field === "width_max_cm") return `宽度 ${value}厘米`;
  if (field === "category") return `品类 ${value}`;
  if (field === "color") return `颜色 ${value}`;
  if (field === "exclude_material") return `不要 ${value}`;
  if (field === "material") return `材质 ${value}`;
  if (field === "style") return `风格 ${value}`;
  return String(value);
}

function preferenceMark(text) {
  if (/必须|一定要|只能|只要/.test(text)) return { strength: "hard", locked: true };
  if (/最好|优先|尽量|喜欢|偏好|可以的话/.test(text)) return { strength: "prefer", locked: false };
  return { strength: "hard", locked: false };
}

function relaxableFields(constraints, roles) {
  const current = mergedRoles(roles);
  return PROBE_FIELDS.filter((field) => constraints?.[field] && current[field] !== "prefer" && !current[`${field}_locked`]);
}

// 正式查询为空时，看有没有可以放宽的颜色或风格。只有一项放宽后能查到商品，就标成可放宽并查出结果。
// 两项分别放宽都能查到商品，才停下来让导购点一项。预算、宽度、品类、不要的材质，以及说了“必须”的条件，不自动放宽。
export function resolveConstraintSearch(constraints, roles) {
  const current = mergedRoles(roles);
  const officialIds = searchProducts(constraints, current);
  if (officialIds.length) return { officialIds, roles: current, probe: null, applied: null };
  const fields = relaxableFields(constraints, current);
  if (!fields.length) return { officialIds: [], roles: current, probe: null, applied: null };
  const hits = fields.map((field) => ({
    field,
    label: tagText(field, constraints[field]),
    ids: searchProducts(constraints, { ...current, [field]: "prefer" }),
  })).filter((item) => item.ids.length);
  if (hits.length === 1) {
    const hit = hits[0];
    return {
      officialIds: hit.ids,
      roles: { ...current, [hit.field]: "prefer", [`${hit.field}_locked`]: false },
      probe: null,
      applied: { field: hit.field, label: hit.label },
    };
  }
  if (hits.length > 1) {
    return {
      officialIds: [],
      roles: current,
      applied: null,
      probe: { needsConfirm: true, options: hits, label: hits.map((item) => item.label).join("、"), ids: [] },
    };
  }
  const tried = fields[0];
  return {
    officialIds: [],
    roles: current,
    applied: null,
    probe: { needsConfirm: false, field: tried, label: tagText(tried, constraints[tried]), ids: [], options: [] },
  };
}

export function probeLead(probe) {
  if (!probe) return "";
  if (probe.needsConfirm) {
    const choices = (probe.options || []).map((item) => item.label).join("、");
    return `需要确认。${choices} 分别放宽都会查到商品，请点一项继续。预算、宽度、品类和不要的材质先不动。`;
  }
  return `无结果。只放宽了「${probe.label}」，仍然没有符合的商品。预算、宽度、品类和不要的材质没有改。我不会自行放宽。`;
}

export function appliedLead(applied) {
  if (!applied?.label) return "";
  return `已把「${applied.label}」标成可放宽，并按这个直接筛选。请点选要确认的商品。`;
}

export function constraintTags(state) {
  const constraints = state?.constraints || {};
  const roles = mergedRoles(state?.constraint_roles);
  return ["budget_max_cny", "width_max_cm", "category", "color", "exclude_material", "material", "style"]
    .filter((field) => constraints[field] != null && constraints[field] !== "")
    .map((field) => ({
      field,
      value: constraints[field],
      label: tagText(field, constraints[field]),
      strength: roles[field] === "prefer" ? "prefer" : "hard",
      locked: Boolean(roles[`${field}_locked`]),
    }));
}

function rememberRoles(next, text, parsed, fieldMarks) {
  const roles = mergedRoles(next.constraint_roles);
  if (parsed.budget != null) {
    roles.budget_max_cny = "hard";
    roles.budget_max_cny_locked = true;
  }
  if (parsed.width?.value != null) {
    roles.width_max_cm = "hard";
    roles.width_max_cm_locked = true;
  }
  if (parsed.category) {
    roles.category = "hard";
    roles.category_locked = true;
  }
  if (parsed.material?.value) {
    roles.exclude_material = "hard";
    roles.exclude_material_locked = true;
  }
  if (parsed.color?.value) {
    const marked = fieldMarks?.color || preferenceMark(text);
    roles.color = marked.strength;
    roles.color_locked = marked.locked;
  }
  if (parsed.style) {
    const marked = fieldMarks?.style || preferenceMark(text);
    roles.style = marked.strength;
    roles.style_locked = marked.locked;
  }
  if (parsed.material?.include) {
    const marked = fieldMarks?.material || { strength: "hard", locked: false };
    roles.material = marked.strength;
    roles.material_locked = marked.locked;
  }
  next.constraint_roles = roles;
}

function clearConfirmed(next) {
  next.confirmed_product_id = null;
  next.confirmed_product_version = null;
  next.card = null;
}

const CONSTRAINT_FIELDS = ["budget_max_cny", "width_max_cm", "category", "color", "exclude_material", "material", "style"];

function writeConstraint(next, roles, change, strict) {
  const field = change?.field;
  if (!CONSTRAINT_FIELDS.includes(field)) return "unknown_constraint";
  if (change.clear) next.constraints[field] = null;
  else if (change.value != null && String(change.value).trim() !== "") {
    if (field === "budget_max_cny" || field === "width_max_cm") {
      const amount = field === "width_max_cm" ? readWidth(change.value) : readAmount(change.value);
      if (amount == null || !Number.isFinite(amount)) return "bad_constraint_value";
      if (field === "budget_max_cny" && resolveDemandLanguage(null, `预算${change.value}`, { budget: amount, category: null }, readAmount).clarification.budget) return "bad_constraint_value";
      next.constraints[field] = amount;
    } else next.constraints[field] = String(change.value).trim();
  } else if (strict) return "bad_constraint_value";
  if (change.strength === "hard" || change.strength === "prefer") {
    roles[field] = change.strength;
    roles[`${field}_locked`] = change.strength === "hard";
  }
  return "";
}

export function editConstraint(state, patch, clientRevision) {
  if (clientRevision != null && clientRevision !== state.revision) {
    return { ok: false, error: "revision_conflict", state, needsResearch: false };
  }
  const batched = Array.isArray(patch?.changes);
  const changes = batched ? patch.changes : [patch];
  if (batched && !changes.length) return { ok: false, error: "bad_constraint_value", state, needsResearch: false };
  const next = structuredClone(state);
  const roles = mergedRoles(next.constraint_roles);
  for (const change of changes) {
    const error = writeConstraint(next, roles, change, batched);
    if (error) return { ok: false, error, state, needsResearch: false };
    if (next.demand_clarification && (change.clear || change.value != null)) {
      if (change.field === 'budget_max_cny') next.demand_clarification.budget = null;
      if (change.field === 'category') next.demand_clarification.category = null;
    }
  }
  next.constraint_roles = roles;
  next.probe = null;
  next.pending_question = demandQuestion(next.demand_clarification) || null;
  clearConfirmed(next);
  next.revision += 1;
  return { ok: true, state: next, needsResearch: !next.pending_question };
}

export function acceptProbe(state, clientRevision, field) {
  if (clientRevision != null && clientRevision !== state.revision) {
    return { ok: false, error: "revision_conflict", state, needsResearch: false };
  }
  const options = state?.probe?.options || [];
  const chosen = options.find((item) => item.field === field) || (options.length === 1 ? options[0] : null);
  if (!state?.probe?.needsConfirm || !chosen) return { ok: false, error: "no_probe", state, needsResearch: false };
  const next = structuredClone(state);
  const roles = mergedRoles(next.constraint_roles);
  roles[chosen.field] = "prefer";
  roles[`${chosen.field}_locked`] = false;
  next.constraint_roles = roles;
  next.probe = null;
  next.pending_question = null;
  clearConfirmed(next);
  next.revision += 1;
  return { ok: true, state: next, needsResearch: true };
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
      const matched = part.match(/(\d+(?:\.\d+)?)\s*(厘米|cm|米)/i) || (/宽/.test(part) ? part.match(/宽[^0-9]{0,8}(\d+(?:\.\d+)?)/) : null);
      if (!matched) continue;
      if (/不是/.test(part) && !/还是|上限/.test(part)) continue;
      const amount = Number(matched[1]);
      const unit = matched[2] || '厘米';
      found = {value: unit === '米' ? Math.round(amount * 100) : amount};
    }
  }
  return found;
}

function clearsBudget(text) {
  return /预算不限|不限预算/.test(text);
}

function clearsCategory(text) {
  return /品类不限|不限品类/.test(text);
}

function scaleAmount(value, unit) {
  const mark = String(unit || "");
  const factor = mark === "万" ? 10000 : mark === "千" || mark.toLowerCase() === "k" ? 1000 : mark === "百" ? 100 : 1;
  return Math.round(value * factor);
}

function chineseInteger(token) {
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const small = { 十: 10, 百: 100, 千: 1000 };
  let result = 0;
  let section = 0;
  let number = 0;
  for (const ch of token) {
    if (Object.prototype.hasOwnProperty.call(digits, ch)) number = digits[ch];
    else if (Object.prototype.hasOwnProperty.call(small, ch)) {
      section += (number || 1) * small[ch];
      number = 0;
    } else if (ch === "万") {
      result += ((section + number) || 1) * 10000;
      section = 0;
      number = 0;
    } else return null;
  }
  const total = result + section + number;
  return total > 0 ? total : null;
}

function readAmount(text) {
  const source = String(text ?? "");
  const matches = [...source.matchAll(/(\d+(?:\.\d+)?)(?:\s*([万千百kK]))?/g)];
  if (matches.length) {
    if (matches.length > 1 && matches.every((item) => item[2])) {
      return matches.reduce((sum, item) => sum + scaleAmount(Number(item[1]), item[2]), 0);
    }
    const last = matches[matches.length - 1];
    return scaleAmount(Number(last[1]), last[2]);
  }
  const spoken = source.match(/[零〇一二三四五六七八九十百千万两]+/);
  if (!spoken || !/[零〇一二三四五六七八九两十]/.test(spoken[0])) return null;
  return chineseInteger(spoken[0]);
}

function readWidth(text) {
  const source = String(text ?? "").trim();
  if (!source) return null;
  if (/一米八/.test(source)) return 180;
  if (/一米六/.test(source)) return 160;
  if (/一米五/.test(source)) return 150;
  if (/两米|二米/.test(source)) return 200;
  const matched = source.match(/(\d+(?:\.\d+)?)\s*(厘米|cm|米|m)?/i);
  if (!matched) return null;
  const amount = Number(matched[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = String(matched[2] || "").toLowerCase();
  if (unit === "米" || unit === "m") return Math.round(amount * 100);
  return amount;
}

function canonicalCategory(phrase) {
  if (phrase === "椅子") return "休闲椅";
  if (phrase === "床") return "床架";
  return tableCategoryAlias(phrase);
}

function categoryPhrase(part) {
  let phrase = "";
  for (const item of CATEGORY_PHRASES) {
    if (part.includes(item) && item.length > phrase.length) phrase = item;
  }
  return phrase ? canonicalCategory(phrase) : null;
}

export function categoryFits(item, wanted) {
  if (!wanted) return true;
  if (item.category === wanted || item.name.includes(wanted)) return true;
  if (String(wanted).includes(item.category)) {
    const named = catalog.some((product) => product.category === item.category && product.name.includes(wanted));
    return named ? item.name.includes(wanted) : true;
  }
  return false;
}

function parseBudget(text) {
  let found = null;
  for (const part of splitParts(text)) {
    if (!/预算|元/.test(part) || /厘米/.test(part)) continue;
    const amount = readAmount(part);
    if (amount != null) found = amount;
  }
  return found;
}

function parseCategory(text) {
  let found = null;
  for (const part of splitParts(text)) {
    const phrase = categoryPhrase(part);
    if (phrase) found = phrase;
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
  if (/皮质也可以|可以皮质|材质不限|排除不限|不限材质|不限排除/.test(text)) return {clear: true};
  const names = ['皮质', '布艺', '橡木', '松木', '板材', '胡桃木', '岩板'];
  if (names.some((item) => new RegExp('(?:去掉|取消)(?:不要)?' + item).test(text) || new RegExp('不要排除' + item).test(text))) {
    return {clear: true};
  }
  const excluded = ['皮质', '布艺', '橡木', '松木'].filter(item => new RegExp('不要' + item).test(text));
  if (excluded.length > 1) return {ambiguous: excluded};
  if (excluded.length === 1) return {value: excluded[0]};
  return null;
}

function parseStyle(text) {
  for (const style of STYLES) {
    if (text.includes(style)) return style;
  }
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

function amountOf(text, pattern) {
  const matched = text.match(pattern);
  return matched ? Number(matched[1]) : null;
}

function badParams(text, parsed) {
  const maxBudget = amountOf(text, /预算[^，。]{0,12}(?:不超过|最多|以内)\s*(\d+)/);
  const minBudget = amountOf(text, /预算[^，。]{0,12}(?:至少|不少于|不低于)\s*(\d+)/);
  if (maxBudget != null && minBudget != null && minBudget > maxBudget) return true;
  const maxWidth = amountOf(text, /宽度[^，。]{0,12}(?:不超过|最多)\s*(\d+)/);
  const minWidth = amountOf(text, /宽度[^，。]{0,12}(?:至少|不少于)\s*(\d+)/);
  if (maxWidth != null && minWidth != null && minWidth > maxWidth) return true;
  if (/预算/.test(text) && parsed.budget == null && !parsed.cheaper && !/预算不限|不限预算|预算不变|预算还是/.test(text)) return true;
  if (/宽度|尺寸/.test(text) && !(parsed.width && (parsed.width.value != null || parsed.width.clear)) && !parsed.smallHome && !/尺寸不限|宽度不限|不限尺寸|不限宽度/.test(text)) return true;
  return false;
}

function constraintsChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function mergeMaterial(offlineMaterial, patch) {
  if (!patch?.active) return offlineMaterial;
  if (patch.material?.ambiguous) return { ambiguous: patch.material.ambiguous };
  if (offlineMaterial?.ambiguous) return offlineMaterial;
  const excludes = [];
  if (offlineMaterial?.value) excludes.push(offlineMaterial.value);
  if (patch.material?.value && !excludes.includes(patch.material.value)) excludes.push(patch.material.value);
  if (excludes.length > 1) return { ambiguous: excludes };
  const material = {};
  if (offlineMaterial?.clear) material.clear = true;
  if (excludes.length === 1) material.value = excludes[0];
  if (patch.material?.include) material.include = patch.material.include;
  if (!material.value && !material.include && !material.clear) return offlineMaterial;
  return material;
}

function readTurn(text, interpretation, state) {
  const patch = clausePatch(text, interpretation);
  return {
    width: parseWidth(text),
    ...resolveDemandLanguage(state, text, { budget: parseBudget(text), category: parseCategory(text) }, readAmount),
    color: patch?.color || parseColor(text),
    material: mergeMaterial(parseMaterial(text), patch),
    style: patch?.style || parseStyle(text),
    copy: parseCopy(text),
    marks: patch?.active ? patch.marks : null,
    unresolved: patch?.active ? patch.unresolved : null,
    interpreted: Boolean(patch?.active),
  };
}

function unmatchedLookup(text) {
  for (const item of catalog) {
    if (text.includes(item.name) || text.includes(item.model)) return null;
  }
  const rest = text
    .replace(/书桌|办公桌|电脑桌|茶几|饭桌|餐台|桌子|最高|块钱|块|预算|上限|最多|不超过|不少于|宽度|尺寸|颜色|材质|品类|只看|改看|改为|改成|换一款|重新选|便宜点|小户型|去掉|取消|不要|排除|浅色|米白|浅灰|深绿|原木|皮质|布艺|橡木|松木|北欧|日式|现代|轻奢|简约|自然|复古|中式|沙发|餐桌|休闲椅|床架|床头柜|柜子|椅子|柜|其他|保持|不变|也可以|不限|文案|话术|发布|下单|朋友圈|确认|商品|名称|型号|不是|还是|提高|以内|直接|你自己|选好|帮我|写它|请|想买|适合|最好|优先|尽量|喜欢|偏好|可以的话|必须|一定要|只能|只要|是|色|的|元|厘米|cm|米/gi, "")
    .replace(/[零一二三四五六七八九十百千万两]/g, "")
    .replace(/[\d\s，,。；;、．.！!？?（）()]/g, "");
  return rest.length >= 2 ? rest.slice(0, 16) : null;
}

export function absorbDemand(state, text, clientRevision, interpretation = null) {
  if (clientRevision != null && clientRevision !== state.revision) {
    return {ok: false, error: 'revision_conflict', state, needsResearch: false};
  }
  const next = structuredClone(state);
  const before = structuredClone(next.constraints);
  const read = readTurn(text, interpretation, state);
  const { width, budget, category, color, material, style, copy, marks } = read;
  const cheaper = /便宜点/.test(text) && budget == null;
  const smallHome = /小户型/.test(text) && !(width && width.value);
  const switchProduct = /换一款|重新选|换一个/.test(text);

  if (width?.clear) next.constraints.width_max_cm = null;
  else if (width?.value != null) next.constraints.width_max_cm = width.value;
  next.demand_clarification = read.clarification;
  if (read.clarification.budget) next.constraints.budget_max_cny = null;
  else if (budget != null) next.constraints.budget_max_cny = budget;
  else if (clearsBudget(text)) next.constraints.budget_max_cny = null;
  if (read.clarification.category) next.constraints.category = null;
  else if (category) next.constraints.category = category;
  else if (clearsCategory(text)) next.constraints.category = null;
  if (color?.clear) next.constraints.color = null;
  else if (color?.value) next.constraints.color = color.value;
  if (material?.clear) {
    next.constraints.exclude_material = null;
    next.constraints.material = null;
  } else {
    if (material?.value) next.constraints.exclude_material = material.value;
    if (material?.include) next.constraints.material = material.include;
  }
  if (style) next.constraints.style = style;
  rememberRoles(next, text, { budget, width, category, color, material, style }, marks);
  next.probe = null;
  next.applied_preference = null;
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
  const changed = constraintsChanged(before, next.constraints) || switchProduct
    || JSON.stringify(state.demand_clarification || { budget: null, category: null }) !== JSON.stringify(next.demand_clarification || {});
  next.pending_question = null;
  if (read.clarificationQuestion) {
    next.pending_question = read.clarificationQuestion;
    next.candidate_ids = [];
    clearConfirmed(next);
    next.revision += 1;
    return {ok: true, state: next, needsResearch: false, changed, reply: next.pending_question};
  }
  if (badParams(text, {budget, width, cheaper, smallHome})) {
    next.pending_question = FAILURE_TEXT.bad_params;
    next.candidate_ids = [];
    next.revision += 1;
    return {ok: true, state: next, needsResearch: false, changed, reply: next.pending_question};
  }
  const unknownName = !copy.asked && !cheaper && !smallHome && !switchProduct
    ? (read.interpreted ? ((read.unresolved || []).find((item) => item && !/^(去掉|取消|不限|改成|改为|其他|保持)$/.test(item)) || null) : unmatchedLookup(text))
    : null;
  if (material?.ambiguous) {
    next.pending_question = '还缺要排除的那一种材质。下一步：只回复一种，例如不要皮质。当前不能同时排除两种。';
    next.candidate_ids = [];
    next.revision += 1;
    return {ok: true, state: next, needsResearch: false, changed, reply: next.pending_question};
  }
  if (unknownName) {
    next.pending_question = `资料缺失。没有找到「${unknownName}」，不会编造。下一步：改用商品名称或型号，或说明预算和品类。`;
  } else if (cheaper) {
    const current = next.constraints.budget_max_cny;
    next.pending_question = current == null
      ? '还缺具体预算。下一步：直接回复预算上限，例如 3000 元。我不会把「便宜点」换成一个百分比。'
      : `还缺新的预算上限。下一步：直接回复金额。当前预算仍是 ${current} 元，我不会自行降低。`;
  } else if (smallHome) {
    next.pending_question = '还缺宽度上限。下一步：直接回复厘米数。「小户型」不能直接换成尺寸，我不会自行填写。';
  }
  if (unknownName || cheaper || smallHome) next.candidate_ids = [];
  if (changed) {
    next.confirmed_product_id = null;
    next.confirmed_product_version = null;
    next.card = null;
  }
  next.revision += 1;
  return {
    ok: true,
    state: next,
    needsResearch: !next.pending_question,
    changed,
    reply: next.pending_question || ''
  };
}

export function applyTurn(state, text, clientRevision, interpretation = null) {
  if (clientRevision != null && clientRevision !== state.revision) {
    return {ok: false, error: 'revision_conflict', state, searched: false, composed: false};
  }
  const next = structuredClone(state);
  const before = structuredClone(next.constraints);
  const read = readTurn(text, interpretation, state);
  const { width, budget, category, color, material, style, copy, marks } = read;
  const cheaper = /便宜点/.test(text) && budget == null;
  const smallHome = /小户型/.test(text) && !(width && width.value);
  const switchProduct = /换一款|重新选|换一个/.test(text);

  if (width?.clear) next.constraints.width_max_cm = null;
  else if (width?.value != null) next.constraints.width_max_cm = width.value;
  next.demand_clarification = read.clarification;
  if (read.clarification.budget) next.constraints.budget_max_cny = null;
  else if (budget != null) next.constraints.budget_max_cny = budget;
  else if (clearsBudget(text)) next.constraints.budget_max_cny = null;
  if (read.clarification.category) next.constraints.category = null;
  else if (category) next.constraints.category = category;
  else if (clearsCategory(text)) next.constraints.category = null;
  if (color?.clear) next.constraints.color = null;
  else if (color?.value) next.constraints.color = color.value;
  if (material?.clear) {
    next.constraints.exclude_material = null;
    next.constraints.material = null;
  } else {
    if (material?.value) next.constraints.exclude_material = material.value;
    if (material?.include) next.constraints.material = material.include;
  }
  if (style) next.constraints.style = style;
  rememberRoles(next, text, { budget, width, category, color, material, style }, marks);
  next.probe = null;
  next.applied_preference = null;

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

  const changed = constraintsChanged(before, next.constraints) || switchProduct
    || JSON.stringify(state.demand_clarification || { budget: null, category: null }) !== JSON.stringify(next.demand_clarification || {});
  let searched = false;
  let composed = false;
  next.pending_question = null;

  if (read.clarificationQuestion) {
    next.pending_question = read.clarificationQuestion;
    next.candidate_ids = [];
    clearConfirmed(next);
    next.revision += 1;
    return {ok: true, status: 'ask', reply: next.pending_question, state: next, searched, composed};
  }

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
      const probed = resolveConstraintSearch(next.constraints, next.constraint_roles);
      next.constraint_roles = probed.roles;
      next.candidate_ids = probed.officialIds;
      next.probe = probed.probe;
      next.applied_preference = probed.applied;
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
    next.pending_question = probeLead(next.probe) || '没有同时满足这些条件的商品。请选择要调整的条件，我不会自行放宽。';
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
  next.demand_clarification = { budget: null, category: null };
  next.pending_question = null;
  next.card = buildCard(product, next.copy_requirement, []);
  next.revision += 1;
  return {
    ok: true,
    status: 'draft_review',
    reply: `已确认${product.name}。下一步去生成可发给顾客的素材。`,
    state: next,
    searched: false,
    composed: true
  };
}

export function confirmFromCatalog(state, productId, clientRevision) {
  const product = productById(productId);
  if (!product) {
    return {ok: false, error: 'unknown_product', state, searched: false, composed: false};
  }
  const next = structuredClone(state);
  if (!next.candidate_ids.includes(productId)) next.candidate_ids = [...next.candidate_ids, productId];
  return confirmProduct(next, productId, clientRevision);
}

export function publicCatalog() {
  return catalog.map(item => ({
    id: item.id,
    name: item.name,
    model: item.model,
    category: item.category,
    price_cny: item.price_cny,
    width_cm: item.width_cm,
    color: item.color,
    material: item.material,
    style: item.style || '',
    image: item.image || `/products/${item.id}.png`,
    synthetic: true,
    sample: true,
    promoNote: buildPromoPlan(item.id).note
  }));
}
