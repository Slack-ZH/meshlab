# 啮合实验室 · meshlab

在浏览器里拆开一台减速器，或给齿轮列加上一个惰轮，看动力怎样从输入轴传到输出轴。啮合实验室有 44 项机械实验，打开网页就能操作。三维实验免登录，使用 AI 助手时再登录。

**[打开在线实验室](https://slack-zh.github.io/meshlab/)** · [按名称或类别查找实验](https://slack-zh.github.io/meshlab/#structures)

## 第一次使用：看惰轮怎样改变转向

1. 打开[带惰轮齿轮列](https://slack-zh.github.io/meshlab/idler.html)，保留默认的「带惰轮（三轮）」，点「播放」。观察最左和最右的齿轮，两者同向转动。
2. 在模型下方把「传动模式」切到「直接啮合（两轮）」，再点「播放」。现在首尾两轮反向转动。
3. 把「三轮齿数组合」从 20 / 30 / 40 切到 20 / 50 / 40。两组的首尾齿数相同，所以输出转速的大小相同。打开「原理」可以核对公式。

## 按学习目标选实验

| 我想弄懂什么 | 打开实验后可以这样试 |
| --- | --- |
| 齿轮、轴和箱体怎样装在一起？ | 在 [GL16 两级斜齿减速器](https://slack-zh.github.io/meshlab/lab.html) 拖动「爆炸展开」，再用「逐步拆装」查看七个步骤。点击任一零件可读说明。 |
| 为什么齿数会影响速度？ | 在[单级直齿轮](https://slack-zh.github.io/meshlab/spur.html)对比 20 / 40 和 40 / 20 齿，再到[自行车链传动](https://slack-zh.github.io/meshlab/bicycle.html)改变后链轮齿数，观察后轮转速。 |
| 两只带轮什么时候反向？ | 在[平带实验](https://slack-zh.github.io/meshlab/belt.html)切换交叉带和开口带，再看[同步带](https://slack-zh.github.io/meshlab/timing.html)如何靠带齿啮合传动。 |
| 摩擦力够不够带动负载？ | 在[摩擦轮](https://slack-zh.github.io/meshlab/friction.html)逐渐增加负载转矩，观察何时出现打滑风险提示。 |
| 一圈能推动钳口多远？ | 在[台虎钳](https://slack-zh.github.io/meshlab/vice.html)改变丝杠导程，比较相同圈数对应的钳口位移。 |
| 汽轮机里面是什么样？ | 在[汽轮机](https://slack-zh.github.io/meshlab/turbine.html)展开汽缸，调整级数观察叶排，再调整蒸汽流量观察估算功率。 |
| 去哪里找万向节、凸轮或变速箱？ | 在[结构目录](https://slack-zh.github.io/meshlab/#structures)输入名称，或按类别筛选。也可以按表查找 [35 项扩展机构](meshlab/dist/catalog/README.md)。 |

## 使用时常见的问题

**为什么暂停了，转速栏还有数字？** 在惰轮和扩展机构等实验中，转速栏显示按当前参数算出的工况转速。「暂停」会定格画面，方便观察。以惰轮为例，1× 播放用设定转速的 20% 慢放，便于看清转向。

**参数改了，模型为什么还停在原处？** 扩展机构遇到超出范围或无法装配的组合时，会保留上一次有效的模型。按参数区提示修正数值，再点「播放」。

**登录和每天 2 元是什么意思？** 打开「AI 助手」，点「登录 / 注册」，用邮箱和密码登录，再选中零件提问。2 元是网站为每个账号提供的每日问答额度，费用由网站维护者承担，北京时间零点重置。刷新页面会清空本页对话，需要保留的回答请先复制。[登录、验证与额度说明](meshlab/docs/AI-SETUP.md)

**图纸在哪里？** GL16 的「资料」页提供 STEP 三维模型、PDF 图纸、设计说明书和零件清单（BOM）。其他实验的「原理」和「资料」说明各自的公式和简化条件。例如摩擦轮会提示打滑风险，画面仍按理想无滑动速比演示。[打开 GL16 工程资料](https://slack-zh.github.io/meshlab/lab.html?view=engineering)

## 在自己的电脑上运行

只体验实验可用上方的在线入口。已下载仓库的读者，可在含本 README 的仓库根目录打开终端，使用 Python 3 启动网页服务。

```sh
python -m http.server 8080 --directory meshlab/dist
```

然后打开[本地首页](http://127.0.0.1:8080/)。直接双击 HTML 文件可能只显示界面，浏览器需要通过网页服务读取三维模型。

本地也要用 AI 时，先在刚才的终端按 Ctrl+C 停止服务，再从仓库根目录执行下面的命令。推荐使用 Node.js 24.14 或更高版本。

```sh
cd meshlab
node --env-file-if-exists=.env server/local.mjs
```

打开同一个本地地址即可。这个预览服务连接线上 AI，沿用同一账号和额度，个人电脑无需配置 DeepSeek 密钥。

## 项目资料与维护

- [项目说明文档](meshlab/docs/项目说明文档.md)介绍实验范围、GL16 案例、技术架构及已记录的验证结果。
- [开发与运行说明](meshlab/README.md)列出源码位置、生成工程资料的方法和测试命令。[首页与目录维护](meshlab/HOMEPAGE.md)说明如何更新实验入口。
- [竞赛资料](meshlab郑州大学ai竞赛资料/)包含阶段性说明书与配图。[协作交接说明](handoff/README.md)包含任务队列和提交变更的流程。
