import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { MAX_FUNDS, normalizeCodes, parseWatchlist, sameCodes, WATCHLIST_KEY } from "../lib/brief.ts";

const resultFor = (codes: string[], changed: boolean) => ({
  codes,
  count: codes.length,
  changed,
  limit: MAX_FUNDS,
});

export default defineTool({
  description:
    "替换整份观察名单。只接受最多 8 个 6 位基金代码。传入空列表会清空。同一列表重复提交不会再次写入。不会下单。",
  effect: "idempotent",
  dryRunResult: ({ codes }) => resultFor(normalizeCodes(codes), false),
  inputSchema: z.object({
    codes: z.array(z.string().regex(/^\d{6}$/)).max(MAX_FUNDS),
  }),
  async execute({ codes }, ctx) {
    const next = normalizeCodes(codes);
    const current = parseWatchlist(await ctx.host.kv.get(WATCHLIST_KEY));
    if (sameCodes(current, next)) return resultFor(next, false);
    await ctx.host.kv.put(WATCHLIST_KEY, { codes: next });
    return resultFor(next, true);
  },
});
