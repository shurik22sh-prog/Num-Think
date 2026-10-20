'use strict';

/* ============ Shape analogies: the rule-library engine ============ */
// The same idea as the "induce" family of the odd-one-out game, applied to A : A' :: B : ?
// A RULE is a list of two or three STEPS on different attributes of a group of shapes
// (colour, shape, number of shapes, size, direction of an arrow). A question is built from a rule, and
// the library is searched exhaustively so that
//   - the shown examples identify the rule (or every rule that fits them gives the same answer),
//   - the right answer is the rule applied to B,
//   - every wrong answer is a plausible mistake: the result of a NEIGHBOUR rule (one step different)
//     that the examples rule out, or the result of forgetting one step.
// Three question designs:
//   classic        A -> A', B -> ?                            (one example)
//   two-examples   A -> A', C -> C', B -> ?                   (each example alone leaves two possible rules; together one)
//   pair-odd       a rule example, and four more pairs: three follow the rule, one does not (find it)
// A state is {shape 0-2, colour 0-3, count 1-4, size 0/1, rot 0-7 (x45 degrees)}; `ctx` says which shapes and colours
// the question uses and whether it is an "arrow" question (rotation matters) or a "shapes" question (the shape can change).

// HARD LIMIT: a group never holds more than this many shapes (in the pictures shown, the examples AND every answer).
// More than four makes the tiles crowded and the shapes too small to compare.
const IQ_AN_MAX_COUNT = 4;
let IQ_AN_AVOID_REPEAT = true;                       // switchable for tests that need seeded sequences
const IQ_AN_LAST = { design: null, rule: null };
const IQ_AN_ATTRS = ['count', 'shape', 'colour', 'size', 'rot'];            // the order in which a rule's steps are applied
const IQ_AN_OPS = {
  count: ['+1', '+2', 'x2', '-1', 'half'], shape: ['+1', '-1'], colour: ['pair', 'skip2'], size: ['flip'],
  rot: ['+90', '-90', '+45', '+135', 'byCount', 'mod3']
};
const IQ_AN_DERIVED = ['byCount', 'mod3'];                                   // the direction follows the NEW number of shapes
const IQ_AN_SHAPES_POOL = ['circle', 'square', 'triangle', 'pentagon', 'hexagon', 'star'];

function iqAnStep(attr, op, st){
  if (attr === 'count'){
    const v = st.count;
    const n = op === '+1' ? v + 1 : op === '+2' ? v + 2 : op === 'x2' ? v * 2 : op === '-1' ? v - 1 : (v % 2 === 0 ? v / 2 : null);
    return n !== null && n >= 1 && n <= IQ_AN_MAX_COUNT ? n : null;
  }
  if (attr === 'shape') return (st.shape + (op === '+1' ? 1 : 2)) % 3;
  if (attr === 'colour') return op === 'pair' ? st.colour ^ 1 : (st.colour + 2) % 4;
  if (attr === 'size') return 1 - st.size;
  if (op === '+90') return (st.rot + 2) % 8;
  if (op === '-90') return (st.rot + 6) % 8;
  if (op === '+45') return (st.rot + 1) % 8;
  if (op === '+135') return (st.rot + 3) % 8;
  if (op === 'byCount') return st.count % 8;                                  // direction = 45 degrees x the number of arrows
  return 2 * (st.count % 3 + 1);                                              // mod3: 90, 180 or 270 degrees by the remainder
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
  const attrs = IQ_AN_ATTRS.filter(a => (mode === 'arrow' ? a !== 'shape' : a !== 'rot'));
  const out = [];
  const build = (start, chosen) => {
    if (chosen.length >= 2) out.push(chosen.slice());
    if (chosen.length === 3) return;
    for (let i = start; i < attrs.length; i++) IQ_AN_OPS[attrs[i]].forEach(op => {
      if (IQ_AN_DERIVED.includes(op) && !chosen.some(s => s[0] === 'count')) return;                // a derived direction needs a count step
      build(i + 1, chosen.concat([[attrs[i], op]]));
    });
  };
  build(0, []);
  IQ_AN_LIBRARY[mode] = out;
  return out;
}
const iqAnFits = (library, pairs) => library.filter(rule => pairs.every(([a, b]) => iqAnSame(iqAnApply(rule, a), b)));
const iqAnRandomState = mode => ({ shape: mode === 'arrow' ? 0 : randInt(0, 2), colour: randInt(0, 3), count: randInt(1, IQ_AN_MAX_COUNT), size: randInt(0, 1), rot: mode === 'arrow' ? randInt(0, 7) : 0 });
function iqAnContext(mode){
  const pairs = shuffle(IQ_COLOR_PAIRS.slice()).slice(0, 2), colours = [pairs[0][0], pairs[0][1], pairs[1][0], pairs[1][1]];
  return { mode, shapes: shuffle(IQ_AN_SHAPES_POOL.slice()).slice(0, 3), colours };
}
function iqAnSpec(ctx, st){
  const spec = { type: ctx.mode === 'arrow' ? 'arrow' : ctx.shapes[st.shape], color: ctx.colours[st.colour], count: st.count, scale: st.size ? 1.3 : 1 };
  if (ctx.mode === 'arrow') spec.rotation = st.rot * 45;
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
    if (attr === 'count') return { '+1': 'מספר הצורות גדל ב-1', '+2': 'מספר הצורות גדל ב-2', 'x2': 'מספר הצורות מוכפל פי 2', '-1': 'מספר הצורות קטן ב-1', 'half': 'מספר הצורות מתחלק לחצי' }[op];
    if (attr === 'shape') { const n = ctx.shapes.map(t => IQ_SHAPE_TYPE_NAMES[t]); return 'הצורה מוחלפת בצורה ' + (op === '+1' ? 'הבאה' : 'הקודמת') + ' ברשימה: ' + n.join(', ') + ' (וחוזר חלילה)'; }
    if (attr === 'colour') return op === 'pair' ? 'הצבע מתחלף בצבע הצמוד לו בזוג: ' + nm(ctx.colours[0]) + ' ו' + nm(ctx.colours[1]) + ', ' + nm(ctx.colours[2]) + ' ו' + nm(ctx.colours[3]) : 'הצבע זז שני מקומות ברשימה: ' + ctx.colours.map(nm).join(', ') + ' (וחוזר חלילה)';
    if (attr === 'size') return 'הצורה מתחלפת בין קטנה לגדולה';
    return { '+90': 'החץ מסתובב 90° עם כיוון השעון', '-90': 'החץ מסתובב 90° נגד כיוון השעון', '+45': 'החץ מסתובב 45° עם כיוון השעון', '+135': 'החץ מסתובב 135° עם כיוון השעון', 'byCount': 'כיוון החץ נקבע לפי מספר החצים החדש: 45° כפול המספר', 'mod3': 'כיוון החץ נקבע לפי שארית מספר החצים החדש בחלוקה ב-3: שארית 0 - 90°, שארית 1 - 180°, שארית 2 - 270°' }[op];
  });
  return parts.join(', ובנוסף ');
}

// ----- question designs -----
function iqAnStepsFor(tier){ return tier <= 2 ? 2 : (tier <= 4 ? (Math.random() < 0.5 ? 2 : 3) : 3); }
function iqAnAllowed(rule, tier){                                            // the derived directions arrive later
  return rule.every(([attr, op]) => !(attr === 'rot' && IQ_AN_DERIVED.includes(op)) || (op === 'byCount' ? tier >= 5 : tier >= 6));
}
function iqAnRule(library, tier){
  const n = iqAnStepsFor(tier), pool = library.filter(r => r.length === n && iqAnAllowed(r, tier) && !(IQ_AN_AVOID_REPEAT && iqAnKey(r) === IQ_AN_LAST.rule));
  return pool.length ? pickOne(pool) : pickOne(library.filter(r => r.length === n));
}
const iqAnPickMode = () => (Math.random() < 0.5 ? 'arrow' : 'shapes');
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
    const mode = iqAnPickMode(), library = iqAnLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, Math.max(tier, 3));
    const A = iqAnRandomState(mode), C = iqAnRandomState(mode), B = iqAnRandomState(mode);
    const A2 = iqAnApply(rule, A), C2 = iqAnApply(rule, C), B2 = iqAnApply(rule, B);
    if (!A2 || !C2 || !B2 || iqAnSame(A, C) || iqAnSame(A, B) || iqAnSame(C, B) || iqAnSame(A, A2) || iqAnSame(C, C2) || iqAnSame(B, B2)) continue;
    const f1 = iqAnFits(library, [[A, A2]]), f2 = iqAnFits(library, [[C, C2]]), both = iqAnFits(library, [[A, A2], [C, C2]]);
    if (f1.length < 2 || f2.length < 2) continue;                                                             // neither example alone is enough
    if (both.some(f => { const r = iqAnApply(f, B); return !r || !iqAnSame(r, B2); })) continue;                // together they settle the answer
    const natural = f1.concat(f2).filter(r => !both.includes(r)).map(r => iqAnApply(r, B));                  // what one example alone would suggest
    const wrong = iqAnPickWrong(ctx, B2, natural, library, rule, B);
    if (!wrong || natural.filter(Boolean).filter(s => !iqAnSame(s, B2)).length < 1) continue;
    return { design: 'two-examples', ctx, rule, A, A2, C, C2, B, B2, wrong, explanation: 'הכלל: ' + iqAnDescribe(ctx, rule) + '. כל דוגמה לבדה מתאימה לכמה כללים - רק שתי הדוגמאות יחד קובעות אותו.' };
  }
  throw new Error('iqAnTwoExamples: no valid question.');
}
function iqAnPairOdd(tier){
  for (let attempt = 0; attempt < 600; attempt++){
    const mode = iqAnPickMode(), library = iqAnLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, Math.max(tier, 3));
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
  { key: 'classic', minTier: 1, weight: 12, make: iqAnClassic },
  { key: 'two-examples', minTier: 3, weight: 9, make: iqAnTwoExamples },
  { key: 'pair-odd', minTier: 3, weight: 9, make: iqAnPairOdd }
];
// every group of shapes in a question respects the hard limit; a question that breaks it is a defect, never shown
function iqAnAssertLimit(q){
  const states = [q.A, q.A2, q.B, q.B2, q.C, q.C2, q.E, q.E2].concat(q.wrong || [], (q.pairs || []).flat());
  if (states.some(st => st && st.count > IQ_AN_MAX_COUNT)) throw new Error('iqAnalogyPick: a group has more than ' + IQ_AN_MAX_COUNT + ' shapes.');
}
function iqAnalogyPick(tier){
  const pool = [];
  IQ_AN_DESIGNS.filter(d => d.minTier <= tier).forEach(d => { for (let i = 0; i < d.weight; i++) pool.push({ key: d.key, make: d.make }); });
  const fresh = IQ_AN_AVOID_REPEAT ? pool.filter(p => p.key !== IQ_AN_LAST.design) : pool;
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
