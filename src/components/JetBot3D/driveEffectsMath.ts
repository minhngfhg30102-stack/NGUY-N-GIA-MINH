export type DriveEffectMode = 'idle' | 'cruise' | 'turbo' | 'brake' | 'reverse';

export interface DriveEffectInput {
  isDriving: boolean;
  linearVel: number;
  angularVel: number;
  prevLinearVel: number;
  isBraking?: boolean;
  delta: number;
}

export interface DriveEffectTelemetry {
  mode: DriveEffectMode;
  speedAbs: number;
  speedNorm: number; // 0..1 relative to turbo max (~1.1 m/s)
  isMoving: boolean;
  isTurbo: boolean;
  isReversing: boolean;
  isBraking: boolean;
  headlightIntensity: number; // 0..1
  brakeIntensity: number; // 0..1
  reverseIntensity: number; // 0..1
  cruiseGlowIntensity: number; // 0..1
  underglowIntensity: number; // 0..1
  turboStreakIntensity: number; // 0..1
  targetCameraFov: number; // 45..50.5
}

export const BASE_DRIVE_CAMERA_FOV = 45;
export const MAX_TURBO_CAMERA_FOV = 50.5;
export const TURBO_SPEED_THRESHOLD = 0.72; // m/s (Normal = 0.55, Turbo = 1.10)

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

export function computeDriveEffectTelemetry(input: DriveEffectInput): DriveEffectTelemetry {
  const { isDriving, linearVel, angularVel, prevLinearVel, delta } = input;

  if (!isDriving) {
    return {
      mode: 'idle',
      speedAbs: 0,
      speedNorm: 0,
      isMoving: false,
      isTurbo: false,
      isReversing: false,
      isBraking: false,
      headlightIntensity: 0,
      brakeIntensity: 0,
      reverseIntensity: 0,
      cruiseGlowIntensity: 0,
      underglowIntensity: 0,
      turboStreakIntensity: 0,
      targetCameraFov: BASE_DRIVE_CAMERA_FOV,
    };
  }

  const speedAbs = Math.abs(linearVel);
  const effectiveMotion = Math.hypot(linearVel, angularVel * 0.14);
  const isMoving = effectiveMotion > 0.025;
  const isReversing = linearVel < -0.025;
  const isTurbo = speedAbs >= TURBO_SPEED_THRESHOLD || Math.abs(angularVel) >= 2.25;

  // Detect active braking: explicit brake flag or sharp deceleration toward zero
  const safeDelta = Math.max(delta, 0.008);
  const decelRate = (Math.abs(prevLinearVel) - speedAbs) / safeDelta;
  const isBraking =
    Boolean(input.isBraking) ||
    (Math.abs(prevLinearVel) > 0.18 && decelRate > 0.9 && speedAbs < Math.abs(prevLinearVel));

  const speedNorm = clamp01(effectiveMotion / 1.1);
  const turboFovFrac = isTurbo
    ? clamp01((speedAbs - 0.65) / 0.45 + (Math.abs(angularVel) >= 2.25 ? 0.35 : 0))
    : 0;

  let mode: DriveEffectMode = 'idle';
  if (isBraking) {
    mode = 'brake';
  } else if (isReversing) {
    mode = 'reverse';
  } else if (isTurbo && isMoving) {
    mode = 'turbo';
  } else if (isMoving) {
    mode = 'cruise';
  }

  const headlightIntensity = 0;
  const brakeIntensity = isBraking ? 1.0 : !isMoving ? 0.22 : 0;
  const reverseIntensity = isReversing && !isBraking ? clamp01(0.65 + speedNorm * 0.35) : 0;
  const cruiseGlowIntensity = isMoving && !isBraking && !isReversing ? clamp01(0.55 + speedNorm * 0.45) : 0;
  const underglowIntensity = 0;
  const turboStreakIntensity = 0;

  const targetCameraFov =
    BASE_DRIVE_CAMERA_FOV +
    (MAX_TURBO_CAMERA_FOV - BASE_DRIVE_CAMERA_FOV) * clamp01(turboFovFrac * 0.85 + (isTurbo ? 0.15 : 0));

  return {
    mode,
    speedAbs,
    speedNorm,
    isMoving,
    isTurbo,
    isReversing,
    isBraking,
    headlightIntensity,
    brakeIntensity,
    reverseIntensity,
    cruiseGlowIntensity,
    underglowIntensity,
    turboStreakIntensity,
    targetCameraFov,
  };
}

export function stepImpactTrauma(currentTrauma: number, impactImpulse: number, delta: number): number {
  const next = Math.min(1, Math.max(0, currentTrauma) + Math.max(0, impactImpulse));
  const decayed = next - Math.max(0, delta) * 2.1;
  return decayed > 0 ? decayed : 0;
}
