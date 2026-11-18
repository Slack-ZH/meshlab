const entries = [
  [
    "齿轮传动",
    "",
    "",
    "从真实的 GL16 齿轮组，理解两级传动如何配合。"
  ],
  [
    "带传动",
    "",
    "",
    "通过带与带轮，让两根轴之间的运动相连。"
  ],
  [
    "曲柄滑块",
    "",
    "",
    "从旋转到往复，观察曲柄、连杆与滑块的配合。"
  ],
  [
    "行星齿轮",
    "",
    "",
    "太阳轮与行星轮协同，构成紧凑的传动系统。"
  ],
  [
    "齿轮齿条",
    "",
    "",
    "让旋转变成直线运动，看清每一次啮合。"
  ]
];

/* Three identical sets let the rail wrap during a drag or a glide. */
const shelf = document.querySelector('.shelf');
const stage = shelf.closest('.hero');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const count = entries.length;
let step = 0, cycle = 0, active = -1, target = 0, frame = 0, captionTimer;
let paintedPosition, railWidth, glideTime, glideDecay, glidePosition = 0;
let drag = null, suppressClick = false;
let wheelSettleTimer = 0;
const cards = [];
const slots = [];
for (let index = 0; index < count * 3; index++) {
  const item = entries[index % count];
  const slot = document.createElement('div');
  slot.className = 'rail-slot';
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.tabIndex = -1;
  card.style.setProperty('--paper', item[2]);
  card.setAttribute('aria-label', item[0] + '，第 ' + (index % count + 1) + ' 个，共 ' + count + ' 个。使用左右方向键浏览');
  card.setAttribute('aria-pressed', 'false');
  const imageNames = ['gear','belt','crank','planetary','rack'];
  card.dataset.surface = 'specimen-surface-' + index;
  const isModel = index % count === 0;
  card.innerHTML = '<span class="card-state sr-only">机械档案</span>'
    + '<span class="card-visual" aria-hidden="true"><span class="model-surface" id="' + card.dataset.surface + '"><img src="homepage/assets/' + imageNames[index % count] + '.png" width="1000" height="760" alt="" draggable="false"></span></span>'
    + '<span class="card-bottom" aria-hidden="true"><span class="card-title">' + item[0] + '</span><span class="card-kind">' + (isModel ? 'GL16 模型' : '原理示意') + '</span></span>';
  card.addEventListener('click', () => { if (!suppressClick) moveTo(index * step); });
  slot.append(card);
  shelf.append(slot);
  slots.push(slot);
  cards.push(card);
}
function cancelWheelSettle() {
  clearTimeout(wheelSettleTimer);
  wheelSettleTimer = 0;
}
function stop() {
  cancelWheelSettle();
  cancelAnimationFrame(frame);
  frame = 0;
  target = shelf.scrollLeft;
}
function update(force = false) {
  if (!cycle) return;
  // Recenter only in the cloned overlap. Adjust the animation target by the same amount.
  const before = shelf.scrollLeft;
  const wrapped = ((before - cycle / 2) % cycle + cycle) % cycle + cycle / 2;
  if (Math.abs(wrapped - before) > 1) {
    shelf.scrollLeft = wrapped;
    target += wrapped - before;
  }
  const position = shelf.scrollLeft;
  if (position === paintedPosition && !force) return;
  paintedPosition = position;
  const nearest = Math.round(position / step);
  slots.forEach((slot, index) => {
    const t = (index * step - position) / (step * 1.05);
    const weight = Math.exp(-t * t * 2.1);
    const angle = Math.max(-64, Math.min(64, -t * 55));
    const depth = railWidth <= 700 ? weight * 65 - 30 : weight * 160 - 60;
    cards[index].style.transform = reduced.matches
      ? 'translate(-50%,calc(0% - var(--model-axis))) scale(.84)'
      : 'translate(-50%,calc(0% - var(--model-axis))) translateZ(' + depth + 'px) rotateY(' + angle + 'deg) scale(' + (.57 + weight * .51) + ')';
    cards[index].style.opacity = reduced.matches ? '1' : String(.32 + weight * .68);
    slot.style.zIndex = String(Math.round(weight * 100));
  });
  if (nearest === active) return;
  const hasCardFocus = cards.includes(document.activeElement);
  active = nearest;
  cards.forEach((card, index) => {
    const selected = index === active;
    card.classList.toggle('active', selected);
    card.tabIndex = selected ? 0 : -1;
    card.setAttribute('aria-pressed', String(selected));
    card.setAttribute('aria-hidden', String(!selected));
    card.querySelector('.card-state').textContent = selected ? '当前项目' : '机械档案';
  });
  if (hasCardFocus) cards[active].focus({preventScroll:true});
  clearTimeout(captionTimer);
  const showCaption = () => {
    document.getElementById('caption-title').textContent = entries[active % count][0];
    document.getElementById('caption').textContent = entries[active % count][3];
    const names=['HELICAL GEARS','BELT DRIVE','SLIDER CRANK','PLANETARY GEARS','RACK & PINION'];
    const relations=['旋转输入 / 两级减速','柔性连接 / 跨轴传递','回转运动 / 往复转换','多轮协同 / 紧凑传动','旋转运动 / 直线输出'];
    document.querySelector('.specimen-number').textContent=String(active%count+1).padStart(2,'0');
    document.getElementById('specimen-en').textContent=names[active%count];
    document.getElementById('specimen-relation').textContent=relations[active%count];
    document.dispatchEvent(new CustomEvent('specimenchange',{detail:{index:active%count,card:cards[active]}}));
  };
  captionTimer = setTimeout(showCaption, reduced.matches ? 0 : 100);
}
function glide(now) {
  // Keep the fractional position between frames, including across a loop boundary.
  const dt = Math.max(0, now - glideTime);
  glideTime = now;
  const remaining = (target - glidePosition) * Math.exp(-dt / glideDecay);
  const done = Math.abs(remaining) < .5;
  glidePosition = done ? target : target - remaining;
  shelf.scrollLeft = glidePosition;
  const beforeWrap = target;
  update();
  glidePosition += target - beforeWrap;
  frame = done ? 0 : requestAnimationFrame(glide);
}
function moveTo(position, decay = 95) {
  cancelWheelSettle();
  target = position;
  glideDecay = decay;
  if (reduced.matches) { shelf.scrollLeft = target; update(); }
  else if (!frame) {
    glidePosition = shelf.scrollLeft;
    glideTime = performance.now();
    frame = requestAnimationFrame(glide);
  }
}
function settleAt(projectedPosition, decay = 95) {
  if (step) moveTo(Math.round(projectedPosition / step) * step, decay);
}
function resizeRail() {
  // Measure in layout pixels even while the entire exhibit scales on vertical scroll.
  const nextStep = parseFloat(getComputedStyle(slots[0]).width);
  if (nextStep === step && railWidth === shelf.clientWidth) return;
  const fraction = step ? (frame ? target : shelf.scrollLeft) / step : count;
  stop();
  step = nextStep;
  railWidth = shelf.clientWidth;
  cycle = step * count;
  shelf.scrollLeft = (drag ? fraction : Math.round(fraction)) * step;
  target = shelf.scrollLeft;
  update(true);
}
shelf.addEventListener('scroll', () => update(), {passive:true});
shelf.addEventListener('scrollend', () => {
  const position = shelf.scrollLeft;
  if (step && !drag && !frame && !wheelSettleTimer && Math.abs(position - Math.round(position / step) * step) > 1) {
    settleAt(position);
  }
});
new ResizeObserver(resizeRail).observe(shelf);
resizeRail();
reduced.addEventListener('change', () => { stop(); if (!drag) settleAt(shelf.scrollLeft); update(true); });
let lastHorizontalWheel = -Infinity;
stage.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey || event.defaultPrevented || scrollY > 1) return;
  const now = performance.now();
  const x = Math.abs(event.deltaX), y = Math.abs(event.deltaY);
  // Trackpads sometimes finish a horizontal stroke with nearly vertical jitter.
  const continuing = now - lastHorizontalWheel < 150;
  if (!event.shiftKey && x <= y && (!continuing || (!x && y >= 6))) {
    lastHorizontalWheel = -Infinity;
    return;
  }
  if (event.cancelable) event.preventDefault();
  lastHorizontalWheel = now;
  const delta = event.shiftKey && y > x ? event.deltaY : event.deltaX;
  if (!delta && !wheelSettleTimer) return;
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? railWidth : 1;
  // A new stroke takes over from the visible position, even during centering.
  if (!wheelSettleTimer) stop();
  // Wheel streams already include OS momentum. Only smooth delivery between events.
  moveTo(target + Math.max(-cycle / 2, Math.min(cycle / 2, delta * scale)), 45);
  wheelSettleTimer = setTimeout(() => settleAt(target), 160);
}, {passive:false});
function navigate(direction) { moveTo((Math.round((frame ? target : shelf.scrollLeft) / step) + direction) * step); }
shelf.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') moveTo(count * step);
  else if (event.key === 'End') moveTo((count * 2 - 1) * step);
  else navigate(event.key === 'ArrowRight' ? 1 : -1);
});
stage.addEventListener('pointerdown', event => {
  if (!event.isPrimary) { endDrag(); return; }
  if (event.button !== 0 || scrollY > 1 || event.target.closest('a,button:not(.card),input,select,textarea')) return;
  stop();
  suppressClick = false;
  drag = {id:event.pointerId, startX:event.clientX, startY:event.clientY, x:event.clientX,
    time:event.timeStamp, velocity:0, horizontal:false};
});
window.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.horizontal) {
    const dx = Math.abs(event.clientX - drag.startX), dy = Math.abs(event.clientY - drag.startY);
    if (Math.max(dx, dy) < 5) return;
    if (dx <= dy) { endDrag(); return; }
    drag.horizontal = true;
    suppressClick = true;
    stage.classList.add('dragging');
    stage.setPointerCapture(drag.id);
  }
  if (event.cancelable) event.preventDefault();
  const delta = drag.x - event.clientX;
  if (!delta) return;
  const dt = Math.max(1, event.timeStamp - drag.time);
  const speed = delta / dt;
  const blend = 1 - Math.exp(-dt / 38);
  drag.velocity = Math.sign(speed) === Math.sign(drag.velocity)
    ? drag.velocity + (speed - drag.velocity) * blend : speed;
  drag.x = event.clientX;
  drag.time = event.timeStamp;
  shelf.scrollLeft += delta;
  update();
}, {passive:false});
function endDrag(event) {
  if (!drag || (event && event.pointerId !== drag.id)) return;
  const released = drag;
  drag = null;
  if (stage.hasPointerCapture(released.id)) stage.releasePointerCapture(released.id);
  stage.classList.remove('dragging');
  let projected = shelf.scrollLeft;
  if (event?.type === 'pointerup' && released.horizontal && !reduced.matches) {
    const freshness = Math.max(0, 1 - (event.timeStamp - released.time) / 120);
    const coast = Math.min(step * .95, Math.abs(released.velocity) * 145) * freshness;
    projected += Math.sign(released.velocity) * coast;
  }
  // Use one deceleration curve through to the centered model.
  settleAt(projected, 145);
  // The click produced by this release must not recenter the card underneath it.
  setTimeout(() => { suppressClick = false; }, 0);
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
stage.addEventListener('lostpointercapture', event => { if (event.target === stage) endDrag(event); });
function settleVisible() {
  endDrag();
  stop();
  settleAt(shelf.scrollLeft);
  lastHorizontalWheel = -Infinity;
}
stage.addEventListener('specimenturn', settleVisible);
window.addEventListener('blur', settleVisible);

// A small pointer-following highlight suggests a curved glass surface without moving the content.
cards.forEach(card => {
  card.addEventListener('pointermove', event => {
    if (reduced.matches || drag || event.pointerType !== 'mouse') return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--light-x', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
    card.style.setProperty('--light-y', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
  });
  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--light-x');
    card.style.removeProperty('--light-y');
  });
});
