// @ts-nocheck

import { RANK_RULE } from "./engine";
import { LIMITS } from "./limits";

const CANNOT = "不能手改名称、价格和规格。不能把不能叠加的活动说成可以一起用。不能把未验证的记忆当成筛选规则。";

export function describeProcess({ edge, note, state, facts, material, decision, contentStatus, productStatus, usage, clarify, failure, degraded }) {
  const pending = state?.pending_question || "";
  let step = "补条件";
  let status = "完成";
  let why = note || "还缺能往下筛的条件，先补问，不编造商品。";
  let did = pending
    ? `自己决定先追问，而不是推荐商品。${pending}`
    : "条件还不够，自己停住，不编造商品。";

  if (edge === "blocked") {
    step = "内容生成";
    status = "失败";
    why = note || "还没有确认商品，不能生成素材。";
    did = "还没有确认商品，内容自己停住，不另选一件。下一步：先点选商品。";
  } else if (edge === "content") {
    step = "内容生成";
    status = contentStatus === "failed" ? "失败" : "完成";
    why = note || "素材只使用已经确认的这件商品。";
    did = contentStatus === "failed"
      ? "素材没有生成。已确认商品还在，没有另选一件。"
      : "只使用已经确认的商品事实生成素材，没有另选一件。";
  } else if (edge === "product_decision" || edge === "stay") {
    step = "商品决策";
    status = productStatus === "failed" ? "失败" : "完成";
    why = note || "按这次接待里的预算、尺寸、品类、颜色和材质筛选。依据来自门店商品资料。";
    if (productStatus === "failed") did = "筛选没有完成，自己停住。已确认商品和已有素材都还在。";
    else if (edge === "stay") did = "商品已经确认。这一步不再重新筛选，也不另选商品。";
    else if (state?.confirmed_product_id && facts?.name) did = `确认了「${facts.name}」。名称、价格和规格来自资料，不能在表单里手改。`;
    else if (!(state?.candidate_ids || []).length && state?.probe?.needsConfirm) did = "两项偏好分别放宽都会查到商品，自己停下来等导购确认放宽哪一项。没有改预算、宽度、品类和排除材质。";
    else if (!(state?.candidate_ids || []).length && state?.probe) did = `自己做了约束敏感度分析，只放宽一个偏好「${state.probe.label}」做了一次试探查询，仍然没有结果。没有放宽必须满足的条件。`;
    else if (!(state?.candidate_ids || []).length) did = "没有同时满足条件的商品，自己停住，不放宽条件。";
    else if (state?.applied_preference?.label) did = `已把「${state.applied_preference.label}」改成优先考虑，并直接筛选。没有改预算、宽度、品类和排除材质。`;
    else did = `按预算、尺寸、品类、颜色和材质自己筛选，等导购点选确认。没有自行放宽条件。${RANK_RULE}`;
  }

  if (material?.pendingReview) {
    did += "确认的商品已更换，旧素材自己标成待核对。";
    if (status !== "失败") status = "待重跑";
  }

  let hit = false;
  let title = "";
  let excerpt = "没有检索到。这一步先补条件，没有去查商品资料。";
  if (facts?.sourceExcerpt) {
    hit = true;
    title = facts.sourceTitle || facts.name || "";
    excerpt = facts.sourceExcerpt;
  } else if (edge === "product_decision" || edge === "stay") {
    const first = (decision?.products || []).find((item) => item?.reason);
    if (first?.reason?.includes("门店资料")) {
      hit = true;
      title = first.name || "";
      excerpt = first.reason;
    } else if (first?.reason) excerpt = first.reason;
    else excerpt = "没有检索到门店资料，不能编造说明。";
  }

  const used = usage || {};
  return {
    workflow: { step, why, status },
    rag: { hit, title, excerpt },
    agent: { did, cannot: CANNOT },
    usage: {
      retrieve: { used: used.retrieve || 0, limit: LIMITS.retrieve },
      product_decision: { used: used.product_decision || 0, limit: LIMITS.product_decision },
      content: { used: used.content || 0, limit: LIMITS.content },
      image: { used: used.image || 0, limit: LIMITS.image },
    },
    clarify: (clarify || []).map((item) => ({
      doubt: item.doubt,
      rounds: item.rounds,
      limit: LIMITS.clarify,
      capped: item.rounds > LIMITS.clarify,
    })),
    failure: failure || null,
    degraded: degraded || [],
  };
}
