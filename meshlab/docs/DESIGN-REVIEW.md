# Design review: GL16 Apple Design 第二版

## Summary

审查对象：第一版轻玻璃网页的实际 HTML、CSS、JS 和截图。技术栈为原生网页和 Three.js，苹果 HIG 的材质、可读性、布局原则适用；原生 SwiftUI 的系统材料和窗口规范不直接套用。第一版评级为 Needs work：交互功能完整，但移动端小字、低于 44px 的常用按钮，以及内容面板也使用玻璃，都需要改进。

## Improvements

- **High — 内容与功能层混淆。What:** 第一版零件讲解、目录、操作区都套用类似的透明白卡片。**Why:** `materials.md › Liquid Glass`: “Don’t use Liquid Glass in the content layer.” **Fix:** 使用实色讲解页和目录列表，只为悬浮导航、视角工具与模型操作台使用 CSS 玻璃近似。
- **High — 小字和触控。What:** 第一版移动端说明文字多为 9–11px，部分按钮高度 35–39px。**Why:** `typography.md › Ensuring legibility`: “Use font sizes that most people can read easily.” `accessibility.md › Mobility` 给出移动端默认 44×44pt。网页采用项目目标 44×44 CSS px，不把 pt 与 px 视为原生等价单位。**Fix:** 主讲解 16px、辅助文字至少 12px，主要控件 44px，滑块有 44px 触控区域；使用 rem 支持浏览器文字放大。
- **High — 手机丢失搜索。What:** 第一版手机隐藏零件搜索和筛选，只能横滑全部零件。**Why:** `layout.md › Adaptability`: “Design a layout that adapts gracefully and consistently.” **Fix:** 增加可打开的零件目录，保留搜索和分类，支持 Escape 关闭和焦点返回。
- **Medium — 颜色过多用于控件。What:** 第一版正文、标签、工具、边框都偏蓝。**Why:** `color.md › Liquid Glass color`: “Apply color sparingly to the Liquid Glass material, and to symbols or text on the material.” **Fix:** 银灰内容舞台和石墨色标签，蓝色集中在播放和当前选择；模型自身提供形状和材质变化。
- **Medium — 深色与偏好。What:** 第一版不跟随系统深色。**Why:** `color.md › Best practices`: “Make sure all your app’s colors work well in light, dark, and increased contrast contexts.” **Fix:** 增加 prefers-color-scheme、prefers-contrast、reduced-motion 和透明度降级；WebKit 不一定提供降低透明度媒体信号，因此保留用户可用开关。

## What works

保留真实的 49 个 CAD 零件、七步拆装、比例正确的传动动画、材料参数与工程包。模型是页面唯一主角；不加入装饰性自动播放。

## Platform notes

手机底部三项导航是本项目的可用性选择，参考 `tab-bars.md › Best practices` 的 “Use a tab bar to support navigation, not to provide actions.” 操作仍在模型附近的工具栏中。使用自制统一 SVG 图标、CSS backdrop-filter，不声称是 Apple 的原生 Liquid Glass 材料。

## Design plan

设计命题：像拿起一台机械仪器一样探索减速器。以更大的银灰模型舞台、可收起的目录和实色检视器组织信息，玻璃只作为悬浮操作层。

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| background | #F5F5F7 | #17181B | 页面底色 |
| surface | #FFFFFF | #242529 | 讲解、正文 |
| content | #1D1D1F | #F5F5F7 | 主要文字 |
| secondary | #646469 | #B6B7BF | 辅助文字 |
| action | #0066CC | #72B2FF | 主操作和选中状态 |
| divider | #D7D8DD | #494B52 | 边界 |

系统字体栈；标题 32px/600，正文 16px/400，辅助 12–14px/400，数字 tabular-nums。对比度在 verification.json 中记录，不能据此声称全页面通过正式无障碍审计。

```text
桌面  品牌             [探索  原理  资料]              透明度
      GL16 两级斜齿减速器
      [ 目录 / 探索-拆装模式    ]       [实色零件检视器]
      [      大幅三维模型        ]       [名称、作用、规格]
      [ 悬浮播放 / 展开 / 复原   ]       [朗读、箱体设置]
      功率      转速       传动比       输出

手机  品牌、透明度
      GL16 两级斜齿减速器
      目录按钮 / 探索-拆装模式
      三维模型
      操作台
      零件检视器
      参数
      [固定底部玻璃导航：探索 / 原理 / 资料]
```

计划自检：单纯再换一套玻璃卡片无法体现机械工具的特征，因此移除顶部宣传式大标题和装饰圆环，把空间还给模型。目录默认收起而可随时打开。没有加入与结构学习无关的动画。保留前一版与生产站，只发布新的独立预览。

## 实现与验证结果

第二版已完成。49 个 CAD 零件、目录搜索、七步拆装、展开复原、传动播放、计算器与资料下载均通过检查；320、390、834、1440px 布局无横向溢出。390×844 与 320×740 首屏的播放、展开、复原、滑块均通过位置及实际命中检查，底部导航不遮挡这些操作。明暗外观、提高对比度、降低透明度与文字放大已检查。主要正文和实色背景对比度 5.88:1 以上；深色主操作按钮采用 #2168D2，白色文字对比度 5.28:1。记录见 verification.json。

最终自检：模型优先、目录随需展开、阅读面板使用实色。玻璃只放在工具与导航层。浏览器截图代表 Chromium 渲染效果，尚未在实体 iPhone 上验证。
