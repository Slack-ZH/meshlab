(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const opening = document.querySelector('.opening');

  if (document.documentElement.classList.contains('show-opening')) {
    const listeners = new AbortController();
    const options = { once: true, signal: listeners.signal };
    function finishOpening() {
      clearTimeout(deadline);
      listeners.abort();
      document.documentElement.classList.remove('show-opening');
      window.dispatchEvent(new Event('openingfinished'));
    }
    // The deadline also covers a background tab or a disabled CSS animation.
    const deadline = setTimeout(finishOpening, 1850);
    opening.addEventListener('animationend', event => {
      if (event.target === opening) finishOpening();
    }, { signal: listeners.signal });
    for (const type of ['pointerdown', 'wheel', 'keydown', 'pagehide']) {
      window.addEventListener(type, finishOpening, { ...options, capture: true, passive: true });
    }
    reducedMotion.addEventListener('change', finishOpening, options);
  }

  const fullTurn = Math.PI * 2;
  function circle(context, x, y, radius) {
    context.beginPath();
    context.arc(x, y, radius, 0, fullTurn);
    context.stroke();
  }

  function drawWheel(context, x, y, radius, teeth, phase) {
    context.save();
    context.translate(x, y);
    context.rotate(phase);
    context.strokeStyle = 'rgba(167, 230, 236, .62)';
    context.beginPath();
    const tooth = [[0, .958], [.18, .958], [.34, 1.039], [.65, 1.039], [.81, .958]];
    for (let index = 0; index < teeth; index++) {
      for (const [position, scale] of tooth) {
        const angle = (index + position) * fullTurn / teeth;
        context.lineTo(Math.cos(angle) * radius * scale, Math.sin(angle) * radius * scale);
      }
    }
    context.closePath();
    context.stroke();
    context.strokeStyle = 'rgba(164, 220, 230, .38)';
    for (const scale of [.16, .23, .79, .87]) circle(context, 0, 0, radius * scale);
    for (let index = 0; index < 6; index++) {
      const angle = index * fullTurn / 6;
      circle(context, Math.cos(angle) * radius * .52, Math.sin(angle) * radius * .52, radius * .136);
    }
    context.setLineDash([9, 5, 2, 5]);
    context.strokeStyle = 'rgba(170, 228, 234, .28)';
    circle(context, 0, 0, radius);
    context.restore();
  }

  // Paint the drafting sheet once per size. The pointer only moves its light and mask.
  function drawBlueprint(canvas) {
    const context = canvas.getContext('2d');
    if (!context) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const resolution = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * resolution);
    canvas.height = Math.round(height * resolution);
    context.setTransform(resolution, 0, 0, resolution, 0, 0);
    context.lineWidth = 1;
    const radius = Math.min(205, Math.max(104, width * .14));
    const pitch = radius * 3;
    for (let row = 0; row * pitch < height + pitch; row++) {
      const y = row * pitch + radius * .5;
      const offset = row % 2 ? radius * 1.35 : radius * .34;
      for (let column = -1; column * pitch < width + pitch; column++) {
        const x = column * pitch + offset;
        drawWheel(context, x, y, radius, 48, 0);
        drawWheel(context, x + 1.5 * radius, y, .5 * radius, 24, Math.PI / 24);
      }
      context.strokeStyle = 'rgba(151, 204, 219, .25)';
      context.setLineDash([14, 5, 2, 5]);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      context.setLineDash([]);
    }
  }
  const blueprint = document.querySelector('.blueprint');
  const pointerEffects = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
  const blueprintObserver = new ResizeObserver(() => drawBlueprint(blueprint));
  function setBlueprintEnabled() {
    if (pointerEffects.matches) blueprintObserver.observe(blueprint);
    else blueprintObserver.disconnect();
  }
  pointerEffects.addEventListener('change', setBlueprintEnabled);
  setBlueprintEnabled();

  for (const field of document.querySelectorAll('.pointer-field')) {
    const surface = field.parentElement;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let lightX = 0;
    let lightY = 0;
    function drawLight() {
      frame = 0;
      const bounds = surface.getBoundingClientRect();
      const dx = pointerX - bounds.left - lightX;
      const dy = pointerY - bounds.top - lightY;
      lightX += dx * .32;
      lightY += dy * .32;
      field.style.setProperty('--light-x', lightX.toFixed(1) + 'px');
      field.style.setProperty('--light-y', lightY.toFixed(1) + 'px');
      if (Math.abs(dx) + Math.abs(dy) > .7) frame = requestAnimationFrame(drawLight);
    }
    function clearLight() {
      cancelAnimationFrame(frame);
      frame = 0;
      field.classList.remove('is-lit');
    }
    surface.addEventListener('pointermove', event => {
      if (!pointerEffects.matches || event.pointerType !== 'mouse' || event.buttons) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!field.classList.contains('is-lit')) {
        const bounds = surface.getBoundingClientRect();
        lightX = pointerX - bounds.left;
        lightY = pointerY - bounds.top;
        field.classList.add('is-lit');
      }
      if (!frame) frame = requestAnimationFrame(drawLight);
    }, { passive: true });
    surface.addEventListener('pointerleave', clearLight);
    surface.addEventListener('pointercancel', clearLight);
    window.addEventListener('scroll', clearLight, { passive: true });
    window.addEventListener('blur', clearLight);
    pointerEffects.addEventListener('change', clearLight);
  }

  const controls = document.querySelectorAll('.glass, .view-control button, .learning-step, .menu-toggle');
  for (const control of controls) {
    control.classList.add('motion-button');
    control.addEventListener('pointermove', event => {
      if (!pointerEffects.matches || event.pointerType !== 'mouse') return;
      const bounds = control.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      control.style.setProperty('--button-x', x + 'px');
      control.style.setProperty('--button-y', y + 'px');
      control.style.setProperty('--icon-x', ((x / bounds.width - .5) * 6) + 'px');
      control.style.setProperty('--icon-y', ((y / bounds.height - .5) * 4) + 'px');
    }, { passive: true });
    control.addEventListener('pointerleave', () => {
      for (const key of ['--button-x', '--button-y', '--icon-x', '--icon-y']) control.style.removeProperty(key);
    });
    function pulse(x, y) {
      if (reducedMotion.matches) return;
      const wave = document.createElement('span');
      wave.className = 'button-wave';
      wave.setAttribute('aria-hidden', 'true');
      const diameter = Math.hypot(control.offsetWidth, control.offsetHeight) * 2;
      Object.assign(wave.style, {
        left: x + 'px', top: y + 'px', width: diameter + 'px', height: diameter + 'px'
      });
      control.querySelector('.button-wave')?.remove();
      control.prepend(wave);
      setTimeout(() => wave.remove(), 460);
    }
    control.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const bounds = control.getBoundingClientRect();
      pulse(event.clientX - bounds.left, event.clientY - bounds.top);
    }, { passive: true });
    control.addEventListener('click', event => {
      if (!event.detail) pulse(control.clientWidth / 2, control.clientHeight / 2);
    });
  }
})();
