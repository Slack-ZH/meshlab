import {defaults, fields, estimate} from './mechanics.mjs';
import {ViceViewer, steps} from './viewer.mjs';

const $ = id => document.getElementById(id);
const setText=(id,text)=>{const el=$(id);if(el&&el.textContent!==text)el.textContent=text;};
const fmt = (value, digits=1) => Number.isFinite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
const geometricKeys = ['lead','screwDiameter','jawWidth','maxOpening'];
const order = ['lead','screwDiameter','jawWidth','maxOpening','inputRPM','inputTorque','efficiency'];
const presets = {fine:{lead:2},standard:{lead:4},coarse:{lead:8}};
let applying=false,lastEndpoint=null;
let viewer, params={...defaults}, modelParameters=null, result=null, selectedPart=null, geometryValid=true, selectedMode='free', partFilter='all';
const status = text => {$('status-message').textContent=text;};
const announce = () => window.dispatchEvent(new Event('vice:statechange'));
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
  if(key==='lead')$(key+'-hint').textContent='2–8 mm；单线导程等于螺距。';
  syncRange(key);
}
function syncRange(key) {
  const input=$(key),range=$(key+'-slider');
  if(input.value!==''&&Number.isFinite(Number(input.value)))range.value=input.value;
  range.style.setProperty('--progress',((Number(range.value)-Number(range.min))/(Number(range.max)-Number(range.min))*100)+'%');
}
function read() {
  return {...Object.fromEntries(order.map(key=>[key,$(key).value==='' ? NaN : Number($(key).value)/(key==='efficiency'?100:1)])),direction:Number($('direction').value)};
}
function apply() {
  params=read();applying=true;
  try {
    const next=estimate(params);
    const structural=!modelParameters||geometricKeys.some(key=>params[key]!==modelParameters[key]);
    if(structural && selectedMode!=='free')setMode('free');
    viewer?.build(params);
    if(params.inputRPM===0)viewer?.setPlaying(false);
    modelParameters={...params};result=next;geometryValid=true;
    $('invalid-input').hidden=true;
    if(structural)renderParts();
    $('model-label').textContent=`单线丝杠 · 导程 ${params.lead} mm · 最大开口 ${params.maxOpening} mm`;
    $('ratio-count').textContent=fmt(next.lead,1);
    document.querySelector('.material-label').textContent='模型 / 台虎钳丝杠螺母';
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
  applying=false;
  $('drive-preset').value=Object.keys(presets).find(key=>presets[key].lead===params.lead)||'custom';
  syncPose();announce();
}
const signed=(value,digits=2)=>Number.isFinite(value)?(value>0?'+':'')+fmt(value,digits):'—';
function motionSnapshot(){return viewer?.state()||{jawOpening:params.maxOpening/2,displacement:0,screwTurns:0,playing:false,atLimit:false,limit:null};}
function renderResults() {
  const r=result;
  $('drive-metrics').replaceChildren(...[
    ['当前钳口开口','opening-value','mm · 运动实时值'],['相对中位位移','displacement-value','mm · 张开为正'],['丝杠转数','turns-value','转 · 以中位为零'],['理论进给速度','feed-value','mm/s · 按设定转速'],
  ].map(([label,id,unit])=>{const card=document.createElement('div');for(const [tag,text] of [['span',label],['strong','—'],['small',unit]]){const el=document.createElement(tag);el.textContent=text;if(tag==='strong')el.id=id;card.append(el);}return card;}));
  $('principle-input').textContent=fmt(params.inputRPM,0);$('principle-ratio').textContent=fmt(r.lead,1);$('principle-output').textContent=signed(r.linearSpeed,2);
  $('principle-direction').textContent='mm/s · '+(params.direction===1?'张开为正':'闭合为负');$('principle-route').textContent='旋转 → 直线';
  $('ratio-example').textContent='单线丝杠导程 '+fmt(r.lead,1)+' mm：每转一圈，钳口沿轴向移动 '+fmt(r.lead,1)+' mm。当前方向为'+(params.direction===1?'张开':'闭合')+'。';
  $('torque-example').textContent=params.inputRPM===0 ? '当前设定转速为 0，运动推力估算不适用；本模型不求静态夹紧力。' : '按给定效率 '+fmt(r.efficiency*100,0)+'% 与输入转矩 '+fmt(r.inputTorque,2)+' N·m，转动工况的理论推力为 '+fmt(r.thrust,2)+' N；不代表端点夹紧力或额定承载。';
  renderMotion(motionSnapshot());
}
function renderMotion(s) {
  if(!result||!geometryValid||!$('opening-value'))return;
  setText('opening-value',fmt(s.jawOpening,2));setText('displacement-value',signed(s.displacement,2));setText('turns-value',signed(s.screwTurns,3));setText('feed-value',signed(result.linearSpeed,2));
  const end=s.atLimit&&!s.playing?(s.limit==='closed'?'已到闭合行程端点，运动停止。':'已到最大开口端点，运动停止。'):s.playing?'正在'+(params.direction===1?'张开':'闭合')+'。':'运动已暂停。';
  const contactText=end+' 行程 0–'+fmt(params.maxOpening,1)+' mm，中位 '+fmt(params.maxOpening/2,1)+' mm；位移与转数以中位为零。换方向保留当前位置；复原或改变几何会回中位。1× 为设定转速的 20% 慢放。';
  setText('contact-summary',contactText);
  const r=result;
  const loadText=params.inputRPM===0?'设定转速为 0：输入与输出运动功率均为 0，运动推力不作估算。静态夹紧力未求解。':'按设定的转动工况估算：推力 '+fmt(r.thrust,2)+' N；输入 '+fmt(r.inputPower,2)+' W → 输出 '+fmt(r.outputPower,2)+' W，损失 '+fmt(r.inputPower-r.outputPower,2)+' W。给定效率 '+fmt(r.efficiency*100,0)+'%。'+(s.atLimit&&!s.playing?'模型已经停在端点，以上数值不代表此时的静态夹紧力。':'这里的运动推力不是静态夹紧力或额定承载。');
  setText('load-summary',loadText);
  const endpoint=s.atLimit&&!s.playing?s.limit:null;
  if(endpoint&&endpoint!==lastEndpoint)status((endpoint==='closed'?'已到闭合行程端点':'已到最大开口')+'，已停止；可反向运动或复原到中位。静态夹紧力未计算。');
  lastEndpoint=endpoint;
}
function onMotion(){if(applying||!viewer)return;const s=viewer.state();renderMotion(s);syncPose(s);announce();}
function syncPose(snapshot) {
  if(!viewer)return;
  const s=snapshot||viewer.state(),step=s.step||0,amount=s.amount||0;
  setText('play',s.playing?'Ⅱ':'▶');$('play').setAttribute('aria-label',s.playing?'暂停丝杠运动':'播放丝杠运动');
  $('explode').value=amount*100;$('explode').style.setProperty('--progress',(amount*100)+'%');$('explode-value').textContent=Math.round(amount*100)+'%';
  $('step-number').textContent=String(step).padStart(2,'0')+' / '+String(steps.length-1).padStart(2,'0');
  $('step-title').textContent=steps[step];
  $('step-copy').textContent=step===0?'先停止转动，按顺序观察钳口、丝杠和螺母。':'丝杠按导程旋出，止推环、钳口与手柄保持总成；再移教学可拆侧盖、侧向取出螺母。整体铸造钳体不适用此侧盖步骤。';
  $('step-prev').disabled=step===0;$('step-next').disabled=step===steps.length-1;
  $('housing-mode').value=s.housingMode||'open';$('labels-toggle').checked=!!s.labelsOn;
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
  viewer=new ViceViewer($('viewport'),part=>{
    selectedPart={id:part.id,name:part.name,description:part.description,spec:part.spec||''};
    $('part-title').textContent=part.name;$('part-description').textContent=part.description;
    $('part-index').textContent=String((viewer?.parts.indexOf(part)??0)+1).padStart(2,'0')+' / '+part.id.toUpperCase();
    $('selection-label').textContent=part.name;
    for(const button of $('parts-list').children){const active=button.dataset.part===part.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    announce();
  });
  viewer.onMotion=onMotion;
  $('loading').hidden=true;
}catch(error){
  console.error('台虎钳三维视图初始化失败',error);
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
  const next=!viewer.state().playing;if(next&&selectedMode!=='free')setMode('free');viewer.setPlaying(next);onMotion();
  const s=viewer.state();
  status(s.playing?(params.direction===1?'丝杠转动，活动钳口张开。':'丝杠反转，活动钳口闭合。'):s.atLimit?'当前方向已到行程端点，请反向运动或复原到中位。':'运动演示已暂停。');
};
$('speed').oninput=e=>{viewer?.setSpeed(Number(e.target.value));$('speed-value').value=Number(e.target.value).toFixed(1)+'×';};
$('explode').oninput=e=>{viewer?.explode(Number(e.target.value)/100);syncPose();};
$('explode-all').onclick=()=>{viewer?.explode(1);viewer?.home();syncPose();};
$('assemble-all').onclick=()=>{viewer?.restore();syncPose();status('已复原装配，钳口回到行程中位。');};
for(const [id,delta] of [['step-next',1],['step-prev',-1]])$(id).onclick=()=>{if(!viewer)return;viewer.assembly(Math.max(0,Math.min(steps.length-1,(viewer.state().step||0)+delta)));syncPose();};
$('home-view').onclick=()=>viewer?.home();$('front-view').onclick=()=>viewer?.home([0,0,1]);$('front-view').title='正视丝杠与钳口';$('front-view').setAttribute('aria-label','正视丝杠与钳口');
$('top-view').onclick=()=>viewer?.home([0,1,0]);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.viewer-panel').requestFullscreen)await document.querySelector('.viewer-panel').requestFullscreen();else status('当前设备不支持浏览器全屏，可横屏放大观察。');}catch{status('当前浏览器未允许全屏。');}};
$('housing-mode').onchange=e=>{viewer?.setHousingMode(e.target.value);syncPose();};$('labels-toggle').onchange=e=>viewer?.setLabels(e.target.checked);
$('drive-preset').onchange=e=>{const preset=presets[e.target.value];if(!preset)return;for(const [key,value] of Object.entries(preset)){$(key).value=value;syncRange(key);}apply();status('已更换导程并回到行程中位，其他参数保持原值。');};

$('direction').onchange=()=>{apply();status(geometryValid?'已改变运动方向，保留当前钳口位置。':'请修正参数；当前模型保留上一组有效值。');};
$('reset-parameters').onclick=()=>{for(const key of order){$(key).value=displayValue(key,defaults[key]);syncRange(key);}$('direction').value=String(defaults.direction);setMode('free');apply();status('已恢复默认台虎钳参数，钳口回到行程中位。');};
$('speak').onclick=()=>{
  if(!selectedPart)return;if(!('speechSynthesis' in window)){status('当前浏览器不支持语音朗读，完整文字讲解已显示。');return;}
  if(speechSynthesis.speaking){speechSynthesis.cancel();$('speak').textContent='◖)) 朗读讲解';return;}
  const utterance=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description);utterance.lang='zh-CN';utterance.rate=.95;
  const reset=()=>{$('speak').textContent='◖)) 朗读讲解';};utterance.onend=reset;utterance.onerror=()=>{reset();status('中文语音暂不可用，文字讲解仍可阅读。');};
  speechSynthesis.speak(utterance);$('speak').textContent='■ 停止朗读';
};
window.__viceLab={getState:()=>({ready:!!viewer?.parts.length,params:{...params},parameters:{...params},modelParameters:modelParameters&&{...modelParameters},result:result&&{...result},geometryValid,selectedPart:selectedPart&&{...selectedPart},view:viewer?.state(),selectedMode})};
document.addEventListener('visibilitychange',()=>{if(document.hidden){viewer?.setPlaying(false);syncPose();}});
window.addEventListener('pagehide',()=>{viewer?.setPlaying(false);window.speechSynthesis?.cancel();});
apply();setMode('free');
