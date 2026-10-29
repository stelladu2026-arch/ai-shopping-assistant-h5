import { defineTool } from "@grok/agent-sdk/tools";
import { screenEntries } from "../lib/screen.ts";

export default defineTool({
  description:
    "筛选当前可以分批入手的基金。用户问现在买什么、哪些基金可以入手时必须用这个工具。只把返回的 ready 说成可以入手。ready 为空就说今天没有。不会连接支付宝，也不会下单。",
  effect: "read",
  async execute() {
    return screenEntries();
  },
});
