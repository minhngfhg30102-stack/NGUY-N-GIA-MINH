import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface JetBotModel {
  rootGroup: THREE.Group;
  groups: {
    chassis: THREE.Group;
    jetsonNano: THREE.Group;
    rplidar: THREE.Group;
    rplidarTurret: THREE.Group;
    rplidarPulley?: THREE.Group;
    coolingFan?: THREE.Group;
    cameraCsi: THREE.Group;
    dcMotors: THREE.Group;
    driveWheels: THREE.Group;
    leftWheel: THREE.Group;
    rightWheel: THREE.Group;
    casterWheels: THREE.Group;
    frontCasterFork: THREE.Group;
    frontCasterWheel: THREE.Group;
    rearCasterFork: THREE.Group;
    rearCasterWheel: THREE.Group;
    motorDriver: THREE.Group;
    wifiAntennas: THREE.Group;
    battery: THREE.Group;
  };
  highlightMeshes: Map<string, THREE.Mesh[]>;
  laserBeam: THREE.LineSegments;
  scanFan: THREE.Mesh;
  contactShadow: THREE.Mesh;
  updateCableMovement?: (delta: number, linearVel: number, angularVel: number, elapsedTime: number) => void;
}

// ==========================================
// PROCEDURAL TEXTURE GENERATORS
// ==========================================

// 1. Procedural Texture: CSI Camera FFC Ribbon Cable with exact text from photo (image_f841a927.png)
function createRibbonCableTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // White/light grey flexible ribbon base
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 1024);

  // Parallel copper trace lines (15-pin CSI layout)
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  for (let x = 12; x < 256; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }

  // Characteristic blue reinforcement stiffener tab at connector end (from photo)
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillRect(0, 928, 256, 96);

  // Silkscreen text matching photo: green AWM 20706 105C 60V VW-1
  ctx.save();
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 22px monospace';
  ctx.translate(128, 512);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('AWM 20706  105C  60V  VW-1', 0, -40);
  ctx.fillText('AWM 20706  105C  60V  VW-1', 0, 0);
  ctx.fillText('AWM 20706  105C  60V  VW-1', 0, 40);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 2. Procedural Texture: RPLIDAR Top Disc with authentic logo and dual screw holes (exact match to image_70fc6719.png)
function createLidarLogoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Matte black circular cap
  ctx.fillStyle = '#16191f';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concentric micro-grooves (turned satin finish)
  for (let r = 50; r < 240; r += 12) {
    ctx.strokeStyle = '#1e232b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Outer bevel ring
  ctx.strokeStyle = '#2d333f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(256, 256, 236, 0, Math.PI * 2);
  ctx.stroke();

  // Raised / Beveled Center Circular Medallion (exact match to photo image_70fc6719.png)
  ctx.fillStyle = '#1e222a';
  ctx.beginPath();
  ctx.arc(256, 256, 126, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#333b47';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Subtle inner shadow ring
  ctx.strokeStyle = '#0d0f13';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 122, 0, Math.PI * 2);
  ctx.stroke();

  // RPLIDAR Silkscreen / Embossed Logo Text (Prominently visible in user photo image_70fc6719.png)
  ctx.save();
  ctx.font = '900 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle dark drop-shadow for etched look
  ctx.fillStyle = '#0b0c10';
  ctx.fillText('RPLIDAR', 257, 258);

  // Crisp metallic silvery-white logo text
  ctx.fillStyle = '#e2e8f0';
  ctx.letterSpacing = '3px';
  ctx.fillText('RPLIDAR', 256, 256);
  ctx.restore();

  // 3 Countersunk Screw Recesses at 120° intervals around perimeter (exact match to user photos 1 & 5)
  const screwRadius = 175;
  const screwPositions = [
    [256, 256 - screwRadius], // 12 o'clock
    [Math.round(256 + screwRadius * Math.sin((2 * Math.PI) / 3)), Math.round(256 - screwRadius * Math.cos((2 * Math.PI) / 3))], // 4 o'clock
    [Math.round(256 + screwRadius * Math.sin((4 * Math.PI) / 3)), Math.round(256 - screwRadius * Math.cos((4 * Math.PI) / 3))], // 8 o'clock
  ];

  screwPositions.forEach(([hx, hy]) => {
    // Outer bevel rim
    ctx.fillStyle = '#0f1115';
    ctx.beginPath();
    ctx.arc(hx, hy, 26, 0, Math.PI * 2);
    ctx.fill();

    // Dark socket recess
    ctx.fillStyle = '#050608';
    ctx.beginPath();
    ctx.arc(hx, hy, 18, 0, Math.PI * 2);
    ctx.fill();

    // Screw head disc
    ctx.fillStyle = '#2d333f';
    ctx.beginPath();
    ctx.arc(hx, hy, 12, 0, Math.PI * 2);
    ctx.fill();

    // Internal Hexagonal Socket (M3 Socket Head Cap Screw)
    ctx.fillStyle = '#0f1115';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const sx = hx + Math.cos(angle) * 6;
      const sy = hy + Math.sin(angle) * 6;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 3. Procedural Texture: Tire Tread with Dual-Track Interlocking Hook/Labyrinth Blocks (Exact match to macro photo 1793006044923_...jpg)
function createTireTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Black background (valley floor, depth = 0 for bumpMap)
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, 1024, 512);

  // Sidewall baseline elevation
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(0, 0, 1024, 44);
  ctx.fillRect(0, 468, 1024, 44);

  // Sidewall circumferential bead rings
  ctx.strokeStyle = '#777780';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.lineTo(1024, 18);
  ctx.moveTo(0, 36);
  ctx.lineTo(1024, 36);
  ctx.moveTo(0, 476);
  ctx.lineTo(1024, 476);
  ctx.moveTo(0, 494);
  ctx.lineTo(1024, 494);
  ctx.stroke();

  // Sidewall radial ribbed grips
  ctx.lineWidth = 2;
  for (let x = 0; x < 1024; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, 34);
    ctx.moveTo(x, 478);
    ctx.lineTo(x, 492);
    ctx.stroke();
  }

  // Sidewall embossed lettering
  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  for (let rep = 0; rep < 4; rep++) {
    const rx = 128 + rep * 256;
    ctx.fillText('JETBOT OFF-ROAD', rx, 14);
    ctx.fillText('45x26mm ▶▶', rx, 506);
  }

  // Central circumferential groove separating the dual tracks (y: 246 to 266 is black)
  // Dual-track interlocking labyrinth / hook tread pattern (Exact match to macro photo 1793006044923_...jpg)
  const numLugs = 16;
  const lugW = 1024 / numLugs; // 64px per pattern cycle

  // Function to draw an interlocking C-hook block with beveled gradient
  function drawHookBlock(x: number, y: number, w: number, h: number, isFlipped: boolean) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlipped) {
      ctx.scale(1, -1);
    }

    // Outer beveled skirt (mid-tone for slope)
    ctx.fillStyle = '#6e737d';
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(w - 4, 4);
    ctx.lineTo(w - 4, h * 0.45);
    ctx.lineTo(w * 0.55, h * 0.45);
    ctx.lineTo(w * 0.55, h * 0.70);
    ctx.lineTo(w * 0.85, h * 0.70);
    ctx.lineTo(w * 0.85, h - 4);
    ctx.lineTo(4, h - 4);
    ctx.closePath();
    ctx.fill();

    // Raised flat top face (bright white = maximum bump relief)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 7);
    ctx.lineTo(w - 7, 7);
    ctx.lineTo(w - 7, h * 0.42);
    ctx.lineTo(w * 0.58, h * 0.42);
    ctx.lineTo(w * 0.58, h * 0.73);
    ctx.lineTo(w * 0.82, h * 0.73);
    ctx.lineTo(w * 0.82, h - 7);
    ctx.lineTo(7, h - 7);
    ctx.closePath();
    ctx.fill();

    // Micro traction siping incision across block face (deep dark cut = 0)
    ctx.strokeStyle = '#050507';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(w - 12, 14);
    ctx.moveTo(12, h * 0.6);
    ctx.lineTo(w * 0.5, h * 0.6);
    ctx.stroke();

    ctx.restore();
  }

  // Interlocking L-mate block that nests inside the C-hook's recess
  function drawNestBlock(x: number, y: number, w: number, h: number, isFlipped: boolean) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlipped) {
      ctx.scale(1, -1);
    }

    // Outer bevel skirt
    ctx.fillStyle = '#6e737d';
    ctx.beginPath();
    ctx.moveTo(w * 0.60, 4);
    ctx.lineTo(w - 4, 4);
    ctx.lineTo(w - 4, h * 0.65);
    ctx.lineTo(w * 0.60, h * 0.65);
    ctx.closePath();
    ctx.fill();

    // Top face
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w * 0.63, 7);
    ctx.lineTo(w - 7, 7);
    ctx.lineTo(w - 7, h * 0.62);
    ctx.lineTo(w * 0.63, h * 0.62);
    ctx.closePath();
    ctx.fill();

    // Sipe cut
    ctx.strokeStyle = '#050507';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.66, h * 0.35);
    ctx.lineTo(w - 10, h * 0.35);
    ctx.stroke();

    ctx.restore();
  }

  for (let i = 0; i < numLugs; i++) {
    const lx = i * lugW;
    const isOdd = i % 2 === 1;

    // Track 1 (Upper track: Y from 48 to 244)
    drawHookBlock(lx, 48, lugW, 196, false);
    if (isOdd) {
      drawNestBlock(lx, 48, lugW, 196, false);
    }

    // Track 2 (Lower track: Y from 268 to 464, staggered for interlocking traction)
    const staggeredX = (lx + lugW * 0.5) % 1024;
    drawHookBlock(staggeredX, 464, lugW, 196, true);
    if (!isOdd) {
      drawNestBlock(staggeredX, 464, lugW, 196, true);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

// 3b. Procedural Texture: Tire Diffuse/Color Map (Authentic vulcanized rubber tones and siping)
function createTireColorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep shadow in the valleys and tread grooves
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(0, 0, 1024, 512);

  // Sidewall baseline rubber
  ctx.fillStyle = '#181a20';
  ctx.fillRect(0, 0, 1024, 44);
  ctx.fillRect(0, 468, 1024, 44);

  // Sidewall circumferential bead rings
  ctx.strokeStyle = '#262a34';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.lineTo(1024, 18);
  ctx.moveTo(0, 36);
  ctx.lineTo(1024, 36);
  ctx.moveTo(0, 476);
  ctx.lineTo(1024, 476);
  ctx.moveTo(0, 494);
  ctx.lineTo(1024, 494);
  ctx.stroke();

  // Sidewall radial ribbed grips
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#323744';
  for (let x = 0; x < 1024; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, 34);
    ctx.moveTo(x, 478);
    ctx.lineTo(x, 492);
    ctx.stroke();
  }

  // Sidewall embossed lettering in authentic rubber-stamped grey
  ctx.fillStyle = '#8b949e';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  for (let rep = 0; rep < 4; rep++) {
    const rx = 128 + rep * 256;
    ctx.fillText('JETBOT OFF-ROAD', rx, 14);
    ctx.fillText('45x26mm ▶▶', rx, 506);
  }

  const numLugs = 16;
  const lugW = 1024 / numLugs;

  function drawHookBlockColor(x: number, y: number, w: number, h: number, isFlipped: boolean) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlipped) {
      ctx.scale(1, -1);
    }

    // Outer beveled skirt (transitional tone)
    ctx.fillStyle = '#22252e';
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(w - 4, 4);
    ctx.lineTo(w - 4, h * 0.45);
    ctx.lineTo(w * 0.55, h * 0.45);
    ctx.lineTo(w * 0.55, h * 0.70);
    ctx.lineTo(w * 0.85, h * 0.70);
    ctx.lineTo(w * 0.85, h - 4);
    ctx.lineTo(4, h - 4);
    ctx.closePath();
    ctx.fill();

    // Raised tread contact face (lighter grey-black tire rubber)
    ctx.fillStyle = '#323743';
    ctx.beginPath();
    ctx.moveTo(7, 7);
    ctx.lineTo(w - 7, 7);
    ctx.lineTo(w - 7, h * 0.42);
    ctx.lineTo(w * 0.58, h * 0.42);
    ctx.lineTo(w * 0.58, h * 0.73);
    ctx.lineTo(w * 0.82, h * 0.73);
    ctx.lineTo(w * 0.82, h - 7);
    ctx.lineTo(7, h - 7);
    ctx.closePath();
    ctx.fill();

    // Sipe slit
    ctx.strokeStyle = '#0a0b0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(w - 12, 14);
    ctx.moveTo(12, h * 0.6);
    ctx.lineTo(w * 0.5, h * 0.6);
    ctx.stroke();

    ctx.restore();
  }

  function drawNestBlockColor(x: number, y: number, w: number, h: number, isFlipped: boolean) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlipped) {
      ctx.scale(1, -1);
    }

    ctx.fillStyle = '#22252e';
    ctx.beginPath();
    ctx.moveTo(w * 0.60, 4);
    ctx.lineTo(w - 4, 4);
    ctx.lineTo(w - 4, h * 0.65);
    ctx.lineTo(w * 0.60, h * 0.65);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#323743';
    ctx.beginPath();
    ctx.moveTo(w * 0.63, 7);
    ctx.lineTo(w - 7, 7);
    ctx.lineTo(w - 7, h * 0.62);
    ctx.lineTo(w * 0.63, h * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#0a0b0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.66, h * 0.35);
    ctx.lineTo(w - 10, h * 0.35);
    ctx.stroke();

    ctx.restore();
  }

  for (let i = 0; i < numLugs; i++) {
    const lx = i * lugW;
    const isOdd = i % 2 === 1;

    drawHookBlockColor(lx, 48, lugW, 196, false);
    if (isOdd) {
      drawNestBlockColor(lx, 48, lugW, 196, false);
    }

    const staggeredX = (lx + lugW * 0.5) % 1024;
    drawHookBlockColor(staggeredX, 464, lugW, 196, true);
    if (!isOdd) {
      drawNestBlockColor(staggeredX, 464, lugW, 196, true);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

// 4. Procedural Texture: 0.91" I2C Mini OLED Display Screen (Photo 3)
function createOledScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Pitch black glass background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 128);

  // Subtle OLED pixel grid effect
  ctx.strokeStyle = '#051329';
  ctx.lineWidth = 0.5;
  for (let y = 0; y < 128; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Bright Cyan / Blue OLED glowing text matching Waveshare JetBot status
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#0284c7';
  ctx.shadowBlur = 4;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('JETBOT 10A-CMU', 12, 28);

  ctx.font = 'bold 17px monospace';
  ctx.fillText('IP: 192.168.1.102', 12, 56);
  ctx.fillText('CPU: 24%  RAM: 1.4G', 12, 84);

  // Status line: Battery & LIDAR
  ctx.fillStyle = '#4ade80';
  ctx.shadowColor = '#16a34a';
  ctx.fillText('BAT: 98% [OK] LIDAR', 12, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 5. Procedural Texture: WaveShare Carrier PCB Silkscreen (Exact match to image (6) & photo 1)
function createCarrierBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // High-density matte black solder mask with subtle FR4 fiber weave
  ctx.fillStyle = '#0f141c';
  ctx.fillRect(0, 0, 1024, 1024);

  // Copper Ground Plane Hatch & Thermal Vias
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let y = 0; y < 1024; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  for (let x = 0; x < 1024; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }

  // Differential High-Speed Copper Bus Traces (CSI, HDMI, USB, PCIe)
  ctx.strokeStyle = '#2563eb33';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const y = 80 + i * 22;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(340, y);
    ctx.lineTo(420, y + 40);
    ctx.lineTo(960, y + 40);
    ctx.stroke();
  }

  // Gold ENIG (Electroless Nickel Immersion Gold) Component Solder Pads & Test Points
  ctx.fillStyle = '#fbbf24';
  for (let x = 80; x < 960; x += 44) {
    for (let y = 140; y < 900; y += 44) {
      if ((x * y) % 7 === 0) {
        ctx.fillRect(x, y, 10, 6);
      } else if ((x + y) % 11 === 0) {
        ctx.beginPath();
        ctx.arc(x + 5, y + 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Gold clearance keepout rings for the 4 mounting standoffs
  const standoffHoles = [
    [100, 100],
    [924, 100],
    [100, 924],
    [924, 924],
  ];
  standoffHoles.forEach(([sx, sy]) => {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0f141c';
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
  });

  // Authentic Waveshare "WS" Stylized Logo Silkscreen (prominent in image (6) below USB & Ethernet)
  ctx.save();
  ctx.fillStyle = '#f8fafc';

  // Stylized "WS" Crown/Wave Logo Symbol
  ctx.beginPath();
  ctx.moveTo(470, 930);
  ctx.lineTo(485, 960);
  ctx.lineTo(500, 935);
  ctx.lineTo(515, 960);
  ctx.lineTo(530, 930);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#f8fafc';
  ctx.stroke();

  ctx.font = 'bold 24px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Waveshare', 500, 985);

  // Board Title & Front Section Silkscreen (matching red marked zone in image_6c9246a9.png)
  ctx.font = '900 30px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('JETSON NANO DEVELOPER KIT CARRIER', 80, 60);

  // Front-Left Silkscreen: Motor Drivers, Power Management & OLED
  ctx.font = 'bold 16px monospace';
  ctx.fillText('MOTOR_L', 160, 150);
  ctx.fillText('MOTOR_R', 320, 150);
  ctx.fillText('TB6612FNG DUAL DRIVER', 180, 260);
  ctx.fillText('5V 4A BUCK DC-DC', 360, 260);
  ctx.fillText('INA219 SENSOR', 140, 340);
  ctx.fillText('0.91" OLED I2C (0x3C)', 80, 420);
  ctx.fillText('SERVO CH1-CH3', 80, 520);
  ctx.fillText('MIPI-CSI CAMERA', 430, 140);

  // Component bounding box outlines in white
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  // Motor L socket outline
  ctx.strokeRect(150, 160, 80, 60);
  // Motor R socket outline
  ctx.strokeRect(310, 160, 80, 60);
  // TB6612FNG chip box
  ctx.strokeRect(200, 275, 90, 45);
  // Buck regulator box
  ctx.strokeRect(370, 275, 80, 45);
  // Inductor L1 & L2 boxes
  ctx.strokeRect(220, 350, 60, 60);
  ctx.strokeRect(320, 350, 60, 60);
  ctx.fillText('L1: 10uH', 225, 430);
  ctx.fillText('L2: 10uH', 325, 430);
  // Solid capacitor circles
  ctx.beginPath();
  ctx.arc(150, 250, 26, 0, Math.PI * 2);
  ctx.arc(150, 320, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillText('C1', 142, 255);
  ctx.fillText('C2', 142, 325);

  // Silkscreen Text for Rear Ports & Controls (matching image (6))
  ctx.font = 'bold 18px monospace';
  ctx.fillText('DC 5V/4A', 90, 955);
  ctx.fillText('HDMI / DP', 220, 955);
  ctx.fillText('USB 3.0', 380, 955);
  ctx.fillText('GIGABIT LAN', 590, 955);
  ctx.fillText('OTG', 750, 955);
  ctx.fillText('BOOT', 820, 955);
  ctx.fillText('RESET', 890, 955);
  ctx.fillText('ON / OFF', 930, 890);

  // Waveshare stylized "W" logo & branding silkscreen (exact match to 3_37e20bc8.jpg)
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(550, 875, 36, 26);
  ctx.font = '900 20px sans-serif';
  ctx.fillText('W', 560, 896);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Waveshare', 596, 892);
  ctx.font = 'bold 11px monospace';
  ctx.fillText('JETBOT ROBOTICS', 596, 908);

  // Silkscreen for 40-Pin Expansion Header along right flank + GPIO Pinout Legend (Photo 5)
  ctx.save();
  ctx.translate(820, 500);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 16px monospace';
  ctx.fillText('40-PIN GPIO (3V3 / 5V / I2C / UART / SPI)', -190, 0);
  ctx.restore();

  // Miniature white pinout chart grid next to OLED & GPIO (visible in top-down Photo 5)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(865, 290, 115, 360);
  ctx.font = 'bold 12px monospace';
  const gpioLabels = ['3V3   5V', 'SDA   5V', 'SCL  GND', 'GP4  TXD', 'GND  RXD', 'GP17 P18', 'GP27 GND', 'GP22 P23', '3V3  P24', 'MOSI GND'];
  gpioLabels.forEach((lbl, idx) => {
    const gy = 318 + idx * 33;
    ctx.fillText(lbl, 874, gy);
    ctx.beginPath();
    ctx.moveTo(865, gy + 8);
    ctx.lineTo(980, gy + 8);
    ctx.stroke();
  });

  // White OLED 0.91" screen footprint & Buzzer circle silkscreen
  ctx.strokeRect(865, 675, 115, 58);
  ctx.font = 'bold 13px monospace';
  ctx.fillText('0.91" OLED', 880, 708);

  ctx.beginPath();
  ctx.arc(140, 815, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillText('BE2105', 114, 868);

  // White boxed outlines for tactile switches and slide switch
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  // BOOT button box
  ctx.strokeRect(810, 920, 46, 28);
  // RESET button box
  ctx.strokeRect(880, 920, 46, 28);
  // Power switch box on right flank
  ctx.strokeRect(930, 825, 50, 44);

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 6. Procedural Texture: 3x 18650 Battery Pack Label
function createBatteryPackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 256);

  // Blue outline
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 236);

  // Text
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('WAVESHARE LI-ION BATTERY PACK', 30, 55);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('Model: 3S 18650 Pack  11.1V / 2600mAh', 30, 100);
  ctx.fillText('Max Discharge: 10A  Power: 28.86Wh', 30, 135);

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CAUTION: Do not short circuit or puncture', 30, 180);

  // Polarity icons
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('+ [POS]', 360, 100);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('- [NEG]', 360, 140);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 6b. Procedural Texture: Sky-Blue 18650 Li-ion Cell Shrink Wrap with Barcode Label (image_4f796f2b.png)
function create18650CellTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Signature light sky-blue PVC shrink wrap
  ctx.fillStyle = '#5bb6e5';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle metallic sheen gradient along cylinder circumference
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  grad.addColorStop(1, 'rgba(15,23,42,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Dark printed barcode & spec markings (matching real 18650 cell in image_4f796f2b.png)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('INR18650-26E  3.7V  2600mAh  9.62Wh', 65, 92);

  // Barcode stripes
  let bx = 70;
  const pattern = [4, 2, 2, 5, 3, 2, 4, 2, 6, 2, 3, 3, 2, 5, 2, 4, 2, 3, 5, 2, 2, 4, 3, 2, 6, 2, 3, 2];
  pattern.forEach((w, idx) => {
    if (idx % 2 === 0) {
      ctx.fillRect(bx, 110, w * 2, 26);
    }
    bx += w * 2 + 2;
  });

  ctx.font = 'bold 14px monospace';
  ctx.fillText('+  LI-ION  MH12210  -', 70, 160);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 7. Contact Shadow
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
  gradient.addColorStop(0.85, 'rgba(0, 0, 0, 0.08)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 8. Procedural Texture: Sony IMX219-160 Camera Module PCB
function createCameraPcbTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Matte black FR4 substrate
  ctx.fillStyle = '#111215';
  ctx.fillRect(0, 0, 256, 256);

  // Gold corner mounting pad rings
  const pads = [
    [24, 24],
    [232, 24],
    [24, 232],
    [232, 232],
  ];
  ctx.fillStyle = '#d4af37';
  pads.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111215';
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d4af37';
  });

  // Copper / Gold fine circuit traces
  ctx.strokeStyle = '#c59b27';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, 50);
  ctx.lineTo(85, 50);
  ctx.lineTo(95, 65);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(170, 50);
  ctx.lineTo(220, 50);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(205, 175);
  ctx.lineTo(225, 175);
  ctx.lineTo(225, 205);
  ctx.stroke();

  // White silkscreen labels matching Waveshare JetBot Camera
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px -apple-system, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('IMX219-160', 128, 44);

  ctx.font = 'bold 9px monospace';
  ctx.fillText('160° FOV WIDE', 128, 58);
  ctx.fillText('Waveshare', 128, 224);

  // White boxed outline for lens mount alignment
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(58, 58, 140, 140);

  // Silkscreen polarity & pin 1 indicators
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(42, 70, 3, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 9. Procedural 3D Geometry: High-Relief Interlocking Off-Road Tire Tread Lugs
// Provides true physical 3D depth (2.3mm relief, interlocking C-hook blocks, siping cuts & shoulder cleats)
// Exact physical match to macro photo 1793006044923_...jpg
function create3DTreadGeometry(): THREE.BufferGeometry {
  const baseRadius = 0.0332;
  const circ = 2 * Math.PI * baseRadius;
  const N = 16;
  const pitch = circ / N;

  // 1. C-Hook Labyrinth Lug Shape
  const hookShape = new THREE.Shape();
  hookShape.moveTo(0.0006, 0.0008);
  hookShape.lineTo(0.0102, 0.0008);
  hookShape.lineTo(0.0102, 0.0096);
  hookShape.lineTo(0.0006, 0.0096);
  hookShape.lineTo(0.0006, 0.0068);
  hookShape.lineTo(0.0058, 0.0068);
  hookShape.lineTo(0.0058, 0.0036);
  hookShape.lineTo(0.0006, 0.0036);
  hookShape.closePath();

  // Sipe slit hole on hook face
  const sipeHole1 = new THREE.Path();
  sipeHole1.moveTo(0.0068, 0.0020);
  sipeHole1.lineTo(0.0092, 0.0020);
  sipeHole1.lineTo(0.0092, 0.0084);
  sipeHole1.lineTo(0.0068, 0.0084);
  sipeHole1.closePath();
  hookShape.holes.push(sipeHole1);

  // 2. Nest Block Shape
  const nestShape = new THREE.Shape();
  nestShape.moveTo(0.0006, 0.0042);
  nestShape.lineTo(0.0050, 0.0042);
  nestShape.lineTo(0.0050, 0.0062);
  nestShape.lineTo(0.0006, 0.0062);
  nestShape.closePath();

  // Sipe slit hole on nest face
  const sipeHole2 = new THREE.Path();
  sipeHole2.moveTo(0.0012, 0.0049);
  sipeHole2.lineTo(0.0044, 0.0049);
  sipeHole2.lineTo(0.0044, 0.0055);
  sipeHole2.lineTo(0.0012, 0.0055);
  sipeHole2.closePath();
  nestShape.holes.push(sipeHole2);

  // 3. Outer Shoulder Cleats (tapering down sidewall)
  const cleatShape = new THREE.Shape();
  cleatShape.moveTo(0.0102, 0.0014);
  cleatShape.lineTo(0.0125, 0.0024);
  cleatShape.lineTo(0.0125, 0.0082);
  cleatShape.lineTo(0.0102, 0.0090);
  cleatShape.closePath();

  const extrudeHook = { depth: 0.0023, bevelEnabled: true, bevelThickness: 0.00045, bevelSize: 0.0004, bevelSegments: 2 };
  const extrudeNest = { depth: 0.0019, bevelEnabled: true, bevelThickness: 0.00035, bevelSize: 0.0003, bevelSegments: 1 };
  const extrudeCleat = { depth: 0.0017, bevelEnabled: true, bevelThickness: 0.00035, bevelSize: 0.0003, bevelSegments: 1 };

  const hookGeom = new THREE.ExtrudeGeometry(hookShape, extrudeHook);
  const nestGeom = new THREE.ExtrudeGeometry(nestShape, extrudeNest);
  const cleatGeom = new THREE.ExtrudeGeometry(cleatShape, extrudeCleat);

  const lugUnit = BufferGeometryUtils.mergeGeometries([hookGeom, nestGeom, cleatGeom], false);

  const geoms: THREE.BufferGeometry[] = [];
  for (let k = 0; k < N; k++) {
    const y0 = k * pitch;

    // Track 1 (outer track, negative X)
    const g1 = lugUnit.clone();
    g1.scale(-1, 1, 1);
    g1.translate(-0.0018, y0, 0);
    geoms.push(g1);

    // Track 2 (inner track, positive X, staggered by half pitch)
    const g2 = lugUnit.clone();
    g2.translate(0.0018, y0 + pitch * 0.5, 0);
    geoms.push(g2);
  }

  // Central mold parting seam rib running down center channel
  const seamShape = new THREE.Shape();
  seamShape.moveTo(-0.00035, 0);
  seamShape.lineTo(0.00035, 0);
  seamShape.lineTo(0.00035, circ);
  seamShape.lineTo(-0.00035, circ);
  seamShape.closePath();
  const seamGeom = new THREE.ExtrudeGeometry(seamShape, { depth: 0.0008, bevelEnabled: false });
  geoms.push(seamGeom);

  const merged = BufferGeometryUtils.mergeGeometries(geoms, false);

  // Cylindrical Warp around X axis (wheel spin axis)
  const pos = merged.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const currentR = baseRadius + z;
    const angle = y / baseRadius;

    pos.setXYZ(i, x, Math.cos(angle) * currentR, Math.sin(angle) * currentR);
  }
  merged.computeVertexNormals();

  return merged;
}

// ==========================================
// MAIN PROCEDURAL MODEL BUILDER
// ==========================================

export function buildJetBotProcedural(isSoftwareGl = false): JetBotModel {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'JetBot';

  const highlightMeshes = new Map<string, THREE.Mesh[]>();
  function registerMesh(groupName: string, mesh: THREE.Mesh) {
    if (!highlightMeshes.has(groupName)) {
      highlightMeshes.set(groupName, []);
    }
    highlightMeshes.get(groupName)!.push(mesh);
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = !isSoftwareGl;
    mesh.userData = { componentId: groupName };
  }

  // --- High-Fidelity Materials ---
  // Metallic Green Anodized Aluminum (chassis, camera bracket, motor brackets)
  const chassisGreenMat = new THREE.MeshStandardMaterial({
    color: 0x15803d, // vivid emerald green
    metalness: 0.84,
    roughness: 0.22,
  });

  // Brass Hexagonal Standoffs (Gold metallic #d4af37)
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.95,
    roughness: 0.16,
  });

  // Chrome / Galvanized Steel (Motors, screws, caster forks)
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.96,
    roughness: 0.12,
  });

  // Brushed Steel / Zinc motor casing
  const motorZincMat = new THREE.MeshStandardMaterial({
    color: 0xb0b8c0,
    metalness: 0.88,
    roughness: 0.32,
  });

  // Matte Black Plastics
  const blackPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.25,
    roughness: 0.65,
  });

  // Jetson Extruded Heatsink Black Anodized Aluminum
  const heatsinkMat = new THREE.MeshStandardMaterial({
    color: 0x1c2128,
    metalness: 0.86,
    roughness: 0.3,
  });

  // Metallic Cyan-Blue 10-Spoke Rims (vivid mirror anodized blue from user photos 3 & 7)
  const blueRimMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9, // vivid metallic sky/cobalt anodized blue
    metalness: 0.96,
    roughness: 0.10,
  });

  // 3D Physical Tread Lugs Geometry & Material (Photo 1793006044923_...jpg)
  const shared3DTreadGeom = create3DTreadGeometry();
  const tireTreadMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d23, // natural charcoal off-road tire rubber
    roughness: 0.85,
    metalness: 0.08,
  });

  // Base Carcass Rubber Material (Valley floor, central channel, and bead)
  const tireColorMap = createTireColorTexture();
  const tireBumpMap = createTireTexture();
  const tireMat = new THREE.MeshStandardMaterial({
    map: tireColorMap,
    bumpMap: tireBumpMap,
    bumpScale: 0.006,
    roughness: 0.88,
    metalness: 0.06,
  });

  // 0.91" I2C Mini OLED Screen Material
  const oledScreenMat = new THREE.MeshBasicMaterial({
    map: createOledScreenTexture(),
  });

  // Carrier Board PCB Material
  const carrierPcbMat = new THREE.MeshStandardMaterial({
    map: createCarrierBoardTexture(),
    roughness: 0.45,
    metalness: 0.3,
  });

  // Battery Pack Label Material
  const batteryLabelMat = new THREE.MeshStandardMaterial({
    map: createBatteryPackTexture(),
    roughness: 0.5,
    metalness: 0.1,
  });

  // FFC Ribbon Cable Material with exact silkscreen
  const ribbonMat = new THREE.MeshStandardMaterial({
    map: createRibbonCableTexture(),
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  // Sony IMX219 Camera Module PCB Material
  const cameraPcbMat = new THREE.MeshStandardMaterial({
    map: createCameraPcbTexture(),
    roughness: 0.45,
    metalness: 0.25,
  });

  // Wire insulation materials
  const wireRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
  const wireBlackMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 });
  const wireYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });
  const wireBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });
  const wireWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const wireGreySleeveMat = new THREE.MeshStandardMaterial({
    color: 0x64748b, // authentic medium-slate grey PVC outer jacket seen in underside photo
    roughness: 0.72,
    metalness: 0.08,
  });
  const encoderPcbMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // matte black encoder PCB
    roughness: 0.5,
    metalness: 0.25,
  });
  const goldPadMat = new THREE.MeshStandardMaterial({
    color: 0xd97706, // gold solder contacts
    roughness: 0.3,
    metalness: 0.85,
  });

  // ----------------------------------------------------
  // 1. CHASSIS GROUP
  // ----------------------------------------------------
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'chassis';

  // Bottom Green Chassis Base Plate with Open Wheel Cutouts (Removes outer fender strips circled in red in image_d596cb7e.png)
  const baseShape = new THREE.Shape();
  const baseR = 0.18;
  const cutZ = 0.065;
  const cutInnerX = 0.095;
  const edgeX = Math.sqrt(baseR * baseR - cutZ * cutZ); // ~0.16785
  const angFrontRight = Math.atan2(cutZ, edgeX); // ~0.3692 rad

  // 1. Front Semi-circular Arc from right to left
  baseShape.moveTo(edgeX, cutZ);
  baseShape.absarc(0, 0, baseR, angFrontRight, Math.PI - angFrontRight, false);

  // 2. Left Wheel Open Notch (cuts inward along wheel, completely removes outer left green rim)
  baseShape.lineTo(-cutInnerX, cutZ);
  baseShape.lineTo(-cutInnerX, -cutZ);
  baseShape.lineTo(-edgeX, -cutZ);

  // 3. Rear Semi-circular Arc from left to right
  baseShape.absarc(0, 0, baseR, Math.PI + angFrontRight, 2 * Math.PI - angFrontRight, false);

  // 4. Right Wheel Open Notch (cuts inward along wheel, completely removes outer right green rim)
  baseShape.lineTo(cutInnerX, -cutZ);
  baseShape.lineTo(cutInnerX, cutZ);
  baseShape.lineTo(edgeX, cutZ);

  // Center wiring slot (where motor wires pass through to the battery pack) - positioned near left motor matching image_e0a05a24.png
  const centerWireHole = new THREE.Path();
  const slotXCenter = -0.0235;
  const slotW = 0.0065; // 13mm wide in X
  const slotZ1 = 0.022; // maps to Z = +0.022 in 3D
  const slotZ2 = 0.046; // maps to Z = +0.046 in 3D
  const slotR = 0.0025; // rounded corner radius
  centerWireHole.moveTo(slotXCenter - slotW + slotR, slotZ1);
  centerWireHole.lineTo(slotXCenter + slotW - slotR, slotZ1);
  centerWireHole.quadraticCurveTo(slotXCenter + slotW, slotZ1, slotXCenter + slotW, slotZ1 + slotR);
  centerWireHole.lineTo(slotXCenter + slotW, slotZ2 - slotR);
  centerWireHole.quadraticCurveTo(slotXCenter + slotW, slotZ2, slotXCenter + slotW - slotR, slotZ2);
  centerWireHole.lineTo(slotXCenter - slotW + slotR, slotZ2);
  centerWireHole.quadraticCurveTo(slotXCenter - slotW, slotZ2, slotXCenter - slotW, slotZ2 - slotR);
  centerWireHole.lineTo(slotXCenter - slotW, slotZ1 + slotR);
  centerWireHole.quadraticCurveTo(slotXCenter - slotW, slotZ1, slotXCenter - slotW + slotR, slotZ1);
  centerWireHole.closePath();
  baseShape.holes.push(centerWireHole);

  const baseGeom = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.0035,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.001,
    bevelThickness: 0.001,
  });
  baseGeom.rotateX(Math.PI / 2);
  const bottomPlate = new THREE.Mesh(baseGeom, chassisGreenMat);
  bottomPlate.position.set(0, 0.02, 0);
  registerMesh('chassisGroup', bottomPlate);
  chassisGroup.add(bottomPlate);

  // Rubber grommet / CNC chamfer bezel lining the wiring pass-through slot (image_e0a05a24.png)
  const slotBezelShape = new THREE.Shape();
  const bzW = 0.0085;
  const bzZ1 = 0.020;
  const bzZ2 = 0.048;
  const bzR = 0.003;
  slotBezelShape.moveTo(slotXCenter - bzW + bzR, bzZ1);
  slotBezelShape.lineTo(slotXCenter + bzW - bzR, bzZ1);
  slotBezelShape.quadraticCurveTo(slotXCenter + bzW, bzZ1, slotXCenter + bzW, bzZ1 + bzR);
  slotBezelShape.lineTo(slotXCenter + bzW, bzZ2 - bzR);
  slotBezelShape.quadraticCurveTo(slotXCenter + bzW, bzZ2, slotXCenter + bzW - bzR, bzZ2);
  slotBezelShape.lineTo(slotXCenter - bzW + bzR, bzZ2);
  slotBezelShape.quadraticCurveTo(slotXCenter - bzW, bzZ2, slotXCenter - bzW, bzZ2 - bzR);
  slotBezelShape.lineTo(slotXCenter - bzW, bzZ1 + bzR);
  slotBezelShape.quadraticCurveTo(slotXCenter - bzW, bzZ1, slotXCenter - bzW + bzR, bzZ1);
  slotBezelShape.closePath();
  const bzHole = new THREE.Path();
  bzHole.moveTo(slotXCenter - slotW, slotZ1);
  bzHole.lineTo(slotXCenter + slotW, slotZ1);
  bzHole.lineTo(slotXCenter + slotW, slotZ2);
  bzHole.lineTo(slotXCenter - slotW, slotZ2);
  bzHole.closePath();
  slotBezelShape.holes.push(bzHole);

  const slotBezelGeom = new THREE.ExtrudeGeometry(slotBezelShape, {
    depth: 0.005,
    bevelEnabled: false,
  });
  slotBezelGeom.rotateX(Math.PI / 2);
  const slotBezel = new THREE.Mesh(slotBezelGeom, blackPlasticMat);
  slotBezel.position.set(0, 0.021, 0);
  chassisGroup.add(slotBezel);

  // 2x Grounding screws & washers flush on green plate underside (image_e0a05a24.png)
  [-0.052, 0.052].forEach((gx) => {
    const gScr = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0014, 12), chromeMat);
    gScr.position.set(gx, 0.0156, 0.118);
    chassisGroup.add(gScr);

    const lugRing = new THREE.Mesh(new THREE.TorusGeometry(0.0026, 0.0006, 8, 16), chromeMat);
    lugRing.rotation.x = Math.PI / 2;
    lugRing.position.set(gx, 0.0162, 0.118);
    chassisGroup.add(lugRing);
  });

  // Pan-head Phillips Screws on Bottom Plate (top surface & real underside dome heads visible in image (8))
  const screwGeom = new THREE.CylinderGeometry(0.003, 0.003, 0.0015, 12);
  const washerGeom = new THREE.CylinderGeometry(0.0045, 0.0045, 0.0006, 12);

  const screwPositions = [
    [-0.04, 0.023, 0.14],
    [0.04, 0.023, 0.14],
    [-0.04, 0.023, -0.14],
    [0.04, 0.023, -0.14],
    [-0.085, 0.023, 0.085],  // Under front-left lower standoff
    [0.085, 0.023, 0.085],   // Under front-right lower standoff
    [-0.085, 0.023, -0.085], // Under rear-left lower standoff
    [0.085, 0.023, -0.085],  // Under rear-right lower standoff
    [-0.018, 0.023, 0.155],  // Front camera mounting screws
    [0.018, 0.023, 0.155],
    [-0.035, 0.023, -0.135], // Rear chassis & caster fasteners
    [0.035, 0.023, -0.135],
    [-0.015, 0.023, -0.145],
    [0.015, 0.023, -0.145],
  ];

  screwPositions.forEach(([x, y, z]) => {
    const screw = new THREE.Mesh(screwGeom, chromeMat);
    screw.position.set(x, y, z);
    const washer = new THREE.Mesh(washerGeom, chromeMat);
    washer.position.set(x, y - 0.0005, z);
    chassisGroup.add(screw);
    chassisGroup.add(washer);
  });

  // Prominent underside M3 dome-head Phillips screws fastening lower standoffs, camera bracket & SMA grounds (image (8))
  const undersideScrewGeom = new THREE.SphereGeometry(0.0030, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const undersideScrewPositions = [
    [-0.085, 0.0156, 0.085],
    [0.085, 0.0156, 0.085],
    [-0.085, 0.0156, -0.085],
    [0.085, 0.0156, -0.085],
    [-0.018, 0.0156, 0.155],
    [0.018, 0.0156, 0.155],
    [-0.095, 0.0156, -0.098],
    [0.095, 0.0156, -0.098],
  ];
  undersideScrewPositions.forEach(([ux, uy, uz]) => {
    const uWsh = new THREE.Mesh(washerGeom, chromeMat);
    uWsh.position.set(ux, uy + 0.0004, uz);
    chassisGroup.add(uWsh);

    const uScr = new THREE.Mesh(undersideScrewGeom, chromeMat);
    uScr.rotation.x = Math.PI;
    uScr.position.set(ux, uy, uz);
    chassisGroup.add(uScr);
  });

  // Lower Hexagonal Brass Standoff Pillars (4 pillars connecting bottom plate to middle black deck plate)
  const lowerStandoffGeom = new THREE.CylinderGeometry(0.0042, 0.0042, 0.050, 6);
  const lowerStandoffPositions = [
    [-0.085, 0.0485, -0.085],
    [0.085, 0.0485, -0.085],
    [-0.085, 0.0485, 0.085],
    [0.085, 0.0485, 0.085],
  ];
  lowerStandoffPositions.forEach(([x, y, z]) => {
    const pillar = new THREE.Mesh(lowerStandoffGeom, brassMat);
    pillar.position.set(x, y, z);
    registerMesh('chassisGroup', pillar);
    registerMesh('brassStandoffsGroup', pillar);
    chassisGroup.add(pillar);
  });

  // Middle Black Deck Plate ("Tấm đen dính vào 4 thanh và ở dưới main")
  // Mounted directly onto the 4 lower brass standoffs, supporting the main board
  const midPlateShape = new THREE.Shape();
  const pw = 0.096; // half width (192mm total width spanning across standoffs at ±85mm)
  const pd = 0.096; // half depth (192mm total depth spanning across standoffs at ±85mm)
  const pr = 0.014; // smooth rounded corner radius
  midPlateShape.moveTo(-pw + pr, -pd);
  midPlateShape.lineTo(pw - pr, -pd);
  midPlateShape.quadraticCurveTo(pw, -pd, pw, -pd + pr);
  midPlateShape.lineTo(pw, pd - pr);
  midPlateShape.quadraticCurveTo(pw, pd, pw - pr, pd);
  midPlateShape.lineTo(-pw + pr, pd);
  midPlateShape.quadraticCurveTo(-pw, pd, -pw, pd - pr);
  midPlateShape.lineTo(-pw, -pd + pr);
  midPlateShape.quadraticCurveTo(-pw, -pd, -pw + pr, -pd);

  const midPlateGeom = new THREE.ExtrudeGeometry(midPlateShape, {
    depth: 0.003,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.001,
    bevelThickness: 0.0008,
  });
  midPlateGeom.rotateX(Math.PI / 2);
  const midPlate = new THREE.Mesh(midPlateGeom, blackPlasticMat);
  midPlate.position.set(0, 0.075, 0);
  registerMesh('chassisGroup', midPlate);
  chassisGroup.add(midPlate);

  // 4 Pan-head Chrome Screws & Washers securing the Black Plate down onto the 4 Standoffs
  lowerStandoffPositions.forEach(([x, _, z]) => {
    const scr = new THREE.Mesh(screwGeom, chromeMat);
    scr.position.set(x, 0.0768, z);
    const wsh = new THREE.Mesh(washerGeom, chromeMat);
    wsh.position.set(x, 0.0763, z);
    chassisGroup.add(scr);
    chassisGroup.add(wsh);
  });

  // Main Motherboard / Waveshare Carrier Board (Sitting on top of the black plate)
  const carrierPcbGeom = new THREE.BoxGeometry(0.148, 0.0028, 0.138);
  const carrierPcb = new THREE.Mesh(carrierPcbGeom, carrierPcbMat);
  carrierPcb.position.set(0, 0.078, 0.005);
  registerMesh('chassisGroup', carrierPcb);
  chassisGroup.add(carrierPcb);

  // Upper Brass Standoff Pillars (Connecting carrier board to top RPLIDAR deck - framed cleanly inside board perimeter)
  const upperStandoffGeom = new THREE.CylinderGeometry(0.0038, 0.0038, 0.062, 6);
  const upperStandoffPositions = [
    [-0.056, 0.111, -0.044],
    [0.056, 0.111, -0.044],
    [-0.056, 0.111, 0.042],
    [0.056, 0.111, 0.042],
  ];
  upperStandoffPositions.forEach(([x, y, z]) => {
    const pillar = new THREE.Mesh(upperStandoffGeom, brassMat);
    pillar.position.set(x, y, z);
    registerMesh('chassisGroup', pillar);
    registerMesh('brassStandoffsGroup', pillar);
    chassisGroup.add(pillar);

    // Chrome screw on top of standoff
    const scr = new THREE.Mesh(screwGeom, chromeMat);
    scr.position.set(x, y + 0.032, z);
    chassisGroup.add(scr);
  });

  // Top Deck Plate / Middle Support Plate ("Tấm đĩa đen ở giữa đỡ RPLIDAR và gắn cọc đồng")
  // Sized accurately (~128x104mm) so rear USB/Ethernet/BOOT/RESET & right-flank switch/OLED remain visible from above (Photos 2, 4, 6)
  const topPlateShape = new THREE.Shape();
  const tpW = 0.064; // half width (128mm spanning standoffs at ±56mm)
  const tpD = 0.052; // half depth (104mm spanning standoffs at -44mm and +42mm)
  const tpR = 0.010; // smooth corner radius

  topPlateShape.moveTo(-tpW + tpR, -tpD);
  topPlateShape.lineTo(tpW - tpR, -tpD);
  topPlateShape.quadraticCurveTo(tpW, -tpD, tpW, -tpD + tpR);
  topPlateShape.lineTo(tpW, tpD - tpR);
  topPlateShape.quadraticCurveTo(tpW, tpD, tpW - tpR, tpD);
  // Front edge with smooth cable relief notch for camera CSI ribbon cable
  topPlateShape.lineTo(0.020, tpD);
  topPlateShape.lineTo(0.016, tpD - 0.007);
  topPlateShape.lineTo(-0.016, tpD - 0.007);
  topPlateShape.lineTo(-0.020, tpD);
  topPlateShape.lineTo(-tpW + tpR, tpD);
  topPlateShape.quadraticCurveTo(-tpW, tpD, -tpW, tpD - tpR);
  topPlateShape.lineTo(-tpW, -tpD + tpR);
  topPlateShape.quadraticCurveTo(-tpW, -tpD, -tpW + tpR, -tpD);

  const topPlateGeom = new THREE.ExtrudeGeometry(topPlateShape, {
    depth: 0.003,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.001,
    bevelThickness: 0.0008,
  });
  topPlateGeom.rotateX(Math.PI / 2);
  const topPlate = new THREE.Mesh(topPlateGeom, blackPlasticMat);
  topPlate.position.set(0, 0.143, -0.001);
  registerMesh('chassisGroup', topPlate);
  chassisGroup.add(topPlate);

  // 4 Chrome M3 Pan-Head Screws & Washers securing the Top Deck down into the 4 Standoffs
  upperStandoffPositions.forEach(([sx, _, sz]) => {
    const scr = new THREE.Mesh(screwGeom, chromeMat);
    scr.position.set(sx, 0.1448, sz);
    const wsh = new THREE.Mesh(washerGeom, chromeMat);
    wsh.position.set(sx, 0.1443, sz);
    chassisGroup.add(scr);
    chassisGroup.add(wsh);
  });

  // 4 Black M3 Socket Cap Screws securing the RPLIDAR risers to the top plate + 4 CNC spare holes (Photo 2 & 4)
  const m3HexGeom = new THREE.CylinderGeometry(0.0028, 0.0028, 0.002, 6);
  [
    [-0.035, 0.1445, -0.032],
    [0.035, 0.1445, -0.032],
    [-0.035, 0.1445, 0.024],
    [0.035, 0.1445, 0.024],
  ].forEach(([hx, hy, hz]) => {
    const hexScr = new THREE.Mesh(m3HexGeom, blackPlasticMat);
    hexScr.position.set(hx, hy, hz);
    chassisGroup.add(hexScr);
  });

  const spareHoleMat = new THREE.MeshBasicMaterial({ color: 0x050608 });
  [
    [-0.044, 0.1442, 0.030],
    [0.044, 0.1442, 0.030],
    [-0.012, 0.1442, -0.042],
    [0.012, 0.1442, -0.042],
  ].forEach(([hx, hy, hz]) => {
    const hMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0012, 12), spareHoleMat);
    hMesh.position.set(hx, hy, hz);
    chassisGroup.add(hMesh);
  });

  // Top-Deck Central Cooling Vent Shroud / Fan Guard Module sitting flush on topPlate under RPLIDAR PCB (image.png red circle)
  const topShroudShape = new THREE.Shape();
  const tsHalf = 0.0185; // 37mm x 37mm square housing
  const tsRad = 0.0025;
  topShroudShape.moveTo(-tsHalf + tsRad, -tsHalf);
  topShroudShape.lineTo(tsHalf - tsRad, -tsHalf);
  topShroudShape.quadraticCurveTo(tsHalf, -tsHalf, tsHalf, -tsHalf + tsRad);
  topShroudShape.lineTo(tsHalf, tsHalf - tsRad);
  topShroudShape.quadraticCurveTo(tsHalf, tsHalf, tsHalf - tsRad, tsHalf);
  topShroudShape.lineTo(-tsHalf + tsRad, tsHalf);
  topShroudShape.quadraticCurveTo(-tsHalf, tsHalf, -tsHalf, tsHalf - tsRad);
  topShroudShape.lineTo(-tsHalf, -tsHalf + tsRad);
  topShroudShape.quadraticCurveTo(-tsHalf, -tsHalf, -tsHalf + tsRad, -tsHalf);
  const tsBore = new THREE.Path();
  tsBore.absarc(0, 0, 0.0155, 0, Math.PI * 2, false);
  topShroudShape.holes.push(tsBore);

  const topShroudGeom = new THREE.ExtrudeGeometry(topShroudShape, {
    depth: 0.0075,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.0006,
    bevelThickness: 0.0005,
  });
  topShroudGeom.rotateX(Math.PI / 2);
  const topVentShroud = new THREE.Mesh(topShroudGeom, blackPlasticMat);
  topVentShroud.position.set(0, 0.151, -0.008);
  registerMesh('coolingFanGroup', topVentShroud);
  chassisGroup.add(topVentShroud);

  // Inner dark recessed louver core & 4 corner mounting screws on top-deck shroud
  const topVentCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0152, 0.0152, 0.006, 20),
    new THREE.MeshBasicMaterial({ color: 0x0b0d12 })
  );
  topVentCore.position.set(0, 0.1465, -0.008);
  chassisGroup.add(topVentCore);

  [
    [-0.014, -0.014],
    [0.014, -0.014],
    [-0.014, 0.014],
    [0.014, 0.014],
  ].forEach(([vx, vz]) => {
    const vScr = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.0018, 8), chromeMat);
    vScr.position.set(vx, 0.152, -0.008 + vz);
    chassisGroup.add(vScr);
  });

  // ----------------------------------------------------
  // 2. NVIDIA JETSON NANO GROUP
  // ----------------------------------------------------
  const jetsonNanoGroup = new THREE.Group();
  jetsonNanoGroup.name = 'jetson-nano';
  jetsonNanoGroup.position.set(0, 0.084, 0.005);

  // Jetson Main SoM (System-on-Module) Board with authentic green FR4 PCB substrate (image (3))
  const somPcbMat = new THREE.MeshStandardMaterial({
    color: 0x166534, // authentic green FR4 substrate
    roughness: 0.45,
    metalness: 0.25,
  });
  const somGeom = new THREE.BoxGeometry(0.069, 0.0016, 0.045);
  const somMesh = new THREE.Mesh(somGeom, somPcbMat);
  somMesh.position.set(0, 0.0025, -0.005);
  registerMesh('jetsonNanoGroup', somMesh);
  jetsonNanoGroup.add(somMesh);

  // SODIMM-260 Socket Base (Black socket on carrier board)
  const sodimmSocketGeom = new THREE.BoxGeometry(0.072, 0.004, 0.007);
  const sodimmSocket = new THREE.Mesh(sodimmSocketGeom, blackPlasticMat);
  sodimmSocket.position.set(0, 0.002, -0.024);
  jetsonNanoGroup.add(sodimmSocket);

  // Gold connector finger edge on SoM
  const goldFingers = new THREE.Mesh(
    new THREE.BoxGeometry(0.066, 0.0006, 0.0035),
    brassMat
  );
  goldFingers.position.set(0, 0.0028, -0.023);
  jetsonNanoGroup.add(goldFingers);

  // SODIMM-260 Dual Spring-Steel Retaining Clips (Visible in image (3))
  const clipGeom = new THREE.BoxGeometry(0.005, 0.006, 0.004);
  const leftClip = new THREE.Mesh(clipGeom, chromeMat);
  leftClip.position.set(-0.035, 0.0045, -0.005);
  jetsonNanoGroup.add(leftClip);
  const rightClip = new THREE.Mesh(clipGeom, chromeMat);
  rightClip.position.set(0.035, 0.0045, -0.005);
  jetsonNanoGroup.add(rightClip);

  // Tegra X1 SoC processor package in center
  const tegraSocGeom = new THREE.BoxGeometry(0.022, 0.0015, 0.022);
  const tegraSocMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
  const tegraSoc = new THREE.Mesh(tegraSocGeom, tegraSocMat);
  tegraSoc.position.set(0, 0.004, -0.005);
  jetsonNanoGroup.add(tegraSoc);

  // Copper / Aluminum heat spreader pedestal between SoC and heatsink
  const spreaderGeom = new THREE.BoxGeometry(0.026, 0.0022, 0.026);
  const spreaderMesh = new THREE.Mesh(spreaderGeom, chromeMat);
  spreaderMesh.position.set(0, 0.0055, -0.005);
  jetsonNanoGroup.add(spreaderMesh);

  // M.2 Key-E Wi-Fi Card tucked underneath the SoM
  const m2PcbGeom = new THREE.BoxGeometry(0.022, 0.0012, 0.030);
  const m2PcbMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.5 }); // green PCB
  const m2Pcb = new THREE.Mesh(m2PcbGeom, m2PcbMat);
  m2Pcb.position.set(-0.015, -0.001, -0.005);
  jetsonNanoGroup.add(m2Pcb);

  // Silver RF Shield Can on M.2 Card
  const rfShieldGeom = new THREE.BoxGeometry(0.019, 0.0018, 0.024);
  const rfShield = new THREE.Mesh(rfShieldGeom, chromeMat);
  rfShield.position.set(-0.015, 0.0005, -0.006);
  jetsonNanoGroup.add(rfShield);

  // 2 Gold Miniature IPEX / u.FL snap-on antenna connectors
  const ipexGeom = new THREE.CylinderGeometry(0.001, 0.001, 0.0012, 8);
  const ipex1 = new THREE.Mesh(ipexGeom, brassMat);
  ipex1.position.set(-0.018, 0.0018, 0.005);
  jetsonNanoGroup.add(ipex1);
  const ipex2 = new THREE.Mesh(ipexGeom, brassMat);
  ipex2.position.set(-0.012, 0.0018, 0.005);
  jetsonNanoGroup.add(ipex2);

  // Jetson Extruded Aluminum Heatsink Central Thermal Column
  // Slim central pedestal column so the 4 horizontal fins have authentic deep open slots in side view (image (3))
  const heatsinkCoreGeom = new THREE.BoxGeometry(0.028, 0.022, 0.024);
  const heatsinkCore = new THREE.Mesh(heatsinkCoreGeom, heatsinkMat);
  heatsinkCore.position.set(0, 0.015, -0.005);
  registerMesh('jetsonNanoGroup', heatsinkCore);
  jetsonNanoGroup.add(heatsinkCore);

  // 5 Distinct Horizontal Layered Cooling Fin Slats (Exact match to side view in Photo 2 & 4)
  // Wide horizontal fins extending outward with deep open air slots letting light pass through
  const finSlatGeom = new THREE.BoxGeometry(0.068, 0.0024, 0.044);
  [0.005, 0.011, 0.017, 0.023, 0.029].forEach((finY) => {
    const finSlat = new THREE.Mesh(finSlatGeom, heatsinkMat);
    finSlat.position.set(0, finY, -0.005);
    registerMesh('jetsonNanoGroup', finSlat);
    jetsonNanoGroup.add(finSlat);
  });

  // Heatsink Side Spring-Loaded Retention Clips & Screws (Seen in Photo 4)
  const heatsinkClipGeom = new THREE.BoxGeometry(0.0035, 0.022, 0.004);
  const heatsinkScrewGeom = new THREE.CylinderGeometry(0.0018, 0.0018, 0.003, 8);
  [-0.035, 0.035].forEach((cx) => {
    const hClip = new THREE.Mesh(heatsinkClipGeom, chromeMat);
    hClip.position.set(cx, 0.017, -0.005);
    jetsonNanoGroup.add(hClip);

    const hScr = new THREE.Mesh(heatsinkScrewGeom, chromeMat);
    hScr.position.set(cx, 0.029, -0.005);
    jetsonNanoGroup.add(hScr);
  });

  // 40mm Heatsink Cooling Fan with true hollow circular bore so blades spin visibly inside (image (6) & image.png)
  const fanGroup = new THREE.Group();
  fanGroup.position.set(0, 0.035, -0.005);

  // Hollow 40x40mm square housing with 36mm circular aperture cut cleanly through the center
  const fanFrameShape = new THREE.Shape();
  const ffHalf = 0.0205;
  const ffCorner = 0.003;
  fanFrameShape.moveTo(-ffHalf + ffCorner, -ffHalf);
  fanFrameShape.lineTo(ffHalf - ffCorner, -ffHalf);
  fanFrameShape.quadraticCurveTo(ffHalf, -ffHalf, ffHalf, -ffHalf + ffCorner);
  fanFrameShape.lineTo(ffHalf, ffHalf - ffCorner);
  fanFrameShape.quadraticCurveTo(ffHalf, ffHalf, ffHalf - ffCorner, ffHalf);
  fanFrameShape.lineTo(-ffHalf + ffCorner, ffHalf);
  fanFrameShape.quadraticCurveTo(-ffHalf, ffHalf, -ffHalf, ffHalf - ffCorner);
  fanFrameShape.lineTo(-ffHalf, -ffHalf + ffCorner);
  fanFrameShape.quadraticCurveTo(-ffHalf, -ffHalf, -ffHalf + ffCorner, -ffHalf);

  const fanAperture = new THREE.Path();
  fanAperture.absarc(0, 0, 0.0178, 0, Math.PI * 2, false);
  fanFrameShape.holes.push(fanAperture);

  const fanShroudGeom = new THREE.ExtrudeGeometry(fanFrameShape, {
    depth: 0.0095,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.0006,
    bevelThickness: 0.0005,
  });
  fanShroudGeom.rotateX(Math.PI / 2);
  const fanShroud = new THREE.Mesh(fanShroudGeom, blackPlasticMat);
  fanShroud.position.y = 0.0045;
  registerMesh('jetsonNanoGroup', fanShroud);
  registerMesh('coolingFanGroup', fanShroud);
  fanGroup.add(fanShroud);

  // 4 radial stator support struts underneath motor hub
  for (let st = 0; st < 4; st++) {
    const stAngle = (st * Math.PI) / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.0012, 0.0018), blackPlasticMat);
    strut.position.set(Math.cos(stAngle) * 0.0095, -0.0042, Math.sin(stAngle) * 0.0095);
    strut.rotation.y = -stAngle;
    fanGroup.add(strut);
  }

  // Rotating Fan Rotor Assembly (Hub + circular glossy hub cap + 7 curved blades visible through open bore!)
  const coolingFan = new THREE.Group();
  coolingFan.name = 'cooling-fan-rotor';

  const fanHubGeom = new THREE.CylinderGeometry(0.0072, 0.0072, 0.0072, 20);
  const fanHub = new THREE.Mesh(fanHubGeom, blackPlasticMat);
  registerMesh('coolingFanGroup', fanHub);
  coolingFan.add(fanHub);

  // Satin hub medallion ring visible on top of center rotor (image (6))
  const hubSticker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0048, 0.0048, 0.0008, 16),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.35 })
  );
  hubSticker.position.y = 0.0038;
  coolingFan.add(hubSticker);

  for (let b = 0; b < 7; b++) {
    const bladeGeom = new THREE.BoxGeometry(0.0105, 0.0012, 0.0042);
    const blade = new THREE.Mesh(bladeGeom, blackPlasticMat);
    const angle = (b / 7) * Math.PI * 2;
    blade.position.set(Math.cos(angle) * 0.0112, 0.0005, Math.sin(angle) * 0.0112);
    blade.rotation.y = -angle;
    blade.rotation.x = 0.42;
    registerMesh('coolingFanGroup', blade);
    coolingFan.add(blade);
  }
  fanGroup.add(coolingFan);

  // 4 Corner silver Phillips screws on fan ears with cross-slots (prominently visible in Photo 5)
  const fanScrewGeom = new THREE.CylinderGeometry(0.0016, 0.0016, 0.010, 10);
  [
    [-0.0165, -0.0165],
    [0.0165, -0.0165],
    [-0.0165, 0.0165],
    [0.0165, 0.0165],
  ].forEach(([sx, sz]) => {
    const fScrew = new THREE.Mesh(fanScrewGeom, chromeMat);
    fScrew.position.set(sx, 0.0005, sz);
    fanGroup.add(fScrew);

    const slotA = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.0004, 0.00045), blackPlasticMat);
    slotA.position.set(sx, 0.0056, sz);
    fanGroup.add(slotA);
    const slotB = new THREE.Mesh(new THREE.BoxGeometry(0.00045, 0.0004, 0.0018), blackPlasticMat);
    slotB.position.set(sx, 0.0056, sz);
    fanGroup.add(slotB);
  });

  // White "TE" Connectivity brand marking on black SODIMM/CSI latch bar (Photo 5)
  const teCanvas = document.createElement('canvas');
  teCanvas.width = 64;
  teCanvas.height = 32;
  const teCtx = teCanvas.getContext('2d')!;
  teCtx.fillStyle = '#18181b';
  teCtx.fillRect(0, 0, 64, 32);
  teCtx.fillStyle = '#e2e8f0';
  teCtx.font = 'bold 20px sans-serif';
  teCtx.textAlign = 'center';
  teCtx.fillText('TE', 32, 23);
  const teTex = new THREE.CanvasTexture(teCanvas);
  teTex.colorSpace = THREE.SRGBColorSpace;
  const teBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.004), new THREE.MeshBasicMaterial({ map: teTex }));
  teBadge.rotateX(-Math.PI / 2);
  teBadge.position.set(0.022, 0.0046, 0.022);
  jetsonNanoGroup.add(teBadge);

  // Glowing green Jetson SoM power indicator LED near GPIO corner (Photo 5)
  const somPwrLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.002, 0.0012, 0.0015),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.0 })
  );
  somPwrLed.position.set(0.031, 0.0038, 0.024);
  jetsonNanoGroup.add(somPwrLed);

  jetsonNanoGroup.add(fanGroup);

  // 0.91" Mini I2C OLED Display Module mounted flush along +X flank beside 40-pin GPIO (exact match to top-down Photo 5!)
  const oledModule = new THREE.Group();
  oledModule.position.set(0.060, 0.0046, 0.010);
  oledModule.rotation.set(0, Math.PI / 2, 0);

  // Blue breakout PCB base
  const oledPcbGeom = new THREE.BoxGeometry(0.038, 0.0016, 0.017);
  const oledPcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.2 });
  const oledPcb = new THREE.Mesh(oledPcbGeom, oledPcbMat);
  oledModule.add(oledPcb);

  // 4 Corner gold plated mounting holes
  [
    [-0.016, 0.006],
    [0.016, 0.006],
    [-0.016, -0.006],
    [0.016, -0.006],
  ].forEach(([hx, hz]) => {
    const holeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.0008, 0.0015, 8),
      brassMat
    );
    holeRing.rotateX(-Math.PI / 2);
    holeRing.position.set(hx, 0.0009, hz);
    oledModule.add(holeRing);
  });

  // Black OLED glass panel
  const oledGlassGeom = new THREE.PlaneGeometry(0.034, 0.0135);
  oledGlassGeom.rotateX(-Math.PI / 2);
  const oledScreen = new THREE.Mesh(oledGlassGeom, oledScreenMat);
  oledScreen.position.y = 0.0016;
  oledModule.add(oledScreen);

  // 4-Pin I2C Connection Header (GND, VCC, SCL, SDA) with gold pins
  const oledHeaderBase = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.0035, 0.003), blackPlasticMat);
  oledHeaderBase.position.set(0, -0.003, -0.007);
  oledModule.add(oledHeaderBase);

  for (let p = -1.5; p <= 1.5; p += 1) {
    const oledPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.00045, 0.00045, 0.007, 6),
      brassMat
    );
    oledPin.position.set(p * 0.0025, -0.004, -0.007);
    oledModule.add(oledPin);
  }

  registerMesh('jetsonNanoGroup', oledPcb);
  registerMesh('oledDisplayGroup', oledPcb);
  registerMesh('oledDisplayGroup', oledScreen);
  jetsonNanoGroup.add(oledModule);

  // ====================================================
  // REAR I/O PORT CLUSTER & CONTROLS (Exact physical match to image (6))
  // Facing rearwards (-Z) between the two Wi-Fi antennas
  // ====================================================

  // 1. Active Piezo Buzzer (Round black cylinder with central sound hole on the far left)
  const buzzerGroup = new THREE.Group();
  buzzerGroup.position.set(-0.056, 0.005, -0.048);
  const buzzerCasing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0058, 0.0058, 0.0055, 24),
    blackPlasticMat
  );
  buzzerGroup.add(buzzerCasing);

  // Recessed center sound port cavity
  const buzzerHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0016, 0.0016, 0.0015, 16),
    new THREE.MeshBasicMaterial({ color: 0x050505 })
  );
  buzzerHole.position.y = 0.0028;
  buzzerGroup.add(buzzerHole);

  // Plus sign (+) polarity indicator silkscreen
  const buzzPlus1 = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.0004, 0.0005), wireWhiteMat);
  buzzPlus1.position.set(-0.0035, 0.0029, -0.002);
  buzzerGroup.add(buzzPlus1);
  const buzzPlus2 = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.0004, 0.0018), wireWhiteMat);
  buzzPlus2.position.set(-0.0035, 0.0029, -0.002);
  buzzerGroup.add(buzzPlus2);

  registerMesh('jetsonNanoGroup', buzzerCasing);
  jetsonNanoGroup.add(buzzerGroup);

  // 2. DC Barrel Power Jack (5.5mm x 2.1mm coaxial jack with black collar & brass center pin)
  const dcJackGroup = new THREE.Group();
  dcJackGroup.position.set(-0.043, 0.0065, -0.060);

  // Main black thermoplastic socket body
  const dcJackBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.0095, 0.011, 0.014),
    blackPlasticMat
  );
  dcJackGroup.add(dcJackBody);

  // Protruding circular barrel collar facing -Z (rearward)
  const dcCollarGeom = new THREE.CylinderGeometry(0.0048, 0.0048, 0.0035, 20);
  dcCollarGeom.rotateX(Math.PI / 2);
  const dcCollar = new THREE.Mesh(dcCollarGeom, blackPlasticMat);
  dcCollar.position.set(0, 0, -0.008);
  dcJackGroup.add(dcCollar);

  // Metal ground outer ring
  const dcRingGeom = new THREE.CylinderGeometry(0.0040, 0.0040, 0.0015, 20);
  dcRingGeom.rotateX(Math.PI / 2);
  const dcRing = new THREE.Mesh(dcRingGeom, chromeMat);
  dcRing.position.set(0, 0, -0.009);
  dcJackGroup.add(dcRing);

  // Dark inner bore cavity
  const dcBoreGeom = new THREE.CylinderGeometry(0.0032, 0.0032, 0.005, 16);
  dcBoreGeom.rotateX(Math.PI / 2);
  const dcBore = new THREE.Mesh(dcBoreGeom, new THREE.MeshBasicMaterial({ color: 0x050505 }));
  dcBore.position.set(0, 0, -0.008);
  dcJackGroup.add(dcBore);

  // Center nickel/brass contact pin (2.1mm diameter)
  const dcPinGeom = new THREE.CylinderGeometry(0.001, 0.001, 0.005, 12);
  dcPinGeom.rotateX(Math.PI / 2);
  const dcPin = new THREE.Mesh(dcPinGeom, brassMat);
  dcPin.position.set(0, 0, -0.007);
  dcJackGroup.add(dcPin);

  registerMesh('jetsonNanoGroup', dcJackBody);
  registerMesh('hardwareControlsGroup', dcJackBody);
  jetsonNanoGroup.add(dcJackGroup);

  // 3. Stacked HDMI & DisplayPort Connectors (Nickel plated metal shielding box)
  const hdmiGroup = new THREE.Group();
  hdmiGroup.position.set(-0.024, 0.008, -0.060);

  const hdmiShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.0145, 0.018),
    chromeMat
  );
  hdmiGroup.add(hdmiShell);

  // Upper DisplayPort / HDMI opening
  const hdmiHole1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.013, 0.004, 0.003),
    new THREE.MeshBasicMaterial({ color: 0x09090b })
  );
  hdmiHole1.position.set(0, 0.0038, -0.0085);
  hdmiGroup.add(hdmiHole1);

  // Lower HDMI opening
  const hdmiHole2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.013, 0.004, 0.003),
    new THREE.MeshBasicMaterial({ color: 0x09090b })
  );
  hdmiHole2.position.set(0, -0.0038, -0.0085);
  hdmiGroup.add(hdmiHole2);

  // Gold internal tongue contacts inside HDMI ports
  const hdmiTongueGeom = new THREE.BoxGeometry(0.011, 0.0012, 0.002);
  const hdmiTongue1 = new THREE.Mesh(hdmiTongueGeom, brassMat);
  hdmiTongue1.position.set(0, 0.0038, -0.008);
  hdmiGroup.add(hdmiTongue1);
  const hdmiTongue2 = new THREE.Mesh(hdmiTongueGeom, brassMat);
  hdmiTongue2.position.set(0, -0.0038, -0.008);
  hdmiGroup.add(hdmiTongue2);

  registerMesh('jetsonNanoGroup', hdmiShell);
  jetsonNanoGroup.add(hdmiGroup);

  // 4. Dual Stacked USB 3.0 Type-A Ports - Stack 1 (2 Ports)
  // Distinctive blue plastic inserts (#0284c7) matching Jetson Nano specifications & image (6)
  const usbBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.35,
    metalness: 0.2,
  });

  function createUsbDualStack(posX: number): THREE.Group {
    const stack = new THREE.Group();
    stack.position.set(posX, 0.009, -0.061);

    // Chrome metal tower shell
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.016, 0.019),
      chromeMat
    );
    stack.add(shell);

    // Upper USB receptacle cavity
    const usbRecess1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.0125, 0.0055, 0.004),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0c })
    );
    usbRecess1.position.set(0, 0.0042, -0.0085);
    stack.add(usbRecess1);

    // Upper USB 3.0 Blue Insulator Tongue
    const tongue1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.0118, 0.002, 0.0035),
      usbBlueMat
    );
    tongue1.position.set(0, 0.0054, -0.008);
    stack.add(tongue1);

    // Lower USB receptacle cavity
    const usbRecess2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.0125, 0.0055, 0.004),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0c })
    );
    usbRecess2.position.set(0, -0.0042, -0.0085);
    stack.add(usbRecess2);

    // Lower USB 3.0 Blue Insulator Tongue
    const tongue2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.0118, 0.002, 0.0035),
      usbBlueMat
    );
    tongue2.position.set(0, -0.003, -0.008);
    stack.add(tongue2);

    // Spring retention grounding tabs on shell exterior
    for (let s = -1; s <= 1; s += 2) {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.006, 0.002), chromeMat);
      tab.position.set(s * 0.0076, 0, -0.002);
      stack.add(tab);
    }

    registerMesh('jetsonNanoGroup', shell);
    return stack;
  }

  // USB Stack 1 & Stack 2 (4 USB ports total, exactly as seen in image (6)!)
  const usbStack1 = createUsbDualStack(-0.005);
  const usbStack2 = createUsbDualStack(0.014);
  jetsonNanoGroup.add(usbStack1);
  jetsonNanoGroup.add(usbStack2);

  // 4b. Signature Waveshare "WS" USB-to-MicroUSB Bridge Dongle plugged below USB Stack 2 (prominent in image.png red circle!)
  const wsBridgeGroup = new THREE.Group();
  wsBridgeGroup.position.set(0.014, 0.002, -0.0725);

  // Molded matte-black L-bridge body
  const wsBody = new THREE.Mesh(new THREE.BoxGeometry(0.0135, 0.0115, 0.008), blackPlasticMat);
  registerMesh('jetsonNanoGroup', wsBody);
  wsBridgeGroup.add(wsBody);

  // White stylized "W" / "WS" Waveshare badge on rear face of dongle
  const wsCanvas = document.createElement('canvas');
  wsCanvas.width = 128;
  wsCanvas.height = 128;
  const wsCtx = wsCanvas.getContext('2d')!;
  wsCtx.fillStyle = '#11141a';
  wsCtx.fillRect(0, 0, 128, 128);
  wsCtx.strokeStyle = '#f8fafc';
  wsCtx.lineWidth = 10;
  wsCtx.lineCap = 'round';
  wsCtx.lineJoin = 'round';
  wsCtx.beginPath();
  wsCtx.moveTo(22, 42);
  wsCtx.lineTo(42, 86);
  wsCtx.lineTo(64, 52);
  wsCtx.lineTo(86, 86);
  wsCtx.lineTo(106, 42);
  wsCtx.stroke();
  wsCtx.fillStyle = '#f8fafc';
  wsCtx.font = 'bold 20px sans-serif';
  wsCtx.textAlign = 'center';
  wsCtx.fillText('WS', 64, 114);
  const wsLogoTex = new THREE.CanvasTexture(wsCanvas);
  wsLogoTex.colorSpace = THREE.SRGBColorSpace;

  const wsBadge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.011, 0.010),
    new THREE.MeshBasicMaterial({ map: wsLogoTex })
  );
  wsBadge.rotation.y = Math.PI;
  wsBadge.position.set(0, 0, -0.0041);
  wsBridgeGroup.add(wsBadge);

  // Lower bridge neck tab tucking into expansion carrier Micro-USB/USB bridge port
  const wsNeck = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.005, 0.009), blackPlasticMat);
  wsNeck.position.set(0, -0.006, 0.004);
  wsBridgeGroup.add(wsNeck);

  jetsonNanoGroup.add(wsBridgeGroup);

  // 5. Gigabit Ethernet RJ45 Metal Jack with LED indicators (image (6))
  const rj45Group = new THREE.Group();
  rj45Group.position.set(0.034, 0.0085, -0.062);

  // Chrome metal shielded RJ45 housing
  const rj45Shell = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.0145, 0.021),
    chromeMat
  );
  rj45Group.add(rj45Shell);

  // Metallic red/silver holographic QC seal sticker on top of Ethernet housing (image (1) / image (6))
  const qcSticker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0042, 0.0042, 0.0004, 16),
    new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.7, roughness: 0.25 })
  );
  qcSticker.position.set(0, 0.0074, 0.002);
  rj45Group.add(qcSticker);

  // Modular 8P8C aperture opening
  const rj45Aperture = new THREE.Mesh(
    new THREE.BoxGeometry(0.0115, 0.0085, 0.004),
    new THREE.MeshBasicMaterial({ color: 0x08080a })
  );
  rj45Aperture.position.set(0, -0.0015, -0.0095);
  rj45Group.add(rj45Aperture);

  // 8 Gold contact wire fingers inside opening
  for (let p = -3.5; p <= 3.5; p += 1) {
    const goldWire = new THREE.Mesh(
      new THREE.BoxGeometry(0.0005, 0.0035, 0.002),
      brassMat
    );
    goldWire.position.set(p * 0.0011, 0.001, -0.009);
    rj45Group.add(goldWire);
  }

  // Dual status LEDs on top corners of RJ45 port:
  // Top-left: Green Link LED
  const ethLedGreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.0022, 0.0016, 0.001),
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    })
  );
  ethLedGreen.position.set(-0.005, 0.0052, -0.0102);
  rj45Group.add(ethLedGreen);

  // Top-right: Amber Activity LED
  const ethLedAmber = new THREE.Mesh(
    new THREE.BoxGeometry(0.0022, 0.0016, 0.001),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.90,
      roughness: 0.2,
    })
  );
  ethLedAmber.position.set(0.005, 0.0052, -0.0102);
  rj45Group.add(ethLedAmber);

  registerMesh('jetsonNanoGroup', rj45Shell);
  jetsonNanoGroup.add(rj45Group);

  // 6. Micro-USB OTG Programming Port
  const microUsbGeom = new THREE.BoxGeometry(0.008, 0.0035, 0.006);
  const microUsb = new THREE.Mesh(microUsbGeom, chromeMat);
  microUsb.position.set(0.048, 0.0035, -0.064);
  registerMesh('jetsonNanoGroup', microUsb);
  registerMesh('hardwareControlsGroup', microUsb);
  jetsonNanoGroup.add(microUsb);

  // 7. Tactile Pushbuttons: BOOT and RESET buttons (matching photo image (6) & photo 1)
  const btnHousingGeom = new THREE.BoxGeometry(0.0052, 0.0036, 0.0052);
  const btnActuatorGeom = new THREE.CylinderGeometry(0.0014, 0.0014, 0.002, 12);

  // BOOT button (rear-right edge beside Micro-USB per Photos 2 & 6)
  const bootBtnBase = new THREE.Mesh(btnHousingGeom, chromeMat);
  bootBtnBase.position.set(0.056, 0.0035, -0.060);
  const bootBtnAct = new THREE.Mesh(btnActuatorGeom, wireWhiteMat);
  bootBtnAct.position.set(0.056, 0.0058, -0.060);
  registerMesh('hardwareControlsGroup', bootBtnBase);
  jetsonNanoGroup.add(bootBtnBase);
  jetsonNanoGroup.add(bootBtnAct);

  // RESET button (rear-right edge beside BOOT per Photos 2 & 6)
  const resetBtnBase = new THREE.Mesh(btnHousingGeom, chromeMat);
  resetBtnBase.position.set(0.064, 0.0035, -0.060);
  const resetBtnAct = new THREE.Mesh(btnActuatorGeom, wireWhiteMat);
  resetBtnAct.position.set(0.064, 0.0058, -0.060);
  registerMesh('hardwareControlsGroup', resetBtnBase);
  jetsonNanoGroup.add(resetBtnBase);
  jetsonNanoGroup.add(resetBtnAct);

  // 8. Power Slide Switch (ON / OFF) on +X rear-right flank with 3 thick silver solder pins (Photos 2, 3, 4, 5, 6)
  const switchGroup = new THREE.Group();
  switchGroup.position.set(0.069, 0.005, -0.044);
  switchGroup.rotation.y = -Math.PI / 2;

  const switchFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.0085, 0.0042, 0.010),
    chromeMat
  );
  switchGroup.add(switchFrame);

  // Black sliding knob toggle protruding outward on right flank
  const switchKnob = new THREE.Mesh(
    new THREE.BoxGeometry(0.0032, 0.0055, 0.0055),
    blackPlasticMat
  );
  switchKnob.position.set(0.0015, 0.0022, -0.0055);
  switchGroup.add(switchKnob);

  // 3 Silver solder lug pins visible cleanly from top & side (Photos 3 & 5)
  for (let s = -1; s <= 1; s++) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.0025, 0.0022), chromeMat);
    lug.position.set(s * 0.0026, -0.0025, 0.0035);
    switchGroup.add(lug);
  }

  // "ON OFF" Silkscreen Plate on Carrier PCB beside switch
  const pwrLabelCanvas = document.createElement('canvas');
  pwrLabelCanvas.width = 128;
  pwrLabelCanvas.height = 64;
  const pwrCtx = pwrLabelCanvas.getContext('2d')!;
  pwrCtx.fillStyle = '#0f141c';
  pwrCtx.fillRect(0, 0, 128, 64);
  pwrCtx.fillStyle = '#ffffff';
  pwrCtx.font = 'bold 20px monospace';
  pwrCtx.textAlign = 'center';
  pwrCtx.fillText('PWR SW', 64, 26);
  pwrCtx.font = 'bold 16px monospace';
  pwrCtx.fillText('ON  OFF', 64, 52);
  const pwrLabelTex = new THREE.CanvasTexture(pwrLabelCanvas);
  const pwrLabelPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.012, 0.006),
    new THREE.MeshBasicMaterial({ map: pwrLabelTex })
  );
  pwrLabelPlate.rotateX(-Math.PI / 2);
  pwrLabelPlate.rotateZ(Math.PI / 2);
  pwrLabelPlate.position.set(0.058, 0.0025, -0.044);
  jetsonNanoGroup.add(pwrLabelPlate);

  // White 4-Pin Side Expansion / I2C JST Socket next to power switch on front/left edge (image (4) side view)
  const batTermGeom = new THREE.BoxGeometry(0.011, 0.0062, 0.0072);
  const batTerm = new THREE.Mesh(batTermGeom, wireWhiteMat);
  batTerm.position.set(-0.044, 0.0048, -0.064);
  jetsonNanoGroup.add(batTerm);
  [-0.0036, -0.0012, 0.0012, 0.0036].forEach((tx) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.004, 6), brassMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(-0.044 + tx, 0.0048, -0.066);
    jetsonNanoGroup.add(pin);
  });

  // 3 Gold Spring-Loaded Pogo Power Contact Pins protruding beneath carrier board into battery bridge (photo 5 / battery photo)
  [-0.010, -0.004, 0.002].forEach((px) => {
    const pogoPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0008, 0.0065, 10), brassMat);
    pogoPin.position.set(px, -0.0065, -0.036);
    jetsonNanoGroup.add(pogoPin);
  });

  // ----------------------------------------------------
  // Horizontal Rear-Facing 40-Pin Header Array (Directly visible in Photo 2 under heatsink!)
  // ----------------------------------------------------
  const rearGpioGroup = new THREE.Group();
  rearGpioGroup.position.set(-0.005, 0.0035, -0.042);

  const rearGpioBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.062, 0.0045, 0.0055),
    blackPlasticMat
  );
  rearGpioGroup.add(rearGpioBase);

  // 2 Rows of 20 Vertical Gold Pins (40 pins total gleam through middle gap under heatsink!)
  const rearPinGeom = new THREE.BoxGeometry(0.00075, 0.0085, 0.00075);
  for (let p = 0; p < 20; p++) {
    const px = -0.028 + p * 0.00295;
    // Front row pin
    const pinF = new THREE.Mesh(rearPinGeom, brassMat);
    pinF.position.set(px, 0.0065, 0.0015);
    rearGpioGroup.add(pinF);
    // Back row pin (closest to rear edge)
    const pinB = new THREE.Mesh(rearPinGeom, brassMat);
    pinB.position.set(px, 0.0065, -0.0015);
    rearGpioGroup.add(pinB);
  }

  // Jumper shunts on select rear pins (Photo 2)
  const rJmpY = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0065, 0.0045), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }));
  rJmpY.position.set(-0.012, 0.008, 0);
  rearGpioGroup.add(rJmpY);

  const rJmpG = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0065, 0.0045), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 }));
  rJmpG.position.set(0.005, 0.008, 0);
  rearGpioGroup.add(rJmpG);

  const rJmpB = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0065, 0.0045), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
  rJmpB.position.set(0.018, 0.008, 0);
  rearGpioGroup.add(rJmpB);

  jetsonNanoGroup.add(rearGpioGroup);

  registerMesh('hardwareControlsGroup', switchFrame);
  jetsonNanoGroup.add(switchGroup);

  // ====================================================
  // SIGNATURE MULTI-COLORED SILICONE WIRING HARNESS (image (6))
  // Looping gracefully over the USB & Ethernet ports from JST connector
  // ====================================================

  // White 4-Pin JST-XH Fan Header Socket on Carrier PCB (right side near Ethernet)
  const jstHarnessPlug = new THREE.Mesh(
    new THREE.BoxGeometry(0.010, 0.0055, 0.006),
    wireWhiteMat
  );
  jstHarnessPlug.position.set(0.032, 0.004, -0.030);
  jetsonNanoGroup.add(jstHarnessPlug);

  // Helper to create smooth 3D curved silicone wire bundles
  function createSiliconeHarnessWire(colorMat: THREE.Material, points: THREE.Vector3[], radius = 0.00095): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, 28, radius, 8, false);
    return new THREE.Mesh(geom, colorMat);
  }

  // 4 Characteristic Colored Silicone Wires (Yellow, Red, Black, Blue)
  // Forms a wide sweeping horizontal arch across the rear face above USB & RJ45 ports (exact match to 3_37e20bc8.jpg)
  // Wire 1: Vivid Yellow wire (outermost/highest crest, most visible in user photo 3_37e20bc8.jpg)
  const wireYellow = createSiliconeHarnessWire(wireYellowMat, [
    new THREE.Vector3(-0.022, 0.031, -0.015),
    new THREE.Vector3(-0.028, 0.028, -0.032),
    new THREE.Vector3(-0.018, 0.029, -0.048),
    new THREE.Vector3( 0.004, 0.031, -0.050),
    new THREE.Vector3( 0.022, 0.027, -0.046),
    new THREE.Vector3( 0.032, 0.016, -0.038),
    new THREE.Vector3( 0.031, 0.006, -0.030),
  ], 0.0010);
  jetsonNanoGroup.add(wireYellow);

  // Wire 2: Bold Red wire (closely bundled immediately beneath/beside yellow)
  const wireRed = createSiliconeHarnessWire(wireRedMat, [
    new THREE.Vector3(-0.022, 0.030, -0.0165),
    new THREE.Vector3(-0.027, 0.027, -0.033),
    new THREE.Vector3(-0.017, 0.027, -0.047),
    new THREE.Vector3( 0.004, 0.029, -0.0485),
    new THREE.Vector3( 0.021, 0.025, -0.045),
    new THREE.Vector3( 0.032, 0.015, -0.038),
    new THREE.Vector3( 0.032, 0.006, -0.030),
  ], 0.00095);
  jetsonNanoGroup.add(wireRed);

  // Wire 3: Matte Jet Black wire (inner track of the bundle)
  const wireBlack = createSiliconeHarnessWire(wireBlackMat, [
    new THREE.Vector3(-0.022, 0.029, -0.018),
    new THREE.Vector3(-0.026, 0.025, -0.034),
    new THREE.Vector3(-0.016, 0.025, -0.046),
    new THREE.Vector3( 0.004, 0.027, -0.047),
    new THREE.Vector3( 0.020, 0.023, -0.044),
    new THREE.Vector3( 0.032, 0.014, -0.038),
    new THREE.Vector3( 0.033, 0.006, -0.030),
  ], 0.00095);
  jetsonNanoGroup.add(wireBlack);

  // Wire 4: Electric Blue wire (PWM/tachometer wire)
  const wireBlue = createSiliconeHarnessWire(wireBlueMat, [
    new THREE.Vector3(-0.022, 0.028, -0.0195),
    new THREE.Vector3(-0.025, 0.024, -0.035),
    new THREE.Vector3(-0.015, 0.024, -0.045),
    new THREE.Vector3( 0.004, 0.025, -0.0455),
    new THREE.Vector3( 0.019, 0.022, -0.043),
    new THREE.Vector3( 0.031, 0.013, -0.038),
    new THREE.Vector3( 0.034, 0.006, -0.030),
  ], 0.00085);
  jetsonNanoGroup.add(wireBlue);

  // Miniature Black Zip-Tie Collars bundling the fan harness together (Photo 3 & Photo 2)
  const zipCollarGeom = new THREE.TorusGeometry(0.0026, 0.00065, 8, 16);
  const zip1 = new THREE.Mesh(zipCollarGeom, blackPlasticMat);
  zip1.position.set(-0.007, 0.0285, -0.048);
  zip1.rotation.y = Math.PI / 2;
  jetsonNanoGroup.add(zip1);

  const zip2 = new THREE.Mesh(zipCollarGeom, blackPlasticMat);
  zip2.position.set(0.016, 0.026, -0.046);
  zip2.rotation.y = Math.PI / 2;
  jetsonNanoGroup.add(zip2);

  // ====================================================
  // CARRIER BOARD FLANK CONNECTORS & 40-PIN GPIO (image (6) & Photo 5)
  // ====================================================

  // White 6-Pin JST-XH Horizontal Connector on Left Board Flank (-X)
  const jst6Geom = new THREE.BoxGeometry(0.007, 0.0058, 0.016);
  const jst6 = new THREE.Mesh(jst6Geom, wireWhiteMat);
  jst6.position.set(-0.071, 0.003, 0.012);
  jetsonNanoGroup.add(jst6);

  // Friction lock ramp on JST-6
  const jst6Ramp = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0018, 0.012), wireWhiteMat);
  jst6Ramp.position.set(-0.071, 0.0062, 0.012);
  jetsonNanoGroup.add(jst6Ramp);

  // 6 Internal Gold Pin Terminals inside JST-6
  for (let p = -2.5; p <= 2.5; p += 1) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0008, 0.0008), brassMat);
    pin.position.set(-0.072, 0.003, 0.012 + p * 0.0025);
    jetsonNanoGroup.add(pin);
  }

  // White 4-Pin JST-XH Auxiliary Connector on Left Flank (-X)
  const jst4Geom = new THREE.BoxGeometry(0.007, 0.0058, 0.011);
  const jst4 = new THREE.Mesh(jst4Geom, wireWhiteMat);
  jst4.position.set(-0.071, 0.003, -0.008);
  jetsonNanoGroup.add(jst4);

  for (let p = -1.5; p <= 1.5; p += 1) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0008, 0.0008), brassMat);
    pin.position.set(-0.072, 0.003, -0.008 + p * 0.0025);
    jetsonNanoGroup.add(pin);
  }

  // Micro-USB Programming Port on Left Flank Edge (Directly visible in side profile)
  const flankUsbGroup = new THREE.Group();
  flankUsbGroup.position.set(-0.071, 0.0032, -0.024);
  const flankUsbShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.0036, 0.008),
    chromeMat
  );
  flankUsbGroup.add(flankUsbShell);
  const flankUsbSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.002, 0.0018, 0.0056),
    new THREE.MeshBasicMaterial({ color: 0x08080a })
  );
  flankUsbSlot.position.set(-0.0025, 0, 0);
  flankUsbGroup.add(flankUsbSlot);
  registerMesh('hardwareControlsGroup', flankUsbShell);
  jetsonNanoGroup.add(flankUsbGroup);

  // 2-Pin Jumper Header with Black Shunt on Left Flank
  const flankJmpBase = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0025, 0.0055), blackPlasticMat);
  flankJmpBase.position.set(-0.066, 0.002, -0.016);
  const flankJmpShunt = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.005, 0.0048), blackPlasticMat);
  flankJmpShunt.position.set(-0.066, 0.0055, -0.016);
  jetsonNanoGroup.add(flankJmpBase);
  jetsonNanoGroup.add(flankJmpShunt);

  // 40-Pin GPIO Expansion Header positioned inside OLED strip so OLED + GPIO pinout chart read side-by-side (Photo 5)
  const gpioBlockGeom = new THREE.BoxGeometry(0.006, 0.005, 0.072);
  const gpioMesh = new THREE.Mesh(gpioBlockGeom, blackPlasticMat);
  gpioMesh.position.set(0.042, 0.004, 0.006);
  registerMesh('jetsonNanoGroup', gpioMesh);
  jetsonNanoGroup.add(gpioMesh);

  // 20 Pairs of Square Gold Pins (40 pins total - authentic 2.54mm pitch)
  const pinGeom = new THREE.BoxGeometry(0.00075, 0.009, 0.00075);
  for (let p = 0; p < 20; p++) {
    const pz = -0.028 + p * 0.00355;
    // Outer row pin (closer to OLED)
    const pinOuter = new THREE.Mesh(pinGeom, brassMat);
    pinOuter.position.set(0.0435, 0.010, pz);
    jetsonNanoGroup.add(pinOuter);
    // Inner row pin
    const pinInner = new THREE.Mesh(pinGeom, brassMat);
    pinInner.position.set(0.0405, 0.010, pz);
    jetsonNanoGroup.add(pinInner);
  }

  // Pin 1 Gold Square Pad indicator on PCB
  const pin1Indicator = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.0004, 0.0018), brassMat);
  pin1Indicator.position.set(0.045, 0.002, -0.031);
  jetsonNanoGroup.add(pin1Indicator);

  // Mini Jumper Caps / Shunt Blocks (Yellow, Green, Blue jumpers visible in user photos!)
  const yellowJumperMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
  const greenJumperMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });
  const blueJumperMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
  const jumperGeom = new THREE.BoxGeometry(0.0048, 0.0068, 0.0032);

  const jmpYellow = new THREE.Mesh(jumperGeom, yellowJumperMat);
  jmpYellow.position.set(0.042, 0.0115, -0.012);
  jetsonNanoGroup.add(jmpYellow);

  const jmpGreen = new THREE.Mesh(jumperGeom, greenJumperMat);
  jmpGreen.position.set(0.042, 0.0115, 0.002);
  jetsonNanoGroup.add(jmpGreen);

  const jmpBlue = new THREE.Mesh(jumperGeom, blueJumperMat);
  jmpBlue.position.set(0.042, 0.0115, 0.014);
  jetsonNanoGroup.add(jmpBlue);

  const jmpBlack = new THREE.Mesh(jumperGeom, blackPlasticMat);
  jmpBlack.position.set(0.042, 0.0115, 0.028);
  jetsonNanoGroup.add(jmpBlack);

  // SMD 0805 Resistors and Capacitors between GPIO header and OLED strip
  const smdCapMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 });
  const smdResMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 });
  for (let c = 0; c < 8; c++) {
    const cz = -0.035 + c * 0.010;
    const isCap = c % 2 === 0;
    const smd = new THREE.Mesh(
      new THREE.BoxGeometry(0.002, 0.0009, 0.0012),
      isCap ? smdCapMat : smdResMat
    );
    smd.position.set(0.049, 0.0018, cz);
    jetsonNanoGroup.add(smd);
  }

  // ====================================================
  // FRONT-LEFT ELECTRONICS & MOTOR DRIVER SUITE (Red-marked zone in image_6c9246a9.png)
  // Fully populates the front & front-left board area with authentic robotics circuitry
  // ====================================================

  // 1. Dual Motor Output Sockets (MOTOR_L & MOTOR_R) with White JST Housings & Gold Pins
  const jstMotorGeom = new THREE.BoxGeometry(0.0075, 0.0055, 0.007);
  const jstMotorRampGeom = new THREE.BoxGeometry(0.0035, 0.0018, 0.006);

  // MOTOR_L socket (Left motor driver output)
  const motorLSocket = new THREE.Mesh(jstMotorGeom, wireWhiteMat);
  motorLSocket.position.set(-0.034, 0.0035, 0.048);
  const motorLRamp = new THREE.Mesh(jstMotorRampGeom, wireWhiteMat);
  motorLRamp.position.set(-0.034, 0.0065, 0.048);
  jetsonNanoGroup.add(motorLSocket);
  jetsonNanoGroup.add(motorLRamp);

  // MOTOR_R socket (Right motor driver output)
  const motorRSocket = new THREE.Mesh(jstMotorGeom, wireWhiteMat);
  motorRSocket.position.set(-0.014, 0.0035, 0.048);
  const motorRRamp = new THREE.Mesh(jstMotorRampGeom, wireWhiteMat);
  motorRRamp.position.set(-0.014, 0.0065, 0.048);
  jetsonNanoGroup.add(motorRSocket);
  jetsonNanoGroup.add(motorRRamp);

  // Gold connector pins inside motor sockets
  [-0.0355, -0.0325, -0.0155, -0.0125].forEach((px) => {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0035, 0.0008), brassMat);
    pin.position.set(px, 0.004, 0.048);
    jetsonNanoGroup.add(pin);
  });

  // Twisted Motor Lead Silicone Wires (Red & Black) curving down through chassis slot
  function createMotorLeadWire(colorMat: THREE.Material, points: THREE.Vector3[]): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, 14, 0.0009, 6, false);
    return new THREE.Mesh(geom, colorMat);
  }

  // Left motor wires descending into center slot
  const motorWireL1 = createMotorLeadWire(wireRedMat, [
    new THREE.Vector3(-0.035, 0.0035, 0.048),
    new THREE.Vector3(-0.038, -0.006, 0.042),
    new THREE.Vector3(-0.028, -0.018, 0.028),
    new THREE.Vector3(-0.012, -0.032, 0.010),
  ]);
  jetsonNanoGroup.add(motorWireL1);

  const motorWireL2 = createMotorLeadWire(wireBlackMat, [
    new THREE.Vector3(-0.032, 0.0035, 0.048),
    new THREE.Vector3(-0.035, -0.006, 0.040),
    new THREE.Vector3(-0.025, -0.018, 0.026),
    new THREE.Vector3(-0.009, -0.032, 0.008),
  ]);
  jetsonNanoGroup.add(motorWireL2);

  // Right motor wires descending into center slot
  const motorWireR1 = createMotorLeadWire(wireRedMat, [
    new THREE.Vector3(-0.015, 0.0035, 0.048),
    new THREE.Vector3(-0.018, -0.006, 0.042),
    new THREE.Vector3(-0.010, -0.018, 0.028),
    new THREE.Vector3(0.004, -0.032, 0.010),
  ]);
  jetsonNanoGroup.add(motorWireR1);

  const motorWireR2 = createMotorLeadWire(wireBlackMat, [
    new THREE.Vector3(-0.012, 0.0035, 0.048),
    new THREE.Vector3(-0.015, -0.006, 0.040),
    new THREE.Vector3(-0.007, -0.018, 0.026),
    new THREE.Vector3(0.007, -0.032, 0.008),
  ]);
  jetsonNanoGroup.add(motorWireR2);

  // 2. Toshiba TB6612FNG Dual H-Bridge Motor Driver IC (SSOP-24 Package)
  const tb6612Group = new THREE.Group();
  tb6612Group.position.set(-0.024, 0.0022, 0.036);

  const tb6612Body = new THREE.Mesh(
    new THREE.BoxGeometry(0.0082, 0.0018, 0.0062),
    new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.35, metalness: 0.2 })
  );
  tb6612Group.add(tb6612Body);

  // Pin 1 dot on TB6612
  const tbDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.0004, 8),
    new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
  );
  tbDot.rotateX(-Math.PI / 2);
  tbDot.position.set(-0.003, 0.001, -0.002);
  tb6612Group.add(tbDot);

  // 24 Silver gull-wing lead pins
  const leadGeom = new THREE.BoxGeometry(0.0012, 0.0004, 0.00035);
  for (let p = 0; p < 12; p++) {
    const pz = -0.0026 + p * 0.00048;
    const leadL = new THREE.Mesh(leadGeom, chromeMat);
    leadL.position.set(-0.0046, -0.0005, pz);
    tb6612Group.add(leadL);
    const leadR = new THREE.Mesh(leadGeom, chromeMat);
    leadR.position.set(0.0046, -0.0005, pz);
    tb6612Group.add(leadR);
  }
  jetsonNanoGroup.add(tb6612Group);

  // 3. Two Large Shielded High-Current Power Inductors (10uH SMD Chokes - L1 & L2)
  const inductorGeom = new THREE.BoxGeometry(0.0075, 0.0045, 0.0075);
  const inductorMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.6, metalness: 0.5 });
  const indTerminalGeom = new THREE.BoxGeometry(0.001, 0.004, 0.007);

  [-0.028, -0.014].forEach((ix) => {
    const indGroup = new THREE.Group();
    indGroup.position.set(ix, 0.004, 0.022);

    const indBody = new THREE.Mesh(inductorGeom, inductorMat);
    indGroup.add(indBody);

    // Silver solder terminal endcaps
    const term1 = new THREE.Mesh(indTerminalGeom, chromeMat);
    term1.position.set(-0.0038, 0, 0);
    indGroup.add(term1);
    const term2 = new THREE.Mesh(indTerminalGeom, chromeMat);
    term2.position.set(0.0038, 0, 0);
    indGroup.add(term2);

    // Silver silkscreen marking disc on top with "100" dot
    const indMark = new THREE.Mesh(
      new THREE.CircleGeometry(0.002, 12),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
    );
    indMark.rotateX(-Math.PI / 2);
    indMark.position.y = 0.0023;
    indGroup.add(indMark);

    jetsonNanoGroup.add(indGroup);
  });

  // 4. Two Solid-Polymer Aluminum Electrolytic Capacitors (Silver Cans with Blue Markings - C1 & C2)
  const solidCapGeom = new THREE.CylinderGeometry(0.0032, 0.0032, 0.0075, 20);
  const solidCapMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.12,
  });

  [0.034, 0.046].forEach((cz) => {
    const capGroup = new THREE.Group();
    capGroup.position.set(-0.044, 0.0055, cz);

    const capCan = new THREE.Mesh(solidCapGeom, solidCapMat);
    capGroup.add(capCan);

    // Blue half-moon negative polarity marking on top disc
    const halfMoonGeom = new THREE.RingGeometry(0, 0.003, 16, 1, 0, Math.PI);
    halfMoonGeom.rotateX(-Math.PI / 2);
    const halfMoonMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const halfMoon = new THREE.Mesh(halfMoonGeom, halfMoonMat);
    halfMoon.position.y = 0.0038;
    capGroup.add(halfMoon);

    // Black plastic seating base plate underneath
    const capSeat = new THREE.Mesh(new THREE.BoxGeometry(0.0068, 0.0012, 0.0068), blackPlasticMat);
    capSeat.position.y = -0.0038;
    capGroup.add(capSeat);

    jetsonNanoGroup.add(capGroup);
  });

  // 5. 5V 4A Step-Down Switching Buck Regulator (D2PAK / TO-263 Power Package)
  const regGroup = new THREE.Group();
  regGroup.position.set(-0.002, 0.0028, 0.035);
  const regBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.007, 0.0022, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
  );
  regGroup.add(regBody);

  // Large copper/tin solder heatsink tab on back of regulator
  const regTab = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.0008, 0.003), chromeMat);
  regTab.position.set(0, -0.0005, -0.0048);
  regGroup.add(regTab);

  // 3 Solder pins on front of regulator
  for (let p = -1; p <= 1; p++) {
    const regPin = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.0006, 0.0022), chromeMat);
    regPin.position.set(p * 0.002, -0.0007, 0.0048);
    regGroup.add(regPin);
  }
  jetsonNanoGroup.add(regGroup);

  // 6. INA219 High-Side Power & Current Monitor IC + R100 Shunt Resistor
  const ina219Group = new THREE.Group();
  ina219Group.position.set(-0.036, 0.002, 0.025);
  const inaBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.0045, 0.0015, 0.0045),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
  );
  ina219Group.add(inaBody);

  // High-precision current sense alloy shunt resistor R100 (0.1 Ohm)
  const shuntGeom = new THREE.BoxGeometry(0.0032, 0.0012, 0.002);
  const shuntMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 }); // green ceramic
  const shuntRes = new THREE.Mesh(shuntGeom, shuntMat);
  shuntRes.position.set(0.005, 0, 0);
  ina219Group.add(shuntRes);
  const shuntEndL = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0013, 0.002), chromeMat);
  shuntEndL.position.set(0.0032, 0, 0);
  ina219Group.add(shuntEndL);
  const shuntEndR = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0013, 0.002), chromeMat);
  shuntEndR.position.set(0.0068, 0, 0);
  ina219Group.add(shuntEndR);

  jetsonNanoGroup.add(ina219Group);

  // 7. 3-Channel 3-Pin Servo Header Bank (Pan-Tilt / Gripper Extension)
  const servoBankGroup = new THREE.Group();
  servoBankGroup.position.set(-0.052, 0.0035, -0.015);
  const servoBase = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.003, 0.016), blackPlasticMat);
  servoBankGroup.add(servoBase);

  // 3x3 Gold Pin Array (GND, VCC, Signal)
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      const sPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.00035, 0.00035, 0.006, 6),
        brassMat
      );
      sPin.position.set(col * 0.0025, 0.003, row * 0.0045);
      servoBankGroup.add(sPin);
    }
  }
  jetsonNanoGroup.add(servoBankGroup);

  // 8. Triple Front Status Indicator LEDs (5V Power, Motor Power, I2C Bus)
  // Green 5V Main Power LED
  const pwr5vLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.0018, 0.0012, 0.0014),
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    })
  );
  pwr5vLed.position.set(-0.003, 0.0022, 0.048);
  jetsonNanoGroup.add(pwr5vLed);

  // Electric Blue Motor Driver Power LED
  const motorPwrLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.0018, 0.0012, 0.0014),
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.90,
      roughness: 0.2,
    })
  );
  motorPwrLed.position.set(-0.023, 0.0022, 0.048);
  jetsonNanoGroup.add(motorPwrLed);

  // Amber I2C Bus Activity LED
  const i2cLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.0018, 0.0012, 0.0014),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    })
  );
  i2cLed.position.set(-0.044, 0.0022, 0.024);
  jetsonNanoGroup.add(i2cLed);

  // 9. Extra SMD 0603/0805 Passives populating the front-left zone
  const frontSmdCoords = [
    [-0.018, 0.026],
    [-0.022, 0.028],
    [-0.030, 0.038],
    [-0.032, 0.032],
    [-0.008, 0.042],
    [-0.006, 0.028],
    [-0.038, 0.022],
    [-0.042, 0.016],
    [-0.046, 0.030],
  ];
  frontSmdCoords.forEach(([sx, sz], i) => {
    const isCap = i % 2 === 0;
    const smdChip = new THREE.Mesh(
      new THREE.BoxGeometry(0.0018, 0.0009, 0.0011),
      isCap ? smdCapMat : smdResMat
    );
    smdChip.position.set(sx, 0.0018, sz);
    jetsonNanoGroup.add(smdChip);
  });

  // 10. Camera CSI ZIF connector on Jetson board (front-facing with silver grounding tabs)
  const csiZifGeom = new THREE.BoxGeometry(0.022, 0.0034, 0.0055);
  const csiZif = new THREE.Mesh(csiZifGeom, blackPlasticMat);
  csiZif.position.set(0, 0.005, 0.022);
  jetsonNanoGroup.add(csiZif);

  // Silver side grounding solder tabs on ZIF socket
  for (let s = -1; s <= 1; s += 2) {
    const csiTab = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0025, 0.004), chromeMat);
    csiTab.position.set(s * 0.0115, 0.004, 0.022);
    jetsonNanoGroup.add(csiTab);
  }

  // White ZIF clamping slider latch on connector
  const csiLatchGeom = new THREE.BoxGeometry(0.020, 0.002, 0.0022);
  const csiLatch = new THREE.Mesh(csiLatchGeom, wireWhiteMat);
  csiLatch.position.set(0, 0.0068, 0.024);
  jetsonNanoGroup.add(csiLatch);

  // Characteristic Blue Stiffener Tab seated in CSI socket
  const csiBlueTabGeom = new THREE.BoxGeometry(0.016, 0.0025, 0.0012);
  const csiBlueTab = new THREE.Mesh(
    csiBlueTabGeom,
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
  );
  csiBlueTab.position.set(0, 0.0075, 0.0245);
  jetsonNanoGroup.add(csiBlueTab);

  // ----------------------------------------------------
  // 3. RPLIDAR HEAD GROUP (Exact match to user photos Photo 2, 3, 4, 7 & Image 14 red circle)
  // ----------------------------------------------------
  const rplidarGroup = new THREE.Group();
  rplidarGroup.name = 'rplidar';
  rplidarGroup.position.set(0, 0.145, -0.005);

  // 4 Black Standoff Risers elevating the RPLIDAR head above the top deck plate (Prominently visible in Photo 2 & 4)
  const lidarRiserGeom = new THREE.CylinderGeometry(0.0035, 0.0035, 0.024, 16);
  const lidarRiserPositions = [
    [-0.035, 0.012, -0.032],
    [0.035, 0.012, -0.032],
    [-0.035, 0.012, 0.024],
    [0.035, 0.012, 0.024],
  ];
  lidarRiserPositions.forEach(([rx, ry, rz]) => {
    const riser = new THREE.Mesh(lidarRiserGeom, blackPlasticMat);
    riser.position.set(rx, ry, rz);
    registerMesh('rplidarGroup', riser);
    rplidarGroup.add(riser);

    // Chrome bottom mounting screw flange on top plate
    const botScr = new THREE.Mesh(screwGeom, chromeMat);
    botScr.position.set(rx, 0.001, rz);
    rplidarGroup.add(botScr);
  });

  // Teardrop / Asymmetric Base Plate (Circled in red in Image 14)
  // Elevated on top of the 4 risers at y = 0.025m
  const teardropShape = new THREE.Shape();
  const mainR = 0.048;
  const lobeX = 0.045;
  const lobeZ = -0.012;
  const lobeR = 0.016;

  const dLobe = Math.hypot(lobeX, lobeZ);
  const angCenter = Math.atan2(lobeZ, lobeX);
  const angOffset = Math.acos(Math.max(-1, Math.min(1, (mainR - lobeR) / dLobe)));

  const t1Main = angCenter + angOffset;
  const t2Main = angCenter - angOffset;
  const t1Lobe = angCenter + angOffset;
  const t2Lobe = angCenter - angOffset;

  teardropShape.moveTo(mainR * Math.cos(t1Main), mainR * Math.sin(t1Main));
  teardropShape.absarc(0, 0, mainR, t1Main, t2Main, false);
  teardropShape.lineTo(lobeX + lobeR * Math.cos(t2Lobe), lobeZ + lobeR * Math.sin(t2Lobe));
  teardropShape.absarc(lobeX, lobeZ, lobeR, t2Lobe, t1Lobe, false);
  teardropShape.closePath();

  const teardropGeom = new THREE.ExtrudeGeometry(teardropShape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.0012,
    bevelThickness: 0.0012,
  });
  teardropGeom.rotateX(Math.PI / 2);
  const lidarBasePlate = new THREE.Mesh(teardropGeom, blackPlasticMat);
  lidarBasePlate.position.set(0, 0.025, 0);
  registerMesh('rplidarGroup', lidarBasePlate);
  rplidarGroup.add(lidarBasePlate);

  // 4 Black M3 Socket-Head Cap Screws on top of Teardrop Plate securing down through the 4 Risers
  const riserCapGeom = new THREE.CylinderGeometry(0.0028, 0.0028, 0.0022, 16);
  const riserSocketGeom = new THREE.CylinderGeometry(0.0015, 0.0015, 0.0012, 6);
  lidarRiserPositions.forEach(([rx, _, rz]) => {
    const cap = new THREE.Mesh(riserCapGeom, blackPlasticMat);
    cap.position.set(rx, 0.0268, rz);
    rplidarGroup.add(cap);

    const sock = new THREE.Mesh(riserSocketGeom, chromeMat);
    sock.position.set(rx, 0.0275, rz);
    rplidarGroup.add(sock);
  });

  // 2 Countersunk Chrome Screws on the Lobe securing the motor bracket below + 2 Perimeter Hex Screws (image (3), image (4))
  const lobeScrewGeom = new THREE.CylinderGeometry(0.0018, 0.0018, 0.0016, 6);
  [
    [lobeX - 0.007, lobeZ + 0.008],
    [lobeX - 0.007, lobeZ - 0.008],
    [lobeX - 0.022, lobeZ + 0.028],
    [lobeX - 0.022, lobeZ - 0.028],
  ].forEach(([sx, sz]) => {
    const scr = new THREE.Mesh(lobeScrewGeom, chromeMat);
    scr.position.set(sx, 0.0262, sz);
    registerMesh('rplidarGroup', scr);
    rplidarGroup.add(scr);
  });

  // ====================================================
  // Silver DC Drive Motor suspended in the open air gap under the lobe (image.png red circle & image (2))
  // ====================================================
  const motorHangerGroup = new THREE.Group();
  motorHangerGroup.position.set(lobeX, 0.0135, lobeZ);

  // Cylindrical Brushed Silver Metal Motor Casing (hanging freely in air gap)
  const dcMotorGeom = new THREE.CylinderGeometry(0.0125, 0.0125, 0.0185, 24);
  const dcMotorMat = new THREE.MeshStandardMaterial({
    color: 0xd8dee9,
    metalness: 0.94,
    roughness: 0.18,
  });
  const dcMotorMesh = new THREE.Mesh(dcMotorGeom, dcMotorMat);
  registerMesh('lidarBeltGroup', dcMotorMesh);
  motorHangerGroup.add(dcMotorMesh);

  // Chamfered bottom aluminum crimp ring & black brush endcap
  const motorEndCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0118, 0.0110, 0.0028, 24),
    blackPlasticMat
  );
  motorEndCap.position.y = -0.0095;
  motorHangerGroup.add(motorEndCap);

  // Stamped Steel Saddle Mounting Clamp Bracket around motor top
  const motorClampGeom = new THREE.CylinderGeometry(0.0134, 0.0134, 0.004, 24, 1, true, 0, Math.PI * 1.6);
  const motorClamp = new THREE.Mesh(motorClampGeom, chromeMat);
  motorClamp.position.y = 0.007;
  motorHangerGroup.add(motorClamp);

  // 2 Side Mounting Flange Tabs on clamp
  const clampTabGeom = new THREE.BoxGeometry(0.004, 0.0015, 0.006);
  const clampTabL = new THREE.Mesh(clampTabGeom, chromeMat);
  clampTabL.position.set(-0.013, 0.009, 0);
  motorHangerGroup.add(clampTabL);
  const clampTabR = new THREE.Mesh(clampTabGeom, chromeMat);
  clampTabR.position.set(0.013, 0.009, 0);
  motorHangerGroup.add(clampTabR);

  // Stamped Motor Ventilation Slots (4 dark relief slots around cylindrical can)
  const ventSlotGeom = new THREE.BoxGeometry(0.001, 0.008, 0.004);
  const ventSlotMat = new THREE.MeshBasicMaterial({ color: 0x111318 });
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((vAngle) => {
    const vSlot = new THREE.Mesh(ventSlotGeom, ventSlotMat);
    vSlot.position.set(Math.cos(vAngle) * 0.0126, 0.001, Math.sin(vAngle) * 0.0126);
    vSlot.rotation.y = -vAngle;
    motorHangerGroup.add(vSlot);
  });

  // Top Bearing Boss on Motor with bronze bushing
  const topMotorBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 16),
    brassMat
  );
  topMotorBoss.position.y = 0.010;
  motorHangerGroup.add(topMotorBoss);

  // Motor Steel Output Shaft extending upward through teardrop plate into pulley
  const motorShaftGeom = new THREE.CylinderGeometry(0.0012, 0.0012, 0.018, 12);
  const motorShaft = new THREE.Mesh(motorShaftGeom, chromeMat);
  motorShaft.position.y = 0.015;
  motorHangerGroup.add(motorShaft);

  // Bottom Bearing Boss on Motor + protruding white/grey nylon thrust cap (clearly seen in side Photo 3!)
  const motorBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0042, 0.0042, 0.0025, 16),
    chromeMat
  );
  motorBoss.position.y = -0.0105;
  motorHangerGroup.add(motorBoss);

  const motorThrustCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0032, 0.0026, 0.0034, 14),
    wireWhiteMat
  );
  motorThrustCap.position.y = -0.0128;
  motorHangerGroup.add(motorThrustCap);

  // 2 Solder Terminal Lugs on motor bottom base
  const termLugGeom = new THREE.BoxGeometry(0.0022, 0.0035, 0.001);
  const termLug1 = new THREE.Mesh(termLugGeom, brassMat);
  termLug1.position.set(-0.006, -0.011, 0.003);
  motorHangerGroup.add(termLug1);
  const termLug2 = new THREE.Mesh(termLugGeom, brassMat);
  termLug2.position.set(0.006, -0.011, 0.003);
  motorHangerGroup.add(termLug2);

  // Red & Black Motor Lead Wires exiting motor base with black heatshrink boots
  const bootRed = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.004, 8), blackPlasticMat);
  bootRed.position.set(-0.006, -0.0125, 0.003);
  motorHangerGroup.add(bootRed);
  const bootBlk = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.004, 8), blackPlasticMat);
  bootBlk.position.set(0.006, -0.0125, 0.003);
  motorHangerGroup.add(bootBlk);

  // Flexible curved motor wires routing cleanly into white 2-pin JST socket on RPLIDAR PCB (image (2))
  const motorWireCurveRed = new THREE.CatmullRomCurve3([
    new THREE.Vector3(lobeX - 0.006, 0.0005, lobeZ + 0.003),
    new THREE.Vector3(lobeX - 0.014, 0.0025, lobeZ + 0.005),
    new THREE.Vector3(0.022, 0.0085, 0.005),
    new THREE.Vector3(0.014, 0.0155, -0.002),
  ]);
  const motorWireRed = new THREE.Mesh(new THREE.TubeGeometry(motorWireCurveRed, 14, 0.00085, 6, false), wireRedMat);
  rplidarGroup.add(motorWireRed);

  const motorWireCurveBlk = new THREE.CatmullRomCurve3([
    new THREE.Vector3(lobeX + 0.006, 0.0005, lobeZ + 0.003),
    new THREE.Vector3(lobeX - 0.008, 0.0015, lobeZ + 0.008),
    new THREE.Vector3(0.020, 0.0075, 0.008),
    new THREE.Vector3(0.012, 0.0155, 0.001),
  ]);
  const motorWireBlk = new THREE.Mesh(new THREE.TubeGeometry(motorWireCurveBlk, 14, 0.00085, 6, false), wireBlackMat);
  rplidarGroup.add(motorWireBlk);

  rplidarGroup.add(motorHangerGroup);

  // ====================================================
  // Green FR4 RPLIDAR Controller PCB & Underside Optical Drum (Clearly visible in image (2) & image.png)
  // ====================================================
  const lidarPcbGeom = new THREE.CylinderGeometry(0.043, 0.043, 0.0016, 32);
  const lidarPcbMat = new THREE.MeshStandardMaterial({
    color: 0x15803d, // vibrant FR4 green solder mask
    metalness: 0.35,
    roughness: 0.45,
  });
  const lidarPcb = new THREE.Mesh(lidarPcbGeom, lidarPcbMat);
  lidarPcb.position.set(0, 0.018, 0);
  registerMesh('rplidarGroup', lidarPcb);
  rplidarGroup.add(lidarPcb);

  // Central black plastic optical slip-ring / rotary encoder drum housing under the green PCB (image (2))
  const slipRingDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.016, 0.0065, 24),
    blackPlasticMat
  );
  slipRingDrum.position.set(0, 0.0145, 0);
  registerMesh('rplidarGroup', slipRingDrum);
  rplidarGroup.add(slipRingDrum);

  // White 2-pin JST motor power socket mounted under green PCB (image (2))
  const motorJstSocket = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.0042, 0.005), wireWhiteMat);
  motorJstSocket.position.set(0.014, 0.0155, -0.001);
  rplidarGroup.add(motorJstSocket);

  // White edge SMD connectors & silver pads on green PCB underside
  const smdWhiteConn = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.003, 0.004), wireWhiteMat);
  smdWhiteConn.position.set(0.025, 0.016, -0.014);
  rplidarGroup.add(smdWhiteConn);

  // RPLIDAR Controller IC Chip (SOIC-16) on green PCB
  const lidarIc = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0018, 0.006), blackPlasticMat);
  lidarIc.position.set(0.012, 0.0195, 0.006);
  rplidarGroup.add(lidarIc);

  // 16 Silver Gull-Wing Lead Pins on IC
  for (let p = -3.5; p <= 3.5; p++) {
    const pinL = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0004, 0.0004), chromeMat);
    pinL.position.set(0.0075, 0.019, 0.006 + p * 0.0007);
    rplidarGroup.add(pinL);
    const pinR = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0004, 0.0004), chromeMat);
    pinR.position.set(0.0165, 0.019, 0.006 + p * 0.0007);
    rplidarGroup.add(pinR);
  }

  // 16MHz Quartz Crystal Resonator (Silver rectangular metal can)
  const lidarCrystal = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.0022, 0.0032), chromeMat);
  lidarCrystal.position.set(0.022, 0.0195, 0.006);
  rplidarGroup.add(lidarCrystal);

  // Optocoupler Zero-Index Slotted Sensor (Black U-sensor)
  const optoSensor = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.004), blackPlasticMat);
  optoSensor.position.set(-0.024, 0.0205, 0.010);
  rplidarGroup.add(optoSensor);

  // White JST-XH 5-Pin Connector Plug under RPLIDAR PCB + 5 colored micro-wires (image (2), image (5), image.png)
  const lidarPlugGeom = new THREE.BoxGeometry(0.009, 0.0048, 0.0065);
  const lidarPlug = new THREE.Mesh(lidarPlugGeom, wireWhiteMat);
  lidarPlug.position.set(-0.024, 0.0145, 0.004);
  rplidarGroup.add(lidarPlug);

  const lidarLeadColors = [wireRedMat, wireBlackMat, wireYellowMat, chassisGreenMat, wireBlueMat];
  lidarLeadColors.forEach((mat, idx) => {
    const zOff = (idx - 2) * 0.0012;
    const microWireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.028, 0.014, 0.004 + zOff),
      new THREE.Vector3(-0.036, 0.011, 0.010 + zOff * 0.7),
      new THREE.Vector3(-0.044, 0.009, 0.018),
    ]);
    const microWire = new THREE.Mesh(new THREE.TubeGeometry(microWireCurve, 8, 0.0005, 6, false), mat);
    rplidarGroup.add(microWire);
  });

  // Black heat-shrink strain relief collar joining the 5 micro-wires into the main black UART/USB cable
  const bootGeom = new THREE.CylinderGeometry(0.0024, 0.0028, 0.007, 10);
  bootGeom.rotateX(Math.PI / 2);
  bootGeom.rotateY(-0.6);
  const boot = new THREE.Mesh(bootGeom, blackPlasticMat);
  boot.position.set(-0.046, 0.0085, 0.021);
  rplidarGroup.add(boot);

  // Thick matte-black RPLIDAR USB data cable looping cleanly out past top plate edge & plugged into Jetson USB port (image (1), image (2), image.png)
  const lidarHarnessPoints = [
    new THREE.Vector3(-0.048, 0.008, 0.024),
    new THREE.Vector3(-0.068, 0.006, 0.034),
    new THREE.Vector3(-0.082, -0.008, 0.026),
    new THREE.Vector3(-0.078, -0.032, 0.002),
    new THREE.Vector3(-0.054, -0.046, -0.042),
    new THREE.Vector3(-0.012, -0.048, -0.070),
    new THREE.Vector3(-0.005, -0.048, -0.066),
  ];
  const lidarUsbCable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lidarHarnessPoints), 30, 0.0021, 10, false),
    wireBlackMat
  );
  rplidarGroup.add(lidarUsbCable);

  // Molded matte-black USB-A connector plug & strain relief seated into Jetson USB 3.0 stack
  const lidarUsbPlug = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.0065, 0.016), blackPlasticMat);
  lidarUsbPlug.position.set(-0.005, -0.048, -0.068);
  rplidarGroup.add(lidarUsbPlug);

  // Signature Front-Side White 5-Pin JST-XH UART Breakout Pigtail suspended beside CSI ribbon arch (Photos 1, 2, 4, 6, 7)
  const frontJstCable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.022, 0.014, 0.022),
        new THREE.Vector3(-0.024, 0.004, 0.062),
        new THREE.Vector3(-0.028, -0.010, 0.096),
        new THREE.Vector3(-0.029, -0.016, 0.114),
      ]),
      18,
      0.0017,
      8,
      false
    ),
    wireBlackMat
  );
  rplidarGroup.add(frontJstCable);

  const frontJstSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0021, 0.0021, 0.007, 10),
    blackPlasticMat
  );
  frontJstSleeve.rotation.set(Math.PI / 2 - 0.3, 0, 0);
  frontJstSleeve.position.set(-0.029, -0.016, 0.114);
  rplidarGroup.add(frontJstSleeve);

  const frontJstColors = [wireRedMat, wireBlackMat, wireYellowMat, chassisGreenMat, wireBlueMat];
  frontJstColors.forEach((mat, idx) => {
    const xOff = (idx - 2) * 0.0013;
    const fWire = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.029, -0.016, 0.114),
          new THREE.Vector3(-0.030 + xOff * 0.8, -0.013, 0.123),
          new THREE.Vector3(-0.031 + xOff, -0.008, 0.129),
        ]),
        8,
        0.0005,
        6,
        false
      ),
      mat
    );
    rplidarGroup.add(fWire);
  });

  const frontJstGroup = new THREE.Group();
  frontJstGroup.position.set(-0.031, -0.006, 0.131);
  frontJstGroup.rotation.set(-0.35, -0.20, 0.12);

  const frontJstPlug = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.0046, 0.0058), wireWhiteMat);
  frontJstGroup.add(frontJstPlug);

  // Tiny silver contact windows + dark pin cavities inside front JST-XH plug housing
  for (let p = -2; p <= 2; p++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 0.0014, 0.0012), chromeMat);
    slot.position.set(p * 0.0017, 0.0016, 0.0015);
    frontJstGroup.add(slot);

    const cav = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0015, 0.001), blackPlasticMat);
    cav.position.set(p * 0.0017, 0, 0.0028);
    frontJstGroup.add(cav);
  }
  rplidarGroup.add(frontJstGroup);

  // ====================================================
  // Motor Drive Pulley on top of lobe (image (1) & image (3)) - Rotates dynamically!
  // ====================================================
  const drivePulleyGroup = new THREE.Group();
  drivePulleyGroup.name = 'rplidar-drive-pulley';
  drivePulleyGroup.position.set(lobeX, 0.033, lobeZ);

  // Stepped Drive Pulley core groove
  const pulleyCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0066, 0.0066, 0.0065, 24),
    blackPlasticMat
  );
  drivePulleyGroup.add(pulleyCore);

  // Open recessed dish upper rim (replaces flat top disc so it looks like image (1) & image (3))
  const topFlangeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0074, 0.0012, 10, 24),
    blackPlasticMat
  );
  topFlangeRing.rotateX(Math.PI / 2);
  topFlangeRing.position.y = 0.0036;
  drivePulleyGroup.add(topFlangeRing);

  const btmFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0084, 0.0084, 0.0014, 24),
    blackPlasticMat
  );
  btmFlange.position.y = -0.0036;
  drivePulleyGroup.add(btmFlange);

  // Center Shaft Pin & Brass Hub Collar inside pulley dish (image (1) & image (3))
  const pulleyHubCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0035, 16), blackPlasticMat);
  pulleyHubCollar.position.set(0, 0.003, 0);
  drivePulleyGroup.add(pulleyHubCollar);

  const pScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.0045, 12), chromeMat);
  pScrew.position.set(0, 0.004, 0);
  drivePulleyGroup.add(pScrew);

  // Timing mark notch on pulley rim for visual spin clarity
  const pNotch = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.002, 0.0015), chromeMat);
  pNotch.position.set(0.0074, 0.0038, 0);
  drivePulleyGroup.add(pNotch);

  registerMesh('lidarBeltGroup', pulleyCore);
  rplidarGroup.add(drivePulleyGroup);

  // True External-Tangent Black Rubber Timing Belt (wraps snugly around outer edges of main collar & drive pulley!)
  const collarRadius = 0.0425;
  const pulleyBeltR = 0.0074;
  const distCenterToPulley = Math.hypot(lobeX, lobeZ);
  const centerAngle = Math.atan2(lobeZ, lobeX);
  const tangentOffset = Math.acos((collarRadius - pulleyBeltR) / distCenterToPulley);

  const beltSamplePts: THREE.Vector3[] = [];
  // Arc around main rotating turret collar (from upper tangent around the back/front to lower tangent)
  const arcSteps = 22;
  const startA = centerAngle + tangentOffset;
  const endA = centerAngle - tangentOffset + Math.PI * 2;
  for (let i = 0; i <= arcSteps; i++) {
    const a = startA + ((endA - startA) * i) / arcSteps;
    beltSamplePts.push(new THREE.Vector3(Math.cos(a) * collarRadius, 0.033, Math.sin(a) * collarRadius));
  }
  // Arc around outer nose of small drive pulley
  const pArcSteps = 8;
  const pStartA = centerAngle - tangentOffset;
  const pEndA = centerAngle + tangentOffset;
  for (let i = 0; i <= pArcSteps; i++) {
    const a = pStartA + ((pEndA - pStartA) * i) / pArcSteps;
    beltSamplePts.push(
      new THREE.Vector3(lobeX + Math.cos(a) * pulleyBeltR, 0.033, lobeZ + Math.sin(a) * pulleyBeltR)
    );
  }

  const beltCurve = new THREE.CatmullRomCurve3(beltSamplePts, true);
  const beltGeom = new THREE.TubeGeometry(beltCurve, 56, 0.0018, 8, true);
  const beltMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.92,
    metalness: 0.12,
  });
  const beltMesh = new THREE.Mesh(beltGeom, beltMat);
  registerMesh('lidarBeltGroup', beltMesh);
  rplidarGroup.add(beltMesh);

  // Rotating RPLIDAR Turret (Upper drum assembly)
  const rplidarTurret = new THREE.Group();
  rplidarTurret.name = 'rplidar-turret';
  rplidarTurret.position.set(0, 0.026, 0);

  // Lower Belt Groove Collar
  const collarGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.008, 36);
  const collarMesh = new THREE.Mesh(collarGeom, blackPlasticMat);
  collarMesh.position.set(0, 0.007, 0);
  registerMesh('rplidarGroup', collarMesh);
  rplidarTurret.add(collarMesh);

  // Main Rotating Cylindrical Drum (Photo 2)
  const turretGeom = new THREE.CylinderGeometry(0.0445, 0.0455, 0.028, 36);
  const turretMesh = new THREE.Mesh(turretGeom, blackPlasticMat);
  turretMesh.position.set(0, 0.022, 0);
  registerMesh('rplidarGroup', turretMesh);
  rplidarTurret.add(turretMesh);

  // Dual Optical Windows on Turret (Laser Emitter & Optical Sensor Receiver lenses)
  // Matching side profile in Photo 2:
  // 1. Receiver Window: Wide pill-shaped stadium aperture
  const rxFrameGeom = new THREE.BoxGeometry(0.022, 0.013, 0.006);
  const rxFrame = new THREE.Mesh(rxFrameGeom, blackPlasticMat);
  rxFrame.position.set(0.015, 0.021, 0.043);
  rplidarTurret.add(rxFrame);

  // Optical sensor collector lens inside receiver window
  const rxGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.1,
    metalness: 0.2,
    transmission: 0.6,
    transparent: true,
    opacity: 0.9,
  });
  const rxLens = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 16), rxGlassMat);
  rxLens.rotateX(Math.PI / 2);
  rxLens.position.set(0.015, 0.021, 0.044);
  registerMesh('rplidarGroup', rxLens);
  rplidarTurret.add(rxLens);

  // 2. Transmitter Window: Red Laser Diode Lens (Photo 2)
  const txFrameGeom = new THREE.BoxGeometry(0.013, 0.013, 0.006);
  const txFrame = new THREE.Mesh(txFrameGeom, blackPlasticMat);
  txFrame.position.set(-0.015, 0.021, 0.043);
  rplidarTurret.add(txFrame);

  const laserLensMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xff0000,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const txLens = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 16), laserLensMat);
  txLens.rotateX(Math.PI / 2);
  txLens.position.set(-0.015, 0.021, 0.044);
  registerMesh('rplidarGroup', txLens);
  rplidarTurret.add(txLens);

  // Top Cap with authentic RPLIDAR logo & 3 physical 3D recessed screw wells (image (1), image (3), image (4))
  const lidarCapMat = new THREE.MeshStandardMaterial({
    map: createLidarLogoTexture(),
    roughness: 0.40,
    metalness: 0.25,
  });
  const capGeom = new THREE.CylinderGeometry(0.044, 0.0445, 0.0035, 36);
  const capMesh = new THREE.Mesh(capGeom, lidarCapMat);
  capMesh.position.set(0, 0.035, 0);
  registerMesh('rplidarGroup', capMesh);
  rplidarTurret.add(capMesh);

  // Raised molded ring bezel around central "RPLIDAR" medallion + 3 recessed screw wells at 120 deg
  const centerMedallionRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0215, 0.0008, 8, 32),
    blackPlasticMat
  );
  centerMedallionRing.rotateX(Math.PI / 2);
  centerMedallionRing.position.set(0, 0.0369, 0);
  rplidarTurret.add(centerMedallionRing);

  for (let w = 0; w < 3; w++) {
    const wAng = (w * Math.PI * 2) / 3;
    const wx = Math.sin(wAng) * 0.030;
    const wz = -Math.cos(wAng) * 0.030;
    const wellRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.0036, 0.0006, 8, 16),
      blackPlasticMat
    );
    wellRim.rotateX(Math.PI / 2);
    wellRim.position.set(wx, 0.0368, wz);
    rplidarTurret.add(wellRim);

    const wellScrew = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, 0.001, 10),
      chromeMat
    );
    wellScrew.position.set(wx, 0.0366, wz);
    rplidarTurret.add(wellScrew);
  }

  rplidarGroup.add(rplidarTurret);

  // Laser beam & scan fan sector
  const laserBeamGeom = new THREE.BufferGeometry();
  const laserPoints = new Float32Array([0, 0.035, 0, 0, 0.035, 2.5]);
  laserBeamGeom.setAttribute('position', new THREE.BufferAttribute(laserPoints, 3));
  const laserLineMat = new THREE.LineBasicMaterial({
    color: 0xff1e1e,
    linewidth: 2,
    transparent: true,
    opacity: 0.85,
  });
  const laserBeam = new THREE.LineSegments(laserBeamGeom, laserLineMat);
  rplidarTurret.add(laserBeam);

  const fanGeom = new THREE.CircleGeometry(1.6, 24, 0, Math.PI / 4);
  fanGeom.rotateX(-Math.PI / 2);
  const fanMat = new THREE.MeshBasicMaterial({
    color: 0xff3b30,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const scanFan = new THREE.Mesh(fanGeom, fanMat);
  scanFan.position.set(0, 0.035, 0);
  rplidarTurret.add(scanFan);

  // ----------------------------------------------------
  // 4. CAMERA CSI GROUP (Accurately modeled from close-up photo image_46099c5c.png)
  // ----------------------------------------------------
  const cameraCsiGroup = new THREE.Group();
  cameraCsiGroup.name = 'camera-csi';
  cameraCsiGroup.position.set(0, 0.0235, 0.155);

  // Green Sheet-Metal Angled Bracket (bent aluminum with front mounting foot)
  const bracketBaseGeom = new THREE.BoxGeometry(0.046, 0.003, 0.024);
  const bracketBase = new THREE.Mesh(bracketBaseGeom, chassisGreenMat);
  bracketBase.position.set(0, 0.0015, 0);
  registerMesh('cameraCsiGroup', bracketBase);
  cameraCsiGroup.add(bracketBase);

  // 2 Mounting screws with silver flat washers on bracket base (exact match to image_46099c5c.png)
  [-0.018, 0.018].forEach((bx) => {
    const bScrew = new THREE.Mesh(screwGeom, chromeMat);
    bScrew.position.set(bx, 0.0038, 0);
    cameraCsiGroup.add(bScrew);

    const bWasher = new THREE.Mesh(washerGeom, chromeMat);
    bWasher.position.set(bx, 0.0032, 0);
    cameraCsiGroup.add(bWasher);
  });

  // Upright angled green arm with side triangular gussets (image_46099c5c.png)
  const armGeom = new THREE.BoxGeometry(0.034, 0.056, 0.003);
  const armMesh = new THREE.Mesh(armGeom, chassisGreenMat);
  armMesh.position.set(0, 0.028, -0.004);
  armMesh.rotation.x = -0.18;
  registerMesh('cameraCsiGroup', armMesh);
  cameraCsiGroup.add(armMesh);

  // Center rectangular lightening pocket on arm
  const armPocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.028, 0.001),
    new THREE.MeshStandardMaterial({ color: 0x14532d, metalness: 0.8, roughness: 0.3 })
  );
  armPocket.position.set(0, 0.028, -0.0023);
  armPocket.rotation.x = -0.18;
  cameraCsiGroup.add(armPocket);

  // Tapered Sheet-Metal Side Gusset Wings (sloped diagonal stiffening flanges matching Photo 1 & Photo 3)
  const gussetShape = new THREE.Shape();
  gussetShape.moveTo(-0.011, 0.002);
  gussetShape.lineTo(0.010, 0.002);
  gussetShape.lineTo(0.002, 0.046);
  gussetShape.lineTo(-0.007, 0.046);
  gussetShape.closePath();

  const gussetGeom = new THREE.ExtrudeGeometry(gussetShape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.0003,
    bevelThickness: 0.0003,
  });
  gussetGeom.rotateY(Math.PI / 2);

  const leftGusset = new THREE.Mesh(gussetGeom, chassisGreenMat);
  leftGusset.position.set(-0.0185, 0, -0.002);
  registerMesh('cameraCsiGroup', leftGusset);
  cameraCsiGroup.add(leftGusset);
  const rightGusset = new THREE.Mesh(gussetGeom, chassisGreenMat);
  rightGusset.position.set(0.0158, 0, -0.002);
  registerMesh('cameraCsiGroup', rightGusset);
  cameraCsiGroup.add(rightGusset);

  // Top U-yoke fork pivot ears (left and right mounting uprights)
  const forkEarGeom = new THREE.BoxGeometry(0.0032, 0.018, 0.016);
  const leftEar = new THREE.Mesh(forkEarGeom, chassisGreenMat);
  leftEar.position.set(-0.018, 0.054, -0.002);
  cameraCsiGroup.add(leftEar);
  const rightEar = new THREE.Mesh(forkEarGeom, chassisGreenMat);
  rightEar.position.set(0.018, 0.054, -0.002);
  cameraCsiGroup.add(rightEar);

  // Pivot bearing bosses on fork ears
  const pivotBossGeom = new THREE.CylinderGeometry(0.0055, 0.0055, 0.0015, 16);
  pivotBossGeom.rotateZ(Math.PI / 2);
  const leftBoss = new THREE.Mesh(pivotBossGeom, chassisGreenMat);
  leftBoss.position.set(-0.0196, 0.054, -0.002);
  cameraCsiGroup.add(leftBoss);
  const rightBoss = new THREE.Mesh(pivotBossGeom, chassisGreenMat);
  rightBoss.position.set(0.0196, 0.054, -0.002);
  cameraCsiGroup.add(rightBoss);

  // Camera Tilt Fork Head (with 2 knurled thumbscrews on the sides - image_46099c5c.png)
  const camHead = new THREE.Group();
  camHead.position.set(0, 0.054, -0.002);
  camHead.rotation.x = -0.14;

  // Two knurled champagne-nickel thumbscrews with flange washer (Photo 1)
  const thumbMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc2, metalness: 0.92, roughness: 0.22 });
  const thumbHeadGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.0038, 20);
  thumbHeadGeom.rotateZ(Math.PI / 2);
  const thumbCollarGeom = new THREE.CylinderGeometry(0.0068, 0.0068, 0.0014, 20);
  thumbCollarGeom.rotateZ(Math.PI / 2);

  [-1, 1].forEach((dir) => {
    const thumbHead = new THREE.Mesh(thumbHeadGeom, thumbMat);
    thumbHead.position.set(dir * 0.0215, 0, 0);
    registerMesh('cameraCsiGroup', thumbHead);
    camHead.add(thumbHead);

    const thumbCollar = new THREE.Mesh(thumbCollarGeom, thumbMat);
    thumbCollar.position.set(dir * 0.0192, 0, 0);
    registerMesh('cameraCsiGroup', thumbCollar);
    camHead.add(thumbCollar);

    const crossSlot1 = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0055, 0.0008), blackPlasticMat);
    crossSlot1.position.set(dir * 0.0235, 0, 0);
    camHead.add(crossSlot1);
    const crossSlot2 = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0008, 0.0055), blackPlasticMat);
    crossSlot2.position.set(dir * 0.0235, 0, 0);
    camHead.add(crossSlot2);
  });

  // Sony IMX219-160 Camera PCB (High-res procedural silkscreen & gold pad texture)
  const camPcbGeom = new THREE.BoxGeometry(0.026, 0.026, 0.002);
  const camPcb = new THREE.Mesh(camPcbGeom, cameraPcbMat);
  registerMesh('cameraCsiGroup', camPcb);
  camHead.add(camPcb);

  // 4 Corner M2 black oxide Phillips screws with hex spacers (matching dark corner screws in Photo 1)
  const camScrewGeom = new THREE.CylinderGeometry(0.0012, 0.0012, 0.0032, 8);
  camScrewGeom.rotateX(Math.PI / 2);
  const camNutGeom = new THREE.CylinderGeometry(0.0018, 0.0018, 0.0012, 6);
  camNutGeom.rotateX(Math.PI / 2);

  [
    [-0.0105, 0.0105],
    [0.0105, 0.0105],
    [-0.0105, -0.0105],
    [0.0105, -0.0105],
  ].forEach(([csx, csy]) => {
    const cs = new THREE.Mesh(camScrewGeom, blackPlasticMat);
    cs.position.set(csx, csy, 0.0015);
    camHead.add(cs);

    const cn = new THREE.Mesh(camNutGeom, chromeMat);
    cn.position.set(csx, csy, 0.0008);
    camHead.add(cn);
  });

  // ----------------------------------------------------
  // Square Lens Mounting Base Pedestal with 2 Side Ears & 2 Fastening Screws
  // (Identical to physical module shown in image_46099c5c.png)
  // ----------------------------------------------------
  const lensBaseGeom = new THREE.BoxGeometry(0.0145, 0.0145, 0.0034);
  const lensBaseMesh = new THREE.Mesh(lensBaseGeom, blackPlasticMat);
  lensBaseMesh.position.set(0, 0, 0.0026);
  registerMesh('cameraCsiGroup', lensBaseMesh);
  camHead.add(lensBaseMesh);

  // 2 Side Mounting Ears on lens base (left & right tabs)
  const lensEarGeom = new THREE.BoxGeometry(0.0042, 0.0036, 0.0026);
  const leftEarTab = new THREE.Mesh(lensEarGeom, blackPlasticMat);
  leftEarTab.position.set(-0.0085, 0, 0.0024);
  camHead.add(leftEarTab);
  const rightEarTab = new THREE.Mesh(lensEarGeom, blackPlasticMat);
  rightEarTab.position.set(0.0085, 0, 0.0024);
  camHead.add(rightEarTab);

  // 2 Tiny Silver Phillips Screws fastening lens mount to camera PCB (prominent in image_46099c5c.png)
  const lensScrGeom = new THREE.CylinderGeometry(0.00095, 0.00095, 0.0018, 8);
  lensScrGeom.rotateX(Math.PI / 2);
  const lensScrL = new THREE.Mesh(lensScrGeom, chromeMat);
  lensScrL.position.set(-0.0085, 0, 0.0038);
  camHead.add(lensScrL);
  const lensScrR = new THREE.Mesh(lensScrGeom, chromeMat);
  lensScrR.position.set(0.0085, 0, 0.0038);
  camHead.add(lensScrR);

  // ----------------------------------------------------
  // Stepped Conical Wide-Angle 160° Fisheye Lens Barrel (image_46099c5c.png)
  // ----------------------------------------------------
  // 1. Threaded Focus Ring Collar
  const focusRingGeom = new THREE.CylinderGeometry(0.0064, 0.0064, 0.0042, 24);
  focusRingGeom.rotateX(Math.PI / 2);
  const focusRing = new THREE.Mesh(focusRingGeom, blackPlasticMat);
  focusRing.position.set(0, 0, 0.006);
  registerMesh('cameraCsiGroup', focusRing);
  camHead.add(focusRing);

  // Knurled focus ribbed lines
  for (let r = 0; r < 8; r++) {
    const angle = (r * Math.PI * 2) / 8;
    const ribMesh = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0006, 0.004), chromeMat);
    ribMesh.position.set(Math.cos(angle) * 0.0064, Math.sin(angle) * 0.0064, 0.006);
    camHead.add(ribMesh);
  }

  // 2. Conical Flared Outer Lens Hood / Barrel (widening towards front lip)
  const coneHoodGeom = new THREE.CylinderGeometry(0.0098, 0.0068, 0.0075, 32);
  coneHoodGeom.rotateX(Math.PI / 2);
  const coneHood = new THREE.Mesh(coneHoodGeom, blackPlasticMat);
  coneHood.position.set(0, 0, 0.0112);
  registerMesh('cameraCsiGroup', coneHood);
  camHead.add(coneHood);

  // 3. Front Lens Bezel Lip Ring
  const bezelRingGeom = new THREE.CylinderGeometry(0.0098, 0.0080, 0.0012, 32);
  bezelRingGeom.rotateX(Math.PI / 2);
  const bezelRing = new THREE.Mesh(bezelRingGeom, chromeMat);
  bezelRing.position.set(0, 0, 0.015);
  camHead.add(bezelRing);

  // 4. Convex Optical Multi-Coated Glass Lens Element
  const lensGlassGeom = new THREE.SphereGeometry(0.0072, 24, 24);
  const lensGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7, // deep cyan-blue anti-reflective tint
    roughness: 0.04,
    metalness: 0.15,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: 0.9,
  });
  const lensGlass = new THREE.Mesh(lensGlassGeom, lensGlassMat);
  lensGlass.position.set(0, 0, 0.0146);
  lensGlass.scale.set(1, 1, 0.35);
  registerMesh('cameraCsiGroup', lensGlass);
  camHead.add(lensGlass);

  // 5. Central Camera Pupil Aperture
  const pupilGeom = new THREE.CylinderGeometry(0.0026, 0.0026, 0.001, 16);
  pupilGeom.rotateX(Math.PI / 2);
  const pupilMesh = new THREE.Mesh(pupilGeom, new THREE.MeshBasicMaterial({ color: 0x050508 }));
  pupilMesh.position.set(0, 0, 0.0142);
  camHead.add(pupilMesh);

  // ----------------------------------------------------
  // SMD Surface-Mount Electronic Components on Camera PCB
  // ----------------------------------------------------
  // Decoupling capacitors (0603 silver/brown chips)
  const smdCapGeom = new THREE.BoxGeometry(0.0016, 0.0009, 0.0008);
  const camSmdCapMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 });
  const smdCap1 = new THREE.Mesh(smdCapGeom, camSmdCapMat);
  smdCap1.position.set(0.0085, -0.006, 0.0014);
  camHead.add(smdCap1);

  // Tiny Green Camera Power/Activity SMD LED
  const camLedMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 0.75,
  });
  const camLed = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0010, 0.0008), camLedMat);
  camLed.position.set(0.0085, 0.006, 0.0014);
  camHead.add(camLed);

  // ----------------------------------------------------
  // Two-Tone ZIF Connector & Electric Blue Stiffener Tab (Exact match to image_46099c5c.png)
  // ----------------------------------------------------
  // Cream/White connector base housing
  const zifBaseGeom = new THREE.BoxGeometry(0.020, 0.0035, 0.0028);
  const zifBase = new THREE.Mesh(zifBaseGeom, wireWhiteMat);
  zifBase.position.set(0, 0.0142, -0.0012);
  camHead.add(zifBase);

  // Black sliding/flip locking bar latch on front of connector
  const zifLockGeom = new THREE.BoxGeometry(0.0185, 0.0018, 0.0022);
  const zifLock = new THREE.Mesh(zifLockGeom, blackPlasticMat);
  zifLock.position.set(0, 0.0136, 0.0005);
  camHead.add(zifLock);

  // 15 Tiny Gold Pin Contacts inside ZIF interface
  for (let p = -7; p <= 7; p++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.0004, 0.0016, 0.0004), brassMat);
    pin.position.set(p * 0.001, 0.015, -0.0012);
    camHead.add(pin);
  }

  // Bright Electric Blue Stiffener Polyimide Tab on ribbon cable entry (prominent in image_46099c5c.png)
  const blueTabGeom = new THREE.BoxGeometry(0.0165, 0.0055, 0.0009);
  const blueTabMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8, // vivid royal/electric blue
    roughness: 0.35,
    metalness: 0.1,
  });
  const blueTabMesh = new THREE.Mesh(blueTabGeom, blueTabMat);
  blueTabMesh.position.set(0, 0.0175, -0.0012);
  camHead.add(blueTabMesh);

  cameraCsiGroup.add(camHead);

  // CSI Socket on front edge of Jetson carrier board where the ribbon enters
  const boardCsiSocketGeom = new THREE.BoxGeometry(0.020, 0.004, 0.006);
  const boardCsiSocket = new THREE.Mesh(boardCsiSocketGeom, blackPlasticMat);
  boardCsiSocket.position.set(0, 0.0525, -0.079);
  cameraCsiGroup.add(boardCsiSocket);

  // ----------------------------------------------------
  // Dynamic Flexible CSI Ribbon Cable (Exact match to real robot photo image_b262a120.png)
  // Forms a tall arch ("cong trên") from the camera top ZIF socket, swoops backward,
  // and enters the CSI socket on the front of the Jetson board.
  // ----------------------------------------------------
  const CABLE_SEGMENTS = 28;
  const CABLE_WIDTH = 0.016; // 16mm wide flat flexible cable
  const HALF_W = CABLE_WIDTH / 2;

  // Base spline points in cameraCsiGroup local coordinates matching photo image_b262a120.png:
  const baseSplinePoints = [
    new THREE.Vector3(0, 0.068, -0.004),  // P0: firmly inserted into camera top ZIF socket
    new THREE.Vector3(0, 0.098, -0.006),  // P1: rising vertically up into the air
    new THREE.Vector3(0, 0.118, -0.016),  // P2: high crest of arch (matching tall loop in photo)
    new THREE.Vector3(0, 0.112, -0.034),  // P3: curving backward over the top
    new THREE.Vector3(0, 0.090, -0.052),  // P4: swooping down behind camera mount
    new THREE.Vector3(0, 0.070, -0.068),  // P5: descending toward the middle deck
    new THREE.Vector3(0, 0.054, -0.079),  // P6: entering CSI connector on front of Jetson board
  ];

  const baseCurve = new THREE.CatmullRomCurve3(baseSplinePoints, false, 'centripetal');
  const sampledBasePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= CABLE_SEGMENTS; i++) {
    sampledBasePoints.push(baseCurve.getPoint(i / CABLE_SEGMENTS));
  }

  const ribbonGeom = new THREE.BufferGeometry();
  const numVertices = (CABLE_SEGMENTS + 1) * 2;
  const ribbonPositions = new Float32Array(numVertices * 3);
  const ribbonUvs = new Float32Array(numVertices * 2);
  const ribbonIndices: number[] = [];

  for (let i = 0; i <= CABLE_SEGMENTS; i++) {
    const v = i / CABLE_SEGMENTS;
    const vIdx = i * 2;
    // Left edge UV
    ribbonUvs[vIdx * 2] = 0;
    ribbonUvs[vIdx * 2 + 1] = v;
    // Right edge UV
    ribbonUvs[(vIdx + 1) * 2] = 1;
    ribbonUvs[(vIdx + 1) * 2 + 1] = v;

    if (i < CABLE_SEGMENTS) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      ribbonIndices.push(a, b, c);
      ribbonIndices.push(b, d, c);
    }
  }

  ribbonGeom.setAttribute('position', new THREE.BufferAttribute(ribbonPositions, 3));
  ribbonGeom.setAttribute('uv', new THREE.BufferAttribute(ribbonUvs, 2));
  ribbonGeom.setIndex(ribbonIndices);

  // Dynamic state for physics and motor vibration simulation
  let currentInertiaX = 0; // lateral sway when turning (chuyển hướng)
  let currentInertiaY = 0; // vertical bounce
  let currentInertiaZ = 0; // fore/aft inertial flex during acceleration/braking (chạy thẳng)

  const updateRibbonCable = (
    delta: number,
    linearVel: number,
    angularVel: number,
    elapsedTime: number
  ) => {
    // Dynamic spring-damped inertial response
    // When turning (angularVel): cable sways laterally in opposite direction
    const targetInertiaX = -angularVel * 0.0085;
    // When accelerating straight (linearVel): arch flexes backward with aerodynamic drag & inertia
    const targetInertiaZ = -linearVel * 0.0065;
    // Slight vertical compression/bobbing under driving speed
    const targetInertiaY = -Math.abs(linearVel) * 0.0035;

    currentInertiaX = THREE.MathUtils.damp(currentInertiaX, targetInertiaX, 5.5, delta);
    currentInertiaY = THREE.MathUtils.damp(currentInertiaY, targetInertiaY, 6.0, delta);
    currentInertiaZ = THREE.MathUtils.damp(currentInertiaZ, targetInertiaZ, 5.5, delta);

    const speedRatio = Math.min(2.0, Math.hypot(linearVel, angularVel * 0.15) / 0.55);
    const isMoving = Math.abs(linearVel) > 0.01 || Math.abs(angularVel) > 0.01;
    const isTurning = Math.abs(angularVel) > 0.02;

    // Displaced points along flexible curve
    const currentPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= CABLE_SEGMENTS; i++) {
      const u = i / CABLE_SEGMENTS;
      // Clamped endpoints: 0 displacement at ends (fixed to camera ZIF & Jetson CSI connector)
      const flex = Math.sin(u * Math.PI);
      const flexHarmonic = Math.sin(u * Math.PI * 2);

      // Organic sway when turning (lắc lư nhẹ khi chuyển hướng)
      const turningSway = isTurning
        ? Math.sin(elapsedTime * 10 + u * Math.PI) * 0.0028 * Math.min(1.5, Math.abs(angularVel) * 0.6)
        : 0;

      // Natural flutter when running straight (chạy thẳng) from motor vibration & chassis movement
      const drivingFlutterY = isMoving
        ? Math.sin(elapsedTime * 22 + i * 0.75) * 0.0014 * speedRatio
        : Math.sin(elapsedTime * 4 + i * 0.4) * 0.00018;
      const drivingFlutterX = isMoving
        ? Math.cos(elapsedTime * 16 + i * 0.6) * 0.0009 * speedRatio
        : 0;

      const basePt = sampledBasePoints[i];
      const px = basePt.x + (currentInertiaX + turningSway + drivingFlutterX) * flex;
      const py =
        basePt.y +
        (currentInertiaY + drivingFlutterY) * flex +
        Math.sin(elapsedTime * 14 + i) * 0.0004 * flexHarmonic * speedRatio;
      const pz = basePt.z + currentInertiaZ * flex;

      currentPoints.push(new THREE.Vector3(px, py, pz));
    }

    // Extrude vertices across ribbon width along the X axis
    // Because ribbon curves in Y-Z plane, width is consistently in the lateral X direction
    const posArr = ribbonPositions;
    for (let i = 0; i <= CABLE_SEGMENTS; i++) {
      const pt = currentPoints[i];
      const vIdx = i * 2;
      // Left vertex
      posArr[vIdx * 3] = pt.x - HALF_W;
      posArr[vIdx * 3 + 1] = pt.y;
      posArr[vIdx * 3 + 2] = pt.z;
      // Right vertex
      posArr[(vIdx + 1) * 3] = pt.x + HALF_W;
      posArr[(vIdx + 1) * 3 + 1] = pt.y;
      posArr[(vIdx + 1) * 3 + 2] = pt.z;
    }

    ribbonGeom.attributes.position.needsUpdate = true;
    ribbonGeom.computeVertexNormals();
  };

  // Initial geometry calculation
  updateRibbonCable(0.016, 0, 0, 0);

  const ribbonCable = new THREE.Mesh(ribbonGeom, ribbonMat);
  registerMesh('cameraCsiGroup', ribbonCable);
  cameraCsiGroup.add(ribbonCable);

  // ----------------------------------------------------
  // 5. 2x DC GEARED MOTORS & ENCODERS (Underside photo image_bbcc8481.png)
  // ----------------------------------------------------
  const dcMotorsGroup = new THREE.Group();
  dcMotorsGroup.name = 'dc-motors';
  dcMotorsGroup.position.set(0, 0.01, 0);

  function createDetailedMotorAssembly(isLeft: boolean): THREE.Group {
    const motorSub = new THREE.Group();
    const xSign = isLeft ? -1 : 1;

    // 1. Heavy-duty Green Anodized L-Bracket (image_b6cd4567.png & 1794209545157_...jpg)
    // Vertical flange with center hole for motor shaft and face screws
    const bracketVertGeom = new THREE.BoxGeometry(0.0035, 0.034, 0.040);
    const bracketVert = new THREE.Mesh(bracketVertGeom, chassisGreenMat);
    bracketVert.position.set(xSign * 0.088, -0.009, 0);
    registerMesh('dcMotorsGroup', bracketVert);
    motorSub.add(bracketVert);

    // Horizontal mounting foot resting flush against the green chassis plate underside
    const bracketFootGeom = new THREE.BoxGeometry(0.018, 0.0035, 0.040);
    const bracketFoot = new THREE.Mesh(bracketFootGeom, chassisGreenMat);
    bracketFoot.position.set(xSign * 0.078, 0.008, 0);
    registerMesh('dcMotorsGroup', bracketFoot);
    motorSub.add(bracketFoot);

    // 2 M3 silver phillips screws with washers securing the bracket foot to the chassis
    [-0.012, 0.012].forEach((fz) => {
      const fScr = new THREE.Mesh(screwGeom, chromeMat);
      fScr.position.set(xSign * 0.078, 0.011, fz);
      motorSub.add(fScr);
      const fWsh = new THREE.Mesh(washerGeom, chromeMat);
      fWsh.position.set(xSign * 0.078, 0.010, fz);
      motorSub.add(fWsh);
    });

    // 4 Face screws securing motor to the vertical bracket plate
    [-0.012, 0.012].forEach((bz) => {
      const bScr = new THREE.Mesh(screwGeom, chromeMat);
      bScr.rotation.z = Math.PI / 2;
      bScr.position.set(xSign * 0.090, -0.009, bz);
      motorSub.add(bScr);
    });

    // 2. Green Anodized Motor Mount Flange Collar (Prominent green ring between gearbox and bracket in image_e0a05a24.png)
    const collarGeom = new THREE.CylinderGeometry(0.0135, 0.0135, 0.0035, 24);
    collarGeom.rotateZ(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeom, chassisGreenMat);
    collarMesh.position.set(xSign * 0.084, -0.009, 0);
    registerMesh('dcMotorsGroup', collarMesh);
    motorSub.add(collarMesh);

    // 6 miniature face-mount screws around collar perimeter
    for (let s = 0; s < 6; s++) {
      const sAngle = (s * Math.PI * 2) / 6;
      const sMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.0018, 8), chromeMat);
      sMesh.rotation.z = Math.PI / 2;
      sMesh.position.set(
        xSign * 0.085,
        -0.009 + Math.cos(sAngle) * 0.0095,
        Math.sin(sAngle) * 0.0095
      );
      motorSub.add(sMesh);
    }

    // 3. Dual-Stage Stepped Metal Gearmotor (~25mm diameter cylindrical reduction gearbox + DC motor extending near centerline!)
    // Front Reduction Gearbox Housing (Brushed zinc/aluminum)
    const gearboxGeom = new THREE.CylinderGeometry(0.0125, 0.0125, 0.022, 24);
    gearboxGeom.rotateZ(Math.PI / 2);
    const gearboxMesh = new THREE.Mesh(gearboxGeom, motorZincMat);
    gearboxMesh.position.set(xSign * 0.072, -0.009, 0);
    registerMesh('dcMotorsGroup', gearboxMesh);
    motorSub.add(gearboxMesh);

    // Step Transition Seam Ring
    const seamGeom = new THREE.CylinderGeometry(0.0128, 0.0128, 0.0020, 24);
    seamGeom.rotateZ(Math.PI / 2);
    const seamMesh = new THREE.Mesh(seamGeom, motorZincMat);
    seamMesh.position.set(xSign * 0.060, -0.009, 0);
    motorSub.add(seamMesh);

    // Rear Cylindrical DC Motor Can (extended length matching real 370-series motors meeting near middle in image (8))
    const motorCanGeom = new THREE.CylinderGeometry(0.0120, 0.0120, 0.043, 24);
    motorCanGeom.rotateZ(Math.PI / 2);
    const motorCan = new THREE.Mesh(motorCanGeom, motorZincMat);
    motorCan.position.set(xSign * 0.038, -0.009, 0);
    registerMesh('dcMotorsGroup', motorCan);
    motorSub.add(motorCan);

    // Motor Stamped Indentations (ventilation / magnetic alignment notches on sides)
    [-0.0122, 0.0122].forEach((iy) => {
      const indent = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0012, 0.004), blackPlasticMat);
      indent.position.set(xSign * 0.040, -0.009 + iy, 0);
      motorSub.add(indent);
    });

    // Black Molded Plastic Brush Endbell Ring + Copper/Chrome Solder Blobs (prominently visible in image (8) red circle!)
    const endbellGeom = new THREE.CylinderGeometry(0.0121, 0.0121, 0.0042, 24);
    endbellGeom.rotateZ(Math.PI / 2);
    const endbell = new THREE.Mesh(endbellGeom, blackPlasticMat);
    endbell.position.set(xSign * 0.0155, -0.009, 0);
    registerMesh('dcMotorsGroup', endbell);
    motorSub.add(endbell);

    [-0.0075, 0.0075].forEach((sz) => {
      const solderLug = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.0022, 0.0014), goldPadMat);
      solderLug.position.set(xSign * 0.0145, -0.018, sz * 0.65);
      motorSub.add(solderLug);

      const solderBlob = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 10, 8), chromeMat);
      solderBlob.position.set(xSign * 0.0138, -0.0185, sz * 0.65);
      motorSub.add(solderBlob);
    });

    // 4. Magnetic Encoder Module at Motor Tail (meeting within ~8mm in the center just like real photo image (8)!)
    // Black FR4 Encoder PCB Disc
    const encPcbGeom = new THREE.CylinderGeometry(0.0118, 0.0118, 0.0018, 24);
    encPcbGeom.rotateZ(Math.PI / 2);
    const encPcb = new THREE.Mesh(encPcbGeom, encoderPcbMat);
    encPcb.position.set(xSign * 0.0125, -0.009, 0);
    registerMesh('dcMotorsGroup', encPcb);
    motorSub.add(encPcb);

    // Gold Peripheral Test Pads + 6 through-hole chrome pins on Encoder PCB
    for (let p = 0; p < 4; p++) {
      const pAng = (p * Math.PI) / 2 + 0.35;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0016, 0.0016), goldPadMat);
      pad.position.set(
        xSign * 0.0116,
        -0.009 + Math.cos(pAng) * 0.0092,
        Math.sin(pAng) * 0.0092
      );
      motorSub.add(pad);
    }

    // Center Dual-Stepped Black Magnetic Encoder Cap (Left & Right nearly meet in middle ~8mm gap!)
    const turretBaseGeom = new THREE.CylinderGeometry(0.0074, 0.0074, 0.0045, 20);
    turretBaseGeom.rotateZ(Math.PI / 2);
    const turretBase = new THREE.Mesh(turretBaseGeom, blackPlasticMat);
    turretBase.position.set(xSign * 0.009, -0.009, 0);
    motorSub.add(turretBase);

    const turretGeom = new THREE.CylinderGeometry(0.0054, 0.0054, 0.0055, 18);
    turretGeom.rotateZ(Math.PI / 2);
    const turretMesh = new THREE.Mesh(turretGeom, blackPlasticMat);
    turretMesh.position.set(xSign * 0.0062, -0.009, 0);
    registerMesh('dcMotorsGroup', turretMesh);
    motorSub.add(turretMesh);

    // Center axle bore & magnet core
    const magnetMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0062, 12), chromeMat);
    magnetMesh.rotation.z = Math.PI / 2;
    magnetMesh.position.set(xSign * 0.006, -0.009, 0);
    motorSub.add(magnetMesh);

    // Asymmetric JST-6 Socket Orientation matching photo image (8):
    // Left motor plug faces +Z (slot side), Right motor plug faces -Z (back/right loop side)
    const zSide = isLeft ? 1 : -1;

    // Miniature SMD Hall Sensor IC on board
    const hallIc = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.003, 0.004), blackPlasticMat);
    hallIc.position.set(xSign * 0.0112, -0.005, -zSide * 0.005);
    motorSub.add(hallIc);

    // White JST-XH 6-Pin Socket & Plug mounted tangentially on encoder PCB (matching cream socket in image (8))
    const jstMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
    const jstSocketGeom = new THREE.BoxGeometry(0.0052, 0.0065, 0.013);
    const jstSocket = new THREE.Mesh(jstSocketGeom, jstMat);
    jstSocket.position.set(xSign * 0.010, -0.0065, zSide * 0.0092);
    registerMesh('dcMotorsGroup', jstSocket);
    motorSub.add(jstSocket);

    const jstPlugGeom = new THREE.BoxGeometry(0.0048, 0.0060, 0.0122);
    const jstPlug = new THREE.Mesh(jstPlugGeom, wireWhiteMat);
    jstPlug.position.set(xSign * 0.010, -0.0065, zSide * 0.0135);
    motorSub.add(jstPlug);

    // 6 Individual colored micro-wires (red, black, white, yellow, blue, green) exiting JST plug before heat-shrink sleeve
    const wireColors = [wireRedMat, wireBlackMat, wireWhiteMat, wireYellowMat, wireBlueMat, chassisGreenMat];
    wireColors.forEach((mat, idx) => {
      const xOff = (idx - 2.5) * 0.0014;
      const leadCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(xSign * 0.010 + xOff, -0.0065, zSide * 0.019),
        new THREE.Vector3(xSign * 0.011 + xOff * 0.5, -0.006, zSide * 0.023),
        new THREE.Vector3(xSign * 0.012, -0.0055, zSide * 0.027),
      ]);
      const lead = new THREE.Mesh(new THREE.TubeGeometry(leadCurve, 6, 0.00045, 5, false), mat);
      motorSub.add(lead);
    });

    // Black heat-shrink collar bundling the 6 wire roots into the grey jacket (image (8))
    const collarBundle = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0026, 0.0065, 12), blackPlasticMat);
    collarBundle.rotation.x = Math.PI / 2;
    collarBundle.position.set(xSign * 0.012, -0.0055, zSide * 0.0285);
    motorSub.add(collarBundle);

    // 5. Authentic Asymmetric Grey Heat-Shrink Harnesses matching image (8):
    // - Left motor curves smoothly in an S-bend right into the chassis slot (-0.0235, +0.034)
    // - Right motor sweeps out in a rounded U-loop toward the right caster with a black heat-shrink tie, then tucks back into the slot!
    const harnessPoints = isLeft
      ? [
          new THREE.Vector3(-0.012, -0.0055, 0.030),
          new THREE.Vector3(-0.018, -0.004, 0.040),
          new THREE.Vector3(-0.025, 0.001, 0.042),
          new THREE.Vector3(-0.025, 0.008, 0.035),
          new THREE.Vector3(-0.022, 0.024, 0.034),
        ]
      : [
          new THREE.Vector3(0.012, -0.0055, -0.030),
          new THREE.Vector3(0.024, -0.003, -0.046),
          new THREE.Vector3(0.046, 0.000, -0.042),
          new THREE.Vector3(0.056, 0.002, -0.020),
          new THREE.Vector3(0.042, 0.003, 0.004),
          new THREE.Vector3(0.012, 0.003, 0.022),
          new THREE.Vector3(-0.018, 0.008, 0.031),
          new THREE.Vector3(-0.025, 0.024, 0.034),
        ];

    const harnessCurve = new THREE.CatmullRomCurve3(harnessPoints, false, 'centripetal');
    const harnessMesh = new THREE.Mesh(
      new THREE.TubeGeometry(harnessCurve, isLeft ? 20 : 34, 0.0023, 10, false),
      wireGreySleeveMat
    );
    registerMesh('dcMotorsGroup', harnessMesh);
    motorSub.add(harnessMesh);

    // Extra black heat-shrink sleeve collar on the right-hand loop (prominently visible in image (8) right half of red circle)
    if (!isLeft) {
      const loopSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.010, 10), blackPlasticMat);
      loopSleeve.rotation.x = Math.PI / 2;
      loopSleeve.rotation.z = 0.55;
      loopSleeve.position.set(0.052, 0.001, -0.028);
      motorSub.add(loopSleeve);
    }

    // Printed specification ring / 205°C white label band on sleeve
    const labelBandGeom = new THREE.CylinderGeometry(0.0025, 0.0025, 0.0038, 12);
    labelBandGeom.rotateX(0.4);
    const labelBand = new THREE.Mesh(labelBandGeom, wireWhiteMat);
    labelBand.position.set(isLeft ? -0.024 : 0.028, isLeft ? 0.002 : -0.002, isLeft ? 0.039 : -0.045);
    motorSub.add(labelBand);

    // 6. Precision Brass Hex Coupler & D-Shaft (Khớp nối lục giác đồng liên kết mâm bánh xe)
    // Motor Steel D-Shaft exiting gearbox through L-bracket
    const dShaftGeom = new THREE.CylinderGeometry(0.002, 0.002, 0.020, 12);
    dShaftGeom.rotateZ(Math.PI / 2);
    const dShaft = new THREE.Mesh(dShaftGeom, chromeMat);
    dShaft.position.set(xSign * 0.098, -0.009, 0);
    motorSub.add(dShaft);

    // Golden Brass Hexagonal Coupler (6-sided prism spanning between L-bracket and wheel rim)
    const couplerGeom = new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 6);
    couplerGeom.rotateZ(Math.PI / 2);
    const coupler = new THREE.Mesh(couplerGeom, brassMat);
    coupler.position.set(xSign * 0.108, -0.009, 0);
    registerMesh('dcMotorsGroup', coupler);
    motorSub.add(coupler);

    // 2 Black M3 Grub Screws on hex flats
    [-0.005, 0.005].forEach((gx) => {
      const grubScr = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.003, 8), blackPlasticMat);
      grubScr.position.set(xSign * (0.108 + gx), -0.004, 0);
      motorSub.add(grubScr);
    });

    // Central Wheel M4 Flange Retaining Bolt & Spring Washer
    const m4BoltGeom = new THREE.CylinderGeometry(0.0025, 0.0025, 0.0025, 12);
    m4BoltGeom.rotateZ(Math.PI / 2);
    const m4Bolt = new THREE.Mesh(m4BoltGeom, chromeMat);
    m4Bolt.position.set(xSign * 0.122, -0.009, 0);
    motorSub.add(m4Bolt);

    const m4WshGeom = new THREE.CylinderGeometry(0.0038, 0.0038, 0.001, 12);
    m4WshGeom.rotateZ(Math.PI / 2);
    const m4Wsh = new THREE.Mesh(m4WshGeom, chromeMat);
    m4Wsh.position.set(xSign * 0.121, -0.009, 0);
    motorSub.add(m4Wsh);

    return motorSub;
  }

  const leftMotor = createDetailedMotorAssembly(true);
  const rightMotor = createDetailedMotorAssembly(false);
  dcMotorsGroup.add(leftMotor);
  dcMotorsGroup.add(rightMotor);

  // ----------------------------------------------------
  // 6. 2x DRIVE WHEELS GROUP (Accurately modeled from macro photo 1793006044923_...jpg & 3_37e20bc8.jpg)
  // ----------------------------------------------------
  const driveWheelsGroup = new THREE.Group();
  driveWheelsGroup.name = 'drive-wheels';

  function createDetailedDriveWheel(isLeft: boolean): THREE.Group {
    const wheelSub = new THREE.Group();
    const xSign = isLeft ? -1 : 1;

    // 1. Base Tire Carcass Cylinder (floor of valleys and central channel at r = 0.0332)
    const carcassGeom = new THREE.CylinderGeometry(0.0332, 0.0332, 0.026, 48, 1);
    carcassGeom.rotateZ(Math.PI / 2);
    const carcassMesh = new THREE.Mesh(carcassGeom, tireMat);
    registerMesh('driveWheelsGroup', carcassMesh);
    wheelSub.add(carcassMesh);

    // 2. High-Relief 3D Tread Lugs (Exact physical C-hook & L-nest blocks with 2.3mm depth!)
    // Cloned/shared geometry with true physical 3D relief, beveled edges, siping cuts and shoulder cleats
    const treadMesh = new THREE.Mesh(shared3DTreadGeom, tireTreadMat);
    registerMesh('driveWheelsGroup', treadMesh);
    wheelSub.add(treadMesh);

    // Rounded Off-Road Rubber Shoulders (Outer & Inner bead rings matching photo 1793006044923_...jpg)
    const shoulderTorusGeom = new THREE.TorusGeometry(0.0330, 0.0016, 12, 36);
    shoulderTorusGeom.rotateY(Math.PI / 2);
    const outerShoulder = new THREE.Mesh(shoulderTorusGeom, blackPlasticMat);
    outerShoulder.position.set(xSign * 0.0120, 0, 0);
    wheelSub.add(outerShoulder);

    const innerShoulder = new THREE.Mesh(shoulderTorusGeom, blackPlasticMat);
    innerShoulder.position.set(-xSign * 0.0120, 0, 0);
    wheelSub.add(innerShoulder);

    // Sidewall Inner Bead Flange Ring
    const sidewallBeadGeom = new THREE.TorusGeometry(0.0272, 0.0012, 10, 36);
    sidewallBeadGeom.rotateY(Math.PI / 2);
    const outerBead = new THREE.Mesh(sidewallBeadGeom, blackPlasticMat);
    outerBead.position.set(xSign * 0.0125, 0, 0);
    wheelSub.add(outerBead);

    // 24 Sidewall 3D Radial Grip Ribs (macro photo 1793006044923_...jpg)
    const ribGeom = new THREE.BoxGeometry(0.0007, 0.0042, 0.0006);
    for (let r = 0; r < 24; r++) {
      const ribAngle = (r * Math.PI * 2) / 24;
      const ribMesh = new THREE.Mesh(ribGeom, blackPlasticMat);
      ribMesh.position.set(
        xSign * 0.0128,
        Math.cos(ribAngle) * 0.0305,
        Math.sin(ribAngle) * 0.0305
      );
      ribMesh.rotation.x = -ribAngle;
      wheelSub.add(ribMesh);
    }

    // ----------------------------------------------------
    // Metallic Electric Blue Rim (High-gloss anodized finish - photo 1793006044923_...jpg)
    // ----------------------------------------------------
    // Outer Rim Barrel
    const rimGeom = new THREE.CylinderGeometry(0.0252, 0.0252, 0.0255, 36);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeom, blueRimMat);
    registerMesh('driveWheelsGroup', rimMesh);
    wheelSub.add(rimMesh);

    // Stepped Outer Rim Lip (Curved chamfered outer ring)
    const rimLipGeom = new THREE.TorusGeometry(0.0252, 0.0016, 12, 36);
    rimLipGeom.rotateY(Math.PI / 2);
    const rimLip = new THREE.Mesh(rimLipGeom, blueRimMat);
    rimLip.position.set(xSign * 0.0126, 0, 0);
    registerMesh('driveWheelsGroup', rimLip);
    wheelSub.add(rimLip);

    // Inner Drop-Center Stepped Well
    const innerLipGeom = new THREE.CylinderGeometry(0.0234, 0.0234, 0.0272, 36);
    innerLipGeom.rotateZ(Math.PI / 2);
    const innerLip = new THREE.Mesh(innerLipGeom, blueRimMat);
    wheelSub.add(innerLip);

    // Inner rim edge flange ring
    const innerFlange = new THREE.Mesh(rimLipGeom, blueRimMat);
    innerFlange.position.set(-xSign * 0.0126, 0, 0);
    wheelSub.add(innerFlange);

    // ----------------------------------------------------
    // 10 Curved Turbine Split-Spokes (Exact match to macro photo 1793006044923_...jpg)
    // Twin aerodynamic blades per spoke radiating and curving into the deep rim barrel
    // ----------------------------------------------------
    for (let s = 0; s < 10; s++) {
      const angle = (s * Math.PI * 2) / 10;
      const spokeGroup = new THREE.Group();
      spokeGroup.position.set(xSign * 0.0132, 0, 0);
      spokeGroup.rotation.x = -angle;

      // Primary curved turbine blade
      const spokeGeom1 = new THREE.BoxGeometry(0.0024, 0.0185, 0.0018);
      const blade1 = new THREE.Mesh(spokeGeom1, blueRimMat);
      blade1.position.set(0, 0.0142, 0.0012);
      blade1.rotation.z = xSign * 0.08;
      blade1.rotation.y = -0.15;
      registerMesh('driveWheelsGroup', blade1);
      spokeGroup.add(blade1);

      // Secondary twin curved blade forming the split spoke
      const spokeGeom2 = new THREE.BoxGeometry(0.0022, 0.0175, 0.0016);
      const blade2 = new THREE.Mesh(spokeGeom2, blueRimMat);
      blade2.position.set(0, 0.0142, -0.0014);
      blade2.rotation.z = xSign * 0.08;
      blade2.rotation.y = 0.15;
      registerMesh('driveWheelsGroup', blade2);
      spokeGroup.add(blade2);

      // Deep dish inner gusset anchor connecting to the drop-center well
      const rootGusset = new THREE.Mesh(
        new THREE.BoxGeometry(0.004, 0.005, 0.0035),
        blueRimMat
      );
      rootGusset.position.set(-xSign * 0.002, 0.022, 0);
      spokeGroup.add(rootGusset);

      wheelSub.add(spokeGroup);
    }

    // ----------------------------------------------------
    // Center Hub Recess with Chrome M4 Bolt & Washer (photo 1793006044923_...jpg)
    // ----------------------------------------------------
    // Outer Center Hub Collar Ring
    const hubCollarGeom = new THREE.CylinderGeometry(0.0084, 0.0084, 0.0045, 24);
    hubCollarGeom.rotateZ(Math.PI / 2);
    const hubCollar = new THREE.Mesh(hubCollarGeom, blueRimMat);
    hubCollar.position.set(xSign * 0.0135, 0, 0);
    registerMesh('driveWheelsGroup', hubCollar);
    wheelSub.add(hubCollar);

    // Deep Dark Socket Well
    const hubWellGeom = new THREE.CylinderGeometry(0.0068, 0.0068, 0.003, 16);
    hubWellGeom.rotateZ(Math.PI / 2);
    const hubWell = new THREE.Mesh(hubWellGeom, blackPlasticMat);
    hubWell.position.set(xSign * 0.014, 0, 0);
    wheelSub.add(hubWell);

    // Flat Round Chrome Washer
    const washerGeom = new THREE.CylinderGeometry(0.0062, 0.0062, 0.0008, 16);
    washerGeom.rotateZ(Math.PI / 2);
    const washerMesh = new THREE.Mesh(washerGeom, chromeMat);
    washerMesh.position.set(xSign * 0.0148, 0, 0);
    wheelSub.add(washerMesh);

    // Chrome Center Phillips Machine Bolt
    const boltGeom = new THREE.CylinderGeometry(0.0045, 0.0045, 0.0032, 16);
    boltGeom.rotateZ(Math.PI / 2);
    const boltMesh = new THREE.Mesh(boltGeom, chromeMat);
    boltMesh.position.set(xSign * 0.0162, 0, 0);
    registerMesh('driveWheelsGroup', boltMesh);
    wheelSub.add(boltMesh);

    // Cross-slot screwdriver recess on bolt head
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.0065, 0.001), blackPlasticMat);
    cross1.position.set(xSign * 0.0178, 0, 0);
    wheelSub.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.0065), blackPlasticMat);
    cross2.position.set(xSign * 0.0178, 0, 0);
    wheelSub.add(cross2);

    // 5 Miniature Chrome Wheel Stud Lug Nuts around hub collar (PCD circle)
    const lugNutGeom = new THREE.CylinderGeometry(0.00075, 0.00075, 0.0016, 6);
    lugNutGeom.rotateZ(Math.PI / 2);
    for (let n = 0; n < 5; n++) {
      const lugAngle = (n * Math.PI * 2) / 5 + 0.31;
      const lugMesh = new THREE.Mesh(lugNutGeom, chromeMat);
      lugMesh.position.set(
        xSign * 0.0152,
        Math.cos(lugAngle) * 0.0062,
        Math.sin(lugAngle) * 0.0062
      );
      registerMesh('driveWheelsGroup', lugMesh);
      wheelSub.add(lugMesh);
    }

    // Metallic Backing Hub Disk behind turbine spokes (gives mechanical depth when looking through spoke gaps)
    const rotorGeom = new THREE.CylinderGeometry(0.021, 0.021, 0.002, 24);
    rotorGeom.rotateZ(Math.PI / 2);
    const rotorMesh = new THREE.Mesh(rotorGeom, motorZincMat);
    rotorMesh.position.set(xSign * 0.005, 0, 0);
    wheelSub.add(rotorMesh);

    // Stepped Inner Drop-Center Ring
    const dropRingGeom = new THREE.TorusGeometry(0.0175, 0.0011, 8, 36);
    dropRingGeom.rotateY(Math.PI / 2);
    const dropRing = new THREE.Mesh(dropRingGeom, blueRimMat);
    dropRing.position.set(xSign * 0.011, 0, 0);
    wheelSub.add(dropRing);

    // ----------------------------------------------------
    // Rubber Air Valve Stem on Rim Face
    // ----------------------------------------------------
    const valveStemGeom = new THREE.CylinderGeometry(0.00085, 0.00085, 0.0038, 8);
    valveStemGeom.rotateZ(Math.PI / 2);
    const valveStem = new THREE.Mesh(valveStemGeom, blackPlasticMat);
    valveStem.position.set(xSign * 0.0142, 0.0182, 0);
    valveStem.rotation.z = xSign * 0.35;
    wheelSub.add(valveStem);

    const valveCapGeom = new THREE.CylinderGeometry(0.0011, 0.0011, 0.0018, 8);
    valveCapGeom.rotateZ(Math.PI / 2);
    const valveCap = new THREE.Mesh(valveCapGeom, chromeMat);
    valveCap.position.set(xSign * 0.0158, 0.0195, 0);
    wheelSub.add(valveCap);

    wheelSub.scale.set(1.25, 1.54, 1.54);
    wheelSub.position.set(xSign * 0.138, 0.001, 0);
    return wheelSub;
  }

  const leftWheel = createDetailedDriveWheel(true);
  leftWheel.name = 'left-wheel';
  const rightWheel = createDetailedDriveWheel(false);
  rightWheel.name = 'right-wheel';
  driveWheelsGroup.add(leftWheel);
  driveWheelsGroup.add(rightWheel);

  // ----------------------------------------------------
  // 7. FRONT & REAR CASTER WHEEL ASSEMBLIES (Underside photo image_bbcc8481.png)
  // ----------------------------------------------------
  const casterWheelsGroup = new THREE.Group();
  casterWheelsGroup.name = 'caster-wheels';

  function createDetailedCasterAssembly(zPos: number): { fork: THREE.Group; wheel: THREE.Group } {
    const casterRoot = new THREE.Group();
    casterRoot.position.set(0, 0.0165, zPos);

    // Stamped Steel Mounting Flange Base (37x37mm square flange with beveled corner radii & 4 dome screws)
    const plateShape = new THREE.Shape();
    const cw = 0.0185;
    const cr = 0.0032;
    plateShape.moveTo(-cw + cr, -cw);
    plateShape.lineTo(cw - cr, -cw);
    plateShape.quadraticCurveTo(cw, -cw, cw, -cw + cr);
    plateShape.lineTo(cw, cw - cr);
    plateShape.quadraticCurveTo(cw, cw, cw - cr, cw);
    plateShape.lineTo(-cw + cr, cw);
    plateShape.quadraticCurveTo(-cw, cw, -cw, cw - cr);
    plateShape.lineTo(-cw, -cw + cr);
    plateShape.quadraticCurveTo(-cw, -cw, -cw + cr, -cw);

    const basePlateGeom = new THREE.ExtrudeGeometry(plateShape, {
      depth: 0.0024,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.0005,
      bevelThickness: 0.0004,
    });
    basePlateGeom.rotateX(Math.PI / 2);
    const basePlate = new THREE.Mesh(basePlateGeom, chromeMat);
    basePlate.position.set(0, 0.001, 0);
    registerMesh('casterWheelsGroup', basePlate);
    casterRoot.add(basePlate);

    // 4 Corner Dome-Head Screws & Washers on caster flange
    const casterScrewGeom = new THREE.SphereGeometry(0.0019, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    [
      [-0.0138, 0.0138],
      [0.0138, 0.0138],
      [-0.0138, -0.0138],
      [0.0138, -0.0138],
    ].forEach(([cx, cz]) => {
      const scr = new THREE.Mesh(casterScrewGeom, chromeMat);
      scr.rotation.x = Math.PI;
      scr.position.set(cx, -0.0014, cz);
      casterRoot.add(scr);
    });

    // Stepped Swivel Ball-Race Bearing Cup
    const hubGeom = new THREE.CylinderGeometry(0.0125, 0.0145, 0.0052, 20);
    const hubMesh = new THREE.Mesh(hubGeom, chromeMat);
    hubMesh.position.set(0, -0.0030, 0);
    registerMesh('casterWheelsGroup', hubMesh);
    casterRoot.add(hubMesh);

    const raceLip = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0013, 8, 20), chromeMat);
    raceLip.rotateX(Math.PI / 2);
    raceLip.position.set(0, -0.0016, 0);
    casterRoot.add(raceLip);

    // Swivel Fork that rotates around Y axis (extended proportionally to touch ground coplanarly with enlarged drive wheels)
    const forkGroup = new THREE.Group();
    forkGroup.position.set(0, -0.0055, 0);

    // Curved Stamped Chrome Trailing Fork Arms
    const forkArmShape = new THREE.Shape();
    forkArmShape.moveTo(-0.011, 0);
    forkArmShape.lineTo(0.011, 0);
    forkArmShape.lineTo(0.006, -0.042);
    forkArmShape.quadraticCurveTo(0.002, -0.050, -0.006, -0.050);
    forkArmShape.lineTo(-0.014, -0.045);
    forkArmShape.quadraticCurveTo(-0.014, -0.022, -0.011, 0);

    const forkArmGeom = new THREE.ExtrudeGeometry(forkArmShape, {
      depth: 0.0025,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.00035,
      bevelThickness: 0.00035,
    });
    forkArmGeom.rotateY(-Math.PI / 2);

    const armLeft = new THREE.Mesh(forkArmGeom, chromeMat);
    armLeft.position.set(-0.011, 0, 0);
    registerMesh('casterWheelsGroup', armLeft);
    forkGroup.add(armLeft);

    const armRight = new THREE.Mesh(forkArmGeom, chromeMat);
    armRight.position.set(0.0135, 0, 0);
    registerMesh('casterWheelsGroup', armRight);
    forkGroup.add(armRight);

    // Swivel Caster Roller Wheel (42mm diameter matching enlarged drive wheels at y_bottom = -0.0544)
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, -0.0444, -0.006);

    const rollerGeom = new THREE.CylinderGeometry(0.021, 0.021, 0.020, 24);
    rollerGeom.rotateZ(Math.PI / 2);
    const rollerMat = new THREE.MeshStandardMaterial({
      color: 0x6b6661, // authentic warm grey/taupe caster tread
      metalness: 0.12,
      roughness: 0.65,
    });
    const rollerMesh = new THREE.Mesh(rollerGeom, rollerMat);
    registerMesh('casterWheelsGroup', rollerMesh);
    wheelGroup.add(rollerMesh);

    const hubCoreGeom = new THREE.CylinderGeometry(0.0125, 0.0125, 0.0208, 20);
    hubCoreGeom.rotateZ(Math.PI / 2);
    const hubCore = new THREE.Mesh(hubCoreGeom, blackPlasticMat);
    wheelGroup.add(hubCore);

    // Chrome axle rivet pin with flared end washers
    const axleGeom = new THREE.CylinderGeometry(0.0038, 0.0038, 0.030, 12);
    axleGeom.rotateZ(Math.PI / 2);
    const axleMesh = new THREE.Mesh(axleGeom, chromeMat);
    wheelGroup.add(axleMesh);

    forkGroup.add(wheelGroup);
    casterRoot.add(forkGroup);
    casterWheelsGroup.add(casterRoot);

    return { fork: forkGroup, wheel: wheelGroup };
  }

  // Front Caster & Rear Caster positioned to frame the middle motor/harness zone (image (8))
  const frontCaster = createDetailedCasterAssembly(0.105);
  const rearCaster = createDetailedCasterAssembly(-0.105);

  // ----------------------------------------------------
  // 8. MOTOR DRIVER SHIELD GROUP (Waveshare JetBot Expansion & Motor Driver Board)
  // ----------------------------------------------------
  const motorDriverGroup = new THREE.Group();
  motorDriverGroup.name = 'motor-driver';
  motorDriverGroup.position.set(0, 0.046, 0.024);

  // Matte Black FR4 Driver Board PCB
  const driverPcbGeom = new THREE.BoxGeometry(0.082, 0.0024, 0.062);
  const driverPcb = new THREE.Mesh(driverPcbGeom, blackPlasticMat);
  registerMesh('motorDriverGroup', driverPcb);
  motorDriverGroup.add(driverPcb);

  // Industrial Phoenix-style Screw Terminal Blocks in Matte Charcoal/Black (Replacing artificial blue blocks)
  const termGeom = new THREE.BoxGeometry(0.019, 0.010, 0.012);
  const termMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d, // Dark industrial charcoal
    roughness: 0.85,
    metalness: 0.2,
  });

  const termLeft = new THREE.Mesh(termGeom, termMat);
  termLeft.position.set(-0.024, 0.006, 0.020);
  registerMesh('motorDriverGroup', termLeft);
  motorDriverGroup.add(termLeft);

  const termRight = new THREE.Mesh(termGeom, termMat);
  termRight.position.set(0.024, 0.006, 0.020);
  registerMesh('motorDriverGroup', termRight);
  motorDriverGroup.add(termRight);

  // Wire entry port cavities on front face of terminal blocks
  const portGeom = new THREE.BoxGeometry(0.004, 0.004, 0.002);
  const portMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  [-0.024, 0.024].forEach((tx) => {
    [-0.0045, 0.0045].forEach((px) => {
      const port = new THREE.Mesh(portGeom, portMat);
      port.position.set(tx + px, 0.005, 0.026);
      motorDriverGroup.add(port);
    });
  });

  // Clamping screws on top of terminal blocks (Chrome slotted M2.5 screws)
  for (let s = -1; s <= 1; s += 2) {
    const tScr1 = new THREE.Mesh(screwGeom, chromeMat);
    tScr1.position.set(-0.024 + s * 0.0045, 0.0115, 0.020);
    motorDriverGroup.add(tScr1);
    const tScr2 = new THREE.Mesh(screwGeom, chromeMat);
    tScr2.position.set(0.024 + s * 0.0045, 0.0115, 0.020);
    motorDriverGroup.add(tScr2);
  }

  // Dual Toshiba TB6612FNG Dual H-Bridge Motor Driver ICs with silver lead pins
  const tbChipGeom = new THREE.BoxGeometry(0.008, 0.002, 0.006);
  [-0.022, 0.022].forEach((cx) => {
    const chip = new THREE.Mesh(tbChipGeom, blackPlasticMat);
    chip.position.set(cx, 0.002, 0.002);
    motorDriverGroup.add(chip);
    // Silver lead pins on sides
    for (let p = -0.0025; p <= 0.0025; p += 0.001) {
      const pinL = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0006, 0.0006), chromeMat);
      pinL.position.set(cx - 0.0045, 0.0012, 0.002 + p);
      motorDriverGroup.add(pinL);
      const pinR = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0006, 0.0006), chromeMat);
      pinR.position.set(cx + 0.0045, 0.0012, 0.002 + p);
      motorDriverGroup.add(pinR);
    }
  });

  // 2x Solid Electrolytic Power Filter Capacitors (silver top with K-vent scoring)
  const driverCapGeom = new THREE.CylinderGeometry(0.0042, 0.0042, 0.013, 16);
  const capTopGeom = new THREE.CylinderGeometry(0.0041, 0.0041, 0.0008, 16);
  [-0.014, 0.014].forEach((cx) => {
    const capBody = new THREE.Mesh(driverCapGeom, blackPlasticMat);
    capBody.position.set(cx, 0.0075, -0.014);
    registerMesh('motorDriverGroup', capBody);
    motorDriverGroup.add(capBody);

    const capTop = new THREE.Mesh(capTopGeom, chromeMat);
    capTop.position.set(cx, 0.0142, -0.014);
    motorDriverGroup.add(capTop);
  });

  // 2x 10µH Shielded Power Inductors
  const indGeom = new THREE.BoxGeometry(0.0065, 0.0045, 0.0065);
  [-0.032, 0.032].forEach((ix) => {
    const ind = new THREE.Mesh(indGeom, blackPlasticMat);
    ind.position.set(ix, 0.0035, -0.008);
    motorDriverGroup.add(ind);
  });

  // Green SMD Power LED & Resistor
  const pwrLedMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 0.8,
  });
  const pwrLed = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.0015, 0.003), pwrLedMat);
  pwrLed.position.set(0, 0.002, 0.024);
  motorDriverGroup.add(pwrLed);

  // Dual White JST-XH Motor Connector Sockets
  const jstMotGeom = new THREE.BoxGeometry(0.008, 0.006, 0.0055);
  const jstMotL = new THREE.Mesh(jstMotGeom, wireWhiteMat);
  jstMotL.position.set(-0.026, 0.004, -0.022);
  motorDriverGroup.add(jstMotL);
  const jstMotR = new THREE.Mesh(jstMotGeom, wireWhiteMat);
  jstMotR.position.set(0.026, 0.004, -0.022);
  motorDriverGroup.add(jstMotR);

  // Clean Twisted-Pair Motor Wires (Red & Black) entering center chassis slot
  // Left Motor Twisted Pair:
  const leftMotTwist1 = [
    new THREE.Vector3(-0.022, 0.004, 0.026),
    new THREE.Vector3(-0.018, -0.006, 0.020),
    new THREE.Vector3(-0.010, -0.018, 0.012),
    new THREE.Vector3(-0.006, -0.026, 0.004),
  ];
  const leftMotWire1 = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftMotTwist1), 10, 0.0011, 6, false),
    wireRedMat
  );
  motorDriverGroup.add(leftMotWire1);

  const leftMotTwist2 = [
    new THREE.Vector3(-0.026, 0.004, 0.026),
    new THREE.Vector3(-0.020, -0.006, 0.022),
    new THREE.Vector3(-0.012, -0.018, 0.014),
    new THREE.Vector3(-0.008, -0.026, 0.006),
  ];
  const leftMotWire2 = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftMotTwist2), 10, 0.0011, 6, false),
    wireBlackMat
  );
  motorDriverGroup.add(leftMotWire2);

  // Right Motor Twisted Pair:
  const rightMotTwist1 = [
    new THREE.Vector3(0.022, 0.004, 0.026),
    new THREE.Vector3(0.018, -0.006, 0.020),
    new THREE.Vector3(0.010, -0.018, 0.012),
    new THREE.Vector3(0.006, -0.026, 0.004),
  ];
  const rightMotWire1 = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightMotTwist1), 10, 0.0011, 6, false),
    wireRedMat
  );
  motorDriverGroup.add(rightMotWire1);

  const rightMotTwist2 = [
    new THREE.Vector3(0.026, 0.004, 0.026),
    new THREE.Vector3(0.020, -0.006, 0.022),
    new THREE.Vector3(0.012, -0.018, 0.014),
    new THREE.Vector3(0.008, -0.026, 0.006),
  ];
  const rightMotWire2 = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightMotTwist2), 10, 0.0011, 6, false),
    wireBlackMat
  );
  motorDriverGroup.add(rightMotWire2);

  // Black nylon wire harness routing clip with chrome screw
  const harnessClipGeom = new THREE.BoxGeometry(0.010, 0.004, 0.008);
  const harnessClip = new THREE.Mesh(harnessClipGeom, blackPlasticMat);
  harnessClip.position.set(0, -0.014, 0.012);
  motorDriverGroup.add(harnessClip);
  const clipScr = new THREE.Mesh(screwGeom, chromeMat);
  clipScr.position.set(0, -0.0118, 0.012);
  motorDriverGroup.add(clipScr);

  // ----------------------------------------------------
  // 9. DUAL WI-FI ANTENNAS GROUP (Accurately modeled from image_c14dba1a.png & image_8a45e6b8.png)
  // ----------------------------------------------------
  const wifiAntennasGroup = new THREE.Group();
  wifiAntennasGroup.name = 'wifi-antennas';
  wifiAntennasGroup.position.set(0, 0.02, -0.11);

  function createDetailedAntenna(isLeft: boolean): THREE.Group {
    const antSub = new THREE.Group();
    const xSign = isLeft ? -1 : 1;

    // Gold Hexagonal SMA Connector Base on Bottom Plate (Photo 2)
    const smaGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.014, 6);
    const smaMesh = new THREE.Mesh(smaGeom, brassMat);
    smaMesh.position.set(xSign * 0.075, 0.007, 0);
    registerMesh('wifiAntennasGroup', smaMesh);
    antSub.add(smaMesh);

    // Prominent Gold Hexagonal Locknut & Star Washer securing to green plate (Photo 2)
    const nutGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.003, 6);
    const nutMesh = new THREE.Mesh(nutGeom, brassMat);
    nutMesh.position.set(xSign * 0.075, 0.002, 0);
    registerMesh('wifiAntennasGroup', nutMesh);
    antSub.add(nutMesh);

    const washerGeom = new THREE.CylinderGeometry(0.0075, 0.0075, 0.001, 16);
    const washerMesh = new THREE.Mesh(washerGeom, chromeMat);
    washerMesh.position.set(xSign * 0.075, 0.0005, 0);
    antSub.add(washerMesh);

    // Black Knuckle Joint
    const knuckleGeom = new THREE.CylinderGeometry(0.0045, 0.0045, 0.018, 12);
    const knuckleMesh = new THREE.Mesh(knuckleGeom, blackPlasticMat);
    knuckleMesh.position.set(xSign * 0.075, 0.02, 0);
    registerMesh('wifiAntennasGroup', knuckleMesh);
    antSub.add(knuckleMesh);

    // Tall Articulated Dipole Rod (~140mm long) with realistic taper
    const rodGeom = new THREE.CylinderGeometry(0.003, 0.0045, 0.14, 16);
    const rodMesh = new THREE.Mesh(rodGeom, blackPlasticMat);
    rodMesh.position.set(xSign * 0.09, 0.09, -0.015);
    rodMesh.rotation.z = xSign * -0.32; // V-shape spread
    rodMesh.rotation.x = -0.12; // angled slightly back
    registerMesh('wifiAntennasGroup', rodMesh);
    antSub.add(rodMesh);

    // Thin Black Coaxial Pigtail Cable arcing outward past chassis rim before looping up to M.2 card (Photos 3, 5, 6, 7)
    const coaxPoints = [
      new THREE.Vector3(xSign * 0.075, -0.001, 0),
      new THREE.Vector3(xSign * 0.090, -0.010, -0.014),
      new THREE.Vector3(xSign * 0.092, 0.006, -0.026),
      new THREE.Vector3(xSign * 0.078, 0.036, -0.010),
      new THREE.Vector3(xSign * 0.054, 0.058, 0.024),
      new THREE.Vector3(xSign * 0.016, 0.064, 0.042),
    ];
    const coaxCurve = new THREE.CatmullRomCurve3(coaxPoints);
    const coaxGeom = new THREE.TubeGeometry(coaxCurve, 26, 0.00095, 6, false);
    const coaxMesh = new THREE.Mesh(coaxGeom, wireBlackMat);
    antSub.add(coaxMesh);

    // Black heat-shrink crimp collar at SMA connector base (photo 3_37e20bc8.jpg)
    const crimpCollarGeom = new THREE.CylinderGeometry(0.0018, 0.0018, 0.004, 8);
    const crimpCollar = new THREE.Mesh(crimpCollarGeom, blackPlasticMat);
    crimpCollar.position.set(xSign * 0.075, 0.003, 0);
    antSub.add(crimpCollar);

    return antSub;
  }

  const leftAntenna = createDetailedAntenna(true);
  const rightAntenna = createDetailedAntenna(false);
  wifiAntennasGroup.add(leftAntenna);
  wifiAntennasGroup.add(rightAntenna);

  // ----------------------------------------------------
  // 10. BATTERY POWER PACK GROUP (Open 18650 Holder & Blue Li-ion Cells under middle board, matching image_4f796f2b.png)
  // ----------------------------------------------------
  const batteryGroup = new THREE.Group();
  batteryGroup.name = 'battery-pack';
  batteryGroup.position.set(0, 0.046, -0.036);

  // Material for sky-blue 18650 cell shrink-wrap with barcode & spec markings
  const cell18650Mat = new THREE.MeshStandardMaterial({
    map: create18650CellTexture(),
    roughness: 0.32,
    metalness: 0.12,
  });

  // Material for pale mint-green underside power/balance connector (image_4f796f2b.png)
  const mintConnectorMat = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    roughness: 0.45,
    metalness: 0.08,
  });

  // 1. Open-Frame Black ABS 18650 Battery Holder Tray (Khay đựng pin 18650 hở mặt sau & hông)
  // Bottom tray floor
  const holderFloor = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.003, 0.056), blackPlasticMat);
  holderFloor.position.set(0, -0.022, 0);
  registerMesh('batteryGroup', holderFloor);
  batteryGroup.add(holderFloor);

  // Top retaining bridge / bracket mounting to underside of middle deck
  const holderTop = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.003, 0.056), blackPlasticMat);
  holderTop.position.set(0, 0.017, 0);
  registerMesh('batteryGroup', holderTop);
  batteryGroup.add(holderTop);

  // Left & Right End Walls holding spring & positive contacts
  [-0.0405, 0.0405].forEach((wx) => {
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.039, 0.056), blackPlasticMat);
    endWall.position.set(wx, -0.0025, 0);
    registerMesh('batteryGroup', endWall);
    batteryGroup.add(endWall);
  });

  // Front backplate (towards +Z motor side)
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.039, 0.003), blackPlasticMat);
  frontWall.position.set(0, -0.0025, 0.0265);
  registerMesh('batteryGroup', frontWall);
  batteryGroup.add(frontWall);

  // Rear protective retaining rails (top & bottom lip on -Z rear face, leaving a wide open window to see the blue 18650 cells!)
  const rearTopLip = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.007, 0.003), blackPlasticMat);
  rearTopLip.position.set(0, 0.0135, -0.0265);
  batteryGroup.add(rearTopLip);

  const rearBotLip = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.005, 0.003), blackPlasticMat);
  rearBotLip.position.set(0, -0.0195, -0.0265);
  batteryGroup.add(rearBotLip);

  // Center vertical divider rib on rear window
  const rearMidPost = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.036, 0.003), blackPlasticMat);
  rearMidPost.position.set(0, -0.0025, -0.0265);
  batteryGroup.add(rearMidPost);

  // 2. 3x Sky-Blue 18650 Li-ion Battery Cells (Horizontal along X axis, clearly visible from rear!)
  const cellRadius = 0.0092; // 18.4mm diameter
  const cellLength = 0.065;  // 65mm length
  const cellGeom = new THREE.CylinderGeometry(cellRadius, cellRadius, cellLength, 24);
  cellGeom.rotateZ(Math.PI / 2);

  const cellPositions: [number, number][] = [
    [-0.011, -0.014], // Rear-lower cell (directly visible in rear cutout window!)
    [0.008, -0.014],  // Rear-upper cell
    [-0.002, 0.010],  // Front cell
  ];

  cellPositions.forEach(([cy, cz], idx) => {
    const cellGroup = new THREE.Group();
    cellGroup.position.set(0, cy, cz);

    // Blue PVC wrapped cylinder with barcode label
    const cellMesh = new THREE.Mesh(cellGeom, cell18650Mat);
    cellMesh.rotation.x = idx === 0 ? -0.35 : 0.4; // orient barcode label facing rear viewer
    registerMesh('batteryGroup', cellMesh);
    cellGroup.add(cellMesh);

    // Positive steel button cap (+ side) & white insulator ring
    const posSide = idx % 2 === 0 ? 1 : -1;
    const insRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0068, 0.0068, 0.0008, 16),
      wireWhiteMat
    );
    insRing.rotation.z = Math.PI / 2;
    insRing.position.set(posSide * 0.0326, 0, 0);
    cellGroup.add(insRing);

    const posCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0036, 0.0036, 0.0022, 14),
      chromeMat
    );
    posCap.rotation.z = Math.PI / 2;
    posCap.position.set(posSide * 0.0332, 0, 0);
    cellGroup.add(posCap);

    // Negative flat steel cap (- side)
    const negCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0075, 0.0075, 0.0012, 16),
      chromeMat
    );
    negCap.rotation.z = Math.PI / 2;
    negCap.position.set(-posSide * 0.0328, 0, 0);
    cellGroup.add(negCap);

    // Nickel-plated spring contact pressing against negative terminal
    const springMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0042, 0.0055, 0.0055, 12),
      chromeMat
    );
    springMesh.rotation.z = Math.PI / 2;
    springMesh.position.set(-posSide * 0.036, 0, 0);
    cellGroup.add(springMesh);

    batteryGroup.add(cellGroup);
  });

  // 3. Mint-Green 4-Pin Power/Balance Connector hanging under middle board (image_4f796f2b.png)
  const mintSocket = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.0075, 0.010), mintConnectorMat);
  mintSocket.position.set(0.004, 0.0215, -0.024);
  registerMesh('batteryGroup', mintSocket);
  batteryGroup.add(mintSocket);

  // Locking tabs on mint-green connector
  [-0.008, 0.008].forEach((tx) => {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.004, 0.011), mintConnectorMat);
    tab.position.set(0.004 + tx, 0.018, -0.024);
    batteryGroup.add(tab);
  });

  // Power & Balance Wires (Black, White, Red) curving from mint connector down into battery holder
  const bmsWires: Array<{ mat: THREE.Material; dx: number; dz: number }> = [
    { mat: wireBlackMat, dx: -0.004, dz: -0.001 },
    { mat: wireWhiteMat, dx: 0.0, dz: 0.0 },
    { mat: wireRedMat, dx: 0.004, dz: 0.001 },
  ];
  bmsWires.forEach(({ mat, dx, dz }) => {
    const wPts = [
      new THREE.Vector3(0.004 + dx, 0.017, -0.024 + dz),
      new THREE.Vector3(0.003 + dx * 1.2, 0.008, -0.029 + dz),
      new THREE.Vector3(0.001 + dx * 0.8, -0.006, -0.024 + dz),
      new THREE.Vector3(0.002 + dx * 0.5, -0.014, -0.018 + dz),
    ];
    const wCurve = new THREE.CatmullRomCurve3(wPts, false, 'centripetal');
    const wMesh = new THREE.Mesh(new THREE.TubeGeometry(wCurve, 12, 0.0010, 6, false), mat);
    registerMesh('batteryGroup', wMesh);
    batteryGroup.add(wMesh);
  });

  // 4. Battery Status Gauge & Power Controls on Right Flank
  const bmsPanel = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.016, 0.036), blackPlasticMat);
  bmsPanel.position.set(0.043, 0.005, -0.004);
  batteryGroup.add(bmsPanel);

  // 4 Micro Battery Level Indicator LEDs (3 Green, 1 Amber)
  const ledGreenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.75 });
  const ledAmberMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.75 });
  const bmsLedGeom = new THREE.CylinderGeometry(0.001, 0.001, 0.002, 8);
  bmsLedGeom.rotateZ(Math.PI / 2);

  [-0.010, -0.004, 0.002].forEach((lz) => {
    const led = new THREE.Mesh(bmsLedGeom, ledGreenMat);
    led.position.set(0.0442, 0.007, lz);
    batteryGroup.add(led);
  });
  const ledLow = new THREE.Mesh(bmsLedGeom, ledAmberMat);
  ledLow.position.set(0.0442, 0.007, 0.008);
  batteryGroup.add(ledLow);

  // Authentic Yellow XT60 High-Current Power Connector on side harness
  const xt60Mat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.1 });
  const xt60Body = new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.0055, 0.012), xt60Mat);
  xt60Body.position.set(0.042, 0.014, 0.014);
  batteryGroup.add(xt60Body);

  // Soft Radial Contact Shadow Grounding Plane
  const shadowGeom = new THREE.PlaneGeometry(0.55, 0.55);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });
  const contactShadow = new THREE.Mesh(shadowGeom, shadowMat);
  contactShadow.position.set(0, -0.0535, 0);

  // Assemble full hierarchy
  rootGroup.add(chassisGroup);
  rootGroup.add(jetsonNanoGroup);
  rootGroup.add(rplidarGroup);
  rootGroup.add(cameraCsiGroup);
  rootGroup.add(dcMotorsGroup);
  rootGroup.add(driveWheelsGroup);
  rootGroup.add(casterWheelsGroup);
  rootGroup.add(motorDriverGroup);
  rootGroup.add(wifiAntennasGroup);
  rootGroup.add(batteryGroup);
  rootGroup.add(contactShadow);

  // Ground enlarged wheels & casters precisely at y = 0
  rootGroup.position.set(0, 0.0544, 0);

  // Recursively tag every single mesh in the model hierarchy with its componentId
  // This guarantees 100% raycast click detection whenever the user clicks on ANY part of the 3D model!
  function tagComponentHierarchy(parent: THREE.Object3D, componentGroup: string) {
    parent.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        if (!child.userData.componentId) {
          child.userData.componentId = componentGroup;
        }
      }
    });
  }

  // Tag sub-specialized components first (so they take precedence over generic parent groups):
  tagComponentHierarchy(coolingFan, 'coolingFanGroup');
  tagComponentHierarchy(oledModule, 'oledDisplayGroup');
  tagComponentHierarchy(switchGroup, 'hardwareControlsGroup');
  tagComponentHierarchy(dcJackGroup, 'hardwareControlsGroup');
  tagComponentHierarchy(drivePulleyGroup, 'lidarBeltGroup');
  tagComponentHierarchy(motorHangerGroup, 'lidarBeltGroup');
  tagComponentHierarchy(beltMesh, 'lidarBeltGroup');

  // Then tag all primary subsystem groups:
  tagComponentHierarchy(cameraCsiGroup, 'cameraCsiGroup');
  tagComponentHierarchy(rplidarGroup, 'rplidarGroup');
  tagComponentHierarchy(jetsonNanoGroup, 'jetsonNanoGroup');
  tagComponentHierarchy(driveWheelsGroup, 'driveWheelsGroup');
  tagComponentHierarchy(dcMotorsGroup, 'dcMotorsGroup');
  tagComponentHierarchy(casterWheelsGroup, 'casterWheelsGroup');
  tagComponentHierarchy(motorDriverGroup, 'motorDriverGroup');
  tagComponentHierarchy(wifiAntennasGroup, 'wifiAntennasGroup');
  tagComponentHierarchy(batteryGroup, 'batteryGroup');
  tagComponentHierarchy(chassisGroup, 'chassisGroup');

  return {
    rootGroup,
    groups: {
      chassis: chassisGroup,
      jetsonNano: jetsonNanoGroup,
      rplidar: rplidarGroup,
      rplidarTurret,
      rplidarPulley: drivePulleyGroup,
      coolingFan,
      cameraCsi: cameraCsiGroup,
      dcMotors: dcMotorsGroup,
      driveWheels: driveWheelsGroup,
      leftWheel,
      rightWheel,
      casterWheels: casterWheelsGroup,
      frontCasterFork: frontCaster.fork,
      frontCasterWheel: frontCaster.wheel,
      rearCasterFork: rearCaster.fork,
      rearCasterWheel: rearCaster.wheel,
      motorDriver: motorDriverGroup,
      wifiAntennas: wifiAntennasGroup,
      battery: batteryGroup,
    },
    highlightMeshes,
    laserBeam,
    scanFan,
    contactShadow,
    updateCableMovement: updateRibbonCable,
  };
}

// Function to smoothly interpolate exploded view positions
export function applyExplodedView(model: JetBotModel, factor: number) {
  const clamped = Math.max(0, Math.min(1, factor));

  // RPLIDAR moves way up
  model.groups.rplidar.position.y = 0.145 + clamped * 0.16;

  // Jetson Nano lifts up
  model.groups.jetsonNano.position.y = 0.084 + clamped * 0.08;

  // Camera CSI moves forward and up
  model.groups.cameraCsi.position.z = 0.155 + clamped * 0.09;
  model.groups.cameraCsi.position.y = 0.0235 + clamped * 0.04;

  // Motor driver lifts slightly
  model.groups.motorDriver.position.y = 0.046 + clamped * 0.035;

  // Wi-Fi antennas spread back and up
  model.groups.wifiAntennas.position.z = -0.11 - clamped * 0.06;
  model.groups.wifiAntennas.position.y = 0.02 + clamped * 0.05;

  // Battery slides slightly back and down
  model.groups.battery.position.z = -0.036 - clamped * 0.04;

  // Drive wheels slide outwards laterally (+X and -X)
  model.groups.leftWheel.position.x = -0.138 - clamped * 0.09;
  model.groups.rightWheel.position.x = 0.138 + clamped * 0.09;

  // Motors move downwards
  model.groups.dcMotors.position.y = 0.01 - clamped * 0.04;

  // Caster wheels drop downwards
  model.groups.casterWheels.position.y = -clamped * 0.05;
}
