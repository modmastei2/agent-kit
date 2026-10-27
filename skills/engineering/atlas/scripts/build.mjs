#!/usr/bin/env node
// Build a self-contained atlas page from an atlas dataset.
//
//   node build.mjs <atlas.json> <out.html> [--overlay <extra.json> ...] [--scale <px per unit>]
//                  [--direction RIGHT|DOWN] [--title <text>]
//   node build.mjs <atlas.json> --check [--overlay ...]          validate only
//
// The dataset format is references/atlas-schema.md. Overlays are merged on top in the order
// given: nodes and entities by id ( fields replaced, markers / ports / sections appended ),
// edges appended. The layout is ELK layered ( elkjs ), computed here so the page is static:
// elkjs is taken from the current project when it has it, else installed once into a cache
// folder ( needs npm and network the first time ). Exit 1 on schema errors; problems the page
// would show ( missing images, nodes nothing reaches ) are warnings.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ELK_VERSION = '0.9.3';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const opts = k => argv.flatMap((a, i) => a === k ? [argv[i + 1]] : []);
const usage = () => { console.error('usage: node build.mjs <atlas.json> <out.html>|--check [--overlay extra.json ...] [--scale n] [--direction RIGHT|DOWN] [--title text]'); process.exit(2); };
const [srcPath, outArg] = argv;
if (!srcPath || !outArg) usage();
const checkOnly = outArg === '--check';

const errors = [], warns = [];
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.error(`ERROR: ${p}: ${e.message}`); process.exit(1); } };

// ---------- load and merge ----------
const data = readJson(srcPath);
data.nodes ??= []; data.edges ??= []; data.entities ??= {}; data.groups ??= []; data.kinds ??= {}; data.edgeKinds ??= {};
for (const p of opts('--overlay')) {
  if (!fs.existsSync(p)) continue;
  const o = readJson(p);
  const byId = new Map(data.nodes.map(n => [n.id, n]));
  for (const n of o.nodes || []) {
    const base = byId.get(n.id);
    if (!base) { data.nodes.push(n); continue; }
    for (const [k, v] of Object.entries(n)) {
      if (['markers', 'ports'].includes(k)) base[k] = [...(base[k] || []), ...v];
      else if (['fields', 'files'].includes(k)) base[k] = { ...(base[k] || {}), ...v };
      else base[k] = v;
    }
  }
  for (const [id, e] of Object.entries(o.entities || {})) {
    const base = data.entities[id];
    if (!base) { data.entities[id] = e; continue; }
    for (const [k, v] of Object.entries(e)) {
      if (k === 'sections') base.sections = [...(base.sections || []), ...v];
      else if (['fields', 'files'].includes(k)) base[k] = { ...(base[k] || {}), ...v };
      else base[k] = v;
    }
  }
  data.edges.push(...(o.edges || []));
  for (const k of ['groups']) data[k].push(...(o[k] || []).filter(g => !data[k].some(x => x.id === g.id)));
  for (const k of ['kinds', 'edgeKinds', 'ui']) data[k] = { ...(data[k] || {}), ...(o[k] || {}) };
}
if (opt('--title')) data.title = opt('--title');

// ---------- validate ----------
const nodes = new Map();
for (const n of data.nodes) {
  if (!n.id) { errors.push('a node has no id'); continue; }
  if (nodes.has(n.id)) errors.push(`node ${n.id}: duplicate id`);
  nodes.set(n.id, n);
  n.ports ??= []; n.markers ??= [];
  if (n.group != null && data.groups.length && !data.groups.some(g => g.id === n.group)) warns.push(`node ${n.id}: group ${n.group} is not in groups`);
  for (const m of n.markers) {
    if (m.entity && !data.entities[m.entity]) warns.push(`node ${n.id}: marker entity ${m.entity} is not in entities`);
    if (!m.points?.length) errors.push(`node ${n.id}: a marker has no points`);
  }
  if (n.image && !checkOnly) {
    const img = path.resolve(path.dirname(path.resolve(outArg)), n.image);
    if (!/^(https?:|data:)/.test(n.image) && !fs.existsSync(img)) warns.push(`node ${n.id}: image ${n.image} not found next to the page`);
  }
}
data.edges = data.edges.filter((e, i) => {
  for (const end of ['from', 'to']) if (!nodes.has(e[end])) { warns.push(`edge ${i}: ${end} node ${e[end]} does not exist ( dropped )`); return false; }
  if (e.from === e.to) return false;
  return true;
});
// a missing reference is reported once per target, with a few of the items that point to it
const missing = new Map();
for (const [id, e] of Object.entries(data.entities))
  for (const s of e.sections || []) for (const r of s.rows || [])
    if (r.ref && !data.entities[r.ref] && !nodes.has(r.ref)) (missing.get(r.ref) || missing.set(r.ref, new Set()).get(r.ref)).add(id);
for (const [ref, from] of missing) warns.push(`${ref} does not exist, referred to by ${from.size}: ${[...from].slice(0, 4).join(', ')}${from.size > 4 ? ' ...' : ''}`);
if (errors.length) { errors.forEach(e => console.error('ERROR:', e)); process.exit(1); }

// ---------- geometry ----------
const scale = +opt('--scale', data.scale || 0.15);
const groupIndex = id => { const i = data.groups.findIndex(g => g.id === id); return i < 0 ? data.groups.length : i; };
for (const n of nodes.values()) {
  const s = n.space ??= { x0: 0, y0: 0, x1: 1, y1: 1 };
  if (n.size) [n.w, n.h] = n.size;
  else if (n.image && s.x1 - s.x0 > 1) [n.w, n.h] = [(s.x1 - s.x0) * scale, (s.y1 - s.y0) * scale];
  else [n.w, n.h] = n.image ? [480, 480] : [240, 110];
  n.w = Math.max(40, Math.round(n.w)); n.h = Math.max(30, Math.round(n.h));
}
const local = (n, p) => {
  const s = n.space;
  const fx = (p[0] - s.x0) / (s.x1 - s.x0), fy = (p[1] - s.y0) / (s.y1 - s.y0);
  return [fx * n.w, (s.flipY ? 1 - fy : fy) * n.h];
};

// orient every edge away from the roots ( breadth first, groups in order ), so the layers read
// in the flow direction and no edge loops back around the whole atlas
const roots = [...nodes.values()].filter(n => n.root).map(n => n.id);
const order = new Map();
const adj = new Map([...nodes.keys()].map(k => [k, []]));
for (const e of data.edges) { adj.get(e.from).push(e.to); if (e.both !== false) adj.get(e.to).push(e.from); }
const seeds = roots.length ? roots : [...nodes.values()].sort((a, b) => groupIndex(a.group) - groupIndex(b.group)).map(n => n.id).slice(0, 1);
const bfs = start => { const q = [...start]; while (q.length) { const k = q.shift(); if (order.has(k)) continue; order.set(k, order.size); q.push(...adj.get(k)); } };
bfs(seeds);
const unreached = [...nodes.keys()].filter(k => !order.has(k));
if (roots.length && unreached.length) warns.push(`${unreached.length} node(s) not reached from the roots: ${unreached.slice(0, 8).join(', ')}${unreached.length > 8 ? ' ...' : ''}`);
for (const k of [...nodes.values()].sort((a, b) => groupIndex(a.group) - groupIndex(b.group)).map(n => n.id)) bfs([k]);

// one edge per pair of ends; an edge that has its reverse is drawn once, both ways
const pairKey = (a, ap, b, bp) => [`${a}:${ap ?? ''}`, `${b}:${bp ?? ''}`].sort().join('|');
const edges = [], seen = new Map();
for (const e of data.edges) {
  const k = pairKey(e.from, e.fromPort, e.to, e.toPort);
  const prev = seen.get(k);
  if (prev) { if (prev.from === e.to) prev.both = true; continue; }
  let x = { ...e, both: e.both ?? false };
  if (order.get(x.from) > order.get(x.to)) x = { ...x, from: e.to, fromPort: e.toPort, to: e.from, toPort: e.fromPort, flipped: true };
  seen.set(k, x); edges.push(x);
}

const portPos = (n, pid) => {
  const p = pid != null && n.ports.find(p => String(p.id) === String(pid));
  return p ? local(n, [p.x, p.y]) : [n.w / 2, n.h / 2];
};
const side = (n, [x, y]) => {
  x = Math.min(Math.max(x, 0), n.w); y = Math.min(Math.max(y, 0), n.h);
  const s = [[x, 'WEST'], [n.w - x, 'EAST'], [y, 'NORTH'], [n.h - y, 'SOUTH']].sort((a, b) => a[0] - b[0])[0][1];
  const [px, py] = { WEST: [-8, y], EAST: [n.w, y], NORTH: [x, -8], SOUTH: [x, n.h] }[s];
  return { x: px, y: py, width: 8, height: 8, layoutOptions: { 'elk.port.side': s } };
};
const elkPorts = new Map([...nodes.keys()].map(k => [k, new Map()]));
const portId = (nid, pid, i) => {
  const key = pid != null ? `p:${pid}` : `e:${i}`;
  const m = elkPorts.get(nid);
  if (!m.has(key)) m.set(key, { id: `${nid}::${key}`, ...side(nodes.get(nid), portPos(nodes.get(nid), pid)) });
  return m.get(key).id;
};
const elkEdges = edges.map((e, i) => ({ id: `e${i}`, sources: [portId(e.from, e.fromPort, i + 'f')], targets: [portId(e.to, e.toPort, i + 't')] }));

if (checkOnly) {
  warns.forEach(w => console.warn('WARN:', w));
  console.log(`ok: ${nodes.size} nodes, ${edges.length} edges, ${Object.keys(data.entities).length} entities${warns.length ? `, ${warns.length} warning(s)` : ''}`);
  process.exit(0);
}

// ---------- ELK ----------
async function loadElk() {
  for (const base of [process.cwd(), path.join(os.homedir(), '.cache', 'atlas')]) {
    try { return createRequire(path.join(base, 'noop.js'))('elkjs/lib/elk.bundled.js'); } catch {}
  }
  const cache = path.join(os.homedir(), '.cache', 'atlas');
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(path.join(cache, 'package.json'))) fs.writeFileSync(path.join(cache, 'package.json'), '{"private":true}');
  console.error(`installing elkjs@${ELK_VERSION} into ${cache} ...`);
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', `elkjs@${ELK_VERSION}`, '--no-audit', '--no-fund', '--silent'], { cwd: cache, stdio: 'inherit', shell: process.platform === 'win32' });
  return createRequire(path.join(cache, 'noop.js'))('elkjs/lib/elk.bundled.js');
}
const ELK = await loadElk();
const dir = (opt('--direction', data.direction || 'RIGHT')).toUpperCase();
const graph = {
  id: 'atlas',
  layoutOptions: {
    'elk.algorithm': 'layered', 'elk.direction': dir, 'elk.edgeRouting': 'ORTHOGONAL',
    'elk.partitioning.activate': 'true',
    'elk.spacing.nodeNode': '160', 'elk.layered.spacing.nodeNodeBetweenLayers': '420',
    'elk.spacing.edgeNode': '60', 'elk.spacing.edgeEdge': '24',
    'elk.layered.spacing.edgeNodeBetweenLayers': '60', 'elk.layered.spacing.edgeEdgeBetweenLayers': '24',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', 'elk.layered.wrapping.strategy': 'MULTI_EDGE',
    'elk.aspectRatio': String(data.aspectRatio || 2.5),
  },
  children: [...nodes.values()].sort((a, b) => order.get(a.id) - order.get(b.id)).map(n => ({
    id: n.id, width: n.w, height: n.h,
    layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE', 'elk.partitioning.partition': String(groupIndex(n.group)) },
    ports: [...elkPorts.get(n.id).values()],
  })),
  edges: elkEdges,
};
let out;
try { out = await new ELK().layout(graph); }
catch (e) { console.error('ERROR: ELK layout failed:', e.message); process.exit(1); }

const PAD = 300;
const layout = { nodes: {}, edges: [], size: [Math.round(out.width) + 2 * PAD, Math.round(out.height) + 2 * PAD] };
for (const c of out.children) layout.nodes[c.id] = { x: Math.round(c.x + PAD), y: Math.round(c.y + PAD), w: c.width, h: c.height };
out.edges.forEach((oe, i) => {
  const e = edges[i];
  let pts = (oe.sections || []).flatMap(s => [s.startPoint, ...(s.bendPoints || []), s.endPoint]).map(p => [Math.round(p.x + PAD), Math.round(p.y + PAD)]);
  const ends = [e.from, e.fromPort, e.to, e.toPort];
  if (e.flipped) { pts = pts.reverse(); [ends[0], ends[1], ends[2], ends[3]] = [e.to, e.toPort, e.from, e.fromPort]; }
  layout.edges.push({ from: ends[0], fromPort: ends[1], to: ends[2], toPort: ends[3], kind: e.kind, label: e.label, both: e.both, pts });
});
for (const n of nodes.values()) { delete n.w; delete n.h; }

// ---------- write ----------
const tpl = fs.readFileSync(path.join(here, '..', 'assets', 'template.html'), 'utf8');
const payload = JSON.stringify({ data, layout }).replace(/</g, '\\u003c');
const html = tpl.replace('/*__ATLAS__*/null', payload).replace('<title>Atlas</title>', `<title>${String(data.title || 'Atlas').replace(/[<&]/g, '')}</title>`);
fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
fs.writeFileSync(outArg, html);
warns.forEach(w => console.warn('WARN:', w));
console.log(`wrote ${outArg}: ${nodes.size} nodes, ${edges.length} edges, ${Object.keys(data.entities).length} entities, page ${layout.size[0]}x${layout.size[1]} px`);
