# 啮合实验室 · meshlab

啮合实验室是一个面向机械课程学习的三维交互网站。以 **GL16 两级斜齿减速器**为例，你可以观察零件如何装配，沿着输入轴、中间轴和输出轴追踪动力传递，再用图纸、BOM 和设计说明书核对结构与参数。

**[在线体验](https://slack-zh.github.io/meshlab/)** · **[进入 GL16 实验室](https://slack-zh.github.io/meshlab/lab.html)** · **[查看工程资料](https://slack-zh.github.io/meshlab/lab.html?view=engineering)**

## 怎么用

1. **认识零件**。进入实验室的「探索」页，拖动模型旋转，用滚轮或双指缩放。点击模型或打开「零件目录」，可在 49 个零件中查看名称、材料和作用，并播放中文讲解。
2. **观察装配**。拖动「爆炸展开」滑块查看零件之间的位置关系。切换到「逐步拆装」，按七个步骤查看拆卸顺序，再逐步复原。
3. **理解传动**。播放传动动画，再切到「原理」查看两级各 4∶1 如何得到总传动比 16∶1。模型用慢放展示各轴之间的真实转速比例。
4. **向 AI 提问**。在「AI 助手」中用邮箱注册或登录，选中零件后提问，助手会收到当前零件的上下文。可以从「输入齿轮轴的作用是什么？」开始。
5. **下载资料**。在「资料」页获取 STEP 装配和零件模型、PDF 图纸与设计说明书、BOM、设计参数和完整工程包。

## 本地运行

从仓库根目录启动静态预览。网页和 Three.js 资源随仓库提供，无需构建。

```sh
python -m http.server 8080 --directory meshlab/dist
```

浏览器打开 [本地首页](http://127.0.0.1:8080/) 或 [本地实验室](http://127.0.0.1:8080/lab.html)。浏览器需支持 WebGL，网页通过本地 HTTP 服务加载模型。

如果要使用 AI 助手，停止上述静态服务，再从仓库根目录用 Node.js 22+ 启动本地代理。它通过 Cloudflare Worker 使用与线上相同的账号和预算。

```sh
cd meshlab
node --env-file-if-exists=.env server/local.mjs
```

## AI 协作与任务交接

执行账号从 [任务队列](https://github.com/Slack-ZH/meshlab/blob/handoff/handoff/README.md) 找到待办，再阅读对应任务单。任务单包含改动范围、实施建议、验收标准，以及此次要提交的截图或测试结果。

规划账号负责把仓库维护者的需求写进任务队列，并按标准检查 PR。执行账号从任务单指定的基准开工作分支，完成实现和验证，再向 `main` 提交草稿 PR，按任务单回传结果。合并由仓库维护者决定。具体流程见 [交接说明](handoff/README.md)。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| [`meshlab/dist/`](meshlab/dist/) | 网站首页 `index.html`、三维实验室 `lab.html`、模型资源和下载文件 |
| [`meshlab/server/`](meshlab/server/) | AI 聊天接口、Firebase 认证、账号预算和本地预览代理 |
| [`meshlab/scripts/`](meshlab/scripts/) | CAD 与工程文档生成、浏览器验证和后端测试 |
| [`meshlab/docs/`](meshlab/docs/) | 设计审查、AI 接入和开发规划 |
| [`handoff/`](handoff/) | AI 协作说明和任务模板 |
| [郑州大学 AI 竞赛资料](meshlab郑州大学ai竞赛资料/) | 项目说明书、研究记录和配图 |

网站由 [GitHub Pages 工作流](.github/workflows/pages.yml) 发布 `meshlab/dist/`。维护说明见 [源码目录 README](meshlab/README.md)、[首页与实验室](meshlab/HOMEPAGE.md)和 [AI 接入说明](meshlab/docs/AI-SETUP.md)。
