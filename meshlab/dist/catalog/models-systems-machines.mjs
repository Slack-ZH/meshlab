import {TAU,rad,colors as C,num,choice,rpm,metric as M,box,cylinder,ring,gear,rod,part,rz,xy,add,define,integer,planetary,planetaryPoses,bevel,helix,circle,Rz,Ry,matmul,transform,euler} from './models-systems-helpers.mjs';

export function cncState(p,a){const linked=p.mode==='linked',x=p.travel*Math.cos(a),y=linked?p.travel*Math.sin(a):0,z=90+(linked?10*Math.sin(2*a):0),c=linked?a*p.rotaryRatio:0,w=p.inputRPM*TAU/60;
  const vx=-p.travel*Math.sin(a)*w,vy=linked?p.travel*Math.cos(a)*w:0,vz=linked?20*Math.cos(2*a)*w:0;
  return {x,y,z,c,vx,vy,vz,toolLocal:transform(Rz(-c),[-x,-y,z-36])};}
const screwNut=(axis,color)=>({kind:'polygon',points:[[-8,-8],[8,-8],[8,8],[-8,8]],holes:[circle(5)],depth:16,color,rotation:axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0]});
export const cnc=define({id:'cnc-feed',number:56,title:'多轴数控机床进给传动',description:'联动丝杠直线进给和转台，观察刀具与工件的相对运动。',
  cameraUp:[0,0,1],cameraDirection:[1,-1,.8],
  fields:[choice('mode','联动程序','linked',[['linked','XYZ + C 联动'],['line','仅 X 往复']]),num('travel','XY 运动幅值','mm',20,50,5,35),num('lead','各轴丝杠导程','mm',4,16,2,8),{...num('rotaryRatio','转台/程序相位比','',0,2,.25,.5),enabledWhen:p=>p.mode==='linked',inactiveHint:'仅X往复时C转台停转，相位比不参与计算。'},num('inputRPM','程序循环参考速度','r/min',0,30,1,6)],
  build(p){return {parts:[
    part('cnc-bed','床身与 X 导轨','X 工作台沿两根导轨平移。',[box([190,240,12],C.dark,[0,20,-43]),rod([-85,-50,-30],[85,-50,-30],4),rod([-85,50,-30],[85,50,-30],4)],[0,0,0],[0,0,0],'housing'),
    part('cnc-xscrew','X 丝杠','丝杠旋转通过固定在滑台上的螺母产生 X 进给。',[cylinder(4,180,C.input,[0,0,0],[0,Math.PI/2,0]),helix(4,p.lead,165,'x')],[0,-75,-25]),
    part('cnc-xnut','X 螺母与鞍座','X 位移跟随丝杠导程关系。',[screwNut('x',C.input),rod([0,8,0],[0,75,5],4,C.input),box([65,130,9],C.steel,[0,75,9])],[0,-75,-25]),
    part('cnc-yscrew','Y 丝杠','整个 Y 轴随 X 鞍座平移。',[cylinder(4,140,C.mid,[0,0,0],[Math.PI/2,0,0]),helix(4,p.lead,128,'y',C.mid)],[0,0,-5]),
    part('cnc-ynut','Y 螺母与滑台','Y 位移相对于 X 鞍座。',[screwNut('y',C.mid),box([85,75,7],C.steel,[0,0,11.5])]),
    part('cnc-rotary','C 轴转台及偏心工件','偏心工件让转台旋转和线性进给的叠加清晰可见。',[cylinder(32,12,C.output),box([22,14,20],C.input,[17,0,16]),rod([-28,0,7],[28,0,7],1.5,C.dark),cylinder(7,12,C.output,[0,0,-12])],[0,0,20]),
    part('cnc-column','固定立柱与 Z 导轨','刀具 Z 轴在固定立柱上移动。',[box([110,18,140],C.dark,[0,110,35]),rod([-25,94,20],[-25,94,130],4),rod([25,94,20],[25,94,130],4)],[0,0,0],[0,0,0],'housing'),
    part('cnc-zscrew','Z 丝杠','Z 进给独立于工作台 XY/C 运动。',[cylinder(4,115,C.input),helix(4,p.lead,105)],[0,92,75]),
    part('cnc-znut','Z 螺母与主轴滑枕','连接螺母与刀具主轴。',[screwNut('z',C.input),rod([0,-8,0],[0,-92,0],5,C.steel)],[0,92,90]),
    part('cnc-tool','主轴与刀具','刀尖位置是本页的观察点；未模拟切削去除。',[cylinder(14,26,C.steel,[0,0,12]),cylinder(3,16,C.output,[0,0,-8])],[0,0,90]) ]};},
  sample(p,a){const q=cncState(p,a);return {poses:{'cnc-xscrew':{rotation:[TAU*q.x/p.lead,0,0]},'cnc-xnut':{position:[q.x,-75,-25]},'cnc-yscrew':{position:[q.x,0,-5],rotation:[0,TAU*q.y/p.lead,0]},'cnc-ynut':{position:[q.x,q.y,-5]},'cnc-rotary':rz(q.c,[q.x,q.y,20]),'cnc-zscrew':rz(TAU*(q.z-90)/p.lead),'cnc-znut':{position:[0,92,q.z]},'cnc-tool':{position:[0,0,q.z]}},metrics:[M('X 位移',q.x,'mm'),M('Y 位移',q.y,'mm'),M('Z 刀尖高度',q.z-16,'mm'),M('C 转台角',q.c*180/Math.PI,'°'),M('X 丝杠转速',q.vx*60/p.lead,'r/min'),M('Y 丝杠转速',q.vy*60/p.lead,'r/min'),M('Z 丝杠转速',q.vz*60/p.lead,'r/min'),M('刀尖在转台坐标 X',q.toolLocal[0],'mm'),M('刀尖在转台坐标 Y',q.toolLocal[1],'mm')],status:'输入为程序循环参考速度，各进给电机按轨迹变速；丝杠角位移与直线位移严格关联。'};},
  principle:[{title:'旋转到直线',text:'相同位移下，导程越大，电机需要的转角越小。',formula:'x = 导程 × θ丝杠/(2π)'},{title:'刀具相对工件',text:'工作台平移与 C 轴旋转叠加，应把刀具位置变换到工件坐标观察。',formula:'p工件 = Rz(−C) (p刀具−p转台)'}],
  sources:[{title:'Haas：直线轴与转台联动',url:'https://www.haascnc.com/service/online-operator-s-manuals/rotary-tailstock---operator-s-manual-supplement/rotary---introduction.html'},{title:'Haas：滚珠丝杠轴系',url:'https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/ballscrew---vertical-axis---replacement.html'}],
  limits:'XYZ+C 四轴的程序轨迹教学模型；丝杠螺旋采用与正转正位移一致的示意旋向；螺母有避让通孔，不含滚珠滚道或循环滚珠内部。没有切削去除、刀具补偿、伺服跟随误差或碰撞路径规划。C 轴电机简化为直接驱动。'});

function cutTube(outer,inner,length,color){const pts=[];for(let i=0;i<=32;i++){const a=Math.PI+Math.PI*i/32;pts.push([outer*Math.cos(a),outer*Math.sin(a)]);}for(let i=32;i>=0;i--){const a=Math.PI+Math.PI*i/32;pts.push([inner*Math.cos(a),inner*Math.sin(a)]);}return {kind:'polygon',points:pts,depth:length,color};}
export function wristState(p,a){const u=a/p.reduction,all=p.mode==='combined',q4=rad(p.axis4)+(all||p.mode==='axis4'?u:0),q5=rad(p.axis5)+(all||p.mode==='axis5'?.45*Math.sin(u):0),q6=rad(p.axis6)+(all||p.mode==='axis6'?-u:0);
  const A=Rz(q4),B=matmul(A,Ry(q5)),D=matmul(B,Rz(q6)),pivot=[0,0,58],end=add(pivot,transform(B,[0,0,45]));return {q4,q5,q6,A,B,D,pivot,end,shaft4:q4,shaft5:q4-q5,shaft6:q4-q5+q6};}
export const wrist=define({id:'robot-wrist',number:57,title:'工业机器人腕部传动',description:'剖开多根同轴传动轴，看末端多轴动作如何合成。',
  cameraDirection:[1,.35,.3],
  fields:[choice('mode','动作','combined',[['combined','三轴合成'],['axis4','仅腕部回转'],['axis5','仅腕部俯仰'],['axis6','仅工具旋转']]),num('axis4','腕部初始回转','°',-90,90,5,20),num('axis5','初始俯仰','°',-40,40,5,20),num('axis6','工具初始转角','°',-90,90,5,0),num('reduction','输入参考/动作比例','',3,20,1,6)],
  build(){return {parts:[
    part('wr-case','剖开前臂','固定外壳露出三根同轴传动轴。',[cutTube(24,21,100,C.dark)],[0,0,-32],[0,0,0],'housing'),
    part('wr-outer','外套轴 → 腕部回转','外套轴直接带动第一个腕部构件。',[cutTube(19,16,100,C.input),ring(22,16,5,C.input,[0,0,-52]),rod([0,18,48],[0,27,90],3,C.input),rod([0,-18,48],[0,-27,90],3,C.input)],[0,0,-32]),
    part('wr-middle','中套轴 → 俯仰','相对外套轴的角位移经锥齿传动形成俯仰。',[cutTube(13,10,120,C.mid),ring(15,10,5,C.mid,[0,0,-62]),{...bevel(24,21,10,C.mid),position:[0,0,60]}],[0,0,-14]),
    part('wr-inner','内轴 → 工具转动','最内轴相对中套轴的角位移传至末端。',[cylinder(6,142,C.output),ring(8,6,5,C.output,[0,0,-73])],[0,0,-10]),
    part('wr-bend','俯仰铰架与锥齿轮','垂直于前臂的第二个转轴。',[{...bevel(24,21,10,C.mid),rotation:[Math.PI/2,0,0]},rod([0,-27,0],[0,-8,0],5,C.mid),rod([0,8,0],[0,27,0],5,C.mid),rod([0,-24,0],[0,-24,40],3,C.mid),rod([0,24,0],[0,24,40],3,C.mid)],[0,0,58]),
    part('wr-transfer','内轴转向锥齿示意','两次转向把内轴运动传到工具；本页采用理想耦合补偿关系。',[bevel(16,13,8,C.output),cylinder(4,35,C.output,[0,0,18])],[0,0,61]),
    part('wr-flange','末端法兰与工具','工具姿态由三个串联旋转合成。',[cylinder(24,7,C.output),cylinder(7,22,C.steel,[0,0,12]),box([34,8,8],C.output,[0,0,28]),box([5,8,20],C.output,[14,0,39]),box([5,8,20],C.output,[-14,0,39]),cylinder(3,2,C.red,[16,0,5])],[0,0,103]) ]};},
  sample(p,a){const q=wristState(p,a);return {poses:{'wr-outer':rz(q.shaft4),'wr-middle':rz(q.shaft5),'wr-inner':rz(q.shaft6),'wr-bend':{rotation:euler(q.B)},'wr-transfer':{position:add(q.pivot,transform(q.B,[0,0,8])),rotation:euler(q.D)},'wr-flange':{position:q.end,rotation:euler(q.D)}},metrics:[M('腕部回转 q4',q.q4*180/Math.PI,'°'),M('俯仰 q5',q.q5*180/Math.PI,'°'),M('工具旋转 q6',q.q6*180/Math.PI,'°'),M('中套轴相对外套轴',q.shaft5-q.shaft4,'rad'),M('内轴相对中套轴',q.shaft6-q.shaft5,'rad'),M('法兰中心 X',q.end[0],'mm'),M('法兰中心 Y',q.end[1],'mm'),M('法兰中心 Z',q.end[2],'mm')],status:'套轴不是各自直接等于关节角：采用理想1:1转向与补偿，q5=φ外−φ中，q6=φ内−φ中。'};},
  principle:[{title:'同轴传递与耦合补偿',text:'三根轴同心布置，外层构件运动会改变内层的相对转角。',formula:'φ外=q4；φ中=q4−q5；φ内=q4−q5+q6'},{title:'姿态合成',text:'工具按当前局部轴转动，三次旋转的顺序不能互换。',formula:'R = Rz(q4) Ry(q5) Rz(q6)'}],
  sources:[{title:'工业机器人三重同轴腕部专利 US4684313A',url:'https://patents.google.com/patent/US4684313A/en'},{title:'同轴空心腕部专利 US6014909A',url:'https://patents.google.com/patent/US6014909A/en'}],
  limits:'参考同轴腕部拓扑的理想三自由度教学模型，采用自定义1:1耦合补偿关系，不复刻专利的完整齿轮链。锥齿只表达轴线转向，未做共轭接触；半剖套轴跟随旋转用于辨认层次，不代表真实开槽轴。未求刚度、负载或机器人逆解。'});

const smooth=x=>x*x*(3-2*x);
export function clockState(p,a){const half=a/Math.PI,k=Math.floor(half),u=half-k,release=u<p.releaseFraction,progress=release?smooth(u/p.releaseFraction):1,escape=(k+progress)*Math.PI/15,side=k%2?1:-1,fork=side*.12*(1-2*progress),balance=rad(p.amplitude)*Math.sin(a);return {escape,fork,balance,release,half:k,progress};}
const spiral=(r0,r1,turns,z,color)=>({kind:'tube',radius:.55,color,points:Array.from({length:241},(_,i)=>{const a=TAU*turns*i/240,r=r0+(r1-r0)*i/240;return xy(r,a,z);})});
// Envelope of both pin pallets over one tooth advance. Fixed timing, not a dynamics solver.
export function escapementOutline(){
  const pitch=TAU/15,mod=x=>((x%pitch)+pitch)%pitch,centers=[],count=256;
  for(let i=0;i<=1000;i++){
    const e=i*pitch/1000,f=i<=500?-.12+.24*i/500:.12-.24*(i-500)/500;
    for(const side of [-1,1]){const x=32.95-9*Math.cos(f)-side*12*Math.sin(f),y=-9*Math.sin(f)+side*12*Math.cos(f);centers.push([Math.hypot(x,y),mod(Math.atan2(y,x)-e)]);}
  }
  const radii=Array.from({length:count},(_,i)=>{const angle=i*pitch/count;let r=29;
    for(const [d,t] of centers){const delta=mod(angle-t+pitch/2)-pitch/2,cross=d*Math.sin(delta);if(Math.abs(cross)<1.6)r=Math.min(r,d*Math.cos(delta)-Math.sqrt(1.6**2-cross**2));}return r-.003;
  });
  return Array.from({length:15*count},(_,i)=>xy(radii[i%count],i*TAU/(15*count)).slice(0,2));
}
const escapeProfile=escapementOutline();
const clockGear=(...args)=>({...gear(...args),hole:3});
export const clockwork=define({id:'clock-escapement',number:58,title:'机械钟表传动与擒纵机构',description:'从发条追踪至轮系、擒纵轮和摆轮，慢放锁止与释放。',
  fields:[num('amplitude','摆轮摆幅','°',60,150,10,100),num('releaseFraction','半振周期释放占比','',.1,.35,.05,.2),num('inputRPM','摆轮周期参考速度','周期/min',0,120,5,60)],
  build(){const escapePoints=escapeProfile;
    return {parts:[part('clk-barrel','发条盒与大齿轮','发条为储能端，经轮系向擒纵机构供能。',[clockGear(60,.9,4,C.input),ring(25,23,10,C.input,[0,0,-8]),spiral(4,22,5,-8,C.input),cylinder(3,20) ],[-105,0,0]),
      part('clk-center','中心轮复合齿轴','60/12外啮合，复合轴上的48齿继续增速。',[clockGear(12,.9,4,C.steel),clockGear(48,.9,4,C.input,[0,0,10]),cylinder(3,20)],[-72.6,0,0]),
      part('clk-third','过轮复合齿轴','48/12外啮合，45齿轮驱动擒纵轮轴小齿轮。',[clockGear(12,.9,4,C.steel),clockGear(45,.9,4,C.input,[0,0,10]),cylinder(3,20)],[-45.6,0,10]),
      part('clk-escape','擒纵轮与小齿轮','每半振释放半齿距，其余时间保持锁止。',[clockGear(12,.9,4,C.steel),{kind:'polygon',points:escapePoints,holes:[circle(3)],depth:3,color:C.output,position:[0,0,15],rotation:[0,0,-12.25*(Math.PI-Math.PI/12)]},cylinder(3,25,C.output,[0,0,10])],[-19.95,0,20]),
      part('clk-fork','擒纵叉与双圆销叉瓦','圆销交替锁止；齿形按给定叉摆轨迹取避让包络，并留0.003 mm显示间隙。',[rod([0,0,-5],[-9,12,-5],1.2,C.mid),rod([0,0,-5],[-9,-12,-5],1.2,C.mid),cylinder(1.6,10,C.red,[-9,12,-3]),cylinder(1.6,10,C.red,[-9,-12,-3]),rod([0,0,0],[24,0,0],2,C.mid),rod([24,-4,0],[30,-4,0],1.5,C.mid),rod([24,4,0],[30,4,0],1.5,C.mid),cylinder(2,12)],[13,0,35]),
      part('clk-balance','摆轮与相位标记','摆轮与叉分层，红色标记显示摆轮相位；不表示已求解真实冲量销接触。',[ring(25,22,4,C.input),rod([-22,0,0],[22,0,0],2,C.input),rod([0,-22,0],[0,22,0],2,C.input),cylinder(1.5,2,C.red,[-12,0,-2])],[52,0,45]),
      part('clk-spring','游丝示意','固定几何仅表示弹性恢复力来源，未模拟螺旋变形。',[spiral(3,19,4,8,C.mid)],[52,0,45],[0,0,0],'housing'),
      part('clk-plate','机芯支承板','支承各轮轴，开放顶面便于查看。',[box([210,65,3],C.dark) ],[-25,0,-22],[0,0,0],'housing')]};},
  sample(p,a){const q=clockState(p,a),e=q.escape,b=-e/75,k=Math.PI-Math.PI/12,c=-5*b+k,t=-4*c+k,ep=-3.75*t+k;return {poses:{'clk-barrel':rz(b),'clk-center':rz(c),'clk-third':rz(t),'clk-escape':rz(ep),'clk-fork':rz(q.fork),'clk-balance':rz(q.balance)},metrics:[M('摆轮角',q.balance*180/Math.PI,'°'),M('擒纵轮累计角',e*180/Math.PI,'°'),M('当前释放',q.release?1:0),M('擒纵轮平均转速',p.inputRPM/15,'r/min'),M('发条盒平均转速幅值',p.inputRPM/1125,'r/min'),M('轮系增速倍数',75)],status:q.release?'释放/时序推进阶段：轮系推进半齿距。':'锁止阶段：轮系保持，摆轮继续自由摆动。'};},
  principle:[{title:'间歇控制连续储能',text:'发条驱动轮系，擒纵轮由两块叉瓦交替保持；摆轮每整振允许前进一个齿距。',formula:'n擒纵平均 = 摆轮完整周期数/15'},{title:'轮系增速',text:'三次外啮合放大转速，且轮系在锁止期间一起停止。',formula:'i增速 = (60/12)(48/12)(45/12) = 75'}],
  sources:[{title:'Patek Philippe：摆轮、游丝与擒纵术语',url:'https://www.patek.com/en/glossary'},{title:'Breguet：发条向摆轮擒纵供能',url:'https://www.breguet.cn/en/magazine-quai-de-l-horloge/272465/principles-tourbillon'}],
  limits:'圆销式双叉瓦的自定义教学结构：按给定叉摆和半齿步进轨迹反求轮廓，检查二维避让及两端锁止；不是Swiss-lever制造齿形。摆轮仅按时序关联，红点为相位标记，未建立冲量销/叉口接触。摆轮周期和摆幅给定，未由惯量、游丝刚度和冲量能量求解，也未预测走时误差或储能续航。'});

export const helicopter=define({id:'dual-rotor-gearbox',number:59,title:'双转子直升机主减速器',description:'追踪两条动力路径，观察两套旋翼如何反向旋转。',
  cameraUp:[0,0,1],cameraDirection:[1,-1,.8],
  fields:[num('rotorTeeth','旋翼从动齿数','齿',60,100,10,80),num('bladeRadius','旋翼示意半径','mm',70,130,10,100),num('inputRPM','发动机参考转速','r/min',0,240,10,120)],validate(p){integer(p.rotorTeeth);},
  build(p){const r=p.rotorTeeth/2,c=(p.rotorTeeth+20)/2,parts=[
    part('heli-input','发动机输入与双支路小齿轮','同一轴的两只20齿轮驱动上下两条支路。',[cylinder(5,135,C.input,[0,0,-32.5]),gear(20,1,8,C.input,[0,0,-22]),gear(20,1,8,C.input,[0,0,22]),cylinder(18,20,C.dark,[0,0,-80])],[-c,0,0]),
    part('heli-lower','下旋翼空心轴与从动轮','一次外啮合，输出与输入反向。',[{...gear(p.rotorTeeth,1,8,C.output,[0,0,-22]),hole:11},ring(11,7,90,C.output,[0,0,20])]),
    part('heli-upper','上旋翼内轴与从动轮','经过复合惰轮两次外啮合，输出与输入同向；从动轮与发动机小轮分开轴向平面。',[gear(p.rotorTeeth,1,8,C.mid,[0,0,-50]),cylinder(5,180,C.mid,[0,0,32])]),
    part('heli-rotor-low','下层旋翼','与外套轴固定连接；两层旋翼在不同高度。',[ring(13,7,10,C.output),...rotorBlades(p.bladeRadius,C.output)],[0,0,70]),
    part('heli-rotor-high','上层旋翼','与内轴固定连接；理想速度与下旋翼等幅反向。',[cylinder(13,10,C.mid),...rotorBlades(p.bladeRadius,C.mid)],[0,0,120]),
    part('heli-bearing','同轴支承','轴承与开口外壳示意，不参与驱动。',[ring(16,12,8,C.dark,[0,0,53]),box([2*c+25,18,8],C.dark,[-c/2,0,-100])],[0,0,0],[0,0,0],'housing')];
    const x=-(c*c+20*20-(r+10)**2)/(2*c),y=Math.sqrt(20*20-x*x);parts.push(part('heli-idler','上支路复合惰轮','两只同为20齿的齿片刚性连接，在不同轴向平面先后啮合，避免额外的三齿轮闭环。',[gear(20,1,8,C.steel),gear(20,1,8,C.steel,[0,0,-72]),cylinder(4,84,C.steel,[0,0,-36])],[-c-x,y,22]));return {parts};},
  sample(p,a){const r=p.rotorTeeth/2,c=(p.rotorTeeth+20)/2,x=-(c*c+400-(r+10)**2)/(2*c),y=Math.sqrt(400-x*x),ix=-c-x,iy=y,alpha=Math.atan2(iy,ix+c),beta=Math.atan2(-iy,-ix),idler=-a+2*alpha+Math.PI-Math.PI/20,low=-a*20/p.rotorTeeth+Math.PI-Math.PI/p.rotorTeeth,high=-idler*20/p.rotorTeeth+(1+20/p.rotorTeeth)*beta+Math.PI-Math.PI/p.rotorTeeth;
    return {poses:{'heli-input':rz(a),'heli-idler':rz(idler),'heli-lower':rz(low),'heli-upper':rz(high),'heli-rotor-low':rz(low),'heli-rotor-high':rz(high)},metrics:[M('主减速比',p.rotorTeeth/20),M('下旋翼转速',-p.inputRPM*20/p.rotorTeeth,'r/min'),M('上旋翼转速',p.inputRPM*20/p.rotorTeeth,'r/min'),M('双旋翼速度和',0,'r/min')],status:'下支路外啮合一次，上支路经惰轮外啮合两次；同轴内外轴分别输出，反向不依赖动画手动倒放。'};},
  principle:[{title:'反向双输出',text:'两条支路总速比相同，外啮合次数奇偶不同，所以同轴旋翼等幅反向。',formula:'n下 = −20n入/Z；n上 = +20n入/Z'}],
  sources:[{title:'NASA：同轴反向旋翼的结构与研究',url:'https://ntrs.nasa.gov/api/citations/20240008307/downloads/hosseini-et-al-2025-higher-order-system.pdf'}],
  limits:'同轴双旋翼的自定义双支路主减速教学拓扑，不是具体直升机维修图。简化了前级高速减速、轴承与桨距操纵；不计算气动、振动、强度，也不由等速反转推断实际反扭矩严格抵消。'});
function rotorBlades(R,color){return Array.from({length:3},(_,i)=>({kind:'polygon',points:[[12,-5],[R,-3],[R,7],[25,12]],depth:2,color,rotation:[0,0,i*TAU/3]}));}

export function windState(p){const ns=p.sunTeeth,nr=ns+72,k=(ns+nr)/ns,gain=k*p.stage2*p.stage3,eff=p.efficiency**3,pin=p.inputTorque*p.inputRPM*TAU/60;return {ns,nr,k,gain,eff,pin,pout:pin*eff,torque:p.inputRPM>0?p.inputTorque*eff/gain:0};}
export const wind=define({id:'wind-turbine-gearbox',number:60,title:'风电行星—平行轴增速箱',description:'从低速叶轮轴追踪至发电机轴，逐级显示转速和转向。',
  fields:[num('sunTeeth','行星级太阳轮齿数','齿',18,36,6,24),num('stage2','第2级增速比','',2,4,1,4),num('stage3','第3级增速比','',2,4,1,4),num('efficiency','每级效率','',.9,1,.01,.97),num('inputTorque','叶轮输入转矩','N·m',0,5000,100,1000),num('inputRPM','叶轮转速','r/min',0,30,1,12)],validate(p){integer(p.sunTeeth,p.stage2,p.stage3);if(p.sunTeeth%6)throw Error('太阳轮齿数须为6的倍数');},
  build(p){const g=planetary(p.sunTeeth,36,1,'wind'),c2=10*(p.stage2+1),c3=10*(p.stage3+1);return {parts:[...g.parts,
    part('wind-rotor','叶轮与低速输入轴','低速空心轴与行星架连接，太阳轮轴从内部通过。',[ring(11,6,65,C.input),...rotorBlades(90,C.input).map(s=>({...s,position:[0,0,-30]})),...Array.from({length:3},(_,i)=>rod(xy(10,TAU*i/3,32),xy(g.c,TAU*i/3,32),3,C.input)),...Array.from({length:3},(_,i)=>cylinder(3,32,C.input,xy(g.c,TAU*i/3,48)))],[0,0,-50]),
    part('wind-stage2','太阳轮轴与第2级大齿轮','行星级太阳轮输出驱动大齿轮。',[cylinder(5,55,C.input),gear(20*p.stage2,1,8,C.input,[0,0,12])],[0,0,33]),
    part('wind-stage3','中间轴小轮与第3级大轮','两个齿轮固定在同一轴上，第一次外啮合反向。',[gear(20,1,8,C.mid,[0,0,-15]),cylinder(5,50,C.mid),gear(20*p.stage3,1,8,C.mid,[0,0,15])],[c2,0,60]),
    part('wind-generator','高速小齿轮与发电机转子','第二次外啮合再次反向，总输出与叶轮同向。',[{...gear(20,1,8,C.output,[0,0,-30]),hole:4},cylinder(4,65,C.output),cylinder(19,24,C.output,[0,0,25]),rod([-19,0,25],[19,0,25],2,C.dark)],[c2+c3,0,105]),
    part('wind-stator','发电机定子','半透明定子展示高速转子。',[{...ring(28,23,40,C.dark),opacity:.3}],[c2+c3,0,130],[0,0,0],'housing')]};},
  sample(p,a){const q=windState(p),g=planetary(p.sunTeeth,36,1,'wind'),s=a*q.k,c2=10*(p.stage2+1),c3=10*(p.stage3+1),mid=-s*p.stage2+Math.PI-Math.PI/20,out=s*p.stage2*p.stage3-p.stage3*(Math.PI-Math.PI/20)+Math.PI-Math.PI/20;return {poses:{...planetaryPoses(g,s,0,a),'wind-rotor':rz(a),'wind-stage2':rz(s),'wind-stage3':rz(mid),'wind-generator':rz(out)},metrics:[M('行星级增速比',q.k),M('总增速比',q.gain),M('太阳轮轴转速',p.inputRPM*q.k,'r/min'),M('中间轴转速',-p.inputRPM*q.k*p.stage2,'r/min'),M('发电机轴转速',p.inputRPM*q.gain,'r/min'),M('输出转矩',q.torque,'N·m'),M('输入功率',q.pin,'W'),M('输出功率',q.pout,'W'),M('总效率',q.eff*100,'%')],status:'行星架输入、内齿圈固定、太阳轮输出；再经过两级外啮合增速。转矩按给定三级效率计算。'};},
  principle:[{title:'行星级增速',text:'把行星架作为低速输入，太阳轮成为较快输出。',formula:'n太阳/n叶轮 = (Z太阳+Z齿圈)/Z太阳'},{title:'多级功率',text:'两级平行轴外啮合各反向一次；速度增加，输出转矩降低。',formula:'n出=G n入；T出=η³ T入/G'}],
  sources:[{title:'NREL：低速行星加两级平行轴风电齿轮箱',url:'https://www.nrel.gov/docs/fy12osti/53584.pdf'}],
  limits:'采用NREL所述级数拓扑的自定义齿数组合，非指定风机产品；叶片为辨认输入端的示意。各级效率给定，未计算风能捕获、变桨、发电机控制、疲劳或轴承载荷。停转输出转矩显示0仅表示本页没有稳态运行，不用于静载判断。'});

export const machineModels=[cnc,wrist,clockwork,helicopter,wind];
