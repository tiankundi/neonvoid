// The renderer: everything the player sees, painted from world state each frame. The world
// is drawn through the camera with pre-rendered glow sprites; the HUD and the screens
// (title, level-up, paused, game over, victory) are drawn in screen space on top. A frame
// shows how the run stands at a glance: hull, experience, clock, score, and what is coming.

import { ARENA, COLORS } from './config.js';
import { actorSprite, glowSprite } from './sprites.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
const FONT_NUM = '"Cascadia Mono", Consolas, "SF Mono", monospace';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The three level-up card rectangles for a view, shared by drawing and click picking. */
export function levelupCardRects(view) {
  const w = Math.min(248, (view.width - 96) / 3);
  const h = 168;
  const gap = 20;
  const total = w * 3 + gap * 2;
  const x0 = (view.width - total) / 2;
  const y = view.height / 2 - h / 2 + 26;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function bar(ctx, x, y, w, h, frac, color, back = 'rgba(140, 160, 220, 0.22)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  ctx.strokeStyle = 'rgba(220, 240, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function text(ctx, value, x, y, { size = 16, color = COLORS.text, align = 'left', bold = false, font = FONT, alpha = 1, glow = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${bold ? '700 ' : ''}${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

/** Create the renderer for a canvas: draw(state, screen, best, ui) and view(). */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 0, height: 0 };
  let vignette = null;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === view.width && h === view.height && canvas.width > 0) return;
    view.width = w;
    view.height = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, 'rgba(2, 3, 10, 0)');
    vignette.addColorStop(1, 'rgba(2, 3, 10, 0.55)');
  }

  function drawWorld(state, hidePlayer) {
    const cam = state.camera;
    const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    ctx.save();
    ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY));

    // Grid and star specks, only in the visible slice of the arena.
    const x0 = Math.max(0, cam.x - 40);
    const y0 = Math.max(0, cam.y - 40);
    const x1 = Math.min(ARENA.width, cam.x + view.width + 40);
    const y1 = Math.min(ARENA.height, cam.y + view.height + 40);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = Math.floor(x0 / 110) * 110; gx <= x1; gx += 110) {
      ctx.moveTo(gx + 0.5, y0);
      ctx.lineTo(gx + 0.5, y1);
    }
    for (let gy = Math.floor(y0 / 110) * 110; gy <= y1; gy += 110) {
      ctx.moveTo(x0, gy + 0.5);
      ctx.lineTo(x1, gy + 0.5);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(160, 190, 255, 0.35)';
    for (let gx = Math.floor(x0 / 110); gx <= x1 / 110; gx += 1) {
      for (let gy = Math.floor(y0 / 110); gy <= y1 / 110; gy += 1) {
        const hash = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
        const fx = hash - Math.floor(hash);
        const fy = (hash * 7) - Math.floor(hash * 7);
        ctx.fillRect(gx * 110 + fx * 100 + 5, gy * 110 + fy * 100 + 5, 2, 2);
      }
    }

    // The arena wall.
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.shadowColor = COLORS.border;
    ctx.shadowBlur = 14;
    ctx.strokeRect(0, 0, ARENA.width, ARENA.height);
    ctx.shadowBlur = 0;

    // Gems.
    for (const gem of state.gems) {
      const sprite = actorSprite('gem', gem.big ? 11 : 7);
      const pulse = 1 + Math.sin(state.time * 5 + gem.x) * 0.12;
      const s = sprite.width * pulse;
      ctx.drawImage(glowSprite(gem.big ? COLORS.gemBig : COLORS.gem), gem.x - 16, gem.y - 16, 32, 32);
      ctx.drawImage(sprite, gem.x - s / 2, gem.y - s / 2, s, s);
    }

    // Enemy shots.
    for (const shot of state.shots) {
      ctx.drawImage(glowSprite(COLORS.spitterShot), shot.x - 15, shot.y - 15, 30, 30);
    }

    // Enemies.
    for (const enemy of state.enemies) {
      const sprite = actorSprite(enemy.kind, enemy.radius);
      const s = sprite.width;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
      ctx.restore();
      if (enemy.flash > 0) {
        ctx.globalAlpha = Math.min(1, enemy.flash * 6);
        ctx.drawImage(glowSprite('#ffffff'), enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
        ctx.globalAlpha = 1;
      }
      if (enemy.kind !== 'boss' && enemy.maxHp >= 30 && enemy.hp < enemy.maxHp) {
        bar(ctx, enemy.x - 18, enemy.y - enemy.radius - 13, 36, 4, enemy.hp / enemy.maxHp, COLORS[enemy.kind]);
      }
    }

    // The player (not on the title backdrop, where no run is live).
    if (state.player && !hidePlayer) {
      const player = state.player;
      const sprite = actorSprite('player', player.stats.radius);
      const s = sprite.width;
      if (player.dashTimer > 0) ctx.globalAlpha = 0.75;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (player.hurtTimer > 0) {
        ctx.globalAlpha = Math.min(1, player.hurtTimer * 2.4);
        ctx.drawImage(glowSprite('#ff4040'), player.x - 30, player.y - 30, 60, 60);
        ctx.globalAlpha = 1;
      }
    }

    // Bullets: glow discs stretched along their flight.
    for (const bullet of state.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(angle);
      ctx.drawImage(glowSprite(COLORS.bullet), -17, -6, 34, 12);
      ctx.restore();
    }

    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      const s = p.size * 4;
      ctx.drawImage(glowSprite(p.color), p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // Floating texts (critical hits).
    for (const t of state.texts) {
      text(ctx, t.text, t.x, t.y, { size: t.size, color: t.color, align: 'center', bold: true, font: FONT_NUM, alpha: Math.max(0, t.life / t.maxLife) });
    }
    ctx.restore();

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, view.width, view.height);
  }

  function drawHud(state, ui) {
    const player = state.player;
    const stats = player.stats;
    // Hull, top left.
    text(ctx, 'HULL', 22, 30, { size: 12, color: COLORS.dim, bold: true });
    bar(ctx, 22, 38, 232, 15, player.hp / stats.maxHp, player.hp / stats.maxHp < 0.3 ? COLORS.hpLow : COLORS.hp);
    text(ctx, `${Math.ceil(player.hp)} / ${stats.maxHp}`, 264, 51, { size: 13, font: FONT_NUM });
    // Dash charge under the hull bar.
    const dashFrac = 1 - player.dashCooldownTimer / stats.dashCooldown;
    bar(ctx, 22, 60, 110, 6, dashFrac, dashFrac >= 1 ? COLORS.player : 'rgba(61, 243, 255, 0.4)');
    text(ctx, 'DASH', 140, 67, { size: 10, color: COLORS.dim, bold: true });

    // Clock, top centre; the boss's hull under it while it lives.
    text(ctx, formatTime(state.time), view.width / 2, 46, { size: 30, align: 'center', bold: true, font: FONT_NUM, glow: 8 });
    if (state.boss) {
      bar(ctx, view.width / 2 - 190, 58, 380, 10, state.boss.hp / state.boss.maxHp, COLORS.boss);
      text(ctx, 'VOID TYRANT', view.width / 2, 84, { size: 11, align: 'center', color: COLORS.boss, bold: true });
    }

    // Score, top right.
    text(ctx, 'SCORE', view.width - 22, 30, { size: 12, color: COLORS.dim, bold: true, align: 'right' });
    text(ctx, String(state.score), view.width - 22, 56, { size: 24, bold: true, font: FONT_NUM, align: 'right' });
    text(ctx, `KILLS ${state.kills}   LV ${state.level}`, view.width - 22, 78, { size: 13, font: FONT_NUM, align: 'right', color: COLORS.dim });

    // Experience along the bottom.
    bar(ctx, 22, view.height - 26, view.width - 44, 10, state.xp / state.xpNeed, COLORS.xp);
    text(ctx, `LEVEL ${state.level}`, 22, view.height - 34, { size: 12, color: COLORS.xp, bold: true });

    if (ui.muted) text(ctx, 'MUTED (M)', view.width - 22, view.height - 34, { size: 11, align: 'right', color: COLORS.dim });

    // Centre banner: warnings and arrivals.
    if (state.banner) {
      const b = state.banner;
      const alpha = Math.min(1, b.t / (b.maxT * 0.35), (b.maxT - b.t) / (b.maxT * 0.2) + 0.2);
      text(ctx, b.title, view.width / 2, view.height * 0.3, { size: 40, align: 'center', bold: true, glow: 16, color: '#ffd7e4', alpha });
      text(ctx, b.sub, view.width / 2, view.height * 0.3 + 30, { size: 16, align: 'center', color: COLORS.text, alpha });
    }

    // Low hull: the edges pulse red.
    if (player.hp / stats.maxHp < 0.3 && !state.over) {
      const pulse = 0.1 + 0.08 * Math.sin(ui.now * 6);
      const grad = ctx.createRadialGradient(view.width / 2, view.height / 2, Math.min(view.width, view.height) * 0.36, view.width / 2, view.height / 2, Math.max(view.width, view.height) * 0.72);
      grad.addColorStop(0, 'rgba(255, 30, 40, 0)');
      grad.addColorStop(1, `rgba(255, 30, 40, ${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, view.width, view.height);
    }
  }

  function panel(x, y, w, h, alpha = 0.72) {
    ctx.fillStyle = `rgba(8, 10, 26, ${alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(90, 130, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawTitle(state, best, ui) {
    const cx = view.width / 2;
    text(ctx, 'N E O N V O I D', cx, view.height * 0.3, { size: 74, align: 'center', bold: true, color: COLORS.player, glow: 26 });
    text(ctx, 'ARENA OF THE LAST LIGHT', cx, view.height * 0.3 + 40, { size: 17, align: 'center', color: COLORS.text });
    text(ctx, 'The swarm pours in from the dark. You are the only light it fears.', cx, view.height * 0.3 + 68, { size: 14, align: 'center', color: COLORS.dim });

    const w = 596;
    const x = cx - w / 2;
    const y = view.height * 0.3 + 96;
    panel(x, y, w, 148);
    const lines = [
      ['WASD / ARROWS', 'move'],
      ['MOUSE', 'aim — hold CLICK or SPACE to fire'],
      ['SHIFT / RIGHT-CLICK', 'dash through danger'],
      ['SURVIVE', 'gather XP, level up, break the TYRANT'],
    ];
    lines.forEach(([key, what], i) => {
      text(ctx, key, x + 26, y + 36 + i * 30, { size: 14, bold: true, color: COLORS.player, font: FONT_NUM });
      text(ctx, what, x + 226, y + 36 + i * 30, { size: 14, color: COLORS.text });
    });

    const pulse = 0.65 + 0.35 * Math.sin(ui.now * 3.4);
    text(ctx, 'CLICK OR PRESS ENTER TO START', cx, y + 196, { size: 19, align: 'center', bold: true, color: '#ffffff', alpha: pulse, glow: 12 });
    if (best > 0) text(ctx, `BEST SCORE ${best}`, cx, y + 228, { size: 14, align: 'center', color: COLORS.gem, font: FONT_NUM });
    text(ctx, 'M — sound on/off', cx, view.height - 22, { size: 12, align: 'center', color: COLORS.dim });
  }

  function drawLevelup(state, ui) {
    ctx.fillStyle = 'rgba(4, 5, 16, 0.66)';
    ctx.fillRect(0, 0, view.width, view.height);
    text(ctx, 'LEVEL UP', view.width / 2, view.height / 2 - 128, { size: 36, align: 'center', bold: true, color: COLORS.xp, glow: 16 });
    text(ctx, `Level ${state.level} — choose one upgrade`, view.width / 2, view.height / 2 - 98, { size: 15, align: 'center', color: COLORS.dim });
    const rects = levelupCardRects(view);
    state.choices.forEach((choice, i) => {
      const r = rects[i];
      const hover = ui.aimX >= r.x && ui.aimX <= r.x + r.w && ui.aimY >= r.y && ui.aimY <= r.y + r.h;
      ctx.fillStyle = hover ? 'rgba(24, 34, 74, 0.95)' : 'rgba(12, 16, 38, 0.92)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = hover ? COLORS.xp : 'rgba(90, 130, 255, 0.55)';
      ctx.lineWidth = hover ? 2 : 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      text(ctx, choice.name, r.x + r.w / 2, r.y + 58, { size: 19, align: 'center', bold: true, color: '#ffffff' });
      text(ctx, choice.text, r.x + r.w / 2, r.y + 88, { size: 13.5, align: 'center', color: COLORS.xp });
      text(ctx, `press ${i + 1} or click`, r.x + r.w / 2, r.y + r.h - 18, { size: 11, align: 'center', color: COLORS.dim });
    });
  }

  function drawResults(state, best, ui, victory) {
    ctx.fillStyle = victory ? 'rgba(3, 18, 16, 0.7)' : 'rgba(16, 4, 10, 0.72)';
    ctx.fillRect(0, 0, view.width, view.height);
    const cx = view.width / 2;
    const top = view.height * 0.24;
    text(ctx, victory ? 'THE VOID IS SILENT' : 'SIGNAL LOST', cx, top, {
      size: 52, align: 'center', bold: true, glow: 20,
      color: victory ? COLORS.gem : '#ff5c7a',
    });
    text(ctx, victory ? 'The Void Tyrant is broken. The arena keeps your light.' : 'The swarm takes another light. It will not take the next one.', cx, top + 34, { size: 15, align: 'center', color: COLORS.text });

    const rows = [
      ['TIME SURVIVED', formatTime(state.time)],
      ['LEVEL REACHED', String(state.level)],
      ['KILLS', String(state.kills)],
      ['SCORE', String(state.score)],
      ['BEST', String(Math.max(best, state.score))],
    ];
    const w = 340;
    const x = cx - w / 2;
    const y = top + 66;
    panel(x, y, w, rows.length * 34 + 22, 0.8);
    rows.forEach(([label, value], i) => {
      text(ctx, label, x + 24, y + 38 + i * 34, { size: 14, color: COLORS.dim, bold: true });
      text(ctx, value, x + w - 24, y + 38 + i * 34, { size: 17, align: 'right', bold: true, font: FONT_NUM });
    });

    const pulse = 0.65 + 0.35 * Math.sin(ui.now * 3.4);
    text(ctx, 'CLICK OR PRESS ENTER TO PLAY AGAIN', cx, y + rows.length * 34 + 62, { size: 17, align: 'center', bold: true, color: '#ffffff', alpha: pulse, glow: 10 });
  }

  function draw(state, screen, best, ui) {
    resize();
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, view.width, view.height);
    drawWorld(state, screen === SCREEN_TITLE);
    if (screen === SCREEN_PLAY || screen === SCREEN_LEVELUP || screen === SCREEN_PAUSED) drawHud(state, ui);
    if (screen === SCREEN_TITLE) drawTitle(state, best, ui);
    else if (screen === SCREEN_LEVELUP) drawLevelup(state, ui);
    else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(4, 5, 16, 0.6)';
      ctx.fillRect(0, 0, view.width, view.height);
      text(ctx, 'PAUSED', view.width / 2, view.height / 2, { size: 40, align: 'center', bold: true, glow: 14 });
      text(ctx, 'ESC or P to resume', view.width / 2, view.height / 2 + 32, { size: 14, align: 'center', color: COLORS.dim });
    } else if (screen === SCREEN_OVER) drawResults(state, best, ui, false);
    else if (screen === SCREEN_VICTORY) drawResults(state, best, ui, true);
  }

  return {
    draw,
    view() {
      resize();
      return view;
    },
  };
}
