import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "A request for funds to buy now uses the screener and does not promise a 20% return.",
  async test(t) {
    await t.send("现在有哪些基金可以入手？不要修改我的持仓。");
    t.succeeded();
    t.calledTool("screen-buys");
    t.notCalledTool("set-holdings");
    t.check(t.reply, includes(/也不会连接支付宝或代你下单/));
    t.check(t.reply, includes(/20%/));
  },
});