// Plans operate on the stopped, phase=0 assembly. Directions are world axes.
// A move is a rigid collection, not a request to scatter each listed component.
const X=[1,0,0],NX=[-1,0,0],Y=[0,1,0],NY=[0,-1,0],Z=[0,0,1],NZ=[0,0,-1];
const negate=v=>v.map(n=>-n);
const matches=(part,key)=>key instanceof RegExp?key.test(part.id):part.id===key||part.assemblyGroup===key;
function planner(parts){
  const stages=[];
  const ids=keys=>{const chosen=new Set(parts.filter(p=>keys.some(k=>matches(p,k))).map(p=>p.id));
    const groups=new Set(parts.filter(p=>chosen.has(p.id)&&p.assemblyGroup).map(p=>p.assemblyGroup));
    for(const p of parts)if(p.assemblyGroup&&groups.has(p.assemblyGroup))chosen.add(p.id);
    return [...chosen];};
  const move=(keys,axis,distance)=>({ids:ids(keys),axis:[...axis],...(distance===undefined?{}:{distance})});
  const stage=(title,description,...moves)=>{moves=moves.filter(m=>m.ids.length);if(moves.length)stages.push({title,description,moves});};
  const out=(title,description,keys,axis,parking)=>{
    const m=move(keys,axis);if(!m.ids.length)return;
    stage(title,description,m);
    if(parking)stage('移到侧方，留出拆卸通道','该总成已脱离原来的轴、齿面或导轨；现在整组移到侧方，后续零件不穿过已拆件。',move(keys,parking));
  };
  return {stages,move,stage,out};
}
function caseOpening(p,prefix){
  p.out('抽出输出端盖','端盖沿输出轴正向滑出；先越过轴端，再移到侧方。',[prefix+'-front-cap'],Z,X);
  p.out('抽出输入端盖','输入侧端盖沿轴线反向滑出，解除壳筒的轴向封闭。',[prefix+'-rear-cap'],NZ,NX);
  p.out('移开壳筒','两端盖已移走；壳筒沿轴向越过内部零件外径，不径向穿过内部齿轮。',[prefix+'-shell'],Z,Y);
}
function planetsOut(p,prefix,parking=X){
  const carrier=[prefix+'-carrier',new RegExp('^'+prefix+'-planet\\d+$')];
  p.out('抽出行星架与行星轮总成','太阳轮和前方连接件已取出，行星架与所有行星轮保持相互位置，沿轴向脱离内齿圈。',carrier,Z,parking);
  p.out('从行星销上取下行星轮','总成已经移到侧方；行星轮整组从行星销背面滑出，行星架不随轮移动。',[new RegExp('^'+prefix+'-planet\\d+$')],NZ);
}

export const systemPlans={
  'rv-reducer':(parts)=>{
    const p=planner(parts);
    p.out('取下输出架','固定针齿壳留作基准；输出架沿正轴向从三根曲柄轴端滑出。',['rv-output'],Z,X);
    p.out('取下前级输入齿轮','输入齿轮与轴是一个零件，向输入侧整体抽出并脱开三个曲柄轮。',['rv-input'],NZ,NX);
    const cartridge=['rv-disc0','rv-disc1',/^rv-crank\d+$/];
    p.out('抽出双盘偏心轴总成','双摆线盘与三根偏心轴共同向输入侧退出固定针齿，不能把后盘强拉过前方反相偏心段。',cartridge,NZ,NY);
    p.out('取下外侧摆线盘','总成已离开针齿壳；外侧盘可向正轴向滑出。后盘与合体偏心轴仍作为子总成保留。',['rv-disc1'],Z,X);
    return p.stages;
  },
  'dual-clutch-transmission':(parts)=>{
    const p=planner(parts);
    p.out('拆下发动机侧飞轮','先释放输入端连接，飞轮及其短轴向输入侧退出。',['dct-engine'],NZ,NY);
    p.out('拆下外侧离合器 K1','从输入端按轴向顺序拆离合器，不让后方 K2 穿过 K1。',['dct-clutch0'],NZ,NX);
    p.out('拆下内侧离合器 K2','输入端通道已打开，K2 沿同一轴线退出。',['dct-clutch1'],NZ,Y);
    p.out('分离输出轴总成','四个从动轮、公共输出轴与两个接合套共同向远离输入轴的方向移动，先解除全部外啮合。',[ 'dct-output','dct-dog','dct-predog',/^dct-driven\d+$/],X);
    p.out('卸下前端三挡输入轮','从空心轴前方的实心轴上，先卸最外侧三挡轮。',['dct-driver2'],Z,Y);
    p.out('卸下一挡输入轮','三挡轮已移开，一挡轮沿同一轴向滑出。',['dct-driver0'],Z,NY);
    p.out('抽出奇数挡实心轴','两只奇数挡轮与 K1 已取下，实心轴从空心轴孔内抽出。',['dct-odd-shaft'],Z,X);
    p.out('卸下四挡输入轮','空心轴保留为基准；先取出其前端四挡轮。',['dct-driver3'],Z,Y);
    p.out('卸下二挡输入轮','四挡轮不再挡住二挡轮的轴向取出路径；输出轴保持完整换挡子总成。',['dct-driver1'],Z,NY);
    return p.stages;
  },
  'planetary-automatic':(parts,params={})=>{
    const p=planner(parts);caseOpening(p,'at-case');
    p.out('拆下输出接合鼓','先解除输出端连接，接合鼓和输出轴整体向正轴向取出。',['at-port'],Z,X);
    if(params.mode==='overdrive')p.out('拆下输入侧制动与离合组件','超速挡的太阳轮制动环位于输入侧；与邻接离合组件一同向输入侧取出。',['at-clutch','at-brake'],NZ,NX);
    else{
      p.out('拆下输入离合器','解除离合约束后，摩擦片组作为整体向输入侧滑出。',['at-clutch'],NZ,NX);
      p.out('拆下制动环','输出端已腾空；制动环沿轴向离开其制动构件。',['at-brake'],Z,NY);
    }
    p.out('抽出太阳轮与输入轴','太阳轮从行星架背面退出，不让大齿轮穿过行星架中心的小孔。',['at-sun'],NZ,NY);
    planetsOut(p,'at');return p.stages;
  },
  'torque-converter':(parts)=>{
    const p=planner(parts);
    p.out('移走流线辅助标记','这组点是流动方向示意，不是需要拆卸的实体零件；整组移出机械观察区。',['tc-fluid',/^tc-flow\d+$/],Y);
    caseOpening(p,'tc-case');
    p.out('取出锁止离合器','输出端盖已打开，先取下最外侧锁止组件，为涡轮让出通道。',['tc-lock'],Z,X);
    p.out('取出涡轮及输出轴','涡轮沿轴向离开泵轮和导轮，保持叶片、轮毂和输出轴为整体。',['tc-turbine'],Z,NY);
    p.out('取出导轮','涡轮已经移走，导轮从中心支承向输出侧取出；泵轮保留为输入侧基准。',['tc-stator'],Z,NX);
    return p.stages;
  },
  'hybrid-power-split':(parts)=>{
    const p=planner(parts);
    p.out('移开电气辅助模块','先断开示意电气接口，电池、逆变器与其示意线保持为一个辅助模块。',['hsd-battery'],X);
    p.out('移开固定发动机机体','带通孔机体沿曲轴输出端退出，不横向扫过曲轴。',['hsd-engine-case'],Z,Y);
    p.out('移开 MG1 固定定子','定子沿 MG1 轴线向输入侧退出；转子暂留原位。',['hsd-mg1-case'],NZ,NX);
    p.out('移开 MG2 固定定子','环形定子沿轴向离开环形转子。',['hsd-mg2-case'],Z,NY);
    p.out('取下发动机输入连接','解除行星架端连接，空心连接段与曲轴向正轴向抽出。',['hsd-engine'],Z,X);
    p.out('取下 MG1 转子','定子与后方通道已清空，MG1 转子向负轴向退出太阳轮连接。',['hsd-mg1'],NZ,NX);
    p.out('取下 MG2 环形转子','环形转子从齿圈外侧沿轴向脱开；内齿圈保留为基准。',['hsd-mg2'],Z,Y);
    p.out('抽出太阳轮','从行星架背面抽出太阳轮，避免齿轮越过行星架中心环。',['hsd-sun'],NZ,NY);
    planetsOut(p,'hsd');return p.stages;
  },
  'four-wheel-transfer':(parts)=>{
    const p=planner(parts);
    p.stage('打开中央差速器剖分外壳','外环按已有剖视结构分成上下半环，各自向外移开；不让整周壳径向穿过内部锥齿。',p.move(['tr-diff-shell-upper'],Y),p.move(['tr-diff-shell-lower'],NY));
    p.out('分离中央差速器总成','前后输出轴、小锥齿轮、锁套与芯架保持为完整模块，沿正轴向脱离高低挡行星排。',['tr-diff','tr-front','tr-rear','tr-spider','tr-lock'],Z,X);
    p.out('取下高低挡锁合套','输入端锁合套沿负轴向滑出，解除高低挡约束。',['tr-range'],NZ,NY);
    p.out('取出行星级太阳轮','输入侧已经打开，太阳轮向负轴向离开行星架；差速器内部锥齿不在此强行散件。',['tr-sun'],NZ,NX);
    planetsOut(p,'tr',Y);return p.stages;
  },
  'tractor-pto':(parts)=>{
    const p=planner(parts);
    p.out('断开作业机具','先从 PTO 花键端取下机具转子，再拆传动分支。',['pto-implement'],Z,Y);
    p.out('分离 PTO 输出分支','输出轴、两只从动轮和选挡套保持为总成，向输入轴外侧移动，解除两对 PTO 齿轮啮合。',['pto-shaft','pto-selector',/^pto-out-/],X);
    p.out('分离车桥与车轮','左右车轮与车轴末级齿轮保持刚性组，向远离中间轴的一侧解除末级外啮合。',['drive-axle','drive-wheels'],NX,NY);
    p.out('分离行驶中间轴总成','车桥已让出空间，中间轴、两只从动轮与行驶选挡套共同横向移出。',['drive-counter','drive-selector',/^drive-out-/],NX,Y);
    p.stage('露出独立 PTO 输入离合器','输出分支已分开；PTO 离合片组向发动机后方退出。发动机、空心输入轴与各主动轮保留为双支路输入基准。',p.move(['pto-clutch'],NZ));
    return p.stages;
  },
  'cnc-feed':(parts)=>{
    const p=planner(parts);
    p.out('取下刀具主轴','床身与固定立柱留作基准，先向正 Z 取下刀具主轴，为工作台上方留出空间。',['cnc-tool'],Z,X);
    p.out('取下 Z 轴滑枕','螺母和滑枕作为一个部件，沿 Z 导向滑出丝杠上端。',['cnc-znut'],Z,NY);
    p.out('抽出 Z 丝杠','滑枕已经取下，再从上方抽出竖直丝杠。',['cnc-zscrew'],Z,Y);
    p.out('取下 C 轴转台','刀具和横臂已让开，转台与偏心工件一起垂直离开 Y 滑台。',['cnc-rotary'],Z,X);
    p.out('抽出 Y 丝杠','先向负 Y 抽出丝杠，避免把 Y 滑台一直推向后方立柱来脱离丝杠。',['cnc-yscrew'],NY);
    p.out('提起 Y 滑台','Y 丝杠已退出螺母孔，Y 螺母和滑台可整体向上取下。',['cnc-ynut'],Z,X);
    p.out('抽出 X 丝杠','上方 Y 轴已经移走，X 丝杠沿自身负 X 轴向退出螺母。',['cnc-xscrew'],NX);
    p.out('提起 X 鞍座','X 丝杠已移出，X 螺母、连接座和鞍座整体向上离开床身导轨。',['cnc-xnut'],Z,NY);
    return p.stages;
  },
  'robot-wrist':(parts,params={})=>{
    const p=planner(parts),a=(params.axis4??20)*Math.PI/180,b=(params.axis5??20)*Math.PI/180;
    const toolAxis=[Math.cos(a)*Math.sin(b),Math.sin(a)*Math.sin(b),Math.cos(b)],hingeAxis=[-Math.sin(a),Math.cos(a),0];
    p.out('移开剖开前臂壳','固定前臂本身是下半剖壳，沿开口反方向移开；外套轴保留为腕部基准。',['wr-case'],NY);
    p.out('取下末端法兰与工具','沿停车姿态下的工具局部轴线取出，不沿固定世界 Z 硬拉偏转后的法兰。',['wr-flange'],toolAxis,hingeAxis);
    p.out('取出工具转向组件','法兰已拆下，转向锥齿与连接轴沿同一工具轴线取出。',['wr-transfer'],toolAxis,negate(hingeAxis));
    p.out('抽出最内传动轴','前端连接已解除，内轴向前臂后方从两层套轴孔内退出。',['wr-inner'],NZ,NX);
    p.stage('抽出两侧俯仰支承销','两段支承销沿当前局部俯仰轴向两侧退出，先解除叉架约束。',p.move(['wr-bend-journal-positive'],hingeAxis),p.move(['wr-bend-journal-negative'],negate(hingeAxis)));
    p.out('移开俯仰铰架','支承销和工具轴均已取下，铰架向前离开外叉；锥齿为转向示意，不逐齿剥离。',['wr-bend'],toolAxis,hingeAxis);
    p.out('抽出中套轴','前端铰架已腾空，中套轴与其前端锥齿向正 Z 取出；不把大锥齿向后穿过外套轴。',['wr-middle'],Z,X);
    return p.stages;
  },
  'clock-escapement':(parts)=>{
    const p=planner(parts);
    p.out('取下游丝示意组件','机芯板固定，先从最高层取下游丝示意件；此处不是给发条放能的真实维修操作。',['clk-spring'],Z,Y);
    p.out('取下摆轮','游丝层已打开，摆轮与相位标记沿轮轴正向取出。',['clk-balance'],Z,X);
    p.out('取下擒纵叉','先使圆销离开擒纵轮接触平面，再移动擒纵轮，避免横向穿过锁止齿。',['clk-fork'],Z,NY);
    p.out('取下擒纵轮复合轴','叉瓦已离开，擒纵轮和同轴小齿轮作为一个部件轴向取出。',['clk-escape'],Z,Y);
    p.out('取下过轮复合轴','上游按层次拆开；复合轮保持两齿片同轴关系。',['clk-third'],Z,NY);
    p.out('取下中心复合轴','过轮已经移走，再取下中心轮轴。',['clk-center'],Z,Y);
    p.out('取下发条盒总成','最后取下低层发条盒与大齿轮；盒内发条不作强制散开。',['clk-barrel'],Z,NX);
    return p.stages;
  },
  'dual-rotor-gearbox':(parts)=>{
    const p=planner(parts);
    p.out('取下上层旋翼','先拆最高层旋翼，沿同轴主轴正向离开内轴端。',['heli-rotor-high'],Z,Y);
    p.out('取下下层旋翼','上层旋翼已停放到侧方，下层轮毂沿内轴外侧滑出。',['heli-rotor-low'],Z,NY);
    p.out('移开下方安装板','安装板向侧方移开，为下方的大齿轮和内轴抽出留通道；上方支承环留作基准。',['heli-bearing-base'],NY);
    p.out('分离复合惰轮轴','向正 Y 同时增大与发动机小轮、同轴大轮的中心距，先解除两个平面的齿轮啮合。',['heli-idler'],Y);
    p.out('移开发动机输入总成','惰轮已离开，输入轴、两小轮与电机示意体共同向负 X 移出。',['heli-input'],NX);
    p.out('向下抽出上旋翼内轴','上支路大齿轮位于外套轴下端，必须从负 Z 退出，不能把大轮穿过套轴孔。',['heli-upper'],NZ,X);
    p.out('向下抽出下旋翼空心轴','内轴已取出，空心轴与下支路大轮向下退出上方支承环。',['heli-lower'],NZ,NX);
    return p.stages;
  },
  'wind-turbine-gearbox':(parts)=>{
    const p=planner(parts);
    p.out('移开发电机定子','先沿高速轴正向取下环形定子，为转子退出留出通道。',['wind-stator'],Z,Y);
    p.out('取出高速轴与发电机转子','最外侧高速小轮沿轴向脱离中间轴大轮，转子与轴保持整体。',['wind-generator'],Z,X);
    p.out('取出中间复合齿轮轴','高速轴已移开，双齿片中间轴向正轴向退出第二级啮合。',['wind-stage3'],Z,NY);
    p.out('取下太阳轮后端大轮轴段','后端增速级已经移走，连接太阳轮的后端轴段向正轴向取出。',['wind-stage2'],Z,Y);
    p.out('取下低速叶轮输入总成','从输入侧退出叶轮、空心轴和连接销；不把叶轮穿过行星排。',['wind-rotor'],NZ,NX);
    p.out('抽出行星级太阳轮','低速输入已移开，太阳轮向负轴向从行星架背面抽出。',['wind-sun'],NZ,NY);
    planetsOut(p,'wind');return p.stages;
  }
};

function piece(original,id,name,shapes){return {...original,id,name,description:original.description+'（教学拆解分件）',poseSource:original.poseSource||original.id,shapes};}
function halfRing(s,upper){
  const start=upper?0:Math.PI,points=[];
  for(let i=0;i<=64;i++){const a=start+Math.PI*i/64;points.push([s.outer*Math.cos(a),s.outer*Math.sin(a)]);}
  for(let i=64;i>=0;i--){const a=start+Math.PI*i/64;points.push([s.inner*Math.cos(a),s.inner*Math.sin(a)]);}
  return {...s,kind:'polygon',points,depth:s.length};
}
// Split only existing blocking housings/journals. All children keep the source pose.
export function splitSystemParts(model,parts){
  if(!systemPlans[model?.id])return parts;
  return parts.flatMap(p=>{
    if((model.id==='planetary-automatic'&&p.id==='at-case')||(model.id==='torque-converter'&&p.id==='tc-case')){
      const shell=p.shapes.find(s=>s.kind==='ring'&&s.length>20),caps=p.shapes.filter(s=>s!==shell);
      if(!shell||caps.length!==2)return [p];
      const [rear,front]=[...caps].sort((a,b)=>(a.position?.[2]||0)-(b.position?.[2]||0));
      return [piece(p,p.id+'-shell','剖开支承壳筒',[shell]),piece(p,p.id+'-rear-cap','输入侧端盖与支承',[rear]),piece(p,p.id+'-front-cap','输出侧端盖与支承',[front])];
    }
    if(model.id==='four-wheel-transfer'&&p.id==='tr-diff'){
      const outer=p.shapes.find(s=>s.kind==='ring'&&s.outer===35&&s.inner===28);
      if(!outer)return [p];
      return [piece(p,p.id,'中央差速器芯架',p.shapes.filter(s=>s!==outer)),piece(p,'tr-diff-shell-upper','中央差速器上半剖壳',[halfRing(outer,true)]),piece(p,'tr-diff-shell-lower','中央差速器下半剖壳',[halfRing(outer,false)])];
    }
    if(model.id==='robot-wrist'&&p.id==='wr-bend'){
      const journals=p.shapes.filter(s=>s.kind==='rod'&&[8,27].every(y=>[Math.abs(s.from?.[1]),Math.abs(s.to?.[1])].includes(y)));
      if(journals.length!==2)return [p];
      return [piece(p,p.id,'俯仰铰架与锥齿轮',p.shapes.filter(s=>!journals.includes(s))),...journals.map(s=>piece(p,'wr-bend-journal-'+(s.from[1]>0?'positive':'negative'),'俯仰侧支承销',[s]))];
    }
    if(model.id==='dual-rotor-gearbox'&&p.id==='heli-bearing'){
      const base=p.shapes.filter(s=>s.kind==='box'),bearing=p.shapes.filter(s=>s.kind!=='box');
      if(!base.length||!bearing.length)return [p];
      return [piece(p,p.id,'同轴支承环',bearing),piece(p,p.id+'-base','下方安装板',base)];
    }
    return [p];
  });
}
