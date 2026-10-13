// @ts-nocheck
import promotions from "../../data/promotions.json";

const TODAY = "2026-10-06";

function stacks(left, right) {
  return Boolean(left.stack_with?.includes(right.id) && right.stack_with?.includes(left.id));
}

function subsets(items) {
  const out = [];
  const count = items.length;
  for (let mask = 1; mask < 2 ** count; mask += 1) {
    const group = [];
    for (let index = 0; index < count; index += 1) {
      if (mask & (2 ** index)) group.push(items[index]);
    }
    out.push(group);
  }
  return out;
}

function compatible(group) {
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      if (!stacks(group[i], group[j])) return false;
    }
  }
  return true;
}

export function buildPromoPlan(productId) {
  const related = promotions.filter((item) => item.products.includes(productId) && item.store_id === "demo");
  const active = related.filter((item) => item.start <= TODAY && item.end >= TODAY);
  const expired = related.filter((item) => item.start > TODAY || item.end < TODAY);
  const choices = subsets(active).filter(compatible);
  choices.sort((left, right) => {
    const discount = (group) => group.reduce((sum, item) => sum + item.discount_cny, 0);
    return discount(right) - discount(left) || right.length - left.length;
  });
  const chosen = choices[0] || [];
  const excluded = [
    ...active
      .filter((item) => !chosen.some((picked) => picked.id === item.id))
      .map((item) => {
        const blocker = chosen.find((picked) => !stacks(item, picked));
        return { id: item.id, reason: blocker ? `与 ${blocker.id} 不能叠加` : "未纳入当前组合" };
      }),
    ...expired.map((item) => ({ id: item.id, reason: "不在有效期内" })),
  ];
  const useText = chosen.length
    ? chosen.map((item) => `${item.id} 减 ${item.discount_cny} 元`).join("、")
    : "没有可同时使用的活动";
  const excludedText = excluded.length
    ? excluded.map((item) => `${item.id}（${item.reason}）`).join("、")
    : "没有需要排除的活动";
  return {
    use: chosen.map((item) => ({ id: item.id, discount_cny: item.discount_cny })),
    excluded,
    note: `当前可以同时使用：${useText}。已排除：${excludedText}。`,
  };
}
