"""Generate Chinese course report and dimensioned A3 engineering sheets."""
import json,math,csv,zipfile
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4,A3,landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_CENTER
ROOT=Path(__file__).resolve().parents[1];DL=ROOT/'dist/downloads'
data=json.loads((ROOT/'dist/assets/model.json').read_text());p=data['parameters'];gs=p['gears']
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'));FONT='STSong-Light'
styles=getSampleStyleSheet()
for s in styles.byName.values():s.fontName=FONT
styles.add(ParagraphStyle(name='CN',fontName=FONT,fontSize=10,leading=18,spaceAfter=9,wordWrap='CJK',textColor=colors.HexColor('#31473f')))
styles.add(ParagraphStyle(name='H',fontName=FONT,fontSize=18,leading=25,spaceBefore=10,spaceAfter=16,textColor=colors.HexColor('#274d3e')))
styles.add(ParagraphStyle(name='Sub',fontName=FONT,fontSize=12,leading=19,spaceBefore=9,spaceAfter=8,textColor=colors.HexColor('#274d3e')))
styles.add(ParagraphStyle(name='SmallCN',fontName=FONT,fontSize=8,leading=13,spaceAfter=7,wordWrap='CJK'))
story=[]
def P(t,style='CN'):return Paragraph(t.replace('Ø','直径'),styles[style])
def para(t):story.append(P(t))
def heading(t):story.append(P(t,'H'))
def sub(t):story.append(P(t,'Sub'))
def table(rows,widths=None):
    cells=[[P(str(v),'SmallCN') for v in row] for row in rows]
    t=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e5eddd')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#cbd7c6')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),4)]));story.append(t);story.append(Spacer(1,12))
def page():story.append(PageBreak())
source='https://www.guomaolide.com/wp-content/uploads/2024/12/ZY-Series-Cylindrical-Gear-Reducer.pdf'
heading('GL16 两级斜齿圆柱齿轮减速器')
para('课程设计说明书 · 与三维交互网页和 STEP 装配模型配套')
story.append(Spacer(1,25))
table([['设计项目','采用值'],['设计用途','机械专业本科教学、课程设计与结构拆装讲解'],['结构','两级展开式、三根平行轴、外啮合渐开线斜齿轮'],['输入工况','1.5 kW / 1440 r/min / 单向平稳载荷'],['传动目标','i = 16；输出 90 r/min'],['计算效率','总效率 0.96；级间转矩计算暂取单级 0.98'],['中心距','高速级 80 mm；低速级 112 mm'],['交付','交互网页、实体 STEP、主要零件图、装配图、BOM、参数与本说明书']], [100,390])
sub('设计范围与数据口径')
para('本项目采用“工业产品作参考、独立完成课程设计”的方式。GL16 是本项目编号，不是厂家型号；公开产品目录用于比较结构、轴伸与尺寸量级，不代表内部零件与原机相同。')
para('本文区分三类数据：①厂家参考数据；②本项目确定的设计值；③用于初步校核的估算与假设。公称承载功率、匹配电机功率和实际工作功率不是同一概念。')
para('STEP 为实体几何，零件保留名称与颜色；网页网格由同一 CAD 实体离散生成。螺纹、轴承滚道、油封唇口、铸造圆角与齿根刀具包络未完整建模。图纸为课程设计图，未声明符合投产图纸全部要求。')
page();heading('01　资料依据与设计任务')
table([['项目','实际产品参考','GL16 设计'],['依据','国茂 ZY 样本 V3.5-2022，表5/9','依据教学目标重新设计'],['型号','ZLY112，名义 i=16','GL16，两级各 i=4'],['表列输入转速','1500 r/min','1440 r/min'],['表列输入功率','16 kW，公称计算/试验功率','工作输入功率 1.5 kW'],['输出转速','目录约94 r/min（取整）','90 r/min（计算值）'],['轴伸直径','输入22 mm / 输出48 mm','输入22 mm / 输出48 mm'],['内部齿数、模数、轴承','未从该目录取得内部设计','本项目计算及选择']], [95,200,195])
para('厂家说明选型需要机械功率、热功率和轴伸附加载荷验证。表列 16 kW 不能直接当作本项目的额定功率，也不能替代具体工况下的电机选型。')
sub('工作条件（教学假设）')
para('采用电动机驱动，单向连续运转、平稳负载，每日8 h，设计寿命暂取10000 h；室内、环境温度25 ℃，自然通风，联轴器连接输入和输出，暂不计轴伸额外径向载荷。未指定冲击、频繁起停或逆转工况。')
para('主要设计任务：传动比分配；齿轮几何设计；齿轮载荷与初步强度校核；轴系和键连接校核；轴承寿命估算；箱体、润滑和拆装设计。轴向力采用成对深沟球轴承的定位方案，实际采购与应用时应按目录复核等效载荷系数。')
sub('可追溯来源')
for t in ['[1] 国茂 ZY 系列圆柱齿轮减速机样本，V3.5-2022，表5、表9及选型章节。',source,'[2] KHK：Gear Types and Characteristics；两级传动比、外啮合转向、斜齿轮轴向力。','https://khkgears.net/new/gear_knowledge/abcs_of_gears-b/gear_types_and_characteristics.html','[3] Flying Drive：ZLY 系列，明确为两级平行轴渐开线斜齿传动。','https://www.flying-drive.com/product/zly-series-parallel-cylindrical-gearbox-speed-reducer/']:
 story.append(P(t,'SmallCN'))
page();heading('02　传动方案与运动参数')
para('两级均采用 z小=20、z大=80，总传动比 i=(80/20)×(80/20)=16。三根轴的转速为1440、360、90 r/min。连续两次外啮合使输入轴与输出轴同向，中间轴反向。')
table([['轴','转速 / r·min⁻¹','功率 / kW','转矩 / N·m'],['输入轴','1440','1.500','9.948'],['中间轴','360','1.470（单级效率0.98）','38.996'],['输出轴','90','1.440（总效率0.96）','152.800']], [105,130,150,105])
para('计算式：T=9550P/n，其中 P 用 kW，n 用 r/min，T 用 N·m。输出转矩 T₂=9550×1.5×0.96/90=152.8 N·m。总效率0.96与0.98²=0.9604的差异为舍入近似。')
sub('网页动画与工程转速')
para('为避免高速运动无法辨认，动画的1倍演示速度对应输入轴约12 r/min，即设计转速的1/120。三个轴始终遵守角速度比例1：−1/4：1/16。演示速度滑块只改变动画时间尺度，不改变设计参数。')
sub('旋向与轴向力')
para('高速级小齿轮右旋、大齿轮左旋；低速级小齿轮左旋、大齿轮右旋。中间轴的大、小齿轮均左旋，但主动/从动关系和啮合力方向不同，使两个级的轴向力具有抵消趋势。由于两级转矩不同，不能假定完全抵消。')
para('CAD 坐标定义：X 为三轴排列方向，Y 为竖直方向，Z 为轴线方向。三轴中心 X = −96、−16、96 mm；高速级齿宽中面 Z=−30 mm，低速级 Z=30 mm。输入端沿 −Z 伸出，输出端沿 +Z 伸出。')
page();heading('03　齿轮几何设计')
para('法向压力角 αₙ=20°，标准齿顶高系数 h*a=1、顶隙系数 c*=0.25，变位系数暂取0。取高速级法向模数1.5 mm，低速级2 mm。通过螺旋角使中心距分别为80 mm和112 mm。')
para('几何关系：cosβ=mₙ(z小+z大)/(2a)；d=mₙz/cosβ；dₐ=d+2mₙ；d_f=d−2.5mₙ；tanα_t=tanαₙ/cosβ。')
rows=[['参数','输入小齿轮','一级大齿轮','二级小齿轮','二级大齿轮']]
for label,key,fmt in [('齿数 z','z','d'),('法向模数 / mm','mn','.1f'),('螺旋角 / °','beta','.3f'),('分度圆 d / mm','d','.3f'),('齿顶圆 dₐ / mm','da','.3f'),('齿根圆 d_f / mm','df','.3f'),('齿宽 b / mm','b','.1f')]:rows.append([label]+[format(g[key],fmt) for g in gs])
rows.append(['旋向','右','左','左','右']);table(rows,[110,95,95,95,95])
sub('渐开线建模')
para('齿廓依据基圆渐开线计算，采用样条拟合两侧齿面，再按螺旋角扭转拉伸。基圆直径 d_b=d cosα_t。沿齿宽 b 的总扭转角为 b tanβ/(d/2)，单位为弧度。')
para('模型采用每齿分度圆弧齿厚减薄0.035 mm，以提供可视化啮合间隙。该值是本模型几何间隙，不替代实际生产中的齿侧间隙、公法线长度或跨棒距检验。齿根连接已简化，标准刀具生成的过渡曲线需在制造设计中重新生成。')
para('小齿轮与轴设计为一体；大齿轮以平键连接。一级齿轮孔径34 mm，二级齿轮孔径55 mm；轮毂与端面形状采用课程模型简化。')
page();heading('04　啮合力与齿轮初步强度')
loads=[]
for j in range(2):
 g=gs[2*j];T=9550*1.5/1440*3.92**j;Ft=2*T*1000/g['d'];beta=math.radians(g['beta']);Fr=Ft*math.tan(math.radians(20))/math.cos(beta);Fa=Ft*math.tan(beta);b=20 if j==0 else 26
 sf=1.5*Ft/(b*g['mn']*.32);sh=189.8*2.4*math.sqrt(1.5*Ft/(b*g['d'])*1.25);loads.append(dict(Ft=Ft,Fr=Fr,Fa=Fa,sigmaF=sf,sigmaH=sh))
para('采用小齿轮侧转矩：F_t=2T/d；F_r=F_t tanαₙ/cosβ；F_a=F_t tanβ。下表为未乘动载系数的名义啮合力。')
table([['载荷','高速级 / N','低速级 / N']]+[[label,f'{loads[0][key]:.1f}',f'{loads[1][key]:.1f}'] for label,key in [('圆周力 F_t','Ft'),('径向力 F_r','Fr'),('轴向力 F_a','Fa')]], [180,155,155])
sub('初步弯曲估算')
para('采用 Lewis 型估算 σ_F≈K F_t/(b mₙ Y)。教学计算取 K=1.5、齿形系数Y=0.32，有效齿宽取较小的配对齿宽20/26 mm。该模型未逐项分解齿向、齿间和动载系数，也未计入齿根缺口局部应力。')
sub('初步接触估算')
para('采用简化接触关系 σ_H≈Z_E Z_H √[K F_t/(b d小)×(u+1)/u]。取钢—钢弹性系数 Z_E=189.8 √MPa，几何系数 Z_H=2.4，K=1.5，u=4。重合度、螺旋角、寿命、润滑等修正项尚未按完整标准逐项展开。')
table([['检查项','高速级','低速级','教学暂定许用值'],['弯曲应力 / MPa',f"{loads[0]['sigmaF']:.1f}",f"{loads[1]['sigmaF']:.1f}",'250 MPa'],['接触应力 / MPa',f"{loads[0]['sigmaH']:.1f}",f"{loads[1]['sigmaH']:.1f}",'900 MPa']], [150,105,105,130])
para('材料设计要求为20CrMnTi渗碳淬火、齿面HRC58–62。上表250/900 MPa是课程初算使用的保守假设，不是从厂家目录查得的该材料疲劳极限。在这些假设下初算满足；严格强度结论必须结合材料质量、热处理层深、寿命和可靠度，按GB/T 3480或ISO 6336的适用版本完成计算。')
page();heading('05　轴、平键与轴承')
sub('轴的受力与强度初算')
para('两轴承中心的实际跨距：输入137 mm、中间136 mm、输出132 mm。为快速比较，下面以两端简支梁、实际齿轮作用位置估算弯矩；中间轴对两级弯矩按绝对值叠加，作为保守包络。轴向力由定位端承受，不计附加轴伸载荷。')
F1=math.hypot(loads[0]['Ft'],loads[0]['Fr']);F2=math.hypot(loads[1]['Ft'],loads[1]['Fr'])
M1=F1*38.5*98.5/137;M2=(F1+F2)*38*98/136;M3=F2*96*36/132
shafts=[]
for name,d,M,T in [('输入轴',25,M1,9948),('中间轴',30,M2,38996),('输出轴',50,M3,152800)]:
 sigma=32*M/(math.pi*d**3);tau=16*T/(math.pi*d**3);equiv=math.sqrt(sigma*sigma+3*tau*tau);shafts.append([name,d,f'{M/1000:.2f}',f'{equiv:.2f}',f'{equiv*2:.2f}'])
table([['轴','检查直径/mm','弯矩/N·m','等效应力/MPa','乘缺口系数2'],*shafts],[95,95,100,100,100])
para('等效应力采用 √(σ_b²+3τ²)，暂定许用应力80 MPa。表中初算值低于该值。实际疲劳校核仍需区分轴肩、键槽、齿根与配合处危险截面，考虑应力集中、表面质量和尺寸效应；本表不替代逐截面疲劳校核。')
sub('平键强度')
table([['位置','尺寸 b×h×l / mm','剪应力 / MPa','挤压应力 / MPa'],['一级大齿轮','10×8×18',f'{2*38996/(34*10*18):.2f}',f'{4*38996/(34*8*18):.2f}'],['二级大齿轮','16×10×24',f'{2*152800/(55*16*24):.2f}',f'{4*152800/(55*10*24):.2f}']], [110,160,110,110])
para('采用 τ=2T/(dbl)，p=4T/(dhl)，默认有效承压高度h/2。暂取许用剪应力60 MPa、挤压100 MPa，均满足初算。图中的矩形键为简化表示，实际应选标准长度、端部型式并按有效长度复核。')
page();heading('06　轴承选型与寿命估算')
table([['轴系','候选型号','内径×外径×宽度 / mm','数量'],['输入轴','6205','25×52×15','2'],['中间轴','6206','30×62×16','2'],['输出轴','6210','50×90×20','2']], [120,100,180,90])
para('上述尺寸属于通用深沟球轴承边界尺寸选择。不同品牌、保持架和游隙组的额定载荷可能不同。由于项目未指定供应商，下面给出“满足寿命所需的最低额定动载荷”，不把未经核实的品牌额定载荷写成定值。')
sub('径向反力与轴向力包络')
R1=F1*98.5/137;R2=(F1+F2)*98/136;R3=F2*96/132
Fas=[loads[0]['Fa'],loads[0]['Fa']+loads[1]['Fa'],loads[1]['Fa']]
R=[R1,R2,R3];speeds=[1440,360,90];Cs=[]
for r,fa,n in zip(R,Fas,speeds):
 Peq=1.2*(r+2*fa);Creq=Peq*(60*n*10000/1e6)**(1/3);Cs.append([f'{r:.1f}',f'{fa:.1f}',f'{Peq:.1f}',f'{Creq/1000:.2f}'])
table([['轴系','径向包络/N','轴向包络/N','等效载荷估算/N','所需C / kN']]+[[name,*v] for name,v in zip(['输入','中间','输出'],Cs)],[70,100,100,120,100])
para('寿命公式：L₁₀h = (10⁶/60n)(C/P)³。目标为10000 h，反推 C_req=P(60nL₁₀h/10⁶)^(1/3)。为课程初选，暂用 P=1.2(F_r+2F_a)的保守包络。该表达式不是具体厂商的X/Y系数公式。')
para('中间轴虽然具有轴向力抵消趋势，表中仍按两级轴向力绝对值相加进行包络。最终采购需查所选品牌C、C₀、e、X、Y、极限转速，校核静安全系数、轴向承载能力和游隙，并重新求等效载荷与寿命。必要时调整为角接触或圆锥滚子轴承组合。')
sub('装配与配合建议')
para('旋转载荷下轴承内圈与轴颈建议采用k6级配合方向，箱体孔建议H7；最终配合根据载荷、温升和拆装需要确定。齿轮孔与轴按H7/k6方向考虑，平键按标准键联接公差选取。图纸中的公差建议为设计意图，不代表所有尺寸链已经封闭验证。')
page();heading('07　箱体、润滑与拆装')
para('箱壳主体348×218×160 mm，名义壁厚10 mm；剖分面经过三轴轴线。下箱体具有385 mm长底脚，上箱盖设置检查孔。箱体材料HT200，实际铸件需增加铸造圆角、拔模斜度、加工余量与定位销结构。')
sub('轴向定位链')
para('输入小齿轮与轴一体，轴肩定位轴承。中间轴一级大齿轮通过两只套筒与轴肩/二级小齿轮端面定位；输出齿轮通过两只套筒与两侧轴肩形成定位链。轴承端盖止口接触外圈端面。实际装配需控制端盖垫片、轴向间隙及热伸长，避免两端过定位。')
sub('润滑与热平衡初估')
para('采用油池飞溅润滑。油位应使低速级齿轮适当浸油，并避免轴承过量搅油；油品、油量与换油周期应依据速度、载荷及环境选择。本模型未使用油液仿真，通气器、检查盖为结构示意，放油孔和油标需在详细工艺设计中补充。')
para('总损耗估算 P损=P输入(1−η)=1.5×0.04=0.06 kW，即60 W。按箱壳有效散热面积0.30 m²、自然散热系数10 W/(m²·K)作量级估算，温升ΔT≈60/(0.30×10)=20 K。这是估算，不是厂家热功率评级；实际油温须试验或使用可靠热平衡模型确认。')
sub('教学拆装顺序')
for i,t in enumerate(['解除合箱紧固件，交叉分次松开螺栓。','打开检查孔盖、通气器与上箱盖。','拆开轴承端盖和油封，解除轴向定位。','查看轴承配合与拆卸关系；实际需专用拉拔工具。','逐一移出输入、中间、输出轴系。','分离可拆大齿轮、平键与定位套筒，保留一体齿轮轴。','检查箱体与所有零件；按逆序装回并检查间隙、润滑和转动。'],1):para(f'{i}. {t}')
para('网页的爆炸轨迹用于显示装配关系，部分步骤先分离轴承以便看清。它不是经过工装、碰撞与可达性验证的现场维修工艺。')
page();heading('08　模型、图纸与验证记录')
table([['交付物','内容与使用'],['GL16-assembly.step','命名彩色实体装配，含'+str(len(data['parts']))+'个可选部件；轴承以滚动体和套圈组成一个显示部件'],['主要零件 STEP','输入齿轮轴、中间齿轮轴、输出轴、两只大齿轮、上下箱体'],['GL16-drawings.pdf','装配简图、轴系零件图、齿轮参数图、箱体尺寸图、附件尺寸表'],['parts-list.csv','与网页零件ID一致的名称、类别、材料和规格'],['design-parameters.json','机器可读的几何、传动参数'],['交互网页','选择讲解、中文朗读、运转慢放、爆炸与逐步拆装、原理计算']], [145,345])
sub('几何与一致性检查')
para('生成脚本逐件执行CAD拓扑有效性检查；从有效实体导出STEP及三维网页网格。齿数、分度圆、中心距和螺旋角由同一参数计算，避免网页与图纸分别填写。STEP是几何交换文件，不包含SolidWorks或Creo原生特征历史及装配约束。')
sub('需要继续深化的工程内容')
para('本轮完成课程级结构表达和初步计算。若用于实际制造，需继续完善：标准齿轮强度校核、轴疲劳与键槽细节、轴承厂商数据、轴向游隙/公差链、润滑油路与油位、端盖紧固和定位销、铸造与加工工艺、密封沟槽、完整几何公差及出厂检验。')
para('产品目录数据的引用不构成对GL16性能的保证；所有教学假设均可在参数与计算脚本中调整。设计修改后应重新生成网页网格、STEP、图纸与报告，保持版本一致。')
sub('主要零件索引')
table([['编号','名称','材料'],*[[x['id'],x['name'],x['material']] for x in data['parts'] if x['id'] in ['input','middle','output','gear1','gear2','housing_top','housing_base']]], [110,160,220])
def footer(c,doc):
 c.setStrokeColor(colors.HexColor('#ccd7c5'));c.line(48,40,547,40);c.setFont(FONT,8);c.setFillColor(colors.HexColor('#778571'));c.drawString(48,27,'GL16 / 课程设计说明书 · 参考工业结构的独立设计');c.drawRightString(547,27,str(doc.page))
SimpleDocTemplate(str(DL/'GL16-design-report.pdf'),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=45,bottomMargin=55,title='GL16 两级减速器课程设计说明书',author='啮合实验室').build(story,onFirstPage=footer,onLaterPages=footer)

# A3 dimensioned teaching engineering drawings. Projection sketches are constructed from the same parameters.
W,H=landscape(A3);c=canvas.Canvas(str(DL/'GL16-drawings.pdf'),pagesize=(W,H));c.setTitle('GL16 装配及主要零件工程图')
def txt(x,y,s,size=10):c.setFont(FONT,size);c.drawString(x,y,str(s).replace('Ø','D'))
def line(x1,y1,x2,y2):c.line(x1,y1,x2,y2)
def dim(x1,y1,x2,y2,label,offset=25):
 c.setLineWidth(.5)
 if abs(y2-y1)<.01:
  yy=y1+offset;line(x1,y1,x1,yy+5);line(x2,y2,x2,yy+5);line(x1,yy,x2,yy)
  for x,d in [(x1,1),(x2,-1)]:line(x,yy,x+d*6,yy+2);line(x,yy,x+d*6,yy-2)
  c.setFont(FONT,10);c.drawCentredString((x1+x2)/2,yy+5,label.replace('Ø','D'))
 else:
  xx=x1+offset;line(x1,y1,xx+5,y1);line(x2,y2,xx+5,y2);line(xx,y1,xx,y2)
  for y,d in [(y1,1),(y2,-1)]:line(xx,y,xx+2,y+d*6);line(xx,y,xx-2,y+d*6)
  txt(xx+6,(y1+y2)/2,label)
 c.setLineWidth(.9)
def center(x,y,r):c.setDash([7,3,1,3]);line(x-r-12,y,x+r+12,y);line(x,y-r-12,x,y+r+12);c.setDash()
def frame(title,no,material='见明细',scale='示意比例，尺寸为准'):
 c.setStrokeColor(colors.HexColor('#263c36'));c.setFillColor(colors.HexColor('#263c36'));c.setLineWidth(.8);c.rect(25,25,W-50,H-50)
 txt(45,H-53,'GL16  /  两级展开式斜齿圆柱齿轮减速器',16);txt(45,H-76,'课程设计图 · 长度单位 mm · D 表示直径 · 角度单位 ° · 参数与 STEP 同源',9)
 c.rect(W-405,25,380,85);line(W-405,65,W-25,65);line(W-205,25,W-205,65)
 txt(W-390,86,title,14);txt(W-390,48,'图号：GL16-'+no,10);txt(W-190,48,'材料：'+material,10);txt(W-390,33,scale,8)
def notes(lines,x=55,y=230):
 txt(x,y,'技术说明 / 设计要求',12)
 for i,t in enumerate(lines):txt(x,y-22-18*i,t,9)
def sheet():c.showPage()

frame('装配总图 / 简化正视与俯视','A00')
s=1.42;ox=310;oy=470
# front (looking along shafts)
c.rect(ox-138*s,oy-109*s,348*s,218*s)
c.setDash(6,3);line(ox-160*s,oy,ox+225*s,oy);c.setDash()
for x,g in [(-96,gs[0]),(-16,gs[1]),(96,gs[3])]:
 c.circle(ox+x*s,oy,g['da']/2*s);c.setDash(4,3);c.circle(ox+x*s,oy,g['d']/2*s);c.setDash();center(ox+x*s,oy,15)
for x,r in [(-96,26),(-16,31),(96,45)]:c.circle(ox+x*s,oy,r*s)
dim(ox-96*s,oy,ox-16*s,oy,'80',190);dim(ox-16*s,oy,ox+96*s,oy,'112',190)
dim(ox-138*s,oy-109*s,ox+210*s,oy-109*s,'348',-35)
txt(145,265,'沿轴方向视图：两级齿轮投影重叠，以实线/节圆表达',9)
# schematic top view at right
sx=850;sy=470;k=.85
c.rect(sx-138*k,sy-80*k,348*k,160*k)
for x in [-96,-16,96]:line(sx+x*k,sy-130*k,sx+x*k,sy+138*k)
for x,z,g in [(-96,-30,gs[0]),(-16,-30,gs[1]),(-16,30,gs[2]),(96,30,gs[3])]:c.rect(sx+(x-g['da']/2)*k,sy+(z-g['b']/2)*k,g['da']*k,g['b']*k)
dim(sx-138*k,sy-80*k,sx-138*k,sy+80*k,'160',-30)
txt(740,620,'俯视 / 动力路径',12);txt(740,340,'输入端 −Z；输出端 +Z',10)
notes(['输入功率1.5 kW；输入1440 r/min；总传动比16；输出90 r/min。','两级齿数均20/80；高速级mₙ=1.5，低速级mₙ=2；压力角20°。','输入轴与输出轴同向，中间轴反向；轴向定位采用轴肩、套筒与端盖。','正视投影为结构表达，不按此简图加工齿形；精确形体参见对应STEP。','装配后检查转动、轴向间隙、齿侧间隙及润滑；端盖连接件在CAD中省略。'],y=220)
sheet()

def shaft_draw(id,title,segments,gear_defs,key_info,material):
 frame(title,id,material);scale=2.7;ox=500;oy=510
 zmin=min(a for a,b,d in segments);zmax=max(b for a,b,d in segments)
 for a,b,d in segments:c.rect(ox+a*scale,oy-d/2*scale,(b-a)*scale,d*scale)
 for zz,g in gear_defs:
  c.rect(ox+(zz-g['b']/2)*scale,oy-g['da']/2*scale,g['b']*scale,g['da']*scale)
  for n in range(7):
   y=oy-g['da']/2*scale+n*g['da']*scale/6;line(ox+(zz-g['b']/2)*scale,y,ox+(zz+g['b']/2)*scale,y+8)
  txt(ox+(zz-g['b']/2)*scale,oy+g['da']/2*scale+15,f"齿宽{g['b']} / z={g['z']}",10)
 c.setDash([7,3,1,3]);line(ox+(zmin-10)*scale,oy,ox+(zmax+10)*scale,oy);c.setDash()
 dim(ox+zmin*scale,oy,ox+zmax*scale,oy,str(zmax-zmin),-140)
 for a,b,d in segments:
  if b-a>=10:dim(ox+a*scale,oy,ox+b*scale,oy,str(b-a),-95);txt(ox+(a+b)/2*scale-12,oy+d/2*scale+8,'Ø'+str(d),9)
 notes(['轴线方向为图中水平方向；各段坐标范围见下表。','轴承位配合建议k6，非配合表面按工艺要求确定；未注倒角建议1×45°。','键槽尺寸、圆角和公差应按配套标准复核；螺纹与退刀槽未细化。',*key_info],y=280)
 xx=760;yy=275;txt(xx,yy,'段起点Z / 终点Z / 直径',11)
 for i,(a,b,d) in enumerate(segments):txt(xx,yy-21-17*i,f'{a:>4}  →  {b:>4}     Ø{d}',10)
 sheet()
shaft_draw('P01','输入齿轮轴',[(-130,-76,22),(-76,-61,25),(-61,-56,28),(-56,56,25),(56,61,28),(61,76,25)],[(-30,gs[0])],['输入轴伸键槽宽6、模型长32；齿轮中面Z=−30。','齿轮：mₙ1.5，z20，右旋β20.364°，齿面HRC58–62。'],'20CrMnTi')
shaft_draw('P02','中间齿轮轴',[(-76,-60,30),(-60,-55,36),(-55,-40,30),(-40,-20,34),(-20,55,30),(55,60,36),(60,76,30)],[(30,gs[2])],['一级齿轮座Ø34，Z=−40至−20；键10×8×18。','二级小齿轮mₙ2、z20、左旋β26.766°；中面Z=30。'],'20CrMnTi')
shaft_draw('P03','输出轴',[(-76,-56,50),(-56,-51,56),(-51,17,50),(17,43,55),(43,51,50),(51,56,56),(56,76,50),(76,138,48)],[],['大齿轮键16×10×24，模型键槽底坐标Y=21.5。','输出轴伸键槽宽14、长48，模型槽底Y=20.5。'],'45钢调质')

for idx,name,bore in [(1,'一级大齿轮',34),(3,'二级大齿轮',55)]:
 g=gs[idx];frame(name,'G0'+str(1 if idx==1 else 2),'20CrMnTi');ox=330;oy=490;scale=2 if idx==1 else 1.7;r=g['da']/2*scale
 c.circle(ox,oy,r);c.circle(ox,oy,g['df']/2*scale);c.circle(ox,oy,bore/2*scale);c.setDash(7,3);c.circle(ox,oy,g['d']/2*scale);c.setDash();center(ox,oy,r)
 for j in range(g['z']):
  a=2*math.pi*j/g['z'];line(ox+g['df']/2*scale*math.cos(a),oy+g['df']/2*scale*math.sin(a),ox+r*math.cos(a),oy+r*math.sin(a))
 dim(ox-r,oy,ox+r,oy,'Ø'+str(round(g['da'],3)),r+35)
 txt(ox-40,oy-20,'孔 Ø'+str(bore),12)
 xx=740;c.rect(xx,oy-r,g['b']*scale,2*r);dim(xx,oy-r,xx+g['b']*scale,oy-r,str(g['b']),-35)
 txt(900,640,'齿轮参数表',14)
 for j,(label,val) in enumerate([('法向模数',g['mn']),('齿数',80),('法向压力角','20°'),('螺旋角',f"{g['beta']:.3f}°"),('旋向','左' if idx==1 else '右'),('分度圆',f"{g['d']:.3f}"),('齿根圆',f"{g['df']:.3f}"),('变位系数',0),('孔配合建议','H7')]):txt(900,610-j*23,f'{label}：{val}',11)
 notes(['图示齿廓为符号表达，准确渐开线形体以STEP与参数表为准。','齿面渗碳淬火HRC58–62；硬化层深度、精度等级与检验尺寸需进一步确定。',('键槽宽10，槽顶距轴线20；平键10×8×18。' if idx==1 else '键槽宽16，槽顶距轴线31.5；平键16×10×24。'),'端面倒角、齿端修缘和齿根过渡按后续制造工艺完善。'],y=235)
 sheet()

for top in [False,True]:
 frame('上箱盖' if top else '下箱体','H02' if top else 'H01','HT200');ox=295;oy=470;s=1.7
 yy=0 if top else -109;c.rect(ox-138*s,oy+yy*s,348*s,109*s)
 c.setDash(5,3);c.rect(ox-128*s,oy+(0 if top else -99)*s,328*s,99*s);c.setDash()
 for x,r in [(-96,26),(-16,31),(96,45)]:
  c.arc(ox+(x-r)*s,oy-r*s,ox+(x+r)*s,oy+r*s,0 if top else 180,180);center(ox+x*s,oy,8)
 dim(ox-138*s,oy+yy*s,ox+210*s,oy+yy*s,'348',-35 if not top else 215)
 dim(ox-96*s,oy,ox-16*s,oy,'80',-240 if not top else -55);dim(ox-16*s,oy,ox+96*s,oy,'112',-240 if not top else -55)
 xx=900;zz=470;c.rect(xx-80,zz-109,160,109);dim(xx-80,zz-109,xx+80,zz-109,'160',-35)
 txt(800,620,'端向示意 / 壁厚10',12)
 notes(['主体外廓348×218×160（合箱），内腔328×198×120。','三轴中心X：−96、−16、96；剖分面Y=0；轴承孔Ø52、Ø62、Ø90。','合箱孔X：−130、−50、40、130、200；Z=±78；孔径Ø9，共10组。','上下箱体合装后加工轴承座孔；孔配合建议H7，需控制同轴度与中心距。',('检查孔78×62；盖板96×80×7；上盖需增加铸造圆角与定位销。' if top else '底脚385×30×16，两条；孔X=−135/207，Z=±76，Ø14，共4孔。'),'图纸为课程结构图；铸造工艺、孔位定位公差、加工余量需进一步深化。'],y=195)
 sheet()

frame('附件尺寸与装配明细','B01')
txt(60,710,'标准件、定位套筒与端盖',18)
rows=[['部件','规格或尺寸（mm）','数量','说明'],['输入轴承','6205 / 25×52×15','2','具体品牌载荷参数待选定'],['中间轴承','6206 / 30×62×16','2','深沟球轴承'],['输出轴承','6210 / 50×90×20','2','深沟球轴承'],['中间轴套筒1','Ø30/Ø40 × 15','1','Z=−55至−40'],['中间轴套筒2','Ø30/Ø40 × 36','1','Z=−20至16'],['输出轴套筒1','Ø50/Ø60 × 68','1','Z=−51至17'],['输出轴套筒2','Ø50/Ø60 × 8','1','Z=43至51'],['6205端盖','外径70，厚7，止口Ø52×4.5','2','一透一闷；中心Z=±84'],['6206端盖','外径80，厚7，止口Ø62×4.5','2','双闷盖'],['6210端盖','外径108，厚7，止口Ø90×4.5','2','一透一闷'],['一级平键','10×8×18','1','模型矩形键'],['二级平键','16×10×24','1','模型矩形键'],['合箱螺栓/螺母','M8，螺栓杆模型长24','10套','螺纹简化；实际选标准长度'],['检查孔盖','96×80×7','1','板件'],['输入/输出密封','内径22/48，宽5','各1','结构示意，实际选标准油封']]
yy=675
for i,row in enumerate(rows):
 if i==0:c.setFillColor(colors.HexColor('#e5eddd'));c.rect(55,yy-5,1060,28,fill=1,stroke=0);c.setFillColor(colors.HexColor('#263c36'))
 for x,t in zip([65,280,650,720],row):txt(x,yy,t,11)
 line(55,yy-9,1115,yy-9);yy-=30
notes(['端盖安装孔：4×Ø5，均布于止口半径+4.5的圆上，首孔方位45°。','端盖安装螺钉、垫片及定位销未在三维模型中逐一展开。','本页用于附件选型与结构对应；标准件优先按供应商正式图纸采购。'],y=150)
c.save()

readme='''GL16 两级斜齿减速器 / 课程设计交付包

1. GL16-assembly.step：完整实体装配（mm），保留部件名称与颜色。
2. input/middle/output/gear1/gear2/housing_top/housing_base.step：主要非标零件。
3. GL16-drawings.pdf：A3课程设计工程图；尺寸为准，打印按实际纸张。
4. GL16-design-report.pdf：计算、依据、假设及需要继续深化的工程内容。
5. parts-list.csv：UTF-8 BOM，可用Excel导入。
6. design-parameters.json：网页/CAD/说明书共同设计参数。

参考工业结构，不是厂家原机复刻；未声明可直接按此投产。
图纸包含装配和主要非标零件，标准件用附件表表达。
网页模型来自同源CAD实体。STEP不包含原生参数特征树或装配约束。
'''
(DL/'README.txt').write_text(readme,encoding='utf8')
with zipfile.ZipFile(DL/'GL16-engineering-package.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(DL.iterdir()):
  if f.is_file() and f.suffix!='.zip':z.write(f,f.name)
calculations={'loads':loads,'shaft_checks':shafts,'bearing_requirements':Cs,'ratio':16,'output_rpm':90,'output_torque':152.8}
(ROOT/'scripts/calculations.json').write_text(json.dumps(calculations,ensure_ascii=False,indent=2))
print('Generated report, drawings, ZIP. Parts:',len(data['parts']))
