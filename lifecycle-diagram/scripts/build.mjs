#!/usr/bin/env node
// Build a self-contained lifecycle-diagram HTML page from a data file, and lint its layout.
//
//   node build.mjs <data.js> <out.html>      validate + write the page
//   node build.mjs <data.js> --check         validate only
//
// <data.js> assigns `window.DATA = {...}` (see references/data-schema.md).
// Exit code 1 on schema errors. Layout problems (edge through a node, overlapping
// labels, outcome step with no edge) are printed as warnings — fix them by moving
// nodes (col/row) or nudging edges (fs/ts/fo/to_/k/lx/ly), then rebuild.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'assets');
const [dataPath, outArg] = process.argv.slice(2);
if (!dataPath || !outArg) {
  console.error('usage: node build.mjs <data.js> <out.html> | --check');
  process.exit(2);
}
const checkOnly = outArg === '--check';

const layoutSrc = fs.readFileSync(path.join(assets, 'layout.js'), 'utf8');
const dataSrc = fs.readFileSync(dataPath, 'utf8');
const ctx = { window: {}, module: undefined };
vm.createContext(ctx);
try {
  vm.runInContext(layoutSrc, ctx, { filename: 'layout.js' });
  vm.runInContext(dataSrc, ctx, { filename: path.basename(dataPath) });
} catch (e) {
  console.error(`ERROR evaluating ${dataPath}: ${e.message}`);
  process.exit(1);
}
const D = ctx.window.DATA;
const errors = [], warns = [];
if (!D || !Array.isArray(D.nodes) || !Array.isArray(D.edges)) {
  console.error('ERROR: data file must set window.DATA with nodes[] and edges[]');
  process.exit(1);
}

/* ---- schema ---- */
const KINDS = ['start', 'main', 'side', 'ok', 'cancel', 'ret', 'exc'];
const EKINDS = ['main', 'cancel', 'ret', 'exc', 'back'];
const ids = new Set();
for (const n of D.nodes) {
  if (!n.id) errors.push(`node without id: ${JSON.stringify(n).slice(0, 60)}`);
  else if (ids.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
  ids.add(n.id);
  if (n.raw == null) errors.push(`node "${n.id}" has no raw`);
  if (typeof n.col !== 'number' || typeof n.row !== 'number') errors.push(`node "${n.id}" needs numeric col and row`);
  if (n.kind && !KINDS.includes(n.kind)) errors.push(`node "${n.id}" kind "${n.kind}" not one of ${KINDS.join('/')}`);
  if (n.effect && !(D.effects && D.effects[n.effect])) errors.push(`node "${n.id}" effect "${n.effect}" missing from DATA.effects`);
}
for (const e of D.edges) {
  if (!ids.has(e.from)) errors.push(`edge from unknown node "${e.from}"`);
  if (!ids.has(e.to)) errors.push(`edge to unknown node "${e.to}"`);
  if (e.kind && !EKINDS.includes(e.kind)) errors.push(`edge ${e.from}→${e.to} kind "${e.kind}" not one of ${EKINDS.join('/')}`);
}
for (const o of D.outcomes || []) {
  for (const id of o.path || []) if (!ids.has(id)) errors.push(`outcome "${o.id}" references unknown node "${id}"`);
  for (let i = 0; i < (o.path || []).length - 1; i++)
    if (!D.edges.some(e => e.from === o.path[i] && e.to === o.path[i + 1]))
      warns.push(`outcome "${o.id}": no edge ${o.path[i]} → ${o.path[i + 1]} (step will not highlight)`);
}
if (!D.accent) warns.push('no DATA.accent — using default blue');

/* ---- layout lint (same geometry as the browser) ---- */
if (!errors.length) {
  const L = ctx.makeLayout(D);
  const rects = D.nodes.map(n => ({ id: n.id, ...L.box(n) }));
  const inside = (p, r, pad) => p[0] > r.x - pad && p[0] < r.x + r.w + pad && p[1] > r.y - pad && p[1] < r.y + r.h + pad;
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++)
      if (overlap(rects[i], rects[j])) warns.push(`nodes overlap: ${rects[i].id} and ${rects[j].id}`);
  // box text must fit: code is 12.5px mono (~7.3px/char), th is 11.5px (~6.4px/char, Thai marks free)
  for (const n of D.nodes) {
    const b = L.box(n), code = String(n.code || n.raw);
    if (code.length * 7.3 > b.w - 10) warns.push(`node ${n.id}: "${code}" is too wide for its box — set a shorter code or a larger w`);
    if (n.th && L.labelWidth(n.th) * 1.07 > b.w - 8) warns.push(`node ${n.id}: second line "${n.th}" is too wide — shorten th or set w`);
  }
  // row labels sit at the left edge above each row
  const rowBoxes = (D.rows || []).map((r, i) => ({ x: 8, y: L.TOP + i * L.RH - 20, w: L.labelWidth(r) * 1.15, h: 14, name: `row label "${r}"` }));
  for (const rb of rowBoxes) for (const r of rects) if (overlap(rb, r)) warns.push(`${rb.name} overlaps node ${r.id} — shorten it or raise top`);
  const labels = [], polys = [];
  for (const e of D.edges) {
    const g = L.edgeGeom(e);
    const hit = new Set();
    for (let t = 0.06; t <= 0.94; t += 0.02) {
      const p = g.at(t);
      for (const r of rects) if (r.id !== e.from && r.id !== e.to && inside(p, r, 3)) hit.add(r.id);
    }
    for (const id of hit) warns.push(`edge ${e.from} → ${e.to} passes through node ${id}`);
    const poly = []; for (let t = 0; t <= 1.0001; t += 0.05) poly.push(g.at(t));
    polys.push({ e, poly });
    if (e.label) {
      const w = L.labelWidth(e.label);
      const lb = { x: g.mx - w / 2, y: g.my - 7, w, h: 14, name: `"${e.label}" (${e.from}→${e.to})` };
      for (const r of rects) if (overlap(lb, r)) warns.push(`label ${lb.name} overlaps node ${r.id} — shorten it, move it (lx/ly) or widen colW`);
      for (const o of labels) if (overlap(lb, o)) warns.push(`label ${lb.name} overlaps label ${o.name}`);
      labels.push(lb);
    }
  }
  // edge crossings: not an error, but the number to drive down when the diagram looks tangled
  const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])); return o(a,b,c) * o(a,b,d) < 0 && o(c,d,a) * o(c,d,b) < 0; };
  let crossings = 0;
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
    const A = polys[i], B = polys[j];
    if ([A.e.from, A.e.to].some(x => x === B.e.from || x === B.e.to)) continue;   // edges sharing a node meet by design
    let hit = false;
    for (let a = 0; a < A.poly.length - 1 && !hit; a++) for (let b = 0; b < B.poly.length - 1 && !hit; b++) if (segX(A.poly[a], A.poly[a+1], B.poly[b], B.poly[b+1])) hit = true;
    if (hit) crossings++;
  }
  console.log(`layout: ${D.nodes.length} nodes, ${D.edges.length} edges, ${crossings} edge crossing(s), viewBox ${Math.round(L.W)}×${Math.round(L.H)}` +
    (L.W > 1600 ? '  (wide: text will render small — consider fewer columns or a smaller colW)' : ''));
}

for (const w of warns) console.warn('WARN  ' + w);
for (const e of errors) console.error('ERROR ' + e);
if (errors.length) process.exit(1);
if (checkOnly) { console.log(warns.length ? `${warns.length} warning(s)` : 'clean'); process.exit(0); }

/* ---- render ---- */
function soft(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(36,67,201,${a})`;
  const v = parseInt(m[1], 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}
const light = D.accent?.light || '#2443c9', dark = D.accent?.dark || '#8ea6ff';
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = fs.readFileSync(path.join(assets, 'template.html'), 'utf8')
  .replace('__LANG__', D.lang || 'th')
  .replace('__TITLE__', escAttr(D.title || D.name))
  .replace('__ACCENT__', light).replace('__ACCENT_SOFT__', soft(light, .09))
  .split('__ACCENT_DARK__').join(dark).split('__ACCENT_SOFT_DARK__').join(soft(dark, .14))
  .replace('/*__LAYOUT__*/', () => layoutSrc)
  .replace('/*__DATA__*/', () => dataSrc);
fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
fs.writeFileSync(outArg, html);
console.log(`wrote ${outArg} (${(html.length / 1024).toFixed(0)} KB)${warns.length ? ` — ${warns.length} warning(s) above` : ''}`);
