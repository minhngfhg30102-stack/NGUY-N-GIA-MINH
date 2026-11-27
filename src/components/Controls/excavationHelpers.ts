import { ExcavationComponent } from '../../types/excavation';
import { AstronautDigStatus, DigMode } from '../../types/robot';

/**
 * Maximum distance (meters) between the Astronaut and JetBot
 * where pressing [Z] transfers the excavated component to JetBot.
 */
export const ASTRONAUT_HANDOFF_RANGE_METERS = 1.05;

/**
 * Target distance (meters) at which the Astronaut stops in front/beside JetBot
 * so they remain clearly visible and never clip inside JetBot's chassis.
 */
export const ASTRONAUT_STOP_DISTANCE_METERS = 0.68;

/**
 * Weighted random roll from the Mars excavation component catalog.
 */
export function rollWeightedExcavationComponent(
  items: ExcavationComponent[],
  rng: () => number = Math.random
): ExcavationComponent {
  if (items.length === 0) {
    throw new Error('Excavation items list cannot be empty');
  }
  const totalWeight = items.reduce((acc, item) => acc + Math.max(0, item.dropWeight), 0);
  if (totalWeight <= 0) {
    return items[0];
  }
  let roll = rng() * totalWeight;
  for (const item of items) {
    roll -= Math.max(0, item.dropWeight);
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

/**
 * Checks whether JetBot can press [Z] right now to receive the item carried by the astronaut.
 */
export function canJetBotReceiveFromAstronaut(
  status: AstronautDigStatus | undefined,
  distanceToBot: number | undefined
): boolean {
  if (status !== 'carrying' && status !== 'ready-handoff') {
    return false;
  }
  if (typeof distanceToBot !== 'number' || Number.isNaN(distanceToBot)) {
    return false;
  }
  return distanceToBot <= ASTRONAUT_HANDOFF_RANGE_METERS;
}

/**
 * Evaluates whether starting a dig in the selected mode is currently permitted.
 */
export function canTriggerDigAction(params: {
  digMode: DigMode;
  isDirectDigging: boolean;
  astronautStatus: AstronautDigStatus | undefined;
  environmentMap: 'mars-planet' | 'cmu-arena';
  isDriveActive: boolean;
}): boolean {
  if (!params.isDriveActive || params.environmentMap !== 'mars-planet') {
    return false;
  }
  if (params.isDirectDigging) {
    return false;
  }
  if (params.digMode === 'astronaut') {
    return !params.astronautStatus || params.astronautStatus === 'idle';
  }
  return true;
}
