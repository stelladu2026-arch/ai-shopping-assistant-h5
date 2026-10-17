// 一次接待里的子任务上限。路由不占这些次数。改上限只改这里。
export const LIMITS = {
  retrieve: 3,
  product_decision: 3,
  content: 2,
  image: 2,
  clarify: 2,
  policy: 3,
};

export const DEGRADE_TEXT = "未核对，不能当作事实";

export const FAILURE_TEXT = {
  no_result: "无结果。这些条件有效，但没有同时符合的商品。下一步：改预算、宽度、颜色或材质里的一项。我不会自行放宽。",
  missing_data: "资料缺失。没有找到这一项，不会编造。下一步：改用商品名称或型号，或说明预算和品类。",
  bad_params: "参数错误。预算或尺寸无法解析，或前后矛盾。下一步：换一种说法，例如预算 3000 元、宽度 180 厘米。",
  network: "网络错误。这次请求没有完成。下一步：稍后再试。已确认商品和已有素材都还在。",
};

export function capText(kind) {
  const limit = LIMITS[kind];
  const name = {
    retrieve: "资料检索",
    product_decision: "商品决策",
    content: "内容生成",
    image: "生图",
  }[kind] || kind;
  return `已达本次上限。${name}这次接待最多 ${limit} 次。下一步：换条件、确认已列出的商品，或复制已有素材。`;
}

export function isTransportError(error) {
  if (!error) return false;
  const name = String(error.name || "");
  const message = String(error.message || error);
  if (name === "TimeoutError" || name === "AbortError") return true;
  return /network|fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|timeout|socket|aborted/i.test(message);
}
