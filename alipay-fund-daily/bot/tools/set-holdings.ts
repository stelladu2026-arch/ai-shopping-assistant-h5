import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { HOLDINGS_KEY, MAX_FUNDS, normalizeCodes, parseWatchlist, sameCodes } from "../lib/brief.ts";

const resultFor = (codes: string[], changed: boolean) => ({
  codes,
  count: codes.length,
  changed,
  limit: MAX_FUNDS,
});

export default defineTool({
  description:
    "替换已买入的持仓代码。用户说自己买了或持有哪些基金时使用，传入完整的 6 位代码列表。空列表表示清空。同一列表重复提交不会再次写入。不会下单。",
  effect: "idempotent",
  dryRunResult: ({ codes }) => resultFor(normalizeCodes(codes), false),
  inputSchema: z.object({
    codes: z.array(z.string().regex(/^\d{6}$/)).max(MAX_FUNDS),
  }),
  async execute({ codes }, ctx) {
    const next = normalizeCodes(codes);
    const current = parseWatchlist(await ctx.host.kv.get(HOLDINGS_KEY));
    if (sameCodes(current, next)) return resultFor(next, false);
    await ctx.host.kv.put(HOLDINGS_KEY, { codes: next });
    return resultFor(next, true);
  },
});
