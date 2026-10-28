# DeepSeek 本地聊天

本地问答已经验证。Cloudflare 部署入口已准备，GitHub Pages 托管静态网页，Cloudflare Worker 提供聊天 API；发布前通过 `scripts/verify-cloud.mjs` 检查线上连通性。

## 启动

需要 Node.js 22 或更新版本。本次验证使用 Node.js 24。

1. 在 `meshlab/`（含 `dist/`、`server/` 的目录）打开终端。
2. 如果终端已有 `DEEPSEEK_API_KEY` 环境变量，直接启动；否则将 `.env.example` 复制为 `.env`，在本机编辑器中填入密钥。不要把密钥发到聊天或写进 `dist/`。
3. 运行：

```powershell
node --env-file-if-exists=.env server/local.mjs
```

打开终端显示的地址，默认 `http://127.0.0.1:8080`。关闭服务终端会停止聊天。当前演示服务使用 8787 端口；重启同一地址可先设置 `$env:PORT='8787'`。

如果本机必须通过代理访问 DeepSeek，在同一个终端设置已有代理（以下端口仅为示例），再使用 Node.js 24 的代理开关：

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7890'
$env:NO_PROXY='localhost,127.0.0.1'
node --use-env-proxy --env-file-if-exists=.env server/local.mjs
```

不要为此修改系统代理。服务器只监听 `127.0.0.1`，不对局域网开放。密钥由后端读取；浏览器仅访问本机 `/api/chat`，不会收到密钥。

## 使用

- 选中三维零件，再在右侧 AI 助手提问，发送时会附带该零件的资料。
- 可以连续追问、停止回复、失败后重试、开始新对话。
- Enter 发送，Shift+Enter 换行；中文输入法选词时不会误发送。
- “零件解读”保留原说明、外壳显示选项和朗读功能。
- 对话只保留在当前页面内存中，刷新即清空。上下文最多保留最近十轮，并按长度缩短；较早的聊天记录可能仍显示，但不再发送给模型。
- 当前 AI 只能文字问答。模型播放、展开、拆装仍由网页按钮控制。

默认模型 `deepseek-flash`，在服务端环境变量 `DEEPSEEK_MODEL` 中修改。接口依据 [DeepSeek 官方文档](https://api-docs.deepseek.com/api/create-chat-completion)，固定请求 `https://api.deepseek.com/chat/completions`，关闭思考模式以缩短交互等待时间。实际请求使用你的 API 账户额度。

## 文件与接口

| 文件 | 用途 |
| --- | --- |
| `dist/chat.js`、`chat.css` | 聊天面板、上下文、流式回复和交互 |
| `dist/chat-stream.js` | 解析 SSE 的可见回答内容 |
| `dist/chat-config.json` | 公开后端地址；禁止填写密钥 |
| `server/local.mjs` | 本机网页和 API 服务，无第三方运行依赖 |
| `server/chat-api.mjs` | 校验消息、补充模型资料、调用 DeepSeek |

- `GET /api/health`：报告是否配置完成，不代表已验证余额或密钥有效性。
- `POST /api/chat`：请求 `{ "messages": [{ "role": "user", "content": "这个零件的作用？", "selectedPartId": "input" }] }`，响应为 SSE。
- 历史消息按 user/assistant 交替排列；客户端不能提交 system/tool 消息。选中零件的资料从服务端已有模型文件取得。
- 单问题最多 2000 字符；请求体最多 128 KiB；单实例每分钟 12 次、同时最多 2 个请求，65 秒上游超时。
- 输出作为纯文本显示，不执行 AI 返回的 HTML 或 JavaScript。

## 验证

```powershell
node --test scripts/test-chat.mjs
pip install -r requirements-test.txt
python -m playwright install chromium
python scripts/verify_browser.py
python scripts/verify_chat.py
```

浏览器脚本默认测试 `http://127.0.0.1:8080/`，可设置 `MESHLAB_BASE_URL`。`verify_chat.py` 默认用明确的模拟响应检查界面；设置 `MESHLAB_LIVE_CHAT=1` 才会发送两次真实模型请求。结果和截图位于忽略版本控制的 `test-results/`。

## 下一步：上线

部署配置在 `wrangler.jsonc`，入口为 `server/worker.mjs`。当前后端地址为 `https://meshlab-chat.meshlab-chat.workers.dev/api`，前端配置在 `dist/chat-config.json`。本地服务会覆盖此配置为 `/api`，因此本地问答仍通过本机后端。

部署时须使用平台的 Secret 保存 `DEEPSEEK_API_KEY` 和至少 24 字符的 `CHAT_ACCESS_TOKEN`，设置 `ALLOWED_ORIGINS=https://slack-zh.github.io`。远程调用必须有访问口令，本地模式不可直接用于公网。用户在浏览器输入的是聊天访问口令，不是 DeepSeek 密钥。当前限流仅覆盖单实例；正式多实例服务需要平台层的配额和限流。

安装项目依赖后，部署步骤如下（已锁定 Wrangler 版本，使用 `pnpm install --frozen-lockfile`）：

```powershell
pnpm worker:check
pnpm worker:login
pnpm worker:deploy
```

首次部署需设置上述两个 Secret。可以在 Cloudflare 控制台的 Worker → Settings → Variables and Secrets 中添加，也可使用 `pnpm exec wrangler secret put DEEPSEEK_API_KEY` 和 `pnpm exec wrangler secret put CHAT_ACCESS_TOKEN`，在交互提示中输入。Secret 更新会触发部署。

本机此次部署使用忽略版本控制的 `.env.worker-secrets.json`，通过 `wrangler deploy --secrets-file .env.worker-secrets.json` 一次上传代码和 Secret。其中含敏感值，不能上传到 GitHub。`.chat-access-code.txt` 只保存网页访问口令，同样已忽略；可在本机复制后填入网页“聊天访问口令”。不要将 API Key 填入网页。

部署后先执行 `node scripts/verify-cloud.mjs` 检查 HTTPS、跨域及未授权拦截。加 `--live` 会发送一次真实请求，使用 DeepSeek API 额度。需要本机代理时使用 Node.js 的 `--use-env-proxy`。新域名必须通过 HTTPS 验证，才更新发布前端。

依据：[Cloudflare 部署指南](https://developers.cloudflare.com/workers/get-started/guide/)、[Secret 配置](https://developers.cloudflare.com/workers/configuration/secrets/)。
