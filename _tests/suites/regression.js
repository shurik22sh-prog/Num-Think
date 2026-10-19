'use strict';
// Regression of the working tree against a frozen reference commit (default 0da4c3c).
// Both builds are loaded unmodified into separate sandboxes and driven with the SAME
// seed, so identical behaviour means identical output - byte for byte where the plan
// says "byte-identical", semantic where fields were deliberately added.
//
//   byte-identical: family sequence, item geometry, oddIndex, explanation text, every
//     option's SVG string, the on-screen (shuffled) option order, the correct-button
//     index, the DOM text, progression storage/level display/toasts, error messages,
//     retry counts, and the amount of randomness consumed (next Math.random() equal).
//   semantic: verifier verdicts on identical (including deliberately corrupted) inputs.
//   intentionally different: the added fields `kind` (on items) and `variant` / `structureKey`
//     (on results), stripped before comparing and checked separately; and, since Step 3, the
//     SYMMETRY family (new generator and margin floor), which is compared only in R3b.

const { execFileSync } = require('child_process');
const H = require('../harness');
const V = require('../verify');

const REF = '0da4c3c';
const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const git = args => execFileSync('git', args, { cwd: H.ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const clone = o => JSON.parse(JSON.stringify(o));
const strip = r => JSON.stringify({ family: r.family, oddIndex: r.oddIndex, explanation: r.explanation, items: r.items.map(it => { const c = clone(it); delete c.kind; return c; }) });
const nextRandom = p => p.evalIn('Math.random()');
const oddCat = p => p.evalIn('IQ_CATEGORIES').find(c => c.key === 'oddone');
const rotD = (pts, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
const mirD = pts => pts.map(([x, y]) => [-x, y]);

// The current build WITHOUT the "do not repeat the previous family/design" rule, so that seeded sequences can still be compared with the frozen reference.
function plainBuild(){ const p = H.loadProject(); p.evalIn('IQ_ODD_AVOID_REPEAT = false'); return p; }

function run(opts){
  const n = opts.n, seed = opts.seed, domN = Math.min(opts.domN, 300), ref = opts.ref || REF;
  const O = H.loadProject({ ref }), N = plainBuild();

  // Step 3 changed the symmetry generator, which consumes a different amount of randomness, so a whole
  // seeded SEQUENCE of mixed families can no longer match the reference after the first symmetry
  // question. Orientation and ratio are therefore checked independently: the family the shared picker
  // chooses is FORCED to the same value in both builds (the frozen build calls pickOne([...strings]),
  // the new one pickOne(<registry entries>)) without consuming any randomness, so their generators
  // still see identical random streams and must stay byte-identical. Symmetry is intentionally
  // different and is checked in R3b (verifier delta) and in the symmetry suite.
  const forceFamily = (p, key) => {
    const orig = p.sandbox.pickOne;
    p.sandbox.pickOne = arr => {
      if (Array.isArray(arr) && arr.length === 3 && arr[0] === 'orientation') return key;
      // the new build's family picker (entries with verify) -> the forced family; its VARIANT picker -> the original design (no randomness consumed either way)
      if (Array.isArray(arr) && arr.length && arr[0] && typeof arr[0] === 'object' && 'key' in arr[0]) return arr[0].verify ? arr.find(f => f.key === key) : arr.find(v => v.key === 'flag' || v.key === 'sides-minus-1-ring');
      return orig(arr);
    };
  };
  const forcedPair = key => { const o = H.loadProject({ ref }), nw = plainBuild(); forceFamily(o, key); forceFamily(nw, key); return { O: o, N: nw }; };
  const UNCHANGED = ['orientation', 'ratio'];

  // ---- R1: unchanged families: same seed -> identical questions, SVG, and randomness consumed ----
  test('R1 orientation and ratio unchanged: same seed gives identical items, oddIndex, explanation and option SVG, and the same randomness consumed (' + Math.ceil(n / 2) + ' questions x 6 tiers x 2 families)', () => {
    const bad = { result: 0, svg: 0, rng: 0, newFields: 0 }; let total = 0, firstBad = null; const fam = {};
    for (const key of UNCHANGED){
      const { O: o, N: nw } = forcedPair(key);
      for (let tier = 1; tier <= 6; tier++){
        o.seed(seed * 1000 + tier); nw.seed(seed * 1000 + tier);
        for (let i = 0; i < Math.ceil(n / 2); i++){
          const a = o.ctx.iqOddGenerate(tier), b = nw.ctx.iqOddGenerate(tier);
          total++; fam[b.family] = (fam[b.family] || 0) + 1;
          if (a.family !== key || b.family !== key) bad.result++;
          if (strip(a) !== strip(b)){ bad.result++; firstBad = firstBad || { family: key, tier, i }; }
          const sa = a.items.map(it => o.ctx.iqOddRenderItem(it)), sb = b.items.map(it => nw.ctx.iqOddRenderItem(it));
          if (sa.join('\n') !== sb.join('\n')) bad.svg++;
          if (!b.variant || !b.structureKey || !b.items.every(it => it.kind === b.family) || a.variant !== undefined) bad.newFields++;
        }
        if (nextRandom(o) !== nextRandom(nw)) bad.rng++;
      }
    }
    return { pass: !bad.result && !bad.svg && !bad.rng && !bad.newFields, info: total + ' questions, families ' + JSON.stringify(fam) + ', mismatches ' + JSON.stringify(bad) + (firstBad ? ' first: ' + JSON.stringify(firstBad) : '') };
  });
  test('R1b family selection unchanged: for the same seed both builds pick the same family first (3,000 seeds x 6 tiers; only the pick is compared, symmetry questions differ afterwards by design)', () => {
    const o = H.loadProject({ ref }), nw = plainBuild(); let bad = 0, total = 0; const fam = {};
    nw.evalIn('IQ_ODD_FAMILIES').forEach(f => { if (!['orientation', 'ratio', 'symmetry'].includes(f.key)) f.enabled = false; });     // the reference only has the three original families
    for (let tier = 1; tier <= 6; tier++) for (let s = 1; s <= 3000; s++){
      o.seed(s * 17 + tier); nw.seed(s * 17 + tier);
      const a = o.ctx.iqOddGenerate(tier).family, b = nw.ctx.iqOddGenerate(tier).family;
      total++; fam[b] = (fam[b] || 0) + 1; if (a !== b) bad++;
    }
    return { pass: !bad, info: total + ' picks, families ' + JSON.stringify(fam) + ', different picks ' + bad };
  });

  // ---- R2: the real renderQuestion/click path, on-screen order included (unchanged families) ----
  test('R2 orientation and ratio unchanged: identical on-screen option order, correct-button index, prompt and explanation (' + domN + ' per tier per family)', () => {
    const rec = p => {
      const cat = oddCat(p), opts_ = p.doc.getElementById('iq-oddone-options');
      p.ctx.askIQQuestion(cat);
      const btns = opts_.children.slice(), html = btns.map(b => b.innerHTML);
      for (const b of btns){ b.click(); if (b.classSet.has('correct')) break; }
      const r = { html, correct: btns.findIndex(b => b.classSet.has('correct')), classes: btns.map(b => b.className),
        prompt: p.doc.getElementById('iq-oddone-prompt').innerHTML, explanation: p.doc.getElementById('iq-oddone-explanation').textContent };
      p.flushTimers();
      return JSON.stringify(r);
    };
    let bad = 0, total = 0, rngBad = 0;
    for (const key of UNCHANGED){
      const { O: o, N: nw } = forcedPair(key);
      for (let tier = 1; tier <= 6; tier++){
        o.seed(seed * 7 + tier); nw.seed(seed * 7 + tier);
        for (let i = 0; i < domN; i++){
          for (const p of [o, nw]) p.localStorage.setItem('iq_progress_v1', JSON.stringify({ oddone: { tier, streak: 0 } }));
          total++;
          if (rec(o) !== rec(nw)) bad++;
        }
        if (nextRandom(o) !== nextRandom(nw)) rngBad++;
      }
    }
    return { pass: !bad && !rngBad, info: total + ' questions, mismatches ' + bad + ', randomness-consumed mismatches ' + rngBad };
  });

  // ---- R3: verifier verdicts on clean AND corrupted questions (unchanged families) ----
  test('R3 orientation and ratio: verifier verdicts identical (old vs new) on generated questions and on deliberately corrupted ones - the ONLY ratio difference is the stricter dot-crowding floor / dot range on corrupted, never-generated inputs', () => {
    const FLAG = O.evalIn('IQ_ODD_FLAG_BASE');
    const corrupt = c => {
      const odd = c.oddIndex, norm = [0, 1, 2, 3].filter(i => i !== odd), outl = [];
      const mk = fn => { const x = clone(c); fn(x); outl.push(x); };
      mk(x => { x.oddIndex = (odd + 1) % 4; });
      mk(x => { x.items[norm[0]] = clone(x.items[odd]); });
      mk(x => { x.items[odd] = clone(x.items[norm[0]]); });
      if (c.family === 'orientation') for (const k of [0, 90, 180, 270]) mk(x => { x.items[odd].pts = rotD(mirD(FLAG), k); });
      if (c.family === 'ratio'){ for (const d of [-2, -1, 1, 2]) mk(x => { x.items[odd].dots = Math.max(0, x.items[odd].dots + d); }); mk(x => { x.items[norm[1]].dots += 1; }); }
      return outl;
    };
    const stat = { pairs: 0, disagree: 0, trueVerdicts: 0, falseVerdicts: 0, cleanFalse: 0, ratioOldAcceptsNewRejectsExplained: 0, unexplained: 0 };
    // Ratio since the Ratio unit: the new verifier needs the result's `variant` (the reference build predates it, so the field the NEW build's
    // results carry is added), and it requires dots 1..8 with a centre distance >= 13.435 (the old floor was 10.95). A deliberately corrupted ratio
    // question the old rule accepted but the new one rejects is therefore EXPECTED exactly when some option has such crowded / out-of-range dots.
    const crowded = (nw, c) => c.items.some(it => {
      if (it.dots < 1 || it.dots > 8) return true;
      const L = nw.ctx.iqOddRatioLayout(it.sides, it.dots, it.strokeWidth, it.size, it.placement);
      for (let a = 0; a < L.centers.length; a++) for (let b = a + 1; b < L.centers.length; b++) if (Math.hypot(L.centers[a][0] - L.centers[b][0], L.centers[a][1] - L.centers[b][1]) < 13.435 - 1e-6) return true;
      return false;
    });
    const per = Math.min(n, 1500);
    for (const key of UNCHANGED){
      const { O: o, N: nw } = forcedPair(key);
      for (const src of [o, nw]){
        for (let tier = 1; tier <= 6; tier++){
          src.seed(seed * 31 + tier);
          for (let i = 0; i < per; i++){
            const res = clone(src.ctx.iqOddGenerate(tier));
            for (const [k, c] of [['clean', res], ...corrupt(res).map(x => ['bad', x])]){
              const cn = clone(c); if (key === 'ratio' && cn.variant === undefined) cn.variant = 'sides-minus-1-ring';
              const vo = o.ctx.iqOddVerifyExactlyOneOdd(clone(c)), vn = nw.ctx.iqOddVerifyExactlyOneOdd(cn);
              stat.pairs++;
              if (vo !== vn){
                if (key === 'ratio' && k !== 'clean' && vo && !vn && crowded(nw, cn)) stat.ratioOldAcceptsNewRejectsExplained++;
                else { stat.disagree++; stat.unexplained++; }
              }
              if (vn) stat.trueVerdicts++; else stat.falseVerdicts++;
              if (k === 'clean' && !vn) stat.cleanFalse++;
            }
          }
        }
      }
    }
    return { pass: stat.disagree === 0 && stat.cleanFalse === 0 && stat.falseVerdicts > 0 && stat.trueVerdicts > 0, info: JSON.stringify(stat) + ' (both verdict values occur, so the false path is exercised; the explained cases are the intended stricter crowding floor)' };
  });
  test('R3b symmetry INTENTIONAL differences, identified: the new verifier differs from the reference only by (1) the margin floor on the RENDERED geometry, (2) the rule that a normal is drawn symmetric about ONE axis only, and (3) the radius range; every new question is also valid under the old rule', () => {
    const { O: o, N: nw } = forcedPair('symmetry');
    // rendered margin of the odd shape, measured independently: the REFERENCE build draws it, the SVG is parsed, integer math
    const renderedOk = (build, it) => { const p = V.parseSvg(build.ctx.iqOddRenderItem(it)); return V.renderedMarginSq(p.polygons[0].pts, p.center) >= 2500; };
    // normals must be DRAWN symmetric about exactly one axis (reflection error <= 4 tenths-squared on the parsed SVG, all vertices)
    const drawnCount = (build, it) => { const p = V.parseSvg(build.ctx.iqOddRenderItem(it)); return Object.values(V.renderedAxisSq(p.polygons[0].pts, p.center)).filter(v => v <= 4).length; };
    const inRange = r => r.length === 8 && r.every(v => v >= 22 - 1e-9 && v <= 38 + 1e-9);
    const per = Math.min(n, 3000);
    const st = { oldQuestions: 0, rejectedByNew: 0, rejectedOnlyBySecondAxisRule: 0, verdictNotExplainedByTheTwoRules: 0, newQuestions: 0, newRejectedByOld: 0 };
    const byTier = {};
    for (let tier = 1; tier <= 6; tier++){
      o.seed(seed * 53 + tier); nw.seed(seed * 53 + tier);
      byTier[tier] = 0;
      for (let i = 0; i < per; i++){
        const a = clone(o.ctx.iqOddGenerate(tier));                       // generated by the REFERENCE
        st.oldQuestions++;
        const vn = nw.ctx.iqOddVerifyExactlyOneOdd(clone(a));
        const floorOk = renderedOk(o, a.items[a.oddIndex]) && a.items.every(it => inRange(it.radii));
        const oneAxis = a.items.every((it, k) => k === a.oddIndex || drawnCount(o, it) === 1);
        const expected = floorOk && oneAxis;
        if (!vn){ st.rejectedByNew++; byTier[tier]++; if (floorOk && !oneAxis) st.rejectedOnlyBySecondAxisRule++; }
        if (vn !== expected) st.verdictNotExplainedByTheTwoRules++;
        const b = clone(nw.ctx.iqOddGenerate(tier));                      // generated by the NEW code
        st.newQuestions++;
        if (!o.ctx.iqOddVerifyExactlyOneOdd(clone(b))) st.newRejectedByOld++;
      }
    }
    const shares = Object.entries(byTier).map(([t, c]) => 'tier ' + t + ' ' + (100 * c / per).toFixed(1) + '%').join(', ');
    return { pass: st.verdictNotExplainedByTheTwoRules === 0 && st.newRejectedByOld === 0, info: JSON.stringify(st) + ' | share of the reference\'s symmetry questions the new floor would reject: ' + shares };
  });

  // ---- R4: retry loop and failure message (forced to ratio so randomness stays comparable) ----
  test('R4 retry loop and failure behaviour identical (forced verifier failures, ratio family)', () => {
    const drive = (p, failFirst) => {
      let gens = 0, vcalls = 0;
      forceFamily(p, 'ratio');
      for (const nm of ['iqOddGenOrientation', 'iqOddGenRatio', 'iqOddGenSymmetry']){ const o = p.sandbox[nm]; p.sandbox[nm] = (...a) => { gens++; return o(...a); }; }
      p.sandbox.iqOddVerifyExactlyOneOdd = () => { vcalls++; return failFirst === Infinity ? false : vcalls > failFirst; };
      p.seed(555);
      let msg = null, res = null;
      try { res = p.ctx.iqOddGenerate(3); } catch (e){ msg = e.message; }
      return JSON.stringify({ gens, vcalls, msg, family: res && res.family, rng: nextRandom(p) });
    };
    const a1 = drive(H.loadProject({ ref }), Infinity), b1 = drive(plainBuild(), Infinity);
    const a2 = drive(H.loadProject({ ref }), 4), b2 = drive(plainBuild(), 4);
    return { pass: a1 === b1 && a2 === b2, info: 'always-fail: ' + b1 + ' | fail-4-then-pass: ' + b2 };
  });

  // ---- R5: progression, storage, level display, toasts ----
  test('R5 progression behaviour identical: storage, level display and toasts for several starting states', () => {
    const drive = p => {
      const cat = oddCat(p), recs = [];
      for (const start of [null, { tier: 5, streak: 3 }, { tier: 6, streak: 3 }, { tier: 2, streak: 0 }]){
        p.localStorage.clear();
        if (start) p.localStorage.setItem('iq_progress_v1', JSON.stringify({ oddone: start, other: { tier: 3, streak: 1 } }));
        for (const ans of [true, true, true, true, false, true, true, true, true, true, true, true, true, false]){
          p.ctx.handleIQAnswer(cat, ans);
          recs.push(p.localStorage.getItem('iq_progress_v1') + '|' + ['level-num', 'streak-label'].map(s => p.doc.getElementById('iq-oddone-' + s).textContent).join('|') + '|' + p.doc.getElementById('iq-oddone-streak-fill').style.width + '|' + p.doc.getElementById('iq-oddone-next-btn').className);
        }
      }
      return JSON.stringify({ recs, toasts: p.doc.body.children.map(c => c.textContent + '/' + c.style.background) });
    };
    const a = drive(O), b = drive(N);
    return { pass: a === b, info: 'compared ' + a.length + ' characters of recorded state' };
  });

  // ---- R6: scope of the change ----
  test('R6 scope: production changes since the reference are confined to the odd-one-out work (iq-visual.js oddone and analogies sections, iq-odd-core.js, iq-analogy-engine.js, the drawing margin in iq-shapes.js, the new iq-odd-*.js files, index.html script tags, one added iq.css block)', () => {
    const changed = git(['diff', '--name-only', ref]).split('\n').filter(Boolean).filter(f => !f.startsWith('_tests/'));
    const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean).filter(f => !f.startsWith('_tests/'));
    const allowedChanged = ['js/iq-visual.js', 'js/iq-odd-core.js', 'index.html', 'css/iq.css', 'js/iq-odd-basic.js', 'js/iq-odd-geo.js', 'js/iq-odd-motion.js', 'js/iq-odd-relation.js', 'js/iq-odd-assembly.js', 'js/iq-odd-combo.js', 'js/iq-odd-insight.js', 'js/iq-odd-logic.js', 'js/iq-analogy-engine.js', 'js/iq-shapes.js'], allowedNew = ['js/iq-odd-basic.js', 'js/iq-odd-geo.js', 'js/iq-odd-motion.js', 'js/iq-odd-relation.js', 'js/iq-odd-assembly.js', 'js/iq-odd-combo.js', 'js/iq-odd-insight.js', 'js/iq-odd-logic.js', 'js/iq-analogy-engine.js'];
    const okChanged = changed.every(f => allowedChanged.includes(f));
    const okNew = untracked.every(f => allowedNew.includes(f));
    // hunks of iq-visual.js must all fall inside the oddone section of the REFERENCE file
    const refLines = git(['show', ref + ':js/iq-visual.js']).split('\n');
    const start = refLines.findIndex(l => l.includes('Category: odd one out')) + 1;
    const end = refLines.findIndex(l => l.includes('Category: shape analogies')) ; // 1-based line of the marker minus 1
    const aStart = refLines.findIndex(l => l.includes('Category: shape analogies')) + 1, aEnd = refLines.findIndex(l => l.includes('Category: matrix completion'));   // the analogies section may change too
    const hunks = [...git(['diff', '-U0', ref, '--', 'js/iq-visual.js']).matchAll(/^@@ -(\d+)(?:,(\d+))? \+/gm)].map(m => [Number(m[1]), m[2] === undefined ? 1 : Number(m[2])]);
    const inside = (a, b, lo, hi) => (b === 0 ? a : a) >= lo && (b === 0 ? a : a + b - 1) <= hi;
    const outside = hunks.filter(([a, b]) => !inside(a, b, start, end) && !inside(a, b, aStart, aEnd));
    const htmlDiff = git(['diff', '-U0', ref, '--', 'index.html']).split('\n').filter(l => /^[+-][^+-]/.test(l));
    const okHtml = htmlDiff.length > 0 && htmlDiff.every(l => /^\+<script src="js\/iq-(?:odd-[a-z]+|analogy-engine)\.js"><\/script>$/.test(l));
    const cssDiff = git(['diff', '-U0', ref, '--', 'css/iq.css']).split('\n').filter(l => /^[+-][^+-]/.test(l));
    const okCss = cssDiff.every(l => l[0] === '+');                                                     // the stylesheet only gained lines
    const untouched = ['js/iq-core.js', 'js/core.js', 'js/iq-matrix3.js', 'js/iq-sequences.js'].filter(f => changed.includes(f));
    return { pass: okChanged && okNew && !outside.length && okHtml && okCss && !untouched.length,
      info: 'changed production files: ' + changed.join(', ') + ' | new production files: ' + untracked.join(', ') + ' | oddone section = reference lines ' + start + '-' + end + ', hunks outside it: ' + outside.length + ' | index.html: ' + htmlDiff.length + ' added script tags | iq.css only additions: ' + okCss };
  });

  // ---- R7: the new registry itself ----
  test('R7 registry: the three original families in the original order, all enabled from tier 1, followed by the newer families (parts, props, topology, stack, net) enabled from their own first tier and the four advanced families (motion, relation, assembly, combo) enabled from tier 4; bad registrations and unknown kinds throw', () => {
    const fams = N.evalIn('IQ_ODD_FAMILIES').map(f => f.key + ':' + f.minTier + ':' + f.enabled);
    const throwsOn = fn => { try { fn(); return false; } catch (e){ return true; } };
    const dupe = throwsOn(() => N.ctx.iqOddRegisterFamily({ key: 'ratio', generate(){}, verify(){}, render(){} }));
    const missing = throwsOn(() => N.ctx.iqOddRegisterFamily({ key: 'x', generate(){}, verify(){} }));
    const unknownKind = throwsOn(() => N.ctx.iqOddRenderItem({ kind: 'nope' }));
    const noKind = throwsOn(() => N.ctx.iqOddRenderItem({ sides: 3, dots: 2 }));
    const unknownFamily = throwsOn(() => N.ctx.iqOddVerifyExactlyOneOdd({ family: 'nope', items: [] }));
    const exp = ['orientation:1:true', 'ratio:1:true', 'symmetry:1:true', 'parts:1:true', 'props:3:true', 'topology:1:true', 'stack:4:true', 'net:4:true', 'basic:1:true', 'motion:4:true', 'relation:4:true', 'assembly:4:true', 'combo:4:true', 'solid:4:true', 'trace:3:true', 'overlay:4:true', 'balance:4:true', 'induce:5:true'];   // the families added after the reference (equal parts, properties, topology, stacking, networks), all switched OFF
    return { pass: JSON.stringify(fams) === JSON.stringify(exp) && dupe && missing && unknownKind && noKind && unknownFamily,
      info: fams.join(' ') + ' | duplicate/missing/unknown-kind/no-kind/unknown-family all throw: ' + [dupe, missing, unknownKind, noKind, unknownFamily] };
  });
  test('R8 tier gating and disabling: a disabled or higher-tier family is never picked', () => {
    const p = plainBuild();
    p.seed(9);
    const fams = p.evalIn('IQ_ODD_FAMILIES');
    fams.forEach(f => { if (!['orientation', 'ratio', 'symmetry'].includes(f.key)) f.enabled = false; });     // isolate the three original families
    fams.find(f => f.key === 'ratio').enabled = false;
    fams.find(f => f.key === 'symmetry').minTier = 4;
    const seen = t => { const s = new Set(); for (let i = 0; i < 400; i++) s.add(p.ctx.iqOddGenerate(t).family); return [...s].sort().join(','); };
    const low = seen(2), high = seen(5);
    fams.forEach(f => { f.enabled = false; });
    let threw = false; try { p.ctx.iqOddGenerate(1); } catch (e){ threw = /no enabled family/.test(e.message); }
    return { pass: low === 'orientation' && high === 'orientation,symmetry' && threw, info: 'tier 2 (ratio disabled, symmetry from tier 4): ' + low + ' | tier 5: ' + high + ' | none enabled -> clear error: ' + threw };
  });

  return out;
}

module.exports = { run, REF };
