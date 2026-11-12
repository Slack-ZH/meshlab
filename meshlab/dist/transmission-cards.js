const cog=(x,y,r,n=18)=>{const points=Array.from({length:n*4},(_,i)=>{const a=i/(n*4)*Math.PI*2,q=i%4===1||i%4===2?r:r*.85;return `${x+Math.cos(a)*q},${y+Math.sin(a)*q}`;});return `<polygon points="${points.join(' ')}" fill="var(--diagram-fill)" stroke="var(--diagram-stroke)" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${r*.45}" fill="var(--diagram-surface)" stroke="var(--diagram-stroke)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r*.12}" fill="var(--diagram-stroke)"/>`;};
const arts=[`${cog(84,94,51)}${cog(161,94,32,14)}<path d="M84 148v12m77-30v30M45 160h151" stroke="var(--diagram-stroke)" stroke-width="3"/>`,`<g fill="none" stroke="var(--diagram-stroke)" stroke-width="4"><path d="M57 52 172 73M57 140l115-21"/><circle cx="57" cy="96" r="44"/><circle cx="172" cy="96" r="23"/><circle cx="57" cy="96" r="9"/><circle cx="172" cy="96" r="6"/></g>`,`<g stroke="var(--diagram-stroke)" stroke-width="3" fill="none"><path d="M23 136H217M51 134V93"/><circle cx="51" cy="93" r="28"/><path d="m51 93 19-21 96 45" stroke-width="8"/><rect x="156" y="105" width="39" height="27" rx="3" fill="var(--diagram-mid)"/><circle cx="51" cy="93" r="5" fill="var(--diagram-surface)"/><circle cx="70" cy="72" r="5" fill="var(--diagram-surface)"/><circle cx="174" cy="117" r="5" fill="var(--diagram-surface)"/></g>`,`<circle cx="120" cy="96" r="71" fill="none" stroke="var(--diagram-stroke)" stroke-width="12"/>${cog(120,96,26,14)}${cog(120,48,22,12)}${cog(78,120,22,12)}${cog(162,120,22,12)}<path d="m120 48-42 72h84z" fill="none" stroke="var(--diagram-mid)" stroke-width="4"/>`,` ${cog(116,70,42)}<path d="M29 132v-13h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v13Z" fill="var(--diagram-mid)" stroke="var(--diagram-stroke)" stroke-width="2"/><path d="M35 147h164m-8-5 8 5-8 5" fill="none" stroke="var(--diagram-stroke)" stroke-width="2"/>`];
const entries=[['齿轮传动','GEAR DRIVE','#c6ceb9','通过相互啮合的齿轮，传递运动并改变转速与转矩。'],['带传动','BELT DRIVE','#dbd9c9','通过带与带轮连接两根轴，观察轮径与转速之间的关系。'],['曲柄滑块','SLIDER–CRANK','#c3cebf','把旋转运动转化为直线往复运动，理解曲柄、连杆与滑块的配合。'],['行星齿轮','PLANETARY GEARS','#d5cbbb','太阳轮、行星轮与齿圈共同构成紧凑的传动系统。'],['齿轮齿条','RACK & PINION','#cbd0c1','通过齿轮与齿条啮合，将旋转运动转化为直线运动。']];


/* Three identical sets allow invisible recentering without an item snap. */
const shelf = document.querySelector('.shelf');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const count = entries.length;
let step = 0, cycle = 0, active = -1, target = 0, frame = 0, captionTimer;
let drag = null, suppressClick = false;
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
  card.innerHTML = '<span class="card-top" aria-hidden="true"><span>传动结构 / ARCHIVE</span><span class="card-number">0' + (index % count + 1) + '</span></span>'
    + '<span class="card-visual" aria-hidden="true"><svg viewBox="0 0 240 190">' + arts[index % count] + '</svg></span>'
    + '<span class="card-title" aria-hidden="true">' + item[0] + '</span><span class="card-sub" aria-hidden="true">' + item[1] + '</span>';
  card.addEventListener('click', () => { if (!suppressClick) moveTo(index * step); });
  slot.append(card);
  shelf.append(slot);
  slots.push(slot);
  cards.push(card);
}
function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  target = shelf.scrollLeft;
}
function update() {
  if (!cycle) return;
  // Recenter only in the cloned overlap. Adjust the animation target by the same amount.
  const before = shelf.scrollLeft;
  const wrapped = ((before - cycle / 2) % cycle + cycle) % cycle + cycle / 2;
  if (Math.abs(wrapped - before) > 1) {
    shelf.scrollLeft = wrapped;
    target += wrapped - before;
  }
  const position = shelf.scrollLeft;
  const nearest = Math.round(position / step);
  slots.forEach((slot, index) => {
    const t = (index * step - position) / (step * 1.2);
    const weight = Math.exp(-t * t * 1.5);
    const angle = Math.max(-68, Math.min(68, -t * 57));
    cards[index].style.transform = reduced.matches
      ? 'translate(-50%,-50%) scale(.88)'
      : 'translate(-50%,-50%) translateZ(' + (weight * 85 - 35) + 'px) rotateY(' + angle + 'deg) scale(' + (.82 + weight * .18) + ')';
    // Keep the glass clear: a brightness filter would muddy its transmitted backdrop.
    cards[index].style.filter = 'none';
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
  });
  if (hasCardFocus) cards[active].focus({preventScroll:true});
  clearTimeout(captionTimer);
  const showCaption = () => {
    document.getElementById('caption-title').textContent = entries[active % count][0];
    document.getElementById('caption').textContent = entries[active % count][3];
  };
  captionTimer = setTimeout(showCaption, reduced.matches ? 0 : 100);
}
function glide() {
  const delta = target - shelf.scrollLeft;
  if (Math.abs(delta) < .75) {
    shelf.scrollLeft = target;
    frame = 0;
    update();
    return;
  }
  const previous = shelf.scrollLeft;
  shelf.scrollLeft += delta * .16;
  update();
  // Prevent an endless frame loop if a browser rounds subpixel scroll positions.
  if (previous === shelf.scrollLeft) {
    shelf.scrollLeft = target;
    frame = 0;
    update();
  } else frame = requestAnimationFrame(glide);
}
function moveTo(position) {
  target = position;
  if (reduced.matches) { shelf.scrollLeft = target; update(); }
  else if (!frame) frame = requestAnimationFrame(glide);
}
function resizeRail() {
  const fraction = step ? shelf.scrollLeft / step : count;
  stop();
  step = slots[0].getBoundingClientRect().width;
  cycle = step * count;
  shelf.scrollLeft = fraction * step;
  target = shelf.scrollLeft;
  update();
}
shelf.addEventListener('scroll', update, {passive:true});
new ResizeObserver(resizeRail).observe(shelf);
resizeRail();
reduced.addEventListener('change', () => { stop(); update(); });
shelf.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey) return; // Preserve browser pinch-to-zoom.
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? shelf.clientWidth : 1;
  const amount = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * scale;
  if (!amount) return;
  event.preventDefault();
  if (!frame) target = shelf.scrollLeft;
  moveTo(target + Math.max(-500, Math.min(500, amount)) * .85);
}, {passive:false});
function navigate(direction) { moveTo((Math.round((frame ? target : shelf.scrollLeft) / step) + direction) * step); }
shelf.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') moveTo(count * step);
  else if (event.key === 'End') moveTo((count * 2 - 1) * step);
  else navigate(event.key === 'ArrowRight' ? 1 : -1);
});
// Mouse dragging complements native touch and trackpad scrolling.
shelf.addEventListener('pointerdown', event => {
  stop();
  suppressClick = false;
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  drag = {id:event.pointerId, x:event.clientX, total:0};
});
shelf.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const delta = drag.x - event.clientX;
  drag.x = event.clientX;
  drag.total += Math.abs(delta);
  if (drag.total > 5) {
    suppressClick = true;
    shelf.classList.add('dragging');
    shelf.setPointerCapture(event.pointerId);
    shelf.scrollLeft += delta;
    target = shelf.scrollLeft;
    update();
  }
});
function endDrag() {
  if (drag && shelf.hasPointerCapture(drag.id)) shelf.releasePointerCapture(drag.id);
  drag = null;
  shelf.classList.remove('dragging');
  // The click resulting from a pointerup is dispatched before this timer.
  setTimeout(() => { suppressClick = false; }, 0);
}
shelf.addEventListener('pointerup', endDrag);
shelf.addEventListener('pointercancel', endDrag);
shelf.addEventListener('lostpointercapture', () => { drag = null; shelf.classList.remove('dragging'); });
window.addEventListener('blur', () => { endDrag(); stop(); });

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
