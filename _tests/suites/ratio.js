'use strict';
// Focused tests of the Ratio family's variants (iq-visual.js, ratio section). Written BEFORE the
// implementation: every test below that exercises a new variant has to fail against code that lacks it.
//
// The oracle in this file is INDEPENDENT of production: it re-derives the layouts, the feasibility of
// every (shape, dots) combination, the structure space and the row-count filter from the stated rules,
// and the per-question checks read only the rendered SVG (what the child sees).
//
// Rules under test (approved plan):
//   - 4 options, 4 DIFFERENT side counts taken from 3..7, dots per option 1..8, all dots the same radius;
//   - three "normal" options follow dots = sides + b (b = -2, -1, 0, +1), the odd one does not;
//   - the odd one's dots = (rule value) + offset, offset in {-2,-1,+1,+2} (new variants; the existing
//     variant keeps its own policy and tier pools);
//   - placement is the same in all 4 options: 'ring' (existing formula), 'rows' (centred rows) or 'dice' (dice pips);
//   - every dot clears every outline edge (centre-to-edge >= 8.5 units) and any two dots keep a centre
//     distance >= 13.435 (the dot gap of the 4-dots-in-a-triangle layout that was accepted on a phone);
//   - rows variants: a structure is DROPPED iff the odd option's number of rows differs from the number of rows
//     of the other three options AND those three share one number of rows (then the row count alone shows the odd one);
//   - only the existing variant is enabled by default; each new variant has its own minTier.

const H = require('../harness');
const V = require('../verify');

// RATIO_SAMPLE_SCALE (default 1) shrinks the number of sampled questions for quick mutation checks; the uniformity check only runs at full scale.
const SCALE = Number(process.env.RATIO_SAMPLE_SCALE || 1);
const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const msgOf = fn => { try { fn(); return null; } catch (e){ return String(e && e.message); } };

// ---------------- the specification table ----------------
// raw = structures before the row-count filter, kept = after it (measured with the oracle below and approved in the plan).
const SPECS = [
  { key: 'sides-minus-1-ring', b: -1, placement: 'ring', minTier: 1, existing: true },
  { key: 'sides-ring',         b: 0,  placement: 'ring', minTier: 1, raw: 72, kept: 72 },
  { key: 'sides-minus-1-rows', b: -1, placement: 'rows', minTier: 2, raw: 72, kept: 69 },
  { key: 'sides-minus-1-dice', b: -1, placement: 'dice', minTier: 2, raw: 60, kept: 60 },
  { key: 'sides-rows',         b: 0,  placement: 'rows', minTier: 2, raw: 15, kept: 12 },
  { key: 'sides-minus-2-ring', b: -2, placement: 'ring', minTier: 3, raw: 68, kept: 68 },
  { key: 'sides-minus-2-rows', b: -2, placement: 'rows', minTier: 3, raw: 64, kept: 59 },
  { key: 'sides-minus-2-dice', b: -2, placement: 'dice', minTier: 3, raw: 60, kept: 60 },
  { key: 'sides-plus-1-ring',  b: 1,  placement: 'ring', minTier: 4, raw: 60, kept: 60 },
  { key: 'sides-plus-1-rows',  b: 1,  placement: 'rows', minTier: 4, raw: 48, kept: 40 }
];
const NEW_SPECS = SPECS.filter(s => !s.existing);
const EXISTING = SPECS[0];
const RULE_PHRASE = { '-2': 'מספר הצלעות פחות 2', '-1': 'מספר הצלעות פחות 1', '0': 'מספר הצלעות', '1': 'מספר הצלעות ועוד 1' };
const explanationOf = spec => 'בשלוש הצורות מספר הנקודות הפנימיות הוא בדיוק ' + RULE_PHRASE[spec.b] + ' - בצורה שנבחרה היחס הזה לא מתקיים.';

// ---------------- independent geometry oracle ----------------
const R = 36, C = 50, DOT_R = 4, STROKE = 3, MARGIN = DOT_R + STROKE / 2 + 3;   // 8.5
const MIN_CENTER = 13.435;
const polyVerts = n => Array.from({ length: n }, (_, k) => { const a = (-90 + k * 360 / n) * Math.PI / 180; return [C + R * Math.cos(a), C + R * Math.sin(a)]; });
function clearanceOf(n, pts){
  const v = polyVerts(n); let m = Infinity;
  for (const [px, py] of pts) for (let k = 0; k < n; k++){
    const [x1, y1] = v[k], [x2, y2] = v[(k + 1) % n]; const ex = x2 - x1, ey = y2 - y1, len = Math.hypot(ex, ey);
    let nx = -ey / len, ny = ex / len; if ((C - x1) * nx + (C - y1) * ny < 0){ nx = -nx; ny = -ny; }
    m = Math.min(m, (px - x1) * nx + (py - y1) * ny);
  }
  return m;
}
function minCenterDist(pts){ let m = Infinity; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])); return m; }
const ROWS = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4] };
const DICE = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 5: [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] };
const LAYOUT = {
  ring(n, d){
    const innerR = Math.min(R * 0.5, R * Math.cos(Math.PI / n) - MARGIN); if (!(innerR > 0)) return null;
    return Array.from({ length: d }, (_, i) => { const a = (-90 + i * 360 / d) * Math.PI / 180; return [C + innerR * Math.cos(a), C + innerR * Math.sin(a)]; });
  },
  rows(n, d){
    const rs = ROWS[d]; if (!rs) return null;
    for (let p = 16; p >= MIN_CENTER - 1e-9; p -= 0.1){
      const o = []; rs.forEach((m, j) => { for (let i = 0; i < m; i++) o.push([C + (i - (m - 1) / 2) * p, C + (j - (rs.length - 1) / 2) * p]); });
      if (clearanceOf(n, o) >= MARGIN - 1e-9) return o;
    }
    return null;
  },
  dice(n, d){
    const g = DICE[d]; if (!g) return null;
    const md = g.length < 2 ? 0 : Math.min(...g.flatMap((a, i) => g.slice(i + 1).map(b => Math.hypot(a[0] - b[0], a[1] - b[1]))));
    const pmin = g.length < 2 ? 0 : MIN_CENTER / md;
    for (let p = 20; p >= pmin - 1e-9; p -= 0.1){ const o = g.map(([a, b]) => [C + a * p, C + b * p]); if (clearanceOf(n, o) >= MARGIN - 1e-9) return o; }
    return null;
  }
};
function feasible(placement, n, d){
  if (!Number.isInteger(d) || d < 1 || d > 8) return false;
  const pts = LAYOUT[placement](n, d);
  return !!pts && clearanceOf(n, pts) >= MARGIN - 1e-9 && (pts.length < 2 || minCenterDist(pts) >= MIN_CENTER - 1e-9);
}
const rowCountOf = d => ROWS[d].length;
// THE row-count filter, as the plan states it
function isolatesByRows(dotsArr, oddIdx){
  const rc = dotsArr.map(rowCountOf), others = rc.filter((_, i) => i !== oddIdx);
  return others.every(v => v === others[0]) && rc[oddIdx] !== others[0];
}
const ALL_SIDES = [3, 4, 5, 6, 7];
const SUBSETS = ALL_SIDES.map((_, skip) => ALL_SIDES.filter((__, i) => i !== skip));
const idOf = (sidesArr, dotsArr) => sidesArr.map((s, i) => s + '/' + dotsArr[i]).sort().join(',');

// every structure of a NEW variant: { S, oddSide, w, sides[], dots[], oi, id }
function oracleStructures(spec, applyFilter){
  const rf = s => s + spec.b, res = [];
  for (const S of SUBSETS){
    if (!S.every(s => feasible(spec.placement, s, rf(s)))) continue;
    for (const oddSide of S) for (const off of [-2, -1, 1, 2]){
      const w = rf(oddSide) + off; if (!feasible(spec.placement, oddSide, w)) continue;
      const dots = S.map(s => (s === oddSide ? w : rf(s))), oi = S.indexOf(oddSide);
      if (applyFilter && spec.placement === 'rows' && isolatesByRows(dots, oi)) continue;
      res.push({ S, oddSide, w, sides: S, dots, oi, id: idOf(S, dots) });
    }
  }
  return res;
}
// every structure of the EXISTING variant for a tier (its own tier pools and wrong-count policy)
function oracleExisting(tier){
  const pool = tier >= 4 ? [4, 5, 6, 7] : [3, 4, 5, 6], res = [];
  for (const oddSide of pool) for (const w of [oddSide, oddSide + 1, Math.max(0, oddSide - 2)]){
    const dots = pool.map(s => (s === oddSide ? w : s - 1));
    res.push({ S: pool, oddSide, w, sides: pool, dots, oi: pool.indexOf(oddSide), id: idOf(pool, dots) });
  }
  return res;
}

// ---------------- independent analysis of one question, from the rendered SVG only ----------------
function clusterRows(circles){
  const ys = circles.map(c => c.cy).sort((a, b) => a - b), rows = [];
  ys.forEach(y => { if (!rows.length || y - rows[rows.length - 1].y > 0.5) rows.push({ y, n: 1 }); else rows[rows.length - 1].n++; });
  return rows;
}
function matchPoints(actual, expected, tol){
  const used = new Set(); let worst = 0;
  for (const [ex, ey] of expected){
    let best = -1, bd = Infinity;
    actual.forEach((a, i) => { if (used.has(i)) return; const d = Math.hypot(a[0] - ex, a[1] - ey); if (d < bd){ bd = d; best = i; } });
    if (best < 0) return { ok: false, worst: Infinity };
    used.add(best); worst = Math.max(worst, bd);
  }
  return { ok: worst <= tol && actual.length === expected.length, worst };
}
function analyzeSvgs(svgs, result, spec){
  const errs = []; const e = m => errs.push(m);
  let parsed;
  try { parsed = svgs.map(s => V.parseSvg(s)); } catch (x){ return { errs: ['unparseable SVG: ' + x.message], id: null }; }
  const sides = [], dots = [];
  parsed.forEach((pa, i) => {
    if (pa.viewBox.join() !== '0,0,100,100') e('option ' + i + ': viewBox ' + pa.viewBox.join());
    if (pa.polygons.length !== 1){ e('option ' + i + ': ' + pa.polygons.length + ' polygons'); return; }
    const poly = pa.polygons[0], n = poly.pts.length;
    sides.push(n); dots.push(pa.circles.length);
    if (n < 3 || n > 7) e('option ' + i + ': ' + n + ' sides');
    if (poly.strokeWidth !== STROKE) e('option ' + i + ': stroke ' + poly.strokeWidth);
    const verts = polyVerts(n);
    if (poly.pts.some((pt, k) => Math.hypot(pt[0] - verts[k][0], pt[1] - verts[k][1]) > 0.08)) e('option ' + i + ': outline is not the regular polygon of radius 36 about (50,50)');
    if (pa.circles.length < 1 || pa.circles.length > 8) e('option ' + i + ': ' + pa.circles.length + ' dots');
    if (pa.circles.some(c => Math.abs(c.r - DOT_R) > 0.01)) e('option ' + i + ': dot radius is not 4');
  });
  if (errs.length) return { errs, id: null };
  if (new Set(sides).size !== 4) e('side counts are not 4 different values: ' + sides.join(','));
  if (new Set(parsed.flatMap(pa => pa.circles.map(c => c.fill))).size > 1) e('dots do not all share one fill');
  if (new Set(parsed.map(pa => pa.polygons[0].stroke)).size > 1) e('outline strokes differ between options');
  // the unique collinear triple (integer arithmetic on (sides, dots))
  const triples = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (let c = b + 1; c < 4; c++){
    if ((sides[b] - sides[a]) * (dots[c] - dots[a]) - (sides[c] - sides[a]) * (dots[b] - dots[a]) === 0) triples.push([a, b, c]);
  }
  let oddIdx = -1;
  if (triples.length !== 1) e('collinear triples among (sides,dots): ' + triples.length + ' (must be exactly 1)');
  else {
    oddIdx = [0, 1, 2, 3].find(i => !triples[0].includes(i));
    if (triples[0].some(i => dots[i] - sides[i] !== spec.b)) e('the collinear triple is not dots = sides ' + (spec.b >= 0 ? '+' : '') + spec.b);
    if (oddIdx !== result.oddIndex) e('SVG-derived odd index ' + oddIdx + ' != result.oddIndex ' + result.oddIndex);
  }
  // geometry, via the existing independent analysis (clearance, spacing, containment) plus placement and row count
  const ra = V.ratioAnalysis(parsed, (s, d) => d === s + spec.b);
  ra.items.forEach((it, i) => {
    if (!it.allInside) e('option ' + i + ': a dot is outside the outline');
    if (it.minClear < 2.85) e('option ' + i + ': dot-to-outline gap ' + it.minClear.toFixed(2) + ' < 2.85');
    if (it.minSpacing < MIN_CENTER - 2 * DOT_R - 0.15) e('option ' + i + ': dot-to-dot gap ' + it.minSpacing.toFixed(2) + ' < 5.28');
  });
  parsed.forEach((pa, i) => {
    const exp = LAYOUT[spec.placement](sides[i], dots[i]);
    if (!exp){ e('option ' + i + ': no ' + spec.placement + ' layout exists for ' + sides[i] + ' sides / ' + dots[i] + ' dots'); return; }
    const m = matchPoints(pa.circles.map(c => [c.cx, c.cy]), exp, 0.3);
    if (!m.ok) e('option ' + i + ': dots are not in the ' + spec.placement + ' layout (worst deviation ' + m.worst.toFixed(2) + ')');
  });
  let rowIsolated = false;
  if (spec.placement === 'rows'){
    const rc = parsed.map(pa => clusterRows(pa.circles).length);
    const others = rc.filter((_, i) => i !== oddIdx);
    rowIsolated = oddIdx >= 0 && others.every(v => v === others[0]) && rc[oddIdx] !== others[0];
    if (rowIsolated) e('the number of rows alone identifies the odd option (rows ' + rc.join(',') + ')');
  }
  if (result.variant !== spec.key) e('result.variant is ' + result.variant);
  if (result.explanation !== explanationOf(spec)) e('explanation is not the one for this rule: ' + result.explanation);
  const id = idOf(sides, dots);
  if (result.structureKey !== 'ratio:' + spec.key + ':' + id) e('structureKey ' + result.structureKey + ' != ratio:' + spec.key + ':' + id);
  return { errs, id, rowIsolated, sides, dots, oddIdx };
}
const analyze = (p, result, spec) => analyzeSvgs(result.items.map(it => p.ctx.iqOddRenderItem(it)), result, spec);

// ---------------- sandbox helpers ----------------
function forced(variantKey){
  const p = H.loadProject();
  p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'ratio'; });
  if (variantKey) p.evalIn('IQ_ODD_VARIANTS.ratio').forEach(v => { v.enabled = v.key === variantKey; });
  return p;
}
const verdict = (p, result) => { try { return p.ctx.iqOddVerifyExactlyOneOdd(result) === true ? 'accept' : 'reject'; } catch (x){ return 'THREW ' + x.message; } };
// builds a production-shaped result for a given structure from a real generated result of the same variant
function fixture(base, spec, S, oddSide, w){
  const b = JSON.parse(JSON.stringify(base));
  b.items = S.map(s => Object.assign({}, b.items[0], { sides: s, dots: s === oddSide ? w : s + spec.b }));
  b.oddIndex = S.indexOf(oddSide);
  return b;
}
function sample(p, spec, tier, perStructure, k){
  const seen = new Map(), errors = []; let n = 0;
  p.seed(5000 + SPECS.indexOf(spec) * 31 + tier);
  for (let i = 0; i < perStructure * k; i++){
    const r = p.ctx.iqOddGenerate(tier); n++;
    const a = analyze(p, r, spec);
    if (a.errs.length && errors.length < 5) errors.push(a.errs.join('; '));
    else if (a.errs.length) errors.push(null);
    if (a.id) seen.set(a.id, (seen.get(a.id) || 0) + 1);
  }
  return { seen, errors: errors.filter(x => x !== null || true), n, errCount: errors.length };
}

// ---------------- exact "simple shortcut" bots (chance = 25%) ----------------
const ALL4 = [0, 1, 2, 3];
function botAccuracy(qs, pick){ let acc = 0; for (const q of qs){ const c = pick(q); acc += c.includes(q.oi) ? 1 / c.length : 0; } return qs.length ? acc / qs.length : NaN; }
const singletonOf = f => q => { const g = {}; ALL4.forEach(i => (g[f(q, i)] = g[f(q, i)] || []).push(i)); const keys = Object.keys(g); const single = Object.values(g).filter(x => x.length === 1); return (keys.length === 2 && single.length === 1) ? single[0] : ALL4; };
const extreme = (key, dir) => q => { const v = q[key], m = dir > 0 ? Math.max(...v) : Math.min(...v); return ALL4.filter(i => v[i] === m); };
const BOTS = {
  mostDots: extreme('dots', 1), fewestDots: extreme('dots', -1), mostSides: extreme('sides', 1), fewestSides: extreme('sides', -1),
  parity: q => [].concat(singletonOf((qq, i) => qq.dots[i] % 2)(q)),
  uniqueCount: q => { const c = {}; q.dots.forEach(d => (c[d] = (c[d] || 0) + 1)); const u = ALL4.filter(i => c[q.dots[i]] === 1); return u.length ? u : ALL4; },
  orderBreak: q => { const ok = []; for (let r = 0; r < 4; r++){ const idx = ALL4.filter(i => i !== r).sort((a, b) => q.sides[a] - q.sides[b]); let mono = true; for (let k = 1; k < 3; k++) if (!(q.dots[idx[k]] > q.dots[idx[k - 1]])) mono = false; if (mono) ok.push(r); } return ok.length ? ok : ALL4; },
  rowCount: q => [].concat(singletonOf((qq, i) => rowCountOf(qq.dots[i]))(q))
};
const pctOf = x => (100 * x).toFixed(1);

function run(){
  // ---- RAT-1: registration and default state ----
  test('RAT-1 registry: the existing variant and the nine new ones are all registered ENABLED with their approved minTier; nothing else', () => {
    const p = H.loadProject();
    const reg = p.evalIn('IQ_ODD_VARIANTS').ratio;
    if (!reg) return { pass: false, info: 'no variants are registered for the ratio family' };
    const bad = [];
    if (reg.map(v => v.key).join() !== SPECS.map(s => s.key).join()) bad.push('registered keys ' + reg.map(v => v.key).join() + ' != expected ' + SPECS.map(s => s.key).join());
    for (const s of SPECS){
      const v = reg.find(x => x.key === s.key); if (!v){ bad.push('missing ' + s.key); continue; }
      if (v.enabled !== true) bad.push(s.key + ' enabled=' + v.enabled);
      if (v.minTier !== s.minTier) bad.push(s.key + ' minTier=' + v.minTier + ' expected ' + s.minTier);
      if (typeof v.generate !== 'function') bad.push(s.key + ' has no generate');
    }
    return { pass: !bad.length, info: reg.length + ' variants' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });

  test('RAT-2 shipped settings: the ratio family asks every variant from its own first tier and never earlier (3,000 questions); the original variant keeps its old item shape and structureKey format', () => {
    const p = H.loadProject();
    p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'ratio'; });
    p.seed(11); const seenAt = {}, shapes = new Set(); let badKey = 0, n = 0, early = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){
      const r = p.ctx.iqOddGenerate(t); n++;
      (seenAt[t] = seenAt[t] || new Set()).add(r.variant);
      const spec = SPECS.find(x => x.key === r.variant); if (!spec || spec.minTier > t) early++;
      if (r.variant === 'sides-minus-1-ring'){ r.items.forEach(it => shapes.add(Object.keys(it).join())); if (r.structureKey !== 'ratio:sides-minus-1-ring:' + r.items.map(it => it.sides + '/' + it.dots).sort().join(',')) badKey++; }
    }
    const missing = []; for (let t = 1; t <= 6; t++) SPECS.filter(x => x.minTier <= t).forEach(x => { if (!seenAt[t].has(x.key)) missing.push(x.key + '@' + t); });
    return { pass: !early && !badKey && !missing.length && [...shapes].join() === 'kind,sides,dots,color,strokeWidth,size', info: n + ' questions | asked too early or unknown: ' + early + ' | variants never reached at a tier where they are due: ' + (missing.join(',') || 'none') + ' | bad structureKeys ' + badKey };
  });

  test('RAT-3 tier gating: a new variant is not offered below its minTier (no eligible variant -> clear error) and is offered from it', () => {
    const bad = [];
    for (const s of NEW_SPECS){
      const p = forced(s.key);
      for (let t = 1; t <= 6; t++){
        const m = msgOf(() => p.ctx.iqOddGenerate(t));
        if (t < s.minTier && !(m && /no enabled variant for family "ratio" at tier/.test(m))) bad.push(s.key + '@' + t + ' should be refused, got ' + m);
        if (t >= s.minTier && m) bad.push(s.key + '@' + t + ' should generate, got ' + m);
      }
    }
    return { pass: !bad.length, info: NEW_SPECS.length + ' variants x 6 tiers' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });

  // ---- RAT-4: the oracle itself (pure arithmetic, independent of production) ----
  test('RAT-4 oracle sanity: structure space per variant before/after the row-count filter equals the approved counts (72/72, 72->69, 60, 15->12, 68, 64->59, 60, 60, 48->40)', () => {
    const rows = NEW_SPECS.map(s => { const raw = oracleStructures(s, false).length, kept = oracleStructures(s, true).length; return { key: s.key, raw, kept, ok: raw === s.raw && kept === s.kept }; });
    return { pass: rows.every(r => r.ok), info: rows.map(r => r.key + ' ' + r.raw + (r.raw !== r.kept ? '->' + r.kept : '') + (r.ok ? '' : ' (UNEXPECTED)')).join(' | ') };
  });

  // ---- RAT-5..13: one exhaustive test per new variant ----
  NEW_SPECS.forEach((spec, idx) => {
    test('RAT-' + (5 + idx) + ' ' + spec.key + ': every question is valid (independent SVG checks), the generator covers EXACTLY the oracle structure set (no more, no less), uniformly', () => {
      const oracle = oracleStructures(spec, true), K = oracle.length, want = new Set(oracle.map(s => s.id));
      const bad = []; let total = 0;
      for (const tier of [spec.minTier, 6]){
        const p = forced(spec.key);
        const per = Math.max(12, Math.round((tier === spec.minTier ? 120 : 40) * SCALE));
        const s = sample(p, spec, tier, per, K); total += s.n;
        if (s.errCount) bad.push('tier ' + tier + ': ' + s.errCount + ' invalid questions, e.g. ' + s.errors.filter(Boolean)[0]);
        const extra = [...s.seen.keys()].filter(id => !want.has(id)), missing = [...want].filter(id => !s.seen.has(id));
        if (extra.length) bad.push('tier ' + tier + ': ' + extra.length + ' structures OUTSIDE the oracle set, e.g. ' + extra[0]);
        if (missing.length) bad.push('tier ' + tier + ': ' + missing.length + ' oracle structures never generated, e.g. ' + missing[0]);
        if (tier === spec.minTier && SCALE >= 1){
          const exp = s.n / K, off = [...s.seen.entries()].filter(([, c]) => c < 0.5 * exp || c > 1.5 * exp);
          if (off.length) bad.push('not uniform: ' + off.length + ' structures outside 0.5x..1.5x of the expected ' + exp.toFixed(0) + ', e.g. ' + off[0].join('x'));
        }
      }
      return { pass: !bad.length, info: K + ' structures; ' + total + ' questions analysed from the SVG' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });

  test('RAT-14 the existing variant (sides-minus-1-ring): every question valid by the independent checks, covers exactly its own 12 structures per tier pool, same wording as before', () => {
    const bad = [];
    for (const tier of [1, 2, 3, 4, 5, 6]){
      const p = forced('sides-minus-1-ring'); const oracle = oracleExisting(tier), want = new Set(oracle.map(s => s.id));
      const s = sample(p, EXISTING, tier, Math.max(30, Math.round(150 * SCALE)), oracle.length);
      if (s.errCount) bad.push('tier ' + tier + ': ' + s.errCount + ' invalid, e.g. ' + s.errors.filter(Boolean)[0]);
      const extra = [...s.seen.keys()].filter(id => !want.has(id)), missing = [...want].filter(id => !s.seen.has(id));
      if (extra.length || missing.length) bad.push('tier ' + tier + ': extra ' + extra.length + ', missing ' + missing.length);
    }
    const wording = 'בשלוש הצורות מספר הנקודות הפנימיות הוא בדיוק מספר הצלעות פחות 1 - בצורה שנבחרה היחס הזה לא מתקיים.';
    if (explanationOf(EXISTING) !== wording) bad.push('oracle wording template does not reproduce the existing sentence');
    return { pass: !bad.length, info: '6 tiers x 12 structures' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });

  // ---- RAT-15: verifier == oracle on EVERY candidate question, including invalid ones ----
  test('RAT-15 the verifier agrees with the oracle on every candidate (all 4-of-5 side sets x odd option x wrong count 0..9): accepts exactly the valid ones, rejects the rest without throwing', () => {
    const bad = []; let cases = 0, accepts = 0;
    for (const spec of SPECS){
      const p = forced(spec.key); p.seed(3);
      let base = null; for (let t = spec.minTier; t <= 6 && !base; t++) base = p.ctx.iqOddGenerate(t);
      for (const S of SUBSETS) for (const oddSide of S) for (let w = 0; w <= 9; w++){
        const dots = S.map(s => (s === oddSide ? w : s + spec.b));
        const oi = S.indexOf(oddSide);
        const valid = w !== oddSide + spec.b && S.every((s, i) => feasible(spec.placement, s, dots[i])) && !(spec.placement === 'rows' && isolatesByRows(dots, oi));
        const v = verdict(p, fixture(base, spec, S, oddSide, w)); cases++; if (v === 'accept') accepts++;
        if ((v === 'accept') !== valid && bad.length < 8) bad.push(spec.key + ' sides ' + S.join('') + ' odd ' + oddSide + ' dots ' + w + ': verifier says ' + v + ', oracle says ' + (valid ? 'valid' : 'invalid'));
        else if ((v === 'accept') !== valid) bad.push('+');
      }
    }
    return { pass: !bad.length, info: cases + ' candidates, ' + accepts + ' accepted' + (bad.length ? ' | DISAGREEMENTS (' + bad.length + '): ' + bad.filter(x => x !== '+').join(' | ') : '') };
  });

  // ---- RAT-16: the row-count filter ----
  test('RAT-16 row-count filter: removes exactly the structures where the odd option\'s row count differs from three equal others (and nothing else); the removed ones are rejected, the kept ones accepted', () => {
    const bad = [], parts = [];
    // the predicate on explicit cases (independent of the layout code)
    const table = [[[4, 5, 6, 1], 3, true], [[4, 4, 4, 1], 3, true], [[1, 2, 3, 6], 3, true], [[3, 4, 5, 6], 0, true], [[3, 4, 5, 6], 3, false], [[1, 5, 6, 7], 0, true], [[1, 5, 6, 3], 0, false], [[2, 3, 4, 5], 2, false], [[1, 2, 5, 6], 0, false]];
    table.forEach(([dots, oi, want]) => { if (isolatesByRows(dots, oi) !== want) bad.push('predicate wrong for ' + dots + ' odd ' + oi); });
    for (const spec of NEW_SPECS.filter(s => s.placement === 'rows')){
      const p = forced(spec.key); p.seed(8);
      let base = null; for (let t = spec.minTier; t <= 6 && !base; t++) base = p.ctx.iqOddGenerate(t);
      const all = oracleStructures(spec, false), kept = new Set(oracleStructures(spec, true).map(s => s.id));
      let removed = 0, removedRejected = 0, keptAccepted = 0;
      for (const q of all){
        const v = verdict(p, fixture(base, spec, q.S, q.oddSide, q.w));
        if (kept.has(q.id)){ if (v === 'accept') keptAccepted++; else bad.push(spec.key + ': kept structure ' + q.id + ' was ' + v); }
        else { removed++; if (v === 'reject') removedRejected++; else bad.push(spec.key + ': removed structure ' + q.id + ' was ' + v); }
      }
      parts.push(spec.key + ' ' + all.length + '->' + kept.size + ' (removed ' + removed + ', rejected ' + removedRejected + ', kept accepted ' + keptAccepted + ')');
    }
    return { pass: !bad.length, info: parts.join(' | ') + (bad.length ? ' | WRONG: ' + bad.slice(0, 6).join(' | ') : '') };
  });

  // ---- RAT-17: named must-reject fixtures, all variants ----
  test('RAT-17 must-reject fixtures: two odd options, no odd option, wrong rule for the variant, dots 0 / 9, duplicate side counts, mixed placements, impossible layouts - the verifier rejects each without throwing', () => {
    const bad = []; let cases = 0;
    const must = (p, label, r) => { cases++; const v = verdict(p, r); if (v !== 'reject') bad.push(label + ' -> ' + v); };
    for (const spec of SPECS){
      const p = forced(spec.key); p.seed(5);
      let base = null; for (let t = spec.minTier; t <= 6 && !base; t++) base = p.ctx.iqOddGenerate(t);
      const clone = () => JSON.parse(JSON.stringify(base));
      const S = [4, 5, 6, 7];
      // find an odd option / count that is otherwise valid so that each fixture breaks exactly one thing
      let good = null;
      for (const oddSide of S) for (const off of [1, -1, 2, -2]){ const w = oddSide + spec.b + off; if (!good && oracleStructures(spec, true).some(q => q.S.join() === S.join() && q.oddSide === oddSide && q.w === w)) good = { oddSide, w }; }
      if (!good){ bad.push(spec.key + ': no valid base structure for 4,5,6,7'); continue; }
      const okFix = fixture(base, spec, S, good.oddSide, good.w);
      if (verdict(p, okFix) !== 'accept') bad.push(spec.key + ': the valid control was not accepted');
      const lbl = t => spec.key + ' ' + t;
      // two options break the rule
      const two = fixture(base, spec, S, good.oddSide, good.w); const j = (two.oddIndex + 1) % 4; two.items[j].dots += 1; must(p, lbl('two odd options'), two);
      // nobody breaks the rule
      const none = fixture(base, spec, S, good.oddSide, good.oddSide + spec.b); must(p, lbl('no odd option'), none);
      // the variant's neighbouring rule (one dot too many in all options)
      const wrong = clone(); wrong.items = S.map(s => Object.assign({}, base.items[0], { sides: s, dots: s + spec.b + 1 })); wrong.items[2].dots += 1; wrong.oddIndex = 2; must(p, lbl('whole figure follows a different rule'), wrong);
      // dots out of range
      must(p, lbl('odd option with 0 dots'), fixture(base, spec, S, good.oddSide, 0));
      must(p, lbl('odd option with 9 dots'), fixture(base, spec, S, good.oddSide, 9));
      // duplicate side counts
      const dup = fixture(base, spec, S, good.oddSide, good.w); dup.items[(dup.oddIndex + 1) % 4].sides = dup.items[(dup.oddIndex + 2) % 4].sides; must(p, lbl('two options with the same side count'), dup);
      // impossible layout: triangle with 8 dots
      const imp = fixture(base, spec, [3, 4, 5, 6], 3, 8); must(p, lbl('triangle with 8 dots'), imp);
      // mixed placement among options
      const mix = fixture(base, spec, S, good.oddSide, good.w);
      const other = spec.placement === 'ring' ? 'dice' : 'ring';
      if (other === 'ring') delete mix.items[(mix.oddIndex + 1) % 4].placement; else mix.items[(mix.oddIndex + 1) % 4].placement = other;
      must(p, lbl('one option in a different placement'), mix);
      // variant name does not match the rule the figure follows
      const names = SPECS.filter(s => s.b !== spec.b).map(s => s.key);
      const ren = clone(); ren.variant = names[0];
      // (the variant must be enabled to reach the verifier through iqOddGenerate; calling the verifier directly checks the rule pairing)
      must(p, lbl('result names a variant with a different rule'), ren);
    }
    return { pass: !bad.length, info: cases + ' fixtures' + (bad.length ? ' | NOT REJECTED: ' + bad.join(' | ') : '') };
  });

  // ---- RAT-18: positive controls of the independent analysis ----
  test('RAT-18 positive controls: the independent SVG analysis flags each seeded defect (dot too close to the outline, two dots touching, a dot removed, a bigger dot, wrong layout, row-count giveaway)', () => {
    const bad = [];
    const spec = NEW_SPECS.find(s => s.key === 'sides-minus-1-rows');
    const p = forced(spec.key); p.seed(2);
    let r = null; for (let i = 0; i < 400 && !r; i++){ const c = p.ctx.iqOddGenerate(spec.minTier); if (c.items.every(it => it.dots >= 2)) r = c; }
    const svgs = r.items.map(it => p.ctx.iqOddRenderItem(it));
    const clean = analyzeSvgs(svgs, r, spec);
    if (clean.errs.length) bad.push('control question not clean: ' + clean.errs.join('; '));
    const mutate = (i, fn) => svgs.map((s, k) => (k === i ? fn(s) : s));
    const firstCircle = s => /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(s);
    const expectErr = (label, mutated, re) => { const a = analyzeSvgs(mutated, r, spec); if (!a.errs.some(x => re.test(x))) bad.push(label + ' not flagged (' + (a.errs.join('; ') || 'no errors') + ')'); };
    expectErr('dot pushed to the outline', mutate(0, s => { const m = firstCircle(s); return s.replace(m[0], '<circle cx="' + m[1] + '" cy="12.0" r="' + m[3] + '"'); }), /gap|outside|layout/);
    expectErr('two dots touching', mutate(0, s => { const m = firstCircle(s); const re2 = /<circle cx="([\d.]+)" cy="([\d.]+)"/g; re2.exec(s); const m2 = re2.exec(s); return s.replace(m2[0], '<circle cx="' + (+m[1] + 8.5).toFixed(1) + '" cy="' + m[2] + '"'); }), /dot-to-dot|layout/);
    expectErr('a dot removed', mutate(1, s => s.replace(/<circle[^>]*\/>/, '')), /collinear|layout|dots/);
    expectErr('a bigger dot', mutate(2, s => s.replace(/ r="4\.0"/, ' r="5.0"')), /radius/);
    expectErr('ring layout inside a rows question', mutate(3, s => { const dots = (s.match(/<circle/g) || []).length; return s.replace(/<circle[^>]*\/>/g, '').replace('</svg>', LAYOUT.ring(r.items[3].sides, dots).map(([x, y]) => '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.0" fill="#1a1a2e"/>').join('') + '</svg>'); }), /layout/);
    // a row-count giveaway: the only 2-row option among 1-row options
    const giveaway = { oddIndex: 3, variant: spec.key, explanation: explanationOf(spec), structureKey: null };
    const mk = (n, d) => { const pts = LAYOUT.rows(n, d); return '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><polygon points="' + polyVerts(n).map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') + '" fill="#aaa" stroke="#1a1a2e" stroke-width="3"/>' + pts.map(q => '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="4.0" fill="#1a1a2e"/>').join('') + '</svg>'; };
    const ga = analyzeSvgs([mk(4, 3), mk(5, 3), mk(6, 3), mk(7, 4)].map(String), giveaway, spec);
    if (!ga.errs.some(x => /number of rows/.test(x))) bad.push('row-count giveaway (3,3,3 dots vs 4: rows 1,1,1,2) not flagged: ' + ga.errs.join('; '));
    return { pass: !bad.length, info: 'clean control + 6 seeded defects' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });

  // ---- RAT-20: the generator itself never proposes an invalid structure (no reliance on the verify-and-retry loop) ----
  test('RAT-20 first-attempt validity: calling each variant generator directly (no retry loop) always yields a question the verifier accepts', () => {
    const bad = []; let total = 0;
    for (const spec of SPECS){
      const p = forced(spec.key); p.seed(900 + SPECS.indexOf(spec));
      const gen = p.evalIn('IQ_ODD_VARIANTS.ratio').find(v => v.key === spec.key).generate;
      const n = Math.max(300, Math.round(3000 * SCALE)); let rejected = 0;
      for (let i = 0; i < n; i++){ const r = gen(spec.minTier); total++; if (p.ctx.iqOddVerifyExactlyOneOdd(r) !== true) rejected++; }
      if (rejected) bad.push(spec.key + ': ' + rejected + ' of ' + n + ' proposals were rejected by the verifier');
    }
    return { pass: !bad.length, info: total + ' direct proposals' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });

  // ---- RAT-19: simple-shortcut bots, exact, before and after the filter ----
  test('RAT-19 simple shortcuts (exact, over the whole structure space; chance 25%): the row-count bot is at chance AFTER the filter and was not before; the filter creates no other prominent shortcut', () => {
    const lines = [], bad = [];
    const names = Object.keys(BOTS);
    lines.push('variant'.padEnd(20) + ' structs ' + names.map(n => n.slice(0, 9).padStart(9)).join(' '));
    for (const spec of NEW_SPECS){
      const kept = oracleStructures(spec, true), raw = oracleStructures(spec, false);
      const rate = (qs, n) => (spec.placement !== 'rows' && n === 'rowCount') ? null : botAccuracy(qs, BOTS[n]);
      const after = {}, before = {}; names.forEach(n => { after[n] = rate(kept, n); before[n] = rate(raw, n); });
      lines.push(spec.key.padEnd(20) + String(kept.length).padStart(7) + '  ' + names.map(n => (after[n] == null ? '-' : pctOf(after[n])).padStart(9)).join(' ') + (raw.length !== kept.length ? '   (before filter: ' + raw.length + ' structs; ' + names.filter(n => before[n] != null && Math.abs(before[n] - after[n]) > 0.0005).map(n => n + ' ' + pctOf(before[n]) + '->' + pctOf(after[n])).join(', ') + ')' : ''));
      if (spec.placement === 'rows'){
        if (after.rowCount > 0.25 + 1e-9) bad.push(spec.key + ' row-count bot still ' + pctOf(after.rowCount) + '% after the filter');
        if (!(after.rowCount < before.rowCount + 1e-9)) bad.push(spec.key + ' filter did not lower the row-count bot (' + pctOf(before.rowCount) + '->' + pctOf(after.rowCount) + ')');
      }
      names.forEach(n => {
        if (after[n] == null) return;
        // pre-registered guards: no simple count/size shortcut above 40%; the order-break pattern (inherent to any linear rule; 52% in the EXISTING variant) stays below 70%
        const cap = n === 'orderBreak' ? 0.70 : 0.40;
        if (after[n] > cap) bad.push(spec.key + ' bot ' + n + ' = ' + pctOf(after[n]) + '% exceeds ' + (cap * 100) + '%');
      });
    }
    return { pass: !bad.length, info: '\n       ' + lines.join('\n       ') + (bad.length ? '\n       GUARD FAILURES: ' + bad.join(' | ') : '') };
  });

  return out;
}

module.exports = { run, SPECS, oracleStructures, oracleExisting, BOTS, botAccuracy };
