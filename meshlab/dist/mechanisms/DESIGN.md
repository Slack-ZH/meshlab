# 六项机械传动与运动变换实验

对应本次截图中 W 负责且未完工的第 14、15、16、23、24、25 行。六个页面为 `bevel-gears.html`、`scissor-jack.html`、`ratchet-pawl.html`、`eccentric-follower.html`、`roller-cam.html`、`geneva-drive.html`。首页“六个新实验”与页内“切换机构”提供入口。

## 文件与复用

- `mechanics.mjs`：六项参数、几何约束、连续运动、分段运动与曲线采样；独立于浏览器。
- `viewer.mjs`：参数化模型，复用连杆实验的场景、相机、点选和拆装控制；材质、灯光、阴影、地面与蓝色高亮均通过 `assets/reference-stage.mjs` 使用 GL16 基准。
- `../experiments/app.mjs` / `style.css` / `catalog.mjs`：11 个 W 机构共用的实验交互、运动读数、曲线、即时参数校验、零件规格和专属拆装讲解。复用基准公共页面样式、图标、目录和登录界面；本目录旧 `app.mjs` / `style.css` 不再被页面加载。
- `../experiments/chat-context.mjs` 与共享 `chat.js`：接入现有 AI 服务，保留每次提问及重试时的当前机构数据。
- `scripts/build-mechanism-pages.mjs`：生成六个完整静态入口。模型功能可独立离线运行，AI 功能使用现有登录与服务接口。

六项默认暂停。1× 为设定输入转速的 20% 慢放，倍速不改变工况读数。拆装和手动定位会暂停运动，复原保留当前输入位置。数值框和滑块即时更新。校验失败时保留上一有效三维模型，暂停当前结果、曲线和导出；AI 同时收到无效输入和上一有效模型的数据，修正后自动恢复。

## 直齿锥齿轮副

两轴沿 X、Z 布置，相交角 90°。大端模数为 m，齿数为 z₁、z₂：

```text
δ₁ = atan(z₁/z₂)，δ₂ = π/2 − δ₁
R = m√(z₁²+z₂²)/2，齿宽 b = 0.24R
r₁ = mz₁/2，r₂ = mz₂/2
n₂ = n₁z₁/z₂，θ₂ = −θ₁z₁/z₂
```

两个节锥共顶点，母线在 `(R cosδ₁, 0, R sinδ₁)` 接触；对应另一齿轮的径向、轴向坐标互换。直齿沿母线延伸，齿顶与齿根沿节锥法向偏置。齿面采用简化梯形采样，不是制造用球面渐开线。默认视角从节锥顶点一侧观察啮合；展开沿两根轴分别分离齿轮与轴。

## 剪式千斤顶

四根支臂长度均为 L，水平铰距 w，高度 H；丝杠导程为 p，累计转数为 N。

```text
w₀ = 2L√0.96
w = w₀ − pN
H = √(4L² − w²)
```

左右铰点位于 `(±w/2, H/2)`，上下铰点位于 `(0,0)`、`(0,H)`，各臂始终长 L。最低 H = 0.4L，最高 H = 1.85L，由几何范围换算允许转数。达到边界会停止，可切换方向下降或上升。丝杠具有可见螺旋线与横向手柄；拆装间距包含手柄转动的完整包络。

仅求刚性位置，不计算承载、自锁、接触摩擦或失稳。

## 棘轮棘爪

齿数 z、每次驱动齿数 k，单循环推进 `360°k/z`。相位 0°–180° 为驱动，180°–360° 为回程；用余弦半周期平滑驱动手柄。驱动段输出跟随，回程段输出保持，跨周期累计输出转角。

棘爪支点固定在手柄上，爪长固定为 31 mm。对棘爪端点绕支点的圆弧与实际锯齿轮廓求交，回程时可见越齿抬起；不通过伸缩棘爪伪造接触。压紧弹簧作结构示意；输出保持由理想负载约束表示，未解算齿间冲击与接触力。

## 偏心轮与直动从动件

采用圆形偏心轮和平底从动件。圆心相对轴心为 `(e cosθ, e sinθ)`，从动件底面与圆盘最高点相切：

```text
s = e(1 + sinθ)
行程 = 2e
```

这里的 s 从最低位置量起。平底宽度随偏心距调整，覆盖整个接触横向范围；轴孔仍位于转轴原点。e = 0 时圆盘仍可转动，从动件保持不动。弹簧仅示意保持接触。

## 盘形凸轮与滚子从动件

给定基圆半径 Rb、滚子半径 r、升程 h、推程/高位停歇/回程角，剩余部分为低位停歇。低位停歇至少 30°。

推程采用摆线规律 `s = h[u − sin(2πu)/(2π)]`，回程采用反向同一规律。各段交界处的速度为零。先建立滚子中心轨迹，再沿外法线向内偏置 r：

```text
q = Rb + r + s
P(θ) = (q sinθ, q cosθ)
凸轮轮廓 = P − r n
```

轮廓随尺寸重建，滚子中心始终位于轴心正上方。用极坐标曲率检查凸轮的凸曲段，拒绝偏置可能产生尖点的尺寸。滚子角速度由无滑动接触关系积分：`dφ/dθ = 1 − √(q² + (ds/dθ)²)/r`，每个参数组合缓存一圈的积分。未求解高速接触分离、弹簧力与动力学。

## 日内瓦槽轮机构

槽数 N = 4–8，中心距 c，主动销半径 `r = c sin(π/N)`。主动销圆与槽轮进入/退出位置相切：

```text
β = π/2 − π/N
每输入一圈输出转角 = −360°/N
停歇比例 = 1/2 + 1/N
```

输入相位 180° 对应分度中点，销进入期间由销与槽轮中心的连线角直接求输出角；其余时间输出保持。槽形包含开放径向槽、圆弧槽底和锁止凹圆弧；主动盘、销和锁止扇面分层显示。测试检查了主动销与真实槽轮多边形，以及锁止扇面与槽轮的整周期间隙。未模拟间隙冲击与制造公差。

## 导出与单位

JSON 保存机构类型、已应用参数、输入位置、结果与单位。CSV 为当前参数下的一整周期/完整行程，共 361 行采样加表头。输入 `input` 在千斤顶中为圈数，其余为度；`height`、`lift`、`width`、`displacement`、`stroke`、`eccentricity` 为 mm；角度字段为度；`outputRPM` 为 r/min；`dwellPercent` 为百分比；`indexCount` 为次数。

## 参考资料与验证

- [项目 GL16 视觉基准](../../../project-docs/视觉基准.md)
- [Jönköping University · Bevel gears](https://mechanics.ju.se/MachineElements/bevel-gears.html)
- [Mechanical Engineering Reference · Cams](https://www.mechref.org/md/Cams/)
- [European Patent Office · Geneva drive mechanism](https://data.epo.org/publication-server/rest/v1.2/publication-dates/20000426/patents/EP0790438NWB1/document.pdf)

模型自行参数化生成，未复制外部模型资产。默认、选中和展开状态需同时检查桌面与手机布局。运行计算和生产模型检查：

```sh
npm run test:mechanisms
```

完整标准检查使用 `scripts/test-experiment-standard.mjs`、`scripts/verify-full-standard.mjs` 和 `scripts/verify-experiment-chat.mjs`。桌面 1440×1080、手机 390×844 与 360×740 的检查证据写入 `test-results/full-standard/`。浏览器脚本通过 `MESHLAB_BASE_URL` 与 `MESHLAB_CDP_URL` 指定已运行的预览和独立浏览器地址；带 AI 预览使用 `server/local.mjs`，本次端口 8091。旧 `verify-mechanisms.mjs` 对应补齐前的界面。
