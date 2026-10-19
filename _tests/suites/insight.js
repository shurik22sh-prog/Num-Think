'use strict';
// Focused tests of the two insight families: 'solid' (cube views) and 'trace' (one-stroke drawings).
// Every rule is re-derived here with test-side code, from the RENDERED SVG where possible:
//   solid: the three face colours of each picture are read from the SVG, mapped back to mark numbers, and consistency is
//          decided with rotation matrices (a different method from the production cross products): exactly one picture
//          can be left out so that the other three are one cube, and all four are never one cube;
//   trace: points and lines are read from the SVG; a one-stroke route is searched for by brute force (not by the odd-point rule);
//          the three normals have one and the odd picture has none; equal numbers of points and lines everywhere; no crossings.
// Also: registry (enabled, large tiles, first levels), level gating, must-reject fixtures.

const H = require('../harness');
const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.INSIGHT_SAMPLE_SCALE || 1);
const N = Math.max(60, Math.round(500 * SCALE));
const COLOURS = ['#D55E00', '#0072B2', '#009E73', '#F0B400', '#9B5DE5', '#E75480', '#56B4E9', '#7A7A8C'];
const lone = vals => { const k = vals.map(v => JSON.stringify(v)); for (let i = 0; i < 4; i++){ const rest = k.filter((_, j) => j !== i); if (rest.every(x => x === rest[0]) && k[i] !== rest[0]) return i; } return -1; };

function forced(fam){
  const p = H.loadProject();
  p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === fam; });
  return p;
}
function svgErrors(svg){
  const errs = [];
  if (!/^<svg viewBox="0 0 100 100" width="100" height="100"/.test(svg) || !/<\/svg>$/.test(svg)) errs.push('not a 100x100 svg');
  if (/NaN|undefined|Infinity|null/.test(svg)) errs.push('NaN in svg');
  const nums = [...svg.matchAll(/\b(?:x|y|cx|cy|x1|y1|x2|y2)="(-?[\d.]+)"/g)].map(m => +m[1]);
  const pts = [...svg.matchAll(/points="([^"]*)"/g)].flatMap(m => m[1].split(/[ ,]+/).filter(Boolean).map(Number));
  if ([...nums, ...pts].some(v => !Number.isFinite(v) || v < -0.5 || v > 100.5)) errs.push('outside the tile');
  return errs;
}

// ----- cube side -----
// all 24 rotations as signed permutation matrices with determinant +1
const ROT = (() => {
  const out = [], perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  perms.forEach(pm => { for (let s = 0; s < 8; s++){ const sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1]; const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let r = 0; r < 3; r++) M[r][pm[r]] = sg[r]; const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]); if (det === 1) out.push(M); } });
  return out;
})();
const col = (M, c) => [M[0][c], M[1][c], M[2][c]];
const dirKey = v => v.join(',');
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(dirKey);
// triples (top, left, right) = columns (z, x, y) of a rotation: a right-handed corner seen from the front
const SEEN = ROT.map(M => [dirKey(col(M, 2)), dirKey(col(M, 0)), dirKey(col(M, 1))]);
function consistent(views){                                                  // is there one cube (6 marks on 6 faces) that shows every view?
  const marks = [...new Set([].concat(...views))];
  if (marks.length > 6) return false;
  const assign = new Map();
  const viewOk = v => SEEN.some(tr => v.every((m, i) => assign.get(m) === tr[i]));
  const go = (i, used) => {
    if (i === marks.length) return views.every(v => v.every(m => assign.has(m)) ? viewOk(v) : true);
    for (const d of DIRS){ if (used.has(d)) continue; assign.set(marks[i], d); used.add(d); if (views.every(v => !v.every(m => assign.has(m)) || viewOk(v)) && go(i + 1, used)) return true; used.delete(d); assign.delete(marks[i]); }
    return false;
  };
  return go(0, new Set());
}
function cubeViews(svg){                                                     // three face colours of the first three polygons -> mark numbers
  const fills = [...svg.matchAll(/<polygon points="[^"]*" fill="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase());
  return fills.filter(f => COLOURS.some(c => c.toUpperCase() === f)).slice(0, 3).map(f => COLOURS.findIndex(c => c.toUpperCase() === f));   // glyph polygons are drawn in ink, not in a face colour
}

// ----- trace side -----
function traceFrom(svg){
  const nodes = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  const lines = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map(m => [[+m[1], +m[2]], [+m[3], +m[4]]]);
  const find = pt => nodes.findIndex(n => Math.hypot(n[0] - pt[0], n[1] - pt[1]) < 0.2);
  return { nodes, edges: lines.map(([a, b]) => [find(a), find(b)]) };
}
function hasOneStrokeRoute(g){                                               // brute force: walk every line exactly once, from any start
  const n = g.nodes.length, used = new Array(g.edges.length).fill(false);
  const go = (v, left) => {
    if (!left) return true;
    for (let e = 0; e < g.edges.length; e++){
      if (used[e]) continue;
      const [a, b] = g.edges[e], w = a === v ? b : (b === v ? a : -1);
      if (w < 0) continue;
      used[e] = true;
      if (go(w, left - 1)) { used[e] = false; return true; }
      used[e] = false;
    }
    return false;
  };
  for (let s = 0; s < n; s++) if (go(s, g.edges.length)) return true;
  return false;
}
const segCross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

function run(){
  test('INS-1 registry: solid (from level 4) and trace (from level 3) are ENABLED, ask for large tiles, one variant each', () => {
    const p = H.loadProject(), fams = p.evalIn('IQ_ODD_FAMILIES'), reg = p.evalIn('IQ_ODD_VARIANTS'), bad = [];
    [['solid', 4, 'cube-views'], ['trace', 3, 'one-stroke']].forEach(([k, t, v]) => {
      const f = fams.find(x => x.key === k);
      if (!f){ bad.push(k + ' missing'); return; }
      if (f.enabled !== true || f.minTier !== t || f.largeTiles !== true) bad.push(k + ' enabled=' + f.enabled + ' minTier=' + f.minTier + ' large=' + f.largeTiles);
      const vs = reg[k] || [];
      if (vs.length !== 1 || vs[0].key !== v || vs[0].enabled !== true || vs[0].minTier !== t) bad.push(k + ' variants ' + JSON.stringify(vs.map(x => x.key + ':' + x.minTier)));
    });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });
  test('INS-2 solid/cube-views: ' + N + ' questions; the colours read from the SVG show exactly one picture that cannot belong to the cube of the other three', () => {
    const bad = [], p = forced('solid'); p.seed(61);
    for (let t = 1; t <= 6; t++){ let m = null; try { p.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < 4 && !(m && /no enabled/.test(m))) bad.push('level ' + t + ' should be refused'); if (t >= 4 && m) bad.push('level ' + t + ': ' + m); }
    let invalid = 0, mirror = 0, opposite = 0, ex = null;
    for (let i = 0; i < N; i++){
      const r = p.ctx.iqOddGenerate(4), svgs = r.items.map(it => p.ctx.iqOddRenderItem(it)), errs = [];
      svgs.forEach(s => svgErrors(s).forEach(e => errs.push(e)));
      const views = svgs.map(cubeViews);
      if (views.some(v => v.some(m => m < 0) || new Set(v).size !== 3)) errs.push('face colours not readable or repeated in one picture');
      else {
        const fits = [0, 1, 2, 3].filter(k => consistent(views.filter((_, j) => j !== k)));
        if (fits.length !== 1 || fits[0] !== r.oddIndex) errs.push('removal that leaves one cube: [' + fits + '], odd ' + r.oddIndex);
        if (consistent(views)) errs.push('all four are one cube');
        if (new Set(views.map(v => v.slice().sort().join())).size !== 4) errs.push('two pictures show the same three faces');
        if (new Set([].concat(...views.filter((_, j) => j !== r.oddIndex))).size < 5) errs.push('the three normals show fewer than 5 marks');
        if (/אחרות|מנוגדות/.test(r.explanation)) opposite++; else mirror++;
      }
      if (errs.length){ invalid++; ex = ex || errs[0]; }
    }
    if (invalid) bad.push(invalid + ' invalid, e.g. ' + ex);
    if (mirror < N * 0.25 || opposite < N * 0.25) bad.push('the two kinds of impossible picture are not both common: mirror ' + mirror + ', opposite faces ' + opposite);
    return { pass: !bad.length, info: N + ' questions | mirror-order odd: ' + mirror + ', opposite-faces odd: ' + opposite + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('INS-3 trace/one-stroke: ' + Math.round(N / 2) + ' questions; a brute-force route search finds a one-stroke route in the three normals and none in the odd drawing', () => {
    const bad = [], p = forced('trace'); p.seed(62);
    for (let t = 1; t <= 6; t++){ let m = null; try { p.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < 3 && !(m && /no enabled/.test(m))) bad.push('level ' + t + ' should be refused'); if (t >= 3 && m) bad.push('level ' + t + ': ' + m); }
    let invalid = 0, ex = null; const oddCounts = {};
    for (let i = 0; i < Math.round(N / 2); i++){
      const r = p.ctx.iqOddGenerate(3), svgs = r.items.map(it => p.ctx.iqOddRenderItem(it)), errs = [];
      svgs.forEach(s => svgErrors(s).forEach(e => errs.push(e)));
      const gs = svgs.map(traceFrom);
      if (gs.some(g => g.edges.some(e => e[0] < 0 || e[1] < 0))) errs.push('a line does not end on a point');
      else {
        gs.forEach((g, k) => { const route = hasOneStrokeRoute(g); if (route === (k === r.oddIndex)) errs.push('picture ' + k + (route ? ' can be drawn in one stroke' : ' cannot be drawn in one stroke')); });
        if (new Set(gs.map(g => g.nodes.length)).size !== 1 || new Set(gs.map(g => g.edges.length)).size !== 1) errs.push('point or line counts differ');
        gs.forEach((g, k) => {
          const P = g.nodes;
          for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) if (Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < 21.9) errs.push('two points too close in ' + k);
          if (P.some(q => q[0] < 11.8 || q[0] > 88.2 || q[1] < 11.8 || q[1] > 88.2)) errs.push('a point near the edge in ' + k);
          g.edges.forEach(([a, b]) => { for (let c = 0; c < P.length; c++) if (c !== a && c !== b && segDist(P[c], P[a], P[b]) < 8.9) errs.push('a line passes close to a point in ' + k); });
          for (let x = 0; x < g.edges.length; x++) for (let y = x + 1; y < g.edges.length; y++){ const [a, b] = g.edges[x], [c, d] = g.edges[y]; if (new Set([a, b, c, d]).size === 4 && segCross(P[a], P[b], P[c], P[d])) errs.push('crossing lines in ' + k); }
          const deg = new Array(P.length).fill(0); g.edges.forEach(([a, b]) => { deg[a]++; deg[b]++; });
          if (deg.some(d => d === 0)) errs.push('a point with no line in ' + k);
        });
        const shape = gs.map(g => { const d = new Array(g.nodes.length).fill(0); g.edges.forEach(([a, b]) => { d[a]++; d[b]++; }); return { m: Math.max(...d), l: d.filter(x => x === 1).length, h: d.filter(x => x >= 4).length }; });
        ['m', 'l', 'h'].forEach(f => { if (lone(shape.map(s => s[f])) >= 0) errs.push('side measurement ' + f + ' singles out a drawing'); });
        const oddDeg = new Array(gs[r.oddIndex].nodes.length).fill(0); gs[r.oddIndex].edges.forEach(([a, b]) => { oddDeg[a]++; oddDeg[b]++; });
        const oc = oddDeg.filter(d => d % 2).length; oddCounts[oc] = (oddCounts[oc] || 0) + 1;
        const m = /יש בו (\d+) נקודות/.exec(r.explanation); if (!m || +m[1] !== oc) errs.push('explanation count');
      }
      if (errs.length){ invalid++; ex = ex || errs[0]; }
    }
    if (invalid) bad.push(invalid + ' invalid, e.g. ' + ex);
    return { pass: !bad.length, info: Math.round(N / 2) + ' questions | odd points in the odd drawing: ' + JSON.stringify(oddCounts) + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('INS-4 must-reject: two impossible cube pictures, a cube picture repeated, a one-stroke odd drawing, a drawing with a different number of lines', () => {
    const clone = o => JSON.parse(JSON.stringify(o)), bad = [];
    const verdict = (p, r) => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW ' + e.message; } };
    const chk = (label, p, r, want) => { const v = verdict(p, r); if (v !== want) bad.push(label + ' -> ' + v); };
    { const p = forced('solid'); p.seed(7); const r = p.ctx.iqOddGenerate(4); chk('solid control', p, r, 'accept');
      const two = clone(r); const n = two.items[(r.oddIndex + 1) % 4]; [n.faces[1], n.faces[2]] = [n.faces[2], n.faces[1]]; chk('two views in the wrong order', p, two, 'reject');
      const rep = clone(r); rep.items[(r.oddIndex + 1) % 4] = clone(rep.items[(r.oddIndex + 2) % 4]); chk('the same view twice', p, rep, 'reject');
      const wrong = clone(r); wrong.oddIndex = (r.oddIndex + 1) % 4; chk('wrong picture marked', p, wrong, 'reject'); }
    { const p = forced('trace'); p.seed(8); const r = p.ctx.iqOddGenerate(3); chk('trace control', p, r, 'accept');
      const same = clone(r); same.items[r.oddIndex] = clone(same.items[(r.oddIndex + 1) % 4]); chk('odd drawing replaced by a one-stroke drawing', p, same, 'reject');
      const lines = clone(r); lines.items[(r.oddIndex + 1) % 4].edges.pop(); chk('a drawing with one line fewer', p, lines, 'reject'); }
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '2 controls accepted, 5 broken fixtures rejected' };
  });
  return out;
}

module.exports = { run };
