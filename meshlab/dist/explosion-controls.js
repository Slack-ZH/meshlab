// The same controls serve every procedural model without replacing its loader,
// playback state, canvas, selection handlers or parameter calculations.
export function connectExplosion(scene, pause) {
  const $ = id => document.getElementById(id);
  const controls = ['explode', 'explode-all', 'assemble-all'].map($);
  const explosion = scene?.explosion;
  if (!explosion) {
    controls.forEach(control => { if (control) control.disabled = true; });
    if ($('explosion-note')) $('explosion-note').textContent = '三维模型未能加载。你仍可调整参数和查看计算结果。';
    return;
  }
  const note = $('explosion-note');
  const instructions = note.textContent;
  function sync(state) {
    controls.forEach(control => { control.disabled = !state.available; });
    $('explode').value = Math.round(state.target * 100);
    $('explode').style.setProperty('--progress', `${state.target * 100}%`);
    $('explode-value').value = `${Math.round(state.target * 100)}%`;
    $('explode-all').setAttribute('aria-pressed', String(state.target > 0));
    note.textContent = state.available ? (state.stepTitle || instructions) : '当前模型没有可分离的多个零件。';
  }
  explosion.subscribe(sync);
  const expand = value => {
    if (value > 0) pause();
    explosion.setTarget(value);
    $('status-message').textContent = value > 0
      ? '已暂停传动。拖动滑块观察装配关系；仍可旋转、缩放和选择零件。'
      : '正在复原装配，可继续观察或播放传动。';
  };
  $('explode').addEventListener('input', event => expand(Number(event.target.value) / 100));
  $('explode-all').addEventListener('click', () => expand(1));
  $('assemble-all').addEventListener('click', () => expand(0));
  // Restore before operating the mechanism. Playback waits for the smooth
  // return in the app's frame loop; discrete motion/dragging uses exact assembly.
  $('play')?.addEventListener('click', () => { if (explosion.active) explosion.setTarget(0); }, true);
  for (const id of ['step', 'run-turn', 'reset', 'dead-center', 'bottom-dead-center']) {
    $(id)?.addEventListener('click', () => explosion.setTarget(0, { immediate: true }), true);
  }
  $('angle')?.addEventListener('input', () => explosion.setTarget(0, { immediate: true }), true);
  // A compact inspection hook for browser regression checks, shared by all five.
  window.__explodedView = explosion;
}
