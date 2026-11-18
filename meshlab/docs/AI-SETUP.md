# AI 助手：登录、提问和每日额度

浏览三维模型和使用拆装功能都可以直接开始。想让助手解释眼前的零件或计算结果时，再用邮箱登录。

## 怎样提问

1. 进入一个实验，点选你想了解的零件。
2. 打开「AI 助手」，点「登录 / 注册」。首次使用请选择注册，输入邮箱并设置至少 8 位的密码。仓库默认配置允许注册后直接提问。
3. 输入问题，按 Enter 发送，Shift+Enter 换行。例如，选中减速器的输出轴后问「动力经过哪两级齿轮传到这根轴？」。回答会逐段显示，可以停止、重试或继续追问。

如果页面出现「验证邮箱」，说明当前服务启用了邮箱验证。点击验证邮件中的链接，再回到页面点「我已验证」。找不到邮件时查看垃圾邮件，或在登录窗口重新发送。忘记密码可在登录窗口输入注册邮箱并申请重置。

聊天记录保存在当前页面，刷新、退出或更换账号会清空。需要留作笔记的回答请先复制。助手可以解释模型，调整参数和播放动画由你操作。

## 看到「今日预算占用」时怎么办

网站为每个登录账号提供每天 2 元的 AI 额度，调用费用由网站维护者承担。电脑和手机登录同一账号时共用额度，每天北京时间零点重置。

发出问题时系统先为这次回答预留额度，所以生成过程中也能看到占用金额。回答结束后按服务端返回的用量结算。若提示剩余额度不足，可以缩短对话再试，或等到次日。等待期间仍可继续操作三维实验。

## 维护者参考

网页由 GitHub Pages 提供，Cloudflare Worker 处理聊天请求。Firebase 验证账号身份，DeepSeek 密钥保存在 Worker。邮箱验证策略由 `wrangler.jsonc` 的 `REQUIRE_EMAIL_VERIFICATION` 控制，配置值为 `"false"` 时允许注册后直接聊天。调整此项后需重新部署 Worker，前端从 `/api/health` 读取生效的策略。

### 预算规则

- 按 Firebase 项目和已登录账号的 UID 分别统计，Cloudflare Durable Object SQLite 持久保存，跨设备和服务重启共享预算。
- 北京时间零点重置；跨零点的请求计入开始当天。
- 先原子预留本次输入和最大输出的保守成本，再按服务端返回的 token 用量结算；同时请求不能绕过预留。剩余预算不足以容纳本次预留时会提前拒绝。
- 仓库对 deepseek-flash 采用 2026-10-28 记录的预算计价参数，每百万 token 按未缓存输入 2 元、输出 8 元估算，不计缓存和低谷优惠。因此网页预算可能高于 DeepSeek 实际账单。
- 停止、断网或上游缺少完整用量时保留预留金额，避免未知消费被误退。生成中金额也显示在“今日预算占用”中。
- 每账号每分钟最多 12 次、同时最多 2 次，最大输出 2048 token。更换模型前必须更新计价规则，未配置价格的模型拒绝调用。

价格依据：[DeepSeek 官方价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)。后续调价应同步修改 server/budget.mjs，保守预留不是供应商侧账单硬限额。

### 本地预览

在源码目录 `meshlab/`（含 `package.json`）打开终端。推荐使用 Node.js 24.14+。

```powershell
node --env-file-if-exists=.env server/local.mjs
```

启动后在浏览器打开 [本地首页](http://127.0.0.1:8080/)，可通过 PORT 修改端口。服务只监听本机。本地 /api 代理到 dist/chat-config.json 指定的云端，使用同一邮箱登录和预算，不提供绕过计费的本地入口。无需在本机配置 DeepSeek 密钥。

若本机需要使用已有代理，可在同一终端设置 HTTPS_PROXY、NO_PROXY=localhost,127.0.0.1，以 Node.js 24 的 --use-env-proxy 参数启动。不需要修改系统代理。

### Firebase 配置

当前项目 meshlab-680d9 使用免费 Spark 方案。Authentication 中启用 Email/Password；Authorized domains 添加 slack-zh.github.io，本地测试可添加 localhost 和 127.0.0.1。前端公开配置位于 dist/chat-config.json，其中 Firebase Web API Key 是客户端项目配置，不是 DeepSeek 密钥或 Firebase 管理员私钥。

后端核验 ID token 的签名、项目、签发者、时间、账号 UID 和登录方式。服务启用邮箱验证时，还会核验邮箱的验证状态。浏览器提交的 UID 或金额不参与授权或计价。没有管理员服务账号密钥。

### 后端部署

```powershell
pnpm install --frozen-lockfile
pnpm worker:login
pnpm exec wrangler secret put DEEPSEEK_API_KEY
pnpm worker:deploy
```

密钥在终端私密输入，不提交版本库。已有密钥无需重复设置。wrangler.jsonc 指定允许的网页源、Firebase 项目、模型，以及 ACCOUNT_BUDGET SQLite Durable Object。保留其名称和存储，避免重新创建而丢失预算。旧的 CHAT_ACCESS_TOKEN 和口令文件不再使用。

网页由仓库根目录 .github/workflows/pages.yml 发布 meshlab/dist/。认证 SDK 已打包进 dist/assets/firebase-auth.js；更新 Firebase 依赖后运行 pnpm build:auth 并提交生成文件。SDK 授权声明保留在 bundle 中。

### 接口与验证

- GET /api/health：是否配置就绪，不代表 DeepSeek 余额充足。
- GET /api/account：带 Firebase Bearer ID token，返回当日预算。
- POST /api/chat：带同一 token，JSON 消息，返回 SSE。最大请求 128 KiB；禁止客户端 system/tool 消息。

```powershell
pnpm test
node scripts/test-budget-runtime.mjs
pnpm worker:check
node scripts/verify-cloud.mjs
$env:MESHLAB_BASE_URL = 'http://127.0.0.1:8080/lab.html'
python scripts/verify_chat.py
python scripts/verify_browser.py
```

Python 测试需要 requirements-test.txt 和 Playwright Chromium，先启动本地网页。MESHLAB_BASE_URL 可改地址。聊天 UI 测试明确模拟认证和 AI，不产生付费调用；Workerd 测试使用独立的本地 SQLite 对象，不接触线上预算。verify-cloud.mjs --live 仅在进程环境具备已验证账号的 FIREBASE_ID_TOKEN 时发送一条真实付费问答，不要在聊天中发送 token。

2026-10-28 已通过 17 项 Node 测试、真实 Workerd SQLite 并发/结算/隔离测试及浏览器模拟登录与聊天检查。真实收件箱验证需由邮箱本人完成。
