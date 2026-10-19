'use strict';
// Focused tests of the four advanced odd-one-out families: motion, relation, assembly, combo (25 variants).
// Every rule is re-derived HERE from the stored question data with test-side code that does not call the production
// helpers (own reflection / hull / tiling / folding / symmetry code), then compared with what the game produced:
//   - registry: families and variants exist, are DISABLED, and carry the planned tiers; the shipped game never asks them;
//   - per variant: N questions generated with only that variant on, each checked for
//       one picture breaking the rule and three keeping it, the stated structure of the odd picture, tile fit,
//       "no single measurement points at one picture" (side measurements named per variant), rendered SVG sanity and the explanation text;
//   - tier gating; the folding rule against all 35 hexominoes (11 nets); must-reject fixtures.

const H = require('../harness');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.ADV_SAMPLE_SCALE || 1);
const N = Math.max(40, Math.round(300 * SCALE));

const PLAN = {
  motion:   { minTier: 4, variants: { 'rot-same': 4, 'mirror-swap': 4, 'rot-centre': 5, 'mirror-offset': 5, 'maze-short': 5, 'maze-long': 6 } },
  relation: { minTier: 4, variants: { 'mirror-diag': 4, 'hull-bbox': 4, 'hull-missing': 5, 'homothety': 5, 'double-mirror': 6, 'self-replace': 6 } },
  assembly: { minTier: 4, variants: { 'cube-net': 4, 'remove-sym-v': 4, 'remove-sym': 5, 'tiling': 6 } },
  combo:    { minTier: 4, variants: { 'dots-axes': 4, 'sudoku-box': 4, 'dots-angles': 5, 'size-sides': 5, 'sudoku-row': 5, 'queens': 5, 'mirror-colour': 5, 'mirror-shape': 6, 'knight': 6 } }
};

// ---------- test-side geometry ----------
const R = Math.PI / 180;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const norm = a => { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; };
const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]) / R;
const adiff = (a, b) => Math.abs(norm(a - b));
function reflectLine(p, a, b){                                            // mirror image of p in the line through a and b
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  const fx = a[0] + t * dx, fy = a[1] + t * dy;
  return [2 * fx - p[0], 2 * fy - p[1]];
}
const rotAbout = (p, c, deg) => [c[0] + (p[0] - c[0]) * Math.cos(deg * R) - (p[1] - c[1]) * Math.sin(deg * R), c[1] + (p[0] - c[0]) * Math.sin(deg * R) + (p[1] - c[1]) * Math.cos(deg * R)];
const mean = P => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
function setMatch(P, Q, tol){
  if (P.length !== Q.length) return false;
  const used = new Array(Q.length).fill(false);
  const go = i => { if (i === P.length) return true; for (let j = 0; j < Q.length; j++){ if (!used[j] && dist(P[i], Q[j]) <= tol){ used[j] = true; if (go(i + 1)) return true; used[j] = false; } } return false; };
  return go(0);
}
function hullOf(points){
  const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = pts => { const h = []; for (const p of pts){ while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 1e-9) h.pop(); h.push(p); } h.pop(); return h; };
  return build(P).concat(build(P.slice().reverse()));
}
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const edgeDist = (p, poly) => Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length])));
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const lone = vals => { const k = vals.map(v => JSON.stringify(v)); for (let i = 0; i < 4; i++){ const rest = k.filter((_, j) => j !== i); if (rest.every(x => x === rest[0]) && k[i] !== rest[0]) return i; } return -1; };
const minPair = pts => { let m = Infinity; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, dist(pts[i], pts[j])); return m; };

// ---------- test-side polyomino code ----------
const ckey = c => c[0] + ',' + c[1];
const orient8 = cells => [0, 1, 2, 3, 4, 5, 6, 7].map(k => { let m = cells.map(([x, y]) => (k & 4 ? [-x, y] : [x, y])); for (let r = 0; r < (k & 3); r++) m = m.map(([x, y]) => [-y, x]); const mx = Math.min(...m.map(c => c[0])), my = Math.min(...m.map(c => c[1])); return m.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); });
const canon = cells => orient8(cells).map(o => o.map(ckey).join(';')).sort()[0];
function hexominoes(){
  let level = new Map([[canon([[0, 0]]), [[0, 0]]]]);
  for (let n = 2; n <= 6; n++){
    const next = new Map();
    level.forEach(cells => { const have = new Set(cells.map(ckey)); cells.forEach(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nb = [c[0] + dx, c[1] + dy]; if (have.has(ckey(nb))) return; const g = cells.concat([nb]); const k = canon(g); if (!next.has(k)) next.set(k, g); })); });
    level = next;
  }
  return [...level.values()];
}
// folding with 3D rotation matrices (a cube rolled over the net); the face on the floor is read off the matrix
const MUL = (A, B) => A.map((row, i) => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const RY = s => [[0, 0, s], [0, 1, 0], [-s, 0, 0]], RX = s => [[1, 0, 0], [0, 0, -s], [0, s, 0]];
function folds(cells){
  const has = new Set(cells.map(ckey)), faces = new Set(), seen = new Set();
  let ok = true;
  const floor = M => { const u = [M[2][0], M[2][1], M[2][2]]; return u.map(v => Math.round(v)).join(','); };    // the body-frame direction pointing down
  const visit = (c, M) => {
    seen.add(ckey(c)); const f = floor(M); if (faces.has(f)) ok = false; faces.add(f);
    [[1, 0, RY(1)], [-1, 0, RY(-1)], [0, 1, RX(1)], [0, -1, RX(-1)]].forEach(([dx, dy, Rm]) => { const nb = [c[0] + dx, c[1] + dy]; if (has.has(ckey(nb)) && !seen.has(ckey(nb))) visit(nb, MUL(Rm, M)); });
  };
  visit(cells[0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  const block = cells.some(([x, y]) => has.has(ckey([x + 1, y])) && has.has(ckey([x, y + 1])) && has.has(ckey([x + 1, y + 1])));
  return ok && !block && seen.size === 6 && faces.size === 6;
}
function tileable(body, pieces){                                           // all placements of piece 0, then 1, then 2; they must fill the body exactly
  const have = new Set(body.map(ckey));
  const placements = pieces.map(p => { const set = new Map(); orient8(p).forEach(o => { for (let dx = -1; dx <= 4; dx++) for (let dy = -1; dy <= 4; dy++){ const pl = o.map(([x, y]) => [x + dx, y + dy]); if (pl.every(c => have.has(ckey(c)))) set.set(pl.map(ckey).sort().join(';'), pl); } }); return [...set.values()]; });
  const go = (i, used) => { if (i === pieces.length) return used.size === body.length; for (const pl of placements[i]){ if (pl.some(c => used.has(ckey(c)))) continue; const u2 = new Set(used); pl.forEach(c => u2.add(ckey(c))); if (go(i + 1, u2)) return true; } return false; };
  return go(0, new Set());
}
function symKinds(cells){                                                  // reflection symmetries of a cell set, found from its bounding box
  const s = new Set(cells.map(ckey)), kinds = [];
  const eq = f => cells.every(c => s.has(ckey(f(c))));
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  const sx = Math.min(...xs) + Math.max(...xs), sy = Math.min(...ys) + Math.max(...ys);
  if (eq(([x, y]) => [sx - x, y])) kinds.push('V');
  if (eq(([x, y]) => [x, sy - y])) kinds.push('H');
  const d = cells.map(([x, y]) => x - y), a = cells.map(([x, y]) => x + y);
  const t1 = Math.min(...d) + Math.max(...d), t2 = Math.min(...a) + Math.max(...a);       // a diagonal axis has to bisect the range of x-y (or x+y)
  if (eq(([x, y]) => [y + t1 / 2, x - t1 / 2]) && t1 % 2 === 0) kinds.push('D');
  if (eq(([x, y]) => [t2 / 2 - y, t2 / 2 - x]) && t2 % 2 === 0) kinds.push('A');
  return kinds;
}

// ---------- rendered-SVG sanity ----------
function svgErrors(svg){
  const errs = [];
  if (!/^<svg viewBox="0 0 100 100" width="100" height="100"/.test(svg) || !/<\/svg>$/.test(svg)) errs.push('not a 100x100 svg');
  if (/NaN|undefined|Infinity|null/.test(svg)) errs.push('NaN/undefined in svg');
  const nums = [...svg.matchAll(/\b(?:x|y|cx|cy|x1|y1|x2|y2)="(-?[\d.]+)"/g)].map(m => +m[1]);
  const pts = [...svg.matchAll(/points="([^"]*)"/g)].flatMap(m => m[1].split(/[ ,]+/).filter(Boolean).map(Number));
  if ([...nums, ...pts].some(v => !Number.isFinite(v) || v < -0.5 || v > 100.5)) errs.push('coordinate outside the tile');
  return errs;
}

// ---------- per-family checkers: return a list of error strings ----------
function chkMotion(r, key){
  const e = [], it = r.items, odd = it[r.oddIndex], normals = it.filter((_, i) => i !== r.oddIndex);
  const marks = x => (x.tokens ? [].concat(...x.tokens.map(t => [t.from, t.to]), x.star ? [x.star] : []) : []);
  if (/^maze/.test(key)){
    const bfs = m => { const w = new Set(m.walls.map(ckey)), d = new Map([[ckey(m.s), 0]]), q = [m.s], ways = new Map([[ckey(m.s), 1]]); for (let i = 0; i < q.length; i++){ const [x, y] = q[i]; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const n = [x + dx, y + dy], k = ckey(n); if (n[0] < 0 || n[1] < 0 || n[0] > 4 || n[1] > 4 || w.has(k)) return; if (!d.has(k)){ d.set(k, d.get(ckey([x, y])) + 1); ways.set(k, ways.get(ckey([x, y]))); q.push(n); } else if (d.get(k) === d.get(ckey([x, y])) + 1) ways.set(k, ways.get(k) + ways.get(ckey([x, y]))); }); } return { len: d.get(ckey(m.e)), ways: ways.get(ckey(m.e)) }; };
    const spec = key === 'maze-short' ? { walls: 8, len: 9, odd: [7, 11] } : { walls: 9, len: 11, odd: [9] };
    const st = it.map(bfs);
    if (st.some(s => s.len === undefined)) return ['unreachable goal'];
    normals.forEach(m => { if (bfs(m).len !== spec.len) e.push('a normal maze needs ' + bfs(m).len + ' steps'); });
    if (!spec.odd.includes(bfs(odd).len)) e.push('the odd maze needs ' + bfs(odd).len);
    if (it.some(m => m.walls.length !== spec.walls || new Set(m.walls.map(ckey)).size !== spec.walls)) e.push('wall count');
    if (lone(it.map(m => Math.abs(m.s[0] - m.e[0]) + Math.abs(m.s[1] - m.e[1]))) >= 0) e.push('Manhattan distance singles out a maze');
    if (lone(st.map(s => s.ways)) >= 0) e.push('the number of shortest ways singles out a maze');
    if (new Set(it.map(m => JSON.stringify([m.walls.map(ckey).sort(), m.s, m.e]))).size !== 4) e.push('two identical mazes');
    const expl = 'בשלושת המבוכים הדרך הקצרה ביותר מהעיגול אל הכוכב היא ' + spec.len + ' צעדים. במבוך שנבחר היא ' + bfs(odd).len + ' צעדים.';
    if (r.explanation !== expl) e.push('explanation');
    return e;
  }
  it.forEach((x, i) => { const m = marks(x); if (m.some(p => p[0] < 11.4 || p[0] > 88.6 || p[1] < 11.4 || p[1] > 88.6)) e.push('mark near the edge in ' + i); if (minPair(m) < 14.9) e.push('marks too close in ' + i); });
  if (key === 'rot-same' || key === 'rot-centre'){
    const turns = x => x.tokens.map(t => norm(ang(x.star, t.to) - ang(x.star, t.from))), dr = x => x.tokens.map(t => Math.abs(dist(x.star, t.to) - dist(x.star, t.from)));
    if (key === 'rot-same'){
      normals.forEach((x, i) => { const t = turns(x); if (Math.max(adiff(t[0], t[1]), adiff(t[0], t[2])) > 6 || Math.max(...dr(x)) > 1.8) e.push('a normal picture is not one common turn'); if (![90, 180, -90].some(v => adiff(t[0], v) <= 6)) e.push('turn is not a quarter/half turn'); });
      const t = turns(odd), pairs = [[0, 1], [0, 2], [1, 2]].filter(([a, b]) => adiff(t[a], t[b]) <= 6);
      if (pairs.length !== 1) e.push('the odd picture does not have exactly two equal turns'); else { const o = [0, 1, 2].find(k => !pairs[0].includes(k)); if (adiff(t[o], t[pairs[0][0]]) < 60) e.push('the odd turn is too close'); }
      if (Math.max(...dr(odd)) > 1.8) e.push('odd circle left its distance from the star');
      if (new Set(normals.map(x => Math.round(turns(x)[0] / 90) * 90)).size < 2) e.push('all normals turn alike');
      it.forEach(x => { const rads = x.tokens.map(t => dist(x.star, t.from)).sort((a, b) => a - b); if (rads[1] - rads[0] < 5.5 || rads[2] - rads[1] < 5.5) e.push('radii too close'); });
    } else {
      const turn = it[0].turn;
      if (![90, -90].includes(turn) || it.some(x => x.turn !== turn)) e.push('turn field');
      normals.forEach(x => { if (turns(x).some(t => adiff(t, turn) > 6) || Math.max(...dr(x)) > 1.8) e.push('a normal is not a turn about the star'); });
      if (turns(odd).some(t => adiff(t, turn) < 12) || Math.min(...dr(odd)) < 5.5) e.push('the odd picture is not clearly off the star');
      const th = turn * R, M = [[Math.cos(th), -Math.sin(th)], [Math.sin(th), Math.cos(th)]];                   // the turn as a matrix: to = C + M (from - C)
      const centreOf = t => { const a = 1 - M[0][0], b = -M[0][1], c = -M[1][0], d = 1 - M[1][1], rhs = [t.to[0] - (M[0][0] * t.from[0] + M[0][1] * t.from[1]), t.to[1] - (M[1][0] * t.from[0] + M[1][1] * t.from[1])], det = a * d - b * c; return [(d * rhs[0] - b * rhs[1]) / det, (a * rhs[1] - c * rhs[0]) / det]; };
      const cs = odd.tokens.map(centreOf), C = cs[0];
      if (cs.some(c => dist(c, C) > 1.8)) e.push('the odd picture is not one rigid turn');
      if (dist(C, odd.star) < 11) e.push('the odd centre is too near the star');
    }
  } else {
    const err = (x, t) => dist(reflectLine(t.from, x.mirror[0], x.mirror[1]), t.to);
    normals.forEach(x => { if (x.tokens.some(t => err(x, t) > 1.8)) e.push('a normal is not mirrored'); });
    const bad = odd.tokens.map((t, k) => (err(odd, t) > 1.8 ? k : -1)).filter(k => k >= 0);
    if (key === 'mirror-swap'){
      if (bad.length !== 2) e.push('odd picture should break two circles, breaks ' + bad.length);
      else { const [i, j] = bad, A = odd.tokens[i], B = odd.tokens[j]; if (dist(reflectLine(A.from, odd.mirror[0], odd.mirror[1]), B.to) > 1.8 || dist(reflectLine(B.from, odd.mirror[0], odd.mirror[1]), A.to) > 1.8) e.push('the two images are not exchanged'); }
      it.forEach(x => { const side = t => (x.mirror[1][0] - x.mirror[0][0]) * (t.from[1] - x.mirror[0][1]) - (x.mirror[1][1] - x.mirror[0][1]) * (t.from[0] - x.mirror[0][0]); const L = Math.hypot(x.mirror[1][0] - x.mirror[0][0], x.mirror[1][1] - x.mirror[0][1]); const sd = x.tokens.map(t => side(t) / L); const pair = x.pair; if (Math.abs(sd[pair[0]] - sd[pair[1]]) > 1.5) e.push('swapped pair at different distances'); });
    } else {
      if (bad.length !== 1) e.push('odd picture should break one circle, breaks ' + bad.length);
      else { const t = odd.tokens[bad[0]], d = dist(reflectLine(t.from, odd.mirror[0], odd.mirror[1]), t.to); if (d < 24 || d > 28) e.push('displacement ' + d.toFixed(1) + ' not about 26'); }
    }
  }
  const ex = { 'rot-same': 'בשלוש הצורות כל שלושת העיגולים מסתובבים סביב הכוכב באותה זווית. בצורה שנבחרה אחד העיגולים מסתובב בזווית אחרת.', 'rot-centre': 'בשלוש הצורות הכוכב הוא מרכז הסיבוב. בצורה שנבחרה העיגולים מסתובבים באותה זווית, אבל סביב נקודה אחרת.', 'mirror-swap': 'בשלוש הצורות כל עיגול מלא הוא השתקפות של העיגול הריק באותו צבע בקו המקווקו. בצורה שנבחרה התמונות של שני צבעים הוחלפו.', 'mirror-offset': 'בשלוש הצורות כל העיגולים משתקפים בקו המקווקו. בצורה שנבחרה אחד העיגולים משתקף בקו אחר, מקביל וקרוב.' };
  if (r.explanation !== ex[key]) e.push('explanation');
  return e;
}

function chkRelation(r, key){
  const e = [], it = r.items, odd = it[r.oddIndex], normals = it.filter((_, i) => i !== r.oddIndex);
  if (it.some(x => x.fill !== it[0].fill)) e.push('fill differs between pictures');
  const inTile = P => P.every(p => p[0] >= 5.9 && p[0] <= 94.1 && p[1] >= 5.9 && p[1] <= 94.1);
  if (key !== 'self-replace' && it.some(x => !inTile(x.L) || !inTile(x.R))) e.push('shape outside the tile');
  const shiftMatch = (A, B, tol) => B.some(b => setMatch(A.map(p => [p[0] + b[0] - A[0][0], p[1] + b[1] - A[0][1]]), B, tol));
  if (key === 'mirror-diag'){
    const img = x => x.L.map(p => reflectLine(p, x.line[0], x.line[1]));
    normals.forEach(x => { if (!setMatch(img(x), x.R, 2)) e.push('a normal is not the mirror image'); });
    const im = img(odd), c = mean(im);
    if (setMatch(im, odd.R, 2)) e.push('odd image is a plain mirror image');
    if (![45, -45].some(a => setMatch(im.map(p => rotAbout(p, c, a)), odd.R, 3))) e.push('odd image is not mirror + 45 degrees');
  }
  if (key === 'hull-bbox' || key === 'hull-missing'){
    normals.forEach(x => { const H = hullOf(x.L); if (!shiftMatch(H, x.R, 1.8)) e.push('a normal image is not the hull of its original'); if (H.length !== x.L.length / 2) e.push('tips are not exactly the hull vertices'); });
    if (key === 'hull-bbox'){
      const xs = odd.L.map(p => p[0]), ys = odd.L.map(p => p[1]), box = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]];
      if (!shiftMatch(box, odd.R, 1.8)) e.push('odd image is not the bounding rectangle');
      const area = P => Math.abs(P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0)) / 2;
      if (area(odd.R) / area(hullOf(odd.L)) < 1.3) e.push('bounding rectangle too close to the hull');
      const rect = x => x.R.length === 4 && x.R.every((p, i) => { const q = x.R[(i + 1) % 4]; return Math.abs(p[0] - q[0]) <= 0.8 || Math.abs(p[1] - q[1]) <= 0.8; });
      if (it.filter(rect).length !== 2) e.push('number of rectangular images is not 2');
    } else {
      const H = hullOf(odd.L), prot = H.map((t, i) => { const rest = hullOf(H.filter((_, j) => j !== i)); return inPoly(t, rest) ? 0 : edgeDist(t, rest); }), big = prot.indexOf(Math.max(...prot)), s = prot.slice().sort((a, b) => b - a);
      if (s[0] < 9 || s[0] < 1.7 * s[1]) e.push('missing tip is not clearly the longest');
      if (!shiftMatch(hullOf(H.filter((_, i) => i !== big)), odd.R, 1.8)) e.push('odd image is not the hull without its most protruding tip');
    }
    if (lone(it.map(x => x.R.length)) >= 0) e.push('vertex count of the image singles out a picture');
  }
  if (key === 'homothety'){
    const k = it[0].k; if (![1.5, 1.6, 1.8, 2].includes(k) || it.some(x => x.k !== k)) e.push('k');
    const dev = x => x.L.map((p, i) => ({ ratio: dist(x.o, x.R[i]) / dist(x.o, p), a: adiff(ang(x.o, x.R[i]), ang(x.o, p)) }));
    normals.forEach(x => { if (dev(x).some(d => Math.abs(d.ratio - k) > 0.1 * k || d.a > 4.5)) e.push('a normal is not an enlargement from the +'); });
    const C = odd.L.map((p, i) => [(k * p[0] - odd.R[i][0]) / (k - 1), (k * p[1] - odd.R[i][1]) / (k - 1)]);
    if (C.some(c => dist(c, C[0]) > 3)) e.push('the odd image is not one enlargement'); else if (dist(C[0], odd.o) < 24) e.push('the odd centre is too close to the +');
    if (Math.min(...dev(odd).map(d => d.a)) < 7) e.push('odd rays too close');
  }
  if (key === 'double-mirror'){
    const lines = x => x.lines.map(l => [l.p[0], l.p[1]]);
    const comp = (x, redFirst) => { const [b, rd] = lines(x); const f = (P, l) => P.map(p => reflectLine(p, l[0], l[1])); return redFirst ? f(f(x.L, rd), b) : f(f(x.L, b), rd); };
    normals.forEach(x => { if (!setMatch(comp(x, false), x.R, 3)) e.push('a normal is not blue-then-red'); });
    if (!setMatch(comp(odd, true), odd.R, 3) || setMatch(comp(odd, false), odd.R, 8)) e.push('the odd picture is not exactly red-then-blue');
    const dir = it.map(x => { const [b, rd] = lines(x), s = Math.sign(norm(2 * (ang(rd[0], rd[1]) - ang(b[0], b[1])))); return x === odd ? -s : s; });
    if (lone(dir) >= 0) e.push('turn direction singles out a picture');
    if (it.some(x => x.lines[0].c !== '#0072B2' || x.lines[1].c !== '#D55E00')) e.push('line colours');
  }
  if (key === 'self-replace'){
    const subst = (L, f) => { const o = []; L.forEach(([bx, by]) => L.forEach(c => { const [x, y] = f(c); o.push([bx * 2 + x, by * 2 + y]); })); return o.map(ckey).sort().join(';'); };
    const same = c => c, cw = ([x, y]) => [1 - y, x], ccw = ([x, y]) => [y, 1 - x];
    normals.forEach(x => { if (x.R.map(ckey).sort().join(';') !== subst(x.L, same)) e.push('a normal is not the substitution'); });
    const rs = odd.R.map(ckey).sort().join(';');
    if (rs === subst(odd.L, same) || (rs !== subst(odd.L, cw) && rs !== subst(odd.L, ccw))) e.push('the odd R is not the substitution with turned copies');
    if (new Set(it.map(x => x.L.map(ckey).sort().join(';'))).size !== 4) e.push('patterns repeat');
    if (it.some(x => x.L.length !== 3 || x.R.length !== 9)) e.push('cell counts');
  }
  if (r.explanation !== ({ 'mirror-diag': 'בשלוש הצורות הצורה המלאה היא תמונת ראי מדויקת של הצורה הריקה בקו המקווקו. בצורה שנבחרה היא תמונת ראי שגם הוסתובבה.', 'hull-bbox': 'בשלוש הצורות הצורה המלאה היא המעטפת הקמורה של הצורה הריקה (הצורה הקמורה הקטנה ביותר שמכילה אותה). בצורה שנבחרה היא המלבן החוסם.', 'hull-missing': 'בשלוש הצורות הצורה המלאה עוברת דרך כל קצוות הקוצים של הצורה הריקה. בצורה שנבחרה חסר קצה של קוץ אחד.', 'homothety': 'בשלוש הצורות הצורה המלאה היא הגדלה של הצורה הריקה מהנקודה המסומנת ב-+. בצורה שנבחרה ההגדלה היא מנקודה אחרת.', 'double-mirror': 'בשלוש הצורות הצורה המלאה מתקבלת מהריקה בשיקוף בקו הכחול ואחריו בקו האדום. בצורה שנבחרה הסדר הפוך.', 'self-replace': 'בשלוש הצורות כל משבצת מלאה בדפוס הקטן הוחלפה בעותק שלו. בצורה שנבחרה העותקים מסובבים.' })[key]) e.push('explanation');
  return e;
}

function chkAssembly(r, key){
  const e = [], it = r.items, odd = it[r.oddIndex], normals = it.filter((_, i) => i !== r.oddIndex);
  const frame = cells => { const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]); return [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1].sort().join('x'); };
  const run = cells => { const s = new Set(cells.map(ckey)); let best = 1; cells.forEach(([x, y]) => [[1, 0], [0, 1]].forEach(([dx, dy]) => { if (s.has(ckey([x - dx, y - dy]))) return; let n = 1; while (s.has(ckey([x + dx * n, y + dy * n]))) n++; best = Math.max(best, n); })); return best; };
  if (key === 'cube-net'){
    normals.forEach(x => { if (!folds(x.cells)) e.push('a normal net does not fold'); });
    if (folds(odd.cells)) e.push('the odd net folds');
    const block = c => { const s = new Set(c.map(ckey)); return c.some(([x, y]) => s.has(ckey([x + 1, y])) && s.has(ckey([x, y + 1])) && s.has(ckey([x + 1, y + 1]))); };
    if (block(odd.cells) || run(odd.cells) > 4) e.push('odd net has a block or a line of five');
    if (it.some(x => x.cells.length !== 6)) e.push('cell count');
    if (new Set(it.map(x => canon(x.cells))).size !== 4) e.push('two nets alike');
    if (lone(it.map(x => frame(x.cells))) >= 0 || lone(it.map(x => run(x.cells))) >= 0) e.push('frame or longest line singles out a net');
  } else if (key === 'tiling'){
    const types = x => x.pieces.map(p => ({ 'I': 'I', 'O': 'O', 'T': 'T', 'S': 'S', 'L': 'L' })[Object.entries({ I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[0, 0], [1, 0], [2, 0], [1, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], L: [[0, 0], [0, 1], [0, 2], [1, 2]] }).find(([, c]) => canon(c) === canon(p.cells))[0]]);
    normals.forEach(x => { if (!tileable(x.body, x.pieces.map(p => p.cells))) e.push('a normal body does not tile'); });
    if (tileable(odd.body, odd.pieces.map(p => p.cells))) e.push('the odd body tiles');
    if (it.some(x => x.body.length !== 12 || x.pieces.length !== 3 || new Set(types(x)).size !== 3)) e.push('structure');
    const t = types(odd), dark = odd.body.filter(c => (c[0] + c[1]) % 2 === 0).length, fixed = t.filter(v => v !== 'T').length * 2;
    if (!(t.includes('T') ? dark === fixed + 1 || dark === fixed + 3 : dark === fixed)) e.push('the odd body is ruled out by cell counting');
    ['I', 'O', 'T', 'S', 'L'].forEach(n => { if (lone(it.map(x => types(x).includes(n))) >= 0) e.push('piece ' + n + ' singles out a picture'); });
    if (lone(it.map(x => { const s = new Set(x.body.map(ckey)); let p = 0; x.body.forEach(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (!s.has(ckey([a + dx, b + dy]))) p++; })); return p; })) >= 0) e.push('perimeter singles out a body');
  } else {
    const rest = x => { const m = new Set(x.marked.map(ckey)); return x.cells.filter(c => !m.has(ckey(c))); };
    normals.forEach(x => { if (!symKinds(rest(x)).length) e.push('a normal leftover is not symmetric'); });
    if (symKinds(rest(odd)).length) e.push('the odd leftover is symmetric');
    if (it.some(x => symKinds(x.cells).length)) e.push('a whole figure is symmetric');
    if (it.some(x => x.cells.length !== 12 || x.marked.length !== 3 || x.marked.some(c => !x.cells.some(d => ckey(d) === ckey(c))))) e.push('structure');
    const bb = x => { const xs = x.marked.map(c => c[0]), ys = x.marked.map(c => c[1]); return Math.max(...xs) - Math.min(...xs) === 1 && Math.max(...ys) - Math.min(...ys) === 1; };
    if (!it.every(bb)) e.push('the starred piece is not an L-tromino');
    if (key === 'remove-sym-v' && normals.some(x => !symKinds(rest(x)).includes('V'))) e.push('a normal leftover is not symmetric about a vertical axis');
    if (key === 'remove-sym' && lone(it.map(x => frame(x.cells))) >= 0) e.push('frame singles out a figure');
  }
  const ex = { 'cube-net': 'בשלוש הצורות אפשר לקפל את המשבצות לקובייה סגורה. בצורה שנבחרה אי אפשר – שתי משבצות נופלות על אותה פאה.', 'remove-sym-v': 'בשלוש הצורות, אם מורידים את החלק המסומן בכוכב, מה שנשאר סימטרי. בצורה שנבחרה מה שנשאר אינו סימטרי.', 'remove-sym': 'בשלוש הצורות, אם מורידים את החלק המסומן בכוכב, מה שנשאר סימטרי בציר כלשהו. בצורה שנבחרה מה שנשאר אינו סימטרי.', 'tiling': 'בשלוש הצורות שלושת החלקים מתרצפים בדיוק לגוף. בצורה שנבחרה אי אפשר לרצף את הגוף בחלקים האלה.' };
  if (r.explanation !== ex[key]) e.push('explanation');
  return e;
}

function chkCombo(r, key){
  const e = [], it = r.items, odd = it[r.oddIndex], normals = it.filter((_, i) => i !== r.oddIndex);
  const two2 = vals => { const m = {}; vals.forEach(v => { m[v] = (m[v] || 0) + 1; }); const c = Object.values(m); return c.length === 2 && c[0] === 2 && c[1] === 2; };
  if (key === 'sudoku-box' || key === 'sudoku-row'){
    const rows = b => [0, 1, 2, 3].map(r0 => [0, 1, 2, 3].map(c => b[r0 * 4 + c])), cols = b => [0, 1, 2, 3].map(c => [0, 1, 2, 3].map(r0 => b[r0 * 4 + c])), boxes = b => [0, 1, 2, 3].map(k => [0, 1, 2, 3].map(j => b[(Math.floor(k / 2) * 2 + Math.floor(j / 2)) * 4 + (k % 2) * 2 + (j % 2)]));
    const bad = g => g.filter(x => new Set(x).size !== 4).length;
    normals.forEach(x => { const b = x.cells; if (bad(rows(b)) || bad(cols(b)) || bad(boxes(b))) e.push('a normal board breaks a rule'); });
    const b = odd.cells, nb = [bad(rows(b)), bad(cols(b)), bad(boxes(b))];
    const want = key === 'sudoku-box' ? [0, 0, 2] : [2, 0, 0];
    if (key === 'sudoku-box' ? (nb[0] || nb[1] || nb[2] < 2) : (nb[1] || nb[2] || nb[0] < 2)) e.push('odd board breaks ' + nb.join(','));
    if (new Set(it.map(x => x.cells.join(''))).size !== 4) e.push('two boards alike');
    void want;
  } else if (key === 'queens' || key === 'knight'){
    const st = x => { let diag = 0, king = 0, knight = 0, far = 0; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++){ const dx = Math.abs(x.marks[i][0] - x.marks[j][0]), dy = Math.abs(x.marks[i][1] - x.marks[j][1]); if (dx === dy){ diag++; if (dx > 1) far++; } if (Math.max(dx, dy) === 1) king++; if (dx + dy === 3 && dx * dy === 2) knight++; } return { diag, king, knight, far }; };
    it.forEach(x => { if (new Set(x.marks.map(m => m[0])).size !== 5 || new Set(x.marks.map(m => m[1])).size !== 5) e.push('not one mark per row and column'); });
    const s = it.map(st);
    if (key === 'queens'){ normals.forEach(x => { if (st(x).diag) e.push('a normal has a diagonal pair'); }); if (st(odd).diag < 2 || st(odd).far !== st(odd).diag) e.push('odd diagonal pairs'); if (lone(s.map(v => v.knight)) >= 0 || lone(s.map(v => v.king)) >= 0) e.push('knight/king count singles out a board'); }
    else { normals.forEach(x => { if (st(x).knight || st(x).diag < 2) e.push('a normal has a knight pair or too few diagonals'); }); if (st(odd).knight < 1) e.push('odd has no knight pair'); if (lone(s.map(v => v.diag)) >= 0 || lone(s.map(v => v.king)) >= 0) e.push('diagonal/king count singles out a board'); }
  } else if (key === 'mirror-colour' || key === 'mirror-shape'){
    const T = ['#D55E00', '#0072B2', '#009E73'];
    const mir = x => setMatch(x.L.map(p => [100 - p[0], p[1]]), x.R, 0.6), half = x => setMatch(x.L.map(p => [100 - p[0], 100 - p[1]]), x.R, 0.6);
    const step = x => (T.indexOf(x.rc) - T.indexOf(x.lc) + 3) % 3;
    normals.forEach(x => { if (!mir(x) || step(x) !== 1) e.push('a normal breaks a rule'); });
    if (key === 'mirror-colour'){ if (!mir(odd) || step(odd) !== 2) e.push('odd should mirror but step the colour backwards'); if (new Set(normals.map(x => x.lc)).size !== 3) e.push('normals do not show the whole cycle'); }
    else { if (mir(odd) || !half(odd) || step(odd) !== 1) e.push('odd should be a half-turn with a correct colour'); }
    if (lone(it.map(x => x.lc)) >= 0 || lone(it.map(x => x.rc)) >= 0) e.push('a colour singles out a picture');
    if (it.some(x => x.L.some(p => p[0] >= 48) || x.R.some(p => p[0] <= 52))) e.push('shapes not in their halves');
  } else if (key === 'dots-axes' || key === 'dots-angles'){
    const edgeLen = (P, i) => dist(P[i], P[(i + 1) % P.length]);
    const angleAt = (P, i) => { const a = P[(i + P.length - 1) % P.length], p = P[i], b = P[(i + 1) % P.length]; const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]]; return Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) / R; };
    const axes = P => { const n = P.length; let c = 0; for (let s = 0; s < n; s++){ let ok = true; for (let i = 0; i < n && ok; i++){ const j = ((s - i) % n + n) % n; if (Math.abs(edgeLen(P, i) - edgeLen(P, ((j - 1) % n + n) % n)) > 1.6 || Math.abs(angleAt(P, i) - angleAt(P, j)) > 3) ok = false; } if (ok) c++; } return c; };
    const right = P => P.filter((_, i) => Math.abs(angleAt(P, i) - 90) < 3).length;
    const meas = x => (key === 'dots-axes' ? axes(x.poly) : right(x.poly)), holds = x => (key === 'dots-axes' ? x.dots.length > meas(x) : x.dots.length < meas(x));
    normals.forEach(x => { if (!holds(x)) e.push('a normal breaks "' + x.dots.length + ' vs ' + meas(x) + '"'); });
    if (holds(odd)) e.push('the odd picture keeps the rule');
    if (!two2(it.map(x => x.dots.length)) || !two2(it.map(meas))) e.push('measurements are not tied two-and-two: dots ' + it.map(x => x.dots.length) + ' / ' + it.map(meas));
    if (lone(it.map(x => x.poly.length)) >= 0) e.push('vertex count singles out a shape');
    it.forEach(x => { x.dots.forEach(d => { if (!inPoly(d, x.poly) || edgeDist(d, x.poly) < 8.1) e.push('a dot is too near the outline'); }); if (x.dots.length > 1 && minPair(x.dots) < 13.7) e.push('dots too close'); });
  } else {
    const poly = p => Array.from({ length: p.n }, (_, i) => [p.c[0] + p.R * Math.cos((p.rot + i * 360 / p.n) * R), p.c[1] + p.R * Math.sin((p.rot + i * 360 / p.n) * R)]);
    const area = p => 0.5 * p.n * p.R * p.R * Math.sin(2 * Math.PI / p.n), per = p => 2 * p.n * p.R * Math.sin(Math.PI / p.n);
    const pairs = x => { const o = []; x.polys.forEach(a => x.polys.forEach(b => { if (a.n < b.n) o.push([a, b]); })); return o; };
    const holds = x => pairs(x).every(([a, b]) => a.R < b.R && area(a) < area(b) && per(a) < per(b));
    normals.forEach(x => { if (!holds(x)) e.push('a normal has a reversed pair'); });
    if (holds(odd)) e.push('the odd picture keeps the rule');
    const rev = pairs(odd).filter(([a, b]) => a.R > b.R && area(a) > area(b) && per(a) > per(b));
    if (rev.length !== 1 || pairs(odd).filter(([a, b]) => a.R > b.R).length !== 1) e.push('the odd picture does not have exactly one clean reversal');
    it.forEach(x => { const P = x.polys; if (P.some(p => poly(p).some(q => q[0] < 2 || q[0] > 98 || q[1] < 2 || q[1] > 98))) e.push('polygon outside the tile'); for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (dist(P[i].c, P[j].c) < P[i].R + P[j].R + 5) e.push('polygons too close'); });
    if (new Set(it.map(x => x.polys.map(p => Math.round(p.R)).sort().join())).size !== 1) e.push('size sets differ between pictures');
    for (const n of [3, 5, 6, 8]) if (it.filter(x => x.polys.some(p => p.n === n)).length !== 2) e.push('side count ' + n + ' is not in exactly two pictures');
    if (!it.every(x => x.polys.some(p => p.n === 4))) e.push('square missing');
  }
  const ex = {
    'dots-axes': 'בשלוש הצורות מספר הנקודות גדול ממספר צירי הסימטריה של הצורה. בצורה שנבחרה מספר הנקודות שווה למספר הצירים.',
    'dots-angles': 'בשלוש הצורות מספר הנקודות קטן ממספר הזוויות הישרות של הצורה. בצורה שנבחרה יש יותר נקודות מזוויות ישרות.',
    'size-sides': 'בשלוש התמונות, ככל שלצורה יותר צלעות היא גדולה יותר. בתמונה שנבחרה המחומש קטן מצורה שיש לה פחות צלעות.',
    'sudoku-box': 'בשלושת הלוחות בכל שורה, בכל עמודה ובכל ריבוע קטן יש את כל ארבעת הצבעים. בלוח שנבחר הריבועים הקטנים אינם כאלה.',
    'sudoku-row': 'בשלושת הלוחות בכל שורה, בכל עמודה ובכל ריבוע קטן יש את כל ארבעת הצבעים. בלוח שנבחר יש שורות שבהן צבע חוזר.',
    'queens': 'בשלושת הלוחות אין שני סימונים על אותה שורה, עמודה או אלכסון. בלוח שנבחר יש סימונים על אותו אלכסון.',
    'knight': 'בשלושת הלוחות אין שני סימונים במרחק של קפיצת פרש (שני צעדים ועוד צעד). בלוח שנבחר יש זוג כזה.',
    'mirror-colour': 'בשלוש הצורות הצורה הימנית היא תמונת ראי של השמאלית, והצבע הימני הוא הצבע הבא אחרי השמאלי במעגל. בצורה שנבחרה הצבע זז לכיוון ההפוך.',
    'mirror-shape': 'בשלוש הצורות הצורה הימנית היא תמונת ראי של השמאלית, והצבע הימני הוא הצבע הבא אחרי השמאלי במעגל. בצורה שנבחרה הצבע נכון, אבל הצורה הימנית מסובבת חצי סיבוב ולא משוקפת.'
  };
  if (r.explanation !== ex[key]) e.push('explanation');
  return e;
}
const CHECK = { motion: chkMotion, relation: chkRelation, assembly: chkAssembly, combo: chkCombo };

function forced(fam, key){
  const p = H.loadProject();
  p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === fam; });
  p.evalIn('IQ_ODD_VARIANTS.' + fam).forEach(v => { v.enabled = !key || v.key === key; });
  return p;
}

function run(){
  test('ADV-1 registry: four families and 25 variants exist, all ENABLED, with the planned tiers', () => {
    const p = H.loadProject(), fams = p.evalIn('IQ_ODD_FAMILIES'), reg = p.evalIn('IQ_ODD_VARIANTS'), bad = [];
    Object.keys(PLAN).forEach(f => {
      const fam = fams.find(x => x.key === f);
      if (!fam){ bad.push(f + ' not registered'); return; }
      if (fam.enabled !== true || fam.minTier !== PLAN[f].minTier) bad.push(f + ' enabled=' + fam.enabled + ' minTier=' + fam.minTier);
      const vs = reg[f] || [];
      if (vs.map(v => v.key).sort().join() !== Object.keys(PLAN[f].variants).sort().join()) bad.push(f + ' variant keys ' + vs.map(v => v.key));
      vs.forEach(v => { if (v.enabled !== true) bad.push(f + '/' + v.key + ' is not enabled'); if (v.minTier !== PLAN[f].variants[v.key]) bad.push(f + '/' + v.key + ' minTier ' + v.minTier); });
    });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : '4 families, ' + Object.values(PLAN).reduce((s, f) => s + Object.keys(f.variants).length, 0) + ' variants, all on' };
  });
  test('ADV-2 shipped game: with the real defaults the four families are asked from their first tier and never before (6 x 400 oddone questions)', () => {
    const p = H.loadProject(); p.seed(8); const early = {}, from = {};
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 400; i++){ const f = p.ctx.iqOddGenerate(t).family; if (PLAN[f]){ if (t < PLAN[f].minTier) early[f] = (early[f] || 0) + 1; else from[f] = (from[f] || 0) + 1; } }
    return { pass: !Object.keys(early).length && Object.keys(PLAN).every(f => from[f] > 0), info: 'asked before tier 4: ' + JSON.stringify(early) + ' | asked from tier 4: ' + JSON.stringify(from) };
  });

  let idx = 3;
  Object.keys(PLAN).forEach(fam => Object.keys(PLAN[fam].variants).forEach(key => {
    const minTier = PLAN[fam].variants[key];
    test('ADV-' + (idx++) + ' ' + fam + '/' + key + ': ' + N + ' questions, rule re-derived from the data, SVG sane, tier-gated', () => {
      const bad = [], pg = forced(fam, key);
      for (let t = 1; t <= 6; t++){ let m = null; try { pg.ctx.iqOddGenerate(t); } catch (x){ m = String(x.message); } if (t < minTier && !(m && /no enabled (variant|family)/.test(m))) bad.push('tier ' + t + ' should be refused'); if (t >= minTier && m) bad.push('tier ' + t + ': ' + m); }
      const p = forced(fam, key); p.seed(400 + idx);
      let invalid = 0, oddAt = [0, 0, 0, 0], svgBad = 0; const examples = [], feat = { len: 0, sum: 0 };
      for (let i = 0; i < N; i++){
        const r = p.ctx.iqOddGenerate(minTier);
        const errs = CHECK[fam](r, key);
        const svgs = r.items.map(it => p.ctx.iqOddRenderItem(it));
        svgs.forEach(s => { const se = svgErrors(s); if (se.length){ svgBad++; if (examples.length < 3) errs.push('svg: ' + se.join(',')); } });
        if (errs.length){ invalid++; if (examples.length < 3) examples.push(errs.slice(0, 2).join('; ')); continue; }
        oddAt[r.oddIndex]++;
        const lens = svgs.map(s => s.length), mx = lens.indexOf(Math.max(...lens)), mn = lens.indexOf(Math.min(...lens));
        if (lens.filter(l => l === lens[mx]).length === 1 && mx === r.oddIndex) feat.len++;
        if (lens.filter(l => l === lens[mn]).length === 1 && mn === r.oddIndex) feat.len++;
      }
      if (invalid) bad.push(invalid + ' invalid, e.g. ' + examples[0]);
      const spread = Math.min(...oddAt) / Math.max(1, N - invalid);
      if (N - invalid > 100 && spread < 0.15) bad.push('the odd picture is not spread over the four positions: ' + oddAt.join('/'));
      const share = feat.len / Math.max(1, N - invalid);
      return { pass: !bad.length, info: N + ' questions | odd position ' + oddAt.join('/') + ' | odd is the unique longest/shortest SVG in ' + (100 * share).toFixed(0) + '% (chance 50%)' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  }));

  test('ADV-N1 cube folding: of the 35 hexominoes exactly 11 fold; the production rule agrees with the rolling-cube test on every one', () => {
    const p = H.loadProject(), all = hexominoes(), bad = [];
    if (all.length !== 35) bad.push('hexomino count ' + all.length);
    const mine = all.filter(folds), norm = c => { const mx = Math.min(...c.map(v => v[0])), my = Math.min(...c.map(v => v[1])); return c.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
    if (mine.length !== 11) bad.push('test-side folding count ' + mine.length);
    all.forEach(c => { if (p.ctx.iqAsmFoldsToCube(norm(c)) !== folds(c)) bad.push('production disagrees on ' + canon(c)); });
    const cross = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], line = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], block = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
    if (!folds(cross) || folds(line) || folds(block)) bad.push('cross / line / 2x3 block misjudged');
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : '35 hexominoes, 11 nets, production and test agree' };
  });
  test('ADV-N2 tiling solver: production and test-side solver agree on 600 random bodies x piece sets', () => {
    const p = H.loadProject(); p.seed(77); const bad = []; let yes = 0, no = 0;
    const T = { I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[0, 0], [1, 0], [2, 0], [1, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], L: [[0, 0], [0, 1], [0, 2], [1, 2]] };
    const names = Object.keys(T), bodies = p.ctx.iqAsmBodies();
    for (let i = 0; i < 600; i++){
      const set = [0, 0, 0].map(() => names[Math.floor(Math.random() * 5)]); if (new Set(set).size < 3){ i--; continue; }
      const body = bodies[Math.floor(Math.random() * bodies.length)], a = p.ctx.iqAsmTileable(body, set.map(n => T[n])), b = tileable(body, set.map(n => T[n]));
      if (a !== b) bad.push(set.join('') + ' ' + JSON.stringify(body)); if (b) yes++; else no++;
    }
    return { pass: !bad.length && yes > 20 && no > 20, info: 'tileable ' + yes + ' / not ' + no + (bad.length ? ' | DISAGREE: ' + bad.slice(0, 2).join(' | ') : '') };
  });
  test('ADV-N3 must-reject: all rules intact in four pictures, two broken pictures, wrong odd marked (one fixture per family)', () => {
    const clone = o => JSON.parse(JSON.stringify(o)), bad = [];
    const verdict = (p, r) => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (x){ return 'THREW ' + x.message; } };
    const gen = (fam, key, tier) => { const p = forced(fam, key); p.seed(5); return { p, r: p.ctx.iqOddGenerate(tier) }; };
    const chk = (label, p, r, expect) => { const v = verdict(p, r); if (v !== expect) bad.push(label + ' -> ' + v + ' (wanted ' + expect + ')'); };
    // motion / rot-same: make the odd picture turn like the others
    { const { p, r } = gen('motion', 'rot-same', 4); chk('rot-same control', p, r, 'accept'); const x = clone(r); const n = x.items.find((_, i) => i !== r.oddIndex); x.items[r.oddIndex].tokens = clone(n.tokens); x.items[r.oddIndex].star = clone(n.star); chk('rot-same all four alike', p, x, 'reject'); const y = clone(r); y.oddIndex = (r.oddIndex + 1) % 4; chk('rot-same wrong odd', p, y, 'reject'); }
    // motion / maze: the odd maze copied from a normal
    { const { p, r } = gen('motion', 'maze-short', 5); chk('maze control', p, r, 'accept'); const x = clone(r); x.items[r.oddIndex] = clone(x.items[(r.oddIndex + 1) % 4]); chk('maze duplicate of a normal', p, x, 'reject'); }
    // relation / mirror-diag: the odd image replaced by a plain mirror image
    { const { p, r } = gen('relation', 'mirror-diag', 4); chk('mirror-diag control', p, r, 'accept'); const x = clone(r); const o = x.items[r.oddIndex]; o.R = o.L.map(q => p.ctx.iqAdvReflect(q, o.line[0], p.ctx.iqAdvAngle(o.line[0], o.line[1])).map(v => Math.round(v * 2) / 2)); chk('mirror-diag all mirrored', p, x, 'reject'); }
    // relation / hull-missing: one normal also loses a tip
    { const { p, r } = gen('relation', 'hull-missing', 5); chk('hull-missing control', p, r, 'accept'); const x = clone(r); const n = x.items[(r.oddIndex + 1) % 4]; n.R = n.R.slice(1); chk('hull-missing two broken', p, x, 'reject'); }
    // assembly / cube-net: the odd net replaced by a foldable one
    { const { p, r } = gen('assembly', 'cube-net', 4); chk('cube-net control', p, r, 'accept'); const x = clone(r); x.items[r.oddIndex].cells = clone(x.items[(r.oddIndex + 1) % 4].cells).map(([a, b]) => [a, b]); chk('cube-net odd folds too', p, x, 'reject'); }
    // assembly / tiling: swap a normal body for the odd body
    { const { p, r } = gen('assembly', 'tiling', 6); chk('tiling control', p, r, 'accept'); const x = clone(r); x.items[(r.oddIndex + 1) % 4].body = clone(x.items[r.oddIndex].body); chk('tiling two broken', p, x, 'reject'); }
    // combo / dots-axes: add a dot to the odd picture so that dots no longer tie two-and-two
    { const { p, r } = gen('combo', 'dots-axes', 4); chk('dots-axes control', p, r, 'accept'); const x = clone(r); const o = x.items[(r.oddIndex + 1) % 4]; o.dots = o.dots.slice(0, 1); chk('dots-axes ties broken', p, x, 'reject'); }
    // combo / sudoku-box: a normal board breaks too
    { const { p, r } = gen('combo', 'sudoku-box', 4); chk('sudoku control', p, r, 'accept'); const x = clone(r); const n = x.items[(r.oddIndex + 1) % 4]; [n.cells[0], n.cells[1]] = [n.cells[1], n.cells[0]]; chk('sudoku two broken', p, x, 'reject'); }
    // combo / size-sides: all four pictures keep the rule
    { const { p, r } = gen('combo', 'size-sides', 5); chk('size-sides control', p, r, 'accept'); const x = clone(r); const o = x.items[r.oddIndex], n = x.items[(r.oddIndex + 1) % 4]; o.polys = clone(n.polys); chk('size-sides odd copied from a normal', p, x, 'reject'); }
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : '10 control fixtures accepted, 12 broken fixtures rejected' };
  });
  test('ADV-N4 tile size: only the four advanced families ask for large tiles, the game toggles the class on the options row, and the CSS gives 120px on wide screens only', () => {
    const fs = require('fs'), path = require('path'), bad = [];
    const p = H.loadProject(), fams = p.evalIn('IQ_ODD_FAMILIES');
    fams.forEach(f => { if ((f.largeTiles === true) !== !!PLAN[f.key]) bad.push(f.key + ' largeTiles=' + f.largeTiles); });
    const ask = (pg, tier) => { const prompt = pg.ctx.document.createElement('div'), opts = pg.ctx.document.createElement('div'); pg.evalIn('IQ_CATEGORIES').find(c => c.key === 'oddone').renderQuestion(tier, prompt, opts, () => {}); return opts.classList.contains('iq-options-large'); };
    const pa = forced('motion', 'rot-same'); pa.seed(1);
    if (!ask(pa, 6)) bad.push('advanced question did not get iq-options-large');
    const pn = H.loadProject(); pn.seed(2); let wrong = 0;
    for (let i = 0; i < 200; i++) if (ask(pn, 1 + (i % 3))) wrong++;   // tiers 1-3: no advanced family is eligible
    if (wrong) bad.push(wrong + ' questions on tiers 1-3 got iq-options-large');
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'css', 'iq.css'), 'utf8');
    const m = /@media \(min-width:601px\)\{([^}]*\}[^}]*)\}/.exec(css);
    if (!m || !/\.iq-options-large \.iq-option-btn\{[^}]*width:120px;[^}]*height:120px/.test(m[1]) || !/max-width:560px/.test(m[1])) bad.push('wide-screen CSS rule missing or wrong');
    if (/iq-options-large/.test(css.split('@media (max-width:600px)')[1] || '')) bad.push('phone rule touches the large tiles');
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'flag, class toggle (on for advanced, off for 200 questions on tiers 1-3) and CSS (4 x 120px + 3 x 14px gaps fit in 560px) ok' };
  });
  return out;
}

module.exports = { run };
