# 五个连杆机构实验

入口：`scotch-yoke.html`、`crank-rocker.html`、`parallelogram.html`、`double-rocker.html`、`quick-return.html`。统一首页“机构目录”提供全部入口，实验页的“切换机构”菜单可互相切换。

这是截图中第 18–22 行的五项教学实验。所有前端资源随仓库提供，可直接静态托管，不需要构建或外部模型服务。

## 实现

- `mechanics.mjs`：参数定义、有效性校验、几何闭合、采样与播放推进；不依赖浏览器。
- `viewer.mjs`：参数化杆件、长槽、铰链销、轴承座与导向结构；统一调用 `assets/reference-stage.mjs` 的 GL16 材质、灯光、地面、取景和选中高亮。
- `../experiments/app.mjs` / `style.css` / `catalog.mjs`：11 个 W 机构共用的操作界面、图表、零件规格、专属拆装讲解和导出。页面复用基准的 `apple.css`、`apple.js`、`chat.css` 和登录界面。
- `../experiments/chat-context.mjs`：提问时的机构、参数、结果、选中件和拆装快照；重试保留原快照。通过共享 `chat.js` 接入现有服务。
- 五个 HTML 为完整静态入口；运行 `node scripts/build-experiments.mjs` 生成全部 11 页；只生成本组时调用该模块的 `buildPages(names)` 并传入上述五个标识。界面仅使用完整的 `experiments/` 公共实现。

长度单位 mm，角度单位度，时间单位秒。旋转机构的转速单位 r/min；往复驱动的频率单位次/min。默认不自动播放。1× 为设定转速或频率的 20% 慢放，与摩擦轮及齿轮齿条一致；倍速不改变工况读数。切换页签、隐藏页面、手动驱动或拆装均暂停运动。数值框和参数滑块即时更新；非法参数保留上一有效三维模型，暂停当前结果、曲线和导出。

## 运动模型

| 实验 | 几何与教学输出 | 范围与约定 |
| --- | --- | --- |
| 苏格兰轭 | `s = r(1 − cos θ)`；对比曲柄滑块 `s = r + l − r cos θ − √(l² − r² sin²θ)` | 相同半径，以右侧死点为零、向左为正；曲柄滑块只显示为对比曲线 |
| 曲柄摇杆 | B 在输入圆上，C 由 B、D 两圆相交求解；绘制输出角与输入角 | a 为最短杆，严格 Grashof 条件；排除临界共线参数；取固定交点支路 |
| 平行四边形 | `B = A + a(cos θ,sin θ)`，`C = D + a(cos θ,sin θ)` | BC 始终平行 AD；演示 15°–165°，不模拟台灯弹簧或重力平衡 |
| 双摇杆 | 使用两圆闭合；最短连杆 b 位于固定机架对侧 | 选用 Grashof 双摇杆；由 `|b−c| ≤ |BD| ≤ b+c` 求输入范围，端点各留 0.5°；在同一装配支路往复 |
| 曲柄导杆急回 | 滑块 B 随曲柄圆周运动；AC 与 AB 共线；末端 C 经长度 l 的连杆驱动水平滑枕 | `α = asin(r/d)`，`K = (π+2α)/(π−2α)`；正转向左为工作，向右为空回；停机时用时显示“停机” |

双摇杆与平行四边形演示采用正弦往复输入，横轴是输入角，不是时间。曲柄摇杆与急回机构的输出由几何闭合求解，未对输出角或滑枕位置做匀速插值。双摇杆输出范围为当前演示支路的采样范围。

急回机构固定轴距为 d、曲柄半径 r、导杆长度 L；滑枕导轨高度取 `A.y + L`。行程 `2Lr/d`。按真实 RPM 计算工作与空回时间，一周期之和为 `60/rpm`。参数额外保证滑块在导杆槽中的端部余量和连接杆可达性。

应用参数时先完整校验。失败时保留上次有效的模型、曲线和导出参数，并阻止新播放；修改为有效参数或恢复默认可继续。只改变转速保留当前角度；几何变化回到该机构默认角附近的合法位置。

## 三维与交互

杆件分置于销轴的不同轴向层，端部使用带孔的圆头杆、衬套和连接销。轭架的两根水平导杆分别止于槽外，保持销与滑块通路；急回导轨位于传动连杆后侧。底座和导向座按机构固定支承位置布置。

全展开按各组件实际厚度分配互不重叠的轴向区间，并切换到较斜的拆装视角；复原恢复此前视角与输入角。四步拆装：销和挡圈 → 连杆与滑动件 → 输入和输出构件 → 导向与支承。步骤按组件展示，非制造装配工艺。

自由模式可旋转、缩放与点选。开启“拖动输入杆”后关闭相机旋转，以指针射线与运动平面的交点计算输入角；角度滑块与数值输入提供等价操作。支持默认、正视、俯视、全屏、铰点标注、16% 透明支承及隐藏支承。

无 WebGL 时保留参数计算、曲线和资料导出，并提示三维不可用。模型忽略弹性、接触摩擦、载荷与动力学；三维厚度和紧固件用于理解装配，不是制造模型或碰撞仿真。

## 验证与本地运行

在 `meshlab/` 目录运行：

```sh
npm run test:linkages
node server/local.mjs
```

预览服务只监听 `http://127.0.0.1:8090/`。也可按项目 README 使用 Python 静态服务。

`scripts/test-linkages.mjs` 覆盖杆长闭合及参数边界、位移端点、急回时间与槽约束、播放范围、非法参数、生产三维组件的复原、高亮、透明度与展开间距。

完整标准检查使用 `scripts/test-experiment-standard.mjs`、`scripts/verify-full-standard.mjs` 和 `scripts/verify-experiment-chat.mjs`，报告与桌面、390×844、360×740 截图写入被忽略的 `test-results/full-standard/`。浏览器脚本连接事先启动的独立无头浏览器；通过 `MESHLAB_BASE_URL` 和 `MESHLAB_CDP_URL` 指定地址。带 AI 预览使用项目 `server/local.mjs`，默认端口 8080，可通过 PORT 配置；静态服务只提供模型功能。

## 参考资料

- [项目 GL16 视觉基准](https://github.com/Slack-ZH/meshlab/blob/5239f10876ca0bab3c7a3168d8d2fa1dc782804e/project-docs/视觉基准.md)
- [University of Almería · Four-bar linkage](https://ingmec.ual.es/tmm/L01_03a_four_bars.html)：Grashof 分类与固定杆关系。
- [Mechanical Engineering Reference · Planar mechanisms](https://www.mechref.org/md/Planar_mechanisms/)：平面机构与滑块运动。
- [EDIBON · Scotch Yoke Mechanism](https://www.edibon.com/en/scotch-yoke-mechanism)：轭架和曲柄销的教学机构形式。
- [Aykut C. Satici · Slider-Crank and Quick-Return Linkages](https://symplectomorphism.github.io/teaching/ug_courses/kinematics/chapter04.html)：滑块与急回机构教学资料。

实现使用上述几何约束直接计算，未复制外部三维资产。
