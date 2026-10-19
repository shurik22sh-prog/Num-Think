'use strict';
// Usage:
//   node _tests/run.js selftest                      harness self-tests + positive controls + production-check injections
//   node _tests/run.js regression [--n=20000] [--seed=1] [--dom=300]
//                                                    working tree vs the frozen reference commit, same seed
//   node _tests/run.js variants                      variant-level gating (registration, picker, result-contract guard, default-state guard)
//   node _tests/run.js symmetry [--n=20000] [--seed=1]
//                                                    focused tests of the symmetry family (floor, axes, explanations, cues, acceptance)
//   node _tests/run.js ratio                         focused tests of the ratio family's variants (exhaustive structure space, placement, row-count filter, shortcuts)
//   node _tests/run.js orientation                   focused tests of the orientation cell-shape variants (library, chirality, area difference, tier gating)
//   node _tests/run.js props                         focused tests of the property-classification family (unambiguous properties, equal areas, audit)
//   node _tests/run.js topology                      focused tests of the topology family (closed holes in cell figures, broken vs connected bead chains)
//   node _tests/run.js stack                         focused tests of the stacking-order family (overlaps, visibility, neighbouring-layer swap)
//   node _tests/run.js net                           focused tests of the network family (ring vs ring-with-stub, same links in different layouts)
//   node _tests/run.js advanced                      focused tests of the four advanced families (motion, relation, assembly, combo): rules re-derived from the data, SVG sanity, tier gating, must-reject fixtures
//   node _tests/run.js insight                       focused tests of the cube-views and one-stroke families (rules re-derived from the rendered SVG, level gating, must-reject fixtures)
//   node _tests/run.js logic                         focused tests of the overlay, balance and induce families (rules re-derived from the rendered SVG, level gating, must-reject fixtures)
//   node _tests/run.js analogy                       focused tests of the upgraded shape-analogies game (rule library rebuilt independently, every question checked, renderer, level gating)
//   node _tests/run.js baseline [--n=20000] [--seed=1] [--dom=300]
//                                                    measure the real game and COMPARE with the stored baseline
//   node _tests/run.js all                           selftest, regression, variants, symmetry, ratio, then baseline (the normal full run)
//   add --update-baseline to (re)write _tests/baseline/oddone-baseline.json. Nothing else ever writes it.
// Exit code is non-zero if any self-test fails, the baseline finds a hard failure, or the
// measurement differs from the stored baseline.

const args = process.argv.slice(2);
const cmd = args[0] || 'all';
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const n = Number(opt('n') || 20000), seed = Number(opt('seed') || 1), domN = Number(opt('dom') || 300);
const update = args.includes('--update-baseline');
let failed = false;
const summary = [];

function printSelftest(){
  const S = require('./suites/selftest').run();
  console.log('\n=== SELF-TESTS ===');
  for (const t of S.tests){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  console.log('\n=== CURRENT PRODUCTION VERIFIER ON THE SAME BAD QUESTIONS (information) ===');
  for (const r of S.productionAgreement)
    console.log((r.agrees ? 'agrees   ' : 'DIFFERS  ') + r.name + '  -> production says ' + r.productionVerdict + ', correct verdict is ' + r.expectedVerdict);
  console.log('(ratio placement faults are exercised by tests P-RAT-1..4 above, which patch the layout inside the sandbox)');
  const passed = S.tests.filter(t => t.pass).length;
  summary.push('selftest: ' + passed + '/' + S.tests.length + ' passed' + (passed === S.tests.length ? '' : '  <-- FAILURES'));
}

function printRegression(){
  const R = require('./suites/regression');
  const res = R.run({ n, seed, domN });
  console.log('\n=== REGRESSION vs reference commit ' + R.REF + ' (same seed, both builds unmodified) ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('regression: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printVariants(){
  const S = require('./suites/variants');
  const res = S.run();
  console.log('\n=== VARIANT GATING ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('variants: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printSymmetry(){
  const S = require('./suites/symmetry');
  const res = S.run({ n, seed });
  console.log('\n=== SYMMETRY FAMILY ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('symmetry: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printRatio(){
  const S = require('./suites/ratio');
  const res = S.run();
  console.log('\n=== RATIO FAMILY (variants) ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('ratio: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printOrientation(){
  const S = require('./suites/orientation');
  const res = S.run();
  console.log('\n=== ORIENTATION CELL VARIANTS ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('orientation: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printParts(){
  const S = require('./suites/parts');
  const res = S.run();
  console.log('\n=== EQUAL PARTS FAMILY ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('parts: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printProps(){
  const S = require('./suites/props');
  const res = S.run();
  console.log('\n=== PROPERTY CLASSIFICATION FAMILY ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('props: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printTopology(){
  const S = require('./suites/topology');
  const res = S.run();
  console.log('\n=== TOPOLOGY FAMILY (holes, chains) ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('topology: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printStack(){
  const S = require('./suites/stack');
  const res = S.run();
  console.log('\n=== STACKING ORDER FAMILY ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('stack: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printNet(){
  const S = require('./suites/net');
  const res = S.run();
  console.log('\n=== NETWORK FAMILY ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('net: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printAdvanced(){
  const S = require('./suites/advanced');
  const res = S.run();
  console.log('\n=== ADVANCED FAMILY ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('advanced: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printInsight(){
  const S = require('./suites/insight');
  const res = S.run();
  console.log('\n=== INSIGHT FAMILIES ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('insight: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printLogic(){
  const S = require('./suites/logic');
  const res = S.run();
  console.log('\n=== LOGIC FAMILIES ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('logic: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printAnalogy(){
  const S = require('./suites/analogy');
  const res = S.run();
  console.log('\n=== SHAPE ANALOGIES ===');
  for (const t of res){
    console.log((t.pass ? 'PASS ' : 'FAIL ') + t.name + (t.info ? '\n       ' + t.info : ''));
    if (!t.pass) failed = true;
  }
  const passed = res.filter(t => t.pass).length;
  summary.push('analogy: ' + passed + '/' + res.length + ' passed' + (passed === res.length ? '' : '  <-- FAILURES'));
}

function printBaseline(){
  const B = require('./suites/baseline');
  const report = B.run({ n, seed, domN });
  console.log('\n=== BASELINE (real current code) ===');
  console.log('git HEAD ' + report.meta.gitHead + ' | production files modified: ' + (report.meta.productionFilesModified.length ? report.meta.productionFilesModified.join(', ') : 'none'));
  console.log('seed ' + seed + ', ' + n + ' questions per tier, ' + domN + ' DOM-path questions per tier, elapsed ' + report._elapsedSecondsNotSaved + 's');
  let hardTotal = 0;
  for (const [tier, T] of Object.entries(report.generation)){
    const fc = T.familyCounts;
    console.log('\n-- tier ' + tier + ': ' + T.questions + ' questions, throws ' + T.throws + ', schema failures ' + T.schemaFailures + ', family-inference mismatches ' + T.familyInferenceMismatch);
    console.log('   families ' + JSON.stringify(fc) + ' | attempts mean ' + T.generationAttempts.mean + ' max ' + T.generationAttempts.max + ' hist ' + JSON.stringify(T.generationAttempts.histogram));
    console.log('   independent check failures ' + JSON.stringify(T.independentFailures));
    console.log('   orientation: ' + T.orientation.distinctStructures + ' structures ' + JSON.stringify(T.orientation.structureCounts) + ' | min XOR/area ' + T.orientation.minXorOverArea + ' (below floor: ' + T.orientation.xorBelowFloor + ') | odd-not-mirror ' + T.orientation.oddNotMirrorOfOthers);
    console.log('   ratio: ' + T.ratio.distinctStructures + ' structures | min dot clearance ' + T.ratio.minDotClearanceUnits + 'u (below 2.5u floor: ' + T.ratio.optionsBelowClearanceFloor + ', outside polygon: ' + T.ratio.dotsOutsidePolygon + ') | min dot gap ' + T.ratio.minDotGapBetweenDotsUnits + 'u | dot radius ' + JSON.stringify(T.ratio.minDotRadiusPx) + 'px');
    const s = T.symmetry;
    console.log('   symmetry: normal axes ' + JSON.stringify(s.normalAxisHistogram) + ' | odd with any axis ' + s.oddWithAnySymmetryAxis + ' | normals max dev ' + s.maxDeviationOfNormalsOnBestAxisUnits + 'u');
    console.log('      odd margin (units) ' + JSON.stringify(s.oddMarginUnits) + ' | phone px p1/median ' + s.oddMarginPx_phone.p1 + '/' + s.oddMarginPx_phone.median + ' | % below 2/3/4/6 units: ' + [2, 3, 4, 6].map(b => s.oddMarginBelowThreshold['below_' + b + '_units_pct']).join('/'));
    if (T.independentFailureExamples.length) console.log('   FAILURE EXAMPLES ' + JSON.stringify(T.independentFailureExamples));
    hardTotal += T.throws + T.schemaFailures + T.familyInferenceMismatch + T.independentFailures.orientation + T.independentFailures.ratio + T.independentFailures.symmetry + T.ratio.dotsOutsidePolygon + T.ratio.optionsBelowClearanceFloor;
  }
  console.log('\n-- DOM path (askIQQuestion -> renderQuestion -> click) on a FAKE DOM --');
  let domBad = 0;
  for (const [tier, R] of Object.entries(report.dom)){
    console.log('   tier ' + tier + ': ' + JSON.stringify(R));
    if (R.errors || R.exactlyOneCorrect !== R.questions || R.correctMatchesGeneratorOdd !== R.questions || R.buttons4 !== R.questions || R.optionMultisetMatches !== R.questions || R.explanationShown !== R.questions) domBad++;
  }
  console.log('\n-- progression (real iq-core.js) --');
  console.log(JSON.stringify(report.progression));

  if (hardTotal || domBad) failed = true;
  summary.push('baseline hard checks: ' + (hardTotal || domBad ? 'FAILURES (generation ' + hardTotal + ', DOM tiers ' + domBad + ')' : 'none failed (' + (6 * n) + ' questions + ' + (6 * domN) + ' DOM-path questions)'));

  if (update){
    B.save(report);
    summary.push('baseline file: REWRITTEN (--update-baseline given)');
  } else {
    const c = B.compare(report);
    console.log('\n-- comparison with stored baseline: ' + c.status.toUpperCase() + ' --');
    c.diffs.forEach(d => console.log('   ' + d));
    if (c.changedScripts && c.changedScripts.length) console.log('   (script hashes differ from the stored run: ' + c.changedScripts.join(', ') + ')');
    if (c.status === 'differs' || c.status === 'missing') failed = true;
    summary.push('baseline file: not rewritten; comparison with stored baseline = ' + c.status);
  }
}

if (cmd === 'selftest' || cmd === 'all') printSelftest();
if (cmd === 'regression' || cmd === 'all') printRegression();
if (cmd === 'variants' || cmd === 'all') printVariants();
if (cmd === 'symmetry' || cmd === 'all') printSymmetry();
if (cmd === 'ratio' || cmd === 'all') printRatio();
if (cmd === 'orientation' || cmd === 'all') printOrientation();
if (cmd === 'parts' || cmd === 'all') printParts();
if (cmd === 'props' || cmd === 'all') printProps();
if (cmd === 'topology' || cmd === 'all') printTopology();
if (cmd === 'stack' || cmd === 'all') printStack();
if (cmd === 'net' || cmd === 'all') printNet();
if (cmd === 'advanced' || cmd === 'all') printAdvanced();
if (cmd === 'insight' || cmd === 'all') printInsight();
if (cmd === 'logic' || cmd === 'all') printLogic();
if (cmd === 'analogy' || cmd === 'all') printAnalogy();
if (cmd === 'baseline' || cmd === 'all') printBaseline();
if (!['selftest', 'regression', 'variants', 'symmetry', 'ratio', 'orientation', 'parts', 'props', 'topology', 'stack', 'net', 'advanced', 'insight', 'logic', 'analogy', 'baseline', 'all'].includes(cmd)){ console.log('unknown command ' + cmd); failed = true; }

console.log('\n=== SUMMARY (' + cmd + ') ===');
summary.forEach(s => console.log(s));
console.log('NOT COVERED by any test here: CSS, the real option-tile size, SVG rendering in a browser, touch input, or how anything looks on a phone.');
console.log('The DOM layer is a fake. Visual legibility stays a MANUAL review gate (contact sheets at 375px and desktop).');
console.log('RESULT: ' + (failed ? 'FAILURES PRESENT (see FAIL / FAILURE / differs lines above)' : 'no failures'));
process.exit(failed ? 1 : 0);
