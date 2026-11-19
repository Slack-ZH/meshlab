import '../lab-shell.js';
import { connectExplosion } from '../explosion-controls.js';
import {defaults,wormResults,poseAt,cycleProgress,animationScale,TAU} from './kinematics.js';
import {createWormScene} from './scene.js';
const $=id=>document.getElementById(id),fmt=n=>String(Number(n.toFixed(2)));
let params={...defaults},angle=0,playing=false,multiplier=1,lastTime=null,lastReadout=-Infinity,cycle=null,scene=null,selected=null;
const views=[['view-3d','3d'],['view-front','front'],['top-view','top']];
const descriptions={worm:['蜗杆 / 输入轴','右旋螺旋齿随输入轴旋转，推动蜗轮齿面。头数表示独立螺旋线的条数。'],wheel:['蜗轮','蜗杆每转一圈，蜗轮推进与蜗杆头数相同的齿数。深色径向标记便于比较转角。'],output:['输出轴','与蜗轮刚性相连，方向与输入轴垂直，但两根轴在空间中不相交。'],bearings:['轴承','分别支承蜗杆和蜗轮轴，让轴线位置保持固定。'],frame:['支承机架','固定两根轴的空间位置。可隐藏机架，集中观察啮合与交错轴。']};
function selectPart(id,expand=true){
  selected=id;scene?.selectPart(id);
  const head=id?.startsWith('thread-')?Number(id.split('-')[1]):null;
  const content=head?[`第 ${head} 头螺旋线`,`蓝色为一条连续的独立螺旋线。当前共有 ${params.starts} 头；每条螺旋线的导程为 ${fmt(wormResults(params).lead)} mm，沿轴向相邻齿的齿距仍为 ${fmt(wormResults(params).axialPitch)} mm。`]:descriptions[id];
  $('part-title').textContent=content?.[0]||'蜗轮蜗杆传动';$('part-description').textContent=content?.[1]||'上方蜗杆驱动下方蜗轮，两根轴的方向垂直、位置不相交。';
  document.querySelector('.worm-part-note').open=Boolean(content&&expand);
  document.querySelectorAll('[data-thread]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.thread===id)));
  document.querySelectorAll('[data-worm-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wormPart===id)));
  $('thread-explanation').textContent=head?`蓝色仅表示第 ${head} 头，沿它追踪一条完整螺旋线。`:'点击“第几头”，沿蓝色高亮辨认一条完整螺旋线。';
  if(expand)window.meshlabShell.open('observe');
}
function setView(view='3d'){
  scene?.setView(view);for(const [id,name] of views)$(id).setAttribute('aria-pressed',String(view===name));
  $('view-name').textContent=view==='detail'?'啮合细节 · 右旋蜗杆':'右旋蜗杆 · 90° 交错轴';
}
function refreshCycle(){
  const delta=cycle?Math.min(TAU,Math.max(0,angle-cycle.start)):angle%TAU;
  const p=cycleProgress(delta,params);
  $('cycle-input').value=p.turns.toFixed(2);$('cycle-teeth').value=fmt(p.teeth);$('cycle-angle').value=fmt(p.wheelDegrees)+'°';
  $('cycle-state').textContent=cycle?(cycle.done?'验证完成 · 蜗杆恰好转过一圈':playing?'正在验证 · 到一圈自动暂停':'验证已暂停 · 点击播放继续'):'连续观察 · 点击下方按钮，从当前位置验证一圈';
}
function setPlaying(value){
  if(value && scene?.explosion?.active)scene.explosion.setTarget(0);
  playing=value;lastTime=null;
  $('play').textContent=value?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-pressed',String(value));$('play').setAttribute('aria-label',value?'暂停演示':'播放演示');
  $('step').disabled=$('run-turn').disabled=Boolean(value&&cycle&&!cycle.done);
  $('status-message').textContent=`${value?'播放中':'已暂停'} · 动画 1/4 慢放 × ${multiplier} · 工况转速不变`;
  refreshCycle();
}
function update(rebuild=false){
  const result=wormResults(params);
  if(rebuild){angle=0;cycle=null;if(selected?.startsWith('thread-')&&Number(selected.split('-')[1])>params.starts)selected=null;scene?.rebuild(params);$('status-message').textContent='结构已更新，已重新对齿。';}
  for(const [id,key,unit] of [['worm-starts','starts','头'],['wheel-teeth','wheelTeeth','齿'],['worm-rpm','rpm','r/min']]){$(id).value=params[key];$(id+'-value').value=`${params[key]} ${unit}`;}
  for(const [id,value] of [['input-rpm',params.rpm],['worm-ratio',result.ratio],['wheel-rpm',result.outputRpm],['worm-diameter',result.wormDiameter],['wheel-diameter',result.wheelDiameter],['center-distance',result.centerDistance],['axial-pitch',result.axialPitch],['worm-lead',result.lead],['lead-angle',result.leadAngle]])$(id).value=fmt(value);
  $('combination').textContent=`${params.starts} 头蜗杆 × ${params.wheelTeeth} 齿蜗轮`;
  $('speed-equation').textContent=`${params.rpm} × ${params.starts} ÷ ${params.wheelTeeth} = ${fmt(result.outputRpm)} r/min`;
  $('running-output').value=`${fmt(result.outputRpm)} r/min · ${fmt(result.ratio)} : 1`;
  $('axis-spacing').value=String(result.centerDistance);
  $('one-turn-relation').textContent=`蜗杆 1 圈 → 蜗轮 ${params.starts} 齿 / ${fmt(result.wheelDegreesPerTurn)}°`;
  $('comparison-caption').textContent=`同为 ${params.wheelTeeth} 齿、输入 ${params.rpm} r/min，点击比较：`;
  $('heads-comparison').replaceChildren(...[1,2,3,4].map(n=>{
    const b=document.createElement('button');b.type='button';b.dataset.heads=n;b.setAttribute('aria-pressed',String(n===params.starts));
    b.innerHTML=`<span>${n} 头</span><i aria-hidden="true"><b style="width:${n*25}%"></b></i><output>${fmt(params.rpm*n/params.wheelTeeth)} r/min</output>`;
    b.addEventListener('click',()=>{if(params.starts!==n){params.starts=n;update(true);$('lab-preset').value='custom';}});return b;
  }));
  $('thread-picker').replaceChildren(...Array.from({length:params.starts},(_,i)=>{
    const b=document.createElement('button');b.type='button';b.dataset.thread=`thread-${i+1}`;b.textContent=`第 ${i+1} 头`;b.addEventListener('click',()=>selectPart(selected===b.dataset.thread?null:b.dataset.thread,false));return b;
  }));
  scene?.setSpeeds(params);scene?.setPose(poseAt(angle,params));selectPart(selected,false);setPlaying(playing);window.dispatchEvent(new CustomEvent('meshlab:statechange'));
}
try{scene=createWormScene($('viewport'),params,id=>selectPart(id));$('viewer-status').hidden=true;}
catch(error){console.error('蜗轮蜗杆三维初始化失败',error);$('viewer-status').textContent='三维模型未能加载。请启用浏览器硬件加速后刷新；参数与计算结果仍可操作。';}
for(const [id,key] of [['worm-starts','starts'],['wheel-teeth','wheelTeeth'],['worm-rpm','rpm']])$(id).addEventListener('input',()=>{params[key]=Number($(id).value);update(key!=='rpm');});
function runTurn(){cycle={start:angle,done:false};setPlaying(true);}
$('step').addEventListener('click',runTurn);$('run-turn').addEventListener('click',runTurn);
$('play').addEventListener('click',()=>{if(!playing&&cycle?.done)cycle=null;setPlaying(!playing);});
$('inspect-mesh').addEventListener('click',()=>{$('show-supports').checked=false;scene?.setSupports(false);setView('detail');window.meshlabShell.open('observe');});
for(const [id,view] of views)$(id).addEventListener('click',()=>setView(view));
for(const [id,method] of [['show-supports','setSupports'],['show-axes','setAxes'],['show-labels','setLabels']])$(id).addEventListener('change',()=>scene?.[method]($(id).checked));
document.querySelectorAll('[data-worm-part]').forEach(b=>b.addEventListener('click',()=>selectPart(b.dataset.wormPart)));
$('reset').addEventListener('click',()=>{
  params={...defaults};angle=0;cycle=null;playing=false;multiplier=1;selected=null;$('lab-demo-speed').value='1';
  for(const [id,method] of [['show-supports','setSupports'],['show-axes','setAxes'],['show-labels','setLabels']]){$(id).checked=true;scene?.[method](true);}
  for(const id of ['worm-starts','wheel-teeth','worm-rpm']){$(id+'-number').removeAttribute('aria-invalid');$(id+'-error').textContent='';}
  $('part-title').textContent='蜗轮蜗杆传动';$('part-description').textContent='上方蜗杆驱动下方蜗轮，两根轴的方向垂直、位置不相交。';update(true);setView();$('lab-preset').value='default';
});
document.addEventListener('meshlab:preset',e=>{if(e.detail.values){const next=e.detail.values,rebuild=next.starts!==params.starts||next.wheelTeeth!==params.wheelTeeth;params={...next};update(rebuild);}});
document.addEventListener('meshlab:demo-speed',e=>{multiplier=e.detail;setPlaying(playing);});
document.addEventListener('visibilitychange',()=>lastTime=null);
update();
connectExplosion(scene, () => setPlaying(false));

function frame(time){
  const dt=lastTime===null?0:Math.max(0,Math.min((time-lastTime)/1000,.05));
  if(!document.hidden){
    if(playing&&!scene?.explosion?.active){angle+=params.rpm*TAU/60*dt*animationScale*multiplier;if(cycle&&angle>=cycle.start+TAU-1e-10){angle=cycle.start+TAU;cycle.done=true;setPlaying(false);}}
    scene?.setPose(poseAt(angle,params));scene?.render();
    if(time-lastReadout>=100){refreshCycle();lastReadout=time;}
  }
  lastTime=time;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
