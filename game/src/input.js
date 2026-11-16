// Keyboard and pointer input. Held keys give a steering direction; one-shot presses (start
// or restart, flare, pause, blessing picks, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice. Pointer
// position is kept in canvas pixels for clicks on blessing cards.

export const ACTION_CONFIRM = 1;
export const ACTION_FLARE = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_PICK_1 = 16;
export const ACTION_PICK_2 = 32;
export const ACTION_PICK_3 = 64;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const PICKS = new Map([['Digit1', ACTION_PICK_1], ['Digit2', ACTION_PICK_2], ['Digit3', ACTION_PICK_3]]);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let actions = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerDown = false;
  let confirmHeld = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (CONFIRM.has(event.code)) {
      confirmHeld = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (PICKS.has(event.code)) {
      if (!event.repeat) actions |= PICKS.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (CONFIRM.has(event.code)) confirmHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    confirmHeld = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    pointerDown = true;
    actions |= ACTION_CONFIRM | ACTION_FLARE;
  });
  target.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  return {
    /** Steering direction, each axis -1, 0 or 1 (0 when both or neither are held). */
    direction() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Last pointer position in canvas pixels, and whether the button is held. */
    pointer() {
      return { x: pointerX, y: pointerY, down: pointerDown };
    },
    /** Whether a flare is being held down: mouse button or Space/Enter. */
    flareHeld() {
      return pointerDown || confirmHeld;
    },
  };
}
