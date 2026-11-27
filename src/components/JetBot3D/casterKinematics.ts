export interface CasterWheelState {
  swivelAngle: number; // Fork Y rotation (radians). 0 => forward (+Z), trailing wheel behind (-Z)
  rollAngle: number;   // Roller X rotation (radians). Positive => forward roll
}

export function normalizeAngleSigned(angle: number): number {
  let r = (angle + Math.PI) % (2 * Math.PI);
  if (r < 0) r += 2 * Math.PI;
  return r - Math.PI;
}

/**
 * Physically accurate, damped trailing-caster kinematics for JetBot.
 * Robot local coordinates: +Z forward, +X left, +angularVel turns nose (+Z) toward +X.
 *
 * At mount position (0, 0, casterZ):
 *   v_x = angularVel * casterZ
 *   v_z = linearVel
 *
 * The caster fork's +Z axis aligns smoothly toward (v_x, v_z) so the trailing
 * wheel at -Z_fork trails naturally behind the pivot for forward, turning,
 * spin-in-place, and reverse maneuvers.
 */
export function stepCasterKinematics(
  prev: CasterWheelState,
  linearVel: number,
  angularVel: number,
  casterZ: number,
  rollerRadius: number,
  delta: number
): CasterWheelState {
  const dt = Math.max(0, Math.min(0.1, delta));
  const vx = angularVel * casterZ;
  const vz = linearVel;
  const speed = Math.hypot(vx, vz);

  let nextSwivel = prev.swivelAngle;

  if (speed > 0.004 && dt > 0) {
    const targetAngle = Math.atan2(vx, vz);
    const diff = normalizeAngleSigned(targetAngle - prev.swivelAngle);
    const rate = 5.0 + Math.min(10.0, speed * 12.0);
    const alpha = 1 - Math.exp(-rate * dt);
    const maxStep = (7.5 + speed * 10.0) * dt;
    const rawStep = diff * alpha;
    const clampedStep =
      Math.abs(rawStep) > maxStep ? Math.sign(rawStep) * maxStep : rawStep;
    nextSwivel = normalizeAngleSigned(prev.swivelAngle + clampedStep);
  }

  // Ground velocity projected onto the caster roller's current rolling plane
  const rollVel = vx * Math.sin(nextSwivel) + vz * Math.cos(nextSwivel);
  const nextRoll =
    dt > 0 ? prev.rollAngle + (rollVel / Math.max(0.005, rollerRadius)) * dt : prev.rollAngle;

  return {
    swivelAngle: nextSwivel,
    rollAngle: nextRoll,
  };
}
