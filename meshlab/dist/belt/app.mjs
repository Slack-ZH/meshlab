import {defaults, fields, estimate} from './mechanics.mjs';
import {BeltViewer, steps} from './viewer.mjs';

const $ = id => document.getElementById(id);
const fmt = (value, digits=1) => Number.isFinite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
const geometricKeys = ['driverDiameter','drivenDiameter','centerDistance','beltWidth','crossed'];
const order = ['driverDiameter','drivenDiameter','centerDistance','beltWidth','inputRPM','inputTorque','efficiency'];
const presets = {reduce:{driverDiameter:120,drivenDiameter:180},equal:{driverDiameter:150,drivenDiameter:150},increase:{driverDiameter:180,drivenDiameter:120}};
let viewer, params={...defaults}, modelParameters=null, result=null, selectedPart=null, geometryValid=true, selectedMode='free', partFilter='all';
const status = text => {$('status-message').textContent=text;};
const announce = () => window.dispatchEvent(new Event('belt:statechange'));
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
  return {...Object.fromEntries(order.map(key=>[key,$(key).value==='' ? NaN : Number($(key).value)/(key==='efficiency'?100:1)])),crossed:$('belt-mode').value==='true'};
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
    $('model-label').textContent=(params.crossed?'交叉带 · 反向':'开口带 · 同向')+` · Φ${params.driverDiameter} / Φ${params.drivenDiameter} mm`;
    $('ratio-count').textContent=fmt(next.ratio,2);
    document.querySelector('.material-label').textContent=params.crossed?'模型 / 交叉平带传动':'模型 / 开口平带对照';
    renderResults();
  } catch(error) {
    result=null;geometryValid=false;
    viewer?.setPlaying(false);
    $('invalid-input').hidden=false;
    $('invalid-input').textContent=error.message+'。模型保留上一组有效参数，当前计算暂停。';
    $('drive-metrics').textContent='请修正参数后查看传动结果。';
    $('contact-summary').textContent='';$('load-summary').textContent='';$('ratio-count').textContent='—';
    for(const id of ['principle-input','principle-ratio','principle-output','principle-direction','principle-route','ratio-example','torque-example'])$(id).textContent='—';
  }
  $('drive-preset').value=Object.keys(presets).find(key=>presets[key].driverDiameter===params.driverDiameter&&presets[key].drivenDiameter===params.drivenDiameter)||'custom';
  syncPose();announce();
}
function renderResults() {
  const r=result,direction=params.crossed?'与输入反向':'与输入同向';
  $('drive-metrics').replaceChildren(...[
    ['理论输出转速',fmt(r.drivenRPM),'r/min · '+direction],['理论带速',fmt(r.beltSpeed,3),'m/s · 无滑动基准'],['投影理论带长',fmt(r.projectedBeltLength,1),'mm · 不含离面避让'],['输出转矩',fmt(r.outputTorque,2),'N·m · 稳态大小'],
  ].map(([label,value,unit])=>{const card=document.createElement('div');for(const [tag,text] of [['span',label],['strong',value],['small',unit]]){const el=document.createElement(tag);el.textContent=text;card.append(el);}return card;}));
  $('contact-summary').textContent='主动轮包角 '+fmt(r.driverWrapDeg,1)+'° / 从动轮包角 '+fmt(r.drivenWrapDeg,1)+'° · 中心距 '+fmt(r.geometry.centerDistance,1)+' mm。轮径按皮带中性层有效直径定义；带厚为 2 mm，轮面半径比有效半径小 1 mm。'+(params.crossed?'交叉区域采用三维避让，投影带长未计入这段离面路径。':'开口带作为同向传动对照。')+' 1× 为实际输入转速的 20% 慢放。';
  $('load-summary').textContent=params.inputRPM===0 ? '当前输入静止，输入与输出功率均为 0；给定效率 '+fmt(r.efficiency*100,0)+'%。不通过稳态功率关系推算静态输出转矩。' : '输入 '+fmt(r.inputTorque,2)+' N·m / '+fmt(r.inputPower,2)+' W → 输出 '+fmt(r.outputTorque,2)+' N·m / '+fmt(r.outputPower,2)+' W；给定效率 '+fmt(r.efficiency*100,0)+'%，损失功率 '+fmt(r.inputPower-r.outputPower,2)+' W。转矩表示大小，输出转向见转速标注。';
  $('principle-input').textContent=fmt(params.inputRPM,0);$('principle-ratio').textContent=fmt(r.ratio,2);$('principle-output').textContent=fmt(r.drivenRPM,1);
  $('principle-direction').textContent='r/min · '+direction;$('principle-route').textContent=params.crossed?'交叉带路':'开口带路';
  $('ratio-example').textContent='当前有效直径 '+params.driverDiameter+' / '+params.drivenDiameter+' mm：主动轮每正转一圈，从动轮'+(params.crossed?'反向':'同向')+'转 '+fmt(r.speedRatio,2)+' 圈；i = D₂ / D₁ = '+fmt(r.ratio,2)+'。';
  $('torque-example').textContent=params.inputRPM===0 ? '当前静止：输入与输出功率均为 0，本模型不求解静态承载转矩。' : '当前输入转矩 '+fmt(r.inputTorque,2)+' N·m，经速比 '+fmt(r.ratio,2)+' 和给定效率 '+fmt(r.efficiency*100,0)+'% 后，输出转矩大小为 '+fmt(r.outputTorque,2)+' N·m。';
}
function syncPose() {
  if(!viewer)return;
  const s=viewer.state(),step=s.step||0,amount=s.amount||0;
  $('play').textContent=s.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',s.playing?'暂停平带传动':'播放平带传动');
  $('explode').value=amount*100;$('explode').style.setProperty('--progress',(amount*100)+'%');$('explode-value').textContent=Math.round(amount*100)+'%';
  $('step-number').textContent=String(step).padStart(2,'0')+' / '+String(steps.length-1).padStart(2,'0');
  $('step-title').textContent=steps[step];
  $('step-copy').textContent=step===0?'先停止转动，按顺序观察皮带、带轮和轴承。':'先退出锁紧环和前挡边，再沿轴移出闭合带、带轮、传动轴；最后横向排布。';
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
  viewer=new BeltViewer($('viewport'),part=>{
    selectedPart={id:part.id,name:part.name,description:part.description,spec:part.spec||''};
    $('part-title').textContent=part.name;$('part-description').textContent=part.description;
    $('part-index').textContent=String((viewer?.parts.indexOf(part)??0)+1).padStart(2,'0')+' / '+part.id.toUpperCase();
    $('selection-label').textContent=part.name;
    for(const button of $('parts-list').children){const active=button.dataset.part===part.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    announce();
  });
  $('loading').hidden=true;
}catch(error){
  console.error('交叉平带三维视图初始化失败',error);
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
  status(next?(params.crossed?'交叉平带按无滑动关系演示，输出与输入反向。':'开口平带按无滑动关系演示，输出与输入同向。'):'传动演示已暂停。');
};
$('speed').oninput=e=>{viewer?.setSpeed(Number(e.target.value));$('speed-value').value=Number(e.target.value).toFixed(1)+'×';};
$('explode').oninput=e=>{viewer?.explode(Number(e.target.value)/100);syncPose();};
$('explode-all').onclick=()=>{viewer?.explode(1);viewer?.home();syncPose();};
$('assemble-all').onclick=()=>{viewer?.restore();syncPose();status('已复原装配。');};
for(const [id,delta] of [['step-next',1],['step-prev',-1]])$(id).onclick=()=>{if(!viewer)return;viewer.assembly(Math.max(0,Math.min(steps.length-1,(viewer.state().step||0)+delta)));syncPose();};
$('home-view').onclick=()=>viewer?.home();$('front-view').onclick=()=>viewer?.home([0,0,1]);$('front-view').title='正视带轮传动平面';$('front-view').setAttribute('aria-label','正视带轮传动平面');
$('top-view').onclick=()=>viewer?.home([0,1,0]);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.viewer-panel').requestFullscreen)await document.querySelector('.viewer-panel').requestFullscreen();else status('当前设备不支持浏览器全屏，可横屏放大观察。');}catch{status('当前浏览器未允许全屏。');}};
$('housing-mode').onchange=e=>{viewer?.setHousingMode(e.target.value);syncPose();};$('labels-toggle').onchange=e=>viewer?.setLabels(e.target.checked);
$('drive-preset').onchange=e=>{const preset=presets[e.target.value];if(!preset)return;for(const [key,value] of Object.entries(preset)){$(key).value=value;syncRange(key);}apply();status('已更换带轮直径组合，并重新匹配皮带路径。');};
$('belt-mode').onchange=()=>{apply();status(!geometryValid?'当前参数无效，保留上一组模型，请修正下方提示。':params.crossed?'已切换为交叉平带，输出反向；路径已重建。':'已切换为开口平带对照，输出同向；路径已重建。');};
$('reset-parameters').onclick=()=>{for(const key of order){$(key).value=displayValue(key,defaults[key]);syncRange(key);}$('belt-mode').value=String(defaults.crossed);setMode('free');apply();status('已恢复默认 Φ120 / Φ180 mm 交叉平带。');};
$('speak').onclick=()=>{
  if(!selectedPart)return;if(!('speechSynthesis' in window)){status('当前浏览器不支持语音朗读，完整文字讲解已显示。');return;}
  if(speechSynthesis.speaking){speechSynthesis.cancel();$('speak').textContent='◖)) 朗读讲解';return;}
  const utterance=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description);utterance.lang='zh-CN';utterance.rate=.95;
  const reset=()=>{$('speak').textContent='◖)) 朗读讲解';};utterance.onend=reset;utterance.onerror=()=>{reset();status('中文语音暂不可用，文字讲解仍可阅读。');};
  speechSynthesis.speak(utterance);$('speak').textContent='■ 停止朗读';
};
window.__beltLab={getState:()=>({ready:!!viewer?.parts.length,params:{...params},parameters:{...params},modelParameters:modelParameters&&{...modelParameters},result:result&&{...result},geometryValid,selectedPart:selectedPart&&{...selectedPart},view:viewer?.state(),selectedMode})};
document.addEventListener('visibilitychange',()=>{if(document.hidden){viewer?.setPlaying(false);syncPose();}});
window.addEventListener('pagehide',()=>{viewer?.setPlaying(false);window.speechSynthesis?.cancel();});
apply();setMode('free');
