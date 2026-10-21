'use strict';
// Focused tests of the shape-analogies game (the rule-library engine).
// The rules are rebuilt HERE with test-side code, and turns / reflections are checked GEOMETRICALLY: a figure is a list of points, and
// "turn a quarter clockwise", "reflect left-right" ... are applied to the points themselves (not to the game's orient numbers), then compared
// with what the game says the answer is. The renderer is checked the same way, from the polygon it really draws.
//   - library: 79 rules with a glyph (turns, reflections, fill, colour, size, number), 9 with a plain shape, 14 with a shape in a shape (inner/outer
//     swap) and 18 with three coloured regions (rotating colours), counted independently; every rule has the visual change of its kind;
//     none of the removed arithmetic / modulo / odd-angle steps exists;
//   - classic / two-examples / pair-odd: every question is checked against the independent library (right answer, unique rule, wrong answers
//     are four different PICTURES, three wrong answers, never more than 4 shapes in a group);
//   - rendering through the real renderer (fake DOM): 4 options, exactly one correct, the rule is shown after a correct answer;
//   - the drawn glyph polygon is the figure turned / mirrored as the state says; everything fits inside its drawing area;
//   - pacing: levels 1-3 only the classic design, heavy designs from level 4 as an occasional twist; no rule or heavy design twice in a row;
//   - share of classic visual rules (turn / reflection / fill) and of rules with a number step.

const H = require('../harness');
const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.ANALOGY_SAMPLE_SCALE || 1);
const N = Math.max(80, Math.round(600 * SCALE));

// ----- test-side geometry and rules -----
const R4 = ([x, y]) => [-y, x];                                    // a quarter-turn clockwise on the screen (y points down)
const GEOM = { '+90': R4, '-90': ([x, y]) => [y, -x], '180': ([x, y]) => [-x, -y], 'flipH': ([x, y]) => [-x, y], 'flipV': ([x, y]) => [x, -y] };
const fix = v => Math.round(v * 1000) / 1000 + 0;
const ptsKey = pts => pts.map(p => p.map(fix).join(',')).sort().join(';');
function glyphPts(p, id, orient){                                   // the outline as drawn for an orient value: mirrored first (left-right), then turned
  let pts = p.evalIn('IQ_GLYPHS')[id].map(q => q.slice());
  if ((orient >> 2) === 1) pts = pts.map(([x, y]) => [-x, y]);
  for (let i = 0; i < (orient & 3); i++) pts = pts.map(R4);
  return pts;
}
const ORDER = ['orient', 'nest', 'cycle', 'op', 'cut', 'colour', 'size', 'fill', 'count'];
const OPS = { orient: ['+90', '-90', '180', 'flipH', 'flipV'], nest: ['swap'], cycle: ['+1', '-1'], op: ['and', 'xor', 'aNotB', 'bNotA', 'union'], cut: ['v', 'd', 'q', 't', 'join'], colour: ['pair'], size: ['flip'], fill: ['flip'], count: ['+1', '-1'] };
const MODE_ATTRS = { glyph: ['orient', 'colour', 'size', 'fill', 'count'], shapes: ['colour', 'size', 'fill', 'count'], nested: ['nest', 'colour', 'size', 'fill', 'count'], spin: ['cycle', 'colour', 'size', 'count'], logic: ['op', 'colour', 'size', 'fill'], parts: ['cut', 'colour', 'size', 'fill'] };
const MUST = { glyph: ['orient', 'fill'], shapes: ['fill'], nested: ['nest'], spin: ['cycle'], logic: ['op'], parts: ['cut'], merge: ['merge'] };
const CAPS = { glyph: 2, nested: 2, spin: 2, shapes: 4, logic: 1, parts: 1 };
const OP_NAMES = ['and', 'xor', 'aNotB', 'bNotA', 'union'], CUT_NAMES = ['whole', 'v', 'd', 'q', 't', 'v!', 'd!', 'q!', 't!'];          // the states 5-8 of a cut are only ever wrong answers: cut, pieces not moved apart
const PERMS_T = [[0, 1, 2], [2, 0, 1], [1, 2, 0], [0, 2, 1], [2, 1, 0], [1, 0, 2]];          // region -> palette colour, six ways
// a test-side figure: {pts (glyph outline or null), colour, size, fill, count, cap, nest {outer, inner, cols} (shape in shape), regions (the colours of the three regions)}
function figure(p, ctx, st){
  const f = { pts: null, colour: st.colour, size: st.size, fill: st.fill, count: st.count, cap: CAPS[ctx.mode], nest: null, regions: null, cfg: st.cfg, op: st.op === 0 ? 'none' : OP_NAMES[st.op - 1], cut: CUT_NAMES[st.cut] };
  if (ctx.mode === 'glyph') f.pts = glyphPts(p, ctx.glyph, st.orient);
  if (ctx.mode === 'nested'){
    const sh = [[0, 1], [1, 0], [1, 1], [0, 0]][st.nest];                                          // [outer, inner] shape; 2 and 3 are the half-finished swaps
    f.colour = null; f.nest = { outer: sh[0], inner: sh[1], cols: [st.colour, st.colour ^ 1] };
  }
  if (ctx.mode === 'spin'){ f.colour = null; f.fill = null; f.regions = PERMS_T[st.cycle].map(i => ctx.palette[i] ^ st.colour); }          // numbers into the four colours; a colour step puts each next to its partner
  return f;
}
function stepFigure(attr, op, f){
  const o = Object.assign({}, f);
  if (attr === 'orient') o.pts = f.pts.map(GEOM[op]);
  else if (attr === 'op'){ if (f.op !== 'none') return null; o.op = op; }                                                    // only a figure that has not been processed yet
  else if (attr === 'cut'){ if (op === 'join'){ if (!['v', 'd', 'q', 't'].includes(f.cut)) return null; o.cut = 'whole'; } else { if (f.cut !== 'whole') return null; o.cut = op; } }
  else if (attr === 'nest') o.nest = { outer: f.nest.inner, inner: f.nest.outer, cols: f.nest.cols };           // the two shapes change places, each keeps its colour
  else if (attr === 'colour' && f.regions) o.regions = f.regions.map(i => i ^ 1);
  else if (attr === 'cycle'){ const r = f.regions; o.regions = op === '+1' ? [r[2], r[0], r[1]] : [r[1], r[2], r[0]]; }  // +1: every colour moves to the next region
  else if (attr === 'colour'){ if (f.nest) o.nest = { outer: f.nest.outer, inner: f.nest.inner, cols: [f.nest.cols[1], f.nest.cols[0]] }; else o.colour = f.colour % 2 ? f.colour - 1 : f.colour + 1; }
  else if (attr === 'size') o.size = 1 - f.size;
  else if (attr === 'fill') o.fill = 1 - f.fill;
  else { o.count = f.count + (op === '+1' ? 1 : -1); if (o.count < 1 || o.count > f.cap) return null; }
  return o;
}
const applyRule = (rule, f) => { let cur = f; for (const [a, op] of rule){ cur = cur && stepFigure(a, op, cur); } return cur; };
const canon = f => JSON.stringify([f.pts ? ptsKey(f.pts) : null, f.colour, f.size, f.fill, f.count, f.nest, f.regions, f.cfg, f.op, f.cut]);
const sameFig = (a, b) => !!(a && b && canon(a) === canon(b));
function library(mode){
  const attrs = ORDER.filter(a => MODE_ATTRS[mode].includes(a)), rules = [];
  const sub = (from, chosen) => {
    if (chosen.length >= 2 && chosen.some(s => MUST[mode].includes(s[0]))) rules.push(chosen);
    if (chosen.length === 3) return;
    for (let i = from; i < attrs.length; i++) for (const op of OPS[attrs[i]]) sub(i + 1, chosen.concat([[attrs[i], op]]));
  };
  sub(0, []);
  return rules;
}
const LIB = { glyph: library('glyph'), shapes: library('shapes'), nested: library('nested'), spin: library('spin'), logic: library('logic'), parts: library('parts') };
const ruleKey = r => r.map(s => s.join(' ')).join(' | ');
const asRule = r => r.map(s => s.slice());
const fitsAll = (lib, pairs) => lib.filter(r => pairs.every(([a, b]) => sameFig(applyRule(r, a), b)));
const look = canon;
// every list of one or two steps on different attributes: a part of a rule
function partialLibrary(mode){
  const attrs = ORDER.filter(a => MODE_ATTRS[mode].includes(a)), rules = [];
  const sub = (from, chosen) => {
    if (chosen.length) rules.push(chosen);
    if (chosen.length === 2) return;
    for (let i = from; i < attrs.length; i++) for (const op of OPS[attrs[i]]) sub(i + 1, chosen.concat([[attrs[i], op]]));
  };
  sub(0, []);
  return rules;
}
const PART = { glyph: partialLibrary('glyph'), shapes: partialLibrary('shapes'), nested: partialLibrary('nested'), spin: partialLibrary('spin'), logic: partialLibrary('logic'), parts: partialLibrary('parts') };
// the merge model, written here from the plain description: what each of the three kinds of square becomes
// (a square only in the dark layer / only in the light layer / in both), 0 nothing, 1 dark, 2 light, 3 a third colour
const MERGE_LIB = [];
for (const x of [0, 1]) for (const y of [0, 2]) for (const b of [0, 1, 2, 3]){
  const nothing = !x && !y, onlyDark = x === 1 && !y && b === 1, onlyLight = !x && y === 2 && b === 2;
  if (!nothing && !onlyDark && !onlyLight) MERGE_LIB.push({ x, y, b });
}
const mergeCell = (r, xv, yv) => (xv && yv ? r.b : xv ? r.x : yv ? r.y : 0);
const mergeApply = (r, X, Y) => X.map((xv, i) => mergeCell(r, xv, Y[i]));
const mergeKey = r => 'x' + r.x + 'y' + r.y + 'b' + r.b;
const mergeFits = pairs => MERGE_LIB.filter(r => pairs.every(([X, Y, Z]) => mergeApply(r, X, Y).join() === Z.join()));
const kinds = (X, Y) => ({ x: X.filter((v, i) => v && !Y[i]).length, y: Y.filter((v, i) => v && !X[i]).length, b: X.filter((v, i) => v && Y[i]).length });
const pickDesign = (p, key, tier) => p.evalIn('IQ_AN_DESIGNS').find(d => d.key === key).make(tier);

function checkMerge(q){
  const e = [], rule = MERGE_LIB.find(r => mergeKey(r) === q.mergeRule.key);
  if (!rule) return ['the rule is not in the merge library'];
  if (q.ctx.palette.names.length !== 3 || new Set([q.ctx.palette.dark, q.ctx.palette.light, q.ctx.palette.third]).size !== 3) e.push('palette');
  if (q.rows.length !== 2) e.push('not two examples');
  q.rows.forEach((r, i) => {
    if (mergeApply(rule, r.X, r.Y).join() !== r.Z.join()) e.push('example ' + i + ' does not follow the rule (checked square by square)');
    if (!r.Z.some(Boolean)) e.push('example ' + i + ' shows nothing');
    if (mergeFits([[r.X, r.Y, r.Z]]).length < 2) e.push('example ' + i + ' alone already settles the rule');
  });
  const fits = mergeFits(q.rows.map(r => [r.X, r.Y, r.Z]));
  if (fits.length !== 1 || mergeKey(fits[0]) !== mergeKey(rule)) e.push('the two examples do not settle exactly this rule');
  const k = kinds(q.Q.X, q.Q.Y);
  if (!(k.x >= 1 && k.y >= 1 && k.b >= 1)) e.push('the question lacks one of the three kinds of square');
  [q.Q.X, q.Q.Y].concat(q.rows.flatMap(r => [r.X, r.Y])).forEach(m => { const n = m.filter(Boolean).length; if (n < 2 || n > 5 || m.length !== 9) e.push('a layer has ' + n + ' squares'); });
  if (mergeApply(rule, q.Q.X, q.Q.Y).join() !== q.answer.join()) e.push('the answer is not the rule applied to the question (checked square by square)');
  const shown = [q.answer].concat(q.wrong).map(z => z.join());
  if (q.wrong.length !== 3 || new Set(shown).size !== 4) e.push('the four answers are not four different pictures');
  const results = new Set(MERGE_LIB.map(r => mergeApply(r, q.Q.X, q.Q.Y).join()));
  if (q.wrong.some(w => !results.has(w.join()))) e.push('a wrong answer is not what any merge rule gives');
  if (q.wrong.some(w => !w.some(Boolean))) e.push('an empty answer');
  return e;
}
function checkSplit(p, q, lib, F){
  const e = [], rule = asRule(q.rule), S1 = asRule(q.parts[0]), S2 = asRule(q.parts[1]);
  const all = S1.concat(S2).map(s => s.join(' ')).sort().join('|');
  if (!S1.length || !S2.length || all !== rule.map(s => s.join(' ')).sort().join('|')) e.push('the two parts are not the whole rule');
  if (new Set(S1.concat(S2).map(s => s[0])).size !== S1.length + S2.length) e.push('the parts share an attribute');
  if (!sameFig(applyRule(S1, F(q.A)), F(q.A2))) e.push('the first example does not show the first part (checked on the points)');
  if (!sameFig(applyRule(S2, F(q.C)), F(q.C2))) e.push('the second example does not show the second part (checked on the points)');
  const f1 = fitsAll(PART[q.ctx.mode], [[F(q.A), F(q.A2)]]), f2 = fitsAll(PART[q.ctx.mode], [[F(q.C), F(q.C2)]]);
  if (f1.length !== 1 || ruleKey(f1[0]) !== ruleKey(S1)) e.push('the first example does not settle exactly its part');
  if (f2.length !== 1 || ruleKey(f2[0]) !== ruleKey(S2)) e.push('the second example does not settle exactly its part');
  const full = applyRule(rule, F(q.B)), p1 = applyRule(S1, F(q.B)), p2 = applyRule(S2, F(q.B));
  if (!sameFig(full, F(q.B2))) e.push("B' is not both parts applied to B (checked on the points)");
  const shown = [q.B2].concat(q.wrong).map(s => look(F(s)));
  if (q.wrong.length !== 3 || new Set(shown).size !== 4) e.push('the four answers are not four different pictures');
  if (!q.wrong.some(w => sameFig(F(w), p1))) e.push('the answer with only the first part is missing among the wrong ones');
  if (!q.wrong.some(w => sameFig(F(w), p2))) e.push('the answer with only the second part is missing among the wrong ones');
  if (!lib.some(r => ruleKey(r) === ruleKey(rule))) e.push('the whole rule is not in the library');
  if (look(F(q.A)) === look(F(q.C)) || look(F(q.A)) === look(F(q.B)) || look(F(q.C)) === look(F(q.B))) e.push('two starting figures look alike');
  return e;
}
function checkQuestion(p, q){
  if (q.design === 'merge') return checkMerge(q);
  const e = [], lib = LIB[q.ctx.mode], rule = asRule(q.rule), F = st => figure(p, q.ctx, st);
  if (!lib.some(r => ruleKey(r) === ruleKey(rule))) e.push('the rule is not in the library');
  if (q.ctx.colours.length !== 4 || new Set(q.ctx.colours).size !== 4) e.push('colour palette');
  const all = [q.A, q.A2, q.B, q.B2, q.C, q.C2, q.E, q.E2].concat(q.wrong || [], (q.pairs || []).flat()).filter(Boolean);
  if (all.some(st => st.count < 1 || st.count > 4)) e.push('a group has more than 4 shapes');
  if (q.ctx.mode !== 'shapes' && all.some(st => st.count > 2)) e.push('a ' + q.ctx.mode + ' group has more than 2 copies');
  if (q.design === 'split-rule'){
    e.push(...checkSplit(p, q, lib, F));
  } else if (q.design === 'classic'){
    const exs = [[q.A, q.A2]];
    exs.forEach(([a, b]) => { if (!sameFig(applyRule(rule, F(a)), F(b))) e.push('an example does not follow the rule (checked on the points)'); });
    if (!sameFig(applyRule(rule, F(q.B)), F(q.B2))) e.push("B' is not the rule applied to B (checked on the points)");
    const fit = fitsAll(lib, exs.map(([a, b]) => [F(a), F(b)]));
    if (!fit.some(r => ruleKey(r) === ruleKey(rule))) e.push('the rule does not fit its own examples');
    fit.forEach(r => { const o = applyRule(r, F(q.B)); if (o && !sameFig(o, F(q.B2))) e.push('a rule that fits the examples gives another answer for B: ' + ruleKey(r)); });
    const shown = [q.B2].concat(q.wrong).map(s => look(F(s)));
    if (q.wrong.length !== 3 || new Set(shown).size !== 4) e.push('the four answers are not four different pictures');
    if (look(F(q.A)) === look(F(q.A2)) || look(F(q.B)) === look(F(q.B2))) e.push('a figure does not change');
    if (look(F(q.A)) === look(F(q.B))) e.push('A and B look alike');
  } else {
    const E = [F(q.E), F(q.E2)], pairs = q.pairs.map(pr => [F(pr[0]), F(pr[1])]);
    if (!sameFig(applyRule(rule, E[0]), E[1])) e.push('the example does not follow the rule');
    const allPairs = [E].concat(pairs), without = i => allPairs.filter((_, j) => j !== i + 1);
    pairs.forEach((pr, i) => { const follows = sameFig(applyRule(rule, pr[0]), pr[1]); if (follows === (i === q.oddIndex)) e.push('pair ' + i + (follows ? ' follows' : ' breaks') + ' the rule'); });
    if (!fitsAll(lib, without(q.oddIndex)).length) e.push('the other four pairs do not fit one rule');
    if (fitsAll(lib, allPairs).length) e.push('all five pairs fit one rule');
    [0, 1, 2, 3].filter(i => i !== q.oddIndex).forEach(i => { if (fitsAll(lib, without(i)).length) e.push('leaving out pair ' + i + ' also gives a rule'); });
    if (new Set(pairs.map(pr => look(pr[0]))).size !== 4) e.push('two pairs start from the same picture');
    if (pairs.some(pr => look(pr[0]) === look(pr[1]))) e.push('a pair does not change');
  }
  return e;
}

function fakeRender(p, q){
  const prompt = p.ctx.document.createElement('div'), opts = p.ctx.document.createElement('div'), results = [];
  p.ctx.iqAnalogyRenderEngine(q, prompt, opts, ok => results.push(ok));
  opts.children.forEach(b => b.click());
  return { prompt: prompt.innerHTML, options: opts.children.map(b => b.innerHTML), results, expl: p.ctx.document.getElementById('iq-analogy-explanation').textContent };
}

function run(){
  test('ANA-1 library: 79 glyph, 9 plain-shape, 14 inner/outer, 18 rotating-colour, 30 logic and 30 parts rules, counted here independently; each has the visual change of its kind; no arithmetic or modulo steps', () => {
    const p = H.loadProject(), bad = [], modes = ['glyph', 'shapes', 'nested', 'spin', 'logic', 'parts'];
    const prod = p.evalIn("['glyph', 'shapes', 'nested', 'spin', 'logic', 'parts'].map(m => iqAnLibrary(m).length)"), mine = modes.map(m => LIB[m].length);
    if (mine.join() !== '79,9,14,18,30,30') bad.push('test-side counts ' + mine.join());
    if (prod.join() !== mine.join()) bad.push('production counts ' + prod.join());
    modes.forEach(m => { if (p.evalIn("iqAnLibrary('" + m + "').map(iqAnKey).sort().join('#')") !== LIB[m].map(ruleKey).sort().join('#')) bad.push(m + ' libraries differ'); });
    const ops = JSON.stringify(p.evalIn('IQ_AN_OPS'));
    if (/x2|half|\+2|skip2|mod3|byCount|\+45|\+135/.test(ops)) bad.push('a removed step still exists: ' + ops);
    modes.forEach(m => { if (LIB[m].some(r => r.length < 2 || r.length > 3 || new Set(r.map(s => s[0])).size !== r.length || !r.some(s => MUST[m].includes(s[0])))) bad.push(m + ': rules are not 2-3 steps on different attributes with the visual change of their kind'); });
    if (p.evalIn('Object.keys(IQ_GLYPHS).length') < 20) bad.push('too few glyphs');
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : mine.join(' + ') + ' rules, identical in production and test, ' + p.evalIn('Object.keys(IQ_GLYPHS).length') + ' glyphs' };
  });
  ['classic', 'split-rule', 'pair-odd', 'merge'].forEach((key, k) => {
    test('ANA-' + (k < 3 ? 2 + k : 14) + ' ' + key + ': ' + N + ' questions checked against the independent library' + (key === 'merge' ? ', square by square' : ', turns and reflections verified on the points'), () => {
      const p = H.loadProject(); p.seed(80 + k); const bad = []; let invalid = 0, ex = null; const rules = new Set();
      const tiers = key === 'classic' ? [1, 2, 3, 4, 5, 6, 7] : [4, 5, 6, 7];
      for (let i = 0; i < N; i++){
        const t = tiers[i % tiers.length], q = pickDesign(p, key, t), errs = checkQuestion(p, q);
        const n = q.rule.length; if (key !== 'merge' && t <= 2 && n !== 2) errs.push('level ' + t + ' rule has ' + n + ' steps'); if (key !== 'merge' && t >= 5 && n !== 3) errs.push('level ' + t + ' rule has ' + n + ' steps');
        rules.add(ruleKey(q.rule));
        if (errs.length){ invalid++; ex = ex || errs[0]; }
      }
      if (invalid) bad.push(invalid + ' invalid, e.g. ' + ex);
      return { pass: !bad.length, info: N + ' questions | different rules used: ' + rules.size + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });
  test('ANA-5 rendering: the real renderer draws the right pictures, exactly one option is correct, the four options look different, the rule is shown after a correct answer', () => {
    const p = H.loadProject(); p.seed(85); const bad = [];
    for (let i = 0; i < Math.round(N / 2); i++){
      const key = ['classic', 'split-rule', 'pair-odd', 'merge'][i % 4], q = pickDesign(p, key, key === 'classic' ? 1 + (i % 7) : 4 + (i % 4)), r = fakeRender(p, q);
      const svgs = h => (h.match(/<svg\b/g) || []).length, wantPrompt = { classic: 3, 'split-rule': 5, 'pair-odd': 2, merge: 8 }[key];
      if (svgs(r.prompt) !== wantPrompt) bad.push(key + ': prompt has ' + svgs(r.prompt) + ' pictures, expected ' + wantPrompt);
      if (r.options.length !== 4) bad.push(key + ': ' + r.options.length + ' options');
      if (r.options.some(h => /NaN|undefined/.test(h)) || /NaN|undefined/.test(r.prompt)) bad.push(key + ': NaN in a picture');
      if (new Set(r.options).size !== 4) bad.push(key + ': two options look exactly alike');
      if (r.results.filter(v => v === true).length !== 1) bad.push(key + ': ' + r.results.filter(v => v === true).length + ' correct options');
      if (!/^הכלל/.test(r.expl)) bad.push(key + ': no rule shown after a correct answer');
      if (key === 'pair-odd' && r.options.some(h => svgs(h) !== 3)) bad.push('pair option without two pictures');
      if (bad.length > 3) break;
    }
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.slice(0, 3).join(' | ') : 'prompt/option pictures, one correct answer, rule text' };
  });
  test('ANA-6 pacing and variety: levels 1-3 are ONLY the classic design, the heavy ones arrive at level 4 as an occasional twist (20-40%); a heavy design or a rule never comes twice in a row', () => {
    const p = H.loadProject(); p.seed(86); const bad = []; let total = 0, repeatsD = 0, repeatsR = 0; const byTier = {};
    for (let t = 1; t <= 7; t++){
      p.evalIn('IQ_AN_LAST.design = null; IQ_AN_LAST.rule = null'); let prevD = null, prevR = null; byTier[t] = new Set(); let heavy = 0;
      for (let i = 0; i < 400; i++){
        const q = p.ctx.iqAnalogyPick(t); total++;
        if (!q.design) bad.push('a question without a design at level ' + t);
        byTier[t].add(q.design); if (q.design !== 'classic') heavy++;
        if (prevR === ruleKey(q.rule)) repeatsR++;
        const d = p.evalIn('IQ_AN_LAST.design'); if (d !== 'classic' && d === prevD) repeatsD++;
        prevD = d; prevR = ruleKey(q.rule);
      }
      if (t <= 3 && heavy) bad.push('a heavy design at level ' + t);
      if (t >= 4 && (heavy / 400 > 0.40 || heavy / 400 < 0.2)) bad.push('heavy designs are ' + (100 * heavy / 400).toFixed(0) + '% at level ' + t);
      if (t >= 4 && !(['classic', 'split-rule', 'pair-odd', 'merge'].every(d => byTier[t].has(d)))) bad.push('a design is missing at level ' + t);
    }
    if (p.evalIn('typeof IQ_ANALOGY_MECHANICS') !== 'undefined' || p.evalIn('typeof generateAnalogy') !== 'undefined') bad.push('the older mechanics still exist');
    if (repeatsD) bad.push(repeatsD + ' heavy designs repeated in a row');
    if (repeatsR) bad.push(repeatsR + ' rules repeated in a row');
    return { pass: !bad.length, info: total + ' questions' + (bad.length ? ' | WRONG: ' + bad.slice(0, 4).join(' | ') : '') };
  });
  test('ANA-7 shapes fit: every shape type and every glyph at every scale up to 1.5, count, turn, reflection and fill stays inside its drawing area, outline included; size is visible at every count', () => {
    const p = H.loadProject(), bad = []; let checked = 0;
    const extents = svg => {
      const vb = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg).slice(1).map(Number);
      let dx = 0, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
      const widen = (x, y, half) => { lo = [Math.min(lo[0], x - half), Math.min(lo[1], y - half)]; hi = [Math.max(hi[0], x + half), Math.max(hi[1], y + half)]; };
      [...svg.matchAll(/<g transform="translate\(([-\d.]+) 0\)">|<\/g>|<polygon points="([^"]*)"[^>]*?stroke-width="([\d.]+)"|<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"[^>]*?stroke-width="([\d.]+)"|<path d="([^"]*)"[^>]*?stroke-width="([\d.]+)"/g)].forEach(m => {
        if (m[1] !== undefined) dx = +m[1];
        else if (m[0] === '</g>') dx = 0;
        else if (m[2] !== undefined) m[2].trim().split(' ').forEach(q => { const [x, y] = q.split(',').map(Number); widen(x + dx, y, +m[3] / 2); });
        else if (m[8] !== undefined) [...m[8].matchAll(/[ML]\s*([-\d.]+) ([-\d.]+)/g)].forEach(q => widen(+q[1] + dx, +q[2], +m[9] / 2));
        else if (m[4] !== undefined){ widen(+m[4] + dx - +m[6], +m[5], +m[7] / 2); widen(+m[4] + dx + +m[6], +m[5], +m[7] / 2); widen(+m[4] + dx, +m[5] - +m[6], +m[7] / 2); widen(+m[4] + dx, +m[5] + +m[6], +m[7] / 2); }
      });
      return { vb, lo, hi };
    };
    const outside = svg => { const e = extents(svg); return Math.max(e.vb[0] - e.lo[0], e.vb[1] - e.lo[1], e.hi[0] - (e.vb[0] + e.vb[2]), e.hi[1] - (e.vb[1] + e.vb[3])); };
    for (const type of ['circle', 'square', 'triangle', 'pentagon', 'hexagon', 'star', 'arrow'])
      for (const scale of [0.7, 1, 1.3, 1.5]) for (const count of [1, 2, 3, 4]) for (const hollow of [false, true]){
        const o = outside(p.ctx.renderShapeSVG({ type, color: '#FF6B6B', scale, count, rotation: 90, hollow })); checked++;
        if (o > 0.05) bad.push(type + ' scale ' + scale + ' x' + count + ': ' + o.toFixed(1) + ' units outside');
      }
    for (const glyph of p.evalIn('Object.keys(IQ_GLYPHS)')) for (const scale of [1, 1.3, 1.5]) for (const count of [1, 3, 4]) for (const rotation of [0, 90, 180, 270]) for (const mirror of [false, true]){
      const o = outside(p.ctx.renderShapeSVG({ type: 'glyph', glyph, color: '#4C6FFF', scale, count, rotation, mirror, hollow: mirror })); checked++;
      if (o > 0.05) bad.push('glyph ' + glyph + ' scale ' + scale + ' x' + count + ': ' + o.toFixed(1) + ' units outside');
    }
    // two overlapping shapes (every operation, both sides filled or outline only) and cut shapes (every cut, whole, moved apart or together): inside at both scales the analogies use (1 and 1.3)
    for (const a of ['circle', 'square', 'triangle', 'pentagon']) for (const b of ['circle', 'square', 'triangle', 'pentagon']) if (a !== b) for (const dir of [0, 90, 45]) for (const op of ['none', 'and', 'xor', 'aNotB', 'bNotA', 'union']) for (const scale of [1, 1.3]) for (const hollow of [false, true]){
      const o = outside(p.ctx.renderShapeSVG({ type: 'logic', a, b, dir, op, color: '#FF6B6B', color2: '#4C6FFF', color3: '#FFD93D', scale, count: 1, hollow })); checked++;
      if (o > 0.05) bad.push('logic ' + a + '/' + b + ' ' + op + ' scale ' + scale + ': ' + o.toFixed(1) + ' units outside');
    }
    for (const shape of ['circle', 'square', 'triangle', 'pentagon', 'hexagon']) for (let cut = 0; cut <= 8; cut++) for (const scale of [1, 1.3]) for (const hollow of [false, true]){
      const o = outside(p.ctx.renderShapeSVG({ type: 'parts', shape, cut, color: '#FF6B6B', color2: '#4C6FFF', scale, count: 1, hollow })); checked++;
      if (o > 0.05) bad.push('parts ' + shape + ' cut ' + cut + ' scale ' + scale + ': ' + o.toFixed(1) + ' units outside');
    }
    // shapes in shapes and coloured regions: also inside the drawing area at every scale and count, with a filled and an outline inner shape
    for (const outer of ['square', 'circle', 'triangle', 'pentagon']) for (const inner of ['square', 'circle', 'triangle']) for (const scale of [1, 1.3, 1.5]) for (const count of [1, 2]) for (const hollow of [false, true]){
      const o = outside(p.ctx.renderShapeSVG({ type: 'nested', outer, inner, color: '#FF6B6B', color2: '#4C6FFF', scale, count, hollow })); checked++;
      if (o > 0.05) bad.push('nested ' + outer + '/' + inner + ' scale ' + scale + ' x' + count + ': ' + o.toFixed(1) + ' units outside');
    }
    for (const layout of ['sectors', 'rings']) for (const scale of [1, 1.3, 1.5]) for (const count of [1, 2]){
      const o = outside(p.ctx.renderShapeSVG({ type: 'spin', layout, colors: ['#FF6B6B', '#4C6FFF', '#FFD93D'], scale, count })); checked++;
      if (o > 0.05) bad.push('spin ' + layout + ' scale ' + scale + ' x' + count + ': ' + o.toFixed(1) + ' units outside');
    }
    for (const type of ['square', 'triangle', 'hexagon']) for (const count of [2, 3, 4]){
      const first = sc => { const m = /<g transform="translate\(([-\d.]+) 0\)"><polygon points="([^"]*)"/.exec(p.ctx.renderShapeSVG({ type, color: '#FF6B6B', scale: sc, count })); const xs = m[2].trim().split(' ').map(q => +q.split(',')[0]); return Math.max(...xs) - Math.min(...xs); };
      const rr = first(1.3) / first(1);
      if (rr < 1.25 || rr > 1.35) bad.push(type + ' x' + count + ': scale 1.3 is drawn ' + rr.toFixed(2) + ' times as wide as scale 1');
    }
    return { pass: !bad.length, info: checked + ' drawings' + (bad.length ? ' | WRONG: ' + bad.slice(0, 4).join(' | ') : ' all inside') };
  });
  test('ANA-8 hard limit: no group in any picture of any question holds more than 4 shapes (examples and all answers), and the real category renderer never draws more', () => {
    const p = H.loadProject(); p.seed(88); const bad = []; let groups = 0; const seenCounts = new Set();
    const cat = p.evalIn('IQ_CATEGORIES').find(c => c.key === 'analogy');
    for (let k = 0; k < N; k++){
      const t = 1 + (k % 7), q = p.ctx.iqAnalogyPick(t);
      const states = [q.A, q.A2, q.B, q.B2, q.C, q.C2, q.E, q.E2].concat(q.wrong || [], (q.pairs || []).flat()).filter(Boolean);
      states.filter(st => st.count !== undefined).forEach(st => { groups++; seenCounts.add(st.count); if (st.count > 4 || st.count < 1) bad.push('count ' + st.count + ' at level ' + t); });
      if (k < 60){
        const prompt = p.ctx.document.createElement('div'), opts = p.ctx.document.createElement('div');
        cat.renderQuestion(t, prompt, opts, () => {});
        [prompt.innerHTML].concat(opts.children.map(b => b.innerHTML)).forEach(h => { (h.match(/<svg\b[^>]*>.*?<\/svg>/g) || []).forEach(svg => { if ((svg.match(/<g transform="translate/g) || []).length > 4) bad.push('more than 4 copies drawn in one picture'); }); });
      }
      if (bad.length > 3) break;
    }
    if (!seenCounts.has(4) || !seenCounts.has(1)) bad.push('counts seen: ' + [...seenCounts].join(','));
    return { pass: !bad.length, info: groups + ' groups checked, counts seen ' + [...seenCounts].sort().join(',') + (bad.length ? ' | WRONG: ' + bad.slice(0, 3).join(' | ') : '') };
  });
  test('ANA-9 the glyph is drawn the way the state says: the polygon in the SVG equals the outline mirrored left-right and turned clockwise (test-side points), for every glyph, turn and reflection', () => {
    const p = H.loadProject(), bad = []; let checked = 0;
    for (const glyph of p.evalIn('Object.keys(IQ_GLYPHS)')) for (let orient = 0; orient < 8; orient++){
      const svg = p.ctx.renderShapeSVG({ type: 'glyph', glyph, color: '#4C6FFF', scale: 1, count: 1, rotation: (orient & 3) * 90, mirror: (orient >> 2) === 1 });
      const m = /<polygon points="([^"]*)"/.exec(svg), drawn = m[1].trim().split(' ').map(q => q.split(',').map(Number));
      const want = glyphPts(p, glyph, orient).map(([x, y]) => [x * 32 / 24 + 40, y * 32 / 24 + 40]);          // radius 0.40 x 80, centre 40
      checked++;
      if (drawn.length !== want.length || drawn.some((q, i) => Math.abs(q[0] - want[i][0]) > 0.06 || Math.abs(q[1] - want[i][1]) > 0.06)) bad.push(glyph + ' orient ' + orient + ' is drawn differently');
    }
    // all 8 orientations of a glyph are 8 different pictures (no symmetry), so every turn and reflection can be seen
    for (const glyph of p.evalIn('Object.keys(IQ_GLYPHS)')){ const keys = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(o => ptsKey(glyphPts(p, glyph, o)))); if (keys.size !== 8) bad.push(glyph + ' has a symmetry: ' + keys.size + ' different pictures'); }
    return { pass: !bad.length, info: checked + ' drawings compared' + (bad.length ? ' | WRONG: ' + bad.slice(0, 3).join(' | ') : ', 8 different pictures for every glyph') };
  });
  test('ANA-10 emphasis: turns/reflections, inner/outer swaps and rotating colours each carry about a seventh to a third of the rules; every rule has the visual change of its kind; a number step is secondary', () => {
    const p = H.loadProject(); p.seed(90); const bad = []; let n = 0, must = 0, count = 0; const has = { orient: 0, nest: 0, cycle: 0 }, modes = {};
    for (let i = 0; i < 2000; i++){
      const q = p.ctx.iqAnalogyPick(1 + (i % 7)); n++; modes[q.ctx.mode] = (modes[q.ctx.mode] || 0) + 1;
      if (q.rule.some(s => MUST[q.ctx.mode].includes(s[0]))) must++;
      ['orient', 'nest', 'cycle'].forEach(a => { if (q.rule.some(s => s[0] === a)) has[a]++; });
      if (q.rule.some(s => s[0] === 'count')) count++;
    }
    const pct = v => 100 * v / n;
    if (must !== n) bad.push((n - must) + ' rules without the visual change of their kind');
    ['orient', 'nest', 'cycle'].forEach(a => { if (pct(has[a]) < 14 || pct(has[a]) > 45) bad.push(a + ' rules are ' + pct(has[a]).toFixed(0) + '%'); });
    if (Math.abs(pct(has.nest) - pct(has.cycle)) > 8) bad.push('inner/outer and rotating-colour rules are not balanced');
    if (pct(has.orient) < pct(has.nest) - 3 || pct(has.orient) < pct(has.cycle) - 3) bad.push('the new rules outweigh turns and reflections');
    if (pct(count) > 30) bad.push('number steps are ' + pct(count).toFixed(0) + '%');
    return { pass: !bad.length, info: n + ' questions | turn or reflection ' + pct(has.orient).toFixed(0) + '% | inner/outer ' + pct(has.nest).toFixed(0) + '% | rotating colours ' + pct(has.cycle).toFixed(0) + '% | number step ' + pct(count).toFixed(0) + '% | figures ' + JSON.stringify(modes) + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('ANA-11 inner/outer drawing: the real renderer draws the outer and inner shape the state says, the inner shape lies inside the outer one (strokes included), a half-finished swap and the real swap are different pictures', () => {
    const p = H.loadProject(), bad = []; let checked = 0;
    const SIDES = { triangle: 3, square: 4, pentagon: 5 };
    const parse = svg => [...svg.matchAll(/<polygon points="([^"]*)" fill="([^"]*)"(?: fill-opacity="[^"]*")? stroke="([^"]*)" stroke-width="([\d.]+)"|<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="([^"]*)"(?: fill-opacity="[^"]*")? stroke="([^"]*)" stroke-width="([\d.]+)"/g)].map(m => m[1] !== undefined
      ? { kind: 'polygon', pts: m[1].trim().split(' ').map(q => q.split(',').map(Number)), fill: m[2], stroke: m[3], sw: +m[4] } : { kind: 'circle', r: +m[7], fill: m[8], stroke: m[9], sw: +m[10] });
    const reach = (e, c) => e.kind === 'circle' ? e.r : Math.max(...e.pts.map(q => Math.hypot(q[0] - c, q[1] - c)));                       // farthest point from the centre
    const inradius = (e, c) => e.kind === 'circle' ? e.r : Math.min(...e.pts.map((a, i) => { const b = e.pts[(i + 1) % e.pts.length], dx = b[0] - a[0], dy = b[1] - a[1]; return Math.abs(dx * (a[1] - c) - dy * (a[0] - c)) / Math.hypot(dx, dy); }));
    const types = ['square', 'circle', 'triangle', 'pentagon'];
    for (const outer of types) for (const inner of types) for (const scale of [1, 1.3]) for (const hollow of [false, true]){
      const svg = p.ctx.renderShapeSVG({ type: 'nested', outer, inner, color: '#FF6B6B', color2: '#4C6FFF', scale, count: 1, hollow }), els = parse(svg); checked++;
      if (els.length !== 2){ bad.push(outer + '/' + inner + ': ' + els.length + ' elements'); continue; }
      const [o, i] = els, kindOf = e => e.kind === 'circle' ? 'circle' : Object.keys(SIDES).find(k => SIDES[k] === e.pts.length) || 'square';
      if (kindOf(o) !== outer || kindOf(i) !== inner) bad.push(outer + '/' + inner + ' drawn as ' + kindOf(o) + '/' + kindOf(i));
      if (o.stroke !== '#FF6B6B' || i.stroke !== '#4C6FFF') bad.push(outer + '/' + inner + ': colours');
      if (hollow !== (i.fill === '#ffffff')) bad.push(outer + '/' + inner + ': hollow flag');
      const gap = inradius(o, 40) - o.sw / 2 - (reach(i, 40) + i.sw / 2);
      if (gap < 0.5) bad.push(outer + '/' + inner + ' scale ' + scale + ': the inner shape touches the outline (gap ' + gap.toFixed(1) + ')');
      if (reach(i, 40) < 0.2 * reach(o, 40)) bad.push(outer + '/' + inner + ': inner shape too small');
    }
    // the states: swap = outer and inner change places; the half-finished ones (nest 2 and 3) look different from both real states
    const ctx = { mode: 'nested', types: ['square', 'circle'], colours: ['#FF6B6B', '#4ECDC4', '#FFD93D', '#9B5DE5'] };
    const sp = n => p.ctx.iqAnSpec(ctx, { orient: 0, nest: n, cycle: 0, colour: 0, size: 0, fill: 0, count: 1, cap: 2 });
    if (new Set([0, 1, 2, 3].map(n => JSON.stringify(sp(n)))).size !== 4) bad.push('the four nest states do not look different');
    if (!(sp(0).outer === 'square' && sp(0).inner === 'circle' && sp(1).outer === 'circle' && sp(1).inner === 'square')) bad.push('the swap does not exchange the shapes');
    if (!(sp(0).color === '#FF6B6B' && sp(0).color2 === '#4ECDC4' && sp(1).color === '#4ECDC4' && sp(1).color2 === '#FF6B6B')) bad.push('a shape does not keep its colour when the shapes change places');
    return { pass: !bad.length, info: checked + ' drawings checked' + (bad.length ? ' | WRONG: ' + bad.slice(0, 4).join(' | ') : ', the inner shape always lies inside') };
  });
  test('ANA-12 rotating-colour drawing: sectors and rings are drawn with the colours of the state (every one of the six colourings), in the order the state says, and +1 / -1 move the colours the way the description says', () => {
    const p = H.loadProject(), bad = []; let checked = 0;
    const palette = ['#FF6B6B', '#4C6FFF', '#FFD93D'];
    for (const layout of ['sectors', 'rings']) for (const perm of PERMS_T) for (const scale of [1, 1.3]){
      const colors = perm.map(i => palette[i]), svg = p.ctx.renderShapeSVG({ type: 'spin', layout, colors, scale, count: 1 }); checked++;
      if (layout === 'rings'){
        const cs = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="([^"]*)"/g)].filter(m => m[4] !== 'none').map(m => ({ r: +m[3], fill: m[4] }));
        if (cs.length !== 3 || !(cs[0].r > cs[1].r && cs[1].r > cs[2].r) || cs.some((c, i) => c.fill !== colors[i])) bad.push('rings ' + perm.join(''));
      } else {
        const ps = [...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+) A[\d.]+ [\d.]+ 0 0 1 ([-\d.]+) ([-\d.]+) Z" fill="([^"]*)"/g)];
        if (ps.length !== 3){ bad.push('sectors ' + perm.join('') + ': ' + ps.length + ' sectors'); continue; }
        ps.forEach((m, i) => {
          const ang = (x, y) => Math.round(((Math.atan2(+y - 40, +x - 40) * 180 / Math.PI) + 360) % 360), want0 = (270 + i * 120) % 360, want1 = (270 + (i + 1) * 120) % 360;
          if (m[7] !== colors[i] || ang(m[3], m[4]) !== want0 || ang(m[5], m[6]) !== want1) bad.push('sectors ' + perm.join('') + ' region ' + i);
        });
      }
    }
    // +1: every colour moves one region on (region 0 -> region 1 -> region 2 -> region 0); -1 the other way; the colour step puts every colour next to its pair partner
    const names = ['#FF6B6B', '#4C6FFF', '#FFD93D', '#06D6A0'], ctx = { mode: 'spin', layout: 'sectors', palette: [0, 1, 2], colours: names };
    for (let c = 0; c < 6; c++) for (let col = 0; col < 2; col++){
      const st = { orient: 0, nest: 0, cycle: c, colour: col, size: 0, fill: 0, count: 1, cap: 2 }, r = PERMS_T[c].map(i => names[i ^ col]);
      const plus = p.ctx.iqAnSpec(ctx, p.ctx.iqAnApply([['cycle', '+1']], st)).colors, minus = p.ctx.iqAnSpec(ctx, p.ctx.iqAnApply([['cycle', '-1']], st)).colors;
      const partner = p.ctx.iqAnSpec(ctx, p.ctx.iqAnApply([['colour', 'pair']], st)).colors;
      if (plus.join() !== [r[2], r[0], r[1]].join()) bad.push('+1 from colouring ' + c);
      if (minus.join() !== [r[1], r[2], r[0]].join()) bad.push('-1 from colouring ' + c);
      if (partner.join() !== r.map(x => names[names.indexOf(x) ^ 1]).join()) bad.push('colour step from colouring ' + c);
    }
    return { pass: !bad.length, info: checked + ' drawings' + (bad.length ? ' | WRONG: ' + bad.slice(0, 4).join(' | ') : ', all six colourings, both layouts, both directions') };
  });
  test('ANA-13 logical wrong answers and visual load: in a classic swap question a half-finished swap is always among the wrong answers, in a rotating-colour question a figure where one colour stayed put is, in a cutting question a cut whose pieces did not move apart is; no rotating-colour or inner/outer group has more than 2 figures', () => {
    const p = H.loadProject(); p.seed(93); const bad = []; let swapQ = 0, swapHit = 0, spinQ = 0, spinHit = 0, cutQ = 0, cutHit = 0, loadMax = 0;
    for (let i = 0; i < 4 * N; i++){
      const q = p.ctx.iqAnalogyPick(1 + (i % 7)), mode = q.ctx.mode;
      const all = [q.A, q.A2, q.B, q.B2, q.C, q.C2, q.E, q.E2].concat(q.wrong || [], (q.pairs || []).flat()).filter(Boolean);
      if (mode === 'nested' || mode === 'spin') all.forEach(st => { loadMax = Math.max(loadMax, st.count); });
      if (q.design !== 'classic') continue;                                       // (the split-rule design has its own wrong answers: the two "only one part" pictures, checked in ANA-3)
      if (mode === 'nested' && q.rule.some(s => s[0] === 'nest')){ swapQ++; if (q.wrong.some(w => w.nest >= 2)) swapHit++; }
      if (mode === 'parts' && q.rule.some(s => s[0] === 'cut' && s[1] !== 'join')){ cutQ++; if (q.wrong.some(w => w.cut >= 5)) cutHit++; }
      if (mode === 'spin'){
        spinQ++;
        // a colouring where exactly one region keeps the colour it had in B (the other two traded places): "one colour did not rotate"
        if (q.wrong.some(w => PERMS_T[w.cycle].filter((c, r) => c === PERMS_T[q.B.cycle][r]).length === 1)) spinHit++;
      }
    }
    if (loadMax > 2) bad.push('a rotating-colour or inner/outer group has ' + loadMax + ' figures');
    if (!swapQ || swapHit !== swapQ) bad.push('half-finished swap among the wrong answers in ' + swapHit + ' of ' + swapQ + ' swap questions');
    if (!cutQ || cutHit !== cutQ) bad.push('a cut whose pieces did not move apart among the wrong answers in ' + cutHit + ' of ' + cutQ + ' cutting questions');
    if (!spinQ || spinHit !== spinQ) bad.push('a colour that did not move among the wrong answers in ' + spinHit + ' of ' + spinQ + ' rotating-colour questions');
    return { pass: !bad.length, info: 'swap questions ' + swapHit + '/' + swapQ + ' | cutting questions ' + cutHit + '/' + cutQ + ' | rotating-colour questions ' + spinHit + '/' + spinQ + ' | largest group ' + loadMax + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('ANA-15 merge drawing: 10 merge rules counted here independently; the 3 x 3 board is drawn square by square with the colours of the state, inside its drawing area, and the real renderer shows the two layers, the result and the four answers exactly as the question says', () => {
    const p = H.loadProject(); p.seed(95); const bad = [];
    const prod = p.evalIn('IQ_AN_MERGE_RULES.map(r => r.key).sort().join()'), mine = MERGE_LIB.map(mergeKey).sort().join();
    if (MERGE_LIB.length !== 10) bad.push('test-side merge library has ' + MERGE_LIB.length + ' rules');
    if (prod !== mine) bad.push('production and test merge libraries differ');
    const rects = svg => [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="3" fill="([^"]*)"/g)].map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], fill: m[5] }));
    let boards = 0;
    for (let k = 0; k < 120; k++){
      const cells = Array.from({ length: 9 }, () => (Math.random() < 0.5 ? ['#2B3A8F', '#FFD93D', '#FF6B6B'][Math.floor(Math.random() * 3)] : ''));
      const svg = p.ctx.renderShapeSVG({ type: 'grid', color: '#3A3352', cells }), rs = rects(svg), vb = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg).slice(1).map(Number); boards++;
      if (rs.length !== 9){ bad.push('a board has ' + rs.length + ' squares'); break; }
      rs.forEach((r, i) => {
        if ((cells[i] ? cells[i] : '#3A3352') !== r.fill) bad.push('square ' + i + ' has the wrong colour');
        const col = i % 3, row = Math.floor(i / 3), c0 = rs[0];
        if (Math.abs(r.x - (c0.x + col * (r.w + 3))) > 0.2 || Math.abs(r.y - (c0.y + row * (r.h + 3))) > 0.2) bad.push('square ' + i + ' is not on the 3 x 3 grid');
        if (r.x < vb[0] || r.y < vb[1] || r.x + r.w > vb[0] + vb[2] || r.y + r.h > vb[1] + vb[3]) bad.push('square ' + i + ' is outside the drawing area');
      });
    }
    const boardOf = (html, pal) => [...html.matchAll(/<svg\b[^>]*>(.*?)<\/svg>/g)].map(m => rects(m[0]).map(r => ({ [pal.dark]: 'D', [pal.light]: 'L', [pal.third]: 'T' })[r.fill] || '.').join(''));
    for (let k = 0; k < 60; k++){
      const q = pickDesign(p, 'merge', 4 + (k % 4)), pal = q.ctx.palette, r = fakeRender(p, q);
      const layer = (m, c) => m.map(v => (v ? c : '.')).join(''), res = z => z.map(c => ['.', 'D', 'L', 'T'][c]).join('');
      const want = [];
      q.rows.forEach(row => want.push(layer(row.X, 'D'), layer(row.Y, 'L'), res(row.Z)));
      want.push(layer(q.Q.X, 'D'), layer(q.Q.Y, 'L'));
      const got = boardOf(r.prompt, pal);
      if (got.join() !== want.join()) bad.push('the prompt does not show the question (' + got.length + ' boards)');
      const opts = r.options.map(h => boardOf(h, pal)[0]).sort().join(), wantOpts = [q.answer].concat(q.wrong).map(res).sort().join();
      if (opts !== wantOpts) bad.push('the four answers are not the four pictures of the question');
      if (r.results.filter(v => v === true).length !== 1) bad.push('not exactly one correct option');
      if (!/^הכלל/.test(r.expl)) bad.push('no rule shown');
      if (bad.length > 3) break;
    }
    return { pass: !bad.length, info: boards + ' boards drawn, 60 merge questions rendered' + (bad.length ? ' | WRONG: ' + bad.slice(0, 3).join(' | ') : ', every square as the state says') };
  });
  test('ANA-16 the new designs by level: split-rule, pair-odd and merge arrive only from level 4, each is a minor twist (merge and split-rule about a tenth of the questions each, logic and parts figures about an eighth each, at level 4 and up), and in split-rule every question has two examples that each show only one part', () => {
    const p = H.loadProject(); p.seed(96); const bad = []; const share = {}; const modeShare = {}; let n = 0, partialLooks = 0, splitQ = 0;
    for (let t = 1; t <= 7; t++) for (let i = 0; i < 300; i++){
      const q = p.ctx.iqAnalogyPick(t);
      if (['logic', 'parts'].includes(q.ctx.mode) && t <= 3) bad.push('a ' + q.ctx.mode + ' figure at level ' + t);
      if (t >= 4) modeShare[q.ctx.mode] = (modeShare[q.ctx.mode] || 0) + 1;
      if (t <= 3 && q.design !== 'classic') bad.push('level ' + t + ' has a ' + q.design + ' question');
      if (t >= 4){ n++; share[q.design] = (share[q.design] || 0) + 1; }
      if (q.design === 'split-rule'){                                              // each example shows a part that is shorter than the whole rule (the parts themselves are checked step by step in ANA-3)
        splitQ++;
        if (q.parts.length === 2 && q.parts.every(part => part.length >= 1 && part.length < q.rule.length)) partialLooks++;
      }
    }
    const pct = d => 100 * (share[d] || 0) / n;
    ['split-rule', 'merge'].forEach(d => { if (pct(d) < 7 || pct(d) > 18) bad.push(d + ' is ' + pct(d).toFixed(0) + '% of the questions from level 4'); });
    if (pct('classic') < 55) bad.push('classic is only ' + pct('classic').toFixed(0) + '%');
    ['logic', 'parts'].forEach(m => { const v = 100 * (modeShare[m] || 0) / n; if (v < 8 || v > 18) bad.push(m + ' figures are ' + v.toFixed(0) + '% of the questions from level 4'); });
    if (partialLooks !== splitQ) bad.push('a split-rule example shows the whole rule (' + (splitQ - partialLooks) + ' of ' + splitQ + ')');
    return { pass: !bad.length, info: n + ' questions from level 4 | ' + Object.keys(share).map(d => d + ' ' + pct(d).toFixed(0) + '%').join(', ') + ' | figures: logic ' + (100 * (modeShare.logic || 0) / n).toFixed(0) + '%, parts ' + (100 * (modeShare.parts || 0) / n).toFixed(0) + '%' + (bad.length ? ' | WRONG: ' + bad.slice(0, 3).join(' | ') : '') };
  });
  test('ANA-17 one-screen layout (the CSS rules that keep the question, the explanation and the "next" button on one screen): tiles sized from the window height, examples side by side, tighter spacing - the real fit is measured in a browser', () => {
    const css = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'css', 'iq.css'), 'utf8'), bad = [];
    if (!/\.iq-options\.iq-options-grow\s*\{[^}]*--odd-tile:\s*clamp\([^}]*\d+vh/.test(css)) bad.push('the answer tiles do not depend on the window height');
    if (!/\.iq-an-prompt\s*\{[^}]*--an-tile:\s*clamp\([^}]*\d+vh/.test(css)) bad.push('the example tiles do not depend on the window height');
    if (!/\.iq-an-prompt\s*\{[^}]*flex-direction:\s*row;[^}]*flex-wrap:\s*wrap/.test(css)) bad.push('the examples are not side by side');
    if (!/#iq-analogy\s*\{\s*gap:\s*([0-9])px/.test(css)) bad.push('no tighter spacing for the analogy screen');
    if (!/\.iq-an-prompt \.iq-tile\s*\{[^}]*width:\s*var\(--an-tile\)/.test(css)) bad.push('the example tiles ignore the size variable');
    const p = H.loadProject(); p.seed(97); const q = pickDesign(p, 'merge', 5), prompt = p.ctx.document.createElement('div'), opts = p.ctx.document.createElement('div');
    p.ctx.iqAnalogyRenderEngine(q, prompt, opts, () => {});
    if (!prompt.classList.contains('iq-an-prompt')) bad.push('the prompt does not get the compact class');
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'height-based tiles, side-by-side examples, compact class applied' };
  });
  test('ANA-18 logic drawing: for every pair of shapes, direction and operation the picture is checked point by point - which colour covers a point is what the operation says about being in the first shape, the second, or both (shapes defined here from their corners); every region is big enough to see', () => {
    const p = H.loadProject(), bad = []; let points = 0, pictures = 0;
    const N = { triangle: 3, square: 4, pentagon: 5 }, START = { triangle: -90, square: -45, pentagon: -90 };
    const inShape = (kind, cx, cy, R, x, y) => {
      if (kind === 'circle') return Math.hypot(x - cx, y - cy) < R;
      const n = N[kind], ap = R * Math.cos(Math.PI / n);
      for (let k = 0; k < n; k++){ const a = (START[kind] + (k + 0.5) * 360 / n) * Math.PI / 180; if ((x - cx) * Math.cos(a) + (y - cy) * Math.sin(a) > ap) return false; }
      return true;
    };
    const polyIn = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > y) !== (pts[j][1] > y) && x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c; return c; };
    const elements = svg => [...svg.matchAll(/<polygon points="([^"]*)" fill="([^"]*)"|<path d="([^"]*)" fill-rule="evenodd" fill="([^"]*)"/g)].map(m => m[1] !== undefined
      ? { polys: [m[1].trim().split(' ').map(q => q.split(',').map(Number))], fill: m[2], eo: false }
      : { polys: m[3].split('Z').filter(x => x.trim()).map(seg => [...seg.matchAll(/[ML]\s*([-\d.]+) ([-\d.]+)/g)].map(q => [+q[1], +q[2]])), fill: m[4], eo: true });
    const colourAt = (els, x, y) => { let c = null; els.forEach(e => { if (e.fill === 'none') return; const n = e.polys.filter(pt => polyIn(pt, x, y)).length; if (e.eo ? n % 2 === 1 : n >= 1) c = e.fill; }); return c; };
    const area = (a, b, dir, R, d) => {                                                      // the three region sizes, by counting half-pixel squares
      const ux = Math.cos(dir * Math.PI / 180), uy = Math.sin(dir * Math.PI / 180), v = { only1: 0, only2: 0, both: 0 };
      for (let x = 0; x < 80; x += 0.5) for (let y = 0; y < 80; y += 0.5){ const i1 = inShape(a, 40 - d * ux, 40 - d * uy, R, x, y), i2 = inShape(b, 40 + d * ux, 40 + d * uy, R, x, y); if (i1 && i2) v.both += 0.25; else if (i1) v.only1 += 0.25; else if (i2) v.only2 += 0.25; }
      return v;
    };
    const types = ['circle', 'square', 'triangle', 'pentagon'], C = { c1: '#FF6B6B', c2: '#4C6FFF', c3: '#FFD93D' };
    for (const dir of [0, 90, 45]){
      const valid = p.evalIn('iqAnLogicPairs(' + dir + ')').map(pr => pr.join('/')), seen = new Set();
      types.forEach((a, i) => types.forEach((b, j) => {
        if (j <= i) return;
        const v = area(a, b, dir, 80 * 0.30, 80 * 0.13), least = Math.min(v.only1, v.only2, v.both), ok = valid.includes(a + '/' + b);
        if (ok && least < 270) bad.push(a + '/' + b + ' dir ' + dir + ' is allowed but a region is only ' + least.toFixed(0));
        if (!ok && least >= 330) bad.push(a + '/' + b + ' dir ' + dir + ' is not allowed although every region is big enough');
        if (!ok) return;
        seen.add(a + '/' + b);
        for (const scale of [1, 1.3]) for (const op of ['none', 'and', 'xor', 'aNotB', 'bNotA', 'union']){
          const R = 80 * 0.30 * scale, d = 80 * 0.13 * scale, ux = Math.cos(dir * Math.PI / 180), uy = Math.sin(dir * Math.PI / 180);
          const svg = p.ctx.renderShapeSVG({ type: 'logic', a, b, dir, op, color: C.c1, color2: C.c2, color3: C.c3, scale, count: 1, hollow: false }), els = elements(svg); pictures++;
          for (let k = 0; k < 400; k++){
            const x = 4 + Math.random() * 72, y = 4 + Math.random() * 72, in1 = inShape(a, 40 - d * ux, 40 - d * uy, R, x, y), in2 = inShape(b, 40 + d * ux, 40 + d * uy, R, x, y);
            const edge = inShape(a, 40 - d * ux, 40 - d * uy, R - 3, x, y) !== inShape(a, 40 - d * ux, 40 - d * uy, R + 3, x, y) || inShape(b, 40 + d * ux, 40 + d * uy, R - 3, x, y) !== inShape(b, 40 + d * ux, 40 + d * uy, R + 3, x, y);
            if (edge) continue;
            const want = op === 'none' ? (in2 ? C.c2 : in1 ? C.c1 : null)                                          // the second shape is drawn on top of the first
              : op === 'and' ? (in1 && in2 ? C.c3 : null)
              : op === 'xor' ? (in1 && !in2 ? C.c1 : in2 && !in1 ? C.c2 : null)
              : op === 'aNotB' ? (in1 && !in2 ? C.c1 : null)
              : op === 'bNotA' ? (in2 && !in1 ? C.c2 : null)
              : (in1 || in2 ? C.c3 : null);
            points++;
            if (colourAt(els, x, y) !== want){ bad.push(a + '/' + b + ' dir ' + dir + ' ' + op + ' scale ' + scale + ': the point (' + x.toFixed(1) + ', ' + y.toFixed(1) + ') is ' + colourAt(els, x, y) + ', expected ' + want); break; }
          }
          if (bad.length > 3) return;
        }
      }));
      if (seen.size < 4) bad.push('dir ' + dir + ': fewer than four allowed pairs');
    }
    // outline only: no fills at all in a result; the union has a single outline (a path), the others the outlines of their regions
    for (const op of ['and', 'xor', 'aNotB', 'bNotA', 'union']){
      const svg = p.ctx.renderShapeSVG({ type: 'logic', a: 'circle', b: 'square', dir: 0, op, color: C.c1, color2: C.c2, color3: C.c3, scale: 1, count: 1, hollow: true });
      if (/fill="(#|rgb)/.test(svg)) bad.push(op + ' outline only still has a fill');
    }
    // the states: every operation is a different picture, and every colour step and size is visible
    const ctx = { mode: 'logic', colours: ['#FF6B6B', '#4ECDC4', '#FFD93D', '#9B5DE5'], dir: 0, pairs: [['circle', 'square'], ['square', 'triangle'], ['triangle', 'pentagon'], ['circle', 'triangle']] };
    const st = o => ({ orient: 0, nest: 0, cycle: 0, op: o, cut: 0, cfg: 0, colour: 0, size: 0, fill: 0, count: 1, cap: 1 });
    if (new Set([0, 1, 2, 3, 4, 5].map(o => p.ctx.renderShapeSVG(p.ctx.iqAnSpec(ctx, st(o))))).size !== 6) bad.push('the six states (given + five operations) are not six different pictures');
    for (const o of [0, 1, 2, 3, 4, 5]){
      const base = p.ctx.renderShapeSVG(p.ctx.iqAnSpec(ctx, st(o)));
      for (const change of [{ colour: 1 }, { size: 1 }, { fill: 1 }]) if (base === p.ctx.renderShapeSVG(p.ctx.iqAnSpec(ctx, Object.assign(st(o), change)))) bad.push('state ' + o + ': a change of ' + Object.keys(change)[0] + ' cannot be seen');
    }
    return { pass: !bad.length, info: pictures + ' pictures, ' + points + ' points checked' + (bad.length ? ' | WRONG: ' + bad.slice(0, 3).join(' | ') : ', every region as the operation says') };
  });
  test('ANA-19 parts drawing: every cut of every shape gives the right number of pieces (2, 2, 4, 3) that together are exactly the whole shape (areas and points), do not overlap, are really moved apart - or really touch when they were not moved - and move away from the centre', () => {
    const p = H.loadProject(), bad = []; let drawings = 0;
    const polys = svg => [...svg.matchAll(/<polygon points="([^"]*)"/g)].map(m => m[1].trim().split(' ').map(q => q.split(',').map(Number)));
    const area = pts => Math.abs(pts.reduce((s, q, i) => { const r = pts[(i + 1) % pts.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
    const centroid = pts => [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
    const polyIn = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > y) !== (pts[j][1] > y) && x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c; return c; };
    const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
    const polyDist = (P, Q) => Math.min(...P.map(v => Math.min(...Q.map((w, i) => segDist(v[0], v[1], w, Q[(i + 1) % Q.length])))), ...Q.map(v => Math.min(...P.map((w, i) => segDist(v[0], v[1], w, P[(i + 1) % P.length])))));
    const SIDES = { circle: 48, triangle: 3, square: 4, pentagon: 5, hexagon: 6 }, COUNT = { v: 2, d: 2, q: 4, t: 3 };
    for (const shape of Object.keys(SIDES)) for (const scale of [1, 1.3]){
      const draw = cut => polys(p.ctx.renderShapeSVG({ type: 'parts', shape, cut, color: '#FF6B6B', color2: '#4C6FFF', scale, count: 1, hollow: false }));
      const whole = draw(0); drawings++;
      if (whole.length !== 1 || whole[0].length !== SIDES[shape]) bad.push(shape + ': the whole shape has ' + (whole[0] || []).length + ' corners');
      const R = 80 * 0.34 * scale, expectArea = shape === 'circle' ? Math.PI * R * R : 0.5 * SIDES[shape] * R * R * Math.sin(2 * Math.PI / SIDES[shape]);
      if (Math.abs(area(whole[0]) - expectArea) / expectArea > 0.01) bad.push(shape + ': the whole shape has the wrong size');
      if (shape === 'square'){ const xs = new Set(whole[0].map(q => q[0])); if (xs.size !== 2) bad.push('the square does not stand on its side'); }
      for (let cut = 1; cut <= 8; cut++){
        const kind = 'vdqt'[(cut - 1) % 4], moved = cut <= 4, pieces = draw(cut); drawings++;
        if (pieces.length !== COUNT[kind]){ bad.push(shape + ' cut ' + cut + ': ' + pieces.length + ' pieces, expected ' + COUNT[kind]); continue; }
        const total = pieces.reduce((s, q) => s + area(q), 0);
        if (Math.abs(total - area(whole[0])) / area(whole[0]) > 0.02) bad.push(shape + ' cut ' + cut + ': the pieces together are ' + total.toFixed(0) + ', the shape ' + area(whole[0]).toFixed(0));
        if ((kind === 'v' || kind === 'd') && (shape === 'circle' || shape === 'square') && Math.abs(area(pieces[0]) - area(pieces[1])) / total > 0.01) bad.push(shape + ' cut ' + cut + ': the halves are not equal');
        for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++){
          const dist = polyDist(pieces[i], pieces[j]);
          if (moved && dist < 3) bad.push(shape + ' cut ' + cut + ': pieces ' + i + ' and ' + j + ' are only ' + dist.toFixed(1) + ' apart');
          if (!moved && dist > 0.3) bad.push(shape + ' cut ' + cut + ': pieces ' + i + ' and ' + j + ' are ' + dist.toFixed(1) + ' apart although they were not moved');
        }
        if (!moved){                                                                                // not moved: together they cover exactly the whole shape, point by point
          for (let k = 0; k < 300; k++){ const x = 8 + Math.random() * 64, y = 8 + Math.random() * 64, edgeNear = whole[0].some((q, i) => segDist(x, y, q, whole[0][(i + 1) % whole[0].length]) < 1) || pieces.some(pc => pc.some((q, i) => segDist(x, y, q, pc[(i + 1) % pc.length]) < 1));
            if (edgeNear) continue;
            const n = pieces.filter(pc => polyIn(pc, x, y)).length;
            if (n !== (polyIn(whole[0], x, y) ? 1 : 0)){ bad.push(shape + ' cut ' + cut + ': a point is covered ' + n + ' times'); break; } }
        } else {                                                                                    // moved: every piece sits further from the centre than the same piece unmoved
          const together = draw(cut + 4);
          pieces.forEach((pc, i) => { const gain = Math.hypot(...centroid(pc).map(v => v - 40)) - Math.hypot(...centroid(together[i]).map(v => v - 40)); if (gain < 80 * 0.08 * scale - 0.6) bad.push(shape + ' cut ' + cut + ': piece ' + i + ' moved only ' + gain.toFixed(1) + ' outwards'); });
        }
        if (bad.length > 4) break;
      }
    }
    return { pass: !bad.length, info: drawings + ' drawings' + (bad.length ? ' | WRONG: ' + bad.slice(0, 3).join(' | ') : ', pieces, areas, gaps and directions as the cut says') };
  });
  return out;
}

module.exports = { run };
