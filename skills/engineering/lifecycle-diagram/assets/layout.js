// Shared geometry for the lifecycle diagram.
// Inlined into the page by build.mjs AND evaluated by build.mjs --check,
// so the validator measures exactly what the browser draws.
//
// Placement is automatic: a node without `row` goes to the row its kind belongs to, and a
// node without `col` is placed from the edges (main path left to right, side and branch
// states under the states they leave from). `col`/`row`/`colW` set in the data always win.
const KIND_ROW = { start: 0, main: 0, ok: 0, side: 1, exc: 1, cancel: 2, ret: 2 };

// rough rendered width of an edge label at 10.5px: Latin ~6px a character, other scripts
// wider; combining marks (Thai vowels and tones, accents) take no width
function labelWidth(s) {
  let w = 6;
  for (const ch of String(s || '').replace(/\p{M}/gu, '')) w += ch.charCodeAt(0) < 0x250 ? 6 : 7;
  return w;
}

// forward edges without loops: `back` edges are ignored, and any other edge that closes a
// loop (found walking from the start, scenario paths first) is treated as going back
function forwardEdges(D, byId) {
  const cand = D.edges.filter(e => (e.kind || 'main') !== 'back' && byId[e.from] && byId[e.to] && e.from !== e.to);
  const order = [];
  const longest = [...(D.outcomes || [])].sort((a, b) => (b.path || []).length - (a.path || []).length);
  for (const o of longest) for (const id of o.path || []) if (byId[id] && !order.includes(id)) order.push(id);
  const roots = [...D.nodes.filter(n => n.kind === 'start').map(n => n.id), ...order, ...D.nodes.map(n => n.id)];
  const prio = id => { const i = order.indexOf(id); return i < 0 ? 1e9 : i; };
  const state = {}, keep = new Set();
  const visit = id => {
    state[id] = 1;
    for (const e of cand.filter(x => x.from === id).sort((a, b) => prio(a.to) - prio(b.to))) {
      if (state[e.to] === 1) continue;           // closes a loop
      keep.add(e);
      if (!state[e.to]) visit(e.to);
    }
    state[id] = 2;
  };
  for (const id of roots) if (!state[id]) visit(id);
  return cand.filter(e => keep.has(e));
}

function autoPlace(D) {
  const nodes = D.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const fwd = forwardEdges(D, byId);
  // rows: by kind, then close the gaps so an unused row leaves no empty band
  const autoRow = nodes.filter(n => typeof n.row !== 'number');
  autoRow.forEach(n => { n.row = KIND_ROW[n.kind || 'main'] ?? 0; });
  if (autoRow.length === nodes.length && !(D.rows || []).length) {
    const used = [...new Set(nodes.map(n => n.row))].sort((a, b) => a - b);
    autoRow.forEach(n => { n.row = used.indexOf(n.row); });
  }
  if (nodes.every(n => typeof n.col === 'number')) return;
  // rank = longest path from the start over the loop-free edges, so a shortcut never
  // pulls a later state forward
  const rank = Object.fromEntries(nodes.map(n => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of fwd) if (rank[e.to] < rank[e.from] + 1) { rank[e.to] = rank[e.from] + 1; changed = true; }
    if (!changed) break;
  }
  // the main row gets one column per distinct rank, in data order for ties
  const mainRow = Math.min(...nodes.map(n => n.row));
  const ranks = [...new Set(nodes.filter(n => n.row === mainRow).map(n => rank[n.id]))].sort((a, b) => a - b);
  const colOfRank = r => { let i = 0; while (i < ranks.length - 1 && ranks[i + 1] <= r) i++; return i + (r - ranks[i]) * 0.5; };
  const placed = n => typeof n.col === 'number';
  nodes.filter(n => !placed(n) && n.row === mainRow).forEach(n => { n.col = colOfRank(rank[n.id]); });
  // other rows: half a column right of a single source, or centred under several sources
  for (let pass = 0; pass < nodes.length && nodes.some(n => !placed(n)); pass++) {
    for (const n of nodes.filter(x => !placed(x))) {
      const src = fwd.filter(e => e.to === n.id).map(e => byId[e.from]).filter(placed);
      if (!src.length && pass < nodes.length - 1 && fwd.some(e => e.to === n.id)) continue;
      const cols = src.map(s => s.col);
      n.col = !cols.length ? colOfRank(rank[n.id]) : cols.length === 1 ? cols[0] + 0.5 : cols.reduce((a, b) => a + b, 0) / cols.length;
    }
  }
  // keep auto-placed boxes in one row from overlapping: push them right in steps of half a column
  const auto = new Set(nodes.filter(n => n._auto).map(n => n.id));
  for (const row of new Set(nodes.map(n => n.row))) {
    const inRow = nodes.filter(n => n.row === row).sort((a, b) => a.col - b.col);
    for (let i = 1; i < inRow.length; i++)
      if (auto.has(inRow[i].id) && inRow[i].col - inRow[i - 1].col < 1) inRow[i].col = Math.ceil((inRow[i - 1].col + 1) * 2) / 2;
  }
}

function makeLayout(D) {
  D.nodes.forEach(n => { if (typeof n.col !== 'number') n._auto = true; });
  autoPlace(D);
  const NW = D.nodeW || 156, NH = 56, RH = D.rowH || 122, PAD = 22;
  const byId = Object.fromEntries(D.nodes.map(n => [n.id, n]));
  const between = (A, B) => D.nodes.some(n => n !== A && n !== B && n.row === A.row && n.col > Math.min(A.col, B.col) && n.col < Math.max(A.col, B.col));
  // default sides: same-row neighbours connect straight (either direction); a same-row edge
  // with a box in the way arcs over the row, or under it for any row but the first
  function sides(e) {
    const A = byId[e.from], B = byId[e.to];
    let fs = e.fs, ts = e.ts;
    if (fs && ts) return [fs, ts, false];
    let arc = false;
    if (A.row === B.row) {
      if (between(A, B)) { arc = true; const s = A.row === firstRow ? 't' : 'b'; fs = fs || s; ts = ts || s; }
      else if (B.col >= A.col) { fs = fs || 'r'; ts = ts || 'l'; } else { fs = fs || 'l'; ts = ts || 'r'; }
    } else if (B.row > A.row) { fs = fs || 'b'; ts = ts || 't'; } else { fs = fs || 't'; ts = ts || 'b'; }
    return [fs, ts, arc];
  }
  const firstRow = Math.min(...D.nodes.map(n => n.row));
  // column width: wide enough for the longest label sitting between two neighbours in a row
  let CW = D.colW || 215;
  if (!D.colW) for (const e of D.edges) {
    const A = byId[e.from], B = byId[e.to];
    if (!A || !B || !e.label || A.row !== B.row || e.fs || e.ts) continue;
    const [fs, , arc] = sides(e);
    const dc = Math.abs(B.col - A.col);
    if (!arc && (fs === 'r' || fs === 'l') && dc > 0) CW = Math.max(CW, Math.ceil((NW + labelWidth(e.label) + 18) / dc));
  }
  const topArcs = D.edges.some(e => byId[e.from] && byId[e.to] && byId[e.from].row === firstRow && sides(e)[0] === 't' && sides(e)[1] === 't');
  const TOP = D.top || (topArcs ? 78 : 30);
  function box(n) {
    const w = n.w || NW; const cx = PAD + n.col * CW + NW / 2;
    return { x: cx - w / 2, y: TOP + n.row * RH, w, h: NH, cx, cy: TOP + n.row * RH + NH / 2 };
  }
  function anchor(b, side, off) {
    off = off || 0;
    if (side === 't') return [b.cx + off, b.y, 0, -1];
    if (side === 'b') return [b.cx + off, b.y + b.h, 0, 1];
    if (side === 'l') return [b.x, b.cy + off, -1, 0];
    return [b.x + b.w, b.cy + off, 1, 0];
  }
  function edgeGeom(e) {
    const A = box(byId[e.from]), B = box(byId[e.to]);
    const [fs, ts, arc] = sides(e);
    // a pair of opposite edges between the same two states runs side by side, labels outside
    let fo = e.fo, to_ = e.to_, lxAuto = 0, lyAuto = 0;
    const rev = D.edges.find(o => o.from === e.to && o.to === e.from);
    if (rev && !arc && !sides(rev)[2] && [e.fs, e.ts, e.fo, e.to_, rev.fs, rev.ts, rev.fo, rev.to_].every(v => v == null)) {
      const sign = e.from < e.to ? 1 : -1, vertical = fs === 't' || fs === 'b';
      fo = to_ = sign * (vertical ? 24 : 10);
      if (vertical) lxAuto = sign * (labelWidth(e.label) / 2 + 4); else lyAuto = sign * 9;
    }
    const [x1, y1, dx1, dy1] = anchor(A, fs, fo);
    const [x2, y2, dx2, dy2] = anchor(B, ts, to_);
    const dist = Math.hypot(x2 - x1, y2 - y1);
    // an automatic arc rises with its span; over the first row it stays inside the space above it
    const k = e.k || (arc ? (fs === 't' ? Math.min(TOP - 12, 28 + dist * 0.07) : 28 + dist * 0.07) / 0.75 : Math.max(26, Math.min(110, dist * .42)));
    const c1 = [x1 + dx1 * k, y1 + dy1 * k], c2 = [x2 + dx2 * (k + 6), y2 + dy2 * (k + 6)];
    const ex = x2 + dx2 * 3, ey = y2 + dy2 * 3;
    const pts = [[x1, y1], c1, c2, [ex, ey]];
    const at = t => { const u = 1 - t; return [0, 1].map(i => u*u*u*pts[0][i] + 3*u*u*t*pts[1][i] + 3*u*t*t*pts[2][i] + t*t*t*pts[3][i]); };
    const mid = at(.5);
    return { d: `M${x1},${y1} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${ex},${ey}`, mx: mid[0] + (e.lx ?? lxAuto), my: mid[1] + (e.ly ?? lyAuto), at };
  }
  // the canvas grows to hold every box, line and label (an arc under the last row included)
  const maxCol = Math.max(...D.nodes.map(n => n.col)), maxRow = Math.max(...D.nodes.map(n => n.row));
  let W = PAD * 2 + maxCol * CW + NW + 20, H = TOP + maxRow * RH + NH + 24;
  for (const e of D.edges) {
    if (!byId[e.from] || !byId[e.to]) continue;
    const g = edgeGeom(e);
    for (let t = 0; t <= 1.0001; t += 0.05) { const p = g.at(t); W = Math.max(W, p[0] + 12); H = Math.max(H, p[1] + 12); }
    if (e.label) { W = Math.max(W, g.mx + labelWidth(e.label) / 2 + 8); H = Math.max(H, g.my + 14); }
  }
  return { NW, NH, CW, RH, PAD, TOP, W, H, byId, box, edgeGeom, labelWidth };
}
if (typeof module !== 'undefined') module.exports = { makeLayout };
