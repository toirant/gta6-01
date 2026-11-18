// main.ts — Solmar City entry program for make.fun gta6-01.
// Node 22, standard library only. Copies game/ and screenshots/ from this
// repository into the output directory and writes /output/dossier.json with
// buildDossier from the kit's vendor/makefun-game.ts.
import { buildDossier } from "./vendor/makefun-game.ts";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Fail fast on a missing page before touching the output directory.
if (!existsSync(join(repoRoot, "game", "index.html"))) {
  throw new Error("missing game/index.html in repository");
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const name of ["game", "screenshots"]) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ in repository`);
  cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
