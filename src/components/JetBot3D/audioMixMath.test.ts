import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAmbientAudioParams } from './audioMixMath';

test('returns silent zero gains when drive mode is inactive', () => {
  const res = computeAmbientAudioParams({
    isDriveMode: false,
    isMuted: false,
    environmentMap: 'mars-planet',
    linearVelocity: 0.8,
    angularVelocity: 1.5,
    elapsedSeconds: 4.2,
  });

  assert.equal(res.active, false);
  assert.equal(res.windGain, 0);
  assert.equal(res.marsRumbleGain, 0);
  assert.equal(res.servoBuzzGain, 0);
  assert.equal(res.servoWhirGain, 0);
});

test('returns silent zero gains when muted even while driving', () => {
  const res = computeAmbientAudioParams({
    isDriveMode: true,
    isMuted: true,
    environmentMap: 'mars-planet',
    linearVelocity: 1.1,
    angularVelocity: 0,
    elapsedSeconds: 2.0,
  });

  assert.equal(res.active, false);
  assert.equal(res.windGain, 0);
  assert.equal(res.servoBuzzGain, 0);
});

test('strictly disables wind and storm rumble on Mars while preserving servo buzz in drive mode', () => {
  const marsIdle = computeAmbientAudioParams({
    isDriveMode: true,
    isMuted: false,
    environmentMap: 'mars-planet',
    linearVelocity: 0,
    angularVelocity: 0,
    elapsedSeconds: 1.5,
  });

  const marsMoving = computeAmbientAudioParams({
    isDriveMode: true,
    isMuted: false,
    environmentMap: 'mars-planet',
    linearVelocity: 1.2,
    angularVelocity: 1.5,
    elapsedSeconds: 4.8,
  });

  assert.equal(marsIdle.active, true);
  assert.equal(marsIdle.windGain, 0);
  assert.equal(marsIdle.marsRumbleGain, 0);
  assert.equal(marsMoving.windGain, 0);
  assert.equal(marsMoving.marsRumbleGain, 0);
  assert.ok(marsIdle.servoBuzzGain > 0);
  assert.ok(marsIdle.servoWhirGain > 0);
});

test('scales servo buzz frequency, chatter rate, and filter cutoff with motion and steering', () => {
  const idle = computeAmbientAudioParams({
    isDriveMode: true,
    isMuted: false,
    environmentMap: 'mars-planet',
    linearVelocity: 0,
    angularVelocity: 0,
    elapsedSeconds: 3,
  });

  const moving = computeAmbientAudioParams({
    isDriveMode: true,
    isMuted: false,
    environmentMap: 'mars-planet',
    linearVelocity: 1.1,
    angularVelocity: 2.2,
    elapsedSeconds: 3,
  });

  assert.ok(moving.servoBuzzGain > idle.servoBuzzGain);
  assert.ok(moving.servoWhirGain > idle.servoWhirGain);
  assert.ok(moving.servoBuzzFreqHz > idle.servoBuzzFreqHz);
  assert.ok(moving.servoWhirFreqHz > idle.servoWhirFreqHz);
  assert.ok(moving.servoFilterHz > idle.servoFilterHz);
  assert.ok(moving.servoChatterRateHz > idle.servoChatterRateHz);
});
