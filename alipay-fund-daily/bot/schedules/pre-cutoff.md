---
cron: "30 6 * * *"
---

现在是北京时间 14:30，赶在支付宝基金 15:00 截止之前。先调用 screen-buys，再调用 sell-check。
不要修改持仓或可投入金额，不要索要支付宝密码、支付密码、短信验证码或 Cookie。
回复以 disclaimer 原句开头，并且只分两节：

适合买入：只列 ready。每只写名称、代码和 amountYuan，并写 purchase.note 里的合计。ready 为空就写今天没有适合买入的，建议购买金额是 0 元。
适合卖出：已记录持仓里 triggered 为 true 的，写名称、代码和 sellDay。ifHeldSellToday 里的基金写成「若已持有，今天适合卖出」。两边都空就写今天没有适合卖出的。持仓为空时说明需要先提供已买入的代码。

不要编造基金、金额或未来的卖出日期。reached20 为 false 时写明这段历史没有达到年化 20%。
