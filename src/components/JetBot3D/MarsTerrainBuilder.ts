import * as THREE from 'three';
import {
  buildEscarpmentQuadIndices,
  buildMarsCraterProfilePoints,
  computeCraterRimHeight,
  MARS_CRATER_SPECS,
  sampleSingleMarsCraterHeight,
} from './marsAtmosphereMath';

export interface ExclusionZone {
  x: number;
  z: number;
  radius: number;
}

export interface MarsTerrainResult {
  terrainGroup: THREE.Group;
  regolithMap: THREE.CanvasTexture;
  regolithBumpMap: THREE.CanvasTexture;
  regolithNormalMap: THREE.DataTexture;
  regolithRoughnessMap: THREE.CanvasTexture;
  mountainMap: THREE.CanvasTexture;
  mountainBumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes a seamless periodic tangent-space NormalMap (Linear DataTexture)
 * via a 3x3 Sobel filter over a grayscale height canvas.
 */
function buildNormalMapFromHeightCanvas(
  bumpCanvas: HTMLCanvasElement,
  strength: number,
  repeat: number
): THREE.DataTexture {
  const size = bumpCanvas.width;
  const ctx = bumpCanvas.getContext('2d')!;
  const src = ctx.getImageData(0, 0, size, size).data;
  const out = new Uint8Array(size * size * 4);

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return src[(wy * size + wx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = dz * invLen;

      const idx = (y * size + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(repeat, repeat);
  normalMap.generateMipmaps = true;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.needsUpdate = true;
  return normalMap;
}

/**
 * Generates paired procedural Martian stratified rock albedo (sRGB) + bump height map (Linear)
 * for mountains, island escarpment cliffs, and canyon mesas.
 */
export function createMarsMountainMaps(
  disposables: { dispose: () => void }[]
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const rand = createSeededRandom(90125);
  const w = 512;
  const h = 512;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const actx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bctx = bumpCanvas.getContext('2d')!;

  // Realistic desaturated iron-oxide & basalt cliff palette
  const mGrad = actx.createLinearGradient(0, 0, 0, h);
  mGrad.addColorStop(0.0, '#c97146'); // Sunlit ochre caprock
  mGrad.addColorStop(0.18, '#a64d2a'); // Rust sandstone shelf
  mGrad.addColorStop(0.36, '#793118'); // Deep iron-oxide stratum
  mGrad.addColorStop(0.54, '#984222'); // Sedimentary terracotta band
  mGrad.addColorStop(0.72, '#572011'); // Basaltic dark hematite belt
  mGrad.addColorStop(0.88, '#7a331a'); // Lower scree rock
  mGrad.addColorStop(1.0, '#622612'); // Base blending into regolith
  actx.fillStyle = mGrad;
  actx.fillRect(0, 0, w, h);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  // Horizontal sedimentary rock strata ledges across both albedo & height bump
  for (let y = 0; y < h; y += 3) {
    const wave = Math.sin(y * 0.14) * 0.5 + Math.cos(y * 0.045) * 0.5;
    if (wave > 0.15) {
      const alpha = (0.14 + wave * 0.18).toFixed(3);
      actx.fillStyle = `rgba(222, 149, 106, ${alpha})`;
      actx.fillRect(0, y, w, 2);
      const lum = Math.round(152 + wave * 76);
      bctx.fillStyle = `rgb(${lum},${lum},${lum})`;
      bctx.fillRect(0, y, w, 3);
    } else if (wave < -0.15) {
      const alpha = (0.18 + -wave * 0.24).toFixed(3);
      actx.fillStyle = `rgba(42, 15, 9, ${alpha})`;
      actx.fillRect(0, y, w, 3);
      const lum = Math.round(92 + wave * 58);
      bctx.fillStyle = `rgb(${lum},${lum},${lum})`;
      bctx.fillRect(0, y, w, 3);
    }
  }

  // Vertical erosion gullies & fissures
  for (let i = 0; i < 48; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.65;
    const gLen = 45 + rand() * 140;
    actx.strokeStyle = `rgba(34, 12, 7, ${(0.14 + rand() * 0.18).toFixed(2)})`;
    actx.lineWidth = 1.5 + rand() * 2.5;
    actx.beginPath();
    actx.moveTo(gx, gy);
    actx.lineTo(gx + (rand() - 0.5) * 18, gy + gLen);
    actx.stroke();

    bctx.strokeStyle = 'rgba(38, 38, 38, 0.38)';
    bctx.lineWidth = actx.lineWidth;
    bctx.beginPath();
    bctx.moveTo(gx, gy);
    bctx.lineTo(gx + (rand() - 0.5) * 18, gy + gLen);
    bctx.stroke();
  }

  // Fine basaltic rock grain
  for (let i = 0; i < 1600; i++) {
    const rx = rand() * w;
    const ry = rand() * h;
    const r = 0.8 + rand() * 1.8;
    const bright = rand() > 0.55;
    actx.fillStyle = bright ? 'rgba(216, 136, 90, 0.28)' : 'rgba(40, 14, 8, 0.34)';
    actx.fillRect(rx, ry, r, r);

    const bl = bright ? 168 : 88;
    bctx.fillStyle = `rgba(${bl},${bl},${bl},0.46)`;
    bctx.fillRect(rx, ry, r, r);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 1);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 1);

  disposables.push(map, bumpMap);
  return { map, bumpMap };
}

/**
 * Computes the exact macro geological vertex color used by marsFloor at any world (wx, wz)
 * so crater aprons and climbable mound bases blend into the plateau with zero color seam.
 */
export function sampleMarsFloorVertexColor(wx: number, wz: number): [number, number, number] {
  const distNorm = Math.min(1, Math.hypot(wx, wz) / 15.5);
  const macroWave =
    Math.sin(wx * 0.28 + wz * 0.19) * 0.08 +
    Math.cos(wx * 0.17 - wz * 0.31) * 0.07;
  const edgeShade = 1.0 - distNorm * 0.24 + macroWave;
  return [
    THREE.MathUtils.clamp(edgeShade, 0.58, 1.08),
    THREE.MathUtils.clamp(edgeShade * 0.94, 0.52, 1.05),
    THREE.MathUtils.clamp(edgeShade * 0.88, 0.48, 1.0),
  ];
}

/**
 * Generates seamless tileable high-frequency Martian Regolith PBR maps
 * (albedo + bump + Sobel tangent-space normalMap + roughness) with aeolian sand bedforms,
 * exposed mudstone fractures, and multi-scale basalt/iron-oxide grit.
 */
function createMarsRegolithMaps(
  disposables: { dispose: () => void }[]
): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const rand = createSeededRandom(424242);
  const size = 512;

  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext('2d')!;

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rctx = rough.getContext('2d')!;

  // Warm iron-oxide regolith baseline
  ctx.fillStyle = '#8d4020';
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  rctx.fillStyle = '#ededed';
  rctx.fillRect(0, 0, size, size);

  const drawWrappedPatch = (
    px: number,
    py: number,
    pr: number,
    fillA: string,
    fillR: string,
    bumpDelta?: string
  ) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const cx = px + ox;
        const cy = py + oy;
        if (cx + pr < 0 || cx - pr > size || cy + pr < 0 || cy - pr > size) continue;
        const grad = ctx.createRadialGradient(cx, cy, pr * 0.1, cx, cy, pr);
        grad.addColorStop(0, fillA);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.fill();

        if (bumpDelta) {
          const bGrad = bctx.createRadialGradient(cx, cy, pr * 0.1, cx, cy, pr);
          bGrad.addColorStop(0, bumpDelta);
          bGrad.addColorStop(1, 'rgba(128,128,128,0)');
          bctx.fillStyle = bGrad;
          bctx.beginPath();
          bctx.arc(cx, cy, pr, 0, Math.PI * 2);
          bctx.fill();
        }

        rctx.fillStyle = fillR;
        rctx.beginPath();
        rctx.arc(cx, cy, pr * 0.72, 0, Math.PI * 2);
        rctx.fill();
      }
    }
  };

  for (let p = 0; p < 36; p++) {
    const px = rand() * size;
    const py = rand() * size;
    const pr = 26 + rand() * 68;
    const isBasalt = p % 2 === 0;
    drawWrappedPatch(
      px,
      py,
      pr,
      isBasalt ? 'rgba(50, 20, 10, 0.28)' : 'rgba(182, 98, 52, 0.22)',
      isBasalt ? 'rgba(182, 182, 182, 0.28)' : 'rgba(248, 248, 248, 0.24)',
      isBasalt ? 'rgba(92, 92, 92, 0.22)' : 'rgba(164, 164, 164, 0.22)'
    );
  }

  // Exposed Gale-Crater fractured mudstone fissures (periodic across tile edges)
  ctx.lineCap = 'round';
  bctx.lineCap = 'round';
  for (let f = 0; f < 34; f++) {
    const fx = rand() * size;
    const fy = rand() * size;
    const len = 24 + rand() * 48;
    const ang = rand() * Math.PI * 2;
    const mx = fx + Math.cos(ang + 0.3) * len * 0.5;
    const my = fy + Math.sin(ang + 0.3) * len * 0.5;
    const ex = fx + Math.cos(ang) * len;
    const ey = fy + Math.sin(ang) * len;

    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const x0 = fx + ox;
        const y0 = fy + oy;
        const x1 = mx + ox;
        const y1 = my + oy;
        const x2 = ex + ox;
        const y2 = ey + oy;
        if (Math.max(x0, x2) < -10 || Math.min(x0, x2) > size + 10) continue;
        if (Math.max(y0, y2) < -10 || Math.min(y0, y2) > size + 10) continue;

        ctx.strokeStyle = 'rgba(38, 14, 8, 0.14)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        bctx.strokeStyle = 'rgba(65, 65, 65, 0.35)';
        bctx.lineWidth = 1.5;
        bctx.beginPath();
        bctx.moveTo(x0, y0);
        bctx.lineTo(x1, y1);
        bctx.lineTo(x2, y2);
        bctx.stroke();
      }
    }
  }

  // Organic wind-carved sand bedforms (static ancient geological ripples, no moving dust)
  for (let w = 0; w < 38; w++) {
    const sx = rand() * size;
    const sy = rand() * size;
    const len = 42 + rand() * 76;
    const tilt = (rand() - 0.5) * 0.5;
    const curve = (rand() - 0.5) * 18;
    const width = 1.8 + rand() * 2.2;

    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const x0 = sx + ox;
        const y0 = sy + oy;
        const x2 = x0 + Math.cos(tilt) * len;
        const y2 = y0 + Math.sin(tilt) * len;
        if (Math.max(x0, x2) < -15 || Math.min(x0, x2) > size + 15) continue;
        if (Math.max(y0, y2) < -15 || Math.min(y0, y2) > size + 15) continue;
        const cx = (x0 + x2) * 0.5;
        const cy = (y0 + y2) * 0.5 + curve;

        ctx.strokeStyle = 'rgba(212, 126, 76, 0.1)';
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x2, y2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(42, 15, 7, 0.08)';
        ctx.lineWidth = width * 0.85;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + width * 0.9);
        ctx.quadraticCurveTo(cx, cy + width * 0.9, x2, y2 + width * 0.9);
        ctx.stroke();

        bctx.strokeStyle = 'rgba(182, 182, 182, 0.28)';
        bctx.lineWidth = width;
        bctx.beginPath();
        bctx.moveTo(x0, y0);
        bctx.quadraticCurveTo(cx, cy, x2, y2);
        bctx.stroke();
      }
    }
  }

  // Dense multi-scale circular sand grains & volcanic gravel
  const drawWrappedDisc = (
    gx: number,
    gy: number,
    radius: number,
    albedoStyle: string,
    bumpStyle: string
  ) => {
    for (const ox of [-size, 0, size]) {
      const cx = gx + ox;
      if (cx + radius < 0 || cx - radius > size) continue;
      for (const oy of [-size, 0, size]) {
        const cy = gy + oy;
        if (cy + radius < 0 || cy - radius > size) continue;

        ctx.fillStyle = albedoStyle;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        bctx.fillStyle = bumpStyle;
        bctx.beginPath();
        bctx.arc(cx, cy, radius, 0, Math.PI * 2);
        bctx.fill();
      }
    }
  };

  for (let i = 0; i < 3600; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const roll = rand();
    const radius = roll > 0.94 ? 1.15 + rand() * 0.95 : 0.45 + rand() * 0.75;
    if (roll < 0.42) {
      drawWrappedDisc(gx, gy, radius, 'rgba(34, 13, 7, 0.36)', 'rgba(84, 84, 84, 0.48)');
    } else if (roll < 0.85) {
      drawWrappedDisc(gx, gy, radius, 'rgba(192, 106, 58, 0.26)', 'rgba(176, 176, 176, 0.46)');
    } else {
      drawWrappedDisc(gx, gy, radius, 'rgba(224, 148, 100, 0.24)', 'rgba(206, 206, 206, 0.5)');
    }
  }

  const repeat = 6;
  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat, repeat);
  bumpMap.anisotropy = 4;

  const normalMap = buildNormalMapFromHeightCanvas(bump, 2.2, repeat);

  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeat, repeat);

  disposables.push(map, bumpMap, normalMap, roughnessMap);
  return { map, bumpMap, normalMap, roughnessMap };
}

/**
 * Builds the 3D outer Martian island escarpment cliff rim descending into an expansive
 * undulating crater basin surrounded 360 degrees by distant Gale/Jezero crater wall mountains.
 */
function buildMarsIslandEscarpment(
  isSoftwareGl: boolean,
  regolithMap: THREE.CanvasTexture,
  regolithBump: THREE.CanvasTexture,
  mountainMap: THREE.CanvasTexture,
  mountainBumpMap: THREE.CanvasTexture,
  disposables: { dispose: () => void }[]
): THREE.Group {
  const escarpmentGroup = new THREE.Group();
  escarpmentGroup.name = 'MarsIslandEscarpment';

  const rand = createSeededRandom(314159);

  // 1. Stepped Rocky Cliff Skirt surrounding the 28m playable plateau (x,z in [-13.8, 13.8])
  const angularSegments = 64;
  const ringProfile = [
    { scale: 13.75, y: -0.01, jitter: 0.05 },
    { scale: 14.35, y: -0.18, jitter: 0.25 },
    { scale: 15.6, y: -1.15, jitter: 0.55 },
    { scale: 17.5, y: -2.05, jitter: 0.72 },
    { scale: 20.4, y: -3.65, jitter: 0.95 },
    { scale: 24.5, y: -4.22, jitter: 0.45 },
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  for (let r = 0; r < ringProfile.length; r++) {
    const step = ringProfile[r];
    const vCoord = r / (ringProfile.length - 1);

    for (let s = 0; s < angularSegments; s++) {
      const theta = (s / angularSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const absMax = Math.max(Math.abs(cosT), Math.abs(sinT));
      const squareProj = 1 / Math.max(0.001, absMax);
      const blendRadius = THREE.MathUtils.lerp(squareProj, 1.18, 0.32);

      const cragNoise =
        Math.sin(theta * 7 + r * 1.4) * 0.55 +
        Math.cos(theta * 13 - r * 0.9) * 0.45;
      const rad = step.scale * blendRadius + cragNoise * step.jitter;

      const x = cosT * rad;
      const z = sinT * rad;
      const y =
        r === 0
          ? step.y
          : step.y + Math.sin(theta * 9 + r) * (step.jitter * 0.14);

      positions.push(x, y, z);
      uvs.push((s / angularSegments) * 6, vCoord * 2);

      const strataShade = 1.0 - vCoord * 0.48 + cragNoise * 0.06;
      colors.push(
        THREE.MathUtils.clamp(strataShade * 0.95, 0.25, 1.0),
        THREE.MathUtils.clamp(strataShade * 0.72, 0.18, 0.95),
        THREE.MathUtils.clamp(strataShade * 0.58, 0.15, 0.85)
      );
    }
  }

  const indices = buildEscarpmentQuadIndices(ringProfile.length, angularSegments);

  const cliffGeom = new THREE.BufferGeometry();
  cliffGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  cliffGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cliffGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  cliffGeom.setIndex(indices);
  cliffGeom.computeVertexNormals();

  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mountainMap,
    bumpMap: mountainBumpMap,
    bumpScale: 0.045,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
    envMapIntensity: 0.28,
    flatShading: true,
  });

  const cliffMesh = new THREE.Mesh(cliffGeom, cliffMat);
  cliffMesh.receiveShadow = !isSoftwareGl;
  cliffMesh.castShadow = !isSoftwareGl;
  escarpmentGroup.add(cliffMesh);
  disposables.push(cliffGeom, cliffMat);

  // 2. Single-Mesh 360-Degree Martian Crater Basin Floor + Towering Distant Crater Rim Wall
  const rimSegs = 72;
  const rimRadii = [18.0, 26.0, 34.0, 41.0, 48.0, 56.0, 65.0, 74.0, 82.0];
  const bPos: number[] = [];
  const bUvs: number[] = [];
  const bCols: number[] = [];

  for (let r = 0; r < rimRadii.length; r++) {
    const rad = rimRadii[r];
    const radialMountainFrac = Math.max(0, (rad - 36.0) / (78.0 - 36.0));
    for (let s = 0; s < rimSegs; s++) {
      const theta = (s / rimSegs) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const duneRipple =
        Math.sin(theta * 6 + rad * 0.2) * 0.35 + Math.cos(theta * 11 - rad * 0.14) * 0.25;
      const rimRise = computeCraterRimHeight(theta, radialMountainFrac);
      const y = -4.24 + duneRipple * (1 - radialMountainFrac * 0.5) + rimRise;

      bPos.push(cosT * rad, y, sinT * rad);
      bUvs.push((s / rimSegs) * 14, (r / (rimRadii.length - 1)) * 4);

      // Blend floor rust into sunlit sedimentary crater mountain strata
      const strataBand = 0.88 + 0.14 * Math.sin(y * 1.45 + theta * 2);
      const peakLift = Math.min(1, rimRise / 9.0);
      bCols.push(
        THREE.MathUtils.clamp((0.68 + peakLift * 0.24) * strataBand, 0.3, 1.0),
        THREE.MathUtils.clamp((0.36 + peakLift * 0.22) * strataBand, 0.18, 0.9),
        THREE.MathUtils.clamp((0.24 + peakLift * 0.16) * strataBand, 0.12, 0.8)
      );
    }
  }

  const bIdx = buildEscarpmentQuadIndices(rimRadii.length, rimSegs);

  const basinGeom = new THREE.BufferGeometry();
  basinGeom.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  basinGeom.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
  basinGeom.setAttribute('color', new THREE.Float32BufferAttribute(bCols, 3));
  basinGeom.setIndex(bIdx);
  basinGeom.computeVertexNormals();

  const basinMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mountainMap,
    bumpMap: regolithBump,
    bumpScale: 0.04,
    vertexColors: true,
    roughness: 0.93,
    metalness: 0.03,
    envMapIntensity: 0.26,
    flatShading: true,
  });
  const basinFloor = new THREE.Mesh(basinGeom, basinMat);
  escarpmentGroup.add(basinFloor);
  disposables.push(basinGeom, basinMat);

  // 3. 18 Stratified Mid-Basin Canyon Mesas circling the plateau (single InstancedMesh draw call)
  const mesaGeom = new THREE.CylinderGeometry(3.4, 7.6, 5.8, 10, 4);
  const mPos = mesaGeom.attributes.position;
  for (let i = 0; i < mPos.count; i++) {
    const mx = mPos.getX(i);
    const my = mPos.getY(i);
    const mz = mPos.getZ(i);
    const ang = Math.atan2(mz, mx);
    const radialScale = 1.0 + Math.sin(ang * 3 + my * 0.45) * 0.24 + Math.cos(ang * 5) * 0.1;
    mPos.setXYZ(i, mx * radialScale, my, mz * radialScale);
  }
  mesaGeom.computeVertexNormals();

  const mesaMat = new THREE.MeshStandardMaterial({
    color: 0xb25a36,
    map: mountainMap,
    bumpMap: mountainBumpMap,
    bumpScale: 0.04,
    roughness: 0.91,
    metalness: 0.04,
    envMapIntensity: 0.26,
    flatShading: true,
  });
  disposables.push(mesaGeom, mesaMat);

  const mesaCount = 18;
  const mesaInstanced = new THREE.InstancedMesh(mesaGeom, mesaMat, mesaCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < mesaCount; i++) {
    const theta = (i / mesaCount) * Math.PI * 2 + (rand() - 0.5) * 0.16;
    const dist = 28 + rand() * 17;
    dummy.position.set(Math.cos(theta) * dist, -1.65 + rand() * 0.9, Math.sin(theta) * dist);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(0.8 + rand() * 0.75, 0.75 + rand() * 0.7, 0.8 + rand() * 0.65);
    dummy.updateMatrix();
    mesaInstanced.setMatrixAt(i, dummy.matrix);
  }
  mesaInstanced.instanceMatrix.needsUpdate = true;
  mesaInstanced.computeBoundingSphere();
  escarpmentGroup.add(mesaInstanced);
  disposables.push(mesaInstanced);

  return escarpmentGroup;
}

/**
 * Builds crisp 3D rimmed Martian impact craters using LatheGeometry with vertex jitter
 * so surface craters have genuine physical relief instead of flat painted circles.
 */
function buildMarsCraters(
  isSoftwareGl: boolean,
  regolithMap: THREE.CanvasTexture,
  regolithNormalMap: THREE.DataTexture,
  regolithBump: THREE.CanvasTexture,
  disposables: { dispose: () => void }[]
): THREE.Group {
  const craterGroup = new THREE.Group();
  craterGroup.name = 'MarsImpactCraters';

  const craterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: regolithMap,
    normalMap: regolithNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    bumpMap: regolithBump,
    bumpScale: 0.04,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.04,
    envMapIntensity: 0.28,
  });
  disposables.push(craterMat);

  MARS_CRATER_SPECS.forEach(({ x, z, r, h }, idx) => {
    const profile = buildMarsCraterProfilePoints(r, h).map(
      ([px, py]) => new THREE.Vector2(px, py)
    );

    const geom = new THREE.LatheGeometry(profile, 32);
    const pos = geom.attributes.position;
    const uvAttr = geom.attributes.uv;
    const cols = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const dist = Math.hypot(vx, vz);
      const yLift = sampleSingleMarsCraterHeight(vx, vz, r, h, idx);
      pos.setXYZ(i, vx, yLift, vz);

      uvAttr.setXY(i, (x + vx + 14) / 28, (-(z + vz) + 14) / 28);

      const heightFrac = THREE.MathUtils.clamp(yLift / h, 0, 1);
      const [baseR, baseG, baseB] = sampleMarsFloorVertexColor(x + vx, z + vz);
      if (dist < r * 0.5) {
        cols[i * 3] = baseR * 0.58;
        cols[i * 3 + 1] = baseG * 0.52;
        cols[i * 3 + 2] = baseB * 0.5;
      } else if (dist < r * 0.88) {
        cols[i * 3] = THREE.MathUtils.lerp(baseR * 0.72, baseR * 1.14, heightFrac);
        cols[i * 3 + 1] = THREE.MathUtils.lerp(baseG * 0.65, baseG * 1.06, heightFrac);
        cols[i * 3 + 2] = THREE.MathUtils.lerp(baseB * 0.6, baseB * 1.0, heightFrac);
      } else {
        cols[i * 3] = baseR;
        cols[i * 3 + 1] = baseG;
        cols[i * 3 + 2] = baseB;
      }
    }

    geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geom.computeVertexNormals();

    const normAttr = geom.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const dist = Math.hypot(pos.getX(i), pos.getZ(i));
      if (dist < 0.01 || dist >= r * 1.01) {
        normAttr.setXYZ(i, 0, 1, 0);
      }
    }
    normAttr.needsUpdate = true;

    const mesh = new THREE.Mesh(geom, craterMat);
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = !isSoftwareGl;
    mesh.castShadow = !isSoftwareGl;
    craterGroup.add(mesh);
    disposables.push(geom);
  });

  return craterGroup;
}

/**
 * Scatters ~370 Martian basalt stones, flat red shale plates, and outer rim boulders
 * using ONLY 3 THREE.InstancedMesh draw calls for rock-solid 60 FPS performance.
 */
function buildInstancedMarsScatter(
  isSoftwareGl: boolean,
  exclusionZones: ExclusionZone[],
  disposables: { dispose: () => void }[]
): THREE.Group {
  const scatterGroup = new THREE.Group();
  scatterGroup.name = 'MarsInstancedPebbleScatter';
  const rand = createSeededRandom(202604);

  const isClear = (x: number, z: number): boolean => {
    for (const zone of exclusionZones) {
      if (Math.hypot(x - zone.x, z - zone.z) < zone.radius) {
        return false;
      }
    }
    return true;
  };

  // Batch 1: 165 Angular Basalt Pebbles
  const pebbleGeom = new THREE.DodecahedronGeometry(0.052, 0);
  const pAttr = pebbleGeom.attributes.position;
  for (let i = 0; i < pAttr.count; i++) {
    const vx = pAttr.getX(i);
    const vy = pAttr.getY(i);
    const vz = pAttr.getZ(i);
    pAttr.setXYZ(i, vx * 1.18, vy * 0.72, vz * 0.94);
  }
  pebbleGeom.computeVertexNormals();

  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
    envMapIntensity: 0.25,
    flatShading: true,
  });

  const pebblePalette = [
    new THREE.Color(0x4a2217),
    new THREE.Color(0x7c2d12),
    new THREE.Color(0x9a3412),
    new THREE.Color(0x632514),
    new THREE.Color(0xb45309),
  ];

  const PEBBLE_COUNT = 165;
  const pebbles = new THREE.InstancedMesh(pebbleGeom, pebbleMat, PEBBLE_COUNT);
  pebbles.receiveShadow = !isSoftwareGl;

  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  while (placed < PEBBLE_COUNT && attempts < 1400) {
    attempts++;
    const px = (rand() - 0.5) * 26.0;
    const pz = (rand() - 0.5) * 26.0;
    if (!isClear(px, pz)) continue;

    const s = 0.6 + rand() * 1.15;
    dummy.position.set(px, 0.018 * s, pz);
    dummy.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35);
    dummy.scale.set(
      s * (0.85 + rand() * 0.45),
      s * (0.65 + rand() * 0.45),
      s * (0.85 + rand() * 0.45)
    );
    dummy.updateMatrix();
    pebbles.setMatrixAt(placed, dummy.matrix);
    pebbles.setColorAt(placed, pebblePalette[placed % pebblePalette.length]);
    placed++;
  }
  pebbles.count = placed;
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  scatterGroup.add(pebbles);

  // Batch 2: 125 Flat Red Shale / Slate Ground Plates
  const shaleGeom = new THREE.CylinderGeometry(0.082, 0.115, 0.022, 6);
  const shaleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.04,
    envMapIntensity: 0.25,
    flatShading: true,
  });

  const SHALE_COUNT = 125;
  const shales = new THREE.InstancedMesh(shaleGeom, shaleMat, SHALE_COUNT);
  shales.receiveShadow = !isSoftwareGl;

  let shalePlaced = 0;
  let shaleAttempts = 0;
  while (shalePlaced < SHALE_COUNT && shaleAttempts < 1200) {
    shaleAttempts++;
    const sx = (rand() - 0.5) * 25.4;
    const sz = (rand() - 0.5) * 25.4;
    if (!isClear(sx, sz)) continue;

    const s = 0.65 + rand() * 1.1;
    dummy.position.set(sx, 0.007, sz);
    dummy.rotation.set((rand() - 0.5) * 0.12, rand() * Math.PI * 2, (rand() - 0.5) * 0.12);
    dummy.scale.set(s * (0.9 + rand() * 0.5), 1, s * (0.75 + rand() * 0.45));
    dummy.updateMatrix();
    shales.setMatrixAt(shalePlaced, dummy.matrix);
    shales.setColorAt(shalePlaced, pebblePalette[(shalePlaced + 2) % pebblePalette.length]);
    shalePlaced++;
  }
  shales.count = shalePlaced;
  shales.instanceMatrix.needsUpdate = true;
  if (shales.instanceColor) shales.instanceColor.needsUpdate = true;
  shales.computeBoundingSphere();
  scatterGroup.add(shales);

  // Batch 3: 80 Low Embedded Perimeter Cobbles tucked around outer sector (r > 6.2m)
  const rimRockGeom = new THREE.DodecahedronGeometry(0.075, 0);
  const rrAttr = rimRockGeom.attributes.position;
  for (let i = 0; i < rrAttr.count; i++) {
    rrAttr.setXYZ(
      i,
      rrAttr.getX(i) * 1.25,
      rrAttr.getY(i) * 0.36,
      rrAttr.getZ(i) * 1.05
    );
  }
  rimRockGeom.computeVertexNormals();

  const RIM_ROCK_COUNT = 80;
  const rimRocks = new THREE.InstancedMesh(rimRockGeom, pebbleMat, RIM_ROCK_COUNT);
  rimRocks.receiveShadow = !isSoftwareGl;
  rimRocks.castShadow = !isSoftwareGl;

  let rimPlaced = 0;
  let rimAttempts = 0;
  while (rimPlaced < RIM_ROCK_COUNT && rimAttempts < 1000) {
    rimAttempts++;
    const angle = rand() * Math.PI * 2;
    const dist = 6.2 + rand() * 7.0;
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;
    if (Math.abs(rx) > 13.0 || Math.abs(rz) > 13.0) continue;
    if (!isClear(rx, rz)) continue;

    const s = 0.65 + rand() * 0.75;
    dummy.position.set(rx, 0.012 * s, rz);
    dummy.rotation.set((rand() - 0.5) * 0.16, rand() * Math.PI * 2, (rand() - 0.5) * 0.16);
    dummy.scale.set(s * (0.9 + rand() * 0.35), s * 0.7, s * (0.9 + rand() * 0.35));
    dummy.updateMatrix();
    rimRocks.setMatrixAt(rimPlaced, dummy.matrix);
    rimRocks.setColorAt(rimPlaced, pebblePalette[rimPlaced % 4]);
    rimPlaced++;
  }
  rimRocks.count = rimPlaced;
  rimRocks.instanceMatrix.needsUpdate = true;
  if (rimRocks.instanceColor) rimRocks.instanceColor.needsUpdate = true;
  rimRocks.computeBoundingSphere();
  scatterGroup.add(rimRocks);

  disposables.push(
    pebbleGeom,
    pebbleMat,
    pebbles,
    shaleGeom,
    shaleMat,
    shales,
    rimRockGeom,
    rimRocks
  );
  return scatterGroup;
}

/**
 * Builds the multi-part pressurized Mars Research Habitat Outpost at (-5.8, 0, 1.4).
 */
function buildMarsResearchOutpost(
  isSoftwareGl: boolean,
  disposables: { dispose: () => void }[]
): THREE.Group {
  const domeGroup = new THREE.Group();
  domeGroup.name = 'MarsResearchOutpost';
  domeGroup.position.set(-5.8, 0, 1.4);

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const foundationMat = track(
    new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.85, metalness: 0.25 })
  );
  const hullMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.48, metalness: 0.28 })
  );
  const titaniumMat = track(
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.34, metalness: 0.78 })
  );
  const windowGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.95,
      roughness: 0.25,
    })
  );
  const solarMat = track(
    new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.25, metalness: 0.72 })
  );
  const copperTrimMat = track(
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.82 })
  );

  const baseGeom = track(new THREE.CylinderGeometry(0.95, 1.04, 0.06, 8));
  const baseMesh = new THREE.Mesh(baseGeom, foundationMat);
  baseMesh.position.y = 0.03;
  baseMesh.receiveShadow = !isSoftwareGl;
  domeGroup.add(baseMesh);

  const domeGeom = track(new THREE.SphereGeometry(0.75, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2));
  const dome = new THREE.Mesh(domeGeom, hullMat);
  dome.position.y = 0.05;
  dome.castShadow = !isSoftwareGl;
  dome.receiveShadow = !isSoftwareGl;
  domeGroup.add(dome);

  const collarGeom = track(new THREE.TorusGeometry(0.755, 0.028, 8, 28));
  const collar = new THREE.Mesh(collarGeom, titaniumMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.07;
  domeGroup.add(collar);

  const upperRingGeom = track(new THREE.TorusGeometry(0.56, 0.016, 8, 24));
  const upperRing = new THREE.Mesh(upperRingGeom, copperTrimMat);
  upperRing.rotation.x = Math.PI / 2;
  upperRing.position.y = 0.54;
  domeGroup.add(upperRing);

  const ribGeom = track(new THREE.TorusGeometry(0.758, 0.013, 6, 24, Math.PI));
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(ribGeom, titaniumMat);
    rib.position.y = 0.05;
    rib.rotation.y = (i / 4) * Math.PI;
    domeGroup.add(rib);
  }

  const viewportFrameGeom = track(new THREE.BoxGeometry(0.19, 0.13, 0.04));
  const viewportGlassGeom = track(new THREE.BoxGeometry(0.15, 0.09, 0.05));
  [0.55, 1.55, 3.85].forEach((ang) => {
    const vpGroup = new THREE.Group();
    vpGroup.position.set(Math.cos(ang) * 0.71, 0.24, Math.sin(ang) * 0.71);
    vpGroup.rotation.y = -ang + Math.PI / 2;
    vpGroup.add(new THREE.Mesh(viewportFrameGeom, titaniumMat));
    vpGroup.add(new THREE.Mesh(viewportGlassGeom, windowGlowMat));
    domeGroup.add(vpGroup);
  });

  const airlockGeom = track(new THREE.CylinderGeometry(0.2, 0.2, 0.54, 16));
  const airlock = new THREE.Mesh(airlockGeom, titaniumMat);
  airlock.rotation.z = Math.PI / 2;
  airlock.position.set(0.66, 0.22, 0);
  airlock.castShadow = !isSoftwareGl;
  domeGroup.add(airlock);

  const hatchRingGeom = track(new THREE.TorusGeometry(0.2, 0.022, 8, 16));
  const hatchRing = new THREE.Mesh(hatchRingGeom, copperTrimMat);
  hatchRing.rotation.y = Math.PI / 2;
  hatchRing.position.set(0.92, 0.22, 0);
  domeGroup.add(hatchRing);

  const tankGeom = track(new THREE.CylinderGeometry(0.11, 0.11, 0.44, 12));
  const tankCapGeom = track(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  [-0.16, 0.16].forEach((tx) => {
    const tMesh = new THREE.Mesh(tankGeom, hullMat);
    tMesh.position.set(tx, 0.28, -0.92);
    tMesh.castShadow = !isSoftwareGl;
    domeGroup.add(tMesh);

    const capMesh = new THREE.Mesh(tankCapGeom, copperTrimMat);
    capMesh.position.set(tx, 0.5, -0.92);
    domeGroup.add(capMesh);
  });

  const mastGeom = track(new THREE.CylinderGeometry(0.02, 0.028, 0.34, 8));
  const mast = new THREE.Mesh(mastGeom, titaniumMat);
  mast.position.set(-0.18, 0.92, -0.1);
  domeGroup.add(mast);

  const dishGeom = track(new THREE.SphereGeometry(0.19, 16, 10, 0, Math.PI * 2, 0, 0.72));
  const dish = new THREE.Mesh(dishGeom, hullMat);
  dish.position.set(-0.18, 1.07, -0.02);
  dish.rotation.x = Math.PI * 0.65;
  domeGroup.add(dish);

  const beaconGeom = track(new THREE.SphereGeometry(0.032, 10, 10));
  const beaconMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf97316,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    })
  );
  const beacon = new THREE.Mesh(beaconGeom, beaconMat);
  beacon.position.set(0.05, 0.85, 0.05);
  domeGroup.add(beacon);

  const solarGroup = new THREE.Group();
  solarGroup.position.set(0, 0, 1.18);
  const panelGeom = track(new THREE.BoxGeometry(0.58, 0.016, 0.38));
  const panelFrameGeom = track(new THREE.BoxGeometry(0.61, 0.012, 0.41));
  const panelMastGeom = track(new THREE.CylinderGeometry(0.022, 0.028, 0.28, 8));

  [-0.36, 0.36].forEach((sx) => {
    const pMast = new THREE.Mesh(panelMastGeom, titaniumMat);
    pMast.position.set(sx, 0.14, 0);
    solarGroup.add(pMast);

    const frame = new THREE.Mesh(panelFrameGeom, titaniumMat);
    frame.position.set(sx, 0.27, 0);
    frame.rotation.x = -0.34;
    solarGroup.add(frame);

    const panel = new THREE.Mesh(panelGeom, solarMat);
    panel.position.set(sx, 0.274, 0);
    panel.rotation.x = -0.34;
    panel.castShadow = !isSoftwareGl;
    solarGroup.add(panel);
  });
  domeGroup.add(solarGroup);

  return domeGroup;
}

/**
 * Builds the complete realistic Martian Island Terrain, Cliffs, 3D Craters,
 * 360-degree Distant Crater Wall Mountains, Instanced Pebble/Shale/Boulder Scatter,
 * and Research Outpost Dome. Strictly zero wind/dust/storm elements for steady FPS.
 */
export function buildRealisticMarsTerrain(
  isSoftwareGl: boolean,
  exclusionZones: ExclusionZone[]
): MarsTerrainResult {
  const disposables: { dispose: () => void }[] = [];
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'MarsRealisticIslandTerrain';

  const {
    map: regolithMap,
    bumpMap: regolithBump,
    normalMap: regolithNormalMap,
    roughnessMap: regolithRough,
  } = createMarsRegolithMaps(disposables);
  const { map: mountainMap, bumpMap: mountainBumpMap } = createMarsMountainMaps(disposables);

  // 1. Main Playable 28m x 28m Regolith Plateau
  const floorGeom = new THREE.PlaneGeometry(28, 28, 48, 48);
  floorGeom.rotateX(-Math.PI / 2);

  const fPos = floorGeom.attributes.position;
  const fCols = new Float32Array(fPos.count * 3);
  for (let i = 0; i < fPos.count; i++) {
    const [r, g, b] = sampleMarsFloorVertexColor(fPos.getX(i), fPos.getZ(i));
    fCols[i * 3] = r;
    fCols[i * 3 + 1] = g;
    fCols[i * 3 + 2] = b;
  }
  floorGeom.setAttribute('color', new THREE.BufferAttribute(fCols, 3));

  const marsFloorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: regolithMap,
    normalMap: regolithNormalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    bumpMap: regolithBump,
    bumpScale: 0.036,
    roughnessMap: regolithRough,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.03,
    envMapIntensity: 0.28,
  });
  const marsFloor = new THREE.Mesh(floorGeom, marsFloorMat);
  marsFloor.receiveShadow = !isSoftwareGl;
  marsFloor.position.y = -0.001;
  terrainGroup.add(marsFloor);
  disposables.push(floorGeom, marsFloorMat);

  // 2. Sculpted 3D Island Escarpment Cliffs & 360-Degree Distant Crater Rim Wall
  terrainGroup.add(
    buildMarsIslandEscarpment(
      isSoftwareGl,
      regolithMap,
      regolithBump,
      mountainMap,
      mountainBumpMap,
      disposables
    )
  );

  // 3. Real 3D Rimmed Impact Craters
  terrainGroup.add(
    buildMarsCraters(isSoftwareGl, regolithMap, regolithNormalMap, regolithBump, disposables)
  );

  // 4. Instanced Ground Basalt Pebbles, Shale & Rim Boulders (3 draw calls total)
  terrainGroup.add(buildInstancedMarsScatter(isSoftwareGl, exclusionZones, disposables));

  // 5. Upgraded Geodesic Mars Research Outpost
  terrainGroup.add(buildMarsResearchOutpost(isSoftwareGl, disposables));

  return {
    terrainGroup,
    regolithMap,
    regolithBumpMap: regolithBump,
    regolithNormalMap,
    regolithRoughnessMap: regolithRough,
    mountainMap,
    mountainBumpMap,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
