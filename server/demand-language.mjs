// Keep vague amounts as a clarification, never convert them to a hard price cap.
const NUMBER = '(?:\\d+(?:\\.\\d+)?|[零〇一二三四五六七八九十百千万两]+)';
const MONEY = `${NUMBER}\\s*[百千万kK]?\\s*(?:元|块钱|块)?`;
const APPROX = new RegExp(`(?:${MONEY}\\s*(?:多(?:点|一点)?|左右|上下|出头|来块)|(?:大概|大约|差不多)\\s*${MONEY}|[一二三四五六七八九两]{2}[百千万])`);
const EXACT_REPLY = new RegExp(`^\\s*${MONEY}\\s*[。！!]?\\s*$`);
const MONEY_UNIT = new RegExp(`${NUMBER}\\s*(?:[百千万kK]|元|块)`);
const BUDGET_CUE = /预算|价钱|价格|最高|最多|上限|不超过|以内/;
const DIMENSION = /宽|长|高|尺寸|厘米|cm|米|m\b/i;

export const EXTRA_CATEGORY_PHRASES = ['书桌', '办公桌', '电脑桌', '茶几', '饭桌', '餐台'];
export function tableCategoryAlias(phrase) {
  if (phrase === '饭桌' || phrase === '餐台') return '餐桌';
  if (phrase === '电脑桌') return '书桌';
  return phrase;
}

export function demandQuestion(clarification) {
  const questions = [];
  if (clarification?.category) questions.push('你想找餐桌、书桌还是茶几？');
  if (clarification?.budget) questions.push(`你说的“${clarification.budget}”还不是明确上限，预算最高能接受多少元？`);
  return questions.join('');
}

export function resolveDemandLanguage(state, text, parsed, readAmount) {
  const previous = state?.demand_clarification || {};
  const clarification = { budget: previous.budget || null, category: previous.category || null };
  let budget = parsed.budget;
  let category = parsed.category;
  for (const part of String(text).split(/[，,。；;\n]/).map(s => s.trim()).filter(Boolean)) {
    if (/预算不限|不限预算/.test(part)) { clarification.budget = null; budget = null; continue; }
    // A width (e.g. 180厘米左右) is not a price, even during budget clarification.
    const budgetPart = BUDGET_CUE.test(part) || (!DIMENSION.test(part) && (MONEY_UNIT.test(part) || (previous.budget && EXACT_REPLY.test(part))));
    if (!budgetPart || (DIMENSION.test(part) && !/预算|价钱|价格/.test(part))) continue;
    const pricePart = part.split(/宽度|尺寸|长度|高度/)[0];
    const approximate = pricePart.match(APPROX);
    if (approximate) {
      clarification.budget = approximate[0].trim();
      budget = null;
    } else {
      const amount = readAmount(pricePart);
      if (amount != null && Number.isFinite(amount)) { budget = amount; clarification.budget = null; }
    }
  }
  if (/品类不限|不限品类/.test(text)) clarification.category = null;
  else if (category) clarification.category = null;
  else if (/桌子/.test(text)) { clarification.category = '桌子'; category = null; }
  // An unresolved budget/category stays unresolved across unrelated follow-up turns.
  if (clarification.budget) budget = null;
  if (clarification.category) category = null;
  return { budget, category, clarification, clarificationQuestion: demandQuestion(clarification) };
}
