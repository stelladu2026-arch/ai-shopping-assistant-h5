# 导购 Agent

独立于产品机会研究仓库的移动端 H5。默认演示回放，不调用真实模型。

## 启动

```bash
node server/index.mjs
```

浏览器打开 http://127.0.0.1:4173 。这是手机宽度的单列 H5：首页、会话中心、对话页和设置。内容宽最多 430px。

检查：

```bash
node tests/guide-rules.mjs
node tests/model-config.mjs
node tests/h5-layout.mjs
```

## API Key 填写位置

复制 `.env.example` 为同目录 `.env`，只填写服务端变量：

- `DASHSCOPE_API_KEY`
- `QWEN_FREE_TIER_ONLY_CONFIRMED`（确认免费额度用完即停已生效后才改为 `true`）
- `GUIDE_AGENT_LIVE_MODEL`（要允许真实生文时才改为 `true`）
- `IMAGE_API_BASE`、`IMAGE_MODEL`、`IMAGE_API_KEY`（生图，可与生文密钥分开；留空则只回放占位图）

网页没有密钥输入框。生文三项同时满足才会请求文案模型。生图三项都有值才会请求图像接口。商品筛选和活动是否有效仍由本地代码判断。

记忆要在页面上点「记住」才会写入，并标成未验证。反思每轮对照预算、尺寸、品类和活动重新核查，不沿用上一轮结论。

## 与产品机会研究一致的接口

地址和模型名与 `jianwei-cursor-handoff-20261005/source/lib/research/provider-config.ts` 相同：

- Base URL：`https://llm-feayjgruj6xxgtqa.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 请求：`POST {Base URL}/chat/completions`
- 模型：`qwen3.7-plus`
- `stream: false`，`enable_thinking: false`，Bearer 密钥，严格 JSON Schema

商品筛选、预算边界和活动是否有效由本地代码决定。模型只在上述开关打开后参与已确认商品的文案，失败时不会把演示稿说成模型结果。
