// Pre-rendered glow sprites: each actor is drawn once to its own small canvas with its
// neon glow baked in, so the render loop only stamps images and stays fast under a swarm.
// Shapes point east; the renderer rotates the stamp toward the actor's heading.

import { COLORS } from './config.js';

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/** A soft radial glow disc: white core, coloured falloff, transparent edge. */
function glowDisc(size, color) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.25, color);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Run a shape painter with glow, centred, in a canvas 4x the shape's radius. */
function bake(radius, color, paint) {
  const size = Math.ceil(radius * 4);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.shadowColor = color;
  ctx.shadowBlur = radius * 0.9;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  paint(ctx, radius);
  return canvas;
}

function polygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

const PAINTERS = {
  player(ctx, r) {
    polygon(ctx, [[r * 1.25, 0], [-r * 0.9, r * 0.85], [-r * 0.45, 0], [-r * 0.9, -r * 0.85]]);
    ctx.fillStyle = '#eafcff';
    polygon(ctx, [[r * 0.55, 0], [-r * 0.3, r * 0.34], [-r * 0.3, -r * 0.34]]);
  },
  mite(ctx, r) {
    polygon(ctx, [[r, 0], [-r * 0.7, r * 0.8], [-r * 0.25, 0], [-r * 0.7, -r * 0.8]]);
  },
  stinger(ctx, r) {
    polygon(ctx, [[r * 1.5, 0], [-r * 0.9, r * 0.55], [-r * 0.45, 0], [-r * 0.9, -r * 0.55]]);
    ctx.fillStyle = '#fff3d6';
    polygon(ctx, [[r * 0.7, 0], [-r * 0.2, r * 0.22], [-r * 0.2, -r * 0.22]]);
  },
  brute(ctx, r) {
    const points = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      points.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    polygon(ctx, points);
    ctx.fillStyle = '#e9dfff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  },
  splitter(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#eafff3';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },
  spitter(ctx, r) {
    polygon(ctx, [[r, 0], [0, r * 0.9], [-r, 0], [0, -r * 0.9]]);
    ctx.fillStyle = '#ffe9e9';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  },
  boss(ctx, r) {
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const rad = i % 2 === 0 ? r : r * 0.68;
      points.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    polygon(ctx, points);
    ctx.fillStyle = '#ffd7e4';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5c0a20';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
  },
  gem(ctx, r) {
    polygon(ctx, [[0, -r], [r * 0.72, 0], [0, r], [-r * 0.72, 0]]);
    ctx.fillStyle = '#eafffb';
    polygon(ctx, [[0, -r * 0.45], [r * 0.32, 0], [0, r * 0.45], [-r * 0.32, 0]]);
  },
};

const cache = new Map();

/** The baked sprite for a kind: 'player', 'mite', 'stinger', 'brute', 'splitter', 'spitter', 'boss' or 'gem'. */
export function actorSprite(kind, radius) {
  const key = `${kind}:${radius}`;
  if (!cache.has(key)) {
    const color = kind === 'gem' ? COLORS.gem : COLORS[kind] ?? '#ffffff';
    cache.set(key, bake(radius, color, PAINTERS[kind]));
  }
  return cache.get(key);
}

/** The soft glow disc used for bullets, enemy shots, gems' halo and particles, in a colour. */
export function glowSprite(color) {
  const key = `glow:${color}`;
  if (!cache.has(key)) cache.set(key, glowDisc(64, color));
  return cache.get(key);
}
