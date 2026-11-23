# 滚动轴承结构教学实验 · 模型与计算说明

本实验位于 [bearing.html](../bearing.html)，复用啮合实验室（meshlab）的公共三维视图、零件目录、爆炸展开、逐步拆装与 AI 助手架构，展示四类典型滚动轴承的内部结构、滚道配合与纯滚动运动关系。

## 1. 覆盖的四种滚动轴承

| 类型 ID | 名称 | 参考教学比例 | 接触形式 | 接触角 α | 可分离性 | 典型承载特点 |
| --- | --- | --- | --- | --- | --- | --- |
| `deep-groove` | 深沟球轴承 | 6208 | 点接触（深圆弧沟道） | 0°（固定） | 不可分离（剖视教学分解） | 径向为主，兼受一定双向轴向载荷 |
| `cylindrical-roller` | 圆柱滚子轴承 | N208（N 型） | 线接触（内圈双挡边） | 0°（固定） | 外圈可沿轴分离 | 高径向承载，不承受轴向载荷 |
| `tapered-roller` | 圆锥滚子轴承 | 30208 | 线接触（共顶锥面） | 10°–25°（可调） | 外圈可沿轴分离 | 径向 + 单向轴向联合载荷 |
| `thrust-ball` | 推力球轴承 | 51208 | 点接触（平面圆弧沟道） | 90°（固定） | 轴圈/座圈可顺序分离 | 仅承受单向轴向载荷 |

## 2. 几何建模原则

1. **尺寸同步重建**：改变内径 $d$、外径 $D$、宽度/高度 $B$、滚动体数 $Z$ 或圆锥接触角 $\alpha$ 时，程序先校验径向截面、壁厚与周向兜孔间隙，再实时重建内外圈滚道、滚动体、保持架、挡环与配合轴；只改转速或载荷时复用网格。
2. **圆锥滚子纯滚动共顶几何**：设节圆半径 $R_m = (d + D)/4$、滚子中心直径 $D_w$、外圈滚道半锥角 $\alpha_o = \alpha$，令 $k = D_w / (2 R_m)$，则滚子轴线倾角精确满足：
   $$\tan\beta = \frac{\sin\alpha_o}{\cos\alpha_o + k}, \quad \gamma = \alpha_o - \beta, \quad \alpha_i = \beta - \gamma$$
   由此外圈锥面、内圈锥面与圆锥滚子母线严格交于轴线上同一点 $z_A = R_m / \tan\beta$，外圈沿 $+Z$ 轴向抽离时半径单调增大、无几何穿插。
3. **剖切观察与自转标线**：默认启用 120° 外圈剖切（可切换完整/透明/隐藏外圈），并在滚动体表面加入窄指示环/标线，直观区分保持架公转与滚动体自转。

## 3. 纯滚动运动学与特征频率（外圈/座圈固定，内圈/轴圈转动）

- **径向与推力通用公式**（深沟球 $\alpha=0^\circ$、圆柱滚子 $\alpha=0^\circ$、推力球 $\alpha=90^\circ$）：
  - 保持架转速（公转）：
    $$n_c = \frac{1}{2} n_i \left(1 - \frac{D_w}{D_m}\cos\alpha\right)$$
  - 滚动体相对保持架的自转转速（负号表示反向自转）：
    $$n_b = -\frac{D_m}{2 D_w}\left[1 - \left(\frac{D_w}{D_m}\cos\alpha\right)^2\right] n_i$$
- **圆锥滚子共顶纯滚动精确公式**：
  $$n_c = \frac{\sin(\beta-\gamma)}{2\sin\beta\cos\gamma}\,n_i, \quad n_b = -\frac{\sin(\beta-\gamma)\sin(\beta+\gamma)}{2\sin\beta\sin\gamma\cos\gamma}\,n_i$$
- **特征通过频率**（以 $f_r = n_i / 60$ 计，单位 Hz）：
  - 保持架频率 $\text{FTF} = f_r \cdot (n_c / n_i)$
  - 外圈滚道通过频率 $\text{BPFO} = Z \cdot \text{FTF}$
  - 内圈滚道通过频率 $\text{BPFI} = Z \cdot (f_r - \text{FTF})$
  - 滚动体自转频率 $\text{BSF} = |n_b| / 60$

1× 演示速度采用设定工况转速的 **3% 慢放**（例如 600 r/min 时画面内圈为 18 r/min），方便肉眼辨认保持架半速公转与滚动体高速自转；演示倍速和暂停不改变理论工况计算结果。

## 4. 参考基本额定寿命估算与边界

- 按 ISO 281 基本公式计算参考疲劳寿命：
  $$L_{10} = \left(\frac{C}{P}\right)^p \quad (\text{百万转}), \qquad L_{10h} = \frac{10^6}{60\,n_i}\,L_{10} \quad (\text{h})$$
  其中球轴承 $p = 3$，滚子轴承 $p = 10/3$。
- **模型边界（不作为工程验收或制造图样）**：
  - 基本额定动载荷 $C$ 由用户按轴承样本手动输入，页面不根据简化教学几何反推厂商额定载荷。
  - 当量动载荷 $P = X F_r + Y F_a$ 采用经典教学常系数示意（圆锥轴承用 $e = 1.5\tan\alpha, Y = 0.4/\tan\alpha$），未按具体样本 $F_a/C_0$ 迭代查表，也未计入修正寿命系数 $a_{\text{ISO}}$、润滑污染、热膨胀、内部游隙、赫兹接触应力与极限转速校核。
  - 深沟球轴承实物为不可分离结构，本页的逐步拆装与爆炸视图用于展示内部装配层次。

## 5. 一手参考来源

- ISO 281:2007 *Rolling bearings — Dynamic load ratings and rating life*.
- SKF Rolling Bearings Catalogue — Bearing types, geometry, kinematics & life calculation: https://www.skf.com/group/products/rolling-bearings
- GB/T 276（深沟球轴承）、GB/T 283（圆柱滚子轴承）、GB/T 297（圆锥滚子轴承）、GB/T 301（推力球轴承）通用结构分类。
