# 首页与实验室

- `dist/index.html`：网站介绍、机械档案和使用指南。
- `dist/archive.css`：首页设计变量、响应式布局、深色与辅助功能适配。
- `dist/transmission-cards.js`：连续的横向空间卡片；鼠标滚轮、拖拽、触摸、方向键和按钮均可浏览。循环无底部进度条，不按项目吸附。
- `dist/lab.html`：原三维实验室。首页通过此地址进入，实验室品牌链接返回首页。
- `dist/home-route.js`：支持 `lab.html?view=principle`、`engineering`、`assistant` 的直接入口。

机械档案中的五类图片是原理示意。当前可操作的真实三维模型是 GL16 两级斜齿减速器。

页面使用原生 HTML/CSS/JavaScript，无新增依赖。现有 GitHub Pages workflow 继续直接发布 `meshlab/dist`。

2026-11-11 验证：Chromium 中的 1440px、768px、390px、320px、深色及 200% 默认字体布局无横向溢出；双向循环、连续非吸附滚动、键盘焦点和减少动态适配通过。原实验室 49 个零件加载、爆炸展开、返回首页及资料/原理入口通过。尚未在实体 iOS/Safari 或读屏器上验证。
