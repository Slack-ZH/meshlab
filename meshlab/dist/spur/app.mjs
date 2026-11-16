import {defaults, fields, estimate} from './mechanics.mjs';
import {SpurViewer, steps} from './viewer.mjs';

const $ = id => document.getElementById(id);
const fmt = (value, digits=1) => Number.isFinite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
const geometricKeys = ['driverTeeth','drivenTeeth','module','faceWidth'];
const order = ['driverTeeth','drivenTeeth','module','faceWidth','inputRPM','inputTorque','efficiency'];
const presets = {reduce:{driverTeeth:20,drivenTeeth:40},equal:{driverTeeth:30,drivenTeeth:30},increase:{driverTeeth:40,drivenTeeth:20}};
let viewer, params={...defaults}, modelParameters=null, result=null, selectedPart=null, geometryValid=true, selectedMode='free', partFilter='all';
const status = text => {$('status-message').textContent=text;};
const announce = () => window.dispatchEvent(new Event('spur:statechange'));
const displayValue = (key,value) => key==='efficiency' ? Math.round(value*100) : value;

for (const key of order) {
  const [name,unit,min,max,step] = fields[key];
  const limits=key==='efficiency' ? [Math.round(min*100),Math.round(max*100),step*100] : [min,max,step];
  const displayUnit=key==='efficiency' ? '%' : unit;
  const el=document.createElement('div'); el.className='parameter-field';
  el.innerHTML=`<label for="${key}">${name} / ${displayUnit}</label><input id="${key}" type="number" min="${limits[0]}" max="${limits[1]}" step="${limits[2]}" value="${displayValue(key,defaults[key])}" aria-describedby="${key}-hint"><input id="${key}-slider" type="range" min="${limits[0]}" max="${limits[1]}" step="${limits[2]}" value="${displayValue(key,defaults[key])}" aria-label="调节${name}"><small id="${key}-hint">${limits[0]}–${limits[1]} ${displayUnit}</small>`;
  $(geometricKeys.includes(key)||key==='inputRPM'?'geometry-fields':'load-fields').append(el);
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
  return Object.fromEntries(order.map(key=>[key,$(key).value==='' ? NaN : Number($(key).value)/(key==='efficiency'?100:1)]));
}
function apply() {
  params=read();
  try {
    const next=estimate(params);
    const structural=!modelParameters||geometricKeys.some(key=>params[key]!==modelParameters[key]);
    if(structural && selectedMode!=='free')setMode('free');
    viewer?.build(params);
    if(params.inputRPM===0)viewer?.setPlaying(false);
    modelParameters={...params};result=next;geometryValid=true;
    $('invalid-input').hidden=true;
    if(structural)renderParts();
    $('model-label').textContent=`单级外啮合 · ${params.driverTeeth} / ${params.drivenTeeth} 齿 · m = ${params.module} mm`;
    $('ratio-count').textContent=fmt(next.ratio,2);
    renderResults();
  } catch(error) {
    result=null;geometryValid=false;
    viewer?.setPlaying(false);
    $('invalid-input').hidden=false;
    $('invalid-input').textContent=error.message+'。模型保留上一组有效参数，当前计算暂停。';
    $('drive-metrics').textContent='请修正参数后查看传动结果。';
    $('contact-summary').textContent='';$('load-summary').textContent='';$('ratio-count').textContent='—';
    for(const id of ['principle-input','principle-ratio','principle-output','ratio-example','torque-example'])$(id).textContent='—';
  }
  $('drive-preset').value=Object.keys(presets).find(key=>presets[key].driverTeeth===params.driverTeeth&&presets[key].drivenTeeth===params.drivenTeeth)||'custom';
  syncPose();announce();
}
function renderResults() {
  const r=result;
  $('drive-metrics').replaceChildren(...[
    ['从动轮转速',fmt(r.drivenRPM),'r/min · 负号表示反向'],['输出转矩',fmt(r.outputTorque,2),'N·m · 稳态大小'],['输出功率',fmt(r.outputPower,2),'W · 已计传动效率'],['中心距',fmt(r.geometry.centerDistance,1),'mm · 标准中心距'],
  ].map(([label,value,unit])=>{const card=document.createElement('div');for(const [tag,text] of [['span',label],['strong',value],['small',unit]]){const el=document.createElement(tag);el.textContent=text;card.append(el);}return card;}));
  $('contact-summary').textContent='节圆直径 '+fmt(r.geometry.driverRadius*2,1)+' / '+fmt(r.geometry.drivenRadius*2,1)+' mm · 压力角 '+fmt(r.pressureAngle,0)+'° · 理论端面重合度 '+fmt(r.contactRatio,2)+'。相同模数的两齿轮配对；1× 为实际输入转速的 20% 慢放。';
  $('load-summary').textContent=params.inputRPM===0 ? '当前输入静止，输入与输出功率均为 0；不通过稳态功率关系推算静态输出转矩。输入转矩设定会在恢复非零转速后用于计算。' : '输入 '+fmt(r.inputTorque,2)+' N·m / '+fmt(r.inputPower,2)+' W → 输出 '+fmt(r.outputTorque,2)+' N·m / '+fmt(r.outputPower,2)+' W；效率 '+fmt(r.efficiency*100,0)+'%，损失功率 '+fmt(r.inputPower-r.outputPower,2)+' W。输出转矩为大小，转向以转速负号表示。';
  $('principle-input').textContent=fmt(params.inputRPM,0);$('principle-ratio').textContent=fmt(r.ratio,2);$('principle-output').textContent=fmt(r.drivenRPM,1);
  $('ratio-example').textContent='当前 '+params.driverTeeth+' / '+params.drivenTeeth+' 齿：主动轮每正转一圈，从动轮反转 '+fmt(r.speedRatio,2)+' 圈；i = z₂ / z₁ = '+fmt(r.ratio,2)+'。';
  $('torque-example').textContent=params.inputRPM===0 ? '当前静止：输入与输出功率均为 0，本模型不求解静态承载转矩。' : '当前输入转矩 '+fmt(r.inputTorque,2)+' N·m，经速比 '+fmt(r.ratio,2)+' 和效率 '+fmt(r.efficiency*100,0)+'% 后，输出转矩大小为 '+fmt(r.outputTorque,2)+' N·m。';
}
function syncPose() {
  if(!viewer)return;
  const s=viewer.state(),step=s.step||0,amount=s.amount||0;
  $('play').textContent=s.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',s.playing?'暂停齿轮传动':'播放齿轮传动');
  $('explode').value=amount*100;$('explode').style.setProperty('--progress',(amount*100)+'%');$('explode-value').textContent=Math.round(amount*100)+'%';
  $('step-number').textContent=String(step).padStart(2,'0')+' / '+String(steps.length-1).padStart(2,'0');
  $('step-title').textContent=steps[step];
  $('step-copy').textContent=step===0?'先停止转动，按顺序观察齿轮、锁紧环和轴承。':'继续分离组件；按“上一步”可反向装配。';
  $('step-prev').disabled=step===0;$('step-next').disabled=step===steps.length-1;
  $('housing-mode').value=s.housingMode||'solid';$('labels-toggle').checked=!!s.labelsOn;
  $('pose-status').textContent=amount>0?'自由展开 · '+Math.round(amount*100)+'%':steps[step];
  $('mode-label').textContent=selectedMode==='steps'?'逐步拆装':'结构探索';
}
const transmission = part => part.category ? part.category==='transmission' : !/bearing|support/.test(part.id);
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
  viewer=new SpurViewer($('viewport'),part=>{
    selectedPart={id:part.id,name:part.name,description:part.description,spec:part.spec||''};
    $('part-title').textContent=part.name;$('part-description').textContent=part.description;
    $('part-index').textContent=String((viewer?.parts.indexOf(part)??0)+1).padStart(2,'0')+' / '+part.id.toUpperCase();
    $('selection-label').textContent=part.name;
    for(const button of $('parts-list').children){const active=button.dataset.part===part.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    announce();
  });
  $('loading').hidden=true;
}catch(error){
  console.error('直齿轮三维视图初始化失败',error);
  $('loading').textContent='三维视图需要 WebGL，仍可使用下方参数与传动计算。';
  for(const id of ['play','speed','explode','explode-all','assemble-all','home-view','front-view','top-view','fullscreen','open-parts','step-next','step-prev','housing-mode','labels-toggle'])$(id).disabled=true;
}
$('part-search').oninput=renderParts;
for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{partFilter=button.dataset.filter;for(const other of document.querySelectorAll('[data-filter]'))other.classList.toggle('active',other===button);renderParts();};
function setMode(mode){
  selectedMode=mode;$('free-controls').hidden=mode!=='free';$('assembly-controls').hidden=mode!=='steps';
  for(const button of document.querySelectorAll('[data-mode]'))button.classList.toggle('active',button.dataset.mode===mode);
  viewer?.restore();syncPose();status(mode==='steps'?'按“下一步”分离组件；按“上一步”反向装配。':'自由探索：拖动旋转、点击零件，或展开查看装配关系。');
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
  const next=!viewer.state().playing;if(next&&selectedMode!=='free')setMode('free');viewer.setPlaying(next);syncPose();
  status(next?'两齿轮按齿数比反向啮合演示；转矩与功率见下方。':'传动演示已暂停。');
};
$('speed').oninput=e=>{viewer?.setSpeed(Number(e.target.value));$('speed-value').value=Number(e.target.value).toFixed(1)+'×';};
$('explode').oninput=e=>{viewer?.explode(Number(e.target.value)/100);syncPose();};
$('explode-all').onclick=()=>{viewer?.explode(1);viewer?.home();syncPose();};
$('assemble-all').onclick=()=>{viewer?.restore();syncPose();status('已复原装配。');};
for(const [id,delta] of [['step-next',1],['step-prev',-1]])$(id).onclick=()=>{if(!viewer)return;viewer.assembly(Math.max(0,Math.min(steps.length-1,(viewer.state().step||0)+delta)));syncPose();};
$('home-view').onclick=()=>viewer?.home();$('front-view').onclick=()=>viewer?.home([0,0,1]);$('front-view').title='正视齿轮啮合平面';$('front-view').setAttribute('aria-label','正视齿轮啮合平面');
$('top-view').onclick=()=>viewer?.home([0,1,0]);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.viewer-panel').requestFullscreen)await document.querySelector('.viewer-panel').requestFullscreen();else status('当前设备不支持浏览器全屏，可横屏放大观察。');}catch{status('当前浏览器未允许全屏。');}};
$('housing-mode').onchange=e=>{viewer?.setHousingMode(e.target.value);syncPose();};$('labels-toggle').onchange=e=>viewer?.setLabels(e.target.checked);
$('drive-preset').onchange=e=>{const preset=presets[e.target.value];if(!preset)return;for(const [key,value] of Object.entries(preset)){$(key).value=value;syncRange(key);}apply();status('已更换齿数组合，节圆与中心距同步更新。');};
$('reset-parameters').onclick=()=>{for(const key of order){$(key).value=displayValue(key,defaults[key]);syncRange(key);}setMode('free');apply();status('已恢复默认 20 / 40 齿、模数 3 mm。');};
$('speak').onclick=()=>{
  if(!selectedPart)return;if(!('speechSynthesis' in window)){status('当前浏览器不支持语音朗读，完整文字讲解已显示。');return;}
  if(speechSynthesis.speaking){speechSynthesis.cancel();$('speak').textContent='◖)) 朗读讲解';return;}
  const utterance=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description);utterance.lang='zh-CN';utterance.rate=.95;
  const reset=()=>{$('speak').textContent='◖)) 朗读讲解';};utterance.onend=reset;utterance.onerror=()=>{reset();status('中文语音暂不可用，文字讲解仍可阅读。');};
  speechSynthesis.speak(utterance);$('speak').textContent='■ 停止朗读';
};
window.__spurLab={getState:()=>({ready:!!viewer?.parts.length,params:{...params},parameters:{...params},modelParameters:modelParameters&&{...modelParameters},result:result&&{...result},geometryValid,selectedPart:selectedPart&&{...selectedPart},view:viewer?.state(),selectedMode})};
document.addEventListener('visibilitychange',()=>{if(document.hidden){viewer?.setPlaying(false);syncPose();}});
window.addEventListener('pagehide',()=>{viewer?.setPlaying(false);window.speechSynthesis?.cancel();});
apply();setMode('free');
