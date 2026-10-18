'use strict';
// Baseline of the CURRENT oddone game, measured on the real production code
// (working tree, all 9 scripts, unmodified) and checked with the independent
// verifiers. Writes _tests/baseline/oddone-baseline.json (deterministic: seeded,
// no timestamps). This is a record of today's behaviour, not a pass/fail gate
// for quality: it reports facts, and flags only hard contradictions.

const fs = require('fs');
const path = require('path');
const H = require('../harness');
const V = require('../verify');

const FLAG = [[-24, -24], [24, -24], [24, 14], [2, 14], [2, 24], [-24, 24]]; // test-side copy (drift-checked in selftest H8)
const GAP_FLOOR = 2.5;   // independent clearance floor (production builds exactly 3 units; 0.5 slack for 0.1 rounding)
const XOR_FLOOR = 0.19;  // 90% of the 0.21 the accepted flag achieves (report-only)
const MARGIN_BINS = [2, 3, 4, 6]; // symmetry-margin thresholds reported, in SVG units

const q = (arr, p) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const r4 = v => (v === null || v === undefined || !isFinite(v) ? v : Math.round(v * 10000) / 10000);
const inc = (o, k, by) => { o[k] = (o[k] || 0) + (by === undefined ? 1 : by); };

function orientationTokens(polys, c){
  // absolute pose of each option relative to the (test-side) base flag, derived from the picture
  const xs = polys[0].map(p => p[0]), scale = (Math.max(...xs) - Math.min(...xs)) / 48;
  const base = FLAG.map(([x, y]) => [c[0] + x * scale, c[1] + y * scale]);
  return polys.map(P => {
    for (let k = 0; k < 4; k++) if (V.samePolygon(V.rot90(base, k, c), P, 0.3)) return 'R' + k;
    const mb = V.mirrorX(base, c);
    for (let k = 0; k < 4; k++) if (V.samePolygon(V.rot90(mb, k, c), P, 0.3)) return 'M' + k;
    return 'X';
  });
}

function newTier(){
  return { questions: 0, throws: 0, throwMessages: {}, families: {}, otherVariants: {}, attempts: {}, schemaFailures: 0, familyMismatch: 0,
    independentFailures: { orientation: 0, ratio: 0, symmetry: 0 }, independentFailureExamples: [],
    orientation: { n: 0, keys: {}, xorBelowFloor: 0, minXor: null, minEdgeUnits: null, notMirror: 0 },
    ratio: { n: 0, keys: {}, minClear: null, minSpacing: null, clearBelowFloor: 0, notInside: 0, minDotRadiusUnits: null, minEdgeUnits: null },
    symmetry: { n: 0, normalAxes: {}, oddAxesNonEmpty: 0, margins: [], maxNormalDeviation: 0, minEdgeUnits: null } };
}

function runGeneration(p, n, seed){
  const counter = { attempts: 0 };
  for (const name of ['iqOddGenOrientation', 'iqOddGenRatio', 'iqOddGenSymmetry']){
    const orig = p.sandbox[name];
    p.sandbox[name] = (...a) => { counter.attempts++; return orig(...a); };
  }
  const out = {};
  const xorCache = {};
  for (let tier = 1; tier <= 6; tier++){
    const T = newTier(); out[tier] = T;
    p.seed(seed * 1000 + tier);
    for (let i = 0; i < n; i++){
      counter.attempts = 0;
      let res;
      try { res = p.ctx.iqOddGenerate(tier); }
      catch (e){ T.throws++; inc(T.throwMessages, String(e.message).slice(0, 90)); continue; }
      T.questions++; inc(T.families, res.family); if (counter.attempts > 0) inc(T.attempts, counter.attempts);
      // The detailed independent analysis below is for the three ORIGINAL designs (flag, ring dots, symmetry). The later designs have
      // their own focused suites (ratio, orientation, parts, props, topology, stack, net); here they are counted per variant and only
      // checked for the generic schema and a renderable, well-formed picture, so a new family cannot silently break the shared path.
      const original = res.family === 'symmetry' || res.variant === 'flag' || res.variant === 'sides-minus-1-ring';
      let parsed;
      try {
        if (!Array.isArray(res.items) || res.items.length !== 4) throw new Error('items');
        if (!(res.oddIndex >= 0 && res.oddIndex <= 3)) throw new Error('oddIndex');
        if (typeof res.explanation !== 'string' || !res.explanation.trim()) throw new Error('explanation');
        const svgs = res.items.map(it => p.ctx.iqOddRenderItem(it));
        if (svgs.some(sv => typeof sv !== 'string' || !/^<svg /.test(sv) || /NaN|undefined|Infinity/.test(sv))) throw new Error('svg');
        if (original) parsed = svgs.map(sv => V.parseSvg(sv));
      } catch (e){ T.schemaFailures++; continue; }
      if (!original){ inc(T.otherVariants, res.family + '/' + res.variant); continue; }
      const fam = V.inferFamily(parsed);
      if (fam !== res.family){ T.familyMismatch++; continue; }

      if (fam === 'orientation'){
        const a = V.orientationAnalysis(parsed), O = T.orientation; O.n++;
        const ok = a.unique && a.oddIndex === res.oddIndex && a.oddIsMirrorOfMajority;
        if (!a.oddIsMirrorOfMajority) O.notMirror++;
        const tokens = orientationTokens(a.polys, parsed[0].center);
        const key = tokens.slice().sort().join(' ');
        inc(O.keys, key);
        if (!(key in xorCache)) xorCache[key] = V.orientationMinXor(a.polys);
        const x = xorCache[key];
        O.minXor = O.minXor === null ? x : Math.min(O.minXor, x);
        if (x < XOR_FLOOR) O.xorBelowFloor++;
        for (const pa of parsed){ const fs_ = V.featureSizes(pa); O.minEdgeUnits = O.minEdgeUnits === null ? fs_.minEdgeUnits : Math.min(O.minEdgeUnits, fs_.minEdgeUnits); }
        if (!ok){ T.independentFailures.orientation++; if (T.independentFailureExamples.length < 3) T.independentFailureExamples.push({ family: fam, sizes: a.sizes }); }
      } else if (fam === 'ratio'){
        const a = V.ratioAnalysis(parsed), R = T.ratio; R.n++;
        const ok = a.unique && a.oddIndex === res.oddIndex;
        inc(R.keys, a.items.map(it => it.sides + ':' + it.dots).sort().join(' '));
        for (const it of a.items){
          if (it.dots){
            R.minClear = R.minClear === null ? it.minClear : Math.min(R.minClear, it.minClear);
            if (it.minClear < GAP_FLOOR) R.clearBelowFloor++;
            if (!it.allInside) R.notInside++;
            R.minDotRadiusUnits = R.minDotRadiusUnits === null ? it.minR : Math.min(R.minDotRadiusUnits, it.minR);
          }
          if (it.dots > 1) R.minSpacing = R.minSpacing === null ? it.minSpacing : Math.min(R.minSpacing, it.minSpacing);
        }
        for (const pa of parsed){ const fs_ = V.featureSizes(pa); R.minEdgeUnits = R.minEdgeUnits === null ? fs_.minEdgeUnits : Math.min(R.minEdgeUnits, fs_.minEdgeUnits); }
        if (!ok){ T.independentFailures.ratio++; if (T.independentFailureExamples.length < 3) T.independentFailureExamples.push({ family: fam, items: a.items.map(it => [it.sides, it.dots]) }); }
      } else {
        const a = V.symmetryAnalysis(parsed), S = T.symmetry; S.n++;
        const ok = a.unique && a.oddIndex === res.oddIndex;
        a.items.forEach((it, i) => {
          if (i === res.oddIndex){ if (it.axes.length) S.oddAxesNonEmpty++; S.margins.push(it.margin); }
          else { inc(S.normalAxes, it.axes.join('+') || 'none'); S.maxNormalDeviation = Math.max(S.maxNormalDeviation, it.margin); }
        });
        for (const pa of parsed){ const fs_ = V.featureSizes(pa); S.minEdgeUnits = S.minEdgeUnits === null ? fs_.minEdgeUnits : Math.min(S.minEdgeUnits, fs_.minEdgeUnits); }
        if (!ok){ T.independentFailures.symmetry++; if (T.independentFailureExamples.length < 3) T.independentFailureExamples.push({ family: fam, axes: a.items.map(it => it.axes) }); }
      }
    }
  }
  return out;
}

function summarise(raw){
  const out = {};
  for (const [tier, T] of Object.entries(raw)){
    const S = T.symmetry, O = T.orientation, R = T.ratio;
    const att = T.attempts, total = Object.values(att).reduce((a, b) => a + b, 0);
    const meanAtt = Object.entries(att).reduce((a, [k, v]) => a + k * v, 0) / Math.max(1, total);
    const px = u => ({ phone: r4(u * V.PX.phone / 100), desktop: r4(u * V.PX.desktop / 100) });
    const marginPct = {};
    for (const b of MARGIN_BINS) marginPct['below_' + b + '_units_pct'] = r4(100 * S.margins.filter(m => m < b).length / Math.max(1, S.margins.length));
    out[tier] = {
      questions: T.questions, throws: T.throws, throwMessages: T.throwMessages, familyCounts: T.families, laterVariantCounts: T.otherVariants,
      generationAttempts: { histogram: att, mean: r4(meanAtt), max: Math.max(0, ...Object.keys(att).map(Number)) },
      schemaFailures: T.schemaFailures, familyInferenceMismatch: T.familyMismatch,
      independentFailures: T.independentFailures, independentFailureExamples: T.independentFailureExamples,
      orientation: { n: O.n, distinctStructures: Object.keys(O.keys).length, structureCounts: O.keys, minXorOverArea: r4(O.minXor), xorBelowFloor: O.xorBelowFloor, oddNotMirrorOfOthers: O.notMirror, minEdgePx: px(O.minEdgeUnits || 0) },
      ratio: { n: R.n, distinctStructures: Object.keys(R.keys).length, minDotClearanceUnits: r4(R.minClear), optionsBelowClearanceFloor: R.clearBelowFloor, dotsOutsidePolygon: R.notInside, minDotGapBetweenDotsUnits: r4(R.minSpacing), minDotRadiusPx: px(R.minDotRadiusUnits || 0), minEdgePx: px(R.minEdgeUnits || 0) },
      symmetry: { n: S.n, normalAxisHistogram: S.normalAxes, oddWithAnySymmetryAxis: S.oddAxesNonEmpty, maxDeviationOfNormalsOnBestAxisUnits: r4(S.maxNormalDeviation),
        oddMarginUnits: { p1: r4(q(S.margins, .01)), p10: r4(q(S.margins, .1)), median: r4(q(S.margins, .5)), p90: r4(q(S.margins, .9)) },
        oddMarginPx_phone: { p1: r4((q(S.margins, .01) || 0) * 0.432), median: r4((q(S.margins, .5) || 0) * 0.432) },
        oddMarginBelowThreshold: marginPct, minEdgePx: px(S.minEdgeUnits || 0) }
    };
  }
  return out;
}

// ---------- DOM-level smoke through the real renderQuestion / click path ----------
function runDom(nPerTier, seed){
  const p = H.loadProject(); p.seed(seed);
  const cat = p.evalIn('IQ_CATEGORIES').find(c => c.key === 'oddone');
  let last = null;
  const orig = p.sandbox.iqOddGenerate;
  p.sandbox.iqOddGenerate = t => { last = orig(t); return last; };
  const res = {};
  for (let tier = 1; tier <= 6; tier++){
    const R = { questions: 0, buttons4: 0, exactlyOneCorrect: 0, correctMatchesGeneratorOdd: 0, optionMultisetMatches: 0, explanationShown: 0, explanationHiddenBefore: 0, promptOk: 0, errors: 0 };
    for (let i = 0; i < nPerTier; i++){
      try {
        p.localStorage.setItem('iq_progress_v1', JSON.stringify({ oddone: { tier, streak: 0 } }));
        p.ctx.askIQQuestion(cat);
        const opts = p.doc.getElementById('iq-oddone-options'), expl = p.doc.getElementById('iq-oddone-explanation');
        R.questions++;
        if (opts.children.length === 4) R.buttons4++;
        if (p.doc.getElementById('iq-oddone-prompt').innerHTML.includes('איזו צורה שונה מהשאר?')) R.promptOk++;
        if (expl.textContent === '') R.explanationHiddenBefore++;
        const btns = opts.children.slice();
        for (const b of btns){ b.click(); if (b.classSet.has('correct')) break; }
        const correct = btns.filter(b => b.classSet.has('correct'));
        if (correct.length === 1) R.exactlyOneCorrect++;
        const expected = last.items.map(it => p.ctx.iqOddRenderItem(it));
        if (correct.length === 1 && correct[0].innerHTML === expected[last.oddIndex]) R.correctMatchesGeneratorOdd++;
        if (btns.map(b => b.innerHTML).sort().join('\n') === expected.slice().sort().join('\n')) R.optionMultisetMatches++;
        if (expl.textContent === last.explanation) R.explanationShown++;
        p.flushTimers();
      } catch (e){ R.errors++; if (R.errors === 1) R.firstError = String(e.stack).split('\n').slice(0, 2).join(' | '); }
    }
    res[tier] = R;
  }
  return res;
}

// ---------- progression (saved-state) behaviour of the real iq-core.js ----------
function runProgression(seed){
  const p = H.loadProject(); p.seed(seed);
  const cat = p.evalIn('IQ_CATEGORIES').find(c => c.key === 'oddone');
  const load = () => p.ctx.loadIQProgress('oddone');
  const snap = () => { const s = load(); return s.tier + '/' + s.streak; };
  const res = { maxTier: cat.maxTier, levelUpStreak: p.evalIn('LEVEL_UP_STREAK') };
  p.localStorage.clear();
  res.fresh = snap();
  const seq = [];
  for (let i = 0; i < 26; i++){ p.ctx.handleIQAnswer(cat, true); seq.push(snap()); }
  res.twentySixCorrectFromFresh = seq.join(' ');
  p.ctx.handleIQAnswer(cat, false); res.afterWrong = snap();
  p.localStorage.setItem('iq_progress_v1', JSON.stringify({ oddone: { tier: cat.maxTier, streak: 3 } }));
  p.ctx.handleIQAnswer(cat, true); res.atMaxTierAfterCorrectAtStreak3 = snap();
  p.localStorage.setItem('iq_progress_v1', '{broken'); res.corruptStorage = snap();
  p.localStorage.setItem('iq_progress_v1', JSON.stringify({ other: { tier: 4, streak: 1 } })); res.missingOddoneKey = snap();
  p.localStorage.setItem('iq_progress_v1', JSON.stringify({ oddone: { tier: 4, streak: 2 }, other: { tier: 3, streak: 1 } }));
  p.ctx.handleIQAnswer(cat, true); res.otherCategoriesUntouched = JSON.stringify(JSON.parse(p.localStorage.getItem('iq_progress_v1')));
  return res;
}

function run(opts){
  const n = opts.n, seed = opts.seed;
  const p = H.loadProject();
  const g = H.gitInfo();
  const t0 = Date.now();
  const generation = summarise(runGeneration(p, n, seed));
  const dom = runDom(opts.domN, seed + 1);
  const progression = runProgression(seed + 2);
  const report = {
    meta: { node: process.version, seed, questionsPerTier: n, domQuestionsPerTier: opts.domN, gitHead: g.head, productionFilesModified: g.productionDirty, scripts: p.sha,
      floors: { clearanceUnits: GAP_FLOOR, xorOverArea: XOR_FLOOR, note: 'report thresholds, not selected product thresholds' } },
    generation, dom, progression
  };
  report._elapsedSecondsNotSaved = Math.round((Date.now() - t0) / 100) / 10;
  return report;
}

const FILE = path.join(H.ROOT, '_tests', 'baseline', 'oddone-baseline.json');

// Only an explicit --update-baseline writes the file.
function save(report){
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const copy = Object.assign({}, report); delete copy._elapsedSecondsNotSaved;
  fs.writeFileSync(FILE, JSON.stringify(copy, null, 1) + '\n');
}

function deepDiff(a, b, p, out){
  if (out.length >= 15) return;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null){
    if (a !== b) out.push(p + ': stored ' + JSON.stringify(a) + ' -> now ' + JSON.stringify(b));
    return;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) deepDiff(a[k], b[k], p + '/' + k, out);
}

// A normal run COMPARES the fresh measurement with the stored one and never rewrites it.
// Compared: generation, dom, progression. Not compared: meta (git head / script hashes / floors),
// which legitimately change whenever production files change.
function compare(report){
  if (!fs.existsSync(FILE)) return { status: 'missing', diffs: ['no stored baseline at ' + FILE + ' (create it with --update-baseline)'] };
  const stored = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const sm = stored.meta;
  if (sm.seed !== report.meta.seed || sm.questionsPerTier !== report.meta.questionsPerTier || sm.domQuestionsPerTier !== report.meta.domQuestionsPerTier)
    return { status: 'not-comparable', diffs: ['stored baseline used seed ' + sm.seed + ', n ' + sm.questionsPerTier + ', dom ' + sm.domQuestionsPerTier + '; this run differs, so nothing was compared'] };
  const diffs = [];
  for (const section of ['generation', 'dom', 'progression']) deepDiff(stored[section], JSON.parse(JSON.stringify(report[section])), section, diffs);
  const changedScripts = Object.keys(report.meta.scripts).filter(s => stored.meta.scripts[s] !== report.meta.scripts[s]);
  return { status: diffs.length ? 'differs' : 'identical', diffs, changedScripts };
}

module.exports = { run, save, compare, FILE };
