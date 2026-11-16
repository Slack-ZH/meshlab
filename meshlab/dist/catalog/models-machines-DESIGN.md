# 机构扩展 36–48：机器与减速机构

本组实现清单 36、37、39–48，共 12 项；38 已由他人认领，未实现。入口和公共查看器由 `catalog` 注册表统一提供。本组只输出纯构造数据、无累计状态的运动采样和教学说明。

## 使用与运动定义

公共输入相位单位为 rad，正向输入转速单位 r/min。全局慢放改变显示时间，不改变结果栏的理论转速。每项数值和选项参数均在 `fields` 中声明；`validate` 在模型更新前拒绝非有限或越界参数。

所有速度关系取教学刚体或指定几何约束。没有载荷、材料、加工精度输入的项目不输出额定转矩、寿命、接触压力或安全系数。

| 序号 / ID | 几何与实际约束 | 具体简化 |
|---|---|---|
| 36 `valvetrain` | 20/40 正时齿轮、同轴进排气凸轮、平底挺柱、阀杆和弹簧。曲轴两转为一周期；压缩/做功关闭，进气/排气分别开启。 | 无提前迟闭或重叠；没有活塞燃烧模拟，导向座按剖视显示。 |
| 37 `planetary` | 太阳轮、三个行星轮、内齿圈、三臂架。轮流固定环/太阳轮/架。约束 `zs(ωs−ωc)+zr(ωr−ωc)=0`。 | 三等分装配，齿数限制为 6 的倍数；忽略齿侧间隙和变形。 |
| 39 `three-speed-hub` | 太阳轮固定，`zr=3zs`；低档环进架出，高档架进环出，中档离合直连。壳体为输出件。 | 0.75/1/1.333 经典关系，不复刻特定品牌花鼓；换档件标示动力路径，省略棘爪。 |
| 40 `manual-gearbox` | 两轴、四对常啮合齿轮，各对齿数和 60；未选齿轮空套，齿套锁定一对。金色表示动力路径。 | 四前进档教学布置，未包含主减速、差速、离合与倒档；空档设输出轴初始静止。 |
| 41 `synchronizer` | 输入空套齿轮、摩擦锥、锁环、花键毂、齿套、拨叉。先缩小转速差，随后解除锁止再接合。 | 同步曲线按三次平滑函数给定；不冒充惯量/摩擦求解。初始齿位匹配最终接合相位。完成后保持接合，恢复初始状态重播。 |
| 42 `cvt` | 两组真实锥面网格，84 个沿闭合路径移动的钢片，两条环带。固定中心距内调半径时保持同一带长。 | 钢片数量为显示离散；无钢带推力、液压、摩擦容量或效率模型。改变中心距表示改选另一条带长。 |
| 43 `rzeppa-joint` | 内外六条圆弧球道、星形套、六球、角平分面保持架。球心同时满足内外球道方位和角平分平面约束。 | 球道用导向轨展示，不是槽截面；保持架双环留空观察，不计算 cage 动力学。 |
| 44 `conjugate-cam` | 两个不同的支持函数轮廓共同约束一个刚性双面框；每一相位上下面都相切。 | 平底从动框代替商用双滚子机构，未计算预紧和接触应力。 |
| 45 `indexing-cam` | 包装瓶转台、工位滚子、由滚子反转轨迹生成的盘形分度凸轮。五次位移规律及圆弧停歇段。 | 非商用 globoidal 凸轮复刻；不含双片预载和工艺补偿。 |
| 46 `cycloidal` | 固定针齿、偏心轴、真实滚子包络摆线盘、扩孔及六个输出销；输出与盘自转一致。 | 单盘观察模型，真实常用的双盘动平衡未实现；孔销显示余隙 0.12 mm。 |
| 47 `harmonic` | 固定内齿刚轮、椭圆发生器、变形柔轮环、逐齿材料位置、输出端。变形波角和材料慢转角分别计算。 | 柔轮齿块与杯壁为近似；不求应力、真实修形接触、回差或疲劳。 |
| 48 `enveloping-worm` | 普通圆柱与沙漏包络可切换；头数控制轮转速。包络螺旋沿蜗轮圆周角布置，高亮对比局部/扩展区域。 | 未求二次包络加工齿面；黄色线框为人为选择的概念区域，不是 TCA、压力云图或实测接触斑。 |

## 关键几何推导

### 平底凸轮

在凸轮转角 `θ` 下，取世界坐标中的支持高度 `h=R+s(θ)`。接触点为 `(h′,h)`，在凸轮本体坐标中为 `Rot(−θ)(h′,h)`。下侧接触同时反转两坐标。因而从动件位移是生成轮廓的同一函数，不是把独立运动的圆盘和推杆拼接。

36 的 `R=70 mm`，最大升程 8 mm，支持函数曲率半径在范围内保持正值。44 采用 `s=A(0.65sinθ+0.175sin2θ)`，两片对应 `R+s` 与 `R−s`；二次谐波保证两片不是同一个偏心圆的改名。

### 分度凸轮

设转台中心距 `C=92 mm`、滚子分布半径 `R=42 mm`、滚子半径 `r=5 mm`。分度运动期间，选中滚子相对近心方向转角 `δ=Δ(f(u)−1/2)`，其中心在凸轮坐标中为：

`q(θ)=Rot(−θ)[C−Rcosδ, −Rsinδ]`。

凸轮轮廓取轨迹沿外法线向内偏置 `r`；其余轮廓由同半径圆弧补齐停歇段。下一输入周期由相邻滚子接续。测试在 4/6/8 工位、210/230/250° 运动角下逐相位检查接触与不穿透，允许离散点引起的 0.008 mm 距离误差。

### 摆线针轮

针齿数 `N`、针齿分布半径 `R`、偏心距 `e=0.35R/N`。固定针齿在摆线盘坐标中的中心轨迹为：

`q(t)=[Rcos t−e cos Nt, Rsin t−e sin Nt]`。

将轨迹沿法向内偏置针齿滚子半径，得到盘形轮廓。盘心按 `e[cosθ,sinθ]` 公转，盘自转为 `−θ/(N−1)`。输出销与盘孔心的相对偏移模长始终是 `e`。

### CVT 与球笼

CVT 闭合带长使用开口带精确平面切线关系，以二分法反求从动半径。锥面按 11° 半角生成，其轴向间隔随半径改变。钢片沿同一条以弧长参数化的路径移动，满足 `R1ω1=R2ω2`。

球笼夹角 `β`，第 k 球外球道方位 `α=θ+2πk/6`。取 `ρ=32/sqrt(1+tan²(β/2)cos²α)`，球心为 `[ρcosα,ρsinα,−tan(β/2)ρcosα]`。这保持球心半径 32 mm，同时满足内外球道方位和角平分面约束；两轴转角均为 θ。

## 核验

运行：`node --test scripts/test-catalog-machines.mjs`。

24 项测试通过：12 个模型的默认、所有选项、每字段上下限、多个相位、零转速与非法值；另核验四冲程窗口、真实凸轮支持高度、Willis 约束、三速比、常啮合齿数和、同步曲线积分、闭合带长/弧长速度、球笼双球道条件、分度接触不穿透、摆线针齿包络、输出销偏心补偿、谐波齿位与变形波分离、包络/圆柱几何不同且速比不变。

## 一手参考

以下来源用于原理和结构确认；本项目自选教学尺寸与生成代码不是对厂商型号的复制。

- [DOE Fundamentals Handbook Mechanical Science](https://www.energy.gov/sites/default/files/2026-04/DOE-HDBK-1018-93_VOL1.pdf)：四冲程与凸轮半速。
- [SDP/SI Planetary Gear Design](https://www.sdp-si.com/planetary-gear-design/index.php)：行星轮系构成及设计关系。
- [Sturmey-Archer 三速花鼓说明](https://www.sturmey-archer.com/files/catalog/files/309/MANUAL%20-%203%20SPEED%20HUBS.pdf)：三档速度关系。
- [Schaeffler 单锥同步器](https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/api/downloads_13/api06_de_en.pdf)：摩擦同步、锁止、接合三者的关系。
- [Bosch Pushbelt](https://www.bosch-mobility.com/en/solutions/transmission-technology/pushbelt/)：双锥盘与钢带式 CVT。
- [GKN Constant Velocity Joints](https://editor.gknautomotive.com/en/aftermarket/portfolio/constant-velocity-joints)：固定球笼结构与用途。
- [DESTACO CAMCO Custom Cams](https://destacosalesaustralia.com.au/product-category/camco-indexing-solutions/custom-cams/)：共轭、分度凸轮机构类型。
- [Sumitomo CYCLO General Information](https://assets.sumitomodrive.com/sites/default/files/nqikej116/files/2022-08/D6000_CAT_DE_991470_07_2022_web.pdf)：偏心输入、固定针齿、一齿差反向自转、销轴输出。
- [Harmonic Drive Detailed Operating Principle](https://legacy.harmonicdrive.net/reference/applicationnotes/principles.php)：柔轮、刚轮、双波发生器及两齿差。
- [KHK Worm Gear](https://khkgears.net/product-category/worm-gear-pair/)：头数与速比。
- [Cone Drive Double Enveloping Worm](https://conedrive.com/double-enveloping-worm/)：沙漏形包覆与圆柱蜗杆的结构差别。
