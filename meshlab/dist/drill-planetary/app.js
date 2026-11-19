import '../lab-shell.js';
import { connectExplosion } from '../explosion-controls.js';
import { defaults,modes,transmission,powerPath,initialAngles,advanceAngles,animationScale } from './kinematics.js';
import { createDrillScene } from './scene.js';
const $=id=>document.getElementById(id),format=n=>String(Number(n.toFixed(1)));
let motorRpm=defaults.motorRpm,mode='low',speeds=transmission(),angles=initialAngles(),playing=false,multiplier=1,lastTime=null,scene=null,pathIndex=-1,currentView='3d';
const views=[['view-3d','3d'],['view-front','front'],['top-view','top'],['front-view','axial']];
function updateViewName(){ $('view-name').textContent=currentView==='axial'?'二级行星轮组 · 沿轴观察':`两级行星传动 · ${{cutaway:'教学剖视',full:'完整齿圈',hidden:'内部啮合'}[$('ring-display').value]}`; }
function applyView(view='3d'){currentView=view;scene?.setView(view);for(const [id,name] of views)$(id).setAttribute('aria-pressed',String(view===name));updateViewName();}
const descriptions={
  motor:['电机外壳','固定外壳包围电机，输入轴驱动一级太阳轮。模型省略电磁过程，仅设置输入转速。'],
  sun1:['一级太阳轮 / 输入轴','电机轴与一级太阳轮相连。太阳轮带动三颗行星轮，固定齿圈提供约束。'],
  planet1:['一级行星轮','与太阳轮和内齿圈同时啮合。一边绕自身轴自转，一边随行星架公转。'],
  ring1:['一级固定齿圈','始终与机壳锁止，转速为零。一级减速比为 1 + 54 / 18 = 4。剖切仅用于看清内部，完整齿圈仍参与计算。'],
  carrier1:['一级行星架','承载三颗一级行星轮，并与二级太阳轮刚性相连。默认转速 1500 r/min。'],
  sun2:['二级太阳轮','由一级行星架驱动。低挡通过行星轮继续减速，高挡与二级齿圈、行星架等速转动。'],
  planet2:['二级行星轮','低挡有相对行星架的自转；高挡全级锁为等速整体，行星轮仅随行星架公转。齿面上的深色标记有助于观察相对运动。'],
  ring2:['二级可移齿圈','拨叉带动它沿轴向移动：低挡接左侧机壳锁止环，高挡接右侧行星架联接盘。移动时始终保留与行星轮的齿宽重叠。'],
  carrier2:['二级行星架 / 联接盘','带动输出轴和夹头。右侧牙嵌联接盘随它转动，高挡时与二级齿圈联接。'],
  selector:['换挡拨叉','沿上方导轨移动，将二级齿圈推向两个联接位置。拨叉只移动，不随齿圈旋转。'],
  housing:['机壳锁止环','固定在机壳上的反力支承。低挡时与二级齿圈的左端牙嵌联接，阻止齿圈旋转。'],
  output:['输出轴 / 夹头','与二级行星架相连。默认低挡 375 r/min，高挡 1500 r/min；模型不模拟钻削负载。'],
};
function selectPart(id,expand=true){
  if(!descriptions[id])return;
  if(expand){pathIndex=-1;document.querySelectorAll('[data-path]').forEach(b=>b.removeAttribute('aria-current'));$('trace-next').textContent='追踪动力 →';$('path-explanation').textContent='点击任一节点，高亮对应部件；“追踪动力”逐段前进。';}
  $('part-title').textContent=descriptions[id][0];$('part-description').textContent=descriptions[id][1];document.querySelector('.drill-part-note').open=expand;
  scene?.selectPart(id);document.querySelectorAll('[data-drill-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.drillPart===id)));window.meshlabShell.open('observe');
}
function setPlaying(value){
  if(value && scene?.explosion?.active)scene.explosion.setTarget(0);
  playing=value;lastTime=null;$('play').textContent=value?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-pressed',String(value));$('play').setAttribute('aria-label',value?'暂停演示':'播放演示');
  $('status-message').textContent=`${modes[mode]} · ${value?'播放中':'已暂停'} · 动画 1/240 慢放 × ${multiplier} · 步进为输入轴前进 30°`;
}
function trace(index){
  pathIndex=index;const node=powerPath(motorRpm,mode)[index];
  document.querySelectorAll('[data-path]').forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  $('path-explanation').textContent=`${index+1} / 5 · ${node.note}`;$('trace-next').textContent=index===4?'从输入重新追踪 ↻':'下一段动力 →';selectPart(node.part,false);
  if(mode==='high'&&index===3)scene?.selectPart(['sun2','planet2','ring2','carrier2']);
}
function update(){
  speeds=transmission(motorRpm,mode);$('drill-rpm').value=motorRpm;$('drill-rpm-value').value=`${motorRpm} r/min`;
  for(const [id,value] of [['motor-speed',motorRpm],['total-ratio',speeds.ratio],['output-speed',speeds.output],['low-speed',speeds.lowOutput],['high-speed',speeds.highOutput]])$(id).value=format(value);
  $('ring-state').textContent=mode==='low'?'固定机壳':'联接行星架';
  $('shift-title').textContent=mode==='low'?'二级齿圈锁止在机壳上':'二级齿圈与行星架联接';
  $('shift-description').textContent=mode==='low'?'二级行星轮沿固定齿圈滚动，再减速 4 : 1，由行星架带动夹头。':'二级太阳轮、齿圈与行星架等速旋转；行星轮相对行星架不自转，按 1 : 1 传动。';
  $('speed-equation').textContent=`${motorRpm} ÷ 4 ÷ ${speeds.stage2Ratio} = ${format(speeds.output)} r/min`;
  $('operating-output').value=`${modes[mode]} · ${format(speeds.output)} r/min`;
  for(const key of ['sun','ring','carrier','planet'])$(`audit-${key}`).textContent=format(speeds[`${key}2`]);
  document.querySelectorAll('[data-gear]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gear===mode)));
  document.querySelectorAll('[data-compare]').forEach(b=>b.dataset.active=String(b.dataset.compare===mode));
  const paths=powerPath(motorRpm,mode);$('power-path').replaceChildren(...paths.map((node,index)=>{
    const b=document.createElement('button');b.type='button';b.dataset.path=index;b.innerHTML=`${index+1}. ${node.title}<span>${format(node.speed)} r/min</span>`;if(index===pathIndex)b.setAttribute('aria-current','step');b.addEventListener('click',()=>trace(index));return b;
  }));
  if(pathIndex>=0)$('path-explanation').textContent=`${pathIndex+1} / 5 · ${paths[pathIndex].note}`;
  scene?.setMode(mode);scene?.setSpeeds(speeds);scene?.setPose(angles);setPlaying(playing);window.dispatchEvent(new CustomEvent('meshlab:statechange'));
}
try{scene=createDrillScene($('viewport'),id=>selectPart(id));$('viewer-status').hidden=true;}
catch(error){console.error('两挡行星减速器三维初始化失败',error);$('viewer-status').textContent='三维模型未能加载。请启用浏览器硬件加速后刷新；下方挡位与转速计算仍可操作。';}
document.querySelectorAll('[data-gear]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.gear===mode)return;mode=b.dataset.gear;setPlaying(false);angles=initialAngles();pathIndex=-1;
  $('path-explanation').textContent='点击任一节点，高亮对应部件；“追踪动力”逐段前进。';$('trace-next').textContent='追踪动力 →';
  $('shift-note').textContent=`已停机切换至${modes[mode]}并对齿。点击播放，追踪动力与输出。`;update();selectPart('ring2',false);
}));
$('drill-rpm').addEventListener('input',()=>{motorRpm=Number($('drill-rpm').value);update();});
$('play').addEventListener('click',()=>setPlaying(!playing));
$('step').addEventListener('click',()=>{setPlaying(false);if(scene?.isShifting())return;angles=advanceAngles(angles,speeds,30/(motorRpm*6));scene?.setPose(angles);});
$('trace-next').addEventListener('click',()=>trace((pathIndex+1)%5));
$('inspect-shift').addEventListener('click',()=>{$('ring-display').value='cutaway';$('ring-display').dispatchEvent(new Event('change'));applyView('detail');selectPart('ring2');});
$('ring-display').addEventListener('change',()=>{scene?.setDisplay($('ring-display').value);updateViewName();});
$('show-labels').addEventListener('change',()=>scene?.setLabels($('show-labels').checked));
for(const [id,view] of views)$(id).addEventListener('click',()=>applyView(view));
document.querySelectorAll('[data-drill-part]').forEach(b=>b.addEventListener('click',()=>selectPart(b.dataset.drillPart)));
$('reset').addEventListener('click',()=>{
  motorRpm=defaults.motorRpm;mode='low';angles=initialAngles();playing=false;multiplier=1;pathIndex=-1;
  $('lab-demo-speed').value='1';$('ring-display').value='cutaway';$('ring-display').dispatchEvent(new Event('change'));$('show-labels').checked=true;
  $('drill-rpm-number').removeAttribute('aria-invalid');$('drill-rpm-error').textContent='';
  $('part-title').textContent='两挡行星减速器';$('part-description').textContent='从电机出发，沿两级太阳轮、行星轮和行星架追踪动力。';document.querySelector('.drill-part-note').open=false;
  $('shift-note').textContent='换挡自动暂停并对齿；点击播放，观察各级运动。';$('path-explanation').textContent='点击任一节点，高亮对应部件；“追踪动力”逐段前进。';$('trace-next').textContent='追踪动力 →';
  scene?.selectPart(null);scene?.setLabels(true);applyView();document.querySelectorAll('[data-drill-part]').forEach(b=>b.setAttribute('aria-pressed','false'));update();$('lab-preset').value='default';
});
document.addEventListener('meshlab:preset',e=>{if(e.detail.values){motorRpm=e.detail.values.motorRpm;update();}});
document.addEventListener('meshlab:demo-speed',e=>{multiplier=e.detail;setPlaying(playing);});
document.addEventListener('visibilitychange',()=>lastTime=null);
update();
connectExplosion(scene, () => setPlaying(false));

function frame(time){
  const dt=lastTime===null ? .016 : Math.max(0,Math.min((time-lastTime)/1000,.05));
  $('step').disabled=Boolean(scene?.isShifting());
  if(!document.hidden){if(playing&&!scene?.explosion?.active&&!scene?.isShifting())angles=advanceAngles(angles,speeds,dt*animationScale*multiplier);scene?.setPose(angles);scene?.render(dt);}
  lastTime=time;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
