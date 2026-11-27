import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDustParticleVisual, computeWheelDustSpawnParams } from './wheelDustMath';

test('emits zero wheel dust when stationary or outside drive mode', () => {
  const notDriving = computeWheelDustSpawnParams({
    isDriving: false,
    linearVel: 0.8,
    angularVel: 0,
    environmentMap: 'mars-planet',
  });
  assert.equal(notDriving.shouldEmit, false);
  assert.equal(notDriving.puffsPerWheel, 0);

  const parkedOnMars = computeWheelDustSpawnParams({
    isDriving: true,
    linearVel: 0,
    angularVel: 0,
    environmentMap: 'mars-planet',
  });
  assert.equal(parkedOnMars.shouldEmit, false);
  assert.equal(parkedOnMars.intensity, 0);
});

test('emits moderate dust in normal cruise and stronger faster puffs in turbo on Mars', () => {
  const cruise = computeWheelDustSpawnParams({
    isDriving: true,
    linearVel: 0.55,
    angularVel: 0,
    environmentMap: 'mars-planet',
  });
  const turbo = computeWheelDustSpawnParams({
    isDriving: true,
    linearVel: 1.1,
    angularVel: 0,
    environmentMap: 'mars-planet',
  });

  assert.equal(cruise.shouldEmit, true);
  assert.equal(turbo.shouldEmit, true);
  assert.equal(cruise.puffsPerWheel, 1);
  assert.equal(turbo.puffsPerWheel, 2);
  assert.ok(turbo.intensity > cruise.intensity);
  assert.ok(turbo.spawnInterval < cruise.spawnInterval);
  assert.ok(turbo.sizeScale > cruise.sizeScale);
  assert.ok(turbo.gravity < 0.1, 'Mars uses lighter 0.38g dust settling gravity');
});

test('emits dust when spinning in place or braking sharply', () => {
  const spin = computeWheelDustSpawnParams({
    isDriving: true,
    linearVel: 0,
    angularVel: 1.8,
    environmentMap: 'cmu-arena',
  });
  assert.equal(spin.shouldEmit, true);
  assert.ok(spin.gravity > 0.1);

  const brakeKick = computeWheelDustSpawnParams({
    isDriving: true,
    linearVel: 0.4,
    angularVel: 0,
    isBraking: true,
    environmentMap: 'mars-planet',
  });
  assert.equal(brakeKick.shouldEmit, true);
  assert.equal(brakeKick.puffsPerWheel, 2);
});

test('dust puff blooms cleanly in size and fades smoothly to zero alpha without popping', () => {
  const start = computeDustParticleVisual(0, 0.04, 0.16, 0.52);
  const peak = computeDustParticleVisual(0.22, 0.04, 0.16, 0.52);
  const end = computeDustParticleVisual(1, 0.04, 0.16, 0.52);

  assert.equal(start.alpha, 0);
  assert.equal(start.scale, 0.04);
  assert.ok(peak.alpha > 0.35 && peak.alpha <= 0.52);
  assert.ok(peak.scale > 0.04 && peak.scale < 0.16);
  assert.equal(end.alpha, 0);
  assert.ok(Math.abs(end.scale - 0.16) < 1e-6);
});
