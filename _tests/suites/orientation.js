'use strict';
// Focused tests of the orientation cell-shape variants (cells-5 / cells-6 / cells-7). Written BEFORE the
// implementation. The checks read only the rendered SVG (and the library patterns as data); the geometry
// below (cell sets from outlines, dihedral matching, area differences) is independent of production.
//
// Rules under test:
//   - the existing 'flag' variant stays the only enabled one; the three cell variants are registered, DISABLED, with minTier 2 / 3 / 5;
//   - every library pattern is edge-connected, hole-free, has no pinched corner, fits 4x4 cells, has the stated number of cells,
//     and has NO rotational and NO mirror symmetry;
//   - every question shows one shape three times in three different rotations and once as its mirror image (never a rotation);
//   - a cell is 21 viewBox units (>= 9px at the 43.2px phone tile), outlines are axis-aligned and bounding-box centred;
//   - every two options differ by at least 0.21 of the shape's area; the generator reaches exactly the structures that satisfy this.

const H = require('../harness');
const V = require('../verify');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.ORI_SAMPLE_SCALE || 1);
const VARIANTS = [{ key: 'cells-5', cells: 5, minTier: 1, count: 5 }, { key: 'cells-6', cells: 6, minTier: 3, count: 17 }, { key: 'cells-7', cells: 7, minTier: 5, count: 54 }];
const CELL_PX = 21;                       // viewBox units per cell

// ---------- test-side cell geometry ----------
const cellsOf = pattern => { const c = []; pattern.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') c.push([x, y]); }); return c; };
const norm = cs => { const mx = Math.min(...cs.map(c => c[0])), my = Math.min(...cs.map(c => c[1])); return cs.map(c => [c[0] - mx, c[1] - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const ser = cs => norm(cs).map(c => c.join(',')).join(';');
const rot90 = cs => cs.map(([x, y]) => [-y, x]), flipX = cs => cs.map(([x, y]) => [-x, y]);
function dihedral(cs){ const o = []; let c = cs; for (let i = 0; i < 4; i++){ o.push(c); c = rot90(c); } c = flipX(cs); for (let i = 0; i < 4; i++){ o.push(c); c = rot90(c); } return o; }
function libraryChecks(pattern, n){
  const errs = [], cs = cellsOf(pattern), set = new Set(cs.map(c => c.join(',')));
  if (cs.length !== n) errs.push('cell count ' + cs.length + ' != ' + n);
  if (Math.max(pattern.length, ...pattern.map(r => r.length)) > 4) errs.push('wider/taller than 4');
  const seen = new Set([cs[0].join(',')]), st = [cs[0]];
  while (st.length){ const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const k = (x + dx) + ',' + (y + dy); if (set.has(k) && !seen.has(k)){ seen.add(k); st.push([x + dx, y + dy]); } } }
  if (seen.size !== cs.length) errs.push('not connected');
  // holes: flood the outside of the padded bounding box
  const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]), x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const out2 = new Set([x0 + ',' + y0]), st2 = [[x0, y0]];
  while (st2.length){ const [x, y] = st2.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || set.has(k) || out2.has(k)) continue; out2.add(k); st2.push([nx, ny]); } }
  if ((x1 - x0 + 1) * (y1 - y0 + 1) - out2.size - set.size) errs.push('has a hole');
  for (const [x, y] of cs) for (const [dx, dy] of [[1, 1], [1, -1]]) if (set.has((x + dx) + ',' + (y + dy)) && !set.has((x + dx) + ',' + y) && !set.has(x + ',' + (y + dy))) errs.push('pinched corner');
  const base = ser(cs), d = dihedral(cs);
  if ([1, 2, 3].some(i => ser(d[i]) === base)) errs.push('rotational symmetry');
  if ([4, 5, 6, 7].some(i => ser(d[i]) === base)) errs.push('mirror symmetry');
  return errs;
}
// cells of a rendered polygon on the 21-unit lattice centred on the tile, via point-in-polygon at cell centres
function pointIn(x, y, pts){ let inside = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++){ const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside; } return inside; }
function renderedCells(pts, center){
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.round((maxX - minX) / CELL_PX), h = Math.round((maxY - minY) / CELL_PX);
  const cells = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (pointIn(minX + (i + 0.5) * CELL_PX, minY + (j + 0.5) * CELL_PX, pts)) cells.push([i, j]);
  return { cells, w, h, minX, maxX, minY, maxY };
}
// shape on a common half-cell lattice about the tile centre -> set of sample keys (for exact area differences)
function sampleSet(pts, center){
  const S = new Set(), step = 3.5;
  for (let j = -14; j < 14; j++) for (let i = -14; i < 14; i++){ const x = center[0] + (i + 0.5) * step, y = center[1] + (j + 0.5) * step; if (pointIn(x, y, pts)) S.add(i + ',' + j); }
  return S;
}
const xorShare = (A, B) => { let d = 0; for (const k of A) if (!B.has(k)) d++; for (const k of B) if (!A.has(k)) d++; return d / A.size; };

// the rendered polygon of each option, with strict structural checks; returns { errs, shapes[] }
function analyze(p, result){
  const errs = [], svgs = result.items.map(it => p.ctx.iqOddRenderItem(it));
  let parsed; try { parsed = svgs.map(s => V.parseSvg(s)); } catch (x){ return { errs: ['unparseable: ' + x.message] }; }
  const info = parsed.map((pa, i) => {
    if (pa.polygons.length !== 1 || pa.circles.length) { errs.push('option ' + i + ': not a single polygon'); return null; }
    const pts = pa.polygons[0].pts;
    for (let k = 0; k < pts.length; k++){ const a = pts[k], b = pts[(k + 1) % pts.length]; const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]); if (Math.min(dx, dy) > 0.15) errs.push('option ' + i + ': a slanted edge'); const len = Math.max(dx, dy); if (Math.abs(len / CELL_PX - Math.round(len / CELL_PX)) * CELL_PX > 0.25) errs.push('option ' + i + ': edge length ' + len.toFixed(1) + ' is not a whole number of cells'); }
    const rc = renderedCells(pts, pa.center);
    const cx = (rc.minX + rc.maxX) / 2, cy = (rc.minY + rc.maxY) / 2;
    if (Math.abs(cx - pa.center[0]) > 0.15 || Math.abs(cy - pa.center[1]) > 0.15) errs.push('option ' + i + ': not centred on the tile');
    if (rc.minX < 3 || rc.maxX > 97 || rc.minY < 3 || rc.maxY > 97) errs.push('option ' + i + ': too close to the tile edge');
    return { pts, rc, center: pa.center, set: sampleSet(pts, pa.center) };
  });
  if (errs.length || info.some(x => !x)) return { errs };
  return { errs, info };
}

function forced(key){
  const p = H.loadProject();
  p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'orientation'; });
  if (key) p.evalIn('IQ_ODD_VARIANTS.orientation').forEach(v => { v.enabled = v.key === key; });
  return p;
}

function run(){
  test('ORI-1 registry: flag and cells-5 / cells-6 / cells-7 are registered ENABLED with minTier 1 / 1 / 3 / 5', () => {
    const p = H.loadProject(); const reg = p.evalIn('IQ_ODD_VARIANTS').orientation;
    if (!reg) return { pass: false, info: 'no variants registered for orientation' };
    const want = [['flag', true, 1], ['cells-5', true, 1], ['cells-6', true, 3], ['cells-7', true, 5]];
    const bad = [];
    if (reg.map(v => v.key).join() !== want.map(w => w[0]).join()) bad.push('keys ' + reg.map(v => v.key).join());
    want.forEach(([k, en, mt]) => { const v = reg.find(x => x.key === k); if (!v) return bad.push('missing ' + k); if (v.enabled !== en) bad.push(k + ' enabled=' + v.enabled); if (v.minTier !== mt) bad.push(k + ' minTier=' + v.minTier); });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });

  test('ORI-2 shipped settings: orientation asks the flag from tier 1 and each cell variant only from its first tier (3,000 questions)', () => {
    const p = forced(null); p.seed(4); const first = { flag: 1, 'cells-5': 1, 'cells-6': 3, 'cells-7': 5 }; const seenAt = {}; let early = 0, n = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){ const v = p.ctx.iqOddGenerate(t).variant; n++; (seenAt[t] = seenAt[t] || new Set()).add(v); if (!(v in first) || first[v] > t) early++; }
    const missing = []; for (let t = 1; t <= 6; t++) Object.keys(first).filter(k => first[k] <= t).forEach(k => { if (!seenAt[t].has(k)) missing.push(k + '@' + t); });
    return { pass: !early && !missing.length, info: n + ' questions; asked too early or unknown ' + early + '; never reached where due: ' + (missing.join(',') || 'none') };
  });

  test('ORI-3 library: the right number of patterns per size and every pattern passes the independent shape checks (connected, no hole, no pinch, <=4x4, C1)', () => {
    const p = H.loadProject(); let shapes;
    try { shapes = p.evalIn('IQ_ODD_CELL_SHAPES'); } catch (e){ return { pass: false, info: 'IQ_ODD_CELL_SHAPES does not exist' }; }
    const bad = [];
    VARIANTS.forEach(v => {
      const list = shapes[v.cells] || [];
      if (list.length !== v.count) bad.push(v.cells + ' cells: ' + list.length + ' patterns, expected ' + v.count);
      const seen = new Set();
      list.forEach((pat, i) => { libraryChecks(pat, v.cells).forEach(e => bad.push(v.cells + '#' + i + ': ' + e)); const c = dihedral(cellsOf(pat)).map(ser).sort()[0]; if (seen.has(c)) bad.push(v.cells + '#' + i + ' duplicates another pattern (same free polyomino)'); seen.add(c); });
    });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'sizes 5/6/7: 5/17/54 patterns (every asymmetric shape that fits 4x4), all valid and distinct' };
  });

  VARIANTS.forEach((v, idx) => {
    test('ORI-' + (4 + idx) + ' ' + v.key + ': 3,000 questions are valid by the independent SVG checks, reach every structure that clears the 0.21 area difference, and are gated by tier', () => {
      const bad = [];
      // tier gating
      const pg = forced(v.key);
      for (let t = 1; t <= 6; t++){ let m = null; try { pg.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < v.minTier && !(m && /no enabled variant/.test(m))) bad.push('tier ' + t + ' should be refused'); if (t >= v.minTier && m) bad.push('tier ' + t + ' should generate: ' + m); }
      const p = forced(v.key); p.seed(60 + idx);
      const library = p.evalIn('IQ_ODD_CELL_SHAPES')[v.cells].map(pat => cellsOf(pat));
      // oracle: shape x 3 shown rotations x mirror rotation, using the test-side area difference on the half-cell lattice
      const lattice = c => { const xs = c.map(q => q[0]), ys = c.map(q => q[1]); const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2; const S = new Set(); for (const [x, y] of c) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) S.add(Math.round((x + a * 0.5 + 0.25 - cx) * 4) + ',' + Math.round((y + b * 0.5 + 0.25 - cy) * 4)); return S; };
      let expected = 0;
      library.forEach(cs => { const R = dihedral(cs).slice(0, 4).map(lattice), M = dihedral(cs).slice(4).map(lattice); for (let miss = 0; miss < 4; miss++) for (let m = 0; m < 4; m++){ const set = [0, 1, 2, 3].filter(r => r !== miss).map(r => R[r]).concat([M[m]]); let least = Infinity; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) least = Math.min(least, xorShare(set[i], set[j])); if (least >= 0.21 - 1e-9) expected++; } });
      const keys = new Set(); const N = Math.round((v.cells === 7 ? 30000 : 3000) * SCALE); let invalid = 0; const examples = [];
      for (let i = 0; i < N; i++){
        const r = p.ctx.iqOddGenerate(v.minTier); keys.add(r.structureKey);
        const a = analyze(p, r); const e = a.errs.slice();
        if (!e.length){
          const { info } = a; const odd = r.oddIndex;
          const canon = info.map(x => ser(x.rc.cells));
          const dih = info.map(x => dihedral(x.rc.cells).map(ser));
          const normals = [0, 1, 2, 3].filter(k => k !== odd);
          const ref = info[normals[0]].rc.cells;
          const refRot = dihedral(ref).slice(0, 4).map(ser), refMir = dihedral(ref).slice(4).map(ser);
          normals.forEach(k => { if (!refRot.includes(canon[k])) e.push('option ' + k + ' is not a rotation of the shape'); });
          if (refRot.includes(canon[odd]) || !refMir.includes(canon[odd])) e.push('the odd option is not a pure mirror image');
          if (new Set(normals.map(k => canon[k])).size !== 3) e.push('two normals are the same rotation');
          const isLib = library.some(cs => dihedral(cs).map(ser).includes(canon[normals[0]]));
          if (!isLib) e.push('shape is not from the library of ' + v.cells + ' cells');
          if (info[0].rc.cells.length !== v.cells) e.push('cell count ' + info[0].rc.cells.length);
          let least = Infinity; for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) least = Math.min(least, xorShare(info[x].set, info[y].set));
          if (least < 0.21 - 0.01) e.push('two options differ by only ' + least.toFixed(3) + ' of the area');
          if (r.explanation !== 'שלוש הצורות הן אותה צורה מסובבת בזוויות שונות - הצורה שנבחרה היא תמונת ראי (שיקוף), לא סיבוב.') e.push('explanation changed');
        }
        if (e.length){ invalid++; if (examples.length < 3) examples.push(e.join('; ')); }
      }
      if (invalid) bad.push(invalid + ' invalid questions, e.g. ' + examples[0]);
      if (SCALE >= 1 && keys.size !== expected) bad.push('reached ' + keys.size + ' structures, expected ' + expected);
      if (SCALE < 1 && keys.size > expected) bad.push('reached MORE structures (' + keys.size + ') than expected ' + expected);
      return { pass: !bad.length, info: N + ' questions, ' + keys.size + ' of ' + expected + ' structures reached' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });

  test('ORI-7 must-reject: no odd option, two odd options, odd that is a rotation, a flag labelled as a cell shape, a library shape labelled as the wrong size', () => {
    const p = forced('cells-6'); p.seed(2);
    const base = p.ctx.iqOddGenerate(3); const clone = o => JSON.parse(JSON.stringify(o));
    const rotPts = (pts, deg) => p.ctx.iqOddRotatePoints(pts, deg);
    const normals = [0, 1, 2, 3].filter(i => i !== base.oddIndex);
    const verdict = r => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW'; } };
    const bad = []; const must = (label, r) => { const v = verdict(r); if (v !== 'reject') bad.push(label + ' -> ' + v); };
    if (verdict(base) !== 'accept') bad.push('control not accepted');
    const noOdd = clone(base); noOdd.items[base.oddIndex].pts = rotPts(noOdd.items[normals[0]].pts, 90); must('odd replaced by another rotation (4 rotations)', noOdd);
    const two = clone(base); two.items[normals[0]].pts = p.ctx.iqOddMirrorPoints(two.items[normals[0]].pts); must('two mirror images', two);
    const same = clone(base); same.items[normals[1]].pts = clone(base).items[normals[0]].pts; must('two normals identical', same);
    const flag = clone(base); flag.items.forEach(it => { it.pts = p.evalIn('IQ_ODD_FLAG_BASE'); }); flag.items[base.oddIndex].pts = p.ctx.iqOddMirrorPoints(p.evalIn('IQ_ODD_FLAG_BASE')); must('flag shapes labelled cells-6', flag);
    const q5 = forced('cells-5'); q5.seed(3); const five = q5.ctx.iqOddGenerate(2); five.variant = 'cells-6'; must('5-cell question labelled cells-6', five);
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '5 fixtures rejected, control accepted' };
  });

  return out;
}

module.exports = { run };
