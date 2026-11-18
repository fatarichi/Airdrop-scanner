// token-radar-01 entry: score every pre-token protocol in the sealed snapshot
// and lay out the ranked board, the dashboard data and the judge's dossier.
//
//   node main.ts --input <snapshot.json|dir> [--output <dir>]
//
// With no --output it writes to $MAKEFUN_OUTPUT_DIR, or /output inside the
// grader's container. Node 22, standard library only; the scoring lives in
// lib/model.ts and the dossier writer in vendor/makefun-board.ts.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

const DOSSIER_TEXT_LIMIT = 65_536;
const SHOT_LIMIT = { max: 4, max_bytes: 524_288 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Stop with a message on stderr and the given exit code. */
function die(message: string, code: number): never {
  process.stderr.write(message);
  process.exit(code);
}

/** Read a `--flag value` or `--flag=value` argument, or fall back. */
function flag(name: string, fallback: string): string {
  const args = process.argv;
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1]!;
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

function snapshotPath(): string {
  const given = flag('input', '/input');
  const path = given.endsWith('.json') ? given : join(given, 'snapshot.json');
  if (!existsSync(path)) {
    die(`token radar: no snapshot at ${path}: pass --input <snapshot.json|directory> or mount the sealed /input\n`, 2);
  }
  return path;
}

/** Copy a directory's plain files into `dest`, skipping dotfiles; returns the names copied. */
function copyPlainFiles(dir: string, dest: string): string[] {
  if (!existsSync(dir)) return [];
  mkdirSync(dest, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const src = join(dir, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(dest, name));
    names.push(name);
  }
  return names;
}

function main(): void {
  const snapshot = parseSnapshot(readFileSync(snapshotPath(), 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const problem = boardIssue(board, snapshot);
  if (problem !== null) {
    die(`token radar: the model wrote a board the gate refuses: ${problem}\n`, 1);
  }

  const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));

  copyPlainFiles(join(root, 'dashboard'), join(outDir, 'dashboard'));
  const shots = copyPlainFiles(join(root, 'screenshots'), join(outDir, 'screenshots'));
  if (shots.length < 3) {
    die(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`, 1);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) {
      die(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`, 1);
    }
  }

  // The dossier goes last: the scorer rebuilds it from this output and compares bytes.
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, { text_max_bytes: DOSSIER_TEXT_LIMIT, screenshots: SHOT_LIMIT, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (3 files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
  );
}

main();
