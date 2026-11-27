import * as THREE from 'three';
import { EnvironmentMap } from '../../types/robot';
import { DriveEffectTelemetry } from './driveEffectsMath';

const MAX_TIRE_TRACKS = 260; // 130 left+right pairs, 1 InstancedMesh draw call
const TRACK_EMIT_DISTANCE = 0.046; // closer spacing for smoother rover tracks
const TRACK_MAX_AGE = 10.0; // seconds before fading away

// Pre-allocated scratch math helpers (Zero GC inside render loop)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

interface TireTrackSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  age: number;
  baseColor: THREE.Color;
}

function createTireTreadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 64, 64);

  const edgeGrad = ctx.createLinearGradient(0, 0, 64, 0);
  edgeGrad.addColorStop(0, 'rgba(255,255,255,0)');
  edgeGrad.addColorStop(0.16, 'rgba(255,255,255,0.85)');
  edgeGrad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  edgeGrad.addColorStop(0.84, 'rgba(255,255,255,0.85)');
  edgeGrad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = edgeGrad;
  // Continuous shoulder lugs + slanted chevron treads
  ctx.fillRect(6, 0, 18, 12);
  ctx.fillRect(40, 6, 18, 12);
  ctx.fillRect(6, 20, 18, 12);
  ctx.fillRect(40, 26, 18, 12);
  ctx.fillRect(6, 42, 18, 12);
  ctx.fillRect(40, 48, 18, 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface DriveEffectsSystem {
  worldGroup: THREE.Group;
  robotGroup: THREE.Group;
  update: (params: {
    delta: number;
    elapsed: number;
    isDriveMode: boolean;
    robotX: number;
    terrainElev: number;
    robotZ: number;
    robotHeading: number;
    terrainPitch: number;
    terrainRoll: number;
    modelScale: number;
    environmentMap: EnvironmentMap;
    telemetry: DriveEffectTelemetry;
    getGroundY?: (x: number, z: number) => number;
  }) => void;
  reset: () => void;
  dispose: () => void;
}

export function createDriveEffectsSystem(_isSoftwareGl: boolean): DriveEffectsSystem {
  const worldGroup = new THREE.Group();
  worldGroup.name = 'DriveEffectsWorld';

  const robotGroup = new THREE.Group();
  robotGroup.name = 'DriveEffectsRobot';

  // ============================================================================
  // WORLD-SPACE GROUND TIRE TRACKS (Single InstancedMesh)
  // ============================================================================
  const treadTex = createTireTreadTexture();
  const trackGeo = new THREE.PlaneGeometry(0.044, 0.072);
  trackGeo.rotateX(-Math.PI / 2);

  const trackMat = new THREE.MeshBasicMaterial({
    map: treadTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const trackMesh = new THREE.InstancedMesh(trackGeo, trackMat, MAX_TIRE_TRACKS);
  trackMesh.frustumCulled = false;
  trackMesh.renderOrder = 2;

  const trackSlots: TireTrackSlot[] = [];
  for (let i = 0; i < MAX_TIRE_TRACKS; i++) {
    trackSlots.push({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      age: 0,
      baseColor: new THREE.Color(0x521d0f),
    });
    _pos.set(0, -100, 0);
    _quat.identity();
    _scale.set(0, 0, 0);
    _mat4.compose(_pos, _quat, _scale);
    trackMesh.setMatrixAt(i, _mat4);
    trackMesh.setColorAt(i, _color.setHex(0x521d0f));
  }
  trackMesh.instanceMatrix.needsUpdate = true;
  if (trackMesh.instanceColor) trackMesh.instanceColor.needsUpdate = true;
  worldGroup.add(trackMesh);

  let nextTrackIndex = 0;
  let hasLastEmitPos = false;
  let lastEmitX = 0;
  let lastEmitZ = 0;
  let lastEmitHeading = 0;

  const stampTrackPair = (
    robotX: number,
    terrainElev: number,
    robotZ: number,
    robotHeading: number,
    terrainPitch: number,
    terrainRoll: number,
    modelScale: number,
    env: EnvironmentMap,
    getGroundY?: (x: number, z: number) => number
  ) => {
    const wheelHalfW = 0.138 * modelScale;
    const cosH = Math.cos(robotHeading);
    const sinH = Math.sin(robotHeading);

    const leftX = robotX - cosH * wheelHalfW;
    const leftZ = robotZ + sinH * wheelHalfW;
    const rightX = robotX + cosH * wheelHalfW;
    const rightZ = robotZ - sinH * wheelHalfW;

    const hex = env === 'mars-planet' ? 0x4b1b0e : 0x1e293b;

    const coords: [number, number][] = [
      [leftX, leftZ],
      [rightX, rightZ],
    ];

    for (const [tx, tz] of coords) {
      const slot = trackSlots[nextTrackIndex];
      nextTrackIndex = (nextTrackIndex + 1) % MAX_TIRE_TRACKS;
      slot.active = true;
      slot.x = tx;
      slot.y = (getGroundY ? getGroundY(tx, tz) : terrainElev) + 0.008;
      slot.z = tz;
      slot.heading = robotHeading;
      slot.pitch = terrainPitch;
      slot.roll = terrainRoll;
      slot.age = 0;
      slot.baseColor.setHex(hex);
    }
  };

  const update: DriveEffectsSystem['update'] = ({
    delta,
    isDriveMode,
    robotX,
    terrainElev,
    robotZ,
    robotHeading,
    terrainPitch,
    terrainRoll,
    modelScale,
    environmentMap,
    telemetry,
    getGroundY,
  }) => {
    worldGroup.visible = isDriveMode;
    robotGroup.visible = false;

    if (!isDriveMode) {
      return;
    }

    if (telemetry.isMoving) {
      if (!hasLastEmitPos) {
        hasLastEmitPos = true;
        lastEmitX = robotX;
        lastEmitZ = robotZ;
        lastEmitHeading = robotHeading;
      } else {
        const distMoved = Math.hypot(robotX - lastEmitX, robotZ - lastEmitZ);
        const turnMoved = Math.abs(robotHeading - lastEmitHeading);
        if (distMoved >= TRACK_EMIT_DISTANCE || turnMoved >= 0.36) {
          stampTrackPair(
            robotX,
            terrainElev,
            robotZ,
            robotHeading,
            terrainPitch,
            terrainRoll,
            modelScale,
            environmentMap,
            getGroundY
          );
          lastEmitX = robotX;
          lastEmitZ = robotZ;
          lastEmitHeading = robotHeading;
        }
      }
    }

    let trackDirty = false;
    for (let i = 0; i < MAX_TIRE_TRACKS; i++) {
      const slot = trackSlots[i];
      if (!slot.active) continue;
      trackDirty = true;
      slot.age += delta;
      if (slot.age >= TRACK_MAX_AGE) {
        slot.active = false;
        _pos.set(0, -100, 0);
        _quat.identity();
        _scale.set(0, 0, 0);
        _mat4.compose(_pos, _quat, _scale);
        trackMesh.setMatrixAt(i, _mat4);
        continue;
      }

      const lifeFrac = slot.age / TRACK_MAX_AGE;
      const fade = Math.max(0, 1 - Math.pow(lifeFrac, 1.5));
      const widthScale = modelScale * (0.95 + fade * 0.08);

      _pos.set(slot.x, slot.y, slot.z);
      _euler.set(slot.pitch, slot.heading, slot.roll, 'YXZ');
      _quat.setFromEuler(_euler);
      _scale.set(widthScale, 1, modelScale * fade);
      _mat4.compose(_pos, _quat, _scale);
      trackMesh.setMatrixAt(i, _mat4);

      _color.copy(slot.baseColor).multiplyScalar(0.5 + fade * 0.5);
      trackMesh.setColorAt(i, _color);
    }

    if (trackDirty) {
      trackMesh.instanceMatrix.needsUpdate = true;
      if (trackMesh.instanceColor) trackMesh.instanceColor.needsUpdate = true;
    }
  };

  const reset = () => {
    hasLastEmitPos = false;
    nextTrackIndex = 0;
    for (let i = 0; i < MAX_TIRE_TRACKS; i++) {
      trackSlots[i].active = false;
      trackSlots[i].age = 0;
      _pos.set(0, -100, 0);
      _quat.identity();
      _scale.set(0, 0, 0);
      _mat4.compose(_pos, _quat, _scale);
      trackMesh.setMatrixAt(i, _mat4);
    }
    trackMesh.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    trackGeo.dispose();
    trackMat.dispose();
    treadTex.dispose();
  };

  return {
    worldGroup,
    robotGroup,
    update,
    reset,
    dispose,
  };
}

