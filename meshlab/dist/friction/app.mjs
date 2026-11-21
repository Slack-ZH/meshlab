import {defaults, fields, estimate} from './mechanics.mjs';
import {FrictionViewer, steps} from './viewer.mjs';

const $ = id => document.getElementById(id);
const fmt = (value, digits=1) => Number.isFinite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
const geometricKeys = ['driverDiameter','drivenDiameter','wheelWidth'];
const order = ['driverDiameter','drivenDiameter','wheelWidth','inputRPM','normalForce','frictionCoefficient','loadTorque'];
const presets = {reduce:{driverDiameter:120,drivenDiameter:240},equal:{driverDiameter:180,drivenDiameter:180},increase:{driverDiameter:240,drivenDiameter:120}};
let viewer, params={...defaults}, modelParameters=null, result=null, selectedPart=null, geometryValid=true, selectedMode='free', partFilter='all';
const status = text => {$('status-message').textContent=text;};
const announce = () => window.dispatchEvent(new Event('friction:statechange'));
const displayValue = (key,value) => value;

for (const key of order) {
  const [name,unit,min,max,step] = fields[key];
  const limits=[min,max,step];
  const el=document.createElement('div'); el.className='parameter-field';
  el.innerHTML=`<label for="${key}">${name} / ${unit}</label><input id="${key}" type="number" min="${limits[0]}" max="${limits[1]}" step="${limits[2]}" value="${displayValue(key,defaults[key])}" aria-describedby="${key}-hint"><input id="${key}-slider" type="range" min="${limits[0]}" max="${limits[1]}" step="${limits[2]}" value="${displayValue(key,defaults[key])}" aria-label="调节${name}"><small id="${key}-hint">${limits[0]}–${limits[1]} ${unit}</small>`;
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
  return Object.fromEntries(order.map(key=>[key,$(key).value==='' ? NaN : Number($(key).value)]));
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
    $('model-label').textContent=`外接圆柱摩擦轮 · Φ${params.driverDiameter} / Φ${params.drivenDiameter} mm · 相反转向`;
    $('ratio-count').textContent=fmt(next.ratio,2);
    renderResults();
  } catch(error) {
    result=null;geometryValid=false;
    viewer?.setPlaying(false);
    $('invalid-input').hidden=false;
    $('invalid-input').textContent=error.message+'。模型保留上一组有效参数，当前计算暂停。';
    $('drive-metrics').textContent='请修正参数后查看传动结果。';
    $('contact-summary').textContent='';$('load-summary').textContent='';$('load-summary').classList.remove('overload');$('ratio-count').textContent='—';
    for(const id of ['principle-input','principle-ratio','principle-output','ratio-example','torque-example'])$(id).textContent='—';
  }
  $('drive-preset').value=Object.keys(presets).find(key=>presets[key].driverDiameter===params.driverDiameter&&presets[key].drivenDiameter===params.drivenDiameter)||'custom';
  syncPose();announce();
}
function renderResults() {
  const r=result;
  $('drive-metrics').replaceChildren(...[
    ['理论从动转速',fmt(r.drivenRPM),'r/min · 负号表示反向'],['轮缘线速度',fmt(r.surfaceSpeed,2),'m/s · 理想无滑动'],['牵引力上限',fmt(r.frictionLimit,1),'N · μ × N'],['承载转矩上限',fmt(r.torqueCapacity,2),'N·m · 从动轮'],
  ].map(([label,value,unit])=>{const card=document.createElement('div');for(const [tag,text] of [['span',label],['strong',value],['small',unit]]){const el=document.createElement(tag);el.textContent=text;card.append(el);}return card;}));
  $('contact-summary').textContent='外接两轮保持相切，轴间距 '+fmt(r.geometry.centerDistance,1)+' mm；轮径比 D₂ / D₁ = '+fmt(r.ratio,2)+'。动画按理想无滑动关系演示，1× 为实际输入转速的 20% 慢放。';
  const capacity='负载要求牵引力 '+fmt(r.tractionDemand,1)+' N / 上限 '+fmt(r.frictionLimit,1)+' N，容量利用率 '+fmt(r.utilization*100,1)+'%。';
  const risk=r.tractionFeasible ? '当前负载未超过简化摩擦容量。' : '负载超过摩擦容量，有打滑风险；转速和动画仅保留理想无滑动基准，实际滑移速度未求解。';
  $('load-summary').textContent=capacity+' '+risk+(params.inputRPM===0?' 当前输入静止，传递功率为 0；容量仍可用于比较。':' 理想无滑动时，该负载所需输出功率 '+fmt(r.theoreticalOutputPower,1)+' W。');
  $('load-summary').classList.toggle('overload',!r.tractionFeasible);
  $('principle-input').textContent=fmt(params.inputRPM,0);$('principle-ratio').textContent=fmt(r.ratio,2);$('principle-output').textContent=fmt(r.drivenRPM,1);
  $('ratio-example').textContent='当前 Φ'+params.driverDiameter+' / Φ'+params.drivenDiameter+' mm：主动轮每正转一圈，从动轮理想反转 '+fmt(r.speedRatio,2)+' 圈。';
  $('torque-example').textContent='当前 μN = '+fmt(r.frictionLimit,1)+' N，对应从动轮承载上限 '+fmt(r.torqueCapacity,2)+' N·m；设定负载 '+fmt(params.loadTorque,2)+' N·m。';
}
function syncPose() {
  if(!viewer)return;
  const s=viewer.state(),step=s.step||0,amount=s.amount||0;
  $('play').textContent=s.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',s.playing?'暂停摩擦轮传动':'播放摩擦轮传动');
  $('explode').value=amount*100;$('explode').style.setProperty('--progress',(amount*100)+'%');$('explode-value').textContent=Math.round(amount*100)+'%';
  $('step-number').textContent=String(step).padStart(2,'0')+' / '+String(steps.length-1).padStart(2,'0');
  $('step-title').textContent=steps[step];
  $('step-copy').textContent=step===0?'先停止转动，按顺序观察轮体、锁紧环和轴承。':'先退出锁紧环，再沿轴退轮、抽轴；所有轴孔脱开后才横向排布。';
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
  viewer=new FrictionViewer($('viewport'),part=>{
    selectedPart={id:part.id,name:part.name,description:part.description,spec:part.spec||''};
    $('part-title').textContent=part.name;$('part-description').textContent=part.description;
    $('part-index').textContent=String((viewer?.parts.indexOf(part)??0)+1).padStart(2,'0')+' / '+part.id.toUpperCase();
    $('selection-label').textContent=part.name;
    for(const button of $('parts-list').children){const active=button.dataset.part===part.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    announce();
  });
  $('loading').hidden=true;
}catch(error){
  console.error('摩擦轮三维视图初始化失败',error);
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
  status(next?'两摩擦轮按理想无滑动关系反向演示；承载情况见下方。':'传动演示已暂停。');
};
$('speed').oninput=e=>{viewer?.setSpeed(Number(e.target.value));$('speed-value').value=Number(e.target.value).toFixed(1)+'×';};
$('explode').oninput=e=>{viewer?.explode(Number(e.target.value)/100);syncPose();};
$('explode-all').onclick=()=>{viewer?.explode(1);viewer?.home();syncPose();};
$('assemble-all').onclick=()=>{viewer?.restore();syncPose();status('已复原装配。');};
for(const [id,delta] of [['step-next',1],['step-prev',-1]])$(id).onclick=()=>{if(!viewer)return;viewer.assembly(Math.max(0,Math.min(steps.length-1,(viewer.state().step||0)+delta)));syncPose();};
$('home-view').onclick=()=>viewer?.home();$('front-view').onclick=()=>viewer?.home([0,0,1]);$('front-view').title='正视摩擦轮接触平面';$('front-view').setAttribute('aria-label','正视摩擦轮接触平面');
$('top-view').onclick=()=>viewer?.home([0,1,0]);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.viewer-panel').requestFullscreen)await document.querySelector('.viewer-panel').requestFullscreen();else status('当前设备不支持浏览器全屏，可横屏放大观察。');}catch{status('当前浏览器未允许全屏。');}};
$('housing-mode').onchange=e=>{viewer?.setHousingMode(e.target.value);syncPose();};$('labels-toggle').onchange=e=>viewer?.setLabels(e.target.checked);
$('drive-preset').onchange=e=>{const preset=presets[e.target.value];if(!preset)return;for(const [key,value] of Object.entries(preset)){$(key).value=value;syncRange(key);}apply();status('已更换轮径组合，两轮保持外接相切。');};
$('reset-parameters').onclick=()=>{for(const key of order){$(key).value=displayValue(key,defaults[key]);syncRange(key);}setMode('free');apply();status('已恢复默认 Φ120 / Φ240 mm 摩擦轮。');};
$('speak').onclick=()=>{
  if(!selectedPart)return;if(!('speechSynthesis' in window)){status('当前浏览器不支持语音朗读，完整文字讲解已显示。');return;}
  if(speechSynthesis.speaking){speechSynthesis.cancel();$('speak').textContent='◖)) 朗读讲解';return;}
  const utterance=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description);utterance.lang='zh-CN';utterance.rate=.95;
  const reset=()=>{$('speak').textContent='◖)) 朗读讲解';};utterance.onend=reset;utterance.onerror=()=>{reset();status('中文语音暂不可用，文字讲解仍可阅读。');};
  speechSynthesis.speak(utterance);$('speak').textContent='■ 停止朗读';
};
window.__frictionLab={getState:()=>({ready:!!viewer?.parts.length,params:{...params},parameters:{...params},modelParameters:modelParameters&&{...modelParameters},result:result&&{...result},geometryValid,selectedPart:selectedPart&&{...selectedPart},view:viewer?.state(),selectedMode})};
document.addEventListener('visibilitychange',()=>{if(document.hidden){viewer?.setPlaying(false);syncPose();}});
window.addEventListener('pagehide',()=>{viewer?.setPlaying(false);window.speechSynthesis?.cancel();});
apply();setMode('free');
