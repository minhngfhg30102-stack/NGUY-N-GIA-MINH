import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_DRIVE_CAMERA_FOV,
  MAX_TURBO_CAMERA_FOV,
  computeDriveEffectTelemetry,
  stepImpactTrauma,
} from './driveEffectsMath';

test('returns silent zeroed effects when not in Drive Mode', () => {
  const fx = computeDriveEffectTelemetry({
    isDriving: false,
    linearVel: 1.1,
    angularVel: 0,
    prevLinearVel: 0.8,
    delta: 0.016,
  });

  assert.equal(fx.mode, 'idle');
  assert.equal(fx.isMoving, false);
  assert.equal(fx.headlightIntensity, 0);
  assert.equal(fx.underglowIntensity, 0);
  assert.equal(fx.turboStreakIntensity, 0);
  assert.equal(fx.targetCameraFov, BASE_DRIVE_CAMERA_FOV);
});

test('enters cruise mode without headlights or underglow on normal forward driving', () => {
  const fx = computeDriveEffectTelemetry({
    isDriving: true,
    linearVel: 0.55,
    angularVel: 0,
    prevLinearVel: 0.55,
    delta: 0.016,
  });

  assert.equal(fx.mode, 'cruise');
  assert.equal(fx.isMoving, true);
  assert.equal(fx.isTurbo, false);
  assert.equal(fx.headlightIntensity, 0);
  assert.equal(fx.underglowIntensity, 0);
  assert.ok(fx.cruiseGlowIntensity > 0.5);
  assert.equal(fx.brakeIntensity, 0);
  assert.equal(fx.turboStreakIntensity, 0);
});

test('widens camera FOV at turbo velocity without wind streaks or headlights', () => {
  const fx = computeDriveEffectTelemetry({
    isDriving: true,
    linearVel: 1.1,
    angularVel: 0,
    prevLinearVel: 1.1,
    delta: 0.016,
  });

  assert.equal(fx.mode, 'turbo');
  assert.equal(fx.isTurbo, true);
  assert.equal(fx.headlightIntensity, 0);
  assert.equal(fx.underglowIntensity, 0);
  assert.equal(fx.turboStreakIntensity, 0);
  assert.ok(fx.targetCameraFov > BASE_DRIVE_CAMERA_FOV + 3);
  assert.ok(fx.targetCameraFov <= MAX_TURBO_CAMERA_FOV);
});

test('flares crimson brake lights on deceleration or explicit brake', () => {
  const fxDecel = computeDriveEffectTelemetry({
    isDriving: true,
    linearVel: 0.0,
    angularVel: 0,
    prevLinearVel: 0.55,
    delta: 0.016,
  });
  assert.equal(fxDecel.mode, 'brake');
  assert.equal(fxDecel.brakeIntensity, 1.0);

  const fxExplicit = computeDriveEffectTelemetry({
    isDriving: true,
    linearVel: 0.1,
    angularVel: 0,
    prevLinearVel: 0.1,
    isBraking: true,
    delta: 0.016,
  });
  assert.equal(fxExplicit.mode, 'brake');
  assert.equal(fxExplicit.brakeIntensity, 1.0);
});

test('activates reverse lights when moving backward', () => {
  const fx = computeDriveEffectTelemetry({
    isDriving: true,
    linearVel: -0.45,
    angularVel: 0,
    prevLinearVel: -0.45,
    delta: 0.016,
  });

  assert.equal(fx.mode, 'reverse');
  assert.equal(fx.isReversing, true);
  assert.ok(fx.reverseIntensity > 0.7);
});

test('stepImpactTrauma clamps to 1 and decays smoothly toward 0', () => {
  const hit = stepImpactTrauma(0.2, 0.95, 0.016);
  assert.ok(hit <= 1.0 && hit > 0.9);

  let t = hit;
  for (let i = 0; i < 40; i++) {
    t = stepImpactTrauma(t, 0, 0.03);
  }
  assert.equal(t, 0);
});
