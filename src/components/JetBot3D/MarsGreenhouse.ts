import * as THREE from 'three';
import { MARS_GREENHOUSE_SPEC } from './marsAtmosphereMath';
import {
  AirlockActorSample,
  createInitialAirlockState,
  GreenhouseAirlockState,
  stepGreenhouseAirlock,
  worldToGreenhouseLocal,
} from './marsGreenhouseAirlock';
import { robotAudio } from './audioSynth';

export interface MarsGreenhouseResult {
  group: THREE.Group;
  center: THREE.Vector2;
  collisionRadius: number;
  getAirlockState: () => GreenhouseAirlockState;
  update: (delta: number, elapsedTime: number, worldActors?: readonly { id: string; x: number; z: number }[]) => GreenhouseAirlockState;
  dispose: () => void;
}

/**
 * Builds a multi-part pressurized Mars Hydroponic Vegetable Greenhouse
 * ("Nhà Kính Trồng Rau Sao Hỏa") featuring:
 * - An elongated 2-door Pressurized Airlock & Perchlorate Dust Mitigation (Air-Shower) Chamber
 * - Clear arched glass vault with full-spectrum purple/pink horticultural LED strips along the ribs
 * - Drivable center aisle flanked by raised hydroponic vegetable beds (lettuce, tomatoes, strawberries, peppers)
 * - External water/CO2 tanks, photovoltaic solar array, and rotating rooftop climate fan
 */
export function createMarsGreenhouse(isSoftwareGl = false): MarsGreenhouseResult {
  const group = new THREE.Group();
  group.name = 'MarsVegetableGreenhouse';
  group.position.set(MARS_GREENHOUSE_SPEC.x, 0, MARS_GREENHOUSE_SPEC.z);
  group.rotation.y = MARS_GREENHOUSE_SPEC.rotationY;

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  let airlockState = createInitialAirlockState();

  // ================================================================
  // 1. SHARED PBR MATERIALS (varied roughness & metalness)
  // ================================================================
  const concreteMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.88,
      metalness: 0.14,
      envMapIntensity: 0.35,
    })
  );
  const hullWhiteMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.44,
      metalness: 0.22,
      envMapIntensity: 0.45,
    })
  );
  const titaniumMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.3,
      metalness: 0.8,
      envMapIntensity: 0.65,
    })
  );
  const doorArmorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.34,
      metalness: 0.82,
      envMapIntensity: 0.65,
    })
  );
  const aluminumPipeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.24,
      metalness: 0.86,
      envMapIntensity: 0.75,
    })
  );
  const copperTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.28,
      metalness: 0.84,
      envMapIntensity: 0.65,
    })
  );
  const troughMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.34,
      metalness: 0.18,
    })
  );
  const soilMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x2b1b12,
      roughness: 0.94,
      metalness: 0.02,
    })
  );
  const stakeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.85,
      metalness: 0.05,
    })
  );
  const stemMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.72,
      metalness: 0.04,
    })
  );
  const tankBlueMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.28,
      metalness: 0.45,
      envMapIntensity: 0.55,
    })
  );

  // Procedural photovoltaic solar cell grid texture
  const solarCanvas = document.createElement('canvas');
  solarCanvas.width = 256;
  solarCanvas.height = 256;
  const sctx = solarCanvas.getContext('2d')!;
  sctx.fillStyle = '#0f2357';
  sctx.fillRect(0, 0, 256, 256);
  sctx.fillStyle = '#17347a';
  for (let gx = 6; gx < 256; gx += 32) {
    for (let gy = 6; gy < 256; gy += 32) {
      sctx.fillRect(gx, gy, 24, 24);
    }
  }
  sctx.strokeStyle = '#94a3b8';
  sctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    sctx.beginPath();
    sctx.moveTo(i, 0);
    sctx.lineTo(i, 256);
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(0, i);
    sctx.lineTo(256, i);
    sctx.stroke();
  }
  const solarTex = track(new THREE.CanvasTexture(solarCanvas));
  solarTex.colorSpace = THREE.SRGBColorSpace;
  const solarMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: solarTex,
      roughness: 0.36,
      metalness: 0.32,
      envMapIntensity: 0.45,
    })
  );

  // Full-spectrum purple/pink horticultural grow LEDs (authentic Martian low-solar-flux agriculture)
  const growLightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfaf5ff,
      emissive: 0xd946ef,
      emissiveIntensity: 1.75,
      roughness: 0.18,
    })
  );
  const archLedMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfdf4ff,
      emissive: 0xec4899,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    })
  );

  // Dynamic airlock status indicator material (shifts idle -> red -> amber -> green)
  const airlockStatusMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x0d9488,
      emissiveIntensity: 1.25,
      roughness: 0.2,
    })
  );

  // ================================================================
  // 2. PROCEDURAL DECK FLOOR TEXTURE & REINFORCED FOUNDATION PAD
  // ================================================================
  const padShape = new THREE.Shape();
  const pw = 1.16;
  const pd = 1.42;
  const chamfer = 0.24;
  padShape.moveTo(-pw + chamfer, -pd);
  padShape.lineTo(pw - chamfer, -pd);
  padShape.lineTo(pw, -pd + chamfer);
  padShape.lineTo(pw, pd - chamfer);
  padShape.lineTo(pw - chamfer, pd);
  padShape.lineTo(-pw + chamfer, pd);
  padShape.lineTo(-pw, pd - chamfer);
  padShape.lineTo(-pw, -pd + chamfer);
  padShape.closePath();

  const padGeom = track(
    new THREE.ExtrudeGeometry(padShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.025,
      bevelSegments: 2,
    })
  );
  padGeom.rotateX(-Math.PI / 2);
  const padMesh = new THREE.Mesh(padGeom, concreteMat);
  padMesh.position.y = 0.015;
  padMesh.receiveShadow = !isSoftwareGl;
  group.add(padMesh);

  // Procedural interior laboratory walkway & bio-dome deck texture
  const deckCanvas = document.createElement('canvas');
  deckCanvas.width = 512;
  deckCanvas.height = 512;
  const dctx = deckCanvas.getContext('2d')!;
  dctx.fillStyle = '#334155';
  dctx.fillRect(0, 0, 512, 512);

  dctx.strokeStyle = '#475569';
  dctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 32) {
    dctx.beginPath();
    dctx.moveTo(i, 0);
    dctx.lineTo(i, 512);
    dctx.stroke();
    dctx.beginPath();
    dctx.moveTo(0, i);
    dctx.lineTo(512, i);
    dctx.stroke();
  }

  // Center agricultural corridor + safety guidance stripes
  dctx.fillStyle = '#1e293b';
  dctx.fillRect(172, 12, 168, 488);
  dctx.fillStyle = '#eab308';
  dctx.fillRect(166, 12, 7, 488);
  dctx.fillRect(339, 12, 7, 488);

  dctx.fillStyle = '#34d399';
  dctx.font = 'bold 19px monospace';
  dctx.textAlign = 'center';
  dctx.save();
  dctx.translate(256, 256);
  dctx.rotate(-Math.PI / 2);
  dctx.fillText('MARS BIO-DOME · RAU SẠCH 02', 0, 7);
  dctx.restore();

  const deckTex = track(new THREE.CanvasTexture(deckCanvas));
  deckTex.colorSpace = THREE.SRGBColorSpace;
  const deckGeom = track(new THREE.BoxGeometry(1.94, 0.02, 2.38));
  const deckMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: deckTex,
      roughness: 0.72,
      metalness: 0.25,
    })
  );
  const deckMesh = new THREE.Mesh(deckGeom, deckMat);
  deckMesh.position.y = 0.078;
  deckMesh.receiveShadow = !isSoftwareGl;
  group.add(deckMesh);

  // ================================================================
  // 3. INSULATED LOWER KNEE-WALLS & BULKHEADS
  // ================================================================
  const kneeWallGeom = track(new THREE.BoxGeometry(0.08, 0.22, 2.4));
  const sillTrimGeom = track(new THREE.BoxGeometry(0.11, 0.036, 2.44));
  [-0.96, 0.96].forEach((kx) => {
    const wall = new THREE.Mesh(kneeWallGeom, hullWhiteMat);
    wall.position.set(kx, 0.19, 0);
    wall.castShadow = !isSoftwareGl;
    wall.receiveShadow = !isSoftwareGl;
    group.add(wall);

    const sill = new THREE.Mesh(sillTrimGeom, titaniumMat);
    sill.position.set(kx, 0.305, 0);
    group.add(sill);
  });

  const rearLowerGeom = track(new THREE.BoxGeometry(2.0, 0.22, 0.08));
  const rearLower = new THREE.Mesh(rearLowerGeom, hullWhiteMat);
  rearLower.position.set(0, 0.19, -1.19);
  group.add(rearLower);

  // Front lower bulkhead flanking the 0.84m airlock doorway (leaves center X in [-0.42, +0.42] completely open!)
  const frontWingGeom = track(new THREE.BoxGeometry(0.56, 0.22, 0.08));
  [-0.72, 0.72].forEach((fx) => {
    const wing = new THREE.Mesh(frontWingGeom, hullWhiteMat);
    wing.position.set(fx, 0.19, 1.19);
    group.add(wing);
  });

  // ================================================================
  // 4. INTERIOR HYDROPONIC BEDS (WIDENED 0.84m DRIVABLE AISLE) & CROPS
  // ================================================================
  const troughGeom = track(new THREE.BoxGeometry(0.42, 0.11, 2.02));
  const soilGeom = track(new THREE.BoxGeometry(0.36, 0.035, 1.94));
  const legGeom = track(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 6));

  [-0.62, 0.62].forEach((bx) => {
    const trough = new THREE.Mesh(troughGeom, troughMat);
    trough.position.set(bx, 0.295, 0);
    trough.receiveShadow = !isSoftwareGl;
    group.add(trough);

    const soil = new THREE.Mesh(soilGeom, soilMat);
    soil.position.set(bx, 0.352, 0);
    group.add(soil);

    [
      [bx - 0.16, -0.85],
      [bx + 0.16, -0.85],
      [bx - 0.16, 0.85],
      [bx + 0.16, 0.85],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeom, titaniumMat);
      leg.position.set(lx, 0.165, lz);
      group.add(leg);
    });
  });

  // Upper elevated strawberry / herb racks tucked along outer walls
  const upperTrayGeom = track(new THREE.BoxGeometry(0.20, 0.055, 1.88));
  const upperSoilGeom = track(new THREE.BoxGeometry(0.16, 0.025, 1.8));
  const bracketGeom = track(new THREE.BoxGeometry(0.22, 0.02, 0.025));
  [-0.76, 0.76].forEach((ux) => {
    const uTray = new THREE.Mesh(upperTrayGeom, troughMat);
    uTray.position.set(ux, 0.56, -0.02);
    group.add(uTray);

    const uSoil = new THREE.Mesh(upperSoilGeom, soilMat);
    uSoil.position.set(ux, 0.588, -0.02);
    group.add(uSoil);

    [-0.75, 0, 0.75].forEach((bz) => {
      const br = new THREE.Mesh(bracketGeom, titaniumMat);
      br.position.set(ux + (ux < 0 ? 0.08 : -0.08), 0.525, bz);
      group.add(br);
    });
  });

  // --- CROP BATCH 1: Lush Leafy Lettuce & Bok Choy Rosettes (InstancedMesh) ---
  const lettuceGeom = track(new THREE.DodecahedronGeometry(0.068, 1));
  const lPos = lettuceGeom.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    const vx = lPos.getX(i);
    const vy = lPos.getY(i);
    const vz = lPos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const leafRuffle = 1.0 + 0.28 * Math.sin(ang * 5 + vy * 18) + 0.14 * Math.cos(ang * 3);
    lPos.setXYZ(i, vx * leafRuffle, Math.max(-0.025, vy * 0.68), vz * leafRuffle);
  }
  lettuceGeom.computeVertexNormals();

  const foliageMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.03,
      flatShading: true,
    })
  );

  const greenPalette = [
    new THREE.Color(0x22c55e),
    new THREE.Color(0x4ade80),
    new THREE.Color(0x16a34a),
    new THREE.Color(0x84cc16),
    new THREE.Color(0x15803d),
  ];

  const LEAF_COUNT = 64;
  const leafInstanced = track(new THREE.InstancedMesh(lettuceGeom, foliageMat, LEAF_COUNT));
  const dummy = new THREE.Object3D();
  let leafIdx = 0;

  for (const sideX of [-0.52, -0.70, 0.52, 0.70]) {
    for (let r = 0; r < 10; r++) {
      if (leafIdx >= LEAF_COUNT) break;
      const pz = -0.82 + r * 0.182;
      const isOuterTomatoRow = Math.abs(sideX) > 0.62;
      const scaleFactor = isOuterTomatoRow
        ? 1.05 + ((r * 7) % 3) * 0.1
        : 1.08 + ((r * 5) % 4) * 0.11;
      dummy.position.set(
        sideX + ((r % 2) - 0.5) * 0.02,
        isOuterTomatoRow ? 0.55 : 0.40,
        pz
      );
      dummy.rotation.set(0, r * 1.15 + sideX * 3.0, 0);
      dummy.scale.set(
        scaleFactor * 1.05,
        isOuterTomatoRow ? scaleFactor * 1.55 : scaleFactor * 0.94,
        scaleFactor * 1.05
      );
      dummy.updateMatrix();
      leafInstanced.setMatrixAt(leafIdx, dummy.matrix);
      leafInstanced.setColorAt(
        leafIdx,
        greenPalette[(leafIdx + (isOuterTomatoRow ? 2 : 0)) % greenPalette.length]
      );
      leafIdx++;
    }
  }

  for (const ux of [-0.76, 0.76]) {
    for (let r = 0; r < 12; r++) {
      if (leafIdx >= LEAF_COUNT) break;
      const pz = -0.82 + r * 0.15;
      dummy.position.set(ux, 0.625, pz);
      dummy.rotation.set(0, r * 0.9 + ux, 0);
      dummy.scale.set(0.75, 0.65, 0.75);
      dummy.updateMatrix();
      leafInstanced.setMatrixAt(leafIdx, dummy.matrix);
      leafInstanced.setColorAt(leafIdx, greenPalette[(r + 1) % 3]);
      leafIdx++;
    }
  }
  leafInstanced.count = leafIdx;
  leafInstanced.instanceMatrix.needsUpdate = true;
  if (leafInstanced.instanceColor) leafInstanced.instanceColor.needsUpdate = true;
  leafInstanced.computeBoundingSphere();
  group.add(leafInstanced);

  // --- CROP BATCH 2: Trellised Tomato Stakes & Stems ---
  const stakeGeom = track(new THREE.CylinderGeometry(0.008, 0.01, 0.34, 6));
  const stemGeom = track(new THREE.CylinderGeometry(0.011, 0.015, 0.25, 6));
  for (const tx of [-0.70, 0.70]) {
    for (let r = 0; r < 8; r++) {
      const pz = -0.78 + r * 0.22;
      const stake = new THREE.Mesh(stakeGeom, stakeMat);
      stake.position.set(tx - (tx < 0 ? 0.03 : -0.03), 0.52, pz);
      group.add(stake);

      const stem = new THREE.Mesh(stemGeom, stemMat);
      stem.position.set(tx, 0.48, pz);
      group.add(stem);
    }
  }

  // --- CROP BATCH 3: Bright Red Cherry Tomatoes, Strawberries & Golden Peppers (InstancedMesh) ---
  const fruitGeom = track(new THREE.SphereGeometry(0.027, 8, 8));
  const fruitMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.05,
    })
  );
  const fruitColors = [
    new THREE.Color(0xef4444),
    new THREE.Color(0xdc2626),
    new THREE.Color(0xfacc15),
    new THREE.Color(0xf97316),
  ];

  const FRUIT_COUNT = 56;
  const fruitInstanced = track(new THREE.InstancedMesh(fruitGeom, fruitMat, FRUIT_COUNT));
  let fIdx = 0;

  for (const tx of [-0.67, 0.67]) {
    for (let r = 0; r < 8; r++) {
      const pz = -0.78 + r * 0.22;
      for (let k = 0; k < 2; k++) {
        if (fIdx >= FRUIT_COUNT) break;
        dummy.position.set(
          tx + (k === 0 ? 0.03 : -0.02),
          0.49 + (k % 2) * 0.09,
          pz + (k === 0 ? 0.025 : -0.025)
        );
        dummy.rotation.set(0, 0, 0);
        const s = r % 3 === 1 ? 1.15 : 0.92;
        dummy.scale.set(s, r % 3 === 1 ? s * 1.25 : s, s);
        dummy.updateMatrix();
        fruitInstanced.setMatrixAt(fIdx, dummy.matrix);
        fruitInstanced.setColorAt(
          fIdx,
          r % 3 === 1 ? fruitColors[2 + (k % 2)] : fruitColors[k % 2]
        );
        fIdx++;
      }
    }
  }

  for (const ux of [-0.74, 0.74]) {
    for (let r = 0; r < 12; r++) {
      if (fIdx >= FRUIT_COUNT) break;
      const pz = -0.8 + r * 0.15;
      dummy.position.set(ux + (ux < 0 ? 0.04 : -0.04), 0.625, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.72, 0.88, 0.72);
      dummy.updateMatrix();
      fruitInstanced.setMatrixAt(fIdx, dummy.matrix);
      fruitInstanced.setColorAt(fIdx, fruitColors[1]);
      fIdx++;
    }
  }
  fruitInstanced.count = fIdx;
  fruitInstanced.instanceMatrix.needsUpdate = true;
  if (fruitInstanced.instanceColor) fruitInstanced.instanceColor.needsUpdate = true;
  fruitInstanced.computeBoundingSphere();
  group.add(fruitInstanced);

  // ================================================================
  // 5. FULL-SPECTRUM PURPLE/PINK GROW LED BARS, RIB LED STRIPS & PIPES
  // ================================================================
  const ledHousingGeom = track(new THREE.BoxGeometry(0.08, 0.022, 1.96));
  const ledStripGeom = track(new THREE.BoxGeometry(0.06, 0.014, 1.9));
  const pipeGeom = track(new THREE.CylinderGeometry(0.012, 0.012, 1.98, 8));
  pipeGeom.rotateX(Math.PI / 2);

  [-0.56, 0.56].forEach((gx) => {
    const housing = new THREE.Mesh(ledHousingGeom, titaniumMat);
    housing.position.set(gx, 0.94, 0);
    group.add(housing);

    const strip = new THREE.Mesh(ledStripGeom, growLightMat);
    strip.position.set(gx, 0.927, 0);
    group.add(strip);

    const sprayPipe = new THREE.Mesh(pipeGeom, aluminumPipeMat);
    sprayPipe.position.set(gx * 1.08, 0.77, 0);
    group.add(sprayPipe);
  });

  // Unshadowed interior magenta-pink botanical spectrum PointLight
  const interiorLight = new THREE.PointLight(0xf0abfc, 2.25, 5.2, 1.5);
  interiorLight.position.set(0, 0.96, 0);
  interiorLight.castShadow = false;
  if (!isSoftwareGl) {
    group.add(interiorLight);
  }

  // ================================================================
  // 6. TRANSPARENT ARCHED GLASS VAULT, RIBS & ARCH PURPLE LED STRIPS
  // ================================================================
  const glassMat = track(
    isSoftwareGl
      ? new THREE.MeshStandardMaterial({
          color: 0xe0e7ff,
          roughness: 0.14,
          metalness: 0.04,
          transparent: true,
          opacity: 0.21,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xe0e7ff,
          roughness: 0.08,
          metalness: 0.04,
          transparent: true,
          opacity: 0.24,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
          ior: 1.48,
          side: THREE.DoubleSide,
          depthWrite: false,
          envMapIntensity: 0.85,
        })
  );

  const vaultGeom = track(
    new THREE.CylinderGeometry(0.98, 0.98, 2.38, 28, 1, true, -Math.PI / 2, Math.PI)
  );
  vaultGeom.rotateX(-Math.PI / 2);
  const vaultGlass = new THREE.Mesh(vaultGeom, glassMat);
  vaultGlass.position.set(0, 0.3, 0);
  vaultGlass.renderOrder = 5;
  group.add(vaultGlass);

  // Rear glass gable (full semicircle at z = -1.19)
  const gableGlassGeom = track(new THREE.CircleGeometry(0.98, 28, 0, Math.PI));
  const rearGable = new THREE.Mesh(gableGlassGeom, glassMat);
  rearGable.position.set(0, 0.3, -1.19);
  rearGable.renderOrder = 5;
  group.add(rearGable);

  // Front gable glazed panels flanking the airlock roof collar
  const frontGableLeft = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.98, 14, 0, Math.PI * 0.34)),
    glassMat
  );
  frontGableLeft.position.set(0, 0.3, 1.19);
  frontGableLeft.renderOrder = 5;
  group.add(frontGableLeft);

  const frontGableRight = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.98, 14, Math.PI * 0.66, Math.PI * 0.34)),
    glassMat
  );
  frontGableRight.position.set(0, 0.3, 1.19);
  frontGableRight.renderOrder = 5;
  group.add(frontGableRight);

  // 5 Structural curved titanium arch ribs + glowing purple/pink LED horticulture strips underneath each rib
  const archRibGeom = track(new THREE.TorusGeometry(0.99, 0.022, 8, 28, Math.PI));
  const archLedGeom = track(new THREE.TorusGeometry(0.955, 0.011, 6, 28, Math.PI * 0.84));
  [-1.19, -0.595, 0, 0.595, 1.19].forEach((rz) => {
    const rib = new THREE.Mesh(archRibGeom, titaniumMat);
    rib.position.set(0, 0.3, rz);
    rib.castShadow = !isSoftwareGl;
    group.add(rib);

    const archLed = new THREE.Mesh(archLedGeom, archLedMat);
    archLed.position.set(0, 0.3, rz);
    archLed.rotation.z = Math.PI * 0.08;
    group.add(archLed);
  });

  const purlinGeom = track(new THREE.CylinderGeometry(0.015, 0.015, 2.42, 8));
  purlinGeom.rotateX(Math.PI / 2);
  [
    [0, 1.29],
    [-0.7, 1.0],
    [0.7, 1.0],
  ].forEach(([px, py]) => {
    const purlin = new THREE.Mesh(purlinGeom, aluminumPipeMat);
    purlin.position.set(px, py, 0);
    group.add(purlin);
  });

  const mullionGeom = track(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6));
  [-0.54, 0.54].forEach((mx) => {
    [-1.19, 1.19].forEach((mz) => {
      const mul = new THREE.Mesh(mullionGeom, titaniumMat);
      mul.position.set(mx, 0.72, mz);
      group.add(mul);
    });
  });

  // ================================================================
  // 7. ELONGATED 2-DOOR PRESSURIZED AIRLOCK & DUST-MITIGATION CHAMBER
  //    (z = +1.20 to z = +2.24, floor y = 0.088, outer ramp to +2.86)
  // ================================================================
  // Airlock continuous deck floor (seamlessly bridges garden z=1.20 to ramp z=2.24)
  const airlockFloorGeom = track(new THREE.BoxGeometry(0.92, 0.088, 1.08));
  const airlockFloor = new THREE.Mesh(airlockFloorGeom, concreteMat);
  airlockFloor.position.set(0, 0.044, 1.72);
  airlockFloor.receiveShadow = !isSoftwareGl;
  group.add(airlockFloor);

  const airlockCarpetGeom = track(new THREE.BoxGeometry(0.78, 0.008, 1.06));
  const airlockCarpet = new THREE.Mesh(airlockCarpetGeom, titaniumMat);
  airlockCarpet.position.set(0, 0.088, 1.72);
  group.add(airlockCarpet);

  // Side insulated lower walls + corner pillars + transparent glass viewing windows
  const sideBaseWallGeom = track(new THREE.BoxGeometry(0.075, 0.24, 1.08));
  const sideUpperBeamGeom = track(new THREE.BoxGeometry(0.075, 0.14, 1.08));
  const sideWindowGeom = track(new THREE.BoxGeometry(0.02, 0.40, 0.84));
  [-0.43, 0.43].forEach((ax) => {
    const baseWall = new THREE.Mesh(sideBaseWallGeom, hullWhiteMat);
    baseWall.position.set(ax, 0.20, 1.72);
    baseWall.castShadow = !isSoftwareGl;
    group.add(baseWall);

    const upperBeam = new THREE.Mesh(sideUpperBeamGeom, hullWhiteMat);
    upperBeam.position.set(ax, 0.73, 1.72);
    group.add(upperBeam);

    const win = new THREE.Mesh(sideWindowGeom, glassMat);
    win.position.set(ax, 0.50, 1.72);
    win.renderOrder = 6;
    group.add(win);
  });

  // Airlock ceiling canopy with upper bulkhead beams at inner (z=1.20) and outer (z=2.24) doorways
  const airlockRoofGeom = track(new THREE.BoxGeometry(0.94, 0.06, 1.12));
  const airlockRoof = new THREE.Mesh(airlockRoofGeom, hullWhiteMat);
  airlockRoof.position.set(0, 0.82, 1.72);
  airlockRoof.castShadow = !isSoftwareGl;
  group.add(airlockRoof);

  // Translucent skylight strip on airlock ceiling so top camera can see inside chamber too!
  const roofWindowGeom = track(new THREE.BoxGeometry(0.56, 0.07, 0.72));
  const roofWindow = new THREE.Mesh(roofWindowGeom, glassMat);
  roofWindow.position.set(0, 0.822, 1.72);
  roofWindow.renderOrder = 6;
  group.add(roofWindow);

  // Corner door portal columns + lintel frames at BOTH outer (z=2.24) and inner (z=1.20) doorways
  const portalPillarGeom = track(new THREE.BoxGeometry(0.09, 0.78, 0.08));
  const portalLintelGeom = track(new THREE.BoxGeometry(0.94, 0.14, 0.09));
  const statusBarGeom = track(new THREE.BoxGeometry(0.54, 0.05, 0.04));

  [1.20, 2.24].forEach((dz) => {
    [-0.43, 0.43].forEach((px) => {
      const p = new THREE.Mesh(portalPillarGeom, titaniumMat);
      p.position.set(px, 0.45, dz);
      group.add(p);
    });
    const lintel = new THREE.Mesh(portalLintelGeom, titaniumMat);
    lintel.position.set(0, 0.78, dz);
    group.add(lintel);

    // Status LED strip mounted on exterior/interior face of each portal lintel
    const barOut = new THREE.Mesh(statusBarGeom, airlockStatusMat);
    barOut.position.set(0, 0.78, dz + (dz > 1.8 ? 0.045 : -0.045));
    group.add(barOut);
  });

  // Helper: Build animated dual-leaf motorized blast door with glazed copper porthole halves
  const doorLeafGeom = track(new THREE.BoxGeometry(0.39, 0.62, 0.042));
  const doorTrimGeom = track(new THREE.BoxGeometry(0.03, 0.62, 0.052));
  const createSlidingDoor = (zPos: number) => {
    const leftLeaf = new THREE.Group();
    leftLeaf.position.set(-0.195, 0.40, zPos);
    const lPanel = new THREE.Mesh(doorLeafGeom, doorArmorMat);
    const lEdge = new THREE.Mesh(doorTrimGeom, copperTrimMat);
    lEdge.position.set(0.185, 0, 0);
    leftLeaf.add(lPanel, lEdge);
    group.add(leftLeaf);

    const rightLeaf = new THREE.Group();
    rightLeaf.position.set(0.195, 0.40, zPos);
    const rPanel = new THREE.Mesh(doorLeafGeom, doorArmorMat);
    const rEdge = new THREE.Mesh(doorTrimGeom, copperTrimMat);
    rEdge.position.set(-0.185, 0, 0);
    rightLeaf.add(rPanel, rEdge);
    group.add(rightLeaf);

    return {
      setOpen: (openFrac: number) => {
        const slideOffset = THREE.MathUtils.clamp(openFrac, 0, 1) * 0.36;
        leftLeaf.position.x = -0.195 - slideOffset;
        rightLeaf.position.x = 0.195 + slideOffset;
      },
    };
  };

  const innerDoor = createSlidingDoor(1.20);
  const outerDoor = createSlidingDoor(2.24);

  // Airlock interior purple-cyan work light + pressurization feedback beacon
  const chamberLight = new THREE.PointLight(0x38bdf8, 0.85, 2.2, 1.8);
  chamberLight.position.set(0, 0.74, 1.72);
  chamberLight.castShadow = false;
  if (!isSoftwareGl) {
    group.add(chamberLight);
  }

  // --- AIR-SHOWER DUST MITIGATION SYSTEM (Luồng khí thổi bụi Perchlorate) ---
  const airShowerGroup = new THREE.Group();
  airShowerGroup.position.set(0, 0, 1.72);
  const nozzleGeom = track(new THREE.CylinderGeometry(0.018, 0.028, 0.08, 8));
  const jetConeGeom = track(new THREE.ConeGeometry(0.14, 0.56, 12, 1, true));
  const jetMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const jetMeshes: THREE.Mesh[] = [];
  [
    [-0.28, -0.24, 0.22],
    [0.28, -0.24, -0.22],
    [-0.28, 0.24, 0.22],
    [0.28, 0.24, -0.22],
  ].forEach(([nx, nz, tiltZ]) => {
    const nozzle = new THREE.Mesh(nozzleGeom, aluminumPipeMat);
    nozzle.position.set(nx, 0.74, nz);
    nozzle.rotation.z = tiltZ;
    airShowerGroup.add(nozzle);

    const jet = new THREE.Mesh(jetConeGeom, jetMat);
    jet.position.set(nx * 0.55, 0.42, nz);
    jet.rotation.z = tiltZ * 0.65;
    jet.renderOrder = 7;
    airShowerGroup.add(jet);
    jetMeshes.push(jet);
  });

  // Animated air-shower compressed mist particles
  const SHOWER_PARTICLES = 44;
  const showerPositions = new Float32Array(SHOWER_PARTICLES * 3);
  const showerPhases = new Float32Array(SHOWER_PARTICLES);
  for (let i = 0; i < SHOWER_PARTICLES; i++) {
    showerPhases[i] = i / SHOWER_PARTICLES;
    showerPositions[i * 3] = ((i % 5) - 2) * 0.13;
    showerPositions[i * 3 + 1] = 0.12 + ((i * 7) % 10) * 0.06;
    showerPositions[i * 3 + 2] = (((i * 3) % 7) - 3) * 0.12;
  }
  const showerGeom = track(new THREE.BufferGeometry());
  showerGeom.setAttribute('position', new THREE.BufferAttribute(showerPositions, 3));
  const showerPointsMat = track(
    new THREE.PointsMaterial({
      color: 0xa5f3fc,
      size: 0.042,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const showerPoints = new THREE.Points(showerGeom, showerPointsMat);
  showerPoints.renderOrder = 8;
  airShowerGroup.add(showerPoints);
  group.add(airShowerGroup);

  // Continuous metallic access ramp flush from outer door (z=2.24, y=0.088) down to Mars surface (z=2.86, y=0)
  const rampLen = Math.hypot(0.64, 0.088);
  const rampGeom = track(new THREE.BoxGeometry(0.84, 0.032, rampLen));
  const ramp = new THREE.Mesh(rampGeom, titaniumMat);
  ramp.position.set(0, 0.034, 2.55);
  ramp.rotation.x = Math.atan2(0.088, 0.64);
  ramp.receiveShadow = !isSoftwareGl;
  group.add(ramp);

  // Yellow safety guidance rails flanking the outer entry ramp
  const rampRailGeom = track(new THREE.BoxGeometry(0.035, 0.04, 0.62));
  const railMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
      metalness: 0.45,
    })
  );
  [-0.42, 0.42].forEach((rx) => {
    const rail = new THREE.Mesh(rampRailGeom, railMat);
    rail.position.set(rx, 0.06, 2.54);
    rail.rotation.x = Math.atan2(0.088, 0.64);
    group.add(rail);
  });

  // ================================================================
  // 8. EXTERNAL WATER/O2 TANK, SOLAR ARRAY & ROOFTOP CLIMATE FAN
  // ================================================================
  const waterTankGeom = track(new THREE.CylinderGeometry(0.22, 0.22, 0.64, 16));
  const waterTank = new THREE.Mesh(waterTankGeom, tankBlueMat);
  waterTank.position.set(-0.38, 0.36, -1.46);
  waterTank.castShadow = !isSoftwareGl;
  group.add(waterTank);

  const tankCapGeom = track(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
  const tankCap = new THREE.Mesh(tankCapGeom, hullWhiteMat);
  tankCap.position.set(-0.38, 0.68, -1.46);
  group.add(tankCap);

  const tankBandGeom = track(new THREE.TorusGeometry(0.226, 0.015, 6, 18));
  tankBandGeom.rotateX(Math.PI / 2);
  const tankBand = new THREE.Mesh(tankBandGeom, copperTrimMat);
  tankBand.position.set(-0.38, 0.46, -1.46);
  group.add(tankBand);

  const feedPipeGeom = track(new THREE.CylinderGeometry(0.024, 0.024, 0.36, 8));
  feedPipeGeom.rotateX(Math.PI / 2);
  const feedPipe = new THREE.Mesh(feedPipeGeom, aluminumPipeMat);
  feedPipe.position.set(-0.38, 0.24, -1.32);
  group.add(feedPipe);

  const co2TankGeom = track(new THREE.CylinderGeometry(0.14, 0.14, 0.48, 12));
  const co2Tank = new THREE.Mesh(co2TankGeom, hullWhiteMat);
  co2Tank.position.set(0.32, 0.28, -1.44);
  co2Tank.castShadow = !isSoftwareGl;
  group.add(co2Tank);

  // Dual Solar Array Wing on +X flank
  const solarMastGeom = track(new THREE.CylinderGeometry(0.025, 0.032, 0.34, 8));
  const solarFrameGeom = track(new THREE.BoxGeometry(0.56, 0.018, 0.72));
  const solarCellGeom = track(new THREE.BoxGeometry(0.52, 0.022, 0.68));
  [-0.55, 0.45].forEach((sz) => {
    const mast = new THREE.Mesh(solarMastGeom, titaniumMat);
    mast.position.set(1.38, 0.17, sz);
    group.add(mast);

    const frame = new THREE.Mesh(solarFrameGeom, aluminumPipeMat);
    frame.position.set(1.38, 0.35, sz);
    frame.rotation.z = -0.38;
    group.add(frame);

    const cell = new THREE.Mesh(solarCellGeom, solarMat);
    cell.position.set(1.38, 0.354, sz);
    cell.rotation.z = -0.38;
    cell.castShadow = !isSoftwareGl;
    group.add(cell);
  });

  // Rooftop Climate-Control Cupola + Animated Ventilation Rotor
  const cupolaGeom = track(new THREE.CylinderGeometry(0.18, 0.22, 0.12, 16));
  const cupola = new THREE.Mesh(cupolaGeom, titaniumMat);
  cupola.position.set(0, 1.31, 0);
  group.add(cupola);

  const fanGroup = new THREE.Group();
  fanGroup.position.set(0, 1.38, 0);
  const fanHubGeom = track(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 10));
  const fanHub = new THREE.Mesh(fanHubGeom, copperTrimMat);
  fanGroup.add(fanHub);

  const fanBladeGeom = track(new THREE.BoxGeometry(0.24, 0.008, 0.045));
  for (let b = 0; b < 2; b++) {
    const blade = new THREE.Mesh(fanBladeGeom, aluminumPipeMat);
    blade.rotation.y = (b * Math.PI) / 2;
    blade.rotation.x = 0.22;
    fanGroup.add(blade);
  }
  group.add(fanGroup);

  const update = (
    delta: number,
    elapsedTime: number,
    worldActors: readonly { id: string; x: number; z: number }[] = []
  ): GreenhouseAirlockState => {
    fanGroup.rotation.y += delta * 3.8;
    growLightMat.emissiveIntensity = 1.65 + Math.sin(elapsedTime * 1.6) * 0.14;
    archLedMat.emissiveIntensity = 1.3 + Math.sin(elapsedTime * 1.6 + 0.8) * 0.14;

    const localActors: AirlockActorSample[] = worldActors.map((a) => {
      const { lx, lz } = worldToGreenhouseLocal(a.x, a.z);
      return { id: a.id, localX: lx, localZ: lz };
    });

    airlockState = stepGreenhouseAirlock(airlockState, localActors, delta);

    // Play subtle pneumatic & chime cues on state transitions
    if (airlockState.lastCycleAudioCue === 'airlock-purge') {
      robotAudio.playAirlockHiss(true);
    } else if (airlockState.lastCycleAudioCue === 'airlock-depressurize') {
      robotAudio.playAirlockHiss(false);
    } else if (airlockState.lastCycleAudioCue === 'door-open' && airlockState.statusColor === 'green') {
      robotAudio.playAirlockReadyChime();
    }

    // Drive smooth interlocked blast door motion
    outerDoor.setOpen(airlockState.outerDoorOpen);
    innerDoor.setOpen(airlockState.innerDoorOpen);

    // Drive airlock indicator beacon color: Red -> Amber -> Green
    if (airlockState.statusColor === 'red') {
      airlockStatusMat.color.setHex(0xfca5a5);
      airlockStatusMat.emissive.setHex(0xef4444);
      airlockStatusMat.emissiveIntensity = 1.55;
      chamberLight.color.setHex(0xef4444);
      chamberLight.intensity = 1.1;
    } else if (airlockState.statusColor === 'amber') {
      airlockStatusMat.color.setHex(0xfde68a);
      airlockStatusMat.emissive.setHex(0xf59e0b);
      airlockStatusMat.emissiveIntensity = 1.65 + Math.sin(elapsedTime * 12) * 0.25;
      chamberLight.color.setHex(0x38bdf8);
      chamberLight.intensity = 1.6;
    } else if (airlockState.statusColor === 'green') {
      airlockStatusMat.color.setHex(0xa7f3d0);
      airlockStatusMat.emissive.setHex(0x10b981);
      airlockStatusMat.emissiveIntensity = 1.5;
      chamberLight.color.setHex(0x10b981);
      chamberLight.intensity = 1.25;
    } else {
      airlockStatusMat.color.setHex(0x5eead4);
      airlockStatusMat.emissive.setHex(0x0d9488);
      airlockStatusMat.emissiveIntensity = 1.0;
      chamberLight.color.setHex(0x38bdf8);
      chamberLight.intensity = 0.6;
    }

    // Drive Dust-Mitigation Air-Shower Jets & Particles inside chamber
    if (airlockState.dustShowerActive) {
      jetMat.opacity = 0.24 + Math.sin(elapsedTime * 22) * 0.08;
      showerPointsMat.opacity = 0.85;
      const posAttr = showerGeom.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < SHOWER_PARTICLES; i++) {
        const ph = (showerPhases[i] + elapsedTime * 2.1) % 1;
        const angle = i * 1.4 + elapsedTime * 5.0;
        const spread = 0.08 + ph * 0.26;
        arr[i * 3] = Math.cos(angle) * spread;
        arr[i * 3 + 1] = 0.72 - ph * 0.62;
        arr[i * 3 + 2] = Math.sin(angle) * spread;
      }
      posAttr.needsUpdate = true;
    } else {
      jetMat.opacity = 0;
      showerPointsMat.opacity = 0;
    }

    return airlockState;
  };

  return {
    group,
    center: new THREE.Vector2(MARS_GREENHOUSE_SPEC.x, MARS_GREENHOUSE_SPEC.z),
    collisionRadius: MARS_GREENHOUSE_SPEC.collisionRadius,
    getAirlockState: () => airlockState,
    update,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
