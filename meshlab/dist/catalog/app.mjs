import {models,modelFields,defaultParameters,validateParameters,parseParameterValue} from './registry.mjs';
import {CatalogViewer} from './viewer.mjs';
const $=id=>document.getElementById(id),text=(id,value)=>{const el=$(id);if(el&&el.textContent!==String(value))el.textContent=String(value);};
const fmt=x=>typeof x==='number'?(Number.isFinite(x)?Number(x.toFixed(3)).toLocaleString('zh-CN'):'—'):String(x??'—');
let model,params={},modelParameters=null,viewer,result=null,selectedPart=null,valid=false,partFilter='all',mode='free',step=0;
const announce=()=>window.dispatchEvent(new Event('catalog:statechange')),status=s=>text('status-message',s);
function fieldValue(f){return parseParameterValue(f,$(f.key).value);}
function syncRange(f){const r=$(f.key+'-slider');if(r){r.value=$(f.key).value;r.style.setProperty('--progress',100*(Number(r.value)-f.min)/(f.max-f.min)+'%');}}
function buildFields(){
 $('geometry-fields').replaceChildren(...modelFields(model).map(f=>{
  const box=document.createElement('div');box.className='parameter-field';const label=document.createElement('label');label.htmlFor=f.key;label.textContent=f.label+(f.unit?' / '+f.unit:'');box.append(label);
  if(f.options){const select=document.createElement('select');select.id=f.key;for(const [value,name]of f.options){const o=new Option(name,String(value));select.add(o);}select.value=String(params[f.key]);select.onchange=apply;box.append(select);}
  else {const input=document.createElement('input');input.type='number';input.id=f.key;input.min=f.min;input.max=f.max;input.step=f.step||1;input.value=params[f.key];input.oninput=()=>{syncRange(f);apply();};const range=document.createElement('input');range.type='range';range.id=f.key+'-slider';range.min=f.min;range.max=f.max;range.step=f.step||1;range.value=params[f.key];range.setAttribute('aria-label','调节'+f.label);let frame;range.oninput=()=>{input.value=range.value;syncRange(f);cancelAnimationFrame(frame);frame=requestAnimationFrame(apply);};const hint=document.createElement('small');hint.textContent=`${f.min}–${f.max} ${f.unit||''}`;box.append(input,range,hint);}
  return box;
 }));for(const f of modelFields(model))syncRange(f);
}
function apply(){
 params=Object.fromEntries(modelFields(model).map(f=>[f.key,fieldValue(f)]));
 try{
  validateParameters(model,params);const rpmOnly=modelParameters&&Object.keys(params).every(k=>k==='inputRPM'||params[k]===modelParameters[k]);
  if(viewer){if(rpmOnly)viewer.setParameters(params);else {step=0;viewer.build(model,params);renderParts();}result=viewer.result;}
  else result=model.sample(params,0);
  modelParameters={...params};valid=true;$('invalid-input').hidden=true;renderMotion();
 }catch(error){valid=false;viewer?.setPlaying(false);$('invalid-input').hidden=false;text('invalid-input',error.message+'。保留上一组有效模型。');status('请修正参数后继续。');}
 syncControls();announce();
}
function renderMotion(){
 const metrics=result?.metrics||[],host=$('drive-metrics');
 if(host.children.length!==metrics.length){host.replaceChildren(...metrics.map(()=>{const el=document.createElement('div');el.append(document.createElement('span'),document.createElement('strong'),document.createElement('small'));return el;}));}
 metrics.forEach((m,i)=>{const n=host.children[i];n.children[0].textContent=m.label;n.children[1].textContent=fmt(m.value);n.children[2].textContent=m.unit||'';});
 text('contact-summary',(viewer?.playing?'正在运动。':'已暂停。')+(result?.status||'')+' 1× 演示为设定输入转速的20%慢放。');
}
function onMotion(s){if(!model)return;result=s.result||result;if(valid)renderMotion();syncControls();announce();}
function syncControls(){if(!viewer)return;text('play',viewer.playing?'Ⅱ':'▶');$('play').setAttribute('aria-label',viewer.playing?'暂停机构运动':'播放机构运动');$('explode').value=viewer.amount*100;$('explode').style.setProperty('--progress',viewer.amount*100+'%');text('explode-value',Math.round(viewer.amount*100)+'%');text('step-number',String(step).padStart(2,'0')+' / 04');text('step-title',step?'展开 '+step*25+'%':'完整装配');text('step-copy','用分步展开观察各组件的装配关系。');$('step-prev').disabled=step===0;$('step-next').disabled=step===4;}
function renderParts(){
 if(!viewer)return;const query=$('part-search').value.trim(),all=viewer.parts.filter(p=>!p.hiddenInList);text('part-count',all.length);const shown=all.filter(p=>(p.name.includes(query)||(p.description||'').includes(query))&&(partFilter==='all'||p.category===partFilter));
 $('parts-list').replaceChildren(...shown.map((p,i)=>{const b=document.createElement('button');b.type='button';b.className='part-item';b.dataset.part=p.id;b.textContent=String(i+1).padStart(2,'0')+'　'+p.name;b.classList.toggle('active',selectedPart?.id===p.id);b.onclick=()=>viewer.select(p.id);return b;}));
}
function selectPart(p){selectedPart={id:p.id,name:p.name,description:p.description||''};text('part-title',p.name);text('part-description',p.description||'');text('part-index',p.id.toUpperCase());text('selection-label',p.name);for(const el of $('parts-list').children)el.classList.toggle('active',el.dataset.part===p.id);announce();}
function loadModel(id,push=false){
 model=models.find(m=>m.id===id)||models[0];if(!model)throw new Error('机构目录为空');params=defaultParameters(model);modelParameters=null;selectedPart=null;result=null;valid=false;step=0;
 document.title=model.title+'实验 · meshlab';document.querySelector('h1').textContent=model.title;text('model-label',model.description);text('ratio-count',model.number);text('parameter-hint',model.description);text('model-limits',model.limits);text('footer-model',model.title+' · 参数化教学模型');text('principle-title',model.title+'的运动原理');text('principle-description',model.description);text('reference-description',model.description);text('reference-limits',model.limits);document.querySelector('.material-label').textContent='模型 / '+model.title;document.querySelector('.chat-header h2').textContent='一起读懂'+model.title;document.querySelector('#chat-welcome > p').textContent=model.description;document.querySelector('.viewer-panel').setAttribute('aria-label','三维'+model.title+'模型');
 $('principle-grid').replaceChildren(...(model.principle||[]).map(p=>{const a=document.createElement('article'),h=document.createElement('h3'),t=document.createElement('p');h.textContent=p.title;t.textContent=p.text;a.append(h,t);if(p.formula){const f=document.createElement('div');f.className='formula';f.textContent=p.formula;a.append(f);}return a;}));
 $('reference-links').replaceChildren(...(model.sources||[]).map(s=>{const li=document.createElement('li'),a=document.createElement('a');a.textContent=s.title;a.href=s.url;a.target='_blank';a.rel='noopener';li.append(a);return li;}));
 const questions=model.questions||['这个机构怎样传递运动？','哪些参数会改变输出？','如何观察选中的零件？'];document.querySelectorAll('.chat-suggestions button').forEach((b,i)=>b.textContent=questions[i]||questions[0]);
 $('model-select').value=model.id;buildFields();setMode('free');apply();if(push){const url=new URL(location.href);url.searchParams.set('model',model.id);history.replaceState({},'',url);$('chat-reset').click();$('workspace').focus({preventScroll:true});document.querySelector('.intro').scrollIntoView({block:'start'});}status(model.title+'已就绪。点击播放或调整下方参数。');
}
function setMode(value){mode=value;step=0;$('free-controls').hidden=value!=='free';$('assembly-controls').hidden=value!=='steps';for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('active',b.dataset.mode===value);viewer?.restore();syncControls();}
function showTab(id){for(const b of document.querySelectorAll('[data-tab]')){const active=b.dataset.tab===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));$(b.dataset.tab).hidden=!active;}if(id!=='explore')viewer?.setPlaying(false);}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode);
for(const b of document.querySelectorAll('[data-tab],[data-go]'))b.addEventListener('click',()=>showTab(b.dataset.tab||b.dataset.go));
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{partFilter=b.dataset.filter;for(const other of document.querySelectorAll('[data-filter]'))other.classList.toggle('active',other===b);renderParts();};
$('part-search').oninput=renderParts;
$('play').onclick=()=>{if(!valid){status('请修正参数后播放。');return;}if(viewer?.amount){status('请先复原装配再播放。');return;}if(!params.inputRPM){status('输入转速为0，请调高转速。');return;}viewer?.setPlaying(!viewer.playing);};
$('speed').oninput=e=>{if(viewer)viewer.speed=Number(e.target.value);text('speed-value',Number(e.target.value).toFixed(1)+'×');};
$('explode').oninput=e=>viewer?.setExplode(Number(e.target.value)/100);$('explode-all').onclick=()=>viewer?.setExplode(1);$('assemble-all').onclick=()=>{step=0;viewer?.restore();};
for(const [id,delta]of [['step-next',1],['step-prev',-1]])$(id).onclick=()=>{step=Math.max(0,Math.min(4,step+delta));viewer?.setExplode(step/4);syncControls();};
$('home-view').onclick=()=>viewer?.home();$('front-view').onclick=()=>viewer?.view('front');$('top-view').onclick=()=>viewer?.view('top');
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.viewer-panel').requestFullscreen();}catch{status('浏览器当前未允许全屏。');}};
$('housing-mode').onchange=e=>viewer?.setHousing(e.target.value);$('labels-toggle').onchange=e=>{if(viewer){viewer.labelsOn=e.target.checked;viewer.render();}};
$('reset-parameters').onclick=()=>{params=defaultParameters(model);buildFields();modelParameters=null;apply();status('已恢复默认参数与初始相位。');};
$('model-select').onchange=e=>loadModel(e.target.value,true);
$('speak').onclick=()=>{if(!selectedPart||!window.speechSynthesis)return;if(speechSynthesis.speaking){speechSynthesis.cancel();return;}const u=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description);u.lang='zh-CN';speechSynthesis.speak(u);};
for(const m of models)$('model-select').add(new Option(String(m.number).padStart(2,'0')+' · '+m.title,m.id));
try{viewer=new CatalogViewer($('viewport'),selectPart,onMotion);$('loading').hidden=true;}catch(error){console.error('三维视图启动失败',error);$('loading').hidden=true;$('webgl-error').hidden=false;}
window.__catalogLab={getState:()=>({model:model&&{id:model.id,number:model.number,title:model.title},parameters:{...params},modelParameters:modelParameters&&{...modelParameters},selectedPart:selectedPart&&{...selectedPart},result:result&&{metrics:result.metrics,status:result.status},phase:viewer?.phase||0,playing:!!viewer?.playing,geometryValid:valid,limits:model?.limits,description:model?.description,principle:model?.principle})};
document.addEventListener('visibilitychange',()=>{if(document.hidden)viewer?.setPlaying(false);});window.addEventListener('pagehide',()=>{viewer?.setPlaying(false);window.speechSynthesis?.cancel();});
loadModel(new URLSearchParams(location.search).get('model'));
