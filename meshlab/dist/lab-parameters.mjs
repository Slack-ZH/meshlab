export const mechanismPresets = {
  worm: { default: { starts: 1, wheelTeeth: 40, rpm: 120 }, double: { starts: 2, wheelTeeth: 40, rpm: 120 }, quad: { starts: 4, wheelTeeth: 40, rpm: 120 }, large: { starts: 1, wheelTeeth: 60, rpm: 120 } },
  drill: { default: { motorRpm: 6000 }, slow: { motorRpm: 3000 }, fast: { motorRpm: 9000 } },
  differential: { default: { carrierRpm: 60, trackWidth: 1.6, turnRadius: 4 }, tight: { carrierRpm: 60, trackWidth: 1.6, turnRadius: 3 }, gentle: { carrierRpm: 60, trackWidth: 1.6, turnRadius: 12 } },
  crank: { default: { radius: 40, rodLength: 140, rpm: 30 }, long: { radius: 40, rodLength: 220, rpm: 30 }, slow: { radius: 40, rodLength: 140, rpm: 10 } },
  belt: { default: { diameter1: 100, diameter2: 180, centerDistance: 260, rpm: 20 }, equal: { diameter1: 180, diameter2: 180, centerDistance: 260, rpm: 20 }, wide: { diameter1: 100, diameter2: 180, centerDistance: 420, rpm: 20 } },
  gear: { default: { power: 1.5, rpm: 1440, efficiency: .96 }, light: { power: .75, rpm: 1440, efficiency: .96 }, slow: { power: 1.5, rpm: 720, efficiency: .96 } },
};

export function validateNumber(raw, { min, max, step = 'any' }) {
  const value = Number(raw);
  if (String(raw).trim() === '' || !Number.isFinite(value)) return { error: '请输入有效数值。' };
  if (value < Number(min) || value > Number(max)) return { error: `请输入 ${min}—${max} 范围内的数值。` };
  if (step !== 'any' && Number(step) > 0) {
    const units = (value - Number(min)) / Number(step);
    if (Math.abs(units - Math.round(units)) > 1e-6) return { error: `请按 ${step} 的步长输入。` };
  }
  return { value };
}

export function reducerResults({ power, rpm, efficiency }) {
  if (![power, rpm, efficiency].every(Number.isFinite) || power <= 0 || rpm <= 0 || efficiency <= 0 || efficiency > 1) throw new RangeError('功率、转速须为正数，效率须在 0—1 之间。');
  const outputRpm = rpm / 16;
  return { ratio: 16, middleRpm: rpm / 4, outputRpm, torque: 9550 * power * efficiency / outputRpm };
}
