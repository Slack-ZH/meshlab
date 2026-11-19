import { mechanismPresets, validateNumber, reducerResults } from './lab-parameters.mjs';

// The shell moves existing controls, never clones a canvas or replaces a live
// model. Each adapter supplies only content; navigation and panel state are shared.
const $ = id => document.getElementById(id);
const query = selector => document.querySelector(selector);
const kind = $('worm-starts') ? 'worm' : $('drill-rpm') ? 'drill' : $('carrier-rpm') ? 'differential' : $('geometry-fields') ? 'turbine' : $('radius') ? 'crank' : $('diameter1') ? 'belt' : 'gear';
const titles = { gear: '两级斜齿减速器', turbine: '轴流式汽轮机', crank: '曲柄滑块', belt: '开口平带传动', differential: '汽车开放式差速器', drill: '电钻两挡行星减速器', worm: '蜗轮蜗杆传动' };
const hasAssemblySteps = kind === 'gear' || kind === 'turbine';
const hasChat = Boolean($('chat-pane'));
const oldMain = query('main');
const oldHeader = query('body > header');
const originalTitle = query('h1')?.textContent || titles[kind];
const ranges = new Map();
let activePanel = 'observe', previousTask = 'observe', parameterGroup = 'structure';
const make = (tag, className, html = '') => {
  const element = document.createElement(tag);
  element.className = className;
  element.innerHTML = html;
  return element;
};
const move = (selector, host) => {
  const element = typeof selector === 'string' ? query(selector) : selector;
  if (element) host.append(element);
  return element;
};
const iconPaths = {
  cube: '<path d="m12 3 9 5v9l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v9"/>',
  list: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7 M3 4v7h7"/>',
  view: '<path d="m12 3 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.cube}</svg>`;
document.body.classList.add('immersive-lab');
document.body.dataset.model = kind;
// Keep reset reachable while the original playback row is temporarily detached.
move('#reset', oldMain);
const header = make('header', 'lab-header', `<a class="lab-brand" href="./#structures" aria-label="meshlab 模型图鉴">${icon('cube')}<span>meshlab</span></a><details class="lab-model-menu"><summary><h1>${originalTitle}</h1><span aria-hidden="true">⌄</span></summary><nav aria-label="模型图鉴"><a href="./#structures">全部模型图鉴 ${icon('arrow')}</a><a href="lab.html">两级斜齿减速器</a><a href="turbine.html">轴流式汽轮机</a><a href="slider-crank.html">曲柄滑块</a><a href="belt.html">交叉与开口平带传动</a><hr><button data-open="principle">原理与资料</button></nav></details><span class="lab-header-space"></span><button data-open="principle" class="lab-reading-link">原理与资料</button><button id="lab-account" aria-label="账号与 AI 助手">${icon('user')}<span>账号</span></button>`);
oldHeader?.replaceWith(header);
for (const [type,url] of [['differential','open-differential.html'],['drill','drill-planetary.html'],['worm','worm-drive.html']]) {
  const link=make('a','',titles[type]);link.href=url;header.querySelector('nav hr').before(link);
}
if (!oldHeader) document.body.prepend(header);
oldMain.id = 'legacy-main';
const app = make('main', 'lab-app');
app.id = 'main';
const stage = make('section', 'lab-stage');
stage.setAttribute('aria-label', '模型观察与播放');
const dock = make('section', 'lab-dock');
dock.setAttribute('aria-label', '实验任务');
const tabs = make('nav', 'lab-task-tabs');
tabs.setAttribute('role', 'tablist');
tabs.setAttribute('aria-label', '切换实验任务');
const tabList = [['observe', '观察'], ['parameters', '参数'], ['assembly', '拆装'], ['ai', 'AI 助手']];
for (const [key, name] of tabList) {
  const button = make('button', '', name);
  button.dataset.open = key; button.id = `lab-tab-${key}`;
  button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', `lab-panel-${key}`);
  tabs.append(button);
}
const panels = {};
const panelHost = make('div', 'lab-panel-host');
for (const [key, label] of [...tabList, ['directory', '零件目录'], ['principle', '原理与资料'], ['results', '计算结果']]) {
  const panel = make('section', 'lab-task-panel');
  panel.id = `lab-panel-${key}`; panel.hidden = true; panel.dataset.task = key;
  panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-label', label);
  if (tabList.some(([id]) => id === key)) panel.setAttribute('aria-labelledby', `lab-tab-${key}`);
  panels[key] = panel; panelHost.append(panel);
}
dock.append(tabs, panelHost); app.append(stage, dock); oldMain.before(app);

const viewer = query('.viewer-panel') || query('.model-panel');
viewer.classList.add('viewer-panel', 'lab-viewer');
const viewport = $('viewport');
const tools = make('div', 'lab-view-tools');
const directoryButton = $('open-parts') || make('button', '', `${icon('list')}<span>零件目录</span>`);
directoryButton.id = 'open-parts'; directoryButton.setAttribute('aria-controls', 'lab-panel-directory'); directoryButton.setAttribute('aria-expanded', 'false');
tools.append(directoryButton);
const viewName = $('view-name') || make('span', 'lab-view-name', '三维结构 · mm');
tools.append(viewName);
const resetView = $('home-view') || make('button', '', '');
resetView.id = 'home-view'; resetView.innerHTML = `${icon('reset')}<span>视角复位</span>`;
resetView.setAttribute('aria-label', '视角复位');
tools.append(resetView);
const viewMenu = make('details', 'lab-display-menu', `<summary>${icon('view')}<span>视图工具</span></summary><div class="lab-view-menu-content"><h3>标准视图</h3><div class="lab-standard-views"></div><div class="lab-display-settings"></div></div>`);
tools.append(viewMenu);
const standardViews = viewMenu.querySelector('.lab-standard-views');
for (const [id, label] of [['view-3d', '立体'], ['view-front', '正视'], ['top-view', '俯视'], ['front-view', '沿轴观察']]) {
  const button = $(id);
  if (button) { button.textContent = label; button.setAttribute('aria-label', label); standardViews.append(button); }
}
move('.visibility-controls', viewMenu.querySelector('.lab-display-settings'));
const fullscreen = $('fullscreen') || make('button', '', '');
fullscreen.id = 'fullscreen'; fullscreen.innerHTML = icon('expand'); fullscreen.setAttribute('aria-label', '全屏'); fullscreen.title = '全屏';
tools.append(fullscreen);
const player = make('div', 'lab-player');
move('.motion-controls', player) || move('.playback', player);
if (!hasAssemblySteps) {
  const speedControl = make('label','lab-motion-speed','<span>演示速度</span><select id="lab-demo-speed" aria-label="演示速度"><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>');
  player.querySelector('.playback').append(speedControl);
  speedControl.querySelector('select').addEventListener('change',event=>document.dispatchEvent(new CustomEvent('meshlab:demo-speed',{detail:Number(event.target.value)})));
}
const quickResults = make('div', 'lab-quick-results');
quickResults.setAttribute('aria-live', 'off');
const status = $('status-message') || make('div', '', '拖动旋转 · 滚轮或双指缩放');
status.id = 'status-message'; status.setAttribute('role', 'status');
const statusLine = make('div', 'lab-status'); statusLine.append(status);
// Model adapters update this label when switching between free and step modes.
move('#mode-label', statusLine);
player.append(quickResults);
const originalMode = query('.control-mode');
move(originalMode, panels.assembly);
move('#free-controls', panels.assembly);
move('#assembly-controls', panels.assembly);
move('#parts-panel', panels.directory);
if ($('parts-panel')) $('parts-panel').hidden = false;
const originalDetail = $('details-pane');
if (originalDetail) { originalDetail.hidden = false; move(originalDetail, panels.observe); }
if (hasChat) {
  const chat = move('#chat-pane', panels.ai); chat.hidden = false;
  move('.assistant-tabs', panels.observe)?.classList.add('lab-legacy-tabs');
  const closeAI = make('button', 'lab-close-ai', `${icon('close')}收起 AI`);
  closeAI.addEventListener('click', () => open(previousTask));
  chat.querySelector('.chat-header').append(closeAI);
} else {
  panels.ai.innerHTML = '<div class="lab-capability-note"><p class="lab-eyebrow">AI 助手</p><h2>这个模型尚未接入问答</h2><p>当前可通过参数、结果和原理资料探索结构。减速器与汽轮机保留现有 AI 问答和账号服务。</p><div class="lab-actions"><a href="lab.html?view=assistant">减速器 AI 助手 →</a><a href="turbine.html">前往汽轮机实验 →</a></div></div>';
}
const ask = make('button', 'lab-ask-part', '询问当前零件 →');
ask.addEventListener('click', () => open('ai'));
if (hasChat) originalDetail.append(ask);

const parameterHeader = make('div', 'lab-parameter-header', '<h2>参数与结果</h2><div class="lab-preset-controls"><label>预设方案 <select id="lab-preset"><option value="custom" disabled>自定义</option><option value="default">默认方案</option></select></label><button id="lab-defaults">恢复默认参数</button></div>');
const groupTabs = make('div', 'lab-parameter-tabs');
const groups = {};
for (const [key, title] of [['structure', '结构'], ['running', '运行'], ['advanced', '进阶']]) {
  const button = make('button', '', title); button.dataset.parameterGroup = key; button.setAttribute('aria-controls', `lab-group-${key}`);
  groupTabs.append(button);
  groups[key] = make('div', 'lab-parameter-group'); groups[key].id = `lab-group-${key}`; groups[key].hidden = key !== parameterGroup;
}
const parameterFields = make('div', 'lab-parameter-fields'); parameterFields.append(...Object.values(groups));
panels.parameters.append(parameterHeader, groupTabs, parameterFields);
const parameterFeedback = make('p', 'lab-parameter-feedback', '参数与结果实时同步');
parameterFeedback.setAttribute('role', 'status'); panels.parameters.append(parameterFeedback);
const preset = $('lab-preset');
const presetLabels = { gear: [['light','轻载 · 0.75 kW'],['slow','低速输入 · 720 r/min']], crank: [['long','长连杆 · 220 mm'],['slow','慢速观察 · 10 r/min']], belt: [['equal','等径带轮 · 180 mm'],['wide','大中心距 · 420 mm']] };
for (const [value, title] of presetLabels[kind] || []) preset.add(new Option(title, value));
if (kind === 'differential') for (const [value, title] of [['tight','急弯 · 半径 3 m'],['gentle','缓弯 · 半径 12 m']]) preset.add(new Option(title, value));
if (kind === 'drill') for (const [value, title] of [['slow','低速输入 · 3000 r/min'],['fast','高速输入 · 9000 r/min']]) preset.add(new Option(title, value));
if (kind === 'worm') for (const [value, title] of [['double','双头 · 40 齿'],['quad','四头 · 40 齿'],['large','单头 · 60 齿']]) preset.add(new Option(title, value));

if (kind === 'gear') {
  groups.structure.innerHTML = '<div class="lab-structure-summary"><h3>两级斜齿轮 · 固定 CAD 结构</h3><dl><dt>一级齿数</dt><dd>20 / 80</dd><dt>二级齿数</dt><dd>20 / 80</dd><dt>总传动比</dt><dd>4 × 4 = 16</dd></dl><p>本模型的结构尺寸来自 GL16 设计。运行参数用于计算并按 1/120 慢放显示，几何保持设计尺寸。</p></div>';
  for (const [key, label, unit, min, max, step, value] of [['power','输入功率','kW',.1,3,.01,1.5],['rpm','输入转速','r/min',160,1500,1,1440],['efficiency','总效率','',.8,1,.01,.96]]) {
    const field = make('div', 'parameter', `<label for="operating-${key}">${label}<output id="operating-${key}-value">${value} ${unit}</output></label><input type="range" id="operating-${key}" min="${min}" max="${max}" step="${step}" value="${value}"><div class="range-labels"><span>${min} ${unit}</span><span>${max} ${unit}</span></div>`);
    (key === 'efficiency' ? groups.advanced : groups.running).append(field);
  }
  groups.advanced.append(make('p', 'lab-help', '效率用于估算输出转矩；演示速度倍率独立于实际工况转速。'));
  move('.metrics', panels.observe);
  move('#principle', panels.principle).hidden = false;
  move('#engineering', panels.principle).hidden = false;
} else if (kind === 'turbine') {
  move('#structure', groups.structure);
  const conditions = move('#conditions', groups.running); conditions.open = true;
  move($('work').closest('.fields'), groups.advanced);
  move('#expansion-note', groups.advanced);
  move('.stage-audit', groups.advanced);
  move('#performance', panels.results).hidden = false;
  move('#calibration', panels.principle).hidden = false;
  const resultsLink = make('button', 'lab-results-link', '查看功率、基准对比与参数扫描 →'); resultsLink.dataset.open = 'results';
  panels.parameters.append(resultsLink);
  panels.observe.append(make('div', 'lab-observe-summary', '<h3>参数化轴流教学模型</h3><p>选择静叶、动叶与轴系，观察每级结构。运行工况与几何参数分别编辑。</p><button data-open="results">功率估算与方案对比 →</button>'));
} else if (kind === 'worm') {
  move('#worm-study', panels.observe);
  for (const key of ['structure','running','advanced']) move(`#worm-${key}`, groups[key]);
  move('#reset', groups.advanced);move('#principle', panels.principle);
  const parts=move('.part-tabs',panels.directory);
  panels.directory.prepend(make('label','lab-search','<span>搜索零件</span><input type="search" id="lab-part-search" placeholder="蜗杆、蜗轮、输出轴、轴承…">'));
  $('lab-part-search').addEventListener('input',event=>parts.querySelectorAll('[data-worm-part]').forEach(button=>button.hidden=!button.textContent.includes(event.target.value.trim())));
  parts.addEventListener('click',event=>{if(event.target.closest('[data-worm-part]'))open('observe');});
  panels.assembly.innerHTML='<div class="lab-capability-note"><p class="lab-eyebrow">啮合结构</p><h2>沿螺旋线观察交错轴传动</h2><p>隐藏支承机架并放大啮合区域，可选择每条独立螺旋线，观察它如何推动蜗轮。</p><button id="worm-show-mesh">放大啮合区域 →</button></div>';
  $('worm-show-mesh').addEventListener('click',()=>{$('inspect-mesh').click();open('observe');});
} else if (kind === 'drill') {
  move('#drill-study', panels.observe);
  for (const key of ['structure','running','advanced']) move(`#drill-${key}`, groups[key]);
  move('#reset', groups.advanced);move('#principle', panels.principle);
  const parts=move('.part-tabs',panels.directory);
  panels.directory.prepend(make('label','lab-search','<span>搜索零件</span><input type="search" id="lab-part-search" placeholder="太阳轮、齿圈、拨叉、夹头…">'));
  $('lab-part-search').addEventListener('input',event=>parts.querySelectorAll('[data-drill-part]').forEach(button=>button.hidden=!button.textContent.includes(event.target.value.trim())));
  parts.addEventListener('click',event=>{if(event.target.closest('[data-drill-part]'))open('observe');});
  panels.assembly.innerHTML='<div class="lab-capability-note"><p class="lab-eyebrow">换挡结构</p><h2>观察齿圈如何切换联接</h2><p>通过齿圈剖视、零件选择和挡位切换，可查看拨叉与两端联接位置。</p><button id="drill-show-shift">查看换挡联接 →</button></div>';
  $('drill-show-shift').addEventListener('click',()=>{$('inspect-shift').click();open('observe');});
} else if (kind === 'differential') {
  move('#differential-study', panels.observe);
  move('#diff-structure', groups.structure);
  move('#diff-running', groups.running);
  move('#diff-advanced', groups.advanced);
  move('#reset', groups.advanced);
  move('#principle', panels.principle);
  const parts = move('.part-tabs', panels.directory);
  panels.directory.prepend(make('label', 'lab-search', '<span>搜索零件</span><input type="search" id="lab-part-search" placeholder="半轴、壳体、行星锥齿轮…">'));
  $('lab-part-search').addEventListener('input', event => parts.querySelectorAll('[data-diff-part]').forEach(button => button.hidden = !button.textContent.includes(event.target.value.trim())));
  parts.addEventListener('click', event => { if (event.target.closest('[data-diff-part]')) open('observe'); });
  panels.assembly.innerHTML = '<div class="lab-capability-note"><p class="lab-eyebrow">结构观察</p><h2>剖开壳体，观察内部啮合</h2><p>可通过“视图工具”切换完整、剖开或隐藏壳体，查看行星锥齿轮与左右半轴齿轮。</p><button id="diff-cutaway">剖开壳体并观察 →</button></div>';
  $('diff-cutaway').addEventListener('click', () => { $('case-display').value = 'cutaway'; $('case-display').dispatchEvent(new Event('change')); open('observe'); });
} else {
  const settings = query('.settings');
  for (const field of [...settings.querySelectorAll('.parameter')]) {
    const id = field.querySelector('input').id;
    (id === 'rpm' ? groups.running : groups.structure).append(field);
  }
  move('.assumption', groups.advanced);
  const reset = $('reset'); reset.textContent = '重置整个实验'; move(reset, groups.advanced);
  move('#equal-wheels', groups.structure);
  move('.metrics', panels.observe);
  move('.current', panels.observe);
  move('.belt-length', panels.observe);
  move('.wheel-readouts', panels.observe);
  move('.belt-observation', panels.observe);
  move('.part-description', panels.observe);
  move('.curves', panels.observe);
  move('.motion-caption', panels.observe);
  move('.angle-control', groups.running);
  move('#principle', panels.principle);
  panels.assembly.innerHTML = '<div class="lab-capability-note"><p class="lab-eyebrow">拆装观察</p><h2>分离零件，观察装配关系</h2><p>可在“观察”中选择零件，在“参数”中调整结构并查看运动关系。</p><button data-open="parameters">调节结构参数 →</button></div>';
  const simpleParts = move('.part-tabs', panels.directory);
  if (simpleParts) {
    panels.directory.prepend(make('label', 'lab-search', '<span>搜索零件</span><input type="search" id="lab-part-search" placeholder="曲柄、连杆、活塞…">'));
    $('lab-part-search').addEventListener('input', event => simpleParts.querySelectorAll('[data-part]').forEach(button => button.hidden = !button.textContent.includes(event.target.value.trim())));
    simpleParts.addEventListener('click', event => { if (event.target.closest('[data-part]')) open('observe'); });
  } else {
    panels.directory.innerHTML = '<h2>带传动零件</h2><label class="lab-search">搜索零件<input type="search" id="lab-part-search" placeholder="带轮、平带、机架…"></label><div class="part-tabs"><button data-belt-part="driver">主动轮</button><button data-belt-part="driven">从动轮</button><button data-belt-part="belt">平带</button><button data-belt-part="frame">支承机架</button></div><p>点击零件可高亮观察，蓝色与绿色圆弧分别表示两轮包角。</p>';
    const description = make('div','part-description','<h3 id="belt-part-title">主动轮</h3><p id="belt-part-description">左侧带轮通过平带带动右侧带轮，两轮同向旋转。</p>');
    panels.observe.prepend(description);
    $('lab-part-search').addEventListener('input', event => panels.directory.querySelectorAll('[data-belt-part]').forEach(button => button.hidden = !button.textContent.includes(event.target.value.trim())));
  }
}


if (!hasAssemblySteps) {
  const directions = {
    worm: '蜗杆抬起，露出啮合处。蜗轮、输出轴与支承轴承分别移开。',
    differential: '左右半轴沿轴线分开，行星锥齿轮沿径向移出，壳体与输入轴分离。',
    drill: '两级齿轮沿主轴分层展开，行星轮径向分离，拨叉向上移出。',
    crank: '活塞向上移出，连杆、曲柄和飞轮分层分离，支承机架保留为装配参照。',
    belt: '平带向前抽出，两只带轮向两侧分离，支架向后移出。',
  };
  const assembly = make('div', 'lab-explosion-controls', `<div id="free-controls"><div class="slider-block"><div><label for="explode">爆炸展开</label><output id="explode-value">0%</output></div><input id="explode" type="range" min="0" max="100" step="1" value="0" disabled aria-describedby="explosion-note"><small>完整装配 <span>零件分离</span></small></div><button class="subtle-button" id="explode-all" disabled aria-pressed="false">全部展开</button><button class="subtle-button" id="assemble-all" disabled>复原装配</button></div><p id="explosion-note">${directions[kind]} 展开自动暂停；播放时先复原。${kind === 'crank' ? '展开时仍可点选零件；复原后可拖动曲柄。' : ''}</p>`);
  panels.assembly.prepend(assembly);
}

if (kind === 'crank') {
  const experiment=make('div','piston-study');
  const controls=make('section','piston-controls');
  controls.setAttribute('aria-label','止点与行程实验');
  move('#phase',controls);
  const measures=make('div','piston-measures');
  move($('stroke').closest('.metrics').firstElementChild,measures);
  move($('displacement').parentElement.parentElement,measures);
  move($('velocity').parentElement.parentElement,measures);
  controls.append(measures);
  move($('ratio').closest('.metrics'),groups.advanced);
  panels.observe.querySelector('.current')?.remove();
  move('.piston-limit-controls',controls);
  move('.angle-control',controls);
  const detail=make('details','piston-part-note','<summary>零件解读</summary>');
  move('.part-description',detail);controls.append(detail);
  const curves=move('.curves',experiment);
  move(curves.querySelector('#velocity-chart').closest('article'),groups.advanced);
  experiment.prepend(controls);panels.observe.append(experiment);
}

// Keep legacy IDs used by existing model code, but remove obsolete layout wrappers.
const keep = [viewport, query('.view-hint') || query('.viewer-hint'), $('selection-label'), query('.axis-mark')].filter(Boolean);
viewer.replaceChildren(...keep);
viewer.prepend(tools); viewer.append(player);
stage.append(viewer, statusLine);
oldMain.hidden = true;
document.querySelectorAll('footer').forEach(footer => { footer.hidden = false; panels.principle.append(footer); });
const skipLink = query('.skip-link'); if (skipLink) skipLink.href = '#main'; app.tabIndex = -1;

function open(name, focus = false) {
  const aliases = { explore: 'observe', details: 'observe', chat: 'ai', assistant: 'ai', engineering: 'principle', calibration: 'principle', performance: 'results' };
  const key = aliases[name] || name;
  if (!panels[key]) return;
  if (key === 'ai' && activePanel !== 'ai') previousTask = activePanel;
  activePanel = key;
  for (const [id, panel] of Object.entries(panels)) panel.hidden = id !== key;
  for (const button of tabs.children) {
    const selected = button.dataset.open === key;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
  }
  if (![...tabs.children].some(button => button.tabIndex === 0)) tabs.firstElementChild.tabIndex = 0;
  directoryButton.setAttribute('aria-expanded', String(key === 'directory'));
  header.querySelector('details').open = false; viewMenu.open = false;
  if (focus) panels[key].querySelector('input,button,a,select')?.focus({ preventScroll: true });
  window.dispatchEvent(new CustomEvent('meshlab:panelchange', { detail: { panel: key } }));
}
function chooseGroup(key) {
  parameterGroup = key;
  for (const [id, group] of Object.entries(groups)) group.hidden = key !== id;
  groupTabs.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.parameterGroup === key)));
}
window.meshlabShell = { open, get activePanel() { return activePanel; }, syncRanges, kind };
// The model may rebuild its list while handling selection; act before that removes
// the clicked row from the document.
panels.directory.addEventListener('click', event => {
  if (event.target.closest('.part-item')) open('observe');
}, { capture: true });
document.addEventListener('click', event => {
  const target = event.target.closest('[data-open]'); if (target) open(target.dataset.open);
  const group = event.target.closest('[data-parameter-group]'); if (group) chooseGroup(group.dataset.parameterGroup);
  if (!viewMenu.contains(event.target)) viewMenu.open = false;
  if (!header.querySelector('details').contains(event.target)) header.querySelector('details').open = false;
  if (event.target.closest('#parts-list .part-item')) open('observe');
  if (event.target.closest('#equal-wheels')) preset.value = 'custom';
  if (event.target.closest('#reset')) preset.value = 'default';
  if (event.target.closest('[data-mode]')) queueMicrotask(() => document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active')))));
  queueMicrotask(syncRanges);
});
tabs.addEventListener('keydown', event => {
  const buttons = [...tabs.children], index = buttons.indexOf(document.activeElement);
  if (index < 0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  open(buttons[next].dataset.open); buttons[next].focus();
});
directoryButton.addEventListener('click', () => open(activePanel === 'directory' ? 'observe' : 'directory', true));
$('close-parts')?.addEventListener('click', () => { open('observe'); directoryButton.focus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { viewMenu.open = false; header.querySelector('details').open = false; if (['directory','ai','results','principle'].includes(activePanel)) open(activePanel === 'ai' ? previousTask : 'observe'); } });
$('lab-account').addEventListener('click', () => {
  open('ai');
  const login = $('chat-login');
  if (login && !login.disabled) login.click();
});
if (!hasAssemblySteps) {
  resetView.addEventListener('click', () => $('view-3d').click());
  fullscreen.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await viewer.requestFullscreen(); }
    catch { status.textContent = '当前浏览器不支持全屏，可横屏放大观察。'; }
  });
}
const selection = $('selection-label');
if (selection) new MutationObserver(() => { if (activePanel === 'directory') open('observe'); }).observe(selection, { childList: true, characterData: true, subtree: true });

function bindRange(range) {
  if (ranges.has(range.id) || range.type !== 'range') return;
  const field = range.closest('.parameter'); if (!field) return;
  const number = make('input', 'lab-number'); number.type = 'number'; number.id = `${range.id}-number`;
  for (const key of ['min','max','step']) number[key] = range[key] || (key === 'step' ? '1' : '');
  number.value = range.value;
  const label = field.querySelector('label');
  const labelCopy = label.cloneNode(true); labelCopy.querySelectorAll('output').forEach(node=>node.remove());
  number.setAttribute('aria-label', labelCopy.textContent.trim().replace(/\s+/g, ' ') || range.id);
  const error = make('p', 'lab-field-error'); error.id = `${range.id}-error`; error.setAttribute('role', 'alert'); number.setAttribute('aria-describedby', error.id);
  const heading = make('div','lab-field-heading'); label.before(heading); heading.append(label,number); field.append(error);
  const sync = () => { if (document.activeElement !== number || !number.hasAttribute('aria-invalid')) number.value = range.value; range.style.setProperty('--progress', `${(range.value-range.min)/(range.max-range.min)*100}%`); };
  range.addEventListener('input', () => { number.removeAttribute('aria-invalid'); error.textContent = ''; number.value = range.value; sync(); preset.value = 'custom'; });
  number.addEventListener('input', () => {
    const checked = validateNumber(number.value, number);
    if (checked.error) { error.textContent = checked.error + ' 保留上一有效模型。'; number.setAttribute('aria-invalid', 'true'); return; }
    error.textContent = ''; number.removeAttribute('aria-invalid'); range.value = checked.value;
    range.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ranges.set(range.id, { range, number, sync }); sync();
}
panels.parameters.querySelectorAll('.parameter input[type=range]').forEach(bindRange);
function syncRanges() { for (const { sync } of ranges.values()) sync(); updateQuickResults(); }
function applyPreset(name) {
  if (name === 'custom') return;
  if (kind === 'gear') {
    const values = mechanismPresets.gear[name];
    for (const [key,value] of Object.entries(values)) $(`operating-${key}`).value = value;
    updateGear();
  } else document.dispatchEvent(new CustomEvent('meshlab:preset', { detail: { name, values: mechanismPresets[kind]?.[name] } }));
  for (const { number } of ranges.values()) number.removeAttribute('aria-invalid');
  panels.parameters.querySelectorAll('.lab-field-error').forEach(node => node.textContent = '');
  syncRanges(); preset.value = name; parameterFeedback.textContent = '方案已应用，参数与计算结果已更新。';
}
preset.addEventListener('change', () => applyPreset(preset.value));
$('lab-defaults').addEventListener('click', () => applyPreset('default'));
panels.parameters.addEventListener('input', event => { if (event.target !== preset) { preset.value = 'custom'; parameterFeedback.textContent = '参数变更后，模型与结果保留当前观察视角。'; } });
function updateGear() {
  const values = Object.fromEntries(['power','rpm','efficiency'].map(key => [key, Number($(`operating-${key}`).value)]));
  const result = reducerResults(values);
  for (const key of Object.keys(values)) $(`operating-${key}-value`).value = `${values[key]} ${key==='power'?'kW':key==='rpm'?'r/min':''}`;
  const metrics = panels.observe.querySelectorAll('.metrics strong');
  if (metrics.length === 5) [values.power, values.rpm, 16, result.outputRpm, result.torque.toFixed(1)].forEach((n,i) => metrics[i].firstChild.textContent = `${n} `);
  quickResults.innerHTML = `<span>传动比 <b>16 : 1</b></span><span>输出 <b>${Number(result.outputRpm.toFixed(2))}</b> r/min</span><span>转矩 <b>${result.torque.toFixed(1)}</b> N·m</span>`;
  document.dispatchEvent(new CustomEvent('meshlab:operating', { detail: values }));
}
if (kind === 'gear') { for (const key of ['power','rpm','efficiency']) $(`operating-${key}`).addEventListener('input', updateGear); updateGear(); }
function updateQuickResults() {
  if (kind === 'gear') return;
  const entries = kind === 'worm' ? [['蜗轮输出',$('wheel-rpm')?.value,'r/min'],['传动比',$('worm-ratio')?.value,': 1']] : kind === 'drill' ? [['夹头输出',$('output-speed')?.value,'r/min'],['总减速比',$('total-ratio')?.value,': 1']] : kind === 'differential' ? [['左半轴',$('left-rpm')?.value,'r/min'],['右半轴',$('right-rpm')?.value,'r/min'],['差速齿轮自转',$('spider-rpm')?.value,'r/min']] : kind === 'crank' ? [['行程', $('stroke')?.value, 'mm'],['位移', $('displacement')?.value, 'mm']] : kind === 'belt' ? [['主动轮包角',$('wrap1')?.value,'°'],['从动轮包角',$('wrap2')?.value,'°'],['输出',$('speed2')?.value,'r/min']] : [['轴功率', $('metrics')?.querySelector('.metric b')?.textContent, 'kW'],['级数',$('stage-count')?.textContent,'']];
  const html = entries.map(([name,value,unit]) => `<span>${name} <b>${value || '—'}</b> ${unit}</span>`).join('');
  if (quickResults.innerHTML !== html) quickResults.innerHTML = html;
}
window.addEventListener('turbine:statechange', syncRanges);
window.addEventListener('meshlab:statechange', syncRanges);
document.addEventListener('input', () => queueMicrotask(updateQuickResults));
// The live outputs update independently of panel visibility. Sampling text at 8 Hz
// avoids a second render loop or rebuilding the whole task panel on every frame.
setInterval(() => { if (!document.hidden && kind !== 'gear') updateQuickResults(); }, 125);
chooseGroup(['gear','differential','drill'].includes(kind) ? 'running' : 'structure');
preset.value = 'default';
open(new URLSearchParams(location.search).get('task') || new URLSearchParams(location.search).get('view') || 'observe');
