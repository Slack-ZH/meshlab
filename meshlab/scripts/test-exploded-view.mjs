import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Group, Mesh, BoxGeometry, MeshBasicMaterial, Vector3, Quaternion, OrthographicCamera, PerspectiveCamera } from '../dist/assets/three.module.js';
import { createExplodedView } from '../dist/exploded-view.js';

const close = (actual, expected, message = '') => {
  const a = actual.toArray?.() || actual, b = expected.toArray?.() || expected;
  assert.equal(a.length, b.length);
  a.forEach((value, index) => assert.ok(Math.abs(value - b[index]) < 1e-8, `${message}: component ${index}: ${value} != ${b[index]}`));
};
const world = object => object.getWorldPosition(new Vector3());
function pair(options = {}) {
  const root = new Scene(), first = new Group(), second = new Group();
  root.add(first, second);
  first.position.set(-4, 2, 3); second.position.set(8, -3, 2);
  const explosion = createExplodedView({ reducedMotion: () => false, ...options });
  explosion.setParts([{ object: first, offset: [20, 10, -15] }, { object: second, offset: [-30, 0, 40] }]);
  return { root, first, second, explosion };
}

test('world offsets survive nested rotated and nonuniformly scaled parents', () => {
  const root = new Scene(), outer = new Group(), inner = new Group(), first = new Group(), second = new Group();
  root.add(outer, second); outer.add(inner); inner.add(first);
  outer.position.set(8, 4, -9); outer.rotation.set(.4, -.6, .2); outer.scale.set(2, 3, .7);
  inner.position.set(-10, 3, 8); inner.rotation.set(.5, .2, -.8); inner.scale.set(.6, 1.3, 2);
  first.position.set(4, -3, 2);
  const base = world(first), position = first.position.clone();
  const explosion = createExplodedView({ reducedMotion: () => false });
  explosion.setParts([{ object: first, offset: [31, -22, 18] }, { object: second, offset: [-5, 0, 0] }]);
  explosion.setTarget(1, { immediate: true });
  close(world(first), base.clone().add(new Vector3(31, -22, 18)));
  explosion.setTarget(0, { immediate: true });
  assert.deepEqual(first.position.toArray(), position.toArray());
  close(world(first), base);
});

test('registered descendants receive absolute offsets instead of adding ancestor offsets', () => {
  const root = new Scene(), parent = new Group(), child = new Group();
  root.add(parent); parent.add(child);
  parent.rotation.set(.3, .8, -.2); parent.scale.set(2, 1, .5); child.position.set(5, 3, -2);
  const parentBase = world(parent), childBase = world(child);
  const explosion = createExplodedView({ reducedMotion: () => false });
  // Register in reverse hierarchy order as well as ordinary order.
  for (const entries of [
    [{ object: child, offset: [-4, 22, 8] }, { object: parent, offset: [10, 0, 0] }],
    [{ object: parent, offset: [10, 0, 0] }, { object: child, offset: [-4, 22, 8] }],
  ]) {
    explosion.setParts(entries); explosion.setTarget(1, { immediate: true });
    close(world(parent), parentBase.clone().add(new Vector3(10, 0, 0)));
    close(world(child), childBase.clone().add(new Vector3(-4, 22, 8)));
    explosion.setTarget(0, { immediate: true });
    close(world(child), childBase);
  }
});

test('repeated expand/restore cycles preserve exact local coordinates and orientation', () => {
  const { first, second, explosion } = pair();
  first.rotation.set(.4, -.7, 1.2); first.scale.set(.4, 2, 3);
  const firstBase = first.position.toArray(), secondBase = second.position.toArray();
  const quaternion = first.quaternion.toArray(), scale = first.scale.toArray();
  for (let cycle = 0; cycle < 200; cycle++) {
    explosion.setTarget(1, { immediate: true });
    for (let frame = 0; frame < 4; frame++) explosion.update(1 / 60);
    explosion.setTarget(0, { immediate: true });
    assert.deepEqual(first.position.toArray(), firstBase);
    assert.deepEqual(second.position.toArray(), secondBase);
  }
  assert.deepEqual(first.quaternion.toArray(), quaternion);
  assert.deepEqual(first.scale.toArray(), scale);
});

test('motion can change the assembled pose after restore without accumulation', () => {
  const { root, first, second, explosion } = pair();
  const carrier = new Group(); root.add(carrier); carrier.add(first);
  explosion.setTarget(1, { immediate: true });
  for (let frame = 0; frame < 70; frame++) {
    explosion.restore(); carrier.rotation.x = frame * .13;
    first.position.set(frame * .5, 3, -2);
    const assembled = world(first);
    explosion.update(1 / 60);
    close(world(first), assembled.add(new Vector3(20, 10, -15)));
  }
  explosion.setTarget(0, { immediate: true });
  assert.deepEqual(first.position.toArray(), [34.5, 3, -2]);
  assert.deepEqual(second.position.toArray(), [8, -3, 2]);
});

test('functional radial offsets and labels follow the carrier current world orientation', () => {
  const { root, first, second, explosion } = pair();
  const carrier = new Group(), marker = new Group(); root.add(carrier); carrier.add(first); first.add(marker);
  const radial = () => new Vector3(0, 20, 0).applyQuaternion(carrier.getWorldQuaternion(new Quaternion()));
  explosion.setParts([{ object: first, offset: radial }, { object: second, offset: [5, 0, 0] }]);
  explosion.setTarget(1, { immediate: true });
  for (const angle of [0, .8, Math.PI, Math.PI * 1.5]) {
    explosion.restore(); carrier.rotation.x = angle;
    const assembled = world(first), label = new Vector3(5, 8, 3), expected = label.clone().add(radial());
    explosion.update(1 / 60);
    close(world(first), assembled.add(radial()));
    close(explosion.shiftPoint(label, marker), expected);
  }
  close(explosion.shiftPoint(new Vector3(1, 2, 3), root), [1, 2, 3]);
});

test('replacing parts restores old meshes and retains the current explosion on new meshes', () => {
  const { root, first, second, explosion } = pair();
  explosion.setTarget(1, { immediate: true });
  const replacement = new Group(), companion = new Group(); replacement.position.set(10, 20, 30); root.add(replacement, companion);
  explosion.setParts([{ object: replacement, offset: [0, 50, 0] }, { object: companion, offset: [0, -20, 0] }]);
  assert.deepEqual(first.position.toArray(), [-4, 2, 3]);
  assert.deepEqual(second.position.toArray(), [8, -3, 2]);
  assert.equal(explosion.getState().target, 1);
  explosion.update(1 / 60);
  close(replacement.position, [10, 70, 30]);
  explosion.setTarget(0, { immediate: true });
  assert.deepEqual(replacement.position.toArray(), [10, 20, 30]);
});

test('zero parts, a single object and duplicate registrations cannot explode', () => {
  const explosion = createExplodedView({ reducedMotion: () => false }), object = new Group();
  for (const entries of [[], [{ object, offset: [10, 0, 0] }], [{ object, offset: [10, 0, 0] }, { object, offset: [20, 0, 0] }]]) {
    explosion.setParts(entries); explosion.setTarget(1, { immediate: true }); explosion.update(.03);
    assert.equal(explosion.getState().available, false);
    assert.equal(explosion.getState().target, 0); assert.equal(explosion.active, false);
    assert.deepEqual(object.position.toArray(), [0, 0, 0]);
  }
  explosion.setParts([null, {}, { object: {} }]);
  assert.equal(explosion.getState().partCount, 0);
});

test('target input is clamped and nonfinite values restore safely', () => {
  const { first, explosion } = pair();
  for (const [value, expected] of [[2, 1], [-1, 0], [.35, .35], ['0.7', .7], [NaN, 0], [Infinity, 0], [undefined, 0], ['invalid', 0]]) {
    explosion.setTarget(value, { immediate: true });
    assert.equal(explosion.getState().target, expected);
    close(first.position, new Vector3(-4, 2, 3).addScaledVector(new Vector3(20, 10, -15), expected));
  }
});

test('invalid offsets never propagate nonfinite coordinates', () => {
  const { first, second, explosion } = pair();
  explosion.setParts([{ object: first, offset: [NaN, 0, 1] }, { object: second, offset: () => [0, Infinity, 0] }]);
  explosion.setTarget(1, { immediate: true });
  assert.deepEqual(first.position.toArray(), [-4, 2, 3]);
  assert.deepEqual(second.position.toArray(), [8, -3, 2]);
});

test('animation remains smooth, can reverse mid-flight, and finishes exactly assembled', () => {
  const { first, explosion } = pair();
  explosion.setTarget(1); explosion.update(1 / 60);
  assert.ok(explosion.getState().amount > 0 && explosion.getState().amount < 1);
  let previous = explosion.getState().amount;
  for (let frame = 0; frame < 20; frame++) {
    explosion.update(1 / 60); assert.ok(explosion.getState().amount >= previous); previous = explosion.getState().amount;
  }
  explosion.setTarget(0);
  for (let frame = 0; frame < 150; frame++) explosion.update(1 / 60);
  assert.equal(explosion.getState().amount, 0); assert.equal(explosion.active, false);
  assert.deepEqual(first.position.toArray(), [-4, 2, 3]);
});

test('reduced motion bypasses transitions including preference changes during animation', () => {
  let reduced = true;
  const { explosion } = pair({ reducedMotion: () => reduced });
  explosion.setTarget(1); assert.equal(explosion.getState().amount, 1);
  reduced = false; explosion.setTarget(0); explosion.update(.01);
  assert.ok(explosion.getState().amount > 0 && explosion.getState().amount < 1);
  reduced = true; explosion.update(.01); assert.equal(explosion.getState().amount, 0);
});

function cameraFixture() {
  const root = new Scene(), first = new Mesh(new BoxGeometry(4, 4, 4), new MeshBasicMaterial()), second = first.clone();
  root.add(first, second); first.position.x = -4; second.position.x = 4;
  const camera = new OrthographicCamera(-15, 15, 10, -10, 1, 2000); camera.position.set(0, 0, 100); camera.lookAt(0, 0, 0);
  const controls = { target: new Vector3() };
  const explosion = createExplodedView({ camera, controls, reducedMotion: () => false });
  explosion.setParts([{ object: first, offset: [-90, 0, 0] }, { object: second, offset: [90, 0, 0] }]);
  return { root, first, second, camera, controls, explosion };
}

test('camera fitting preserves orbit orientation, and restores the user zoom ratio', () => {
  const { camera, controls, explosion } = cameraFixture();
  const position = camera.position.toArray(), quaternion = camera.quaternion.toArray(), target = controls.target.toArray();
  explosion.setTarget(1, { immediate: true });
  assert.ok(camera.zoom < 1);
  assert.deepEqual(camera.position.toArray(), position); assert.deepEqual(camera.quaternion.toArray(), quaternion);
  assert.deepEqual(controls.target.toArray(), target);
  camera.zoom *= 1.25; const userZoom = camera.zoom;
  explosion.update(1 / 60); assert.equal(camera.zoom, userZoom, 'settled expansion must not override manual zoom');
  explosion.setTarget(0, { immediate: true }); close([camera.zoom], [1.25]);
});

test('perspective camera pose and zoom remain untouched by the shared orthographic fitter', () => {
  const camera = new PerspectiveCamera(40, 1.5, 1, 3000); camera.position.set(12, 40, 90); camera.zoom = 1.7; camera.lookAt(0, 0, 0);
  const initial = [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.zoom];
  const { explosion } = pair({ camera, controls: { target: new Vector3() } });
  explosion.setTarget(1, { immediate: true }); explosion.update(.02); explosion.setTarget(0, { immediate: true });
  assert.deepEqual([...camera.position.toArray(), ...camera.quaternion.toArray(), camera.zoom], initial);
});

test('changing to a standard view while fully exploded reframes once', () => {
  const { camera, explosion } = cameraFixture();
  explosion.setTarget(1, { immediate: true });
  explosion.restoreCamera(); camera.zoom = 1; camera.updateProjectionMatrix();
  explosion.update(1 / 60);
  assert.ok(camera.zoom < .2, 'the expanded model must remain visible after a standard-view reset');
  const fitted = camera.zoom; camera.zoom *= 1.2; explosion.update(1 / 60);
  close([camera.zoom], [fitted * 1.2]);
});

test('rebuilding a larger model while exploded reframes for replacement bounds', () => {
  const { root, camera, explosion } = cameraFixture();
  explosion.setTarget(1, { immediate: true }); const oldZoom = camera.zoom;
  const first = new Mesh(new BoxGeometry(4, 4, 4), new MeshBasicMaterial()), second = first.clone(); root.add(first, second);
  first.position.x = -200; second.position.x = 200;
  explosion.setParts([{ object: first, offset: [-90, 0, 0] }, { object: second, offset: [90, 0, 0] }]);
  explosion.update(1 / 60);
  assert.ok(camera.zoom < oldZoom * .5, 'replacement geometry requires a fresh fit');
});
