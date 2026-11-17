export const fields = {
  module: ['模数', 'mm', 1, 4, 0.25],
  teeth: ['小齿轮齿数', '齿', 18, 40, 1],
  rackTeeth: ['齿条齿数', '齿', 32, 80, 1],
  faceWidth: ['齿宽', 'mm', 10, 30, 1],
  inputRPM: ['输入转速', 'r/min', 0, 60, 1],
};
export const defaults = Object.freeze({module: 2, teeth: 24, rackTeeth: 64, faceWidth: 18, inputRPM: 12});
export const PRESSURE_ANGLE = 20 * Math.PI / 180;
export const ANIMATION_SCALE = 0.2;

export function validate(p) {
  for (const [key, [name, unit, min, max]] of Object.entries(fields)) {
    if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max) {
      throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
    }
  }
  if (!Number.isInteger(p.teeth) || !Number.isInteger(p.rackTeeth)) {
    throw new RangeError('齿数必须为整数');
  }
  return p;
}

export function geometry(p) {
  validate(p);
  const pitch = Math.PI * p.module;
  const radius = p.module * p.teeth / 2;
  const length = p.rackTeeth * pitch;
  // Keep two teeth beyond the pitch contact on both ends throughout travel.
  const travel = length / 2 - 2 * pitch;
  return {pitch, radius, diameter: radius * 2, length, travel,
    maxAngle: travel / radius * 180 / Math.PI,
    tipRadius: radius + p.module, rootRadius: radius - 1.25 * p.module};
}

export function estimate(p, angle = 0) {
  const g = geometry(p);
  if (!Number.isFinite(angle) || Math.abs(angle) > g.maxAngle + 1e-8) {
    throw new RangeError('转角超出齿条有效行程');
  }
  return {...g, angle, displacement: g.radius * angle * Math.PI / 180,
    perTurn: Math.PI * g.diameter,
    velocity: Math.PI * g.diameter * p.inputRPM / 60};
}

export function advanceMotion(p, angle, direction, seconds, speed = 1) {
  const g = geometry(p);
  if (!Number.isFinite(angle) || Math.abs(angle) > g.maxAngle + 1e-8 ||
      ![1, -1].includes(direction) || !Number.isFinite(seconds) || seconds < 0 ||
      !Number.isFinite(speed) || speed <= 0) throw new RangeError('无效运动状态');
  const next = angle + direction * seconds * p.inputRPM * 6 * speed * ANIMATION_SCALE;
  const atLimit = direction > 0 ? next >= g.maxAngle : next <= -g.maxAngle;
  return {angle: Math.max(-g.maxAngle, Math.min(g.maxAngle, next)), atLimit};
}

const involute = a => Math.tan(a) - a;

// A sampled involute above the base circle, with a radial root transition.
// Phase aligns a pinion tooth with the center valley of an even-length rack,
// and a pinion gap with the center tooth of an odd-length rack.
export function pinionOutline(p) {
  const g = geometry(p), base = g.radius * Math.cos(PRESSURE_ANGLE);
  const start = Math.max(base, g.rootRadius), points = [];
  const halfThickness = radius => Math.PI / (2 * p.teeth) + involute(PRESSURE_ANGLE)
    - involute(Math.acos(Math.min(1, base / radius)));
  const point = (radius, angle) => [radius * Math.cos(angle), radius * Math.sin(angle)];
  for (let tooth = 0; tooth < p.teeth; tooth++) {
    const phase = p.rackTeeth % 2 ? Math.PI / p.teeth : 0;
    const center = -Math.PI / 2 + phase + tooth * 2 * Math.PI / p.teeth;
    points.push(point(g.rootRadius, center - halfThickness(start)));
    for (let i = 0; i <= 10; i++) {
      const radius = start + (g.tipRadius - start) * i / 10;
      points.push(point(radius, center - halfThickness(radius)));
    }
    const tipHalf = halfThickness(g.tipRadius);
    for (let i = 1; i <= 4; i++) points.push(point(g.tipRadius, center - tipHalf + 2 * tipHalf * i / 4));
    for (let i = 10; i >= 0; i--) {
      const radius = start + (g.tipRadius - start) * i / 10;
      points.push(point(radius, center + halfThickness(radius)));
    }
    points.push(point(g.rootRadius, center + halfThickness(start)));
  }
  return points;
}

export function rackOutline(p) {
  const g = geometry(p), m = p.module, points = [];
  const root = -g.radius - 1.25 * m, top = -g.radius + m;
  const halfPitchThickness = g.pitch / 4 - 0.02 * m;
  const rootHalf = halfPitchThickness + 1.25 * m * Math.tan(PRESSURE_ANGLE);
  const tipHalf = halfPitchThickness - m * Math.tan(PRESSURE_ANGLE);
  points.push([-g.length / 2, root - 4 * m], [-g.length / 2, root]);
  for (let tooth = 0; tooth < p.rackTeeth; tooth++) {
    const center = -g.length / 2 + (tooth + 0.5) * g.pitch;
    points.push([center - rootHalf, root], [center - tipHalf, top], [center + tipHalf, top], [center + rootHalf, root]);
  }
  points.push([g.length / 2, root], [g.length / 2, root - 4 * m]);
  return points;
}
