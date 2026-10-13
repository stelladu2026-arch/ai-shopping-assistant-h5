// @ts-nocheck
import { DEGRADE_TEXT } from "./limits";

const HIGH_RISK = ["价格", "尺寸", "材质", "颜色", "型号", "活动叠加", "送装", "质保"];

export function sealFacts(product, promoPlan) {
  const degraded = [];
  const keep = (label, value) => {
    if (value == null || value === "") {
      degraded.push(label);
      return null;
    }
    return value;
  };
  const facts = {
    name: product?.name || "",
    model: keep("型号", product?.model),
    price_cny: keep("价格", product?.price_cny),
    width_cm: keep("尺寸", product?.width_cm),
    material: keep("材质", product?.material),
    color: keep("颜色", product?.color),
    promoUse: promoPlan?.use || [],
  };
  if (!promoPlan) degraded.push("活动叠加");
  degraded.push("送装", "质保");
  return { facts, degraded: [...new Set(degraded)], text: DEGRADE_TEXT };
}

export function degradeLine(labels) {
  return (labels || []).map((label) => `${label}：${DEGRADE_TEXT}`).join("。");
}

// 模型以后即使返回了这些字段，也不能覆盖已核对事实，也不能把未核对内容说成已确认。
export function dropUnverifiedModelText(text, sealed) {
  let next = String(text || "");
  const dropped = [];
  const replacements = [
    [/终身保修|终身质保|免费送装|包送装|质保无忧/g, "质保"],
    [/\d+\s*年(?:质保|保修|送装)/g, "质保"],
  ];
  for (const [pattern, label] of replacements) {
    if (pattern.test(next)) dropped.push(label);
    pattern.lastIndex = 0;
    next = next.replace(pattern, `${label}：${DEGRADE_TEXT}`);
  }
  const price = sealed?.facts?.price_cny;
  if (price != null) {
    next = next.replace(/(\d+(?:\.\d+)?)\s*元/g, (full, amount) => {
      if (Number(amount) === Number(price)) return full;
      dropped.push("价格");
      return `价格：${DEGRADE_TEXT}`;
    });
  }
  return { text: next, dropped: [...new Set(dropped)] };
}

export { HIGH_RISK, DEGRADE_TEXT };
