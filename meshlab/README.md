# 啮合实验室 · 开发与运行说明

啮合实验室包含 9 个独立实验和 35 个共用查看器的机构实验。网站使用原生 HTML、CSS、JavaScript 和 Three.js，浏览器可直接加载已提交的网页与模型资源。[第一次使用指南](../README.md) · [打开全部实验](https://slack-zh.github.io/meshlab/#structures)

## GL16 两级斜齿减速器

GL16 包含 49 个可选 CAD 零件，支持中文朗读、爆炸展开、七步拆装和传动演示。设计输入为 1.5 kW、1440 r/min，两级各减速 4 倍，输出为 90 r/min。按总效率 0.96 估算，输出转矩为 152.8 N·m。[在线拆装](https://slack-zh.github.io/meshlab/lab.html) · [STEP 模型、图纸和零件清单](https://slack-zh.github.io/meshlab/lab.html?view=engineering)

## 汽轮机与自行车链传动

[汽轮机](https://slack-zh.github.io/meshlab/turbine.html)可调整叶片与级数。功率按蒸汽工况、流量和设定效率估算。[自行车链传动](https://slack-zh.github.io/meshlab/bicycle.html)可调整踏频和前后链轮齿数，观察链速、后轮转速与理论车速。分别参见[汽轮机几何说明](dist/turbine/GEOMETRY.md)和[链传动计算说明](dist/bicycle/DESIGN.md)。

## 摩擦轮实验

入口为 [在线实验](https://slack-zh.github.io/meshlab/friction.html)，复用现有减速器的公共 UI，参数放在模型下方。可调整主动/从动轮直径、轮宽、输入转速、压紧力、摩擦系数和负载转矩。几何尺寸变化会重建两轮并保持外接相切；接触载荷变化只更新计算。

点击播放观察相反转向，使用爆炸、复原、逐步拆装和零件目录检查结构。原理页说明速比与摩擦容量，AI 提问会附带本次问题对应的参数和选中零件。1× 为实际输入转速的 20% 慢放；超载只提示打滑风险，不计算实际滑移速度。详细公式与范围见 [friction/DESIGN.md](dist/friction/DESIGN.md)。

## 单级直齿圆柱齿轮实验

入口为 [在线实验](https://slack-zh.github.io/meshlab/spur.html)，公共视图、控制栏、拆装和 AI 与既有实验一致，参数位于模型下方。主动齿数、从动齿数、模数和齿宽控制几何；输入转速、输入转矩与效率控制运动和计算。预设提供 20/40、30/30、40/20 齿组合。

传动比定义为 `i=z₂/z₁=n₁/|n₂|`，外啮合从动轮反向；非零转速时按 `T₂=T₁iη`、`P₂=P₁η` 计算稳态输出。零转速时功率为 0，不推算静态输出转矩。1× 演示为实际输入转速的 20% 慢放；轮齿几何、假设和参考资料见 [spur/DESIGN.md](dist/spur/DESIGN.md)。

## 带惰轮齿轮列实验

入口为 [在线实验](https://slack-zh.github.io/meshlab/idler.html)。参数区可切换带惰轮的三轮传动与两轮直接啮合；各轮齿数、共同模数和齿宽控制几何，输入转速、转矩与单次啮合效率控制运动和结果。三个齿轮、两次啮合的模式显示 12 个组件，直接模式显示 8 个。

总速比大小始终为 `i=z₃/z₁`。带惰轮时输出同向、总效率为 `η²`；直接啮合输出反向、效率为 `η`。无惰轮模式禁用并忽略中间齿数，保留其输入以便切回。零速功率为 0，静态输出转矩不由稳态公式推算。模型延续 20°、零变位教学齿廓及简化齿根，详见 [idler/DESIGN.md](dist/idler/DESIGN.md)。

## 交叉平带传动实验

入口为 [在线实验](https://slack-zh.github.io/meshlab/belt.html)。交叉模式默认开启，输出与输入反向；同页提供开口平带对照，输出同向。参数区可改变主动/从动带轮有效直径、中心距、带宽、输入转速、转矩及效率。改变几何或带路会暂停并重建，调整运行参数保留几何。

轮径按皮带中性层有效节径定义，理想无滑动速比为 `i=D₂/D₁`。结果展示包角、带速、投影理论带长、输出转矩及功率损失；交叉处三维避让不计入投影长度，不用于采购或裁带。零转速功率为 0，不由稳态公式推算静态输出转矩。详细计算与边界见 [belt/DESIGN.md](dist/belt/DESIGN.md)。

## 同步带传动实验

入口为 [在线实验](https://slack-zh.github.io/meshlab/timing.html)。固定开口同向布置、5 mm 节距，带轮齿数决定速比；参数包括主动/从动齿数、目标中心距、带宽、输入转速、转矩与效率。通过预设 20/40、30/30、40/20 齿比较减速、等速和增速。

目标中心距用于匹配最近整数带齿数 N，再按 `L=N×5 mm` 求实际中心距；实际值和差值在参数下方显示，模型按实际位置装配。包角换算的理论包络齿数不等于瞬时完整承载齿数。零转速功率为 0，静态输出转矩不由稳态公式推算。T5 启发的教学轮廓、几何假设与参考资料见 [timing/DESIGN.md](dist/timing/DESIGN.md)。

## 丝杠螺母传动实验（台虎钳）

入口为 [在线实验](https://slack-zh.github.io/meshlab/vice.html)。默认半剖固定钳体与螺母，钳口处于最大开口的一半。单线导程等于螺距，参数包括导程、丝杠直径、钳口宽度、最大开口、输入转速、转矩与效率；方向选择为张开 +1 / 闭合 −1。

改变方向或运行参数保留当前位置；几何更新暂停并回中位。到 0 或最大开口自动停止，不循环；反向可从端点继续，复原则回中位。实时位移与圈数来自模型状态，理论进给速度为 `v=方向×导程×RPM/60`。给定效率下的运行推力不代表静态夹紧力或额定承载，零 RPM 不推算运动推力。说明与参考资料见 [vice/DESIGN.md](dist/vice/DESIGN.md)。

## 35 项参数化机构目录

入口为 [在线实验](https://slack-zh.github.io/meshlab/catalog.html?model=universal-joint)，首页也提供可搜索的「结构目录」。本批覆盖清单第 24–34、36–37、39–60 项，共 35 项，包含万向节、离合器、后拨、雨刮、转向、行星传动、变速箱、凸轮及动力系统。完整编号、ID 与能力见 [catalog/README.md](dist/catalog/README.md)。

视图框、AI 面板、播放/速度/爆炸/复原按钮及逐步拆装沿用现有实验布局；机构选择和参数位于模型下方。调转速保留相位；其他参数变化先验证，再暂停并重建。无效组合显示原因，当前有效模型不被非法参数替换。页面结果对应设置工况，暂停不等于把理论工况转速改为零。1× 为工况的 20% 慢放。

「原理」与「资料」页提供公式、假设和来源；教学简化逐项列明，不宣称制造级全实体接触或承载验收。AI 附带每次提问时的模型、有效参数、选中组件和运动结果；原生 catalog 上下文仅在后端健康检查明确支持后使用，正式能力应在后端上线后确认。纯静态预览仍可使用全部三维功能。

```sh
npm run test:catalog
npm run build:catalog
```

前者运行模型、集成和专项回归测试，后者依次运行 page、index 两个生成脚本，更新 `dist/catalog.html`、首页机构目录和索引。模型描述符在 `dist/catalog/models-*.mjs`，公共接口见 [CONTRACT.md](dist/catalog/CONTRACT.md)。

## 本地运行

要使用 AI 聊天，在本目录运行 `node --env-file-if-exists=.env server/local.mjs`，需要 Node.js 22+。本地预览代理到云端，邮箱登录及每日预算与正式网站共享，无需本机 DeepSeek 密钥。详细步骤见 [AI 接入说明](docs/AI-SETUP.md)，后续开发见 [分步计划](docs/AI-ROADMAP.md)。

仅浏览三维网页时也可使用以下静态服务（不提供聊天 API）：

在含 `package.json` 的 `meshlab/` 目录运行：

```sh
python -m http.server 8080 --directory dist
```

浏览器打开 http://localhost:8080 。请通过 HTTP 服务打开，不要直接双击 HTML；模型使用 fetch 和 ES modules。网页已包含 Three.js 和模型资源，语音质量取决于设备中文语音支持。

## 文件结构

- `dist/`：可直接部署的网站，`index.html`、`app.js`、`apple.css`、`apple.js` 是网页源代码。
- `dist/assets/`：Three.js、OrbitControls、CAD 网格和模型参数。
- `dist/friction/`：摩擦轮参数、计算、三维模型、交互和 AI 上下文。
- `dist/spur/`：单级直齿轮参数、计算、三维模型、交互和 AI 上下文。
- `dist/idler/`：带惰轮齿轮列的双模式模型、计算、交互和 AI 上下文。
- `dist/belt/`：交叉平带与开口对照的几何、计算、交互和 AI 上下文。
- `dist/timing/`：固定节距同步带的逐齿模型、带长匹配、计算和 AI 上下文。
- `dist/vice/`：台虎钳丝杠螺母的直线进给、端点限制、运行估算和 AI 上下文。
- `dist/downloads/`：STEP、PDF、BOM 与工程资料包。
- `dist/previews/`：桌面、手机和深色版实际浏览器截图。
- `scripts/`：参数化 CAD、文档生成、工程验证及浏览器检查脚本。
- `docs/`：本版设计审查和已执行的界面检查记录。

## 重新生成工程资料（可选）

建议使用 Python 3.12 独立虚拟环境。浏览网页不需要安装这些依赖。

```sh
pip install -r requirements-engineering.txt
python scripts/build_model.py
python scripts/build_documents.py
python scripts/validate_engineering.py
```

这些命令会重新生成并覆盖 `dist/assets/` 和 `dist/downloads/` 中相关文件。原始实体单位为 mm，轴线沿 Z；STEP 不包含原生 CAD 特征树及装配约束。

## 浏览器验证（可选）

先启动上述本地服务，再在另一终端运行：

```powershell
$env:MESHLAB_BASE_URL = 'http://127.0.0.1:8080/lab.html'
pip install -r requirements-test.txt
python -m playwright install chromium
python scripts/verify_browser.py
```

`MESHLAB_BASE_URL` 应指向 GL16 实验页，`CHROMIUM_PATH` 可指定浏览器。结果写入 `test-results/`。本版检查使用 Chromium；尚未在实体 iPhone 上验证。

## 部署

网页使用 [GitHub Pages](https://slack-zh.github.io/meshlab/)，仓库根目录 `.github/workflows/pages.yml` 在 main 更新时发布 `meshlab/dist/`，无需构建命令。聊天 API 由 Cloudflare Worker 提供，地址及公开 Firebase 配置在 `dist/chat-config.json`，使用 AI 时请用邮箱和密码登录；页面提示验证邮箱时再按提示操作。每日预算由云端 SQLite 持久记账，北京时间零点重置。静态托管不会运行 `server/`。后端部署与 Secret 管理见 [AI 接入说明](docs/AI-SETUP.md)。

## 设计预览

![桌面预览](dist/previews/desktop.png)

[手机预览](dist/previews/mobile.png) · [深色预览](dist/previews/desktop-dark.png)

## 工程与依赖说明

GL16 为参考工业产品公开资料的独立本科课程设计，并非厂家内部图纸复原或投产认证。载荷、材料与许用值假设见设计说明书；投产前需进一步完成工艺、公差链与标准强度验证。

使用的 Apple Design Skill 为社区设计参考；网页玻璃效果由 CSS 实现。Third-party Three.js / OrbitControls 使用 MIT 许可，原文件保留版权声明。资料来源链接见网页工程资料页和 `scripts/manufacturer-reference.md`。
