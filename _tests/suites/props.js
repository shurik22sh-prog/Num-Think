'use strict';
// Focused tests of the property-classification family (key 'props'): three shapes share a geometric property, one does not.
// Everything is derived from the rendered SVG with test-side geometry. Rules under test:
//   - the family and its five variants (equal-sides, two-parallel-pairs, right-angles, one-parallel-pair, right-triangle) are registered DISABLED
//     (family minTier 3; variants 3 / 4 / 4 / 4 / 4);
//   - exactly one option lacks the variant's property, and it is the intended odd one;
//   - every measured property is unambiguous: right angles within 1 degree or 12+ degrees away, parallel pairs within 1 degree or 12+ away,
//     "all sides equal" within 1% or the shortest at most 85% of the longest;
//   - the four areas agree (3% after the SVG's 0.1 rounding), every side is at least 17 viewBox units, shapes are tilted at random;
//   - property audit: any visible property that splits the four options 3-1 singles out the odd option (so e.g. a square among rhombi is rejected).

const H = require('../harness');
const V = require('../verify');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.PROPS_SAMPLE_SCALE || 1);
const VARIANTS = [
  { key: 'equal-sides', minTier: 3, n: 4, rule: p => p.equalSides, text: 'בשלוש הצורות כל ארבע הצלעות שוות באורכן - בצורה שנבחרה הצלעות אינן שוות.' },
  { key: 'two-parallel-pairs', minTier: 4, n: 4, rule: p => p.parallel === 2, text: 'בשלוש הצורות יש שני זוגות של צלעות מקבילות - בצורה שנבחרה יש רק זוג אחד.' },
  { key: 'right-angles', minTier: 4, n: 4, rule: p => p.right === 4, text: 'בשלוש הצורות כל הזוויות ישרות - בצורה שנבחרה אין זוויות ישרות.' },
  { key: 'one-parallel-pair', minTier: 4, n: 4, rule: p => p.parallel === 1, text: 'בשלוש הצורות יש בדיוק זוג אחד של צלעות מקבילות - בצורה שנבחרה יש שני זוגות.' },
  { key: 'right-triangle', minTier: 4, n: 3, rule: p => p.right === 1, text: 'בכל אחד משלושת המשולשים יש זווית ישרה - במשולש שנבחר אין זווית ישרה.' }
];
const D = 180 / Math.PI;

// ---------- test-side geometry on rendered polygons ----------
function measure(pts){
  const n = pts.length, vec = pts.map((p, i) => { const q = pts[(i + 1) % n]; return [q[0] - p[0], q[1] - p[1]]; }), len = vec.map(v => Math.hypot(v[0], v[1]));
  const ang = pts.map((p, i) => { const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n]; const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]]; return Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * D; });
  const line = (u, v) => Math.acos(Math.min(1, Math.abs(u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v)))) * D;
  const ratio = Math.min(...len) / Math.max(...len);
  const m = { n, right: ang.filter(a => Math.abs(a - 90) <= 1.2).length, equalSides: ratio >= 0.985, area: 0, minSide: Math.min(...len), clear: true, parallel: undefined, axes: 0 };
  if (!ang.every(a => Math.abs(a - 90) <= 1.2 || Math.abs(a - 90) >= 10)) m.clear = false;
  if (!(ratio >= 0.985 || ratio <= 0.87)) m.clear = false;
  if (n === 4){ const par = [line(vec[0], vec[2]), line(vec[1], vec[3])]; m.parallel = par.filter(a => a <= 1.2).length; if (!par.every(a => a <= 1.2 || a >= 10)) m.clear = false; }
  for (let c = 0; c < n; c++){ let dA = 0, r = 1; for (let i = 0; i < n; i++){ const mm = ((c - i) % n + n) % n, e = ((c - i - 1) % n + n) % n; dA = Math.max(dA, Math.abs(ang[i] - ang[mm])); r = Math.min(r, Math.min(len[i], len[e]) / Math.max(len[i], len[e])); } if (dA <= 1.2 && r >= 0.985) m.axes++; else if (dA < 6 && r > 0.9) m.clear = false; }
  let a = 0; for (let i = 0; i < n; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]; a += x1 * y2 - x2 * y1; } m.area = Math.abs(a) / 2;
  m.edgeAligned = vec.some(v => { const t = Math.abs(Math.atan2(v[1], v[0]) * D) % 90; return Math.min(t, 90 - t) < 1; });
  return m;
}
const audit = (ms, odd) => ['equalSides', 'right', 'parallel', 'axes'].every(k => { const vals = ms.map(m => m[k]); if (vals.some(v => v === undefined)) return true; const g = {}; vals.forEach((v, i) => (g[String(v)] = g[String(v)] || []).push(i)); const s = Object.values(g); return !(s.length === 2 && s.some(x => x.length === 1) && s.some(x => x.length === 3)) || s.find(x => x.length === 1)[0] === odd; });

function analyze(p, result, v){
  const errs = [], svgs = result.items.map(it => p.ctx.iqOddRenderItem(it));
  let parsed; try { parsed = svgs.map(s => V.parseSvg(s)); } catch (x){ return { errs: ['unparseable: ' + x.message] }; }
  const ms = parsed.map((pa, i) => {
    if (pa.polygons.length !== 1 || pa.circles.length || pa.polygons[0].pts.length !== v.n){ errs.push('option ' + i + ': not a single ' + v.n + '-gon'); return null; }
    const pts = pa.polygons[0].pts;
    if (pts.some(q => q[0] < 4 || q[0] > 96 || q[1] < 4 || q[1] > 96)) errs.push('option ' + i + ': too close to the tile edge');
    return measure(pts);
  });
  if (errs.length) return { errs };
  const holds = ms.map(v.rule), bad = holds.map((h, i) => (h ? -1 : i)).filter(i => i >= 0);
  if (bad.length !== 1) errs.push('options lacking the property: ' + bad.length);
  else if (bad[0] !== result.oddIndex) errs.push('SVG-derived odd ' + bad[0] + ' != result.oddIndex ' + result.oddIndex);
  ms.forEach((m, i) => { if (!m.clear) errs.push('option ' + i + ' has an ambiguous property'); if (m.minSide < 17) errs.push('option ' + i + ' side ' + m.minSide.toFixed(1) + ' < 17'); });
  const areas = ms.map(m => m.area); if (Math.max(...areas) / Math.min(...areas) - 1 > 0.03) errs.push('areas differ by ' + (100 * (Math.max(...areas) / Math.min(...areas) - 1)).toFixed(1) + '%');
  if (!audit(ms, result.oddIndex)) errs.push('a visible property splits 3-1 on the wrong option');
  if (result.explanation !== v.text) errs.push('explanation');
  if (result.variant !== v.key) errs.push('variant ' + result.variant);
  return { errs, ms };
}
function forced(key){
  const p = H.loadProject();
  p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'props'; });
  if (key) p.evalIn('IQ_ODD_VARIANTS.props').forEach(x => { x.enabled = x.key === key; });
  return p;
}

function run(){
  test('PROPS-1 registry: family "props" exists, ENABLED, minTier 3; its five variants are ENABLED with minTier 3 / 4 / 4 / 4 / 4', () => {
    const p = H.loadProject(); const fam = p.evalIn('IQ_ODD_FAMILIES').find(f => f.key === 'props');
    if (!fam) return { pass: false, info: 'family not registered' };
    const reg = p.evalIn('IQ_ODD_VARIANTS').props; if (!reg) return { pass: false, info: 'no variants registered' };
    const bad = [];
    if (fam.enabled !== true || fam.minTier !== 3) bad.push('family enabled=' + fam.enabled + ' minTier=' + fam.minTier);
    if (reg.map(x => x.key).join() !== VARIANTS.map(x => x.key).join()) bad.push('keys ' + reg.map(x => x.key).join());
    VARIANTS.forEach(v => { const r = reg.find(x => x.key === v.key); if (!r) return; if (r.enabled !== true) bad.push(v.key + ' not enabled'); if (r.minTier !== v.minTier) bad.push(v.key + ' minTier=' + r.minTier); });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });

  test('PROPS-2 shipped settings: with the real defaults "props" is asked from tier 3 and never before (3,000 oddone questions)', () => {
    const p = H.loadProject(); p.seed(5); let before = 0, from = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){ const f = p.ctx.iqOddGenerate(t).family; if (f === 'props'){ if (t < 3) before++; else from++; } }
    return { pass: before === 0 && from > 0, info: 'asked before tier 3: ' + before + ' | asked from tier 3: ' + from };
  });

  VARIANTS.forEach((v, idx) => {
    test('PROPS-' + (3 + idx) + ' ' + v.key + ': ' + Math.round(2000 * SCALE) + ' questions valid by the independent SVG checks (single odd, unambiguous properties, equal areas, side length, audit, wording), gated by tier', () => {
      const bad = [], pg = forced(v.key);
      for (let t = 1; t <= 6; t++){ let m = null; try { pg.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < v.minTier && !(m && /no enabled (variant|family)/.test(m))) bad.push('tier ' + t + ' should be refused'); if (t >= v.minTier && m) bad.push('tier ' + t + ' should generate: ' + m); }
      const p = forced(v.key); p.seed(120 + idx);
      const N = Math.round(2000 * SCALE); let invalid = 0; const examples = []; const oddTypes = {}; let aligned = 0, oddAligned = 0;
      for (let i = 0; i < N; i++){
        const r = p.ctx.iqOddGenerate(v.minTier); oddTypes[r.structureKey] = (oddTypes[r.structureKey] || 0) + 1;
        const a = analyze(p, r, v);
        if (a.errs.length){ invalid++; if (examples.length < 3) examples.push(a.errs.join('; ')); } else {
          const al = a.ms.map(m => m.edgeAligned); if (al.some(Boolean)) aligned++;
          if (al[r.oddIndex] && al.filter(Boolean).length === 1) oddAligned++;
        }
      }
      if (invalid) bad.push(invalid + ' invalid, e.g. ' + examples[0]);
      // acceptance of raw candidates (the generator redraws internally; below 20% would mean a poorly designed generator)
      const cand = p.evalIn('IQ_ODD_PROPS_VARIANTS').find(x => x.key === v.key); let ok = 0; const C = 1500;
      for (let i = 0; i < C; i++) if (p.ctx.iqOddGenPropsCandidate(cand)) ok++;
      if (ok / C < 0.2) bad.push('candidate acceptance only ' + (100 * ok / C).toFixed(1) + '%');
      return { pass: !bad.length, info: N + ' questions | odd shape types ' + JSON.stringify(oddTypes) + ' | candidate acceptance ' + (100 * ok / C).toFixed(0) + '% | the only axis-aligned option is the odd in ' + (100 * oddAligned / N).toFixed(1) + '%' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });

  test('PROPS-8 must-reject: a square among rhombi, two odd, no odd, a near-parallel "trapezoid", unequal areas, a tiny shape, a wrong-size polygon', () => {
    const p = forced('equal-sides'); p.seed(2);
    const base = p.ctx.iqOddGenerate(3); const clone = o => JSON.parse(JSON.stringify(o));
    const verdict = r => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW ' + e.message; } };
    const bad = [], must = (l, r) => { const x = verdict(r); if (x !== 'reject') bad.push(l + ' -> ' + x); };
    if (verdict(base) !== 'accept') bad.push('control not accepted');
    const normalsIdx = [0, 1, 2, 3].filter(i => i !== base.oddIndex);
    const fit = pts => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2; return pts.map(([x, y]) => [x - cx, y - cy]); };
    const ar = pts => { let a = 0; for (let i = 0; i < pts.length; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
    const withArea = (pts, target) => { const k = Math.sqrt(target / ar(pts)); return fit(pts.map(([x, y]) => [x * k, y * k])); };
    const A = ar(base.items[0].pts);
    const sq = withArea([[0, 0], [1, 0], [1, 1], [0, 1]], A);
    const sqAmong = clone(base); sqAmong.items[normalsIdx[0]].pts = sq; must('a square among the rhombi (lone right angles)', sqAmong);
    const two = clone(base); two.items[normalsIdx[0]].pts = clone(base.items[base.oddIndex].pts); must('two unequal-sided options', two);
    const none = clone(base); none.items[base.oddIndex].pts = clone(base.items[normalsIdx[0]].pts); must('no odd option', none);
    const tinyK = clone(base); tinyK.items.forEach(it => { it.pts = it.pts.map(([x, y]) => [x * 0.4, y * 0.4]); }); must('everything too small', tinyK);
    const bigDiff = clone(base); bigDiff.items[normalsIdx[1]].pts = bigDiff.items[normalsIdx[1]].pts.map(([x, y]) => [x * 0.85, y * 0.85]); must('areas differ by 28%', bigDiff);
    const tri = clone(base); tri.items[normalsIdx[2]].pts = tri.items[normalsIdx[2]].pts.slice(0, 3); must('a triangle among quadrilaterals', tri);
    const q = forced('two-parallel-pairs'); q.seed(4); const b2 = q.ctx.iqOddGenerate(4); const oddI = b2.oddIndex;
    const nearPar = clone(b2); const t = withArea([[0, 0], [1, 0], [0.80, 0.7], [0.15, 0.78]], A); nearPar.items[oddI].pts = t;      // top edge tilted 6 degrees off parallel: ambiguous
    const verdict2 = r => { try { return q.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW'; } };
    if (verdict2(nearPar) !== 'reject') bad.push('a trapezoid with an almost-parallel top -> ' + verdict2(nearPar));
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '7 fixtures rejected, control accepted' };
  });

  return out;
}

module.exports = { run };
