// Local re-implementation of the token-radar-01 gate's seven rows, as RULES.txt states them.
// The sealed scorer stays on the server; this checks the same conditions on /output before submit.
// Usage: node scripts/check-gate.mjs <out-dir> <snapshot.json>
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const out = process.argv[2] ?? 'out';
const snapPath = process.argv[3];
if (!snapPath || !existsSync(snapPath)) {
  console.error('usage: node scripts/check-gate.mjs <out-dir> <snapshot.json>');
  process.exit(2);
}
const snapshot = JSON.parse(readFileSync(snapPath, 'utf8'));
const snapSlugs = new Set(snapshot.protocols.map((p) => p.slug));
const watchlist = snapshot.watchlist;

const results = [];
function row(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const NAME_OK = /^[A-Za-z0-9._-]{1,128}$/;
const files = [];
function walk(dir, rel) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.')) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, `${rel}${n}/`);
    else if (st.isFile()) files.push({ rel: `${rel}${n}`, path: p, size: st.size });
  }
}
walk(out, '');

// 1. dashboard_files
{
  const dash = join(out, 'dashboard');
  const dFiles = existsSync(dash) ? files.filter((f) => f.rel.startsWith('dashboard/')) : [];
  const total = dFiles.reduce((a, f) => a + f.size, 0);
  const hasHtml = dFiles.some((f) => f.rel === 'dashboard/index.html');
  const hasCss = dFiles.some((f) => f.rel.endsWith('.css'));
  const hasJs = dFiles.some((f) => f.rel.endsWith('.js'));
  const badNames = dFiles.filter((f) => !NAME_OK.test(basename(f.rel)) || basename(f.rel).startsWith('-'));
  const urlHits = [];
  for (const f of dFiles) {
    if (!/\.(html|css|js)$/.test(f.rel)) continue;
    const text = readFileSync(f.path, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/https?:\/\/[^\s"'<>]+/);
      if (m) urlHits.push(`${f.rel}:${i + 1}: ${m[0].slice(0, 60)}`);
    });
  }
  const ok = hasHtml && hasCss && hasJs && dFiles.length <= 400 && total <= 4_194_304 && badNames.length === 0 && urlHits.length === 0;
  row('dashboard_files', ok, `${dFiles.length} files, ${total} bytes, html=${hasHtml} css=${hasCss} js=${hasJs}` +
    (badNames.length ? ` bad names: ${badNames.map((f) => f.rel).join(', ')}` : '') +
    (urlHits.length ? ` urls: ${urlHits.join(' | ')}` : ''));
}

// 2-5. board rows
let board = null;
{
  const raw = readFileSync(join(out, 'board.json'), 'utf8');
  const parsed = JSON.parse(raw);
  board = Array.isArray(parsed) ? parsed : parsed.rows;
  const bytes = Buffer.byteLength(raw);
  let issue = null;
  if (!Array.isArray(board) || board.length < 100 || board.length > 4000) issue = `${board?.length ?? 0} rows`;
  else if (bytes > 8_388_608) issue = `${bytes} bytes`;
  else {
    for (const r of board) {
      if (!snapSlugs.has(r.slug)) { issue = `unknown slug ${r.slug}`; break; }
      if (typeof r.name !== 'string' || r.name.length === 0) { issue = `empty name ${r.slug}`; break; }
      if (!Number.isSafeInteger(r.rank) || r.rank <= 0) { issue = `bad rank ${r.slug}`; break; }
      if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) { issue = `bad implied ${r.slug}`; break; }
      if (!Array.isArray(r.farm_steps)) { issue = `no farm_steps ${r.slug}`; break; }
    }
    if (!issue && board.length >= 2 && board[0].implied_value_usd === board[board.length - 1].implied_value_usd) {
      issue = 'all rows share one implied value';
    }
  }
  row('board_file', issue === null, `${board.length} rows, ${bytes} bytes${issue ? ` — ${issue}` : ''}`);
}
{
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  let issue = null;
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) { issue = `rank ${i + 1} is ${ranks[i]}`; break; }
  if (!issue) for (let i = 1; i < board.length; i++) {
    if (board[i].implied_value_usd > board[i - 1].implied_value_usd) { issue = `row ${i + 1} outranks row ${i}`; break; }
  }
  row('sorted_by_value', issue === null, `${board.length} rows, ranks 1..${board.length}${issue ? ` — ${issue}` : ''}`);
}
{
  const slugs = new Set(board.map((r) => r.slug));
  const missing = watchlist.filter((s) => !slugs.has(s));
  row('coverage', missing.length === 0, `${watchlist.length}/${watchlist.length} watchlist slugs${missing.length ? ` missing: ${missing.slice(0, 5).join(', ')}` : ''}`);
}
{
  let issue = null;
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) { issue = `${r.slug} has ${steps.length} steps`; break; }
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) { issue = `${r.slug} step ${t.length} chars`; break; }
    }
    if (issue) break;
  }
  row('farm_steps', issue === null, `${board.length} rows checked${issue ? ` — ${issue}` : ''}`);
}

// 6. screenshots
function pngSize(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'PNG' };
}
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), type: 'JPEG' };
    }
    i += 2 + len;
  }
  return null;
}
{
  const shots = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.')) : [];
  let issue = null;
  const infos = [];
  if (shots.length < 3 || shots.length > 4) issue = `${shots.length} images`;
  for (const n of shots) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(n)) { issue = `bad name ${n}`; break; }
    const buf = readFileSync(join(out, 'screenshots', n));
    if (buf.length > 524_288) { issue = `${n} is ${buf.length} bytes`; break; }
    const size = pngSize(buf) ?? jpegSize(buf);
    if (!size) { issue = `${n} is not a whole PNG or JPEG`; break; }
    const long = Math.max(size.w, size.h);
    const short = Math.min(size.w, size.h);
    infos.push(`${n} ${size.w}x${size.h} ${buf.length}B`);
    if (long > 1440 || short < 800) { issue = `${n} is ${size.w}x${size.h}`; break; }
  }
  row('screenshots', issue === null, infos.join(', ') + (issue ? ` — ${issue}` : ''));
}

// 7. dossier_matches
{
  const written = readFileSync(join(out, 'dossier.json'));
  const rebuilt = Buffer.from(buildDossier(out, { text_max_bytes: 65_536, screenshots: { max: 4, max_bytes: 524_288 }, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));
  const dossier = JSON.parse(written.toString('utf8'));
  const textBytes = Buffer.byteLength(dossier.text ?? '', 'utf8');
  const ok = written.equals(rebuilt);
  row('dossier_matches', ok, `dossier ${written.length} bytes, text ${textBytes}/65536 bytes${ok ? '' : ' — bytes differ from rebuild'}`);
}

const failed = results.filter((r) => !r.pass);
console.log(failed.length === 0 ? 'GATE: VALID (7/7)' : `GATE: INVALID (${results.length - failed.length}/7)`);
process.exit(failed.length === 0 ? 0 : 1);
