// The screenshot scenes behind ?shot=title|battle|levelup|gameover|victory. Each plays the
// real rules forward from a fresh world, steered by a simple autopilot (keep clear of the
// swarm, chase XP, shoot the nearest enemy), so every frame is a moment a real run passes
// through and the same seed always deals the same frame. A run cannot be replayed to a
// chosen moment — the world's random stream does not rewind — so a scene that wants a
// particular moment plays one run, keeps a snapshot of the best moment it passes, and
// restores that snapshot to be photographed.
//
// The four frames the entry ships: the title over a live mid-run swarm (the start screen,
// with the fight it promises already raging behind it), the Void Tyrant fight itself with
// its hull bar, orb bursts and the swarm in frame, a late level-up draft with the run's
// whole build listed under the cards, and the victory results the boss fight ends in.

import { ARENA, STEP } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

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

/** Take the pending level-up card the autopilot values most. */
function pickByTaste(world) {
  const state = world.state;
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
}

/** One autopilot step: take any pending level-up card by taste, else advance the world. */
function pilotStep(world, view, doomed, sloppy = false) {
  const state = world.state;
  if (state.pendingLevels > 0) {
    pickByTaste(world);
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

/** Is a world point inside the camera's view, with a small margin? */
function inView(state, view, o, margin = 50) {
  const cam = state.camera;
  return o.x > cam.x - margin && o.x < cam.x + view.width + margin && o.y > cam.y - margin && o.y < cam.y + view.height + margin;
}

/**
 * How much is happening inside the camera's view: the frame worth keeping. Enemies and
 * the boss weigh most, then orb fire, gems, bullets, particles and crit numbers; a frame
 * also reads best with the player near the middle of it, the swarm closing in.
 */
function density(state, view) {
  let score = 0;
  for (const enemy of state.enemies) if (inView(state, view, enemy)) score += 3;
  if (state.boss && inView(state, view, state.boss)) score += 50;
  for (const shot of state.shots) if (inView(state, view, shot)) score += 1.5;
  for (const bullet of state.bullets) if (inView(state, view, bullet)) score += 1;
  for (const gem of state.gems) if (inView(state, view, gem)) score += 0.7;
  for (const p of state.particles) if (inView(state, view, p)) score += 0.25;
  for (const t of state.texts) if (inView(state, view, t)) score += 2;
  const px = state.player.x - state.camera.x;
  const py = state.player.y - state.camera.y;
  if (px > view.width * 0.28 && px < view.width * 0.72 && py > view.height * 0.25 && py < view.height * 0.75) score += 7;
  return score;
}

/**
 * Keep a copy of the world's state to restore later. A plain deep copy, not
 * structuredClone: the level-up choices carry their `apply` functions, which a data
 * clone refuses — functions (and everything else that is not an object) pass through by
 * reference, and shared references (the boss is also one of the enemies) stay shared.
 */
function snapshot(state, seen = new Map()) {
  if (state === null || typeof state !== 'object') return state;
  if (seen.has(state)) return seen.get(state);
  const copy = Array.isArray(state) ? [] : {};
  seen.set(state, copy);
  for (const key of Object.keys(state)) copy[key] = snapshot(state[key], seen);
  return copy;
}

/** Put a snapshot back into the world's live state object, field by field. */
function restore(state, snap) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, snap);
}

/**
 * Play one sloppy run, calling `scan(state)` after every step; it returns a score for
 * moments worth keeping and null for the rest. Returns a snapshot of the best moment, or
 * null if the scan never scored. The run plays out to its end (or `until` seconds).
 */
function playAndKeepBest(world, view, scan, until = 300) {
  const state = world.state;
  world.reset();
  let best = null;
  let bestScore = -Infinity;
  let guard = Math.round(until / STEP) + 600;
  while (!state.over && !state.victory && guard > 0) {
    pilotStep(world, view, false, true);
    guard -= 1;
    const score = scan(state);
    if (score !== null && score > bestScore) {
      bestScore = score;
      best = snapshot(state);
    }
  }
  return best;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score
 * to show. Unknown names stage the title.
 */
export function stageShot(name, world, view) {
  const state = world.state;

  if (name === 'battle') {
    // The Void Tyrant fight: the boss in view and already hurt, its orb bursts in flight,
    // the swarm it summoned around it, the whole HUD live. If no boss moment qualifies
    // (the boss always comes, so this is a formality), keep the run's busiest moment.
    let best = playAndKeepBest(world, view, (s) => {
      if (!s.boss || s.pendingLevels > 0) return null;
      const frac = s.boss.hp / s.boss.maxHp;
      if (frac < 0.12 || frac > 0.65 || !inView(s, view, s.boss)) return null;
      // The Tyrant must loom in the frame, not lurk at its edge: near the player, clear
      // of the frame's border, near its middle — with orb bursts and bullet fire on top.
      const dist = Math.hypot(s.boss.x - s.player.x, s.boss.y - s.player.y);
      if (dist > 660) return null;
      const bx = s.boss.x - s.camera.x;
      const by = s.boss.y - s.camera.y;
      if (bx < 110 || bx > view.width - 110 || by < 110 || by > view.height - 110) return null;
      return density(s, view) * 0.5 + s.shots.length * 4 + s.bullets.length
        + (660 - dist) * 0.6 - (Math.abs(bx - view.width / 2) + Math.abs(by - view.height / 2)) * 0.2
        + (s.banner ? 15 : 0);
    });
    if (!best) {
      best = playAndKeepBest(world, view, (s) => (
        s.time > 35 && s.time < 120 && s.pendingLevels === 0 ? density(s, view) : null
      ), 130);
    }
    if (best) restore(state, best);
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'levelup') {
    // A late draft, not the first: note every level-up landing from level 14 on and keep
    // the one with the most crowded arena behind the cards. The scan runs before the
    // autopilot takes the card, so the snapshot holds the choice itself. If no late draft
    // happens (the pilot always reaches one), stage the first landing instead.
    let best = null;
    let bestScore = -Infinity;
    world.reset();
    let guard = Math.round(300 / STEP) + 600;
    while (!state.over && !state.victory && guard > 0) {
      guard -= 1;
      if (state.pendingLevels > 0) {
        pickByTaste(world);
        continue;
      }
      world.step(STEP, pilotControl(state, false, true), view);
      if (state.pendingLevels > 0 && state.level >= 14) {
        const score = density(state, view);
        if (score > bestScore) {
          bestScore = score;
          best = snapshot(state);
        }
      }
    }
    if (best) {
      restore(state, best);
      return { screen: SCREEN_LEVELUP, best: 0 };
    }
    world.reset();
    for (let i = 0; i < 150 / STEP && state.pendingLevels === 0 && !state.over; i += 1) {
      world.step(STEP, pilotControl(state, false), view);
    }
    return { screen: SCREEN_LEVELUP, best: 0 };
  }

  if (name === 'victory') {
    // The whole run, played out: the Tyrant breaks at the end of it and the results
    // screen keeps the run's real numbers — time, level, kills, score.
    world.reset();
    let guard = Math.round(420 / STEP) + 600;
    while (!state.victory && !state.over && guard > 0) {
      pilotStep(world, view, false, true);
      guard -= 1;
    }
    if (state.victory) return { screen: SCREEN_VICTORY, best: state.score };
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }

  if (name === 'gameover') {
    world.reset();
    pilotPlay(world, view, 130, 42);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }

  // Title: the start screen over a living arena — keep the most crowded mid-run moment
  // of a sloppy run and freeze the swarm there behind the name of the game, so the cover
  // promises the fight the other frames keep.
  const best = playAndKeepBest(world, view, (s) => (
    s.time > 50 && s.time < 120 && s.pendingLevels === 0 ? density(s, view) : null
  ), 130);
  if (best) {
    restore(state, best);
  } else {
    // No crowd found (a formality): six seconds of harmless drift behind the name.
    world.reset();
    state.enemies.length = 0;
    for (let i = 0; i < 6 / STEP; i += 1) world.stepAmbient(STEP);
    state.camera.x = ARENA.width / 2 - view.width / 2;
    state.camera.y = ARENA.height / 2 - view.height / 2;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
