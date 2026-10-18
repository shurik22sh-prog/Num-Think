'use strict';
// Focused tests of the "equal parts" family (key 'parts'): each option is a whole shape cut into the same number of
// pieces; in three options the pieces are EQUAL (congruent), in one they are not. Written BEFORE the implementation.
// Everything below reads the rendered SVG only (pieces are <polygon>s; circles are polygonised), with test-side geometry.
//
// Rules under test:
//   - the family and its four variants (square-2, square-4, circle-3, circle-4) are registered DISABLED (variants minTier 2 / 3 / 4 / 4);
//   - every option is one whole shape (square 76 units, or circle radius 38, centred) split into the variant's number of pieces;
//   - the pieces tile the whole exactly (areas add up, no overlap, no gap);
//   - in the three normals the pieces are congruent (equal area and equal shape); in the odd option the smallest piece is at most 0.65 of the largest;
//   - the odd option's cut style also appears among the normals (the drawing style is not the giveaway), and the four drawings are pairwise different;
//   - every piece is at least 7 units thick (2 x area / perimeter), so it survives on a phone;
//   - the explanation names the rule.

const H = require('../harness');
const V = require('../verify');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.PARTS_SAMPLE_SCALE || 1);
const VARIANTS = [
  { key: 'square-2', minTier: 2, whole: 'square', n: 2 }, { key: 'square-4', minTier: 3, whole: 'square', n: 4 },
  { key: 'circle-3', minTier: 4, whole: 'circle', n: 3 }, { key: 'circle-4', minTier: 4, whole: 'circle', n: 4 }
];
const EXPLANATION = 'בשלוש הצורות החלוקה היא לחלקים שווים - בצורה שנבחרה החלקים אינם שווים.';

// ---------- test-side geometry ----------
const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
const perim = pts => pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]), 0);
const centroid = pts => { let a = 0, cx = 0, cy = 0; for (let i = 0; i < pts.length; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; const f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; } return [cx / (3 * a), cy / (3 * a)]; };
function pointIn(x, y, pts){ let inside = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++){ const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside; } return inside; }
// congruence of two pieces (rotation / reflection / translation): same area and the same sorted distances from the centroid to the vertices and the same perimeter
function signature(pts){ const [cx, cy] = centroid(pts); return { a: area(pts), p: perim(pts), d: pts.map(q => Math.hypot(q[0] - cx, q[1] - cy)).sort((a, b) => a - b) }; }
function congruent(A, B){
  const a = signature(A), b = signature(B);
  if (Math.abs(a.a - b.a) / a.a > 0.015 || Math.abs(a.p - b.p) / a.p > 0.015) return false;
  // vertex lists can differ in length by polygonised arcs only if the pieces differ; compare the extreme distances and the median
  const q = (s, f) => s.d[Math.min(s.d.length - 1, Math.floor(f * (s.d.length - 1)))];
  return [0, 0.5, 1].every(f => Math.abs(q(a, f) - q(b, f)) < 0.6);
}
function analyze(p, result, variant){
  const errs = [], svgs = result.items.map(it => p.ctx.iqOddRenderItem(it));
  let parsed; try { parsed = svgs.map(s => V.parseSvg(s)); } catch (x){ return { errs: ['unparseable: ' + x.message] }; }
  const wholeArea = variant.whole === 'square' ? 76 * 76 : Math.PI * 38 * 38;
  const opts = parsed.map((pa, i) => {
    if (pa.circles.length) errs.push('option ' + i + ': has circles');
    const pieces = pa.polygons.map(q => q.pts);
    if (pieces.length !== variant.n) errs.push('option ' + i + ': ' + pieces.length + ' pieces, expected ' + variant.n);
    const areas = pieces.map(area), total = areas.reduce((s, v) => s + v, 0);
    if (Math.abs(total - wholeArea) / wholeArea > 0.006) errs.push('option ' + i + ': pieces add up to ' + total.toFixed(0) + ', the whole is ' + wholeArea.toFixed(0));
    // no overlap / no gap: 50x50 sample grid over the tile, every sample inside the whole is inside exactly one piece
    let bad = 0;
    for (let a = 0; a < 50; a++) for (let b = 0; b < 50; b++){
      const x = 6 + (a + 0.5) * 88 / 50, y = 6 + (b + 0.5) * 88 / 50;
      const inWhole = variant.whole === 'square' ? (x > 12 && x < 88 && y > 12 && y < 88) : Math.hypot(x - 50, y - 50) < 38;
      const hits = pieces.filter(q => pointIn(x, y, q)).length;
      if (inWhole && hits !== 1 && !nearEdge(x, y, pieces)) bad++;
      if (!inWhole && hits > 0 && !nearWholeBoundary(x, y, variant)) bad++;
    }
    if (bad) errs.push('option ' + i + ': ' + bad + ' samples are covered 0 or 2+ times');
    pieces.forEach((q, k) => { const t = 2 * area(q) / perim(q); if (t < 7 - 1e-9) errs.push('option ' + i + ' piece ' + k + ' is only ' + t.toFixed(1) + ' units thick'); });
    const ratio = Math.min(...areas) / Math.max(...areas);
    const allCongruent = pieces.every(q => congruent(q, pieces[0]));
    return { pieces, areas, ratio, allCongruent };
  });
  if (errs.length) return { errs };
  const equal = opts.map(o => o.allCongruent && o.ratio >= 0.985), unequal = opts.map(o => !o.allCongruent && o.ratio <= 0.65);
  const oddIdx = equal.indexOf(false);
  if (equal.filter(Boolean).length !== 3) errs.push('not exactly three options with congruent pieces: ' + equal.join());
  else {
    if (oddIdx !== result.oddIndex) errs.push('SVG-derived odd option ' + oddIdx + ' != result.oddIndex ' + result.oddIndex);
    if (!unequal[oddIdx]) errs.push('the odd option is not clearly unequal (smallest/largest ' + opts[oddIdx].ratio.toFixed(2) + ')');
  }
  // four drawings pairwise different (compare the sorted piece centroids)
  const key = o => o.pieces.map(q => centroid(q).map(v => v.toFixed(0)).join(',')).sort().join('|');
  if (new Set(opts.map(key)).size !== 4) errs.push('two options are the same drawing');
  return { errs, opts, oddIdx };
}
function nearEdge(x, y, pieces){ // within 2 units of a piece edge: sample may legitimately fall on a stroke boundary
  return pieces.some(q => q.some((a, i) => { const b = q[(i + 1) % q.length]; return V.distToSegment(x, y, a, b) < 1.2; }));
}
function nearWholeBoundary(x, y, v){ return v.whole === 'square' ? (Math.abs(x - 12) < 1.5 || Math.abs(x - 88) < 1.5 || Math.abs(y - 12) < 1.5 || Math.abs(y - 88) < 1.5) : Math.abs(Math.hypot(x - 50, y - 50) - 38) < 1.5; }

function forced(key){
  const p = H.loadProject();
  const fams = p.evalIn('IQ_ODD_FAMILIES'); fams.forEach(f => { f.enabled = f.key === 'parts'; });
  if (key) p.evalIn('IQ_ODD_VARIANTS.parts').forEach(v => { v.enabled = v.key === key; });
  return p;
}

function run(){
  test('PARTS-1 registry: family "parts" exists and is ENABLED; variants square-2 / square-4 / circle-3 / circle-4 are ENABLED with minTier 2 / 3 / 4 / 4', () => {
    const p = H.loadProject(); const fam = p.evalIn('IQ_ODD_FAMILIES').find(f => f.key === 'parts');
    if (!fam) return { pass: false, info: 'family not registered' };
    const reg = p.evalIn('IQ_ODD_VARIANTS').parts; if (!reg) return { pass: false, info: 'no variants registered' };
    const bad = [];
    if (fam.enabled !== true) bad.push('family enabled=' + fam.enabled);
    if (reg.map(v => v.key).join() !== VARIANTS.map(v => v.key).join()) bad.push('keys ' + reg.map(v => v.key).join());
    VARIANTS.forEach(v => { const r = reg.find(x => x.key === v.key); if (!r) return; if (r.enabled !== true) bad.push(v.key + ' not enabled'); if (r.minTier !== v.minTier) bad.push(v.key + ' minTier=' + r.minTier); });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });

  test('PARTS-2 shipped settings: with the real defaults "parts" is asked from tier 2 and never before (3,000 oddone questions)', () => {
    const p = H.loadProject(); p.seed(5); let before = 0, from = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){ const f = p.ctx.iqOddGenerate(t).family; if (f === 'parts'){ if (t < 2) before++; else from++; } }
    return { pass: before === 0 && from > 0, info: 'asked before tier 2: ' + before + ' | asked from tier 2: ' + from };
  });

  VARIANTS.forEach((v, idx) => {
    test('PARTS-' + (3 + idx) + ' ' + v.key + ': ' + Math.round(2000 * SCALE) + ' questions valid by the independent SVG checks (tiling, congruent normals, unequal odd, thickness, distinct drawings, explanation), gated by tier, every structure reached', () => {
      const bad = [];
      const pg = forced(v.key);
      for (let t = 1; t <= 6; t++){ let m = null; try { pg.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < v.minTier && !(m && /no enabled (variant|family)/.test(m))) bad.push('tier ' + t + ' should be refused'); if (t >= v.minTier && m) bad.push('tier ' + t + ' should generate: ' + m); }
      const p = forced(v.key); p.seed(70 + idx);
      const structures = p.evalIn('iqOddPartsStructures(IQ_ODD_PARTS_VARIANTS.find(v => v.key === "' + v.key + '"))').length;
      const keys = new Set(); const N = Math.round(2000 * SCALE); let invalid = 0; const examples = [];
      for (let i = 0; i < N; i++){
        const r = p.ctx.iqOddGenerate(v.minTier); keys.add(r.structureKey);
        const e = analyze(p, r, v).errs.slice();
        if (r.explanation !== EXPLANATION) e.push('explanation is not the rule sentence');
        if (r.variant !== v.key) e.push('variant ' + r.variant);
        if (e.length){ invalid++; if (examples.length < 3) examples.push(e.join('; ')); }
      }
      if (invalid) bad.push(invalid + ' invalid, e.g. ' + examples[0]);
      if (SCALE >= 1 && keys.size !== structures) bad.push('reached ' + keys.size + ' of ' + structures + ' structures');
      if (keys.size > structures) bad.push('more structures than enumerated');
      return { pass: !bad.length, info: N + ' questions; ' + keys.size + ' of ' + structures + ' structures reached' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });

  test('PARTS-7 must-reject: all four equal, two unequal, a different piece count, a thin piece, two identical normals, a circle among squares', () => {
    const v = VARIANTS[1], p = forced(v.key); p.seed(8);
    const clone = o => JSON.parse(JSON.stringify(o));
    const base = p.ctx.iqOddGenerate(v.minTier); const odd = base.oddIndex; const normals = [0, 1, 2, 3].filter(i => i !== odd);
    const verdict = r => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW ' + e.message; } };
    const bad = [], must = (l, r) => { const x = verdict(r); if (x !== 'reject') bad.push(l + ' -> ' + x); };
    if (verdict(base) !== 'accept') bad.push('control not accepted');
    const allEq = clone(base); allEq.items[odd].pieces = clone(base.items[normals[0]].pieces); must('four equal', allEq);
    const two = clone(base); two.items[normals[0]] = clone(base.items[odd]); must('two unequal', two);
    const fewer = clone(base); fewer.items[normals[0]].pieces = fewer.items[normals[0]].pieces.slice(0, 3); must('different piece count', fewer);
    const dup = clone(base); dup.items[normals[1]] = clone(base.items[normals[0]]); must('two identical normals', dup);
    const thin = clone(base); thin.items[odd].pieces = [[[12, 12], [88, 12], [88, 17], [12, 17]], [[12, 17], [88, 17], [88, 50], [12, 50]], [[12, 50], [88, 50], [88, 88], [12, 88]]].concat([[[12, 88], [13, 88], [13, 88.1]]]); must('thin sliver piece', thin);
    const q = forced('circle-3'); q.seed(1); const c = q.ctx.iqOddGenerate(4); const mixed = clone(base); mixed.items[normals[0]] = c.items[0]; must('a circle among squares', mixed);
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '6 fixtures rejected, control accepted' };
  });

  test('PARTS-8 simple shortcuts (reported; chance 25%): axis count, total cut length, piece-count of equal tiles, "the asymmetric one" - none may isolate the odd option', () => {
    const lines = [], bad = [];
    const mirrorAxes = (pieces, whole) => { // number of mirror axes (of vertical, horizontal, 2 diagonals, + rotations for circles) that map the piece set onto itself
      const sets = [];
      const feat = ps => ps.map(q => { const c = centroid(q); return [c[0] - 50, c[1] - 50, area(q)]; });
      // the reflected piece set matches the original when every piece has a partner with the same centroid (0.8 units) and area (1.5%)
      const same = (A, B) => { const used = new Set(); return A.every(a => { const j = B.findIndex((b, k) => !used.has(k) && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.8 && Math.abs(a[2] - b[2]) / a[2] < 0.015); if (j < 0) return false; used.add(j); return true; }); };
      const base = feat(pieces); let n = 0;
      const mapAxes = whole === 'square' ? [q => [-q[0], q[1]], q => [q[0], -q[1]], q => [q[1], q[0]], q => [-q[1], -q[0]]] : Array.from({ length: 36 }, (_, i) => i * 5).map(d => { const t = d * Math.PI / 180, c = Math.cos(2 * t), s = Math.sin(2 * t); return q => [c * q[0] + s * q[1], s * q[0] - c * q[1]]; });
      for (const f of mapAxes){ const ps = pieces.map(q => q.map(pt => { const m = f([pt[0] - 50, pt[1] - 50]); return [m[0] + 50, m[1] + 50]; })); if (same(feat(ps), base)) n++; }
      return n;
    };
    for (const v of VARIANTS){
      const p = forced(v.key); p.seed(90);
      const N = Math.round(1500 * SCALE); const hit = { axisMax: 0, axisMin: 0, fewestAxes: 0, cut: 0, asym: 0 }; let n = 0;
      for (let i = 0; i < N; i++){
        const r = p.ctx.iqOddGenerate(v.minTier); const a = analyze(p, r, v); if (a.errs.length) continue; n++;
        const ax = a.opts.map(o => mirrorAxes(o.pieces, v.whole)), odd = a.oddIdx;
        const single = f => { const vals = ax.map(f); const g = {}; vals.forEach((x, k) => (g[x] = g[x] || []).push(k)); const s = Object.values(g).filter(z => z.length === 1); return (Object.keys(g).length === 2 && s.length === 1) ? s[0][0] : -1; };
        if (single(x => x) === odd) hit.axisMin++;                // the option whose axis count differs from the other three
        if (single(x => (x > 0 ? 1 : 0)) === odd) hit.asym++;     // the only one with / without any mirror axis
        const len = a.opts.map(o => o.pieces.reduce((s, q) => s + perim(q), 0));
        const m = Math.max(...len), mn = Math.min(...len);
        const lone = len.map((x, k) => ({ k, off: Math.abs(x - (len.reduce((s, y) => s + y, 0) - x) / 3) / m })).sort((x, y) => y.off - x.off)[0];
        if (lone.off > 0.04 && lone.k === odd) hit.cut++;        // one option has a >4% different total outline+cut length
      }
      const pct = x => (100 * x / n).toFixed(1);
      lines.push(v.key.padEnd(10) + ' n=' + n + ' | axis-count singleton picks the odd in ' + pct(hit.axisMin) + '% of questions | only-asymmetric/only-symmetric ' + pct(hit.asym) + '% | clearly different total cut length ' + pct(hit.cut) + '%');
      if (hit.asym / n > 0.2) bad.push(v.key + ': symmetry presence isolates the odd in ' + pct(hit.asym) + '%');
      if (hit.cut / n > 0.2) bad.push(v.key + ': a clearly different total cut length isolates the odd in ' + pct(hit.cut) + '%');
    }
    return { pass: !bad.length, info: '\n       ' + lines.join('\n       ') + (bad.length ? '\n       GUARD: ' + bad.join(' | ') : '') };
  });

  return out;
}

module.exports = { run };
