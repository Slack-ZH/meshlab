import {definitions,defaults,validate,solve,summary,angleRange,advance,phaseForAngle,clamp} from './mechanics.mjs';
import {LinkageViewer} from './viewer.mjs';

const kind=document.body.dataset.mechanism,definition=definitions[kind],$=id=>document.getElementById(id);
let params=defaults(kind),angle=definition.initial,phase=phaseForAngle(kind,params,angle),playing=false,speed=1,valid=true,viewer,tab='explore',mode='free';
let analysis=summary(kind,params),result=solve(kind,params,angle);
const oscillating=['parallelogram','double-rocker'].includes(kind),linear=['scotch-yoke','quick-return'].includes(kind);
const icon=(path)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const icons={home:icon('<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>'),front:icon('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="4"/>'),top:icon('<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>'),full:icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>')};
const steps=['完整装配','取下铰链销与挡圈','分离连杆与滑动件','移开输入与输出构件','分离导向与支承'];
document.title=definition.title+' · 啮合实验室';
$('app').innerHTML=`
<a class="skip" href="#workspace">跳到实验模型</a>
<header class="topbar"><a class="brand" href="./"><span class="brand-mark">⚙</span><span>啮合实验室<small>meshlab</small></span></a><nav class="tabs" aria-label="实验内容"><button data-tab="explore" aria-pressed="true" class="active">◇ 探索</button><button data-tab="principle" aria-pressed="false">⌁ 原理</button><button data-tab="resources" aria-pressed="false">▤ 资料</button></nav><a class="all-link" href="./#linkage-experiments">全部实验 ↗</a></header>
<main>
<section class="intro"><div><p class="eyebrow">连杆机构实验 / ${definition.number}</p><h1>${definition.title}</h1><p class="intro-copy">${definition.subtitle}</p></div><label class="switcher">切换机构<select id="mechanism" aria-label="切换机构">${Object.entries(definitions).map(([id,d])=>`<option value="${id}" ${id===kind?'selected':''}>${d.title}</option>`).join('')}</select></label></section>
<section id="explore">
<div id="workspace" class="workspace" tabindex="-1"><div class="stage-column">
<section class="stage-shell" aria-label="${definition.title}三维实验"><div class="viewer-panel">
<div class="viewer-top"><span class="stage-label"><i></i> 三维装配 <small>mm</small></span><div class="segmented"><button class="active" data-mode="free" aria-pressed="true">自由探索</button><button data-mode="steps" aria-pressed="false">逐步拆装</button></div></div>
<div id="viewport"><p id="loading">正在装配机构…</p></div>
<div id="joint-labels" hidden>${['A','B','C','D','O'].map(k=>`<span data-joint="${k}">${k}</span>`).join('')}</div>
<div class="view-tools"><button id="home-view" aria-label="恢复默认视角" title="默认视角">${icons.home}</button><button id="front-view" aria-label="正视" title="正视">${icons.front}</button><button id="top-view" aria-label="俯视" title="俯视">${icons.top}</button><button id="fullscreen" aria-label="全屏模型" title="全屏">${icons.full}</button></div>
<div class="view-hint"><span id="gesture-hint">拖动旋转 · 双指 / 滚轮缩放 · 点击选取</span></div><span id="selection-label" hidden></span>
</div>
<div class="control-deck"><div class="motion-controls"><button id="play" class="play-button" aria-label="播放机构运动">▶</button><label>播放速度 <output id="speed-value">1.0×</output><input id="speed" type="range" min="0.2" max="2" step="0.1" value="1" aria-label="播放倍速"></label></div><div id="free-controls"><label>爆炸展开 <output id="explode-value">0%</output><input id="explode" type="range" min="0" max="100" value="0" aria-label="爆炸展开比例"></label><button id="explode-all">展开</button><button id="assemble-all">复原</button></div><div id="assembly-controls" hidden><p><small id="step-number">00 / 04</small><strong id="step-title">完整装配</strong></p><button id="step-prev" disabled>上一步</button><button id="step-next">下一步</button></div></div>
</section><p id="status" class="status" role="status">模型已就绪。选择播放，或拖动下方角度滑块。</p>
<div class="drive-strip"><button id="drag-mode" aria-pressed="false">拖动输入杆</button><label><input type="checkbox" id="labels"> 标注铰点</label><label class="housing-label">支承 <select id="housing"><option value="solid">完整结构</option><option value="transparent">透明支承</option><option value="hidden">隐藏支承</option></select></label></div>
</div><aside class="inspector"><div class="inspector-head"><h2>零件解读</h2><span id="part-count"></span></div><div class="detail"><p id="part-code" class="eyebrow">ASSEMBLY</p><h3 id="part-name">从一个零件开始</h3><p id="part-description">点击三维零件，或在下方目录中选择，查看它在机构中的作用。</p></div><div id="part-list" class="part-list" aria-label="零件目录"></div><div class="try-card"><p class="eyebrow">动手试一试</p><p>${definition.prompt}</p></div></aside></div>
<div class="experiment-grid"><section class="card motion-card"><div class="card-heading"><div><p class="eyebrow">观察运动</p><h2>${oscillating?'摆角与姿态':'转角与位移'}</h2></div><span id="motion-state" class="pill">已暂停</span></div><div class="angle-row"><label for="angle">输入${oscillating?'摆角':'转角'}</label><span><input id="angle-number" type="number" step="0.1" value="${angle}" aria-label="输入角度数值"> °</span></div><input id="angle" type="range" step="0.1" value="${angle}" aria-label="拖动输入角度"><div class="range-labels"><span id="angle-min"></span><span id="angle-max"></span></div><div id="metrics" class="metrics"></div><div id="timing" hidden><div class="timing-labels"><span id="work-time"></span><span id="return-time"></span></div><div class="timing-track"><span id="work-bar">工作</span><span>空回</span></div></div><div class="chart-heading"><h3 id="chart-title"></h3><span id="chart-unit"></span></div><canvas id="chart" role="img"></canvas><div id="chart-legend" class="chart-legend"></div><p id="chart-copy" class="hint"></p></section>
<section class="card parameters"><div class="card-heading"><div><p class="eyebrow">改变一个条件</p><h2>参数调节</h2></div><button id="reset">恢复默认</button></div><form id="parameter-form" novalidate>${definition.fields.map(f=>`<label class="parameter-field" for="param-${f.key}"><span>${f.label}</span><span class="parameter-input"><input type="number" id="param-${f.key}" name="${f.key}" min="${f.min}" max="${f.max}" step="1" value="${f.value}" required><small>${f.unit}</small></span><small>${f.min}–${f.max} ${f.unit}</small></label>`).join('')}<p id="parameter-error" class="error" role="alert" hidden></p><button class="primary" type="submit">应用参数</button></form><p class="hint">输入后点击“应用参数”。几何参数变化会重新装配；仅改变转速保留当前角度。</p><div class="formula"><strong>本次观察</strong><p>${definition.task}</p></div></section></div>
</section>
<section id="principle" class="reading" hidden><p class="eyebrow">${definition.english}</p><h2>从约束关系，读懂运动。</h2><div class="reading-grid"><article class="card"><h3>运动关系</h3><p>${definition.explanation}</p><pre>${definition.formula}</pre></article><article class="card"><h3>跟着模型做一次实验</h3><p>${definition.prompt}</p><button data-go="explore" class="primary">回到模型</button></article><article class="card"><h3>模型范围</h3><p>${definition.note}</p><p>所有尺寸为毫米，角度为度。刚性构件按平面运动求解，三维厚度、轴承与紧固件用于展示装配，不作为制造图纸。</p></article><article class="card"><h3>如何读图</h3><p>${kind==='quick-return'?'曲线横轴为匀速曲柄转角，因此也对应一个周期的时间。读数显示真实输入转速下的工作与空回用时。':kind==='scotch-yoke'?'蓝色实线是轭架位移，橙色虚线是同半径曲柄滑块位移。两者均从右侧死点量起，行程都是 2r。':oscillating?'横轴为输入摆角，并非时间。往复演示使用正弦规律驱动输入杆；输出曲线通过机构闭合计算。':'横轴为输入曲柄转角，纵轴为输出摇杆相对固定机架的角度；一个输入周期内，摇杆完成一次往返。'}</p><p>蓝色高亮只表示当前选中件。拆装会暂停运动；复原后保留拆装前的角度。</p></article></div></section>
<section id="resources" class="reading" hidden><p class="eyebrow">实验资料</p><h2>把观察结果带走。</h2><div class="reading-grid"><article class="card"><h3>当前实验参数</h3><p>包含已应用尺寸、输入角度、机构类型、计算结果和单位。</p><button id="download-json" class="primary">下载参数 JSON</button></article><article class="card"><h3>完整运动采样</h3><p>导出当前参数下 361 个输入角度的位移或输出角度数据，可用 Excel 绘图核对。</p><button id="download-csv" class="primary">下载曲线 CSV</button></article><article class="card"><h3>公式与参考</h3><p>本实验以几何约束直接求解。下列教学资料可用于核对四杆分类、滑块运动及急回原理。</p><ul><li><a href="https://ingmec.ual.es/tmm/L01_03a_four_bars.html" target="_blank" rel="noopener">University of Almería · 四杆机构</a></li><li><a href="https://www.mechref.org/md/Planar_mechanisms/" target="_blank" rel="noopener">Mechanical Engineering Reference · 平面机构</a></li><li><a href="https://symplectomorphism.github.io/teaching/ug_courses/kinematics/chapter04.html" target="_blank" rel="noopener">Aykut C. Satici · 滑块与急回机构</a></li></ul></article><article class="card"><h3>实验说明</h3><p>${definition.note}</p><p>输出文件记录已应用参数。未通过校验的输入不会覆盖当前模型或导出结果。</p></article></div></section>
</main><footer><span>啮合实验室 / 看见结构，理解机械。</span><span>${definition.english} · 参数化教学模型</span></footer>`;

function status(text){$('status').textContent=text;}
function select(part) {
  $('part-code').textContent=part?part.id.toUpperCase():'ASSEMBLY';$('part-name').textContent=part?.name||'从一个零件开始';
  $('part-description').textContent=part?.description||'点击三维零件，或在目录中选择，查看结构与作用。';
  $('selection-label').hidden=!part;$('selection-label').textContent=part?.name||'';
  for(const button of $('part-list').children){const active=button.dataset.part===part?.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
}
function listParts() {
  $('part-count').textContent=viewer.parts.length+' 个组件';
  $('part-list').replaceChildren(...viewer.parts.map((part,i)=>{const button=document.createElement('button');button.dataset.part=part.id;button.setAttribute('aria-pressed','false');button.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${part.name}`;button.onclick=()=>viewer.select(part.id);return button;}));
}
function build(){viewer?.build(params,angle);if(viewer)listParts();select(null);setRange();update();}
function setRange(){const range=angleRange(kind,params);for(const id of ['angle','angle-number']){$(id).min=range.min.toFixed(5);$(id).max=range.max.toFixed(5);}$('angle-min').textContent=range.min.toFixed(1)+'°';$('angle-max').textContent=range.max.toFixed(1)+'°';}
function setAngle(value){if(!Number.isFinite(value))return;const range=angleRange(kind,params);angle=clamp(value,range.min,range.max);phase=phaseForAngle(kind,params,angle);viewer?.update(angle);update();}
function pause(){playing=false;update();}
function syncPose(){
  $('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'暂停机构运动':'播放机构运动');
  const separated=viewer&&(viewer.amount||viewer.step);$('motion-state').textContent=separated?'拆装中':playing?(result.phase||'演示中'):'已暂停';
  $('angle').disabled=!!separated;$('angle-number').disabled=!!separated;$('drag-mode').disabled=!!separated||!viewer;
  $('explode').value=(viewer?.amount||0)*100;$('explode-value').value=Math.round((viewer?.amount||0)*100)+'%';
  const step=viewer?.step||0;$('step-number').textContent=String(step).padStart(2,'0')+' / 04';$('step-title').textContent=steps[step];$('step-prev').disabled=!step;$('step-next').disabled=step===4;
}
const metric=(label,value,unit='')=>`<div><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`;
const fmt=(x,n=1)=>Number.isFinite(x)?x.toFixed(n):'—';
function update(){
  result=solve(kind,params,angle);$('angle').value=angle;$('angle-number').value=angle.toFixed(1);syncPose();
  let html='';
  if(kind==='scotch-yoke')html=metric('轭架位移',fmt(result.displacement),'mm')+metric('曲柄滑块位移',fmt(result.comparison),'mm')+metric('两者差值',fmt(result.comparison-result.displacement,2),'mm');
  else if(kind==='quick-return')html=metric('滑枕位移',fmt(result.displacement),'mm')+metric('急回系数 K',fmt(result.ratio,3))+metric('总行程',fmt(result.stroke),'mm');
  else if(kind==='parallelogram')html=metric('末端连杆姿态',fmt(result.couplerAngle),'°')+metric('灯头抬升高度',fmt(result.height),'mm')+metric('右臂角度',fmt(result.outputAngle),'°');
  else html=metric('输出摇杆角度',fmt(result.outputAngle),'°')+metric('最小输出角',fmt(analysis.min),'°')+metric('最大输出角',fmt(analysis.max),'°');
  $('metrics').innerHTML=html;
  if(kind==='quick-return'){$('timing').hidden=false;$('work-time').textContent='工作 '+(result.workTime===null?'停机':fmt(result.workTime,3)+' s');$('return-time').textContent='空回 '+(result.returnTime===null?'停机':fmt(result.returnTime,3)+' s');$('work-bar').style.width=result.workFraction*100+'%';}
  drawChart();
}
const series=kind==='scotch-yoke'?[['displacement','轭架','#066bd8'],['comparison','曲柄滑块','#b16d28']]:kind==='parallelogram'?[['couplerAngle','末端连杆姿态','#066bd8']]:linear?[['displacement','滑枕位移','#066bd8']]:[['outputAngle','输出摇杆角度','#066bd8']];
function drawChart(){
  if(!chartReady)return;
  const canvas=$('chart'),w=canvas.clientWidth,h=210,dpr=Math.min(devicePixelRatio,2);if(!w)return;canvas.width=w*dpr;canvas.height=h*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const dark=matchMedia('(prefers-color-scheme:dark)').matches,text=dark?'#aeb8c9':'#687181',line=dark?'#354050':'#dbe0e7';
  const range=angleRange(kind,params),vals=analysis.data.flatMap(v=>series.map(([key])=>v[key]));let lo=Math.min(0,...vals),hi=Math.max(...vals);if(hi-lo<1){lo=-1;hi=1;}else{const margin=(hi-lo)*.12;lo-=margin;hi+=margin;}
  const left=44,right=w-16,top=12,bottom=h-30,px=x=>left+(x-range.min)/(range.max-range.min)*(right-left),py=y=>bottom-(y-lo)/(hi-lo)*(bottom-top);
  ctx.font='11px system-ui';ctx.lineWidth=1;
  for(let i=0;i<5;i++){const y=lo+(hi-lo)*i/4;ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(left,py(y));ctx.lineTo(right,py(y));ctx.stroke();ctx.fillStyle=text;ctx.textAlign='right';ctx.fillText(y.toFixed(0),left-7,py(y)+4);}
  for(let i=0;i<=4;i++){const x=range.min+(range.max-range.min)*i/4;ctx.textAlign='center';ctx.fillStyle=text;ctx.fillText(x.toFixed(0)+'°',px(x),h-9);}
  for(const [index,[key,,color]]of series.entries()) {ctx.strokeStyle=color;ctx.lineWidth=2.3;ctx.setLineDash(index?[6,4]:[]);ctx.beginPath();analysis.data.forEach((p,i)=>i?ctx.lineTo(px(p.angle),py(p[key])):ctx.moveTo(px(p.angle),py(p[key])));ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(px(angle),py(result[key]),4,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();}
  ctx.strokeStyle=text;ctx.lineWidth=.8;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(px(angle),top);ctx.lineTo(px(angle),bottom);ctx.stroke();
  canvas.setAttribute('aria-label',$('chart-title').textContent+'；当前输入 '+angle.toFixed(1)+'°，'+series.map(([key,name])=>name+' '+result[key].toFixed(2)+(linear?'毫米':'度')).join('；'));
}
let chartReady=true;
$('chart-title').textContent=kind==='scotch-yoke'?'位移曲线对比':kind==='parallelogram'?'末端姿态保持':kind==='quick-return'?'一个周期的滑枕位移':'输入角 → 输出角';
$('chart-unit').textContent=linear?'位移 / mm':'角度 / °';
$('chart-legend').innerHTML=series.map(([,name,color],i)=>`<span><i style="border-color:${color};border-style:${i?'dashed':'solid'}"></i>${name}</span>`).join('');
$('chart-copy').textContent=oscillating?'横轴：输入摆角。演示为正弦往复驱动，曲线不是时间曲线。':kind==='scotch-yoke'?'相同半径与转角，右侧死点为零，向左为正。虚线使用当前对比连杆长度。':'横轴：输入曲柄转角。1× 按设置转速播放，时间读数不受倍速影响。';
try {viewer=new LinkageViewer($('viewport'),kind,select,value=>{playing=false;setAngle(value);status('正在手动驱动输入杆。');});build();$('loading').remove();}
catch(error){console.error(error);$('loading').textContent='三维视图未能启动。请使用支持 WebGL 的浏览器；下方运动计算仍可使用。';viewer?.dispose();viewer=null;for(const el of document.querySelectorAll('.view-tools button,.segmented button,#drag-mode,#explode,#explode-all,#assemble-all,#housing,#labels'))el.disabled=true;}
setRange();update();
$('mechanism').onchange=e=>location.href=e.target.value+'.html';
for(const id of ['angle','angle-number'])$(id).oninput=e=>{const value=e.target.value;playing=false;setAngle(value===''?NaN:Number(value));};
$('angle-number').onchange=()=>update();
$('play').onclick=()=>{if(!valid){status('请先应用有效参数，或恢复默认。');return;}if(!params.rpm){status('当前转速为 0，请提高转速后应用参数。');return;}if(viewer&&(viewer.amount||viewer.step)){viewer.restore();setMode('free');}playing=!playing;syncPose();status(playing?(oscillating?'输入杆在演示范围内平滑往复。':'正在按输入转速演示。'):'运动已暂停。');};
$('speed').oninput=e=>{speed=Number(e.target.value);$('speed-value').value=speed.toFixed(1)+'×';};
$('explode').oninput=e=>{pause();viewer?.explode(Number(e.target.value)/100);syncPose();status('沿铰链轴线展开。复原后保留当前角度。');};
$('explode-all').onclick=()=>{pause();viewer?.explode(1);syncPose();status('已全部展开，可旋转查看各组件的装配层次。');};
$('assemble-all').onclick=()=>{pause();viewer?.restore();syncPose();status('已复原装配，角度保持不变。');};
function setMode(value){pause();mode=value;viewer?.restore();$('free-controls').hidden=value!=='free';$('assembly-controls').hidden=value!=='steps';for(const b of document.querySelectorAll('[data-mode]')){b.classList.toggle('active',b.dataset.mode===value);b.setAttribute('aria-pressed',String(b.dataset.mode===value));}syncPose();}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode);
for(const [id,delta]of [['step-prev',-1],['step-next',1]])$(id).onclick=()=>{pause();viewer?.assembly(viewer.step+delta);syncPose();status(steps[viewer?.step||0]+'。可按上一步反向装配。');};
$('drag-mode').onclick=()=>{pause();const active=!viewer.dragMode;viewer.setDragMode(active);$('drag-mode').setAttribute('aria-pressed',String(active));$('gesture-hint').textContent=active?'拖动输入杆驱动 · 角度滑块也可操作':'拖动旋转 · 双指 / 滚轮缩放 · 点击选取';status(active?'已进入驱动模式。拖动输入杆；再次点击按钮可恢复视角旋转。':'已恢复视角旋转。');};
$('housing').onchange=e=>viewer?.setHousing(e.target.value);
$('labels').onchange=e=>{viewer.labels=e.target.checked;$('joint-labels').hidden=!e.target.checked;viewer.render();};
$('home-view').onclick=()=>viewer?.home();$('front-view').onclick=()=>viewer?.view('front');$('top-view').onclick=()=>viewer?.view('top');
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.stage-shell').requestFullscreen();}catch{status('当前浏览器不支持全屏，可使用浏览器缩放查看。');}};
function showTab(value){tab=value;pause();for(const id of ['explore','principle','resources'])$(id).hidden=id!==value;for(const b of document.querySelectorAll('[data-tab]')){b.classList.toggle('active',b.dataset.tab===value);b.setAttribute('aria-pressed',String(b.dataset.tab===value));}if(value==='explore'){viewer?.fit();drawChart();}}
for(const b of document.querySelectorAll('[data-tab],[data-go]'))b.onclick=()=>showTab(b.dataset.tab||b.dataset.go);
function error(message){valid=false;playing=false;$('parameter-error').hidden=false;$('parameter-error').textContent=message;status('参数未应用，模型与曲线保留上一次有效尺寸。');syncPose();}
$('parameter-form').onsubmit=e=>{
  e.preventDefault();const next=Object.fromEntries(definition.fields.map(f=>[f.key,$('param-'+f.key).value===''?NaN:Number($('param-'+f.key).value)]));
  try{validate(kind,next);}catch(e){error(e.message);return;}
  const rebuild=definition.fields.some(f=>f.key!=='rpm'&&params[f.key]!==next[f.key]);params=next;valid=true;playing=false;$('parameter-error').hidden=true;
  analysis=summary(kind,params);if(rebuild){const range=angleRange(kind,params);angle=clamp(definition.initial,range.min,range.max);phase=phaseForAngle(kind,params,angle);build();}else{if(viewer)viewer.p={...params};update();}
  status(rebuild?'尺寸已应用，模型和曲线已更新。':'转速已更新，当前角度保持不变。');
};
$('reset').onclick=()=>{params=defaults(kind);angle=definition.initial;phase=phaseForAngle(kind,params,angle);valid=true;playing=false;analysis=summary(kind,params);$('parameter-error').hidden=true;for(const f of definition.fields)$('param-'+f.key).value=params[f.key];build();status('已恢复默认参数与装配。');};
function download(text,type,extension){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=kind+'-experiment.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('download-json').onclick=()=>download(JSON.stringify({schema:1,mechanism:kind,title:definition.title,units:{length:'mm',angle:'deg',time:'s',rate:oscillating?'cycles/min':'r/min'},parameters:params,inputAngle:angle,result,range:angleRange(kind,params),assumptions:definition.note},null,2),'application/json','json');
$('download-csv').onclick=()=>{const keys=['angle',...(kind==='scotch-yoke'?['displacement','comparison','slotTravel']:kind==='quick-return'?['displacement','outputAngle']:['outputAngle','couplerAngle','height'])];const header=keys.map(k=>k+(['angle','outputAngle','couplerAngle'].includes(k)?'_deg':'_mm'));download('\ufeff'+[header.join(','),...analysis.data.map(row=>keys.map(k=>row[k].toFixed(6)).join(','))].join('\r\n'),'text/csv;charset=utf-8','csv');};
new ResizeObserver(()=>drawChart()).observe($('chart'));matchMedia('(prefers-color-scheme:dark)').addEventListener('change',drawChart);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
let previous=0,frame;
function animate(now){const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;if(playing){const next=advance(kind,params,{angle,phase},dt,speed);({angle,phase}=next);viewer?.update(angle);update();}frame=requestAnimationFrame(animate);}
frame=requestAnimationFrame(animate);
window.addEventListener('pagehide',e=>{if(!e.persisted){cancelAnimationFrame(frame);viewer?.dispose();}});
window.__linkageLab={getState:()=>structuredClone({ready:!!viewer,kind,params,result,valid,playing,speed,angle,mode,tab,range:angleRange(kind,params),view:viewer?.state()})};
