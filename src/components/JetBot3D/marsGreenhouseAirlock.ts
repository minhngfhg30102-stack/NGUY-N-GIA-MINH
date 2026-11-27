import { MARS_GREENHOUSE_SPEC, MarsGreenhouseSpec } from './marsAtmosphereMath';

export const GREENHOUSE_FLOOR_Y = 0.088;
export const GREENHOUSE_INNER_DOOR_Z = 1.20;
export const GREENHOUSE_OUTER_DOOR_Z = 2.24;
export const GREENHOUSE_RAMP_END_Z = 2.86;
export const GREENHOUSE_CORRIDOR_HALF_WIDTH = 0.40;
export const GREENHOUSE_GARDEN_Z_MIN = -1.04;

export const GREENHOUSE_CHAMBER_Z_MIN = 1.38;
export const GREENHOUSE_CHAMBER_Z_MAX = 2.06;

export const GREENHOUSE_PRESSURIZE_SEC = 1.8;
export const GREENHOUSE_DEPRESSURIZE_SEC = 1.4;
export const GREENHOUSE_DOOR_SPEED = 2.2;

export type GreenhouseZone = 'outside' | 'ramp' | 'airlock' | 'garden';

export type AirlockPhase =
  | 'idle'
  | 'outer-open-entry'
  | 'sealing-outer'
  | 'pressurizing-purge'
  | 'inner-open-entry'
  | 'inner-open-exit'
  | 'sealing-inner'
  | 'depressurizing'
  | 'outer-open-exit';

export type AirlockStatusColor = 'idle' | 'red' | 'amber' | 'green';

export interface GreenhouseAirlockState {
  phase: AirlockPhase;
  phaseTimer: number;
  outerDoorOpen: number; // 0 = sealed, 1 = fully open
  innerDoorOpen: number; // 0 = sealed, 1 = fully open
  purgeProgress: number; // 0..1 during pressurization/dust purge or depressurization
  statusColor: AirlockStatusColor;
  dustShowerActive: boolean;
  dustPurgedComplete: boolean;
  lastCycleAudioCue: string | null;
}

export interface AirlockActorSample {
  id: string;
  localX: number;
  localZ: number;
}

export function createInitialAirlockState(): GreenhouseAirlockState {
  return {
    phase: 'idle',
    phaseTimer: 0,
    outerDoorOpen: 0,
    innerDoorOpen: 0,
    purgeProgress: 0,
    statusColor: 'idle',
    dustShowerActive: false,
    dustPurgedComplete: false,
    lastCycleAudioCue: null,
  };
}

export function worldToGreenhouseLocal(
  wx: number,
  wz: number,
  spec: MarsGreenhouseSpec = MARS_GREENHOUSE_SPEC
): { lx: number; lz: number } {
  const dx = wx - spec.x;
  const dz = wz - spec.z;
  const c = Math.cos(spec.rotationY);
  const s = Math.sin(spec.rotationY);
  return {
    lx: dx * c - dz * s,
    lz: dx * s + dz * c,
  };
}

export function greenhouseLocalToWorld(
  lx: number,
  lz: number,
  spec: MarsGreenhouseSpec = MARS_GREENHOUSE_SPEC
): { wx: number; wz: number } {
  const c = Math.cos(spec.rotationY);
  const s = Math.sin(spec.rotationY);
  return {
    wx: spec.x + lx * c + lz * s,
    wz: spec.z - lx * s + lz * c,
  };
}

export function classifyGreenhouseZone(lx: number, lz: number): GreenhouseZone {
  if (lz >= GREENHOUSE_GARDEN_Z_MIN - 0.12 && lz < GREENHOUSE_INNER_DOOR_Z && Math.abs(lx) <= 0.96) {
    return 'garden';
  }
  if (lz >= GREENHOUSE_INNER_DOOR_Z && lz <= GREENHOUSE_OUTER_DOOR_Z && Math.abs(lx) <= 0.45) {
    return 'airlock';
  }
  if (lz > GREENHOUSE_OUTER_DOOR_Z && lz <= GREENHOUSE_RAMP_END_Z + 0.35 && Math.abs(lx) <= 0.56) {
    return 'ramp';
  }
  return 'outside';
}

export function sampleGreenhouseElevationAt(
  wx: number,
  wz: number,
  spec: MarsGreenhouseSpec = MARS_GREENHOUSE_SPEC
): number {
  const { lx, lz } = worldToGreenhouseLocal(wx, wz, spec);
  if (Math.abs(lx) > 0.54) return 0;

  // Interior garden aisle and airlock floor slab
  if (lz >= GREENHOUSE_GARDEN_Z_MIN - 0.1 && lz <= GREENHOUSE_OUTER_DOOR_Z + 0.04) {
    if (lz >= GREENHOUSE_INNER_DOOR_Z || Math.abs(lx) <= 0.44) {
      return GREENHOUSE_FLOOR_Y;
    }
  }

  // Smooth entry ramp from airlock outer threshold down to Mars regolith
  if (lz > GREENHOUSE_OUTER_DOOR_Z + 0.04 && lz <= GREENHOUSE_RAMP_END_Z && Math.abs(lx) <= 0.46) {
    const t = (lz - (GREENHOUSE_OUTER_DOOR_Z + 0.04)) / (GREENHOUSE_RAMP_END_Z - (GREENHOUSE_OUTER_DOOR_Z + 0.04));
    return GREENHOUSE_FLOOR_Y * Math.max(0, Math.min(1, 1 - t));
  }

  return 0;
}

function stepToward(current: number, target: number, maxStep: number): number {
  if (Math.abs(target - current) <= maxStep) return target;
  return current + Math.sign(target - current) * maxStep;
}

/**
 * Advances the dual-door pressurized airlock state machine with strict mechanical interlock:
 * outerDoorOpen and innerDoorOpen can NEVER both be > 0 at the same time.
 */
export function stepGreenhouseAirlock(
  prev: GreenhouseAirlockState,
  actors: readonly AirlockActorSample[],
  deltaSec: number
): GreenhouseAirlockState {
  const dt = Math.max(0, Math.min(0.15, deltaSec));
  let { phase, phaseTimer, outerDoorOpen, innerDoorOpen, purgeProgress, statusColor, dustShowerActive, dustPurgedComplete } = prev;
  let audioCue: string | null = null;

  const isOnOuterApproach = actors.some(
    (a) => Math.abs(a.localX) <= 0.58 && a.localZ > GREENHOUSE_OUTER_DOOR_Z && a.localZ <= GREENHOUSE_RAMP_END_Z + 0.5
  );
  const isInsideChamber = actors.some(
    (a) => Math.abs(a.localX) <= 0.36 && a.localZ >= GREENHOUSE_CHAMBER_Z_MIN && a.localZ <= GREENHOUSE_CHAMBER_Z_MAX
  );
  const isAnyInChamberSpan = actors.some(
    (a) => Math.abs(a.localX) <= 0.42 && a.localZ >= GREENHOUSE_INNER_DOOR_Z + 0.05 && a.localZ <= GREENHOUSE_OUTER_DOOR_Z - 0.05
  );
  const isNearInnerFromGarden = actors.some(
    (a) => Math.abs(a.localX) <= 0.42 && a.localZ >= 0.72 && a.localZ < GREENHOUSE_INNER_DOOR_Z
  );
  const isCrossingInner = actors.some(
    (a) => Math.abs(a.localX) <= 0.40 && a.localZ >= 1.0 && a.localZ <= 1.44
  );
  const isCrossingOuter = actors.some(
    (a) => Math.abs(a.localX) <= 0.44 && a.localZ >= 2.02 && a.localZ <= 2.52
  );

  phaseTimer += dt;

  switch (phase) {
    case 'idle': {
      purgeProgress = 0;
      dustShowerActive = false;
      statusColor = 'idle';
      if (isInsideChamber) {
        // Safety recovery: someone is inside chamber while idle -> start pressurizing
        phase = 'sealing-outer';
        phaseTimer = 0;
        dustPurgedComplete = false;
      } else if (isOnOuterApproach && innerDoorOpen <= 0.001) {
        phase = 'outer-open-entry';
        phaseTimer = 0;
        dustPurgedComplete = false;
        audioCue = 'door-open';
      } else if (isNearInnerFromGarden && outerDoorOpen <= 0.001) {
        phase = 'inner-open-exit';
        phaseTimer = 0;
        audioCue = 'door-open';
      }
      break;
    }

    case 'outer-open-entry': {
      statusColor = 'green';
      purgeProgress = 0;
      dustShowerActive = false;
      if (isInsideChamber) {
        phase = 'sealing-outer';
        phaseTimer = 0;
        audioCue = 'seal-outer';
      } else if (!isOnOuterApproach && !isCrossingOuter && !isAnyInChamberSpan && phaseTimer > 0.75) {
        // Actor retreated without entering
        phase = 'idle';
        phaseTimer = 0;
      }
      break;
    }

    case 'sealing-outer': {
      statusColor = 'red';
      purgeProgress = 0;
      dustShowerActive = false;
      if (outerDoorOpen <= 0.001) {
        phase = 'pressurizing-purge';
        phaseTimer = 0;
        audioCue = 'airlock-purge';
      }
      break;
    }

    case 'pressurizing-purge': {
      dustShowerActive = true;
      purgeProgress = Math.min(1, phaseTimer / GREENHOUSE_PRESSURIZE_SEC);
      statusColor = purgeProgress < 0.25 ? 'red' : purgeProgress < 0.96 ? 'amber' : 'green';
      if (phaseTimer >= GREENHOUSE_PRESSURIZE_SEC) {
        dustShowerActive = false;
        dustPurgedComplete = true;
        purgeProgress = 1;
        statusColor = 'green';
        phase = 'inner-open-entry';
        phaseTimer = 0;
        audioCue = 'door-open';
      }
      break;
    }

    case 'inner-open-entry': {
      statusColor = 'green';
      dustShowerActive = false;
      purgeProgress = 1;
      if (!isAnyInChamberSpan && !isCrossingInner) {
        // Actor cleanly entered garden (or walked away)
        phase = 'idle';
        phaseTimer = 0;
      } else if (
        actors.some((a) => Math.abs(a.localX) <= 0.36 && a.localZ > 1.96 && a.localZ <= GREENHOUSE_OUTER_DOOR_Z) &&
        phaseTimer > 1.25
      ) {
        // Actor changed mind inside chamber and reversed toward outer door -> cycle exit cleanly
        phase = 'sealing-inner';
        phaseTimer = 0;
        audioCue = 'seal-inner';
      }
      break;
    }

    case 'inner-open-exit': {
      statusColor = 'green';
      dustShowerActive = false;
      purgeProgress = 0;
      if (isInsideChamber) {
        phase = 'sealing-inner';
        phaseTimer = 0;
        audioCue = 'seal-inner';
      } else if (!isNearInnerFromGarden && !isCrossingInner && !isAnyInChamberSpan && phaseTimer > 0.75) {
        phase = 'idle';
        phaseTimer = 0;
      }
      break;
    }

    case 'sealing-inner': {
      statusColor = 'red';
      dustShowerActive = false;
      purgeProgress = 0;
      if (innerDoorOpen <= 0.001) {
        phase = 'depressurizing';
        phaseTimer = 0;
        audioCue = 'airlock-depressurize';
      }
      break;
    }

    case 'depressurizing': {
      dustShowerActive = false;
      purgeProgress = Math.min(1, phaseTimer / GREENHOUSE_DEPRESSURIZE_SEC);
      statusColor = purgeProgress < 0.92 ? 'amber' : 'green';
      if (phaseTimer >= GREENHOUSE_DEPRESSURIZE_SEC) {
        purgeProgress = 1;
        statusColor = 'green';
        phase = 'outer-open-exit';
        phaseTimer = 0;
        audioCue = 'door-open';
      }
      break;
    }

    case 'outer-open-exit': {
      statusColor = 'green';
      dustShowerActive = false;
      purgeProgress = 1;
      if (!isAnyInChamberSpan && !isCrossingOuter && phaseTimer > 0.65) {
        phase = 'idle';
        phaseTimer = 0;
        dustPurgedComplete = false;
      }
      break;
    }
  }

  // Compute strict interlocked door targets
  const wantsOuterOpen = phase === 'outer-open-entry' || phase === 'outer-open-exit';
  const wantsInnerOpen = phase === 'inner-open-entry' || phase === 'inner-open-exit';

  const doorStep = GREENHOUSE_DOOR_SPEED * dt;

  if (wantsOuterOpen && innerDoorOpen <= 0.001) {
    innerDoorOpen = 0;
    outerDoorOpen = stepToward(outerDoorOpen, 1, doorStep);
  } else if (wantsInnerOpen && outerDoorOpen <= 0.001) {
    outerDoorOpen = 0;
    innerDoorOpen = stepToward(innerDoorOpen, 1, doorStep);
  } else {
    outerDoorOpen = stepToward(outerDoorOpen, 0, doorStep);
    innerDoorOpen = stepToward(innerDoorOpen, 0, doorStep);
  }

  // Hard mechanical invariant guard: both doors never open simultaneously
  if (outerDoorOpen > 0.001 && innerDoorOpen > 0.001) {
    if (wantsInnerOpen) {
      outerDoorOpen = 0;
    } else {
      innerDoorOpen = 0;
    }
  }

  return {
    phase,
    phaseTimer,
    outerDoorOpen,
    innerDoorOpen,
    purgeProgress,
    statusColor,
    dustShowerActive,
    dustPurgedComplete,
    lastCycleAudioCue: audioCue,
  };
}

function pushOutOfBox(
  px: number,
  pz: number,
  radius: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): { lx: number; lz: number; pushed: boolean } {
  const eMinX = minX - radius;
  const eMaxX = maxX + radius;
  const eMinZ = minZ - radius;
  const eMaxZ = maxZ + radius;
  if (px <= eMinX || px >= eMaxX || pz <= eMinZ || pz >= eMaxZ) {
    return { lx: px, lz: pz, pushed: false };
  }
  const dLeft = px - eMinX;
  const dRight = eMaxX - px;
  const dBack = pz - eMinZ;
  const dFront = eMaxZ - pz;
  const m = Math.min(dLeft, dRight, dBack, dFront);
  if (m === dLeft) return { lx: eMinX, lz: pz, pushed: true };
  if (m === dRight) return { lx: eMaxX, lz: pz, pushed: true };
  if (m === dBack) return { lx: px, lz: eMinZ, pushed: true };
  return { lx: px, lz: eMaxZ, pushed: true };
}

/**
 * Resolves exact local-space collision against the Mars Greenhouse shell, raised grow beds,
 * external tanks/solar array, and the 2-door pressurized airlock interlock.
 * Actors can enter ONLY through the outer door -> airlock chamber (after pressurize/purge) -> inner door -> aisle.
 */
export function resolveGreenhouseCollision(
  wx: number,
  wz: number,
  radius: number,
  airlockState: GreenhouseAirlockState,
  spec: MarsGreenhouseSpec = MARS_GREENHOUSE_SPEC
): { x: number; z: number; blocked: boolean; zone: GreenhouseZone } {
  let { lx, lz } = worldToGreenhouseLocal(wx, wz, spec);

  // Fast coarse reject
  if (lx < -1.8 || lx > 2.2 || lz < -2.2 || lz > 3.2) {
    return { x: wx, z: wz, blocked: false, zone: 'outside' };
  }

  let blocked = false;
  const outerPassable = airlockState.outerDoorOpen >= 0.72;
  const innerPassable = airlockState.innerDoorOpen >= 0.72;
  const corridorLimit = GREENHOUSE_CORRIDOR_HALF_WIDTH - radius;

  // 1. Inside main vegetable garden chamber (between left/right raised hydroponic beds)
  if (lz < GREENHOUSE_INNER_DOOR_Z && lz >= GREENHOUSE_GARDEN_Z_MIN - 0.08 && Math.abs(lx) < 0.85) {
    if (lx < -corridorLimit) {
      lx = -corridorLimit;
      blocked = true;
    } else if (lx > corridorLimit) {
      lx = corridorLimit;
      blocked = true;
    }
    if (lz < GREENHOUSE_GARDEN_Z_MIN + radius) {
      lz = GREENHOUSE_GARDEN_Z_MIN + radius;
      blocked = true;
    }
    if (!innerPassable && lz > GREENHOUSE_INNER_DOOR_Z - radius) {
      lz = GREENHOUSE_INNER_DOOR_Z - radius;
      blocked = true;
    }
    const world = greenhouseLocalToWorld(lx, lz, spec);
    return { x: world.wx, z: world.wz, blocked, zone: 'garden' };
  }

  // 2. Inside pressurized airlock vestibule chamber (strictly sealed during pressurization & dust purge)
  if (lz >= GREENHOUSE_INNER_DOOR_Z && lz <= GREENHOUSE_OUTER_DOOR_Z && Math.abs(lx) <= 0.44) {
    if (lx < -corridorLimit) {
      lx = -corridorLimit;
      blocked = true;
    } else if (lx > corridorLimit) {
      lx = corridorLimit;
      blocked = true;
    }
    if (!innerPassable && lz < GREENHOUSE_INNER_DOOR_Z + radius) {
      lz = GREENHOUSE_INNER_DOOR_Z + radius;
      blocked = true;
    }
    if (!outerPassable && lz > GREENHOUSE_OUTER_DOOR_Z - radius) {
      lz = GREENHOUSE_OUTER_DOOR_Z - radius;
      blocked = true;
    }
    const world = greenhouseLocalToWorld(lx, lz, spec);
    return { x: world.wx, z: world.wz, blocked, zone: 'airlock' };
  }

  // 3. Approaching on ramp right outside outer doorway (can only pass Z <= 2.24 when outer door is open)
  if (lz > GREENHOUSE_OUTER_DOOR_Z && Math.abs(lx) <= corridorLimit + 0.06) {
    if (!outerPassable && lz < GREENHOUSE_OUTER_DOOR_Z + radius) {
      lz = GREENHOUSE_OUTER_DOOR_Z + radius;
      blocked = true;
    }
    // Check ramp side limits vs airlock front cheeks if close
    const world = greenhouseLocalToWorld(lx, lz, spec);
    return {
      x: world.wx,
      z: world.wz,
      blocked,
      zone: lz <= GREENHOUSE_RAMP_END_Z + 0.35 ? 'ramp' : 'outside',
    };
  }

  // 4. Exterior structural boxes (sides & rear of main dome, airlock outer cheeks, water/CO2 tanks, solar array)
  const boxes: ReadonlyArray<[number, number, number, number]> = [
    // Main dome hull sides & rear
    [-1.06, 1.06, -1.24, 1.24],
    // Airlock left & right exterior cheeks
    [-0.48, -0.38, 1.20, 2.26],
    [0.38, 0.48, 1.20, 2.26],
    // Rear water tank & CO2 canister
    [-0.66, 0.50, -1.74, -1.20],
    // Solar array wing on +X flank
    [1.04, 1.72, -0.96, 0.84],
  ];

  for (const [minX, maxX, minZ, maxZ] of boxes) {
    const res = pushOutOfBox(lx, lz, radius, minX, maxX, minZ, maxZ);
    if (res.pushed) {
      lx = res.lx;
      lz = res.lz;
      blocked = true;
    }
  }

  // Outer door threshold barrier when touching from outside offset
  if (!outerPassable && Math.abs(lx) <= 0.48 && lz < GREENHOUSE_OUTER_DOOR_Z + radius && lz > 1.8) {
    lz = GREENHOUSE_OUTER_DOOR_Z + radius;
    blocked = true;
  }

  const world = greenhouseLocalToWorld(lx, lz, spec);
  return { x: world.wx, z: world.wz, blocked, zone: classifyGreenhouseZone(lx, lz) };
}

/**
 * Computes human-readable Vietnamese telemetry for the Drive Mode HUD when near/inside the Bio-Dome.
 */
export function describeAirlockForHud(
  state: GreenhouseAirlockState,
  zone: GreenhouseZone
): {
  zone: GreenhouseZone;
  phaseLabel: string;
  statusColor: AirlockStatusColor;
  progressPercent: number;
  outerDoorOpen: boolean;
  innerDoorOpen: boolean;
  dustPurged: boolean;
} {
  let phaseLabel = 'Ngoài nhà kính';
  if (state.phase === 'outer-open-entry') {
    phaseLabel = 'Cửa ngoài đã mở — Mời vào khoang đệm';
  } else if (state.phase === 'sealing-outer') {
    phaseLabel = 'Đang khóa kín cửa ngoài...';
  } else if (state.phase === 'pressurizing-purge') {
    phaseLabel = 'Cân bằng áp suất & Thổi bụi Perchlorate';
  } else if (state.phase === 'inner-open-entry') {
    phaseLabel = 'Áp suất ổn định — Cửa trong đã mở';
  } else if (state.phase === 'inner-open-exit') {
    phaseLabel = 'Cửa trong đã mở — Rời khu trồng rau';
  } else if (state.phase === 'sealing-inner') {
    phaseLabel = 'Đang khóa kín cửa trong...';
  } else if (state.phase === 'depressurizing') {
    phaseLabel = 'Xả cân bằng áp suất ra bề mặt Sao Hỏa';
  } else if (state.phase === 'outer-open-exit') {
    phaseLabel = 'Cửa ngoài đã mở — Lăn ra bề mặt Sao Hỏa';
  } else if (zone === 'garden') {
    phaseLabel = 'Bên trong Vườn Rau Thủy Canh (Đã khử bụi)';
  } else if (zone === 'ramp') {
    phaseLabel = 'Cửa khoang đệm điều áp 2 lớp';
  }

  return {
    zone,
    phaseLabel,
    statusColor: state.statusColor,
    progressPercent: Math.round(state.purgeProgress * 100),
    outerDoorOpen: state.outerDoorOpen >= 0.72,
    innerDoorOpen: state.innerDoorOpen >= 0.72,
    dustPurged: state.dustPurgedComplete,
  };
}
