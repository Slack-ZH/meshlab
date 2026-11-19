import '../lab-shell.js';
import { connectExplosion } from '../explosion-controls.js';
import { defaults, differentialSpeeds, initialAngles, advanceAngles, demonstrationScale, modes } from './kinematics.js';
import { createDifferentialScene } from './scene.js';

const $=id=>document.getElementById(id);
const fields={carrierRpm:'carrier-rpm',trackWidth:'track-width',turnRadius:'turn-radius'};
let parameters={...defaults},mode='straight',playing=false,multiplier=1,angles=initialAngles(),speeds=differentialSpeeds(parameters,mode),scene=null,lastTime=null;
const parts={
  input:['主动锥齿轮','接收传动轴输入，经主减速齿轮带动差速器壳体。固定主减速比为 4 : 1；默认输入 240 r/min，壳体 60 r/min。'],
  ring:['主减速大齿轮','与差速器壳体固定为一体，把输入转动传给壳体。转弯时，它仍决定左右半轴的平均转速。'],
  carrier:['差速器壳体','携带行星轮轴及行星锥齿轮公转。剖视中保留端环和支承，便于看清内部。壳体转速始终等于左右半轴转速的平均值。'],
  left:['左半轴齿轮与半轴','与左侧车轮相连。直行时与壳体等速，左转时位于内侧而减速，右转时位于外侧而加速。左右以车辆朝前的方向定义。'],
  right:['右半轴齿轮与半轴','与右侧车轮相连。直行时与壳体等速，左转时位于外侧而加速，右转时位于内侧而减速。左右以车辆朝前的方向定义。'],
  spider:['行星锥齿轮（差速齿轮）','沿壳体内的行星轮轴转动，同时随壳体绕半轴轴线公转。直行时无相对自转；转弯时自转，使两侧半轴相对壳体一快一慢。深色径向标记帮助观察自转。'],
};
const format=value=>String(Number(value.toFixed(1)));
function selectPart(id){
  if(!parts[id])return;
  $('part-title').textContent=parts[id][0];$('part-description').textContent=parts[id][1];
  document.querySelector('.diff-part-note').open=true;
  document.querySelectorAll('[data-diff-part]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.diffPart===id)));
  scene?.selectPart(id);window.meshlabShell.open('observe');
}
function setPlaying(value){
  if(value && scene?.explosion?.active)scene.explosion.setTarget(0);
  playing=value;lastTime=null;
  $('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-pressed',String(playing));
  $('play').setAttribute('aria-label',playing?'暂停演示':'播放演示');
  $('status-message').textContent=`${modes[mode]} · ${playing?'播放中':'已暂停'} · 动画按实际转速 1/5 慢放 × ${multiplier} · 步进为壳体转过 15°`;
}
function update(){
  speeds=differentialSpeeds(parameters,mode);
  for(const [key,id] of Object.entries(fields)){
    $(id).value=parameters[key];$(`${id}-value`).value=`${format(parameters[key])} ${key==='carrierRpm'?'r/min':'m'}`;
  }
  for(const [id,key] of [['left-rpm','left'],['right-rpm','right'],['carrier-speed','carrier']])$(id).value=format(speeds[key]);
  $('spider-rpm').value=format(Math.abs(speeds.spider));
  $('left-role').textContent=mode==='straight'?'等速':mode==='left'?'内侧 · 慢':'外侧 · 快';
  $('right-role').textContent=mode==='straight'?'等速':mode==='right'?'内侧 · 慢':'外侧 · 快';
  for(const key of ['left','right','carrier'])$(`${key}-bar`).style.width=`${speeds[key]/parameters.carrierRpm*60}%`;
  $('mean-equation').value=`(${format(speeds.left)} + ${format(speeds.right)}) ÷ 2 = ${format(speeds.carrier)}`;
  $('drive-title').textContent=mode==='straight'?'两侧等速，同步前行':mode==='left'?'左侧走得短，右侧走得长':'右侧走得短，左侧走得长';
  $('drive-explanation').textContent=mode==='straight'?'左右半轴与壳体等速。行星锥齿轮只随壳体公转，相对壳体不自转。':`${mode==='left'?'左':'右'}半轴减速，${mode==='left'?'右':'左'}半轴加速。行星锥齿轮一边随壳体公转，一边沿自身轴自转。`;
  $('spider-state').textContent=mode==='straight'?'相对壳体静止 · 仍随壳体公转':`相对壳体自转 · ${mode==='left'?'左转方向':'右转方向'}（换向时反转）`;
  $('drive-path').setAttribute('d',mode==='straight'?'M80 103V9':mode==='left'?'M80 103V64Q80 16 16 16':'M80 103V64Q80 16 144 16');
  document.querySelector('.diff-road').setAttribute('aria-label',`${modes[mode]}车辆俯视示意，${mode==='straight'?'左右轮等速':mode==='left'?'左轮内侧较慢，右轮外侧较快':'右轮内侧较慢，左轮外侧较快'}`);
  document.querySelectorAll('[data-drive]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.drive===mode)));
  $('radius-note').textContent=mode==='straight'?'R 指转弯中心到后轴中点的距离；直行时不参与转速计算。':`当前${modes[mode]}：内侧半径 ${format(parameters.turnRadius-parameters.trackWidth/2)} m，外侧半径 ${format(parameters.turnRadius+parameters.trackWidth/2)} m；减小 R 会增大转速差。`;
  scene?.setSpeeds(speeds);scene?.setPose(angles);
  setPlaying(playing);window.dispatchEvent(new CustomEvent('meshlab:statechange'));
}
try{
  scene=createDifferentialScene($('viewport'),selectPart);$('viewer-status').hidden=true;
}catch(error){
  console.error('差速器三维渲染初始化失败',error);
  $('viewer-status').textContent='三维模型未能加载。请启用浏览器硬件加速后刷新；下方转速计算仍可操作。';
}
document.querySelectorAll('[data-drive]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.drive;playing=true;update();}));
document.querySelectorAll('[data-diff-part]').forEach(button=>button.addEventListener('click',()=>selectPart(button.dataset.diffPart)));
for(const [key,id] of Object.entries(fields))$(id).addEventListener('input',()=>{parameters[key]=Number($(id).value);update();});
$('play').addEventListener('click',()=>setPlaying(!playing));
$('step').addEventListener('click',()=>{setPlaying(false);angles=advanceAngles(angles,speeds,15/(speeds.carrier*6));scene?.setPose(angles);});
$('reset').addEventListener('click',()=>{
  parameters={...defaults};mode='straight';angles=initialAngles();playing=false;multiplier=1;
  $('lab-demo-speed').value='1';$('case-display').value='cutaway';$('show-labels').checked=true;
  $('case-display').dispatchEvent(new Event('change'));scene?.setLabels(true);scene?.setView();scene?.selectPart(null);
  document.querySelectorAll('[data-diff-part]').forEach(button=>button.setAttribute('aria-pressed','false'));
  $('part-title').textContent='开放式差速器';$('part-description').textContent='选择模型中的零件或打开零件目录，查看它在动力传递中的作用。';document.querySelector('.diff-part-note').open=false;
  for(const id of Object.values(fields)){$(`${id}-number`).removeAttribute('aria-invalid');$(`${id}-error`).textContent='';}
  update();$('lab-preset').value='default';
});
$('focus-spider').addEventListener('click',()=>{$('case-display').value='hidden';$('case-display').dispatchEvent(new Event('change'));scene?.setView('detail');selectPart('spider');});
$('case-display').addEventListener('change',()=>{scene?.setDisplay($('case-display').value);$('view-name').textContent=`锥齿轮差速器 · ${{cutaway:'剖视',solid:'完整壳体',hidden:'内部啮合'}[$('case-display').value]}`;});
$('show-labels').addEventListener('change',()=>scene?.setLabels($('show-labels').checked));
for(const [id,name] of [['view-3d','3d'],['view-front','front'],['top-view','top']])$(id).addEventListener('click',()=>{scene?.setView(name);for(const other of ['view-3d','view-front','top-view'])$(other).setAttribute('aria-pressed',String(id===other));});
document.addEventListener('meshlab:demo-speed',event=>{multiplier=event.detail;setPlaying(playing);});
document.addEventListener('meshlab:preset',event=>{if(event.detail.values){parameters={...event.detail.values};update();}});
document.addEventListener('visibilitychange',()=>{lastTime=null;});
update();
connectExplosion(scene, () => setPlaying(false));

function frame(time){
  if(!document.hidden){
    if(playing&&!scene?.explosion?.active&&lastTime!==null)angles=advanceAngles(angles,speeds,Math.min((time-lastTime)/1000,.05)*demonstrationScale*multiplier);
    scene?.setPose(angles);scene?.render();
  }
  lastTime=time;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
