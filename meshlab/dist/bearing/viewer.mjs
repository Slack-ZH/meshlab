import * as THREE from 'three';
import { OrbitControls } from '../assets/OrbitControls.js';
import { phase } from '../legacy-disassembly.mjs';
import { BEARING_TYPES, ANIMATION_SCALE, geometry, kinematicsRatios, validate } from './mechanics.mjs';

export const steps = [
  '完整装配',
  '移开前后防尘盖 / 挡环',
  '沿轴向分离外圈 / 座圈',
  '分离保持架与滚动体',
  '分离内圈与传动轴',
];

const geometryKeys = ['bearingType', 'boreDiameter', 'outerDiameter', 'width', 'elementCount', 'contactAngle'];

// Visual baseline aligned with GL16 / mechanical-style.js / spur reference:
// restrained bearing steel, brass cage, matte housing/cover, dark rubber/index marks.
const PALETTE = {
  bearing: 0xb9c6cd,
  ball: 0xcfd9e0,
  cutFace: 0x8e9ca8,
  cage: 0xbf9a5b,
  shaft: 0x8c9caa,
  cover: 0x64707d,
  seal: 0x323c43,
  marker: 0x323c43,
  accent: 0x2082a2,
};

// 120° cutaway window in upper-right (+X, +Y) facing default home view.
// After LatheGeometry.rotateX(PI/2), polar angle theta = phi - PI/2.
// Keeping phi in [190°, 430°] keeps theta in [100°, 340°] and opens [-20°, +100°].
const CUT_PHI_START = (190 * Math.PI) / 180;
const CUT_PHI_LENGTH = (240 * Math.PI) / 180;

function closeProfile(points) {
  if (!points.length) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 1e-6) {
    return [...points, [first[0], first[1]]];
  }
  return points;
}

function buildRevolvedGeometry(profile, segments = 96, phiStart = 0, phiLength = Math.PI * 2) {
  const closed = closeProfile(profile);
  const pts = closed.map(([r, z]) => new THREE.Vector2(Math.max(0.01, r), z));
  const geo = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function buildCutCapGeometry(profile, phi) {
  const shape = new THREE.Shape();
  profile.forEach(([r, z], i) => {
    if (i === 0) shape.moveTo(r, z);
    else shape.lineTo(r, z);
  });
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  // Maps (r, z, 0) -> (r, 0, z) -> (r*sin(phi), -r*cos(phi), z) matching LatheGeometry.rotateX(PI/2).
  geo.rotateX(Math.PI / 2);
  geo.rotateZ(phi - Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function arcPoints(cx, cz, radius, a0, a1, count = 14) {
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const a = a0 + ((a1 - a0) * i) / count;
    pts.push([cx + radius * Math.cos(a), cz + radius * Math.sin(a)]);
  }
  return pts;
}

export function bearingProfiles(g) {
  const ri = g.boreRadius;
  const ro = g.outerRadius;
  const rm = g.pitchRadius;
  const hw = g.width / 2;
  const rb = g.elementRadius;
  const ch = Math.min(1.2, g.ringWall * 0.28);

  if (g.bearingType === 'deep-groove') {
    const rg = g.grooveRadius;
    const gd = g.grooveDepth;
    const clear = 0.04;
    // Inner ring raceway bottom at rm - rb - clear; groove center at rci = rm - rb - clear + rg
    const rci = rm - rb - clear + rg;
    const rsi = rm - rb + gd;
    const sinA = Math.min(0.92, Math.sqrt(Math.max(0.05, rg * rg - (rci - rsi) * (rci - rsi))) / rg);
    const halfArc = Math.asin(sinA);
    const innerGroove = arcPoints(rci, 0, rg, Math.PI - halfArc, Math.PI + halfArc, 16);
    const inner = [
      [ri + ch, -hw],
      [rsi - ch * 0.5, -hw],
      [rsi, -hw + ch * 0.5],
      ...innerGroove.slice().reverse(),
      [rsi, hw - ch * 0.5],
      [rsi - ch * 0.5, hw],
      [ri + ch, hw],
      [ri, hw - ch],
      [ri, -hw + ch],
    ];

    const rco = rm + rb + clear - rg;
    const rso = rm + rb - gd;
    const sinAo = Math.min(0.92, Math.sqrt(Math.max(0.05, rg * rg - (rso - rco) * (rso - rco))) / rg);
    const halfArcO = Math.asin(sinAo);
    const outerGroove = arcPoints(rco, 0, rg, -halfArcO, halfArcO, 16);
    const outer = [
      [rso + ch * 0.5, -hw],
      [ro - ch, -hw],
      [ro, -hw + ch],
      [ro, hw - ch],
      [ro - ch, hw],
      [rso + ch * 0.5, hw],
      [rso, hw - ch * 0.5],
      ...outerGroove.slice().reverse(),
      [rso, -hw + ch * 0.5],
    ];
    return { inner, outer, rsi, rso };
  }

  if (g.bearingType === 'cylindrical-roller') {
    const clear = 0.04;
    const halfL = g.rollerLength / 2 + 0.2;
    const rRaceI = rm - rb - clear;
    const rFlangeI = Math.min(rm - rb * 0.38, rRaceI + rb * 0.55);
    const inner = [
      [ri + ch, -hw],
      [rFlangeI - ch * 0.4, -hw],
      [rFlangeI, -hw + ch * 0.4],
      [rFlangeI, -halfL],
      [rRaceI, -halfL],
      [rRaceI, halfL],
      [rFlangeI, halfL],
      [rFlangeI, hw - ch * 0.4],
      [rFlangeI - ch * 0.4, hw],
      [ri + ch, hw],
      [ri, hw - ch],
      [ri, -hw + ch],
    ];

    // N-type separable outer ring: straight cylindrical raceway bore, no flanges.
    const rRaceO = rm + rb + clear;
    const outer = [
      [rRaceO + ch * 0.4, -hw],
      [ro - ch, -hw],
      [ro, -hw + ch],
      [ro, hw - ch],
      [ro - ch, hw],
      [rRaceO + ch * 0.4, hw],
      [rRaceO, hw - ch * 0.4],
      [rRaceO, -hw + ch * 0.4],
    ];
    return { inner, outer, rsi: rFlangeI, rso: rRaceO };
  }

  if (g.bearingType === 'tapered-roller') {
    const c = g.cone;
    const clear = 0.04;
    const zMin = -hw;
    const zMax = hw;
    const zLargeEdge = Math.max(zMin + 1.4, c.zLarge - 0.15);
    const zSmallEdge = Math.min(zMax - 1.4, c.zSmall + 0.15);

    const rInnerLarge = Math.max(ri + 1.6, (c.apexZ - zLargeEdge) * Math.tan(c.innerConeAngle) - clear);
    const rInnerSmall = Math.max(ri + 1.6, (c.apexZ - zSmallEdge) * Math.tan(c.innerConeAngle) - clear);
    const rLargeRib = Math.min(rm + c.largeRadius * 0.25, rInnerLarge + c.largeRadius * 0.72);
    const rSmallRib = Math.min(rm - c.smallRadius * 0.15, rInnerSmall + c.smallRadius * 0.42);

    const inner = [
      [ri + ch, zMin],
      [rLargeRib - ch * 0.4, zMin],
      [rLargeRib, zMin + ch * 0.4],
      [rLargeRib, zLargeEdge],
      [rInnerLarge, zLargeEdge],
      [rInnerSmall, zSmallEdge],
      [rSmallRib, zSmallEdge],
      [rSmallRib, zMax - ch * 0.4],
      [rSmallRib - ch * 0.4, zMax],
      [ri + ch, zMax],
      [ri, zMax - ch],
      [ri, zMin + ch],
    ];

    const zCupMin = Math.max(zMin, c.zLarge - 0.8);
    const zCupMax = Math.min(zMax, c.zSmall + 0.8);
    const rOuterLarge = Math.min(ro - 1.35, (c.apexZ - zCupMin) * Math.tan(c.outerConeAngle) + clear);
    const rOuterSmall = Math.min(ro - 1.35, (c.apexZ - zCupMax) * Math.tan(c.outerConeAngle) + clear);

    const outer = [
      [rOuterLarge, zCupMin],
      [ro - ch, zCupMin],
      [ro, zCupMin + ch],
      [ro, zCupMax - ch],
      [ro - ch, zCupMax],
      [rOuterSmall, zCupMax],
    ];
    return { inner, outer, rsi: rLargeRib, rso: rOuterSmall };
  }

  // thrust-ball: shaft washer (-Z, tight on shaft bore ri) & housing washer (+Z, clearance bore rHouse, cutaway facing camera)
  const rg = g.grooveRadius;
  const gd = g.grooveDepth;
  const clear = 0.04;
  const rHouse = g.housingWasherBoreRadius;
  const zFace = rb - gd; // inner face of each washer facing the balls
  const zGrooveCenterShaft = -rb - clear + rg;
  const sinT = Math.min(0.92, Math.sqrt(Math.max(0.05, rg * rg - (-zFace - zGrooveCenterShaft) ** 2)) / rg);
  const halfT = Math.asin(sinT);
  const shaftGroove = arcPoints(rm, zGrooveCenterShaft, rg, -Math.PI / 2 + halfT, -Math.PI / 2 - halfT, 16);
  const inner = [
    [ri + ch, -hw],
    [ro - ch, -hw],
    [ro, -hw + ch],
    [ro, -zFace - ch * 0.4],
    [ro - ch * 0.4, -zFace],
    ...shaftGroove,
    [ri + ch * 0.4, -zFace],
    [ri, -zFace - ch * 0.4],
    [ri, -hw + ch],
  ];

  const zGrooveCenterHouse = rb + clear - rg;
  const houseGroove = arcPoints(rm, zGrooveCenterHouse, rg, Math.PI / 2 - halfT, Math.PI / 2 + halfT, 16);
  const outer = [
    [rHouse + ch, hw],
    [ro - ch, hw],
    [ro, hw - ch],
    [ro, zFace + ch * 0.4],
    [ro - ch * 0.4, zFace],
    ...houseGroove,
    [rHouse + ch * 0.4, zFace],
    [rHouse, zFace + ch * 0.4],
    [rHouse, hw - ch],
  ];
  return { inner, outer, rsi: ri, rso: ro };
}

export function bearingDisassemblyPlan(parts, _bearingType, gap = 22) {
  const byId = new Map(parts.map(p => [p.id, p]));
  const boxOf = id => byId.get(id);
  const plan = {};

  // Unified physical axial order from -Z to +Z for all 4 bearing types:
  // rear-shield < shaft < inner-ring (datum 0) < elements < cage < outer-ring < front-shield
  const inner = boxOf('inner-ring');
  const elements = boxOf('elements');
  const cage = boxOf('cage');
  const outer = boxOf('outer-ring');
  const front = boxOf('front-shield');
  const shaft = boxOf('shaft');
  const rear = boxOf('rear-shield');

  const zElements = inner.max[2] + gap - elements.min[2];
  const zCage = elements.max[2] + zElements + gap - cage.min[2];
  const zOuter = cage.max[2] + zCage + gap - outer.min[2];
  const zFront = outer.max[2] + zOuter + gap - front.min[2];

  const zShaft = inner.min[2] - gap - shaft.max[2];
  const zRear = shaft.min[2] + zShaft - gap - rear.max[2];

  plan['front-shield'] = { step: 1, finalZ: zFront };
  plan['rear-shield'] = { step: 1, finalZ: zRear };
  plan['outer-ring'] = { step: 2, finalZ: zOuter };
  plan['cage'] = { step: 3, finalZ: zCage };
  plan['elements'] = { step: 3, finalZ: zElements };
  plan['shaft'] = { step: 4, finalZ: zShaft };
  plan['inner-ring'] = { step: 0, finalZ: 0 };
  return plan;
}

export function bearingDisassemblyOffset(planEntry, progress) {
  if (!planEntry || planEntry.step === 0) return [0, 0, 0];
  const f = phase(progress, planEntry.step - 1, planEntry.step);
  return [0, 0, planEntry.finalZ * f];
}

export class BearingViewer {
  constructor(host, onSelect) {
    this.host = host;
    this.onSelect = onSelect;
    this.parts = [];
    this.amount = 0;
    this.step = 0;
    this.selected = 'elements';
    this.playing = false;
    this.speed = 1;
    this.labelsOn = false;
    // Default to 120° cutaway so internal raceways, rolling elements & cage are immediately visible.
    this.housingMode = 'open';
    this.open = true;
    this.rotations = { inner: 0, cage: 0, elementSpin: 0 };
    this.time = 0;
    this.events = new AbortController();
    this.label = host.closest('.viewer-panel')?.querySelector('#selection-label');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 12000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '滚动轴承三维视图，拖动旋转，滚轮缩放；点击选择零件。');

    this.onControlChange = () => this.render();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 4000;
    this.controls.addEventListener('change', this.onControlChange);

    // Match spur/GL16 lighting balance: clean hemisphere + key/fill/rim directional lights.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x798597, 3));
    for (const [x, y, z, power] of [
      [-400, 900, 1100, 3],
      [800, 200, -500, 2],
      [-800, -250, 400, 1],
    ]) {
      const light = new THREE.DirectionalLight(0xffffff, power);
      light.position.set(x, y, z);
      this.scene.add(light);
    }

    this.home();
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.root) this.fitModel();
      this.render();
    });
    this.resize.observe(host);

    let down;
    host.addEventListener('pointerdown', e => {
      down = [e.clientX, e.clientY];
    }, { signal: this.events.signal });
    host.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const r = host.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
        this.camera
      );
      const pick = [];
      this.scene.traverse(o => {
        if (o.isMesh && o.userData.partId && this.isVisible(o)) pick.push(o);
      });
      const hit = ray.intersectObjects(pick, false)[0];
      if (hit) this.select(hit.object.userData.partId);
    }, { signal: this.events.signal });

    const loop = now => {
      if (this.disposed) return;
      this.frame = requestAnimationFrame(loop);
      const dt = this.lastFrame === undefined ? 0 : Math.min((now - this.lastFrame) / 1000, 0.05);
      this.lastFrame = now;
      if (this.playing && this.root && this.p && this.g) {
        this.time += dt;
        const { cageRatio, elementSpinRatio } = kinematicsRatios(this.g);
        this.rotations.inner += dt * ((this.p.innerRPM * Math.PI) / 30) * this.speed * ANIMATION_SCALE;
        this.rotations.cage = this.rotations.inner * cageRatio;
        this.rotations.elementSpin = this.rotations.inner * elementSpinRatio;
        this.updateMotion();
      }
      this.controls.update();
      if (this.playing) this.render();
    };
    this.frame = requestAnimationFrame(loop);
  }

  isVisible(o) {
    while (o) {
      if (!o.visible) return false;
      o = o.parent;
    }
    return true;
  }

  render() {
    if (this.disposed) return;
    const part = this.parts.find(p => p.id === this.selected);
    if (this.label) {
      this.label.hidden = !(this.labelsOn && part && this.isVisible(part.group));
      if (part && this.label.textContent !== part.name) this.label.textContent = part.name;
    }
    this.renderer.render(this.scene, this.camera);
  }

  material(color, { metalness = 0.65, roughness = 0.36 } = {}) {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide });
  }

  part(id, name, description, spec, step, category = 'transmission') {
    const group = new THREE.Group();
    group.userData.partId = id;
    this.root.add(group);
    const p = { id, name, description, spec, step, category, group, offset: new THREE.Vector3() };
    this.parts.push(p);
    return p;
  }

  mesh(p, geo, color, pos = [0, 0, 0], parent = p.group, matOpts = {}) {
    const m = new THREE.Mesh(geo, this.material(color, matOpts));
    m.position.set(...pos);
    m.userData.partId = p.id;
    parent.add(m);
    return m;
  }

  ring(p, outer, inner, depth, color, parent = p.group, matOpts = {}) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 72 });
    geo.translate(0, 0, -depth / 2);
    return this.mesh(p, geo, color, [0, 0, 0], parent, matOpts);
  }

  addRevolvedWithCutaway(part, profile, color, cutCapColor = PALETTE.cutFace) {
    const fullGroup = new THREE.Group();
    const cutGroup = new THREE.Group();
    part.group.add(fullGroup, cutGroup);

    this.mesh(part, buildRevolvedGeometry(profile, 96, 0, Math.PI * 2), color, [0, 0, 0], fullGroup);
    this.mesh(part, buildRevolvedGeometry(profile, 72, CUT_PHI_START, CUT_PHI_LENGTH), color, [0, 0, 0], cutGroup);
    for (const phi of [CUT_PHI_START, CUT_PHI_START + CUT_PHI_LENGTH]) {
      this.mesh(part, buildCutCapGeometry(profile, phi), cutCapColor, [0, 0, 0], cutGroup, { metalness: 0.45, roughness: 0.5 });
    }
    this.cutawayPairs.push({ partId: part.id, fullGroup, cutGroup });
  }

  build(p) {
    validate(p);
    if (this.p && geometryKeys.every(key => this.p[key] === p[key])) {
      this.p = { ...p };
      if (p.innerRPM === 0) this.setPlaying(false);
      return;
    }

    const hadRoot = !!this.root;
    this.clearGeometry();
    this.resetMotion();
    this.amount = 0;
    this.step = 0;
    this.p = { ...p };
    this.g = geometry(p);
    this.parts = [];
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.innerSpinGroups = [];
    this.cageOrbitGroups = [];
    this.elementSpinEntries = [];
    this.cutawayPairs = [];

    const g = this.g;
    const info = BEARING_TYPES[g.bearingType];
    const profiles = bearingProfiles(g);
    const ri = g.boreRadius;
    const ro = g.outerRadius;
    const rm = g.pitchRadius;
    const hw = g.width / 2;
    const rb = g.elementRadius;
    const Z = g.elementCount;
    const isThrust = g.bearingType === 'thrust-ball';

    // 1. Mating shaft (配合传动轴)
    const shaftLen = g.width + 32;
    const shaftPart = this.part(
      'shaft',
      '配合传动轴',
      isThrust
        ? '传动轴与轴圈紧配合并同步旋转；下方座圈内孔刻意放大留出径向间隙，不与转轴摩擦。'
        : '传动轴与内圈紧配合并同步旋转；轴肩抵靠内圈后端面实现轴向定位。',
      `轴径 Ø${(g.shaftRadius * 2).toFixed(1)} mm · 与${isThrust ? '轴圈' : '内圈'}同步转动`,
      4,
      'transmission'
    );
    const shaftSpin = new THREE.Group();
    shaftPart.group.add(shaftSpin);
    const shaftGeo = new THREE.CylinderGeometry(g.shaftRadius, g.shaftRadius, shaftLen, 64);
    shaftGeo.rotateX(Math.PI / 2);
    this.mesh(shaftPart, shaftGeo, PALETTE.shaft, [0, 0, -2], shaftSpin);
    // Locating shoulder abutting rear (-Z) face of inner ring / shaft washer
    const shoulderRadius = Math.min(ri + Math.max(2.6, g.ringWall * 0.55), rm - rb * 0.85);
    const shoulderZ = -hw - 5;
    if (shoulderRadius > g.shaftRadius + 0.8) {
      this.ring(shaftPart, shoulderRadius, g.shaftRadius * 0.96, 8, PALETTE.shaft, shaftSpin).position.z = shoulderZ;
    }
    // Axial reference key/mark so students clearly track shaft & inner-ring angular velocity.
    this.mesh(
      shaftPart,
      new THREE.BoxGeometry(Math.max(2, g.shaftRadius * 0.14), 1.4, shaftLen * 0.72),
      PALETTE.marker,
      [0, g.shaftRadius - 0.35, -2],
      shaftSpin,
      { metalness: 0.3, roughness: 0.65 }
    );
    this.innerSpinGroups.push(shaftSpin);

    // 2. Inner ring / Shaft washer (内圈 / 轴圈)
    const innerName = isThrust ? '轴圈（转动圈）' : g.bearingType === 'tapered-roller' ? '内圈（带大小挡边锥面）' : '内圈';
    const innerDesc = isThrust
      ? '紧配在传动轴上随轴同步旋转，前侧加工圆弧球沟道，把轴向推力传给钢球。'
      : g.bearingType === 'deep-groove'
        ? '与传动轴同步旋转，外周加工深圆弧沟道（沟曲率半径约为球径 0.525 倍），可同时承受径向与一定双向轴向载荷。'
        : g.bearingType === 'cylindrical-roller'
          ? 'N 型内圈两侧带有整体挡边，引导圆柱滚子轴向定位；随轴同步旋转。'
          : `内圈锥面半锥角 ${g.cone.innerConeAngleDeg.toFixed(1)}°，与外圈及圆锥滚子共交于轴线上同一点；左侧大挡边引导滚子大端面。`;
    const innerPart = this.part(
      'inner-ring',
      innerName,
      innerDesc,
      `内径 Ø${g.boreDiameter} mm · 宽度 ${g.width} mm · 轴承钢`,
      0,
      'transmission'
    );
    const innerSpin = new THREE.Group();
    innerPart.group.add(innerSpin);
    this.mesh(innerPart, buildRevolvedGeometry(profiles.inner, 96), PALETTE.bearing, [0, 0, 0], innerSpin);
    // Subtle timing mark on exposed face of inner ring / shaft washer so rotation speed is legible vs cage.
    const markR = isThrust ? (ri + ro) / 2 : (ri + profiles.rsi) / 2;
    const markZ = isThrust ? -(rb - g.grooveDepth) + 0.08 : hw + 0.08;
    this.mesh(
      innerPart,
      new THREE.BoxGeometry(Math.max(2.2, (profiles.rsi - ri) * 0.55 || 4), 1.4, 0.35),
      PALETTE.accent,
      [markR, 0, markZ],
      innerSpin,
      { metalness: 0.25, roughness: 0.5 }
    );
    this.innerSpinGroups.push(innerSpin);

    // 3. Rolling elements (滚动体组：钢球 / 圆柱滚子 / 圆锥滚子)
    const elemName = info.kind === 'ball' ? `钢球组（${Z} 颗）` : g.bearingType === 'cylindrical-roller' ? `圆柱滚子组（${Z} 颗）` : `圆锥滚子组（${Z} 颗）`;
    const elemDesc =
      g.bearingType === 'deep-groove'
        ? '钢球在内外圈深沟道间纯滚动：一方面随保持架以约 0.4 倍内圈转速正向公转，另一方面绕自身轴线反向高速自转（可观察球面深色标线）。'
        : g.bearingType === 'cylindrical-roller'
          ? '圆柱滚子与滚道呈线接触，径向承载能力高于同尺寸球轴承；纯滚动时随保持架公转并绕自身轴反向自转。'
          : g.bearingType === 'tapered-roller'
            ? `圆锥滚子半锥角 ${g.cone.gammaDeg.toFixed(2)}°，轴线倾角 ${g.cone.betaDeg.toFixed(2)}°，滚子锥面与内外圈锥面共顶点，沿整条接触线实现纯滚动。`
            : '钢球夹在上方旋转轴圈与下方静止座圈之间；保持架恰好以半速公转，钢球绕径向水平轴纯滚动。';
    const elemSpec =
      info.kind === 'ball'
        ? `${Z} 颗 · 球径 Dw = ${g.elementDiameter.toFixed(2)} mm · 节圆 Ø${g.pitchDiameter.toFixed(1)} mm`
        : `${Z} 颗 · 均径 Dw = ${g.elementDiameter.toFixed(2)} mm × 长 Lw = ${g.rollerLength.toFixed(1)} mm`;
    const elemPart = this.part('elements', elemName, elemDesc, elemSpec, 3, 'transmission');
    const elemOrbit = new THREE.Group();
    elemPart.group.add(elemOrbit);
    this.cageOrbitGroups.push(elemOrbit);

    for (let k = 0; k < Z; k++) {
      const theta = (k * Math.PI * 2) / Z;
      const pocket = new THREE.Group();
      pocket.position.set(rm * Math.cos(theta), rm * Math.sin(theta), 0);
      pocket.rotation.z = theta;
      elemOrbit.add(pocket);

      if (info.kind === 'ball') {
        const spin = new THREE.Group();
        pocket.add(spin);
        this.mesh(elemPart, new THREE.SphereGeometry(rb, 28, 22), PALETTE.ball, [0, 0, 0], spin, { metalness: 0.72, roughness: 0.24 });
        // Crisp dark meridian stripe to make pure-rolling self-spin unmistakably visible.
        const band = new THREE.TorusGeometry(rb + 0.04, Math.max(0.24, rb * 0.055), 8, 36);
        if (!isThrust) band.rotateY(Math.PI / 2); // band lies in YZ plane, spins clearly around Z
        this.mesh(elemPart, band, PALETTE.marker, [0, 0, 0], spin, { metalness: 0.2, roughness: 0.7 });
        this.elementSpinEntries.push({ group: spin, axis: isThrust ? 'x' : 'z', sign: isThrust ? -1 : 1 });
      } else if (g.bearingType === 'cylindrical-roller') {
        const spin = new THREE.Group();
        pocket.add(spin);
        const rGeo = new THREE.CylinderGeometry(rb, rb, g.rollerLength, 28);
        rGeo.rotateX(Math.PI / 2);
        this.mesh(elemPart, rGeo, PALETTE.ball, [0, 0, 0], spin, { metalness: 0.72, roughness: 0.24 });
        // Axial stripe + end-face radial bar to show roller spin cleanly.
        this.mesh(
          elemPart,
          new THREE.BoxGeometry(Math.max(0.45, rb * 0.14), Math.max(0.45, rb * 0.14), g.rollerLength * 0.94),
          PALETTE.marker,
          [rb - 0.08, 0, 0],
          spin,
          { metalness: 0.2, roughness: 0.7 }
        );
        this.mesh(
          elemPart,
          new THREE.BoxGeometry(rb * 1.5, Math.max(0.45, rb * 0.15), 0.28),
          PALETTE.marker,
          [0, 0, g.rollerLength / 2 + 0.06],
          spin,
          { metalness: 0.2, roughness: 0.7 }
        );
        this.elementSpinEntries.push({ group: spin, axis: 'z' });
      } else {
        // Tapered roller tilted inward by -beta about local Y so local +Z points exactly to the cone apex.
        const c = g.cone;
        const tilt = new THREE.Group();
        tilt.rotation.y = -c.beta;
        pocket.add(tilt);
        const spin = new THREE.Group();
        tilt.add(spin);
        const coneGeo = new THREE.CylinderGeometry(c.smallRadius, c.largeRadius, g.rollerLength, 28);
        coneGeo.rotateX(Math.PI / 2); // top (smallRadius) -> +Z, bottom (largeRadius) -> -Z
        this.mesh(elemPart, coneGeo, PALETTE.ball, [0, 0, 0], spin, { metalness: 0.72, roughness: 0.24 });
        // Spin marker along tapered surface & large end face.
        const midR = (c.smallRadius + c.largeRadius) / 2;
        const stripe = this.mesh(
          elemPart,
          new THREE.BoxGeometry(Math.max(0.45, midR * 0.16), Math.max(0.45, midR * 0.16), g.rollerLength * 0.88),
          PALETTE.marker,
          [midR - 0.05, 0, 0],
          spin,
          { metalness: 0.2, roughness: 0.7 }
        );
        stripe.rotation.y = -c.gamma;
        this.mesh(
          elemPart,
          new THREE.BoxGeometry(c.largeRadius * 1.55, Math.max(0.45, c.largeRadius * 0.16), 0.28),
          PALETTE.marker,
          [0, 0, -g.rollerLength / 2 - 0.06],
          spin,
          { metalness: 0.2, roughness: 0.7 }
        );
        this.elementSpinEntries.push({ group: spin, axis: 'z' });
      }
    }

    // 4. Cage / Retainer (保持架，黄铜色，与滚动体同公转)
    const cageName =
      g.bearingType === 'deep-groove'
        ? '兜孔保持架'
        : g.bearingType === 'cylindrical-roller'
          ? '窗式保持架'
          : g.bearingType === 'tapered-roller'
            ? '锥形窗式保持架'
            : '平面保持架';
    const cagePart = this.part(
      'cage',
      cageName,
      '保持架将各滚动体均匀隔开，防止相邻滚动体直接碰撞摩擦，并随滚动体中心以相同公转转速运行。',
      `${Z} 个兜孔 · 周向节距 ${g.circumferentialPitch.toFixed(1)} mm · 黄铜示意`,
      3,
      'transmission'
    );
    const cageOrbit = new THREE.Group();
    cagePart.group.add(cageOrbit);
    this.cageOrbitGroups.push(cageOrbit);
    this.buildCageGeometry(cagePart, cageOrbit, g);

    // 5. Outer ring / Housing washer (外圈 / 座圈，静止，默认 120° 剖切)
    const outerName = isThrust ? '座圈（静止圈）' : g.bearingType === 'tapered-roller' ? '外圈（可分离锥面）' : '外圈';
    const outerDesc = isThrust
      ? '固定在轴承座内（位于前侧 +Z），内孔刻意大于轴径以留出径向间隙；背侧球沟道承受轴向推力。支持剖切/透明/隐藏外圈观察内部。'
      : g.bearingType === 'deep-groove'
        ? '静止安装在轴承座孔中，内壁加工深圆弧沟道。默认 120° 剖切便于观察滚道截面与滚动体运动；实物为不可分离结构。'
        : g.bearingType === 'cylindrical-roller'
          ? 'N 型无挡边外圈，内壁为光整圆柱滚道，拆装时可沿轴向直接滑出，便于安装与允许轴向热膨胀游动。'
          : `外圈内锥面半锥角等于接触角 ${g.contactAngleDeg.toFixed(0)}°，大口朝向 −Z 端；沿 +Z 抽离时与圆锥滚子迅速脱开无干涉。`;
    const outerPart = this.part(
      'outer-ring',
      outerName,
      outerDesc,
      `外径 Ø${g.outerDiameter} mm · ${info.separable ? '可沿轴分离' : '剖视教学展示'}`,
      2,
      'housing'
    );
    this.addRevolvedWithCutaway(outerPart, profiles.outer, PALETTE.bearing);

    // 6 & 7. Front & Rear shields / locating rings (前后防尘盖 / 挡环)
    const shieldNameFront = isThrust ? '座圈支承垫环' : g.bearingType === 'deep-groove' ? '前防尘盖' : '前端密封挡环';
    const shieldNameRear = isThrust ? '轴端定位挡环' : g.bearingType === 'deep-groove' ? '后防尘盖' : '后端密封挡环';
    const shieldDesc =
      g.bearingType === 'deep-groove'
        ? '固定在外圈端槽内的非接触式防尘盖，与内圈肩部保留微小径向间隙，阻挡异物并保持润滑脂。'
        : isThrust
          ? '轴端与座端的轴向限位示意件，拆装时最先解除端面约束。'
          : '端面迷宫挡环示意，防止润滑剂流失并作为拆装第一步先行退出。';

    const shieldThickness = 0.9;
    let shieldInnerR, shieldOuterR, frontZ, rearZ;
    if (g.bearingType === 'deep-groove') {
      shieldInnerR = Math.min(profiles.rsi + 0.55, rm - rb * 0.3);
      shieldOuterR = Math.max(shieldInnerR + 2, profiles.rso + 0.5);
      frontZ = hw - shieldThickness * 0.6;
      rearZ = -hw + shieldThickness * 0.6;
    } else if (isThrust) {
      shieldInnerR = Math.max(g.housingWasherBoreRadius + 0.4, rm + rb * 0.35);
      shieldOuterR = ro - 0.6;
      frontZ = hw + 2.0;
      rearZ = -hw - 2.0;
    } else {
      // Slim outer-rim labyrinth retaining ring so the machined inner-ring face remains unobstructed.
      shieldInnerR = Math.min(ro - 2.6, Math.max(profiles.rso - 1.2, rm + rb * 0.55));
      shieldOuterR = ro - 0.5;
      frontZ = hw + 1.8;
      rearZ = -hw - 1.8;
    }

    const frontProfile = [
      [shieldInnerR, frontZ - shieldThickness / 2],
      [shieldOuterR, frontZ - shieldThickness / 2],
      [shieldOuterR, frontZ + shieldThickness / 2],
      [shieldInnerR, frontZ + shieldThickness / 2],
    ];
    const rearProfile = [
      [shieldInnerR, rearZ - shieldThickness / 2],
      [shieldOuterR, rearZ - shieldThickness / 2],
      [shieldOuterR, rearZ + shieldThickness / 2],
      [shieldInnerR, rearZ + shieldThickness / 2],
    ];

    const frontPart = this.part('front-shield', shieldNameFront, shieldDesc, '拆装第 1 步退出 · +Z 端', 1, 'housing');
    this.addRevolvedWithCutaway(frontPart, frontProfile, PALETTE.cover, PALETTE.seal);

    const rearPart = this.part('rear-shield', shieldNameRear, shieldDesc, '拆装第 1 步退出 · −Z 端', 1, 'housing');
    this.addRevolvedWithCutaway(rearPart, rearProfile, PALETTE.cover, PALETTE.seal);

    // Compute exact bounding-box-based collision-free axial disassembly plan.
    this.updateMotion();
    this.scene.updateMatrixWorld(true);
    const axialGap = Math.max(18, ro * 0.42);
    const boxSummaries = this.parts.map(part => {
      const b = new THREE.Box3().setFromObject(part.group);
      return { id: part.id, min: b.min.toArray(), max: b.max.toArray() };
    });
    this.disassemblyPlan = bearingDisassemblyPlan(boxSummaries, g.bearingType, axialGap);
    for (const part of this.parts) {
      part.offset.set(0, 0, this.disassemblyPlan[part.id].finalZ);
    }

    this.pose();
    this.select(this.parts.some(x => x.id === this.selected) ? this.selected : 'elements');
    if (hadRoot) this.fitModel();
    else this.home();
  }

  buildCageGeometry(part, parent, g) {
    const rm = g.pitchRadius;
    const rb = g.elementRadius;
    const Z = g.elementCount;
    const hw = g.width / 2;
    const gap = Math.max(0.9, g.cagePocketClearance);
    const barTangential = Math.min(gap * 0.48, Math.max(1.0, rb * 0.42));

    if (g.bearingType === 'thrust-ball') {
      // Flat pressed ring cage: inner ring & outer ring centered at z=0 with radial pocket bars.
      const tZ = Math.min(rb * 0.72, Math.max(1.6, rb * 0.55));
      const rInOuter = Math.max(g.housingWasherBoreRadius + 0.8, rm - rb - 0.35);
      const rInInner = Math.max(g.housingWasherBoreRadius + 0.25, rInOuter - Math.min(2.4, (rInOuter - g.housingWasherBoreRadius) * 0.7));
      const rOutInner = Math.min(g.outerRadius - 1.4, rm + rb + 0.35);
      const rOutOuter = Math.min(g.outerRadius - 0.3, rOutInner + Math.min(2.4, (g.outerRadius - rOutInner) * 0.7));
      this.ring(part, rInOuter, rInInner, tZ, PALETTE.cage, parent);
      this.ring(part, rOutOuter, rOutInner, tZ, PALETTE.cage, parent);
      const spokeLen = Math.max(1, rOutInner - rInOuter + 0.4);
      const spokeMid = (rInOuter + rOutInner) / 2;
      for (let k = 0; k < Z; k++) {
        const a = ((k + 0.5) * Math.PI * 2) / Z;
        const bar = this.mesh(part, new THREE.BoxGeometry(spokeLen, barTangential, tZ * 0.9), PALETTE.cage, [spokeMid * Math.cos(a), spokeMid * Math.sin(a), 0], parent);
        bar.rotation.z = a;
      }
      return;
    }

    if (g.bearingType === 'tapered-roller') {
      const c = g.cone;
      const ringT = Math.max(1.0, Math.min(1.6, (hw - Math.abs(c.zSmall)) * 0.45));
      const zSmallRing = Math.min(hw - ringT * 0.65, c.zSmall + ringT * 0.65 + 0.15);
      const zLargeRing = Math.max(-hw + ringT * 0.65, c.zLarge - ringT * 0.65 - 0.15);
      const rSmallC = (c.apexZ - zSmallRing) * Math.tan(c.beta);
      const rLargeC = (c.apexZ - zLargeRing) * Math.tan(c.beta);
      const halfThickS = Math.min(c.smallRadius * 0.42, 1.5);
      const halfThickL = Math.min(c.largeRadius * 0.42, 1.8);
      this.ring(part, rSmallC + halfThickS, rSmallC - halfThickS, ringT, PALETTE.cage, parent).position.z = zSmallRing;
      this.ring(part, rLargeC + halfThickL, rLargeC - halfThickL, ringT, PALETTE.cage, parent).position.z = zLargeRing;

      const spanLen = Math.hypot(rLargeC - rSmallC, zSmallRing - zLargeRing);
      const barRad = Math.min(halfThickS * 1.6, 2.2);
      for (let k = 0; k < Z; k++) {
        const a = ((k + 0.5) * Math.PI * 2) / Z;
        const pivot = new THREE.Group();
        pivot.position.set(((rSmallC + rLargeC) / 2) * Math.cos(a), ((rSmallC + rLargeC) / 2) * Math.sin(a), (zSmallRing + zLargeRing) / 2);
        pivot.rotation.z = a;
        const bar = this.mesh(part, new THREE.BoxGeometry(barRad, barTangential, spanLen), PALETTE.cage, [0, 0, 0], pivot);
        bar.rotation.y = -c.beta;
        parent.add(pivot);
      }
      return;
    }

    // deep-groove & cylindrical-roller windowed brass cage:
    // two side rings axially outside the balls/rollers + Z pocket bridges midway between elements.
    const halfElemZ = g.bearingType === 'deep-groove' ? rb : g.rollerLength / 2;
    const shieldInnerZ = g.bearingType === 'deep-groove' ? hw - 1.0 : hw - 0.3;
    const axialSlack = Math.max(0.7, shieldInnerZ - halfElemZ - 0.25);
    const ringT = Math.max(0.55, Math.min(1.25, axialSlack * 0.65));
    const ringZ = halfElemZ + 0.15 + ringT / 2;
    const halfRad = Math.min(rb * 0.46, (g.outerRadius - g.boreRadius) * 0.14);
    for (const sign of [-1, 1]) {
      this.ring(part, rm + halfRad, rm - halfRad, ringT, PALETTE.cage, parent).position.z = sign * ringZ;
    }
    const bridgeLen = Math.max(1, 2 * ringZ);
    for (let k = 0; k < Z; k++) {
      const a = ((k + 0.5) * Math.PI * 2) / Z;
      const bar = this.mesh(
        part,
        new THREE.BoxGeometry(halfRad * 1.85, barTangential, bridgeLen),
        PALETTE.cage,
        [rm * Math.cos(a), rm * Math.sin(a), 0],
        parent
      );
      bar.rotation.z = a;
    }
  }

  updateMotion() {
    if (!this.root) return;
    for (const g of this.innerSpinGroups || []) g.rotation.z = this.rotations.inner;
    for (const g of this.cageOrbitGroups || []) g.rotation.z = this.rotations.cage;
    for (const { group, axis, sign = 1 } of this.elementSpinEntries || []) {
      group.rotation[axis] = sign * this.rotations.elementSpin;
    }
  }

  resetMotion() {
    this.playing = false;
    this.time = 0;
    this.lastFrame = undefined;
    this.rotations = { inner: 0, cage: 0, elementSpin: 0 };
    if (this.root) this.updateMotion();
  }

  setPlaying(value) {
    if (value && (this.amount > 0 || this.step > 0)) this.restore();
    this.playing = Boolean(value) && (this.p?.innerRPM ?? 0) > 0;
    this.lastFrame = undefined;
    this.render();
  }

  setSpeed(value) {
    if (!Number.isFinite(value)) throw new RangeError('无效演示速度');
    this.speed = THREE.MathUtils.clamp(value, 0.1, 2);
  }

  setLabels(value) {
    this.labelsOn = Boolean(value);
    this.render();
  }

  setHousingMode(mode) {
    if (!['solid', 'open', 'transparent', 'hidden'].includes(mode)) throw new RangeError('无效外圈显示方式');
    this.housingMode = mode;
    this.open = mode === 'open';
    this.pose();
    this.fitModel();
  }

  pose() {
    const assembled = this.amount === 0 && this.step === 0;
    const progress = this.step ? this.step : this.amount * (steps.length - 1);
    const useCut = this.housingMode === 'open';
    const hideHousing = assembled && this.housingMode === 'hidden';
    const transparentHousing = assembled && this.housingMode === 'transparent';

    for (const { fullGroup, cutGroup } of this.cutawayPairs || []) {
      fullGroup.visible = !useCut;
      cutGroup.visible = useCut;
    }

    for (const p of this.parts) {
      p.group.position.fromArray(bearingDisassemblyOffset(this.disassemblyPlan[p.id], progress));
      p.group.visible = !(p.category === 'housing' && hideHousing);
      if (p.category === 'housing') {
        p.group.traverse(o => {
          if (!o.isMesh) return;
          o.material.transparent = transparentHousing;
          o.material.opacity = transparentHousing ? 0.22 : 1;
          o.material.depthWrite = !transparentHousing;
        });
      }
    }
    this.scene.updateMatrixWorld(true);
    this.render();
  }

  explode(value) {
    this.resetMotion();
    this.amount = THREE.MathUtils.clamp(value, 0, 1);
    this.step = 0;
    this.pose();
    this.fitModel();
  }

  assembly(step) {
    this.resetMotion();
    this.step = THREE.MathUtils.clamp(step, 0, steps.length - 1);
    this.amount = 0;
    this.pose();
    this.fitModel();
  }

  restore() {
    this.resetMotion();
    this.amount = 0;
    this.step = 0;
    this.pose();
    this.home();
  }

  select(id) {
    const part = this.parts.find(x => x.id === id);
    if (!part) return;
    this.selected = id;
    for (const p of this.parts) {
      p.group.traverse(o => {
        if (o.isMesh) o.material.emissive.setHex(p.id === id ? 0x122638 : 0);
      });
    }
    this.onSelect(part);
    this.render();
  }

  home(direction = this.amount > 0 || this.step > 0 ? [1.2, 0.42, 1.35] : [0.58, 0.38, 1]) {
    const up = Math.abs(new THREE.Vector3(...direction).normalize().y) > 0.999 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    if (!this.camera.up.equals(up)) {
      const previous = this.controls;
      previous.removeEventListener('change', this.onControlChange);
      previous.dispose();
      this.camera.up.copy(up);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.minDistance = 40;
      this.controls.maxDistance = 4000;
      this.controls.addEventListener('change', this.onControlChange);
    }
    const damp = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(...direction).multiplyScalar(320);
    if (this.root) this.fitModel();
    else this.controls.update();
    this.controls.enableDamping = damp;
  }

  fitModel() {
    if (!this.root) return;
    this.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    const boxes = [];
    this.root.traverse(mesh => {
      if (!mesh.isMesh || !this.isVisible(mesh)) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      bounds.union(b);
      boxes.push(b);
    });
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    const right = new THREE.Vector3().crossVectors(this.camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right);
    const tv = Math.tan((this.camera.fov * Math.PI) / 360);
    const th = tv * this.camera.aspect;
    let distance = 0;
    for (const b of boxes) {
      for (const x of [b.min.x, b.max.x]) {
        for (const y of [b.min.y, b.max.y]) {
          for (const z of [b.min.z, b.max.z]) {
            const v = new THREE.Vector3(x, y, z).sub(center);
            const depth = v.dot(direction);
            distance = Math.max(distance, depth + Math.abs(v.dot(right)) / th, depth + Math.abs(v.dot(up)) / tv);
          }
        }
      }
    }
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance * 1.15);
    this.controls.update();
  }

  state() {
    this.scene.updateMatrixWorld(true);
    return {
      p: this.p && { ...this.p },
      amount: this.amount,
      step: this.step,
      selected: this.selected,
      playing: this.playing,
      speed: this.speed,
      housingMode: this.housingMode,
      open: this.open,
      labelsOn: this.labelsOn,
      time: this.time,
      rotations: { ...this.rotations },
      animationScale: ANIMATION_SCALE,
      geometry: this.g ? { ...this.g } : null,
      parts: this.parts.map(p => {
        const b = new THREE.Box3().setFromObject(p.group);
        return {
          id: p.id,
          name: p.name,
          position: p.group.position.toArray(),
          visible: this.isVisible(p.group),
          min: b.min.toArray(),
          max: b.max.toArray(),
        };
      }),
      camera: this.camera.position.toArray(),
      geometries: this.renderer.info.memory.geometries,
    };
  }

  clearGeometry() {
    if (!this.root) return;
    const geometries = new Set();
    const materials = new Set();
    this.root.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    geometries.forEach(x => x.dispose());
    materials.forEach(x => x.dispose());
    this.scene.remove(this.root);
    this.root = null;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.events.abort();
    this.resize.disconnect();
    this.controls.removeEventListener('change', this.onControlChange);
    this.controls.dispose();
    this.clearGeometry();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.parts = [];
  }
}
