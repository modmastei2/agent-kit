#!/usr/bin/env node
// Screenshot a built atlas with a headless Chromium browser, to look at the layout.
//
//   node screenshot.mjs <page.html> <out.png> [--node <id>] [--entity <id>] [--size 1600x1000] [--timeout <s>]
//
// --node / --entity open that item's detail panel ( and zoom to it ) through the page's #hash.
// Browser: $BROWSER, else the usual Chrome / Edge / Chromium install paths.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [page, out] = args;
if (!page || !out) { console.error('usage: node screenshot.mjs <page.html> <out.png> [--node id] [--entity id] [--size WxH] [--timeout s]'); process.exit(2); }
const browser = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean).find(p => fs.existsSync(p));
if (!browser) { console.error('No Chromium-based browser found; set $BROWSER'); process.exit(1); }
const hash = opt('--node') ? `#node=${encodeURIComponent(opt('--node'))}` : opt('--entity') ? `#entity=${encodeURIComponent(opt('--entity'))}` : '';
const url = pathToFileURL(path.resolve(page)).href + hash;
const [w, h] = opt('--size', '1600x1000').split('x');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`,
  '--virtual-time-budget=8000', `--screenshot=${path.resolve(out)}`, url],
  { stdio: 'ignore', timeout: +opt('--timeout', 45) * 1000 });
console.log(fs.existsSync(out) ? `wrote ${out}` : 'no screenshot written');
