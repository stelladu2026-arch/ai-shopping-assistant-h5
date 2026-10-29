import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { parseBudget, BUDGET_KEY } from "../lib/sizing.ts";

const resultFor = (capitalYuan: number, changed: boolean) => ({
  capitalYuan,
  changed,
  unit: "元",
});

export default defineTool({
  description:
    "记录可投入金额，单位是人民币元。用户说出打算用来买基金的钱时使用。同一金额重复提交不会再次写入。不会下单，也不会把金额当成预期利润。",
  effect: "idempotent",
  dryRunResult: ({ capitalYuan }) => resultFor(capitalYuan, false),
  inputSchema: z.object({
    capitalYuan: z.number().positive().max(100_000_000),
  }),
  async execute({ capitalYuan }, ctx) {
    const current = parseBudget(await ctx.host.kv.get(BUDGET_KEY));
    if (current === capitalYuan) return resultFor(capitalYuan, false);
    await ctx.host.kv.put(BUDGET_KEY, { capitalYuan });
    return resultFor(capitalYuan, true);
  },
});
