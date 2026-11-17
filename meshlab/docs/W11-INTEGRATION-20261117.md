# W 的 11 项机构整合交接 · 2026-11-17

这份代码以同学最新主线 `b63af270c49bab4c35fcd6468d691ef69f83a408` 为基础，接入 W 的 11 项机构。统一首页现有 **55 个实验：原有 44 项 + W 的 11 项**。双方的模型成果和原有入口均保留。

分支：`codex/integrate-w11-20261117`。本次只上传独立整合分支，**没有改 main、合并或部署**。这是可供同学获取和审查的代码版本，线上网站仍是原发布版本。

## 同学如何查看

可以在本分支选择 Code → Download ZIP，或在一个新目录检出，避免覆盖自己尚未提交的工作：

```sh
git clone --single-branch --branch codex/integrate-w11-20261117 https://github.com/Slack-ZH/meshlab.git meshlab-w11-review
cd meshlab-w11-review/meshlab
pnpm install --prod --frozen-lockfile --ignore-scripts
pnpm start
```

打开终端显示的本地地址（默认 `http://127.0.0.1:8080/`），从首页“机构目录”搜索机构名称。页面的模型、参数、拆装、资料导出可以直接体验；真实 AI 仍需要有效账号和可达的既有服务。

[对比主线与整合分支](https://github.com/Slack-ZH/meshlab/compare/main...codex/integrate-w11-20261117)。审核完成后再决定是否合并和发布；本次没有创建或合并 PR。

## 本轮范围与逐项结果

| 机构 | 原负责人 | 页面 | 完整页面检查 | 模拟 AI | 桌面/手机默认、选中、拆装 | 验收 |
| --- | --- | --- | --- | --- | --- | --- |
| 苏格兰轭机构 | W | `scotch-yoke.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 曲柄摇杆四杆机构 | W | `crank-rocker.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 平行四边形四杆机构 | W | `parallelogram.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 双摇杆机构 | W | `double-rocker.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 曲柄导杆急回机构 | W | `quick-return.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 直齿锥齿轮副 | W | `bevel-gears.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 剪式千斤顶 | W | `scissor-jack.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 棘轮棘爪 | W | `ratchet-pawl.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 偏心轮与直动从动件 | W | `eccentric-follower.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 盘形凸轮与滚子从动件 | W | `roller-cam.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |
| 日内瓦槽轮机构 | W | `geneva-drive.html` | 12 / 12 | 4 / 4 | 已检查 | 待用户验收 |

**实现完成**：11 项已接入当前主线的首页目录和公共聊天界面。**本地检查通过**：本轮实际运行结果如下。**待用户验收**：不将自动检查当作用户验收，不修改原分工表状态。

## 整合方式和保留内容

- 首页沿用同学的可搜索目录，在原有 44 条记录之外增加 11 条；原记录的名称、编号、说明和 URL 逐项一致，未制造第二套首页入口。
- W 的完整界面复用 `dist/experiments/`，并仅带入其实际依赖的 `linkages/`、`mechanisms/` 运动学、查看器和模型说明，以及 `assets/reference-stage.mjs`。
- 公共 `chat.js` 保留当前主线的全部机构捕获、协议能力判断和不支持 catalog 服务时的提示；新增 W 的快照捕获及历史保存。没有 W 快照的请求直接交给当前主线原构造器，44 类既有实验的请求内容逐字节对照通过。
- W 的请求继续使用已有服务接受的逐轮文字快照。不同机构或旧/新机构混合历史会明确要求新对话，不把旧问题改写成新机构。
- 解除了原 W 公共聊天模块对独立齿轮齿条页面的依赖；本分支未带入额外的齿轮齿条实验、旧简化 app/style、整包备份资料、录屏、浏览器缓存或 node_modules。
- 保留 GL16 页面的相对 SVG 图标声明，避免默认 `/favicon.ico` 请求。其余模型实现、查看器、服务端、工作流和锁文件均未改动。[文件保护核对](w11-integration-20261117/preservation-report.json)

## 检查证据

| 检查 | 本轮结果 | 证据 |
| --- | --- | --- |
| W 的静态完整性、专属运动/上下文与整合约束 | 11 页静态检查通过；71 / 71 测试通过 | [单元摘要](w11-integration-20261117/unit-summary.json) |
| 同学原主线的运动、几何、模型、聊天与目录回归 | 265 / 265 通过 | [单元摘要](w11-integration-20261117/unit-summary.json) |
| npm test 所定义的通用聊天、预算和认证测试 | 17 / 17 通过 | [单元摘要](w11-integration-20261117/unit-summary.json) |
| W 的完整页面、参数、导出、桌面/手机布局 | 132 / 132 通过 | [页面报告](w11-integration-20261117/browser-report.json) |
| W 的模拟聊天、重试、无效输入、停止和清空 | 44 / 44 通过 | [聊天报告](w11-integration-20261117/chat-browser-report.json) |
| 直接拖动、铰点标注、手机拆装 | 24 / 24 通过 | [输入报告](w11-integration-20261117/input-browser-report.json) |
| 原 9 个独立实验及 W 的最终装配状态 | 20 / 20 通过 | [兼容报告](w11-integration-20261117/compatibility-report.json) |
| 55 项目录、桌面/手机搜索、11 条实际入口、原 35 个目录模型的选中/运动/拆装 | 49 / 49 通过 | [整合浏览器报告](w11-integration-20261117/integration-browser-report.json) |
| W 逐机构默认、选中及拆装截图核对 | 桌面与手机逐项复核；截图索引记录 3 种尺寸 | [视觉记录与截图哈希](w11-integration-20261117/visual-review.json) |

所有浏览器组的失败资源和运行错误均为 0。保留原断言，并增加了入口保留、跨机构历史和全部主线协议兼容检查，没有跳过失败获取通过。

复查入口（在 `meshlab/`）：

```sh
pnpm run check:experiments
pnpm run test:experiments
pnpm run test:audit
pnpm test
```

浏览器检查前先启动可访问的本地预览及独立 Chromium/Edge 调试实例，设置 `MESHLAB_BASE_URL`、`MESHLAB_CDP_URL`，再运行 `pnpm run verify:experiments`。浏览器组必须串行执行。原始截图和运行日志保存在本地被忽略的 `test-results/`，本分支保存结构化报告与索引。

## 验证边界

本机使用 Node 22.23.2，并按原锁文件以 `--prod --frozen-lockfile --ignore-scripts` 补齐依赖，未改变版本。Node 22 的原预览服务不能自动继承本机代理，因此本次浏览器检查使用独立静态预览，通过既有代理读取真实健康接口，并禁止真实 POST；没有修改产品服务端或设备代理配置。

真实账号 AI 回答质量、设备实际中文语音、Cloudflare 生产环境行为和用户验收仍未验证。35 项目录模型保留主线已有的服务能力保护，不因本次代码整合绕过它。此次整合不包含云端后端发布、网站部署或参赛提交。
