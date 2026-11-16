// NEONVOID tuning: every number that shapes how a run feels lives here, so the world's code
// reads as rules and this file reads as the game's balance sheet.

/** The fixed simulation step, in seconds: the world always advances in 1/60 s ticks. */
export const STEP = 1 / 60;

/** The arena the fight happens in, in world pixels. The camera shows part of it at a time. */
export const ARENA = { width: 2200, height: 1500 };

/** Where the best score is kept between visits. */
export const BEST_KEY = 'neonvoid.bestScore';

/** The player: a lone light holding the arena against the swarm. */
export const PLAYER = {
  radius: 16,
  speed: 268,
  maxHp: 100,
  fireInterval: 0.19,
  bulletDamage: 13,
  bulletSpeed: 760,
  bulletRadius: 5,
  dashTime: 0.16,
  dashSpeed: 980,
  dashCooldown: 1.7,
  magnetRadius: 96,
  pickupRadius: 24,
  regen: 0,
  critChance: 0.05,
  critMultiplier: 2.2,
  projectiles: 1,
  pierce: 0,
};

/** Contact damage cools down per enemy, so brushing a swarm stings instead of melting you. */
export const CONTACT_COOLDOWN = 0.55;

/** Experience: gems are worth 1 or 5; the curve is what each level costs beyond the last. */
export const XP = { base: 6, growth: 5 };

/** When the Void Tyrant comes, and the warning that precedes it. */
export const BOSS = { atTime: 210, warnBefore: 8, hp: 2400, radius: 54 };

/** The neon palette: one hue per actor, so a screenshot reads at a glance. */
export const COLORS = {
  background: '#070814',
  grid: 'rgba(64, 84, 180, 0.16)',
  border: '#2b3f9e',
  player: '#3df3ff',
  bullet: '#bffbff',
  mite: '#ff3d7e',
  stinger: '#ffb03a',
  brute: '#9d6bff',
  splitter: '#52ffa8',
  spitter: '#ff5252',
  spitterShot: '#ff8a5c',
  boss: '#ff2e63',
  gem: '#3affd8',
  gemBig: '#ffe93a',
  text: '#e8f6ff',
  dim: '#8fa3c8',
  hp: '#3affa0',
  hpLow: '#ff5252',
  xp: '#3affd8',
};
