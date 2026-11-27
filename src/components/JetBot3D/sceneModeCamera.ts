import { ViewPreset } from '../../types/robot';

export type Vec3Tuple = [number, number, number];

export interface InspectCameraSnapshot {
  position: Vec3Tuple;
  target: Vec3Tuple;
}

export interface DriveCameraSnapshot {
  orbitOffset: Vec3Tuple;
  followDistance: number;
  followHeight: number;
  hasCustomOrbit: boolean;
}

export const INSPECT_DEFAULT_DISTANCE_MIN = 0.05;
export const INSPECT_DEFAULT_DISTANCE_MAX = 3.2;

export const DRIVE_DEFAULT_DISTANCE_MIN = 0.25;
export const DRIVE_DEFAULT_DISTANCE_MAX = 16.0;

export function createInitialInspectCamera(): InspectCameraSnapshot {
  return {
    position: [0.68, 0.44, 0.68],
    target: [0, 0.16, 0],
  };
}

export function createInitialDriveCamera(): DriveCameraSnapshot {
  return {
    followDistance: 1.15,
    followHeight: 0.75,
    hasCustomOrbit: false,
    orbitOffset: [0, 0.61, -1.15],
  };
}

export function computeDriveTarget(
  robotX: number,
  terrainElev: number,
  robotZ: number
): Vec3Tuple {
  return [robotX, 0.14 + terrainElev, robotZ];
}

export function computeDefaultDriveCameraPosition(
  robotX: number,
  terrainElev: number,
  robotZ: number,
  robotHeading: number,
  followDistance: number,
  followHeight: number
): Vec3Tuple {
  return [
    robotX - Math.sin(robotHeading) * followDistance,
    followHeight + terrainElev,
    robotZ - Math.cos(robotHeading) * followDistance,
  ];
}

export function captureDriveOrbitOffset(
  cameraPos: Vec3Tuple,
  targetPos: Vec3Tuple
): Vec3Tuple {
  return [
    cameraPos[0] - targetPos[0],
    cameraPos[1] - targetPos[1],
    cameraPos[2] - targetPos[2],
  ];
}

export function computeRestoredDriveCamera(
  snapshot: DriveCameraSnapshot,
  robotX: number,
  terrainElev: number,
  robotZ: number,
  robotHeading: number
): { position: Vec3Tuple; target: Vec3Tuple } {
  const target = computeDriveTarget(robotX, terrainElev, robotZ);

  if (snapshot.hasCustomOrbit) {
    return {
      target,
      position: [
        target[0] + snapshot.orbitOffset[0],
        Math.max(terrainElev + 0.12, target[1] + snapshot.orbitOffset[1]),
        target[2] + snapshot.orbitOffset[2],
      ],
    };
  }

  return {
    target,
    position: computeDefaultDriveCameraPosition(
      robotX,
      terrainElev,
      robotZ,
      robotHeading,
      snapshot.followDistance,
      snapshot.followHeight
    ),
  };
}

export function computeInspectPresetPose(preset: ViewPreset): InspectCameraSnapshot {
  if (preset === 'top') {
    return { position: [0.001, 0.65, 0.001], target: [0, 0.12, 0] };
  }
  if (preset === 'front') {
    return { position: [0, 0.22, 0.58], target: [0, 0.14, 0] };
  }
  if (preset === 'bottom') {
    return { position: [0.38, -0.32, 0.38], target: [0, 0.02, 0] };
  }
  if (preset === 'side') {
    return { position: [0.62, 0.22, 0], target: [0, 0.14, 0] };
  }
  return { position: [0.52, 0.36, 0.52], target: [0, 0.14, 0] };
}

export function clampDriveFollowZoom(
  snapshot: DriveCameraSnapshot,
  distanceDelta: number
): DriveCameraSnapshot {
  const nextDist = Math.min(12.5, Math.max(0.35, snapshot.followDistance + distanceDelta));
  const nextHeight = Math.min(
    7.5,
    Math.max(0.22, snapshot.followHeight + distanceDelta * 0.55)
  );
  return {
    ...snapshot,
    followDistance: nextDist,
    followHeight: nextHeight,
  };
}

/**
 * Translates both camera and orbit target equally when JetBot moves or climbs terrain
 * so user camera orbit angle stays completely undisturbed while driving.
 */
export function computeDisplacedDriveCamera(
  cameraPos: Vec3Tuple,
  robotX: number,
  terrainElev: number,
  robotZ: number,
  prevRobotX: number,
  prevTerrainElev: number,
  prevRobotZ: number
): { position: Vec3Tuple; target: Vec3Tuple; orbitOffset: Vec3Tuple } {
  const dx = robotX - prevRobotX;
  const dy = terrainElev - prevTerrainElev;
  const dz = robotZ - prevRobotZ;
  const position: Vec3Tuple = [cameraPos[0] + dx, cameraPos[1] + dy, cameraPos[2] + dz];
  const target: Vec3Tuple = computeDriveTarget(robotX, terrainElev, robotZ);
  return {
    position,
    target,
    orbitOffset: captureDriveOrbitOffset(position, target),
  };
}

/**
 * Applies spherical orbit rotation around the current target (used when Shift+drag is
 * performed in Drive Mode where OrbitControls' built-in shift->pan shortcut would otherwise ignore drag).
 */
export function computeRotatedOrbitOffset(
  offset: Vec3Tuple,
  deltaAzimuthRad: number,
  deltaPolarRad: number,
  minPolarAngle: number = 0.06,
  maxPolarAngle: number = Math.PI * 0.48
): Vec3Tuple {
  const [x, y, z] = offset;
  const radius = Math.hypot(x, y, z);
  if (radius < 1e-5) {
    return offset;
  }
  const currentTheta = Math.atan2(x, z);
  const currentPhi = Math.acos(Math.max(-1, Math.min(1, y / radius)));

  const nextTheta = currentTheta + deltaAzimuthRad;
  const nextPhi = Math.max(minPolarAngle, Math.min(maxPolarAngle, currentPhi + deltaPolarRad));

  const sinPhiRadius = Math.sin(nextPhi) * radius;
  return [
    sinPhiRadius * Math.sin(nextTheta),
    Math.cos(nextPhi) * radius,
    sinPhiRadius * Math.cos(nextTheta),
  ];
}

