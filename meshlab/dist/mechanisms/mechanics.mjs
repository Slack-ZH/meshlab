// Pure kinematics for the six unfinished experiments assigned to W.
export const rad=x=>x*Math.PI/180,deg=x=>x*180/Math.PI;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=x=>((x%360)+360)%360;
const f=(key,label,value,min,max,unit='mm',step=1)=>({key,label,value,min,max,unit,step});
export const definitions={
  'bevel-gears':{title:'直齿锥齿轮副',english:'STRAIGHT BEVEL GEARS',row:14,initial:25,
    subtitle:'沿着相交的轴线，改变动力方向。',task:'观察动力如何在两根相交轴之间传递。',input:'主动轴转角',unit:'°',
    fields:[f('z1','主动轮齿数',18,16,30,'齿'),f('z2','从动轮齿数',30,20,40,'齿'),f('module','大端模数',3,2,4),f('rpm','输入转速',10,0,30,'r/min')],
    readouts:[['传动比 i','ratio','∶1',2],['从动轴转速','outputRPM','r/min',1],['轴交角','shaftAngle','°',0]],chart:[['outputAngle','从动轴转角','°']],
    formula:'i = z₂ / z₁；n₂ = n₁z₁/z₂\nδ₁ = atan(z₁/z₂)，δ₂ = 90° − δ₁',
    explanation:'两只齿轮的节锥共用一个顶点，沿共同母线接触。两根轴相交成 90°，轮齿沿锥面母线排列。改变齿数时，节锥角、轮径和从动转速一起更新。',
    prompt:'播放后沿两根轴观察转动；增大从动轮齿数，比较传动比和输出转速。用透明支承查看共顶点的轴系。',
    note:'齿面为参数化直齿锥齿的简化形状，保持节锥、齿数和速比，不作为制造级球面渐开线或接触应力模型。转向按各轴正方向定义。'},
  'scissor-jack':{title:'剪式千斤顶',english:'SCISSOR JACK',row:15,initial:12,
    subtitle:'转动一圈丝杠，量出托座的升高。',task:'转动丝杠，看起升高度如何随手柄转数变化。',input:'累计手柄转数',unit:'圈',
    fields:[f('arm','单根臂长 L',140,120,180),f('lead','丝杠导程 p',4,2,6),f('rpm','手柄转速',12,0,40,'r/min')],
    readouts:[['起升高度 H','height','mm',1],['水平铰距 w','width','mm',1],['累计升高','lift','mm',1]],chart:[['height','起升高度','mm']],
    formula:'w = w₀ − pN\nH = √(4L² − w²)',
    explanation:'四根等长支臂组成菱形。丝杠每转一圈，使左右螺母的相对间距缩短一个导程；水平距离变小，顶端托座升高。相同圈数在不同高度处产生的升高量不同。',
    prompt:'拖动手柄转数，比较低位与高位时每转一圈的高度变化。点击“下降”反向转动，观察支臂长度保持不变。',
    note:'演示限制在 H = 0.4L 至 1.85L，避开展平和完全竖直的奇异位形。未模拟承载、摩擦、自锁与稳定性，不用于确定举升能力。'},
  'ratchet-pawl':{title:'棘轮棘爪',english:'RATCHET & PAWL',row:16,initial:70,
    subtitle:'来回摆动手柄，让输出只向一个方向前进。',task:'切换驱动和回程，观察套筒扳手如何单向传力。',input:'往复循环相位',unit:'°',
    fields:[f('teeth','棘轮齿数 z',24,18,36,'齿'),f('advanceTeeth','每次驱动齿数 k',2,1,4,'齿'),f('rpm','往复频率',12,0,30,'次/min')],
    readouts:[['每循环进给','stepAngle','°',1],['输出累计转角','outputAngle','°',1],['手柄摆角','handleAngle','°',1]],chart:[['handleAngle','手柄角度','°'],['outputAngle','输出角度','°']],
    formula:'每循环输出增量 = 360° × k / z\n驱动：输出跟随手柄；回程：输出保持',
    explanation:'驱动时棘爪抵住齿的陡面，手柄带动棘轮；回程时棘爪抬起越过齿背，手柄返回而输出不倒转。这里用一个往复周期演示套筒扳手的单向传力。',
    prompt:'点“驱动段”和“回程段”切换观察，再播放完整循环。看回程中棘爪跨过齿背，而输出角度曲线保持水平。',
    note:'每次驱动为整数齿。输出保持由理想负载约束表示；未模拟棘爪弹簧力、间隙冲击或棘齿强度。'},
  'eccentric-follower':{title:'偏心轮与直动从动件',english:'ECCENTRIC FOLLOWER',row:23,initial:20,
    subtitle:'轴心偏一点，行程就改变一点。',task:'调整偏心距，观察从动件行程变化。',input:'偏心轮转角',unit:'°',
    fields:[f('radius','偏心轮半径 R',48,40,65),f('eccentricity','偏心距 e',12,0,20),f('rpm','输入转速',10,0,30,'r/min')],
    readouts:[['从动件位移','displacement','mm',1],['总行程 2e','stroke','mm',1],['偏心距','eccentricity','mm',1]],chart:[['displacement','从动件位移','mm']],
    formula:'s = e(1 + sin θ)\n总行程 = 2e',
    explanation:'圆盘的几何中心偏离转轴。平底从动件始终贴住圆盘上沿，导向座只允许竖直移动。圆盘半径决定基准位置，偏心距决定行程。',
    prompt:'把偏心距从 12 mm 改成 20 mm，比较曲线峰谷；再设为 0，看圆盘转动时从动件是否仍起伏。',
    note:'采用平底直动从动件，弹簧仅示意保持接触；忽略惯性、摩擦及接触分离。此处不是尖顶从动件的交点公式。'},
  'roller-cam':{title:'盘形凸轮与滚子从动件',english:'RADIAL CAM & ROLLER',row:24,initial:60,
    subtitle:'一圈轮廓，安排推程、停歇和回程。',task:'手动转动凸轮，观察推程、停歇与回程。',input:'凸轮转角',unit:'°',
    fields:[f('base','基圆半径 Rb',42,35,60),f('lift','从动件升程 h',28,15,45),f('roller','滚子半径 r',8,5,12),f('rise','推程角',120,60,150,'°'),f('dwell','高位停歇角',60,30,90,'°'),f('fall','回程角',120,60,150,'°'),f('rpm','输入转速',8,0,25,'r/min')],
    readouts:[['当前升程','displacement','mm',1],['总升程','lift','mm',1],['低位停歇角','lowDwell','°',0]],chart:[['displacement','从动件升程','mm']],
    formula:'推程：s = h[u − sin(2πu)/(2π)]\n实际轮廓 = 滚子中心轨迹 − r × 外法线',
    explanation:'先给从动件指定摆线推程、停歇和回程，再将滚子中心轨迹向内偏置一个滚子半径，得到实际凸轮轮廓。转动时滚子与轮廓保持相切。',
    prompt:'暂停后拖动转角，依次经过推程、高位停歇、回程和低位停歇；修改各段角度，观察曲线分段与轮廓一起变化。',
    note:'角度总和须留出至少 30° 低位停歇。会拒绝可能发生滚子偏置尖点的尺寸；仅作刚性运动学教学，不计算弹簧动力学或制造公差。'},
  'geneva-drive':{title:'日内瓦槽轮机构',english:'GENEVA DRIVE',row:25,initial:150,
    subtitle:'主动轮连续转，槽轮一格一格走。',task:'调整槽数，观察连续转动变成间歇分度。',input:'主动轮转角',unit:'°',
    fields:[f('slots','槽数 N',4,4,8,'槽'),f('center','两轴中心距 c',140,120,180),f('rpm','输入转速',10,0,30,'r/min')],
    readouts:[['每次分度','stepAngle','°',1],['停歇占比','dwellPercent','%',1],['已完成分度','indexCount','次',0]],chart:[['outputAngle','槽轮累计转角','°']],
    formula:'主动销半径 r = c sin(π/N)\n每圈分度 = 360°/N；停歇比例 = 1/2 + 1/N',
    explanation:'主动轮上的销进入径向槽时推动槽轮转动；销退出后，槽轮停歇。每转一圈只推进一个槽距。槽数增加，每次分度角减小，转动与停歇的时间分配也随之改变。',
    prompt:'先观察四槽轮每圈转过 90°，再改为六槽，比较 60° 分度与停歇比例。拖动转角可以看清主动销进槽、滑动和退出。',
    note:'外啮合标准几何，槽宽含显示间隙，锁止面与驱动销分层展示。停歇采用理想定位约束，不计算冲击、弹性与润滑。'},
};
export const defaults=k=>Object.fromEntries(definitions[k].fields.map(f=>[f.key,f.value]));
export function range(kind,p){if(kind==='scissor-jack'){const w0=2*p.arm*Math.sqrt(.96),wmin=p.arm*Math.sqrt(4-1.85**2);return{min:0,max:(w0-wmin)/p.lead};}return{min:0,max:360};}
export function camMotion(p,angle){
  const a=wrap(angle),h=p.lift;
  let start=0,beta=p.rise,sign=1,offset=0,phase='推程';
  if(a>=p.rise&&a<p.rise+p.dwell)return{s:h,ds:0,dds:0,phase:'高位停歇'};
  if(a>=p.rise+p.dwell){start=p.rise+p.dwell;beta=p.fall;sign=-1;offset=h;phase='回程';}
  if(a>=start+beta)return{s:0,ds:0,dds:0,phase:'低位停歇'};
  const u=(a-start)/beta,b=rad(beta);
  return{s:offset+sign*h*(u-Math.sin(2*Math.PI*u)/(2*Math.PI)),ds:sign*h/b*(1-Math.cos(2*Math.PI*u)),dds:sign*h*2*Math.PI/(b*b)*Math.sin(2*Math.PI*u),phase};
}
export function camPoint(p,angle){
  const t=rad(angle),m=camMotion(p,angle),q=p.base+p.roller+m.s,v=Math.hypot(q,m.ds);
  const normal={x:(q*Math.sin(t)-m.ds*Math.cos(t))/v,y:(q*Math.cos(t)+m.ds*Math.sin(t))/v};
  return{x:q*Math.sin(t)-p.roller*normal.x,y:q*Math.cos(t)-p.roller*normal.y,normal,pitch:{x:q*Math.sin(t),y:q*Math.cos(t)},...m};
}
export function validate(kind,p){
  for(const f of definitions[kind].fields){if(!Number.isFinite(p[f.key])||p[f.key]<f.min||p[f.key]>f.max)throw Error(`${f.label}须在 ${f.min}–${f.max} ${f.unit} 内。`);if(['z1','z2','teeth','advanceTeeth','slots'].includes(f.key)&&!Number.isInteger(p[f.key]))throw Error(f.label+'必须为整数。');}
  if(kind==='roller-cam'){
    if(p.rise+p.dwell+p.fall>330)throw Error('推程、停歇、回程之和不能超过 330°，请留出至少 30° 低位停歇。');
    for(let a=0;a<360;a+=1){const m=camMotion(p,a),q=p.base+p.roller+m.s,den=q*q+2*m.ds*m.ds-q*m.dds;
      if(den>0&&(q*q+m.ds*m.ds)**1.5/den<=p.roller+1)throw Error('这组尺寸的曲率过小，滚子偏置会产生尖点。请增大基圆、延长推程/回程或减小升程与滚子。');}
  }
  return true;
}
export function bevelGeometry(p){const d1=Math.atan(p.z1/p.z2),d2=Math.PI/2-d1,R=p.module/2*Math.hypot(p.z1,p.z2),width=R*.24;return{d1,d2,R,width,r1:p.module*p.z1/2,r2:p.module*p.z2/2,z1:R*Math.cos(d1),z2:R*Math.cos(d2)};}
export function ratchetOutline(p){const R=62,n=p.teeth,points=[];for(let i=0;i<n;i++)for(const [phase,r]of [[0,R-6],[.12,R-6],[.82,R]]){const t=(i+phase)*2*Math.PI/n;points.push([r*Math.cos(t),r*Math.sin(t)]);}return points;}
function polygonRadius(points,angle){const dx=Math.cos(angle),dy=Math.sin(angle);let answer=Infinity;for(let i=0;i<points.length;i++){const [ax,ay]=points[i],[bx,by]=points[(i+1)%points.length],ex=bx-ax,ey=by-ay,den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)continue;const r=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;if(r>=0&&u>=-1e-8&&u<=1+1e-8)answer=Math.min(answer,r);}return answer;}
const smooth=u=>(1-Math.cos(Math.PI*u))/2;
export function pawlPose(p,handle,output){
  const pivot={x:30,y:74},length=31,outline=ratchetOutline(p),relative=rad(output-handle);
  function clearance(a){const x=pivot.x+length*Math.cos(a),y=pivot.y+length*Math.sin(a);return Math.hypot(x,y)-polygonRadius(outline,Math.atan2(y,x)-relative);}
  let previous=Math.PI,root=previous;
  for(let i=1;i<=90;i++){const next=Math.PI+i*Math.PI/180;if(clearance(previous)>=0&&clearance(next)<=0){let lo=previous,hi=next;for(let k=0;k<28;k++){const mid=(lo+hi)/2;if(clearance(mid)>0)lo=mid;else hi=mid;}root=(lo+hi)/2;break;}previous=next;}
  const a=rad(handle),rotate=v=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)});
  return{pivot:rotate(pivot),tip:rotate({x:pivot.x+length*Math.cos(root),y:pivot.y+length*Math.sin(root)}),rotation:root+a,length};
}
export function genevaGeometry(p){const gamma=Math.PI/p.slots,r=p.center*Math.sin(gamma),outer=p.center*Math.cos(gamma),pin=4.5,lock=r-pin-4;return{gamma,r,outer,pin,lock,beta:Math.PI/2-gamma,slotBase:Math.PI+gamma,slotEnd:p.center-r};}
export function genevaOutline(p){
  const g=genevaGeometry(p),half=g.pin+.65,R=g.outer,mouth=Math.asin(half/R),entry=Math.sqrt(R*R-half*half),points=[];
  const xy=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
  for(let i=0;i<p.slots;i++){
    const a=g.slotBase+i*2*Math.PI/p.slots;points.push(xy(entry,-half,a),xy(g.slotEnd,-half,a));
    for(let j=1;j<=14;j++){const t=-Math.PI/2-j*Math.PI/14;points.push(xy(g.slotEnd+half*Math.cos(t),half*Math.sin(t),a));}
    points.push(xy(entry,half,a));const next=a+2*Math.PI/p.slots,mid=(a+next)/2,cut=g.lock+.6;
    for(let j=1;j<=44;j++){const t=a+mouth+(next-a-2*mouth)*j/44,delta=t-mid,disc=cut*cut-p.center*p.center*Math.sin(delta)**2;let rho=R;
      if(disc>=0)rho=Math.min(R,p.center*Math.cos(delta)-Math.sqrt(disc));points.push([rho*Math.cos(t),rho*Math.sin(t)]);}
  }return points;
}
export function solve(kind,p,input){
  const a=wrap(input),t=rad(a),O={x:0,y:kind==='roller-cam'?p.base+p.lift+30:kind==='eccentric-follower'?p.radius+p.eccentricity+30:95};
  if(kind==='bevel-gears'){const g=bevelGeometry(p);return{O,input,outputAngle:-input*p.z1/p.z2,ratio:p.z2/p.z1,outputRPM:p.rpm*p.z1/p.z2,shaftAngle:90,cone1:deg(g.d1),cone2:deg(g.d2),phase:'连续传动'};}
  if(kind==='scissor-jack'){
    const w0=2*p.arm*Math.sqrt(.96),width=w0-p.lead*input,height=Math.sqrt(Math.max(0,4*p.arm*p.arm-width*width));
    return{input,width,height,lift:height-.4*p.arm,A:{x:0,y:25},L:{x:-width/2,y:25+height/2},R:{x:width/2,y:25+height/2},T:{x:0,y:25+height},phase:'丝杠调高'};
  }
  if(kind==='ratchet-pawl'){
    const cycle=Math.floor(input/360),stroke=360*p.advanceTeeth/p.teeth,driving=a<180,f=smooth((driving?a:a-180)/180),handleAngle=driving?stroke*(f-.5):stroke*(.5-f),outputAngle=stroke*(cycle+(driving?f:1));
    return{O,input,handleAngle,outputAngle,stepAngle:stroke,phase:driving?'驱动 · 棘爪抵住齿面':'回程 · 棘爪越齿',driving,pawl:pawlPose(p,handleAngle,outputAngle)};
  }
  if(kind==='eccentric-follower'){
    const C={x:p.eccentricity*Math.cos(t),y:O.y+p.eccentricity*Math.sin(t)},displacement=p.eccentricity*(1+Math.sin(t));
    return{O,C,input,displacement,stroke:2*p.eccentricity,eccentricity:p.eccentricity,follower:{x:0,y:C.y+p.radius},phase:'平底从动件保持相切'};
  }
  if(kind==='roller-cam'){
    const m=camMotion(p,a),cp=camPoint(p,a),q=p.base+p.roller+m.s,contact={x:cp.x*Math.cos(t)-cp.y*Math.sin(t),y:O.y+cp.x*Math.sin(t)+cp.y*Math.cos(t)};
    return{O,input,displacement:m.s,lift:p.lift,lowDwell:360-p.rise-p.dwell-p.fall,follower:{x:0,y:O.y+q},contact,phase:m.phase,ds:m.ds};
  }
  const g=genevaGeometry(p),theta=rad(a-180),engaged=Math.abs(theta)<=g.beta,cycle=Math.floor(input/360);
  const local=theta<-g.beta?0:theta>g.beta?-2*g.gamma:-Math.atan2(g.r*Math.sin(theta),p.center-g.r*Math.cos(theta))-g.gamma;
  const A={x:-p.center/2,y:g.outer+30},D={x:p.center/2,y:g.outer+30},B={x:A.x+g.r*Math.cos(theta),y:A.y+g.r*Math.sin(theta)};
  return{input,A,D,B,outputAngle:deg(local)-cycle*360/p.slots,stepAngle:360/p.slots,dwellPercent:100*(.5+1/p.slots),indexCount:cycle+(theta>=g.beta?1:0),engaged,phase:engaged?'分度 · 主动销在槽内':'停歇 · 槽轮保持',driverAngle:a-180};
}
export function samples(kind,p,count=360){const r=range(kind,p);return Array.from({length:count+1},(_,i)=>solve(kind,p,r.min+(r.max-r.min)*i/count));}
export function advance(kind,p,input,dt,speed=1,direction=1){
  if(kind==='scissor-jack'){const r=range(kind,p),value=clamp(input+dt*p.rpm/60*speed*direction,r.min,r.max);return{input:value,atLimit:direction>0?value>=r.max:value<=r.min};}
  return{input:input+dt*p.rpm*6*speed,atLimit:false};
}
const spinCache={key:'',values:[]};
export function rollerSpin(p,input){
  const key=[p.base,p.roller,p.lift,p.rise,p.dwell,p.fall].join('/');
  if(key!==spinCache.key){spinCache.key=key;spinCache.values=[0];for(let i=0;i<720;i++){const m=camMotion(p,(i+.5)/2),q=p.base+p.roller+m.s;spinCache.values.push(spinCache.values[i]+(1-Math.hypot(q,m.ds)/p.roller)*Math.PI/360);}}
  const phase=wrap(input)*2,i=Math.floor(phase),v=spinCache.values;
  return Math.floor(input/360)*v[720]+v[i]+(v[i+1]-v[i])*(phase-i);
}
