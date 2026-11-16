// Boot and the one loop: NEONVOID's shell. Input is read every frame, the world advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one), world events become
// sounds and announcements, and the renderer paints the screen the run is on: title, play,
// level-up, paused, game over or victory.
//
// ?seed=N fixes a run's swarm. ?shot=title|battle|levelup|gameover (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.

import { ARENA, BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BOSS, EVENT_DASH, EVENT_EXPLODE, EVENT_HIT, EVENT_LEVELUP,
  EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_VICTORY, EVENT_WARN,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE,
  ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, levelupCardRects,
  SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const view = renderer.view();
  const scene = stageShot(name, world, view);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { aimX: 0, aimY: 0, muted: false, now: 1.2 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastShotSound = 0;
  let lastPickupSound = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.setPlaying(true);
    announce('Playing. The swarm is coming.');
  }

  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    audio.setPlaying(false);
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(victory ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pickAt(x, y) {
    const rects = levelupCardRects(renderer.view());
    const index = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    return index;
  }

  let dashQueued = false;

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_DASH) dashQueued = true;

    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) {
      // A click starts only when it lands anywhere on the title; Enter/Space do the same.
      startGame();
      return;
    }
    if ((screen === SCREEN_OVER || screen === SCREEN_VICTORY) && (actions & ACTION_CONFIRM)) {
      startGame();
      return;
    }
    if (screen === SCREEN_LEVELUP) {
      let pick = -1;
      if (actions & ACTION_PICK_1) pick = 0;
      else if (actions & ACTION_PICK_2) pick = 1;
      else if (actions & ACTION_PICK_3) pick = 2;
      else if (actions & ACTION_CONFIRM) {
        const aim = input.aim();
        pick = pickAt(aim.x, aim.y);
      }
      if (pick >= 0) {
        world.chooseUpgrade(pick);
        audio.play('click');
        if (world.state.pendingLevels <= 0) {
          screen = SCREEN_PLAY;
          announce(`Level ${world.state.level}. Playing.`);
        }
      }
      return;
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      audio.setPlaying(false);
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      audio.setPlaying(true);
      announce('Playing.');
    }
  }

  function controlFromInput() {
    const view = renderer.view();
    const cam = world.state.camera;
    const aim = input.aim();
    return {
      move: input.direction(),
      aimX: cam.x + aim.x,
      aimY: cam.y + aim.y,
      firing: input.firing(),
      dash: false, // set from the frame's action bits below
    };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.stepAmbient(STEP);
      // Let the backdrop drift slowly across the arena.
      const state = world.state;
      state.camera.x = Math.min(state.camera.x + STEP * 12, ARENA.width - renderer.view().width);
      return;
    }
    const control = controlFromInput();
    control.dash = dashQueued;
    dashQueued = false;
    const events = world.step(STEP, control, renderer.view());
    const now = performance.now();
    if (events & EVENT_SHOOT && now - lastShotSound > 70) {
      audio.play('shoot');
      lastShotSound = now;
    }
    if (events & EVENT_PICKUP && now - lastPickupSound > 60) {
      audio.play('pickup');
      lastPickupSound = now;
    }
    if (events & EVENT_EXPLODE) audio.play('explode');
    if (events & EVENT_DASH) audio.play('dash');
    if (events & EVENT_WARN) audio.play('warn');
    if (events & EVENT_BOSS) audio.play('warn');
    if (events & EVENT_HIT && !(events & EVENT_OVER)) {
      audio.play('hurt');
      announce(`Hit. Hull ${Math.ceil(world.state.player.hp)}.`);
    }
    if (events & EVENT_LEVELUP) {
      screen = SCREEN_LEVELUP;
      audio.play('levelup');
      announce(`Level ${world.state.level}. Choose an upgrade.`);
    }
    if (events & EVENT_VICTORY) {
      audio.play('victory');
      endGame(true);
    } else if (events & EVENT_OVER) {
      endGame(false);
    }
  }

  function frame(nowMs) {
    requestAnimationFrame(frame);
    accumulator += Math.min((nowMs - last) / 1000, MAX_FRAME);
    last = nowMs;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const aim = input.aim();
    renderer.draw(world.state, screen, best, {
      aimX: aim.x,
      aimY: aim.y,
      muted: audio.isMuted(),
      now: nowMs / 1000,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setPlaying(false);
      announce('Paused.');
    }
  });

  announce('Neonvoid. Click or press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
