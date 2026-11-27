import * as THREE from 'three';
import { EnvironmentMap } from '../../types/robot';
import { MARS_ATMOSPHERE_PALETTE, MARS_SUN_DIRECTION } from './marsAtmosphereMath';

interface Asteroid {
  mesh: THREE.Mesh;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  orbitHeight: number;
}

interface MeteorTrail {
  headMesh: THREE.Sprite;
  tailLine: THREE.Line;
  positions: Float32Array;
  active: boolean;
  startX: number;
  startY: number;
  startZ: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
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
 * Creates a crisp procedural Earth texture with continents, polar caps, and atmospheric cloud bands.
 */
function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
  oceanGrad.addColorStop(0, '#0a2142');
  oceanGrad.addColorStop(0.5, '#1d4ed8');
  oceanGrad.addColorStop(1, '#0a2142');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Continents
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(120, 82, 46, 30, -0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(152, 162, 28, 44, 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(322, 74, 78, 36, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.ellipse(282, 142, 34, 44, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(420, 182, 26, 19, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Cyclonic cloud swirls
  const rand = createSeededRandom(1102);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const cy = 34 + i * 26;
    ctx.moveTo(0, cy);
    ctx.bezierCurveTo(130, cy - 16 + rand() * 8, 280, cy + 18, 512, cy);
    ctx.lineTo(512, cy + 10);
    ctx.bezierCurveTo(280, cy + 28, 130, cy - 4, 0, cy + 10);
    ctx.closePath();
    ctx.fill();
  }

  // Polar ice caps
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 240, 512, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a procedural banded atmosphere texture for Jupiter with the Great Red Spot.
 */
function createJupiterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const bands = [
    { y: 0, h: 28, color: '#fed7aa' },
    { y: 28, h: 24, color: '#c2410c' },
    { y: 52, h: 22, color: '#ffedd5' },
    { y: 74, h: 36, color: '#9a3412' },
    { y: 110, h: 26, color: '#fef3c7' },
    { y: 136, h: 40, color: '#7c2d12' },
    { y: 176, h: 28, color: '#fed7aa' },
    { y: 204, h: 26, color: '#b45309' },
    { y: 230, h: 26, color: '#5c2210' },
  ];

  bands.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillRect(0, b.y, 512, b.h);
  });

  ctx.fillStyle = 'rgba(255, 248, 235, 0.28)';
  for (let y = 28; y < 240; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(130, y + 8, 310, y - 8, 512, y);
    ctx.lineTo(512, y + 4);
    ctx.bezierCurveTo(310, y - 4, 130, y + 12, 0, y + 4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(320, 152, 28, 16, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a cratered regolith albedo & bump texture for Phobos (Stickney crater + grooves).
 */
function createPhobosMaps(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const rand = createSeededRandom(55129);
  const w = 256;
  const h = 128;

  const albedo = document.createElement('canvas');
  albedo.width = w;
  albedo.height = h;
  const actx = albedo.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = w;
  bump.height = h;
  const bctx = bump.getContext('2d')!;

  actx.fillStyle = '#736862';
  actx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  // Dust grooves across Phobos
  actx.strokeStyle = 'rgba(54, 46, 42, 0.45)';
  actx.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    const y0 = rand() * h;
    actx.beginPath();
    actx.moveTo(0, y0);
    actx.lineTo(w, y0 + (rand() - 0.5) * 28);
    actx.stroke();
  }

  // Impact craters including large Stickney Crater
  const drawCrater = (cx: number, cy: number, r: number) => {
    const aGrad = actx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    aGrad.addColorStop(0, '#443c38');
    aGrad.addColorStop(0.7, '#5c524d');
    aGrad.addColorStop(0.88, '#968b83');
    aGrad.addColorStop(1, 'rgba(115, 104, 98, 0)');
    actx.fillStyle = aGrad;
    actx.beginPath();
    actx.arc(cx, cy, r, 0, Math.PI * 2);
    actx.fill();

    const bGrad = bctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    bGrad.addColorStop(0, '#383838');
    bGrad.addColorStop(0.75, '#707070');
    bGrad.addColorStop(0.9, '#c8c8c8');
    bGrad.addColorStop(1, 'rgba(128,128,128,0)');
    bctx.fillStyle = bGrad;
    bctx.beginPath();
    bctx.arc(cx, cy, r, 0, Math.PI * 2);
    bctx.fill();
  };

  drawCrater(88, 62, 26); // Stickney crater
  for (let c = 0; c < 34; c++) {
    drawCrater(rand() * w, rand() * h, 3 + rand() * 9);
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
}

/**
 * Creates the procedural Martian atmospheric twilight sky dome shader.
 * Renders thin CO2 butterscotch-to-indigo gradient, crisp Milky Way band,
 * and characteristic pale-blue Martian solar Mie aureole (zero moving wind clouds).
 */
function createMarsSkyDome(disposables: { dispose: () => void }[]): THREE.Mesh {
  const skyGeom = new THREE.SphereGeometry(96, 32, 20);
  disposables.push(skyGeom);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: {
        value: new THREE.Vector3(
          MARS_SUN_DIRECTION.x,
          MARS_SUN_DIRECTION.y,
          MARS_SUN_DIRECTION.z
        ),
      },
      uZenithColor: { value: new THREE.Color(MARS_ATMOSPHERE_PALETTE.zenithColorHex) },
      uMidSkyColor: { value: new THREE.Color(MARS_ATMOSPHERE_PALETTE.midSkyColorHex) },
      uHorizonColor: { value: new THREE.Color(MARS_ATMOSPHERE_PALETTE.horizonColorHex) },
      uGroundColor: { value: new THREE.Color(MARS_ATMOSPHERE_PALETTE.groundBounceHex) },
    },
    vertexShader: `
      varying vec3 vLocalDir;
      void main() {
        vLocalDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      varying vec3 vLocalDir;

      void main() {
        vec3 dir = normalize(vLocalDir);
        float h = dir.y;

        // Clear Martian atmospheric vertical profile (deep starry cosmos -> dusty twilight -> butterscotch horizon)
        float lowBand = smoothstep(-0.02, 0.08, h);
        float midBand = smoothstep(0.05, 0.19, h);
        float highBand = smoothstep(0.14, 0.40, h);

        vec3 skyCol = mix(uGroundColor, uHorizonColor, lowBand);
        skyCol = mix(skyCol, uMidSkyColor, midBand);
        skyCol = mix(skyCol, uZenithColor, highBand);

        // Warm atmospheric horizon band brightening near solar azimuth
        float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
        float horizonGlow = (1.0 - smoothstep(0.0, 0.22, max(0.0, h))) * smoothstep(-0.04, 0.03, h);
        skyCol += vec3(0.24, 0.11, 0.05) * horizonGlow * (0.45 + 0.55 * pow(sunDot, 2.0));

        // Signature Mars pale silver-blue Mie solar aureole around the distant Sun
        float mieHalo = pow(sunDot, 14.0) * 0.42 + pow(sunDot, 85.0) * 0.62;
        skyCol += vec3(0.74, 0.88, 0.99) * mieHalo * smoothstep(-0.04, 0.10, h);

        // Faint diagonal Milky Way cosmic band high in the clear Martian sky
        float mwAxis = abs(dir.x * 0.52 + dir.y * 0.48 - dir.z * 0.70);
        float mwBand = exp(-mwAxis * mwAxis * 14.0) * smoothstep(0.11, 0.36, h);
        float mwGrain = 0.72 + 0.28 * sin(dir.x * 31.0 + dir.z * 25.0) * cos(dir.y * 29.0);
        skyCol += vec3(0.11, 0.14, 0.23) * mwBand * mwGrain;

        gl_FragColor = vec4(skyCol, 1.0);
      }
    `,
  });
  disposables.push(skyMat);

  const skyDome = new THREE.Mesh(skyGeom, skyMat);
  skyDome.name = 'MarsAtmosphericSkyDome';
  skyDome.renderOrder = -10;
  return skyDome;
}

/**
 * Creates a static, zero-CPU crisp starfield across the upper Martian sky hemisphere.
 */
function createStaticStarfield(
  count: number,
  disposables: { dispose: () => void }[]
): THREE.Points {
  const rand = createSeededRandom(88421);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const palette = [
    new THREE.Color(0xe0f2fe), // Blue-white hot star
    new THREE.Color(0xf8fafc), // Crisp white star
    new THREE.Color(0xfef3c7), // Solar yellow-white
    new THREE.Color(0xfed7aa), // Amber giant
  ];

  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    // Populate stars starting just above the crater rim (u >= 0.07) up to the zenith
    const u = 0.07 + Math.pow(rand(), 0.78) * 0.91;
    const phi = Math.acos(u);
    const radius = 88.0;

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const col = palette[i % palette.length];
    const brightness = (0.55 + rand() * 0.45) * Math.min(1, (u - 0.04) * 3.2);
    colors[i * 3] = col.r * brightness;
    colors[i * 3 + 1] = col.g * brightness;
    colors[i * 3 + 2] = col.b * brightness;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  disposables.push(geom);

  const mat = new THREE.PointsMaterial({
    size: 2.35,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    fog: false,
  });
  disposables.push(mat);

  const stars = new THREE.Points(geom, mat);
  stars.name = 'MarsCrispStarfield';
  stars.renderOrder = -9;
  return stars;
}

export interface MarsCelestialSystem {
  group: THREE.Group;
  update: (delta: number, time: number, robotPos: THREE.Vector3, envMap: EnvironmentMap) => void;
  dispose: () => void;
}

export function createMarsCelestialSystem(isSoftwareGl = false): MarsCelestialSystem {
  const group = new THREE.Group();
  group.name = 'MarsCelestialSystem';

  const disposables: { dispose: () => void }[] = [];

  // Infinity-centered skybox sub-group (tracks robot position 1:1 so horizon never shifts)
  const infinitySkyGroup = new THREE.Group();
  infinitySkyGroup.name = 'MarsInfinitySkyGroup';
  const skyDome = createMarsSkyDome(disposables);
  const starfield = createStaticStarfield(isSoftwareGl ? 380 : 760, disposables);
  infinitySkyGroup.add(skyDome);
  infinitySkyGroup.add(starfield);
  group.add(infinitySkyGroup);

  // Celestial objects sub-group at outer orbital depth (40m - 72m)
  const orbitersGroup = new THREE.Group();
  orbitersGroup.name = 'MarsOrbitersGroup';
  group.add(orbitersGroup);

  // ====================================================================
  // 1. EARTH & THE MOON (Trái Đất & Mặt Trăng nhìn từ quỹ đạo Sao Hỏa)
  // ====================================================================
  const earthGroup = new THREE.Group();
  earthGroup.position.set(-28.0, 14.5, -44.0);

  const earthTex = createEarthTexture();
  disposables.push(earthTex);

  const earthGeom = new THREE.SphereGeometry(1.55, 32, 24);
  disposables.push(earthGeom);

  const earthMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    roughness: 0.65,
    metalness: 0.12,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.25,
    fog: false,
  });
  disposables.push(earthMat);
  const earthMesh = new THREE.Mesh(earthGeom, earthMat);
  earthGroup.add(earthMesh);

  const earthAtmosphereGeom = new THREE.SphereGeometry(1.66, 24, 18);
  disposables.push(earthAtmosphereGeom);
  const earthAtmosphereMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.34,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  disposables.push(earthAtmosphereMat);
  earthGroup.add(new THREE.Mesh(earthAtmosphereGeom, earthAtmosphereMat));

  const moonGeom = new THREE.SphereGeometry(0.38, 16, 12);
  disposables.push(moonGeom);
  const moonMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.9,
    emissive: 0xffffff,
    emissiveIntensity: 0.2,
    fog: false,
  });
  disposables.push(moonMat);
  const moonMesh = new THREE.Mesh(moonGeom, moonMat);
  moonMesh.position.set(3.4, 0.5, 1.0);
  earthGroup.add(moonMesh);

  orbitersGroup.add(earthGroup);

  // ====================================================================
  // 2. JUPITER & GALILEAN MOONS (Sao Mộc & các mặt trăng Galilean)
  // ====================================================================
  const jupiterGroup = new THREE.Group();
  jupiterGroup.position.set(34.0, 15.5, -38.0);

  const jupiterTex = createJupiterTexture();
  disposables.push(jupiterTex);

  const jupiterGeom = new THREE.SphereGeometry(2.35, 32, 24);
  disposables.push(jupiterGeom);

  const jupiterMat = new THREE.MeshStandardMaterial({
    map: jupiterTex,
    roughness: 0.8,
    metalness: 0.05,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.2,
    fog: false,
  });
  disposables.push(jupiterMat);
  const jupiterMesh = new THREE.Mesh(jupiterGeom, jupiterMat);
  jupiterMesh.rotation.z = 0.05;
  jupiterGroup.add(jupiterMesh);

  const jupiterAtmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.46, 24, 18),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  disposables.push(jupiterAtmosphere.geometry as THREE.BufferGeometry);
  disposables.push(jupiterAtmosphere.material as THREE.Material);
  jupiterGroup.add(jupiterAtmosphere);

  const galileanMoons: { mesh: THREE.Mesh; dist: number; speed: number; angle: number }[] = [];
  const gMoonData = [
    { dist: 3.8, size: 0.16, color: 0xfde047, speed: 0.85 },
    { dist: 5.0, size: 0.14, color: 0xe0f2fe, speed: 0.58 },
    { dist: 6.4, size: 0.2, color: 0xd1d5db, speed: 0.36 },
  ];
  gMoonData.forEach((gm) => {
    const mGeom = new THREE.SphereGeometry(gm.size, 12, 10);
    disposables.push(mGeom);
    const mMat = new THREE.MeshBasicMaterial({ color: gm.color, fog: false });
    disposables.push(mMat);
    const mMesh = new THREE.Mesh(mGeom, mMat);
    jupiterGroup.add(mMesh);
    galileanMoons.push({
      mesh: mMesh,
      dist: gm.dist,
      speed: gm.speed,
      angle: Math.random() * Math.PI * 2,
    });
  });

  orbitersGroup.add(jupiterGroup);

  // ====================================================================
  // 3. PHOBOS & DEIMOS (Hai vệ tinh tự nhiên của Sao Hỏa ở cự ly thiên văn)
  // ====================================================================
  const { map: phobosMap, bumpMap: phobosBump } = createPhobosMaps();
  disposables.push(phobosMap, phobosBump);

  const phobosGeom = new THREE.DodecahedronGeometry(1.15, 2);
  const pAttr = phobosGeom.attributes.position;
  for (let i = 0; i < pAttr.count; i++) {
    const vx = pAttr.getX(i);
    const vy = pAttr.getY(i);
    const vz = pAttr.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;
    const potato = 1.0 + 0.12 * Math.sin(nx * 3.1 + ny * 2.4) - 0.08 * Math.cos(nz * 4.0);
    pAttr.setXYZ(i, vx * 1.28 * potato, vy * 0.92 * potato, vz * 0.88 * potato);
  }
  phobosGeom.computeVertexNormals();
  disposables.push(phobosGeom);

  const phobosMat = new THREE.MeshStandardMaterial({
    map: phobosMap,
    bumpMap: phobosBump,
    bumpScale: 0.08,
    roughness: 0.94,
    metalness: 0.04,
    emissive: 0x261d19,
    emissiveIntensity: 0.24,
    fog: false,
  });
  disposables.push(phobosMat);

  const phobosMesh = new THREE.Mesh(phobosGeom, phobosMat);
  phobosMesh.position.set(-14.0, 12.2, -38.0);
  orbitersGroup.add(phobosMesh);

  const deimosGeom = new THREE.DodecahedronGeometry(0.45, 1);
  disposables.push(deimosGeom);
  const deimosMat = new THREE.MeshStandardMaterial({
    color: 0xc2b6aa,
    roughness: 0.92,
    emissive: 0x3b2c25,
    emissiveIntensity: 0.28,
    fog: false,
  });
  disposables.push(deimosMat);
  const deimosMesh = new THREE.Mesh(deimosGeom, deimosMat);
  deimosMesh.position.set(14.0, 15.0, -44.0);
  orbitersGroup.add(deimosMesh);

  // ====================================================================
  // 4. MARTIAN SUN (Aligned with MARS_SUN_DIRECTION & sky dome aureole)
  // ====================================================================
  const sunGroup = new THREE.Group();
  const sunDistance = 74.0;
  sunGroup.position.set(
    MARS_SUN_DIRECTION.x * sunDistance,
    MARS_SUN_DIRECTION.y * sunDistance,
    MARS_SUN_DIRECTION.z * sunDistance
  );

  const sunGeom = new THREE.SphereGeometry(1.55, 24, 16);
  disposables.push(sunGeom);
  const sunMat = new THREE.MeshBasicMaterial({
    color: 0xf8fbff,
    fog: false,
  });
  disposables.push(sunMat);
  sunGroup.add(new THREE.Mesh(sunGeom, sunMat));

  // Cool pale-blue Martian solar corona sprite (camera-facing automatically!)
  const sunHaloCanvas = document.createElement('canvas');
  sunHaloCanvas.width = 128;
  sunHaloCanvas.height = 128;
  const sctx = sunHaloCanvas.getContext('2d')!;
  const sGrad = sctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  sGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  sGrad.addColorStop(0.18, 'rgba(204, 232, 255, 0.7)');
  sGrad.addColorStop(0.48, 'rgba(135, 198, 245, 0.25)');
  sGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  sctx.fillStyle = sGrad;
  sctx.fillRect(0, 0, 128, 128);
  const sunHaloTex = new THREE.CanvasTexture(sunHaloCanvas);
  disposables.push(sunHaloTex);

  const sunHaloMat = new THREE.SpriteMaterial({
    map: sunHaloTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  disposables.push(sunHaloMat);
  const sunHaloSprite = new THREE.Sprite(sunHaloMat);
  sunHaloSprite.scale.set(14.0, 14.0, 1);
  sunGroup.add(sunHaloSprite);

  orbitersGroup.add(sunGroup);

  // ====================================================================
  // 5. ASTEROID BELT CLUSTERS (Outer sky belt beyond crater rim)
  // ====================================================================
  const asteroids: Asteroid[] = [];
  const asteroidCount = isSoftwareGl ? 6 : 12;

  const sharedAsteroidMat = new THREE.MeshStandardMaterial({
    color: 0x78716c,
    roughness: 0.92,
    metalness: 0.22,
    fog: false,
  });
  disposables.push(sharedAsteroidMat);

  const rustAsteroidMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.94,
    metalness: 0.14,
    fog: false,
  });
  disposables.push(rustAsteroidMat);

  const astRand = createSeededRandom(66103);
  for (let i = 0; i < asteroidCount; i++) {
    const baseRadius = 0.45 + astRand() * 0.65;
    const geom = new THREE.DodecahedronGeometry(baseRadius, 1);
    disposables.push(geom);

    const posAttr = geom.attributes.position;
    for (let v = 0; v < posAttr.count; v++) {
      const vx = posAttr.getX(v);
      const vy = posAttr.getY(v);
      const vz = posAttr.getZ(v);
      const noise = 1.0 + (astRand() - 0.5) * 0.28;
      posAttr.setXYZ(v, vx * noise, vy * noise, vz * noise);
    }
    geom.computeVertexNormals();

    const mat = astRand() > 0.4 ? sharedAsteroidMat : rustAsteroidMat;
    const aMesh = new THREE.Mesh(geom, mat);
    aMesh.scale.set(1.0 + astRand() * 0.5, 0.8 + astRand() * 0.4, 0.9 + astRand() * 0.6);

    const orbitRadius = 32.0 + astRand() * 18.0;
    const orbitAngle = (i / asteroidCount) * Math.PI * 2 + astRand() * 0.5;
    const orbitHeight = 16.0 + astRand() * 14.0;

    aMesh.position.set(
      Math.cos(orbitAngle) * orbitRadius,
      orbitHeight,
      Math.sin(orbitAngle) * orbitRadius
    );

    orbitersGroup.add(aMesh);

    asteroids.push({
      mesh: aMesh,
      rotSpeedX: (astRand() - 0.5) * 0.7,
      rotSpeedY: (astRand() - 0.5) * 0.7,
      rotSpeedZ: (astRand() - 0.5) * 0.7,
      orbitRadius,
      orbitAngle,
      orbitSpeed: (0.012 + astRand() * 0.02) * (astRand() > 0.5 ? 1 : -1),
      orbitHeight,
    });
  }

  // ====================================================================
  // 6. HIGH-ALTITUDE SHOOTING METEOR TRAILS
  // ====================================================================
  const METEOR_COUNT = 3;
  const meteors: MeteorTrail[] = [];

  const meteorHeadCanvas = document.createElement('canvas');
  meteorHeadCanvas.width = 32;
  meteorHeadCanvas.height = 32;
  const mhctx = meteorHeadCanvas.getContext('2d')!;
  const mhGrad = mhctx.createRadialGradient(16, 16, 2, 16, 16, 16);
  mhGrad.addColorStop(0, 'rgba(255, 255, 240, 1.0)');
  mhGrad.addColorStop(0.3, 'rgba(251, 146, 60, 0.9)');
  mhGrad.addColorStop(1, 'rgba(225, 29, 72, 0)');
  mhctx.fillStyle = mhGrad;
  mhctx.fillRect(0, 0, 32, 32);
  const meteorHeadTex = new THREE.CanvasTexture(meteorHeadCanvas);
  disposables.push(meteorHeadTex);

  const meteorHeadMat = new THREE.SpriteMaterial({
    map: meteorHeadTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    fog: false,
  });
  disposables.push(meteorHeadMat);

  for (let m = 0; m < METEOR_COUNT; m++) {
    const head = new THREE.Sprite(meteorHeadMat);
    head.scale.set(0.85, 0.85, 1);
    head.visible = false;
    orbitersGroup.add(head);

    const TRAIL_POINTS = 8;
    const positions = new Float32Array(TRAIL_POINTS * 3);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    disposables.push(lineGeom);

    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfdba74,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    disposables.push(lineMat);

    const tailLine = new THREE.Line(lineGeom, lineMat);
    tailLine.visible = false;
    orbitersGroup.add(tailLine);

    meteors.push({
      headMesh: head,
      tailLine,
      positions,
      active: false,
      startX: 0,
      startY: 0,
      startZ: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1.2,
    });
  }

  let meteorSpawnTimer = 0;

  const triggerMeteor = () => {
    const m = meteors.find((item) => !item.active);
    if (!m) return;

    m.active = true;
    m.life = 0;
    m.maxLife = 1.0 + Math.random() * 0.7;

    m.startX = (Math.random() - 0.5) * 48.0;
    m.startY = 26.0 + Math.random() * 12.0;
    m.startZ = -34.0 - Math.random() * 20.0;

    const speed = 26.0 + Math.random() * 14.0;
    m.vx = speed * (0.55 + Math.random() * 0.4);
    m.vy = speed * (-0.45 - Math.random() * 0.25);
    m.vz = speed * 0.25;

    m.headMesh.position.set(m.startX, m.startY, m.startZ);
    m.headMesh.visible = true;
    m.tailLine.visible = true;

    for (let i = 0; i < 8; i++) {
      m.positions[i * 3] = m.startX;
      m.positions[i * 3 + 1] = m.startY;
      m.positions[i * 3 + 2] = m.startZ;
    }
    m.tailLine.geometry.attributes.position.needsUpdate = true;
  };

  // ====================================================================
  // 7. MARS RECONNAISSANCE ORBITER SATELLITE
  // ====================================================================
  const orbiterGroup = new THREE.Group();
  orbiterGroup.position.set(0, 26.0, -24.0);

  const satBodyGeom = new THREE.BoxGeometry(0.45, 0.35, 0.35);
  disposables.push(satBodyGeom);
  const satBodyMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.15,
    emissive: 0x78350f,
    emissiveIntensity: 0.2,
    fog: false,
  });
  disposables.push(satBodyMat);
  orbiterGroup.add(new THREE.Mesh(satBodyGeom, satBodyMat));

  const dishGeom = new THREE.ConeGeometry(0.3, 0.14, 16, 1, true);
  dishGeom.rotateX(Math.PI / 2);
  disposables.push(dishGeom);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.8,
    roughness: 0.3,
    side: THREE.DoubleSide,
    fog: false,
  });
  disposables.push(dishMat);
  const dish = new THREE.Mesh(dishGeom, dishMat);
  dish.position.set(0, -0.2, 0.18);
  orbiterGroup.add(dish);

  const satPanelGeom = new THREE.BoxGeometry(1.4, 0.02, 0.4);
  disposables.push(satPanelGeom);
  const satPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    metalness: 0.7,
    roughness: 0.2,
    emissive: 0x1e40af,
    emissiveIntensity: 0.3,
    fog: false,
  });
  disposables.push(satPanelMat);
  orbiterGroup.add(new THREE.Mesh(satPanelGeom, satPanelMat));

  const satBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x10b981, fog: false })
  );
  disposables.push(satBeacon.geometry as THREE.BufferGeometry);
  disposables.push(satBeacon.material as THREE.Material);
  satBeacon.position.set(0, 0.22, 0);
  orbiterGroup.add(satBeacon);

  orbitersGroup.add(orbiterGroup);

  const update = (
    delta: number,
    time: number,
    robotPos: THREE.Vector3,
    envMap: EnvironmentMap
  ) => {
    const isMars = envMap === 'mars-planet';
    group.visible = isMars;
    if (!isMars) return;

    // Sky dome & stars stay centered on viewer/robot so horizon is invariant at infinity
    infinitySkyGroup.position.set(robotPos.x, 0, robotPos.z);
    orbitersGroup.position.set(robotPos.x * 0.2, 0, robotPos.z * 0.2);

    earthMesh.rotation.y += delta * 0.08;
    const moonAngle = time * 0.25;
    moonMesh.position.x = Math.cos(moonAngle) * 3.4;
    moonMesh.position.z = Math.sin(moonAngle) * 3.4;
    moonMesh.position.y = Math.sin(moonAngle * 0.5) * 0.75;

    jupiterMesh.rotation.y += delta * 0.05;
    galileanMoons.forEach((gm) => {
      gm.angle += gm.speed * delta * 0.3;
      gm.mesh.position.x = Math.cos(gm.angle) * gm.dist;
      gm.mesh.position.z = Math.sin(gm.angle) * gm.dist * 0.4;
      gm.mesh.position.y = Math.sin(gm.angle) * 0.32;
    });

    // Subtle tidal rotation & sky arc for Phobos and Deimos
    phobosMesh.rotation.y += delta * 0.06;
    deimosMesh.rotation.y += delta * 0.03;

    asteroids.forEach((a) => {
      a.mesh.rotation.x += a.rotSpeedX * delta;
      a.mesh.rotation.y += a.rotSpeedY * delta;
      a.mesh.rotation.z += a.rotSpeedZ * delta;

      a.orbitAngle += a.orbitSpeed * delta * 0.14;
      a.mesh.position.x = Math.cos(a.orbitAngle) * a.orbitRadius;
      a.mesh.position.z = Math.sin(a.orbitAngle) * a.orbitRadius;
      a.mesh.position.y = a.orbitHeight + Math.sin(time * 0.35 + a.orbitAngle) * 0.5;
    });

    meteorSpawnTimer += delta;
    if (meteorSpawnTimer >= 4.2) {
      meteorSpawnTimer = 0;
      triggerMeteor();
    }

    meteors.forEach((m) => {
      if (!m.active) return;
      m.life += delta;
      if (m.life >= m.maxLife) {
        m.active = false;
        m.headMesh.visible = false;
        m.tailLine.visible = false;
        return;
      }

      const curX = m.startX + m.vx * m.life;
      const curY = m.startY + m.vy * m.life;
      const curZ = m.startZ + m.vz * m.life;
      m.headMesh.position.set(curX, curY, curZ);

      const progress = m.life / m.maxLife;
      const alpha = Math.max(0, 1.0 - progress);
      (m.tailLine.material as THREE.LineBasicMaterial).opacity = alpha * 0.85;

      const pts = m.positions;
      for (let i = 7; i > 0; i--) {
        pts[i * 3] = pts[(i - 1) * 3];
        pts[i * 3 + 1] = pts[(i - 1) * 3 + 1];
        pts[i * 3 + 2] = pts[(i - 1) * 3 + 2];
      }
      pts[0] = curX;
      pts[1] = curY;
      pts[2] = curZ;
      m.tailLine.geometry.attributes.position.needsUpdate = true;
    });

    const satAngle = time * 0.065;
    const satRadius = 26.0;
    orbiterGroup.position.x = Math.sin(satAngle) * satRadius;
    orbiterGroup.position.z = Math.cos(satAngle) * satRadius - 18.0;
    orbiterGroup.position.y = 14.5 + Math.sin(time * 0.2) * 0.6;
    orbiterGroup.rotation.y = satAngle + Math.PI / 2;

    satBeacon.visible = Math.floor(time * 3.3) % 2 === 0;
  };

  const dispose = () => {
    disposables.forEach((d) => {
      try {
        d.dispose();
      } catch {
        // Safe disposal
      }
    });
  };

  return {
    group,
    update,
    dispose,
  };
}
