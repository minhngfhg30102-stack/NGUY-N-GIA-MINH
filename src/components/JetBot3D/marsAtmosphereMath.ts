export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

/**
 * Shared normalized Martian solar direction used to align the Sky Dome Mie aureole,
 * the celestial Sun disk, and the terrain DirectionalLight shadow caster.
 */
export const MARS_SUN_DIRECTION: Vec3Tuple = (() => {
  const rx = 0.44;
  const ry = 0.31;
  const rz = -0.84;
  const len = Math.hypot(rx, ry, rz);
  return { x: rx / len, y: ry / len, z: rz / len };
})();

/**
 * Color & atmospheric constants calibrated so the outer Martian crater wall blends
 * seamlessly into the Sky Dome's lower butterscotch horizon band without any dust storm haze.
 */
export const MARS_ATMOSPHERE_PALETTE = {
  zenithColorHex: 0x050814,
  midSkyColorHex: 0x2d1f2b,
  horizonColorHex: 0x87472d,
  groundBounceHex: 0x2a1109,
  fogColorHex: 0x7c412a,
  fogDensity: 0.008,
  keyLightHex: 0xffe4c4,
  keyLightIntensity: 3.1,
  hemiSkyHex: 0x6f84b4,
  hemiGroundHex: 0x6e2d16,
  hemiIntensity: 0.92,
  rimLightHex: 0x93c5fd,
  rimIntensity: 0.72,
} as const;

/**
 * Periodic continuous height function for the 360-degree outer Martian crater rim & mountain wall.
 * Guarantees seamless wrap-around at theta = 0 / 2*PI so there is zero geometric crack on the horizon.
 */
export function computeCraterRimHeight(theta: number, radialFrac: number): number {
  const clampedFrac = Math.max(0, Math.min(1, radialFrac));
  if (clampedFrac <= 0) return 0;

  // Integer harmonics guarantee f(0) === f(2*PI)
  const broadPeaks =
    0.55 +
    0.26 * Math.sin(theta * 3 + 0.6) +
    0.19 * Math.cos(theta * 5 - 1.1) +
    0.14 * Math.sin(theta * 8 + 2.2) +
    0.08 * Math.cos(theta * 13 + 0.4);

  const ridgeEnvelope = Math.pow(clampedFrac, 1.35);
  // Slight eroded terraced plateau near the outer crest
  const crestDrop = clampedFrac > 0.85 ? (clampedFrac - 0.85) * 4.5 : 0;
  return Math.max(0, (4.2 + broadPeaks * 7.8) * ridgeEnvelope - crestDrop);
}

/**
 * Computes dusty ochre settlement factor [0..1] on upward-facing rock surfaces.
 */
export function computeRockDustBlend(normalY: number): number {
  const clamped = Math.max(0, Math.min(1, (normalY - 0.15) / 0.75));
  return clamped * clamped * (3 - 2 * clamped);
}

export interface MarsCraterSpec {
  x: number;
  z: number;
  r: number;
  h: number;
}

export const MARS_CRATER_SPECS: readonly MarsCraterSpec[] = [
  { x: 5.8, z: 0.6, r: 1.35, h: 0.16 },
  { x: -5.8, z: 4.4, r: 1.45, h: 0.18 },
  { x: 4.6, z: -5.8, r: 1.55, h: 0.19 },
  { x: -1.6, z: -8.4, r: 1.3, h: 0.15 },
  { x: 6.4, z: 5.2, r: 1.25, h: 0.15 },
  { x: -0.4, z: -6.2, r: 1.25, h: 0.15 },
];

export interface MarsClimbMoundSpec {
  x: number;
  z: number;
  radius: number;
  height: number;
}

/**
 * Generates radial [radius, y] profile points for THREE.LatheGeometry ordered from outer
 * skirt inward to the crater center so triangles wind counter-clockwise with upward (+Y) normals.
 */
export function buildMarsCraterProfilePoints(
  radius: number,
  height: number
): Array<[number, number]> {
  return [
    [radius * 1.08, 0.0],
    [radius * 0.96, height * 0.14],
    [radius * 0.84, height * 0.72],
    [radius * 0.74, height],
    [radius * 0.62, 0.045],
    [radius * 0.42, 0.003],
    [0.0, 0.002],
  ];
}

/**
 * Evaluates exact surface Y height of a single Martian impact crater at local offset (dx, dz),
 * matching both the 3D rendered crater mesh and physical rover climbing elevation 1:1.
 */
export function sampleSingleMarsCraterHeight(
  dx: number,
  dz: number,
  radius: number,
  height: number,
  craterIdx: number
): number {
  const dist = Math.hypot(dx, dz);
  if (dist >= radius * 1.08) return 0;

  const profile = buildMarsCraterProfilePoints(radius, height);
  let baseY = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    if (dist <= r0 && dist >= r1) {
      const span = Math.max(1e-6, r0 - r1);
      const t = (r0 - dist) / span;
      baseY = y0 + (y1 - y0) * t;
      break;
    }
  }

  if (baseY > 0.005) {
    const ang = Math.atan2(dz, dx);
    const edgeTaper = Math.max(
      0,
      Math.min(1, 1.0 - Math.max(0, dist - radius * 0.85) / (radius * 0.25))
    );
    const rimWave =
      (Math.sin(ang * 5 + craterIdx * 1.7) * 0.12 +
        Math.cos(ang * 9 - craterIdx) * 0.07) *
      edgeTaper;
    return Math.max(0.001, baseY * (1.0 + rimWave * 0.35));
  }

  return Math.max(0.001, baseY);
}

/**
 * Computes climbable Martian surface height at world (x, z) across sand mounds,
 * raised impact crater rims, and the octagonal spaceship landing apron.
 */
export function sampleMarsTerrainPointElevation(
  x: number,
  z: number,
  mounds: readonly MarsClimbMoundSpec[]
): number {
  let maxElev = 0;

  for (let i = 0; i < mounds.length; i++) {
    const m = mounds[i];
    const dist = Math.hypot(x - m.x, z - m.z);
    if (dist < m.radius) {
      const frac = dist / m.radius;
      const elev = m.height * 0.5 * (1 + Math.cos(frac * Math.PI));
      if (elev > maxElev) maxElev = elev;
    }
  }

  for (let i = 0; i < MARS_CRATER_SPECS.length; i++) {
    const c = MARS_CRATER_SPECS[i];
    const elev = sampleSingleMarsCraterHeight(x - c.x, z - c.z, c.r, c.h, i);
    if (elev > maxElev) maxElev = elev;
  }

  // Spaceship octagonal concrete blast pad at (-4.8, -4.2), height 0.04m with smooth entry ramp
  const padDist = Math.hypot(x - -4.8, z - -4.2);
  if (padDist < 3.45) {
    const padElev =
      padDist <= 3.05
        ? 0.04
        : 0.04 * (1 - (padDist - 3.05) / 0.4);
    if (padElev > maxElev) maxElev = padElev;
  }

  return maxElev;
}

/**
 * Computes rover body elevation, pitch, and roll from a 4-point chassis wheel/caster footprint
 * so JetBot smoothly climbs up and over crater rims & hills without clipping through rim walls.
 */
export function computeChassisTerrainPose(
  x: number,
  z: number,
  heading: number,
  sampleHeightAt: (wx: number, wz: number) => number
): { elevation: number; slopePitch: number; slopeRoll: number } {
  const halfLength = 0.115;
  const halfWidth = 0.125;
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  const hCenter = sampleHeightAt(x, z);
  const hFront = sampleHeightAt(x + sinH * halfLength, z + cosH * halfLength);
  const hRear = sampleHeightAt(x - sinH * halfLength, z - cosH * halfLength);
  const hPlusX = sampleHeightAt(x + cosH * halfWidth, z - sinH * halfWidth);
  const hMinusX = sampleHeightAt(x - cosH * halfWidth, z + sinH * halfWidth);

  const elevation = Math.max(
    hCenter,
    (hFront + hRear) * 0.5,
    (hPlusX + hMinusX) * 0.5
  );
  const forwardSlope = (hFront - hRear) / (halfLength * 2);
  const rightSlope = (hPlusX - hMinusX) / (halfWidth * 2);

  const slopePitch = Math.max(-0.62, Math.min(0.62, -Math.atan(forwardSlope)));
  const slopeRoll = Math.max(-0.62, Math.min(0.62, Math.atan(rightSlope)));

  return { elevation, slopePitch, slopeRoll };
}

/**
 * Generates CCW upward-facing triangle indices connecting concentric terrain rings
 * ordered from inner ring (r = 0) outward to outer ring (r = ringCount - 1).
 */
export function buildEscarpmentQuadIndices(
  ringCount: number,
  angularSegments: number
): number[] {
  const indices: number[] = [];
  for (let r = 0; r < ringCount - 1; r++) {
    const rowStart = r * angularSegments;
    const nextRowStart = (r + 1) * angularSegments;
    for (let s = 0; s < angularSegments; s++) {
      const nextS = (s + 1) % angularSegments;
      const a = rowStart + s;
      const b = rowStart + nextS;
      const c = nextRowStart + s;
      const d = nextRowStart + nextS;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  return indices;
}

export interface MarsGreenhouseSpec {
  x: number;
  z: number;
  collisionRadius: number;
  exclusionRadius: number;
  rotationY: number;
}

/**
 * Placement & collision specification for the Mars Hydroponic Vegetable Greenhouse.
 * Positioned in the clear northeast exploration plain so it is visible from spawn
 * while maintaining wide clearance from all craters, climbable mounds, mountains, and rocks.
 */
export const MARS_GREENHOUSE_SPEC: MarsGreenhouseSpec = {
  x: 2.8,
  z: 8.0,
  collisionRadius: 2.15,
  exclusionRadius: 3.1,
  rotationY: -2.80,
};

/**
 * Keeps moving actors (aliens, astronauts) cleanly outside static pressurized dome perimeters.
 */
export function resolveStaticDomePushout(
  x: number,
  z: number,
  actorRadius: number,
  domeX: number,
  domeZ: number,
  domeRadius: number
): { x: number; z: number; pushed: boolean } {
  const minDist = domeRadius + actorRadius;
  const dx = x - domeX;
  const dz = z - domeZ;
  const dist = Math.hypot(dx, dz);
  if (dist >= minDist) {
    return { x, z, pushed: false };
  }
  if (dist < 1e-5) {
    return { x: domeX, z: domeZ + minDist, pushed: true };
  }
  const scale = minDist / dist;
  return {
    x: domeX + dx * scale,
    z: domeZ + dz * scale,
    pushed: true,
  };
}
