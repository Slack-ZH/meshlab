# 邮箱登录与 DeepSeek 聊天

网页部署在 GitHub Pages，聊天由 Cloudflare Worker 提供。Firebase 邮箱密码登录后，必须验证邮箱才能使用 AI。DeepSeek 密钥仅保存在服务端。

## 使用

点击 AI 助手下方“登录 / 注册”，注册后打开验证邮件，再回到网页点击“我已验证”。支持退出登录、重新发送验证邮件和重置密码。选中三维零件后提问会自动附带该零件资料；Enter 发送，Shift+Enter 换行。

对话保留在当前页面内存中；刷新、退出或切换账号会清空。可以连续追问、停止、重试和新建对话。当前 AI 只提供文字回答，尚未执行三维操作或工程仿真。

## 每账号每日 2 元

- 按 Firebase 项目和已验证账号 UID 分别统计，Cloudflare Durable Object SQLite 持久保存，跨设备和服务重启共享预算。
- 北京时间零点重置；跨零点的请求计入开始当天。
- 先原子预留本次输入和最大输出的保守成本，再按服务端返回的 token 用量结算；同时请求不能绕过预留。剩余预算不足以容纳本次预留时会提前拒绝。
- 当前固定模型 deepseek-flash，按 2026-10-28 核对的高峰未缓存输入价 2 元/百万 token、输出价 8 元/百万 token 统计，不计缓存和低谷优惠。因此网页预算可能高于 DeepSeek 实际账单。
- 停止、断网或上游缺少完整用量时保留预留金额，避免未知消费被误退。生成中金额也显示在“今日预算占用”中。
- 每账号每分钟最多 12 次、同时最多 2 次，最大输出 2048 token。更换模型前必须更新计价规则，未配置价格的模型拒绝调用。
- 这是每个登录账号的应用预算。所有账号的实际费用仍由网站维护者的 DeepSeek API 账号承担，不是整个 API 账号每天总共 2 元；多个邮箱也是多个账号。

价格依据：[DeepSeek 官方价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)。后续调价应同步修改 server/budget.mjs，保守预留不是供应商侧账单硬限额。

## 本地预览

需要 Node.js 22+，在本目录运行：

```powershell
node --env-file-if-exists=.env server/local.mjs
```

默认打开 http://127.0.0.1:8080，可通过 PORT 修改端口。服务只监听本机。本地 /api 代理到 dist/chat-config.json 指定的云端，使用同一邮箱登录和预算，不提供绕过计费的本地入口。无需在本机配置 DeepSeek 密钥。

若本机需要使用已有代理，可在同一终端设置 HTTPS_PROXY、NO_PROXY=localhost,127.0.0.1，以 Node.js 24 的 --use-env-proxy 参数启动。不需要修改系统代理。

## Firebase 配置

当前项目 meshlab-680d9 使用免费 Spark 方案。Authentication 中启用 Email/Password；Authorized domains 添加 slack-zh.github.io，本地测试可添加 localhost 和 127.0.0.1。前端公开配置位于 dist/chat-config.json，其中 Firebase Web API Key 是客户端项目配置，不是 DeepSeek 密钥或 Firebase 管理员私钥。

后端验证 ID token 签名、项目、签发者、时间、账号 UID、邮箱已验证标记以及密码登录方式。浏览器提交的 UID 或金额不参与授权或计价。没有管理员服务账号密钥。

## 后端部署

```powershell
pnpm install --frozen-lockfile
pnpm worker:login
pnpm exec wrangler secret put DEEPSEEK_API_KEY
pnpm worker:deploy
```

密钥在终端私密输入，不提交版本库。已有密钥无需重复设置。wrangler.jsonc 指定允许的网页源、Firebase 项目、模型，以及 ACCOUNT_BUDGET SQLite Durable Object。保留其名称和存储，避免重新创建而丢失预算。旧的 CHAT_ACCESS_TOKEN 和口令文件不再使用。

网页由仓库根目录 .github/workflows/pages.yml 发布 meshlab/dist/。认证 SDK 已打包进 dist/assets/firebase-auth.js；更新 Firebase 依赖后运行 pnpm build:auth 并提交生成文件。SDK 授权声明保留在 bundle 中。

## 接口与验证

- GET /api/health：是否配置就绪，不代表 DeepSeek 余额充足。
- GET /api/account：带 Firebase Bearer ID token，返回当日预算。
- POST /api/chat：带同一 token，JSON 消息，返回 SSE。最大请求 128 KiB；禁止客户端 system/tool 消息。

```powershell
pnpm test
node scripts/test-budget-runtime.mjs
pnpm worker:check
node scripts/verify-cloud.mjs
python scripts/verify_chat.py
python scripts/verify_browser.py
```

Python 测试需要 requirements-test.txt 和 Playwright Chromium，先启动本地网页。MESHLAB_BASE_URL 可改地址。聊天 UI 测试明确模拟认证和 AI，不产生付费调用；Workerd 测试使用独立的本地 SQLite 对象，不接触线上预算。verify-cloud.mjs --live 仅在进程环境具备已验证账号的 FIREBASE_ID_TOKEN 时发送一条真实付费问答，不要在聊天中发送 token。

2026-10-28 已通过 17 项 Node 测试、真实 Workerd SQLite 并发/结算/隔离测试及浏览器模拟登录与聊天检查。真实收件箱验证需由邮箱本人完成。
