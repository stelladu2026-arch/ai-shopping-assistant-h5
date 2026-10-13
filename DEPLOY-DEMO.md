> 历史文档：当前 guide-agent 主线使用 Next.js + 服务端 SQLite，请先看 README.md 和 docs/IMPLEMENTATION-AUDIT-2026-10-13.md。以下旧 Coze / 纯前端 / 部署流程尚未按当前版本验收。

# 线上演示部署（发给面试官）

本项目为 **Next.js 全栈**（含 `/api/agent/chat`），推荐用 **Vercel** 免费托管，几分钟可得固定 HTTPS 链接。

演示部署已配置 **Mock 模式**（`COZE_WORKFLOW_USE_MOCK=1`），无需 Coze 密钥，面试官打开即可体验朋友圈生成与政策查询。

## 方式一：一条命令部署（推荐）

### 1. 安装依赖

```powershell
cd C:\Users\Administrator\ai-shopping-assistant-h5
npm install
```

### 2. 登录并部署

```powershell
npm run deploy:demo
```

- **首次**会打开浏览器，用 GitHub / 邮箱注册或登录 [Vercel](https://vercel.com)。
- 按提示确认项目名、目录即可。
- 成功后终端会输出类似：`https://ai-shopping-assistant-h5.vercel.app`

### 3. 发给面试官的链接

| 页面 | 路径 |
|------|------|
| 首页（推荐入口） | `/` |
| AI 对话 | `/chat` |
| 会话中心 | `/sessions` |

示例消息：

> 您好，这是我的 AI 导购助手 H5 演示：  
> https://你的项目名.vercel.app  
> 演示账号：guide01 / manager01，口令 demo123（设置里登录）。数据在浏览器本地，可手机浏览器打开。

---

## 方式二：Vercel 网站导入（适合有 GitHub 仓库）

1. 将代码推送到 GitHub（勿提交 `.env.local`）。
2. 打开 [vercel.com/new](https://vercel.com/new) → Import 该仓库。
3. Framework 选 **Next.js**，环境变量添加（或已写在 `vercel.json`）：
   - `COZE_WORKFLOW_USE_MOCK` = `1`
   - `NEXT_PUBLIC_DEMO_MODE` = `1`
4. Deploy，使用生成的 `*.vercel.app` 域名。

---

## 方式三：仅临时本地分享（不推荐面试正式用）

若暂时无法部署，可用内网穿透暴露本机 `npm run dev`（链接不稳定、需本机一直开着）：

```powershell
npm run dev
# 另开终端，安装 cloudflared 后：
cloudflared tunnel --url http://localhost:3000
```

---

## 常见问题

**构建失败**  
本地先执行 `npm run build` 排查；Vercel 云端构建日志在项目 Dashboard → Deployments。

**对话无响应**  
确认环境变量 `COZE_WORKFLOW_USE_MOCK=1` 已生效；演示部署不应依赖 Coze。

**清除演示数据**  
访问 `/chat?clearLocal=1` 可重置浏览器内会话与收藏。

**接入真实 Coze**  
在 Vercel 项目 Settings → Environment Variables 配置 `COZE_WORKFLOW_TOKEN` 等（见 `.env.example`），并删除或设为 `0` 的 `COZE_WORKFLOW_USE_MOCK`。
