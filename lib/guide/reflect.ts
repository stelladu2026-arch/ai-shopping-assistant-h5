// @ts-nocheck
import catalog from "../../data/catalog.json";
import promotions from "../../data/promotions.json";

const LIGHT = ['米白', '浅灰'];
const TODAY = '2026-10-06';

export function reflect(state, confirmedFacts) {
  const checks = [];
  const constraints = state?.constraints || {};
  const ids = state?.confirmed_product_id ? [state.confirmed_product_id] : (state?.candidate_ids || []);
  for (const id of ids) {
    const product = catalog.find(item => item.id === id);
    if (!product) {
      checks.push({target: id, name: '商品资料', ok: false, detail: '资料里没有这件商品'});
      continue;
    }
    if (constraints.budget_max_cny != null) {
      checks.push({target: id, name: '预算', ok: product.price_cny <= constraints.budget_max_cny, detail: `${product.name}标价${product.price_cny}，上限${constraints.budget_max_cny}`});
    }
    if (constraints.width_max_cm != null) {
      checks.push({target: id, name: '宽度', ok: product.width_cm <= constraints.width_max_cm, detail: `${product.width_cm}厘米，上限${constraints.width_max_cm}厘米`});
    }
    if (constraints.category) {
      checks.push({target: id, name: '品类', ok: product.category === constraints.category, detail: product.category});
    }
    const colorHard = state?.constraint_roles?.color !== "prefer";
    if (constraints.color && !colorHard) {
      checks.push({target: id, name: '颜色', ok: true, detail: `优先考虑${constraints.color}，这件是${product.color}，不作为必须满足`});
    } else if (constraints.color === '浅色') {
      checks.push({target: id, name: '颜色', ok: LIGHT.includes(product.color), detail: product.color});
    } else if (constraints.color) {
      checks.push({target: id, name: '颜色', ok: product.color === constraints.color, detail: product.color});
    }
    if (constraints.exclude_material) {
      checks.push({target: id, name: '材质', ok: product.material !== constraints.exclude_material, detail: product.material});
    }
  }
  if (state?.confirmed_product_id && state.card?.promotions) {
    for (const promo of state.card.promotions) {
      const source = promotions.find(item => item.id === promo.id);
      const ok = Boolean(source && source.products.includes(state.confirmed_product_id) && source.start <= TODAY && source.end >= TODAY);
      checks.push({target: promo.id, name: '活动', ok, detail: ok ? `${promo.id}在有效期内` : `${promo.id}不能当成有效活动`});
    }
  }
  if (state?.confirmed_product_id) {
    const plan = confirmedFacts?.id === state.confirmed_product_id ? confirmedFacts.promoPlan : null;
    if (!plan) {
      checks.push({ target: "promo-plan", name: "活动叠加", ok: false, detail: "没有已确认的活动组合，不能编造可以一起使用的活动。" });
    } else {
      const conflicts = [];
      for (let i = 0; i < plan.use.length; i += 1) {
        for (let j = i + 1; j < plan.use.length; j += 1) {
          const left = promotions.find(item => item.id === plan.use[i].id);
          const right = promotions.find(item => item.id === plan.use[j].id);
          const stacks = left?.stack_with?.includes(right?.id) && right?.stack_with?.includes(left?.id);
          if (!stacks) conflicts.push(plan.use[i].id + "和" + plan.use[j].id);
        }
      }
      const expiredUsed = plan.use.some(item => item.id === "EXPIRED");
      checks.push({
        target: "promo-plan",
        name: "活动叠加",
        ok: conflicts.length === 0 && !expiredUsed,
        detail: conflicts.length ? conflicts.join("、") + "不能叠加，不能说成可以一起使用" : plan.note,
      });
    }
  }
  const failed = checks.filter(item => !item.ok);
  return {
    blind: true,
    used_prior_conclusion: false,
    passed: checks.length > 0 && failed.length === 0,
    pending_review: failed.length > 0,
    failed_targets: [...new Set(failed.map(item => item.target))],
    checks,
    note: checks.length
      ? (failed.length ? '核查未通过。这些结果保持待核对，不能说成已通过。' : '规则通过仍待人工核对。') + '本轮只对照约束和资料，没有沿用上一轮结论。'
      : '还没有可核查的商品。'
  };
}
