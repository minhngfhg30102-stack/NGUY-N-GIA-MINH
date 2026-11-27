import test from 'node:test';
import assert from 'node:assert/strict';
import { MARS_GREENHOUSE_SPEC, sampleMarsTerrainPointElevation } from './marsAtmosphereMath';
import {
  createInitialAirlockState,
  GREENHOUSE_DEPRESSURIZE_SEC,
  GREENHOUSE_OUTER_DOOR_Z,
  GREENHOUSE_PRESSURIZE_SEC,
  greenhouseLocalToWorld,
  resolveGreenhouseCollision,
  sampleGreenhouseElevationAt,
  stepGreenhouseAirlock,
  worldToGreenhouseLocal,
} from './marsGreenhouseAirlock';

test('worldToGreenhouseLocal and greenhouseLocalToWorld are exact inverses', () => {
  const sample = greenhouseLocalToWorld(0.24, 1.85);
  const back = worldToGreenhouseLocal(sample.wx, sample.wz);
  assert.ok(Math.abs(back.lx - 0.24) < 1e-6);
  assert.ok(Math.abs(back.lz - 1.85) < 1e-6);
});

test('extended greenhouse ramp tip sits on completely flat Martian ground away from mounds and craters', () => {
  const rampTip = greenhouseLocalToWorld(0, 2.86);
  const elevAtTip = sampleMarsTerrainPointElevation(rampTip.wx, rampTip.wz, [
    { x: 2.4, z: 1.8, radius: 1.6, height: 0.28 },
    { x: 0.2, z: 4.2, radius: 1.8, height: 0.34 },
  ]);
  assert.equal(elevAtTip, 0);

  const deckElev = sampleGreenhouseElevationAt(MARS_GREENHOUSE_SPEC.x, MARS_GREENHOUSE_SPEC.z);
  assert.ok(deckElev > 0.08);
});

test('two airlock doors NEVER open simultaneously across complete entry and exit cycle', () => {
  let state = createInitialAirlockState();

  const assertInterlock = () => {
    assert.ok(
      !(state.outerDoorOpen > 0.001 && state.innerDoorOpen > 0.001),
      `Doors violated interlock: outer=${state.outerDoorOpen}, inner=${state.innerDoorOpen}, phase=${state.phase}`
    );
  };

  // 1. Approach outer ramp -> outer door opens while inner remains sealed
  for (let i = 0; i < 10; i++) {
    state = stepGreenhouseAirlock(state, [{ id: 'bot', localX: 0, localZ: 2.55 }], 0.1);
    assertInterlock();
  }
  assert.equal(state.phase, 'outer-open-entry');
  assert.ok(state.outerDoorOpen >= 0.72);
  assert.equal(state.innerDoorOpen, 0);

  // 2. Enter chamber -> outer door seals tightly -> pressurizing & air-shower dust purge runs
  for (let i = 0; i < 8; i++) {
    state = stepGreenhouseAirlock(state, [{ id: 'bot', localX: 0, localZ: 1.72 }], 0.1);
    assertInterlock();
  }
  assert.equal(state.phase, 'pressurizing-purge');
  assert.equal(state.outerDoorOpen, 0);
  assert.equal(state.innerDoorOpen, 0);
  assert.equal(state.dustShowerActive, true);

  // While pressurizing, JetBot cannot push through the inner door
  const blockedMidPurge = greenhouseLocalToWorld(0, 1.12);
  const colMid = resolveGreenhouseCollision(blockedMidPurge.wx, blockedMidPurge.wz, 0.16, state);
  assert.equal(colMid.blocked, true);

  // 3. Finish pressurization -> inner door opens while outer stays 0
  const steps = Math.ceil((GREENHOUSE_PRESSURIZE_SEC + 0.6) / 0.1);
  for (let i = 0; i < steps; i++) {
    state = stepGreenhouseAirlock(state, [{ id: 'bot', localX: 0, localZ: 1.72 }], 0.1);
    assertInterlock();
  }
  assert.equal(state.phase, 'inner-open-entry');
  assert.equal(state.outerDoorOpen, 0);
  assert.ok(state.innerDoorOpen >= 0.72);
  assert.equal(state.dustPurgedComplete, true);
  assert.equal(state.statusColor, 'green');

  // 4. Drive into garden -> inner door seals behind
  for (let i = 0; i < 8; i++) {
    state = stepGreenhouseAirlock(state, [{ id: 'bot', localX: 0, localZ: 0.2 }], 0.1);
    assertInterlock();
  }
  assert.equal(state.phase, 'idle');
  assert.equal(state.innerDoorOpen, 0);

  // 5. Exit sequence: approach inner door from garden -> inner opens -> enter chamber -> inner seals -> depressurizes -> outer opens
  for (let i = 0; i < 8; i++) {
    state = stepGreenhouseAirlock(state, [{ id: 'bot', localX: 0, localZ: 1.0 }], 0.1);
    assertInterlock();
  }
  assert.equal(state.phase, 'inner-open-exit');
  assert.ok(state.innerDoorOpen >= 0.72);
  assert.equal(state.outerDoorOpen, 0);

  const exitSteps = Math.ceil((GREENHOUSE_DEPRESSURIZE_SEC + 1.4) / 0.1);
  for (let i = 0; i < exitSteps; i++) {
    state = stepGreenhouseAirlock(state, [{ id: 'bot', localX: 0, localZ: 1.72 }], 0.1);
    assertInterlock();
  }
  assert.equal(state.phase, 'outer-open-exit');
  assert.equal(state.innerDoorOpen, 0);
  assert.ok(state.outerDoorOpen >= 0.72);
});

test('solid exterior walls and hydroponic beds block clipping from flanks and aisle edges', () => {
  const closedState = createInitialAirlockState();
  // Try walking straight through side glass wall
  const sideWall = greenhouseLocalToWorld(-0.98, 0.0);
  const resSide = resolveGreenhouseCollision(sideWall.wx, sideWall.wz, 0.16, closedState);
  assert.equal(resSide.blocked, true);

  // Try bypassing closed outer airlock door from ramp
  const closedFront = greenhouseLocalToWorld(0, GREENHOUSE_OUTER_DOOR_Z);
  const resFront = resolveGreenhouseCollision(closedFront.wx, closedFront.wz, 0.16, closedState);
  assert.equal(resFront.blocked, true);

  // Inside aisle, hitting raised hydroponic bed at lx = +0.35 gets clamped cleanly to center aisle
  const inBed = greenhouseLocalToWorld(0.35, 0.0);
  const resBed = resolveGreenhouseCollision(inBed.wx, inBed.wz, 0.16, closedState);
  assert.equal(resBed.blocked, true);
  assert.equal(resBed.zone, 'garden');
});
