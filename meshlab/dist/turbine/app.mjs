import {defaults,fields,estimate,geometry,validateGeometry,scan,changes,assumptions,pressureToMPa} from './physics.mjs';
import {TurbineViewer,steps} from './viewer.mjs?v=20261116-ui2';
const $=id=>document.getElementById(id),fmt=(n,d=2)=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
let selectedMode = 'free',partFilter='all';
let current={...defaults},baseline=null,result=null,viewer,unit='MPa',selectedPart=null,geometryValid=true;
const text={work:'做功方式',exhaust:'排汽方式',impulse:'冲动式',reaction:'反动式',condensing:'凝汽式',backpressure:'背压式'};
const value=(p,k)=>fields[k]?fmt(p[k],['p1','p2'].includes(k)?4:2):text[p[k]];
const status=message=>{$('status-message').textContent=message;};
const stepDescriptions=['演示开始前停机。先移开汽缸，再拆轴端组件和静叶隔板。','上汽缸和进汽口向上移开，露出内部叶栅。','轴承座与轴封沿轴线退出，查看轴端支承关系。','下汽缸和排汽口向下移开，转子保持装配基准。','上下静叶隔板沿径向分离；可反向逐步装配。'];
function read(){const p={...current,work:$('work').value,exhaust:$('exhaust').value};for(const k of Object.keys(fields)){p[k]=$(k).value===''?NaN:Number($(k).value);if((k==='p1'||k==='p2')&&Number.isFinite(p[k]))p[k]=pressureToMPa(p[k],unit);}return p;}
for(const k of ['stages','blades','height','chord','hub',...Object.keys(fields).slice(5)]){
  const [label,u,min,max,step]=fields[k];
  const geometric=['height','chord','blades','hub','stages'].includes(k);
  const host=geometric?$('geometry-fields'):$('condition-fields');
  const el=document.createElement('div');el.className='parameter-field';
  el.innerHTML=`<label id="${k}-label" for="${k}">${label} / ${u}</label><input id="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${current[k]}" aria-describedby="${k}-range">${geometric?`<input id="${k}-slider" type="range" min="${min}" max="${max}" step="${step}" value="${current[k]}" aria-label="调节${label}">`:''}<span class="range" id="${k}-range">${min}–${max} ${u}</span>`;host.append(el);
  const syncRange=()=>{if(!geometric)return;const range=$(k+'-slider');if($(k).value!=='')range.value=$(k).value;range.style.setProperty('--progress',`${(Number(range.value)-min)/(max-min)*100}%`);};
  $(k).addEventListener('input',()=>{syncRange();update();});
  if(geometric){let pending;$(k+'-slider').addEventListener('input',()=>{$(k).value=$(k+'-slider').value;syncRange();cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>update());});syncRange();}
}
$('assumptions').textContent=assumptions;
function update({rebuild=true}={}) {
  const next = read();
  current = next;
  $('expansion-note').textContent = next.work === 'impulse'
    ? '冲动式：膨胀主要发生在静叶，动叶将蒸汽动量变化转化为转矩。'
    : '反动式：蒸汽在静叶与动叶中膨胀。';
  const invalidInput = $('invalid-input');
  invalidInput.hidden = true;
  geometryValid=true;
  try {
    validateGeometry(next);
    if (rebuild && viewer && (!viewer.p ||
      ['height','chord','blades','hub','stages','work','exhaust'].some(k => viewer.p[k] !== next[k]))) {
      if(viewer.p && selectedMode==='free' && viewer.amount===0 && viewer.step===0 &&
        ['height','chord','blades','hub','stages','work'].some(k=>viewer.p[k]!==next[k])) viewer.open=true;
      viewer.build(next);
      renderParts();
    }
    const g = geometry(next);
    $('model-label').textContent = '卧式 · 单缸 · 单轴 · ' + next.stages + ' 级';
    $('stage-count').textContent=next.stages;
    $('geometry-results').textContent = '末级流道 ' + fmt(g.area,4) + ' m² · 最大叶尖直径 ' + g.diameter + ' mm · 总叶片 ' + g.totalBlades + ' 片';
    renderBladeDesign();
  } catch (error) {
    geometryValid=false;
    invalidInput.hidden = false;
    invalidInput.textContent = error.message + '。模型仍显示上一组有效结构。';
    $('geometry-results').textContent = '';
  }
  try {
    const calc = estimate(next);
    current = next;
    result = calc;
    $('error').hidden = true;
    $('save-baseline').disabled = false;
    $('metrics').replaceChildren(...[
      ['估算轴功率', fmt(calc.power), 'kW'],
      ['等熵焓降', fmt(calc.drop), 'kJ/kg'],
      ['入口焓 h₁', fmt(calc.h1), 'kJ/kg'],
      ['实际出口', calc.outlet.x === null ? '过热蒸汽' : 'x = ' + fmt(calc.outlet.x,4),
        calc.outlet.x === null ? fmt(calc.outlet.T-273.15) + ' °C' : '两相区干度 · 按实际 h₂'],
    ].map(([name,value,unit]) => {
      const card = document.createElement('div');
      card.className = 'metric';
      for (const [tag,text] of [['span',name],['b',value],['small',unit]]) {
        const element = document.createElement(tag); element.textContent = text; card.append(element);
      }
      return card;
    }));
  } catch (error) {
    result = null;
    $('error').textContent = error.message;
    $('error').hidden = false;
    $('metrics').textContent = '当前方案无有效轴功率。';
    $('save-baseline').disabled = true;
  }
  compare();
  $('scan-results').replaceChildren();
  syncPose();
  window.dispatchEvent(new Event('turbine:statechange'));
}
function renderBladeDesign(){
  const design=viewer?.state().bladeDesign;
  if(!design)return;
  $('blade-scope').textContent=design.note;
  $('stage-geometry').innerHTML='<table><thead><tr><th>级</th><th>叶高 mm</th><th>弦长 mm</th><th>静叶剖面</th><th>动叶剖面</th><th>间隙下界 mm</th></tr></thead><tbody>'+design.stages.map(s=>`<tr><th>${s.stage}</th><td>${fmt(s.height,1)}</td><td>${fmt(s.chord,1)}</td><td>${s.statorProfile}</td><td>${s.rotorProfile}</td><td>${fmt(s.minimumGap,2)}</td></tr>`).join('')+'</tbody></table>';
}
function syncPose() {
  if (!viewer) return;
  const percent = Math.round(viewer.amount * 100);
  $('explode').value = viewer.amount * 100;
  $('explode').style.setProperty('--progress', percent + '%');
  $('explode-value').textContent = percent + '%';
  $('step-number').textContent=String(viewer.step).padStart(2,'0')+' / '+String(steps.length-1).padStart(2,'0');
  $('step-title').textContent=steps[viewer.step];
  $('step-copy').textContent=stepDescriptions[viewer.step];
  $('pose-status').textContent = viewer.open ? '上盖已打开'
    : viewer.amount > 0 ? '自由展开 · ' + percent + '%' : steps[viewer.step];
  $('step-prev').disabled = viewer.step === 0;
  $('step-next').disabled = viewer.step === steps.length - 1;
  $('parameter-cover').textContent = viewer.open ? '关闭上盖' : '打开上盖';
  $('parameter-cover').setAttribute('aria-pressed', viewer.open);
  $('housing-mode').value=viewer.housingMode || (viewer.open?'open':'solid');
  $('labels-toggle').checked=viewer.labelsOn;
  $('play').textContent=viewer.playing?'Ⅱ':'▶';
  $('play').setAttribute('aria-label',viewer.playing?'暂停转子演示':'播放转子演示');
  $('mode-label').textContent=selectedMode==='steps'?'逐步拆装':'结构探索';
}
function renderParts() {
  const query = $('part-search').value.trim();
  $('part-count').textContent = viewer.parts.length;
  const transmission=part=>part.id==='rotor'||/^(moving-|stator-|stator-lower-|bearing)/.test(part.id);
  const matches=viewer.parts.filter(part => part.name.includes(query) && (partFilter==='all'||(partFilter==='transmission' ? transmission(part):!transmission(part))));
  $('parts-list').replaceChildren(...matches.map(part => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'part-item';
    button.classList.toggle('active', part.id === viewer.selected);
    button.dataset.part = part.id;
    button.setAttribute('aria-pressed',String(part.id===viewer.selected));
    button.innerHTML='<span class="part-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5m0 6v5M4 12h5m6 0h5"/></svg></span><span></span><span class="part-number"></span>';
    button.children[1].textContent=part.name;
    button.children[2].textContent=String(viewer.parts.indexOf(part)+1).padStart(2,'0');
    button.addEventListener('click', () => viewer.select(part.id));
    return button;
  }));
  if(!matches.length){const empty=document.createElement('p');empty.className='detail-description';empty.textContent='没有匹配的零件';$('parts-list').append(empty);}
}
try {
  viewer = new TurbineViewer($('viewport'), part => {
    selectedPart={id:part.id,name:part.name,description:part.description};
    $('part-title').textContent = part.name;
    $('part-description').textContent = part.description;
    $('part-index').textContent=String((viewer?.parts.indexOf(part)??0)+1).padStart(2,'0')+' / '+part.id.toUpperCase();
    for (const button of $('parts-list').children) {button.classList.toggle('active', button.dataset.part === part.id);button.setAttribute('aria-pressed',String(button.dataset.part === part.id));}
    $('selection-label').textContent = part.name;
    window.dispatchEvent(new Event('turbine:statechange'));
  });
  $('loading').hidden = true;
} catch (error) {
  console.error('汽轮机 WebGL 初始化失败', error);
  $('loading').textContent = '三维视图需要 WebGL，仍可使用参数和功率计算。';
  for (const id of ['parameter-cover','explode-all','assemble-all','home-view','top-view','front-view','fullscreen','step-next','step-prev','explode','open-parts','play','speed','housing-mode','labels-toggle']) $(id).disabled = true;
}
$('part-search').oninput = () => { if (viewer) renderParts(); };
for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{partFilter=button.dataset.filter;for(const other of document.querySelectorAll('[data-filter]'))other.classList.toggle('active',other===button);if(viewer)renderParts();};
function showTab(id) {
  const parameters=id==='parameters';
  if(parameters)id='explore';
  for (const button of document.querySelectorAll('[data-tab]')) {
    const active = id === button.dataset.tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    $(button.dataset.tab).hidden = !active;
  }
  if(id!=='explore'){viewer?.setPlaying(false);syncPose();}
  if(parameters){$('parameters').scrollIntoView({block:'start'});$('stages').focus({preventScroll:true});}
}
for (const button of document.querySelectorAll('[data-tab],[data-go]'))
  button.addEventListener('click', () => showTab(button.dataset.tab || button.dataset.go));
function setMode(mode) {
  selectedMode = mode;
  $('free-controls').hidden = mode !== 'free';
  $('assembly-controls').hidden = mode !== 'steps';
  for (const button of document.querySelectorAll('[data-mode]'))
    button.classList.toggle('active', button.dataset.mode === mode);
  viewer?.restore();
  syncPose();
  status(mode==='steps'?'按“下一步”逐步拆卸；按“上一步”反向装配。':'自由探索：拖动旋转、点击零件，或展开查看装配关系。');
}
for (const button of document.querySelectorAll('[data-mode]'))
  button.addEventListener('click', () => setMode(button.dataset.mode));
$('top-view').onclick = () => viewer?.home([0,1,0]);
$('front-view').onclick = () => viewer?.home([1,0,0]);
$('fullscreen').onclick = async () => {
  try {if (document.fullscreenElement) await document.exitFullscreen();
  else if(document.querySelector('.viewer-panel').requestFullscreen) await document.querySelector('.viewer-panel').requestFullscreen();
  else status('当前设备不支持浏览器全屏，可横屏放大观察。');}catch{status('当前浏览器未允许全屏。');}
};
$('home-view').onclick=()=>viewer?.home();
$('parameter-cover').onclick=()=>{if(!viewer)return;const next=!viewer.open;if (selectedMode !== 'free') setMode('free');viewer.restore();viewer.setHousingMode(next?'open':'solid');syncPose();};
$('housing-mode').onchange=e=>{viewer?.setHousingMode(e.target.value);syncPose();};
$('labels-toggle').onchange=e=>viewer?.setLabels(e.target.checked);
$('speed').oninput=e=>{viewer?.setSpeed(Number(e.target.value));$('speed-value').value=Number(e.target.value).toFixed(1)+'×';};
$('play').onclick=()=>{if(!viewer)return;const next=!viewer.playing;if(next&&selectedMode!=='free')setMode('free');viewer.setPlaying(next);syncPose();status(next?'转子慢放演示，不代表设计转速或流场计算。':'转子演示已暂停。');};
$('explode').oninput=e=>{viewer?.explode(Number(e.target.value)/100);syncPose();};
$('explode-all').onclick=()=>{viewer?.explode(1);viewer?.home();syncPose();};
$('assemble-all').onclick=()=>{viewer?.restore();syncPose();status('已复原装配。');};
for(const [id,delta] of [['step-next',1],['step-prev',-1]])$(id).onclick=()=>{if(!viewer)return;viewer.assembly(Math.max(0,Math.min(steps.length - 1,viewer.step+delta)));syncPose();};
$('speak').onclick=()=>{if(!selectedPart)return;if(!('speechSynthesis'in window)){status('当前浏览器不支持语音朗读，完整文字讲解已显示。');return;}if(speechSynthesis.speaking){speechSynthesis.cancel();$('speak').textContent='◖)) 朗读讲解';return;}const utterance=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description);utterance.lang='zh-CN';utterance.rate=.95;utterance.onend=()=>{$('speak').textContent='◖)) 朗读讲解';};utterance.onerror=()=>{status('中文语音暂不可用，文字讲解仍可阅读。');$('speak').textContent='◖)) 朗读讲解';};speechSynthesis.speak(utterance);$('speak').textContent='■ 停止朗读';};
$('work').onchange=()=>{$('preset-change').textContent='实际变化：做功方式与叶栅示意。排汽方式及所有数值输入保持不变。';update();};
$('exhaust').onchange=()=>{let note='实际变化：排汽方式与出口连接。其余参数保持不变。';if(!$('lock-pressure').checked){const prev=$('p2').value;const target=$('exhaust').value==='condensing'?.01:.5;$('p2').value=target/pressureToMPa(1,unit);note=`实际变化：排汽方式、出口连接、排汽绝对压力 ${prev} → ${$('p2').value} ${unit}。进汽、流量、效率与结构参数保持不变。`;}else note+=' 已锁定排汽压力。';$('preset-change').textContent=note;update();};
$('pressure-unit').onchange=e=>{ // Convert displayed values, including currently invalid input; do not silently restore a valid state.
  const previous=unit;unit=e.target.value;for(const k of ['p1','p2']){if($(k).value!=='')$(k).value=Number((Number($(k).value)*pressureToMPa(1,previous)/pressureToMPa(1,unit)).toPrecision(12));const factor=pressureToMPa(1,unit);$(k).min=fields[k][2]/factor;$(k).max=fields[k][3]/factor;$(k).step=fields[k][4]/factor;$(k+'-label').textContent=`${fields[k][0]} / ${unit}`;$(k+'-range').textContent=`${fields[k][2]/factor}–${fields[k][3]/factor} ${unit}`;}update({rebuild:false});};
function compare(){
  if(!baseline)return;
  if(!result){$('comparison').textContent='基准已保留；当前方案无效，修正输入后恢复对比。';return;}
  const a=estimate(baseline),changed=changes(baseline,current);
  const rows=Object.keys(defaults).map(k=>`<tr class="${changed.includes(k)?'changed':''}"><th>${fields[k]?fields[k][0]+' / '+fields[k][1]:text[k]}</th><td>${value(baseline,k)}</td><td>${value(current,k)}</td></tr>`);
  for(const [label,key,u] of [['入口焓 h₁','h1','kJ/kg'],['入口熵 s₁','s1','kJ/(kg·K)'],['等熵出口焓 h₂s','h2s','kJ/kg'],['等熵焓降','drop','kJ/kg'],['实际出口焓 h₂','h2','kJ/kg'],['轴功率','power','kW']])rows.push(`<tr><th>${label} / ${u}</th><td>${fmt(a[key],3)}</td><td>${fmt(result[key],3)}</td></tr>`);
  $('comparison').innerHTML=`<h3>方案对比</h3><p class="note">改变的输入：${changed.map(k=>fields[k]?.[0]||text[k]).join('、')||'无'}。轴功率变化 ${fmt(result.power-a.power)} kW。共同假设：${assumptions}</p><div class="table-wrap"><table><thead><tr><th>参数 / 结果</th><th>基准 A</th><th>当前 B</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
$('save-baseline').onclick=()=>{if(!result)return;baseline={...current};try{localStorage.setItem('meshlab-turbine-baseline-v1',JSON.stringify(baseline));}catch{$('preset-change').textContent='浏览器存储不可用；基准仅保存在本次页面会话中。';}compare();};
try{const saved=JSON.parse(localStorage.getItem('meshlab-turbine-baseline-v1'));if(saved){estimate(saved);baseline=saved;}}catch{baseline=null;}
for(const [k,[name,u]] of Object.entries(fields))$('scan-key').add(new Option(`${name} / ${u}`,k));$('scan-key').value='p2';
$('scan-key').onchange=()=>{const k=$('scan-key').value;$('scan-start').value=current[k];$('scan-end').value=['blades','stages'].includes(k)?Math.min(fields[k][3],current[k]+4):Math.min(fields[k][3],current[k]*2);$('scan-results').replaceChildren();};
$('run-scan').onclick=()=>{
  try{if(!result)throw new Error('请先修正当前方案');const key=$('scan-key').value;if($('scan-start').value===''||$('scan-end').value==='')throw new Error('请填写扫描起点与终点');const points=scan(current,key,Number($('scan-start').value),Number($('scan-end').value));
    $('scan-results').innerHTML=`<p class="hint">扫描 ${fields[key][0]}，单位 ${fields[key][1]}。其余输入固定于当前方案；${assumptions}</p><div class="table-wrap"><table><thead><tr><th>输入</th><th>等熵焓降 kJ/kg</th><th>轴功率 kW</th><th>状态 / 原因</th></tr></thead><tbody>${points.map(p=>`<tr><td>${fmt(p.value,4)}</td><td>${p.error?'—':fmt(p.drop)}</td><td>${p.error?'—':fmt(p.power)}</td><td>${p.error||'有效'}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){$('scan-results').textContent=e.message;}
};
// Read-only diagnostics for reproducible UI acceptance; interactions still use the DOM.
window.__turbineLab={getState:()=>({ready:!!viewer,parameters:read(),params:read(),modelParameters:viewer?.p?{...viewer.p}:null,geometryValid,selected:viewer?.selected,selectedPart,geometry:viewer?.p?geometry(viewer.p):null,performance:result,result,baseline:baseline?{...baseline}:null,view:viewer?.state()})};
update();
