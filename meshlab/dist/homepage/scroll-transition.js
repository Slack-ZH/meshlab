(() => {
  const hero = document.getElementById('collection');
  const shelf = hero.querySelector('.shelf');
  const dock = document.querySelector('.catalog-dock');
  const catalogPage = document.querySelector('.catalog-page');
  document.documentElement.classList.add('paged-home');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const flight = document.createElement('div');
  flight.className = 'model-flight';
  flight.setAttribute('aria-hidden', 'true');
  document.body.append(flight);

  let source, surface, frame = 0;
  let start = 0, end = 1;
  let resized = true;
  let turn = null;
  let directoryTop = 0;
  const mix = (from, to, t) => from + (to - from) * t;

  function draw() {
    frame = 0;
    const card = shelf.querySelector('.card.active');
    if (!card) return;
    const next = document.getElementById(card.dataset.surface);
    if (next !== surface) {
      if (surface && surface.parentNode !== source) source.append(surface);
      source = card.querySelector('.card-visual');
      surface = next;
      resized = true;
    }
    let t = Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
    if (reduced.matches) t = t < .5 ? 0 : 1;
    const labelVisibility = Math.max(0, Math.min(1, 1 - (t - .08) / .19)).toFixed(3);
    if (hero.style.getPropertyValue('--stage-label') !== labelVisibility) {
      hero.style.setProperty('--stage-label', labelVisibility);
    }
    if (t === 0) {
      if (surface.parentNode !== source) source.append(surface);
      return;
    }
    if (t === 1 && surface.parentNode === dock && !resized) return;

    // The empty source slot keeps its carousel perspective and the dock keeps its grid cell.
    // Both can be measured without moving the canvas or changing its drawing buffer.
    const from = source.getBoundingClientRect();
    const to = dock.getBoundingClientRect();
    if (!from.width || !from.height || !to.width || !to.height) return;
    const fit = Math.min(to.width / from.width, to.height / from.height);
    resized = false;
    if (t === 1) {
      dock.style.setProperty('--land-width', from.width * fit + 'px');
      dock.style.setProperty('--land-height', from.height * fit + 'px');
      if (surface.parentNode !== dock) dock.append(surface);
      return;
    }

    const eased = t * t * (3 - 2 * t);
    const scale = Math.pow(fit, eased);
    const width = from.width * scale, height = from.height * scale;
    const arc = 4 * eased * (1 - eased);
    let x = mix(from.left + from.width / 2, to.left + to.width / 2, eased);
    let y = mix(from.top + from.height / 2, to.top + to.height / 2, eased);
    if (innerWidth <= 620) {
      x -= Math.max(0, Math.min(72 * arc, x - width / 2 - 4));
    } else {
      x -= Math.min(190, innerWidth * .14) * arc;
    }
    y -= Math.min(96, innerHeight * .1) * arc;
    flight.style.width = from.width + 'px';
    flight.style.height = from.height + 'px';
    flight.style.transform = 'translate3d(' + (x - width / 2) + 'px,' + (y - height / 2) +
      'px,0) scale(' + scale + ')';
    if (surface.parentNode !== flight) flight.append(surface);
  }
  function schedule() {
    if (!turn && !frame) frame = requestAnimationFrame(draw);
  }
  function measure() {
    const viewport = document.documentElement.clientHeight;
    const target = dock.getBoundingClientRect();
    directoryTop = catalogPage.getBoundingClientRect().top + scrollY;
    start = Math.max(0, hero.offsetHeight - viewport) + viewport * .025;
    end = Math.max(start + 1, target.top + scrollY + catalogPage.scrollTop + target.height / 2 - viewport * .28);
    resized = true;
    schedule();
  }

  // Both directions use the same scroll coordinates and the same model path.
  function cancelTurn() {
    if (!turn) return;
    cancelAnimationFrame(frame);
    frame = 0;
    turn = null;
    schedule();
  }
  function advance(now) {
    const t = reduced.matches ? 1 : Math.min(1, (now - turn.started) / 860);
    const ease = t * t * (3 - 2 * t);
    const destination = turn.direction > 0 ? directoryTop : 0;
    window.scrollTo({top: mix(turn.from, destination, ease), behavior:'instant'});
    draw();
    if (t < 1 && (t < .5 || Math.abs(scrollY - destination) > .5)) {
      frame = requestAnimationFrame(advance);
    } else {
      const heading = turn.direction > 0 ? 'catalog-title' : 'hero-title';
      const arrivedPanel = turn.direction > 0 ? catalogPage : hero;
      if (turn.keyboard || !arrivedPanel.contains(document.activeElement)) {
        document.getElementById(heading).focus({preventScroll:true});
      }
      turn = null;
    }
  }
  function beginTurn(direction, keyboard = false) {
    if (turn) return;
    hero.dispatchEvent(new Event('specimenturn'));
    if (direction > 0) catalogPage.scrollTop = 0;
    cancelAnimationFrame(frame);
    const now = performance.now();
    turn = {direction, from: scrollY, started: now, keyboard};
    advance(now);
  }
  function canTurn(direction, target) {
    if (turn || target.closest?.('input:not([type="search"]), textarea, select, [contenteditable]:not([contenteditable="false"]), #mobile-nav') ||
        document.querySelector('.menu-toggle')?.getAttribute('aria-expanded') === 'true') return false;
    if (direction < 0) return catalogPage.scrollTop <= 0 && scrollY > 1;
    return scrollY < directoryTop - 1 && !catalogPage.contains(target);
  }

  // Wheel events have no finger-up event. Require quiet both in the input stream
  // and at the physical top of the pane before accepting another upward gesture.
  const wheelQuiet = 360;
  let lastWheel = -Infinity, lastDirection = 0, swallowed = false;
  let wasAtTop = catalogPage.scrollTop <= 0, hitTop = -Infinity;
  catalogPage.addEventListener('scroll', () => {
    const atTop = catalogPage.scrollTop <= 0;
    if (atTop && !wasAtTop) hitTop = performance.now();
    wasAtTop = atTop;
  }, {passive:true});

  window.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const direction = Math.sign(event.deltaY);
    const now = performance.now();
    const newGesture = direction !== lastDirection || now - lastWheel >= wheelQuiet;
    lastWheel = now;
    lastDirection = direction;
    if (newGesture) {
      const eligible = canTurn(direction, event.target) && (direction > 0 || now - hitTop >= wheelQuiet);
      swallowed = !!turn || eligible;
      if (eligible) beginTurn(direction);
    }
    if ((swallowed || turn) && event.cancelable) event.preventDefault();
    // Everything else belongs to the native pane, including momentum at its edge.
  }, {passive:false});

  let swipe = null;
  window.addEventListener('touchstart', event => {
    swipe = null;
    if (event.touches.length !== 1) return;
    const direction = scrollY < directoryTop / 2 ? 1 : -1;
    if (!canTurn(direction, event.target)) return;
    const point = event.touches[0];
    swipe = {x:point.clientX, y:point.clientY, direction, committed:false};
  }, {passive:true});
  window.addEventListener('touchmove', event => {
    if (event.touches.length !== 1) return;
    if (turn || swipe?.committed) {
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (!swipe) return;
    const dx = Math.abs(event.touches[0].clientX - swipe.x);
    const dy = swipe.y - event.touches[0].clientY;
    if (Math.max(dx, Math.abs(dy)) < 5) return;
    if (dx > Math.abs(dy) || Math.sign(dy) !== swipe.direction) { swipe = null; return; }
    if (event.cancelable) event.preventDefault();
    if (Math.abs(dy) >= 12) {
      swipe.committed = true;
      if (event.cancelable) beginTurn(swipe.direction);
      else swipe.onRelease = true;
    }
  }, {passive:false});
  window.addEventListener('touchend', () => {
    if (swipe?.onRelease) beginTurn(swipe.direction);
    swipe = null;
  }, {passive:true});
  window.addEventListener('touchcancel', () => { swipe = null; }, {passive:true});

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
        (event.shiftKey && event.key !== ' ')) return;
    if (['Escape','Home','End'].includes(event.key)) { cancelTurn(); return; }
    if (!['PageDown','ArrowDown','PageUp','ArrowUp',' '].includes(event.key)) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (event.key === ' ' && event.target.closest?.('button, a, summary')) return;
    const direction = event.shiftKey || ['PageUp','ArrowUp'].includes(event.key) ? -1 : 1;
    if (turn) { event.preventDefault(); return; }
    if (!canTurn(direction, event.target)) return;
    event.preventDefault();
    if (!event.repeat) beginTurn(direction, true);
  });
  window.addEventListener('hashchange', cancelTurn);
  window.addEventListener('pagehide', cancelTurn);
  const observer = new ResizeObserver(measure);
  observer.observe(hero);
  observer.observe(dock);
  shelf.addEventListener('scroll', schedule, {passive:true});
  document.addEventListener('specimenchange', schedule);
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', measure);
  reduced.addEventListener('change', measure);
  measure();
})();
