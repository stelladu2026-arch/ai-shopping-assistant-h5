import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "A named fund brief uses the quote tool and does not promise a 20% return.",
  async test(t) {
    await t.send("请只对照基金 110022 今天该怎么看。不要修改观察名单。");
    t.succeeded();
    t.calledTool("daily-brief", { input: { codes: ["110022"] } });
    t.notCalledTool("set-watchlist");
    t.check(t.reply, includes(/也不会连接支付宝或代你下单/));
    t.check(t.reply, includes(/20%/));
  },
});
