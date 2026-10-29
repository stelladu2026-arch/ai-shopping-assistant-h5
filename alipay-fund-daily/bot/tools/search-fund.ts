import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { searchFunds } from "../lib/market.ts";

export default defineTool({
  description:
    "按基金名称或 6 位代码查询公开基金。只返回代码、名称和类型，不加入观察名单，也不给出买卖动作。",
  effect: "read",
  inputSchema: z.object({
    query: z.string().trim().min(1).max(30),
  }),
  async execute({ query }) {
    const hits = await searchFunds(query);
    return {
      hits: hits.map((hit) => ({
        code: hit.code,
        name: hit.name,
        ftype: hit.ftype,
        kind: hit.kind,
      })),
    };
  },
});
