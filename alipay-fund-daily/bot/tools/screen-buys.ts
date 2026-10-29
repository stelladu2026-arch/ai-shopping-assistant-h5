import { defineTool } from "@grok/agent-sdk/tools";
import { screenEntries } from "../lib/screen.ts";
import { parseBudget, BUDGET_KEY } from "../lib/sizing.ts";

export default defineTool({
  description:
    "筛选当前可以分批入手的基金，并给出每只的建议购买金额。用户问现在买什么、买多少、哪些基金可以入手时必须用这个工具。只把返回的 ready 说成可以入手，金额只用 purchase 和 amountYuan。ready 为空时建议购买金额是 0 元。不会连接支付宝，也不会下单。",
  effect: "read",
  async execute(_input, ctx) {
    const capitalYuan = parseBudget(await ctx.host.kv.get(BUDGET_KEY));
    return screenEntries(new Date(), capitalYuan);
  },
});
