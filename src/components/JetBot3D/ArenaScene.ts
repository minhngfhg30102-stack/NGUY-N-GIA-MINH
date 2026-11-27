import * as THREE from 'three';
import { robotAudio } from './audioSynth';
import { AstronautDigStatus, EnvironmentMap } from '../../types/robot';
import { createMarsSpaceshipHangar } from './MarsSpaceshipHangar';
import { createMarsGreenhouse, MarsGreenhouseResult } from './MarsGreenhouse';
import {
  buildRealisticMarsTerrain,
  ExclusionZone,
  MarsTerrainResult,
  sampleMarsFloorVertexColor,
} from './MarsTerrainBuilder';
import {
  ASTRONAUT_STOP_DISTANCE_METERS,
  canJetBotReceiveFromAstronaut,
} from '../Controls/excavationHelpers';
import {
  computeChassisTerrainPose,
  computeRockDustBlend,
  MARS_GREENHOUSE_SPEC,
  MarsClimbMoundSpec,
  resolveStaticDomePushout,
  sampleMarsTerrainPointElevation,
} from './marsAtmosphereMath';
import {
  classifyGreenhouseZone,
  createInitialAirlockState,
  describeAirlockForHud,
  greenhouseLocalToWorld,
  GreenhouseZone,
  resolveGreenhouseCollision,
  sampleGreenhouseElevationAt,
  worldToGreenhouseLocal,
} from './marsGreenhouseAirlock';

export interface ArenaObstacle {
  mesh: THREE.Group;
  center: THREE.Vector2;
  radius: number;
  label: string;
  type: 'cone' | 'crate' | 'beacon' | 'mars-rock' | 'mars-dome' | 'mars-mountain';
  isToppled: boolean;
  toppleAngle: number;
  maxToppleAngle: number;
  toppleAxis: THREE.Vector3;
  angularVel: number;
  initialPos: THREE.Vector3;
  initialRot: THREE.Euler;
  pivotOffset: number;
}

export interface AlienEntity {
  mesh: THREE.Group;
  center: THREE.Vector2;
  radius: number;
  name: string;
  type: 'scout' | 'tripod' | 'crawler' | 'overseer' | 'biped';
  speed: number;
  hoverHeight: number;
  orbitCenter: THREE.Vector2;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  eyeMesh?: THREE.Mesh;
  glowRing?: THREE.Mesh;
  legs?: { upper: THREE.Mesh; lower: THREE.Mesh; baseAngle: number }[];
  tentacles?: THREE.Mesh[];
  alertLevel: number;
  lastChirpTime: number;
  update: (delta: number, elapsedTime: number, robotPos: THREE.Vector3) => void;
}

export interface AstronautEntity {
  mesh: THREE.Group;
  center: THREE.Vector2;
  position: THREE.Vector3;
  radius: number;
  name: string;
  isFleeing: boolean;
  isWateringGreenhouse?: boolean;
  state: 'calm' | 'fleeing' | 'waving' | 'digging' | 'carrying' | 'ready-handoff' | 'watering';
  taskState: AstronautDigStatus;
  taskItemColorHex: number;
  nearestAlienDist: number;
  startDigTask: (robotPos: THREE.Vector3, itemColorHex: number, digDurationSec?: number) => void;
  startWateringShift?: () => void;
  completeReceiveTask: () => void;
  cancelTask: () => void;
  update: (delta: number, elapsedTime: number, aliens: AlienEntity[], robotPos: THREE.Vector3) => void;
}

export interface ClimbableMound {
  center: THREE.Vector2;
  radius: number;
  height: number;
  label: string;
}

export interface TerrainElevation {
  elevation: number;
  slopePitch: number;
  slopeRoll: number;
}

export interface ArenaEnvironment {
  group: THREE.Group;
  obstacles: ArenaObstacle[];
  climbableMounds?: ClimbableMound[];
  aliens: AlienEntity[];
  astronauts?: AstronautEntity[];
  mapType: EnvironmentMap;
  pointCloud: THREE.Points;
  getPointElevationAt?: (x: number, z: number) => number;
  getElevationAt?: (x: number, z: number, heading?: number) => TerrainElevation;
  resolveGreenhouseCollision?: (
    x: number,
    z: number,
    radius: number
  ) => { x: number; z: number; blocked: boolean; zone: GreenhouseZone };
  getGreenhouseStatus?: (
    robotX: number,
    robotZ: number
  ) => ReturnType<typeof describeAirlockForHud> | null;
  updatePointCloud: (robotPos: THREE.Vector3, robotHeading: number, _scanAngle: number) => { minObstacleDist: number; minAlienDist: number };
  updateObstaclesPhysics: (delta: number) => void;
  updateAliens: (delta: number, elapsedTime: number, robotPos: THREE.Vector3) => {
    nearestAlienDist: number;
    alienDetected: boolean;
    isCharging?: boolean;
    chargingBatteryLevel?: number;
    isAstronautFleeing?: boolean;
    astronautWatering?: boolean;
    astronautsCount?: number;
  };
  startAstronautDig?: (robotPos: THREE.Vector3, itemColorHex: number) => boolean;
  completeAstronautReceive?: () => { x: number; y: number; z: number } | null;
  cancelAstronautTask?: () => void;
  getAstronautTaskTelemetry?: (robotPos: THREE.Vector3) => {
    status: AstronautDigStatus;
    astronautName?: string;
    distanceToBot?: number;
    canReceiveZ: boolean;
    activePos?: { x: number; y: number; z: number };
  };
  checkAndToppleObstacles: (robotX: number, robotZ: number, speed: number) => boolean;
  resetAllObstacles: () => void;
  getToppledCount: () => { toppled: number; total: number };
  dispose?: () => void;
}

const _sharedQuat = new THREE.Quaternion();

export function buildArenaScene(isSoftwareGl = false, mapType: EnvironmentMap = 'cmu-arena'): ArenaEnvironment {
  const group = new THREE.Group();
  group.name = `ArenaEnvironment_${mapType}`;

  const obstacles: ArenaObstacle[] = [];
  const climbableMounds: ClimbableMound[] = [];
  const aliens: AlienEntity[] = [];
  const astronauts: AstronautEntity[] = [];
  let spaceshipHangar: ReturnType<typeof createMarsSpaceshipHangar> | null = null;
  let marsGreenhouse: MarsGreenhouseResult | null = null;
  let marsTerrain: MarsTerrainResult | null = null;
  const sceneDisposables: { dispose: () => void }[] = [];

  const closedGreenhouseAirlock = createInitialAirlockState();

  const clampActorOutsideStaticDomes = (x: number, z: number, actorRadius: number): { x: number; z: number } => {
    if (mapType !== 'mars-planet') return { x, z };
    const ghCol = resolveGreenhouseCollision(x, z, actorRadius, closedGreenhouseAirlock);
    const res = resolveStaticDomePushout(ghCol.x, ghCol.z, actorRadius, -5.8, 1.4, 1.15);
    return { x: res.x, z: res.z };
  };

  // ================================================================
  // 1. TERRAIN & ENVIRONMENT GROUND (EXPANDED 28m x 28m FOR VAST MARS EXPLORATION)
  // ================================================================

  if (mapType === 'mars-planet') {
    // Exclusion zones so instanced gravel/shale never overlaps spawn, hangar, outpost, greenhouse, mounds, craters, or mountains
    const marsExclusionZones: ExclusionZone[] = [
      { x: 0, z: 0, radius: 1.25 }, // Robot spawn zone
      { x: -4.8, z: -4.2, radius: 3.7 }, // Spaceship hangar blast apron
      { x: -5.8, z: 1.4, radius: 1.85 }, // Geodesic research outpost
      { x: MARS_GREENHOUSE_SPEC.x, z: MARS_GREENHOUSE_SPEC.z, radius: MARS_GREENHOUSE_SPEC.exclusionRadius }, // Mars hydroponic vegetable greenhouse
      // Climbable mounds
      { x: 2.4, z: 1.8, radius: 1.8 },
      { x: -2.6, z: 2.2, radius: 1.9 },
      { x: 2.0, z: -2.5, radius: 1.7 },
      { x: -3.0, z: -1.8, radius: 1.8 },
      { x: 0.2, z: 4.2, radius: 2.0 },
      // 3D Impact Craters
      // Impact craters (keep pebble/cobble scatter clear of crater rim walls)
      { x: 5.8, z: 0.6, radius: 1.72 },
      { x: -5.8, z: 4.4, radius: 1.85 },
      { x: 4.6, z: -5.8, radius: 1.98 },
      { x: -1.6, z: -8.4, radius: 1.65 },
      { x: 6.4, z: 5.2, radius: 1.6 },
      { x: -0.4, z: -6.2, radius: 1.6 },
      // Geological Mountains
      { x: 8.5, z: 8.2, radius: 2.5 },
      { x: -9.2, z: 7.5, radius: 2.3 },
      { x: 7.8, z: -8.8, radius: 2.7 },
      { x: -9.8, z: -7.2, radius: 2.4 },
      { x: -1.2, z: 9.5, radius: 2.1 },
      { x: 9.8, z: -1.5, radius: 2.2 },
      { x: -8.5, z: -1.0, radius: 2.0 },
    ];

    marsTerrain = buildRealisticMarsTerrain(isSoftwareGl, marsExclusionZones);
    group.add(marsTerrain.terrainGroup);

    // Astronaut Spaceship & JetBot Docking Hangar with Charging Cable
    spaceshipHangar = createMarsSpaceshipHangar(isSoftwareGl);
    group.add(spaceshipHangar.group);

    // Mars Hydroponic Vegetable Greenhouse (Nhà Kính Trồng Rau Sao Hỏa - 2-door pressurized airlock)
    marsGreenhouse = createMarsGreenhouse(isSoftwareGl);
    group.add(marsGreenhouse.group);

    // Subtle Titanium Perimeter Survey Beacons along the 28m plateau rim
    const pylonPostGeom = new THREE.CylinderGeometry(0.032, 0.048, 0.42, 8);
    const pylonCapGeom = new THREE.SphereGeometry(0.045, 8, 8);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.78,
      roughness: 0.36,
    });
    const amberGlow = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    sceneDisposables.push(pylonPostGeom, pylonCapGeom, beaconMat, amberGlow);

    const pylonCoords = [
      [-13.2, -13.2], [0, -13.2], [13.2, -13.2],
      [13.2, 0], [13.2, 13.2], [0, 13.2], [-13.2, 13.2], [-13.2, 0],
      [-6.6, -13.2], [6.6, -13.2], [-13.2, -6.6], [13.2, -6.6],
      [-13.2, 6.6], [13.2, 6.6], [-6.6, 13.2], [6.6, 13.2],
    ];
    pylonCoords.forEach(([px, pz]) => {
      const pylon = new THREE.Group();
      pylon.position.set(px, 0, pz);
      const post = new THREE.Mesh(pylonPostGeom, beaconMat);
      post.position.y = 0.21;
      const beaconLight = new THREE.Mesh(pylonCapGeom, amberGlow);
      beaconLight.position.y = 0.45;
      pylon.add(post);
      pylon.add(beaconLight);
      group.add(pylon);
    });

  } else {
    // -------------------------------------------------------------
    // CMU 10A ROBOTICS ARENA - Green Turf Pitch
    // -------------------------------------------------------------
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 1024;
    floorCanvas.height = 1024;
    const ctx = floorCanvas.getContext('2d')!;

    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = '#166534';
    for (let y = 0; y < 1024; y += 128) {
      ctx.fillRect(0, y, 1024, 64);
    }

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i <= 1024; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Pitch borders & lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.strokeRect(50, 50, 924, 924);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(50, 512);
    ctx.lineTo(974, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(512, 512, 170, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(512, 512, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(512, 512, 340, 240, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([16, 16]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(512, 512, 340, 240, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ĐÍCH / GOAL ZONE', 512, 120);
    ctx.font = 'bold 18px monospace';
    ctx.fillText('SÂN THI ĐẤU ROBOT JETBOT - LỚP 10A CMU', 512, 550);

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.colorSpace = THREE.SRGBColorSpace;

    const floorGeom = new THREE.PlaneGeometry(6, 6);
    floorGeom.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.75,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.receiveShadow = !isSoftwareGl;
    floor.position.y = -0.001;
    group.add(floor);

    // Arena walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.25 });
    const wallGreenGlowMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    const wallGeomH = new THREE.BoxGeometry(6.1, 0.09, 0.06);
    const wallGeomV = new THREE.BoxGeometry(0.06, 0.09, 6.1);

    const wallN = new THREE.Mesh(wallGeomH, wallMat);
    wallN.position.set(0, 0.045, -3.0);
    group.add(wallN);
    const wallS = new THREE.Mesh(wallGeomH, wallMat);
    wallS.position.set(0, 0.045, 3.0);
    group.add(wallS);
    const wallW = new THREE.Mesh(wallGeomV, wallMat);
    wallW.position.set(-3.0, 0.045, 0);
    group.add(wallW);
    const wallE = new THREE.Mesh(wallGeomV, wallMat);
    wallE.position.set(3.0, 0.045, 0);
    group.add(wallE);

    // LED light strips
    const stripH = new THREE.BoxGeometry(6, 0.008, 0.008);
    const stripV = new THREE.BoxGeometry(0.008, 0.008, 6);
    const stripN = new THREE.Mesh(stripH, wallGreenGlowMat);
    stripN.position.set(0, 0.088, -2.97);
    group.add(stripN);
    const stripS = new THREE.Mesh(stripH, wallGreenGlowMat);
    stripS.position.set(0, 0.088, 2.97);
    group.add(stripS);
    const stripW = new THREE.Mesh(stripV, wallGreenGlowMat);
    stripW.position.set(-2.97, 0.088, 0);
    group.add(stripW);
    const stripE = new THREE.Mesh(stripV, wallGreenGlowMat);
    stripE.position.set(2.97, 0.088, 0);
    group.add(stripE);
  }

  // ================================================================
  // 2. OBSTACLES (Earth Cones/Crates OR Martian Rocks & Crystals)
  // ================================================================

  if (mapType === 'mars-planet') {
    const marsMountainTex = marsTerrain!.mountainMap;
    const marsMountainBumpTex = marsTerrain!.mountainBumpMap;

    // Shared materials for realistic Martian boulders, mountains, and volcanic vents
    const rockMatShared = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: marsMountainTex,
      bumpMap: marsMountainBumpTex,
      bumpScale: 0.042,
      roughness: 0.93,
      metalness: 0.04,
      envMapIntensity: 0.24,
      flatShading: true,
    });
    const mineralVeinMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.18,
      roughness: 0.55,
      metalness: 0.25,
      envMapIntensity: 0.3,
    });
    const mountMatShared = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: marsMountainTex,
      bumpMap: marsMountainBumpTex,
      bumpScale: 0.048,
      vertexColors: true,
      roughness: 0.91,
      metalness: 0.04,
      envMapIntensity: 0.26,
      flatShading: true,
    });
    const screeMatShared = new THREE.MeshStandardMaterial({
      color: 0x6b2b15,
      bumpMap: marsMountainBumpTex,
      bumpScale: 0.03,
      roughness: 0.92,
      metalness: 0.04,
      envMapIntensity: 0.25,
      flatShading: true,
    });
    const volcanicRimMat = new THREE.MeshStandardMaterial({
      color: 0x2b130c,
      roughness: 0.92,
      metalness: 0.08,
      flatShading: true,
    });
    const magmaFissureMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xc2410c,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    });
    sceneDisposables.push(
      rockMatShared,
      mineralVeinMat,
      mountMatShared,
      screeMatShared,
      volcanicRimMat,
      magmaFissureMat
    );

    // Helper: Build an organic wind-eroded Martian Basalt Boulder
    function createMarsRock(x: number, z: number, scale: number, label: string): ArenaObstacle {
      const rockRoot = new THREE.Group();
      rockRoot.position.set(x, 0, z);

      const pivot = new THREE.Group();
      rockRoot.add(pivot);

      const rockGeom = new THREE.DodecahedronGeometry(scale, 1);
      const posAttr = rockGeom.attributes.position;
      const seedOffset = (x * 7.13 + z * 11.31) % 6.28;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const deform =
          0.86 +
          0.22 * Math.sin(vx * 11 + seedOffset) * Math.cos(vz * 9 - seedOffset) +
          0.12 * Math.cos(vy * 13);
        posAttr.setXYZ(i, vx * deform, vy * deform, vz * deform);
      }
      rockGeom.computeVertexNormals();

      // Desaturated natural iron-oxide & dark basalt rock tones with subtle dusty top settling
      const tones = [
        { r: 0.34, g: 0.16, b: 0.10 },
        { r: 0.28, g: 0.13, b: 0.09 },
        { r: 0.39, g: 0.19, b: 0.11 },
        { r: 0.24, g: 0.12, b: 0.08 },
      ];
      const tone = tones[Math.abs(Math.round((x + z) * 10)) % tones.length];
      const rockNormAttr = rockGeom.attributes.normal;

      const rockColorsAttr = new Float32Array(posAttr.count * 3);
      for (let i = 0; i < posAttr.count; i++) {
        const ry = posAttr.getY(i);
        const ny = rockNormAttr.getY(i);
        const dust = computeRockDustBlend(ny);
        const frac = THREE.MathUtils.clamp((ry + scale) / (scale * 2), 0, 1);
        const rVal = tone.r * 0.82 + frac * 0.06 + dust * 0.12;
        const gVal = tone.g * 0.78 + frac * 0.04 + dust * 0.08;
        const bVal = tone.b * 0.78 + frac * 0.03 + dust * 0.05;
        rockColorsAttr[i * 3] = THREE.MathUtils.clamp(rVal, 0, 0.72);
        rockColorsAttr[i * 3 + 1] = THREE.MathUtils.clamp(gVal, 0, 0.45);
        rockColorsAttr[i * 3 + 2] = THREE.MathUtils.clamp(bVal, 0, 0.32);
      }
      rockGeom.setAttribute('color', new THREE.BufferAttribute(rockColorsAttr, 3));

      const rockMesh = new THREE.Mesh(rockGeom, rockMatShared);
      rockMesh.position.y = scale * 0.66;
      rockMesh.scale.set(1.22, 0.78, 1.08);
      rockMesh.castShadow = !isSoftwareGl;
      rockMesh.receiveShadow = !isSoftwareGl;
      pivot.add(rockMesh);

      // Subtle embedded iron-oxide / ochre mineral vein
      const oreGeom = new THREE.DodecahedronGeometry(scale * 0.24, 0);
      const ore = new THREE.Mesh(oreGeom, mineralVeinMat);
      ore.position.set(scale * 0.42, scale * 0.48, scale * 0.28);
      ore.scale.set(1.2, 0.7, 0.8);
      pivot.add(ore);

      sceneDisposables.push(rockGeom, oreGeom);
      group.add(rockRoot);

      const obs: ArenaObstacle = {
        mesh: rockRoot,
        center: new THREE.Vector2(x, z),
        radius: scale * 1.1,
        label,
        type: 'mars-rock',
        isToppled: false,
        toppleAngle: 0,
        maxToppleAngle: 1.35,
        toppleAxis: new THREE.Vector3(1, 0, 0),
        angularVel: 0,
        initialPos: new THREE.Vector3(x, 0, z),
        initialRot: new THREE.Euler(0, 0, 0),
        pivotOffset: 0.02,
      };
      obstacles.push(obs);
      return obs;
    }

    // Central crater rocks
    createMarsRock(-1.5, -0.8, 0.22, 'Khối đá Bazan Sao Hỏa #1');
    createMarsRock(1.4, 1.5, 0.26, 'Tảng thiên thạch quặng đỏ #2');
    createMarsRock(-2.2, 2.5, 0.22, 'Đá núi lửa Olympus #3');
    createMarsRock(2.5, -1.8, 0.28, 'Mỏ khoáng sản hematit #4');
    createMarsRock(-2.8, 0.3, 0.24, 'Đá trầm tích Jezero #5');
    createMarsRock(0.8, -3.2, 0.24, 'Cột mốc tọa độ thám hiểm');

    // Outer sector rock formations across the 28m expanse
    createMarsRock(-7.5, 4.2, 0.42, 'Khối đá sa thạch thung lũng Bắc');
    createMarsRock(6.8, -5.5, 0.38, 'Tảng thiên thạch quặng Nam');
    createMarsRock(8.2, 5.8, 0.45, 'Mỏm đá hẻm núi Valles Marineris');
    createMarsRock(-6.8, -7.5, 0.40, 'Khối trầm tích lòng hồ cổ Jezero');
    createMarsRock(0.0, 9.2, 0.38, 'Trụ đá Bazan cực Bắc');
    createMarsRock(0.0, -9.5, 0.38, 'Trụ đá Bazan cực Nam');
    createMarsRock(-9.5, 0.0, 0.42, 'Bức tường đá hẻm Tây');
    createMarsRock(9.5, 0.0, 0.42, 'Mỏ khoáng sản tinh thể Đông');

    // Helper: Build a Rugged Martian Mountain / Butte with bump-mapped geological strata and talus scree
    function createMarsMountain(
      x: number,
      z: number,
      baseRadius: number,
      height: number,
      label: string,
      peakType: 'volcanic' | 'crag' | 'butte' = 'crag'
    ): ArenaObstacle {
      const mountRoot = new THREE.Group();
      mountRoot.position.set(x, 0, z);

      const pivot = new THREE.Group();
      mountRoot.add(pivot);

      const radialSegs = 20;
      const heightSegs = 10;
      const geom = new THREE.ConeGeometry(baseRadius, height, radialSegs, heightSegs, false);

      const posAttr = geom.attributes.position;
      const phaseSeed = (x * 0.7 + z * 1.1);
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);

        const vLevel = (vy + height / 2) / height;

        if (vLevel > 0.04 && vLevel < 0.88) {
          const angle = Math.atan2(vz, vx);
          const ridgeNoise =
            Math.sin(angle * 4 + vLevel * 5 + phaseSeed) * 0.18 +
            Math.cos(angle * 7 - phaseSeed) * 0.12;
          const terracing = Math.sin(vLevel * Math.PI * 7) * 0.075;
          const factor = 1.0 + (ridgeNoise + terracing) * (1.0 - vLevel * 0.25);
          posAttr.setXYZ(i, vx * factor, vy + Math.sin(angle * 3) * 0.05, vz * factor);
        } else if (vLevel >= 0.88) {
          // Erode sharp pyramid peaks into stepped Martian caprock plateaus / ridges
          const capFlatten = peakType === 'butte' ? 0.28 : peakType === 'volcanic' ? 0.24 : 0.15;
          const widen = peakType === 'butte' ? 2.4 : peakType === 'volcanic' ? 1.9 : 1.55;
          posAttr.setXYZ(i, vx * widen, vy - height * capFlatten * (vLevel - 0.88) * 3.0, vz * widen);
        }
      }
      geom.computeVertexNormals();

      // Authentic iron-oxide sedimentary rock vertex colors (balanced natural contrast)
      const colors = new Float32Array(posAttr.count * 3);
      for (let i = 0; i < posAttr.count; i++) {
        const vy = posAttr.getY(i);
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const vLevel = THREE.MathUtils.clamp((vy + height / 2) / height, 0, 1);
        const angle = Math.atan2(vz, vx);
        const band = Math.sin(vLevel * Math.PI * 14 + Math.cos(angle * 4) * 0.6) * 0.5 + 0.5;

        let r = 0.68, g = 0.28, b = 0.13;
        if (vLevel > 0.82) {
          r = 0.82;
          g = 0.42 + (vLevel - 0.82) * 0.2;
          b = 0.22;
        } else if (vLevel > 0.3) {
          if (band > 0.5) {
            r = 0.72;
            g = 0.34;
            b = 0.16;
          } else {
            r = 0.48;
            g = 0.18;
            b = 0.09;
          }
        }
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mountMesh = new THREE.Mesh(geom, mountMatShared);
      mountMesh.position.y = height / 2;
      mountMesh.castShadow = !isSoftwareGl;
      mountMesh.receiveShadow = !isSoftwareGl;
      pivot.add(mountMesh);
      sceneDisposables.push(geom);

      // Base talus scree boulders grounded cleanly around cliff toe
      for (let s = 0; s < 5; s++) {
        const sAngle = (s / 5) * Math.PI * 2 + phaseSeed * 0.2;
        const sDist = baseRadius * (0.84 + (s % 2) * 0.18);
        const sRadius = 0.18 + (s % 3) * 0.06;
        const screeGeom = new THREE.DodecahedronGeometry(sRadius, 0);
        const screeMesh = new THREE.Mesh(screeGeom, screeMatShared);
        screeMesh.position.set(
          Math.cos(sAngle) * sDist,
          sRadius * 0.45,
          Math.sin(sAngle) * sDist
        );
        screeMesh.scale.set(1.25, 0.68, 1.1);
        screeMesh.rotation.y = sAngle;
        screeMesh.receiveShadow = !isSoftwareGl;
        pivot.add(screeMesh);
        sceneDisposables.push(screeGeom);
      }

      // Realistic cooled dark basalt caldera rim + recessed magma fissure on volcanic cones
      if (peakType === 'volcanic') {
        const rimGeom = new THREE.TorusGeometry(baseRadius * 0.24, 0.08, 6, 14);
        rimGeom.rotateX(Math.PI / 2);
        const rimMesh = new THREE.Mesh(rimGeom, volcanicRimMat);
        rimMesh.position.set(0, height - 0.15, 0);
        pivot.add(rimMesh);

        const magmaGeom = new THREE.CircleGeometry(baseRadius * 0.18, 12);
        magmaGeom.rotateX(-Math.PI / 2);
        const magma = new THREE.Mesh(magmaGeom, magmaFissureMat);
        magma.position.set(0, height - 0.17, 0);
        pivot.add(magma);
        sceneDisposables.push(rimGeom, magmaGeom);
      }

      group.add(mountRoot);

      const obs: ArenaObstacle = {
        mesh: mountRoot,
        center: new THREE.Vector2(x, z),
        radius: baseRadius * 0.9,
        label,
        type: 'mars-mountain',
        isToppled: false,
        toppleAngle: 0,
        maxToppleAngle: 0,
        toppleAxis: new THREE.Vector3(1, 0, 0),
        angularVel: 0,
        initialPos: new THREE.Vector3(x, 0, z),
        initialRot: new THREE.Euler(0, 0, 0),
        pivotOffset: 0.05,
      };
      obstacles.push(obs);
      return obs;
    }

    // 7 Mountains / Buttes across the 28m Martian landscape
    createMarsMountain(8.5, 8.2, 2.2, 2.6, 'Ngọn núi Đỉnh Đỏ Olympus (Olympus Foothill Peak)', 'crag');
    createMarsMountain(-9.2, 7.5, 2.0, 2.2, 'Đồi Hẻm Núi Đôi (Twin Butte Ridge)', 'butte');
    createMarsMountain(7.8, -8.8, 2.4, 2.8, 'Núi Lửa Trầm Tích Nam (South Volcanic Cone)', 'volcanic');
    createMarsMountain(-9.8, -7.2, 2.1, 2.4, 'Dãy Đồi Vực Thẳm Tây (West Canyon Crag)', 'crag');
    createMarsMountain(-1.2, 9.5, 1.8, 1.9, 'Núi Cô Đơn Vùng Jezero (Jezero Butte Mount)', 'butte');
    createMarsMountain(9.8, -1.5, 1.9, 2.1, 'Mỏm Núi Đá Quặng Sắt (Hematite Spire Hill)', 'crag');
    createMarsMountain(-8.5, -1.0, 1.7, 1.8, 'Đồi Đá Đỏ Trạm Thám Hiểm (Outpost Red Hill)', 'crag');

    // Helper: Build a climbable hill / mound with gentle incline that JetBot can physically drive up, stand on, and roll down
    function createClimbableMound(
      x: number,
      z: number,
      radius: number,
      height: number,
      label: string
    ): ClimbableMound {
      const moundRoot = new THREE.Group();
      moundRoot.name = `ClimbableMound_${label}`;
      moundRoot.position.set(x, 0, z);

      // Subdivided radial geometry for the smooth climbable mound
      const rings = 16;
      const segments = 32;
      const geom = new THREE.BufferGeometry();
      const vertices: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      // Peak center vertex (normalized floor UVs match 28m floor tiling 1:1)
      vertices.push(0, height, 0);
      uvs.push((x + 14) / 28, (-z + 14) / 28);

      for (let r = 1; r <= rings; r++) {
        const frac = r / rings;
        const rad = frac * radius;
        // Smooth cosine dome profile meeting ground flush at r === rings
        const y = r === rings ? 0 : height * 0.5 * (1 + Math.cos(frac * Math.PI));
        for (let s = 0; s < segments; s++) {
          const angle = (s / segments) * Math.PI * 2;
          const vx = Math.cos(angle) * rad;
          const vz = Math.sin(angle) * rad;
          const ripple = r === rings ? 0 : Math.sin(angle * 4) * Math.sin(frac * Math.PI) * 0.012;
          vertices.push(vx, Math.max(0, y + ripple), vz);
          uvs.push((x + vx + 14) / 28, (-(z + vz) + 14) / 28);
        }
      }

      // Indices for center cap: Counter-Clockwise (CCW) so normal points upward and outward
      for (let s = 0; s < segments; s++) {
        const nextS = (s + 1) % segments;
        indices.push(0, 1 + nextS, 1 + s);
      }

      // Indices for ring segments: CCW outward normals
      for (let r = 0; r < rings - 1; r++) {
        const ringStart = 1 + r * segments;
        const nextRingStart = 1 + (r + 1) * segments;
        for (let s = 0; s < segments; s++) {
          const nextS = (s + 1) % segments;
          const c1 = ringStart + s;
          const c2 = ringStart + nextS;
          const n1 = nextRingStart + s;
          const n2 = nextRingStart + nextS;
          indices.push(c1, c2, n1);
          indices.push(c2, n2, n1);
        }
      }

      geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      // Flatten outer perimeter ring normals to exact (0, 1, 0) floor normal so dune base has zero crease line
      const lastRingStart = 1 + (rings - 1) * segments;
      const normAttr = geom.attributes.normal;
      for (let i = lastRingStart; i < vertices.length / 3; i++) {
        normAttr.setXYZ(i, 0, 1, 0);
      }
      normAttr.needsUpdate = true;

      // Vertex color matches marsFloor exact tint at perimeter and warms naturally toward dune crest
      const moundColors = new Float32Array((vertices.length / 3) * 3);
      for (let i = 0; i < vertices.length / 3; i++) {
        const vx = vertices[i * 3];
        const vy = vertices[i * 3 + 1];
        const vz = vertices[i * 3 + 2];
        const frac = THREE.MathUtils.clamp(vy / height, 0, 1);
        const [baseR, baseG, baseB] = sampleMarsFloorVertexColor(x + vx, z + vz);
        moundColors[i * 3] = THREE.MathUtils.lerp(baseR, baseR * 1.12, frac);
        moundColors[i * 3 + 1] = THREE.MathUtils.lerp(baseG, baseG * 1.07, frac);
        moundColors[i * 3 + 2] = THREE.MathUtils.lerp(baseB, baseB * 1.02, frac);
      }
      geom.setAttribute('color', new THREE.BufferAttribute(moundColors, 3));

      const moundMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: marsTerrain!.regolithMap,
        normalMap: marsTerrain!.regolithNormalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        bumpMap: marsTerrain!.regolithBumpMap,
        bumpScale: 0.036,
        roughnessMap: marsTerrain!.regolithRoughnessMap,
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.03,
        envMapIntensity: 0.28,
      });
      const moundMesh = new THREE.Mesh(geom, moundMat);
      moundMesh.receiveShadow = !isSoftwareGl;
      moundMesh.castShadow = !isSoftwareGl;
      moundRoot.add(moundMesh);

      // Small Martian pebbles along the dune slopes
      const pebbleMat = new THREE.MeshStandardMaterial({
        color: 0x7c2d12,
        roughness: 0.9,
        metalness: 0.08,
        flatShading: true,
      });
      const pebbleGeom = new THREE.DodecahedronGeometry(0.035, 0);
      for (let p = 0; p < 6; p++) {
        const pAngle = (p / 6) * Math.PI * 2 + 0.3;
        const pFrac = 0.4 + (p % 3) * 0.2;
        const pDist = pFrac * radius;
        const pY = height * 0.5 * (1 + Math.cos(pFrac * Math.PI));
        const pebble = new THREE.Mesh(pebbleGeom, pebbleMat);
        pebble.position.set(Math.cos(pAngle) * pDist, pY + 0.015, Math.sin(pAngle) * pDist);
        pebble.scale.set(1.1, 0.6, 1.0);
        moundRoot.add(pebble);
      }

      // Summit science waypoint pin
      const mastGeom = new THREE.CylinderGeometry(0.005, 0.007, 0.2, 8);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.3 });
      const beaconMast = new THREE.Mesh(mastGeom, mastMat);
      beaconMast.position.set(0, height + 0.1, 0);
      moundRoot.add(beaconMast);

      const beaconCapGeom = new THREE.SphereGeometry(0.016, 8, 8);
      const beaconCapMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.9,
      });
      const beaconLight = new THREE.Mesh(beaconCapGeom, beaconCapMat);
      beaconLight.position.set(0, height + 0.21, 0);
      moundRoot.add(beaconLight);

      sceneDisposables.push(geom, moundMat, pebbleMat, pebbleGeom, mastGeom, mastMat, beaconCapGeom, beaconCapMat);
      group.add(moundRoot);

      const mound: ClimbableMound = {
        center: new THREE.Vector2(x, z),
        radius,
        height,
        label,
      };
      climbableMounds.push(mound);
      return mound;
    }

    // 5 Climbable Hills & Mounds placed directly in driving pathways (JetBot can climb over them!)
    createClimbableMound(2.4, 1.8, 1.6, 0.28, 'Đồi Cát Thám Hiểm Đông (East Exploration Mound)');
    createClimbableMound(-2.6, 2.2, 1.7, 0.32, 'Gò Đất Trầm Tích Đỏ Bắc (North Red Hill)');
    createClimbableMound(2.0, -2.5, 1.5, 0.26, 'Đụn Cát Khoáng Vật Nam (South Mineral Mound)');
    createClimbableMound(-3.0, -1.8, 1.6, 0.29, 'Dốc Núi Lửa Bằng Phẳng Tây (West Low Volcanic Ramp)');
    createClimbableMound(0.2, 4.2, 1.8, 0.34, 'Đồi Đỉnh Vọng Cảnh Trung Tâm (Central Crest Mount)');

  } else {
    // Earth Robotics arena traffic cones & crates
    function createTrafficCone(x: number, z: number, label: string): ArenaObstacle {
      const coneRoot = new THREE.Group();
      coneRoot.position.set(x, 0, z);
      const pivot = new THREE.Group();
      coneRoot.add(pivot);

      const coneGeom = new THREE.ConeGeometry(0.09, 0.26, 16);
      const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.1 });
      const coneMesh = new THREE.Mesh(coneGeom, orangeMat);
      coneMesh.position.y = 0.13;
      coneMesh.castShadow = !isSoftwareGl;
      pivot.add(coneMesh);

      const ringGeom = new THREE.CylinderGeometry(0.052, 0.065, 0.06, 16, 1, true);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.6 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.y = 0.12;
      pivot.add(ringMesh);

      const baseGeom = new THREE.BoxGeometry(0.2, 0.018, 0.2);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 0.009;
      pivot.add(baseMesh);

      group.add(coneRoot);

      const obs: ArenaObstacle = {
        mesh: coneRoot,
        center: new THREE.Vector2(x, z),
        radius: 0.14,
        label,
        type: 'cone',
        isToppled: false,
        toppleAngle: 0,
        maxToppleAngle: 1.48,
        toppleAxis: new THREE.Vector3(1, 0, 0),
        angularVel: 0,
        initialPos: new THREE.Vector3(x, 0, z),
        initialRot: new THREE.Euler(0, 0, 0),
        pivotOffset: 0.01,
      };
      obstacles.push(obs);
      return obs;
    }

    function createCrate(x: number, z: number, size: number, label: string): ArenaObstacle {
      const crateRoot = new THREE.Group();
      crateRoot.position.set(x, 0, z);
      const pivot = new THREE.Group();
      crateRoot.add(pivot);

      const crateGeom = new THREE.BoxGeometry(size, size, size);
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 });
      const crateMesh = new THREE.Mesh(crateGeom, crateMat);
      crateMesh.position.y = size / 2;
      pivot.add(crateMesh);

      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.3 });
      const frameGeom = new THREE.BoxGeometry(size * 1.02, size * 0.1, size * 1.02);
      const frame1 = new THREE.Mesh(frameGeom, frameMat);
      frame1.position.y = size * 0.9;
      pivot.add(frame1);

      group.add(crateRoot);

      const obs: ArenaObstacle = {
        mesh: crateRoot,
        center: new THREE.Vector2(x, z),
        radius: (size * Math.SQRT2) / 2,
        label,
        type: 'crate',
        isToppled: false,
        toppleAngle: 0,
        maxToppleAngle: 1.45,
        toppleAxis: new THREE.Vector3(1, 0, 0),
        angularVel: 0,
        initialPos: new THREE.Vector3(x, 0, z),
        initialRot: new THREE.Euler(0, 0, 0),
        pivotOffset: 0.02,
      };
      obstacles.push(obs);
      return obs;
    }

    function createBeacon(x: number, z: number, label: string): ArenaObstacle {
      const bRoot = new THREE.Group();
      bRoot.position.set(x, 0, z);
      const pivot = new THREE.Group();
      bRoot.add(pivot);

      const mastGeom = new THREE.CylinderGeometry(0.025, 0.035, 0.45, 12);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const mast = new THREE.Mesh(mastGeom, mastMat);
      mast.position.y = 0.225;
      pivot.add(mast);

      const lightGeom = new THREE.SphereGeometry(0.065, 16, 16);
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.85,
      });
      const light = new THREE.Mesh(lightGeom, lightMat);
      light.position.y = 0.45;
      pivot.add(light);

      group.add(bRoot);

      const obs: ArenaObstacle = {
        mesh: bRoot,
        center: new THREE.Vector2(x, z),
        radius: 0.12,
        label,
        type: 'beacon',
        isToppled: false,
        toppleAngle: 0,
        maxToppleAngle: 1.5,
        toppleAxis: new THREE.Vector3(1, 0, 0),
        angularVel: 0,
        initialPos: new THREE.Vector3(x, 0, z),
        initialRot: new THREE.Euler(0, 0, 0),
        pivotOffset: 0.01,
      };
      obstacles.push(obs);
      return obs;
    }

    createTrafficCone(-1.4, -0.9, 'Cọc tiêu #1');
    createTrafficCone(1.2, 1.4, 'Cọc tiêu #2');
    createTrafficCone(-0.8, 1.6, 'Cọc tiêu #3');
    createCrate(1.5, -1.2, 0.34, 'Hộp thiết bị #A');
    createCrate(-1.6, 0.2, 0.30, 'Hộp thiết bị #B');
    createBeacon(0.0, -1.8, 'Cột mốc mục tiêu');
  }

  // ================================================================
  // 3. ANIMATED MOVING ALIENS (Sinh vật ngoài hành tinh di chuyển)
  // ================================================================

  // ALIEN 1: "Martian Bio-Scout" (Do thám bay phát sáng xanh ngọc)
  function createAlienScout(orbitCenterX: number, orbitCenterZ: number, orbitRadius: number): AlienEntity {
    const alienRoot = new THREE.Group();
    alienRoot.name = 'Alien_BioScout';
    alienRoot.scale.set(0.42, 0.42, 0.42); // Scaled miniature, noticeably smaller than JetBot

    // Alien metallic body sphere
    const bodyGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4c1d95, // deep cosmic purple
      metalness: 0.8,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.32;
    body.scale.set(1.1, 0.9, 1.2);
    alienRoot.add(body);

    // Glowing Bioluminescent Cyclopean Eye
    const eyeGeom = new THREE.SphereGeometry(0.05, 16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.9,
    });
    const eyeMesh = new THREE.Mesh(eyeGeom, eyeMat);
    eyeMesh.position.set(0, 0.33, 0.11);
    alienRoot.add(eyeMesh);

    // Rotating Plasma Ring around alien
    const ringGeom = new THREE.TorusGeometry(0.18, 0.014, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    const glowRing = new THREE.Mesh(ringGeom, ringMat);
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.32;
    alienRoot.add(glowRing);

    // 3 Floating Claws / Tentacles hanging underneath
    const tentacles: THREE.Mesh[] = [];
    const tentacleGeom = new THREE.ConeGeometry(0.02, 0.16, 8);
    const tentacleMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, metalness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const tentacle = new THREE.Mesh(tentacleGeom, tentacleMat);
      const angle = (i / 3) * Math.PI * 2;
      tentacle.position.set(Math.cos(angle) * 0.06, 0.16, Math.sin(angle) * 0.06);
      tentacle.rotation.x = Math.PI; // pointing down
      alienRoot.add(tentacle);
      tentacles.push(tentacle);
    }

    // Shadow blob
    const shadowGeom = new THREE.CircleGeometry(0.16, 16);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.position.y = 0.002;
    alienRoot.add(shadow);

    group.add(alienRoot);

    const alien: AlienEntity = {
      mesh: alienRoot,
      center: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      radius: 0.14,
      name: 'Alien Do Thám (Bio-Scout Alpha)',
      type: 'scout',
      speed: 0.65,
      hoverHeight: 0.32,
      orbitCenter: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      orbitRadius,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: 0.55,
      eyeMesh,
      glowRing,
      tentacles,
      alertLevel: 0,
      lastChirpTime: 0,
      update: (delta, elapsedTime, robotPos) => {
        // Orbit patrol in elliptical pattern
        alien.orbitAngle += alien.orbitSpeed * delta;
        const rawX = alien.orbitCenter.x + Math.cos(alien.orbitAngle) * alien.orbitRadius;
        const rawZ = alien.orbitCenter.y + Math.sin(alien.orbitAngle * 1.5) * (alien.orbitRadius * 0.8);
        const { x: curX, z: curZ } = clampActorOutsideStaticDomes(rawX, rawZ, alien.radius);

        // Heading direction
        const nextX = alien.orbitCenter.x + Math.cos(alien.orbitAngle + 0.05) * alien.orbitRadius;
        const nextZ = alien.orbitCenter.y + Math.sin((alien.orbitAngle + 0.05) * 1.5) * (alien.orbitRadius * 0.8);
        const heading = Math.atan2(nextX - curX, nextZ - curZ);

        alienRoot.position.set(curX, 0, curZ);
        alienRoot.rotation.y = heading;
        alien.center.set(curX, curZ);

        // Hover bobbing motion
        const bob = Math.sin(elapsedTime * 3.5) * 0.05;
        body.position.y = alien.hoverHeight + bob;
        eyeMesh.position.y = alien.hoverHeight + 0.01 + bob;
        glowRing.position.y = alien.hoverHeight + bob;
        glowRing.rotation.z += delta * 4; // spin plasma ring

        // Tentacle sway
        tentacles.forEach((t, idx) => {
          t.position.y = alien.hoverHeight - 0.16 + bob;
          t.rotation.z = Math.sin(elapsedTime * 4 + idx) * 0.25;
        });

        // Proximity reaction to JetBot
        const dist = Math.hypot(curX - robotPos.x, curZ - robotPos.z);
        if (dist < 1.3) {
          alien.alertLevel = Math.min(1.0, alien.alertLevel + delta * 3);
          eyeMat.emissive.setHex(0xef4444); // turns alert red
          eyeMat.emissiveIntensity = 1.3;
          glowRing.scale.setScalar(1.2 + Math.sin(elapsedTime * 10) * 0.15);

          if (elapsedTime - alien.lastChirpTime > 3.0) {
            alien.lastChirpTime = elapsedTime;
            robotAudio.playAlienChirp();
          }
        } else {
          alien.alertLevel = Math.max(0, alien.alertLevel - delta * 1.5);
          eyeMat.emissive.setHex(0x10b981); // calm emerald
          eyeMat.emissiveIntensity = 0.85;
          glowRing.scale.setScalar(1.0);
        }
      }
    };

    aliens.push(alien);
    return alien;
  }

  // ALIEN 2: "Martian Tripod Walker" (Sinh vật ba chân ngoài hành tinh di chuyển)
  function createAlienTripod(orbitCenterX: number, orbitCenterZ: number, orbitRadius: number): AlienEntity {
    const tripodRoot = new THREE.Group();
    tripodRoot.name = 'Alien_TripodWalker';
    tripodRoot.scale.set(0.40, 0.40, 0.40); // Scaled miniature, noticeably smaller than JetBot

    // Tripod Head (domed biomechanical skull)
    const headGeom = new THREE.CylinderGeometry(0.14, 0.08, 0.18, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e, // alien deep teal
      metalness: 0.75,
      roughness: 0.3,
    });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 0.44;
    tripodRoot.add(head);

    // Dual Visor Eyes
    const visorGeom = new THREE.BoxGeometry(0.16, 0.04, 0.03);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 0.9,
    });
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 0.46, 0.08);
    tripodRoot.add(visor);

    // 3 Articulated Tripod Legs
    const legs: { upper: THREE.Mesh; lower: THREE.Mesh; baseAngle: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const baseAngle = (i / 3) * Math.PI * 2;
      const legGroup = new THREE.Group();
      legGroup.position.set(0, 0.4, 0);

      // Upper leg
      const upperGeom = new THREE.CylinderGeometry(0.015, 0.012, 0.22, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x134e4a, metalness: 0.8, roughness: 0.25 });
      const upper = new THREE.Mesh(upperGeom, legMat);
      upper.position.set(Math.cos(baseAngle) * 0.1, -0.08, Math.sin(baseAngle) * 0.1);
      upper.rotation.z = Math.cos(baseAngle) * 0.45;
      upper.rotation.x = Math.sin(baseAngle) * 0.45;
      legGroup.add(upper);

      // Lower leg / claw foot
      const lowerGeom = new THREE.CylinderGeometry(0.01, 0.006, 0.24, 8);
      const lower = new THREE.Mesh(lowerGeom, legMat);
      lower.position.set(Math.cos(baseAngle) * 0.18, -0.26, Math.sin(baseAngle) * 0.18);
      lower.rotation.z = -Math.cos(baseAngle) * 0.3;
      lower.rotation.x = -Math.sin(baseAngle) * 0.3;
      legGroup.add(lower);

      tripodRoot.add(legGroup);
      legs.push({ upper, lower, baseAngle });
    }

    // Shadow
    const shadowGeom = new THREE.CircleGeometry(0.22, 16);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.position.y = 0.002;
    tripodRoot.add(shadow);

    group.add(tripodRoot);

    const alien: AlienEntity = {
      mesh: tripodRoot,
      center: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      radius: 0.15,
      name: 'Alien Ba Chân (Martian Tripod)',
      type: 'tripod',
      speed: 0.5,
      hoverHeight: 0.44,
      orbitCenter: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      orbitRadius,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: 0.42,
      legs,
      alertLevel: 0,
      lastChirpTime: 0,
      update: (delta, elapsedTime, robotPos) => {
        // Orbit path around crater
        alien.orbitAngle += alien.orbitSpeed * delta;
        const rawX = alien.orbitCenter.x + Math.sin(alien.orbitAngle) * alien.orbitRadius;
        const rawZ = alien.orbitCenter.y + Math.cos(alien.orbitAngle) * alien.orbitRadius;
        const { x: curX, z: curZ } = clampActorOutsideStaticDomes(rawX, rawZ, alien.radius);

        const nextX = alien.orbitCenter.x + Math.sin(alien.orbitAngle + 0.05) * alien.orbitRadius;
        const nextZ = alien.orbitCenter.y + Math.cos(alien.orbitAngle + 0.05) * alien.orbitRadius;
        const heading = Math.atan2(nextX - curX, nextZ - curZ);

        tripodRoot.position.set(curX, 0, curZ);
        tripodRoot.rotation.y = heading;
        alien.center.set(curX, curZ);

        // Walking step animation (alternating leg lifts)
        legs.forEach(({ upper, lower, baseAngle }, idx) => {
          const stepPhase = elapsedTime * 6 + (idx * Math.PI * 2) / 3;
          const lift = Math.max(0, Math.sin(stepPhase)) * 0.06;
          upper.position.y = -0.08 + lift;
          lower.position.y = -0.26 + lift * 1.4;
        });

        // Head sway
        head.position.y = 0.44 + Math.sin(elapsedTime * 6) * 0.02;

        // Proximity detection
        const dist = Math.hypot(curX - robotPos.x, curZ - robotPos.z);
        if (dist < 1.4) {
          visorMat.emissive.setHex(0xf59e0b); // warning amber
          visorMat.emissiveIntensity = 1.2;
          if (elapsedTime - alien.lastChirpTime > 3.5) {
            alien.lastChirpTime = elapsedTime;
            robotAudio.playAlienEncounter();
          }
        } else {
          visorMat.emissive.setHex(0xa855f7); // calm purple
          visorMat.emissiveIntensity = 0.8;
        }
      }
    };

    aliens.push(alien);
    return alien;
  }

  // ALIEN 3: "Martian Bio-Crawler" (Quái vật bò sát năng lượng)
  function createAlienCrawler(orbitCenterX: number, orbitCenterZ: number, orbitRadius: number): AlienEntity {
    const crawlerRoot = new THREE.Group();
    crawlerRoot.name = 'Alien_BioCrawler';
    crawlerRoot.scale.set(0.45, 0.45, 0.45); // Scaled miniature, noticeably smaller than JetBot

    // Segmented multi-node body
    const segmentMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b, // crimson alien shell
      metalness: 0.6,
      roughness: 0.35,
    });
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
    });

    const segments: THREE.Mesh[] = [];
    for (let s = 0; s < 4; s++) {
      const segGeom = new THREE.SphereGeometry(0.08 - s * 0.012, 12, 12);
      const seg = new THREE.Mesh(segGeom, segmentMat);
      seg.position.set(0, 0.09, -s * 0.1);
      seg.scale.set(1.2, 0.8, 1.0);
      crawlerRoot.add(seg);
      segments.push(seg);

      // Glowing bio-luminescent spine node on top
      const spineNode = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), spineMat);
      spineNode.position.set(0, 0.15, -s * 0.1);
      crawlerRoot.add(spineNode);
    }

    // Glowing front mandibles / eyes
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), spineMat);
    eyeR.position.set(0.045, 0.11, 0.06);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), spineMat);
    eyeL.position.set(-0.045, 0.11, 0.06);
    crawlerRoot.add(eyeR);
    crawlerRoot.add(eyeL);

    group.add(crawlerRoot);

    const alien: AlienEntity = {
      mesh: crawlerRoot,
      center: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      radius: 0.14,
      name: 'Alien Bò Sát (Bio-Crawler Beta)',
      type: 'crawler',
      speed: 0.8,
      hoverHeight: 0.09,
      orbitCenter: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      orbitRadius,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: 0.7,
      alertLevel: 0,
      lastChirpTime: 0,
      update: (delta, elapsedTime, robotPos) => {
        // Patrol path (Sine wave snake-like track)
        alien.orbitAngle += alien.orbitSpeed * delta;
        const rawX = alien.orbitCenter.x + Math.sin(alien.orbitAngle) * alien.orbitRadius;
        const rawZ = alien.orbitCenter.y + Math.cos(alien.orbitAngle * 2) * (alien.orbitRadius * 0.6);
        const { x: curX, z: curZ } = clampActorOutsideStaticDomes(rawX, rawZ, alien.radius);

        const nextX = alien.orbitCenter.x + Math.sin(alien.orbitAngle + 0.05) * alien.orbitRadius;
        const nextZ = alien.orbitCenter.y + Math.cos((alien.orbitAngle + 0.05) * 2) * (alien.orbitRadius * 0.6);
        const heading = Math.atan2(nextX - curX, nextZ - curZ);

        crawlerRoot.position.set(curX, 0, curZ);
        crawlerRoot.rotation.y = heading;
        alien.center.set(curX, curZ);

        // Segment undulation (crawling snake motion)
        segments.forEach((seg, i) => {
          seg.position.x = Math.sin(elapsedTime * 8 - i * 0.8) * 0.035;
        });

        // Proximity detection
        const dist = Math.hypot(curX - robotPos.x, curZ - robotPos.z);
        if (dist < 1.2) {
          spineMat.emissive.setHex(0xf43f5e); // danger neon rose
          spineMat.emissiveIntensity = 1.3;
          if (elapsedTime - alien.lastChirpTime > 3.0) {
            alien.lastChirpTime = elapsedTime;
            robotAudio.playAlienChirp();
          }
        } else {
          spineMat.emissive.setHex(0x0284c7);
          spineMat.emissiveIntensity = 0.85;
        }
      }
    };

    aliens.push(alien);
    return alien;
  }

  // ALIEN 4: "Martian Bipedal Walker" (Người ngoài hành tinh đi hai chân)
  function createAlienBiped(
    orbitCenterX: number,
    orbitCenterZ: number,
    orbitRadius: number,
    name = 'Người Ngoài Hành Tinh Hai Chân (Bipedal Martian)',
    themeColor = 0x0284c7
  ): AlienEntity {
    const bipedRoot = new THREE.Group();
    bipedRoot.name = 'Alien_BipedalWalker';
    bipedRoot.scale.set(0.38, 0.38, 0.38); // Scaled miniature, visibly smaller than JetBot (~0.31m vs JetBot's 0.35m wide chassis)

    const alienMat = new THREE.MeshStandardMaterial({
      color: themeColor,
      roughness: 0.35,
      metalness: 0.75,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.85,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.95,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.1,
    });

    // 1. Pelvis / Hips
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), jointMat);
    pelvis.position.y = 0.44;
    bipedRoot.add(pelvis);

    // 2. Torso with chest exoskeleton plates & glowing power core
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.26, 12), alienMat);
    torso.position.set(0, 0.17, 0);
    pelvis.add(torso);

    const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), coreMat);
    chestCore.position.set(0, 0.04, 0.085);
    torso.add(chestCore);

    // 3. Alien Head with compound visor eyes & sensory antennae
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.22, 0);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 12), alienMat);
    skull.scale.set(0.9, 1.25, 1.15);
    headGroup.add(skull);

    // Large glowing visor eyes
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.05), visorMat);
    visor.position.set(0, 0.02, 0.09);
    headGroup.add(visor);

    // Dual sensory antennae
    const antGeom = new THREE.CylinderGeometry(0.006, 0.003, 0.14, 6);
    const antL = new THREE.Mesh(antGeom, jointMat);
    antL.position.set(-0.06, 0.14, 0.02);
    antL.rotation.z = 0.35;
    antL.rotation.x = -0.2;
    headGroup.add(antL);

    const antR = new THREE.Mesh(antGeom, jointMat);
    antR.position.set(0.06, 0.14, 0.02);
    antR.rotation.z = -0.35;
    antR.rotation.x = -0.2;
    headGroup.add(antR);

    torso.add(headGroup);

    // 4. Two Articulated Walking Legs (Chân trái & Chân phải)
    const legGeom = new THREE.CylinderGeometry(0.022, 0.016, 0.22, 8);
    const calfGeom = new THREE.CylinderGeometry(0.016, 0.012, 0.24, 8);
    const footGeom = new THREE.BoxGeometry(0.065, 0.024, 0.14);

    // Left Leg
    const legLGroup = new THREE.Group();
    legLGroup.position.set(-0.09, 0, 0);
    const thighL = new THREE.Mesh(legGeom, alienMat);
    thighL.position.y = -0.11;
    legLGroup.add(thighL);
    const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), jointMat);
    kneeL.position.y = -0.22;
    legLGroup.add(kneeL);
    const calfL = new THREE.Mesh(calfGeom, jointMat);
    calfL.position.y = -0.33;
    legLGroup.add(calfL);
    const footL = new THREE.Mesh(footGeom, alienMat);
    footL.position.set(0, -0.44, 0.03);
    legLGroup.add(footL);
    pelvis.add(legLGroup);

    // Right Leg
    const legRGroup = new THREE.Group();
    legRGroup.position.set(0.09, 0, 0);
    const thighR = new THREE.Mesh(legGeom, alienMat);
    thighR.position.y = -0.11;
    legRGroup.add(thighR);
    const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), jointMat);
    kneeR.position.y = -0.22;
    legRGroup.add(kneeR);
    const calfR = new THREE.Mesh(calfGeom, jointMat);
    calfR.position.y = -0.33;
    legRGroup.add(calfR);
    const footR = new THREE.Mesh(footGeom, alienMat);
    footR.position.set(0, -0.44, 0.03);
    legRGroup.add(footR);
    pelvis.add(legRGroup);

    // 5. Two Articulated Arms with Biomechanical Claws (Tay trái & Tay phải)
    const armGeom = new THREE.CylinderGeometry(0.018, 0.014, 0.20, 8);
    const forearmGeom = new THREE.CylinderGeometry(0.014, 0.010, 0.20, 8);

    const armLGroup = new THREE.Group();
    armLGroup.position.set(-0.13, 0.08, 0);
    const armL = new THREE.Mesh(armGeom, alienMat);
    armL.position.y = -0.09;
    armLGroup.add(armL);
    const forearmL = new THREE.Mesh(forearmGeom, jointMat);
    forearmL.position.set(0, -0.25, 0.04);
    forearmL.rotation.x = -0.35;
    armLGroup.add(forearmL);
    torso.add(armLGroup);

    const armRGroup = new THREE.Group();
    armRGroup.position.set(0.13, 0.08, 0);
    const armR = new THREE.Mesh(armGeom, alienMat);
    armR.position.y = -0.09;
    armRGroup.add(armR);
    const forearmR = new THREE.Mesh(forearmGeom, jointMat);
    forearmR.position.set(0, -0.25, 0.04);
    forearmR.rotation.x = -0.35;
    armRGroup.add(forearmR);
    torso.add(armRGroup);

    // Ground contact shadow
    const shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
    );
    shadowMesh.rotateX(-Math.PI / 2);
    shadowMesh.position.y = 0.002;
    bipedRoot.add(shadowMesh);

    group.add(bipedRoot);

    const alien: AlienEntity = {
      mesh: bipedRoot,
      center: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      radius: 0.15,
      name,
      type: 'biped',
      speed: 0.65,
      hoverHeight: 0.44,
      orbitCenter: new THREE.Vector2(orbitCenterX, orbitCenterZ),
      orbitRadius,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: 0.38,
      alertLevel: 0,
      lastChirpTime: 0,
      update: (delta, elapsedTime, robotPos) => {
        // Natural patrol path
        alien.orbitAngle += alien.orbitSpeed * delta;
        const rawX = alien.orbitCenter.x + Math.sin(alien.orbitAngle) * alien.orbitRadius;
        const rawZ = alien.orbitCenter.y + Math.cos(alien.orbitAngle) * alien.orbitRadius;
        const { x: curX, z: curZ } = clampActorOutsideStaticDomes(rawX, rawZ, alien.radius);

        const nextX = alien.orbitCenter.x + Math.sin(alien.orbitAngle + 0.05) * alien.orbitRadius;
        const nextZ = alien.orbitCenter.y + Math.cos(alien.orbitAngle + 0.05) * alien.orbitRadius;
        const heading = Math.atan2(nextX - curX, nextZ - curZ);

        bipedRoot.position.set(curX, 0, curZ);
        bipedRoot.rotation.y = heading;
        alien.center.set(curX, curZ);

        // Natural Bipedal Walking Gait (2 chân bước so le + 2 tay vung ngược chiều chân)
        const stridePhase = elapsedTime * 5.2;
        legLGroup.rotation.x = Math.sin(stridePhase) * 0.48;
        legRGroup.rotation.x = -Math.sin(stridePhase) * 0.48;

        armLGroup.rotation.x = -Math.sin(stridePhase) * 0.42;
        armRGroup.rotation.x = Math.sin(stridePhase) * 0.42;

        // Torso natural vertical bounce during stride
        pelvis.position.y = 0.44 + Math.abs(Math.sin(stridePhase * 2)) * 0.024;
        torso.rotation.y = Math.sin(stridePhase) * 0.08;

        // Proximity detection to JetBot
        const dist = Math.hypot(curX - robotPos.x, curZ - robotPos.z);
        if (dist < 1.6) {
          visorMat.emissive.setHex(0xef4444); // turns alert red
          visorMat.emissiveIntensity = 1.4;
          coreMat.emissive.setHex(0xf59e0b);

          // Face JetBot when close!
          const angleToBot = Math.atan2(robotPos.x - curX, robotPos.z - curZ);
          bipedRoot.rotation.y = angleToBot;

          if (elapsedTime - alien.lastChirpTime > 3.0) {
            alien.lastChirpTime = elapsedTime;
            robotAudio.playAlienEncounter();
          }
        } else {
          visorMat.emissive.setHex(0x0284c7);
          visorMat.emissiveIntensity = 0.9;
          coreMat.emissive.setHex(0x10b981);
        }
      },
    };

    aliens.push(alien);
    return alien;
  }

  // ASTRONAUT CREATOR: "Martian Explorer Astronaut" (Phi hành gia khám phá Sao Hỏa)
  function createAstronaut(
    startX: number,
    startZ: number,
    name: string,
    badgeColor = 0xef4444,
    role = 'Commander'
  ): AstronautEntity {
    const astronautRoot = new THREE.Group();
    astronautRoot.name = `Astronaut_${name}`;
    // EXACT SAME SIZE AS BIPED ALIEN (~0.38x scale, height ~0.31m, smaller than JetBot)
    astronautRoot.scale.set(0.38, 0.38, 0.38);

    // Suit materials
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // EVA White space suit fabric
      roughness: 0.85,
      metalness: 0.12,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Pressure seal joints
      roughness: 0.7,
      metalness: 0.3,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, // Apollo/Artemis gold-coated reflective sun visor
      metalness: 0.95,
      roughness: 0.12,
    });
    const plssMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.45,
      roughness: 0.4,
    });
    const badgeMat = new THREE.MeshStandardMaterial({
      color: badgeColor,
      roughness: 0.5,
      metalness: 0.5,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
    });

    // 1. Pelvis / Utility Belt
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), jointMat);
    pelvis.position.y = 0.44;
    astronautRoot.add(pelvis);

    // Belt buckle
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), badgeMat);
    buckle.position.set(0, 0, 0.065);
    pelvis.add(buckle);

    // 2. Torso (Pressurized white EVA suit)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.26, 14), suitMat);
    torso.position.set(0, 0.17, 0);
    pelvis.add(torso);

    // Chest DCM (Display and Control Module) unit
    const dcm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.08, 0.04), jointMat);
    dcm.position.set(0, 0.03, 0.095);
    torso.add(dcm);

    // Status LED dots on chest
    const ledMat1 = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const ledMat2 = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const led1 = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), ledMat1);
    led1.position.set(-0.025, 0.015, 0.022);
    dcm.add(led1);
    const led2 = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), ledMat2);
    led2.position.set(0.025, 0.015, 0.022);
    dcm.add(led2);

    // Mission Patch / Chevron on chest
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.025), badgeMat);
    patch.position.set(0, 0.08, 0.096);
    torso.add(patch);

    // 3. Life Support Backpack (PLSS)
    const plss = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.10), plssMat);
    plss.position.set(0, 0.03, -0.11);
    torso.add(plss);

    // Dual oxygen cylinders
    const o2Geom = new THREE.CylinderGeometry(0.022, 0.022, 0.20, 8);
    const o2L = new THREE.Mesh(o2Geom, plssMat);
    o2L.position.set(-0.06, 0, -0.04);
    plss.add(o2L);
    const o2R = new THREE.Mesh(o2Geom, plssMat);
    o2R.position.set(0.06, 0, -0.04);
    plss.add(o2R);

    // Comm antenna on backpack
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.002, 0.18, 6), jointMat);
    ant.position.set(0.06, 0.18, -0.04);
    plss.add(ant);

    // 4. Helmet Group
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, 0.22, 0);

    const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 14), suitMat);
    helmetShell.scale.set(1.0, 1.05, 1.02);
    helmetGroup.add(helmetShell);

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), visorMat);
    visor.scale.set(0.9, 0.82, 0.95);
    visor.position.set(0, 0.01, 0.04);
    helmetGroup.add(visor);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), lampMat);
    lamp.position.set(0.085, 0.06, 0.07);
    helmetGroup.add(lamp);

    // Panic Alert Badge (Floating "!" above head when fleeing)
    const panicGroup = new THREE.Group();
    panicGroup.position.set(0, 0.25, 0);
    const exclamationStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.008, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.2 })
    );
    exclamationStem.position.y = 0.04;
    panicGroup.add(exclamationStem);
    const exclamationDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.2 })
    );
    exclamationDot.position.y = -0.015;
    panicGroup.add(exclamationDot);
    panicGroup.visible = false;
    helmetGroup.add(panicGroup);

    torso.add(helmetGroup);

    // 5. Two Articulated Legs
    const legGeom = new THREE.CylinderGeometry(0.024, 0.018, 0.22, 8);
    const calfGeom = new THREE.CylinderGeometry(0.018, 0.014, 0.24, 8);
    const bootGeom = new THREE.BoxGeometry(0.068, 0.035, 0.14);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, metalness: 0.1 });

    const legLGroup = new THREE.Group();
    legLGroup.position.set(-0.09, 0, 0);
    const thighL = new THREE.Mesh(legGeom, suitMat);
    thighL.position.y = -0.11;
    legLGroup.add(thighL);
    const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), jointMat);
    kneeL.position.y = -0.22;
    legLGroup.add(kneeL);
    const calfL = new THREE.Mesh(calfGeom, suitMat);
    calfL.position.y = -0.33;
    legLGroup.add(calfL);
    const bootL = new THREE.Mesh(bootGeom, bootMat);
    bootL.position.set(0, -0.44, 0.03);
    legLGroup.add(bootL);
    pelvis.add(legLGroup);

    const legRGroup = new THREE.Group();
    legRGroup.position.set(0.09, 0, 0);
    const thighR = new THREE.Mesh(legGeom, suitMat);
    thighR.position.y = -0.11;
    legRGroup.add(thighR);
    const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), jointMat);
    kneeR.position.y = -0.22;
    legRGroup.add(kneeR);
    const calfR = new THREE.Mesh(calfGeom, suitMat);
    calfR.position.y = -0.33;
    legRGroup.add(calfR);
    const bootR = new THREE.Mesh(bootGeom, bootMat);
    bootR.position.set(0, -0.44, 0.03);
    legRGroup.add(bootR);
    pelvis.add(legRGroup);

    // 6. Two Articulated Arms
    const armGeom = new THREE.CylinderGeometry(0.020, 0.016, 0.20, 8);
    const forearmGeom = new THREE.CylinderGeometry(0.016, 0.012, 0.20, 8);
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 });

    const armLGroup = new THREE.Group();
    armLGroup.position.set(-0.14, 0.08, 0);
    const armL = new THREE.Mesh(armGeom, suitMat);
    armL.position.y = -0.09;
    armLGroup.add(armL);
    const forearmL = new THREE.Mesh(forearmGeom, suitMat);
    forearmL.position.set(0, -0.25, 0.03);
    armLGroup.add(forearmL);
    const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), gloveMat);
    gloveL.position.set(0, -0.36, 0.03);
    armLGroup.add(gloveL);
    torso.add(armLGroup);

    const armRGroup = new THREE.Group();
    armRGroup.position.set(0.14, 0.08, 0);
    const armR = new THREE.Mesh(armGeom, suitMat);
    armR.position.y = -0.09;
    armRGroup.add(armR);
    const forearmR = new THREE.Mesh(forearmGeom, suitMat);
    forearmR.position.set(0, -0.25, 0.03);
    armRGroup.add(forearmR);
    const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), gloveMat);
    gloveR.position.set(0, -0.36, 0.03);
    armRGroup.add(gloveR);

    if (role === 'Geologist') {
      const toolGeom = new THREE.BoxGeometry(0.04, 0.06, 0.02);
      const toolMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.8 });
      const tool = new THREE.Mesh(toolGeom, toolMat);
      tool.position.set(0, -0.38, 0.05);
      armRGroup.add(tool);
    }

    // Multi-part Procedural Excavation Shovel (visible during 'digging')
    const shovelGroup = new THREE.Group();
    shovelGroup.name = 'AstronautShovel';
    shovelGroup.position.set(0, -0.35, 0.04);
    shovelGroup.rotation.x = Math.PI * 0.36;
    const shovelShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.44, 8),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7, metalness: 0.12 })
    );
    shovelShaft.position.set(0, -0.06, 0);
    shovelGroup.add(shovelShaft);

    const shovelGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.022, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.25 })
    );
    shovelGrip.position.set(0, 0.16, 0);
    shovelGroup.add(shovelGrip);

    const shovelCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.015, 0.04, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.82 })
    );
    shovelCollar.position.set(0, -0.25, 0);
    shovelGroup.add(shovelCollar);

    const shovelBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.115, 0.145, 0.014),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.24, metalness: 0.88 })
    );
    shovelBlade.position.set(0, -0.33, 0.012);
    shovelBlade.rotation.x = -0.15;
    shovelGroup.add(shovelBlade);
    shovelGroup.visible = false;
    armRGroup.add(shovelGroup);

    torso.add(armRGroup);

    // Multi-part Procedural Carried Component Crate (visible while carrying & delivering to JetBot)
    const carriedCrateGroup = new THREE.Group();
    carriedCrateGroup.name = 'AstronautCarriedCrate';
    carriedCrateGroup.position.set(0, -0.03, 0.23);

    const crateFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.72,
    });
    const crateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.16), crateFrameMat);
    carriedCrateGroup.add(crateFrame);

    const crateCoreMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.45,
      roughness: 0.22,
      metalness: 0.3,
    });
    const crateCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.175), crateCoreMat);
    carriedCrateGroup.add(crateCore);

    const crateTrimBands = new THREE.Mesh(
      new THREE.BoxGeometry(0.235, 0.03, 0.172),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 })
    );
    carriedCrateGroup.add(crateTrimBands);

    const crateHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.026, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
    );
    crateHandle.position.set(0, 0.095, 0);
    carriedCrateGroup.add(crateHandle);

    carriedCrateGroup.visible = false;
    torso.add(carriedCrateGroup);

    // Multi-part Procedural Hydroponic Watering Can (visible during greenhouse crop-watering shifts)
    const wateringCanGroup = new THREE.Group();
    wateringCanGroup.name = 'AstronautWateringCan';
    wateringCanGroup.position.set(0, -0.34, 0.14);
    wateringCanGroup.rotation.x = 0.25;

    const canBodyMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
      metalness: 0.55,
    });
    const canTank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.072, 0.14, 10),
      canBodyMat
    );
    wateringCanGroup.add(canTank);

    const canSpout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.018, 0.16, 8),
      canBodyMat
    );
    canSpout.position.set(0, 0.03, 0.11);
    canSpout.rotation.x = Math.PI * 0.34;
    wateringCanGroup.add(canSpout);

    const canRose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.014, 0.025, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.28, metalness: 0.8 })
    );
    canRose.position.set(0, 0.068, 0.19);
    canRose.rotation.x = Math.PI * 0.38;
    wateringCanGroup.add(canRose);

    const canHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.6 })
    );
    canHandle.position.set(0, 0.04, -0.05);
    canHandle.rotation.y = Math.PI / 2;
    wateringCanGroup.add(canHandle);
    wateringCanGroup.visible = false;
    armRGroup.add(wateringCanGroup);

    // Animated Water Mist Droplets streaming onto crops when watering
    const SPRAY_DROP_COUNT = 22;
    const sprayPositions = new Float32Array(SPRAY_DROP_COUNT * 3);
    const sprayPhases = new Float32Array(SPRAY_DROP_COUNT);
    for (let i = 0; i < SPRAY_DROP_COUNT; i++) {
      sprayPhases[i] = i / SPRAY_DROP_COUNT;
      sprayPositions[i * 3] = 0;
      sprayPositions[i * 3 + 1] = 0.5;
      sprayPositions[i * 3 + 2] = 0.4;
    }
    const sprayGeom = new THREE.BufferGeometry();
    sprayGeom.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    const sprayMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.032,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const waterSprayPoints = new THREE.Points(sprayGeom, sprayMat);
    waterSprayPoints.visible = false;
    astronautRoot.add(waterSprayPoints);

    // Floating Handoff Beacon above helmet when carrying / ready for [Z] pickup
    const handoffBeaconGroup = new THREE.Group();
    handoffBeaconGroup.position.set(0, 0.27, 0);
    const handoffDiamondMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.4,
    });
    const handoffDiamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.048, 0),
      handoffDiamondMat
    );
    handoffBeaconGroup.add(handoffDiamond);
    const handoffHaloMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
    });
    const handoffHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.008, 8, 24),
      handoffHaloMat
    );
    handoffHalo.rotation.x = Math.PI / 2;
    handoffBeaconGroup.add(handoffHalo);
    handoffBeaconGroup.visible = false;
    helmetGroup.add(handoffBeaconGroup);

    // Ground shadow
    const shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
    );
    shadowMesh.rotateX(-Math.PI / 2);
    shadowMesh.position.y = 0.002;
    astronautRoot.add(shadowMesh);

    group.add(astronautRoot);

    // Dynamic AI Flee, Patrol & Excavation-Delivery State
    let posX = startX;
    let posZ = startZ;
    let heading = Math.random() * Math.PI * 2;
    let curSpeed = 0.38;
    let lastPanicTime = -10;
    let patrolTimer = 0;
    const patrolTarget = new THREE.Vector2(startX + (Math.random() - 0.5) * 3, startZ + (Math.random() - 0.5) * 3);

    let digEndsAtMs = 0;
    let digSpotX = startX;
    let digSpotZ = startZ;
    let lastCarryWallMs = 0;

    type WateringPhase =
      | 'none'
      | 'to-ramp'
      | 'enter-airlock'
      | 'to-bed'
      | 'watering-crops'
      | 'to-inner-exit'
      | 'exit-airlock'
      | 'exit-ramp';

    const WATERING_STOPS: ReadonlyArray<{ lx: number; lz: number; faceBedX: number }> = [
      { lx: -0.15, lz: 0.42, faceBedX: -0.64 },
      { lx: -0.15, lz: -0.34, faceBedX: -0.64 },
      { lx: 0.15, lz: -0.30, faceBedX: 0.64 },
    ];
    let wateringPhase: WateringPhase = 'none';
    let wateringStopIndex = 0;
    let wateringStationTimer = 0;
    let lastWaterSfxAt = -10;

    const resetWateringVisuals = () => {
      wateringPhase = 'none';
      wateringStopIndex = 0;
      wateringStationTimer = 0;
      wateringCanGroup.visible = false;
      waterSprayPoints.visible = false;
    };

    const astronaut: AstronautEntity = {
      mesh: astronautRoot,
      center: new THREE.Vector2(posX, posZ),
      position: new THREE.Vector3(posX, 0, posZ),
      radius: 0.16,
      name,
      isFleeing: false,
      isWateringGreenhouse: false,
      state: 'calm',
      taskState: 'idle',
      taskItemColorHex: 0xf59e0b,
      nearestAlienDist: 999,
      startWateringShift: () => {
        if (astronaut.taskState !== 'idle' || astronaut.isWateringGreenhouse) return;
        wateringPhase = 'to-ramp';
        wateringStopIndex = 0;
        wateringStationTimer = 0;
        astronaut.isWateringGreenhouse = true;
        astronaut.isFleeing = false;
        astronaut.state = 'watering';
        panicGroup.visible = false;
        shovelGroup.visible = false;
        carriedCrateGroup.visible = false;
        handoffBeaconGroup.visible = false;
        wateringCanGroup.visible = true;
        waterSprayPoints.visible = false;
      },
      startDigTask: (robotPos, itemColorHex, digDurationSec = 1.4) => {
        resetWateringVisuals();
        astronaut.isWateringGreenhouse = false;
        astronaut.taskItemColorHex = itemColorHex;
        crateCoreMat.color.setHex(itemColorHex);
        crateCoreMat.emissive.setHex(itemColorHex);
        handoffDiamondMat.color.setHex(itemColorHex);
        handoffDiamondMat.emissive.setHex(itemColorHex);

        // Ensure astronaut is reasonably close & visible in camera view so dig + delivery flows smoothly
        const curDist = Math.hypot(posX - robotPos.x, posZ - robotPos.z);
        if (curDist > 3.0) {
          const spawnAngle = Math.atan2(posX - robotPos.x, posZ - robotPos.z);
          posX = Math.max(-11.4, Math.min(11.4, robotPos.x + Math.sin(spawnAngle) * 1.75));
          posZ = Math.max(-11.4, Math.min(11.4, robotPos.z + Math.cos(spawnAngle) * 1.75));
        } else if (curDist < 0.85) {
          const awayAngle = curDist > 0.05 ? Math.atan2(posX - robotPos.x, posZ - robotPos.z) : 0.7;
          posX = Math.max(-11.4, Math.min(11.4, robotPos.x + Math.sin(awayAngle) * 1.35));
          posZ = Math.max(-11.4, Math.min(11.4, robotPos.z + Math.cos(awayAngle) * 1.35));
        }

        const clampedStart = clampActorOutsideStaticDomes(posX, posZ, astronaut.radius);
        posX = clampedStart.x;
        posZ = clampedStart.z;

        const dirToBotX = robotPos.x - posX;
        const dirToBotZ = robotPos.z - posZ;
        const norm = Math.hypot(dirToBotX, dirToBotZ) || 1;
        const rawDigX = Math.max(-11.5, Math.min(11.5, posX + (dirToBotX / norm) * 0.22));
        const rawDigZ = Math.max(-11.5, Math.min(11.5, posZ + (dirToBotZ / norm) * 0.22));
        const clampedDig = clampActorOutsideStaticDomes(rawDigX, rawDigZ, astronaut.radius);
        digSpotX = clampedDig.x;
        digSpotZ = clampedDig.z;
        heading = Math.atan2(digSpotX - posX, digSpotZ - posZ);

        digEndsAtMs = performance.now() + digDurationSec * 1000;
        lastCarryWallMs = performance.now();
        astronaut.taskState = 'digging';
        astronaut.state = 'digging';
        astronaut.isFleeing = false;
        panicGroup.visible = false;
        carriedCrateGroup.visible = false;
        handoffBeaconGroup.visible = false;
        shovelGroup.visible = true;
      },
      completeReceiveTask: () => {
        astronaut.taskState = 'idle';
        astronaut.state = 'waving';
        shovelGroup.visible = false;
        carriedCrateGroup.visible = false;
        handoffBeaconGroup.visible = false;
      },
      cancelTask: () => {
        astronaut.taskState = 'idle';
        astronaut.state = 'calm';
        shovelGroup.visible = false;
        carriedCrateGroup.visible = false;
        handoffBeaconGroup.visible = false;
      },
      update: (delta, elapsedTime, allAliens, robotPos) => {
        // 1. Scan distance to all aliens
        let closestAlien: AlienEntity | null = null;
        let minAlienDist = 999;
        for (const al of allAliens) {
          const d = Math.hypot(posX - al.center.x, posZ - al.center.y);
          if (d < minAlienDist) {
            minAlienDist = d;
            closestAlien = al;
          }
        }
        astronaut.nearestAlienDist = minAlienDist;

        const distToBot = Math.hypot(posX - robotPos.x, posZ - robotPos.z);
        const nowWallMs = performance.now();
        let overrideCarryStepDelta: number | null = null;
        const ghAirlock = marsGreenhouse ? marsGreenhouse.getAirlockState() : closedGreenhouseAirlock;
        const localPos = worldToGreenhouseLocal(posX, posZ);

        // Priority A: Active Astronaut Digging Mission
        if (astronaut.taskState === 'digging') {
          resetWateringVisuals();
          astronaut.isWateringGreenhouse = false;
          astronaut.isFleeing = false;
          astronaut.state = 'digging';
          panicGroup.visible = false;
          shovelGroup.visible = true;
          carriedCrateGroup.visible = false;
          handoffBeaconGroup.visible = false;

          curSpeed = THREE.MathUtils.damp(curSpeed, 0, 12, delta);
          heading = Math.atan2(digSpotX - posX, digSpotZ - posZ);

          // Energetic digging stance & shovel scooping motion
          const scoop = elapsedTime * 11.5;
          torso.rotation.x = 0.44 + Math.sin(scoop) * 0.08;
          armRGroup.rotation.x = -0.95 + Math.sin(scoop) * 0.55;
          armRGroup.rotation.z = -0.15;
          armLGroup.rotation.x = -0.78 + Math.sin(scoop) * 0.42;
          legLGroup.rotation.x = -0.18;
          legRGroup.rotation.x = 0.22;
          pelvis.position.y = 0.41 + Math.abs(Math.sin(scoop)) * 0.015;

          lampMat.emissive.setHex(0xf59e0b);
          lampMat.emissiveIntensity = 1.3;

          if (nowWallMs >= digEndsAtMs) {
            astronaut.taskState = 'carrying';
            astronaut.state = 'carrying';
            lastCarryWallMs = nowWallMs;
            shovelGroup.visible = false;
            carriedCrateGroup.visible = true;
            handoffBeaconGroup.visible = true;
            robotAudio.playDiggingSound();
          }

        // Priority B: Carrying excavated crate toward JetBot & waiting for [Z] handoff
        } else if (astronaut.taskState === 'carrying' || astronaut.taskState === 'ready-handoff') {
          resetWateringVisuals();
          astronaut.isWateringGreenhouse = false;
          astronaut.isFleeing = false;
          panicGroup.visible = false;
          shovelGroup.visible = false;
          carriedCrateGroup.visible = true;
          handoffBeaconGroup.visible = true;

          const angleToBot = Math.atan2(robotPos.x - posX, robotPos.z - posZ);
          heading = angleToBot;

          // Spin & bob floating handoff beacon above helmet
          handoffBeaconGroup.rotation.y = elapsedTime * 3.5;
          handoffBeaconGroup.position.y = 0.27 + Math.sin(elapsedTime * 5) * 0.02;

          const wallStep = Math.min(0.45, Math.max(delta, (nowWallMs - lastCarryWallMs) / 1000));
          lastCarryWallMs = nowWallMs;

          if (distToBot > ASTRONAUT_STOP_DISTANCE_METERS) {
            astronaut.taskState = 'carrying';
            astronaut.state = 'carrying';
            curSpeed = 1.45;
            overrideCarryStepDelta = wallStep;

            const stride = elapsedTime * 9.5;
            legLGroup.rotation.x = Math.sin(stride) * 0.56;
            legRGroup.rotation.x = -Math.sin(stride) * 0.56;
            armLGroup.rotation.x = -1.12 + Math.sin(stride) * 0.06;
            armRGroup.rotation.x = -1.12 + Math.sin(stride) * 0.06;
            armRGroup.rotation.z = 0;
            torso.rotation.x = 0.12;
            pelvis.position.y = 0.44 + Math.abs(Math.sin(stride)) * 0.025;
            carriedCrateGroup.position.y = -0.02 + Math.abs(Math.sin(stride)) * 0.015;

            lampMat.emissive.setHex(astronaut.taskItemColorHex);
            lampMat.emissiveIntensity = 1.2;
          } else {
            astronaut.taskState = 'ready-handoff';
            astronaut.state = 'ready-handoff';
            curSpeed = 0;

            legLGroup.rotation.x = 0;
            legRGroup.rotation.x = 0;
            armLGroup.rotation.x = -1.16 + Math.sin(elapsedTime * 4.5) * 0.07;
            armRGroup.rotation.x = -1.16 + Math.sin(elapsedTime * 4.5) * 0.07;
            armRGroup.rotation.z = 0;
            torso.rotation.x = 0.04;
            pelvis.position.y = 0.44;
            carriedCrateGroup.position.y = -0.01 + Math.sin(elapsedTime * 4.5) * 0.022;

            handoffDiamondMat.color.setHex(0x10b981);
            handoffDiamondMat.emissive.setHex(0x10b981);
            lampMat.emissive.setHex(0x10b981);
            lampMat.emissiveIntensity = 1.4;
          }

        // Priority C: Scheduled Mars Greenhouse Crop-Watering Shift (Strict 2-Door Airlock & Purge Loop!)
        } else if (astronaut.isWateringGreenhouse && wateringPhase !== 'none') {
          astronaut.isFleeing = false;
          astronaut.state = 'watering';
          panicGroup.visible = false;
          shovelGroup.visible = false;
          carriedCrateGroup.visible = false;
          handoffBeaconGroup.visible = false;
          wateringCanGroup.visible = true;
          lampMat.emissive.setHex(0x22c55e);
          lampMat.emissiveIntensity = 1.15;

          const steerToLocal = (txLocalX: number, txLocalZ: number, moveSpeed: number) => {
            const targetWorld = greenhouseLocalToWorld(txLocalX, txLocalZ);
            const desiredHeading = Math.atan2(targetWorld.wx - posX, targetWorld.wz - posZ);
            let diff = desiredHeading - heading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            heading += diff * Math.min(1.0, 6.5 * delta);
            curSpeed = THREE.MathUtils.damp(curSpeed, moveSpeed, 6, delta);
            return Math.hypot(targetWorld.wx - posX, targetWorld.wz - posZ);
          };

          if (wateringPhase === 'to-ramp') {
            waterSprayPoints.visible = false;
            const detourNeeded = localPos.lz < 2.25 && Math.abs(localPos.lx) < 1.8;
            const targetLx = detourNeeded ? (localPos.lx >= 0 ? 1.95 : -1.45) : 0;
            const targetLz = detourNeeded ? 2.85 : 2.52;
            const d = steerToLocal(targetLx, targetLz, 0.72);
            if (!detourNeeded && d < 0.24) {
              wateringPhase = 'enter-airlock';
            }
          } else if (wateringPhase === 'enter-airlock') {
            waterSprayPoints.visible = false;
            const insideChamber = Math.abs(localPos.lx) <= 0.28 && localPos.lz <= 1.88 && localPos.lz >= 1.52;
            if (!insideChamber) {
              if (ghAirlock.outerDoorOpen >= 0.72 || localPos.lz <= 2.26) {
                steerToLocal(0, 1.72, 0.56);
              } else {
                // Wait respectfully at ramp threshold until outer door slides open
                steerToLocal(0, 2.48, 0);
              }
            } else if (ghAirlock.innerDoorOpen >= 0.72) {
              wateringStopIndex = 0;
              wateringPhase = 'to-bed';
            } else {
              // Inside sealed chamber undergoing pressurization + perchlorate dust air-shower
              steerToLocal(0, 1.0, 0);
            }
          } else if (wateringPhase === 'to-bed') {
            waterSprayPoints.visible = false;
            const stop = WATERING_STOPS[wateringStopIndex];
            const d = steerToLocal(stop.lx, stop.lz, 0.52);
            if (d < 0.14) {
              wateringPhase = 'watering-crops';
              wateringStationTimer = 0;
            }
          } else if (wateringPhase === 'watering-crops') {
            const stop = WATERING_STOPS[wateringStopIndex];
            const bedTarget = greenhouseLocalToWorld(stop.faceBedX, stop.lz);
            const faceHeading = Math.atan2(bedTarget.wx - posX, bedTarget.wz - posZ);
            let diff = faceHeading - heading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            heading += diff * Math.min(1.0, 8.0 * delta);
            curSpeed = THREE.MathUtils.damp(curSpeed, 0, 12, delta);

            wateringStationTimer += delta;
            waterSprayPoints.visible = true;

            // Animate water mist droplets arching from sprayer rose down onto hydroponic plants
            const sAttr = sprayGeom.attributes.position as THREE.BufferAttribute;
            const sArr = sAttr.array as Float32Array;
            for (let i = 0; i < SPRAY_DROP_COUNT; i++) {
              const ph = (sprayPhases[i] + elapsedTime * 1.9) % 1;
              const lateral = (((i * 7) % 11) - 5) * 0.032;
              sArr[i * 3] = 0.08 + lateral * ph;
              sArr[i * 3 + 1] = 0.58 + Math.sin(ph * Math.PI) * 0.08 - ph * 0.34;
              sArr[i * 3 + 2] = 0.32 + ph * 0.58;
            }
            sAttr.needsUpdate = true;

            if (elapsedTime - lastWaterSfxAt > 2.2 && distToBot < 8.5) {
              lastWaterSfxAt = elapsedTime;
              robotAudio.playWateringMist();
            }

            if (wateringStationTimer >= 2.7) {
              waterSprayPoints.visible = false;
              wateringStopIndex++;
              if (wateringStopIndex < WATERING_STOPS.length) {
                wateringPhase = 'to-bed';
              } else {
                wateringPhase = 'to-inner-exit';
              }
            }
          } else if (wateringPhase === 'to-inner-exit') {
            waterSprayPoints.visible = false;
            if (localPos.lz < 1.24) {
              if (ghAirlock.innerDoorOpen >= 0.72) {
                steerToLocal(0, 1.72, 0.54);
              } else {
                steerToLocal(0, 0.94, 0.44);
              }
            } else {
              wateringPhase = 'exit-airlock';
            }
          } else if (wateringPhase === 'exit-airlock') {
            waterSprayPoints.visible = false;
            if (ghAirlock.outerDoorOpen >= 0.72) {
              wateringPhase = 'exit-ramp';
            } else {
              steerToLocal(0, 1.72, 0.25);
            }
          } else if (wateringPhase === 'exit-ramp') {
            waterSprayPoints.visible = false;
            steerToLocal(0, 3.25, 0.65);
            if (localPos.lz >= 3.05) {
              resetWateringVisuals();
              astronaut.isWateringGreenhouse = false;
              astronaut.state = 'calm';
            }
          }

          // Pose articulation for watering shift (carrying can, dust purge, or watering)
          if (wateringPhase === 'watering-crops') {
            torso.rotation.x = 0.14;
            legLGroup.rotation.x = -0.06;
            legRGroup.rotation.x = 0.06;
            armRGroup.rotation.x = -0.88 + Math.sin(elapsedTime * 4.5) * 0.10;
            armRGroup.rotation.z = -0.08;
            armLGroup.rotation.x = -0.18;
            pelvis.position.y = 0.44;
          } else if (wateringPhase === 'enter-airlock' && ghAirlock.dustShowerActive) {
            torso.rotation.x = 0;
            legLGroup.rotation.x = 0;
            legRGroup.rotation.x = 0;
            armLGroup.rotation.x = -0.75 + Math.sin(elapsedTime * 14) * 0.08;
            armRGroup.rotation.x = -0.55;
            armRGroup.rotation.z = 0;
            pelvis.position.y = 0.44;
          } else if (curSpeed > 0.08) {
            const stride = elapsedTime * 5.6;
            legLGroup.rotation.x = Math.sin(stride) * 0.46;
            legRGroup.rotation.x = -Math.sin(stride) * 0.46;
            armLGroup.rotation.x = -Math.sin(stride) * 0.36;
            armRGroup.rotation.x = -0.45 + Math.sin(stride) * 0.12;
            armRGroup.rotation.z = 0;
            torso.rotation.x = 0.04;
            pelvis.position.y = 0.44 + Math.abs(Math.sin(stride)) * 0.018;
          } else {
            torso.rotation.x = 0;
            legLGroup.rotation.x = 0;
            legRGroup.rotation.x = 0;
            armLGroup.rotation.x = 0;
            armRGroup.rotation.x = -0.42;
            armRGroup.rotation.z = 0;
            pelvis.position.y = 0.44;
          }

        // 2. Normal Idle AI: Flee Logic when alien approaches (< 2.8m)
        } else if (minAlienDist < 2.8 && closestAlien) {
          wateringCanGroup.visible = false;
          waterSprayPoints.visible = false;
          astronaut.isFleeing = true;
          astronaut.state = 'fleeing';
          shovelGroup.visible = false;
          carriedCrateGroup.visible = false;
          handoffBeaconGroup.visible = false;

          // Flee vector away from alien
          const fleeX = posX - closestAlien.center.x;
          const fleeZ = posZ - closestAlien.center.y;
          const targetHeading = Math.atan2(fleeX, fleeZ);

          let diff = targetHeading - heading;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          heading += diff * Math.min(1.0, 8.0 * delta);

          // Fast sprint speed!
          curSpeed = THREE.MathUtils.damp(curSpeed, 1.45, 5, delta);

          if (elapsedTime - lastPanicTime > 3.5) {
            lastPanicTime = elapsedTime;
            robotAudio.playAstronautPanic();
          }

          // Visual panic cues: blinking headlamp & visible floating alert icon
          panicGroup.visible = true;
          panicGroup.rotation.y = elapsedTime * 8;
          lampMat.emissive.setHex(Math.sin(elapsedTime * 16) > 0 ? 0xef4444 : 0xf59e0b);
          lampMat.emissiveIntensity = 1.6;

          // Fast running stride
          const stride = elapsedTime * 13.5;
          legLGroup.rotation.x = Math.sin(stride) * 0.72;
          legRGroup.rotation.x = -Math.sin(stride) * 0.72;
          armLGroup.rotation.x = -Math.sin(stride) * 0.85;
          armRGroup.rotation.x = Math.sin(stride) * 0.85;
          armRGroup.rotation.z = 0;

          // Sprinter forward lean
          torso.rotation.x = 0.24;
          pelvis.position.y = 0.44 + Math.abs(Math.sin(stride)) * 0.035;

        } else if (distToBot < 1.6 && !astronaut.isFleeing) {
          wateringCanGroup.visible = false;
          waterSprayPoints.visible = false;
          // Safe near JetBot: stop and friendly wave!
          astronaut.isFleeing = false;
          astronaut.state = 'waving';
          panicGroup.visible = false;
          shovelGroup.visible = false;
          carriedCrateGroup.visible = false;
          handoffBeaconGroup.visible = false;
          lampMat.emissive.setHex(0x10b981);
          lampMat.emissiveIntensity = 0.9;

          curSpeed = THREE.MathUtils.damp(curSpeed, 0, 6, delta);

          const angleToBot = Math.atan2(robotPos.x - posX, robotPos.z - posZ);
          heading = angleToBot;

          armRGroup.rotation.x = -1.35 + Math.sin(elapsedTime * 6) * 0.25;
          armRGroup.rotation.z = -0.55 + Math.cos(elapsedTime * 6) * 0.35;
          armLGroup.rotation.x = 0;
          legLGroup.rotation.x = 0;
          legRGroup.rotation.x = 0;
          torso.rotation.x = 0;
          pelvis.position.y = 0.44;

        } else {
          wateringCanGroup.visible = false;
          waterSprayPoints.visible = false;
          // Normal calm patrol / exploration
          astronaut.isFleeing = false;
          astronaut.state = 'calm';
          panicGroup.visible = false;
          shovelGroup.visible = false;
          carriedCrateGroup.visible = false;
          handoffBeaconGroup.visible = false;
          lampMat.emissive.setHex(0x38bdf8);
          lampMat.emissiveIntensity = 0.8;

          curSpeed = THREE.MathUtils.damp(curSpeed, 0.40, 4, delta);
          torso.rotation.x = 0;
          armRGroup.rotation.z = 0;

          patrolTimer += delta;
          if (patrolTimer > 7 || Math.hypot(posX - patrolTarget.x, posZ - patrolTarget.y) < 0.6) {
            patrolTimer = 0;
            patrolTarget.set(startX + (Math.random() - 0.5) * 5, startZ + (Math.random() - 0.5) * 5);
          }
          const desiredHeading = Math.atan2(patrolTarget.x - posX, patrolTarget.y - posZ);
          let diff = desiredHeading - heading;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          heading += diff * Math.min(1.0, 3.0 * delta);

          const stride = elapsedTime * 4.8;
          legLGroup.rotation.x = Math.sin(stride) * 0.44;
          legRGroup.rotation.x = -Math.sin(stride) * 0.44;
          armLGroup.rotation.x = -Math.sin(stride) * 0.38;
          armRGroup.rotation.x = Math.sin(stride) * 0.38;
          pelvis.position.y = 0.44 + Math.abs(Math.sin(stride)) * 0.018;
        }

        // 3. Position displacement
        const moveDt = overrideCarryStepDelta !== null ? overrideCarryStepDelta : delta;
        let stepDist = curSpeed * moveDt;
        if (overrideCarryStepDelta !== null) {
          stepDist = Math.min(stepDist, Math.max(0, distToBot - ASTRONAUT_STOP_DISTANCE_METERS));
        }
        posX += Math.sin(heading) * stepDist;
        posZ += Math.cos(heading) * stepDist;

        // Arena boundary retention (28m diameter Mars boundary, +/-11.8m)
        if (posX > 11.8) { posX = 11.8; heading = Math.PI - heading; }
        if (posX < -11.8) { posX = -11.8; heading = Math.PI - heading; }
        if (posZ > 11.8) { posZ = 11.8; heading = -heading; }
        if (posZ < -11.8) { posZ = -11.8; heading = -heading; }

        if (astronaut.isWateringGreenhouse && mapType === 'mars-planet') {
          const ghCol = resolveGreenhouseCollision(posX, posZ, astronaut.radius, ghAirlock);
          const domeRes = resolveStaticDomePushout(ghCol.x, ghCol.z, astronaut.radius, -5.8, 1.4, 1.15);
          posX = domeRes.x;
          posZ = domeRes.z;
        } else {
          const domeClamp = clampActorOutsideStaticDomes(posX, posZ, astronaut.radius);
          posX = domeClamp.x;
          posZ = domeClamp.z;
        }

        astronaut.center.set(posX, posZ);

        // 4. Climbable Hill & Greenhouse Ramp/Floor Elevation adaptation
        const elev = getElevationAt ? getElevationAt(posX, posZ, heading) : { elevation: 0, slopePitch: 0, slopeRoll: 0 };
        astronautRoot.position.set(posX, elev.elevation, posZ);
        astronaut.position.set(posX, elev.elevation, posZ);
        astronautRoot.rotation.order = 'YXZ';
        astronautRoot.rotation.set(elev.slopePitch, heading, elev.slopeRoll);
      },
    };

    astronauts.push(astronaut);
    return astronaut;
  }

  // Populate moving aliens and astronauts across the expanded 28m Mars surface!
  if (mapType === 'mars-planet') {
    // 1. Aerial & Scout Aliens
    createAlienScout(2.2, 1.8, 3.2);
    createAlienTripod(-2.5, 3.5, 2.8);
    createAlienCrawler(3.2, -3.0, 3.5);

    // 2. Bipedal Walking Aliens (Người Ngoài Hành Tinh Đi Hai Chân)
    createAlienBiped(
      5.2, 4.2, 3.6,
      'Người Ngoài Hành Tinh Chiến Binh (Bipedal Warrior Alpha)',
      0x0284c7 // Cyan-Blue Carapace
    );
    createAlienBiped(
      -5.8, 5.2, 3.4,
      'Người Ngoài Hành Tinh Thám Hiểm (Bipedal Scout Beta)',
      0x9333ea // Violet-Purple Carapace
    );
    createAlienBiped(
      4.8, -5.5, 3.8,
      'Người Ngoài Hành Tinh Trưởng Lão (Bipedal Elder Gamma)',
      0x059669 // Emerald-Green Carapace
    );

    // 3. Human Astronauts (Cùng kích thước với alien, thấy alien lại gần thì bỏ chạy!)
    createAstronaut(
      -1.6, -1.0,
      'Phi Hành Gia Neil (Chỉ Huy Trạm)',
      0xef4444, // Red Commander Chevron
      'Commander'
    );
    createAstronaut(
      1.5, 1.0,
      'Phi Hành Gia Buzz (Kỹ Sư Trưởng)',
      0x0284c7, // Blue Engineering Chevron
      'Engineer'
    );
    createAstronaut(
      -3.0, 2.2,
      'Phi Hành Gia Sally (Nhà Khoa Học Địa Chất)',
      0xf97316, // Orange Science Chevron
      'Geologist'
    );
  }

  // ================================================================
  // 4. COLLISION DETECTION & TOPPLING FOR OBSTACLES
  // ================================================================
  const checkAndToppleObstacles = (robotX: number, robotZ: number, speed: number): boolean => {
    let newlyToppled = false;
    const robotRadius = 0.16;

    for (const obs of obstacles) {
      if (obs.isToppled) continue;
      // Mountains and research domes are massive immovable geological/base structures
      if (obs.type === 'mars-mountain' || obs.type === 'mars-dome') continue;

      const dx = obs.center.x - robotX;
      const dz = obs.center.y - robotZ;
      const dist = Math.hypot(dx, dz);

      if (dist < obs.radius + robotRadius && Math.abs(speed) > 0.04) {
        obs.isToppled = true;
        const pushDir = new THREE.Vector3(dx, 0, dz).normalize();
        obs.toppleAxis.set(-pushDir.z, 0, pushDir.x).normalize();
        obs.angularVel = 5.5 + Math.abs(speed) * 4.5;

        robotAudio.playObstacleCrash();
        newlyToppled = true;
      }
    }

    return newlyToppled;
  };

  const updateObstaclesPhysics = (delta: number) => {
    // Martian gravity is ~0.38g, Earth is 1.0g
    const gravityMult = mapType === 'mars-planet' ? 6.5 : 14.0;

    for (const obs of obstacles) {
      if (!obs.isToppled) continue;

      if (obs.toppleAngle < obs.maxToppleAngle) {
        obs.angularVel += gravityMult * delta;
        obs.toppleAngle += obs.angularVel * delta;

        if (obs.toppleAngle >= obs.maxToppleAngle) {
          obs.toppleAngle = obs.maxToppleAngle;
          obs.angularVel = -obs.angularVel * (mapType === 'mars-planet' ? 0.38 : 0.22);
          if (Math.abs(obs.angularVel) < 0.6) {
            obs.angularVel = 0;
          }
        }
      } else if (obs.angularVel < 0) {
        obs.toppleAngle += obs.angularVel * delta;
        if (obs.toppleAngle < obs.maxToppleAngle - 0.1) {
          obs.angularVel = -obs.angularVel;
        }
      }

      _sharedQuat.setFromAxisAngle(obs.toppleAxis, obs.toppleAngle);
      obs.mesh.setRotationFromQuaternion(_sharedQuat);
      obs.mesh.position.y = -Math.sin(obs.toppleAngle) * 0.02;
    }
  };

  const resetAllObstacles = () => {
    for (const obs of obstacles) {
      obs.isToppled = false;
      obs.toppleAngle = 0;
      obs.angularVel = 0;
      obs.mesh.rotation.set(0, 0, 0);
      obs.mesh.position.copy(obs.initialPos);
    }
    robotAudio.playClick(900);
  };

  const getToppledCount = () => {
    const toppled = obstacles.filter((o) => o.isToppled).length;
    return { toppled, total: obstacles.length };
  };

  // ================================================================
  // 5. UPDATE MOVING ALIENS, GREENHOUSE AIRLOCK & ASTRONAUT SHIFTS
  // ================================================================
  let marsClockSec = 0;
  let nextWateringShiftAt = 1.8;
  let wateringAstronautTurn = 0;

  const updateAliens = (delta: number, elapsedTime: number, robotPos: THREE.Vector3) => {
    marsClockSec += delta;
    let nearestAlienDist = 999;
    let alienDetected = false;

    for (const alien of aliens) {
      alien.update(delta, elapsedTime, robotPos);
      const d = Math.hypot(alien.center.x - robotPos.x, alien.center.y - robotPos.z);
      if (d < nearestAlienDist) {
        nearestAlienDist = d;
      }
      if (d < 1.4) {
        alienDetected = true;
      }
    }

    let isCharging = false;
    let chargingBatteryLevel = undefined;
    if (spaceshipHangar) {
      const dockRes = spaceshipHangar.update(delta, elapsedTime, robotPos);
      isCharging = dockRes.isDocked;
      chargingBatteryLevel = dockRes.batteryPercent;
    }

    // Periodically dispatch a calm astronaut on a greenhouse watering shift
    if (mapType === 'mars-planet' && marsGreenhouse && astronauts.length > 0) {
      const someoneWatering = astronauts.some((a) => a.isWateringGreenhouse);
      if (!someoneWatering && marsClockSec >= nextWateringShiftAt) {
        const candidate =
          astronauts.find((_, idx) => idx === wateringAstronautTurn % astronauts.length && astronauts[idx].taskState === 'idle') ||
          astronauts.find((a) => a.taskState === 'idle');
        if (candidate?.startWateringShift) {
          candidate.startWateringShift();
          wateringAstronautTurn++;
          nextWateringShiftAt = marsClockSec + 32;
        }
      }

      const worldActors: { id: string; x: number; z: number }[] = [
        { id: 'jetbot', x: robotPos.x, z: robotPos.z },
      ];
      for (const ast of astronauts) {
        if (ast.isWateringGreenhouse) {
          worldActors.push({ id: ast.name, x: ast.center.x, z: ast.center.y });
        }
      }
      marsGreenhouse.update(delta, elapsedTime, worldActors);
    }

    // Update Human Astronauts (watering crops, digging, waving at JetBot, or fleeing from aliens!)
    let isAstronautFleeing = false;
    let astronautWatering = false;
    for (const astronaut of astronauts) {
      astronaut.update(delta, elapsedTime, aliens, robotPos);
      if (astronaut.isFleeing) {
        isAstronautFleeing = true;
      }
      if (astronaut.isWateringGreenhouse) {
        astronautWatering = true;
      }
    }

    return {
      nearestAlienDist,
      alienDetected,
      isCharging,
      chargingBatteryLevel,
      isAstronautFleeing,
      astronautWatering,
      astronautsCount: astronauts.length,
    };
  };

  // ================================================================
  // 6. RPLIDAR SIMULATED 360° POINT CLOUD (Detects Obstacles, Aliens & Astronauts!)
  // ================================================================
  const POINT_COUNT = 96;
  const pointPositions = new Float32Array(POINT_COUNT * 3);
  const pointColors = new Float32Array(POINT_COUNT * 3);

  for (let i = 0; i < POINT_COUNT; i++) {
    pointPositions[i * 3] = 0;
    pointPositions[i * 3 + 1] = 0.16;
    pointPositions[i * 3 + 2] = 0;

    pointColors[i * 3] = 0.2;
    pointColors[i * 3 + 1] = 0.8;
    pointColors[i * 3 + 2] = 1.0;
  }

  const pointCloudGeom = new THREE.BufferGeometry();
  pointCloudGeom.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
  pointCloudGeom.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

  const pointCloudMat = new THREE.PointsMaterial({
    size: 0.048,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const pointCloud = new THREE.Points(pointCloudGeom, pointCloudMat);
  group.add(pointCloud);

  const updatePointCloud = (robotPos: THREE.Vector3, robotHeading: number, _scanAngle: number) => {
    const posAttr = pointCloudGeom.attributes.position as THREE.BufferAttribute;
    const colAttr = pointCloudGeom.attributes.color as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;
    const colArray = colAttr.array as Float32Array;

    let minObstacleDist = 999;
    let minAlienDist = 999;
    const maxRange = mapType === 'mars-planet' ? 8.5 : 2.8;

    for (let i = 0; i < POINT_COUNT; i++) {
      const angle = (i / POINT_COUNT) * Math.PI * 2 + robotHeading;
      const dirX = Math.sin(angle);
      const dirZ = Math.cos(angle);

      let hitDist = maxRange;
      let isAlienHit = false;
      let isAstronautHit = false;

      // Arena walls / perimeter
      const bound = mapType === 'mars-planet' ? 12.8 : 2.95;
      if (dirX > 0.001) hitDist = Math.min(hitDist, (bound - robotPos.x) / dirX);
      if (dirX < -0.001) hitDist = Math.min(hitDist, (-bound - robotPos.x) / dirX);
      if (dirZ > 0.001) hitDist = Math.min(hitDist, (bound - robotPos.z) / dirZ);
      if (dirZ < -0.001) hitDist = Math.min(hitDist, (-bound - robotPos.z) / dirZ);

      // Obstacles
      for (const obs of obstacles) {
        const effectiveRadius = obs.isToppled ? obs.radius * 0.4 : obs.radius;
        const ox = obs.center.x - robotPos.x;
        const oz = obs.center.y - robotPos.z;
        const proj = ox * dirX + oz * dirZ;
        if (proj > 0) {
          const perpDistSq = (ox * ox + oz * oz) - (proj * proj);
          if (perpDistSq < effectiveRadius * effectiveRadius) {
            const insideDist = Math.sqrt(effectiveRadius * effectiveRadius - perpDistSq);
            const dist = proj - insideDist;
            if (dist > 0 && dist < hitDist) {
              hitDist = dist;
            }
          }
        }
      }

      // Moving Aliens Detection in RPLIDAR Laser!
      for (const alien of aliens) {
        const ax = alien.center.x - robotPos.x;
        const az = alien.center.y - robotPos.z;
        const proj = ax * dirX + az * dirZ;
        if (proj > 0) {
          const perpDistSq = (ax * ax + az * az) - (proj * proj);
          if (perpDistSq < alien.radius * alien.radius) {
            const insideDist = Math.sqrt(alien.radius * alien.radius - perpDistSq);
            const dist = proj - insideDist;
            if (dist > 0 && dist < hitDist) {
              hitDist = dist;
              isAlienHit = true;
            }
          }
        }
      }

      // Astronauts Detection in RPLIDAR Laser!
      for (const astronaut of astronauts) {
        const ax = astronaut.center.x - robotPos.x;
        const az = astronaut.center.y - robotPos.z;
        const proj = ax * dirX + az * dirZ;
        if (proj > 0) {
          const perpDistSq = (ax * ax + az * az) - (proj * proj);
          if (perpDistSq < astronaut.radius * astronaut.radius) {
            const insideDist = Math.sqrt(astronaut.radius * astronaut.radius - perpDistSq);
            const dist = proj - insideDist;
            if (dist > 0 && dist < hitDist) {
              hitDist = dist;
              isAstronautHit = true;
            }
          }
        }
      }

      // Mars Greenhouse walls, beds, airlock cheeks & closed blast doors in RPLIDAR!
      if (mapType === 'mars-planet' && marsGreenhouse) {
        const airlock = marsGreenhouse.getAirlockState();
        const originLocal = worldToGreenhouseLocal(robotPos.x, robotPos.z);
        const c = Math.cos(MARS_GREENHOUSE_SPEC.rotationY);
        const s = Math.sin(MARS_GREENHOUSE_SPEC.rotationY);
        const dirLocalX = dirX * c - dirZ * s;
        const dirLocalZ = dirX * s + dirZ * c;

        const ghBoxes: [number, number, number, number][] = [
          [-1.06, -0.40, -1.22, 1.20],
          [0.40, 1.06, -1.22, 1.20],
          [-1.06, 1.06, -1.24, -1.04],
          [-0.48, -0.40, 1.20, 2.26],
          [0.40, 0.48, 1.20, 2.26],
          [-0.66, 0.50, -1.74, -1.20],
          [1.04, 1.72, -0.96, 0.84],
        ];
        if (airlock.outerDoorOpen < 0.72) {
          ghBoxes.push([-0.40, 0.40, 2.22, 2.26]);
        }
        if (airlock.innerDoorOpen < 0.72) {
          ghBoxes.push([-0.40, 0.40, 1.18, 1.22]);
        }

        for (const [bMinX, bMaxX, bMinZ, bMaxZ] of ghBoxes) {
          let tmin = 0;
          let tmax = hitDist;
          if (Math.abs(dirLocalX) < 1e-6) {
            if (originLocal.lx < bMinX || originLocal.lx > bMaxX) continue;
          } else {
            const invX = 1 / dirLocalX;
            let tx1 = (bMinX - originLocal.lx) * invX;
            let tx2 = (bMaxX - originLocal.lx) * invX;
            if (tx1 > tx2) {
              const tmp = tx1; tx1 = tx2; tx2 = tmp;
            }
            tmin = Math.max(tmin, tx1);
            tmax = Math.min(tmax, tx2);
            if (tmin > tmax) continue;
          }
          if (Math.abs(dirLocalZ) < 1e-6) {
            if (originLocal.lz < bMinZ || originLocal.lz > bMaxZ) continue;
          } else {
            const invZ = 1 / dirLocalZ;
            let tz1 = (bMinZ - originLocal.lz) * invZ;
            let tz2 = (bMaxZ - originLocal.lz) * invZ;
            if (tz1 > tz2) {
              const tmp = tz1; tz1 = tz2; tz2 = tmp;
            }
            tmin = Math.max(tmin, tz1);
            tmax = Math.min(tmax, tz2);
            if (tmin > tmax) continue;
          }
          if (tmin > 0.02 && tmin < hitDist) {
            hitDist = tmin;
          }
        }
      }

      if (isAlienHit) {
        if (hitDist < minAlienDist) minAlienDist = hitDist;
      } else {
        if (hitDist < minObstacleDist) minObstacleDist = hitDist;
      }

      // Point coordinate
      posArray[i * 3] = robotPos.x + dirX * hitDist;
      posArray[i * 3 + 1] = 0.17;
      posArray[i * 3 + 2] = robotPos.z + dirZ * hitDist;

      // Color coding:
      // Golden/Amber for Astronauts!
      // Purple/Neon Magenta for Aliens!
      // Red for Danger (<0.5m), Amber for Warning (<1.2m), Cyan/Emerald for Safe
      if (isAstronautHit) {
        colArray[i * 3] = 0.95;
        colArray[i * 3 + 1] = 0.85;
        colArray[i * 3 + 2] = 0.2; // Warm Golden Astronaut color!
      } else if (isAlienHit) {
        colArray[i * 3] = 0.85;
        colArray[i * 3 + 1] = 0.2;
        colArray[i * 3 + 2] = 1.0; // Neon Alien Purple!
      } else if (hitDist < 0.5) {
        colArray[i * 3] = 1.0;
        colArray[i * 3 + 1] = 0.15;
        colArray[i * 3 + 2] = 0.15;
      } else if (hitDist < 1.2) {
        colArray[i * 3] = 1.0;
        colArray[i * 3 + 1] = 0.75;
        colArray[i * 3 + 2] = 0.1;
      } else {
        colArray[i * 3] = 0.15;
        colArray[i * 3 + 1] = 0.85;
        colArray[i * 3 + 2] = 0.95;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    return { minObstacleDist, minAlienDist };
  };

  const climbMoundSpecs: MarsClimbMoundSpec[] = climbableMounds.map((m) => ({
    x: m.center.x,
    z: m.center.y,
    radius: m.radius,
    height: m.height,
  }));

  const getPointElevationAt = (x: number, z: number): number => {
    if (mapType !== 'mars-planet') return 0;
    return Math.max(
      sampleMarsTerrainPointElevation(x, z, climbMoundSpecs),
      sampleGreenhouseElevationAt(x, z)
    );
  };

  // Function to calculate terrain elevation and slope pitch/roll at any (x, z) for robot climbing
  const getElevationAt = (x: number, z: number, heading = 0): TerrainElevation => {
    if (mapType !== 'mars-planet') {
      return { elevation: 0, slopePitch: 0, slopeRoll: 0 };
    }
    return computeChassisTerrainPose(x, z, heading, getPointElevationAt);
  };

  // ================================================================
  // 7. ASTRONAUT EXCAVATION & HANDOFF COORDINATOR
  // ================================================================
  const findActiveTaskAstronaut = (): AstronautEntity | null => {
    return astronauts.find((a) => a.taskState !== 'idle') || null;
  };

  const startAstronautDig = (robotPos: THREE.Vector3, itemColorHex: number): boolean => {
    if (astronauts.length === 0) return false;
    if (findActiveTaskAstronaut()) return false;

    const available = astronauts.filter((a) => !a.isWateringGreenhouse);
    const pool = available.length > 0 ? available : astronauts;
    let closest = pool[0];
    let minDist = Math.hypot(closest.center.x - robotPos.x, closest.center.y - robotPos.z);
    for (let i = 1; i < pool.length; i++) {
      const candidate = pool[i];
      const d = Math.hypot(candidate.center.x - robotPos.x, candidate.center.y - robotPos.z);
      if (d < minDist) {
        minDist = d;
        closest = candidate;
      }
    }
    closest.startDigTask(robotPos, itemColorHex, 1.45);
    return true;
  };

  const completeAstronautReceive = (): { x: number; y: number; z: number } | null => {
    const active = findActiveTaskAstronaut();
    if (!active) return null;
    const spot = { x: active.position.x, y: active.position.y + 0.16, z: active.position.z };
    active.completeReceiveTask();
    return spot;
  };

  const cancelAstronautTask = () => {
    for (const a of astronauts) {
      if (a.taskState !== 'idle') {
        a.cancelTask();
      }
    }
  };

  const getAstronautTaskTelemetry = (robotPos: THREE.Vector3) => {
    const active = findActiveTaskAstronaut();
    if (!active) {
      return {
        status: 'idle' as AstronautDigStatus,
        canReceiveZ: false,
      };
    }
    const distanceToBot = Math.hypot(active.center.x - robotPos.x, active.center.y - robotPos.z);
    const shortName = active.name.split('(')[0].trim();
    return {
      status: active.taskState,
      astronautName: shortName,
      distanceToBot: Math.round(distanceToBot * 100) / 100,
      canReceiveZ: canJetBotReceiveFromAstronaut(active.taskState, distanceToBot),
      activePos: { x: active.position.x, y: active.position.y, z: active.position.z },
    };
  };

  const resolveGreenhouseCollisionForScene = (x: number, z: number, radius: number) => {
    if (mapType !== 'mars-planet' || !marsGreenhouse) {
      return { x, z, blocked: false, zone: 'outside' as GreenhouseZone };
    }
    return resolveGreenhouseCollision(x, z, radius, marsGreenhouse.getAirlockState());
  };

  const getGreenhouseStatus = (robotX: number, robotZ: number) => {
    if (mapType !== 'mars-planet' || !marsGreenhouse) return null;
    const { lx, lz } = worldToGreenhouseLocal(robotX, robotZ);
    const zone = classifyGreenhouseZone(lx, lz);
    return describeAirlockForHud(marsGreenhouse.getAirlockState(), zone);
  };

  return {
    group,
    obstacles,
    climbableMounds,
    aliens,
    astronauts,
    mapType,
    pointCloud,
    getPointElevationAt,
    getElevationAt,
    resolveGreenhouseCollision: resolveGreenhouseCollisionForScene,
    getGreenhouseStatus,
    updatePointCloud,
    updateObstaclesPhysics,
    updateAliens,
    startAstronautDig,
    completeAstronautReceive,
    cancelAstronautTask,
    getAstronautTaskTelemetry,
    checkAndToppleObstacles,
    resetAllObstacles,
    getToppledCount,
    dispose: () => {
      spaceshipHangar?.dispose();
      marsGreenhouse?.dispose();
      marsTerrain?.dispose();
      pointCloudGeom.dispose();
      pointCloudMat.dispose();
      for (const item of sceneDisposables) {
        item.dispose();
      }
    },
  };
}
