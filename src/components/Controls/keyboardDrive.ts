export type CanonicalDriveKey =
  | 'KeyW'
  | 'KeyA'
  | 'KeyS'
  | 'KeyD'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Space'
  | 'ShiftLeft'
  | 'ShiftRight';

const DIRECT_DRIVE_CODES = new Set<string>([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
]);

const MOVEMENT_KEYS = new Set<CanonicalDriveKey>([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const KEY_CHAR_FALLBACK_MAP: Record<string, CanonicalDriveKey> = {
  w: 'KeyW',
  'ư': 'KeyW',
  a: 'KeyA',
  'ă': 'KeyA',
  'â': 'KeyA',
  s: 'KeyS',
  d: 'KeyD',
  'đ': 'KeyD',
  ' ': 'Space',
  spacebar: 'Space',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  shift: 'ShiftLeft',
};

const KEYCODE_FALLBACK_MAP: Record<number, CanonicalDriveKey> = {
  87: 'KeyW', // W
  65: 'KeyA', // A
  83: 'KeyS', // S
  68: 'KeyD', // D
  38: 'ArrowUp',
  40: 'ArrowDown',
  37: 'ArrowLeft',
  39: 'ArrowRight',
  32: 'Space',
  16: 'ShiftLeft',
};

export interface KeyboardLikeEvent {
  code?: string;
  key?: string;
  keyCode?: number;
}

/**
 * Normalizes WASD / Arrow / Space / Shift key events across standard keyboards,
 * virtual keyboards, and Vietnamese Telex/VNI IME composition states.
 */
export function normalizeDriveKeyCode(e: KeyboardLikeEvent): CanonicalDriveKey | null {
  if (e.code && DIRECT_DRIVE_CODES.has(e.code)) {
    return e.code as CanonicalDriveKey;
  }

  const normalizedKey = typeof e.key === 'string' ? e.key.toLowerCase() : '';
  if (normalizedKey && KEY_CHAR_FALLBACK_MAP[normalizedKey]) {
    return KEY_CHAR_FALLBACK_MAP[normalizedKey];
  }

  if (typeof e.keyCode === 'number' && KEYCODE_FALLBACK_MAP[e.keyCode]) {
    return KEYCODE_FALLBACK_MAP[e.keyCode];
  }

  return null;
}

export function isMovementDriveKey(code: CanonicalDriveKey | null): boolean {
  return code !== null && MOVEMENT_KEYS.has(code);
}

export function shouldIgnoreKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return Boolean(el.isContentEditable);
}

export function computeDriveVelocityFromKeys(
  keys: ReadonlySet<string>,
  speedLevel: number
): { linearVelocity: number; angularVelocity: number; isTurbo: boolean } {
  const isShiftPressed = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const isTurbo = speedLevel === 3 || isShiftPressed;

  const linearSpeed = isTurbo ? 1.1 : speedLevel === 1 ? 0.3 : 0.55;
  const reverseSpeed = isTurbo ? 0.84 : speedLevel === 1 ? 0.23 : 0.42;
  const angularSpeed = isTurbo ? 2.6 : speedLevel === 1 ? 1.4 : 1.9;

  let linear = 0;
  let angular = 0;

  if (keys.has('KeyW') || keys.has('ArrowUp')) linear += linearSpeed;
  if (keys.has('KeyS') || keys.has('ArrowDown')) linear -= reverseSpeed;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) angular += angularSpeed;
  if (keys.has('KeyD') || keys.has('ArrowRight')) angular -= angularSpeed;
  if (keys.has('Space')) {
    linear = 0;
    angular = 0;
  }

  return {
    linearVelocity: linear,
    angularVelocity: angular,
    isTurbo,
  };
}
