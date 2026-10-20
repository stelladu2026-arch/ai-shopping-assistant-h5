# 导购 Agent

独立于产品机会研究仓库的移动端 H5。默认演示回放，不调用真实模型。

## 启动

当前 Next.js 移动端 H5 使用 项目要求的 Node.js 22：

```bash
npm ci
npm run dev
```

浏览器打开 http://localhost:3000 。检查稳定预览时可以先 `npm run build`，再 `npm start`，避免首次访问触发开发编译。

`node server/index.mjs` / 4173 是旧版独立演示入口，与当前 Next.js 页面和 API 不同。

加载故障与此次修复说明见 [docs/preview-loading-fix.md](docs/preview-loading-fix.md)。

检查（不配置真实服务时不消耗模型额度）：

```bash
node --import ./tests/register-ts.mjs tests/request-deadlines.mjs
node --import ./tests/register-ts.mjs tests/rag-retrieve.mjs
node tests/edit-constraints.mjs
node --import ./tests/register-ts.mjs tests/image-call.mjs
npx tsc --noEmit --incremental false
```

## 生图配置检查

在项目目录执行 `npm run doctor`。它不会调用模型或消耗额度，会显示配置实际来自哪个文件；特别检查 `.env.local` 是否覆盖了刚修改的 `.env`。修改后停止并重新启动服务。使用 `npm start` 时可用 `npm run doctor -- --production` 检查生产模式。

`npm run test:stability` 运行非飞书主流程的 14 组离线回归。

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
