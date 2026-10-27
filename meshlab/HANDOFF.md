# 项目交接

## 当前版本

本目录为啮合实验室 Apple Design 风格第二版源码。网页由原生 HTML/CSS/JavaScript 和随附 Three.js 构成，无构建步骤。直接编辑 `dist/index.html`、`dist/apple.css`、`dist/apple.js`、`dist/app.js`。旧版配色文件已从此目录清理。

## 品牌名称

中文统一为“啮合实验室”，英文品牌统一为小写 `meshlab`。GL16 是减速器型号，保留工程编号、零件 ID 与单位。

## 用户希望保留的内容

- 机械专业本科生使用：真实参数依据、公式、选型与初步校核。
- 49 个可选部件，三维旋转、爆炸展开、复原、七步拆装、比例正确的传动动画。
- 中文文字讲解和点击朗读，电脑、平板、手机适配。
- 少量 Apple 风格液态玻璃，集中在导航与操作栏；阅读面板实色、清晰。
- CAD 模型、PDF 图纸、BOM 和工程资料下载。

## 后续修改入口

先读 README.md 和 docs/DESIGN-REVIEW.md。`docs/verification.json` 是上传前的检查记录，修改后按变化范围重新验证。`scripts/verify_browser.py` 可验证主要交互；执行方法见 README。

不得把演示动画转速当作设计转速。工程模型的齿数、中心距、轴系结构和说明书具有对应关系，调整参数时同步更新几何、下载文件及讲解。

## 托管现状（本次交接时）

- 既有生产地址：https://meshlab-gear.netlify.app
- 第一版视觉预览：https://glass-preview--meshlab-gear.netlify.app
- 本目录第二版已经完成本地浏览器检查，但最近发布尝试返回 Netlify Unauthorized，因此未确认发布成功。
- 用户申请的 meshlab.localhost.cc 曾因 DNS 服务商配额满而未完成配置。
- 本次上传不包含托管凭据，不创建自动发布工作流。GitHub 存储源码与线上部署是两个独立步骤；未来如需更新线上版本，应确认目标站点和可用授权。

## 资源边界

STEP 不包含原生 CAD 特征树或装配约束。本项目是独立课程设计，工程假设及简化见 PDF 说明书；不得表述为厂家原机内部设计或制造认证。
