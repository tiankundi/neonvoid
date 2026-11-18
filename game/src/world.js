// The world: NEONVOID's whole simulation in fixed steps. It owns the player, the swarm,
// bullets, gems, particles and the camera; it takes a control (move, aim, fire, dash) each
// step and returns event bits the shell turns into sound and announcements. All chance
// flows through the seeded generator it was made with, so a run replays exactly.

import { ARENA, BOSS, COLORS, CONTACT_COOLDOWN, PLAYER, STEP, XP } from './config.js';
import { createDirector, ENEMY_TYPES, hpScale } from './enemies.js';
import { dealChoices } from './upgrades.js';
import { range } from './random.js';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_EXPLODE = 4;
export const EVENT_PICKUP = 8;
export const EVENT_LEVELUP = 16;
export const EVENT_WARN = 32;
export const EVENT_BOSS = 64;
export const EVENT_OVER = 128;
export const EVENT_VICTORY = 256;
export const EVENT_DASH = 512;

const MAX_PARTICLES = 650;
const BULLET_LIFE = 0.85;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function makePlayer() {
  const stats = { ...PLAYER };
  return {
    x: ARENA.width / 2,
    y: ARENA.height / 2,
    vx: 0,
    vy: 0,
    hp: stats.maxHp,
    angle: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashDirX: 1,
    dashDirY: 0,
    hurtTimer: 0,
    stats,
  };
}

function makeEnemy(kind, x, y, time, next) {
  const type = ENEMY_TYPES[kind];
  const hp = Math.round(type.hp * (kind === 'boss' ? 1 : hpScale(time)));
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    radius: type.radius,
    angle: range(next, 0, Math.PI * 2),
    contactTimer: 0,
    flash: 0,
    stateT: range(next, 0.3, 1.1),
    shotTimer: range(next, 1, 2.2),
    burstTimer: 3.4,
    summonTimer: 6.5,
    wobble: range(next, 0, Math.PI * 2),
  };
}

/** Create a world dealt from the seeded generator `next` (see random.js). */
export function createWorld(next) {
  const state = {
    time: 0,
    score: 0,
    scoreFloat: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNeed: XP.base,
    pendingLevels: 0,
    choices: [],
    build: {},
    player: makePlayer(),
    enemies: [],
    bullets: [],
    shots: [],
    gems: [],
    particles: [],
    texts: [],
    camera: { x: 0, y: 0 },
    shake: 0,
    banner: null,
    boss: null,
    over: false,
    victory: false,
    ambientCount: 0,
  };
  let director = createDirector();

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= MAX_PARTICLES) state.particles.shift();
      const a = range(next, 0, Math.PI * 2);
      const v = range(next, speed * 0.25, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: range(next, life * 0.5, life),
        maxLife: life,
        size: range(next, size * 0.5, size),
        color,
      });
    }
  }

  function addText(x, y, text, color, size = 13) {
    state.texts.push({ x, y, text, color, size, life: 0.8, maxLife: 0.8 });
    if (state.texts.length > 40) state.texts.shift();
  }

  function setBanner(title, sub, seconds = 2.6) {
    state.banner = { title, sub, t: seconds, maxT: seconds };
  }

  function dropGems(x, y, value) {
    let left = value;
    while (left >= 5) {
      spawnGem(x, y, 5);
      left -= 5;
    }
    while (left >= 1) {
      spawnGem(x, y, 1);
      left -= 1;
    }
  }

  function spawnGem(x, y, value) {
    const a = range(next, 0, Math.PI * 2);
    const v = range(next, 20, 95);
    state.gems.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, value, big: value >= 5, pull: 0 });
  }

  function hurtPlayer(damage) {
    const player = state.player;
    if (state.over || player.dashTimer > 0) return 0;
    player.hp -= damage;
    player.hurtTimer = 0.3;
    state.shake = Math.min(state.shake + 7, 15);
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
      burst(player.x, player.y, COLORS.player, 70, 340, 1.1, 5);
      burst(player.x, player.y, '#ffffff', 30, 220, 0.8, 4);
      return EVENT_OVER | EVENT_HIT;
    }
    return EVENT_HIT;
  }

  function killEnemy(index, events) {
    const enemy = state.enemies[index];
    const type = ENEMY_TYPES[enemy.kind];
    state.kills += 1;
    state.scoreFloat += type.score;
    burst(enemy.x, enemy.y, COLORS[enemy.kind], enemy.kind === 'boss' ? 130 : 14, 260, 0.7, 4);
    dropGems(enemy.x, enemy.y, type.xp);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const child = makeEnemy('mite', enemy.x + range(next, -14, 14), enemy.y + range(next, -14, 14), state.time, next);
        const a = range(next, 0, Math.PI * 2);
        child.vx = Math.cos(a) * 190;
        child.vy = Math.sin(a) * 190;
        state.enemies.push(child);
      }
    }
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.victory = true;
      for (const other of state.enemies) burst(other.x, other.y, COLORS[other.kind], 10, 240, 0.8, 4);
      state.enemies.length = 0;
      state.shots.length = 0;
      setBanner('THE VOID IS SILENT', 'The Tyrant is broken. The arena is yours.', 4.5);
      return events | EVENT_VICTORY | EVENT_EXPLODE;
    }
    state.enemies.splice(index, 1);
    return events | EVENT_EXPLODE;
  }

  function fireBullet(angle, stats) {
    state.bullets.push({
      x: state.player.x + Math.cos(angle) * (stats.radius + 6),
      y: state.player.y + Math.sin(angle) * (stats.radius + 6),
      vx: Math.cos(angle) * stats.bulletSpeed,
      vy: Math.sin(angle) * stats.bulletSpeed,
      life: BULLET_LIFE,
      damage: stats.bulletDamage,
      pierce: stats.pierce,
      radius: stats.bulletRadius,
    });
  }

  function stepPlayer(dt, control, events) {
    const player = state.player;
    const stats = player.stats;
    player.fireTimer -= dt;
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - dt);
    if (stats.regen > 0 && !state.over) player.hp = Math.min(stats.maxHp, player.hp + stats.regen * dt);

    if (control.dash && player.dashCooldownTimer <= 0 && player.dashTimer <= 0) {
      const [mx, my] = control.move;
      const hasMove = mx !== 0 || my !== 0;
      player.dashDirX = hasMove ? mx : Math.cos(player.angle);
      player.dashDirY = hasMove ? my : Math.sin(player.angle);
      player.dashTimer = stats.dashTime;
      player.dashCooldownTimer = stats.dashCooldown;
      burst(player.x, player.y, COLORS.player, 10, 120, 0.35, 4);
      events |= EVENT_DASH;
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashDirX * stats.dashSpeed;
      player.vy = player.dashDirY * stats.dashSpeed;
      state.particles.push({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.28, maxLife: 0.28, size: stats.radius * 1.15, color: COLORS.player,
      });
    } else {
      player.vx = control.move[0] * stats.speed;
      player.vy = control.move[1] * stats.speed;
    }
    player.x = clamp(player.x + player.vx * dt, stats.radius, ARENA.width - stats.radius);
    player.y = clamp(player.y + player.vy * dt, stats.radius, ARENA.height - stats.radius);

    const aimDx = control.aimX - player.x;
    const aimDy = control.aimY - player.y;
    if (aimDx !== 0 || aimDy !== 0) player.angle = Math.atan2(aimDy, aimDx);

    if (control.firing && player.fireTimer <= 0 && !state.over) {
      player.fireTimer = stats.fireInterval;
      const count = stats.projectiles;
      for (let i = 0; i < count; i += 1) {
        const offset = count === 1 ? 0 : (i - (count - 1) / 2) * 0.1;
        fireBullet(player.angle + offset, stats);
      }
      events |= EVENT_SHOOT;
    }
    return events;
  }

  function stepBullets(dt, events) {
    const player = state.player;
    for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = state.bullets[bi];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0 || bullet.x < -20 || bullet.y < -20 || bullet.x > ARENA.width + 20 || bullet.y > ARENA.height + 20;
      if (!dead) {
        for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
          const enemy = state.enemies[ei];
          const dx = enemy.x - bullet.x;
          const dy = enemy.y - bullet.y;
          const rr = enemy.radius + bullet.radius;
          if (dx * dx + dy * dy > rr * rr) continue;
          const crit = next() < player.stats.critChance;
          const damage = bullet.damage * (crit ? player.stats.critMultiplier : 1);
          enemy.hp -= damage;
          enemy.flash = 0.09;
          enemy.vx += bullet.vx * 0.012;
          enemy.vy += bullet.vy * 0.012;
          burst(bullet.x, bullet.y, COLORS[enemy.kind], 3, 150, 0.3, 3);
          if (crit) addText(enemy.x, enemy.y - enemy.radius - 6, `${Math.round(damage)}`, '#ffe93a', 15);
          if (enemy.hp <= 0) events = killEnemy(ei, events);
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
      if (dead) state.bullets.splice(bi, 1);
    }
    return events;
  }

  function stepEnemies(dt, events) {
    const player = state.player;
    const enemies = state.enemies;
    // Gentle separation so the swarm reads as bodies, not a single blob.
    for (let i = 0; i < enemies.length; i += 1) {
      const a = enemies[i];
      for (let j = i + 1; j < enemies.length; j += 1) {
        const b = enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = (a.radius + b.radius) * 0.82;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((rr - d) / d) * 0.5;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
    for (const enemy of enemies) {
      const type = ENEMY_TYPES[enemy.kind];
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.contactTimer = Math.max(0, enemy.contactTimer - dt);
      enemy.wobble += dt * 3;

      if (type.behaviour === 'dart') {
        enemy.stateT -= dt;
        if (enemy.stateT <= 0) {
          enemy.phase = ((enemy.phase ?? 0) + 1) % 3;
          enemy.stateT = enemy.phase === 0 ? range(next, 0.5, 1.1) : enemy.phase === 1 ? 0.42 : 0.34;
          if (enemy.phase === 2) {
            enemy.vx = ux * type.speed * 3.1;
            enemy.vy = uy * type.speed * 3.1;
          }
        }
        if (enemy.phase === 1) {
          enemy.vx = ux * type.speed * 0.25;
          enemy.vy = uy * type.speed * 0.25;
        } else if (enemy.phase !== 2) {
          enemy.vx = ux * type.speed;
          enemy.vy = uy * type.speed;
        }
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
      } else if (type.behaviour === 'spit') {
        const want = dist > type.range + 25 ? 1 : dist < type.range - 45 ? -1 : 0;
        const strafe = Math.sin(enemy.wobble * 0.7) * 0.55;
        enemy.vx = (ux * want - uy * strafe) * type.speed;
        enemy.vy = (uy * want + ux * strafe) * type.speed;
        enemy.angle = Math.atan2(uy, ux);
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && dist < 430 && !state.over) {
          enemy.shotTimer = type.shotInterval * range(next, 0.85, 1.2);
          state.shots.push({
            x: enemy.x, y: enemy.y,
            vx: ux * type.shotSpeed, vy: uy * type.shotSpeed,
            life: 3.2, damage: type.shotDamage, radius: 7,
          });
        }
      } else if (type.behaviour === 'boss') {
        enemy.vx = ux * type.speed;
        enemy.vy = uy * type.speed;
        enemy.angle += dt * 0.7;
        enemy.burstTimer -= dt;
        enemy.summonTimer -= dt;
        const enraged = enemy.hp < enemy.maxHp * 0.3;
        if (enemy.burstTimer <= 0 && !state.over) {
          enemy.burstTimer = enraged ? 2.1 : 3.3;
          const n = 14;
          const base = range(next, 0, Math.PI * 2);
          for (let i = 0; i < n; i += 1) {
            const a = base + (i / n) * Math.PI * 2;
            state.shots.push({
              x: enemy.x, y: enemy.y,
              vx: Math.cos(a) * 168, vy: Math.sin(a) * 168,
              life: 4.2, damage: 12, radius: 7,
            });
          }
        }
        if (enemy.summonTimer <= 0 && !state.over) {
          enemy.summonTimer = 7;
          for (let i = 0; i < 4; i += 1) {
            const a = range(next, 0, Math.PI * 2);
            state.enemies.push(makeEnemy('mite', enemy.x + Math.cos(a) * 70, enemy.y + Math.sin(a) * 70, state.time, next));
          }
        }
      } else {
        const sway = Math.sin(enemy.wobble) * 0.22;
        enemy.vx = (ux - uy * sway) * type.speed;
        enemy.vy = (uy + ux * sway) * type.speed;
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
      }

      enemy.x = clamp(enemy.x + (enemy.vx + (enemy.knockX ?? 0)) * dt, enemy.radius, ARENA.width - enemy.radius);
      enemy.y = clamp(enemy.y + (enemy.vy + (enemy.knockY ?? 0)) * dt, enemy.radius, ARENA.height - enemy.radius);
      enemy.vx *= 0.9;
      enemy.vy *= 0.9;

      if (!state.over && enemy.contactTimer <= 0) {
        const rr = enemy.radius + player.stats.radius;
        const ddx = player.x - enemy.x;
        const ddy = player.y - enemy.y;
        if (ddx * ddx + ddy * ddy < rr * rr) {
          enemy.contactTimer = CONTACT_COOLDOWN;
          events |= hurtPlayer(type.damage);
        }
      }
    }
    return events;
  }

  function stepShots(dt, events) {
    const player = state.player;
    for (let i = state.shots.length - 1; i >= 0; i -= 1) {
      const shot = state.shots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      let dead = shot.life <= 0 || shot.x < 0 || shot.y < 0 || shot.x > ARENA.width || shot.y > ARENA.height;
      if (!dead && !state.over) {
        const rr = shot.radius + player.stats.radius;
        const dx = player.x - shot.x;
        const dy = player.y - shot.y;
        if (dx * dx + dy * dy < rr * rr) {
          events |= hurtPlayer(shot.damage);
          dead = true;
        }
      }
      if (dead) state.shots.splice(i, 1);
    }
    return events;
  }

  function stepGems(dt, events) {
    const player = state.player;
    for (let i = state.gems.length - 1; i >= 0; i -= 1) {
      const gem = state.gems[i];
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < player.stats.magnetRadius * player.stats.magnetRadius) {
        const d = Math.sqrt(d2) || 1;
        gem.pull = Math.min(gem.pull + dt * 1400, 620);
        gem.vx = (dx / d) * gem.pull;
        gem.vy = (dy / d) * gem.pull;
      } else {
        gem.vx *= 0.86;
        gem.vy *= 0.86;
        gem.pull = 0;
      }
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      if (d2 < player.stats.pickupRadius * player.stats.pickupRadius && !state.over) {
        state.gems.splice(i, 1);
        state.xp += gem.value;
        burst(gem.x, gem.y, gem.big ? COLORS.gemBig : COLORS.gem, 3, 90, 0.3, 3);
        events |= EVENT_PICKUP;
        while (state.xp >= state.xpNeed) {
          state.xp -= state.xpNeed;
          state.level += 1;
          state.pendingLevels += 1;
          state.xpNeed = XP.base + XP.growth * (state.level - 1);
        }
        if (state.pendingLevels > 0 && state.choices.length === 0) {
          state.choices = dealChoices(next);
          events |= EVENT_LEVELUP;
        }
      }
    }
    return events;
  }

  function stepFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    if (state.banner) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) state.banner = null;
    }
    state.shake = Math.max(0, state.shake - dt * 26);
  }

  function stepCamera(dt, view) {
    const player = state.player;
    const tx = clamp(player.x - view.width / 2, 0, Math.max(0, ARENA.width - view.width));
    const ty = clamp(player.y - view.height / 2, 0, Math.max(0, ARENA.height - view.height));
    const k = Math.min(1, dt * 7);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
  }

  return {
    state,

    reset() {
      state.time = 0;
      state.score = 0;
      state.scoreFloat = 0;
      state.kills = 0;
      state.level = 1;
      state.xp = 0;
      state.xpNeed = XP.base;
      state.pendingLevels = 0;
      state.choices = [];
      state.build = {};
      state.player = makePlayer();
      state.enemies.length = 0;
      state.bullets.length = 0;
      state.shots.length = 0;
      state.gems.length = 0;
      state.particles.length = 0;
      state.texts.length = 0;
      state.camera.x = clamp(state.player.x - 640, 0, ARENA.width - 640);
      state.camera.y = clamp(state.player.y - 400, 0, ARENA.height - 400);
      state.shake = 0;
      state.banner = null;
      state.boss = null;
      state.over = false;
      state.victory = false;
      director = createDirector();
    },

    /** Advance the title-screen backdrop: a harmless drifting swarm, no player, no stakes. */
    stepAmbient(dt) {
      state.time += dt;
      state.ambientCount += dt;
      if (state.enemies.length < 26 && state.ambientCount > 0.3) {
        state.ambientCount = 0;
        const kinds = ['mite', 'stinger', 'splitter', 'spitter', 'brute'];
        const kind = kinds[Math.floor(next() * kinds.length)];
        const enemy = makeEnemy(kind, range(next, 60, ARENA.width - 60), range(next, 60, ARENA.height - 60), 0, next);
        enemy.vx = range(next, -40, 40);
        enemy.vy = range(next, -40, 40);
        state.enemies.push(enemy);
      }
      for (const enemy of state.enemies) {
        enemy.wobble += dt * 2;
        if (next() < dt * 0.24) {
          enemy.vx = range(next, -46, 46);
          enemy.vy = range(next, -46, 46);
        }
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        if (enemy.x < 40 || enemy.x > ARENA.width - 40) enemy.vx *= -1;
        if (enemy.y < 40 || enemy.y > ARENA.height - 40) enemy.vy *= -1;
        enemy.x = clamp(enemy.x, 30, ARENA.width - 30);
        enemy.y = clamp(enemy.y, 30, ARENA.height - 30);
      }
      stepFx(dt);
    },

    /**
     * Advance one fixed step of a run. control: {move: [x, y], aimX, aimY (world pixels),
     * firing, dash}. view: {width, height} of the canvas in CSS pixels, for the camera.
     */
    step(dt, control, view) {
      let events = 0;
      if (state.over || state.victory) {
        stepFx(dt);
        stepCamera(dt, view);
        return events;
      }
      state.time += dt;
      state.scoreFloat += dt * 5;

      const viewRect = { x: state.camera.x, y: state.camera.y, width: view.width, height: view.height };
      for (const spawn of director.update(next, dt, state.time, state.player, state.enemies.length, viewRect)) {
        if (spawn.kind === 'warn') {
          setBanner('WARNING', 'Something vast is coming through the void.', 2.8);
          events |= EVENT_WARN;
        } else {
          const enemy = makeEnemy(spawn.kind, spawn.x, spawn.y, state.time, next);
          state.enemies.push(enemy);
          if (spawn.kind === 'boss') {
            state.boss = enemy;
            setBanner('THE VOID TYRANT', 'Break it, and the arena is yours.', 3.4);
            events |= EVENT_BOSS;
          }
        }
      }
      const minute = Math.floor(state.time);
      if (minute > 0 && minute % 60 === 0 && Math.abs(state.time - minute) < dt) {
        setBanner(`MINUTE ${minute / 60 + 1}`, 'The swarm thickens.', 2.2);
      }

      events = stepPlayer(dt, control, events);
      events = stepBullets(dt, events);
      events = stepEnemies(dt, events);
      events = stepShots(dt, events);
      events = stepGems(dt, events);
      stepFx(dt);
      stepCamera(dt, view);
      state.score = Math.floor(state.scoreFloat);
      return events;
    },

    /** Apply the level-up card at `index` (0..2); deals fresh cards if levels remain. */
    chooseUpgrade(index) {
      const choice = state.choices[index];
      if (!choice || state.pendingLevels <= 0) return;
      choice.apply(state.player.stats, state.player);
      state.build[choice.id] = (state.build[choice.id] ?? 0) + 1;
      state.pendingLevels -= 1;
      state.choices = state.pendingLevels > 0 ? dealChoices(next) : [];
      burst(state.player.x, state.player.y, COLORS.xp, 26, 200, 0.6, 4);
    },
  };
}

export { STEP };
