# 首页与结构目录

首页的「机械展台」可以转动浏览不同传动结构。要做实验，点「查找结构」或「浏览结构目录」，输入机构名称或常用别名。例如搜“机械臂”会找到「工业机器人腕部传动」。选中搜索结果即可打开实验。[进入结构目录](https://slack-zh.github.io/meshlab/#structures)

目录收录 44 项实验，分为齿轮与减变速、带链与摩擦传动、轴连接与离合、直线与往复机构、动力与装备系统。GL16 是其中的减速器案例，可以直接进入[三维实验](https://slack-zh.github.io/meshlab/lab.html)、[传动原理](https://slack-zh.github.io/meshlab/lab.html?view=principle)或[工程资料](https://slack-zh.github.io/meshlab/lab.html?view=engineering)。

## 维护入口

| 要改什么 | 对应文件 |
| --- | --- |
| 首页布局、展台和使用指南 | [首页 HTML](dist/index.html) 与[首页样式及脚本](dist/homepage/) |
| 目录中的类别和搜索别名 | [分类配置](scripts/homepage-categories.json) |
| 目录内容生成 | [目录生成脚本](scripts/build-catalog-index.mjs)。从含 `package.json` 的目录运行 `npm run build:catalog` 更新页面与索引。 |
| GL16 原理、资料与助手的直达入口 | [实验页路由](dist/home-route.js) |

GitHub Pages 发布 `meshlab/dist/`。每次调整目录后，可以打开首页搜一次名称、选一次分类，再点搜索结果确认进入了预期实验。

## 早期版本检查记录

2026-11-12 玻璃主题验证：浏览器实测 `backdrop-filter` 和鼠标跟随高光生效，减少动态时停止高光跟随，减少透明度时取消模糊并使用不透明面板。浅色与深色各抽样五处文字和实际合成背景，对比度均不低于 4.5:1。该抽样不是全页面无障碍合规认证。

2026-11-11 验证：Chromium 中的 1440px、768px、390px、320px、深色及 200% 默认字体布局无横向溢出；双向循环、连续非吸附滚动、键盘焦点和减少动态适配通过。原实验室 49 个零件加载、爆炸展开、返回首页及资料/原理入口通过。尚未在实体 iOS/Safari 或读屏器上验证。
