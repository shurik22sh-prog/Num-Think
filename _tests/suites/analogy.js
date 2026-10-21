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
const ORDER = ['orient', 'nest', 'cycle', 'colour', 'size', 'fill', 'count'];
const OPS = { orient: ['+90', '-90', '180', 'flipH', 'flipV'], nest: ['swap'], cycle: ['+1', '-1'], colour: ['pair'], size: ['flip'], fill: ['flip'], count: ['+1', '-1'] };
const MODE_ATTRS = { glyph: ['orient', 'colour', 'size', 'fill', 'count'], shapes: ['colour', 'size', 'fill', 'count'], nested: ['nest', 'colour', 'size', 'fill', 'count'], spin: ['cycle', 'colour', 'size', 'count'] };
const MUST = { glyph: ['orient', 'fill'], shapes: ['fill'], nested: ['nest'], spin: ['cycle'] };
const CAPS = { glyph: 2, nested: 2, spin: 2, shapes: 4 };
const PERMS_T = [[0, 1, 2], [2, 0, 1], [1, 2, 0], [0, 2, 1], [2, 1, 0], [1, 0, 2]];          // region -> palette colour, six ways
// a test-side figure: {pts (glyph outline or null), colour, size, fill, count, cap, nest {outer, inner, cols} (shape in shape), regions (the colours of the three regions)}
function figure(p, ctx, st){
  const f = { pts: null, colour: st.colour, size: st.size, fill: st.fill, count: st.count, cap: CAPS[ctx.mode], nest: null, regions: null };
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
const canon = f => JSON.stringify([f.pts ? ptsKey(f.pts) : null, f.colour, f.size, f.fill, f.count, f.nest, f.regions]);
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
const LIB = { glyph: library('glyph'), shapes: library('shapes'), nested: library('nested'), spin: library('spin') };
const ruleKey = r => r.map(s => s.join(' ')).join(' | ');
const asRule = r => r.map(s => s.slice());
const fitsAll = (lib, pairs) => lib.filter(r => pairs.every(([a, b]) => sameFig(applyRule(r, a), b)));
const look = canon;
const pickDesign = (p, key, tier) => p.evalIn('IQ_AN_DESIGNS').find(d => d.key === key).make(tier);

function checkQuestion(p, q){
  const e = [], lib = LIB[q.ctx.mode], rule = asRule(q.rule), F = st => figure(p, q.ctx, st);
  if (!lib.some(r => ruleKey(r) === ruleKey(rule))) e.push('the rule is not in the library');
  if (q.ctx.colours.length !== 4 || new Set(q.ctx.colours).size !== 4) e.push('colour palette');
  const all = [q.A, q.A2, q.B, q.B2, q.C, q.C2, q.E, q.E2].concat(q.wrong || [], (q.pairs || []).flat()).filter(Boolean);
  if (all.some(st => st.count < 1 || st.count > 4)) e.push('a group has more than 4 shapes');
  if (q.ctx.mode !== 'shapes' && all.some(st => st.count > 2)) e.push('a ' + q.ctx.mode + ' group has more than 2 copies');
  if (q.design === 'classic' || q.design === 'two-examples'){
    const exs = [[q.A, q.A2]].concat(q.design === 'two-examples' ? [[q.C, q.C2]] : []);
    exs.forEach(([a, b]) => { if (!sameFig(applyRule(rule, F(a)), F(b))) e.push('an example does not follow the rule (checked on the points)'); });
    if (!sameFig(applyRule(rule, F(q.B)), F(q.B2))) e.push("B' is not the rule applied to B (checked on the points)");
    const fit = fitsAll(lib, exs.map(([a, b]) => [F(a), F(b)]));
    if (!fit.some(r => ruleKey(r) === ruleKey(rule))) e.push('the rule does not fit its own examples');
    fit.forEach(r => { const o = applyRule(r, F(q.B)); if (o && !sameFig(o, F(q.B2))) e.push('a rule that fits the examples gives another answer for B: ' + ruleKey(r)); });
    if (q.design === 'two-examples' && fit.length !== 1) e.push('the two examples do not settle one rule');
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
  test('ANA-1 library: 79 glyph rules, 9 plain-shape rules, 14 inner/outer rules and 18 rotating-colour rules, counted here independently; each has the visual change of its kind; no arithmetic or modulo steps', () => {
    const p = H.loadProject(), bad = [], modes = ['glyph', 'shapes', 'nested', 'spin'];
    const prod = p.evalIn("['glyph', 'shapes', 'nested', 'spin'].map(m => iqAnLibrary(m).length)"), mine = modes.map(m => LIB[m].length);
    if (mine.join() !== '79,9,14,18') bad.push('test-side counts ' + mine.join());
    if (prod.join() !== mine.join()) bad.push('production counts ' + prod.join());
    modes.forEach(m => { if (p.evalIn("iqAnLibrary('" + m + "').map(iqAnKey).sort().join('#')") !== LIB[m].map(ruleKey).sort().join('#')) bad.push(m + ' libraries differ'); });
    const ops = JSON.stringify(p.evalIn('IQ_AN_OPS'));
    if (/x2|half|\+2|skip2|mod3|byCount|\+45|\+135/.test(ops)) bad.push('a removed step still exists: ' + ops);
    modes.forEach(m => { if (LIB[m].some(r => r.length < 2 || r.length > 3 || new Set(r.map(s => s[0])).size !== r.length || !r.some(s => MUST[m].includes(s[0])))) bad.push(m + ': rules are not 2-3 steps on different attributes with the visual change of their kind'); });
    if (p.evalIn('Object.keys(IQ_GLYPHS).length') < 20) bad.push('too few glyphs');
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : mine.join(' + ') + ' rules, identical in production and test, ' + p.evalIn('Object.keys(IQ_GLYPHS).length') + ' glyphs' };
  });
  ['classic', 'two-examples', 'pair-odd'].forEach((key, k) => {
    test('ANA-' + (2 + k) + ' ' + key + ': ' + N + ' questions checked against the independent library, turns and reflections verified on the points', () => {
      const p = H.loadProject(); p.seed(80 + k); const bad = []; let invalid = 0, ex = null; const rules = new Set();
      const tiers = key === 'classic' ? [1, 2, 3, 4, 5, 6, 7] : [4, 5, 6, 7];
      for (let i = 0; i < N; i++){
        const t = tiers[i % tiers.length], q = pickDesign(p, key, t), errs = checkQuestion(p, q);
        const n = q.rule.length; if (t <= 2 && n !== 2) errs.push('level ' + t + ' rule has ' + n + ' steps'); if (t >= 5 && n !== 3) errs.push('level ' + t + ' rule has ' + n + ' steps');
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
      const key = ['classic', 'two-examples', 'pair-odd'][i % 3], q = pickDesign(p, key, key === 'classic' ? 1 + (i % 7) : 4 + (i % 4)), r = fakeRender(p, q);
      const svgs = h => (h.match(/<svg\b/g) || []).length, wantPrompt = { classic: 3, 'two-examples': 5, 'pair-odd': 2 }[key];
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
      if (t >= 4 && !(byTier[t].has('classic') && byTier[t].has('two-examples') && byTier[t].has('pair-odd'))) bad.push('a design is missing at level ' + t);
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
      [...svg.matchAll(/<g transform="translate\(([-\d.]+) 0\)">|<\/g>|<polygon points="([^"]*)"[^>]*?stroke-width="([\d.]+)"|<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"[^>]*?stroke-width="([\d.]+)"/g)].forEach(m => {
        if (m[1] !== undefined) dx = +m[1];
        else if (m[0] === '</g>') dx = 0;
        else if (m[2] !== undefined) m[2].trim().split(' ').forEach(q => { const [x, y] = q.split(',').map(Number); widen(x + dx, y, +m[3] / 2); });
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
      states.forEach(st => { groups++; seenCounts.add(st.count); if (st.count > 4 || st.count < 1) bad.push('count ' + st.count + ' at level ' + t); });
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
  test('ANA-10 emphasis: turns/reflections, inner/outer swaps and rotating colours each carry about a quarter to a third of the rules; every rule has the visual change of its kind; a number step is secondary', () => {
    const p = H.loadProject(); p.seed(90); const bad = []; let n = 0, must = 0, count = 0; const has = { orient: 0, nest: 0, cycle: 0 }, modes = {};
    for (let i = 0; i < 2000; i++){
      const q = p.ctx.iqAnalogyPick(1 + (i % 7)); n++; modes[q.ctx.mode] = (modes[q.ctx.mode] || 0) + 1;
      if (q.rule.some(s => MUST[q.ctx.mode].includes(s[0]))) must++;
      ['orient', 'nest', 'cycle'].forEach(a => { if (q.rule.some(s => s[0] === a)) has[a]++; });
      if (q.rule.some(s => s[0] === 'count')) count++;
    }
    const pct = v => 100 * v / n;
    if (must !== n) bad.push((n - must) + ' rules without the visual change of their kind');
    ['orient', 'nest', 'cycle'].forEach(a => { if (pct(has[a]) < 18 || pct(has[a]) > 45) bad.push(a + ' rules are ' + pct(has[a]).toFixed(0) + '%'); });
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
  test('ANA-13 logical wrong answers and visual load: in a swap question a half-finished swap is always among the wrong answers, in a rotating-colour question a figure where one colour stayed put is; no rotating-colour or inner/outer group has more than 2 figures', () => {
    const p = H.loadProject(); p.seed(93); const bad = []; let swapQ = 0, swapHit = 0, spinQ = 0, spinHit = 0, loadMax = 0;
    for (let i = 0; i < 4 * N; i++){
      const q = p.ctx.iqAnalogyPick(1 + (i % 7)), mode = q.ctx.mode;
      const all = [q.A, q.A2, q.B, q.B2, q.C, q.C2, q.E, q.E2].concat(q.wrong || [], (q.pairs || []).flat()).filter(Boolean);
      if (mode === 'nested' || mode === 'spin') all.forEach(st => { loadMax = Math.max(loadMax, st.count); });
      if (q.design === 'pair-odd') continue;
      if (mode === 'nested' && q.rule.some(s => s[0] === 'nest')){ swapQ++; if (q.wrong.some(w => w.nest >= 2)) swapHit++; }
      if (mode === 'spin'){
        spinQ++;
        // a colouring where exactly one region keeps the colour it had in B (the other two traded places): "one colour did not rotate"
        if (q.wrong.some(w => PERMS_T[w.cycle].filter((c, r) => c === PERMS_T[q.B.cycle][r]).length === 1)) spinHit++;
      }
    }
    if (loadMax > 2) bad.push('a rotating-colour or inner/outer group has ' + loadMax + ' figures');
    if (!swapQ || swapHit !== swapQ) bad.push('half-finished swap among the wrong answers in ' + swapHit + ' of ' + swapQ + ' swap questions');
    if (!spinQ || spinHit !== spinQ) bad.push('a colour that did not move among the wrong answers in ' + spinHit + ' of ' + spinQ + ' rotating-colour questions');
    return { pass: !bad.length, info: 'swap questions ' + swapHit + '/' + swapQ + ' | rotating-colour questions ' + spinHit + '/' + spinQ + ' | largest group ' + loadMax + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  return out;
}

module.exports = { run };
