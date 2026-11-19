import { Vector3, Matrix3, Box3 } from './assets/three.module.js';

// Offsets describe displacement in world millimetres, independent of the
// animated, rotated or scaled parents used by each mechanism. Call restore()
// before changing its assembled pose, and update() immediately before drawing.
export function createExplodedView({ camera, controls, container, reducedMotion } = {}) {
  const motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const shouldSnap = reducedMotion ?? (() => motionPreference?.matches === true);
  let parts = [], target = 0, amount = 0, applied = false, cameraScale = 1;
  let lastTime = null, needsDraw = true, needsFit = true, viewportSize = '';
  const listeners = new Set(), byObject = new Map();
  const worldOffset = part => {
    const value = typeof part.offset === 'function' ? part.offset() : part.offset;
    const vector = value?.isVector3 ? value.clone() : new Vector3(...(value || [0, 0, 0]));
    return [vector.x, vector.y, vector.z].every(Number.isFinite) ? vector : new Vector3();
  };
  const state = () => ({ target, amount, partCount: parts.length, available: parts.length > 1 });
  const notify = () => { needsDraw = true; for (const fn of listeners) fn(state()); };
  function restore() {
    if (!applied) return;
    for (const p of parts) p.object.position.copy(p.base);
    applied = false;
  }
  function restoreCamera() {
    if (camera && cameraScale !== 1) { camera.zoom /= cameraScale; camera.updateProjectionMatrix(); }
    cameraScale = 1;
    needsFit = true;
  }
  function setParts(entries = []) {
    restore(); byObject.clear();
    parts = [];
    for (const entry of entries) {
      if (!entry?.object?.position || byObject.has(entry.object)) continue;
      const part = { ...entry, base: entry.object.position.clone(), displacement: new Vector3() };
      parts.push(part);
      byObject.set(part.object, part);
    }
    if (parts.length < 2) { target = amount = 0; restoreCamera(); }
    needsFit = true; notify();
  }
  function apply() {
    // Restore exact saved coordinates instead of subtracting floating offsets.
    restore();
    if (amount === 0) {
      for (const p of parts) p.displacement.set(0, 0, 0);
      return;
    }
    for (const p of parts) {
      p.base.copy(p.object.position);
      p.object.updateWorldMatrix(true, false);
      p.displacement.copy(worldOffset(p)).multiplyScalar(amount);
    }
    for (const p of parts) {
      const delta = p.displacement.clone();
      // An explicitly registered descendant has an absolute world offset:
      // remove its nearest registered ancestor's contribution, avoiding doubles.
      let ancestor = p.object.parent;
      while (ancestor && !byObject.has(ancestor)) ancestor = ancestor.parent;
      if (ancestor) delta.sub(byObject.get(ancestor).displacement);
      if (p.object.parent) delta.applyMatrix3(new Matrix3().setFromMatrix4(p.object.parent.matrixWorld).invert());
      p.object.position.copy(p.base).add(delta);
    }
    applied = true;
    for (const p of parts) p.object.updateWorldMatrix(true, true);
  }
  function fit() {
    if (!camera?.isOrthographicCamera || !controls || !amount) return;
    // Frame all physical parts in the existing viewing direction. The saved
    // scale is factored out, so repeated frames never accumulate a zoom-out.
    camera.updateMatrixWorld();
    const bounds = new Box3();
    for (const p of parts) {
      const box = new Box3().setFromObject(p.object);
      if (box.isEmpty()) continue;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        bounds.expandByPoint(new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
      }
    }
    if (bounds.isEmpty()) return;
    const baseZoom = camera.zoom / cameraScale;
    const required = Math.min((camera.right - camera.left) / (2 * Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), 1)),
      (camera.top - camera.bottom) / (2 * Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y), 1))) * .9;
    // Only widen when necessary; never fight a user's zoom gesture every frame.
    const next = Math.min(cameraScale, required / baseZoom, 1);
    if (next > 0 && next < cameraScale) { camera.zoom *= next / cameraScale; cameraScale = next; camera.updateProjectionMatrix(); }
  }
  function setTarget(value, { immediate = false } = {}) {
    const number = Number(value);
    target = parts.length > 1 && Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
    if (immediate || shouldSnap()) {
      amount = target; apply();
      if (!amount) restoreCamera();
      else { fit(); needsFit = false; viewportSize = `${container?.clientWidth}/${container?.clientHeight}`; }
    }
    lastTime = null; notify();
  }
  function update(dt) {
    if (amount === 0 && target === 0) {
      const redraw = needsDraw;
      needsDraw = false;
      return redraw;
    }
    const now = globalThis.performance?.now() ?? Date.now();
    if (!Number.isFinite(dt)) dt = lastTime === null ? 1 / 60 : (now - lastTime) / 1000;
    lastTime = now;
    const before = amount;
    amount = shouldSnap() ? target : amount + (target - amount) * (1 - Math.exp(-7 * Math.max(0, Math.min(dt, .05))));
    if (Math.abs(amount - target) < .0005) amount = target;
    const poseChanged = !applied || before !== amount;
    if (poseChanged) apply();
    if (amount < before && before > 0 && cameraScale < 1) {
      const next = 1 - (1 - cameraScale) * amount / before;
      camera.zoom *= next / cameraScale; cameraScale = next; camera.updateProjectionMatrix();
    }
    if (!amount) restoreCamera();
    // Fitting only during outward animation preserves orbit and manual zoom
    // once expanded; resize/standard-view changes can explicitly reframe.
    const size = `${container?.clientWidth}/${container?.clientHeight}`;
    if (size !== viewportSize) { viewportSize = size; needsFit = true; }
    if (amount > before || (amount > 0 && needsFit)) { fit(); needsFit = false; }
    const redraw = needsDraw || poseChanged;
    needsDraw = false; return redraw;
  }
  function shiftPoint(point, object) {
    let node = object;
    while (node && !byObject.has(node)) node = node.parent;
    return node ? point.add(byObject.get(node).displacement) : point;
  }
  return { setParts, restore, restoreCamera, setTarget, update, shiftPoint, getState: state,
    get active() { return target > 0 || amount > 0; },
    subscribe(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); } };
}
