---
cron: "0 6 * * 1-5"
---

现在是北京时间 14:00，交易日 15:00 截止之前。先调用 screen-buys，再调用 sell-check。
不要修改持仓，不要索要支付宝密码、支付密码、短信验证码或 Cookie。
回复以 disclaimer 原句开头。
第一节只列 ready 里的基金，作为今天可以分批入手的对照。ready 为空就写今天没有。
第二节写已记录持仓：triggered 为 true 时用 sellDay 作为卖出日；为 false 时写明卖出日还没到，并引用 submitNote。持仓为空就说明需要先提供已买入的 6 位代码。
不要编造未来的卖出日期。reached20 为 false 时写明这段历史没有达到年化 20%。
