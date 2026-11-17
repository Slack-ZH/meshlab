import {TAU,rad,mod,colors as C,field as f,choice,metric as M,part,pose,box,cylinder,ring,rod,shaft,gear,circle,rot,rpm,validateFields,flatCam,valveLift,conjugateLift,planetaryBuild,planetaryPoses,cvtGeometry,beltPath,coneSheave,synchronizerState,cvBall,indexState,indexProfile,cycloidGeometry,ellipseRadius,wormTooth,pushbeltElement,harmonicTooth,harmonicToothPose,hollowFrustum,smooth5} from './models-machines-geometry.mjs';

const sources={
 valve:{title:'美国能源部 DOE：四冲程发动机与配气机构',url:'https://www.energy.gov/sites/default/files/2026-04/DOE-HDBK-1018-93_VOL1.pdf'},
 planetary:{title:'SDP/SI：行星齿轮设计与齿数关系',url:'https://www.sdp-si.com/planetary-gear-design/index.php'},
 hub:{title:'Sturmey-Archer：三速内变速花鼓说明书',url:'https://www.sturmey-archer.com/files/catalog/files/309/MANUAL%20-%203%20SPEED%20HUBS.pdf'},
 synchro:{title:'Schaeffler：单锥同步器的同步与锁止过程',url:'https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/api/downloads_13/api06_de_en.pdf'},
 cvt:{title:'Bosch Mobility：Pushbelt 钢带式 CVT',url:'https://www.bosch-mobility.com/en/solutions/transmission-technology/pushbelt/'},
 cv:{title:'GKN Automotive：固定球笼式等速万向节',url:'https://editor.gknautomotive.com/en/aftermarket/portfolio/constant-velocity-joints'},
 cam:{title:'DESTACO CAMCO：共轭凸轮与分度凸轮',url:'https://destacosalesaustralia.com.au/product-category/camco-indexing-solutions/custom-cams/'},
 cycloid:{title:'Sumitomo：CYCLO 减速器工作原理',url:'https://assets.sumitomodrive.com/sites/default/files/nqikej116/files/2022-08/D6000_CAT_DE_991470_07_2022_web.pdf'},
 harmonic:{title:'Harmonic Drive：应变波传动原理',url:'https://www.harmonicdrive.net/technology'},
 worm:{title:'KHK：蜗杆头数、蜗轮齿数与速比',url:'https://khkgears.net/product-category/worm-gear-pair/'}
};
const finish=model=>({...model,validate(p){validateFields(model.fields,p);model.validate?.(p);}});
const meshNote='齿面采用教学显示网格；未包含制造侧隙、修形、公差、承载和润滑校核。';

const valvetrain=finish({
 id:'valvetrain',number:36,title:'发动机气门配气机构',description:'联动曲轴、凸轮轴与气门，观察四冲程中的开闭时序。',cameraDirection:[1,-.25,.45],
 fields:[f('lift','最大气门升程','mm',4,8,.5,6)],
 build(p){
  const parts=[part('crank','曲轴与正时主动轮',[gear(20,4,10,C.input,{hole:8}),rod([0,0,14],[23,0,14],5,C.input),cylinder(5,16,C.steel,[23,0,14]),cylinder(8,40,C.steel)],[-120,0,-55]),part('cam-drive','凸轮轴正时齿轮',[gear(40,4,10,C.output,{hole:7,rotation:[0,0,Math.PI-Math.PI/40]}),cylinder(7,140,C.steel,[0,0,40])],[0,0,-55]),part('head','气门导向座',[box([12,12,92],C.case,[-22,-108,0]),...[-24,24].flatMap(z=>[ring(10,3.15,12,C.case,[0,-108,z],{rotation:[Math.PI/2,0,0]}),rod([-22,-108,z],[-9,-108,z],3,C.case)])],[0,0,0],'两组实际导向孔对准气门杆，留0.15 mm径向显示间隙',{category:'housing'})];
  for(const [id,name,z,exhaust] of [['intake','进气',-24,false],['exhaust','排气',24,true]]){
   parts.push(part(id+'-cam',name+'凸轮',[{kind:'polygon',points:flatCam(a=>valveLift(a,p.lift,exhaust),70,-1),holes:[circle(7.15)],depth:14,color:exhaust?C.brass:C.output}],[0,0,z],'由升程支持函数生成平底从动件相切轮廓'));
   parts.push(part(id+'-valve',name+'气门与平底挺柱',[box([38,3,18],C.steel,[0,-71.5,0]),cylinder(3,50,C.steel,[0,-98,0],{rotation:[Math.PI/2,0,0]}),cylinder(12,4,C.steel,[0,-125,0],{rotation:[Math.PI/2,0,0]})],[0,0,z]));
   parts.push(part(id+'-spring',name+'回位弹簧',[{kind:'tube',points:Array.from({length:121},(_,k)=>[7*Math.cos(TAU*k/20),-30*k/120,7*Math.sin(TAU*k/20)]),radius:1,color:C.brass}],[0,-75,z],'弹簧只表现回位方向，未计算刚度与阀跳'));
  }
  return {parts};
 },
 sample(p,phase){const theta=-phase/2,crank=mod(phase,TAU*2),a=valveLift(theta,p.lift),e=valveLift(theta,p.lift,true),poses={crank:pose([0,0,phase]),'cam-drive':pose([0,0,theta])};
  for(const [id,z,l] of [['intake',-24,a.s],['exhaust',24,e.s]]){poses[id+'-cam']=pose([0,0,theta]);poses[id+'-valve']=pose([0,0,0],[0,-l,z]);poses[id+'-spring']={position:[0,-75-l,z],scale:[1,(30-l)/30,1]};}
  const stroke=['进气','压缩','做功','排气'][Math.floor(crank/Math.PI)%4];return {poses,metrics:[M('当前冲程',stroke),M('曲轴相位',crank*180/Math.PI,'° / 720°'),M('凸轮轴转速',-rpm(p)/2,'r/min'),M('进气门升程',a.s,'mm'),M('排气门升程',e.s,'mm')],status:`${stroke}冲程；曲轴转两圈，凸轮轴转一圈。正时齿轮外啮合，凸轮轴反向。`};},
 principle:[{title:'四冲程配气',text:'理想进气冲程打开进气门，排气冲程打开排气门；压缩和做功冲程均关闭。',formula:'θcam = −θcrank / 2；每个气门每 720° 曲轴相位开启一次。'},{title:'凸轮与挺柱接触',text:'轮廓由支持函数 h=R+s 及导数构造，平底挺柱保持相切。升程改变会真正改变凸轮轮廓。'}],
 sources:[sources.valve],limits:'采用无提前/迟闭、无重叠角的理想四冲程。两组平底挺柱代替实际摇臂机构；未模拟燃烧、气体流量、热间隙、弹簧动力学。气门座及燃烧室省略，导向孔保留可观察的装配间隙。',questions:['为什么凸轮轴只转曲轴的一半？','实际发动机为何有气门重叠？','增大升程会怎样改变凸轮轮廓？']
});

const planetary=finish({
 id:'planetary',number:37,title:'简单行星齿轮传动',description:'轮流固定太阳轮、齿圈和行星架，对比输出转向与速比。',
 fields:[choice('fixed','固定构件','ring',[['ring','齿圈固定：太阳轮输入'],['sun','太阳轮固定：齿圈输入'],['carrier','行星架固定：太阳轮输入']]),f('sunTeeth','太阳轮齿数','',18,36,6,24),f('planetTeeth','行星轮齿数','',18,30,6,18)],
 validate(p){if(p.sunTeeth%6||p.planetTeeth%6)throw Error('三等分装配要求本实验齿数为 6 的倍数');},
 build:p=>planetaryBuild(p.sunTeeth,p.planetTeeth,1.6,p.fixed==='carrier'?'ring':'carrier'),
 sample(p,phase){const zs=p.sunTeeth,zp=p.planetTeeth,zr=zs+2*zp;let s,r,c,ratio,label;
  if(p.fixed==='ring'){s=phase;r=0;c=phase*zs/(zs+zr);ratio=zs/(zs+zr);label='行星架';}else if(p.fixed==='sun'){s=0;r=phase;c=phase*zr/(zs+zr);ratio=zr/(zs+zr);label='行星架';}else{s=phase;r=-phase*zs/zr;c=0;ratio=-zs/zr;label='齿圈';}
  return {poses:planetaryPoses(zs,zp,1.6,{s,r,c}),metrics:[M('内齿圈齿数',zr),M('输出构件',label),M('输出 / 输入转速',ratio),M('输出转速',rpm(p)*ratio,'r/min'),M('Willis 约束残差',zs*s+zr*r-(zs+zr)*c,'齿·rad')],status:`${p.fixed==='ring'?'齿圈':p.fixed==='sun'?'太阳轮':'行星架'}固定；${label}${ratio<0?'反向':'同向'}输出。`};},
 principle:[{title:'行星传动约束',text:'行星轮同时自转和随架公转；固定哪个构件决定输入、输出关系。',formula:'zs(ωs−ωc) + zr(ωr−ωc) = 0；zr = zs + 2zp。'}],sources:[sources.planetary],limits:'三颗等分行星轮；限定齿数组合满足等距装配。固定构件为理想约束；未模拟制动器和负载分配。'+meshNote,questions:['固定行星架时为什么反向？','太阳轮固定后谁是输入？','为什么内齿圈齿数不能独立设置？']
});

const hub=finish({
 id:'three-speed-hub',number:39,title:'自行车三速内变速花鼓',description:'切换三档，观察花鼓内部哪些零件参与传力。',
 fields:[choice('selectedGear','档位','1',[['1','一档：减速'],['2','二档：直接传动'],['3','三档：增速']]),f('sunTeeth','太阳轮齿数','',18,30,6,24)],
 validate(p){if(p.sunTeeth%6)throw Error('太阳轮齿数取 6 的倍数');},
 build(p){const z=p.sunTeeth,m=1.4,R=3*z*m/2,b=planetaryBuild(z,z,m,p.selectedGear==='1'?'carrier':'ring');b.parts.push(part('hub-shell','花鼓壳与输出法兰',[ring(R+9,R+5,48,C.output,[0,0,0],{opacity:.25}),ring(R+15,R+7,4,C.output,[0,0,28]),...Array.from({length:8},(_,k)=>rod([8*Math.cos(k*TAU/8),8*Math.sin(k*TAU/8),28],[(R+8)*Math.cos(k*TAU/8),(R+8)*Math.sin(k*TAU/8),28],2,C.output))]));b.parts.push(part('selector','轴向换档接合件',[ring(19,8,8,C.active),box([5,8,14],C.active,[19,0,0])],[0,0,p.selectedGear==='1'?-32:p.selectedGear==='2'?-23:-14],'用轴向位置标识选择的动力路径，棘爪与单向离合器省略'));b.parts.push(part('driver','链轮输入套',[ring(7,5.3,22,C.input)],[0,0,-48]));return b;},
 sample(p,phase){const z=p.sunTeeth,high=p.selectedGear==='3',c=phase*(high?1:.75),r=phase*(high?4/3:1),out=phase*(p.selectedGear==='1'?.75:p.selectedGear==='2'?1:4/3),ratio=p.selectedGear==='1'?.75:p.selectedGear==='2'?1:4/3,poses=planetaryPoses(z,z,1.4,{s:0,r,c});poses['hub-shell']=pose([0,0,out]);poses.driver=pose([0,0,phase]);poses.selector=pose([0,0,p.selectedGear==='1'?c:r]);
  return {poses,metrics:[M('输出 / 输入转速',ratio),M('花鼓输出转速',rpm(p)*ratio,'r/min'),M('太阳轮齿数',z),M('齿圈齿数',3*z),M('动力路径',p.selectedGear==='1'?'输入 → 齿圈 → 行星架 → 花鼓':p.selectedGear==='2'?'输入 → 直接离合 → 花鼓':'输入 → 行星架 → 齿圈 → 花鼓')],status:'太阳轮固定。二档通过直接离合器传力，内部行星轮仍可空载转动。'};},
 principle:[{title:'三种动力路径',text:'采用齿圈齿数为太阳轮三倍的一组行星轮系；一档环输入、架输出，三档架输入、环输出。二档直接联接输入与花鼓。',formula:'n一/n入=3/4；n二/n入=1；n三/n入=4/3。'}],sources:[sources.hub,sources.planetary],limits:'表现经典 0.75/1/1.333 三速运动关系，不复刻某款花鼓。棘爪、单向离合器、制动与换档负载瞬态省略，接合件仅标示动力路径。'+meshNote,questions:['二档为何仍能看到行星轮转动？','高档由哪个构件输入？','齿数整体放大，三档速比会改变吗？']
});

const manual=finish({
 id:'manual-gearbox',number:40,title:'汽车手动变速箱',description:'选择档位，高亮从输入轴到输出轴的动力路径。',cameraDirection:[1,.65,.25],
 fields:[choice('selectedGear','档位','1',[['N','空档'],['1','一档 2:1'],['2','二档 1.4:1'],['3','三档 1:1'],['4','四档 0.667:1']]),f('module','齿轮模数','mm',1.5,3,.5,2),f('faceWidth','齿宽','mm',8,16,1,12)],
 build(p){const a=30*p.module/2,b=-a,parts=[shaft('input','输入轴',6,170,C.input,[b,0,0]),shaft('output','输出轴',6,170,C.output,[a,0,0])];const teeth=[20,25,30,36];for(let k=0;k<4;k++){const active=p.selectedGear===String(k+1),z=-57+k*38;parts.push(part('input-'+k,`${k+1} 档主动齿轮`,[gear(teeth[k],p.module,p.faceWidth,active?C.active:C.steel,{hole:6.15})],[b,0,z]));parts.push(part('loose-'+k,`${k+1} 档常啮合空套齿轮`,[gear(60-teeth[k],p.module,p.faceWidth,active?C.active:C.output,{hole:7})],[a,0,z]));}
  const selected=p.selectedGear==='N'?0:Number(p.selectedGear)-1;parts.push(part('dog','选档齿套',[ring(14,7,10,C.active),box([5,7,12],C.active,[14,0,0])],[a,0,p.selectedGear==='N'?76:-57+selected*38+p.faceWidth/2+5],'齿套将选中的空套齿轮与输出轴刚性连接'));parts.push(part('fork','拨叉',[rod([-18,0,0],[-18,26,0],3,C.case),rod([-18,26,0],[18,26,0],3,C.case),rod([18,26,0],[18,0,0],3,C.case)],[a,0,p.selectedGear==='N'?76:-57+selected*38+p.faceWidth/2+5]));return {parts};},
 sample(p,phase){const teeth=[20,25,30,36],index=p.selectedGear==='N'?-1:Number(p.selectedGear)-1,ratio=index<0?0:-teeth[index]/(60-teeth[index]),poses={input:pose([0,0,phase]),output:pose([0,0,phase*ratio]),dog:pose([0,0,phase*ratio])};for(let k=0;k<4;k++){poses['input-'+k]=pose([0,0,phase]);poses['loose-'+k]=pose([0,0,-phase*teeth[k]/(60-teeth[k])+Math.PI-Math.PI/(60-teeth[k])]);}
  return {poses,metrics:[M('选中档位',p.selectedGear==='N'?'空档':p.selectedGear+' 档'),M('输出 / 输入转速',ratio),M('输出轴转速',rpm(p)*ratio,'r/min'),M('固定中心距',30*p.module,'mm')],status:index<0?'空档：各空套齿轮转动，未与输出轴接合；本演示输出轴初始静止。':`${index+1} 档金色齿轮与齿套为当前动力路径。两平行轴齿轮外啮合，轴转向相反。`};},
 principle:[{title:'常啮合与选档',text:'所有齿轮副一直啮合；选档改变齿套锁定的空套齿轮。未选中的齿轮允许相对输出轴转动。',formula:'n出/n入 = −z主动/z从动；各齿轮副 z主动+z从动=60。'}],sources:[sources.synchro],limits:'采用两轴四前进档教学布置，省略主减速器、差速器、离合器和倒档。外部两轴转向符号不代表汽车前进/倒退。齿套按档位重定位；真实换档同步过程见单独同步器实验。'+meshNote,questions:['为什么空档时齿轮也在转？','选档为何不用把整只齿轮移开？','所有齿轮副中心距为什么相同？']
});

const synchronizer=finish({
 id:'synchronizer',number:41,title:'变速箱同步器',description:'慢放拨叉移动、锥面同步、锁止与齿套接合。',
 fields:[f('initialRatio','初始轴速 / 齿轮转速','',.2,.8,.1,.4),f('shiftTurns','完成换档的输入圈数','圈',1,4,.5,2)],
 build(p){const dogOffset=-p.shiftTurns*TAU*.4*(1-p.initialRatio);return {parts:[shaft('shaft','待同步输出轴',7,100,C.output,[0,0,0]),part('free-gear','常啮合空套齿轮与接合齿',[gear(32,2,10,C.input,{hole:8,position:[0,0,-38]}),gear(20,1.6,8,C.input,{hole:8,position:[0,0,-25],rotation:[0,0,dogOffset]}),hollowFrustum(-20,-12,8.2,8.2,12.4,10.4,C.brass)]),part('hub','花键毂',[gear(20,1.6,16,C.output,{hole:7,position:[0,0,6]})]),part('blocker','同步锁环',[gear(20,1.6,4,C.brass,{hole:11.5}),hollowFrustum(-2,2,11.45,10.45,11.6,11.6,C.brass)],[0,0,-8]),part('sleeve','滑动接合齿套',[gear(20,1.6,44,C.active,{internal:true,hole:0}),ring(25,20,4,C.active)]),part('fork','换档拨叉',[rod([-28,0,0],[-28,30,0],3,C.case),rod([-28,30,0],[28,30,0],3,C.case),rod([28,30,0],[28,0,0],3,C.case)],[0,0,0])]};},
 sample(p,phase){const s=synchronizerState(p,phase);return {poses:{'free-gear':pose([0,0,phase]),shaft:pose([0,0,s.outputAngle]),hub:pose([0,0,s.outputAngle]),blocker:pose([0,0,s.outputAngle+.07*(1-smooth5((s.t-.6)/.05))],[0,0,-8-Math.min(1,s.t/.2)*6]),sleeve:pose([0,0,s.outputAngle+Math.PI/20],[0,0,s.sleeve+15]),fork:{position:[0,0,s.sleeve+15]}},metrics:[M('换档阶段',s.stage),M('齿轮转速',rpm(p),'r/min'),M('输出轴转速',rpm(p)*s.ratio,'r/min'),M('转速差',rpm(p)*(1-s.ratio),'r/min'),M('齿套位移',s.sleeve,'mm')],status:`${s.stage}。恢复初始状态可重播；同步完成后保持接合，不循环重置。`};},
 principle:[{title:'先同步、后接合',text:'拨叉推动齿套，锥面摩擦减小转速差；锁环在同步前限制齿套继续推进。转速相同后接合齿传递转矩。',formula:'同步前 Δn≠0；接合条件 Δn=0；接合后 n轴=n齿轮。'}],sources:[sources.synchro],limits:'采用指定的平滑转速过渡展示阶段顺序，并非由转动惯量、锥角、摩擦系数和轴向力求出的实际同步时间。锁环倒角与花键齿形为示意；不用于换档冲击或磨损预测。',questions:['为什么不能直接把齿套推入？','锥面摩擦和接合齿分别做什么？','改变初始转速差会影响哪个阶段？']
});

const cvt=finish({
 id:'cvt',number:42,title:'钢带式无级变速器 CVT',description:'联动两组锥轮，观察钢带工作半径与速比连续变化。',
 fields:[f('driveRadius','主动工作半径','mm',25,55,1,40),f('centerDistance','轴间距','mm',160,220,5,180)],
 build(p){const g=cvtGeometry(p),path=beltPath(g.r1,g.r2,g.C),parts=[];for(const [id,name,r,x,col] of [['primary','主动锥轮',g.r1,-g.C/2,C.input],['secondary','从动锥轮',g.r2,g.C/2,C.output]])parts.push(part(id,name,[coneSheave(r,1,col),coneSheave(r,-1,col),ring(18,7,30,col),cylinder(7,76,C.steel),box([4,10,4],C.active,[0,55,18])],[x,0,0],'两锥盘的轴向位置由工作半径联动决定；锥面半角 11°'));
  const n=84;for(let k=0;k<n;k++){const t=path.at(path.length*k/n);parts.push(part('element-'+k,k?'钢带钢片':'钢带组件',[pushbeltElement(path.length/n*.9,k===0?C.active:C.steel)],[t.x,t.y,0],'钢片沿闭合工作路径运动',{rotation:[0,0,t.angle],assemblyGroup:'pushbelt',hiddenInList:k!==0}));}
  for(const z of [-7,7])parts.push(part('band-'+z,'钢带承载环带',[{kind:'tube',points:Array.from({length:241},(_,k)=>{const t=path.at(path.length*k/240);return [t.x,t.y,z];}),radius:.7,closed:true,color:C.dark}],[0,0,0],'环带连续闭合',{assemblyGroup:'pushbelt',hiddenInList:true}));return {parts};},
 sample(p,phase){const g=cvtGeometry(p),path=beltPath(g.r1,g.r2,g.C),poses={primary:pose([0,0,-phase]),secondary:pose([0,0,-phase*g.ratio])};for(let k=0;k<84;k++){const t=path.at(path.length*k/84+phase*g.r1);poses['element-'+k]=pose([0,0,t.angle],[t.x,t.y,0]);}return {poses,metrics:[M('主动工作半径',g.r1,'mm'),M('从动工作半径',g.r2,'mm'),M('输出 / 输入转速',g.ratio),M('输出转速',rpm(p)*g.ratio,'r/min'),M('钢带理论长度',g.L,'mm'),M('无滑动带速',rpm(p)*TAU*g.r1/60000,'m/s')],status:'同向无级变速；同一中心距下保持钢带长度不变，联动求解从动工作半径。'};},
 principle:[{title:'工作半径联动',text:'锥轮轴向距离改变钢带工作半径。调主动半径时，以恒定闭合带长反求从动半径，不能独立随意指定两个半径。',formula:'n出/n入 = R主动/R从动；L=2√(C²−ΔR²)+π(R1+R2)+2ΔR asin(ΔR/C)。'}],sources:[sources.cvt],limits:'用 84 块可辨识钢片及两条环带表现推力钢带；钢片数量为显示离散，不是采购规格。无滑动运动基准，不计算液压夹紧力、钢片接触应力、摩擦极限和效率。改变轴间距代表选择另一条基准长度的钢带。',questions:['为什么两组锥轮需要联动？','主动工作半径变大时输出转速如何变化？','真实 CVT 为何需要足够夹紧力？']
});

const rzeppa=finish({
 id:'rzeppa-joint',number:43,title:'球笼式等速万向节',description:'调整半轴夹角，观察钢球在球道中的运动。',
 fields:[f('angle','半轴夹角','°',0,40,1,25)],
 build(p){const a=rad(p.angle),parts=[];const outer=[ring(43,39,10,C.steel,[0,0,-27]),cylinder(8,35,C.input,[0,0,-50]),...Array.from({length:6},(_,k)=>{const a=k*TAU/6;return rod([0,0,-29],[41*Math.cos(a),41*Math.sin(a),-29],2.6,C.steel);})],inner=[cylinder(8,60,C.output,[0,0,45]),cylinder(10,12,C.output,[0,0,11]),{kind:'polygon',points:Array.from({length:72},(_,k)=>{const t=k*TAU/72,r=25+3*(1-Math.cos(6*t))/2;return [r*Math.cos(t),r*Math.sin(t)];}),depth:22,color:C.output}];
  for(let k=0;k<6;k++){const t=TAU*k/6;outer.push({kind:'tube',points:Array.from({length:49},(_,j)=>{const z=-22+44*j/48,r=Math.sqrt(38.7*38.7-z*z);return [r*Math.cos(t),r*Math.sin(t),z];}),radius:2.6,color:C.steel},rod([Math.sqrt(38.7**2-22**2)*Math.cos(t),Math.sqrt(38.7**2-22**2)*Math.sin(t),-22],[41*Math.cos(t),41*Math.sin(t),-27],2.6,C.steel));inner.push({kind:'tube',points:Array.from({length:41},(_,j)=>{const z=-18+36*j/40,r=Math.sqrt(26.5*26.5-z*z);return [r*Math.cos(t),r*Math.sin(t),z];}),radius:1.4,color:C.brass});}
  parts.push(part('outer-race','外球笼与六条球道',outer),part('inner-race','星形套与输出半轴',inner,[0,0,0],'六条内球道与外球道相对',{rotation:[0,a,0]}),part('cage','保持架（角平分面）',[{kind:'torus',radius:32,tube:1.4,position:[0,0,6],color:C.brass},{kind:'torus',radius:32,tube:1.4,position:[0,0,-6],color:C.brass}],[0,0,0],'保持架以两条观察环表示；球窗留空便于观察',{rotation:[0,a/2,0]}));
  for(let k=0;k<6;k++)parts.push(part('ball-'+k,k?'传力钢球':'六颗传力钢球',[{kind:'sphere',radius:4,color:k?C.steel:C.active}],cvBall(a,0,k),'球心保持在轴线角平分面上',{assemblyGroup:'balls',hiddenInList:k!==0}));return {parts};},
 sample(p,phase){const a=rad(p.angle),poses={'outer-race':pose([0,0,phase]),'inner-race':pose([0,a,phase]),cage:pose([0,a/2,phase])};let error=0;for(let k=0;k<6;k++){const b=cvBall(a,phase,k);poses['ball-'+k]={position:b};error=Math.max(error,Math.abs(Math.sin(a/2)*b[0]+Math.cos(a/2)*b[2]));}return {poses,metrics:[M('轴线夹角',p.angle,'°'),M('输出 / 输入转速',1),M('输出转速',rpm(p),'r/min'),M('球心角平分面误差',error,'mm'),M('钢球数',6)],status:'输入与输出绕各自轴线等速转动；球心沿球道移动并保持在角平分面。'};},
 principle:[{title:'等速条件',text:'六颗钢球在内外球道之间传力；球心位于两轴夹角的平分面。该模型同时满足内外球道方位和球心平面约束。',formula:'θ出=θ入；n出=n入；sin(β/2)x + cos(β/2)z = 0。'}],sources:[sources.cv],limits:'采用固定式 Rzeppa 几何原理。球道显示为圆弧导向轨，省略实际槽截面、接触变形、偏置曲率、防尘套及球窗制造形状。保持架观察环不用于推算真实 cage 动力学。',questions:['为什么钢球需要保持在角平分面？','与单十字轴万向节的速度有什么区别？','半轴夹角改变后钢球如何移动？']
});

const conjugate=finish({
 id:'conjugate-cam',number:44,title:'双凸轮共轭机构',description:'观察两只凸轮如何共同约束从动件往返。',cameraDirection:[1,.15,.3],fields:[f('amplitude','位移幅度参数','mm',6,16,1,12)],
 build(p){const law=a=>conjugateLift(a,p.amplitude),parts=[shaft('shaft','共用凸轮轴',7,86,C.input)];parts.push(part('upper-cam','上侧共轭凸轮',[{kind:'polygon',points:flatCam(law,42,1),holes:[circle(7.15)],depth:12,color:C.input}],[0,0,-15]));parts.push(part('lower-cam','下侧共轭凸轮',[{kind:'polygon',points:flatCam(a=>{const l=law(a);return {s:-l.s,ds:-l.ds};},42,-1),holes:[circle(7.15)],depth:12,color:C.output}],[0,0,15]));parts.push(part('follower','双面刚性从动框',[box([56,3,16],C.steel,[0,43.5,-15]),box([56,3,16],C.steel,[0,-43.5,15]),rod([-68,48,-15],[-68,-48,15],4,C.steel),rod([68,48,-15],[68,-48,15],4,C.steel),rod([-68,48,-15],[28,48,-15],3,C.steel),rod([68,-48,15],[-28,-48,15],3,C.steel)]));return {parts};},
 sample(p,phase){const l=conjugateLift(phase,p.amplitude);return {poses:{shaft:pose([0,0,phase]),'upper-cam':pose([0,0,phase]),'lower-cam':pose([0,0,phase]),follower:{position:[0,l.s,0]}},metrics:[M('从动件位移',l.s,'mm'),M('理论瞬时速度',l.ds*rpm(p)*TAU/60,'mm/s'),M('上接触支持高度',42+l.s,'mm'),M('下接触支持高度',42-l.s,'mm'),M('两支持高度之和',84,'mm')],status:'两只不同轮廓的凸轮同步旋转，上下平底面始终分别相切，构成双向几何约束。'};},
 principle:[{title:'共轭几何闭合',text:'上凸轮规定 h1=R+s，下凸轮规定 h2=R−s；二者始终互补，刚性框无需依靠弹簧维持双向接触。',formula:'s=A(0.65 sinθ+0.175 sin2θ)；h1+h2=2R。'}],sources:[sources.cam],limits:'采用平底从动框展示共轭闭合，并非特定厂家的双滚子设计。轮廓由支持函数精确构造后离散；未模拟预紧、弹性变形、摩擦和高速失联。',questions:['为什么需要两条不同凸轮轮廓？','两个支持高度之和为何恒定？','普通弹簧回位凸轮和共轭凸轮有何不同？']
});

const indexing=finish({
 id:'indexing-cam',number:45,title:'分度凸轮机构',description:'用包装机转盘演示转位和停歇。',cameraDirection:[.35,.45,1],fields:[f('stops','每周分度数','',4,8,1,6),f('moveDegrees','输入分度运动角','°',210,250,5,230)],
 build(p){const g=indexProfile(p.stops,p.moveDegrees),parts=[part('lock-pin','停歇定位销',[cylinder(3,6,C.active)],[g.C-26,0,24],'辅助定位销在停歇时进入定位孔，运动前平滑退出'),part('cam','盘形分度凸轮',[{kind:'polygon',points:g.points,depth:14,color:C.input},cylinder(7,48,C.steel)]),part('turret','滚子分度转台',[{kind:'polygon',points:circle(34),holes:[circle(12),...Array.from({length:p.stops},(_,k)=>circle(3.3,48,[26*Math.cos(Math.PI-Math.PI/p.stops+TAU*k/p.stops),26*Math.sin(Math.PI-Math.PI/p.stops+TAU*k/p.stops)]))],depth:4,color:C.output,position:[0,0,22]},ring(34,12,6,C.output,[0,0,16]),cylinder(10,12,C.output,[0,0,16]),...Array.from({length:p.stops},(_,k)=>{const a=Math.PI+TAU*k/p.stops;return cylinder(5,18,0x87bca9,[29*Math.cos(a),29*Math.sin(a),29]);}),...Array.from({length:p.stops},(_,k)=>rod([0,0,16],[g.R*Math.cos(Math.PI+TAU*k/p.stops),g.R*Math.sin(Math.PI+TAU*k/p.stops),16],3,C.output))],[g.C,0,0])];for(let k=0;k<p.stops;k++)parts.push(part('roller-'+k,k?'转台滚子':'分度滚子组件',[cylinder(g.roller,18,C.brass),cylinder(2,28,C.dark)],[g.C+g.R*Math.cos(Math.PI+TAU*k/p.stops),g.R*Math.sin(Math.PI+TAU*k/p.stops),0],'滚子中心轨迹的法向偏置生成凸轮廓线',{assemblyGroup:'index-rollers',hiddenInList:k!==0}));return {parts};},
 sample(p,phase){const s=indexState(p.stops,p.moveDegrees,phase),poses={cam:pose([0,0,phase]),turret:pose([0,0,s.angle]),'lock-pin':{position:[66,0,24+9*(s.moving?Math.min(smooth5(mod(phase)/rad(10)),smooth5((rad(p.moveDegrees)-mod(phase))/rad(10))):0)]}};for(let k=0;k<p.stops;k++){const a=Math.PI+s.angle+TAU*k/p.stops;poses['roller-'+k]={position:[92+42*Math.cos(a),42*Math.sin(a),0]};}return {poses,metrics:[M('单次分度角',360/p.stops,'°'),M('停歇输入角',360-p.moveDegrees,'°'),M('转台累计角',s.angle*180/Math.PI,'°'),M('转台瞬时转速',rpm(p)*s.derivative,'r/min'),M('当前阶段',s.moving?'分度运动':'停歇锁位')],status:s.moving?'凸轮按五次多项式驱动滚子转台分度。':'圆弧停歇段与辅助定位销共同保持转台位置；输入轴继续转动。'};},
 principle:[{title:'分度与停歇',text:'每转输入轴，转台前进一个工位；运动段使用零端点速度和加速度的五次多项式。凸轮由滚子中心的反转轨迹求包络，而不是圆盘配独立转动。',formula:'Δψ=2π/N；f(u)=10u³−15u⁴+6u⁵；停歇时 dψ/dθ=0。'}],sources:[sources.cam],limits:'为盘形外缘滚子分度凸轮配辅助定位销的几何模型；不复刻 globoidal 商用凸轮。销在停歇时进入实际定位孔，在运动起止的小角度区平滑退出/进入；驱动销的辅助凸轮与弹簧、回转轴承和加工补偿省略；离散轮廓用于运动教学，不是凸轮加工数据。',questions:['停歇时输入轴是否仍转？','增加工位数怎样改变单次分度角？','运动角变小为何会提高峰值输出转速？']
});

const cycloidal=finish({
 id:'cycloidal',number:46,title:'摆线针轮减速器',description:'追踪偏心输入、摆线轮、针齿和输出销的运动。',fields:[f('pinCount','固定针齿数','',9,25,2,13),f('ringRadius','针齿分布半径','mm',45,70,5,55),f('pinRadius','针齿滚子半径','mm',2,3.5,.5,2.5)],
 build(p){const g=cycloidGeometry(p),holes=Array.from({length:6},(_,k)=>circle(g.outputPinRadius+g.e+.12,48,[g.outputCircle*Math.cos(TAU*k/6),g.outputCircle*Math.sin(TAU*k/6)]));holes.push(circle(8,64));const parts=[part('pins','固定针齿壳',[ring(g.R+6,g.R+1,5,C.case,[0,0,-12]),...Array.from({length:g.N},(_,k)=>cylinder(g.r,24,C.steel,[g.R*Math.cos(TAU*k/g.N),g.R*Math.sin(TAU*k/g.N),0]))]),part('eccentric','输入偏心轴',[cylinder(6,32,C.input,[0,0,-24]),cylinder(7.8,12,C.input,[g.e,0,0]),rod([0,0,-20],[g.e,0,-20],4,C.input)]),part('disc','摆线盘',[{kind:'polygon',points:g.points,holes,depth:10,color:C.output}],[g.e,0,0],'针齿中心的相对轨迹按滚子半径法向偏置形成摆线廓线'),part('output','销轴输出法兰',[ring(g.outputCircle+7,10,7,C.brass,[0,0,24]),cylinder(7,24,C.output,[0,0,36]),...Array.from({length:6},(_,k)=>cylinder(g.outputPinRadius,36,C.brass,[g.outputCircle*Math.cos(TAU*k/6),g.outputCircle*Math.sin(TAU*k/6),9]))])];return {parts};},
 sample(p,phase){const g=cycloidGeometry(p),out=-phase/g.reduction;return {poses:{eccentric:pose([0,0,phase]),disc:pose([0,0,out],[g.e*Math.cos(phase),g.e*Math.sin(phase),0]),output:pose([0,0,out])},metrics:[M('摆线盘齿数',g.N-1),M('减速比绝对值',g.reduction),M('输出转速',-rpm(p)/g.reduction,'r/min'),M('偏心距',g.e,'mm'),M('盘心偏移半径',g.e,'mm')],status:'输入每转一圈，摆线盘沿相反方向转过一个齿距；输出销提取自转并容纳偏心位移。'};},
 principle:[{title:'一齿差减速',text:'固定针齿数比摆线盘齿数多一；偏心公转产生低速反向自转，孔销输出保留自转并消除盘心公转。',formula:'n出/n入 = −1/(N针−1)；输出孔半径 ≈ 输出销半径 + 偏心距。'}],sources:[sources.cycloid],limits:'显示单摆线盘以观察轨迹，未建真实常用双盘平衡结构。孔销保留 0.12 mm 显示间隙；偏心距按几何范围选定，未作承载、轴承寿命或接触应力验算。',questions:['为什么输出转向与输入相反？','输出孔为何比销轴大？','双摆线盘的作用是什么？']
});

const harmonic=finish({
 id:'harmonic',number:47,title:'谐波减速器',description:'剖开观察柔轮变形，以及少量齿数差如何产生大速比。',fields:[f('flexTeeth','柔轮齿数','',40,80,10,60)],
 validate(p){if(p.flexTeeth%2)throw Error('双波发生器模型采用偶数柔轮齿数');},
 build(p){const z=p.flexTeeth,R=z/2,parts=[part('circular','固定刚轮',[gear(z+2,1,12,C.steel,{internal:true,hole:0,rotation:[0,0,Math.PI/(z+2)]})]),part('wave','椭圆波发生器',[ring(R-3,R-6,8,C.input),cylinder(5,42,C.input,[0,0,-16])],[0,0,0],'波发生器长轴方向控制两处啮合区域'),part('flex-body','柔轮薄壁环',[ring(R-2,R-3.2,10,C.output)],[0,0,0],'柔轮材料齿位与椭圆变形方向分别计算',{assemblyGroup:'flexspline'}),part('output','柔轮输出端',[ring(R-3,7,4,C.output,[0,0,18]),cylinder(6,18,C.output,[0,0,29]),box([3,6,4],C.active,[0,R-7,18])])];
  for(let k=0;k<z;k++){const t=harmonicToothPose(z,0,k);parts.push(part('flex-tooth-'+k,'柔轮教学啮合齿',[{kind:'polygon',points:harmonicTooth(z),depth:10,color:k?C.output:C.active}],t.position,'长轴啮合区匹配刚轮齿槽，退出后平滑补偿材料齿距',{rotation:t.rotation,assemblyGroup:'flexspline',hiddenInList:true}));}return {parts};},
 sample(p,phase){const z=p.flexTeeth,R=z/2,out=-2*phase/z,poses={wave:{rotation:[0,0,phase],scale:[(R-2.4)/(R-3),(R-4.4)/(R-3),1]},'flex-body':{rotation:[0,0,phase],scale:[(R-1)/(R-2),(R-3)/(R-2),1]},output:pose([0,0,out])};for(let k=0;k<z;k++){const t=harmonicToothPose(z,phase,k);poses['flex-tooth-'+k]=pose(t.rotation,t.position);}return {poses,metrics:[M('柔轮 / 刚轮齿数',`${z} / ${z+2}`),M('减速比绝对值',z/2),M('输出转速',-2*rpm(p)/z,'r/min'),M('每输入圈输出位移',-720/z,'°')],status:'刚轮固定；椭圆长轴随输入旋转，柔轮每输入圈反向错过两齿。'};},
 principle:[{title:'齿差与应变波',text:'双波发生器使柔轮在相对的两个区域与刚轮啮合。刚轮多两个齿，因此波发生器转一圈，柔轮相对退后两齿。',formula:'n柔/n波 = (z柔−z刚)/z柔 = −2/z柔。'}],sources:[sources.harmonic],limits:'采用两长轴啮合区与平滑退出区的教学变形映射：啮合区齿廓匹配刚轮齿槽，退出后补偿材料齿距；保留两齿差与慢速输出。该映射不是实际弹性应变解或厂商 S-tooth 齿面；省略杯壁、柔性轴承、载荷分配及制造修形，不用于应力、回差或寿命预测。',questions:['变形波的转向为何不同于柔轮材料转向？','刚轮为何比柔轮多两个齿？','柔轮齿数增多后输出如何变化？']
});

const worm=finish({
 id:'enveloping-worm',number:48,title:'包络蜗杆传动',description:'对比普通圆柱蜗杆与包络蜗杆的齿面接触区域。',fields:[choice('wormType','蜗杆形式','enveloping',[['cylindrical','普通圆柱蜗杆'],['enveloping','包络蜗杆']]),choice('contactOverlay','接触区域示意','on',[['on','显示教学高亮'],['off','隐藏教学高亮']]),f('starts','蜗杆头数','',1,4,1,1),f('wheelTeeth','蜗轮齿数','',24,60,2,40),f('module','基准模数','mm',2,3.5,.5,2.5)],
 build(p){
  const R=p.wheelTeeth*p.module/2,wr=5*p.module,Cdist=R+wr,L=1.1*R,lead=p.starts*Math.PI*p.module,enveloping=p.wormType==='enveloping',radius=x=>enveloping?Cdist-Math.sqrt(R*R-x*x):wr;
  const vertices=[],indices=[];for(let i=0;i<=60;i++){const x=-L/2+L*i/60,r=radius(x)-p.module;for(let j=0;j<48;j++){const a=j*TAU/48;vertices.push(x,r*Math.cos(a),r*Math.sin(a));}}for(let i=0;i<60;i++)for(let j=0;j<48;j++){const a=i*48+j,b=i*48+(j+1)%48,c=b+48,d=a+48;indices.push(a,b,c,a,c,d);}
  const shapes=[{kind:'mesh',vertices,indices,color:C.input},cylinder(5,L+50,C.steel,[0,0,0],{rotation:[0,Math.PI/2,0]})];
  for(let k=0;k<p.starts;k++)shapes.push({kind:'tube',points:Array.from({length:601},(_,j)=>{const x=-L/2+L*j/600,a=(enveloping?p.wheelTeeth/p.starts*Math.asin(x/R):TAU*x/lead)+TAU*k/p.starts+Math.PI,r=radius(x);return [x,r*Math.cos(a),r*Math.sin(a)];}),radius:p.module*.4,color:k?C.input:C.active});
  const parts=[part('worm',enveloping?'沙漏形包络蜗杆':'普通圆柱蜗杆',shapes,[0,Cdist,0]),part('wheel','凹面蜗轮',[cylinder(R-1.15*p.module,4*p.module,C.brass),...Array.from({length:p.wheelTeeth},(_,k)=>wormTooth(p.wheelTeeth,p.module,p.starts,k,4*p.module)),cylinder(7,65,C.output)]),part('bearings','交错轴支承',[ring(12,7,8,C.case,[0,0,-28]),ring(12,7,8,C.case,[0,0,28]),ring(12,5,8,C.case,[-L/2-12,Cdist,0],{rotation:[0,Math.PI/2,0]}),ring(12,5,8,C.case,[L/2+12,Cdist,0],{rotation:[0,Math.PI/2,0]})],[0,0,0],'两轴交错 90°，不相交',{category:'housing'})];
  if(p.contactOverlay==='on'){const half=enveloping?.46:.1,overlay=[];for(const z of [-p.module*2.15,p.module*2.15])overlay.push({kind:'tube',points:Array.from({length:61},(_,i)=>{const a=Math.PI/2-half+2*half*i/60;return [(R+p.module)*Math.cos(a),(R+p.module)*Math.sin(a),z];}),radius:1,color:0xf7d06b});for(let i=0;i<=8;i++){const a=Math.PI/2-half+2*half*i/8;overlay.push(rod([(R+p.module)*Math.cos(a),(R+p.module)*Math.sin(a),-p.module*2.15],[(R+p.module)*Math.cos(a),(R+p.module)*Math.sin(a),p.module*2.15],.65,0xf7d06b));}parts.push(part('contact-guide','接触区域概念高亮',overlay,[0,0,0],'黄色网格仅对比局部与扩展包覆区域，不是压力云图、实测接触斑或 TCA 计算结果'));}
  return {parts};
 },
 sample(p,phase){const ratio=p.starts/p.wheelTeeth;return {poses:{worm:pose([phase,0,0]),wheel:pose([0,0,phase*ratio+Math.PI/2-Math.PI/p.wheelTeeth])},metrics:[M('蜗杆形式',p.wormType==='enveloping'?'包络（沙漏形）':'圆柱形'),M('减速比',p.wheelTeeth/p.starts),M('蜗轮转速',rpm(p)*ratio,'r/min'),M('基准截面导程',p.starts*Math.PI*p.module,'mm'),M('轴间距',p.module*(p.wheelTeeth+10)/2,'mm'),M('接触区域','黄色线框为教学概念示意')],status:'蜗杆形式改变包覆几何；相同头数与齿数保持相同速比。实际接触斑需齿面接触分析及加载验证。'};},
 principle:[{title:'从圆柱到包络',text:'普通蜗杆的基准半径沿轴向不变；包络蜗杆腰部收窄，两端增大，沿蜗轮圆周包覆更长区域。黄色网格只表达区域对比，不提供承载面积数值。'},{title:'速比仍由齿数决定',text:'蜗杆每转一圈，蜗轮前进与头数相同的齿数。',formula:'i = z蜗轮 / k蜗杆；n蜗轮 = n蜗杆·k/z。'}],sources:[sources.worm,{title:'Cone Drive：普通与双包络蜗杆结构对比',url:'https://conedrive.com/double-enveloping-worm/'}],limits:'包络蜗杆用沙漏形基准面与沿蜗轮角度分布的螺旋示意生成；蜗轮齿面为可辨识凹面近似；螺旋齿采用0.4模数截面半径及教学间隙，未求严格共轭接触或真实二次包络加工齿面。黄色区域范围人为选作教学对比，不能用于面积、压力、承载或效率判断；真实接触必须用 TCA/加载测试。',questions:['为什么包络蜗杆中间细、两端粗？','改变包络形式会改变速比吗？','为什么高亮区域不能直接当作接触压力？']
});

export const models=[valvetrain,planetary,hub,manual,synchronizer,cvt,rzeppa,conjugate,indexing,cycloidal,harmonic,worm];
