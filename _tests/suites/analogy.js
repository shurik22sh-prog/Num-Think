'use strict';
// Focused tests of the upgraded shape-analogies game (rule-library engine + the nine older mechanics).
// The rules are rebuilt HERE with test-side code (their own step functions and their own enumeration of the library) and every
// generated question is checked against them:
//   - the library has 167 rules in "arrow" questions and 77 in "shapes" questions (counted independently);
//   - classic: A' and B' follow the rule; every rule that fits the example gives the same answer for B (or none);
//   - two-examples: neither example alone is enough, both together give one answer, and the natural wrong answers (what one example alone suggests) appear;
//   - pair-odd: four of the five pairs fit one rule, all five fit none, and leaving out any other pair does not help;
//   - three wrong answers per question, all different from the right answer and each other AS DRAWN (shape, colour, number, size, direction);
//   - the real question renderer (fake DOM) draws 4 options of which exactly one is correct and shows the rule after a correct answer;
//   - level gating (steps per level, derived directions, new designs), the older mechanics stay in the pool, no repeats in a row.

const H = require('../harness');
const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.ANALOGY_SAMPLE_SCALE || 1);
const N = Math.max(80, Math.round(600 * SCALE));

// ----- test-side rule library -----
const ORDER = ['count', 'shape', 'colour', 'size', 'rot'];
const OPS = { count: ['+1', '+2', 'x2', '-1', 'half'], shape: ['+1', '-1'], colour: ['pair', 'skip2'], size: ['flip'], rot: ['+90', '-90', '+45', '+135', 'byCount', 'mod3'] };
function stepValue(attr, op, st){
  switch (attr){
    case 'count': { const c = st.count; const n = { '+1': c + 1, '+2': c + 2, 'x2': c * 2, '-1': c - 1, 'half': c % 2 ? -1 : c / 2 }[op]; return n >= 1 && n <= 6 ? n : null; }
    case 'shape': return (st.shape + { '+1': 1, '-1': 2 }[op]) % 3;
    case 'colour': return op === 'pair' ? (st.colour % 2 ? st.colour - 1 : st.colour + 1) : (st.colour + 2) % 4;
    case 'size': return st.size ? 0 : 1;
    default: return op === 'byCount' ? st.count % 8 : op === 'mod3' ? 2 * ((st.count % 3) + 1) : (st.rot + { '+90': 2, '-90': 6, '+45': 1, '+135': 3 }[op]) % 8;
  }
}
const apply = (rule, st) => { const o = Object.assign({}, st); for (const [a, op] of rule){ const v = stepValue(a, op, o); if (v === null) return null; o[a] = v; } return o; };
function library(mode){
  const attrs = ORDER.filter(a => (mode === 'arrow' ? a !== 'shape' : a !== 'rot')), rules = [];
  const sub = (from, chosen) => { if (chosen.length >= 2) rules.push(chosen); if (chosen.length === 3) return; for (let i = from; i < attrs.length; i++) for (const op of OPS[attrs[i]]){ if ((op === 'byCount' || op === 'mod3') && !chosen.some(s => s[0] === 'count')) continue; sub(i + 1, chosen.concat([[attrs[i], op]])); } };
  sub(0, []);
  return rules;
}
const LIB = { arrow: library('arrow'), shapes: library('shapes') };
const same = (a, b) => a && b && ORDER.every(k => a[k] === b[k]);
const fits = (lib, pairs) => lib.filter(r => pairs.every(([a, b]) => same(apply(r, a), b)));
const ruleKey = r => r.map(s => s.join(' ')).join(' | ');
// what the child sees
const look = (ctx, st) => JSON.stringify([ctx.mode === 'arrow' ? 'arrow' : ctx.shapes[st.shape], ctx.colours[st.colour], st.count, st.size, ctx.mode === 'arrow' ? st.rot * 45 : 0]);
const pickDesign = (p, key, tier) => p.evalIn('IQ_AN_DESIGNS').find(d => d.key === key).make(tier);
const asRule = r => r.map(s => s.slice());

function checkQuestion(q){
  const e = [], lib = LIB[q.ctx.mode], rule = asRule(q.rule);
  if (!lib.some(r => ruleKey(r) === ruleKey(rule))) e.push('the rule is not in the library');
  if (q.ctx.colours.length !== 4 || new Set(q.ctx.colours).size !== 4 || q.ctx.shapes.length !== 3 || new Set(q.ctx.shapes).size !== 3) e.push('palette');
  const sees = st => look(q.ctx, st);
  if (q.design === 'classic' || q.design === 'two-examples'){
    if (!same(apply(rule, q.A), q.A2)) e.push("A' is not the rule applied to A");
    if (!same(apply(rule, q.B), q.B2)) e.push("B' is not the rule applied to B");
    const exs = q.design === 'classic' ? [[q.A, q.A2]] : [[q.A, q.A2], [q.C, q.C2]];
    if (q.design === 'two-examples' && !same(apply(rule, q.C), q.C2)) e.push("C' is not the rule applied to C");
    const f = fits(lib, exs);
    if (!f.some(r => ruleKey(r) === ruleKey(rule))) e.push('the rule does not fit its own examples');
    f.forEach(r => { const o = apply(r, q.B); if (o && sees(o) !== sees(q.B2)) e.push('a rule that fits the examples gives another answer for B: ' + ruleKey(r)); });
    if (q.design === 'two-examples'){
      if (fits(lib, [exs[0]]).length < 2 || fits(lib, [exs[1]]).length < 2) e.push('an example alone is already enough');
      const nat = new Set(fits(lib, [exs[0]]).concat(fits(lib, [exs[1]])).filter(r => !f.includes(r)).map(r => apply(r, q.B)).filter(Boolean).map(sees));
      if (!q.wrong.some(w => nat.has(sees(w)))) e.push('no wrong answer is what one example alone would suggest');
    }
    const shown = [q.B2].concat(q.wrong).map(sees);
    if (q.wrong.length !== 3 || new Set(shown).size !== 4) e.push('the four answers are not four different pictures');
    if (sees(q.A) === sees(q.A2) || sees(q.B) === sees(q.B2)) e.push('a shape does not change');
    if (new Set([sees(q.A), sees(q.B)]).size !== 2) e.push('A and B look alike');
  } else {
    const E = [q.E, q.E2], pairs = q.pairs;
    if (!same(apply(rule, q.E), q.E2)) e.push('the example does not follow the rule');
    const allPairs = [E].concat(pairs), without = i => allPairs.filter((_, j) => j !== i + 1);
    pairs.forEach((p, i) => { const follows = same(apply(rule, p[0]), p[1]); if (follows === (i === q.oddIndex)) e.push('pair ' + i + (follows ? ' follows' : ' breaks') + ' the rule'); });
    if (!fits(lib, without(q.oddIndex)).length) e.push('the other four pairs do not fit one rule');
    if (fits(lib, allPairs).length) e.push('all five pairs fit one rule');
    [0, 1, 2, 3].filter(i => i !== q.oddIndex).forEach(i => { if (fits(lib, without(i)).length) e.push('leaving out pair ' + i + ' also gives a rule'); });
    if (new Set(pairs.map(p => sees(p[0]))).size !== 4) e.push('two pairs start from the same picture');
    if (pairs.some(p => sees(p[0]) === sees(p[1]))) e.push('a pair does not change');
  }
  return e;
}

function fakeRender(p, q){
  const prompt = p.ctx.document.createElement('div'), opts = p.ctx.document.createElement('div');
  const results = [];
  const cat = p.evalIn('IQ_CATEGORIES').find(c => c.key === 'analogy');
  p.ctx.iqAnalogyRenderEngine(q, prompt, opts, ok => results.push(ok));
  const buttons = opts.children;
  buttons.forEach(b => b.click());
  void cat;
  return { prompt: prompt.innerHTML, options: buttons.map(b => b.innerHTML), results, expl: p.ctx.document.getElementById('iq-analogy-explanation').textContent };
}

function run(){
  test('ANA-1 library: 167 rules in arrow questions and 77 in shapes questions, counted here independently; steps 2-3 on different attributes', () => {
    const p = H.loadProject(), mine = [LIB.arrow.length, LIB.shapes.length], prod = p.evalIn("[iqAnLibrary('arrow').length, iqAnLibrary('shapes').length]");
    const keys = m => p.evalIn("iqAnLibrary('" + m + "').map(iqAnKey).sort().join('#')");
    const bad = [];
    if (mine.join() !== '167,77') bad.push('test-side counts ' + mine.join());
    if (prod.join() !== mine.join()) bad.push('production counts ' + prod.join());
    ['arrow', 'shapes'].forEach(m => { if (keys(m) !== LIB[m].map(ruleKey).sort().join('#')) bad.push(m + ' libraries differ'); });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : '167 + 77 rules, identical in production and test' };
  });
  ['classic', 'two-examples', 'pair-odd'].forEach((key, k) => {
    test('ANA-' + (2 + k) + ' ' + key + ': ' + N + ' questions checked against the independent library at every level', () => {
      const p = H.loadProject(); p.seed(80 + k); const bad = []; let invalid = 0, ex = null; const rules = new Set();
      const tiers = key === 'classic' ? [1, 2, 3, 4, 5, 6, 7] : [3, 4, 5, 6, 7];
      for (let i = 0; i < N; i++){
        const t = tiers[i % tiers.length], q = pickDesign(p, key, t), errs = checkQuestion(q);
        const n = q.rule.length; if (t <= 2 && n !== 2) errs.push('level ' + t + ' rule has ' + n + ' steps'); if (t >= 5 && n !== 3) errs.push('level ' + t + ' rule has ' + n + ' steps');
        q.rule.forEach(([a, op]) => { if (a === 'rot' && op === 'byCount' && t < 5) errs.push('derived direction too early'); if (a === 'rot' && op === 'mod3' && t < 6) errs.push('mod-3 direction too early'); });
        rules.add(ruleKey(q.rule));
        if (errs.length){ invalid++; ex = ex || errs[0]; }
      }
      if (invalid) bad.push(invalid + ' invalid, e.g. ' + ex);
      return { pass: !bad.length, info: N + ' questions | different rules used: ' + rules.size + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });
  test('ANA-5 rendering: the real renderer draws the right pictures, exactly one option is correct, the rule is shown after a correct answer', () => {
    const p = H.loadProject(); p.seed(85); const bad = [];
    for (let i = 0; i < Math.round(N / 2); i++){
      const key = ['classic', 'two-examples', 'pair-odd'][i % 3], q = pickDesign(p, key, 3 + (i % 5)), r = fakeRender(p, q);
      const svgs = h => (h.match(/<svg\b/g) || []).length;
      const wantPrompt = { classic: 3, 'two-examples': 5, 'pair-odd': 2 }[key];
      if (svgs(r.prompt) !== wantPrompt) bad.push(key + ': prompt has ' + svgs(r.prompt) + ' pictures, expected ' + wantPrompt);
      if (r.options.length !== 4) bad.push(key + ': ' + r.options.length + ' options');
      if (r.options.some(h => /NaN|undefined/.test(h)) || /NaN|undefined/.test(r.prompt)) bad.push(key + ': NaN in a picture');
      if (r.results.filter(v => v === true).length !== 1) bad.push(key + ': ' + r.results.filter(v => v === true).length + ' correct options');
      if (!/^הכלל/.test(r.expl)) bad.push(key + ': no rule shown after a correct answer');
      if (key === 'pair-odd' && r.options.some(h => svgs(h) !== 3)) bad.push('pair option without two pictures');
      if (bad.length > 3) break;
    }
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.slice(0, 3).join(' | ') : 'prompt/option pictures, one correct answer, rule text' };
  });
  test('ANA-6 pool and variety: the nine older mechanics are still drawn; the new designs wait for level 3; the same design never comes twice in a row; no rule repeats back to back', () => {
    const p = H.loadProject(); p.seed(86); const bad = []; let legacy = 0, total = 0, repeatsD = 0, repeatsR = 0, prevD = null, prevR = null; const byTier = {};
    for (let t = 1; t <= 7; t++){
      p.evalIn('IQ_AN_LAST.design = null; IQ_AN_LAST.rule = null'); prevD = null; prevR = null; byTier[t] = new Set();
      for (let i = 0; i < 400; i++){
        const q = p.ctx.iqAnalogyPick(t), d = q.design || 'legacy'; total++;
        if (!q.design) legacy++; byTier[t].add(d);
        if (d !== 'legacy' && q.rule && prevR === ruleKey(q.rule)) repeatsR++;
        if (p.evalIn('IQ_AN_LAST.design') === prevD && prevD !== null) repeatsD++;
        prevD = p.evalIn('IQ_AN_LAST.design'); prevR = q.rule ? ruleKey(q.rule) : null;
      }
    }
    if (!legacy) bad.push('the older mechanics are never drawn');
    [1, 2].forEach(t => { if (byTier[t].has('two-examples') || byTier[t].has('pair-odd')) bad.push('new designs at level ' + t); });
    [3, 4, 5, 6, 7].forEach(t => { if (!byTier[t].has('two-examples') || !byTier[t].has('pair-odd')) bad.push('new designs missing at level ' + t); });
    if (p.evalIn('IQ_ANALOGY_MECHANICS.length') !== 9) bad.push('the older mechanics are not all registered');
    if (repeatsD) bad.push(repeatsD + ' designs repeated in a row');
    if (repeatsR) bad.push(repeatsR + ' rules repeated in a row');
    return { pass: !bad.length, info: total + ' questions | older mechanics ' + (100 * legacy / total).toFixed(0) + '%' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  return out;
}

module.exports = { run };
