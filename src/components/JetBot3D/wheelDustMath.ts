import { EnvironmentMap } from '../../types/robot';

export interface WheelDustSpawnInput {
  isDriving: boolean;
  linearVel: number;
  angularVel: number;
  isBraking?: boolean;
  environmentMap: EnvironmentMap;
}

export interface WheelDustSpawnPlan {
  shouldEmit: boolean;
  speedMag: number;
  intensity: number; // 0..1
  spawnInterval: number; // seconds between emissions
  puffsPerWheel: number; // 1 in cruise, 2 in turbo / heavy turn / brake
  ejectSpeedScale: number;
  sizeScale: number;
  gravity: number;
}

export interface DustParticleVisual {
  scale: number;
  alpha: number;
}

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

export function computeWheelDustSpawnParams(input: WheelDustSpawnInput): WheelDustSpawnPlan {
  const { isDriving, linearVel, angularVel, isBraking = false, environmentMap } = input;
  const gravity = environmentMap === 'mars-planet' ? 0.08 : 0.14;

  if (!isDriving) {
    return {
      shouldEmit: false,
      speedMag: 0,
      intensity: 0,
      spawnInterval: 0.1,
      puffsPerWheel: 0,
      ejectSpeedScale: 0,
      sizeScale: 1,
      gravity,
    };
  }

  const speedMag = Math.hypot(linearVel, angularVel * 0.14);
  const isMoving = speedMag > 0.025;
  const shouldEmit = isMoving || (isBraking && speedMag > 0.01);

  if (!shouldEmit) {
    return {
      shouldEmit: false,
      speedMag,
      intensity: 0,
      spawnInterval: 0.1,
      puffsPerWheel: 0,
      ejectSpeedScale: 0,
      sizeScale: 1,
      gravity,
    };
  }

  const baseNorm = clamp01(speedMag / 1.1);
  const intensity = clamp01(baseNorm + (isBraking ? 0.28 : 0));
  const isHighKick = intensity >= 0.65 || isBraking;

  // Faster emission in Turbo/braking while keeping total pool light for high FPS
  const spawnInterval = Math.max(0.024, 0.068 - intensity * 0.042);
  const puffsPerWheel = isHighKick ? 2 : 1;
  const ejectSpeedScale = 0.38 + intensity * 0.55;
  const sizeScale = 0.88 + intensity * 0.48;

  return {
    shouldEmit: true,
    speedMag,
    intensity,
    spawnInterval,
    puffsPerWheel,
    ejectSpeedScale,
    sizeScale,
    gravity,
  };
}

export function computeDustParticleVisual(
  progress: number,
  initialSize: number,
  maxSize: number,
  peakOpacity = 0.55
): DustParticleVisual {
  const t = clamp01(progress);
  // Rapid bloom early, gentle widening late
  const expandCurve = 1 - Math.pow(1 - t, 2.2);
  const scale = initialSize + (maxSize - initialSize) * expandCurve;

  // Smooth fade-in over first 18% of life, then clean dissolve to 0
  const fadeIn = clamp01(t / 0.18);
  const fadeOut = Math.max(0, 1 - Math.pow(t, 1.45));
  const alpha = peakOpacity * fadeIn * fadeOut;

  return { scale, alpha };
}
