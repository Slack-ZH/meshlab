import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {definitions,inputLabel,inputUnit,isLinkage,assemblySteps} from '../dist/experiments/catalog.mjs';
import {assertExperimentDefinition,assertExperimentPage} from './experiment-page-contract.mjs';
import {assertTeachingCoverage} from './experiment-teaching-checks.mjs';

// Reuse the actual baseline chrome, catalogue, auth dialog and chat panel.
// Only the eleven experiment pages are written; the reference pages are read-only.
export async function renderPages(names=Object.keys(definitions)){
  assertTeachingCoverage(names);
  for(const kind of names)assertExperimentDefinition(kind,definitions[kind],assemblySteps[kind]);
  const pages=new Map();
  const source=(await readFile(new URL('../dist/friction.html',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const auth=source.match(/<dialog id="auth-dialog"[\s\S]*?<\/dialog>/)[0];
  const header=source.match(/<header class="topbar"[\s\S]*?<\/header>/)[0];
  const stageStart=source.indexOf('<div class="stage-shell">'),sideStart=source.indexOf('<aside class="assistant-sidebar"');
  const sideEnd=source.indexOf('\n</div>\n<div id="status-message"',sideStart);
  if(stageStart<0||sideStart<0||sideEnd<0)throw Error('Baseline layout markers changed');
  const baselineStage=source.slice(stageStart,sideStart),baselineSidebar=source.slice(sideStart,sideEnd);
  if(!baselineStage.includes('id="part-search"'))throw Error('Baseline part catalogue missing');
  for(const kind of names){
    const d=definitions[kind];if(!d)throw Error('Unknown experiment '+kind);
    let stage=baselineStage.replaceAll('摩擦轮传动',d.title);
    stage=stage.replace('<div id="viewport">','<div id="viewport"><div id="joint-labels" hidden>'+['A','B','C','D','O','L','R','T'].map(j=>`<span data-joint="${j}" hidden>${j}</span>`).join('')+'</div>');
    const sidebar=baselineSidebar.replaceAll('摩擦轮传动',d.title).replaceAll('外接圆柱摩擦轮',d.title)
      .replace(/结合当前轮径、转速与载荷，理解摩擦如何传递运动。/g,d.task)
      .replace('为什么两个摩擦轮的转向相反？','当前选中零件在机构中起什么作用？')
      .replace('改变轮径后，传动比会怎样变化？','这些参数如何决定运动关系？')
      .replace('增大负载，什么时候会打滑？','如何按顺序拆开并复原这个机构？')
      .replace(/<div class="chat-suggestions">[\s\S]*?<\/div>/,'<div class="chat-suggestions"><button type="button">当前选中零件在机构中起什么作用？</button><button type="button">这些参数如何决定当前运动关系？</button><button type="button">如何按顺序拆开并复原这个机构？</button></div>')
      .replace('仅看摩擦轮','仅看传动').replace('01 / DRIVER-WHEEL','ASSEMBLY').replace('主动摩擦轮','选择一个零件')
      .replace('<p id="pose-status"','<p id="part-spec" class="part-spec"></p><p id="part-material" class="material-label"></p><p id="pose-status"');
    const unit=inputUnit(kind),label=inputLabel(kind),jack=kind==='scissor-jack';
    const parameters=`<section id="parameters" class="parameter-panel" aria-labelledby="parameter-title"><div class="settings">
      <section class="motion-lab"><div class="parameter-heading"><div><h2>运动与测量</h2><p class="hint">${d.task}</p></div><span id="motion-state" class="motion-state">已暂停</span></div>
      <div class="angle-heading"><label for="angle">${label}</label><span><input id="angle-number" type="number" step="${jack?'.01':'.1'}" value="${d.initial}" aria-label="${label}数值"> ${unit}</span></div><input id="angle" type="range" step="${jack?'.01':'.1'}" value="${d.initial}" aria-label="${label}"><div class="range-labels"><span id="angle-min"></span><span id="angle-max"></span></div>
      <div class="motion-actions"><button id="step-input" class="subtle-button">${jack?'手柄转一圈':'前进 15°'}</button><button id="home-position" class="subtle-button">输入归零</button><button id="drag-mode" class="subtle-button" aria-pressed="false" ${['bevel-gears','scissor-jack','ratchet-pawl'].includes(kind)?'hidden':''}>拖动输入件</button><button id="reverse" class="subtle-button" ${jack?'':'hidden'}>方向 · 上升 ↑</button><button id="drive-phase" class="subtle-button" ${kind==='ratchet-pawl'?'':'hidden'}>驱动段</button><button id="return-phase" class="subtle-button" ${kind==='ratchet-pawl'?'':'hidden'}>回程段</button><label class="joint-option" ${isLinkage(kind)?'':'hidden'}><input id="joint-toggle" type="checkbox"> 标注铰点</label></div>
      <p id="phase-state" class="phase-state"></p><div id="drive-metrics" class="drive-metrics"></div><div id="timing" hidden><div class="timing-labels"><span id="work-time"></span><span id="return-time"></span></div><div class="timing-track"><span id="work-bar">工作</span><span>空回</span></div></div>
      <div class="chart-heading"><h3 id="chart-title">输入与输出关系</h3><span id="chart-unit"></span></div><canvas id="motion-chart" height="210" role="img" aria-label="输入与输出关系图"></canvas><div id="chart-legend" class="chart-legend"></div><p id="chart-caption" class="hint"></p></section>
      <section><div class="parameter-heading"><div><h2 id="parameter-title">参数调节</h2><p class="hint">拖动滑块或输入数值，模型与计算即时更新。</p></div><button id="reset-parameters" class="subtle-button">恢复默认</button></div><div id="geometry-fields" class="fields">${d.fields.map(f=>`<div class="parameter-field"><label for="${f.key}">${f.label} / ${f.unit}</label><input id="${f.key}" type="number" min="${f.min}" max="${f.max}" step="${f.step||1}" value="${f.value}" aria-describedby="${f.key}-hint"><input id="${f.key}-slider" type="range" min="${f.min}" max="${f.max}" step="${f.step||1}" value="${f.value}" aria-label="调节${f.label}"><small id="${f.key}-hint">${f.min}–${f.max} ${f.unit}</small></div>`).join('')}</div><p id="invalid-input" class="input-error" role="alert" hidden></p><p class="hint">尺寸变化会复原装配并保留可达范围内的输入位置。输入不合法时暂停计算，画面保留上一组有效模型。</p><p class="hint scope-note">${d.note}</p></section>
    </div></section>`;
    const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#f5f5f7"><meta name="description" content="${d.title}三维交互实验：${d.task}"><title>${d.title}实验 · meshlab</title><link rel="icon" href="favicon.svg"><link rel="stylesheet" href="apple.css"><link rel="stylesheet" href="chat.css"><link rel="stylesheet" href="experiments/style.css"><script type="importmap">{"imports":{"three":"./assets/three.module.js"}}</script><script type="module" src="experiments/app.mjs"></script><script defer src="apple.js"></script><script type="module" src="chat.js"></script></head><body data-mechanism="${kind}">
    ${auth}<a class="skip-link" href="#workspace">跳到模型与操作</a>${header}<main>
    <section class="intro"><div><p class="intro-kicker">${d.english} · 传动实验</p><h1>${d.title}</h1><p id="model-label" class="intro-copy">${d.subtitle}</p></div><div class="model-tag"><span id="headline-value"></span><p id="headline-label"></p><a class="text-button" href="./">全部实验 ↗</a></div></section>
    <div class="experiment-switch"><label for="mechanism">切换机构</label><select id="mechanism">${Object.entries(definitions).map(([id,q])=>`<option value="${id}" ${id===kind?'selected':''}>${q.title}</option>`).join('')}</select></div>
    <div id="explore" class="tab-panel"><div id="workspace" class="workspace" tabindex="-1"><div class="stage-column">${stage}<div id="status-message" role="status" aria-live="polite"></div>${parameters}</div>${sidebar}</div></div>
    <section id="performance" class="tab-panel reading-panel" hidden><div class="section-lead"><p class="eyebrow">${d.english}</p><h2>从约束关系，读懂运动。</h2><p>${d.subtitle}</p></div><div class="formula-grid"><article><h3>运动关系</h3><p>${d.explanation}</p><div class="formula">${d.formula.replaceAll('\n','<br>')}</div><p id="current-example"></p></article><article><h3>跟着模型做一次实验</h3><p>${d.prompt}</p><button class="text-button" data-go="explore">回到模型试一试 →</button></article><article><h3>模型范围</h3><p>${d.note}</p><p>模型用于刚性运动学教学，不代替制造图纸、载荷与动力学校核。</p></article><article><h3>读数与播放速度</h3><p>数值和时间按设定工况计算。1× 演示为设定转速或往复频率的 20% 慢放，播放倍速不改变公式和工况读数。</p><p>拆装暂停运动；复原保留输入位置。蓝色高亮只表示当前选中零件。</p></article></div></section>
    <section id="calibration" class="tab-panel reading-panel" hidden><div class="section-lead"><p class="eyebrow">实验资料</p><h2>把观察结果带走。</h2><p>保存当前已应用参数，或导出完整运动范围的采样数据。</p></div><div class="formula-grid"><article><h3>当前实验参数</h3><p>包含机构类型、参数与单位、输入位置、计算结果及选中零件。</p><button id="download-parameters" class="primary-button">下载参数 JSON</button></article><article><h3>运动采样数据</h3><p>361 个采样点，表头包含单位，可用 Excel 绘图核对。无效参数状态下暂停导出。</p><button id="download-data" class="primary-button">下载采样 CSV</button></article><article><h3>如何向 AI 提问</h3><p>在 AI 助手中登录后提问。助手会收到提问当时的机构、参数、运动读数、拆装状态和选中零件；重试沿用原问题的快照。</p><p>例如：选中输入件，询问“当前尺寸怎样影响输出运动？”</p></article><article><h3>模型和公式依据</h3><p>${d.note}</p><a class="text-button" href="${isLinkage(kind)?'linkages':'mechanisms'}/DESIGN.md">模型说明与参考资料 ↗</a></article></div></section>
    </main><footer><span>啮合实验室 <b> / </b> 看见结构，理解机械。</span><span>${d.title} · 参数化教学模型</span></footer></body></html>`;
    assertExperimentPage(kind,d,html);pages.set(kind,html);
  }
  return pages;
}
export async function buildPages(names=Object.keys(definitions)){
  // Validate the entire requested batch before writing its first file.
  const pages=await renderPages(names);
  for(const [kind,html]of pages)await writeFile(new URL('../dist/'+kind+'.html',import.meta.url),html);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await buildPages();
