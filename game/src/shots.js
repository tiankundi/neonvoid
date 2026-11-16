// The screenshot scenes behind ?shot=title|battle|levelup|gameover. Each plays the real
// rules forward from a fresh world, steered by a simple autopilot (keep clear of the swarm,
// chase XP, shoot the nearest enemy), so every frame is a moment a real run passes through
// and the same seed always deals the same frame. The battle scene is picked by rehearsing
// the run once and noting its busiest moment, then playing to that moment again.

import { ARENA, STEP } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** What the autopilot values in a level-up card, best first. */
const UPGRADE_TASTE = ['multi', 'power', 'rate', 'pierce', 'crit', 'hull', 'regen', 'magnet', 'dash', 'speed'];

function nearestEnemy(state) {
  const player = state.player;
  let best = null;
  let bestD2 = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = enemy;
    }
  }
  return best;
}

/**
 * The autopilot's control for one step: flee crowding, feed on gems, aim at the nearest
 * enemy. A sloppy pilot aims with a wobble and holds fire until the swarm is close, the
 * way a first-time player does, so the battle scene shows the swarm closing in.
 */
function pilotControl(state, doomed, sloppy = false) {
  const player = state.player;
  if (doomed) return { move: [0, 0], aimX: player.x + 100, aimY: player.y, firing: false, dash: false };
  const fleeRadius = sloppy ? 150 : 190;

  let fleeX = 0;
  let fleeY = 0;
  let close = 0;
  for (const enemy of state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < fleeRadius * fleeRadius && d2 > 0) {
      const d = Math.sqrt(d2);
      const weight = (fleeRadius - d) / fleeRadius * (enemy.kind === 'boss' ? 2 : 1);
      fleeX += (dx / d) * weight;
      fleeY += (dy / d) * weight;
      if (d < 120) close += 1;
    }
  }
  for (const shot of state.shots) {
    const dx = player.x - shot.x;
    const dy = player.y - shot.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 90 * 90 && d2 > 0) {
      const d = Math.sqrt(d2);
      fleeX += (dx / d) * 0.7;
      fleeY += (dy / d) * 0.7;
    }
  }

  let seekX = 0;
  let seekY = 0;
  let gemD2 = Infinity;
  for (const gem of state.gems) {
    const dx = gem.x - player.x;
    const dy = gem.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < gemD2) {
      gemD2 = d2;
      seekX = dx;
      seekY = dy;
    }
  }
  const fleeMag = Math.hypot(fleeX, fleeY);
  let mx = fleeX;
  let my = fleeY;
  if (fleeMag < 0.55 && gemD2 < 420 * 420) {
    const d = Math.sqrt(gemD2) || 1;
    mx += (seekX / d) * 0.85;
    my += (seekY / d) * 0.85;
  }
  // Keep off the walls, where the swarm corners you, and drift back toward the middle.
  const wall = 150;
  if (player.x < wall) mx += (wall - player.x) / wall * 1.2;
  if (player.x > ARENA.width - wall) mx -= (wall - (ARENA.width - player.x)) / wall * 1.2;
  if (player.y < wall) my += (wall - player.y) / wall * 1.2;
  if (player.y > ARENA.height - wall) my -= (wall - (ARENA.height - player.y)) / wall * 1.2;
  mx += (ARENA.width / 2 - player.x) / ARENA.width * 0.3;
  my += (ARENA.height / 2 - player.y) / ARENA.height * 0.3;

  const mag = Math.hypot(mx, my);
  const move = mag > 0.01 ? [mx / mag, my / mag] : [0, 0];
  const target = nearestEnemy(state);
  let aimX = target ? target.x : player.x + move[0] * 100;
  let aimY = target ? target.y : player.y + move[1] * 100;
  let firing = Boolean(target);
  if (sloppy && target) {
    const dx = aimX - player.x;
    const dy = aimY - player.y;
    const dist = Math.hypot(dx, dy);
    const wobble = Math.sin(state.time * 0.9) * 0.17;
    const cos = Math.cos(wobble);
    const sin = Math.sin(wobble);
    aimX = player.x + dx * cos - dy * sin;
    aimY = player.y + dx * sin + dy * cos;
    firing = dist < 560;
  }
  return { move, aimX, aimY, firing, dash: close >= 3 };
}

/** One autopilot step: take any pending level-up card by taste, else advance the world. */
function pilotStep(world, view, doomed, sloppy = false) {
  const state = world.state;
  if (state.pendingLevels > 0) {
    let pickIndex = 0;
    let pickRank = Infinity;
    state.choices.forEach((choice, index) => {
      const rank = UPGRADE_TASTE.indexOf(choice.id);
      if (rank < pickRank) {
        pickRank = rank;
        pickIndex = index;
      }
    });
    world.chooseUpgrade(pickIndex);
    return;
  }
  world.step(STEP, pilotControl(state, doomed, sloppy), view);
}

/** Play with the autopilot until the world's clock reaches `until` (or the run ends). */
function pilotPlay(world, view, until, doomedAfter = Infinity, sloppy = false) {
  const state = world.state;
  let guard = Math.round((until + 30) / STEP) + 600;
  while (state.time < until && !state.over && !state.victory && guard > 0) {
    pilotStep(world, view, state.time > doomedAfter, sloppy);
    guard -= 1;
  }
}

/** How much is happening inside the camera's view: the battle frame worth keeping. */
function busyness(state, view) {
  const cam = state.camera;
  const inside = (o) => o.x > cam.x - 50 && o.x < cam.x + view.width + 50 && o.y > cam.y - 50 && o.y < cam.y + view.height + 50;
  let score = 0;
  for (const enemy of state.enemies) if (inside(enemy)) score += 3;
  for (const shot of state.shots) if (inside(shot)) score += 1.5;
  // A frame reads best with the player near the middle of it, the swarm closing in.
  const px = state.player.x - cam.x;
  const py = state.player.y - cam.y;
  if (px > view.width * 0.28 && px < view.width * 0.72 && py > view.height * 0.25 && py < view.height * 0.75) score += 7;
  return score;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score
 * to show. Unknown names stage the title.
 */
export function stageShot(name, world, view) {
  const state = world.state;
  if (name === 'battle') {
    // Rehearse: play once, noting the busiest moment after the fight has warmed up.
    world.reset();
    let bestTime = 70;
    let bestScore = -1;
    let guard = Math.round(120 / STEP) + 600;
    while (state.time < 82 && !state.over && !state.victory && guard > 0) {
      pilotStep(world, view, false, true);
      guard -= 1;
      if (state.time > 35 && state.pendingLevels === 0) {
        const score = busyness(state, view);
        if (score > bestScore) {
          bestScore = score;
          bestTime = state.time;
        }
      }
    }
    // Play it again to that moment and hold the frame.
    world.reset();
    pilotPlay(world, view, bestTime, Infinity, true);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  world.reset();
  if (name === 'levelup') {
    // Play until the first level-up lands and hold the frame on its choice.
    for (let i = 0; i < 150 / STEP && state.pendingLevels === 0 && !state.over; i += 1) {
      world.step(STEP, pilotControl(state, false), view);
    }
    return { screen: SCREEN_LEVELUP, best: 0 };
  }
  if (name === 'gameover') {
    pilotPlay(world, view, 130, 42);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  // Title: six seconds of harmless drift behind the name of the game.
  state.enemies.length = 0;
  for (let i = 0; i < 6 / STEP; i += 1) world.stepAmbient(STEP);
  state.camera.x = ARENA.width / 2 - view.width / 2;
  state.camera.y = ARENA.height / 2 - view.height / 2;
  return { screen: SCREEN_TITLE, best: 0 };
}
