// A small seeded random source (mulberry32). A run is dealt from one seed, so the staged
// screenshot scenes and any replay of a run always deal the same swarm.

/** Create a random generator from a 32-bit seed: () => a float in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) from a generator made by createRandom. */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** An integer in [min, max] from a generator made by createRandom. */
export function intRange(next, min, max) {
  return min + Math.floor(next() * (max - min + 1));
}

/** One item of a list, chosen by the generator. */
export function pick(next, items) {
  return items[Math.floor(next() * items.length)];
}
