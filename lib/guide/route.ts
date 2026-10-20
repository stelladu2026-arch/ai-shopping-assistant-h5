// @ts-nocheck

const NOTES = {
  ask: "还缺能往下筛的条件，先补问，不编造商品。",
  product_decision: "按这次接待里的预算、尺寸、品类、颜色和材质筛选。依据来自门店商品资料。",
  content: "素材只使用已经确认的这件商品。",
  blocked: "还没有确认商品，不能生成素材。",
  stay: "商品已确认。下一步去生成素材。这里不会重新筛选。",
};

export function routeEdge(input) {
  const intent = input?.intent || "turn";
  const confirmed = input?.confirmedProductId || null;
  if (intent === "content") return confirmed ? "content" : "blocked";
  if (intent === "confirm" || intent === "product_decision") return "product_decision";
  if (input?.pendingQuestion) return "ask";
  if (input?.needsResearch) return "product_decision";
  if (!confirmed) return "ask";
  return "stay";
}

export function routeNote(edge, input) {
  if (edge === "product_decision" && input?.intent === "confirm") {
    return input.source === "catalog"
      ? "导购在商品列表里点了这件，所以进入商品确认。不会另搜一件。"
      : "导购点选了候选里的这件，所以进入商品确认。";
  }
  if (edge === "product_decision" && input?.intent === "product_decision") {
    return "导购要求按当前条件重新筛选，所以回到商品决策。";
  }
  return NOTES[edge] || NOTES.ask;
}
