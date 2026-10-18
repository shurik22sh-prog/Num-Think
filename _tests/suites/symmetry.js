'use strict';
// Focused tests for the symmetry family. Questions are generated through the real
// iqOddGenerate (core retry loop included) with only the symmetry family enabled in the sandbox,
// then re-derived from the rendered SVG with the independent verifiers wherever possible.
// Rule of this suite: hard gates are properties the design guarantees or the user specified;
// statistical cue rates are REPORTED with their sample size and tolerance and only guarded
// against gross leakage (stated below), not rejected for being non-zero.
// The margin floor is a property of the RENDERED geometry (the rounded coordinates that are drawn),
// checked here in exact integer arithmetic with NO tolerance: 5 units = 2500 tenths-squared.

const H = require('../harness');
const V = require('../verify');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}

// ---- test-side spec (an independent copy of the approved design) ----
const FLOOR = 5, FLOOR_SQ = 2500, RMIN = 22, RMAX = 38;
// A shape is DRAWN symmetric about an axis when its reflection error (tenths of a unit, squared) is within what
// rounding alone can produce: an exactly symmetric shape is off by at most one tenth per coordinate (error <= 2),
// so 4 is twice the worst case. The intended axis of an exactly symmetric shape is measured to be exactly 0.
const DRAWN_SQ = 4;
const BANDS = { 1: [7, 8.5], 2: [7, 8.5], 3: [6, 7], 4: [6, 7], 5: [5, 6], 6: [5, 6] };
const VARIANT = { 1: 'axis-fixed', 2: 'axis-fixed', 3: 'axis-mixed-2', 4: 'axis-mixed-2', 5: 'axis-mixed-3', 6: 'axis-mixed-3' };
const DISTINCT_NORMAL_AXES = { 'axis-fixed': 1, 'axis-mixed-2': 2, 'axis-mixed-3': 3 };
const PAIRS = { vertical: [[0, 4], [1, 3], [5, 7]], horizontal: [[1, 7], [2, 6], [3, 5]], diag45: [[0, 2], [3, 7], [4, 6]], diag135: [[0, 6], [1, 5], [2, 4]] };
const AXES = Object.keys(PAIRS);
const DEG = { horizontal: 0, diag45: 45, vertical: 90, diag135: 135 };      // geometric meaning of each axis name (SVG coordinates, y down)
const PHRASE = { vertical: 'אנכי', horizontal: 'אופקי', diag45: 'מוטה, מלמעלה-שמאל למטה-ימין', diag135: 'מוטה, מלמעלה-ימין למטה-שמאל' };
const FIXED_PREFIX = 'שלוש הצורות סימטריות, ולכל אחת מהן ציר סימטריה ';
const MIXED_PREFIX = 'שלוש הצורות סימטריות, ולכל אחת מהן ציר סימטריה אחד. הצירים: ';
const ENDING = '. בצורה שנבחרה אחת הפינות זזה, ולכן אין לה אף ציר סימטריה.';
const BANNED = ['אלכסון', 'מעוין', 'מקבילית', 'טרפז', 'דלתון', 'קודקוד'];
const MAX_EXPLANATION = 185;   // conciseness guard: the longest wording today is 181 characters (the previous version reached 219)
const PROMPT_HTML = '<div class="iq-prompt-text">איזו צורה שונה מהשאר?</div>';
const gapOn = (r, ax) => Math.max(...PAIRS[ax].map(([i, j]) => Math.abs(r[i] - r[j])));
const marginOf = r => Math.min(...AXES.map(a => gapOn(r, a)));                     // unrounded radii margin (information only)
const exactAxes = r => AXES.filter(a => PAIRS[a].every(([i, j]) => r[i] === r[j]));
const sorted = a => a.slice().sort();
const ci = (p, n) => 1.96 * Math.sqrt(p * (1 - p) / n);
const pct = x => (100 * x).toFixed(1) + '%';
const count = (s, sub) => s.split(sub).length - 1;

// Which on-screen vertices lie ON the symmetry axis of a rendered shape, derived from the SVG alone, for one
// axis angle: the vertices that reflect onto themselves (within the 0.1 rounding), named by where they sit.
function onAxisSignature(pts, center, deg){
  const cx = Math.round(center[0] * 10), cy = Math.round(center[1] * 10);
  const T = pts.map(([x, y]) => [Math.round(x * 10) - cx, Math.round(y * 10) - cy]);
  const cs = Math.round(Math.cos(deg * Math.PI / 90)), sn = Math.round(Math.sin(deg * Math.PI / 90));
  const on = T.filter(([x, y]) => Math.abs((x * cs + y * sn) - x) <= 2 && Math.abs((x * sn - y * cs) - y) <= 2);
  const quad = ([x, y]) => (Math.abs(x) <= 2 ? (y < 0 ? 'top' : 'bottom') : Math.abs(y) <= 2 ? (x < 0 ? 'left' : 'right') : (y < 0 ? (x < 0 ? 'upper-left' : 'upper-right') : (x < 0 ? 'lower-left' : 'lower-right')));
  return sorted(on.map(quad)).join('+');
}
// Every axis the shape is DRAWN symmetric about (reflection error at rounding level, <= 4 tenths-squared).
function drawnAxes(pts, center){
  const sq = V.renderedAxisSq(pts, center);
  return Object.keys(sq).map(Number).filter(d => sq[d] <= DRAWN_SQ);
}
const GEOMETRY_PHRASE = { 'bottom+top': 'אנכי', 'left+right': 'אופקי', 'lower-right+upper-left': 'מוטה, מלמעלה-שמאל למטה-ימין', 'lower-left+upper-right': 'מוטה, מלמעלה-ימין למטה-שמאל' };

function run(opts){
  const n = opts.n, seed = opts.seed;
  const P = H.loadProject();
  P.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'symmetry'; });
  const counter = { core: 0 };
  const origGen = P.sandbox.iqOddGenSymmetry;
  P.sandbox.iqOddGenSymmetry = (...a) => { counter.core++; return origGen(...a); };

  // ---- collect once ----
  const data = {}; let errors = 0;
  for (let tier = 1; tier <= 6; tier++){
    P.seed(seed * 100 + tier);
    const rows = [], attempts = {};
    for (let i = 0; i < n; i++){
      counter.core = 0;
      let res;
      try { res = P.ctx.iqOddGenerate(tier); } catch (e){ errors++; continue; }
      attempts[counter.core] = (attempts[counter.core] || 0) + 1;
      const svgs = res.items.map(it => P.ctx.iqOddRenderItem(it));
      const parsed = svgs.map(s => V.parseSvg(s));
      rows.push({ res, radii: res.items.map(it => Array.from(it.radii)), parsed });
    }
    data[tier] = { rows, attempts };
  }
  const tiers = [1, 2, 3, 4, 5, 6];

  test('SY-1 RENDERED margin floor: every odd shape has margin >= 5 units on the drawn (rounded) coordinates, in exact integer arithmetic with no tolerance, on all six tiers', () => {
    const lines = []; let violations = 0, disagree = 0, exactly5 = 0, radiiBelowRenderedOk = 0;
    for (const t of tiers){
      let minSq = Infinity, atBoundary = 0, radiiBelow = 0;
      for (const { res, radii, parsed } of data[t].rows){
        const o = res.oddIndex, sq = V.renderedMarginSq(parsed[o].polygons[0].pts, parsed[o].center);
        minSq = Math.min(minSq, sq);
        if (sq < FLOOR_SQ) violations++;
        if (sq === FLOOR_SQ) atBoundary++;
        if (sq !== P.ctx.iqOddRenderedMarginSq(radii[o])) disagree++;          // independent measure vs the shared production helper
        if (marginOf(radii[o]) < FLOOR) radiiBelow++;                           // accepted although the unrounded radii gap is below 5 (rendered gap is 5.0 or more)
      }
      exactly5 += atBoundary; radiiBelowRenderedOk += radiiBelow;
      lines.push('tier ' + t + ': N=' + data[t].rows.length + ' min rendered margin ' + (Math.sqrt(minSq) / 10).toFixed(2) + ' (' + minSq + ' of 2500 tenths-squared)');
    }
    return { pass: !violations && !disagree && !errors, info: lines.join(' | ') + ' | rendered margin below 5: ' + violations + ' | independent vs production helper disagreements: ' + disagree + ' | exactly 5.0: ' + exactly5 + ' | unrounded-radii gap below 5 but rendered >= 5: ' + radiiBelowRenderedOk + ' | generation errors ' + errors };
  });

  test('SY-2 all three normal shapes are EXACTLY symmetric (shared radii on the intended axis), the SVG shows that axis, and NO other axis is drawn', () => {
    let bad = 0, total = 0;
    for (const t of tiers) for (const { res, radii } of data[t].rows){
      res.items.forEach((_, i) => {
        if (i === res.oddIndex) return;
        total++;
        if (exactAxes(radii[i]).length < 1) bad++;                                         // exact, not approximate
      });
    }
    // axis-name <-> geometry mapping, independently: every exact axis must be seen by the SVG analysis at the matching angle
    let mapBad = 0, mapTotal = 0;
    for (const t of tiers) for (const { res, radii, parsed } of data[t].rows){
      const an = V.symmetryAnalysis(parsed);
      res.items.forEach((_, i) => {
        if (i === res.oddIndex) return;
        for (const a of exactAxes(radii[i])){ mapTotal++; if (an.items[i].dev[DEG[a]] > 0.3) mapBad++; }
      });
    }
    // the rendered normal is symmetric about its intended axis and about NO other axis (independent, all vertices)
    let axisBad = 0, axisTotal = 0, notIntended = 0;
    for (const t of tiers) for (const { res, radii, parsed } of data[t].rows){
      res.items.forEach((_, i) => {
        if (i === res.oddIndex) return;
        axisTotal++;
        const drawn = drawnAxes(parsed[i].polygons[0].pts, parsed[i].center), intended = exactAxes(radii[i]);
        if (intended.length !== 1 || !drawn.includes(DEG[intended[0]])) notIntended++;
        if (drawn.length !== 1) axisBad++;
      });
    }
    return { pass: !bad && !mapBad && !axisBad && !notIntended, info: total + ' normals: not exactly symmetric ' + bad + '; ' + mapTotal + ' exact axes checked against the rendered SVG at their geometric angle, mismatches ' + mapBad + ' | rendered intended axis missing: ' + notIntended + ' of ' + axisTotal + ' | drawn symmetric about an UNINTENDED extra axis (error <= ' + DRAWN_SQ + '): ' + axisBad + ' of ' + axisTotal };
  });

  test('SY-3 exactly one odd shape per question, independently re-derived from the SVG; the odd has no symmetry axis at all', () => {
    let bad = 0, total = 0, oddWithAxis = 0;
    for (const t of tiers) for (const { res, parsed } of data[t].rows){
      total++;
      const an = V.symmetryAnalysis(parsed);
      if (!(an.unique && an.oddIndex === res.oddIndex)) bad++;
      if (an.items[res.oddIndex].axes.length) oddWithAxis++;
    }
    return { pass: !bad && !oddWithAxis, info: total + ' questions, not-unique/wrong-index ' + bad + ', odd with a symmetry axis ' + oddWithAxis };
  });

  test('SY-4 axis configuration by tier: tiers 1-2 one shared axis; tiers 3-4 two different axes; tiers 5-6 three different axes; all four orientations occur', () => {
    const lines = []; let bad = 0;
    for (const t of tiers){
      const need = DISTINCT_NORMAL_AXES[VARIANT[t]], seen = {}, baseSeen = {};
      for (const { res, radii } of data[t].rows){
        const normAxes = [];
        res.items.forEach((_, i) => { if (i !== res.oddIndex){ const ex = exactAxes(radii[i]); if (ex.length !== 1) bad++; normAxes.push(ex[0]); } });
        const distinct = new Set(normAxes);
        if (distinct.size !== need) bad++;
        const m = /^symmetry:(.+?):normals=(.+?):defect-axis=(.+)$/.exec(res.structureKey);
        if (!m || m[1] !== VARIANT[t] || res.variant !== VARIANT[t] || m[2] !== sorted(normAxes).join('+')) bad++;
        else {
          baseSeen[m[3]] = (baseSeen[m[3]] || 0) + 1;
          if (need <= 2 && !distinct.has(m[3])) bad++;                     // odd's near-axis is one of the normals' axes in tiers 1-4
          // the defect is local: on its axis exactly ONE pair differs, by an amount inside the tier's band
          const o = radii[res.oddIndex], gaps = PAIRS[m[3]].map(([a, b]) => Math.abs(o[a] - o[b])), moved = gaps.filter(g => g > 1e-12);
          if (moved.length !== 1 || moved[0] < BANDS[t][0] - 1e-9 || moved[0] > BANDS[t][1] + 1e-9) bad++;
        }
        for (const a of distinct) seen[a] = (seen[a] || 0) + 1;
      }
      const N = data[t].rows.length;
      const axisShare = AXES.map(a => a + ' ' + pct((seen[a] || 0) / N)).join(', ');
      const baseShare = AXES.map(a => a + ' ' + pct((baseSeen[a] || 0) / N)).join(', ');
      lines.push('tier ' + t + ' (' + VARIANT[t] + '): axes present in a question: ' + axisShare + ' | defect axis: ' + baseShare);
      if (AXES.some(a => !seen[a] || !baseSeen[a])) bad++;                   // all four orientations occur, as normals and as defect axis
      if (VARIANT[t] === 'axis-fixed') for (const a of AXES) if (Math.abs(baseSeen[a] / N - 0.25) > 0.03) bad++;
    }
    return { pass: !bad, info: lines.join(' || ') + ' || violations ' + bad };
  });

  test('SY-5 explanations: exact wording, only the axes used, each normal has ONE axis (mixed variants say so), banned words absent, concise', () => {
    let bad = 0, total = 0, maxLen = 0; const samples = {}; const keys = {}; let triedBad = 0; const why = {};
    const flag = k => { bad++; why[k] = (why[k] || 0) + 1; };
    for (const t of tiers) for (const { res, radii } of data[t].rows){
      total++;
      const used = AXES.filter(a => res.items.some((_, i) => i !== res.oddIndex && exactAxes(radii[i]).includes(a)));
      const e = res.explanation; maxLen = Math.max(maxLen, e.length);
      const expected = used.length === 1 ? FIXED_PREFIX + PHRASE[used[0]] + ENDING : MIXED_PREFIX + used.map(a => PHRASE[a]).join('; ') + ENDING;
      if (e !== expected) flag('text differs from the specified wording');
      for (const a of AXES) if (count(e, PHRASE[a]) !== (used.includes(a) ? 1 : 0)) flag('axis phrase count wrong');
      if (used.length > 1 && count(e, 'ציר סימטריה אחד') !== 1) flag('mixed variant does not say each shape has one axis');
      if (used.length === 1 && e.includes('הצירים')) flag('fixed variant lists several axes');
      if (e.includes('אנכי או אופקי')) flag('old inaccurate claim');
      if (BANNED.some(w => e.includes(w)) || /(^|[^א-ת])אנך([^א-ת]|$)/.test(e)) flag('banned word');
      if (!e.includes('הפינות')) flag('does not use פינה');
      if (e.length > MAX_EXPLANATION) flag('too long');
      if (!Number.isInteger(res.candidatesTried) || res.candidatesTried < 1 || res.candidatesTried > 30) triedBad++;
      if (!Number.isInteger(res.normalCandidatesTried) || res.normalCandidatesTried < 3 || res.normalCandidatesTried > 90) triedBad++;
      keys[t] = keys[t] || {}; keys[t][res.structureKey] = (keys[t][res.structureKey] || 0) + 1;
      if (!samples[res.variant]) samples[res.variant] = e;
    }
    const keyInfo = [[1, 2], [3, 4], [5, 6]].map(g => { const m = {}; g.forEach(t => Object.entries(keys[t]).forEach(([k, v]) => { m[k] = (m[k] || 0) + v; })); const N = Object.values(m).reduce((a, b) => a + b, 0); return g.join('-') + ': ' + Object.keys(m).length + ' keys, largest share ' + pct(Math.max(...Object.values(m)) / N); }).join('; ');
    return { pass: !bad && !triedBad, info: total + ' explanations, longest ' + maxLen + ' characters (guard ' + MAX_EXPLANATION + '), violations ' + bad + ' ' + JSON.stringify(why) + ', bad candidatesTried ' + triedBad + ' | structure keys per tier group (provisional targets: >=10 keys, largest share <=25%): ' + keyInfo + ' | samples: [' + samples['axis-fixed'] + '] [' + samples['axis-mixed-3'] + ']' };
  });

  test('SY-5b the axis words are geometrically correct: the INTENDED axis of each normal is among the axes it is really drawn with, its phrase matches the vertices on that axis, and no phrase names an undrawn axis', () => {
    let bad = 0, total = 0, dual = 0; const byPhrase = {}; const dualExamples = [];
    for (const t of tiers) for (const { res, radii, parsed } of data[t].rows.slice(0, 3000)){
      const drawnPhrases = new Set();
      res.items.forEach((_, i) => {
        if (i === res.oddIndex) return;
        total++;
        const pts = parsed[i].polygons[0].pts, c = parsed[i].center;
        const drawn = drawnAxes(pts, c);
        const intended = exactAxes(radii[i])[0];                                  // the axis the shape was built with
        if (!drawn.includes(DEG[intended])){ bad++; return; }
        if (drawn.length > 1){ dual++; if (dualExamples.length < 2) dualExamples.push(t + ':' + intended + '+' + drawn.filter(d => d !== DEG[intended]).join('/')); }
        const p = GEOMETRY_PHRASE[onAxisSignature(pts, c, DEG[intended])];       // phrase implied by the GEOMETRY of the intended axis
        if (!p || p !== PHRASE[intended]){ bad++; return; }                        // phrase in the code must be what the drawing shows
        byPhrase[p] = (byPhrase[p] || 0) + 1;
        drawn.forEach(d => { const q = GEOMETRY_PHRASE[onAxisSignature(pts, c, d)]; if (q) drawnPhrases.add(q); });
        if (res.explanation.split(p).length !== 2) bad++;                         // the intended axis is named exactly once
      });
      for (const p of Object.values(PHRASE)) if (res.explanation.includes(p) && !drawnPhrases.has(p)) bad++;   // no phrase for an axis that is not drawn
    }
    return { pass: !bad && !dual, info: total + ' normals checked; mismatches ' + bad + ' | phrases confirmed by geometry: ' + JSON.stringify(byPhrase) + ' | normals ALSO drawn symmetric about a second axis (would make "one axis" untrue of the drawing): ' + dual + ' of ' + total + (dualExamples.length ? ' e.g. ' + dualExamples.join(', ') : '') + ' (upper-left/lower-right = "מלמעלה-שמאל למטה-ימין", upper-right/lower-left = "מלמעלה-ימין למטה-שמאל"; SVG y points down)' };
  });

  test('SY-6 no tier-based reduction of the radius range: 22-38 at every tier, same distribution of the symmetric shapes on every tier', () => {
    const lines = []; let bad = 0;
    for (const t of tiers){
      let mn = Infinity, mx = -Infinity, s = 0, s2 = 0, c = 0;
      for (const { res, radii } of data[t].rows){
        radii.forEach((r, i) => r.forEach(v => { if (v < RMIN - 1e-9 || v > RMAX + 1e-9) bad++; if (i !== res.oddIndex){ mn = Math.min(mn, v); mx = Math.max(mx, v); s += v; s2 += v * v; c++; } }));
      }
      const mean = s / c, sd = Math.sqrt(s2 / c - mean * mean);
      lines.push('tier ' + t + ': normals span ' + mn.toFixed(2) + '-' + mx.toFixed(2) + ', mean ' + mean.toFixed(2) + ', sd ' + sd.toFixed(2));
      if (mn > RMIN + 0.1 || mx < RMAX - 0.1 || Math.abs(mean - 30) > 0.15 || Math.abs(sd - 16 / Math.sqrt(12)) > 0.12) bad++;   // uniform(22,38): mean 30, sd 4.62
    }
    return { pass: !bad, info: lines.join(' | ') + ' | expected uniform 22-38: mean 30.00, sd 4.62 | violations ' + bad };
  });

  test('SY-7 acceptance and retry cost under the RENDERED floor: candidate acceptance, the loop that absorbs rejections, and exhaustion of the 10-attempt limit', () => {
    const lines = []; let bad = 0;
    for (const t of tiers){
      const rows = data[t].rows, N = rows.length;
      const tried = rows.map(r => r.res.candidatesTried), total = tried.reduce((a, b) => a + b, 0);
      const a = N / total;                                   // per-candidate acceptance (geometric estimate)
      const p10 = Math.pow(1 - a, 10), p30 = Math.pow(1 - a, 30);
      const att = data[t].attempts, maxAtt = Math.max(...Object.keys(att).map(Number));
      const nTried = rows.reduce((s, r) => s + r.res.normalCandidatesTried, 0), nAcc = (3 * N) / nTried, nP30 = Math.pow(1 - nAcc, 30);
      if (nP30 > 1e-9) bad++;
      lines.push('tier ' + t + ' normals: candidate acceptance ' + pct(nAcc) + ' (' + nTried + ' candidates for ' + 3 * N + ' normals, P(30 all rejected)=' + nP30.toExponential(1) + ') | odd: acceptance per candidate ' + pct(a) + ' (+-' + (100 * ci(a, total)).toFixed(2) + ' pts, ' + total + ' candidates), candidates tried mean ' + (total / N).toFixed(2) + ' max ' + Math.max(...tried) +
        ' | P(10 candidates all rejected)=' + p10.toExponential(1) + ' (what the core loop alone would face) | P(30 all rejected)=' + p30.toExponential(1) + ' | core attempts ' + JSON.stringify(att));
      if (a < 0.5 || p30 > 1e-9 || maxAtt !== 1) bad++;      // 50% = the provisional design target
    }
    return { pass: !bad && errors === 0, info: lines.join(' || ') + ' || generation errors (core exhaustion) ' + errors };
  });

  test('SY-8 cue rates for area, perimeter and radius spread (reported; guard only against gross leakage)', () => {
    const feat = pts => {
      const c = [50, 50]; let area = 0, per = 0;
      for (let i = 0; i < pts.length; i++){ const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; per += Math.hypot(a[0] - b[0], a[1] - b[1]); }
      const rs = pts.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])), m = rs.reduce((x, y) => x + y, 0) / rs.length;
      return [Math.abs(area) / 2, per, Math.sqrt(rs.reduce((x, y) => x + (y - m) * (y - m), 0) / rs.length)];
    };
    const groups = [[1, 2], [3, 4], [5, 6], [1, 2, 3, 4, 5, 6]];
    const names = ['area', 'perimeter', 'spread'];
    const lines = []; let bad = 0;
    for (const g of groups){
      const rows = g.flatMap(t => data[t].rows), N = rows.length;
      const cnt = names.map(() => ({ max: 0, min: 0, mid: 0 })); let comb = 0;
      for (const { res, parsed } of rows){
        const f = parsed.map(p => feat(p.polygons[0].pts)), score = [0, 0, 0, 0];
        names.forEach((_, k) => {
          const o = f[res.oddIndex][k], others = f.filter((_, i) => i !== res.oddIndex).map(x => x[k]);
          if (o > Math.max(...others)) cnt[k].max++; else if (o < Math.min(...others)) cnt[k].min++; else cnt[k].mid++;
          for (let i = 0; i < 4; i++){ const v = f[i][k], oth = f.filter((_, j) => j !== i).map(x => x[k]); if (!(v > Math.max(...oth)) && !(v < Math.min(...oth))) score[i]++; }
        });
        const best = Math.max(...score), tied = score.filter(s => s === best).length;
        if (score[res.oddIndex] === best) comb += 1 / tied;
      }
      const hw = ci(0.3, N);
      lines.push('tiers ' + g.join(',') + ' (N=' + N + ', +-' + (100 * hw).toFixed(2) + ' pts): ' + names.map((nm, k) => nm + ' max/min/middle ' + pct(cnt[k].max / N) + '/' + pct(cnt[k].min / N) + '/' + pct(cnt[k].mid / N)).join('; ') +
        ' | guess-largest-spread ' + pct(cnt[2].max / N) + ', guess-a-middle-area ' + pct(cnt[0].mid / N / 2) + ', combined-middle bot ' + pct(comb / N));
      if (cnt[2].max / N > 0.40 || comb / N > 0.40 || cnt[0].max / N > 0.40 || cnt[1].max / N > 0.40) bad++;
    }
    return { pass: !bad, info: lines.join(' || ') + ' || chance for a guess is 25%; no cue-based rejection is applied; the only guard is a gross-leakage limit of 40% (a regression alarm, not a quality threshold)' };
  });

  test('SY-9 deterministic: the same seed gives identical symmetry questions on every tier; a different seed differs', () => {
    const run1 = seedv => { const Q = H.loadProject(); Q.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'symmetry'; }); Q.seed(seedv); const r = []; for (let t = 1; t <= 6; t++) for (let i = 0; i < 200; i++) r.push(Q.ctx.iqOddGenerate(t)); return JSON.stringify(r); };
    const a = run1(5), b = run1(5), c = run1(6);
    return { pass: a === b && a !== c, info: 'compared 1,200 full questions (' + a.length + ' characters)' };
  });

  test('SY-10 the production verifier on the exact RENDERED boundary and malformed questions (fixtures; the floor is 2500 tenths-squared = 5.0 units, no tolerance)', () => {
    const rng = H.mulberry32(4242), rr = () => RMIN + rng() * (RMAX - RMIN);
    const sym = ax => { const r = new Array(8).fill(null); for (let i = 0; i < 8; i++) if (r[i] === null){ const p = PAIRS[ax].find(q => q[0] === i || q[1] === i); r[i] = rr(); if (p) r[p[0] === i ? p[1] : p[0]] = r[i]; } return r; };
    const render = r => V.parseSvg(P.ctx.iqOddRenderBlob(r, '#4C6FFF', 3, 100));
    const axisSq = r => { const p = render(r); return V.renderedAxisSq(p.polygons[0].pts, p.center); };
    const marginSq = r => Math.min(...Object.values(axisSq(r)));
    // an odd whose only large vertical-axis gap is the axis-aligned pair (0,4), so the rendered gap is exactly
    // r4 - r0 on a 0.1 grid; the other three axes are required to be clearly above the floor
    const oddWithGap = (r0, r4) => { for (;;){ const r = sym('vertical'); r[0] = r0; r[4] = r4; const s = axisSq(r); if (s[0] >= 3600 && s[45] >= 3600 && s[135] >= 3600) return r; } };
    const q = (radiiList, odd) => ({ family: 'symmetry', oddIndex: odd, items: radiiList.map(radii => ({ kind: 'symmetry', radii, color: '#4C6FFF', strokeWidth: 3, size: 100 })) });
    const v = r => P.ctx.iqOddVerifyExactlyOneOdd(JSON.parse(JSON.stringify(r)));
    const normals = () => [sym('vertical'), sym('horizontal'), sym('diag45')];
    const jitter = r => r.map((x, i) => (i === 3 ? x + 1e-3 : x));
    const odd60 = oddWithGap(30, 36), odd50 = oddWithGap(30, 35), odd49 = oddWithGap(30, 34.9), odd51 = oddWithGap(30, 35.1);
    const oddRadii4_92 = oddWithGap(30.04, 34.96);                        // unrounded gap 4.92, but it DRAWS as 30.0 vs 35.0 = exactly 5.0
    // an odd whose unrounded radii gap is >= 5 but whose DRAWN margin is below 5 (the 4.95 case the rounding produces)
    let belowRendered = null;
    for (let k = 0; k < 400000 && !belowRendered; k++){
      const r = sym('vertical'); const g = 5 + rng() * 0.14; r[1] = r[3] - g < RMIN ? r[3] + g : r[3] - g;
      if (r[1] < RMIN || r[1] > RMAX) continue;
      if (marginOf(r) >= FLOOR && marginSq(r) < FLOOR_SQ && marginSq(r) > 1600) belowRendered = r;
    }
    if (!belowRendered) throw new Error('fixture search failed: no odd with radii margin >= 5 and rendered margin < 5');
    // a normal exactly symmetric about the VERTICAL axis whose HORIZONTAL axis is off only by the gap between the two
    // axis-aligned vertices (2 and 6): gap 0.1 draws as an error of 1, 0.2 as 4, 0.3 as 9 (tenths squared)
    const normalWithGap = g => [34, 30, 26, 30, 34, 30, 26 + g, 30];
    const hAxisSq = r => axisSq(r)[0], vAxisSq = r => axisSq(r)[90];
    const checks = [
      ['fixture sanity: the second-axis normals draw horizontal errors 0 / 1 / 4 / 9 and vertical error 0', [0, 0.1, 0.2, 0.3].map(g => hAxisSq(normalWithGap(g))).join() === '0,1,4,9' && [0, 0.1, 0.2, 0.3].every(g => vAxisSq(normalWithGap(g)) === 0), null],
      ['fixture sanity: drawn margin of the 6.0 / 5.0 / 4.9 / 5.1 / 4.92-radii fixtures', [marginSq(odd60), marginSq(odd50), marginSq(odd49), marginSq(odd51), marginSq(oddRadii4_92)].join() === '3600,2500,2401,2601,2500', null],
      ['drawn margin below 5 although the unrounded radii gap is at least 5 (drawn ' + (Math.sqrt(marginSq(belowRendered)) / 10).toFixed(3) + ', radii ' + marginOf(belowRendered).toFixed(4) + ')', null, [q([...normals(), belowRendered], 3), false]],
      ['valid: drawn margin 6.0', null, [q([...normals(), odd60], 3), true]],
      ['boundary: drawn margin exactly 5.0 is accepted', null, [q([...normals(), odd50], 3), true]],
      ['drawn margin 4.9 is rejected', null, [q([...normals(), odd49], 3), false]],
      ['drawn margin 5.1 is accepted', null, [q([...normals(), odd51], 3), true]],
      ['unrounded radii gap 4.92 but drawn margin exactly 5.0 is accepted (the floor is on the drawing)', null, [q([...normals(), oddRadii4_92], 3), true]],
      ['a normal ALSO exactly symmetric about a second axis (horizontal, gap 0) is rejected', null, [q([normalWithGap(0), normals()[1], normals()[2], odd60], 3), false]],
      ['a normal drawn identical to symmetric about a second axis (error 1) is rejected', null, [q([normalWithGap(0.1), normals()[1], normals()[2], odd60], 3), false]],
      ['a normal at the threshold (second-axis error 4) is rejected', null, [q([normalWithGap(0.2), normals()[1], normals()[2], odd60], 3), false]],
      ['a normal just beyond it (second-axis error 9) is accepted: it is not drawn symmetric about a second axis', null, [q([normalWithGap(0.3), normals()[1], normals()[2], odd60], 3), true]],
      ['odd is exactly symmetric about a diagonal (margin 0)', null, [q([...normals(), sym('diag45')], 3), false]],
      ['no odd: all four exactly symmetric', null, [q([...normals(), sym('horizontal')], 3), false]],
      ['two odd', null, [q([normals()[0], normals()[1], odd60, odd51], 3), false]],
      ['a normal is only approximately symmetric (off by 0.001)', null, [q([normals()[0], jitter(sym('vertical')), normals()[2], odd60], 3), false]],
      ['generator names the wrong option as odd', null, [q([...normals(), odd60], 0), false]],
      ['radius above the range (39)', null, [q([...normals(), odd60.map((x, i) => (i === 2 ? 39 : x))], 3), false]],
      ['radius below the range (21)', null, [q([...normals(), odd60.map((x, i) => (i === 2 ? 21 : x))], 3), false]],
      ['wrong number of radii (7)', null, [q([...normals(), odd60.slice(0, 7)], 3), false]],
      ['radii are not numbers', null, [q([...normals(), odd60.map((x, i) => (i === 0 ? 'x' : x))], 3), false]]
    ];
    const bad = [];
    for (const [label, sanity, fx] of checks){
      if (sanity !== null){ if (!sanity) bad.push(label); continue; }
      if (v(fx[0]) !== fx[1]) bad.push(label);
    }
    return { pass: !bad.length, info: checks.length + ' checks, wrong verdicts: ' + (bad.length ? bad.join(' | ') : 'none') };
  });

  test('SY-11 independent discovery at EVERY tier: before answering the player gets no axis hint, no defect hint and no sign of which option is odd; the explanation appears only after a correct answer', () => {
    const cat = P.evalIn('IQ_CATEGORIES').find(c => c.key === 'oddone');
    const HINT_WORDS = ['ציר', 'סימטר', 'אנכי', 'אופקי', 'מוטה', 'פינה', 'פינות', 'זזה', 'הוזז', 'קודקוד', 'אלכסון', 'שונה:', 'כאן'];
    const why = {}; let bad = 0, total = 0, afterCorrect = 0, afterWrongHidden = 0;
    const flag = k => { bad++; why[k] = (why[k] || 0) + 1; };
    for (const t of tiers){
      for (let i = 0; i < 150; i++){
        P.localStorage.setItem('iq_progress_v1', JSON.stringify({ oddone: { tier: t, streak: 0 } }));
        P.ctx.askIQQuestion(cat);
        const prompt = P.doc.getElementById('iq-oddone-prompt'), expl = P.doc.getElementById('iq-oddone-explanation'), opts = P.doc.getElementById('iq-oddone-options');
        total++;
        if (prompt.innerHTML !== PROMPT_HTML) flag('prompt differs from the fixed prompt');
        if (expl.textContent !== '') flag('explanation visible before answering');
        const btns = opts.children.slice();
        if (btns.length !== 4){ flag('not four options'); continue; }
        const heads = new Set();
        for (const b of btns){
          if (Object.keys(b.attrs).length || Object.keys(b.dataset).length) flag('option carries attributes/data');
          if ([...b.classSet].join(' ') !== 'iq-option-btn' || b.disabled) flag('option has a distinguishing class/state before answering');
          let parsed;
          try { parsed = V.parseSvg(b.innerHTML); } catch (e){ flag('option contains something other than a plain svg'); continue; }
          if (parsed.tags.join() !== 'svg,polygon' || parsed.circles.length) flag('extra drawing elements (marks/lines/text)');
          heads.add(b.innerHTML.replace(/points="[^"]*"/, 'points=""'));
          const visible = b.innerHTML.replace(/<[^>]*>/g, '');
          if (visible.trim()) flag('text inside an option');
        }
        if (heads.size !== 1) flag('options differ in anything other than their outline');
        const all = prompt.textContent + expl.textContent + btns.map(b => b.textContent + b.innerHTML.replace(/points="[^"]*"/g, '')).join('');
        if (HINT_WORDS.some(w => all.includes(w))) flag('hint wording on screen before answering');
        // feedback only after the answer: wrong clicks reveal nothing, the correct click shows the explanation
        for (const b of btns){
          b.click();
          if (b.classSet.has('incorrect')){ if (expl.textContent === '') afterWrongHidden++; else flag('explanation shown after a WRONG answer'); }
          if (b.classSet.has('correct')){ if (expl.textContent.startsWith(FIXED_PREFIX.slice(0, 20))) afterCorrect++; else flag('no explanation after the correct answer'); break; }
        }
        P.flushTimers();
      }
    }
    return { pass: !bad, info: total + ' questions (150 per tier, tiers 1-6) checked on the fake DOM; violations ' + bad + ' ' + JSON.stringify(why) + ' | explanation appeared after the correct click ' + afterCorrect + ' times and stayed hidden after ' + afterWrongHidden + ' wrong clicks | the prompt is the same fixed string on every tier' };
  });

  test('SY-12 unintended second axis, BEFORE vs AFTER the fix: raw candidates (what the generator built before) against the normals it now delivers', () => {
    const THRESH = [2, 4, 16];
    const extraFreq = (list) => { const c = { 2: 0, 4: 0, 16: 0 }; let intendedMax = 0, n = 0;
      for (const { pts, center, deg } of list){ n++; const sq = V.renderedAxisSq(pts, center); intendedMax = Math.max(intendedMax, sq[deg]); const others = Object.keys(sq).map(Number).filter(d => d !== deg); for (const th of THRESH) if (others.some(d => sq[d] <= th)) c[th]++; }
      return { n, c, intendedMax }; };
    // BEFORE: raw exactly-symmetric candidates straight from the radius builder (no extra-axis check)
    const before = []; const rawPerAxis = 100000;
    for (const axis of P.evalIn('IQ_ODD_SYM_AXES')) for (let k = 0; k < rawPerAxis; k++){
      const r = Array.from(P.ctx.iqOddSymmetricRadii(axis));
      before.push({ pts: P.ctx.iqOddBlobPointStrings(r, 100).map(([x, y]) => [Number(x), Number(y)]), center: [50, 50], deg: DEG[axis] });
    }
    // AFTER: every normal in the generated questions
    const after = [];
    for (const t of tiers) for (const { res, radii, parsed } of data[t].rows) res.items.forEach((_, i) => { if (i !== res.oddIndex) after.push({ pts: parsed[i].polygons[0].pts, center: parsed[i].center, deg: DEG[exactAxes(radii[i])[0]] }); });
    const B = extraFreq(before), A = extraFreq(after);
    const fmt = (S) => THRESH.map(th => 'error<=' + th + ': ' + S.c[th] + ' of ' + S.n + ' (' + (100 * S.c[th] / S.n).toFixed(4) + '%)').join(', ');
    const pass = A.c[2] === 0 && A.c[4] === 0 && B.c[4] > 0 && A.intendedMax <= 2 && B.intendedMax <= 2;
    return { pass, info: 'BEFORE (raw candidates): ' + fmt(B) + ' | AFTER (generated normals): ' + fmt(A) + ' | largest error on the INTENDED axis: before ' + B.intendedMax + ', after ' + A.intendedMax + ' (rounding bound 2) | gate: none after at error <= 4 (the detector does see them before); the looser <=16 line is context only - those shapes still differ from symmetric about a second axis by 0.4-1.3 units in the radii' };
  });

  test('SY-13 generator and verifier agree: every candidate the generator delivers is accepted by the verifier, and the generator never delivers a question the verifier would reject', () => {
    let delivered = 0, rejected = 0; const lines = [];
    const Q = H.loadProject();                                    // no wrapper here: raw iqOddGenSymmetry output, BEFORE the core retry loop
    for (const t of tiers){
      Q.seed(seed * 77 + t); let rej = 0;
      for (let i = 0; i < n; i++){ const res = Q.ctx.iqOddGenSymmetry(t); delivered++; if (!Q.ctx.iqOddVerifyExactlyOneOdd(res)){ rej++; rejected++; } }
      lines.push('tier ' + t + ': ' + n + ' raw generator outputs, rejected by the verifier ' + rej);
    }
    return { pass: rejected === 0, info: lines.join(' | ') + ' | total ' + delivered + ', verifier disagreements ' + rejected + ' (the generator tests each candidate with the SAME shared floor and extra-axis helpers the verifier uses; a disagreement would mean the loop gave up after 30 candidates)' };
  });

  return out;
}

module.exports = { run };
