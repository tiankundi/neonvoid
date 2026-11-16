// Keyboard and mouse, read as state: the main loop asks each frame which way the player
// moves, where the aim points and whether the trigger is held, and drains one-shot actions
// (confirm, pause, dash, upgrade picks) that key presses and clicks have queued.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_PICK_1 = 8;
export const ACTION_PICK_2 = 16;
export const ACTION_PICK_3 = 32;
export const ACTION_MUTE = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  ShiftLeft: ACTION_DASH,
  ShiftRight: ACTION_DASH,
  Digit1: ACTION_PICK_1,
  Digit2: ACTION_PICK_2,
  Digit3: ACTION_PICK_3,
  Numpad1: ACTION_PICK_1,
  Numpad2: ACTION_PICK_2,
  Numpad3: ACTION_PICK_3,
  KeyM: ACTION_MUTE,
};

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/**
 * Listen on the canvas and window. Returns the reader the loop uses:
 * direction() (a unit vector or [0, 0]), aim() (canvas pixels), firing(), and
 * takeActions() (the queued one-shot actions, drained).
 */
export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    if (!event.repeat) {
      held.add(event.code);
      const action = KEY_ACTIONS[event.code === 'Space' ? ' ' : event.code];
      if (action) actions |= action;
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', toCanvas);
  canvas.addEventListener('mousedown', (event) => {
    toCanvas(event);
    if (event.button === 0) {
      mouse.down = true;
      actions |= ACTION_CONFIRM;
    }
    if (event.button === 2) actions |= ACTION_DASH;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return [0, 0];
      const length = Math.hypot(x, y);
      return [x / length, y / length];
    },
    aim() {
      return mouse;
    },
    firing() {
      return mouse.down || held.has('Space');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
