// The swarm: five kinds with one job each, and the director that deals them. The director
// spends a budget that grows with the clock, just outside the player's view, and saves its
// biggest purchase for the Void Tyrant, whose coming ends the run one way or the other.

import { ARENA, BOSS } from './config.js';
import { range } from './random.js';

/**
 * What each kind is: radius, hull, speed, contact damage, score and XP value, and how it
 * behaves (chase, dart in lunges, spit from range, split on death, or the boss).
 */
export const ENEMY_TYPES = {
  mite: { radius: 13, hp: 10, speed: 128, damage: 6, score: 10, xp: 1, behaviour: 'chase' },
  stinger: { radius: 12, hp: 8, speed: 196, damage: 8, score: 15, xp: 1, behaviour: 'dart' },
  splitter: { radius: 20, hp: 32, speed: 92, damage: 10, score: 25, xp: 2, behaviour: 'split' },
  spitter: { radius: 16, hp: 24, speed: 104, damage: 8, score: 30, xp: 2, behaviour: 'spit', range: 265, shotInterval: 2.3, shotSpeed: 235, shotDamage: 10 },
  brute: { radius: 30, hp: 95, speed: 60, damage: 20, score: 50, xp: 5, behaviour: 'chase' },
  boss: { radius: BOSS.radius, hp: BOSS.hp, speed: 46, damage: 26, score: 2000, xp: 40, behaviour: 'boss' },
};

/** Enemy hulls thicken as the run goes on, so early upgrades stay ahead only by growing. */
export function hpScale(time) {
  return 1 + time / 110;
}

/** Which kinds the director may buy at a given second of the run. */
function menuAt(time) {
  const menu = [['mite', 46]];
  if (time > 25) menu.push(['stinger', 22]);
  if (time > 55) menu.push(['splitter', 15]);
  if (time > 85) menu.push(['spitter', 12]);
  if (time > 45) menu.push(['brute', 9]);
  return menu;
}

function chooseKind(next, time) {
  const menu = menuAt(time);
  let total = 0;
  for (const [, weight] of menu) total += weight;
  let roll = next() * total;
  for (const [kind, weight] of menu) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return 'mite';
}

/**
 * A spawn point just outside the camera's view, so pressure arrives promptly instead of
 * crossing the whole arena: a point on a ring around the visible rectangle, clamped into
 * the arena. A point the clamp drags on top of the player is reflected to the far side.
 */
function spawnPoint(next, player, view) {
  const out = range(next, 50, 150);
  const side = Math.floor(next() * 4);
  let x;
  let y;
  if (side === 0) { x = range(next, view.x - out, view.x + view.width + out); y = view.y - out; }
  else if (side === 1) { x = range(next, view.x - out, view.x + view.width + out); y = view.y + view.height + out; }
  else if (side === 2) { x = view.x - out; y = range(next, view.y - out, view.y + view.height + out); }
  else { x = view.x + view.width + out; y = range(next, view.y - out, view.y + view.height + out); }
  x = Math.min(ARENA.width - 26, Math.max(26, x));
  y = Math.min(ARENA.height - 26, Math.max(26, y));
  if (Math.hypot(x - player.x, y - player.y) < 250) {
    x = Math.min(ARENA.width - 26, Math.max(26, ARENA.width - x));
    y = Math.min(ARENA.height - 26, Math.max(26, ARENA.height - y));
  }
  return { x, y };
}

/**
 * The director's state: a budget that refills faster as the run ages. update() returns the
 * spawns due this step as [{kind, x, y}]; the boss arrives once, on the clock, and the
 * director goes quiet behind it (only a trickle of mites keeps the pressure on).
 */
export function createDirector() {
  let budget = 2;
  let bossSpawned = false;
  let bossWarned = false;

  return {
    update(next, dt, time, player, aliveCount, view) {
      const spawns = [];
      if (!bossSpawned && time >= BOSS.atTime - BOSS.warnBefore && !bossWarned) {
        bossWarned = true;
        spawns.push({ kind: 'warn' });
      }
      if (!bossSpawned && time >= BOSS.atTime) {
        bossSpawned = true;
        const point = spawnPoint(next, player, view);
        spawns.push({ kind: 'boss', x: point.x, y: point.y });
        return spawns;
      }
      const rate = bossSpawned ? 0.25 : 2.0 + time / 20;
      budget = Math.min(budget + rate * dt, 60);
      const cap = bossSpawned ? 40 : 170;
      while (budget >= 1 && aliveCount + spawns.length < cap) {
        const kind = chooseKind(next, time);
        const cost = kind === 'mite' ? 1 : 2;
        if (cost > budget) break;
        budget -= cost;
        const point = spawnPoint(next, player, view);
        spawns.push({ kind, x: point.x, y: point.y });
      }
      return spawns;
    },
    get bossSpawned() {
      return bossSpawned;
    },
  };
}
