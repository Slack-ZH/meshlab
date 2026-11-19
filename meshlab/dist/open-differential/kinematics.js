export const defaults = Object.freeze({ carrierRpm: 60, trackWidth: 1.6, turnRadius: 4 });
export const gearing = Object.freeze({ sideTeeth: 20, spiderTeeth: 10, finalDrive: 4 });
export const demonstrationScale = 1 / 5;
export const modes = Object.freeze({ straight: '直行', left: '左转', right: '右转' });

// Equal tyres, pure rolling, steady turning about the rear-axle centreline.
// Speeds use the same vehicle-forward sign convention for both half-shafts.
export function differentialSpeeds(parameters = defaults, mode = 'straight') {
  const { carrierRpm, trackWidth, turnRadius } = parameters;
  if (!Object.hasOwn(modes, mode)) throw new RangeError('未知工况');
  if (![carrierRpm, trackWidth, turnRadius].every(Number.isFinite) || carrierRpm < 0 || trackWidth <= 0 || turnRadius <= trackWidth / 2) throw new RangeError('转速须非负，转弯半径须大于半轮距。');
  const difference = mode === 'straight' ? 0 : trackWidth / (2 * turnRadius) * (mode === 'left' ? 1 : -1);
  const left = carrierRpm * (1 - difference), right = carrierRpm * (1 + difference);
  return { left, right, carrier: carrierRpm, input: carrierRpm * gearing.finalDrive,
    spider: -(right - left) / 2 * gearing.sideTeeth / gearing.spiderTeeth,
    delta: right - left, ratio: difference, inner: mode === 'straight' ? null : mode };
}

export function initialAngles() { return { carrier: 0, left: 0, right: 0, spider: 0, input: 0 }; }

// Integrating angles, rather than recomputing from elapsed time and the new speed,
// preserves tooth phase when switching modes or changing parameters mid-motion.
export function advanceAngles(angles, speeds, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('时间步长须非负');
  const step = seconds * Math.PI / 30;
  return Object.fromEntries(Object.keys(angles).map(key => [key, angles[key] + speeds[key] * step]));
}
