# 演示说明（本地 MVP）

面向门店导购 / 店长场景的 H5 前端演示工程，数据默认落在浏览器 **localStorage**。

## 线上演示部署（发给面试官）

见 **[DEPLOY-DEMO.md](./DEPLOY-DEMO.md)**。最快方式：

```powershell
npm install
npm run deploy:demo
```

部署后使用 Vercel 提供的 `https://xxx.vercel.app` 链接即可分享。

## 本地启动

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址（默认 `http://localhost:3000`）。

## 主要浏览路径


| 页面   | 路径          | 说明                                                   |
| ---- | ----------- | ---------------------------------------------------- |
| 首页   | `/`         | 功能入口、常用提问、继续上次会话                                     |
| 会话中心 | `/sessions` | 最近会话与收藏；店长可在顶部切换 **我的 / 本店**，本店含会话摘要与门店指标（Mock）      |
| 对话   | `/chat`     | AI 对话：顶部切换 **朋友圈生成 / 政策查询**；本页**无底部 Tab**，请用顶栏返回会话中心 |


底部导航仅两 Tab：**首页** → `/`，**会话中心** → `/sessions`。进入对话请从首页入口、常用提问或会话中心等跳转至 `/chat`。

## 角色与登录（演示）

设置（首页右上角）→ **账号登录**。内置演示账号见 `mock/authUsers.ts`（口令均为 `demo123`）：

- `guide01`：导购  
- `manager01`：店长（会话中心默认进入 **本店** 视图）

登录后会同步本地「角色」配置（`useAppSettings`），用于店长专属入口与视图。

## 清除本地演示数据

在地址栏访问：

```
/chat?clearLocal=1
```

会清空应用写入 localStorage 的键（会话、收藏、RAG 查询历史、登录会话等），并新建一条本地对话会话 id。逻辑见 `ChatPageClient.tsx` 中对 `clearLocal` 的处理及 `lib/appLocalStorage.ts` 中的键列表。

亦可在浏览器开发者工具中手动清除本站存储。

## Mock 与接口

- 对话请求默认走 `services/agent.ts` → `**/api/agent/chat**`。
- **服务端优先 POST 到 Coze 发布的工作流 URL**（默认 `https://vkpkbmtz48.coze.site/run`，可通过环境变量覆盖），请求体为完整的 `AgentChatRequestBody`（含 `scene`、`messages`、`momentsInput` 等）。  
若远程不可用、返回无法解析或设置 `COZE_WORKFLOW_USE_MOCK=1`，则回退到路由内的本地 Mock。
- 工作流返回需能映射为 `types/agent.ts` 中的 `**MomentsGenerationResult` / `RagPolicyAnswer`**（见 `lib/cozeWorkflow.ts` 中的解析逻辑）；否则仍会回落 Mock。
- 复制 `.env.example` 为 `.env.local` 按需修改。
- 清除本地数据后刷新即可从零开始演示。

