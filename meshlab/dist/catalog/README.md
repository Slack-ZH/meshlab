# 机械机构扩展目录 · 35 项

本批实现 WPS 清单第 24–34、36–37、39–60 项；第 35、38 项已有制作人，未纳入本批。原有 9 个独立实验继续保留。每一项都有自己的参数、部件描述和运动关系，不是用相同模型更换名称。

## 使用

通过 HTTP 服务打开首页，在「机构目录」搜索，或打开 `catalog.html?model=<id>`。默认显示单十字轴万向节。模型下方可切换机构及调节参数；与既有实验相同的视图框、AI 面板、零件目录、播放、速度、爆炸展开、复原与逐步拆装按钮保持原位置。

1. 点击播放，拖动旋转模型；1× 演示速度为设置工况的 20%。
2. 调整下方的尺寸、档位、夹角、输入转速或其他本机构参数；指标由当前参数与运动相位计算。
3. 只修改转速会保留相位；其他字段变化会验证、停机并回到初始相位。非法组合显示原因并保留上一个有效模型。
4. 使用爆炸与目录查看组件。链节、滚珠等按装配组拆开，组内小件仍独立运动。
5. 在「原理」「资料」查公式、简化范围与来源，再选中零件向 AI 提问。

有限行程机构在自身运动端点夹停；复原可重新开始。暂停时几何停止更新，指标中的理论工况值仍可能非零，不能据此断言部件正实际运行。

## 编号与能力

| 清单编号 | 名称 | ID / 入口 | 本项实验能力 |
| --- | --- | --- | --- |
| 24 | 单十字轴万向节 | [`universal-joint`](../catalog.html?model=universal-joint) | 调轴间夹角，看输入匀速时输出转速如何波动。 |
| 25 | 双万向节传动轴 | [`double-universal`](../catalog.html?model=double-universal) | 调整夹角和叉头相位，找出抵消转速波动的条件。 |
| 26 | 链条输送机 | [`chain-conveyor`](../catalog.html?model=chain-conveyor) | 观察托板的载物段、回程段和张紧轮的位置。 |
| 27 | 滚珠丝杠 | [`recirculating-ball-screw`](../catalog.html?model=recirculating-ball-screw) | 剖开透明螺母，跟踪滚珠的循环路径。 |
| 28 | 摩擦片离合器 | [`friction-clutch`](../catalog.html?model=friction-clutch) | 操作压盘，观察飞轮、摩擦片接合与分离。 |
| 29 | 滚柱式单向离合器 | [`roller-freewheel`](../catalog.html?model=roller-freewheel) | 切换相对转向，看滚柱如何楔紧和释放。 |
| 30 | 离心离合器 | [`centrifugal-clutch`](../catalog.html?model=centrifugal-clutch) | 调整转速，看蹄块张开并与离合器鼓接触。 |
| 31 | 奥尔德姆联轴器 | [`oldham-coupling`](../catalog.html?model=oldham-coupling) | 改变两根平行轴的偏置，观察中间滑块的补偿运动。 |
| 32 | 自行车后拨变速机构 | [`bicycle-rear-derailleur`](../catalog.html?model=bicycle-rear-derailleur) | 切换飞轮档位，看链条横移与导轮补偿。 |
| 33 | 汽车雨刮连杆 | [`dual-wiper`](../catalog.html?model=dual-wiper) | 用一个电机驱动两支雨刮，观察摆幅和相位。 |
| 34 | 汽车转向齿轮齿条总成 | [`steering-rack`](../catalog.html?model=steering-rack) | 联动齿条、横拉杆和转向节，对比内外轮转角。 |
| 36 | 发动机气门配气机构 | [`valvetrain`](../catalog.html?model=valvetrain) | 联动曲轴、凸轮轴与气门，观察四冲程中的开闭时序。 |
| 37 | 简单行星齿轮传动 | [`planetary`](../catalog.html?model=planetary) | 轮流固定太阳轮、齿圈和行星架，对比输出转向与速比。 |
| 39 | 自行车三速内变速花鼓 | [`three-speed-hub`](../catalog.html?model=three-speed-hub) | 切换三档，观察花鼓内部哪些零件参与传力。 |
| 40 | 汽车手动变速箱 | [`manual-gearbox`](../catalog.html?model=manual-gearbox) | 选择档位，高亮从输入轴到输出轴的动力路径。 |
| 41 | 变速箱同步器 | [`synchronizer`](../catalog.html?model=synchronizer) | 慢放拨叉移动、锥面同步、锁止与齿套接合。 |
| 42 | 钢带式无级变速器 CVT | [`cvt`](../catalog.html?model=cvt) | 联动两组锥轮，观察钢带工作半径与速比连续变化。 |
| 43 | 球笼式等速万向节 | [`rzeppa-joint`](../catalog.html?model=rzeppa-joint) | 调整半轴夹角，观察钢球在球道中的运动。 |
| 44 | 双凸轮共轭机构 | [`conjugate-cam`](../catalog.html?model=conjugate-cam) | 观察两只凸轮如何共同约束从动件往返。 |
| 45 | 分度凸轮机构 | [`indexing-cam`](../catalog.html?model=indexing-cam) | 用包装机转盘演示转位和停歇。 |
| 46 | 摆线针轮减速器 | [`cycloidal`](../catalog.html?model=cycloidal) | 追踪偏心输入、摆线轮、针齿和输出销的运动。 |
| 47 | 谐波减速器 | [`harmonic`](../catalog.html?model=harmonic) | 剖开观察柔轮变形，以及少量齿数差如何产生大速比。 |
| 48 | 包络蜗杆传动 | [`enveloping-worm`](../catalog.html?model=enveloping-worm) | 对比普通圆柱蜗杆与包络蜗杆的齿面接触区域。 |
| 49 | RV减速器 | [`rv-reducer`](../catalog.html?model=rv-reducer) | 观察前级直齿轮与双摆线轮的两级减速，比较输入、偏心轴和输出。 |
| 50 | 汽车双离合变速箱DCT | [`dual-clutch-transmission`](../catalog.html?model=dual-clutch-transmission) | 切换奇偶挡位与预选挡，追踪两个离合器和两根输入轴的动力路线。 |
| 51 | 行星齿轮式自动变速箱AT | [`planetary-automatic`](../catalog.html?model=planetary-automatic) | 切换离合器和制动器组合，观察低挡、直接挡、超速挡与倒挡。 |
| 52 | 液力变矩器 | [`torque-converter`](../catalog.html?model=torque-converter) | 比较泵轮、涡轮、导轮与锁止离合器，观察速比、转矩比和效率。 |
| 53 | 混合动力功率分流机构 | [`hybrid-power-split`](../catalog.html?model=hybrid-power-split) | 调节发动机与车轮支路速度，观察太阳轮发电机及机械、电气功率分流。 |
| 54 | 四驱分动箱与中央差速器 | [`four-wheel-transfer`](../catalog.html?model=four-wheel-transfer) | 切换高低速及中央差速锁，对比前后传动轴同速与差速。 |
| 55 | 拖拉机动力输出传动 | [`tractor-pto`](../catalog.html?model=tractor-pto) | 选择540/1000转速挡和PTO独立离合器，观察动力输出轴与作业机具。 |
| 56 | 多轴数控机床进给传动 | [`cnc-feed`](../catalog.html?model=cnc-feed) | 联动丝杠直线进给和转台，观察刀具与工件的相对运动。 |
| 57 | 工业机器人腕部传动 | [`robot-wrist`](../catalog.html?model=robot-wrist) | 剖开多根同轴传动轴，看末端多轴动作如何合成。 |
| 58 | 机械钟表传动与擒纵机构 | [`clock-escapement`](../catalog.html?model=clock-escapement) | 从发条追踪至轮系、擒纵轮和摆轮，慢放锁止与释放。 |
| 59 | 双转子直升机主减速器 | [`dual-rotor-gearbox`](../catalog.html?model=dual-rotor-gearbox) | 追踪两条动力路径，观察两套旋翼如何反向旋转。 |
| 60 | 风电行星—平行轴增速箱 | [`wind-turbine-gearbox`](../catalog.html?model=wind-turbine-gearbox) | 从低速叶轮轴追踪至发电机轴，逐级显示转速和转向。 |

## 参数与教学范围

参数随机构定义，页面会显示单位、范围及选项；几何参数会改变实体形状或装配位置，工况参数会改变对应运动及计算关系。机构从同一输入相位求解从动部件，不能把各轴独立转动视为正确传动。

复杂机构使用页面明确列出的运动原理简化，例如链传动的连续节线、给定离合器滑差、简化回珠路径或传力状态。理想运动速比、静态/准静态容量和真实负载下的动态响应应分别理解。部分机构展示几何接触及运动约束，不包含制造齿形认证、所有零件的全实体碰撞求解、材料强度、热平衡、疲劳寿命或额定承载。具体限制以每项 `limits` 和页面资料为准；不能把教学参数直接当作采购或制造规格。

第 24–34 项的详细关系及验证说明见 [models-motion-DESIGN.md](models-motion-DESIGN.md)。各模型的一手来源同时保存在描述符 `sources` 中，由资料页展示。

## AI 与上线健康检查

提问时冻结机构 ID、名称、有效参数、当前相位/播放状态、运动指标和所选组件，切换机构后重新开始该机构会话，避免混用减速器或另一机构的上下文。

浏览器从当前配置的后端请求 `/api/health`，只有服务已部署、`ready` 为真并且 `modelContexts` 包含 `catalog`，才启用原生目录上下文。旧后端未声明支持时使用有长度限制的文字快照兼容路径；不把本地模拟测试结果当作线上支持。正式上线后需检查实际健康响应。登录、预算与流式回答继续采用现有 AI 服务策略。

纯静态 HTTP 服务可浏览全部三维功能，但不提供聊天 API。本地 Node 代理可连接已配置的服务；目录测试使用模拟请求，不调用付费大模型。健康检查本身不会生成 AI 回答。

## 开发与验证

在产品目录（含 `package.json` 的 `meshlab/`）执行：

```sh
npm run test:catalog
npm run build:catalog
```

- `test:catalog`：依次交给 Node test runner 执行 `test-catalog-motion.mjs`、`test-catalog-machines.mjs`、`test-catalog-systems.mjs`、`test-catalog-integration.mjs`；包括参数边界、运动不变量和公共上下文/查看器检查。
- `build:catalog`：先运行 `build-catalog-page.mjs` 生成统一实验页面，再运行 `build-catalog-index.mjs` 生成首页目录与索引；会更新生成的 HTML 和相关缓存版本引用。
- 描述符约定见 [CONTRACT.md](CONTRACT.md)。新增/调整模型后运行对应组测试及集成测试，并对变化的模型重新截取默认/关键工况/爆炸画面。

已提交静态产物可直接部署，日常浏览无需 Node 构建。浏览器布局、关键按钮位置、默认可见性与爆炸终态仍需实际界面验收；数学测试不能替代视觉检查。
