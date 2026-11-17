// Millimetres, degrees and seconds. Pure kinematics, independent of rendering.
export const rad = degrees => degrees * Math.PI / 180;
export const deg = radians => radians * 180 / Math.PI;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const wrap = x => ((x % 360) + 360) % 360;
const field = (key, label, value, min, max, unit = 'mm') => ({key, label, value, min, max, unit});
export const definitions = {
  'scotch-yoke': {
    title:'苏格兰轭机构', english:'SCOTCH YOKE', number:'018', initial:45,
    subtitle:'一根销，一道槽，把旋转变成往复。', task:'看销在槽中滑动，并与曲柄滑块的位移曲线对比。',
    fields:[field('r','曲柄半径 r',40,25,55),field('rod','对比连杆长度 l',140,120,220),field('rpm','输入转速',12,0,40,'r/min')],
    formula:'s轭 = r(1 − cos θ)\ns滑块 = r + l − r cos θ − √(l² − r² sin²θ)',
    explanation:'竖直槽吸收曲柄销的上下运动，轭架只沿水平方向平移。两条曲线取相同曲柄半径，以右侧死点为零，均向左为正。轭架为简谐运动；有限长度连杆使曲柄滑块的曲线偏离正弦。',
    prompt:'暂停后拖动输入角度到 90°，比较两条曲线；再增大对比连杆长度，观察差异是否减小。',
    note:'曲柄滑块作为曲线对比，三维视图显示苏格兰轭。忽略槽内间隙、摩擦与惯性。',
  },
  'crank-rocker': {
    title:'曲柄摇杆四杆机构', english:'CRANK & ROCKER', number:'019', initial:55,
    subtitle:'输入转过整圈，输出往复摆动。', task:'调整杆长，看曲柄整周转动如何带动摇杆摆动。',
    fields:[field('a','输入曲柄 a',40,25,65),field('b','中间连杆 b',140,105,180),field('c','输出摇杆 c',100,80,140),field('d','机架间距 d',130,100,170),field('rpm','输入转速',10,0,30,'r/min')],
    formula:'|AB| = a · |BC| = b · |CD| = c · |AD| = d\ns + L < p + q；最短杆为输入曲柄',
    explanation:'A、D 是固定转轴。给定输入角后，B 在以 A 为圆心的圆上；C 是以 B、D 为圆心的两圆交点。当前采用连续的上支路装配，输入杆为最短杆且满足严格 Grashof 条件，可以转过整圈。',
    prompt:'点击播放，看输入曲柄完整转动；暂停后改变 a、b、c 或 d，对比输出摇杆的摆角范围。',
    note:'不满足当前机构类型或无法闭合的参数不会应用；临界共线尺寸被排除。忽略杆厚引起的空间干涉、弹性与载荷。',
  },
  'parallelogram': {
    title:'平行四边形四杆机构', english:'PARALLELOGRAM', number:'020', initial:65,
    subtitle:'抬起台灯臂，末端仍保持水平。', task:'拖动台灯臂，观察末端连杆如何保持姿态。',
    fields:[field('a','两侧臂长 a',110,80,150),field('d','水平杆间距 d',150,110,190),field('rpm','往复频率',6,0,15,'次/min')],
    formula:'AB = DC，BC = AD\nC − B = D − A → 末端连杆姿态 = 0°',
    explanation:'两侧支臂始终平行、长度相等，末端连杆与固定机架平行。灯头固定在末端连杆上，升降时保持水平；“保持姿态”并不意味着位置不变。',
    prompt:'选择“拖动输入杆”，直接拖动左侧支臂，或用下方角度滑块。观察灯头的位置变化与 0° 姿态读数。',
    note:'教学运动范围为 15°–165°，避开共线奇异位形。模型未包含弹簧或摩擦锁止，不演示台灯的静力平衡。',
  },
  'double-rocker': {
    title:'双摇杆机构', english:'DOUBLE ROCKER', number:'021', initial:50,
    subtitle:'输入与输出，都在各自范围内摆动。', task:'拖动输入摇杆，观察输出摇杆的摆角范围。',
    fields:[field('a','输入摇杆 a',95,80,130),field('b','中间连杆 b',45,35,65),field('c','输出摇杆 c',110,85,135),field('d','机架间距 d',140,130,180),field('rpm','往复频率',6,0,15,'次/min')],
    formula:'|b − c| ≤ |BD| ≤ b + c\n|BD|² = d² + a² − 2ad cos θ',
    explanation:'此处固定最短连杆的对边，得到 Grashof 双摇杆机构。输入角的可达范围来自两圆相交条件。演示采用往复驱动，在同一装配支路上往返，不将输入摇杆当作整周旋转的曲柄。',
    prompt:'把输入摇杆拖到两端，比较输入与输出的摆角。更改杆长后，可达范围和曲线会一起重算。',
    note:'演示范围在两端各留 0.5°，避免进入切点死位。输出摆角为该装配支路、该演示范围内的数值采样结果。',
  },
  'quick-return': {
    title:'曲柄导杆急回机构', english:'QUICK RETURN', number:'022', initial:35,
    subtitle:'同一段行程，用两种时间走完。', task:'对比牛头刨床工作行程和空回行程的用时。',
    fields:[field('r','曲柄半径 r',30,20,45),field('d','固定轴间距 d',90,70,130),field('lever','导杆长度 L',220,180,300),field('rod','滑枕连杆长度 l',120,100,180),field('rpm','输入转速',12,0,30,'r/min')],
    formula:'α = asin(r / d)\nK = t工作 / t空回 = (π + 2α) / (π − 2α)',
    explanation:'曲柄绕上方固定轴 O 匀速转动，滑块在绕 A 摆动的导杆槽内移动。导杆末端通过连杆驱动水平滑枕。两切线位置对应行程端点，工作行程占较大的曲柄转角，空回占较小转角。',
    prompt:'播放观察滑枕的慢进快退；增大 r/d，对比时间条和急回系数。正转时向左为工作行程，向右为空回。',
    note:'按曲柄匀速计算真实工况用时；播放倍速仅用于观察。此模型不计算切削力、速度波动或惯性。',
  },
};
export const defaults = kind => Object.fromEntries(definitions[kind].fields.map(f=>[f.key,f.value]));
function grashof(p) {const q=[p.a,p.b,p.c,p.d].sort((a,b)=>a-b);return q[0]+q[3]<q[1]+q[2]-.1;}
export function validate(kind,p) {
  for(const f of definitions[kind].fields) if(!Number.isFinite(p[f.key])||p[f.key]<f.min||p[f.key]>f.max) throw Error(`${f.label}应在 ${f.min}–${f.max} ${f.unit} 内。`);
  if(kind==='crank-rocker' && (!grashof(p)||p.a>=Math.min(p.b,p.c,p.d)||Math.abs(p.d-p.a)<=Math.abs(p.b-p.c)+.1||p.d+p.a>=p.b+p.c-.1)) throw Error('无法保持曲柄摇杆：输入杆 a 须为最短杆，且满足严格 Grashof 条件。请调整杆长。');
  if(kind==='double-rocker') {
    if(!grashof(p)||p.b>=Math.min(p.a,p.c,p.d)||p.d<=p.a||Math.abs(p.d-p.a)>=Math.abs(p.b-p.c)||p.b+p.c>=p.d+p.a) throw Error('这组尺寸不属于当前双摇杆支路。保持 b 为最短杆，并使两圆存在上下两个摆角边界。');
    const q=angleRange(kind,p);if(q.max-q.min<5)throw Error('可达摆角过小，请调整杆长。');
  }
  if(kind==='scotch-yoke'&&p.rod<=p.r)throw Error('对比连杆长度应大于曲柄半径。');
  if(kind==='quick-return'&&(p.r>=p.d*.65||p.lever<=p.d+p.r+25||p.rod<=p.lever*(1-Math.sqrt(1-(p.r/p.d)**2))+20)) throw Error('尺寸无法闭合：需要 r < 0.65d、L > d + r + 25，并为滑枕连杆保留足够长度。');
  return true;
}
export function angleRange(kind,p) {
  if(kind==='parallelogram')return {min:15,max:165};
  if(kind==='double-rocker')return {
    min:deg(Math.acos(clamp((p.d*p.d+p.a*p.a-(p.b-p.c)**2)/(2*p.d*p.a),-1,1)))+.5,
    max:deg(Math.acos(clamp((p.d*p.d+p.a*p.a-(p.b+p.c)**2)/(2*p.d*p.a),-1,1)))-.5,
  };
  return {min:0,max:360};
}
export function intersection(B,b,D,c) {
  const dx=D.x-B.x,dy=D.y-B.y,q=Math.hypot(dx,dy);
  if(q<1e-8||q>b+c+1e-7||q<Math.abs(b-c)-1e-7)throw Error('连杆无法闭合。');
  const t=(b*b-c*c+q*q)/(2*q),h=Math.sqrt(Math.max(0,b*b-t*t));
  return {x:B.x+t*dx/q-h*dy/q,y:B.y+t*dy/q+h*dx/q};
}
export function solve(kind,p,angle) {
  const t=rad(angle),cos=Math.cos(t),sin=Math.sin(t);
  if(kind==='scotch-yoke') {
    const A={x:0,y:105},B={x:p.r*cos,y:105+p.r*sin};
    return {A,B,slider:{x:B.x,y:A.y},angle,displacement:p.r*(1-cos),comparison:p.r+p.rod-p.r*cos-Math.sqrt(p.rod*p.rod-p.r*p.r*sin*sin),slotTravel:p.r*sin};
  }
  if(kind==='quick-return') {
    const A={x:0,y:55},O={x:0,y:55+p.d},B={x:p.r*cos,y:O.y+p.r*sin};
    const distance=Math.hypot(B.x-A.x,B.y-A.y),u={x:(B.x-A.x)/distance,y:(B.y-A.y)/distance};
    const C={x:A.x+p.lever*u.x,y:A.y+p.lever*u.y};
    const slider={x:C.x+Math.sqrt(Math.max(0,p.rod*p.rod-(A.y+p.lever-C.y)**2)),y:A.y+p.lever};
    const alpha=Math.asin(p.r/p.d),workFraction=(Math.PI+2*alpha)/(2*Math.PI);
    const offset=Math.sqrt(p.rod*p.rod-(p.lever*(1-Math.cos(alpha)))**2),minimum=offset-p.lever*p.r/p.d;
    const phase=wrap(angle)>deg(Math.PI+alpha)&&wrap(angle)<deg(2*Math.PI-alpha)?'空回行程':'工作行程';
    return {A,O,B,C,slider,angle,displacement:slider.x-minimum,stroke:2*p.lever*p.r/p.d,outputAngle:deg(Math.atan2(u.y,u.x)),ratio:workFraction/(1-workFraction),workFraction,workTime:p.rpm?60/p.rpm*workFraction:null,returnTime:p.rpm?60/p.rpm*(1-workFraction):null,phase};
  }
  const A={x:0,y:80},D={x:p.d,y:80},B={x:p.a*cos,y:80+p.a*sin};
  const C=kind==='parallelogram'?{x:D.x+p.a*cos,y:D.y+p.a*sin}:intersection(B,p.b,D,p.c);
  return {A,B,C,D,angle,outputAngle:deg(Math.atan2(C.y-D.y,C.x-D.x)),couplerAngle:deg(Math.atan2(C.y-B.y,C.x-B.x)),height:(B.y+C.y)/2-80,displacement:C.x};
}
export function samples(kind,p,count=360) {
  const range=angleRange(kind,p);
  return Array.from({length:count+1},(_,i)=>solve(kind,p,range.min+(range.max-range.min)*i/count));
}
export function summary(kind,p) {
  const data=samples(kind,p),values=data.map(v=>v.outputAngle??v.displacement);
  return {min:Math.min(...values),max:Math.max(...values),span:Math.max(...values)-Math.min(...values),data};
}
// Reciprocating experiments use a smooth, imposed sinusoidal input. Rotary
// experiments use constant angular velocity, so quick-return timing is physical.
export function advance(kind,p,state,dt,speed=1) {
  if(!p.rpm)return {...state};
  if(kind==='double-rocker'||kind==='parallelogram') {
    const range=angleRange(kind,p),phase=(state.phase+dt*p.rpm/60*2*Math.PI*speed)%(2*Math.PI);
    return {phase,angle:(range.min+range.max)/2+(range.max-range.min)/2*Math.sin(phase)};
  }
  return {phase:0,angle:wrap(state.angle+dt*p.rpm*6*speed)};
}
export function phaseForAngle(kind,p,angle) {const r=angleRange(kind,p);return Math.asin(clamp((2*angle-r.min-r.max)/(r.max-r.min),-1,1));}
