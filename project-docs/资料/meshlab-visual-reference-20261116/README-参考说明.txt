meshlab 减速器视觉参考包

本包由本地仓库的 GL16 减速器页面实际运行后采集，不是根据文字重新生成的效果图。参考网页：https://slack-zh.github.io/meshlab/lab.html

01-full-assembly-desktop.png：完整箱体装配，桌面界面。
02-open-assembly-desktop.png：打开上盖，显示内部轴系与齿轮。
03-exploded-desktop.png：100% 爆炸展开，包含原操作栏。
04-selected-highlight-desktop.png：选中二级大齿轮，展示蓝色高亮及右侧零件说明。
05-material-closeup.png：三维视图区域细节。
06-mobile-layout.png：390×844 手机端布局。
07-motion-and-highlight.mp4：约 8.6 秒实际浏览器运动录屏，中途通过零件目录切换选中零件。无音频。齿轮按网页演示速度运行，不是设计工况的真实高速转动。
08-material-and-lighting.json：来自现有源码的逐零件颜色、金属度、粗糙度、灯光与渲染参数。
发给设计模型.txt：可随附件一起发送的说明。

桌面截图为 1440×1080，局部图为实际视图框裁取。蓝色齿轮代表选中状态，不应误认成齿轮本来的固定配色。

设计时，以这些附件锁定三维模型的材质与光照风格；网页 UI 可以按用户的新要求重新优化。没有读取网页的能力时直接使用附件，不必继续依赖外部网页加载。
