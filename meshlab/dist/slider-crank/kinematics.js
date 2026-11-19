export const DEFAULTS = Object.freeze({ radius: 40, rodLength: 140, rpm: 30 });

export const LIMITS = Object.freeze({
  radius: Object.freeze({ min: 20, max: 70 }),
  rodLength: Object.freeze({ min: 120, max: 240 }),
  rpm: Object.freeze({ min: 5, max: 60 }),
});

/**
 * In-line slider crank with its fixed pivot at the origin and slider on +X.
 * Lengths are millimetres, angle is radians, omega is radians per second.
 * Displacement starts at the inner dead centre (rodLength - radius).
 * rodAngle points from the crank pin toward the slider pin.
 */
export function poseAt({ radius, rodLength, angle, omega }) {
  if (![radius, rodLength, angle, omega].every(Number.isFinite)) {
    throw new TypeError('Slider-crank inputs must be finite numbers.');
  }
  if (radius <= 0 || rodLength <= radius) {
    throw new RangeError('Require radius > 0 and rodLength > radius.');
  }

  const crankX = radius * Math.cos(angle);
  const crankY = radius * Math.sin(angle);
  const rodProjection = Math.sqrt(rodLength ** 2 - crankY ** 2);
  const sliderX = crankX + rodProjection;
  const displacement = sliderX - (rodLength - radius);
  const velocity = -omega * crankY * (1 + crankX / rodProjection);
  const rodAngle = Math.atan2(-crankY, rodProjection);

  return { crankX, crankY, sliderX, displacement, velocity, rodAngle };
}

/** Vertical piston; theta is clockwise from +Y and s is downward from TDC. */
export function pistonPoseAt(input) {
  const horizontal = poseAt(input);
  const crankX = horizontal.crankY;
  const crankY = horizontal.crankX;
  const pistonY = horizontal.sliderX;
  const stroke = 2 * input.radius;
  return {
    crankX, crankY, pistonY, stroke,
    tdcY: input.rodLength + input.radius,
    bdcY: input.rodLength - input.radius,
    displacement: stroke - horizontal.displacement,
    velocity: -horizontal.velocity,
    rodAngle: Math.atan2(pistonY - crankY, -crankX),
  };
}
