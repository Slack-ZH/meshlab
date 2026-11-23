import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {
  BEARING_TYPES,
  defaults,
  presets,
  fields,
  validate,
  geometry,
  kinematicsRatios,
  estimate,
  motion,
} from '../dist/bearing/mechanics.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} (diff=${Math.abs(a - b)})`);

test('deep-groove and cylindrical-roller satisfy exact pure-rolling contact velocities and frequency identities', () => {
  for (const typeId of ['deep-groove', 'cylindrical-roller']) {
    const p = presets[typeId];
    const r = estimate(p);
    const g = r.geometry;
    const wi = (p.innerRPM * Math.PI) / 30;
    const wc = (r.cageRPM * Math.PI) / 30;
    const wbRel = (r.elementSpinRPM * Math.PI) / 30;
    const rm = g.pitchRadius;
    const rb = g.elementRadius;

    // Velocity of rolling-element center
    const vc = rm * wc;
    // Outer raceway contact (stationary): vc + (wc + wbRel) * rb === 0
    close(vc + (wc + wbRel) * rb, 0, 1e-9);
    // Inner raceway contact (inner ring speed): vc - (wc + wbRel) * rb === (rm - rb) * wi
    close(vc - (wc + wbRel) * rb, (rm - rb) * wi, 1e-9);
    // Pass frequencies sum to Z * shaftHz
    close(r.bpfoHz + r.bpfiHz, g.elementCount * (p.innerRPM / 60), 1e-9);
    assert.ok(r.cageRatio > 0 && r.cageRatio < 0.5);
    assert.ok(r.elementSpinRatio < 0);
  }
});

test('tapered-roller satisfies exact common-apex geometry and zero-slip 3D cone rolling along the entire contact lines', () => {
  for (const contactAngle of [10, 12, 15, 20, 25]) {
    const p = { ...presets['tapered-roller'], contactAngle };
    const r = estimate(p);
    const g = r.geometry;
    const c = g.cone;
    assert.ok(c);

    // 1. All three cones meet at (0, apexZ) and perpendicular distance from roller center (Rm, 0) to both raceway cones equals Dw/2.
    close(c.outerConeAngleDeg, contactAngle, 1e-9);
    close(c.beta + c.gamma, c.outerConeAngle, 1e-12);
    close(c.beta - c.gamma, c.innerConeAngle, 1e-12);
    close(c.coneDist * Math.sin(c.gamma), g.elementRadius, 1e-9);
    close(g.pitchRadius / Math.tan(c.beta), c.apexZ, 1e-9);

    // 2. Exact 3D pure-rolling velocity at multiple axial stations along both outer and inner contact generators.
    const wi = (p.innerRPM * Math.PI) / 30;
    const wc = wi * r.cageRatio;
    const wbRel = wi * r.elementSpinRatio;
    // Angular velocity vector in meridional (r, z) frame: omega = (-wbRel*sin(beta), wc + wbRel*cos(beta))
    const Ar = -wbRel * Math.sin(c.beta);
    const Az = wc + wbRel * Math.cos(c.beta);
    for (const frac of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const s = c.coneDist + frac * g.rollerLength;
      // Outer cone generator point relative to apex: (s*sin(alphaO), -s*cos(alphaO))
      const vOuter = s * (Az * Math.sin(c.outerConeAngle) - Ar * -Math.cos(c.outerConeAngle));
      close(vOuter, 0, 1e-9);
      // Inner cone generator point relative to apex: (s*sin(alphaI), -s*cos(alphaI))
      const vInner = s * (Az * Math.sin(c.innerConeAngle) - Ar * -Math.cos(c.innerConeAngle));
      const expectedInner = wi * s * Math.sin(c.innerConeAngle);
      close(vInner, expectedInner, 1e-9);
    }

    // 3. Shifting outer cup in +Z strictly increases radial clearance at every point along the roller.
    for (const dz of [0.1, 2, 10]) {
      const shiftedOuterR = (c.apexZ - (c.zSmall - dz)) * Math.tan(c.outerConeAngle);
      const baseOuterR = (c.apexZ - c.zSmall) * Math.tan(c.outerConeAngle);
      close(shiftedOuterR - baseOuterR, dz * Math.tan(c.outerConeAngle), 1e-9);
      assert.ok(shiftedOuterR > baseOuterR);
    }
  }
});

test('thrust-ball runs cage at exact half speed, spins balls with zero slip, and clears housing washer bore from shaft', () => {
  const p = presets['thrust-ball'];
  const r = estimate(p);
  const g = r.geometry;
  close(r.cageRatio, 0.5, 1e-12);
  close(r.cageRPM, p.innerRPM / 2, 1e-12);
  close(r.elementSpinRatio, -g.pitchDiameter / (2 * g.elementDiameter), 1e-12);
  assert.ok(g.housingWasherBoreRadius > g.shaftRadius + 1.0, 'housing washer bore must clear rotating shaft');

  // Top contact velocity = Rm*wi, bottom contact velocity = 0
  const wi = (p.innerRPM * Math.PI) / 30;
  const vc = g.pitchRadius * (wi * r.cageRatio);
  const wb = wi * r.elementSpinRatio;
  // Cross product (wb * e_r) x (+rb * e_z) = -wb * rb * e_phi
  close(vc - wb * g.elementRadius, g.pitchRadius * wi, 1e-9);
  close(vc + wb * g.elementRadius, 0, 1e-9);
});

test('load boundaries and ISO 281 teaching life exponents behave honestly without fabricating invalid ratings', () => {
  // N-type cylindrical roller rejects axial load
  const badCyl = estimate({ ...presets['cylindrical-roller'], axialLoad: 1.0 });
  assert.equal(badCyl.loadValid, false);
  assert.equal(badCyl.l10MillionRev, null);
  assert.equal(badCyl.l10Hours, null);
  assert.match(badCyl.warning, /轴向载荷/);

  // Thrust ball rejects radial load
  const badThrust = estimate({ ...presets['thrust-ball'], radialLoad: 0.6 });
  assert.equal(badThrust.loadValid, false);
  assert.equal(badThrust.l10MillionRev, null);
  assert.equal(badThrust.l10Hours, null);
  assert.match(badThrust.warning, /径向载荷/);

  // Zero load produces no finite fatigue life
  const zeroLoad = estimate({ ...presets['deep-groove'], radialLoad: 0, axialLoad: 0 });
  assert.equal(zeroLoad.l10MillionRev, null);
  assert.equal(zeroLoad.l10Hours, null);

  // Zero RPM preserves L10 (million rev) but declines L10h conversion
  const stopped = estimate({ ...presets['deep-groove'], innerRPM: 0 });
  assert.ok(Number.isFinite(stopped.l10MillionRev) && stopped.l10MillionRev > 0);
  assert.equal(stopped.l10Hours, null);
  assert.equal(stopped.cageRPM, 0);
  assert.equal(stopped.elementSpinRPM, 0);

  // Doubling load scales L10 by 2^-3 (ball) and 2^(-10/3) (roller)
  const ball1 = estimate({ ...presets['deep-groove'], radialLoad: 2, axialLoad: 0 });
  const ball2 = estimate({ ...presets['deep-groove'], radialLoad: 4, axialLoad: 0 });
  close(ball2.l10MillionRev / ball1.l10MillionRev, 1 / 8, 1e-12);

  const roller1 = estimate({ ...presets['cylindrical-roller'], radialLoad: 3, axialLoad: 0 });
  const roller2 = estimate({ ...presets['cylindrical-roller'], radialLoad: 6, axialLoad: 0 });
  close(roller2.l10MillionRev / roller1.l10MillionRev, 2 ** (-10 / 3), 1e-12);
});

test('parameter validation rejects out-of-range, non-integer, cramped circumference and thin cone walls', () => {
  assert.throws(() => validate({ ...defaults, bearingType: 'unknown' }));
  for (const [key, [, , min, max]] of Object.entries(fields)) {
    const base = key === 'contactAngle' ? presets['tapered-roller'] : defaults;
    for (const bad of [NaN, Infinity, min - 1, max + 1]) {
      assert.throws(() => validate({ ...base, [key]: bad }), `${key}=${bad}`);
    }
  }
  assert.throws(() => validate({ ...defaults, elementCount: 9.5 }));
  assert.throws(() => validate({ ...defaults, boreDiameter: 56, outerDiameter: 70 }), /径向截面/);
  assert.throws(() => validate({ ...defaults, boreDiameter: 20, outerDiameter: 56, width: 22, elementCount: 20 }), /最多容纳/);
  assert.throws(() => validate({ ...presets['tapered-roller'], boreDiameter: 40, outerDiameter: 64, width: 26, contactAngle: 25 }), /壁厚不足|截面/);
});

// Load production BearingViewer against Node's Three.js copy (no WebGL required)
const moduleUrl = path => new URL(path, import.meta.url).href;
const viewerSource = (await readFile(new URL('../dist/bearing/viewer.mjs', import.meta.url), 'utf8'))
  .replace("from '../legacy-disassembly.mjs'", `from '${moduleUrl('../dist/legacy-disassembly.mjs')}'`)
  .replace("from 'three'", `from '${moduleUrl('../dist/assets/three.module.js')}'`)
  .replace("import { OrbitControls } from '../assets/OrbitControls.js';", 'const OrbitControls = class {};')
  .replace("from './mechanics.mjs'", `from '${moduleUrl('../dist/bearing/mechanics.mjs')}'`);
const { BearingViewer, steps } = await import('data:text/javascript;base64,' + Buffer.from(viewerSource).toString('base64'));

function cpuViewer() {
  const v = Object.create(BearingViewer.prototype);
  Object.assign(v, {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    renderer: { info: { memory: { geometries: 0 } } },
    parts: [],
    selected: 'elements',
    amount: 0,
    step: 0,
    speed: 1,
    labelsOn: false,
    housingMode: 'open',
    open: true,
    onSelect() {},
    render() {},
    home() {},
    fitModel() {},
  });
  return v;
}

const overlap = (a, b) => a.min.every((n, i) => a.max[i] > b.min[i] + 1e-4 && b.max[i] > n + 1e-4);

test('all four bearing types build valid production meshes, synchronize pure-rolling poses, and separate cleanly on disassembly', () => {
  const v = cpuViewer();
  const configs = [
    presets['deep-groove'],
    { ...presets['deep-groove'], boreDiameter: 24, outerDiameter: 62, width: 12, elementCount: 8 },
    { ...presets['deep-groove'], boreDiameter: 60, outerDiameter: 130, width: 32, elementCount: 12 },
    presets['cylindrical-roller'],
    { ...presets['cylindrical-roller'], boreDiameter: 30, outerDiameter: 72, width: 20, elementCount: 13 },
    presets['tapered-roller'],
    { ...presets['tapered-roller'], contactAngle: 10, elementCount: 12 },
    { ...presets['tapered-roller'], contactAngle: 24, outerDiameter: 92, width: 22, elementCount: 15 },
    presets['thrust-ball'],
    { ...presets['thrust-ball'], boreDiameter: 30, outerDiameter: 70, width: 22, elementCount: 10 },
  ];

  for (const cfg of configs) {
    v.build(cfg);
    assert.equal(v.parts.length, 7);

    // Every mesh buffer must have finite positions/normals and non-empty bounds
    for (const part of v.parts) {
      let meshCount = 0;
      part.group.traverse(o => {
        if (!o.isMesh) return;
        meshCount++;
        const pos = o.geometry.getAttribute('position');
        assert.ok(pos && pos.count > 0, `${cfg.bearingType}/${part.id} empty geometry`);
        assert.ok(pos.array.every(Number.isFinite), `${cfg.bearingType}/${part.id} non-finite vertex`);
        if (o.geometry.index) {
          assert.ok(o.geometry.index.array.every(idx => idx < pos.count));
        }
        o.geometry.computeBoundingBox();
        assert.equal(o.geometry.boundingBox.isEmpty(), false);
      });
      assert.ok(meshCount > 0);
    }

    // Motion pose matches analytical motion()
    const m = motion(cfg, 1.7, 1.3);
    v.rotations = { inner: m.innerAngle, cage: m.cageAngle, elementSpin: m.elementSpinAngle };
    v.updateMotion();
    for (const g of v.innerSpinGroups) close(g.rotation.z, m.innerAngle);
    for (const g of v.cageOrbitGroups) close(g.rotation.z, m.cageAngle);
    for (const { group, axis, sign = 1 } of v.elementSpinEntries) close(group.rotation[axis], sign * m.elementSpinAngle);

    // Housing display modes switch cleanly
    for (const mode of ['open', 'solid', 'transparent', 'hidden']) {
      v.setHousingMode(mode);
      const outer = v.parts.find(p => p.id === 'outer-ring');
      assert.equal(outer.group.visible, mode !== 'hidden');
    }
    v.setHousingMode('open');

    // Staged disassembly: reversible, monotonic per-stage start, zero final overlap across all 7 parts
    const maxStage = steps.length - 1;
    const saved = new Map();
    for (const forward of [true, false]) {
      for (let i = 0; i <= 80; i++) {
        const progress = ((forward ? i : 80 - i) * maxStage) / 80;
        v.explode(progress / maxStage);
        const snap = v.parts.map(p => p.group.position.toArray());
        if (forward) saved.set(i, snap);
        else assert.deepEqual(snap, saved.get(80 - i), `reverse mismatch at ${cfg.bearingType} i=${i}`);

        for (const p of v.parts) {
          const plan = v.disassemblyPlan[p.id];
          if (plan.step === 0 || progress <= plan.step - 1) {
            close(p.group.position.z, 0, 1e-6);
          }
        }
      }
    }

    // Final exploded state: 0 overlaps between any pair of parts, matches final discrete assembly step
    v.explode(1);
    const finalParts = v.state().parts;
    for (let i = 0; i < finalParts.length; i++) {
      for (let j = i + 1; j < finalParts.length; j++) {
        assert.equal(
          overlap(finalParts[i], finalParts[j]),
          false,
          `${cfg.bearingType} final overlap: ${finalParts[i].id} vs ${finalParts[j].id}`
        );
      }
    }
    // Verify expected axial ordering without inversion (unified across all 4 bearing types)
    const zOrder = ['rear-shield', 'shaft', 'inner-ring', 'elements', 'cage', 'outer-ring', 'front-shield'];
    const orderedBoxes = zOrder.map(id => finalParts.find(p => p.id === id));
    for (let k = 1; k < orderedBoxes.length; k++) {
      assert.ok(
        orderedBoxes[k].min[2] - orderedBoxes[k - 1].max[2] >= 17.5,
        `${cfg.bearingType} axial gap too small between ${orderedBoxes[k - 1].id} and ${orderedBoxes[k].id}`
      );
    }

    v.assembly(maxStage);
    assert.deepEqual(
      v.state().parts.map(p => p.position),
      finalParts.map(p => p.position)
    );
    v.restore();
    assert.ok(v.state().parts.every(p => p.position.every(n => n === 0)));
  }
  v.clearGeometry();
});

test('operating updates retain meshes while geometric or type updates rebuild safely', () => {
  const v = cpuViewer();
  v.build(defaults);
  const root = v.root;
  v.setPlaying(true);
  v.build({ ...defaults, innerRPM: 1200, radialLoad: 6, axialLoad: 1, dynamicRatingC: 40 });
  assert.equal(v.root, root);
  assert.equal(v.playing, true);

  v.build({ ...defaults, innerRPM: 0 });
  assert.equal(v.root, root);
  assert.equal(v.playing, false);

  for (const patch of [
    { boreDiameter: 36 },
    { outerDiameter: 90 },
    { width: 22 },
    { elementCount: 11 },
    presets['tapered-roller'],
    { ...presets['tapered-roller'], contactAngle: 20 },
    presets['thrust-ball'],
  ]) {
    const prev = v.root;
    v.build({ ...defaults, ...patch });
    assert.notEqual(v.root, prev);
    assert.equal(v.playing, false);
  }

  const validRoot = v.root;
  assert.throws(() => v.build({ ...defaults, outerDiameter: 45 }));
  assert.equal(v.root, validRoot);
  v.clearGeometry();
});

test('bearing.html provides every static app.mjs ID once and preserves shared control order', async () => {
  const html = await readFile(new URL('../dist/bearing.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../dist/bearing/app.mjs', import.meta.url), 'utf8');
  const spurHtml = await readFile(new URL('../dist/spur.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate IDs in bearing.html');

  const dynamicIds = new Set([...Object.keys(fields), ...Object.keys(fields).map(k => `${k}-slider`), ...Object.keys(fields).map(k => `${k}-hint`)]);
  for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) {
    if (!dynamicIds.has(id)) assert.ok(ids.includes(id), `missing static id="${id}" in bearing.html`);
  }

  const controls = ['play', 'speed', 'explode', 'explode-all', 'assemble-all', 'step-prev', 'step-next', 'home-view', 'front-view', 'top-view', 'fullscreen', 'housing-mode', 'labels-toggle'];
  const order = text => controls.slice().sort((a, b) => text.indexOf(`id="${a}"`) - text.indexOf(`id="${b}"`));
  assert.deepEqual(order(html), order(spurHtml));
  assert.ok(html.indexOf('id="parameters"') > html.indexOf('id="viewport"'));
  assert.equal(Object.keys(BEARING_TYPES).length, 4);
});
