import * as THREE from 'three';
import { robotAudio } from './audioSynth';

export interface MarsSpaceshipHangar {
  group: THREE.Group;
  dockCenter: THREE.Vector3;
  update: (delta: number, time: number, robotPos: THREE.Vector3) => { isDocked: boolean; batteryPercent: number };
  dispose: () => void;
}

/**
 * Creates the Astronaut Spaceship (Tàu vũ trụ phi hành gia) with an open
 * sheltered docking hangar underneath that JetBot can drive into, complete with
 * an articulated charging cable that connects to the robot.
 */
export function createMarsSpaceshipHangar(isSoftwareGl = false): MarsSpaceshipHangar {
  const group = new THREE.Group();
  group.name = 'MarsSpaceshipHangar';

  // Base position for spaceship landing complex
  const SHIP_X = -4.8;
  const SHIP_Z = -4.2;
  group.position.set(SHIP_X, 0, SHIP_Z);

  // Exact center coordinate of the docking bay inside the hangar where JetBot rests
  const dockCenter = new THREE.Vector3(SHIP_X, 0, SHIP_Z + 0.35);

  const disposables: { dispose: () => void }[] = [];

  // ====================================================================
  // 1. OCTAGONAL LANDING APRON / CONCRETE BLAST PAD
  // ====================================================================
  const padCanvas = document.createElement('canvas');
  padCanvas.width = 512;
  padCanvas.height = 512;
  const pctx = padCanvas.getContext('2d')!;

  // Dark thermal concrete base
  pctx.fillStyle = '#27272a';
  pctx.fillRect(0, 0, 512, 512);

  // Hexagonal thermal grid lines
  pctx.strokeStyle = '#3f3f46';
  pctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 32) {
    pctx.beginPath();
    pctx.moveTo(i, 0);
    pctx.lineTo(i, 512);
    pctx.stroke();
    pctx.beginPath();
    pctx.moveTo(0, i);
    pctx.lineTo(512, i);
    pctx.stroke();
  }

  // Rocket exhaust scorch mark
  const scorch = pctx.createRadialGradient(256, 256, 40, 256, 256, 220);
  scorch.addColorStop(0, 'rgba(10, 10, 10, 0.85)');
  scorch.addColorStop(0.6, 'rgba(40, 20, 10, 0.5)');
  scorch.addColorStop(1, 'rgba(40, 40, 40, 0)');
  pctx.fillStyle = scorch;
  pctx.beginPath();
  pctx.arc(256, 256, 220, 0, Math.PI * 2);
  pctx.fill();

  // Landing Target Circle & Hangar Guideway Chevrons
  pctx.strokeStyle = '#f59e0b';
  pctx.lineWidth = 8;
  pctx.beginPath();
  pctx.arc(256, 256, 180, 0, Math.PI * 2);
  pctx.stroke();

  pctx.fillStyle = '#f59e0b';
  pctx.font = 'bold 24px monospace';
  pctx.textAlign = 'center';
  pctx.fillText('ASTRONAUT SHIP - DOCKING APRON 01', 256, 60);
  pctx.fillText('JETBOT CHARGE BAY ENTRY ➜', 256, 470);

  const padTex = new THREE.CanvasTexture(padCanvas);
  padTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(padTex);

  const padGeom = new THREE.CylinderGeometry(3.2, 3.4, 0.04, 8);
  disposables.push(padGeom);
  const padMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: 0.85,
    metalness: 0.2,
  });
  disposables.push(padMat);
  const padMesh = new THREE.Mesh(padGeom, padMat);
  padMesh.position.y = 0.02;
  padMesh.receiveShadow = !isSoftwareGl;
  group.add(padMesh);

  // ====================================================================
  // 2. ASTRONAUT SPACESHIP (TÀU VŨ TRỤ THÁM HIỂM SAO HỎA)
  // ====================================================================
  const shipGroup = new THREE.Group();
  shipGroup.position.set(0, 0.72, 0); // Elevated to create high clearance hangar underneath!

  // 2.1 Spaceship Main Fuselage (Thân tên lửa hình trụ cao 4.2m)
  const fuselageGeom = new THREE.CylinderGeometry(0.85, 0.85, 3.8, 24);
  disposables.push(fuselageGeom);
  const fuselageMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.85,
    roughness: 0.2,
  });
  disposables.push(fuselageMat);
  const fuselage = new THREE.Mesh(fuselageGeom, fuselageMat);
  fuselage.position.y = 1.9;
  fuselage.castShadow = !isSoftwareGl;
  shipGroup.add(fuselage);

  // Heat-shield ceramic black tile half-shell on re-entry face
  const heatShieldGeom = new THREE.CylinderGeometry(0.858, 0.858, 3.8, 24, 1, false, 0, Math.PI);
  disposables.push(heatShieldGeom);
  const heatShieldMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.95,
    metalness: 0.1,
  });
  disposables.push(heatShieldMat);
  const heatShield = new THREE.Mesh(heatShieldGeom, heatShieldMat);
  heatShield.position.y = 1.9;
  heatShield.rotation.y = -Math.PI / 2;
  shipGroup.add(heatShield);

  // 2.2 Aerodynamic Nosecone / Command Module (Khoang chỉ huy hình nón nhọn)
  const noseGeom = new THREE.ConeGeometry(0.85, 1.8, 24);
  disposables.push(noseGeom);
  const nose = new THREE.Mesh(noseGeom, fuselageMat);
  nose.position.y = 3.8 + 0.9;
  shipGroup.add(nose);

  // Heat shield on nosecone
  const noseShieldGeom = new THREE.ConeGeometry(0.856, 1.8, 24, 1, false, 0, Math.PI);
  disposables.push(noseShieldGeom);
  const noseShield = new THREE.Mesh(noseShieldGeom, heatShieldMat);
  noseShield.position.y = 3.8 + 0.9;
  noseShield.rotation.y = -Math.PI / 2;
  shipGroup.add(noseShield);

  // 2.3 Astronaut Cockpit Panoramic Viewing Dome (Kính buồng lái phi hành gia)
  const cockpitGeom = new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  cockpitGeom.rotateX(Math.PI / 2);
  disposables.push(cockpitGeom);
  const cockpitMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.75,
    roughness: 0.1,
    metalness: 0.9,
  });
  disposables.push(cockpitMat);
  const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
  cockpit.position.set(0, 4.3, 0.76);
  cockpit.rotation.x = -0.25;
  shipGroup.add(cockpit);

  // Interior astronaut cabin warm light
  const cockpitLight = new THREE.PointLight(0x38bdf8, 1.8, 4);
  cockpitLight.position.set(0, 4.3, 0.6);
  shipGroup.add(cockpitLight);

  // 2.4 Aerodynamic Grid Fins (Cánh điều hướng trên thân)
  const finGeom = new THREE.BoxGeometry(0.45, 0.02, 0.28);
  disposables.push(finGeom);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
  disposables.push(finMat);
  for (let f = 0; f < 4; f++) {
    const fin = new THREE.Mesh(finGeom, finMat);
    const angle = (f / 4) * Math.PI * 2 + Math.PI / 4;
    fin.position.set(Math.cos(angle) * 0.98, 3.5, Math.sin(angle) * 0.98);
    fin.rotation.y = angle;
    shipGroup.add(fin);
  }

  // 2.5 Thruster Cluster (Cụm 3 động cơ tên lửa phản lực bên dưới)
  const thrusterMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.95,
    roughness: 0.2,
  });
  disposables.push(thrusterMat);
  for (let t = 0; t < 3; t++) {
    const tAngle = (t / 3) * Math.PI * 2;
    const bellGeom = new THREE.CylinderGeometry(0.12, 0.24, 0.35, 16, 1, true);
    disposables.push(bellGeom);
    const bell = new THREE.Mesh(bellGeom, thrusterMat);
    bell.position.set(Math.cos(tAngle) * 0.35, -0.15, Math.sin(tAngle) * 0.35);
    shipGroup.add(bell);

    // Cyan plasma pre-ignition glow ring
    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide })
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.set(Math.cos(tAngle) * 0.35, -0.32, Math.sin(tAngle) * 0.35);
    shipGroup.add(glowRing);
  }

  // 2.6 4 Heavy Hydraulic Landing Struts & Footpads (Chân đáp tàu vũ trụ)
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });
  disposables.push(strutMat);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.4 });
  disposables.push(footMat);

  const legAngles = [
    Math.PI * 0.25,   // Front-Right
    Math.PI * 0.75,   // Rear-Right
    Math.PI * 1.25,   // Rear-Left
    Math.PI * 1.75,   // Front-Left
  ];

  legAngles.forEach((angle) => {
    const legGroup = new THREE.Group();
    const legR = 1.45;
    const footX = Math.cos(angle) * legR;
    const footZ = Math.sin(angle) * legR;

    // Diagonal upper strut
    const strutGeom = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 10);
    disposables.push(strutGeom);
    const strut = new THREE.Mesh(strutGeom, strutMat);
    strut.position.set(footX * 0.5, 0.32, footZ * 0.5);
    strut.lookAt(footX, -0.68, footZ);
    strut.rotateX(Math.PI / 2);
    legGroup.add(strut);

    // Footpad dish
    const footGeom = new THREE.CylinderGeometry(0.22, 0.25, 0.06, 12);
    disposables.push(footGeom);
    const foot = new THREE.Mesh(footGeom, footMat);
    foot.position.set(footX, -0.68, footZ);
    legGroup.add(foot);

    shipGroup.add(legGroup);
  });

  // 2.7 Exterior Crew Airlock & Access Ladder
  const ladderGroup = new THREE.Group();
  ladderGroup.position.set(-0.86, 1.4, 0);
  const ladderMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 });
  disposables.push(ladderMat);
  for (let r = 0; r < 7; r++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.24), ladderMat);
    rung.position.y = -r * 0.22;
    ladderGroup.add(rung);
  }
  shipGroup.add(ladderGroup);

  group.add(shipGroup);

  // ====================================================================
  // 3. KHOẢNG TRỐNG JETBOT CHUI VÀO (SHELTERED DOCKING HANGAR)
  // ====================================================================
  // Directly between the front landing legs: wide open entrance
  const hangarGroup = new THREE.Group();
  hangarGroup.position.set(0, 0, 0.35); // centered at dock entrance

  // Hangar Canopy Frame (Mái vòm khoang trú ẩn)
  const canopyGeom = new THREE.BoxGeometry(1.25, 0.08, 1.55);
  disposables.push(canopyGeom);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.8,
    roughness: 0.3,
  });
  disposables.push(canopyMat);
  const canopy = new THREE.Mesh(canopyGeom, canopyMat);
  canopy.position.y = 0.68; // 68cm clear height (JetBot is ~28cm)
  hangarGroup.add(canopy);

  // Left and Right Hangar Protective Side Walls
  const wallGeom = new THREE.BoxGeometry(0.06, 0.68, 1.55);
  disposables.push(wallGeom);
  const wallL = new THREE.Mesh(wallGeom, canopyMat);
  wallL.position.set(-0.62, 0.34, 0);
  hangarGroup.add(wallL);

  const wallR = new THREE.Mesh(wallGeom, canopyMat);
  wallR.position.set(0.62, 0.34, 0);
  hangarGroup.add(wallR);

  // Yellow-Black Hazard Stripe Entrance Portal Arch
  const portalArchGeom = new THREE.BoxGeometry(1.35, 0.12, 0.08);
  disposables.push(portalArchGeom);
  const portalArchMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
  });
  disposables.push(portalArchMat);
  const portalArch = new THREE.Mesh(portalArchGeom, portalArchMat);
  portalArch.position.set(0, 0.68, 0.78);
  hangarGroup.add(portalArch);

  // Industrial Worklights illuminating the interior when JetBot drives inside
  const workLight = new THREE.PointLight(0x38bdf8, 2.2, 3.5);
  workLight.position.set(0, 0.62, 0);
  hangarGroup.add(workLight);

  // Entrance Hazard Strip Floor Guide Tracks
  const trackMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85 });
  disposables.push(trackMat);
  const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 1.4), trackMat);
  trackL.position.set(-0.25, 0.045, 0);
  hangarGroup.add(trackL);
  const trackR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 1.4), trackMat);
  trackR.position.set(0.25, 0.045, 0);
  hangarGroup.add(trackR);

  // Illuminated Docking Target Pad in Center
  const dockPadGeom = new THREE.CircleGeometry(0.32, 24);
  dockPadGeom.rotateX(-Math.PI / 2);
  disposables.push(dockPadGeom);
  const dockPadMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.75,
  });
  disposables.push(dockPadMat);
  const dockPad = new THREE.Mesh(dockPadGeom, dockPadMat);
  dockPad.position.set(0, 0.046, 0);
  hangarGroup.add(dockPad);

  // Wall-mounted Charging Station Terminal Box & Hologram Banner
  const terminalGeom = new THREE.BoxGeometry(0.4, 0.3, 0.12);
  disposables.push(terminalGeom);
  const terminalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
  disposables.push(terminalMat);
  const terminal = new THREE.Mesh(terminalGeom, terminalMat);
  terminal.position.set(0, 0.42, -0.72);
  hangarGroup.add(terminal);

  // Status Holographic LED Display Screen
  const screenGeom = new THREE.PlaneGeometry(0.34, 0.16);
  disposables.push(screenGeom);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
  disposables.push(screenMat);
  const screenMesh = new THREE.Mesh(screenGeom, screenMat);
  screenMesh.position.set(0, 0.42, -0.65);
  hangarGroup.add(screenMesh);

  // ====================================================================
  // 4. ARTICULATED ROBOTIC CHARGING CABLE (DÂY KẾT NỐI SẠC JETBOT)
  // ====================================================================
  // Overhead swivel arm that hangs down above the docking target
  const armGroup = new THREE.Group();
  armGroup.position.set(0, 0.64, -0.25);

  const cableArmGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
  disposables.push(cableArmGeom);
  const cableArmMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 });
  disposables.push(cableArmMat);
  const cableArm = new THREE.Mesh(cableArmGeom, cableArmMat);
  cableArm.rotation.x = Math.PI / 4;
  armGroup.add(cableArm);

  // Coiled flexible heavy-duty charging cable (Dây cáp sạc)
  // Constructed with a dynamic multi-segment tube/curve
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.7,
    metalness: 0.3,
  });
  disposables.push(cableMat);

  // 6 articulated cable links dropping down toward robot
  const cableSegments: THREE.Mesh[] = [];
  for (let c = 0; c < 6; c++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.065, 8), cableMat);
    seg.position.set(0, -0.06 * c - 0.04, 0.03 * c);
    armGroup.add(seg);
    cableSegments.push(seg);
  }

  // Magnetic Golden Charging Coupler / Plug Nozzle (Đầu cắm sạc nam châm)
  const plugGeom = new THREE.CylinderGeometry(0.032, 0.024, 0.07, 12);
  disposables.push(plugGeom);
  const plugMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.95,
    roughness: 0.1,
    emissive: 0x10b981,
    emissiveIntensity: 0.2,
  });
  disposables.push(plugMat);
  const plugNozzle = new THREE.Mesh(plugGeom, plugMat);
  plugNozzle.position.set(0, -0.38, 0.18);
  armGroup.add(plugNozzle);

  // Glowing energy conduit indicator on the plug
  const energyGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85 })
  );
  energyGlow.position.set(0, -0.42, 0.18);
  energyGlow.visible = false;
  armGroup.add(energyGlow);

  hangarGroup.add(armGroup);
  group.add(hangarGroup);

  // Charging status tracking
  let batteryCharge = 82; // Initial battery level percent
  let wasDocked = false;

  // ====================================================================
  // UPDATE LOOP (Runs at 60 FPS)
  // ====================================================================
  const update = (delta: number, time: number, robotPos: THREE.Vector3) => {
    // Check distance between JetBot and the docking center
    const dx = robotPos.x - dockCenter.x;
    const dz = robotPos.z - dockCenter.z;
    const distToDock = Math.hypot(dx, dz);

    // JetBot is inside the docking hangar if within 0.52m of the dock center
    const isDocked = distToDock < 0.52;

    if (isDocked) {
      if (!wasDocked) {
        wasDocked = true;
        robotAudio.playChargingDock();
      }

      // Progressively charge battery up to 100%
      batteryCharge = Math.min(100, batteryCharge + delta * 2.8);

      // 1. Lower the charging cable to connect directly onto robot rear
      armGroup.rotation.x = THREE.MathUtils.damp(armGroup.rotation.x, 0.32, 5, delta);
      plugNozzle.position.y = THREE.MathUtils.damp(plugNozzle.position.y, -0.48, 5, delta);

      // 2. Pulse active charging green glow
      energyGlow.visible = true;
      const pulse = 0.75 + Math.sin(time * 8) * 0.25;
      (energyGlow.material as THREE.MeshBasicMaterial).opacity = pulse;
      dockPadMat.emissive.setHex(0x10b981);
      dockPadMat.emissiveIntensity = 1.2 * pulse;
      screenMat.color.setHex(0x10b981); // Screen turns emerald charging green
      workLight.color.setHex(0x10b981);
      workLight.intensity = 2.8;
      portalArchMat.emissive.setHex(0x10b981);
    } else {
      wasDocked = false;

      // Standby idle mode
      armGroup.rotation.x = THREE.MathUtils.damp(armGroup.rotation.x, 0.0, 4, delta);
      plugNozzle.position.y = THREE.MathUtils.damp(plugNozzle.position.y, -0.38, 4, delta);

      energyGlow.visible = false;
      dockPadMat.emissive.setHex(0x06b6d4);
      dockPadMat.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.2;
      screenMat.color.setHex(0x06b6d4); // Screen stays standby cyan
      workLight.color.setHex(0x38bdf8);
      workLight.intensity = 1.8;
      portalArchMat.emissive.setHex(0xd97706);
    }

    return {
      isDocked,
      batteryPercent: Math.round(batteryCharge),
    };
  };

  const dispose = () => {
    disposables.forEach((d) => {
      try {
        d.dispose();
      } catch {}
    });
  };

  return {
    group,
    dockCenter,
    update,
    dispose,
  };
}
