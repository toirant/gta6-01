// Solmar City — the entry program for make.fun's gta6-01 bounty.
// It copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with the kit's buildDossier.
// Node 22, standard library only; run as plain `node main.ts`.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir)) {
  throw new Error('game/: no such directory in this repository');
}
if (!existsSync(shotsDir)) {
  throw new Error('screenshots/: no such directory in this repository');
}

// Start from a clean output directory so two runs write the same bytes.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Self-check: rebuilding the dossier from what we just wrote must give the
// same bytes, so two runs of this program hand in identical output.
const rebuilt = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
if (!Buffer.from(dossier).equals(Buffer.from(rebuilt))) {
  throw new Error('dossier.json is not reproducible: rebuild differs');
}

console.log(`Solmar City handed in to ${outDir} (dossier ${dossier.length} bytes).`);
