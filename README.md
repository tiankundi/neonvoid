# neonvoid

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/tiankundi/neonvoid/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/tiankundi/neonvoid/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# NEONVOID — Arena of the Last Light

A neon arena-survival shooter for the browser. You are the last light in a dark arena;
the swarm pours in from every side. Survive the waves, gather the XP the dead leave
behind, choose how your ship grows — and at 3:30 the Void Tyrant comes for you. Break
it and the arena is yours. Fall, and the swarm takes another light.

Pure vanilla JavaScript and canvas: no build step, no dependencies, no network. Sound
is synthesized live with WebAudio. One HTML file opens the whole game.

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in a desktop browser. (Opening `game/index.html` straight
from disk does not work — the game is a set of ES modules, and browsers will not load
those from `file://`. Any static file server does.)

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold click or Space | Fire |
| Shift / right-click | Dash (brief invulnerability) |
| 1 / 2 / 3 or click | Choose a level-up upgrade |
| Esc or P | Pause |
| M | Sound on/off |
| Enter | Start / restart |

## The game

- **Five enemy kinds**, each with its own behaviour and colour: mites that chase,
  stingers that telegraph and lunge, splitters that burst into mites, spitters that
  keep their distance and shoot, and brutes that soak up fire.
- **A spawn director** spends a budget that grows with the clock, dealing enemies just
  outside your view so the pressure never lets up — and the **Void Tyrant** boss at
  3:30, with radial orb bursts, summoned mites, and an enrage below 30% hull.
- **Ten stacking upgrades** dealt three at a time on every level-up: more projectiles,
  damage, fire rate, piercing, crits, hull, regeneration, magnet range, dash recharge,
  and speed.
- **A complete loop**: title screen with instructions, HUD (hull, dash, timer, score,
  kills, level, XP bar), pause, and victory/defeat results screens with your stats,
  your best score, and one-click restart.
- **Deterministic runs**: all chance flows through a seeded generator, so
  `?seed=1234` replays the same run. `?shot=title|battle|levelup|gameover` stages a
  frame for the screenshots in `screenshots/` — an autopilot plays the real rules to
  the moment each picture shows.

## Layout

- `game/index.html` — the page, its styles, and the canvas.
- `game/src/config.js` — every tuning number: arena, player, gun, boss, palette.
- `game/src/random.js` — the seeded generator all chance flows through.
- `game/src/input.js` — keyboard and mouse, as polled state and action bits.
- `game/src/audio.js` — WebAudio sound effects and the ambient music sequencer.
- `game/src/sprites.js` — the glow-baked ship and enemy art, drawn once, blitted after.
- `game/src/enemies.js` — the five enemy kinds and the spawn director.
- `game/src/upgrades.js` — the ten level-up upgrades and their cards.
- `game/src/world.js` — the simulation: physics, combat, particles, camera, banners.
- `game/src/render.js` — everything drawn: the arena, the HUD, and every screen.
- `game/src/shots.js` — the `?shot=` screenshot scenes.
- `game/src/main.js` — boot, the fixed-step loop, and the screen state machine.
- `main.ts` — the make.fun entry point: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`.
- `vendor/makefun-game.ts` — the competition's dossier builder, vendored unchanged.

Best score is kept in `localStorage`. MIT licensed — see `LICENSE`.

---
<sub>Entered on [make.fun](https://make.fun/?ref=dj5sp1xh&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
