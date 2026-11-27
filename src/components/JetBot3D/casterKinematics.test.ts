import test from 'node:test';
import assert from 'node:assert/strict';
import { stepCasterKinematics } from './casterKinematics';

test('straight forward travel keeps fork aligned at 0 and rolls wheel forward', () => {
  let state = { swivelAngle: 0, rollAngle: 0 };
  state = stepCasterKinematics(state, 0.5, 0, 0.105, 0.021, 0.016);
  assert.ok(Math.abs(state.swivelAngle) < 1e-6);
  assert.ok(state.rollAngle > 0);
});

test('turning causes front and rear casters to counter-swivel tangent to turn arc', () => {
  let front = { swivelAngle: 0, rollAngle: 0 };
  let rear = { swivelAngle: 0, rollAngle: 0 };

  for (let i = 0; i < 60; i++) {
    front = stepCasterKinematics(front, 0.4, 2.0, 0.105, 0.021, 0.016);
    rear = stepCasterKinematics(rear, 0.4, 2.0, -0.105, 0.021, 0.016);
  }

  // Front (+Z) swings toward +X => positive Y swivel; Rear (-Z) swings toward -X => negative Y swivel
  assert.ok(front.swivelAngle > 0.35 && front.swivelAngle < 0.65, `front=${front.swivelAngle}`);
  assert.ok(rear.swivelAngle < -0.35 && rear.swivelAngle > -0.65, `rear=${rear.swivelAngle}`);
  assert.ok(Math.abs(front.swivelAngle + rear.swivelAngle) < 0.02);
});

test('spin in place aligns front and rear casters ±90 deg and rolls rollers', () => {
  let front = { swivelAngle: 0, rollAngle: 0 };
  let rear = { swivelAngle: 0, rollAngle: 0 };

  for (let i = 0; i < 90; i++) {
    front = stepCasterKinematics(front, 0, 2.5, 0.105, 0.021, 0.016);
    rear = stepCasterKinematics(rear, 0, 2.5, -0.105, 0.021, 0.016);
  }

  assert.ok(Math.abs(front.swivelAngle - Math.PI / 2) < 0.05, `front=${front.swivelAngle}`);
  assert.ok(Math.abs(rear.swivelAngle + Math.PI / 2) < 0.05, `rear=${rear.swivelAngle}`);
  assert.ok(front.rollAngle > 1.0);
  assert.ok(rear.rollAngle > 1.0);
});

test('reversing smoothly rotates caster fork 180 deg without instantaneous snap', () => {
  let state = { swivelAngle: 0.05, rollAngle: 0 };
  const firstStep = stepCasterKinematics(state, -0.5, 0, 0.105, 0.021, 0.016);
  // Bounded angular velocity per frame ensures smooth bearing sweep
  assert.ok(Math.abs(firstStep.swivelAngle - state.swivelAngle) < 0.3);

  state = firstStep;
  for (let i = 0; i < 80; i++) {
    state = stepCasterKinematics(state, -0.5, 0, 0.105, 0.021, 0.016);
  }
  assert.ok(Math.abs(Math.abs(state.swivelAngle) - Math.PI) < 0.05, `rev=${state.swivelAngle}`);
});

test('stopping holds caster swivel angle without snapping back to zero', () => {
  const parked = { swivelAngle: 0.72, rollAngle: 3.0 };
  const afterStop = stepCasterKinematics(parked, 0, 0, 0.105, 0.021, 0.016);
  assert.equal(afterStop.swivelAngle, 0.72);
  assert.equal(afterStop.rollAngle, 3.0);
});
