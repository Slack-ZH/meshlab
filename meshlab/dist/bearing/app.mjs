import { BEARING_TYPES, defaults, estimate, fields, presets } from './mechanics.mjs';
import { BearingViewer, steps } from './viewer.mjs';

const $ = id => document.getElementById(id);
const fmt = (value, digits = 1) =>
  Number.isFinite(value)
    ? value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : '—';

const geometricKeys = ['boreDiameter', 'outerDiameter', 'width', 'elementCount', 'contactAngle'];
const structureOrder = ['boreDiameter', 'outerDiameter', 'width', 'elementCount', 'contactAngle', 'innerRPM'];
const loadOrder = ['radialLoad', 'axialLoad', 'dynamicRatingC'];
const allNumericOrder = [...structureOrder, ...loadOrder];

let viewer;
let params = { ...defaults };
let modelParameters = null;
let result = null;
let selectedPart = null;
let geometryValid = true;
let selectedMode = 'free';
let partFilter = 'all';

const status = text => {
  $('status-message').textContent = text;
};
const announce = () => window.dispatchEvent(new Event('bearing:statechange'));

// Build numeric + range controls
for (const key of allNumericOrder) {
  const [name, unit, min, max, step] = fields[key];
  const el = document.createElement('div');
  el.className = 'parameter-field';
  el.dataset.field = key;
  el.innerHTML =
    `<label for="${key}">${name} / ${unit}</label>` +
    `<input id="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${defaults[key]}" aria-describedby="${key}-hint">` +
    `<input id="${key}-slider" type="range" min="${min}" max="${max}" step="${step}" value="${defaults[key]}" aria-label="调节${name}">` +
    `<small id="${key}-hint">${min}–${max} ${unit}</small>`;
  $(structureOrder.includes(key) ? 'geometry-fields' : 'load-fields').append(el);
  $(key).addEventListener('input', () => {
    syncRange(key);
    apply();
  });
  let frame;
  $(key + '-slider').addEventListener('input', () => {
    $(key).value = $(key + '-slider').value;
    syncRange(key);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => apply());
  });
  syncRange(key);
}

function syncRange(key) {
  const input = $(key);
  const range = $(key + '-slider');
  if (input.value !== '' && Number.isFinite(Number(input.value))) range.value = input.value;
  const span = Number(range.max) - Number(range.min);
  const pct = span > 0 ? ((Number(range.value) - Number(range.min)) / span) * 100 : 0;
  range.style.setProperty('--progress', `${Math.max(0, Math.min(100, pct))}%`);
}

function syncConditionalFields() {
  const info = BEARING_TYPES[params.bearingType];
  const fixedAngle = info.fixedContactAngle !== null;
  const angleWrap = document.querySelector('[data-field="contactAngle"]');
  if (angleWrap) angleWrap.classList.toggle('is-disabled', fixedAngle);
  $('contactAngle').disabled = fixedAngle;
  $('contactAngle-slider').disabled = fixedAngle;
  if (fixedAngle) {
    $('contactAngle').value = info.fixedContactAngle;
    $('contactAngle-slider').value = info.fixedContactAngle === 90 ? 25 : 10;
    $('contactAngle-hint').textContent = `${info.shortName}固定接触角 ${info.fixedContactAngle}°（仅圆锥滚子可调）`;
  } else {
    $('contactAngle-hint').textContent = '10–25 ° · 改变内外圈与滚子锥角';
  }

  $('radialLoad-hint').textContent = info.radialCapable ? '0–20 kN · 垂直于轴线' : '0–20 kN · 推力球不承受径向载荷（应为 0）';
  $('axialLoad-hint').textContent = info.axialCapable ? '0–20 kN · 沿轴线方向' : '0–20 kN · N 型圆柱滚子不承受轴向载荷（应为 0）';

  for (const btn of document.querySelectorAll('[data-bearing-type]')) {
    const active = btn.dataset.bearingType === params.bearingType;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
  $('bearing-type-summary').textContent = `${info.name}（${info.exampleCode}）：${info.summary}`;
}

function read() {
  const next = { bearingType: params.bearingType };
  const info = BEARING_TYPES[params.bearingType];
  for (const key of allNumericOrder) {
    if (key === 'contactAngle' && info.fixedContactAngle !== null) {
      next[key] = info.fixedContactAngle;
    } else {
      next[key] = $(key).value === '' ? NaN : Number($(key).value);
    }
  }
  return next;
}

function loadPreset(typeId) {
  const preset = presets[typeId];
  if (!preset) return;
  params = { ...preset };
  for (const key of allNumericOrder) {
    $(key).value = preset[key];
    syncRange(key);
  }
  syncConditionalFields();
  if (selectedMode !== 'free') setMode('free');
  apply();
  const info = BEARING_TYPES[typeId];
  status(`已切换为${info.name}（${info.exampleCode}），内外圈滚道、滚动体与保持架已同步重建。`);
}

for (const btn of document.querySelectorAll('[data-bearing-type]')) {
  btn.addEventListener('click', () => loadPreset(btn.dataset.bearingType));
}

function apply() {
  params = read();
  syncConditionalFields();
  try {
    const next = estimate(params);
    const structural =
      !modelParameters ||
      modelParameters.bearingType !== params.bearingType ||
      geometricKeys.some(key => params[key] !== modelParameters[key]);
    if (structural && selectedMode !== 'free') setMode('free');
    viewer?.build(params);
    if (params.innerRPM === 0) viewer?.setPlaying(false);
    modelParameters = { ...params };
    result = next;
    geometryValid = true;
    $('invalid-input').hidden = true;
    if (structural) renderParts();
    const g = next.geometry;
    $('model-label').textContent =
      `${next.typeName} · d ${g.boreDiameter} / D ${g.outerDiameter} / B ${g.width} mm · Z = ${g.elementCount} · α = ${g.contactAngleDeg}°`;
    $('ratio-count').textContent = fmt(next.cageRatio, 3);
    renderResults();
  } catch (error) {
    result = null;
    geometryValid = false;
    viewer?.setPlaying(false);
    $('invalid-input').hidden = false;
    $('invalid-input').textContent = error.message + '。模型保留上一组有效参数，当前计算暂停。';
    $('drive-metrics').textContent = '请修正参数后查看轴承运动与寿命估算。';
    $('contact-summary').textContent = '';
    $('load-summary').textContent = '';
    $('ratio-count').textContent = '—';
    for (const id of ['principle-input', 'principle-cage', 'principle-spin', 'kinematics-example', 'frequency-example', 'life-example']) {
      $(id).textContent = '—';
    }
  }
  syncPose();
  announce();
}

function renderResults() {
  const r = result;
  const g = r.geometry;
  const lifeDisplay = r.l10Hours !== null ? fmt(r.l10Hours, 0) : r.l10MillionRev !== null ? fmt(r.l10MillionRev, 1) : '—';
  const lifeUnit =
    r.l10Hours !== null
      ? `h · L10 = ${fmt(r.l10MillionRev, 1)} 百万转`
      : r.l10MillionRev !== null
        ? '百万转 · 静止不换算小时'
        : '不适用 / 零载荷';

  const sizeLabel = g.kind === 'ball' ? `Dw = ${fmt(g.elementDiameter, 2)} mm` : `Dw ${fmt(g.elementDiameter, 1)} × Lw ${fmt(g.rollerLength, 1)} mm`;

  $('drive-metrics').replaceChildren(
    ...[
      ['保持架公转转速 nc', fmt(r.cageRPM, 1), `r/min · 速比 ${fmt(r.cageRatio, 3)} × nᵢ`],
      ['滚动体自转转速 nb', fmt(r.elementSpinRPM, 1), 'r/min · 相对保持架反向纯滚'],
      ['节圆直径 Dm', fmt(g.pitchDiameter, 1), `mm · ${sizeLabel}`],
      ['参考寿命 L10h', lifeDisplay, lifeUnit],
    ].map(([label, value, unit]) => {
      const card = document.createElement('div');
      for (const [tag, text] of [
        ['span', label],
        ['strong', value],
        ['small', unit],
      ]) {
        const el = document.createElement(tag);
        el.textContent = text;
        card.append(el);
      }
      return card;
    })
  );

  const coneNote = g.cone
    ? ` 共顶锥角：外圈 ${fmt(g.cone.outerConeAngleDeg, 1)}° / 滚子轴 ${fmt(g.cone.betaDeg, 2)}° / 内圈 ${fmt(g.cone.innerConeAngleDeg, 2)}°（顶点 z = ${fmt(g.cone.apexZ, 1)} mm）。`
    : '';
  $('contact-summary').textContent =
    `特征通过频率（外圈固定）：FTF = ${fmt(r.ftfHz, 2)} Hz · BPFO = ${fmt(r.bpfoHz, 2)} Hz · BPFI = ${fmt(r.bpfiHz, 2)} Hz · BSF = ${fmt(r.bsfHz, 2)} Hz。` +
    ` 节圆线速 ${fmt(r.pitchSpeed, 2)} m/s，1× 演示为设定转速的 3% 慢放。${coneNote}`;

  const loadEl = $('load-summary');
  loadEl.classList.toggle('is-warning', !r.loadValid);
  if (!r.loadValid) {
    loadEl.textContent = r.warning;
  } else if (r.equivalentLoad === null) {
    loadEl.textContent = r.warning || '当前载荷为 0 kN，不计算有限疲劳寿命。';
  } else {
    const factorsText =
      r.loadFactors.X !== null
        ? `（教学系数 X = ${fmt(r.loadFactors.X, 2)}，Y = ${fmt(r.loadFactors.Y, 2)}${r.loadFactors.e !== null ? `，判别比 e = ${fmt(r.loadFactors.e, 2)}` : ''}）`
        : '';
    const hoursText = r.l10Hours !== null ? `，按 ${fmt(r.innerRPM, 0)} r/min 折算 L10h ≈ ${fmt(r.l10Hours, 0)} h` : '';
    loadEl.textContent =
      `当量动载荷 P = ${fmt(r.equivalentLoad, 2)} kN${factorsText}，参考动载荷 C = ${fmt(r.dynamicRatingC, 0)} kN，` +
      `寿命指数 p = ${g.kind === 'ball' ? '3（球轴承）' : '10/3（滚子轴承）'} → 参考 L10 = ${fmt(r.l10MillionRev, 2)} 百万转${hoursText}。` +
      (r.warning ? ' ' + r.warning : ' 仅供教学原理对照，不替代厂商样本选型。');
  }

  $('principle-input').textContent = fmt(r.innerRPM, 0);
  $('principle-cage').textContent = fmt(r.cageRPM, 1);
  $('principle-spin').textContent = fmt(r.elementSpinRPM, 1);
  $('kinematics-example').textContent =
    `当前 ${r.typeName}（Dm = ${fmt(g.pitchDiameter, 1)} mm，Dw = ${fmt(g.elementDiameter, 2)} mm，α = ${g.contactAngleDeg}°）：` +
    `内圈 ${fmt(r.innerRPM, 0)} r/min 时，保持架以 ${fmt(r.cageRPM, 1)} r/min（${fmt(r.cageRatio * 100, 1)}%）同向公转，滚动体以 ${fmt(r.elementSpinRPM, 1)} r/min 相对保持架反向自转。`;
  $('frequency-example').textContent =
    `当前 ${g.elementCount} 个滚动体：每转过 1 圈，约有 ${fmt(g.elementCount * r.cageRatio, 2)} 个滚动体经过外圈固定点（BPFO = ${fmt(r.bpfoHz, 2)} Hz），` +
    `约有 ${fmt(g.elementCount * (1 - r.cageRatio), 2)} 个经过内圈同一位置（BPFI = ${fmt(r.bpfiHz, 2)} Hz）。`;
  $('life-example').textContent =
    r.loadValid && r.l10MillionRev !== null
      ? `当前 C/P = ${fmt(r.dynamicRatingC / r.equivalentLoad, 2)}，p = ${g.kind === 'ball' ? '3' : '10/3'}，因此载荷翻倍时基本寿命将降至原来的 ${g.kind === 'ball' ? '1/8' : '约 1/10.1'}。`
      : r.warning || '设定非零有效载荷后可观察 C/P 与寿命的幂次敏感度。';
}

function syncPose() {
  if (!viewer) return;
  const s = viewer.state();
  const step = s.step || 0;
  const amount = s.amount || 0;
  $('play').textContent = s.playing ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', s.playing ? '暂停轴承转动' : '播放轴承转动');
  $('explode').value = amount * 100;
  $('explode').style.setProperty('--progress', `${amount * 100}%`);
  $('explode-value').textContent = Math.round(amount * 100) + '%';
  $('step-number').textContent = String(step).padStart(2, '0') + ' / ' + String(steps.length - 1).padStart(2, '0');
  $('step-title').textContent = steps[step];
  const sepNote =
    params.bearingType === 'deep-groove'
      ? '深沟球轴承实物不可分离，此处按剖视教学顺序逐层展开内外部件。'
      : '先移开防尘盖/挡环，再沿轴向分离可拆外圈/座圈、保持架、滚动体与转轴。';
  $('step-copy').textContent = step === 0 ? '先停止转动，再按顺序观察滚动轴承的装配层次。' : sepNote;
  $('step-prev').disabled = step === 0;
  $('step-next').disabled = step === steps.length - 1;
  $('housing-mode').value = s.housingMode || 'open';
  $('labels-toggle').checked = !!s.labelsOn;
  $('pose-status').textContent = amount > 0 ? `自由展开 · ${Math.round(amount * 100)}%` : steps[step];
  $('mode-label').textContent = selectedMode === 'steps' ? '逐步拆装' : '结构探索';
}

const isTransmission = part => part.category === 'transmission';

function renderParts() {
  if (!viewer) return;
  const query = $('part-search').value.trim();
  $('part-count').textContent = viewer.parts.length;
  const parts = viewer.parts.filter(
    p =>
      (p.name.includes(query) || (p.description || '').includes(query)) &&
      (partFilter === 'all' || (partFilter === 'transmission' ? isTransmission(p) : !isTransmission(p)))
  );
  $('parts-list').replaceChildren(
    ...parts.map(part => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'part-item';
      button.dataset.part = part.id;
      button.classList.toggle('active', selectedPart?.id === part.id);
      button.setAttribute('aria-pressed', String(selectedPart?.id === part.id));
      button.innerHTML =
        '<span class="part-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/><circle cx="5.5" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></svg></span><span></span><span class="part-number"></span>';
      button.children[1].textContent = part.name;
      button.children[2].textContent = String(viewer.parts.indexOf(part) + 1).padStart(2, '0');
      button.onclick = () => viewer.select(part.id);
      return button;
    })
  );
  if (!parts.length) {
    const empty = document.createElement('p');
    empty.className = 'detail-description';
    empty.textContent = '没有匹配的零件';
    $('parts-list').append(empty);
  }
}

try {
  viewer = new BearingViewer($('viewport'), part => {
    selectedPart = { id: part.id, name: part.name, description: part.description, spec: part.spec || '' };
    $('part-title').textContent = part.name;
    $('part-description').textContent = part.description;
    $('part-index').textContent = String((viewer?.parts.indexOf(part) ?? 0) + 1).padStart(2, '0') + ' / ' + part.id.toUpperCase();
    $('selection-label').textContent = part.name;
    for (const button of $('parts-list').children) {
      const active = button.dataset.part === part.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    announce();
  });
  $('loading').hidden = true;
} catch (error) {
  console.error('滚动轴承三维视图初始化失败', error);
  $('loading').textContent = '三维视图需要 WebGL，仍可使用下方参数与轴承计算。';
  for (const id of [
    'play',
    'speed',
    'explode',
    'explode-all',
    'assemble-all',
    'home-view',
    'front-view',
    'top-view',
    'fullscreen',
    'open-parts',
    'step-next',
    'step-prev',
    'housing-mode',
    'labels-toggle',
  ]) {
    $(id).disabled = true;
  }
}

$('part-search').oninput = renderParts;
for (const button of document.querySelectorAll('[data-filter]')) {
  button.onclick = () => {
    partFilter = button.dataset.filter;
    for (const other of document.querySelectorAll('[data-filter]')) other.classList.toggle('active', other === button);
    renderParts();
  };
}

function setMode(mode) {
  selectedMode = mode;
  $('free-controls').hidden = mode !== 'free';
  $('assembly-controls').hidden = mode !== 'steps';
  for (const button of document.querySelectorAll('[data-mode]')) button.classList.toggle('active', button.dataset.mode === mode);
  viewer?.restore();
  syncPose();
  status(mode === 'steps' ? '按“下一步”按轴向顺序分离轴承部件；按“上一步”复原。' : '自由探索：拖动旋转、点击零件，或切换外圈剖切/透明状态观察内部。');
}
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => setMode(button.dataset.mode);

function showTab(id) {
  for (const button of document.querySelectorAll('[data-tab]')) {
    const active = button.dataset.tab === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    $(button.dataset.tab).hidden = !active;
  }
  if (id !== 'explore') {
    viewer?.setPlaying(false);
    syncPose();
  }
}
for (const button of document.querySelectorAll('[data-tab],[data-go]')) {
  button.addEventListener('click', () => showTab(button.dataset.tab || button.dataset.go));
}

$('play').onclick = () => {
  if (!viewer) return;
  if (!geometryValid) {
    status('请先修正参数，再播放当前模型。');
    return;
  }
  if (params.innerRPM === 0) {
    status('当前内圈转速为 0，请在模型下方提高转速。');
    return;
  }
  const next = !viewer.state().playing;
  if (next && selectedMode !== 'free') setMode('free');
  viewer.setPlaying(next);
  syncPose();
  status(next ? '已启动纯滚动演示：观察保持架半速同向公转，以及滚动体标线反向自转。' : '轴承演示已暂停。');
};
$('speed').oninput = e => {
  viewer?.setSpeed(Number(e.target.value));
  $('speed-value').value = Number(e.target.value).toFixed(1) + '×';
};
$('explode').oninput = e => {
  viewer?.explode(Number(e.target.value) / 100);
  syncPose();
};
$('explode-all').onclick = () => {
  viewer?.explode(1);
  viewer?.home();
  syncPose();
};
$('assemble-all').onclick = () => {
  viewer?.restore();
  syncPose();
  status('已复原装配。');
};
for (const [id, delta] of [
  ['step-next', 1],
  ['step-prev', -1],
]) {
  $(id).onclick = () => {
    if (!viewer) return;
    viewer.assembly(Math.max(0, Math.min(steps.length - 1, (viewer.state().step || 0) + delta)));
    syncPose();
  };
}

$('home-view').onclick = () => viewer?.home();
$('front-view').onclick = () => viewer?.home([0, 0, 1]);
$('top-view').onclick = () => viewer?.home([0, 1, 0]);
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.querySelector('.viewer-panel').requestFullscreen) await document.querySelector('.viewer-panel').requestFullscreen();
    else status('当前设备不支持浏览器全屏，可横屏放大观察。');
  } catch {
    status('当前浏览器未允许全屏。');
  }
};
$('housing-mode').onchange = e => {
  viewer?.setHousingMode(e.target.value);
  syncPose();
  announce();
};
$('labels-toggle').onchange = e => viewer?.setLabels(e.target.checked);

$('reset-parameters').onclick = () => {
  loadPreset(params.bearingType);
  status(`已恢复${BEARING_TYPES[params.bearingType].name}默认教学尺寸与工况。`);
};

$('speak').onclick = () => {
  if (!selectedPart) return;
  if (!('speechSynthesis' in window)) {
    status('当前浏览器不支持语音朗读，完整文字讲解已显示。');
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    $('speak').textContent = '◖)) 朗读讲解';
    return;
  }
  const utterance = new SpeechSynthesisUtterance(selectedPart.name + '。' + selectedPart.description);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.95;
  const reset = () => {
    $('speak').textContent = '◖)) 朗读讲解';
  };
  utterance.onend = reset;
  utterance.onerror = () => {
    reset();
    status('中文语音暂不可用，文字讲解仍可阅读。');
  };
  speechSynthesis.speak(utterance);
  $('speak').textContent = '■ 停止朗读';
};

window.__bearingLab = {
  getState: () => ({
    ready: !!viewer?.parts.length,
    params: { ...params },
    parameters: { ...params },
    modelParameters: modelParameters && { ...modelParameters },
    result: result && { ...result },
    geometryValid,
    selectedPart: selectedPart && { ...selectedPart },
    view: viewer?.state(),
    selectedMode,
  }),
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    viewer?.setPlaying(false);
    syncPose();
  }
});
window.addEventListener('pagehide', () => {
  viewer?.setPlaying(false);
  window.speechSynthesis?.cancel();
});

// Support optional URL query ?type=tapered-roller etc.
const requestedType = new URLSearchParams(location.search).get('type');
if (requestedType && presets[requestedType]) {
  loadPreset(requestedType);
} else {
  apply();
  setMode('free');
}
