import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASTRONAUT_HANDOFF_RANGE_METERS,
  ASTRONAUT_STOP_DISTANCE_METERS,
  canJetBotReceiveFromAstronaut,
  canTriggerDigAction,
  rollWeightedExcavationComponent,
} from './excavationHelpers';
import { EXCAVATION_COMPONENTS } from '../../data/excavationData';

test('rollWeightedExcavationComponent selects first/last items deterministically by dropWeight', () => {
  const first = rollWeightedExcavationComponent(EXCAVATION_COMPONENTS, () => 0);
  assert.equal(first.id, EXCAVATION_COMPONENTS[0].id);

  const last = rollWeightedExcavationComponent(EXCAVATION_COMPONENTS, () => 0.999999);
  assert.equal(last.id, EXCAVATION_COMPONENTS[EXCAVATION_COMPONENTS.length - 1].id);
});

test('canJetBotReceiveFromAstronaut requires carrying/ready-handoff AND distance within handoff threshold', () => {
  assert.equal(canJetBotReceiveFromAstronaut('idle', 0.5), false);
  assert.equal(canJetBotReceiveFromAstronaut('digging', 0.5), false);
  assert.equal(canJetBotReceiveFromAstronaut('carrying', 1.8), false);
  assert.equal(canJetBotReceiveFromAstronaut('carrying', ASTRONAUT_HANDOFF_RANGE_METERS), true);
  assert.equal(canJetBotReceiveFromAstronaut('ready-handoff', ASTRONAUT_STOP_DISTANCE_METERS), true);
  assert.equal(canJetBotReceiveFromAstronaut('ready-handoff', undefined), false);
});

test('canTriggerDigAction blocks overlapping astronaut missions and non-Mars maps', () => {
  assert.equal(
    canTriggerDigAction({
      digMode: 'astronaut',
      isDirectDigging: false,
      astronautStatus: 'idle',
      environmentMap: 'mars-planet',
      isDriveActive: true,
    }),
    true
  );

  assert.equal(
    canTriggerDigAction({
      digMode: 'astronaut',
      isDirectDigging: false,
      astronautStatus: 'carrying',
      environmentMap: 'mars-planet',
      isDriveActive: true,
    }),
    false
  );

  assert.equal(
    canTriggerDigAction({
      digMode: 'jetbot',
      isDirectDigging: false,
      astronautStatus: 'carrying',
      environmentMap: 'mars-planet',
      isDriveActive: true,
    }),
    true
  );

  assert.equal(
    canTriggerDigAction({
      digMode: 'astronaut',
      isDirectDigging: false,
      astronautStatus: 'idle',
      environmentMap: 'cmu-arena',
      isDriveActive: true,
    }),
    false
  );
});
