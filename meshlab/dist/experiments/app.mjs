import {definitions,isLinkage,defaults,validate,range,results,samples,advance,phaseFor,readouts,chartSeries,inputLabel,inputUnit,assemblySteps,applyPartMetadata,ANIMATION_SCALE} from './catalog.mjs';
import {LinkageViewer} from '../linkages/viewer.mjs';
import {MechanismViewer} from '../mechanisms/viewer.mjs';

const kind=document.body.dataset.mechanism,definition=definitions[kind],$=id=>document.getElementById(id);
const jack=kind==='scissor-jack',oscillating=['parallelogram','double-rocker'].includes(kind);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=v=>((v%360)+360)%360;
const fields=definition.fields,series=chartSeries(kind),metrics=readouts(kind),steps=assemblySteps[kind];
let params=defaults(kind),modelParameters={...params},input=definition.initial,phase=phaseFor(kind,params,input);
let data=samples(kind,params),result=results(kind,params,input,data),valid=true,playing=false,speed=1,direction=1;
let viewer,selectedPart=null,partFilter='all',mode='free',tab='explore',labelsOn=false,announcedAt=0;
const status=text=>$('status-message').textContent=text;
const fmt=(value,digits=1)=>Number.isFinite(value)?value.toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
const snapshotPart=part=>part&&Object.fromEntries(['id','name','description','spec','category','materialLabel'].map(key=>[key,part[key]||'']));
function state(){return{ready:!!viewer?.parts.length,kind,title:definition.title,params:{...params},modelParameters:{...modelParameters},geometryValid:valid,valid,result:valid&&result?structuredClone(result):null,selectedPart:snapshotPart(selectedPart),input,angle:input,playing,speed,direction,mode,tab,phase,range:range(kind,modelParameters),view:viewer?{...viewer.state(),playing,speed,animationScale:ANIMATION_SCALE,labelsOn,housingMode:$('housing-mode').value}:null};}
window.__experimentLab={getState:state};
// Keep the existing read-only diagnostics names for previous model checks.
window[isLinkage(kind)?'__linkageLab':'__mechanismLab']=window.__experimentLab;
function announce(force=false){const now=performance.now();if(force||now-announcedAt>250){announcedAt=now;window.dispatchEvent(new Event('experiment:statechange'));}}
function stopSpeech(){window.speechSynthesis?.cancel();$('speak').textContent='◖)) 朗读讲解';}
function select(part){
  stopSpeech();selectedPart=part||null;
  $('part-title').textContent=part?.name||'选择一个零件';$('part-description').textContent=part?.description||'点击模型或打开零件目录，查看结构、尺寸与作用。';
  $('part-spec').textContent=part?.spec||'';$('part-material').textContent=part?.materialLabel||'';
  $('part-index').textContent=part?String((viewer?.parts.indexOf(part)??0)+1).padStart(2,'0')+' / '+part.id.toUpperCase():'ASSEMBLY';
  if($('selection-label').textContent!==(part?.name||''))$('selection-label').textContent=part?.name||'';
  $('selection-label').hidden=!(labelsOn&&part&&part.group.visible);$('speak').disabled=!part;
  for(const b of $('parts-list').children){const active=b.dataset.part===part?.id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
  announce(true);
}
function renderParts(){
  if(!viewer)return;const query=$('part-search').value.trim().toLocaleLowerCase();$('part-count').textContent=viewer.parts.length;
  const parts=viewer.parts.filter(p=>(partFilter==='all'||p.category===partFilter)&&[p.name,p.description,p.spec].some(v=>v.toLocaleLowerCase().includes(query)));
  $('parts-list').replaceChildren(...parts.map(part=>{const b=document.createElement('button');b.type='button';b.className='part-item';b.dataset.part=part.id;const icon=document.createElement('span');icon.className='part-icon';icon.textContent=part.category==='housing'?'▤':'⚙';icon.setAttribute('aria-hidden','true');const name=document.createElement('span');name.textContent=part.name;const n=document.createElement('span');n.className='part-number';n.textContent=String(viewer.parts.indexOf(part)+1).padStart(2,'0');b.append(icon,name,n);b.onclick=()=>viewer.select(part.id);const active=selectedPart?.id===part.id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));return b;}));
  if(!parts.length){const e=document.createElement('p');e.className='empty-parts';e.textContent='没有匹配的零件。可清空搜索或切换到“全部”。';$('parts-list').append(e);}
}
function setRanges(){const r=range(kind,modelParameters);for(const id of ['angle','angle-number']){$(id).min=r.min;$(id).max=r.max;}$('angle-min').textContent=fmt(r.min,jack?1:0)+inputUnit(kind);$('angle-max').textContent=fmt(r.max,jack?1:0)+inputUnit(kind);}
function rangePaint(el){const span=Number(el.max)-Number(el.min);el.style.setProperty('--progress',span?(Number(el.value)-Number(el.min))/span*100+'%':'0%');}
function setMode(value){mode=value;playing=false;viewer?.restore();$('free-controls').hidden=value!=='free';$('assembly-controls').hidden=value!=='steps';for(const b of document.querySelectorAll('[data-mode]')){b.classList.toggle('active',b.dataset.mode===value);b.setAttribute('aria-pressed',String(b.dataset.mode===value));}syncPose();announce(true);status(value==='steps'?'已暂停运动，按下一步逐层查看装配关系。':'已复原装配，可旋转、点选或播放机构。');}
function syncPose(){
  const step=viewer?.step||0,amount=viewer?.amount||0,separated=!!(step||amount);
  $('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',(playing?'暂停':'播放')+definition.title);
  $('explode').value=amount*100;rangePaint($('explode'));$('explode-value').textContent=fmt(amount*100,0)+'%';
  $('step-number').textContent=String(step).padStart(2,'0')+' / 04';$('step-title').textContent=steps[step].title;$('step-copy').textContent=steps[step].copy;
  $('step-prev').disabled=!viewer||!step;$('step-next').disabled=!viewer||step===4;
  $('pose-status').textContent=amount?'自由展开 · '+fmt(amount*100,0)+'%':steps[step].title;
  $('mode-label').textContent=mode==='steps'?'逐步拆装':'结构探索';
  $('motion-state').textContent=!valid?'参数待修正':separated?'拆装中':playing?'演示中':'已暂停';
  for(const id of ['angle','angle-number','step-input','home-position','drive-phase','return-phase'])$(id).disabled=!valid||separated;
  $('drag-mode').disabled=!viewer||!valid||separated;$('download-parameters').disabled=!valid;$('download-data').disabled=!valid;
  $('selection-label').hidden=!(labelsOn&&selectedPart&&selectedPart.group.visible);
}
function update(){
  if(valid)result=results(kind,modelParameters,input,data);
  const shown=jack||oscillating?input:input<=360?input:wrap(input);
  $('angle').value=shown;rangePaint($('angle'));if(document.activeElement!==$('angle-number'))$('angle-number').value=shown.toFixed(jack?2:1);
  $('drive-metrics').replaceChildren(...metrics.map(([name,key,unit,digits])=>{const row=document.createElement('div'),label=document.createElement('span'),v=document.createElement('strong'),u=document.createElement('small');label.textContent=name;v.textContent=valid?fmt(result[key],digits):'—';u.textContent=unit;v.append(u);row.append(label,v);return row;}));
  $('phase-state').textContent=valid?(result.phase||'输入与输出由机构约束联动'):'输入无效，当前计算暂停；三维保留上一组有效尺寸。';
  const first=metrics[0];$('headline-value').textContent=(valid?fmt(result[first[1]],first[3]):'—')+(first[2]?' '+first[2]:'');$('headline-label').textContent=first[0];
  $('model-label').textContent=definition.subtitle+(!valid?' · 当前显示上一组有效模型':'');
  $('current-example').textContent=valid?'当前输入 '+fmt(shown,jack?2:1)+inputUnit(kind)+'：'+metrics.map(([n,key,u,d])=>n+' '+fmt(result[key],d)+' '+u).join('；')+'。':'请先修正参数，再查看当前工况示例。';
  if(kind==='quick-return'){$('timing').hidden=!valid;$('work-time').textContent='工作 '+(result.workTime===null?'停机':fmt(result.workTime,3)+' s');$('return-time').textContent='空回 '+(result.returnTime===null?'停机':fmt(result.returnTime,3)+' s');$('work-bar').style.width=result.workFraction*100+'%';}
  syncPose();drawChart();announce();
}
const colors=['#066bd8','#b16d28'];
function drawChart(){
  const canvas=$('motion-chart'),width=canvas.clientWidth,height=210;if(!width)return;const dpr=Math.min(devicePixelRatio,2);canvas.width=width*dpr;canvas.height=height*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.font='11px system-ui';
  const dark=matchMedia('(prefers-color-scheme:dark)').matches,ink=dark?'#b2bac8':'#687181',line=dark?'#3c4656':'#dbe0e7';c.fillStyle=ink;
  if(!valid){c.fillText('参数无效，请修正后继续比较运动曲线。',16,100);canvas.setAttribute('aria-label','参数无效，曲线暂停。');return;}
  const r=range(kind,modelParameters),values=data.flatMap(s=>series.map(([k])=>s[k]));let lo=Math.min(0,...values),hi=Math.max(0,...values);if(hi-lo<1){lo-=1;hi+=1;}else{const pad=(hi-lo)*.12;lo-=pad;hi+=pad;}
  const left=44,right=width-16,top=12,bottom=180,x=v=>left+(v-r.min)/(r.max-r.min)*(right-left),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  for(let i=0;i<=4;i++){const yy=lo+(hi-lo)*i/4;c.strokeStyle=line;c.lineWidth=1;c.beginPath();c.moveTo(left,y(yy));c.lineTo(right,y(yy));c.stroke();c.textAlign='right';c.fillStyle=ink;c.fillText(yy.toFixed(0),left-7,y(yy)+4);const xx=r.min+(r.max-r.min)*i/4;c.textAlign='center';c.fillText(xx.toFixed(jack?1:0)+inputUnit(kind),x(xx),203);}
  const shown=jack||oscillating?input:input<=360?input:wrap(input),current=results(kind,modelParameters,shown,data);
  for(const [i,[key]]of series.entries()){c.strokeStyle=colors[i];c.lineWidth=2.2;c.setLineDash(i?[6,4]:[]);c.beginPath();data.forEach((s,j)=>j?c.lineTo(x(s.input??s.angle),y(s[key])):c.moveTo(x(s.input??s.angle),y(s[key])));c.stroke();c.setLineDash([]);c.fillStyle=colors[i];c.beginPath();c.arc(x(shown),y(current[key]),4,0,Math.PI*2);c.fill();}
  c.strokeStyle=ink;c.lineWidth=.7;c.setLineDash([3,4]);c.beginPath();c.moveTo(x(shown),top);c.lineTo(x(shown),bottom);c.stroke();canvas.setAttribute('aria-label',definition.title+'运动曲线；'+inputLabel(kind)+' '+shown.toFixed(1)+inputUnit(kind)+'；'+series.map(([key,label,u])=>label+' '+fmt(current[key],2)+u).join('；'));
}
function rebuild(){
  const prior=selectedPart?.id||'input';
  if(viewer){viewer.build(modelParameters,input);applyPartMetadata(kind,viewer,modelParameters);viewer.setHousing($('housing-mode').value==='open'?'hidden':$('housing-mode').value);renderParts();viewer.select(viewer.parts.some(p=>p.id===prior)?prior:'input');}
  setRanges();update();
}
function setInput(value){if(!valid||!Number.isFinite(value))return;playing=false;const r=range(kind,modelParameters);input=clamp(value,r.min,r.max);phase=phaseFor(kind,modelParameters,input);viewer?.update(input);update();announce(true);}
try{
  const Viewer=isLinkage(kind)?LinkageViewer:MechanismViewer;
  viewer=new Viewer($('viewport'),kind,select,value=>setInput(value));viewer.draggablePartIds=isLinkage(kind)?['input','pins','slider']:kind==='geneva-drive'?['input','locking']:['input'];rebuild();$('loading').hidden=true;
}catch(error){console.error(definition.title+'三维初始化失败',error);viewer?.dispose();viewer=null;$('loading').textContent='三维视图需要 WebGL；下方参数、计算与资料仍可使用。';for(const id of ['explode','explode-all','assemble-all','home-view','front-view','top-view','fullscreen','open-parts','housing-mode','labels-toggle','joint-toggle'])$(id).disabled=true;}
$('chart-unit').textContent=series[0][2];$('chart-title').textContent=kind==='scotch-yoke'?'轭架与曲柄滑块位移对比':kind==='parallelogram'?'末端连杆姿态':kind==='ratchet-pawl'?'手柄与输出角度对比':kind==='scissor-jack'?'手柄转数与起升高度':'输入与输出关系';
$('chart-legend').innerHTML=series.map(([,name],i)=>`<span><i style="border-color:${colors[i]};border-style:${i?'dashed':'solid'}"></i>${name}</span>`).join('');
$('chart-caption').textContent=(oscillating?'横轴为输入摆角，不是时间；演示采用正弦往复驱动。':jack?'横轴为手柄圈数；到达行程边界后切换方向返回。':'横轴为一个输入周期内的转角。')+' 1× 为设定转速或频率的 20% 慢放，工况读数不随倍速改变。';
setRanges();update();
$('part-search').oninput=renderParts;for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{partFilter=b.dataset.filter;for(const other of document.querySelectorAll('[data-filter]')){other.classList.toggle('active',other===b);other.setAttribute('aria-pressed',String(other===b));}renderParts();};
function applyParameters(){
  params=Object.fromEntries(fields.map(f=>[f.key,$(f.key).value===''?NaN:Number($(f.key).value)]));playing=false;stopSpeech();
  try{validate(kind,params);}catch(error){valid=false;$('invalid-input').hidden=false;$('invalid-input').textContent=error.message+' 画面保留上一组有效模型，当前计算与导出已暂停。';update();announce(true);return;}
  const structural=fields.some(f=>f.key!=='rpm'&&params[f.key]!==modelParameters[f.key]);valid=true;$('invalid-input').hidden=true;modelParameters={...params};
  if(structural){setMode('free');const r=range(kind,modelParameters);input=clamp(input,r.min,r.max);phase=phaseFor(kind,modelParameters,input);data=samples(kind,modelParameters);rebuild();}
  else{if(viewer)viewer.p={...modelParameters};update();}
  announce(true);status(structural?'尺寸已更新，模型、读数和曲线保持联动。':'转速已更新，输入位置保持不变。');
}
let parameterFrame;
for(const f of fields){const number=$(f.key),slider=$(f.key+'-slider');number.oninput=()=>{cancelAnimationFrame(parameterFrame);if(number.value!==''&&Number.isFinite(Number(number.value)))slider.value=number.value;rangePaint(slider);applyParameters();};slider.addEventListener('input',()=>{number.value=slider.value;rangePaint(slider);cancelAnimationFrame(parameterFrame);parameterFrame=requestAnimationFrame(applyParameters);});}
$('reset-parameters').onclick=()=>{cancelAnimationFrame(parameterFrame);for(const f of fields){$(f.key).value=f.value;$(f.key+'-slider').value=f.value;rangePaint($(f.key+'-slider'));}input=definition.initial;phase=phaseFor(kind,defaults(kind),input);direction=1;$('reverse').textContent='方向 · 上升 ↑';setMode('free');applyParameters();viewer?.home();status('已恢复默认参数和完整装配。');};
for(const id of ['angle','angle-number'])$(id).oninput=e=>{const value=e.target.value;setInput(value===''?NaN:Number(value));};$('angle-number').onchange=update;
$('play').onclick=()=>{if(!valid){status('请先修正参数，再播放当前模型。');return;}if(!modelParameters.rpm){status('输入转速为 0，请提高转速。');return;}if(viewer&&(viewer.amount||viewer.step))setMode('free');if(jack&&advance(kind,modelParameters,{input,phase},0,speed,direction).atLimit){status('已到行程边界，请切换方向。');return;}playing=!playing;syncPose();announce(true);status(playing?'正在以设定工况的 20% 慢放。':'运动已暂停。');};
$('speed').oninput=e=>{speed=Number(e.target.value);$('speed-value').value=speed.toFixed(1)+'×';announce(true);};
$('explode').oninput=e=>{playing=false;viewer?.explode(Number(e.target.value)/100);syncPose();announce(true);status('自由展开 '+e.target.value+'%，运动已暂停。');};$('explode-all').onclick=()=>{playing=false;viewer?.explode(1);syncPose();announce(true);status('已全部展开，可点选零件查看结构与规格。');};$('assemble-all').onclick=()=>{playing=false;viewer?.restore();syncPose();announce(true);status('已复原装配，输入位置保持不变。');};
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>setMode(b.dataset.mode));for(const [id,delta]of [['step-prev',-1],['step-next',1]])$(id).onclick=()=>{playing=false;const next=clamp(viewer.step+delta,0,4);viewer.assembly(next);const chosen=steps[next].parts.find(id=>viewer.parts.some(p=>p.id===id));if(chosen)viewer.select(chosen);syncPose();announce(true);status(next?'拆装 '+next+' / 4：'+steps[next].title+'。':'已回到完整装配，输入位置保持不变。');};
$('home-view').onclick=()=>viewer?.home();$('front-view').onclick=()=>viewer?.view('front');$('top-view').onclick=()=>viewer?.view('top');$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.stage-shell').requestFullscreen();}catch{status('当前浏览器未允许全屏，可使用浏览器缩放查看。');}};
$('housing-mode').onchange=e=>{viewer?.setHousing(e.target.value==='open'?'hidden':e.target.value);syncPose();announce(true);};$('labels-toggle').onchange=e=>{labelsOn=e.target.checked;syncPose();};$('joint-toggle').onchange=e=>{if(viewer){viewer.labels=e.target.checked;$('joint-labels').hidden=!e.target.checked;viewer.render();}};
$('drag-mode').onclick=()=>{playing=false;viewer.setDragMode(!viewer.dragMode);$('drag-mode').setAttribute('aria-pressed',String(viewer.dragMode));status(viewer.dragMode?'拖动输入构件驱动机构；再次点击可恢复视角旋转。':'已恢复视角旋转。');syncPose();};
$('step-input').onclick=()=>setInput(jack?input+direction:clamp((oscillating?input:wrap(input))+15,range(kind,modelParameters).min,range(kind,modelParameters).max));$('home-position').onclick=()=>setInput(range(kind,modelParameters).min);
$('reverse').onclick=()=>{playing=false;direction*=-1;$('reverse').textContent=direction>0?'方向 · 上升 ↑':'方向 · 下降 ↓';syncPose();announce(true);};$('drive-phase').onclick=()=>setInput(90);$('return-phase').onclick=()=>setInput(270);
function showTab(value){playing=false;tab=value;for(const b of document.querySelectorAll('[data-tab]')){const active=b.dataset.tab===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));$(b.dataset.tab).hidden=!active;}if(value==='explore'){viewer?.fit();drawChart();}syncPose();announce(true);}
for(const b of document.querySelectorAll('[data-tab],[data-go]'))b.addEventListener('click',()=>showTab(b.dataset.tab||b.dataset.go));$('mechanism').onchange=e=>location.href=e.target.value+'.html';
$('speak').onclick=()=>{if(!selectedPart)return;if(!('speechSynthesis'in window)){status('当前浏览器不支持语音朗读，文字说明仍可阅读。');return;}if(speechSynthesis.speaking){stopSpeech();return;}const utterance=new SpeechSynthesisUtterance(selectedPart.name+'。'+selectedPart.description+'。'+selectedPart.spec);utterance.lang='zh-CN';utterance.rate=.95;utterance.onend=()=>$('speak').textContent='◖)) 朗读讲解';utterance.onerror=()=>{$('speak').textContent='◖)) 朗读讲解';status('中文语音暂不可用，文字讲解仍可阅读。');};speechSynthesis.speak(utterance);$('speak').textContent='■ 停止朗读';};
function download(text,type,extension){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=kind+'-experiment.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('download-parameters').onclick=()=>{if(valid)download(JSON.stringify({mechanism:kind,title:definition.title,parameters:modelParameters,parameterUnits:Object.fromEntries(fields.map(f=>[f.key,f.unit])),input,inputUnit:inputUnit(kind),result,selectedPart:snapshotPart(selectedPart),animationScale:ANIMATION_SCALE,assumptions:definition.note},null,2),'application/json','json');};
$('download-data').onclick=()=>{if(!valid)return;const columns=[['input','输入',inputUnit(kind)],...series];const header=columns.map(([key,label,u])=>key+'_'+u);download('\ufeff'+[header.join(','),...data.map(s=>columns.map(([key])=>Number(key==='input'?(s.input??s.angle):s[key]).toFixed(6)).join(','))].join('\r\n'),'text/csv;charset=utf-8','csv');};
new ResizeObserver(drawChart).observe($('motion-chart'));
new ResizeObserver(()=>{document.querySelector('.stage-shell').style.setProperty('--deck-clearance',document.querySelector('.control-deck').getBoundingClientRect().height+17+'px');viewer?.fit();}).observe(document.querySelector('.control-deck'));
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',drawChart);document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;stopSpeech();syncPose();}});
let previous=0,frame;function animate(now){const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;if(playing){const next=advance(kind,modelParameters,{input,phase},dt,speed,direction);input=next.input;phase=next.phase;if(next.atLimit){playing=false;status('已到达行程边界，请切换方向继续。');}viewer?.update(input);update();}frame=requestAnimationFrame(animate);}frame=requestAnimationFrame(animate);window.addEventListener('pagehide',e=>{playing=false;stopSpeech();if(!e.persisted){cancelAnimationFrame(frame);cancelAnimationFrame(parameterFrame);viewer?.dispose();}});
status('模型已就绪。点击零件或打开目录，调节下方参数可即时观察。');
