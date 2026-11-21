// Mechanism-specific extraction plans. Coordinates are model/world mm at phase=0.
// A move retains every selected part's relative pose. The viewer interpolates stages.
const X=[1,0,0],NX=[-1,0,0],Y=[0,1,0],NY=[0,-1,0],Z=[0,0,1],NZ=[0,0,-1];
const ids=(parts,match)=>parts.filter(typeof match==='function'?match:p=>match.includes(p.id)).map(p=>p.id);
const group=(parts,name)=>ids(parts,p=>p.assemblyGroup===name);
const move=(parts,list,axis,distance)=>({ids:ids(parts,list),axis:[...axis],...(distance!==undefined?{distance}:{})});
const step=(title,description,...moves)=>({title,description,moves:moves.filter(m=>m.ids.length)});
const clean=stages=>stages.filter(s=>s.moves.length);
function partition(parts,id,newGroups,remainingName){
 const original=parts.find(p=>p.id===id);if(!original)return parts;
 const used=new Set(newGroups.flatMap(g=>g.indices));
 const remain=original.shapes.filter((_,i)=>!used.has(i));if(!remain.length)throw Error('Split must retain original part '+id);
 return parts.flatMap(p=>p!==original?[p]:[{...p,name:remainingName||p.name,shapes:remain},...newGroups.map(g=>({...p,id:g.id,name:g.name,description:g.description||g.name,poseSource:p.poseSource||p.id,assemblyGroup:undefined,hiddenInList:false,shapes:g.indices.map(i=>p.shapes[i]).filter(Boolean)}))]);
}
/** Split existing shape descriptors only; original mesh positions/rotations are preserved. */
export function splitMachineParts(model,parts){
 let out=parts;
 switch(model.id){
 case 'valvetrain':
  for(const [prefix,name]of [['intake','进气'],['exhaust','排气']])out=partition(out,prefix+'-valve',[{id:prefix+'-tappet',name:name+'平底挺柱',indices:[0],description:'平底挺柱可在凸轮卸下后向上取出；阀杆与气门头保留为一件'}],name+'门与阀杆');
  break;
 case 'manual-gearbox':
  out=partition(out,'output',[{id:'output-index',name:'输出轴端标记',indices:[1],description:'模型的凸起观察标记先移开，不作为真实换档锁止件'}]);break;
 case 'cvt':
  for(const [id,name]of [['primary','主动'],['secondary','从动']])out=partition(out,id,[{id:id+'-front-sheave',name:name+'前锥盘',indices:[0,4],description:'先沿轴向抽出前锥盘，给闭合钢带留下正向取出口'}],name+'后锥盘与轴');
  break;
 case 'rzeppa-joint':
  out=partition(out,'outer-race',Array.from({length:6},(_,k)=>({id:'outer-track-'+k,name:'外观察球道 '+(k+1),indices:[8+2*k,9+2*k],description:'可分离的教学观察轨架；真实整体球笼不按此形式制造拆卸'})),'外球笼后支承与输入轴');break;
 case 'enveloping-worm':
  out=partition(out,'bearings',[
   {id:'wheel-front-bearing',name:'蜗轮前支承环',indices:[1]},
   {id:'worm-left-bearing',name:'蜗杆左支承环',indices:[2]},
   {id:'worm-right-bearing',name:'蜗杆右支承环',indices:[3]}
  ],'蜗轮后支承环');break;
 }
 return out;
}
function planetaryStages(parts,{shell=false}={}){
 const stages=[];
 if(shell){
  stages.push(step('抽出花鼓壳','先沿输出轴方向取下花鼓壳，内齿圈和轮架留在轴线上。',move(parts,['hub-shell'],Z,170)));
  stages.push(step('停放外壳','将已脱离轮系的外壳横向停放，让出后续轴向通道。',move(parts,['hub-shell'],X,230)));
  stages.push(step('退下选档与输入套','从后端沿中心轴退出选档标识件和空心输入套。',move(parts,['selector','driver'],NZ,120)));
  stages.push(step('停放后端组件','后端组件已越过轴端，横移后保持为同一展示组。',move(parts,['selector','driver'],NX,180)));
 }
 stages.push(step('取下行星架','行星架先沿销轴方向前移，解除对三颗行星轮的轴向约束。',move(parts,['carrier'],Z,100)));
 stages.push(step('让出轮架通道','已抽出的行星架向上停放，中心轴前方保持畅通。',move(parts,['carrier'],Y,160)));
 stages.push(step('轴向抽出内齿圈','沿平行齿线退出内齿圈，先解除与行星轮的内啮合。',move(parts,['ring'],Z,105)));
 stages.push(step('停放内齿圈','齿圈完全离开啮合平面后再向下停放。',move(parts,['ring'],NY,170)));
 stages.push(step('退出三颗行星轮','三颗行星轮沿各自平行销轴向后抽出，保持相互间距。',move(parts,ids(parts,p=>/^planet-\d+$/.test(p.id)),NZ,95)));
 stages.push(step('停放行星轮组','三颗行星轮均已退出销轴，整体侧移，为太阳轮轴组留下后端通道。',move(parts,ids(parts,p=>/^planet-\d+$/.test(p.id)),X,230)));
 stages.push(step('取出太阳轮轴组','从后端取出太阳轮与中心轴；观察支承环保持原位。',move(parts,['sun','sun-shaft'],NZ,240)));
 return stages;
}
export const machinePlans={
 'valvetrain':(parts,p)=>clean([
  step('退出正时凸轮轴','正时齿轮在后端，向后抽出齿轮与凸轮轴，细轴穿过两只凸轮的轴孔。',move(parts,['cam-drive'],NZ,180)),
  step('停放凸轮轴','轴已完全退出凸轮孔，横移停放，不让后续凸轮撞到已拆轴组。',move(parts,['cam-drive'],X,230)),
  step('拆下两只凸轮','两只凸轮分别从前后端沿Z轴抽出，离开平底挺柱。',move(parts,['intake-cam'],NZ,140),move(parts,['exhaust-cam'],Z,140)),
  step('停放凸轮','前后凸轮已越过挺柱与轴座，分别横移停放。',move(parts,['intake-cam'],NX,220),move(parts,['exhaust-cam'],X,220)),
  step('提起平底挺柱','凸轮让开后，平底挺柱沿气门导向向上取出，露出弹簧和阀杆顶端。',move(parts,['intake-tappet','exhaust-tappet'],Y,130)),
  step('取下回位弹簧','已移除挺柱，弹簧可从阀杆上端沿导向退出。',move(parts,['intake-spring','exhaust-spring'],Y,80)),
  step('向下抽出气门','带大气门头的阀杆向下退出实际导向孔；导向座留作装配参照。',move(parts,['intake-valve','exhaust-valve'],NY,90)),
  step('取出曲轴正时组件','将曲轴与主动正时齿轮从后端移开，保留导向座的位置。',move(parts,['crank'],NZ,180))
 ]),
 'planetary':parts=>clean(planetaryStages(parts)),
 'three-speed-hub':parts=>clean(planetaryStages(parts,{shell:true})),
 'manual-gearbox':(parts,p)=>{
  const stages=[step('退出拨叉与观察标记','拨叉向上退出齿套外圆；轴端凸起观察标记先移开。',move(parts,['fork','output-index'],Y,140)),
   step('抽出两根平行轴','沿正Z方向抽出输入轴和输出轴，所有齿轮副暂时保留原啮合位置。',move(parts,['input','output'],Z,200)),
   step('停放轴组','双轴已完全退出齿轮孔，向下停放，给轮组留出前端取出口。',move(parts,['input','output'],NY,170))];
  if(p.selectedGear==='N')stages.push(step('取下空档齿套','空档齿套位于最前端，沿轴向退出。',move(parts,['dog'],Z,260)));
  for(let k=3;k>=0;k--){
   if(p.selectedGear===String(k+1))stages.push(step('退出'+(k+1)+'档齿套','前方齿轮已移开，选档齿套现在可沿正Z方向退出。',move(parts,['dog'],Z,260)));
   if(k===0)continue;
   const pair=['input-'+k,'loose-'+k];
   stages.push(step('轴向取出'+(k+1)+'档齿轮副','按前端到后端顺序取出整对常啮合齿轮，不让大齿轮横穿其他档位。',move(parts,pair,Z,220)));
   stages.push(step('停放'+(k+1)+'档齿轮副','轮副已经越过轴系，向上停放；保持两只配对齿轮的装配关系。',move(parts,pair,Y,180)));
  }
  return clean(stages);
 },
 'synchronizer':parts=>clean([
  step('取下换档拨叉','从齿套上方提出开口拨叉，解除外部轴向操纵约束。',move(parts,['fork'],Y,100)),
  step('退出滑动齿套','沿输出端正Z方向把齿套从花键毂上抽出。',move(parts,['sleeve'],Z,130)),
  step('停放齿套','已退出花键的齿套横移，让出输出端观察通道。',move(parts,['sleeve'],Y,140)),
  step('退出空套齿轮与摩擦锥','向输入侧后退，摩擦锥先与锁环脱开，空套齿轮从轴的后端取出。',move(parts,['free-gear'],NZ,125)),
  step('停放空套齿轮','已退出轴端的齿轮横移，给锁环留下同轴取出口。',move(parts,['free-gear'],NX,130)),
  step('向后取下同步锁环','摩擦锥已移走，锁环从后端退出，不穿过前方花键毂。',move(parts,['blocker'],NZ,120)),
  step('停放同步锁环','锁环离轴后侧移，与空套齿轮分别展示。',move(parts,['blocker'],X,100)),
  step('取下花键毂','从后端退出花键毂，输出轴保持原位作为装配参照。',move(parts,['hub'],NZ,90))
 ]),
 'cvt':parts=>clean([
  step('拆开两只前锥盘','两前锥盘沿轴向前移，先解除钢带两侧的夹持；后锥盘与轴保持原位。',move(parts,['primary-front-sheave','secondary-front-sheave'],Z,110)),
  step('停放前锥盘','锥盘已经越过轴端，向下停放，让出钢带的轴向取出口。',move(parts,['primary-front-sheave','secondary-front-sheave'],NY,175)),
  step('完整取下钢带','钢片及两条承载环带保持闭合总成，沿开放的正Z方向从后锥盘取下。',move(parts,group(parts,'pushbelt'),Z,100)),
  step('停放闭合钢带','保持钢带整体形状向上停放，不把钢片拆成无约束粒子。',move(parts,group(parts,'pushbelt'),Y,160)),
  step('取出从动后锥盘轴组','钢带已解除包络，从动后锥盘与轴沿轴向退出；主动后锥盘留作参照。',move(parts,['secondary'],Z,110))
 ]),
 'rzeppa-joint':(parts,p)=>{
  const tracks=ids(parts,x=>/^outer-track-\d+$/.test(x.id)),balls=ids(parts,x=>/^ball-\d+$/.test(x.id)),a=p.angle*Math.PI/180;
  return clean([
   step('径向退开观察轨架','先把六条可拆教学观察球道向外退开，解除对钢球的包络。真实整体球笼不按轨架分块制造。',...tracks.map(id=>{const k=Number(id.split('-').at(-1)),t=k*Math.PI/3;return move(parts,[id],[Math.cos(t),Math.sin(t),0],75);})),
   step('停放观察轨架','轨架已经离开球心周围，整体移到后方，保持钢球径向与输出半轴前方的取出通道畅通。',move(parts,tracks,NZ,170)),
   step('逐球径向退出','钢球通过保持架观察窗向外退出；每颗球沿自身球心径向移动。',...balls.map(id=>{const k=Number(id.split('-').at(-1)),t=k*Math.PI/3,tt=Math.tan(a/2),r=32/Math.sqrt(1+tt*tt*Math.cos(t)**2);return move(parts,[id],[r*Math.cos(t)/32,r*Math.sin(t)/32,-tt*r*Math.cos(t)/32],55);})),
   step('退出保持架','钢球已移开，双环保持架沿两轴角平分线退出。',move(parts,['cage'],[Math.sin(a/2),0,Math.cos(a/2)],110)),
   step('停放保持架','保持架离开星形套后向下停放，让出输出半轴取出口。',move(parts,['cage'],NY,150)),
   step('沿半轴方向抽出星形套','沿实际倾斜输出轴方向取出星形套及半轴，外球笼后支承留在原位。',move(parts,['inner-race'],[Math.sin(a),0,Math.cos(a)],110))
  ]);
 },
 'conjugate-cam':parts=>clean([
  step('抽出共用凸轮轴','轴向标记位于前端，沿正Z方向退出共用凸轮轴；从动框和两凸轮暂时保持位置。',move(parts,['shaft'],Z,110)),
  step('停放凸轮轴','轴已离开两只凸轮的孔，向下停放。',move(parts,['shaft'],NY,140)),
  step('分别退出共轭凸轮','前后两片凸轮分别从各自轴向退出，平底面沿接触切线滑离从动框。',move(parts,['upper-cam'],NZ,100),move(parts,['lower-cam'],Z,100))
 ]),
 'indexing-cam':parts=>clean([
  step('拔出停歇定位销','先沿定位孔轴线拔销，解除转台锁位。',move(parts,['lock-pin'],Z,80)),
  step('停放定位销','定位销已离开转台孔，横移停放，不挡住转台前端。',move(parts,['lock-pin'],Y,100)),
  step('提取分度转台','转台沿自身轴线向前取出，离开滚子销的上端。',move(parts,['turret'],Z,100)),
  step('停放转台','已离开滚子销的转台向右停放，露出全部滚子。',move(parts,['turret'],X,130)),
  step('退出分度滚子组','各滚子沿平行销轴向后取出，盘形凸轮留作运动参照。',move(parts,group(parts,'index-rollers'),NZ,80))
 ]),
 'cycloidal':parts=>clean([
  step('抽出输出销轴法兰','先沿正Z方向把输出销从摆线盘的大孔退出。',move(parts,['output'],Z,100)),
  step('停放输出法兰','输出销全部离孔后横移停放，留出摆线盘前端通道。',move(parts,['output'],Y,160)),
  step('轴向取出摆线盘','摆线盘沿偏心轴颈轴向退出，同时离开固定针齿啮合平面。',move(parts,['disc'],Z,100)),
  step('停放摆线盘','摆线盘完全脱离轴颈和针齿后向下停放。',move(parts,['disc'],NY,160)),
  step('从后端退出偏心轴','偏心输入轴向后取出，固定针齿壳保持原位。',move(parts,['eccentric'],NZ,110))
 ]),
 'harmonic':parts=>clean([
  step('拆下柔轮输出端','先沿输出方向移开前端输出环与轴，露出柔轮。',move(parts,['output'],Z,90)),
  step('停放输出端','输出端已离开波发生器轴线，向上停放。',move(parts,['output'],Y,150)),
  step('抽出波发生器','从输入端沿负Z方向取出椭圆波发生器与输入轴。柔轮暂时保留当前教学变形。',move(parts,['wave'],NZ,90)),
  step('停放波发生器','已抽出的波发生器向下停放。',move(parts,['wave'],NY,150)),
  step('完整取出柔轮总成','薄壁环和所有柔轮齿保持同一总成，沿齿线前移脱开刚轮；固定刚轮留作参照。',move(parts,group(parts,'flexspline'),Z,90))
 ]),
 'enveloping-worm':(parts,p)=>{
  const R=p.wheelTeeth*p.module/2,stages=[
   step('退出四处轴端支承','蜗轮前后支承沿各自Z轴端退出，蜗杆左右支承分别沿X轴退出；不横向掠过实心轴。',move(parts,['wheel-front-bearing'],Z,80),move(parts,['bearings'],NZ,80),move(parts,['worm-left-bearing'],NX,80),move(parts,['worm-right-bearing'],X,80)),
   step('停放蜗轮支承','两只支承环均已越过蜗轮轴端，横移后让出轮轴通道。',move(parts,['wheel-front-bearing','bearings'],NX,R+80))
  ];
  if(p.wormType==='enveloping')stages.push(step('整体取出包络匹配副','包络齿面相互包覆，蜗杆和蜗轮保持匹配装配状态整体取出；本模型不强制平移拆开这对齿面。黄色概念高亮随配对总成移动。',move(parts,['worm','wheel','contact-guide'],Y,R+80)));
  else stages.push(
   step('解除圆柱蜗杆啮合','四处支承已移走，圆柱蜗杆沿中心距增大的方向抬起，离开蜗轮。',move(parts,['worm'],Y,R+80)),
   step('沿轮轴取出蜗轮','啮合和两端支承均已解除，蜗轮及轴沿正Z方向取出；黄色概念高亮随蜗轮移动。',move(parts,['wheel','contact-guide'],Z,100))
  );
  return clean(stages);
 }
};
export const machineReferences={
 'valvetrain':['head'],'planetary':['support'],'three-speed-hub':['support'],
 'manual-gearbox':['input-0','loose-0'],'synchronizer':['shaft'],'cvt':['primary'],
 'rzeppa-joint':['outer-race'],'conjugate-cam':['follower'],'indexing-cam':['cam'],
 'cycloidal':['pins'],'harmonic':['circular'],'enveloping-worm':[]
};
