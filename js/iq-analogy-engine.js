'use strict';

/* ============ Shape analogies: the rule-library engine ============ */
// The same idea as the "induce" family of the odd-one-out game, applied to A : A' :: B : ?
// A RULE is a list of two or three STEPS on different attributes of a group of figures, and every rule contains at least one
// classic VISUAL change: a turn or a reflection of an asymmetric figure ("orient"), or filled <-> outline only ("fill").
// Colour swaps and size changes come along as supporting steps, and a change of the NUMBER of figures (+1 / -1) is only a
// secondary step in about one rule of four. A question is built from a rule, and the library is searched exhaustively so that
//   - the shown example(s) identify the rule,
//   - the right answer is the rule applied to B,
//   - every wrong answer is a plausible mistake: the result of a NEIGHBOUR rule (one step different) that the examples rule
//     out, or the result of forgetting one step.
// Three question designs:
//   classic        A -> A', B -> ?                            (one example)
//   two-examples   A -> A', C -> C', B -> ?                   (two examples with different starting figures)
//   pair-odd       a rule example, and four more pairs: three follow the rule, one does not (find it)
// A state is {orient 0-7, colour 0-3, size 0/1, fill 0/1, count 1-4}. orient = 4 x mirrored + quarter-turns clockwise.
// `ctx` says which figure the question uses: a "glyph" (an asymmetric outline, so turns and reflections show) or a plain
// shape ("shapes" questions have no turns or reflections, so their rules always contain the fill step).

// HARD LIMIT: a group never holds more than this many shapes (in the pictures shown, the examples AND every answer).
// More than four makes the tiles crowded and the shapes too small to compare.
const IQ_AN_MAX_COUNT = 4;
// Turns and reflections of an asymmetric figure are hard to read when the figure is drawn small, so a glyph question uses at most two copies
const IQ_AN_GLYPH_MAX_COUNT = 2;
let IQ_AN_AVOID_REPEAT = true;                       // switchable for tests that need seeded sequences
const IQ_AN_LAST = { design: null, rule: null };
const IQ_AN_ATTRS = ['orient', 'colour', 'size', 'fill', 'count'];
const IQ_AN_OPS = {
  orient: ['+90', '-90', '180', 'flipH', 'flipV'],            // quarter-turn clockwise / anticlockwise, half-turn, reflection left-right, reflection top-bottom
  colour: ['pair'], size: ['flip'], fill: ['flip'], count: ['+1', '-1']
};
const IQ_AN_MUST_HAVE = ['orient', 'fill'];                   // every rule has at least one of these classic visual changes
const IQ_AN_SHAPE_TYPES = ['square', 'triangle', 'pentagon', 'hexagon', 'circle'];
// glyphs: the flag of the odd-one-out game and the chiral cell shapes of 5 and 6 cells (all with no symmetry at all), scaled to the same size
(function registerGlyphs(){
  const norm = pts => { const k = 24 / Math.max(...pts.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1])))); return pts.map(([x, y]) => [x * k, y * k]); };
  [5, 6].forEach(n => IQ_ODD_CELL_LIBRARY[n].forEach((shape, i) => { IQ_GLYPHS['c' + n + '-' + i] = norm(shape.outline); }));
})();

// the turn / mirror value after a step
function iqAnOrient(op, o){
  const r = o & 3, m = o >> 2;
  if (op === '+90') return m * 4 + (r + 1) % 4;
  if (op === '-90') return m * 4 + (r + 3) % 4;
  if (op === '180') return m * 4 + (r + 2) % 4;
  if (op === 'flipH') return (1 - m) * 4 + (4 - r) % 4;        // a mirror at the side: the figure is mirrored and its turn runs the other way
  return (1 - m) * 4 + (6 - r) % 4;                           // flipV, a mirror above: the turn becomes a half-turn minus the old one
}
function iqAnStep(attr, op, st){
  if (attr === 'orient') return iqAnOrient(op, st.orient);
  if (attr === 'colour') return st.colour ^ 1;
  if (attr === 'size' || attr === 'fill') return 1 - st[attr];
  const n = st.count + (op === '+1' ? 1 : -1);
  return n >= 1 && n <= st.cap ? n : null;                      // st.cap: the most copies this question allows (never more than IQ_AN_MAX_COUNT)
}
function iqAnApply(rule, st){
  const out = Object.assign({}, st);
  for (const [attr, op] of rule){ const v = iqAnStep(attr, op, out); if (v === null) return null; out[attr] = v; }
  return out;
}
const iqAnSame = (a, b) => a && b && IQ_AN_ATTRS.every(k => a[k] === b[k]);
const iqAnKey = rule => rule.map(s => s.join(' ')).join(' | ');
// the whole library for one mode
const IQ_AN_LIBRARY = {};
function iqAnLibrary(mode){
  if (IQ_AN_LIBRARY[mode]) return IQ_AN_LIBRARY[mode];
  const attrs = IQ_AN_ATTRS.filter(a => mode === 'glyph' || a !== 'orient');
  const out = [];
  const build = (start, chosen) => {
    if (chosen.length >= 2 && chosen.some(s => IQ_AN_MUST_HAVE.includes(s[0]))) out.push(chosen.slice());
    if (chosen.length === 3) return;
    for (let i = start; i < attrs.length; i++) IQ_AN_OPS[attrs[i]].forEach(op => build(i + 1, chosen.concat([[attrs[i], op]])));
  };
  build(0, []);
  IQ_AN_LIBRARY[mode] = out;
  return out;
}
const iqAnFits = (library, pairs) => library.filter(rule => pairs.every(([a, b]) => iqAnSame(iqAnApply(rule, a), b)));
const iqAnRandomState = mode => { const cap = mode === 'glyph' ? IQ_AN_GLYPH_MAX_COUNT : IQ_AN_MAX_COUNT; return { orient: mode === 'glyph' ? randInt(0, 7) : 0, colour: randInt(0, 3), size: randInt(0, 1), fill: randInt(0, 1), count: randInt(1, cap), cap }; };
function iqAnContext(mode){
  const pairs = shuffle(IQ_COLOR_PAIRS.slice()).slice(0, 2), colours = [pairs[0][0], pairs[0][1], pairs[1][0], pairs[1][1]];
  return { mode, glyph: mode === 'glyph' ? pickOne(Object.keys(IQ_GLYPHS)) : null, shape: mode === 'shapes' ? pickOne(IQ_AN_SHAPE_TYPES) : null, colours };
}
function iqAnSpec(ctx, st){
  const spec = { type: ctx.mode === 'glyph' ? 'glyph' : ctx.shape, color: ctx.colours[st.colour], count: st.count, scale: st.size ? 1.3 : 1, hollow: !!st.fill };
  if (ctx.mode === 'glyph'){ spec.glyph = ctx.glyph; spec.rotation = (st.orient & 3) * 90; spec.mirror = (st.orient >> 2) === 1; }
  return spec;
}
const iqAnSpecSame = (ctx, a, b) => iqSpecsEqual(iqAnSpec(ctx, a), iqAnSpec(ctx, b));

// ----- wrong answers: neighbour rules and "forgot a step" -----
function iqAnNeighbours(rule, library){
  return library.filter(r => r.length === rule.length && r.filter(s => rule.some(t => t[0] === s[0] && t[1] === s[1])).length === rule.length - 1);
}
function iqAnForgot(rule, st){                                               // apply every step but one
  return rule.map((_, skip) => iqAnApply(rule.filter((__, i) => i !== skip), st)).filter(Boolean);
}
function iqAnPickWrong(ctx, correct, candidates, library, rule, B){
  const keep = [];
  const add = st => { if (st && !iqAnSameSpec(ctx, st, correct) && !keep.some(k => iqAnSameSpec(ctx, k, st))) keep.push(st); };
  shuffle(candidates.filter(Boolean)).forEach(add);
  if (keep.length < 3) shuffle(iqAnForgot(rule, B)).forEach(add);
  if (keep.length < 3) shuffle(library.map(r => iqAnApply(r, B))).forEach(add);
  return keep.length >= 3 ? shuffle(keep.slice(0, 3)) : null;                 // the plausible mistakes come first and are the ones kept
}
const iqAnSameSpec = iqAnSpecSame;

// ----- plain-language description of a rule (shown after a correct answer) -----
const IQ_AN_COLOUR_NAME = { '#FF6B6B': 'אדום', '#4C6FFF': 'כחול', '#FFD93D': 'צהוב', '#06D6A0': 'ירוק', '#9B5DE5': 'סגול', '#FF8C42': 'כתום' };
function iqAnDescribe(ctx, rule){
  const nm = c => IQ_AN_COLOUR_NAME[c] || c;
  const parts = rule.map(([attr, op]) => {
    if (attr === 'count') return op === '+1' ? 'נוספת עוד צורה אחת' : 'נעלמת צורה אחת';
    if (attr === 'colour') return 'הצבע מתחלף בצבע הצמוד לו בזוג: ' + nm(ctx.colours[0]) + ' ו' + nm(ctx.colours[1]) + ', ' + nm(ctx.colours[2]) + ' ו' + nm(ctx.colours[3]);
    if (attr === 'size') return 'הצורה מתחלפת בין קטנה לגדולה';
    if (attr === 'fill') return 'צורה מלאה הופכת לחלולה (רק קו מתאר), וחלולה הופכת למלאה';
    return { '+90': 'הצורה מסתובבת רבע סיבוב עם כיוון השעון', '-90': 'הצורה מסתובבת רבע סיבוב נגד כיוון השעון', '180': 'הצורה מסתובבת חצי סיבוב', 'flipH': 'הצורה משתקפת ימין-שמאל, כמו במראה שעומדת לידה', 'flipV': 'הצורה משתקפת מעלה-מטה, כמו במראה שמונחת מתחתיה' }[op];
  });
  return parts.join(', ובנוסף ');
}

// ----- question designs -----
function iqAnStepsFor(tier){ return tier <= 2 ? 2 : (tier <= 4 ? (Math.random() < 0.5 ? 2 : 3) : 3); }
// about three rules in four have no change of the number of figures at all; the rest may add or remove one figure
function iqAnRule(library, tier){
  const n = iqAnStepsFor(tier), fresh = r => r.length === n && !(IQ_AN_AVOID_REPEAT && iqAnKey(r) === IQ_AN_LAST.rule);
  const withCount = r => r.some(st => st[0] === 'count'), wantCount = Math.random() >= 0.75;
  let pool = library.filter(r => fresh(r) && withCount(r) === wantCount);
  if (!pool.length) pool = library.filter(fresh);                                   // not the wanted kind of rule, but still a different one
  if (!pool.length) pool = library.filter(r => r.length === n);
  return pickOne(pool);
}
const iqAnPickMode = () => (Math.random() < 0.85 ? 'glyph' : 'shapes');
function iqAnClassic(tier){
  for (let attempt = 0; attempt < 400; attempt++){
    const mode = iqAnPickMode(), library = iqAnLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, tier);
    const A = iqAnRandomState(mode), B = iqAnRandomState(mode), A2 = iqAnApply(rule, A), B2 = iqAnApply(rule, B);
    if (!A2 || !B2 || iqAnSame(A, B) || iqAnSame(A, A2) || iqAnSame(B, B2)) continue;
    const fits = iqAnFits(library, [[A, A2]]);
    if (fits.some(f => { const r = iqAnApply(f, B); return r && !iqAnSame(r, B2); })) continue;           // the example must settle the answer
    const near = iqAnNeighbours(rule, library).filter(r => !fits.includes(r)).map(r => iqAnApply(r, B));
    const wrong = iqAnPickWrong(ctx, B2, near, library, rule, B);
    if (!wrong) continue;
    return { design: 'classic', ctx, rule, A, A2, B, B2, wrong, explanation: 'הכלל: ' + iqAnDescribe(ctx, rule) + '.' };
  }
  throw new Error('iqAnClassic: no valid question.');
}
function iqAnTwoExamples(tier){
  for (let attempt = 0; attempt < 600; attempt++){
    const mode = iqAnPickMode(), library = iqAnLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, Math.max(tier, 4));
    const A = iqAnRandomState(mode), C = iqAnRandomState(mode), B = iqAnRandomState(mode);
    const A2 = iqAnApply(rule, A), C2 = iqAnApply(rule, C), B2 = iqAnApply(rule, B);
    if (!A2 || !C2 || !B2 || iqAnSame(A, C) || iqAnSame(A, B) || iqAnSame(C, B) || iqAnSame(A, A2) || iqAnSame(C, C2) || iqAnSame(B, B2)) continue;
    const both = iqAnFits(library, [[A, A2], [C, C2]]);
    if (both.length !== 1 || iqAnKey(both[0]) !== iqAnKey(rule)) continue;                                   // the two examples settle the rule
    const near = iqAnNeighbours(rule, library).filter(r => !both.includes(r)).map(r => iqAnApply(r, B));
    const wrong = iqAnPickWrong(ctx, B2, near, library, rule, B);
    if (!wrong) continue;
    return { design: 'two-examples', ctx, rule, A, A2, C, C2, B, B2, wrong, explanation: 'הכלל: ' + iqAnDescribe(ctx, rule) + '.' };
  }
  throw new Error('iqAnTwoExamples: no valid question.');
}
function iqAnPairOdd(tier){
  for (let attempt = 0; attempt < 600; attempt++){
    const mode = iqAnPickMode(), library = iqAnLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, Math.max(tier, 4));
    const near = iqAnNeighbours(rule, library);
    if (!near.length) continue;
    const other = pickOne(near), states = [0, 1, 2, 3, 4].map(() => iqAnRandomState(mode));
    const E = states[0], xs = states.slice(1), oddIndex = randInt(0, 3);
    const E2 = iqAnApply(rule, E);
    const pairs = xs.map((x, i) => [x, iqAnApply(i === oddIndex ? other : rule, x)]);
    if (!E2 || iqAnSame(E, E2) || pairs.some(p => !p[1] || iqAnSame(p[0], p[1])) || xs.some((x, i) => xs.some((y, j) => j > i && iqAnSame(x, y)))) continue;
    if (iqAnSame(pairs[oddIndex][1], iqAnApply(rule, xs[oddIndex]))) continue;                               // the odd pair really breaks the rule
    const allPairs = [[E, E2]].concat(pairs), without = i => allPairs.filter((_, j) => j !== i + 1);
    if (!iqAnFits(library, without(oddIndex)).length) continue;                                                // the other four pairs fit one rule
    if (iqAnFits(library, allPairs).length) continue;                                                          // all five do not
    if ([0, 1, 2, 3].some(i => i !== oddIndex && iqAnFits(library, without(i)).length)) continue;             // leaving out any other pair does not help
    return { design: 'pair-odd', ctx, rule, other, E, E2, pairs, oddIndex, explanation: 'הכלל בדוגמה: ' + iqAnDescribe(ctx, rule) + '. בזוג שנבחר הכלל שונה: ' + iqAnDescribe(ctx, other) + '.' };
  }
  throw new Error('iqAnPairOdd: no valid question.');
}

// ----- the pool: the three designs -----
const IQ_AN_DESIGNS = [
  // Pacing: levels 1-3 are ONLY the classic design; the heavier designs arrive from level 4 as an occasional twist (about a third of the questions)
  { key: 'classic', minTier: 1, weight: 12, make: iqAnClassic },
  { key: 'two-examples', minTier: 4, weight: 3, make: iqAnTwoExamples },
  { key: 'pair-odd', minTier: 4, weight: 3, make: iqAnPairOdd }
];
// every group of shapes in a question respects the hard limit; a question that breaks it is a defect, never shown
function iqAnAssertLimit(q){
  const states = [q.A, q.A2, q.B, q.B2, q.C, q.C2, q.E, q.E2].concat(q.wrong || [], (q.pairs || []).flat());
  if (states.some(st => st && st.count > IQ_AN_MAX_COUNT)) throw new Error('iqAnalogyPick: a group has more than ' + IQ_AN_MAX_COUNT + ' shapes.');
}
function iqAnalogyPick(tier){
  const pool = [];
  IQ_AN_DESIGNS.filter(d => d.minTier <= tier).forEach(d => { for (let i = 0; i < d.weight; i++) pool.push({ key: d.key, make: d.make }); });
  // a heavy design never comes twice in a row; the classic design may (it is the base, and forbidding it would force a heavy design after every classic one)
  const fresh = IQ_AN_AVOID_REPEAT ? pool.filter(p => p.key === 'classic' || p.key !== IQ_AN_LAST.design) : pool;
  const chosen = pickOne(fresh.length ? fresh : pool);
  const q = chosen.make(tier);
  iqAnAssertLimit(q);
  IQ_AN_LAST.design = chosen.key;
  IQ_AN_LAST.rule = iqAnKey(q.rule);
  return q;
}

// ----- rendering -----
function iqAnPairSVG(after, before){                                         // the original on top, an arrow down, the result below: big enough to read in a square tile
  const nest = (svg, y) => svg.replace('<svg ', '<svg x="27" y="' + y + '" ').replace('width="80" height="80"', 'width="46" height="46"');
  return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' + nest(renderShapeSVG(before), 1) + nest(renderShapeSVG(after), 53) +
    '<line x1="50" y1="47" x2="50" y2="55" stroke="#3A3352" stroke-width="2.6" stroke-linecap="round"/><polyline points="45,51 50,56 55,51" fill="none" stroke="#3A3352" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
const iqAnTile = spec => '<div class="iq-tile iq-tile-shape">' + renderShapeSVG(spec) + '</div>';
const iqAnRow = (a, b) => '<div class="iq-analogy-row">' + iqAnTile(a) + '<div class="iq-arrow">←</div>' + (b ? iqAnTile(b) : '<div class="iq-tile iq-tile-blank">?</div>') + '</div>';
function iqAnalogyRenderEngine(q, promptEl, optionsEl, onAnswer){
  const S = st => iqAnSpec(q.ctx, st);
  let options, prompt;
  if (q.design === 'pair-odd'){
    prompt = '<div class="iq-prompt-label">בדוגמה הצורה משתנה לפי כלל. איזה זוג לא מתאים לאותו כלל?</div>' + iqAnRow(S(q.E), S(q.E2));
    options = q.pairs.map((p, i) => ({ html: iqAnPairSVG(S(p[1]), S(p[0])), isCorrect: i === q.oddIndex }));
  } else {
    prompt = '<div class="iq-prompt-label">השלימו את האנלוגיה:</div>' + iqAnRow(S(q.A), S(q.A2)) + (q.design === 'two-examples' ? iqAnRow(S(q.C), S(q.C2)) : '') + iqAnRow(S(q.B), null);
    options = [{ html: renderShapeSVG(S(q.B2)), isCorrect: true }].concat(q.wrong.map(w => ({ html: renderShapeSVG(S(w)), isCorrect: false })));
  }
  promptEl.innerHTML = prompt;
  optionsEl.classList.add('iq-options-grow');
  renderIQMultipleChoice(optionsEl, options, isCorrect => {
    if (isCorrect) document.getElementById('iq-analogy-explanation').textContent = q.explanation;
    onAnswer(isCorrect);
  });
}
