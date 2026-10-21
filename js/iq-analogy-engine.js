'use strict';

/* ============ Shape analogies: the rule-library engine ============ */
// The same idea as the "induce" family of the odd-one-out game, applied to A : A' :: B : ?
// A RULE is a list of two or three STEPS on different attributes of a group of figures, and every rule contains at least one
// VISUAL change of its kind of figure: a turn or a reflection of an asymmetric figure ("orient") or filled <-> outline only ("fill"),
// an inner/outer swap of a shape in a shape ("nest"), or colours moving round three regions ("cycle").
// Colour swaps and size changes come along as supporting steps, and a change of the NUMBER of figures (+1 / -1) is only a
// secondary step in about one rule of four. A question is built from a rule, and the library is searched exhaustively so that
//   - the shown example(s) identify the rule,
//   - the right answer is the rule applied to B,
//   - every wrong answer is a plausible mistake: the result of a NEIGHBOUR rule (one step different) that the examples rule
//     out, or the result of forgetting one step.
// Four question designs:
//   classic        A -> A', B -> ?                            (one example)
//   split-rule     A -> A', C -> C', B -> ?                   (the rule has two parts: the first example shows only the first part, the second only
//                  the other part, on a different figure; the answer needs both parts together - induction, not just copying one change)
//   pair-odd       a rule example, and four more pairs: three follow the rule, one does not (find it)
//   merge          X + Y = Z, X' + Y' = Z', X'' + Y'' = ?     (a dark layer and a light layer lie on top of each other and merge into a third picture;
//                  the two examples each show only part of what the merge does, see "merge" below)
// A state is {orient 0-7, nest 0-3, cycle 0-5, colour 0-3, size 0/1, fill 0/1, count}. orient = 4 x mirrored + quarter-turns clockwise.
// `ctx.mode` says which figure the question uses:
//   glyph    an asymmetric outline, so turns and reflections show
//   nested   a shape inside another shape: the step "swap" puts the inner shape outside and the outer one inside
//   spin     a circle in three coloured regions (sectors or rings): the steps "+1" / "-1" move the colours round the regions
//   shapes   a plain shape (no turns or reflections, so its rules always contain the fill step)
//   logic    two overlapping shapes; the step "op" keeps what a logical operation leaves of them (both = AND, one of them = XOR, first without second, ...)
//   parts    a shape that the step "cut" cuts into pieces that move apart (or, in the other direction, "join" puts the pieces back together)
//   holes    a shape with holes: the steps "+1" / "-1" add or close a hole (topology: the number of holes)
//   chain    two or three rings: the step "join" weaves them into a chain (each ring over its neighbour at one crossing and under it at the other), "open" takes the chain apart
// logic, parts, holes and chain come in from level 4, like the heavier designs.

// HARD LIMIT: a group never holds more than this many shapes (in the pictures shown, the examples AND every answer).
// More than four makes the tiles crowded and the shapes too small to compare.
const IQ_AN_MAX_COUNT = 4;
// Fine figures (asymmetric outlines, shapes inside shapes, coloured regions) are hard to read when drawn small, so they use at most two copies
const IQ_AN_GLYPH_MAX_COUNT = 2;
const IQ_AN_CAP = { glyph: IQ_AN_GLYPH_MAX_COUNT, nested: 2, spin: 2, shapes: IQ_AN_MAX_COUNT, logic: 1, parts: 1, holes: 1, chain: 3 };      // logic: two shapes in one picture; parts: at most four pieces
let IQ_AN_AVOID_REPEAT = true;                       // switchable for tests that need seeded sequences
const IQ_AN_LAST = { design: null, rule: null };
const IQ_AN_ATTRS = ['orient', 'nest', 'cycle', 'op', 'cut', 'holes', 'link', 'colour', 'size', 'fill', 'count'];
const IQ_AN_OPS = {
  orient: ['+90', '-90', '180', 'flipH', 'flipV'],            // quarter-turn clockwise / anticlockwise, half-turn, reflection left-right, reflection top-bottom
  nest: ['swap'],                                              // the inner shape and the outer shape change places
  cycle: ['+1', '-1'],                                         // the colours of the three regions move round: each colour to the next region / the previous one
  op: ['and', 'xor', 'aNotB', 'bNotA', 'union'],               // two overlapping shapes: only the common part / only the parts that are in one shape / the first without the second / the second without the first / the union as one shape
  cut: ['v', 'd', 'q', 't', 'join'],                           // cut into two vertical halves / two diagonal halves / four quarters / three wedges (the pieces move apart), or the pieces join into the whole shape
  holes: ['+1', '-1'],                                         // one hole more / one hole less (at most two)
  link: ['join', 'open'],                                      // separate rings are woven into a chain / a chain comes apart
  colour: ['pair'], size: ['flip'], fill: ['flip'], count: ['+1', '-1']
};
// the attributes a figure of each kind has, and the classic visual change every rule of that kind must contain
const IQ_AN_MODE_ATTRS = { glyph: ['orient', 'colour', 'size', 'fill', 'count'], shapes: ['colour', 'size', 'fill', 'count'], nested: ['nest', 'colour', 'size', 'fill', 'count'], spin: ['cycle', 'colour', 'size', 'count'], logic: ['op', 'colour', 'size', 'fill'], parts: ['cut', 'colour', 'size', 'fill'],
  holes: ['holes', 'colour', 'size', 'fill'], chain: ['link', 'count', 'colour', 'size'] };
const IQ_AN_MUST_HAVE = { glyph: ['orient', 'fill'], shapes: ['fill'], nested: ['nest'], spin: ['cycle'], logic: ['op'], parts: ['cut'], holes: ['holes'], chain: ['link'] };
// the six ways to give three colours to the three regions: the first three are turns of the first one, the last three are reflections
const IQ_AN_PERMS = [[0, 1, 2], [2, 0, 1], [1, 2, 0], [0, 2, 1], [2, 1, 0], [1, 0, 2]];
const IQ_AN_STATE_KEYS = IQ_AN_ATTRS.concat(['cfg']);          // cfg: which of the four shapes (or pairs of shapes) of the question the figure is
const iqAnPermIndex = p => IQ_AN_PERMS.findIndex(q => q.join() === p.join());
const IQ_AN_SHAPE_TYPES = ['square', 'triangle', 'pentagon', 'hexagon', 'circle'];
// shape-in-shape pairs: the inner shape is small, so only shapes that cannot be mistaken for each other at that size (no circle with a pentagon)
const IQ_AN_NEST_TYPES = [['square', 'circle'], ['square', 'triangle'], ['triangle', 'circle'], ['square', 'pentagon'], ['triangle', 'pentagon']];
const IQ_AN_NEST_PAIRS = [[0, 1], [1, 0], [1, 1], [0, 0]];     // [outer, inner] shape for nest 0..3 (2 and 3: a swap that stopped half way, only ever a wrong answer)
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
  if (attr === 'nest') return st.nest < 2 ? 1 - st.nest : null;
  if (attr === 'holes'){ const h = st.holes + (op === '+1' ? 1 : -1); return h >= 0 && h <= 2 ? h : null; }
  if (attr === 'link') return op === 'join' ? (st.link === 0 ? 1 : null) : (st.link === 1 ? 0 : null);
  if (attr === 'op') return st.op === 0 ? IQ_AN_OPS.op.indexOf(op) + 1 : null;                      // only a figure that has not been processed yet can be processed
  if (attr === 'cut'){ if (op === 'join') return st.cut >= 1 && st.cut <= 4 ? 0 : null; return st.cut === 0 ? IQ_AN_OPS.cut.indexOf(op) + 1 : null; }
  if (attr === 'cycle'){ const q = IQ_AN_PERMS[st.cycle]; return iqAnPermIndex(op === '+1' ? [q[2], q[0], q[1]] : [q[1], q[2], q[0]]); }
  if (attr === 'colour') return st.colour ^ 1;
  if (attr === 'size' || attr === 'fill') return 1 - st[attr];
  const n = st.count + (op === '+1' ? 1 : -1);
  return n >= (st.floor || 1) && n <= st.cap ? n : null;                      // st.cap: the most copies this question allows (never more than IQ_AN_MAX_COUNT)
}
function iqAnApply(rule, st){
  const out = Object.assign({}, st);
  for (const [attr, op] of rule){ const v = iqAnStep(attr, op, out); if (v === null) return null; out[attr] = v; }
  return out;
}
const iqAnSame = (a, b) => a && b && IQ_AN_STATE_KEYS.every(k => a[k] === b[k]);
const iqAnKey = rule => rule.map(s => s.join(' ')).join(' | ');
// the whole library for one mode
const IQ_AN_LIBRARY = {};
function iqAnLibrary(mode){
  if (IQ_AN_LIBRARY[mode]) return IQ_AN_LIBRARY[mode];
  const attrs = IQ_AN_ATTRS.filter(a => IQ_AN_MODE_ATTRS[mode].includes(a)), must = IQ_AN_MUST_HAVE[mode], out = [];
  const build = (start, chosen) => {
    if (chosen.length >= 2 && chosen.some(s => must.includes(s[0]))) out.push(chosen.slice());
    if (chosen.length === 3) return;
    for (let i = start; i < attrs.length; i++) IQ_AN_OPS[attrs[i]].forEach(op => build(i + 1, chosen.concat([[attrs[i], op]])));
  };
  build(0, []);
  IQ_AN_LIBRARY[mode] = out;
  return out;
}
const iqAnFits = (library, pairs) => library.filter(rule => pairs.every(([a, b]) => iqAnSame(iqAnApply(rule, a), b)));
// `steps` (the rule, or the part of it that a figure goes through) says what the figure must be able to do: a cut needs a whole shape, a join needs a cut one
function iqAnRandomState(mode, steps){
  const cutStep = (steps || []).find(s => s[0] === 'cut'), holesStep = (steps || []).find(s => s[0] === 'holes'), linkStep = (steps || []).find(s => s[0] === 'link');
  const holes = mode !== 'holes' ? 0 : (holesStep ? (holesStep[1] === '+1' ? randInt(0, 1) : randInt(1, 2)) : randInt(0, 2));
  const link = mode !== 'chain' ? 0 : (linkStep ? (linkStep[1] === 'join' ? 0 : 1) : randInt(0, 1));
  return { holes, link, floor: mode === 'chain' ? 2 : 1, op: 0, cut: mode === 'parts' ? (cutStep ? (cutStep[1] === 'join' ? randInt(1, 4) : 0) : randInt(0, 4)) : 0, cfg: mode === 'logic' || mode === 'parts' || mode === 'holes' ? randInt(0, 3) : 0,
    orient: mode === 'glyph' ? randInt(0, 7) : 0, nest: mode === 'nested' ? randInt(0, 1) : 0, cycle: mode === 'spin' ? randInt(0, 5) : 0,
    colour: mode === 'spin' ? randInt(0, 1) : randInt(0, 3), size: randInt(0, 1), fill: mode === 'spin' || mode === 'chain' ? 0 : randInt(0, 1), count: randInt(mode === 'chain' ? 2 : 1, IQ_AN_CAP[mode]), cap: IQ_AN_CAP[mode] };   // spin has no colour step and chain no fill step: pinned, so two states never differ in something nobody can see
}
// the pairs of shapes for the logic figure: every one of its three regions (only the first shape, only the second, both) must be big enough to see and to colour
let IQ_AN_LOGIC_PAIRS = null;
function iqAnLogicPairs(dir){
  if (!IQ_AN_LOGIC_PAIRS){
    IQ_AN_LOGIC_PAIRS = {};
    [0, 90, 45].forEach(d => {
      IQ_AN_LOGIC_PAIRS[d] = [];
      const types = ['circle', 'square', 'triangle', 'pentagon'];
      types.forEach((a, i) => types.forEach((b, j) => {
        if (j <= i) return;
        const [A, B] = iqLogicShapes(a, b, d, 40, 40, 80 * IQ_LOGIC_R, 80 * IQ_LOGIC_D), I = iqClipConvex(A, B);
        const parts = [iqPolyArea(I), iqPolyArea(A) - iqPolyArea(I), iqPolyArea(B) - iqPolyArea(I)];
        if (Math.min(...parts) >= 300) IQ_AN_LOGIC_PAIRS[d].push([a, b]);
      }));
    });
  }
  return IQ_AN_LOGIC_PAIRS[dir];
}
function iqAnContext(mode){
  const pairs = shuffle(IQ_COLOR_PAIRS.slice()).slice(0, 2), colours = [pairs[0][0], pairs[0][1], pairs[1][0], pairs[1][1]];
  const dir = mode === 'logic' ? pickOne([0, 90, 45]) : null;
  return { mode, colours,
    glyph: mode === 'glyph' ? pickOne(Object.keys(IQ_GLYPHS)) : null,
    shape: mode === 'shapes' ? pickOne(IQ_AN_SHAPE_TYPES) : null,
    types: mode === 'nested' ? shuffle(pickOne(IQ_AN_NEST_TYPES).slice()) : null,           // [shape 0, shape 1]: at nest 0 shape 0 is outside and shape 1 inside
    layout: mode === 'spin' ? pickOne(['sectors', 'rings']) : null,
    palette: mode === 'spin' ? shuffle([0, 1, 2, 3]).slice(0, 3) : null,                    // the three colours (numbers into `colours`) that move round
    dir,                                                                                      // logic: where the second shape sits relative to the first (the same in every figure of the question)
    pairs: mode === 'logic' ? shuffle(iqAnLogicPairs(dir).slice()).slice(0, 4).map(pr => shuffle(pr.slice())) : null,     // logic: the four pairs of shapes (state.cfg picks one)
    shapes: mode === 'parts' ? shuffle(IQ_AN_SHAPE_TYPES.slice()).slice(0, 4) : (mode === 'holes' ? shuffle(IQ_AN_SHAPE_TYPES.filter(t => t !== 'triangle')) : null) };      // parts, holes: the four shapes (state.cfg picks one); a triangle is too small for two holes
}
function iqAnSpec(ctx, st){
  const spec = { color: ctx.colours[st.colour], count: st.count, scale: st.size ? 1.3 : 1, hollow: !!st.fill };
  if (ctx.mode === 'glyph'){ spec.type = 'glyph'; spec.glyph = ctx.glyph; spec.rotation = (st.orient & 3) * 90; spec.mirror = (st.orient >> 2) === 1; }
  else if (ctx.mode === 'nested'){               // each shape keeps its own colour when the two change places; the colour step exchanges the two colours
    const [o, i] = IQ_AN_NEST_PAIRS[st.nest], shapeColour = k => ctx.colours[k === 0 ? st.colour : st.colour ^ 1];
    spec.type = 'nested'; spec.outer = ctx.types[o]; spec.inner = ctx.types[i]; spec.color = shapeColour(o); spec.color2 = shapeColour(i);
  }
  else if (ctx.mode === 'spin'){ spec.type = 'spin'; spec.layout = ctx.layout; spec.colors = IQ_AN_PERMS[st.cycle].map(i => ctx.colours[ctx.palette[i] ^ st.colour]); spec.hollow = false; }      // the colour step puts every colour next to its pair partner
  else if (ctx.mode === 'logic'){                // the first shape has the colour of the state, the second the colour next to it, and what the operation leaves in the overlap is a third colour
    const [a, b] = ctx.pairs[st.cfg];
    spec.type = 'logic'; spec.a = a; spec.b = b; spec.dir = ctx.dir; spec.op = st.op ? IQ_AN_OPS.op[st.op - 1] : 'none'; spec.color2 = ctx.colours[st.colour ^ 1]; spec.color3 = ctx.colours[st.colour ^ 2];
  }
  else if (ctx.mode === 'parts'){ spec.type = 'parts'; spec.shape = ctx.shapes[st.cfg]; spec.cut = st.cut; spec.color2 = ctx.colours[st.colour ^ 1]; }
  else if (ctx.mode === 'holes'){ spec.type = 'holes'; spec.shape = ctx.shapes[st.cfg]; spec.holes = st.holes; }
  else if (ctx.mode === 'chain'){ spec.type = 'chain'; spec.rings = st.count; spec.count = 1; spec.link = st.link; spec.color2 = ctx.colours[st.colour ^ 1]; }      // the rings are drawn inside one picture, so the picture itself counts as one figure
  else spec.type = ctx.shape;
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
// plausible mistakes that no neighbour rule produces:
//   a swap that stopped half way (the inner shape came out, but the outer one did not go in - or the other way round);
//   a colour that did not move: in the result of the other steps, two of the three regions exchange colours and one keeps its own
//   a cut where the pieces did not move apart (the cut shape is drawn with its pieces still together);
//   a hole in the wrong place (one hole off-centre, two holes one above the other); rings that overlap but are not woven together (the same ring on top at both crossings)
function iqAnMistakes(rule, st){
  const out = [];
  rule.forEach(([attr, op], k) => {
    const base = iqAnApply(rule.filter((_, i) => i !== k), st);
    if (!base) return;
    if (attr === 'holes'){ const h = iqAnStep('holes', op, base); if (h === 1) out.push(Object.assign({}, base, { holes: 3 })); if (h === 2) out.push(Object.assign({}, base, { holes: 4 })); }
    if (attr === 'link' && op === 'join') out.push(Object.assign({}, base, { link: 2 }));
    if (attr === 'cut' && op !== 'join') out.push(Object.assign({}, base, { cut: 5 + IQ_AN_OPS.cut.indexOf(op) }));
    if (attr === 'nest') [2, 3].forEach(n => out.push(Object.assign({}, base, { nest: n })));
    if (attr === 'cycle') [[0, 1], [0, 2], [1, 2]].forEach(([a, b]) => {
      const q = IQ_AN_PERMS[base.cycle].slice();
      [q[a], q[b]] = [q[b], q[a]];
      out.push(Object.assign({}, base, { cycle: iqAnPermIndex(q) }));
    });
  });
  return out;
}
function iqAnPickWrong(ctx, correct, candidates, library, rule, B, mistakes, take){
  const keep = [];
  const add = st => { if (st && !iqAnSameSpec(ctx, st, correct) && !keep.some(k => iqAnSameSpec(ctx, k, st))) keep.push(st); };
  shuffle((mistakes || []).slice()).slice(0, take || 1).forEach(add);           // a swap that stopped half way / a colour that did not move / one part of the rule forgotten is always among the wrong answers
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
    if (attr === 'holes') return op === '+1' ? 'נוסף עוד חור בצורה' : 'חור אחד נסגר';
    if (attr === 'link') return op === 'join' ? 'הטבעות הנפרדות נשזרות לשרשרת: כל טבעת עוברת פעם מעל ופעם מתחת לטבעת הסמוכה' : 'השרשרת נפתחת: הטבעות נפרדות זו מזו';
    if (attr === 'count') return ctx.mode === 'chain' ? (op === '+1' ? 'נוספת עוד טבעת' : 'נעלמת טבעת') : (op === '+1' ? 'נוספת עוד צורה אחת' : 'נעלמת צורה אחת');
    if (attr === 'op'){
      const side = { 0: ['השמאלית', 'הימנית'], 90: ['העליונה', 'התחתונה'], 45: ['השמאלית-עליונה', 'הימנית-תחתונה'] }[ctx.dir];
      return { and: 'נשאר רק אזור החפיפה של שתי הצורות, בצבע נוסף', xor: 'החפיפה נעלמת, ונשארים רק האזורים שבצורה אחת בלבד (כל אחד בצבע הצורה שלו)',
        aNotB: 'נשאר רק החלק של הצורה ה' + side[0] + ' שלא חופף לצורה ה' + side[1], bNotA: 'נשאר רק החלק של הצורה ה' + side[1] + ' שלא חופף לצורה ה' + side[0],
        union: 'שתי הצורות מתאחדות לצורה אחת בצבע נוסף' }[op];
    }
    if (attr === 'cut') return { v: 'הצורה נחתכת לשני חצאים (חיתוך אנכי) והחצאים מתרחקים זה מזה', d: 'הצורה נחתכת לשני חצאים (חיתוך באלכסון) והחצאים מתרחקים זה מזה',
      q: 'הצורה נחתכת לארבעה רבעים והרבעים מתרחקים זה מזה', t: 'הצורה נחתכת לשלושה חלקים שנפגשים במרכז, והחלקים מתרחקים זה מזה', join: 'החלקים מתחברים בחזרה לצורה אחת שלמה' }[op];
    if (attr === 'nest') return 'הצורה הפנימית יוצאת החוצה והצורה החיצונית נכנסת פנימה (הצורות מתחלפות, כל אחת שומרת על הצבע שלה)';
    if (attr === 'cycle') return ctx.layout === 'rings'
      ? (op === '+1' ? 'הצבעים זזים פנימה: הצבע של הטבעת החיצונית עובר לאמצעית, האמצעית לפנימית והפנימית לחיצונית' : 'הצבעים זזים החוצה: הצבע של הטבעת הפנימית עובר לאמצעית, האמצעית לחיצונית והחיצונית לפנימית')
      : (op === '+1' ? 'הצבעים מסתובבים עם כיוון השעון: הצבע של כל גזרה עובר לגזרה הבאה' : 'הצבעים מסתובבים נגד כיוון השעון: הצבע של כל גזרה עובר לגזרה הקודמת');
    if (attr === 'colour') return ctx.mode === 'nested' || ctx.mode === 'logic' || ctx.mode === 'chain' ? 'שתי הצורות מחליפות ביניהן צבעים (' + nm(ctx.colours[0]) + ' ו' + nm(ctx.colours[1]) + ', ' + nm(ctx.colours[2]) + ' ו' + nm(ctx.colours[3]) + ')'
      : 'הצבע מתחלף בצבע הצמוד לו בזוג: ' + nm(ctx.colours[0]) + ' ו' + nm(ctx.colours[1]) + ', ' + nm(ctx.colours[2]) + ' ו' + nm(ctx.colours[3]);
    if (attr === 'size') return 'הצורה מתחלפת בין קטנה לגדולה';
    if (attr === 'fill') return ctx.mode === 'nested' ? 'הצורה הפנימית מלאה הופכת לחלולה (רק קו מתאר), וחלולה הופכת למלאה' : 'צורה מלאה הופכת לחלולה (רק קו מתאר), וחלולה הופכת למלאה';
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
// turns and reflections, inner/outer swaps and rotating colours carry the game side by side; plain shapes (fill only) are the minor kind.
// From level 4 the logic (two overlapping shapes), parts (a shape cut into pieces) and topology (holes, chains of rings) figures join in, about a tenth of the questions each.
const IQ_AN_MODE_WEIGHTS = [['glyph', 40], ['nested', 25], ['spin', 25], ['shapes', 10]];
const IQ_AN_MODE_WEIGHTS_4 = [['glyph', 25], ['nested', 14], ['spin', 14], ['shapes', 6], ['logic', 12], ['parts', 12], ['holes', 8], ['chain', 9]];
function iqAnPickMode(tier){
  let r = Math.random() * 100;
  for (const [mode, w] of (tier >= 4 ? IQ_AN_MODE_WEIGHTS_4 : IQ_AN_MODE_WEIGHTS)){ if (r < w) return mode; r -= w; }
  return 'glyph';
}
function iqAnClassic(tier){
  const mode = iqAnPickMode(tier);                                                     // chosen once: a kind of figure whose examples are harder to find is not drawn less often
  for (let attempt = 0; attempt < 400; attempt++){
    const library = iqAnLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, tier);
    const A = iqAnRandomState(mode, rule), B = iqAnRandomState(mode, rule), A2 = iqAnApply(rule, A), B2 = iqAnApply(rule, B);
    if (!A2 || !B2 || iqAnSame(A, B) || iqAnSame(A, A2) || iqAnSame(B, B2)) continue;
    const fits = iqAnFits(library, [[A, A2]]);
    if (fits.some(f => { const r = iqAnApply(f, B); return r && !iqAnSame(r, B2); })) continue;           // the example must settle the answer
    const near = iqAnNeighbours(rule, library).filter(r => !fits.includes(r)).map(r => iqAnApply(r, B));
    const wrong = iqAnPickWrong(ctx, B2, near, library, rule, B, iqAnMistakes(rule, B));
    if (!wrong) continue;
    return { design: 'classic', ctx, rule, A, A2, B, B2, wrong, explanation: 'הכלל: ' + iqAnDescribe(ctx, rule) + '.' };
  }
  throw new Error('iqAnClassic: no valid question.');
}
// ----- split-rule: each example shows only one part of the rule -----
// every list of one or two steps on different attributes (a part of a rule): the examples are checked against these, so that each one
// settles its own part and nothing but its own part
const IQ_AN_PARTIAL = {};
function iqAnPartialLibrary(mode){
  if (IQ_AN_PARTIAL[mode]) return IQ_AN_PARTIAL[mode];
  const attrs = IQ_AN_ATTRS.filter(a => IQ_AN_MODE_ATTRS[mode].includes(a)), out = [];
  const build = (start, chosen) => {
    if (chosen.length) out.push(chosen.slice());
    if (chosen.length === 2) return;
    for (let i = start; i < attrs.length; i++) IQ_AN_OPS[attrs[i]].forEach(op => build(i + 1, chosen.concat([[attrs[i], op]])));
  };
  build(0, []);
  IQ_AN_PARTIAL[mode] = out;
  return out;
}
function iqAnSplitSteps(rule){                                                         // two non-empty groups of steps, each in the original order
  const k = randInt(1, rule.length - 1), first = shuffle(rule.map((_, i) => i)).slice(0, k);
  return [rule.filter((_, i) => first.includes(i)), rule.filter((_, i) => !first.includes(i))];
}
function iqAnSplitRule(tier){
  const mode = iqAnPickMode(Math.max(tier, 4));
  for (let attempt = 0; attempt < 800; attempt++){
    const library = iqAnLibrary(mode), partial = iqAnPartialLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, Math.max(tier, 4));
    const [S1, S2] = iqAnSplitSteps(rule);
    const A = iqAnRandomState(mode, S1), C = iqAnRandomState(mode, S2), B = iqAnRandomState(mode, rule);
    const A2 = iqAnApply(S1, A), C2 = iqAnApply(S2, C), B2 = iqAnApply(rule, B), P1 = iqAnApply(S1, B), P2 = iqAnApply(S2, B);
    if (!A2 || !C2 || !B2 || !P1 || !P2 || iqAnSame(A, C) || iqAnSame(A, B) || iqAnSame(C, B) || iqAnSame(A, A2) || iqAnSame(C, C2) || iqAnSame(B, B2)) continue;
    const f1 = iqAnFits(partial, [[A, A2]]), f2 = iqAnFits(partial, [[C, C2]]);
    if (f1.length !== 1 || f2.length !== 1 || iqAnKey(f1[0]) !== iqAnKey(S1) || iqAnKey(f2[0]) !== iqAnKey(S2)) continue;           // each example settles exactly its own part
    const near = iqAnMistakes(rule, B).concat(iqAnNeighbours(rule, library).map(r => iqAnApply(r, B)));
    const wrong = iqAnPickWrong(ctx, B2, near, library, rule, B, [P1, P2], 2);                       // the two "forgot a part" answers are always among the wrong ones
    if (!wrong) continue;
    return { design: 'split-rule', ctx, rule, parts: [S1, S2], A, A2, C, C2, B, B2, wrong,
      explanation: 'הכלל בשני חלקים. הדוגמה הראשונה הראתה: ' + iqAnDescribe(ctx, S1) + '. הדוגמה השנייה הראתה: ' + iqAnDescribe(ctx, S2) + '. בשאלה פועלים שני החלקים יחד.' };
  }
  throw new Error('iqAnSplitRule: no valid question.');
}
function iqAnPairOdd(tier){
  const mode = iqAnPickMode(Math.max(tier, 4));
  for (let attempt = 0; attempt < 600; attempt++){
    const library = iqAnLibrary(mode), ctx = iqAnContext(mode), rule = iqAnRule(library, Math.max(tier, 4));
    const near = iqAnNeighbours(rule, library);
    if (!near.length) continue;
    const other = pickOne(near), states = [0, 1, 2, 3, 4].map(() => iqAnRandomState(mode, rule));
    const E = states[0], xs = states.slice(1), oddIndex = randInt(0, 3);
    const E2 = iqAnApply(rule, E);
    const pairs = xs.map((x, i) => [x, iqAnApply(i === oddIndex ? other : rule, x)]);
    if (!E2 || iqAnSame(E, E2) || pairs.some(p => !p[1] || iqAnSame(p[0], p[1])) || xs.some((x, i) => xs.some((y, j) => j > i && iqAnSame(x, y)))) continue;
    if (iqAnSame(pairs[oddIndex][1], iqAnApply(rule, xs[oddIndex]))) continue;                               // the odd pair really breaks the rule
    const allPairs = [[E, E2]].concat(pairs), without = i => allPairs.filter((_, j) => j !== i + 1);
    if (!iqAnFits(library, without(oddIndex)).length) continue;                                                // the other four pairs fit one rule
    if (iqAnFits(library, allPairs).length) continue;                                                          // all five do not
    if ([0, 1, 2, 3].some(i => i !== oddIndex && iqAnFits(library, without(i)).length)) continue;             // leaving out any other pair does not help
    return { design: 'pair-odd', ctx, rule, other, E, E2, pairs, oddIndex, explanation: 'הכלל בדוגמה: ' + iqAnDescribe(ctx, rule) + '. בזוג שנבחר: ' + iqAnDescribe(ctx, other) + '.' };
  }
  throw new Error('iqAnPairOdd: no valid question.');
}

// ----- merge: a dark layer and a light layer on top of each other -----
// A picture is a 3 x 3 board; the dark layer X and the light layer Y each colour some of its squares. Where the layers lie on top of each other, the squares are
// of three kinds: only dark (x), only light (y) and both (b). A RULE says what each kind becomes: nothing (0), dark (1), light (2) or a third colour (3).
// x can only stay dark or vanish, y can only stay light or vanish, b can become anything; the rules that do nothing but copy one layer, or keep only the overlap, are left out:
// 10 rules. The two examples each show only part of the picture of the rule (the first has no squares in both layers, the second lacks one of the single kinds),
// so neither example alone settles the rule - the solver puts the two together - and the question has all three kinds of square.
const IQ_AN_MERGE_PALETTES = [
  { dark: '#2B3A8F', light: '#FFD93D', third: '#FF6B6B', names: ['כחול כהה', 'צהוב', 'אדום'] },
  { dark: '#7A2E8E', light: '#8EE3C8', third: '#FF8C42', names: ['סגול', 'ירוק בהיר', 'כתום'] },
  { dark: '#1F6F5C', light: '#FFC9A8', third: '#4C6FFF', names: ['ירוק כהה', 'אפרסק', 'כחול'] }
];
const IQ_AN_MERGE_RULES = (() => {
  const out = [];
  for (const x of [0, 1]) for (const y of [0, 2]) for (const b of [0, 1, 2, 3]){
    if ((!x && !y) || (x === 1 && !y && b === 1) || (!x && y === 2 && b === 2)) continue;       // only the overlap survives (its examples would have to show an empty picture) / only layer X / only layer Y
    out.push({ x, y, b, key: 'x' + x + 'y' + y + 'b' + b });
  }
  return out;
})();
const iqAnMergeApply = (rule, X, Y) => X.map((xv, i) => (xv && Y[i] ? rule.b : (xv ? rule.x : (Y[i] ? rule.y : 0))));
const iqAnMergeFits = (rules, pairs) => rules.filter(r => pairs.every(([X, Y, Z]) => iqAnMergeApply(r, X, Y).join() === Z.join()));
const iqAnMergeNear = (rule, rules) => rules.filter(r => ['x', 'y', 'b'].filter(f => r[f] !== rule[f]).length === 1);          // one kind of square handled differently
// a pair of layers of a given kind, as two lists of nine 0/1: apart (no square in both), yInX / xInY (one layer lies entirely within the other), full (all three kinds)
function iqAnMergeState(kind){
  const cells = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  let X, Y;
  if (kind === 'apart'){ const nx = randInt(3, 4), ny = randInt(2, 3); X = cells.slice(0, nx); Y = cells.slice(nx, nx + ny); }
  else if (kind === 'yInX'){ X = cells.slice(0, randInt(4, 5)); Y = shuffle(X.slice()).slice(0, randInt(2, 3)); }
  else if (kind === 'xInY'){ Y = cells.slice(0, randInt(4, 5)); X = shuffle(Y.slice()).slice(0, randInt(2, 3)); }
  else {
    const o = randInt(1, 2), xo = randInt(1, 3), yo = randInt(1, 3);
    X = cells.slice(0, o + xo); Y = cells.slice(0, o).concat(cells.slice(o + xo, o + xo + yo));
  }
  const mask = list => [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (list.includes(i) ? 1 : 0));
  return { X: mask(X), Y: mask(Y) };
}
function iqAnMergeDescribe(ctx, rule){
  const [dark, light, third] = ctx.palette.names;
  return [rule.x ? 'המשבצות של הצורה הכהה (' + dark + ') שלא חופפות לבהירה נשארות' : 'המשבצות של הצורה הכהה (' + dark + ') שלא חופפות לבהירה נעלמות',
    rule.y ? 'המשבצות של הצורה הבהירה (' + light + ') שלא חופפות לכהה נשארות' : 'המשבצות של הצורה הבהירה (' + light + ') שלא חופפות לכהה נעלמות',
    ['המשבצות החופפות נעלמות', 'המשבצות החופפות נצבעות בצבע הכהה', 'המשבצות החופפות נצבעות בצבע הבהיר', 'המשבצות החופפות נצבעות בצבע שלישי (' + third + ')'][rule.b]].join('; ');
}
function iqAnMerge(tier){
  for (let attempt = 0; attempt < 1500; attempt++){
    const ctx = { mode: 'merge', palette: pickOne(IQ_AN_MERGE_PALETTES) }, rule = pickOne(IQ_AN_MERGE_RULES.filter(r => !(IQ_AN_AVOID_REPEAT && iqAnKey([['merge', r.key]]) === IQ_AN_LAST.rule)));
    const kinds = shuffle(['apart', pickOne(['yInX', 'xInY'])]), shown = kinds.map(k => iqAnMergeState(k)), Q = iqAnMergeState('full');
    const rows = shown.map(st => ({ X: st.X, Y: st.Y, Z: iqAnMergeApply(rule, st.X, st.Y) })), answer = iqAnMergeApply(rule, Q.X, Q.Y);
    if (rows.some(r => !r.Z.some(Boolean)) || rows[0].X.join() === rows[1].X.join()) continue;           // a result that shows nothing is no help
    const fitsEach = rows.map(r => iqAnMergeFits(IQ_AN_MERGE_RULES, [[r.X, r.Y, r.Z]])), fitsBoth = iqAnMergeFits(IQ_AN_MERGE_RULES, rows.map(r => [r.X, r.Y, r.Z]));
    if (fitsEach.some(f => f.length < 2) || fitsBoth.length !== 1 || fitsBoth[0].key !== rule.key) continue;      // neither example alone settles the rule, the two together do
    const picks = [], add = z => { if (z.some(Boolean) && z.join() !== answer.join() && !picks.some(k => k.join() === z.join())) picks.push(z); };
    shuffle(iqAnMergeNear(rule, IQ_AN_MERGE_RULES)).forEach(r => add(iqAnMergeApply(r, Q.X, Q.Y)));                  // one kind of square handled the wrong way
    if (picks.length < 3) shuffle(IQ_AN_MERGE_RULES).forEach(r => add(iqAnMergeApply(r, Q.X, Q.Y)));
    if (picks.length < 3) continue;
    return { design: 'merge', ctx, rule: [['merge', rule.key]], mergeRule: rule, rows, Q, answer, wrong: shuffle(picks.slice(0, 3)),
      explanation: 'הכלל: ' + iqAnMergeDescribe(ctx, rule) + '.' };
  }
  throw new Error('iqAnMerge: no valid question.');
}

// ----- the pool: the designs -----
const IQ_AN_DESIGNS = [
  // Pacing: levels 1-3 are ONLY the classic design; the heavier designs arrive from level 4 as an occasional twist (about a third of the questions)
  { key: 'classic', minTier: 1, weight: 14, make: iqAnClassic },
  { key: 'split-rule', minTier: 4, weight: 3, make: iqAnSplitRule },
  { key: 'pair-odd', minTier: 4, weight: 2, make: iqAnPairOdd },
  { key: 'merge', minTier: 4, weight: 3, make: iqAnMerge }
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
// merge pictures: a 3 x 3 board; `cells` are nine colours ('' for an empty square)
const iqAnBoard = (cells) => renderShapeSVG({ type: 'grid', color: '#3A3352', cells });
const iqAnLayerCells = (mask, colour) => mask.map(v => (v ? colour : ''));
const iqAnResultCells = (ctx, codes) => codes.map(c => [''].concat([ctx.palette.dark, ctx.palette.light, ctx.palette.third])[c]);
function iqAnMergeRowHTML(ctx, row, answered){
  const tile = svg => '<div class="iq-tile iq-tile-shape">' + svg + '</div>';
  return '<div class="iq-analogy-row">' + tile(iqAnBoard(iqAnLayerCells(row.X, ctx.palette.dark))) + '<div class="iq-analogy-sep">+</div>' + tile(iqAnBoard(iqAnLayerCells(row.Y, ctx.palette.light))) +
    '<div class="iq-arrow">=</div>' + (row.Z ? tile(iqAnBoard(iqAnResultCells(ctx, row.Z))) : '<div class="iq-tile iq-tile-blank">?</div>') + '</div>';
}
const iqAnRow = (a, b) => '<div class="iq-analogy-row">' + iqAnTile(a) + '<div class="iq-arrow">←</div>' + (b ? iqAnTile(b) : '<div class="iq-tile iq-tile-blank">?</div>') + '</div>';
function iqAnalogyRenderEngine(q, promptEl, optionsEl, onAnswer){
  const S = st => iqAnSpec(q.ctx, st);
  let options, prompt;
  if (q.design === 'merge'){
    prompt = '<div class="iq-prompt-label">שתי צורות מונחות זו על זו וממזגות לצורה שלישית. כל דוגמה מראה רק חלק מהכלל - מה יהיה בשאלה?</div>' + q.rows.map(r => iqAnMergeRowHTML(q.ctx, r)).join('') + iqAnMergeRowHTML(q.ctx, { X: q.Q.X, Y: q.Q.Y, Z: null });
    options = [{ html: iqAnBoard(iqAnResultCells(q.ctx, q.answer)), isCorrect: true }].concat(q.wrong.map(w => ({ html: iqAnBoard(iqAnResultCells(q.ctx, w)), isCorrect: false })));
  } else if (q.design === 'pair-odd'){
    prompt = '<div class="iq-prompt-label">בדוגמה הצורה משתנה לפי כלל. איזה זוג לא מתאים לאותו כלל?</div>' + iqAnRow(S(q.E), S(q.E2));
    options = q.pairs.map((p, i) => ({ html: iqAnPairSVG(S(p[1]), S(p[0])), isCorrect: i === q.oddIndex }));
  } else {
    const split = q.design === 'split-rule';
    prompt = '<div class="iq-prompt-label">' + (split ? 'כל דוגמה מראה רק חלק מהשינוי. מה קורה כששני החלקים פועלים יחד?' : 'השלימו את האנלוגיה:') + '</div>' +
      iqAnRow(S(q.A), S(q.A2)) + (split ? iqAnRow(S(q.C), S(q.C2)) : '') + iqAnRow(S(q.B), null);
    options = [{ html: renderShapeSVG(S(q.B2)), isCorrect: true }].concat(q.wrong.map(w => ({ html: renderShapeSVG(S(w)), isCorrect: false })));
  }
  promptEl.classList.add('iq-an-prompt');
  promptEl.innerHTML = prompt;
  optionsEl.classList.add('iq-options-grow');
  renderIQMultipleChoice(optionsEl, options, isCorrect => {
    if (isCorrect) document.getElementById('iq-analogy-explanation').textContent = q.explanation;
    onAnswer(isCorrect);
  });
}
