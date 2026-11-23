export const BEARING_TYPES = Object.freeze({
  'deep-groove': {
    id: 'deep-groove',
    name: '深沟球轴承',
    shortName: '深沟球',
    exampleCode: '6208 教学比例',
    kind: 'ball',
    separable: false,
    lifeExponent: 3,
    fixedContactAngle: 0,
    radialCapable: true,
    axialCapable: true,
    axialNote: '可承受径向载荷及一定双向轴向载荷',
    summary: '点接触、深圆弧沟道、浪形兜孔保持架；结构紧凑、摩擦较小，实物为不可分离结构。',
  },
  'cylindrical-roller': {
    id: 'cylindrical-roller',
    name: '圆柱滚子轴承',
    shortName: '圆柱滚子',
    exampleCode: 'N208 教学比例',
    kind: 'roller',
    separable: true,
    lifeExponent: 10 / 3,
    fixedContactAngle: 0,
    radialCapable: true,
    axialCapable: false,
    axialNote: 'N 型外圈无挡边，仅承受径向载荷，允许轴向游动',
    summary: '线接触、内圈双挡边 + 无挡边可分离外圈 + 窗式保持架；径向承载高，不承受轴向载荷。',
  },
  'tapered-roller': {
    id: 'tapered-roller',
    name: '圆锥滚子轴承',
    shortName: '圆锥滚子',
    exampleCode: '30208 教学比例',
    kind: 'roller',
    separable: true,
    lifeExponent: 10 / 3,
    fixedContactAngle: null,
    radialCapable: true,
    axialCapable: true,
    axialNote: '承受径向与单向轴向联合载荷；接触角越大轴向承载比例越高',
    summary: '内外圈锥面与圆锥滚子母线延长线交于轴线上同一点，满足纯滚动条件；外圈可沿轴分离。',
  },
  'thrust-ball': {
    id: 'thrust-ball',
    name: '推力球轴承',
    shortName: '推力球',
    exampleCode: '51208 教学比例',
    kind: 'ball',
    separable: true,
    lifeExponent: 3,
    fixedContactAngle: 90,
    radialCapable: false,
    axialCapable: true,
    axialNote: '接触角 90°，仅承受单向轴向载荷，不能承受径向载荷',
    summary: '由紧配轴的轴圈、带轴孔间隙的座圈、钢球与平面保持架组成，可沿轴向顺序分离。',
  },
});

export const presets = Object.freeze({
  'deep-groove': Object.freeze({
    bearingType: 'deep-groove',
    boreDiameter: 40,
    outerDiameter: 80,
    width: 18,
    elementCount: 9,
    contactAngle: 0,
    innerRPM: 600,
    radialLoad: 3.0,
    axialLoad: 0.5,
    dynamicRatingC: 30,
  }),
  'cylindrical-roller': Object.freeze({
    bearingType: 'cylindrical-roller',
    boreDiameter: 40,
    outerDiameter: 80,
    width: 18,
    elementCount: 12,
    contactAngle: 0,
    innerRPM: 600,
    radialLoad: 5.0,
    axialLoad: 0.0,
    dynamicRatingC: 45,
  }),
  'tapered-roller': Object.freeze({
    bearingType: 'tapered-roller',
    boreDiameter: 40,
    outerDiameter: 80,
    width: 20,
    elementCount: 14,
    contactAngle: 15,
    innerRPM: 600,
    radialLoad: 4.5,
    axialLoad: 1.5,
    dynamicRatingC: 52,
  }),
  'thrust-ball': Object.freeze({
    bearingType: 'thrust-ball',
    boreDiameter: 40,
    outerDiameter: 80,
    width: 26,
    elementCount: 12,
    contactAngle: 90,
    innerRPM: 300,
    radialLoad: 0.0,
    axialLoad: 4.0,
    dynamicRatingC: 42,
  }),
});

export const defaults = presets['deep-groove'];

export const fields = Object.freeze({
  boreDiameter: ['内径 d', 'mm', 20, 60, 2],
  outerDiameter: ['外径 D', 'mm', 52, 130, 2],
  width: ['宽度 / 高度 B', 'mm', 12, 36, 1],
  elementCount: ['滚动体数 Z', '个', 6, 20, 1],
  contactAngle: ['接触角 α', '°', 10, 25, 1],
  innerRPM: ['内圈 / 轴圈转速 nᵢ', 'r/min', 0, 1800, 10],
  radialLoad: ['径向载荷 Fr', 'kN', 0, 20, 0.2],
  axialLoad: ['轴向载荷 Fa', 'kN', 0, 20, 0.2],
  dynamicRatingC: ['参考额定动载荷 C', 'kN', 5, 120, 1],
});

// 1x demo runs at 3% of operating speed (600 rpm -> 18 rpm visual) so students can track
// both cage orbital speed and individual rolling-element spin markers cleanly.
export const ANIMATION_SCALE = 0.03;

export const assumptions =
  '滚动轴承教学模型覆盖深沟球、N型圆柱滚子、圆锥滚子与单向推力球四类结构。' +
  '运动关系基于外圈/座圈固定、内圈/轴圈匀速转动且滚道接触处理想纯滚动的假设，未计入游隙、弹性趋近、离心滑移、保持架打滑与润滑油膜摩擦。' +
  '寿命估算按 ISO 281 基本公式 L10=(C/P)^p（球轴承 p=3、滚子轴承 p=10/3）和简化当量动载荷系数计算，C 由用户按样本给定，不代表特定厂商型号校核、极限转速认证或制造图纸。';

const DEG = Math.PI / 180;

export function effectiveContactAngle(p) {
  const info = BEARING_TYPES[p?.bearingType];
  if (!info) throw new RangeError('无效的轴承类型');
  return info.fixedContactAngle === null ? p.contactAngle : info.fixedContactAngle;
}

export function validate(p) {
  if (!p || typeof p !== 'object') throw new RangeError('缺少轴承参数');
  const info = BEARING_TYPES[p.bearingType];
  if (!info) throw new RangeError('轴承类型无效，请从四类标准结构中选择');

  for (const [key, [name, unit, min, max]] of Object.entries(fields)) {
    if (key === 'contactAngle' && info.fixedContactAngle !== null) continue;
    const v = p[key];
    if (!Number.isFinite(v) || v < min || v > max) {
      throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
    }
  }
  if (!Number.isInteger(p.elementCount)) throw new RangeError('滚动体数必须为整数');

  const radialSection = (p.outerDiameter - p.boreDiameter) / 2;
  if (radialSection < 12) {
    throw new RangeError('径向截面高度 (D − d) / 2 不得小于 12 mm，请增大外径或减小内径');
  }

  const pitchDiameter = (p.outerDiameter + p.boreDiameter) / 2;
  const pitchRadius = pitchDiameter / 2;
  const maxWidthAllowed = radialSection * 2.2;
  if (p.width > maxWidthAllowed + 1e-9 && p.bearingType !== 'thrust-ball') {
    throw new RangeError(`当前截面下宽度 B 不宜超过 ${Math.floor(maxWidthAllowed)} mm`);
  }

  // Verify rolling-element geometry fits both radially, axially, and circumferentially with cage pocket clearance.
  const sizing = computeElementSizing(p, info, radialSection, pitchRadius);
  if (sizing.elementDiameter < 4) {
    throw new RangeError('当前尺寸下滚动体直径过小（< 4 mm），请增大径向截面或调整宽度');
  }
  if (sizing.ringWall < 2.4) {
    throw new RangeError('内外圈最小壁厚不足（< 2.4 mm），请增大外径或减小内径');
  }
  const circumferentialPitch = (2 * Math.PI * pitchRadius) / p.elementCount;
  const minClearance = Math.max(1.2, sizing.elementDiameter * 0.14);
  if (circumferentialPitch < sizing.elementDiameter + minClearance) {
    const maxZ = Math.floor((2 * Math.PI * pitchRadius) / (sizing.elementDiameter + minClearance));
    throw new RangeError(`当前节圆下最多容纳约 ${Math.max(6, maxZ)} 个滚动体，请减少滚动体数或增大外径`);
  }

  if (p.bearingType === 'tapered-roller') {
    const alpha = p.contactAngle * DEG;
    const k = sizing.elementDiameter / (2 * pitchRadius);
    const beta = Math.atan2(Math.sin(alpha), Math.cos(alpha) + k);
    const gamma = alpha - beta;
    const innerConeAngle = beta - gamma;
    if (innerConeAngle <= 2 * DEG) {
      throw new RangeError('当前接触角与滚子直径比例导致内圈锥角过小，请增大接触角或增大外径');
    }
    const apexZ = pitchRadius / Math.tan(beta);
    const coneDist = pitchRadius / Math.sin(beta);
    const halfL = sizing.rollerLength / 2;
    const smallRadius = (coneDist - halfL) * Math.tan(gamma);
    if (smallRadius < 1.5 || apexZ <= sizing.rollerLength) {
      throw new RangeError('当前圆锥滚子长度或接触角不合理，请调整宽度或接触角');
    }
    const zLarge = -halfL * Math.cos(beta);
    const zSmall = halfL * Math.cos(beta);
    const rAtLargeOuter = (apexZ - zLarge) * Math.tan(alpha);
    const rAtSmallInner = (apexZ - zSmall) * Math.tan(innerConeAngle);
    if (p.outerDiameter / 2 - rAtLargeOuter < 1.8 || rAtSmallInner - p.boreDiameter / 2 < 1.8) {
      throw new RangeError('当前接触角或宽度下圆锥滚道端面壁厚不足，请增大外径、减小宽度或降低接触角');
    }
  }

  return p;
}

function computeElementSizing(p, info, radialSection, pitchRadius) {
  if (p.bearingType === 'deep-groove') {
    // Classic 62xx proportion: ball diameter ~ 0.54 * H, bounded by width B so cage rings & shields clear cleanly.
    const elementDiameter = Math.min(radialSection * 0.54, p.width * 0.62);
    const ringWall = (radialSection - elementDiameter) / 2;
    return {
      elementDiameter,
      rollerLength: elementDiameter,
      ringWall,
      grooveRadius: elementDiameter * 0.525,
      grooveDepth: elementDiameter * 0.19,
    };
  }
  if (p.bearingType === 'cylindrical-roller') {
    const elementDiameter = Math.min(radialSection * 0.48, p.width * 0.56);
    const rollerLength = Math.min(p.width * 0.56, elementDiameter * 1.28);
    const ringWall = (radialSection - elementDiameter) / 2;
    return {
      elementDiameter,
      rollerLength,
      ringWall,
      grooveRadius: null,
      grooveDepth: 0,
    };
  }
  if (p.bearingType === 'tapered-roller') {
    const elementDiameter = Math.min(radialSection * 0.44, p.width * 0.48);
    const rollerLength = Math.min(p.width * 0.56, elementDiameter * 1.38);
    const ringWall = (radialSection - elementDiameter) / 2;
    return {
      elementDiameter,
      rollerLength,
      ringWall,
      grooveRadius: null,
      grooveDepth: 0,
    };
  }
  // thrust-ball: balls sit between shaft washer (+z) and housing washer (-z)
  const elementDiameter = Math.min(p.width * 0.46, radialSection * 0.64);
  const washerThickness = (p.width - elementDiameter) / 2 + elementDiameter * 0.18;
  const ringWall = Math.min((radialSection - elementDiameter) / 2, washerThickness - elementDiameter * 0.18);
  return {
    elementDiameter,
    rollerLength: elementDiameter,
    ringWall,
    washerThickness,
    grooveRadius: elementDiameter * 0.525,
    grooveDepth: elementDiameter * 0.18,
  };
}

export function geometry(p) {
  validate(p);
  const info = BEARING_TYPES[p.bearingType];
  const boreRadius = p.boreDiameter / 2;
  const outerRadius = p.outerDiameter / 2;
  const radialSection = outerRadius - boreRadius;
  const pitchDiameter = (p.boreDiameter + p.outerDiameter) / 2;
  const pitchRadius = pitchDiameter / 2;
  const contactAngleDeg = effectiveContactAngle(p);
  const contactAngleRad = contactAngleDeg * DEG;
  const sizing = computeElementSizing(p, info, radialSection, pitchRadius);

  const g = {
    bearingType: p.bearingType,
    kind: info.kind,
    separable: info.separable,
    boreDiameter: p.boreDiameter,
    outerDiameter: p.outerDiameter,
    boreRadius,
    outerRadius,
    width: p.width,
    radialSection,
    pitchDiameter,
    pitchRadius,
    elementCount: p.elementCount,
    elementDiameter: sizing.elementDiameter,
    elementRadius: sizing.elementDiameter / 2,
    rollerLength: sizing.rollerLength,
    ringWall: sizing.ringWall,
    grooveRadius: sizing.grooveRadius,
    grooveDepth: sizing.grooveDepth,
    washerThickness: sizing.washerThickness || null,
    contactAngleDeg,
    contactAngleRad,
    // Exact cone geometry for tapered roller (null for other types)
    cone: null,
    // Shaft & housing washer clearance
    shaftRadius: boreRadius - 0.15,
    housingWasherBoreRadius: boreRadius + Math.max(1.2, radialSection * 0.08),
    circumferentialPitch: (2 * Math.PI * pitchRadius) / p.elementCount,
    cagePocketClearance: (2 * Math.PI * pitchRadius) / p.elementCount - sizing.elementDiameter,
  };

  if (p.bearingType === 'tapered-roller') {
    const k = g.elementDiameter / (2 * pitchRadius);
    const alphaO = contactAngleRad;
    const beta = Math.atan2(Math.sin(alphaO), Math.cos(alphaO) + k);
    const gamma = alphaO - beta;
    const alphaI = beta - gamma;
    const apexZ = pitchRadius / Math.tan(beta);
    const coneDist = pitchRadius / Math.sin(beta);
    const halfL = g.rollerLength / 2;
    const smallRadius = (coneDist - halfL) * Math.tan(gamma);
    const largeRadius = (coneDist + halfL) * Math.tan(gamma);
    const zSmall = halfL * Math.cos(beta);
    const zLarge = -halfL * Math.cos(beta);
    const rAtSmallOuter = (apexZ - zSmall) * Math.tan(alphaO);
    const rAtLargeOuter = (apexZ - zLarge) * Math.tan(alphaO);
    const rAtSmallInner = (apexZ - zSmall) * Math.tan(alphaI);
    const rAtLargeInner = (apexZ - zLarge) * Math.tan(alphaI);
    g.cone = {
      apexZ,
      coneDist,
      beta,
      betaDeg: beta / DEG,
      gamma,
      gammaDeg: gamma / DEG,
      outerConeAngle: alphaO,
      outerConeAngleDeg: alphaO / DEG,
      innerConeAngle: alphaI,
      innerConeAngleDeg: alphaI / DEG,
      smallRadius,
      largeRadius,
      zSmall,
      zLarge,
      rAtSmallOuter,
      rAtLargeOuter,
      rAtSmallInner,
      rAtLargeInner,
    };
  }

  return g;
}

/**
 * Pure-rolling kinematics (stationary outer ring / housing washer, rotating inner ring / shaft washer).
 * Returns exact speed ratios so both numerical readouts and 3D animation use the exact same physics.
 */
export function kinematicsRatios(g) {
  if (g.bearingType === 'tapered-roller') {
    const { beta, gamma } = g.cone;
    // Exact 3D rolling cone constraint: zero slip along the entire inner and outer cone contact lines.
    const cageRatio = Math.sin(beta - gamma) / (2 * Math.sin(beta) * Math.cos(gamma));
    // Relative angular velocity of roller about its own axis (+axis pointing toward apex) inside the cage frame.
    const elementSpinRatio = -(Math.sin(beta - gamma) * Math.sin(beta + gamma)) / (2 * Math.sin(beta) * Math.sin(gamma) * Math.cos(gamma));
    return {
      cageRatio,
      elementSpinRatio,
      effectiveAngleRad: beta,
    };
  }
  const lambda = (g.elementDiameter / g.pitchDiameter) * Math.cos(g.contactAngleRad);
  const cageRatio = 0.5 * (1 - lambda);
  // Relative spin of rolling element inside the orbiting cage frame:
  // For alpha = 0: omega_b_rel = -(Dm / (2*Dw)) * (1 - (Dw/Dm)^2) * omega_i (opposite to inner ring).
  // For alpha = 90° (thrust ball): cos(alpha)=0 -> omega_b_rel = -(Dm / (2*Dw)) * omega_i about +r axis.
  const elementSpinRatio = -(g.pitchDiameter / (2 * g.elementDiameter)) * (1 - lambda * lambda);
  return {
    cageRatio,
    elementSpinRatio,
    effectiveAngleRad: g.contactAngleRad,
  };
}

export function estimate(p) {
  const g = geometry(p);
  const info = BEARING_TYPES[p.bearingType];
  const { cageRatio, elementSpinRatio } = kinematicsRatios(g);

  const innerRPM = p.innerRPM;
  const rawCage = innerRPM * cageRatio;
  const rawSpin = innerRPM * elementSpinRatio;
  const cageRPM = rawCage === 0 ? 0 : rawCage;
  const elementSpinRPM = rawSpin === 0 ? 0 : rawSpin;
  const shaftHz = innerRPM / 60;
  const ftfHz = shaftHz * cageRatio;
  const bpfoHz = g.elementCount * ftfHz;
  const bpfiHz = g.elementCount * shaftHz * (1 - cageRatio);
  const bsfHz = Math.abs(elementSpinRPM) / 60;

  // Pitch-line circumferential velocity of inner raceway contact & cage center (m/s)
  const innerContactRadius =
    g.bearingType === 'tapered-roller'
      ? g.cone.coneDist * Math.sin(g.cone.innerConeAngle)
      : g.bearingType === 'thrust-ball'
        ? g.pitchRadius
        : g.pitchRadius - g.elementRadius;
  const pitchSpeed = (Math.PI * g.pitchDiameter * cageRPM) / 60000;
  const innerContactSpeed = (Math.PI * 2 * innerContactRadius * innerRPM) / 60000;

  // Equivalent dynamic load P (teaching ISO 281-inspired linear combination with explicit scope limits)
  const Fr = p.radialLoad;
  const Fa = p.axialLoad;
  const C = p.dynamicRatingC;
  let equivalentLoad = null;
  let loadFactors = { X: null, Y: null, e: null };
  let loadWarning = '';
  let loadValid = true;

  if (p.bearingType === 'cylindrical-roller') {
    if (Fa > 0) {
      loadValid = false;
      loadWarning = 'N 型圆柱滚子轴承外圈无挡边，不能承受轴向载荷（请将轴向载荷 Fa 设为 0 kN，或切换至深沟球 / 圆锥滚子轴承）。';
    } else if (Fr === 0) {
      loadWarning = '当前载荷为 0 kN，不计算有限疲劳寿命。';
    } else {
      loadFactors = { X: 1, Y: 0, e: null };
      equivalentLoad = Fr;
    }
  } else if (p.bearingType === 'thrust-ball') {
    if (Fr > 0) {
      loadValid = false;
      loadWarning = '推力球轴承接触角为 90°，不能承受径向载荷（请将径向载荷 Fr 设为 0 kN，或切换至深沟球 / 圆锥滚子轴承）。';
    } else if (Fa === 0) {
      loadWarning = '当前载荷为 0 kN，不计算有限疲劳寿命。';
    } else {
      loadFactors = { X: 0, Y: 1, e: null };
      equivalentLoad = Fa;
    }
  } else if (p.bearingType === 'deep-groove') {
    if (Fr === 0 && Fa === 0) {
      loadWarning = '当前载荷为 0 kN，不计算有限疲劳寿命。';
    } else if (Fr === 0) {
      // Pure axial load teaching approximation for deep groove ball bearing (illustrative)
      loadFactors = { X: 0.56, Y: 1.6, e: 0.28 };
      equivalentLoad = 1.6 * Fa;
      loadWarning = '深沟球轴承承受纯轴向载荷时需核对接触角变化与最大轴向承载限制，此处仅作教学示例估算。';
    } else {
      const e = 0.28;
      if (Fa / Fr <= e) {
        loadFactors = { X: 1, Y: 0, e };
        equivalentLoad = Fr;
      } else {
        loadFactors = { X: 0.56, Y: 1.55, e };
        equivalentLoad = 0.56 * Fr + 1.55 * Fa;
      }
    }
  } else if (p.bearingType === 'tapered-roller') {
    const e = 1.5 * Math.tan(g.contactAngleRad);
    const Y = 0.4 / Math.tan(g.contactAngleRad);
    if (Fr === 0 && Fa === 0) {
      loadWarning = '当前载荷为 0 kN，不计算有限疲劳寿命。';
    } else if (Fr === 0) {
      loadFactors = { X: 0.4, Y, e };
      equivalentLoad = Y * Fa;
    } else if (Fa / Fr <= e) {
      loadFactors = { X: 1, Y: 0, e };
      equivalentLoad = Fr;
    } else {
      loadFactors = { X: 0.4, Y, e };
      equivalentLoad = 0.4 * Fr + Y * Fa;
    }
  }

  let l10MillionRev = null;
  let l10Hours = null;
  if (loadValid && equivalentLoad !== null && equivalentLoad > 0) {
    l10MillionRev = (C / equivalentLoad) ** info.lifeExponent;
    if (innerRPM > 0) {
      l10Hours = (1e6 / (60 * innerRPM)) * l10MillionRev;
    } else if (!loadWarning) {
      loadWarning = '当前内圈静止（nᵢ = 0 r/min），按百万转计的 L10 仍可参考，但不换算运行小时寿命 L10h。';
    }
  }

  return {
    bearingType: p.bearingType,
    typeName: info.name,
    kind: info.kind,
    separable: info.separable,
    lifeExponent: info.lifeExponent,
    innerRPM,
    cageRPM,
    cageRatio,
    elementSpinRPM,
    elementSpinRatio,
    ftfHz,
    bpfoHz,
    bpfiHz,
    bsfHz,
    pitchSpeed,
    innerContactSpeed,
    radialLoad: Fr,
    axialLoad: Fa,
    dynamicRatingC: C,
    equivalentLoad,
    loadFactors,
    loadValid,
    l10MillionRev,
    l10Hours,
    warning: loadWarning,
    geometry: g,
  };
}

export function motion(p, elapsedSeconds, speed = 1) {
  const g = geometry(p);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || !Number.isFinite(speed) || speed < 0) {
    throw new RangeError('无效演示时间或速度');
  }
  const { cageRatio, elementSpinRatio } = kinematicsRatios(g);
  const innerAngle = elapsedSeconds * ((p.innerRPM * Math.PI) / 30) * speed * ANIMATION_SCALE;
  const cageAngle = innerAngle * cageRatio;
  const elementSpinAngle = innerAngle * elementSpinRatio;
  return {
    innerAngle: innerAngle === 0 ? 0 : innerAngle,
    cageAngle: cageAngle === 0 ? 0 : cageAngle,
    elementSpinAngle: elementSpinAngle === 0 ? 0 : elementSpinAngle,
  };
}
