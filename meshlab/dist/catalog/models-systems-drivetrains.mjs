import {TAU,colors as C,num,choice,rpm,metric as M,box,cylinder,ring,gear,rod,part,rz,xy,add,define,integer,planetary,planetaryPoses,cage,clutch,bevel,cycloidOutline,circle} from './models-systems-helpers.mjs';

const planetarySource={title:'MathWorks：行星齿轮运动约束',url:'https://www.mathworks.com/help/sdl/ref/planetarygear.html'};
const rvData=p=>({ratio:1+p.crankTeeth/p.sunTeeth*p.pins,R:58,e:1.5,roller:2.8,c:(p.sunTeeth+p.crankTeeth)/2});
export const rv=define({id:'rv-reducer',number:49,title:'RV减速器',description:'观察前级直齿轮与双摆线轮的两级减速，比较输入、偏心轴和输出。',
  fields:[num('sunTeeth','输入太阳轮齿数','齿',12,30,3,18),num('crankTeeth','曲柄齿轮齿数','齿',30,54,6,36),num('pins','针齿数','个',14,24,2,18)],
  validate(p){integer(p.sunTeeth,p.crankTeeth,p.pins);if((p.sunTeeth+p.crankTeeth)%3)throw Error('三曲柄装配要求前级齿数和可被3整除');},
  build(p){const g=rvData(p),out=[];
    out.push(part('rv-input','前级输入齿轮','相对输出架驱动三个曲柄齿轮。',[gear(p.sunTeeth,1,8,C.input),cylinder(4,40,C.input,[0,0,-15])],[0,0,-28]));
    out.push(part('rv-ring','固定针齿壳','针齿数比摆线盘齿数多1，提供少齿差约束。',[ring(65,61,22,C.dark),...Array.from({length:p.pins},(_,i)=>cylinder(g.roller,24,C.steel,xy(g.R,i*TAU/p.pins)))],[0,0,4]));
    for(let i=0;i<2;i++){const holes=Array.from({length:3},(_,j)=>circle(6,xy(g.c,TAU*j/3+i*Math.PI/(p.pins-1)).slice(0,2)));out.push(part('rv-disc'+i,'摆线盘 '+(i+1),'双盘偏心相位相差180°；盘齿比针齿少1。透明显示便于追踪后方前级齿轮。',[{kind:'polygon',points:cycloidOutline(p.pins,g.R,g.e,g.roller),holes,depth:6,color:i?C.mid:C.output,opacity:i?.4:.5}],[i?-g.e:g.e,0,i*9]));}
    out.push(part('rv-output','输出架','与盘的低速姿态保持一致，支承三根曲柄。',[ring(13,5,7,C.output,[0,0,25]),cylinder(5,35,C.output,[0,0,43]),...Array.from({length:3},(_,i)=>rod([0,0,25],xy(g.c,TAU*i/3,25),4,C.output))]));
    for(let i=0;i<3;i++){const phase=(1+p.sunTeeth/p.crankTeeth)*TAU*i/3+Math.PI-Math.PI/p.crankTeeth;out.push(part('rv-crank'+i,'曲柄齿轮与偏心轴 '+(i+1),'前级外啮合驱动偏心部；轴中心随输出架公转。',[{...gear(p.crankTeeth,1,8,C.steel,[0,0,-28]),rotation:[0,0,phase]},cylinder(3,60,C.mid,[0,0,-3]),cylinder(5,6,C.input,[g.e,0,0]),cylinder(5,6,C.input,[-g.e,0,9])],xy(g.c,TAU*i/3)));}
    return {parts:out};},
  sample(p,a){const g=rvData(p),c=a/g.ratio,k=-(p.pins-1)*c,poses={'rv-input':rz(a),'rv-output':rz(c)};
    poses['rv-disc0']=rz(c,xy(g.e,k,0));poses['rv-disc1']=rz(c-Math.PI/(p.pins-1),xy(g.e,k+Math.PI,9));
    for(let i=0;i<3;i++)poses['rv-crank'+i]=rz(k,xy(g.c,TAU*i/3+c));
    return {poses,metrics:[M('总减速比',g.ratio),M('输出转速',p.inputRPM/g.ratio,'r/min'),M('曲柄绝对转速',-(p.pins-1)*p.inputRPM/g.ratio,'r/min'),M('摆线齿数',p.pins-1,'齿')],status:'固定针齿壳，输出架输出；双摆线盘作180°错相演示。'};},
  principle:[{title:'两级耦合',text:'前级曲柄中心随输出架运动，不能简单把两个固定轴速比相乘。',formula:'i = 1 + N针 × Z曲柄 / Z输入'},
    {title:'少齿差',text:'摆线盘比固定针齿少1齿，偏心运动产生低速输出。',formula:'ω曲柄 = −(N针−1)ω输出'}],
  sources:[{title:'Nabtesco：摆线减速器原理',url:'https://www.nabtesco.de/en/service/faq/technologies/functional-principle-of-cycloidal-gears'}],
  limits:'按RV运动约束和滚针包络构造双盘教学模型；曲柄孔、偏心轴承及双盘负载分配经过简化，未校核齿面修形、完整干涉、回差和制造公差。'});

const dctPairs=[[18,52],[24,46],[30,40],[36,34]],dctZ=[-45,-15,15,45];
function dctMotion(p,a){const k=Number(p.gear),selected=k?k-1:0,next=k===4?2:Math.min(3,selected+1),out=k?-a*dctPairs[selected][0]/dctPairs[selected][1]:0;
  const active=k?(selected%2):null,shaft=[0,0];if(k){shaft[active]=a;if(p.preselect==='on')shaft[1-active]=-out*dctPairs[next][1]/dctPairs[next][0];}return {k,selected,next,out,shaft,active};}
export const dct=define({id:'dual-clutch-transmission',number:50,title:'汽车双离合变速箱DCT',description:'切换奇偶挡位与预选挡，追踪两个离合器和两根输入轴的动力路线。',
  fields:[choice('gear','接合挡位','1',[['0','空挡'],['1','1挡'],['2','2挡'],['3','3挡'],['4','4挡']]),choice('preselect','另一半变速器','on',[['on','预选下一挡'],['off','未预选']])],
  build(p){const q=dctMotion(p,0),parts=[part('dct-engine','发动机侧飞轮','两个离合器共用的输入端。',[cylinder(30,7,C.input),cylinder(5,45,C.input,[0,0,-20])],[-35,0,-145]),
    part('dct-odd-shaft','奇数挡实心轴','连接1、3挡输入齿轮。',[cylinder(4,220,C.input)],[-35,0,-30]),
    part('dct-even-shaft','偶数挡空心轴','套在奇数挡轴外，独立连接2、4挡齿轮。',[{...ring(8,5,185,C.mid),opacity:.5}],[-35,0,-10]),
    part('dct-output','公共输出轴','承载挡与预选挡可各有一个从动轮锁合，预选支路离合器保持分离。',[cylinder(5,170,C.output)],[35,0,0]),
    part('dct-dog','承载挡接合套','当前位置显示承载挡位的从动齿轮；空挡移至末端。',[ring(11,5.5,9,q.k?C.output:C.red)],[35,0,q.k?dctZ[q.selected]+8:78]),
    part('dct-predog','预选挡接合套','预选挡被公共输出轴反拖，但对应发动机离合器分离。',[ring(11,5.5,7,p.preselect==='on'&&q.k?C.mid:C.red)],[35,0,p.preselect==='on'&&q.k?dctZ[q.next]+8:-75])];
    for(let j=0;j<2;j++){const c=clutch('dct-clutch'+j,j?'偶数挡离合器 K2':'奇数挡离合器 K1',0,23,q.active===j);c.position=[-35,0,-105+j*28];parts.push(c);}
    dctPairs.forEach(([z1,z2],i)=>{parts.push(part('dct-driver'+i,(i+1)+'挡输入轮','与对应奇/偶输入轴刚性连接。',[gear(z1,2,8,i%2?C.mid:C.input)],[-35,0,dctZ[i]]));parts.push(part('dct-driven'+i,(i+1)+'挡从动轮','未选中时为空套齿轮，可随对应输入轴空转。',[gear(z2,2,8,q.selected===i&&q.k?C.output:C.steel)],[35,0,dctZ[i]]));});
    return {parts};},
  sample(p,a){const q=dctMotion(p,a),poses={'dct-engine':rz(a),'dct-odd-shaft':rz(q.shaft[0]),'dct-even-shaft':rz(q.shaft[1]),'dct-output':rz(q.out),'dct-dog':rz(q.out),'dct-predog':rz(q.out)};
    for(let j=0;j<2;j++)poses['dct-clutch'+j]=rz(q.shaft[j]);dctPairs.forEach(([x,y],i)=>{poses['dct-driver'+i]=rz(q.shaft[i%2]);poses['dct-driven'+i]=rz(-q.shaft[i%2]*x/y+Math.PI-Math.PI/y);});
    const ratio=q.k?dctPairs[q.selected][1]/dctPairs[q.selected][0]:0;
    return {poses,metrics:[M('当前挡位',q.k),M('当前传动比',ratio),M('输出转速幅值',q.k?p.inputRPM/ratio:0,'r/min'),M('K1 接合',q.active===0?1:0),M('K2 接合',q.active===1?1:0)],status:q.k?'只有一个离合器承载；预选轴由公共输出轴反拖至下一挡匹配转速。':'空挡，两离合器分离；本页以无惯性初始静止表示输出。'};},
  principle:[{title:'双支路',text:'奇偶挡分别由K1、K2驱动，下一挡可在不承载的支路预先接合。',formula:'ω输出 = −ω输入 Z主动 / Z从动'},
    {title:'预选速度',text:'空套齿轮仍可转动；未承载不等于所有零件都静止。',formula:'ω预选轴 = −ω输出 Z下一从动 / Z下一主动'}],
  sources:[{title:'Volkswagen：DSG的两个传动半部',url:'https://www.volkswagen-newsroom.com/en/the-new-golf-r-estate-media-drive-7510/the-drive-train-7512'}],
  limits:'四个前进挡的双离合结构示意；没有液压控制、惯性、摩擦片温升和换挡重叠过程。挡位切换为离散稳态，未仿真驾驶换挡冲击。'});

function atState(p,a){const ns=p.sunTeeth,nr=ns+36;switch(p.mode){case'low':return {s:a,r:0,c:a*ns/(ns+nr),out:a*ns/(ns+nr),label:'内齿圈制动，太阳轮输入，行星架输出'};case'reverse':return {s:a,r:-a*ns/nr,c:0,out:-a*ns/nr,label:'行星架制动，太阳轮输入，内齿圈输出'};case'overdrive':return {s:0,r:a*(ns+nr)/nr,c:a,out:a*(ns+nr)/nr,label:'太阳轮制动，行星架输入，内齿圈输出'};default:return{s:a,r:a,c:a,out:a,label:'锁合任意两构件，整体1:1旋转'};}}
export const automatic=define({id:'planetary-automatic',number:51,title:'行星齿轮式自动变速箱AT',description:'切换离合器和制动器组合，观察低挡、直接挡、超速挡与倒挡。',
  fields:[choice('mode','离合/制动组合','low',[['low','低挡：锁内齿圈'],['direct','直接挡：整体锁合'],['overdrive','超速挡：锁太阳轮'],['reverse','倒挡：锁行星架']]),num('sunTeeth','太阳轮齿数','齿',18,36,6,24)],validate(p){integer(p.sunTeeth);if(p.sunTeeth%6)throw Error('太阳轮齿数须为6的倍数');},
  build(p){const g=planetary(p.sunTeeth,18,1.4,'at'),q=atState(p,0),R=g.nr*.7,brake=p.mode==='reverse'?ring(14,10,6,C.red,[0,0,14]):p.mode==='overdrive'?ring(9,5,6,C.red,[0,0,-27]):ring(R+9,R+4,10,p.mode==='direct'?C.steel:C.red),ringOutput=p.mode==='reverse'||p.mode==='overdrive',connection=ringOutput?[ring(R+4.5,R+3.5,20,C.output,[0,0,-25]),...Array.from({length:3},(_,i)=>rod([0,0,-15],xy(R+4,TAU*i/3,-15),3,C.output))]:[];return {parts:[...g.parts,clutch('at-clutch','换挡离合器组',-24,27,p.mode==='direct'),
    part('at-brake','壳体制动器','制动片随工况连接到内齿圈、行星架或太阳轮；直接挡释放。',[{...brake,opacity:.7}]),
    part('at-port','输出接合鼓',q.label,[ring(18,6,6,C.output),ring(8,5.5,35,C.output,[0,0,-12]),cylinder(6,30,C.output,[0,0,15]),...connection],[0,0,35]),cage(R+12,90,[0,0,0],'at-case')]};},
  sample(p,a){const g=planetary(p.sunTeeth,18,1.4,'at'),q=atState(p,a),unit=atState(p,1);return {poses:{...planetaryPoses(g,q.s,q.r,q.c),'at-clutch':rz(p.mode==='direct'?a:0),'at-port':rz(q.out)},metrics:[M('太阳轮转速',unit.s*p.inputRPM,'r/min'),M('内齿圈转速',unit.r*p.inputRPM,'r/min'),M('行星架转速',unit.c*p.inputRPM,'r/min'),M('输出转速',unit.out*p.inputRPM,'r/min'),M('Willis残差',p.sunTeeth*unit.s+g.nr*unit.r-(p.sunTeeth+g.nr)*unit.c)],status:q.label};},
  principle:[{title:'同一行星排，多种速比',text:'改变谁输入、谁输出、谁制动，改变三个构件的约束。',formula:'Zs ωs + Zr ωr = (Zs+Zr) ωc'}],sources:[planetarySource],
  limits:'单排行星排展示AT换挡约束，不代表任何量产多排行星八挡变速箱；离合器离散锁合，未求换挡瞬态、阀体与液压。'});

function converter(p){const s=p.mode==='locked'?1:p.speedRatio,anchors=[[0,2.232],[.5,1.5462],[.8,1.1528],[.94,1],[.98,1]];let t=1;
  if(p.mode!=='locked'){for(let i=1;i<anchors.length;i++)if(s<=anchors[i][0]){const [x,y]=anchors[i-1],[X,Y]=anchors[i];t=y+(Y-y)*(s-x)/(X-x);break;}}
  const pin=p.inputTorque*p.inputRPM*TAU/60;return {s,t,eta:s*t,pin,pout:pin*s*t,torque:p.inputRPM>0?p.inputTorque*t:0};}
function vanes(count,hand,color){return Array.from({length:count},(_,i)=>{const a=TAU*i/count,points=[];for(let j=0;j<7;j++){const r=13+31*j/6,t=a+hand*.32*j/6;points.push([r*Math.cos(t),r*Math.sin(t)]);}for(let j=6;j>=0;j--){const r=13+31*j/6,t=a+hand*.32*j/6+.045;points.push([r*Math.cos(t),r*Math.sin(t)]);}return {kind:'polygon',points,depth:13,color};});}
export const torqueConverter=define({id:'torque-converter',number:52,title:'液力变矩器',description:'比较泵轮、涡轮、导轮与锁止离合器，观察速比、转矩比和效率。',
  fields:[choice('mode','传动状态','fluid',[['fluid','液力传动'],['locked','锁止离合器接合']]),num('speedRatio','涡轮/泵轮速比','',0,.98,.01,.65),num('inputTorque','泵轮输入转矩','N·m',0,200,5,60)],
  build(p){const parts=[part('tc-pump','泵轮','与发动机相连，推动液体；透明背板便于看叶片。',[{...ring(46,10,3,C.input),opacity:.2},cylinder(12,4,C.input),...vanes(18,1,C.input),cylinder(5,40,C.input,[0,0,-20])],[0,0,-14]),
    part('tc-turbine','涡轮','接收流体角动量并向变速器输出；背板透明用于内部观察。',[{...ring(46,10,3,C.output),opacity:.2},cylinder(12,4,C.output),...vanes(16,-1,C.output),cylinder(5,40,C.output,[0,0,20])],[0,0,14]),
    part('tc-stator','导轮','通过单向支承改变回流方向；此页以固定参考位置显示，不求自由轮转速。',[{...ring(27,10,3,C.mid),opacity:.2},...vanes(10,.45,C.mid).map(s=>({...s,points:s.points.map(([x,y])=>[x*.6,y*.6]),depth:7}))]),
    part('tc-lock','锁止离合器','外圈摩擦片和开放支架展示锁止通路，省略完整遮盖式压盘以便看流动。',[ring(12,5,16,C.mid),...[-3,0,3].map((z,i)=>ring(40,34,2,i%2?C.steel:C.input,[0,0,z])),ring(42,33,3,p.mode==='locked'?C.output:C.red,[0,0,p.mode==='locked'?9:15]),...Array.from({length:3},(_,i)=>rod(xy(6,TAU*i/3,-7),xy(34,TAU*i/3,-7),2,C.output))],[0,0,36]),cage(52,90,[0,0,0],'tc-case')];
    for(let i=0;i<10;i++)parts.push({...part('tc-flow'+i,i?'流线标记':'流动方向示意','标记轨迹不是CFD求解。',[{kind:'sphere',radius:2,color:0x67c1e0}]),assemblyGroup:'tc-fluid',hiddenInList:i!==0});return {parts};},
  sample(p,a){const q=converter(p),poses={'tc-pump':rz(a),'tc-turbine':rz(a*q.s),'tc-lock':rz(p.mode==='locked'?a:a*q.s)};
    for(let i=0;i<10;i++){const u=a+i*TAU/10,v=2*a+i*TAU/10;poses['tc-flow'+i]={position:xy(29+12*Math.cos(v),u,12*Math.sin(v)),scale:p.mode==='locked'?[.1,.1,.1]:[1,1,1]};}
    return {poses,metrics:[M('涡轮转速',p.inputRPM*q.s,'r/min'),M('转矩比',q.t),M('涡轮转矩',q.torque,'N·m'),M('效率',100*q.eta,'%'),M('输入功率',q.pin,'W'),M('损失功率',q.pin-q.pout,'W')],status:p.inputRPM===0?'输入停转、功率为0；速比/转矩比/效率仅保留给定工况的曲线值，并非当前静止效率。':p.mode==='locked'?'锁止强制泵轮与涡轮1:1，速比滑块在此状态被忽略。':'速比由用户给定，转矩比由教学特性表插值；不由叶片几何预测。'};},
  principle:[{title:'转矩放大与效率',text:'低速比可放大转矩，但输出功率不会超过输入；失速时输出功率为0。',formula:'η = (n涡/n泵) × (T涡/T泵)'},{title:'锁止',text:'锁止离合器建立机械连接，理想速比和转矩比均为1。',formula:'n涡 = n泵'}],
  sources:[{title:'MathWorks：液力变矩器速比与转矩比',url:'https://www.mathworks.com/help/sdl/ref/torqueconverter.html'},{title:'ZF：液力变矩器与锁止',url:'https://www.zf.com/products/en/cars/products_65854.html'}],
  limits:'使用文档特性表的少量节点线性插值，仅为原理曲线；叶片和流线为示意，不计算三维流场、容量系数、热平衡或瞬态。锁止效率按理想1处理。'});

function hybridState(p){const ns=30,nr=78,c=p.mode==='accelerate'?1:0,r=p.roadRatio,s=((ns+nr)*c-nr*r)/ns,T=p.mode==='accelerate'?p.engineTorque:0,ts=-ns/(ns+nr)*T,tr=-nr/(ns+nr)*T,w=p.inputRPM*TAU/60,tm=p.mode==='recover'?-p.motorTorque:p.motorTorque;
  return {ns,nr,c,r,s,T,ts,tr,engineP:T*c*w,mg1P:ts*s*w,mg2P:tm*r*w,outputP:(-tr+tm)*r*w};}
export const hybrid=define({id:'hybrid-power-split',number:53,title:'混合动力功率分流机构',description:'调节发动机与车轮支路速度，观察太阳轮发电机及机械、电气功率分流。',
  fields:[choice('mode','运行方式','accelerate',[['start','电动起步'],['accelerate','发动机+电机加速'],['recover','制动回收']]),num('roadRatio','车轮支路/参考轴转速','',0,3,.1,1.2),num('engineTorque','发动机转矩','N·m',0,150,5,80),num('motorTorque','MG2驱动/回收转矩幅值','N·m',0,120,5,40)],
  build(p){const g=planetary(30,24,1.2,'hsd');return {parts:[...g.parts,
    part('hsd-engine','发动机曲轴 → 行星架','发动机曲轴通过空心连接段驱动行星架，太阳轮轴从内部通过。',[ring(9,5.5,48,C.input,[0,0,38]),cylinder(6,32,C.input,[0,0,78])]),
    part('hsd-engine-case','固定发动机机体','机体保持静止，内部曲轴驱动行星架。',[{...box([42,32,35],C.dark),opacity:.35}],[0,0,90],[0,0,0],'housing'),
    part('hsd-mg1','MG1 转子 → 太阳轮','MG1转速由行星约束决定，可正转、静止或反转。',[cylinder(15,20,C.mid),cylinder(5,35,C.mid),box([4,4,22],C.steel,[14,0,0])],[0,0,-40]),
    part('hsd-mg1-case','MG1 固定定子','定子不跟随太阳轮旋转。',[{...ring(26,18,30,C.dark),opacity:.3}],[0,0,-40],[0,0,0],'housing'),
    part('hsd-mg2','MG2 环形转子 → 齿圈支路','本页环形电机与齿圈1:1连接；按给定转矩计算理想功率。',[ring(57,50,18,C.output),box([4,4,20],C.steel,[55,0,0])]),
    part('hsd-mg2-case','MG2 固定定子','定子围绕齿圈输出支路，不参与转动。',[{...ring(64,60,24,C.dark),opacity:.3}],[0,0,0],[0,0,0],'housing'),
    part('hsd-battery','电池与逆变器','导线仅表示功率端口；不计算电池SOC和电控。',[box([48,22,30],0x6ba587),{kind:'tube',points:[[0,0,0],[-15,0,-40],[-90,0,-40]],radius:2,color:C.mid},{kind:'tube',points:[[0,0,0],[-26,0,0]],radius:2,color:C.output}],[90,0,0],[0,0,0],'housing')]};},
  sample(p,a){const g=planetary(30,24,1.2,'hsd'),q=hybridState(p);return {poses:{...planetaryPoses(g,a*q.s,a*q.r,a*q.c),'hsd-engine':rz(a*q.c),'hsd-mg1':rz(a*q.s),'hsd-mg2':rz(a*q.r)},metrics:[M('发动机转速',p.inputRPM*q.c,'r/min'),M('MG1转速',p.inputRPM*q.s,'r/min'),M('输出/MG2转速',p.inputRPM*q.r,'r/min'),M('发动机功率',q.engineP,'W'),M('MG1功率（正为输入）',q.mg1P,'W'),M('MG2功率',q.mg2P,'W'),M('车轮输出功率',q.outputP,'W'),M('功率平衡残差',q.engineP+q.mg1P+q.mg2P-q.outputP,'W')],status:p.mode==='recover'?'回收时MG2及车轮输出功率为负：车轮机械能输入系统，MG2发电；发动机停机。':'电动起步忽略发动机转矩；加速时发动机与MG2共同供能，MG1负功率表示发电。'};},
  principle:[{title:'速度约束',text:'三端行星排有两个独立转速，MG1用于调节发动机与车轮支路的关系。',formula:'30 nMG1 + 78 n输出 = 108 n发动机'},{title:'功率不是固定比例',text:'理想转矩比由齿数决定，各端功率还取决于该端速度。',formula:'P发动机 + PMG1 + PMG2 = P输出'}],
  sources:[{title:'Toyota技术报告：混合动力功率分流',url:'https://global.toyota/pages/global_toyota/mobility/technology/toyota-technical-review/TTR_Vol47-2_E.pdf'},planetarySource],
  limits:'单排行星功率分流示意，固定30/78齿；省略终传动、逆变器损失、电池SOC、控制限幅和动力学。MG2与齿圈按1:1简化。'});

function transferState(p){const factor=p.range==='low'?1/3:1,d=p.lock==='locked'?0:p.difference;return {factor,front:factor*(1+d),rear:factor*(1-d),d};}
export const transfer=define({id:'four-wheel-transfer',number:54,title:'四驱分动箱与中央差速器',description:'切换高低速及中央差速锁，对比前后传动轴同速与差速。',
  fields:[choice('range','分动箱挡位','high',[['high','高速直连'],['low','低速3:1']]),choice('lock','中央差速器','open',[['open','允许差速'],['locked','锁止']]),num('difference','前后速度差比例','',-.8,.8,.1,.2)],
  build(p){const g=planetary(24,12,1.4,'tr',[0,0,-35]);return {parts:[...g.parts,clutch('tr-range','高低挡锁合套',-70,24,p.range==='high'),
    part('tr-diff','中央差速器壳','壳体转速是前后输出转速平均值；空心连接段来自行星架。',[ring(35,28,35,C.output),rod([-25,0,0],[25,0,0],3,C.output),ring(14,10,76,C.output,[0,0,-38]),ring(14,6,5,C.output,[0,0,-76]),...Array.from({length:3},(_,i)=>rod([0,0,0],xy(33,TAU*i/3),3,C.output))],[0,0,55]),
    part('tr-front','前传动轴侧齿轮','允许差速时可相对壳体转动。',[bevel(24,25,10,C.input),cylinder(5,58,C.input,[0,0,32])],[0,0,72]),
    part('tr-rear','后传动轴侧齿轮','后向空心输出轴从行星架连接段内部通过。',[bevel(24,25,10,C.mid),ring(8,5.5,70,C.mid,[0,0,35])],[0,0,38],[0,Math.PI,0]),
    part('tr-spider','差速小锥齿轮','差速时相对十字轴自转；齿形仅示意非共面传动。',[bevel(12,13,8,C.steel)],[23,0,55],[0,Math.PI/2,0]),
    clutch('tr-lock','中央差速锁套',95,20,p.lock==='locked')]};},
  sample(p,a){const q=transferState(p),g=planetary(24,12,1.4,'tr',[0,0,-35]),c=a*q.factor;
    return {poses:{...planetaryPoses(g,a,p.range==='high'?a:0,c),'tr-range':rz(p.range==='high'?a:c),'tr-diff':rz(c),'tr-front':rz(a*q.front),'tr-rear':{rotation:[0,Math.PI,-a*q.rear]},'tr-spider':{position:xy(23,c,55),rotation:[a*q.factor*q.d*2,Math.PI/2,c]},'tr-lock':rz(c)},metrics:[M('前轴转速',p.inputRPM*q.front,'r/min'),M('后轴转速',p.inputRPM*q.rear,'r/min'),M('差速壳转速',p.inputRPM*q.factor,'r/min'),M('平均约束残差',(q.front+q.rear)/2-q.factor)],status:p.lock==='locked'?'锁止只强制前后同速，速度差滑块被忽略；不代表扭矩固定按50/50分配。':'前后速度差是用户给定的转弯工况；未由轮胎/道路负载预测。'};},
  principle:[{title:'差速与锁止',text:'开放差速器允许前后转速不同；锁止消除相对转速。',formula:'(n前+n后)/2 = n差速壳'},{title:'低速挡',text:'本例采用行星减速，理想输出速度降至输入的1/3。',formula:'n壳 = n输入/3（低挡）'}],
  sources:[{title:'Toyota：四驱与中央差速锁',url:'https://assets.sia.toyota.com/publications/en/om-s/OM60C79U/pdf/OM60C79U.pdf'},planetarySource],
  limits:'三级接口为行星高低挡加对称锥齿差速示意；非共面锥齿形状未做制造共轭校核。未求轮胎附着、实际扭矩分配、传动系扭紧或接合冲击。'});

const ptoPairs={slow:[27,100],fast:[40,80]},wheelPairs={low:[12,48],high:[24,36]};
export const pto=define({id:'tractor-pto',number:55,title:'拖拉机动力输出传动',description:'选择540/1000转速挡和PTO独立离合器，观察动力输出轴与作业机具。',
  fields:[choice('mode','PTO挡位','slow',[['slow','540 r/min 标称挡'],['fast','1000 r/min 标称挡']]),choice('clutch','PTO离合器','engaged',[['engaged','接合'],['released','分离']]),choice('driveGear','行驶支路','low',[['low','低挡'],['high','高挡'],['neutral','行驶空挡']]),num('inputRPM','发动机转速','r/min',0,2500,20,2000)],
  build(p){const parts=[part('pto-engine','发动机输入轴','PTO离合器分离时发动机侧仍可旋转。',[cylinder(4,150,C.input,[0,0,15]),cylinder(24,8,C.input,[0,0,-50])],[-30,0,-10]),
    part('pto-input-tube','PTO 独立空心输入轴','套在发动机轴外，只有PTO离合器接合才带动这根轴。',[ring(8,6.5,82,C.input)],[-30,0,-25]),
    part('pto-shaft','PTO输出轴','花键轴与接合挡位相连，向机具传递动力。',[cylinder(6,115,C.output),...Array.from({length:6},(_,i)=>box([3,3,32],C.output,xy(7,TAU*i/6,53),[0,0,TAU*i/6]))],[30,0,10]),
    part('pto-implement','机具转子示意','输出连接示意，不代表真实刀具或机具安全防护设计。',[cylinder(10,12,C.output),box([80,7,4],C.output)],[30,0,77]),
    part('pto-selector','PTO选挡套','只将一个空套齿轮锁到输出轴。',[ring(12,6.5,8,C.output)],[30,0,p.mode==='slow'?-6:24])];
    const cc=clutch('pto-clutch','独立PTO离合器',0,21,p.clutch==='engaged');cc.position=[-30,0,-65];parts.push(cc);
    Object.entries(ptoPairs).forEach(([id,[a,b]],j)=>{const m=120/(a+b),z=j*30-15;parts.push(part('pto-in-'+id,id==='slow'?'540挡主动轮':'1000挡主动轮','固定总中心距，选择不同齿数比。',[{...gear(a,m,8,C.input),hole:7.5}],[-30,0,z]));parts.push(part('pto-out-'+id,id==='slow'?'540挡从动轮':'1000挡从动轮','未接合挡位可以空转，不能同时锁合两挡。',[{...gear(b,m,8,C.steel),hole:6.4}],[30,0,z]));});
    Object.entries(wheelPairs).forEach(([id,[a,b]],j)=>{const z=40+j*25;parts.push(part('drive-in-'+id,'行驶'+(id==='low'?'低挡':'高挡')+'主动轮','从发动机侧单独分出行驶支路。',[gear(a,2,8,C.input)],[-30,0,z]));parts.push(part('drive-out-'+id,'行驶'+(id==='low'?'低挡':'高挡')+'从动轮','由行驶选挡套决定是否锁合到中间轴。',[gear(b,2,8,p.driveGear===id?C.output:C.steel)],[-90,0,z]));});
    parts.push(part('drive-counter','行驶中间轴与末级小齿轮','与PTO离合器独立，驱动车轮末级。',[cylinder(5,65,C.mid),gear(15,2,8,C.mid,[0,0,33])],[-90,0,60]),
      part('drive-axle','车轮末级与车轴','末级60齿轮与中间轴15齿轮减速。',[gear(60,2,8,C.output),cylinder(6,160,C.output)],[-165,0,93]),
      part('drive-wheels','左右车轮','本页两轮共用刚性轴，未包含后桥差速。',[{kind:'torus',radius:31,tube:9,color:C.dark,position:[0,0,-65]},{kind:'torus',radius:31,tube:9,color:C.dark,position:[0,0,65]},...[-65,65].flatMap(z=>[rod([-25,0,z],[25,0,z],3,C.steel),rod([0,-25,z],[0,25,z],3,C.steel)])],[-165,0,93]),
      part('drive-selector','行驶选挡套','行驶空挡与PTO接合可同时存在。',[ring(12,5.5,7,p.driveGear==='neutral'?C.red:C.output)],[-90,0,p.driveGear==='low'?48:p.driveGear==='high'?73:22]));return {parts};},
  sample(p,a){const active=p.clutch==='engaged',input=active?a:0,[z1,z2]=ptoPairs[p.mode],out=-input*z1/z2,poses={'pto-engine':rz(a),'pto-input-tube':rz(input),'pto-clutch':rz(input),'pto-shaft':rz(out),'pto-selector':rz(out),'pto-implement':rz(out)};
    Object.entries(ptoPairs).forEach(([id,[x,y]])=>{poses['pto-in-'+id]=rz(input);poses['pto-out-'+id]=rz(-input*x/y+Math.PI-Math.PI/y);});
    const w=p.driveGear==='neutral'?0:wheelPairs[p.driveGear][0]/wheelPairs[p.driveGear][1],counter=-a*w,wheel=-counter/4;
    Object.entries(wheelPairs).forEach(([id,[x,y]])=>{poses['drive-in-'+id]=rz(a);poses['drive-out-'+id]=rz(-a*x/y+(1+x/y)*Math.PI+Math.PI-Math.PI/y);});
    poses['drive-counter']=rz(counter);poses['drive-selector']=rz(counter);poses['drive-axle']=rz(wheel+(1+15/60)*Math.PI+Math.PI-Math.PI/60);poses['drive-wheels']=rz(wheel);
    return {poses,metrics:[M('发动机转速',p.inputRPM,'r/min'),M('PTO输出转速幅值',active?p.inputRPM*z1/z2:0,'r/min'),M('车轮转速',p.inputRPM*w/4,'r/min'),M('PTO离合器接合',active?1:0)],status:'车轮与PTO分别选挡；行驶空挡时仍可驱动PTO。540/1000为发动机2000 r/min的教学匹配。'};},
  principle:[{title:'独立动力输出',text:'PTO独立离合器可切断机具支路而发动机仍转；本页不绑定车轮行驶速度。',formula:'|nPTO| = n发动机 × Z主动/Z从动'}],
  sources:[{title:'John Deere：540/1000 PTO工况',url:'https://www.deere.co.nz/en/tractors/row-crop-tractors/row-crop-7-family/implement-compatibility/'}],
  limits:'标称发动机2000 r/min和齿数组合为教学配置，非某台拖拉机维修参数；车轮支路两挡加固定末级，省略后桥差速、PTO万向轴、惯性滑行及机具载荷。分离后的支路以无惯性静止表示。'});

export const drivetrainModels=[rv,dct,automatic,torqueConverter,hybrid,transfer,pto];
