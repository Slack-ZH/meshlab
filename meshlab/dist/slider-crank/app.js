import '../lab-shell.js';
import { connectExplosion } from '../explosion-controls.js';
let demoSpeed=1;document.addEventListener('meshlab:demo-speed',event=>{demoSpeed=event.detail;});
import { DEFAULTS, LIMITS, pistonPoseAt } from './kinematics.js';

const byId = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const params = { ...DEFAULTS };
const state = { angle: Math.PI / 4, playing: false, selected: 'crank' };
const theme = matchMedia('(prefers-color-scheme: dark)');
let scene = null;
let fallback = false;
let lastTime = null;
let samples = [];
let chartDirty = true;
let lastChartAngle = null;
const chartBackgrounds = new Map();

const parts = {
  crank: ['曲柄', '绕固定轴心旋转，带动连杆。轴心到活动铰点的距离为曲柄半径 r。'],
  rod: ['连杆', '连接曲柄销与活塞销，随曲柄摆动并驱动活塞。两铰点之间的距离为连杆长度 l。'],
  slider: ['活塞', '受缸体约束，沿竖直方向往复运动。活塞顶部在上止点与下止点之间移动，行程 S = 2r。'],
  frame: ['机架', '固定曲柄轴心并支承剖开的缸体。活塞运动轴线通过曲柄轴心，构成对心曲柄滑块机构。'],
};

function currentPose(angle = state.angle) {
  return pistonPoseAt({ ...params, angle, omega: params.rpm * TAU / 60 });
}

function setPlaying(playing) {
  if (playing && scene?.explosion?.active) scene.explosion.setTarget(0);
  state.playing = playing;
  lastTime = null;
  byId('play').textContent = playing ? 'Ⅱ 暂停' : '▶ 播放';
  byId('play').setAttribute('aria-pressed', String(playing));
}

function setAngle(angle, preserveEnd = false) {
  setPlaying(false);
  state.angle = preserveEnd ? angle : ((angle % TAU) + TAU) % TAU;
  update();
}

function selectPart(part) {
  state.selected = part;
  const [title, description] = parts[part];
  byId('part-title').textContent = title;
  byId('part-description').textContent = description;
  document.querySelectorAll('[data-part]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.part === part));
  });
  scene?.select(part);
}

function rebuildCurves() {
  samples = Array.from({ length: 361 }, (_, degrees) => currentPose(degrees * Math.PI / 180));
  chartDirty = true;
}

function updateParameters() {
  for (const key of Object.keys(DEFAULTS)) {
    byId(key).value = params[key];
    byId(`${key}-value`).value = `${params[key]} ${key === 'rpm' ? 'r/min' : 'mm'}`;
  }
  byId('stroke').value = params.radius * 2;
  byId('ratio').value = (params.rodLength / params.radius).toFixed(2);
  rebuildCurves();
  update();
}

function update() {
  const pose = currentPose();
  const degrees = state.angle * 180 / Math.PI;
  byId('angle').value = degrees;
  byId('angle-value').value = `${degrees.toFixed(1)}°`;
  byId('displacement').value = pose.displacement.toFixed(1);
  byId('velocity').value = Math.abs(pose.velocity) < 0.05 ? '0.0' : pose.velocity.toFixed(1);
  const atDeadCenter = Math.abs(Math.sin(state.angle)) < 0.0001;
  byId('phase').textContent = atDeadCenter
    ? (Math.cos(state.angle) > 0 ? '上止点 · s = 0，速度为零' : '下止点 · s = 2r，速度为零')
    : (pose.velocity < 0 ? '↑ 活塞上行 · 接近上止点' : '↓ 活塞下行 · 接近下止点');
  byId('dead-center').setAttribute('aria-pressed',String(atDeadCenter && Math.cos(state.angle)>0));
  byId('bottom-dead-center').setAttribute('aria-pressed',String(atDeadCenter && Math.cos(state.angle)<0));
  byId('curve-readout').value=`θ ${degrees.toFixed(1)}° · s ${pose.displacement.toFixed(1)} mm`;
  scene?.update(pose, params);
  if (fallback) drawFallback(pose);
  drawCharts(pose);
}

function prepareCanvas(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = Math.min(devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * scale);
  const pixelHeight = Math.round(height * scale);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return { context, width, height, scale };
}

function chartBase(canvas, key, color) {
  const { width, height, scale } = prepareCanvas(canvas);
  const background = document.createElement('canvas');
  background.width = canvas.width;
  background.height = canvas.height;
  const ctx = background.getContext('2d');
  ctx.scale(scale, scale);
  const pad = { left: 48, right: 15, top: 30, bottom: 30 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxSpeed = Math.max(...samples.map((point) => Math.abs(point.velocity)));
  const maximum = key === 'displacement' ? params.radius * 2 : Math.ceil(maxSpeed / 10) * 10;
  const minimum = key === 'displacement' ? 0 : -maximum;
  const x = (angle) => pad.left + angle / TAU * plotWidth;
  const y = (value) => pad.top + (maximum - value) / (maximum - minimum) * plotHeight;
  const colors = getComputedStyle(document.documentElement);
  ctx.font = '11px system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.fillStyle = colors.getPropertyValue('--muted').trim();
  ctx.strokeStyle = colors.getPropertyValue('--line').trim();
  ctx.textAlign = 'right';
  for (let index = 0; index <= 4; index++) {
    const value = minimum + (maximum - minimum) * index / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y(value));
    ctx.lineTo(width - pad.right, y(value));
    ctx.stroke();
    ctx.fillText(value.toFixed(0), pad.left - 9, y(value) + 4);
  }
  ctx.textAlign = 'center';
  for (let degrees = 0; degrees <= 360; degrees += 90) {
    ctx.fillText(`${degrees}°`, x(degrees * Math.PI / 180), height - 10);
  }
  if(key==='displacement'){
    ctx.fillText('上止点',x(0)+16,15);ctx.fillText('下止点',x(Math.PI),15);ctx.fillText('上止点',x(TAU)-16,15);
    ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x(Math.PI),pad.top);ctx.lineTo(x(Math.PI),height-pad.bottom);ctx.stroke();ctx.setLineDash([]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  samples.forEach((point, index) => {
    if (index === 0) ctx.moveTo(x(0), y(point[key]));
    else ctx.lineTo(x(index * Math.PI / 180), y(point[key]));
  });
  ctx.stroke();
  return { background, x, y, pad, width, height, color };
}

function drawCharts(pose) {
  if (!chartDirty && lastChartAngle === state.angle) return;
  const colors = getComputedStyle(document.documentElement);
  for (const key of ['displacement', 'velocity']) {
    const canvas = byId(`${key}-chart`);
    if(!canvas.clientWidth||!canvas.clientHeight)continue;
    if (chartDirty || !chartBackgrounds.has(key) || chartBackgrounds.get(key).width !== canvas.clientWidth || chartBackgrounds.get(key).height !== canvas.clientHeight) {
      const color = colors.getPropertyValue(key === 'displacement' ? '--blue' : '--orange').trim();
      chartBackgrounds.set(key, chartBase(canvas, key, color));
    }
    const chart = chartBackgrounds.get(key);
    const { context: ctx, width, height } = prepareCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(chart.background, 0, 0, width, height);
    const x = chart.x(state.angle);
    const y = chart.y(pose[key]);
    ctx.strokeStyle = chart.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chart.pad.top);
    ctx.lineTo(x, height - chart.pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    ctx.fillStyle = chart.color;
    ctx.fill();
    ctx.strokeStyle = colors.getPropertyValue('--panel').trim();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  chartDirty = false;
  lastChartAngle = state.angle;
}

let fallbackProjection=null;
function drawFallback(pose) {
  const {context:ctx,width,height}=prepareCanvas(byId('fallback'));
  if(!width||!height)return;
  ctx.clearRect(0,0,width,height);
  const scale=Math.min((width-150)/(2*params.radius+100),(height-70)/(params.rodLength+2*params.radius+65));
  const originX=width/2-10,originY=height-35-(params.radius+28)*scale;
  fallbackProjection={scale,originX,originY};
  const x=v=>originX+v*scale,y=v=>originY-v*scale;
  ctx.lineCap='round';ctx.lineWidth=2;ctx.strokeStyle='#8c9caa';
  ctx.fillStyle='#c6cdd4';ctx.fillRect(x(-31),y(pose.tdcY+26),62*scale,(2*params.radius+50)*scale);
  ctx.clearRect(x(-25),y(pose.tdcY+24),50*scale,(2*params.radius+46)*scale);
  ctx.setLineDash([3,4]);
  for(const [pos,label] of [[pose.tdcY+22,'上止点 · 0°'],[pose.bdcY+22,'下止点 · 180°']]){
    ctx.beginPath();ctx.moveTo(x(-36),y(pos));ctx.lineTo(x(55),y(pos));ctx.stroke();ctx.fillStyle='#516173';ctx.font='11px system-ui';ctx.fillText(label,x(58),y(pos)+4);
  }
  ctx.beginPath();ctx.arc(x(0),y(0),params.radius*scale,0,TAU);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#b9c6cd';ctx.fillRect(x(-23),y(pose.pistonY+22),46*scale,40*scale);
  ctx.strokeStyle='#8c9caa';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x(pose.crankX),y(pose.crankY));ctx.lineTo(x(0),y(pose.pistonY));ctx.stroke();
  ctx.strokeStyle='#226ad8';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(x(0),y(0));ctx.lineTo(x(pose.crankX),y(pose.crankY));ctx.stroke();
  for(const [px,py] of [[0,0],[pose.crankX,pose.crankY],[0,pose.pistonY]]){
    ctx.fillStyle='#64707d';ctx.beginPath();ctx.arc(x(px),y(py),4,0,TAU);ctx.fill();
  }
  ctx.fillStyle='#0667d5';ctx.font='11px system-ui';ctx.fillText('拖动曲柄',x(pose.crankX)+10,y(pose.crankY)+15);
}

// The curve is another direct manipulation surface; the angle slider remains
// the keyboard and assistive-technology equivalent.
function bindScrub(canvas,angleFromEvent,canStart=()=>true){
  let pointer=null;
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0||!event.isPrimary||!canStart(event))return;pointer=event.pointerId;canvas.setPointerCapture(pointer);setAngle(angleFromEvent(event),true);});
  canvas.addEventListener('pointermove',event=>{if(event.pointerId===pointer)setAngle(angleFromEvent(event),true);});
  const end=event=>{if(event.pointerId===pointer){pointer=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,end);
}
bindScrub(byId('displacement-chart'),event=>{
  const rect=byId('displacement-chart').getBoundingClientRect();
  return Math.max(0,Math.min(1,(event.clientX-rect.left-48)/(rect.width-63)))*TAU;
});
bindScrub(byId('fallback'),event=>{
  const rect=byId('fallback').getBoundingClientRect(),p=fallbackProjection;
  return (Math.atan2((event.clientX-rect.left-p.originX)/p.scale,(p.originY-event.clientY+rect.top)/p.scale)+TAU)%TAU;
},()=>fallback&&Boolean(fallbackProjection));

for (const key of Object.keys(DEFAULTS)) {
  const input = byId(key);
  input.min = LIMITS[key].min;
  input.max = LIMITS[key].max;
  input.addEventListener('input', () => {
    params[key] = Number(input.value);
    updateParameters();
  });
}
byId('angle').addEventListener('input', (event) => setAngle(Number(event.target.value) * Math.PI / 180, true));
byId('play').addEventListener('click', () => setPlaying(!state.playing));
byId('step').addEventListener('click', () => setAngle(state.angle + 5 * Math.PI / 180));
byId('dead-center').addEventListener('click',()=>setAngle(0));
byId('bottom-dead-center').addEventListener('click',()=>setAngle(Math.PI));

document.querySelectorAll('[data-part]').forEach((button) => {
  button.addEventListener('click', () => selectPart(button.dataset.part));
});
function setView(view) {
  scene?.setView(view);
  byId('view-3d').setAttribute('aria-pressed', String(view === '3d'));
  byId('view-front').setAttribute('aria-pressed', String(view === 'front'));
  byId('view-name').textContent = view === '3d' ? '三维结构' : '正视 · 运动平面';
}
byId('view-3d').addEventListener('click', () => setView('3d'));
byId('view-front').addEventListener('click', () => setView('front'));
byId('reset').addEventListener('click', () => {
  setPlaying(false);
  Object.assign(params, DEFAULTS);
  state.angle = Math.PI / 4;
  updateParameters();
  selectPart('crank');
  if (scene) setView('3d');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPlaying(false);
});
theme.addEventListener('change', () => {
  chartDirty = true;
  update();
});
const resizeObserver = new ResizeObserver(() => {
  chartDirty = true;
  scene?.resize();
  update();
});
for (const id of ['viewport', 'displacement-chart', 'velocity-chart']) resizeObserver.observe(byId(id));
window.addEventListener('meshlab:panelchange',()=>{chartDirty=true;update();});
window.addEventListener('meshlab:statechange',()=>{chartDirty=true;update();});


updateParameters();
try {
  const { createScene } = await import('./scene.js');
  scene = await createScene({ container: byId('viewport'), onAngle: setAngle, onSelect: selectPart, onDragStart: () => setPlaying(false) });
  byId('viewer-status').hidden = true;
  scene.update(currentPose(), params);
  selectPart(state.selected);
} catch (error) {
  console.warn('三维视图不可用，启用平面模型。', error);
  byId('viewport').querySelectorAll('canvas:not(#fallback)').forEach((canvas) => canvas.remove());
  fallback = true;
  byId('fallback').hidden = false;
  byId('viewer-status').hidden = true;
  byId('view-name').textContent = '平面模型 · 三维视图不可用';
  byId('view-3d').disabled = true;
  byId('view-front').disabled = true;
  byId('view-3d').setAttribute('aria-pressed', 'false');
  byId('view-front').setAttribute('aria-pressed', 'true');
  byId('viewer-hint').textContent = '拖动曲柄或转角滑块；当前为平面示意，止点与曲线仍可使用。';
  update();
}

connectExplosion(scene, () => setPlaying(false));

function frame(time) {
  if (state.playing && !scene?.explosion?.active) {
    if (lastTime !== null) {
      const elapsed = (time - lastTime) / 1000 * demoSpeed;
      state.angle = (state.angle + elapsed * params.rpm * TAU / 60) % TAU;
      update();
    }
    lastTime = time;
  }
  scene?.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('meshlab:preset',event=>{if(event.detail.values){Object.assign(params,event.detail.values);updateParameters();window.dispatchEvent(new Event('meshlab:statechange'));}});
