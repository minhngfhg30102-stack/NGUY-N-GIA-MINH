import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeDriveVelocityFromKeys,
  isMovementDriveKey,
  normalizeDriveKeyCode,
  shouldIgnoreKeyboardTarget,
} from './keyboardDrive.ts';

test('normalizeDriveKeyCode handles physical codes, virtual keyboards, and Vietnamese Telex characters', () => {
  assert.equal(normalizeDriveKeyCode({ code: 'KeyW', key: 'w' }), 'KeyW');
  assert.equal(normalizeDriveKeyCode({ code: 'KeyA', key: 'a' }), 'KeyA');
  assert.equal(normalizeDriveKeyCode({ code: 'KeyS', key: 's' }), 'KeyS');
  assert.equal(normalizeDriveKeyCode({ code: 'KeyD', key: 'd' }), 'KeyD');

  // Empty code fallback (e.g. mobile/IME keyboards)
  assert.equal(normalizeDriveKeyCode({ code: '', key: 'w' }), 'KeyW');
  assert.equal(normalizeDriveKeyCode({ code: '', key: 'ư' }), 'KeyW');
  assert.equal(normalizeDriveKeyCode({ code: '', key: 'ă' }), 'KeyA');
  assert.equal(normalizeDriveKeyCode({ code: '', key: 'â' }), 'KeyA');
  assert.equal(normalizeDriveKeyCode({ code: '', key: 'đ' }), 'KeyD');

  // KeyCode fallback during composition
  assert.equal(normalizeDriveKeyCode({ code: 'Unidentified', key: 'Process', keyCode: 87 }), 'KeyW');
  assert.equal(normalizeDriveKeyCode({ code: 'Unidentified', key: 'Process', keyCode: 68 }), 'KeyD');
  assert.equal(normalizeDriveKeyCode({ code: '', key: '', keyCode: 32 }), 'Space');

  assert.equal(isMovementDriveKey('KeyW'), true);
  assert.equal(isMovementDriveKey('ArrowRight'), true);
  assert.equal(isMovementDriveKey('Space'), false);
  assert.equal(isMovementDriveKey(null), false);
});

test('shouldIgnoreKeyboardTarget blocks editors/dropdowns but allows driving when buttons or canvas are focused', () => {
  assert.equal(shouldIgnoreKeyboardTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget), true);
  assert.equal(shouldIgnoreKeyboardTarget({ tagName: 'INPUT' } as unknown as EventTarget), true);
  assert.equal(shouldIgnoreKeyboardTarget({ tagName: 'SELECT' } as unknown as EventTarget), true);
  assert.equal(
    shouldIgnoreKeyboardTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    true
  );

  // Focusing a tab or reset button must NOT prevent WASD driving
  assert.equal(shouldIgnoreKeyboardTarget({ tagName: 'BUTTON' } as unknown as EventTarget), false);
  assert.equal(shouldIgnoreKeyboardTarget({ tagName: 'CANVAS' } as unknown as EventTarget), false);
  assert.equal(shouldIgnoreKeyboardTarget(null), false);
});

test('computeDriveVelocityFromKeys supports combined steering, Shift turbo, and Space brake', () => {
  const forwardTurn = new Set(['KeyW', 'KeyA']);
  const res1 = computeDriveVelocityFromKeys(forwardTurn, 2);
  assert.equal(res1.linearVelocity, 0.55);
  assert.equal(res1.angularVelocity, 1.9);
  assert.equal(res1.isTurbo, false);

  const turboTurn = new Set(['KeyW', 'KeyD', 'ShiftLeft']);
  const res2 = computeDriveVelocityFromKeys(turboTurn, 2);
  assert.equal(res2.linearVelocity, 1.1);
  assert.equal(res2.angularVelocity, -2.6);
  assert.equal(res2.isTurbo, true);

  const braked = new Set(['KeyW', 'Space']);
  const res3 = computeDriveVelocityFromKeys(braked, 3);
  assert.equal(res3.linearVelocity, 0);
  assert.equal(res3.angularVelocity, 0);
});
