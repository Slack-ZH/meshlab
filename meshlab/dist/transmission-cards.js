const cog=(x,y,r,n=18)=>{const points=Array.from({length:n*4},(_,i)=>{const a=i/(n*4)*Math.PI*2,q=i%4===1||i%4===2?r:r*.85;return `${x+Math.cos(a)*q},${y+Math.sin(a)*q}`;});return `<polygon points="${points.join(' ')}" fill="var(--diagram-fill)" stroke="var(--diagram-stroke)" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${r*.45}" fill="var(--diagram-surface)" stroke="var(--diagram-stroke)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r*.12}" fill="var(--diagram-stroke)"/>`;};
const arts=[`${cog(84,94,51)}${cog(161,94,32,14)}<path d="M84 148v12m77-30v30M45 160h151" stroke="var(--diagram-stroke)" stroke-width="3"/>`,`<g fill="none" stroke="var(--diagram-stroke)" stroke-width="4"><path d="M57 52 172 73M57 140l115-21"/><circle cx="57" cy="96" r="44"/><circle cx="172" cy="96" r="23"/><circle cx="57" cy="96" r="9"/><circle cx="172" cy="96" r="6"/></g>`,`<g stroke="var(--diagram-stroke)" stroke-width="3" fill="none"><path d="M23 136H217M51 134V93"/><circle cx="51" cy="93" r="28"/><path d="m51 93 19-21 96 45" stroke-width="8"/><rect x="156" y="105" width="39" height="27" rx="3" fill="var(--diagram-mid)"/><circle cx="51" cy="93" r="5" fill="var(--diagram-surface)"/><circle cx="70" cy="72" r="5" fill="var(--diagram-surface)"/><circle cx="174" cy="117" r="5" fill="var(--diagram-surface)"/></g>`,`<circle cx="120" cy="96" r="71" fill="none" stroke="var(--diagram-stroke)" stroke-width="12"/>${cog(120,96,26,14)}${cog(120,48,22,12)}${cog(78,120,22,12)}${cog(162,120,22,12)}<path d="m120 48-42 72h84z" fill="none" stroke="var(--diagram-mid)" stroke-width="4"/>`,` ${cog(116,70,42)}<path d="M29 132v-13h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v-11h12v11h12v13Z" fill="var(--diagram-mid)" stroke="var(--diagram-stroke)" stroke-width="2"/><path d="M35 147h164m-8-5 8 5-8 5" fill="none" stroke="var(--diagram-stroke)" stroke-width="2"/>`];
const entries=[['齿轮传动','GEAR DRIVE','#c6ceb9','通过相互啮合的齿轮，传递运动并改变转速与转矩。'],['带传动','BELT DRIVE','#dbd9c9','通过带与带轮连接两根轴，观察轮径与转速之间的关系。'],['曲柄滑块','SLIDER–CRANK','#c3cebf','把旋转运动转化为直线往复运动，理解曲柄、连杆与滑块的配合。'],['行星齿轮','PLANETARY GEARS','#d5cbbb','太阳轮、行星轮与齿圈共同构成紧凑的传动系统。'],['齿轮齿条','RACK & PINION','#cbd0c1','通过齿轮与齿条啮合，将旋转运动转化为直线运动。']];



arts.push(`<g fill="none" stroke="var(--diagram-stroke)" stroke-width="4"><path d="M63 55 181 75M63 139l118-22" stroke-width="7" stroke-dasharray="6 4"/>${cog(63,97,42,22)}${cog(181,97,22,12)}<path d="m63 97-20 30h-15" stroke-width="6"/><circle cx="181" cy="97" r="58" stroke-opacity=".25" stroke-width="2"/></g>`);
entries.push(['自行车链传动','BICYCLE CHAIN','#bfcfd0','前牙盘通过链条驱动后轮，调整齿数与踏频，观察速度和转矩的变化。']);

arts.push('<g stroke="var(--diagram-stroke)" fill="var(--diagram-fill)"><circle cx="64" cy="96" r="36" stroke-width="5"/><circle cx="157" cy="96" r="57" stroke-width="5"/><circle cx="64" cy="96" r="11" fill="var(--diagram-surface)" stroke-width="3"/><circle cx="157" cy="96" r="14" fill="var(--diagram-surface)" stroke-width="3"/><path d="M64 65v17m93 28v30M38 143c17 12 37 9 47-4m46-91c21-8 45-2 58 13" fill="none" stroke-width="3"/><path d="m78 137 8 2-2 8m99-89 7 4-1-9" fill="none" stroke-width="3"/></g>');
entries.push(['摩擦轮传动','FRICTION DRIVE','#d5c8ba','两只外接摩擦轮反向转动，调整轮径和接触载荷，比较理论转速与摩擦容量。']);

arts.push(`${cog(65,96,34,20)}${cog(158,96,63,40)}<g fill="none" stroke="var(--diagram-stroke)" stroke-width="2" stroke-dasharray="4 3"><circle cx="65" cy="96" r="31"/><circle cx="158" cy="96" r="62"/></g><path d="M65 96h93" stroke="var(--diagram-stroke)" stroke-width="1.5" stroke-dasharray="3 5"/>`);
entries.push(['单级直齿圆柱齿轮','SPUR GEARS','#c8cbd7','调整齿数、模数和齿宽，观察外啮合转向、速比及转矩与功率的关系。']);

arts.push(`${cog(39,96,25,20)}${cog(98,96,38,30)}${cog(180,96,50,40)}<path d="M39 151v9m141-4v4M39 160h141" fill="none" stroke="var(--diagram-stroke)" stroke-width="2"/><path d="m43 60 8 6-10 2m133-31-10 1 6 8" fill="none" stroke="var(--diagram-stroke)" stroke-width="3"/>`);
entries.push(['带惰轮齿轮列','IDLER GEAR TRAIN','#c5d2c9','三个齿轮、两次啮合；切换有无惰轮，比较输出转向、总速比与效率。']);

arts.push('<g fill="none" stroke="var(--diagram-stroke)" stroke-width="4"><circle cx="54" cy="96" r="34"/><circle cx="182" cy="96" r="46"/><path d="M76 70 153 131M76 122 153 61"/><path d="m101 102 24-19" stroke="var(--diagram-surface)" stroke-width="10"/><path d="m101 102 24-19"/><circle cx="54" cy="96" r="8"/><circle cx="182" cy="96" r="10"/></g>');
entries.push(['交叉平带传动','CROSSED FLAT BELT','#d2c4b7','交叉反向、开口同向；调节轮径和中心距，观察包角、带长与传动关系。']);

arts.push(`<path d="M49 62 170 45M49 130l121 17" fill="none" stroke="var(--diagram-stroke)" stroke-width="7"/>${cog(49,96,32,20)}${cog(170,96,49,40)}<path d="M54 69 165 53M54 123l111 16" fill="none" stroke="var(--diagram-stroke)" stroke-width="7" stroke-dasharray="3 6"/><path d="M19 96a30 34 0 0 1 30-34M49 130a30 34 0 0 1-30-34M170 45a49 51 0 0 1 0 102" fill="none" stroke="var(--diagram-stroke)" stroke-width="6"/>`);
entries.push(['同步带传动','TIMING BELT','#c0cbd9','固定节距、逐齿啮合；调整带轮齿数，验证速比与整数带齿的闭合关系。']);

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
  card.innerHTML = '<span class="card-top" aria-hidden="true"><span class="card-state">机械档案</span><span class="card-number">' + String(index % count + 1).padStart(2,'0') + ' / ' + String(count).padStart(2,'0') + '</span></span>'
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
    const t = (index * step - position) / (step * 1.05);
    const weight = Math.exp(-t * t * 2.1);
    const angle = Math.max(-74, Math.min(74, -t * 68));
    const depth = shelf.clientWidth <= 700 ? weight * 80 - 35 : weight * 165 - 75;
    cards[index].style.transform = reduced.matches
      ? 'translate(-50%,-50%) scale(.84)'
      : 'translate(-50%,-50%) translateZ(' + depth + 'px) rotateY(' + angle + 'deg) scale(' + (.66 + weight * .4) + ')';
    cards[index].style.opacity = reduced.matches ? '1' : String(.38 + weight * .62);
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
    card.querySelector('.card-state').textContent = selected ? '当前项目' : '机械档案';
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
