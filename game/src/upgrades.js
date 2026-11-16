// Level-up choices: what a run can become. Each upgrade is a name, the promise on its
// card, and what it does to the player's stats. Three distinct cards are dealt per level;
// most can be taken again and keep stacking, so long runs grow strange and strong.

/** Every upgrade in the pool: id, card name, card text, and apply(stats, player). */
export const UPGRADES = [
  {
    id: 'power', name: 'Overcharge', text: '+20% bullet damage',
    apply(stats) { stats.bulletDamage *= 1.2; },
  },
  {
    id: 'rate', name: 'Rapid Cycler', text: '+15% fire rate',
    apply(stats) { stats.fireInterval *= 0.87; },
  },
  {
    id: 'multi', name: 'Split Cannon', text: '+1 projectile per shot',
    apply(stats) { stats.projectiles += 1; },
  },
  {
    id: 'pierce', name: 'Lance Rounds', text: 'Bullets pierce +1 enemy',
    apply(stats) { stats.pierce += 1; },
  },
  {
    id: 'speed', name: 'Ion Thrusters', text: '+8% move speed',
    apply(stats) { stats.speed *= 1.08; },
  },
  {
    id: 'hull', name: 'Reinforced Hull', text: '+25 max HP and repair 25',
    apply(stats, player) { stats.maxHp += 25; player.hp = Math.min(stats.maxHp, player.hp + 25); },
  },
  {
    id: 'magnet', name: 'Tractor Field', text: '+45% XP magnet radius',
    apply(stats) { stats.magnetRadius *= 1.45; },
  },
  {
    id: 'dash', name: 'Phase Coils', text: 'Dash recharges 25% faster',
    apply(stats) { stats.dashCooldown *= 0.75; },
  },
  {
    id: 'crit', name: 'Weak-Point AI', text: '+10% critical chance (x2.2)',
    apply(stats) { stats.critChance += 0.1; },
  },
  {
    id: 'regen', name: 'Nano Repair', text: 'Regenerate +0.7 HP/s',
    apply(stats) { stats.regen += 0.7; },
  },
];

/** Deal three distinct upgrades from the pool, using the run's own random source. */
export function dealChoices(next) {
  const pool = UPGRADES.slice();
  const dealt = [];
  for (let i = 0; i < 3; i += 1) {
    const index = Math.floor(next() * pool.length);
    dealt.push(pool.splice(index, 1)[0]);
  }
  return dealt;
}
