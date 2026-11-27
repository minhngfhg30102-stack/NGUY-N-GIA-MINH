import * as THREE from 'three';
import { EnvironmentMap } from '../../types/robot';
import { computeDustParticleVisual, computeWheelDustSpawnParams } from './wheelDustMath';

interface DustParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  floorY: number;
  life: number;
  maxLife: number;
  initialSize: number;
  maxSize: number;
  peakOpacity: number;
  roll: number;
  rollSpeed: number;
  active: boolean;
  baseR: number;
  baseG: number;
  baseB: number;
}

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

function createSoftDustTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);

  // Organic multi-lobe cloud puff inside radial bounds so particles look like swirling sand/dust, not flat dots
  const lobes: Array<[number, number, number, number]> = [
    [64, 64, 52, 0.72],
    [50, 56, 36, 0.55],
    [78, 58, 34, 0.52],
    [58, 76, 35, 0.5],
    [72, 74, 30, 0.45],
  ];

  for (const [cx, cy, r, alpha] of lobes) {
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.42, `rgba(255, 255, 255, ${alpha * 0.58})`);
    grad.addColorStop(0.8, `rgba(255, 255, 255, ${alpha * 0.14})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface WheelDustSystem {
  group: THREE.Group;
  update: (
    delta: number,
    isDriving: boolean,
    robotX: number,
    robotZ: number,
    robotHeading: number,
    linearVel: number,
    angularVel: number,
    modelScale: number,
    environmentMap: EnvironmentMap,
    terrainElev?: number,
    isBraking?: boolean
  ) => number;
  triggerDigBurst: (x: number, y: number, z: number, count?: number) => void;
  reset: () => void;
  dispose: () => void;
}

export function createWheelDustSystem(isSoftwareGl = false): WheelDustSystem {
  const maxParticles = isSoftwareGl ? 64 : 96;
  const group = new THREE.Group();
  group.name = 'WheelDustSystem';

  const colors = new Float32Array(maxParticles * 3);
  const alphas = new Float32Array(maxParticles);
  const rolls = new Float32Array(maxParticles);

  const particles: DustParticle[] = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push({
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      floorY: 0,
      life: 0,
      maxLife: 0.65,
      initialSize: 0.04,
      maxSize: 0.14,
      peakOpacity: 0.52,
      roll: 0,
      rollSpeed: 0,
      active: false,
      baseR: 0.9,
      baseG: 0.45,
      baseB: 0.2,
    });
  }

  const geometry = new THREE.PlaneGeometry(1, 1);
  const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
  const alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
  const rollAttr = new THREE.InstancedBufferAttribute(rolls, 1);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  rollAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('aColor', colorAttr);
  geometry.setAttribute('aAlpha', alphaAttr);
  geometry.setAttribute('aRoll', rollAttr);

  const texture = createSoftDustTexture();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aAlpha;
      attribute float aRoll;

      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vUv = uv;
        vColor = aColor;
        vAlpha = aAlpha;

        vec4 mvCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float scaleX = length(instanceMatrix[0].xyz);
        float scaleY = length(instanceMatrix[1].xyz);

        float c = cos(aRoll);
        float s = sin(aRoll);
        vec2 rotated = vec2(
          position.x * c - position.y * s,
          position.x * s + position.y * c
        );

        mvCenter.xy += rotated * vec2(scaleX, scaleY);
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;

      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        float alpha = tex.a * vAlpha;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(vColor * tex.rgb, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, maxParticles);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.raycast = () => {};

  _quat.identity();
  for (let i = 0; i < maxParticles; i++) {
    _pos.set(0, -100, 0);
    _scale.set(0, 0, 1);
    _mat4.compose(_pos, _quat, _scale);
    mesh.setMatrixAt(i, _mat4);
    alphas[i] = 0;
  }
  mesh.instanceMatrix.needsUpdate = true;
  alphaAttr.needsUpdate = true;

  group.add(mesh);

  let spawnTimer = 0;
  let nextIndex = 0;

  const spawnParticleAt = (
    spawnX: number,
    spawnY: number,
    spawnZ: number,
    ejectVx: number,
    ejectVz: number,
    intensity: number,
    sizeScale: number,
    env: EnvironmentMap
  ) => {
    const p = particles[nextIndex];
    nextIndex = (nextIndex + 1) % maxParticles;

    p.active = true;
    p.life = 0;
    p.floorY = spawnY;
    p.maxLife = 0.42 + Math.random() * 0.28 + intensity * 0.26;

    // Ground patch jitter
    p.x = spawnX + (Math.random() - 0.5) * 0.022;
    p.y = spawnY + 0.016 + Math.random() * 0.012;
    p.z = spawnZ + (Math.random() - 0.5) * 0.022;

    // Ejection velocity kicking backward and slightly outward from tires
    p.vx = ejectVx + (Math.random() - 0.5) * (0.14 + intensity * 0.14);
    p.vz = ejectVz + (Math.random() - 0.5) * (0.14 + intensity * 0.14);
    p.vy = 0.07 + Math.random() * 0.08 + intensity * 0.12;

    // Smooth cloud puff bloom sizes (visible at follow-camera distance without obscuring robot)
    p.initialSize = (0.042 + Math.random() * 0.018) * sizeScale;
    p.maxSize = (0.125 + Math.random() * 0.055 + intensity * 0.045) * sizeScale;
    p.peakOpacity = env === 'mars-planet' ? 0.46 + intensity * 0.16 : 0.36 + intensity * 0.14;
    p.roll = Math.random() * Math.PI * 2;
    p.rollSpeed = (Math.random() - 0.5) * 2.4;

    if (env === 'mars-planet') {
      // Martian regolith tones: sun-lit apricot sand, terracotta ochre, and burnt rust
      const tone = Math.random();
      if (tone > 0.62) {
        p.baseR = 0.96;
        p.baseG = 0.56 + Math.random() * 0.1;
        p.baseB = 0.32 + Math.random() * 0.08;
      } else if (tone > 0.25) {
        p.baseR = 0.89;
        p.baseG = 0.42 + Math.random() * 0.08;
        p.baseB = 0.21 + Math.random() * 0.05;
      } else {
        p.baseR = 0.98;
        p.baseG = 0.72;
        p.baseB = 0.46;
      }
    } else {
      // CMU Arena: clean slate/rubber indoor track puff
      const gray = 0.68 + Math.random() * 0.2;
      p.baseR = gray * 0.95;
      p.baseG = gray * 0.98;
      p.baseB = Math.min(1, gray * 1.04);
    }
  };

  const update: WheelDustSystem['update'] = (
    delta,
    isDriving,
    robotX,
    robotZ,
    robotHeading,
    linearVel,
    angularVel,
    modelScale,
    environmentMap,
    terrainElev = 0,
    isBraking = false
  ) => {
    const plan = computeWheelDustSpawnParams({
      isDriving,
      linearVel,
      angularVel,
      isBraking,
      environmentMap,
    });

    // 1. Emit wheel-kick dust puffs strictly while driving/moving
    if (plan.shouldEmit) {
      spawnTimer += delta;
      while (spawnTimer >= plan.spawnInterval) {
        spawnTimer -= plan.spawnInterval;

        const wheelHalfW = 0.138 * modelScale;
        const cosH = Math.cos(robotHeading);
        const sinH = Math.sin(robotHeading);

        const moveSign = linearVel >= 0 ? 1 : -1;
        // Kick backward behind rolling wheels & outward from wheel tracks
        const kickBack = linearVel * plan.ejectSpeedScale;
        const kickVx = -sinH * kickBack - cosH * (angularVel * 0.06);
        const kickVz = -cosH * kickBack + sinH * (angularVel * 0.06);

        const rearOffset = moveSign * 0.095 * modelScale;
        const leftX = robotX - cosH * wheelHalfW - sinH * rearOffset;
        const leftZ = robotZ + sinH * wheelHalfW - cosH * rearOffset;

        const rightX = robotX + cosH * wheelHalfW - sinH * rearOffset;
        const rightZ = robotZ - sinH * wheelHalfW - cosH * rearOffset;

        for (let k = 0; k < plan.puffsPerWheel; k++) {
          spawnParticleAt(
            leftX,
            terrainElev,
            leftZ,
            kickVx - cosH * 0.075,
            kickVz + sinH * 0.075,
            plan.intensity,
            plan.sizeScale,
            environmentMap
          );
          spawnParticleAt(
            rightX,
            terrainElev,
            rightZ,
            kickVx + cosH * 0.075,
            kickVz - sinH * 0.075,
            plan.intensity,
            plan.sizeScale,
            environmentMap
          );
        }

        // Subtle rear caster swirl when turning or at higher speed
        if (Math.abs(angularVel) > 0.35 || plan.intensity > 0.55) {
          const casterDist = 0.125 * modelScale;
          const casterX = robotX - sinH * casterDist;
          const casterZ = robotZ - cosH * casterDist;
          spawnParticleAt(
            casterX,
            terrainElev,
            casterZ,
            kickVx * 0.65,
            kickVz * 0.65,
            plan.intensity * 0.85,
            plan.sizeScale * 0.85,
            environmentMap
          );
        }
      }
    } else {
      spawnTimer = 0;
    }

    // 2. Simulate active dust puffs
    let activeCount = 0;
    let dirty = false;

    for (let i = 0; i < maxParticles; i++) {
      const p = particles[i];
      if (!p.active) continue;

      dirty = true;
      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        alphas[i] = 0;
        _pos.set(0, -100, 0);
        _scale.set(0, 0, 1);
        _mat4.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat4);
        continue;
      }

      activeCount++;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.roll += p.rollSpeed * delta;

      p.vy -= plan.gravity * delta;
      const drag = Math.max(0, 1 - 2.6 * delta);
      p.vx *= drag;
      p.vz *= drag;

      const minGroundY = p.floorY + 0.012;
      if (p.y < minGroundY) {
        p.y = minGroundY;
        p.vy = Math.max(0, -p.vy * 0.2);
      }

      const progress = p.life / p.maxLife;
      const visual = computeDustParticleVisual(progress, p.initialSize, p.maxSize, p.peakOpacity);

      _pos.set(p.x, p.y, p.z);
      _scale.set(visual.scale, visual.scale, 1);
      _mat4.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat4);

      colors[i * 3] = p.baseR;
      colors[i * 3 + 1] = p.baseG;
      colors[i * 3 + 2] = p.baseB;
      alphas[i] = visual.alpha;
      rolls[i] = p.roll;
    }

    if (dirty || plan.shouldEmit) {
      mesh.instanceMatrix.needsUpdate = true;
      colorAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      rollAttr.needsUpdate = true;
    }

    return activeCount;
  };

  const triggerDigBurst = (x: number, y: number, z: number, count = 20) => {
    for (let c = 0; c < count; c++) {
      const p = particles[nextIndex];
      nextIndex = (nextIndex + 1) % maxParticles;
      p.active = true;
      p.floorY = y;
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.random() * 0.16;
      p.x = x + Math.cos(angle) * rad;
      p.y = y + 0.02 + Math.random() * 0.04;
      p.z = z + Math.sin(angle) * rad;

      const speed = 0.28 + Math.random() * 0.45;
      p.vx = Math.cos(angle) * speed;
      p.vy = 0.35 + Math.random() * 0.55;
      p.vz = Math.sin(angle) * speed;

      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.45;
      p.initialSize = 0.045;
      p.maxSize = 0.15;
      p.peakOpacity = 0.58;
      p.roll = Math.random() * Math.PI * 2;
      p.rollSpeed = (Math.random() - 0.5) * 3.0;

      if (Math.random() > 0.3) {
        p.baseR = 0.96;
        p.baseG = 0.48 + Math.random() * 0.22;
        p.baseB = 0.16;
      } else {
        p.baseR = 0.98;
        p.baseG = 0.82;
        p.baseB = 0.32;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    rollAttr.needsUpdate = true;
  };

  const reset = () => {
    spawnTimer = 0;
    for (let i = 0; i < maxParticles; i++) {
      particles[i].active = false;
      alphas[i] = 0;
      _pos.set(0, -100, 0);
      _scale.set(0, 0, 1);
      _mat4.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
    texture.dispose();
  };

  return {
    group,
    update,
    triggerDigBurst,
    reset,
    dispose,
  };
}
