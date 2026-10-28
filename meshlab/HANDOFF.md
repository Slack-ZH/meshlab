# 项目交接

> 2026-10-28 更新：按网站维护者要求，暂时关闭邮箱验证。注册或邮箱密码登录后即可聊天，不自动发送验证邮件；每账号每日 2 元预算不变。恢复时将 wrangler.jsonc 的 REQUIRE_EMAIL_VERIFICATION 改为 "true" 并重新部署 Worker，前端会自动采用云端策略。以下涉及强制验证的步骤仅在重新开启后适用。

## 当前版本

本目录为啮合实验室 Apple Design 风格第二版源码。网页由原生 HTML/CSS/JavaScript 和随附 Three.js 构成，无构建步骤。直接编辑 `dist/index.html`、`dist/apple.css`、`dist/apple.js`、`dist/app.js`。旧版配色文件已从此目录清理。

## 品牌名称

中文统一为“啮合实验室”，英文品牌统一为小写 `meshlab`。GL16 是减速器型号，保留工程编号、零件 ID 与单位。

## 用户希望保留的内容

- 机械专业本科生使用：真实参数依据、公式、选型与初步校核。
- 49 个可选部件，三维旋转、爆炸展开、复原、七步拆装、比例正确的传动动画。
- 中文文字讲解和点击朗读，电脑、平板、手机适配。
- 少量 Apple 风格液态玻璃，集中在导航与操作栏；阅读面板实色、清晰。
- CAD 模型、PDF 图纸、BOM 和工程资料下载。

## 后续修改入口

先读 README.md 和 docs/DESIGN-REVIEW.md。`docs/verification.json` 是上传前的检查记录，修改后按变化范围重新验证。`scripts/verify_browser.py` 可验证主要交互；执行方法见 README。

不得把演示动画转速当作设计转速。工程模型的齿数、中心距、轴系结构和说明书具有对应关系，调整参数时同步更新几何、下载文件及讲解。

## 托管现状（本次交接时）

- Netlify 账户不可用，网页已迁移至 https://slack-zh.github.io/meshlab/ 。
- 仓库根目录 `.github/workflows/pages.yml` 将 main 中的 `meshlab/dist/` 发布到 GitHub Pages。
- 2026-10-27 新增本地 DeepSeek 聊天，真实两轮问答、原网页回归通过。
- 2026-10-28 Cloudflare 后端已部署：`https://meshlab-chat.meshlab-chat.workers.dev/api`。9 项 API 测试及云端真实问答、跨域预检、无口令拦截通过。已修复 Workers 不支持 `redirect:error` 的兼容问题，使用 manual 并拒绝上游跳转。
- 前端通过 GitHub Pages 工作流发布。运行与部署见 `docs/AI-SETUP.md`，开发阶段见 `docs/AI-ROADMAP.md`。
- 密钥由 `server/` 读取环境变量，不得放进静态网页、版本库或聊天消息。暂未增加 AI 控制模型的执行接口。
- 2026-10-28 改为 Firebase 邮箱密码登录，验证邮箱后可聊天；按 Firebase UID 在 Cloudflare Durable Object SQLite 中统计每日 2 元预算，北京时间零点重置。价格和未知用量按保守规则核算，详见 `docs/AI-SETUP.md`。
- `.env.worker-secrets.json` 为本机私有文件，仅保留 DeepSeek 部署密钥；旧访问口令文件和云端 Secret 已移除。公网部署必须使用 `server/worker.mjs` 入口；本地预览同样代理云端认证和预算。

## 资源边界

STEP 不包含原生 CAD 特征树或装配约束。本项目是独立课程设计，工程假设及简化见 PDF 说明书；不得表述为厂家原机内部设计或制造认证。
