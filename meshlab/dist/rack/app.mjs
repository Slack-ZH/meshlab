import {defaults, fields, estimate} from './mechanics.mjs';
import {RackViewer, steps} from './viewer.mjs';

const $ = id => document.getElementById(id);
const fmt = (value, digits=1) => Number.isFinite(value)
  ? (Math.abs(value)<0.5*10**-digits?0:value).toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
const geometricKeys = ['module','teeth','rackTeeth','faceWidth'];
const order = Object.keys(fields);
let zeroPosition=0;
let chartDirty=true;
let viewer, params={...defaults}, modelParameters=null, result=null, selectedPart=null, geometryValid=true, selectedMode='free', partFilter='all';
const status = text => {$('status-message').textContent=text;};
const announce = () => window.dispatchEvent(new Event('rack:statechange'));

for (const key of order) {
  const [name,unit,min,max,step] = fields[key];
  const limits=[min,max,step];
  const el=document.createElement('div'); el.className='parameter-field';
  el.innerHTML=`<label for="${key}">${name} / ${unit}</label><input id="${key}" type="number" min="${limits[0]}" max="${limits[1]}" step="${limits[2]}" value="${defaults[key]}" aria-describedby="${key}-hint"><input id="${key}-slider" type="range" min="${limits[0]}" max="${limits[1]}" step="${limits[2]}" value="${defaults[key]}" aria-label="调节${name}"><small id="${key}-hint">${limits[0]}–${limits[1]} ${unit}</small>`;
  $('geometry-fields').append(el);
  $(key).addEventListener('input',()=>{syncRange(key);apply();});
  let frame;
  $(key+'-slider').addEventListener('input',()=>{
    $(key).value=$(key+'-slider').value;syncRange(key);
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>apply());
  });
  syncRange(key);
}
function syncRange(key) {
  const input=$(key),range=$(key+'-slider');
  if(input.value!==''&&Number.isFinite(Number(input.value)))range.value=input.value;
  range.style.setProperty('--progress',((Number(range.value)-Number(range.min))/(Number(range.max)-Number(range.min))*100)+'%');
}
function read() {
  return Object.fromEntries(order.map(key=>[key,$(key).value==='' ? NaN : Number($(key).value)]));
}
function apply() {
  params=read();
  geometryValid=false;
  chartDirty=true;
  try {
    const next=estimate(params);
    const structural=!modelParameters||geometricKeys.some(key=>params[key]!==modelParameters[key]);
    if(structural && selectedMode!=='free')setMode('free');
    if(structural)zeroPosition=0;
    viewer?.build(params);
    modelParameters={...params};result=next;geometryValid=true;
    $('invalid-input').hidden=true;
    $('angle').min=$('angle-number').min=-next.maxAngle;
    $('angle').max=$('angle-number').max=next.maxAngle;
    if(structural)renderParts();
    $('model-label').textContent='模数 '+params.module+' mm · '+params.teeth+' 齿 · 压力角 20°';
    $('travel-per-turn').textContent=fmt(next.perTurn);
    renderResults();
  } catch(error) {
    result=null;geometryValid=false;
    viewer?.setPlaying(false);
    $('invalid-input').hidden=false;
    $('invalid-input').textContent=error.message+'。请修正后继续实验。';
    for(const id of ['position-value','measurement-value','velocity-value','pitch-value','travel-per-turn'])$(id).textContent='—';
    $('contact-summary').textContent='参数无效，当前计算已暂停。';
    $('travel-example').textContent=$('pitch-example').textContent='请先修正参数。';
    $('stage-position').textContent=$('stage-angle').textContent='—';
    $('chart-caption').textContent='修正参数后继续测量。';
    drawChart();
  }
  for(const id of ['angle','angle-number','one-tooth','quarter-turn','zero-measurement','measure-pitch'])$(id).disabled=!geometryValid||!viewer;
  for(const id of ['download-parameters','download-data'])$(id).disabled=!geometryValid;
  syncPose();announce();
}
function renderResults() {
  if(!geometryValid||!result)return;
  const angle=viewer?.angle||0;
  result=estimate(params,angle);
  result.velocity=result.velocity?result.velocity*(viewer?.direction||1):0;
  $('angle').value=angle;
  if(document.activeElement!==$('angle-number'))$('angle-number').value=angle.toFixed(1);
  $('angle').style.setProperty('--progress',((angle+result.maxAngle)/(2*result.maxAngle)*100)+'%');
  $('position-value').textContent=fmt(result.displacement,2);
  $('stage-position').textContent=fmt(result.displacement,2);
  $('stage-angle').textContent=fmt(angle,1);
  $('measurement-value').textContent=fmt(result.displacement-zeroPosition,2);
  $('velocity-value').textContent=fmt(result.velocity,2);
  $('pitch-value').textContent=fmt(result.pitch,2);
  const atEnd=Math.abs(angle)>=result.maxAngle-1e-6;
  $('contact-summary').textContent=atEnd?'已到达有效行程边界。点击“方向”反转，再播放返回。':
    '有效行程 ±'+fmt(result.travel,2)+' mm · 两端各预留 2 个齿距 · 测量基准 '+fmt(zeroPosition,2)+' mm';
  $('travel-example').textContent='当前 d = '+fmt(result.diameter)+' mm，每圈移动 '+fmt(result.perTurn,2)+' mm。';
  $('pitch-example').textContent='当前一齿对应 '+fmt(360/params.teeth,2)+'°，直线位移 '+fmt(result.pitch,2)+' mm。';
  $('chart-caption').textContent='当前位置 '+fmt(angle,1)+'° → '+fmt(result.displacement,2)+' mm；曲线斜率 '+fmt(result.perTurn/360,3)+' mm/°。';
  if(chartDirty||!viewer?.playing||performance.now()-(drawChart.lastPaint||0)>80)drawChart();
}
function drawChart() {
  drawChart.lastPaint=performance.now();chartDirty=false;
  const canvas=$('motion-chart'), width=canvas.clientWidth;
  if(!width)return;
  const ratio=Math.min(devicePixelRatio,2),height=200;
  if(canvas.width!==Math.round(width*ratio)||canvas.height!==height*ratio){
    canvas.width=Math.round(width*ratio);canvas.height=height*ratio;
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.textAlign='left';
  const style=getComputedStyle(document.documentElement);
  const ink=style.getPropertyValue('--secondary'), accent=style.getPropertyValue('--accent');
  ctx.font='12px system-ui';ctx.fillStyle=ink;
  if(!geometryValid||!result){ctx.fillText('修正参数后显示位移曲线',24,95);return;}
  const left=58,right=width-24,top=25,bottom=158;
  const px=angle=>left+(angle/result.maxAngle+1)*(right-left)/2;
  const py=s=>bottom-(s/result.travel+1)*(bottom-top)/2;
  ctx.strokeStyle=style.getPropertyValue('--line');ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);
  ctx.moveTo(px(0),top);ctx.lineTo(px(0),bottom);ctx.moveTo(left,py(0));ctx.lineTo(right,py(0));ctx.stroke();
  ctx.fillText('位移 / mm',8,15);ctx.fillText('转角 / °',right-45,191);
  ctx.fillText(fmt(result.travel,0),5,top+4);ctx.fillText('0',30,py(0)+4);
  ctx.fillText('−'+fmt(result.travel,0),5,bottom+4);
  ctx.textAlign='center';ctx.fillText('−'+fmt(result.maxAngle,0),left,bottom+18);ctx.fillText('0',px(0),bottom+18);ctx.fillText(fmt(result.maxAngle,0),right,bottom+18);
  ctx.strokeStyle=accent;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(right,top);ctx.stroke();
  ctx.fillStyle=accent;ctx.beginPath();ctx.arc(px(result.angle),py(result.displacement),5,0,Math.PI*2);ctx.fill();
}
function syncPose() {
  if(!viewer)return;
  const s=viewer,step=s.step||0,amount=s.amount||0;
  $('play').textContent=s.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',s.playing?'暂停齿轮齿条传动':'播放齿轮齿条传动');
  $('explode').value=amount*100;$('explode').style.setProperty('--progress',(amount*100)+'%');$('explode-value').textContent=Math.round(amount*100)+'%';
  $('step-number').textContent=String(step).padStart(2,'0')+' / '+String(steps.length-1).padStart(2,'0');
  $('step-title').textContent=steps[step];
  $('step-copy').textContent=[
    '按顺序拆解，当前转角和测量零点会保留。',
    '沿轴端取下锁紧环，释放小齿轮的轴向定位。',
    '小齿轮沿轴线移开，观察轮毂与传动轴。',
    '向后抽出传动轴，观察轴承的支承位置。',
    '分离齿条、导向槽和支座，按“上一步”可反向装配。',
  ][step];
  $('step-prev').disabled=step===0;$('step-next').disabled=step===steps.length-1;
  $('housing-mode').value=s.housingMode||'solid';$('labels-toggle').checked=!!s.labelsOn;
  $('pose-status').textContent=amount>0?'自由展开 · '+Math.round(amount*100)+'%':steps[step];
  $('mode-label').textContent=selectedMode==='steps'?'逐步拆装':'结构探索';
  $('reverse').textContent=s.direction===1?'方向 · 向右 →':'方向 · ← 向左';
  $('reverse').setAttribute('aria-pressed',String(s.direction===-1));
  $('focus-contact').setAttribute('aria-pressed',String(!!s.contactView));
  $('focus-contact').textContent=s.contactView?'查看整体':'观察啮合';
  const atEnd=s.g&&Math.abs(s.angle)>=s.g.maxAngle-1e-6;
  $('stage-state').textContent=!geometryValid?'参数待修正':amount||step?'拆装中 · 传动已暂停':atEnd&&!s.playing?'已到行程边界':
    (s.playing?'演示中':'已暂停')+' · '+(s.direction===1?'向右 →':'← 向左');
}
const transmission = part => part.category==='transmission';
function renderParts() {
  if(!viewer)return;
  const query=$('part-search').value.trim();$('part-count').textContent=viewer.parts.length;
  const parts=viewer.parts.filter(p=>(p.name.includes(query)||(p.description||'').includes(query))&&(partFilter==='all'||(partFilter==='transmission'?transmission(p):!transmission(p))));
  $('parts-list').replaceChildren(...parts.map(part=>{
    const button=document.createElement('button');button.type='button';button.className='part-item';button.dataset.part=part.id;
    button.classList.toggle('active',selectedPart?.id===part.id);button.setAttribute('aria-pressed',String(selectedPart?.id===part.id));
    button.innerHTML='<span class="part-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5m0 6v5M4 12h5m6 0h5"/></svg></span><span></span><span class="part-number"></span>';
    button.children[1].textContent=part.name;button.children[2].textContent=String(viewer.parts.indexOf(part)+1).padStart(2,'0');button.onclick=()=>viewer.select(part.id);return button;
  }));
  if(!parts.length){const empty=document.createElement('p');empty.className='detail-description';empty.textContent='没有匹配的零件';$('parts-list').append(empty);}
}
try {
  viewer=new RackViewer($('viewport'),part=>{
    selectedPart={id:part.id,name:part.name,description:part.description,spec:part.spec||''};
    $('part-title').textContent=part.name;$('part-description').textContent=part.description;
    $('part-spec').textContent=part.spec||'';
    $('part-index').textContent=String((viewer?.parts.indexOf(part)??0)+1).padStart(2,'0')+' / '+part.id.toUpperCase();
    $('selection-label').textContent=part.name;
    for(const button of $('parts-list').children){const active=button.dataset.part===part.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    announce();
  });
  $('loading').hidden=true;
}catch(error){
  console.error('齿轮齿条三维视图初始化失败',error);
  $('loading').textContent='三维视图需要 WebGL，仍可使用下方参数与传动计算。';
  for(const id of ['play','speed','explode','explode-all','assemble-all','home-view','front-view','top-view','fullscreen','open-parts','step-next','step-prev','housing-mode','labels-toggle','focus-contact','reverse','pitch-toggle','home-position'])$(id).disabled=true;
}
$('part-search').oninput=renderParts;
for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{partFilter=button.dataset.filter;for(const other of document.querySelectorAll('[data-filter]'))other.classList.toggle('active',other===button);renderParts();};
function setMode(mode){
  selectedMode=mode;$('free-controls').hidden=mode!=='free';$('assembly-controls').hidden=mode!=='steps';
  for(const button of document.querySelectorAll('[data-mode]')){
    const active=button.dataset.mode===mode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  if(viewer?.amount||viewer?.step)viewer.restore();else viewer?.pauseMotion();
  syncPose();status(mode==='steps'?'按“下一步”分离组件；转角与测量基准已保留。':'自由探索：拖动旋转、点击零件，或展开查看装配关系。');
}
for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>setMode(button.dataset.mode);
function showTab(id){
  for(const button of document.querySelectorAll('[data-tab]')){const active=button.dataset.tab===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));$(button.dataset.tab).hidden=!active;}
  if(id!=='explore'){viewer?.setPlaying(false);syncPose();}
}
for(const button of document.querySelectorAll('[data-tab],[data-go]'))button.addEventListener('click',()=>showTab(button.dataset.tab||button.dataset.go));
$('play').onclick=()=>{
  if(!viewer)return;
  if(!geometryValid){status('请先修正参数，再播放当前模型。');return;}
  if(params.inputRPM===0){status('当前输入转速为 0，请在模型下方提高转速。');return;}
  const next=!viewer.playing;if(next&&selectedMode!=='free')setMode('free');viewer.setPlaying(next);syncPose();
  status(next?'齿轮旋转带动齿条平移，抵达有效行程边界时自动停止。':'传动演示已暂停。');
};
$('speed').oninput=e=>{viewer?.setSpeed(Number(e.target.value));$('speed-value').value=Number(e.target.value).toFixed(1)+'×';};
$('explode').oninput=e=>{viewer?.explode(Number(e.target.value)/100);syncPose();};
$('explode-all').onclick=()=>{viewer?.explode(1);viewer?.home();syncPose();};
$('assemble-all').onclick=()=>{viewer?.restore();syncPose();status('已复原装配。');};
for(const [id,delta] of [['step-next',1],['step-prev',-1]])$(id).onclick=()=>{if(!viewer)return;viewer.assembly(Math.max(0,Math.min(steps.length-1,(viewer.state().step||0)+delta)));syncPose();};
$('home-view').onclick=()=>{viewer?.home();syncPose();};$('front-view').onclick=()=>{viewer?.home([0,0,1]);syncPose();};$('front-view').title='正视齿轮齿条啮合平面';$('front-view').setAttribute('aria-label','正视齿轮齿条啮合平面');
$('top-view').onclick=()=>{viewer?.home([0,1,0]);syncPose();};
$('focus-contact').onclick=()=>{
  if(!viewer)return;
  if(viewer.contactView)viewer.home();else {if(selectedMode!=='free')setMode('free');viewer.focusContact();}
  syncPose();
};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.viewer-panel').requestFullscreen)await document.querySelector('.viewer-panel').requestFullscreen();else status('当前设备不支持浏览器全屏，可横屏放大观察。');}catch{status('当前浏览器未允许全屏。');}};
$('housing-mode').onchange=e=>{viewer?.setHousingMode(e.target.value);syncPose();};$('labels-toggle').onchange=e=>viewer?.setLabels(e.target.checked);
$('reset-parameters').onclick=()=>{
  for(const key of order){$(key).value=defaults[key];syncRange(key);}
  if(viewer)viewer.direction=1;
  zeroPosition=0;setMode('free');apply();viewer?.setAngle(0);viewer?.home();syncPose();status('已恢复默认参数与中点位置。');
};
function moveTo(angle) {
  if(!geometryValid||!viewer)return;
  if(!Number.isFinite(angle)){status('请输入有效转角。');return;}
  if(selectedMode!=='free')setMode('free');
  const clipped=Math.max(-result.maxAngle,Math.min(result.maxAngle,angle));
  viewer.setAngle(clipped);$('angle-number').value=clipped.toFixed(1);
  if(clipped!==angle)status('已停在有效行程边界。');
  syncPose();renderResults();announce();
}
$('angle').oninput=e=>moveTo(Number(e.target.value));
$('angle-number').onchange=e=>{if(e.target.value===''){e.target.value=(viewer?.angle||0).toFixed(1);return;}moveTo(Number(e.target.value));};
$('one-tooth').onclick=()=>moveTo((viewer?.angle||0)+(viewer?.direction||1)*360/params.teeth);
$('quarter-turn').onclick=()=>moveTo((viewer?.angle||0)+(viewer?.direction||1)*90);
$('home-position').onclick=()=>moveTo(0);
$('reverse').onclick=()=>{
  if(!viewer)return;
  viewer.direction*=-1;
  $('reverse').textContent=viewer.direction===1?'方向 · 向右 →':'方向 · ← 向左';
  $('reverse').setAttribute('aria-pressed',String(viewer.direction===-1));renderResults();announce();
};
$('zero-measurement').onclick=()=>{if(result){zeroPosition=result.displacement;renderResults();status('已把当前位置设为测量零点。');}};
$('measure-pitch').onclick=()=>{
  if(!result||!viewer)return;
  viewer.setPlaying(false);
  syncPose();
  const step=viewer.direction*360/params.teeth;
  if(Math.abs(viewer.angle+step)>result.maxAngle+1e-8){status('剩余行程不足一齿，请反转方向或回到中点。');return;}
  zeroPosition=result.displacement;
  moveTo(viewer.angle+step);
  status('已测得一齿位移 '+fmt(Math.abs(result.displacement-zeroPosition),2)+' mm，理论齿距 '+fmt(result.pitch,2)+' mm。');
};
$('pitch-toggle').onchange=e=>viewer?.setPitchVisible(e.target.checked);
function download(name,content,type) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('download-parameters').onclick=()=>{
  if(!result)return;
  download('rack-parameters.json',JSON.stringify({model:'齿轮齿条',units:{length:'mm',angle:'degree',inputRPM:'r/min',velocity:'mm/s'},
    parameters:params,angle:viewer?.angle||0,direction:viewer?.direction||1,zeroPosition,
    measurement:result.displacement-zeroPosition,result},null,2),'application/json');
};
$('download-data').onclick=()=>{
  if(!result)return;
  const rows=['angle_deg,displacement_mm'];
  for(let i=0;i<=20;i++){
    const angle=result.maxAngle*(i/10-1),sample=estimate(params,angle);
    rows.push(angle.toFixed(6)+','+sample.displacement.toFixed(6));
  }
  download('rack-displacement.csv','﻿'+rows.join('\r\n'),'text/csv;charset=utf-8');
};
$('speak').onclick=()=>{
  if(!selectedPart)return;if(!('speechSynthesis' in window)){status('当前浏览器不支持语音朗读，完整文字讲解已显示。');return;}
  if(speechSynthesis.speaking){speechSynthesis.cancel();$('speak').textContent='◖)) 朗读讲解';return;}
  const utterance=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description);utterance.lang='zh-CN';utterance.rate=.95;
  const reset=()=>{$('speak').textContent='◖)) 朗读讲解';};utterance.onend=reset;utterance.onerror=()=>{reset();status('中文语音暂不可用，文字讲解仍可阅读。');};
  speechSynthesis.speak(utterance);$('speak').textContent='■ 停止朗读';
};
window.__rackLab={getState:()=>({ready:!!viewer?.parts.length,params:{...params},parameters:{...params},modelParameters:modelParameters&&{...modelParameters},result:result&&{...result},zeroPosition,geometryValid,selectedPart:selectedPart&&{...selectedPart},view:viewer?.state(),selectedMode})};
document.addEventListener('visibilitychange',()=>{if(document.hidden){viewer?.setPlaying(false);syncPose();}});
window.addEventListener('pagehide',()=>{viewer?.setPlaying(false);window.speechSynthesis?.cancel();});
if(viewer)viewer.onMotion=()=>{renderResults();syncPose();};
new ResizeObserver(drawChart).observe($('motion-chart'));
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',drawChart);
apply();setMode('free');
