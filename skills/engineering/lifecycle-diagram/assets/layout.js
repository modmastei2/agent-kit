// Shared geometry for the lifecycle diagram.
// Inlined into the page by build.mjs AND evaluated by build.mjs --check,
// so the validator measures exactly what the browser draws.
//
// Placement is automatic: a node without `row` goes to the row its kind belongs to, and a
// node without `col` is placed from the edges (main path left to right, side and branch
// states under the states they leave from). `col`/`row` on a node always win.
const KIND_ROW = { start: 0, main: 0, ok: 0, side: 1, exc: 1, cancel: 2, ret: 2 };

function autoPlace(D) {
  const nodes = D.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const fwd = D.edges.filter(e => (e.kind || 'main') !== 'back' && byId[e.from] && byId[e.to] && e.from !== e.to);
  // rows: by kind, then close the gaps so an unused row leaves no empty band
  const autoRow = nodes.filter(n => typeof n.row !== 'number');
  autoRow.forEach(n => { n.row = KIND_ROW[n.kind || 'main'] ?? 0; });
  if (autoRow.length === nodes.length && !(D.rows || []).length) {
    const used = [...new Set(nodes.map(n => n.row))].sort((a, b) => a - b);
    autoRow.forEach(n => { n.row = used.indexOf(n.row); });
  }
  if (nodes.every(n => typeof n.col === 'number')) return;
  // rank = longest path from a node with no incoming forward edge (bounded, so cycles stop)
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
  const NW = D.nodeW || 156, NH = 56, CW = D.colW || 215, RH = D.rowH || 122, PAD = 22;
  const byId = Object.fromEntries(D.nodes.map(n => [n.id, n]));
  // default sides: a same-row edge that skips a column or runs backwards arcs over the row
  // (under it, below the first row) instead of cutting through the boxes in between
  function sides(e) {
    const A = byId[e.from], B = byId[e.to];
    let fs = e.fs, ts = e.ts;
    if (fs && ts) return [fs, ts, false];
    let arc = false;
    if (A.row === B.row) {
      const dc = B.col - A.col;
      if (dc > 1.3 || dc < 0) { arc = true; const s = A.row === 0 ? 't' : 'b'; fs = fs || s; ts = ts || s; }
      else if (dc >= 0) { fs = fs || 'r'; ts = ts || 'l'; } else { fs = fs || 'l'; ts = ts || 'r'; }
    } else if (B.row > A.row) { fs = fs || 'b'; ts = ts || 't'; } else { fs = fs || 't'; ts = ts || 'b'; }
    return [fs, ts, arc];
  }
  const firstRow = Math.min(...D.nodes.map(n => n.row));
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
    // a pair of opposite edges between the same two states runs side by side, not on top of each other
    let fo = e.fo, to_ = e.to_;
    const rev = D.edges.find(o => o.from === e.to && o.to === e.from);
    if (rev && !arc && !sides(rev)[2] && [e.fs, e.ts, e.fo, e.to_, rev.fs, rev.ts, rev.fo, rev.to_].every(v => v == null)) {
      const off = (e.from < e.to ? 1 : -1) * (fs === 't' || fs === 'b' ? 24 : 10);
      fo = off; to_ = off;
    }
    const [x1, y1, dx1, dy1] = anchor(A, fs, fo);
    const [x2, y2, dx2, dy2] = anchor(B, ts, to_);
    const dist = Math.hypot(x2 - x1, y2 - y1);
    // an automatic arc rises with its span but stays inside the space above the row
    const k = e.k || (arc ? Math.min(TOP - 12, 28 + dist * 0.07) / 0.75 : Math.max(26, Math.min(110, dist * .42)));
    const c1 = [x1 + dx1 * k, y1 + dy1 * k], c2 = [x2 + dx2 * (k + 6), y2 + dy2 * (k + 6)];
    const ex = x2 + dx2 * 3, ey = y2 + dy2 * 3;
    const pts = [[x1, y1], c1, c2, [ex, ey]];
    const at = t => { const u = 1 - t; return [0, 1].map(i => u*u*u*pts[0][i] + 3*u*u*t*pts[1][i] + 3*u*t*t*pts[2][i] + t*t*t*pts[3][i]); };
    const mid = at(.5);
    return { d: `M${x1},${y1} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${ex},${ey}`, mx: mid[0] + (e.lx || 0), my: mid[1] + (e.ly || 0), at };
  }
  // rough rendered width of an edge label at 10.5px; combining marks (any script) take no width
  function labelWidth(s) { return String(s || '').replace(/\p{M}/gu, '').length * 6 + 6; }
  const maxCol = Math.max(...D.nodes.map(n => n.col)), maxRow = Math.max(...D.nodes.map(n => n.row));
  const W = PAD * 2 + maxCol * CW + NW + 20, H = TOP + maxRow * RH + NH + 24;
  return { NW, NH, CW, RH, PAD, TOP, W, H, byId, box, edgeGeom, labelWidth };
}
if (typeof module !== 'undefined') module.exports = { makeLayout };
