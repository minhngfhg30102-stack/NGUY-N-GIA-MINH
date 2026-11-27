import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureDriveOrbitOffset,
  clampDriveFollowZoom,
  computeDefaultDriveCameraPosition,
  computeDisplacedDriveCamera,
  computeInspectPresetPose,
  computeRestoredDriveCamera,
  computeRotatedOrbitOffset,
  createInitialDriveCamera,
  createInitialInspectCamera,
} from './sceneModeCamera.ts';

test('Inspection and Drive snapshots start completely independent', () => {
  const inspect = createInitialInspectCamera();
  const drive = createInitialDriveCamera();

  assert.deepEqual(inspect.target, [0, 0.16, 0]);
  assert.deepEqual(inspect.position, [0.68, 0.44, 0.68]);

  const initialDrivePose = computeRestoredDriveCamera(drive, 0, 0, 0, 0);
  assert.deepEqual(initialDrivePose.target, [0, 0.14, 0]);
  // Camera sits cleanly behind robot (-Z) and never inside the robot origin
  assert.ok(initialDrivePose.position[2] < -1.0);
  assert.ok(initialDrivePose.position[1] > 0.5);
});

test('Driving far away and returning to Inspection leaves Inspection centered at origin', () => {
  let inspect = createInitialInspectCamera();
  let drive = createInitialDriveCamera();

  // User orbited in Inspection mode before switching
  inspect = {
    position: [0.42, 0.31, -0.55],
    target: [0, 0.15, 0],
  };

  // User switches to Drive mode and drives JetBot to distant Mars coordinates
  const robotX = 5.4;
  const robotZ = -4.2;
  const terrainElev = 0.35;
  const robotHeading = Math.PI / 3;

  // First entry into Drive mode places camera directly behind robot (no fly-through from inspect)
  const enterDrivePose = computeRestoredDriveCamera(
    drive,
    robotX,
    terrainElev,
    robotZ,
    robotHeading
  );
  assert.ok(
    Math.hypot(
      enterDrivePose.position[0] - enterDrivePose.target[0],
      enterDrivePose.position[2] - enterDrivePose.target[2]
    ) > 1.0
  );

  // User orbits manually in Drive mode while out on Mars
  drive = {
    ...drive,
    hasCustomOrbit: true,
    orbitOffset: captureDriveOrbitOffset([6.5, 1.2, -3.4], [robotX, 0.14 + terrainElev, robotZ]),
  };

  // Returning to Inspection must keep Inspection target at [0, 0.15, 0], never stranded at Mars [5.4, *, -4.2]
  assert.deepEqual(inspect.target, [0, 0.15, 0]);
  assert.deepEqual(inspect.position, [0.42, 0.31, -0.55]);

  // Returning back to Drive mode later restores the custom orbit right around Mars coordinates
  const reEnterDrivePose = computeRestoredDriveCamera(
    drive,
    robotX,
    terrainElev,
    robotZ,
    robotHeading
  );
  assert.deepEqual(reEnterDrivePose.target, [robotX, 0.14 + terrainElev, robotZ]);
  assert.ok(Math.abs(reEnterDrivePose.position[0] - 6.5) < 1e-6);
  assert.ok(Math.abs(reEnterDrivePose.position[2] - -3.4) < 1e-6);
});

test('Drive zoom clamping and reset do not mutate Inspection camera', () => {
  const inspect = createInitialInspectCamera();
  let drive = createInitialDriveCamera();

  drive = clampDriveFollowZoom(drive, -0.5);
  assert.ok(drive.followDistance < 1.15);
  assert.ok(drive.followHeight < 0.75);

  const behindOrigin = computeDefaultDriveCameraPosition(0, 0, 0, 0, drive.followDistance, drive.followHeight);
  assert.ok(behindOrigin[2] < 0);

  // Inspection snapshot remains untouched
  assert.deepEqual(inspect, createInitialInspectCamera());
});

test('Inspection preset poses cover all 5 angles cleanly', () => {
  for (const preset of ['iso', 'top', 'front', 'bottom', 'side'] as const) {
    const pose = computeInspectPresetPose(preset);
    assert.equal(pose.position.length, 3);
    assert.equal(pose.target.length, 3);
  }
});

test('computeDisplacedDriveCamera preserves user orbit offset across XZ travel and Mars hill climb', () => {
  const startCam: [number, number, number] = [0.8, 1.1, -0.9];
  const displaced = computeDisplacedDriveCamera(startCam, 2.5, 0.45, 3.0, 1.0, 0.15, 1.0);

  // Robot moved (+1.5, +0.3, +2.0), so camera must move identically
  assert.ok(Math.abs(displaced.position[0] - 2.3) < 1e-6);
  assert.ok(Math.abs(displaced.position[1] - 1.4) < 1e-6);
  assert.ok(Math.abs(displaced.position[2] - 1.1) < 1e-6);
  assert.equal(displaced.target[0], 2.5);
  assert.ok(Math.abs(displaced.target[1] - 0.59) < 1e-6);
  assert.equal(displaced.target[2], 3.0);

  // Exact relative orbit offset stays unchanged relative to the robot target
  const originalOffset = captureDriveOrbitOffset(startCam, [1.0, 0.14 + 0.15, 1.0]);
  assert.ok(Math.abs(displaced.orbitOffset[0] - originalOffset[0]) < 1e-6);
  assert.ok(Math.abs(displaced.orbitOffset[1] - originalOffset[1]) < 1e-6);
  assert.ok(Math.abs(displaced.orbitOffset[2] - originalOffset[2]) < 1e-6);
});

test('computeRotatedOrbitOffset orbits azimuth cleanly without losing radius or violating polar limits', () => {
  const startOffset: [number, number, number] = [0, 0.6, -1.2];
  const startRadius = Math.hypot(...startOffset);
  const rotated = computeRotatedOrbitOffset(startOffset, Math.PI / 2, -0.2, 0.06, Math.PI * 0.48);

  const nextRadius = Math.hypot(...rotated);
  assert.ok(Math.abs(nextRadius - startRadius) < 1e-6);
  // Rotating azimuth by +90 deg from -Z shifts X away from 0
  assert.ok(Math.abs(rotated[0]) > 0.5);
  // Polar clamp prevents flipping underground
  const extremeLow = computeRotatedOrbitOffset(startOffset, 0, 5.0, 0.06, Math.PI * 0.48);
  assert.ok(extremeLow[1] > 0);
});
