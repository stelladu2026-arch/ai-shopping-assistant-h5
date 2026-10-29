import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { buildDailyBrief, MAX_FUNDS, normalizeCodes, parseWatchlist, WATCHLIST_KEY } from "../lib/brief.ts";

export default defineTool({
  description:
    "用公开净值计算今天的对照动作。传入 codes 就只算这些 6 位代码；不传则读取观察名单。动作、收益率和历史对照都以这个结果为准，不要自行编造。不会连接支付宝，也不会下单。",
  effect: "read",
  inputSchema: z.object({
    codes: z.array(z.string().regex(/^\d{6}$/)).max(MAX_FUNDS).optional(),
  }),
  async execute({ codes }, ctx) {
    const selected = codes === undefined
      ? parseWatchlist(await ctx.host.kv.get(WATCHLIST_KEY))
      : normalizeCodes(codes);
    const brief = await buildDailyBrief(selected);
    if (selected.length === 0) {
      return {
        ...brief,
        message: "观察名单是空的。请发送最多 8 个 6 位基金代码，并说明要加入观察名单。这里不推荐具体基金。",
      };
    }
    return brief;
  },
});
