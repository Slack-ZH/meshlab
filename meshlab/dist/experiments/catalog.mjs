import * as linkage from '../linkages/mechanics.mjs';
import * as mechanism from '../mechanisms/mechanics.mjs';

export const ANIMATION_SCALE=.2;
export const definitions={...linkage.definitions,...mechanism.definitions};
export const isLinkage=kind=>Object.hasOwn(linkage.definitions,kind);
export const defaults=kind=>(isLinkage(kind)?linkage:mechanism).defaults(kind);
export const validate=(kind,p)=>(isLinkage(kind)?linkage:mechanism).validate(kind,p);
export const range=(kind,p)=>isLinkage(kind)?linkage.angleRange(kind,p):mechanism.range(kind,p);
export const solve=(kind,p,input)=>(isLinkage(kind)?linkage:mechanism).solve(kind,p,input);
export const samples=(kind,p)=>(isLinkage(kind)?linkage:mechanism).samples(kind,p);
export const phaseFor=(kind,p,input)=>isLinkage(kind)?linkage.phaseForAngle(kind,p,input):0;
export function advance(kind,p,state,dt,speed,direction=1){
  if(isLinkage(kind)){const n=linkage.advance(kind,p,{angle:state.input,phase:state.phase},dt*ANIMATION_SCALE,speed);return{input:n.angle,phase:n.phase,atLimit:false};}
  return{...mechanism.advance(kind,p,state.input,dt*ANIMATION_SCALE,speed,direction),phase:0};
}
export const inputLabel=kind=>definitions[kind].input||(['parallelogram','double-rocker'].includes(kind)?'输入摆角':'输入转角');
export const inputUnit=kind=>definitions[kind].unit||'°';
export const readouts=kind=>definitions[kind].readouts||({
  'scotch-yoke':[['轭架位移','displacement','mm',2],['曲柄滑块位移','comparison','mm',2],['位移差','difference','mm',2]],
  'crank-rocker':[['输出摇杆角度','outputAngle','°',1],['最小输出角','minimum','°',1],['最大输出角','maximum','°',1]],
  'parallelogram':[['末端连杆姿态','couplerAngle','°',1],['灯头抬升高度','height','mm',1],['右臂角度','outputAngle','°',1]],
  'double-rocker':[['输出摇杆角度','outputAngle','°',1],['最小输出角','minimum','°',1],['最大输出角','maximum','°',1]],
  'quick-return':[['滑枕位移','displacement','mm',1],['急回系数 K','ratio','',3],['总行程','stroke','mm',1]],
})[kind];
export const chartSeries=kind=>definitions[kind].chart||({
  'scotch-yoke':[['displacement','轭架位移','mm'],['comparison','曲柄滑块位移','mm']],
  'crank-rocker':[['outputAngle','输出摇杆角度','°']],
  'parallelogram':[['couplerAngle','末端连杆姿态','°']],
  'double-rocker':[['outputAngle','输出摇杆角度','°']],
  'quick-return':[['displacement','滑枕位移','mm']],
})[kind];
export function results(kind,p,input,data=samples(kind,p)){
  const s=solve(kind,p,input);
  if(kind==='scotch-yoke')s.difference=s.comparison-s.displacement;
  if(['crank-rocker','double-rocker'].includes(kind)){const values=data.map(v=>v.outputAngle);s.minimum=Math.min(...values);s.maximum=Math.max(...values);}
  return s;
}

const step=(title,copy,parts=[])=>({title,copy,parts});
const assembled=step('完整装配','先观察机构的固定端与输入端。拆装时暂停运动，复原后保留当前输入位置。');
export const assemblySteps={
  'scotch-yoke':[assembled,step('取下曲柄销与挡圈','沿铰链轴线抽出连接销，释放曲柄与槽内滑块的连接。',['pins']),step('取出槽内滑块','从竖直槽内移出滑块，观察它如何吸收曲柄销的竖直运动。',['slider']),step('分离轭架与曲柄','移开开槽轭架和输入曲柄，比较轭架水平导杆与曲柄转轴的方向。',['output','input']),step('移开直线导向座','分离两侧导向座和底座；反向装配时先恢复固定支承。',['guide','frame'])],
  'crank-rocker':[assembled,step('释放四个铰链销','取下固定端 A、D 与活动端 B、C 的连接销及挡圈。',['pins']),step('移开中间连杆','沿销轴方向分离 BC 连杆，观察它连接输入曲柄与输出摇杆的位置。',['coupler']),step('分离曲柄与摇杆','移开 AB 输入曲柄和 CD 输出摇杆；比较两侧杆长与运动范围。',['input','output']),step('分离固定机架','保留 A、D 固定轴距的概念，查看底座和轴承支承。',['frame'])],
  'parallelogram':[assembled,step('取下台灯臂铰链销','释放四个转动副，注意两侧支臂与水平连杆之间的平行关系。',['pins']),step('移开水平连杆与灯头','灯头与 BC 连杆属于同一组件；装配时应与固定机架平行。',['coupler']),step('分离两侧等长支臂','移开 AB、DC 两根等长支臂；两者是姿态保持约束的一部分。',['input','output']),step('分离台灯固定支承','查看底座上的两个固定转轴；反向装配时先确定轴间距。',['frame'])],
  'double-rocker':[assembled,step('释放四杆铰接销','沿轴向抽出连接销，观察输入端、输出端各自的固定转轴。',['pins']),step('移开最短连杆','移开位于机架对侧的 BC 最短连杆，这是本页双摇杆构型的特征。',['coupler']),step('分离两侧摇杆','移开 AB 与 DC 摇杆，比较输入范围和输出摆角，不能把任一侧当作整周曲柄。',['input','output']),step('分离固定支座','观察固定轴距 d；复装后仍应满足所选双摇杆支路的闭合条件。',['frame'])],
  'quick-return':[assembled,step('抽出驱动与连接销','释放曲柄轴、导杆轴、槽内销、导杆顶端与滑枕的连接。',['pins']),step('分离滑块与滑枕连杆','移出槽内滑块和顶部连杆，区分槽内滑动副与水平滑枕导向。',['slider','coupler']),step('移开曲柄、导杆与滑枕','分离输入曲柄、摆动导杆和滑枕，沿运动链观察从旋转到往复的转换。',['input','output','ram']),step('分离滑枕导轨与底座','查看两固定转轴与水平导轨的装配位置；按上一步可逐层复装。',['guide','frame'])],
  'bevel-gears':[assembled,step('抽出两根传动轴','沿各自轴线分离输入轴与输出轴。两轴的延长线相交成 90°。',['input-shaft','output-shaft']),step('移开从动锥齿轮','沿输出轴线移开大端齿数为 z₂ 的齿轮，观察其锥面与轴孔。',['output']),step('移开主动锥齿轮','沿输入轴线移开主动轮。复装时两节锥必须保持同一顶点。',['input']),step('移开两轴支承','查看两组轴承与底座；支承位置维持两轴的相交关系。',['frame'])],
  'scissor-jack':[assembled,step('取下上下铰链销','释放底座和托座处的连接销。先卸载再拆装，此处仅作结构示意。',['pins']),step('移出丝杠与铰接螺母','分离手柄丝杠、止推座与移动螺母，观察丝杠如何改变左右铰距。',['input','nut-L','nut-R']),step('分离四根支臂和托座','四根支臂等长；按上下、左右位置观察菱形闭环关系。',['lower-left','upper-left','lower-right','upper-right','output']),step('移开千斤顶底座','查看固定铰点与底板。复装时先恢复底座，再连接各支臂。',['frame'])],
  'ratchet-pawl':[assembled,step('释放棘爪与压紧弹簧','取下棘爪和弹簧，观察爪尖与棘轮陡齿面的接触位置。',['pawl','spring']),step('移开摆动手柄','分离手柄和棘爪支座，查看棘爪支点如何随手柄往复运动。',['input']),step('分离棘轮输出组件','移开棘轮、轮毂和方头输出轴，区分输入手柄与输出套筒。',['output']),step('分离轴承支架','查看固定支承。逆序装回后再比较驱动段和回程段。',['frame'])],
  'eccentric-follower':[assembled,step('抽出驱动轴和挡圈','沿凸轮转轴取出轴系，注意轴孔与圆盘几何中心并不重合。',['shaft']),step('释放接触保持弹簧','分离压紧弹簧，观察其位于从动件与固定导向座之间。',['spring']),step('移开偏心轮与从动件','分离圆盘和平底从动件；平底必须覆盖偏心接触点的横向范围。',['input','output']),step('分离竖直导向与机架','查看导向套和立柱。复装后从动件只允许竖直平移。',['guide','frame'])],
  'roller-cam':[assembled,step('取下滚子与驱动轴','沿轴向分离接触滚子、销轴和凸轮驱动轴，观察滚子的转动副。',['roller','shaft']),step('移开接触保持弹簧','释放从动件上的弹簧。弹簧仅表示保持接触，不用于载荷计算。',['spring']),step('分离凸轮与从动杆','移开凸轮和从动杆，比较实际轮廓与滚子中心轨迹的半径偏置。',['input','output']),step('分离导向支承','查看竖直导向与底座；逆序复装后检查推程、停歇和回程。',['guide','frame'])],
  'geneva-drive':[assembled,step('取下两轴与定位件','释放主动轮、槽轮的轴系与挡圈，保留两轴中心距的参照。',['shaft']),step('移开锁止扇面','分离锁止扇面，观察它与槽轮凹圆弧对应的停歇定位关系。',['locking']),step('分离主动盘与径向槽轮','分离带销主动盘与槽轮，查看销进入径向槽时的驱动位置。',['input','output']),step('分离槽轮固定支座','查看平行轴支承和底座。复装时恢复中心距后再检查分度相位。',['frame'])],
};

const num=(v,n=1)=>Number.isFinite(v)?Number(v.toFixed(n)).toString():'—';
export function describePart(kind,part,p){
  const id=part.id,def=definitions[kind],category=['frame','guide'].includes(id)?'housing':'transmission';
  let spec='',description=part.description.replaceAll('拖动输入杆','拖动输入件'),finish='机械钢材外观 · 教学示意';
  if(id==='frame'){spec=p.d?`固定轴距 d = ${num(p.d)} mm`:p.center?`两轴中心距 c = ${num(p.center)} mm`:'固定支承与底座组件';finish='铸造支承外观 · 教学示意';}
  if(id==='guide'){spec=kind==='scotch-yoke'?'水平直线导向 · 对称双支承':kind==='quick-return'?'滑枕沿水平方向移动':'竖直直线导向 · 从动杆单自由度';finish='支承与导向套外观 · 教学示意';}
  if(id==='pins'||id==='shaft')spec=kind==='geneva-drive'?`两轴中心距 ${num(p.center)} mm · 轴向定位`:kind==='scissor-jack'?'上下铰点 A、T · Z 向连接销':'转轴、连接销及轴向定位组件';
  if(isLinkage(kind)){
    if(id==='input')spec=p.a?`中心距 a = ${num(p.a)} mm`:`曲柄半径 r = ${num(p.r)} mm`;
    if(id==='output')spec=kind==='scotch-yoke'?`竖直槽 · 水平行程 ${num(2*p.r)} mm`:kind==='quick-return'?`导杆中心距 L = ${num(p.lever)} mm`:`中心距 ${kind==='parallelogram'?'a':'c'} = ${num(p.c||p.a)} mm`;
    if(id==='coupler')spec=kind==='quick-return'?`滑枕连杆长度 l = ${num(p.rod)} mm`:`BC 中心距 = ${num(p.b||p.d)} mm${kind==='parallelogram'?' · 灯头与连杆固定':''}`;
    if(id==='slider')spec='滑块与销连接 · 在导杆槽内相对滑动';
    if(id==='ram')spec=`水平滑枕 · 总行程 ${num(2*p.lever*p.r/p.d)} mm`;
  }else if(kind==='bevel-gears'){
    if(id==='input'||id==='output'){const z=id==='input'?p.z1:p.z2,delta=id==='input'?Math.atan(p.z1/p.z2):Math.atan(p.z2/p.z1);spec=`${z} 齿 · 大端分度圆 Ø${num(p.module*z)} mm · 节锥角 ${num(delta*180/Math.PI)}°`;description=id==='input'?'主动锥齿轮固定在输入轴上，沿共同节锥母线将旋转传给从动轮。改变主动齿数会同时改变节锥角与速比。':'从动锥齿轮沿相交的输出轴旋转；与主动轮共用节锥顶点，输出转速由两轮齿数比决定。';}
    if(id.endsWith('-shaft'))spec=`${id==='input-shaft'?'X':'Z'} 方向轴线 · 两轴交角 90°`;
  }else if(kind==='scissor-jack'){
    if(id==='input'){spec=`单线丝杠导程 p = ${num(p.lead)} mm/圈`;description='手柄驱动丝杠旋转，每圈改变左右铰点的相对距离一个导程；螺旋线展示螺纹方向，不表示承载校核。';}
    if(id==='output'){spec=`高度范围 ${num(.4*p.arm)}–${num(1.85*p.arm)} mm`;description='顶部托座连接两根上支臂，随菱形机构的竖直对角线伸长而升高，底面和顶面保持水平。';}
    if(id.includes('left')||id.includes('right'))spec=`支臂中心距 L = ${num(p.arm)} mm · 四臂等长`;
    if(id.startsWith('nut-'))spec=`配对丝杠导程 ${num(p.lead)} mm/圈 · 横向螺纹副`;
  }else if(kind==='ratchet-pawl'){
    if(id==='input'){spec=`每次摆动 ${num(360*p.advanceTeeth/p.teeth)}°`;description='手柄携带棘爪支点往复摆动。驱动段通过棘爪传力，回程段越齿返回，输出保持原位。';}
    if(id==='output'){spec=`${p.teeth} 齿 · 每循环前进 ${p.advanceTeeth} 齿`;description='锯齿棘轮与方头输出轴固定，驱动段随手柄前进；回程不倒转，便于套筒扳手在有限空间反复操作。';}
    if(id==='pawl')spec='支点至爪尖 31 mm · 刚性接触构件';
  }else if(kind==='eccentric-follower'){
    if(id==='input'){spec=`圆盘 R = ${num(p.radius)} mm · 偏心距 e = ${num(p.eccentricity)} mm`;description='圆盘几何中心相对转轴偏置 e，转动时最高点升降，带动平底从动件往复。e 为零时圆盘轮廓相对轴心不变。';}
    if(id==='output'){spec=`平底直动从动件 · 行程 2e = ${num(2*p.eccentricity)} mm`;description='从动件以平底接触圆盘上沿，导向套限制其仅沿竖直方向移动。平底宽度覆盖偏心接触点的横向变化。';}
  }else if(kind==='roller-cam'){
    if(id==='input'){spec=`基圆 Rb = ${num(p.base)} mm · 升程 h = ${num(p.lift)} mm`;description='凸轮轮廓由摆线升程规律和滚子半径偏置生成。一圈依次安排推程、高位停歇、回程和低位停歇。';}
    if(id==='output'){spec=`竖直行程 ${num(p.lift)} mm · 推程 ${p.rise}° / 回程 ${p.fall}°`;description='从动杆通过叉架支承滚子，在导向套内竖直滑动；位移由当前凸轮分段运动规律决定。';}
    if(id==='roller')spec=`滚子半径 r = ${num(p.roller)} mm · 绕接触销转动`;
  }else if(kind==='geneva-drive'){
    if(id==='input'){spec=`驱动销半径 ${num(p.center*Math.sin(Math.PI/p.slots))} mm`;description='主动盘连续旋转，驱动销进入槽轮的径向槽时使其分度，离槽后继续空转。销半径随槽数与中心距更新。';}
    if(id==='output'){spec=`${p.slots} 槽 · 每次分度 ${num(360/p.slots)}°`;description='槽轮每个输入周期转过一个槽距，随后保持停歇。径向槽负责驱动，凹圆弧对应锁止定位。';}
    if(id==='locking')spec='圆弧锁止扇面 · 与槽轮凹圆弧配合';
  }
  if(id==='spring'){spec=kind==='ratchet-pawl'?'棘爪压紧弹簧 · 不计算弹簧力':'8 圈显示弹簧 · 接触保持示意';finish='弹簧钢外观 · 教学示意';}
  return{...part,category,spec:spec||def.title+' · 装配组件',description,materialLabel:finish};
}
export function applyPartMetadata(kind,viewer,p){
  const steps=assemblySteps[kind];
  for(const part of viewer.parts){Object.assign(part,describePart(kind,part,p));const order=steps.findIndex((step,i)=>i&&step.parts.includes(part.id));if(order>0)part.order=order;}
}
