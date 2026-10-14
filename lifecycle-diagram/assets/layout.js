// Shared geometry for the lifecycle diagram.
// Inlined into the page by build.mjs AND evaluated by build.mjs --check,
// so the validator measures exactly what the browser draws.
function makeLayout(D) {
  const NW = D.nodeW || 156, NH = 56, CW = D.colW || 215, RH = D.rowH || 122, PAD = 22, TOP = D.top || 26;
  const byId = Object.fromEntries(D.nodes.map(n => [n.id, n]));
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
    let fs = e.fs, ts = e.ts;
    if (!fs || !ts) {
      const dy = B.cy - A.cy;
      if (Math.abs(dy) < 4) { if (B.cx > A.cx) { fs = fs || 'r'; ts = ts || 'l'; } else { fs = fs || 'l'; ts = ts || 'r'; } }
      else if (dy > 0) { fs = fs || 'b'; ts = ts || 't'; } else { fs = fs || 't'; ts = ts || 'b'; }
    }
    const [x1, y1, dx1, dy1] = anchor(A, fs, e.fo);
    const [x2, y2, dx2, dy2] = anchor(B, ts, e.to_);
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const k = e.k || Math.max(26, Math.min(110, dist * .42));
    const c1 = [x1 + dx1 * k, y1 + dy1 * k], c2 = [x2 + dx2 * (k + 6), y2 + dy2 * (k + 6)];
    const ex = x2 + dx2 * 3, ey = y2 + dy2 * 3;
    const pts = [[x1, y1], c1, c2, [ex, ey]];
    const at = t => { const u = 1 - t; return [0, 1].map(i => u*u*u*pts[0][i] + 3*u*u*t*pts[1][i] + 3*u*t*t*pts[2][i] + t*t*t*pts[3][i]); };
    const mid = at(.5);
    return { d: `M${x1},${y1} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${ex},${ey}`, mx: mid[0] + (e.lx || 0), my: mid[1] + (e.ly || 0), at };
  }
  // rough rendered width of an edge label at 10.5px (Thai combining marks take no width)
  function labelWidth(s) { return String(s || '').replace(/[ัิ-ฺ็-๎]/g, '').length * 6 + 6; }
  const maxCol = Math.max(...D.nodes.map(n => n.col)), maxRow = Math.max(...D.nodes.map(n => n.row));
  const W = PAD * 2 + maxCol * CW + NW + 20, H = TOP + maxRow * RH + NH + 24;
  return { NW, NH, CW, RH, PAD, TOP, W, H, byId, box, edgeGeom, labelWidth };
}
if (typeof module !== 'undefined') module.exports = { makeLayout };
