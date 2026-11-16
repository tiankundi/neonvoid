// NEONVOID's entry program for make.fun's best-game-01 (Node 22, standard library only).
// The game itself is the game/ folder beside this file: plain static files a desktop
// browser plays offline, no build step and no network. This program hands it in: it copies
// game/ and screenshots/ to /output and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts, the kit's library, exactly as the scorer rebuilds it.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with: node serve.ts  (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps, passed so this program refuses anything the scorer would refuse:
// at most 4 screenshots of 256 KiB each, at most 993 files and 48 MiB under game/, no path
// under game/ longer than 1000 bytes; only the 160 KiB text cap shapes the dossier's bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
