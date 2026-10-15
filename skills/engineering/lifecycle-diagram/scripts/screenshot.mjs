#!/usr/bin/env node
// Screenshot a built page with a headless Chromium browser so you can look at the layout.
//
//   node screenshot.mjs <page.html> <out.png> [--node <id>] [--dark] [--size 1500x1300] [--outcome <id>]
//
// --node selects a node (via #hash) so its detail panel is rendered.
// --outcome clicks an outcome button first, to check path highlighting (then --node, if given, is selected).
// --timeout <seconds> kills a hung browser (default 45).
// Browser: $BROWSER, else the usual Chrome / Edge / Chromium install paths.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [page, out] = args;
if (!page || !out) { console.error('usage: node screenshot.mjs <page.html> <out.png> [--node id] [--dark] [--size WxH] [--outcome id] [--timeout s]'); process.exit(2); }

const candidates = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean);
const browser = candidates.find(p => fs.existsSync(p));
if (!browser) { console.error('No Chromium-based browser found; set $BROWSER'); process.exit(1); }

let target = path.resolve(page);
const outcome = opt('--outcome'), node = opt('--node');
const clean = s => String(s).replace(/["\\]/g, '');
let tmp;
if (outcome) {
  // copy the page with a small script that clicks the outcome, then the node (outcome selection would otherwise win)
  tmp = path.join(path.dirname(target), `.__shot_${process.pid}.html`);
  const js = `document.querySelector('.out[data-id="${clean(outcome)}"]')?.click();` +
    (node ? `document.querySelector('.node[data-id="${clean(node)}"]')?.dispatchEvent(new Event('click'));` : '') +
    // a user-style click may smooth-scroll to the panel; pin the viewport back to the top
    `setTimeout(() => scrollTo({top: 0, behavior: 'instant'}), 300);`;
  fs.writeFileSync(tmp, fs.readFileSync(target, 'utf8').replace('</body>', `<script>${js}</script></body>`));
  target = tmp;
}
const url = pathToFileURL(target).href + (node && !outcome ? '#' + encodeURIComponent(node) : '');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lcd-shot-'));
const [w, h] = (opt('--size', '1500x1300')).split('x');
try {
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${w},${h}`,
    `--blink-settings=preferredColorScheme=${args.includes('--dark') ? 0 : 1}`,
    '--virtual-time-budget=4000',
    `--user-data-dir=${profile}`,
    `--screenshot=${path.resolve(out)}`, url,
  ], { stdio: 'ignore', timeout: Number(opt('--timeout', 45)) * 1000, killSignal: 'SIGKILL' });
} catch (e) {
  console.error(e.code === 'ETIMEDOUT' ? 'browser timed out (killed)' : `browser failed: ${e.message}`);
} finally {
  if (tmp) fs.rmSync(tmp, { force: true });
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(fs.existsSync(out) ? `wrote ${out}` : 'screenshot failed');
