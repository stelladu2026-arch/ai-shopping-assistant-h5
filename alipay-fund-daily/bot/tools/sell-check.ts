import { defineTool } from "@grok/agent-sdk/tools";
import { HOLDINGS_KEY, parseWatchlist } from "../lib/brief.ts";
import { reviewHoldings } from "../lib/screen.ts";

export default defineTool({
  description:
    "检查已记录持仓今天是不是卖出日。用户问哪天卖、要不要卖、卖出条件到了没有时必须用这个工具。只有 triggered 为 true 才有 sellDay。条件没成立时不要编未来日期。不会连接支付宝，也不会下单。",
  effect: "read",
  async execute(_input, ctx) {
    const codes = parseWatchlist(await ctx.host.kv.get(HOLDINGS_KEY));
    return reviewHoldings(codes);
  },
});
