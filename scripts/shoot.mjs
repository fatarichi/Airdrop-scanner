// Take the three gate screenshots of the final dashboard with headless Chromium.
// Usage: node scripts/shoot.mjs <out-dir>
// Writes screenshots/1-board.png, 2-detail.png, 3-filtered.png into the REPO (not out/).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolve } from 'node:path';
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] ?? join(repo, 'out'));
const page_url = `file://${outDir}/dashboard/index.html`;

const policy = '/tmp/policy.txt';
const sha = createHash('sha256').update(readFileSync(policy)).digest('hex');

const browser = await puppeteer.launch({
  executablePath: '/opt/meta-chromium/chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    `--hatch-webgl-allowed-domains-file=${policy}`, `--hatch-webgl-allowed-domains-sha256=${sha}`],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function shoot(url, name) {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  // A hash-only navigation does not reload the page, so the dashboard never reads the new
  // hash: reload once so readHash() runs on the URL we actually want to capture.
  if (url.includes('#')) await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('table', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 700));
  const buf = await page.screenshot({ path: join(repo, 'screenshots', name) });
  console.log(`${name}: ${buf.length} bytes`);
  return buf;
}

mkdirSync(join(repo, 'screenshots'), { recursive: true });

// 1. Board: the ranked board, top of the page.
await shoot(page_url, '1-board.png');

// 2. Detail: rank #1's detail dialog. The hash opens it on load.
const top = await page.evaluate(() => window.RADAR.rows[0].slug);
await shoot(`${page_url}#p=${encodeURIComponent(top)}`, '2-detail.png');
// The dialog's own text says whether the page's recompute matches board.json.
const detailText = await page.evaluate(() => document.querySelector('.detail')?.textContent ?? '');
console.log('detail recompute matches board:', /the same number board\.json carries/.test(detailText));
console.log('detail dialog open:', await page.evaluate(() => !!document.querySelector('.detail[open]')));

// 3. Filtered: one category, via the hash.
await shoot(`${page_url}#category=Lending`, '3-filtered.png');
const filteredCount = await page.evaluate(() => document.querySelector('.count')?.textContent ?? '');
console.log('filtered count label:', filteredCount);

console.log('page errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
