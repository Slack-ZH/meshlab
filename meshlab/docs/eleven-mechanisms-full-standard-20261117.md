# W 的 11 个机构：完整标准补齐与本地验收记录

2026-11-17（香港时间）。基准为用户指定的 **摩擦轮传动 + 齿轮齿条传动**，三维外观继续采用项目 GL16 视觉基准。

**11 项的功能补齐及本地逐项检查已完成，等待用户统一验收。** 本记录更新了 11 月 16 日审计中的“待补齐”状态；历史审计保留为整改依据。

本轮仅处理 W 的这 11 项。没有新增机构，没有修改朱赫、李东林负责的模型；没有提交、推送、同步或部署，也没有修改原表格状态。工作区开始前已有的其他改动保持原样。

## 本地入口与逐项结果

[打开本地实验](http://127.0.0.1:8091/scotch-yoke.html)，页面“切换机构”包含全部 11 项。预览进程为项目现有 `server/local.mjs`，本轮使用端口 8091。

| 序号 | 机构 | 已核对的专属实验行为 | 状态 |
| --- | --- | --- | --- |
| 1 | [苏格兰轭机构](http://127.0.0.1:8091/scotch-yoke.html) | 曲柄销/滑块拖动、槽内滑动、与曲柄滑块位移对比 | 本地检查通过，待验收 |
| 2 | [曲柄摇杆四杆机构](http://127.0.0.1:8091/crank-rocker.html) | 杆长即时改变、整周输入、输出摆角上下限 | 本地检查通过，待验收 |
| 3 | [平行四边形四杆机构](http://127.0.0.1:8091/parallelogram.html) | 直接拖动台灯臂、末端连杆姿态保持 | 本地检查通过，待验收 |
| 4 | [双摇杆机构](http://127.0.0.1:8091/double-rocker.html) | 输入拖动、有效支路与输出摆动范围 | 本地检查通过，待验收 |
| 5 | [曲柄导杆急回机构](http://127.0.0.1:8091/quick-return.html) | 曲柄销拖动、工作/空回用时及急回系数 | 本地检查通过，待验收 |
| 6 | [直齿锥齿轮副](http://127.0.0.1:8091/bevel-gears.html) | 相交轴运动、齿数/速比/输出转速联动 | 本地检查通过，待验收 |
| 7 | [剪式千斤顶](http://127.0.0.1:8091/scissor-jack.html) | 丝杠转数与高度、上下行程边界及反向启动 | 本地检查通过，待验收 |
| 8 | [棘轮棘爪](http://127.0.0.1:8091/ratchet-pawl.html) | 驱动与回程切换、回程输出保持、单向累积运动 | 本地检查通过，待验收 |
| 9 | [偏心轮与直动从动件](http://127.0.0.1:8091/eccentric-follower.html) | 偏心距/行程联动、零偏心距、直接拖动 | 本地检查通过，待验收 |
| 10 | [盘形凸轮与滚子从动件](http://127.0.0.1:8091/roller-cam.html) | 推程、两段停歇、回程及角度约束、直接拖动 | 本地检查通过，待验收 |
| 11 | [日内瓦槽轮机构](http://127.0.0.1:8091/geneva-drive.html) | 槽数/分度角联动、停歇输出保持、直接拖动 | 本地检查通过，待验收 |

## 11 项共同补齐的标准

- 使用实际基准的公共导航、SVG 图标、可展开目录、AI/零件解读切换、邮箱登录界面及降低透明度开关。
- 零件目录支持名称/说明/规格搜索及分类筛选；每个实际组件都有独立规格、作用与外观说明，选中高亮和标注开关联动。
- 接入中文朗读按钮，并处理切换选中、停止朗读及语音不可用状态。
- 每个参数都有数值框与配套滑块，修改即更新模型、规格、读数和曲线。无效输入暂停计算和导出，保留上一有效三维模型；修正后恢复。
- 每个机构都有与实际部件对应的四步拆装标题、说明、选中件和拆装顺序；全部展开、复原与逐步复装保留输入位置。
- 保留各自的运动操作、原理与当前工况示例、参数 JSON、带单位表头的 361 点采样 CSV。
- 统一为 **1× = 工况的 20% 慢放**，倍速不改变工况数值。拆装、切换页签或隐藏页面时暂停。
- AI 每次提问携带本机构、当前参数、计算结果、选中零件与规格、拆装状态；无效输入与上一有效模型明确分开。重试沿用原快照，追问使用新快照，支持停止和新对话。
- 桌面及 390×844、360×740 手机布局检查默认、选中、展开和拆装状态；手机测量与参数位于模型之后、助手之前。

GL16 共享材质、灯光、浅网格、落影、蓝色选中和 16% 透明支承保留。修复了控制栏与操作提示的遮挡、全屏空间分配，以及苏格兰轭/急回机构被连接件遮挡时无法拖动输入的问题；拖动按下时保持原角度。

## 检查证据

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 11 项完整页面交互、参数、导出、桌面/手机/深色/全屏 | 132 / 132 通过 | [browser-report.json](backup-evidence-20261117/full-standard/browser-report.json) |
| 11 项 AI 发送、错误提示、原快照重试、追问、无效输入、拆装、停止、清空 | 44 / 44 通过；模拟登录和流式接口 | [chat-browser-report.json](backup-evidence-20261117/full-standard/chat-browser-report.json) |
| 8 项直接指针拖动、5 项铰点标注、11 项手机拆装控件 | 24 / 24 通过 | [input-browser-report.json](backup-evidence-20261117/full-standard/input-browser-report.json) |
| 原有 5 个实验共享聊天兼容性及 11 项最终状态文字 | 16 / 16 通过 | [compatibility-report.json](backup-evidence-20261117/full-standard/compatibility-report.json) |
| 运动约束、生产三维组件、20% 播放、上下文及原有模型协议等 | 90 / 90 通过 | [unit-report.tap](backup-evidence-20261117/full-standard/unit-report.tap) |
| 其他机构、两个基准、公共样式/认证及服务端文件保护核对 | 40 个文件哈希一致 | [protected-after.json](backup-evidence-20261117/full-standard/protected-after.json) |

截图保存在本地完整备份；见[证据索引](backup-evidence-20261117/README.md)。浏览器使用独立无头配置，未读取用户浏览器账号。运行中发现的问题修复后已复测；最终上述报告均通过且未记录浏览器运行异常。

## 仍需在统一验收时确认的体验

AI 的真实服务健康检查及登录弹窗入口已通过；没有使用用户账号登录或发送真实付费问题。聊天交互与请求内容通过模拟接口和服务端协议测试，**真实模型的回答质量尚未验证**。兼容请求沿用齿轮齿条的文字快照方式，本轮没有向云端部署新协议。

朗读检查验证了中文语音 API、文本和停止调用，实际发声仍取决于验收设备可用的中文语音。

额外尝试项目的服务端认证/通用聊天测试时，`test-auth.mjs` 与 `test-chat.mjs` 因本地未安装 `jose` 依赖而未能运行；没有为此改动服务端或其他项目依赖。不能把本次结果表述为完整 `npm test` 已通过。与这次改动相关的 90 项测试及上述浏览器检查已通过。

## 实现与复查入口

- [experiments/app.mjs](../dist/experiments/app.mjs)、[catalog.mjs](../dist/experiments/catalog.mjs)、[style.css](../dist/experiments/style.css)：11 项公共功能、参数、规格与逐机构拆装内容。
- [chat-context.mjs](../dist/experiments/chat-context.mjs)、[chat.js](../dist/chat.js)：新增机构的上下文接入；其他模型继续走原有请求构造器。
- [build-experiments.mjs](../scripts/build-experiments.mjs)：仅生成本范围 11 个页面，基准页面只读。
- [test-experiment-standard.mjs](../scripts/test-experiment-standard.mjs)、[verify-full-standard.mjs](../scripts/verify-full-standard.mjs)、[verify-experiment-chat.mjs](../scripts/verify-experiment-chat.mjs)、[verify-experiment-input.mjs](../scripts/verify-experiment-input.mjs)、[verify-experiment-compatibility.mjs](../scripts/verify-experiment-compatibility.mjs)：复查脚本。

以上为开发阶段记录；2026-11-17 用户授权整理后同步至独立备份分支，不合并、不部署。本记录不代表用户已经验收通过。
