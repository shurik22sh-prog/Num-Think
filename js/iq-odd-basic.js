'use strict';

/* ============ Odd one out: simple counting & size questions (family 'basic') ============ */
// Easy questions for levels 1-2 so that the first levels are not made of the same few rules.
// Three pictures share a plain property, one does not. Colours, turns and positions are
// random in every picture (they are never the rule), so no two questions look alike.
//   count-sides   three regular shapes have the same number of sides, one has another number
//   count-dots    three pictures show the same number of dots, one shows another number
//   size          three shapes have the same size, one is clearly bigger or smaller
//   colour-split  six dots in two colours: three pictures split 4 and 2, one splits differently
// The verifier recomputes each property from the stored numbers only.

const IQ_BASIC_VARIANTS = [
  { key: 'count-sides',  minTier: 1 },
  { key: 'count-dots',   minTier: 1 },
  { key: 'size',         minTier: 1 },
  { key: 'colour-split', minTier: 2 }
];
const iqBasicVariant = key => IQ_BASIC_VARIANTS.find(v => v.key === key);
const IQ_BASIC_DOT_R = 8, IQ_BASIC_DOT_GAP = 24, IQ_BASIC_SW = 3;
const iqBasicColour = () => pickOne(IQ_SHAPE_COLORS);

function iqBasicPoly(n, R, rot){                                          // vertices of a regular polygon about the tile centre (n = 0: a circle)
  return Array.from({ length: n }, (_, i) => [50 + R * Math.cos((rot + i * 360 / n) * IQ_ADV_RAD), 50 + R * Math.sin((rot + i * 360 / n) * IQ_ADV_RAD)]);
}
const iqBasicShapeItem = (n, R) => ({ kind: 'basic', figure: 'shape', size: 100, strokeWidth: IQ_BASIC_SW, n, R, rot: randInt(0, 359), color: iqBasicColour() });
function iqBasicScatter(count){                                           // dot centres inside the tile, never touching each other
  for (let attempt = 0; attempt < 300; attempt++){
    const pts = [];
    for (let t = 0; t < 400 && pts.length < count; t++){
      const p = [iqAdvR5(iqAdvRand(16, 84)), iqAdvR5(iqAdvRand(16, 84))];
      if (pts.every(q => iqAdvDist(p, q) >= IQ_BASIC_DOT_GAP)) pts.push(p);
    }
    if (pts.length === count) return pts;
  }
  return null;
}

// ----- generation -----
function iqBasicBuild(def, makeItem, explain){
  for (let attempt = 0; attempt < 100; attempt++){
    const oddIndex = randInt(0, 3), plan = makeItem.plan();
    const items = [0, 1, 2, 3].map(i => makeItem.item(i === oddIndex, plan));
    if (items.some(it => !it)) continue;
    const result = { items, oddIndex, family: 'basic', variant: def.key, structureKey: 'basic:' + def.key, explanation: explain(plan) };
    if (iqBasicVerify(result)) return result;
  }
  throw new Error('iqBasicBuild: no valid question for "' + def.key + '".');
}
function iqBasicGenerate(def){
  if (def.key === 'count-sides') return iqBasicBuild(def, {
    plan: () => { const ns = shuffle([3, 4, 5, 6]), common = ns[0], odd = ns.find(n => Math.abs(n - common) >= 2); return { common, odd }; },
    item: (isOdd, plan) => iqBasicShapeItem(isOdd ? plan.odd : plan.common, 34)
  }, plan => 'בשלוש הצורות יש ' + plan.common + ' צלעות - בצורה שנבחרה יש ' + plan.odd + ' צלעות.');
  if (def.key === 'size') return iqBasicBuild(def, {
    plan: () => {
      const n = pickOne([0, 3, 4, 5, 6]), bigger = Math.random() < 0.5, k = iqAdvRand(1.6, 1.9);
      const common = bigger ? iqAdvRand(16, 21) : iqAdvRand(30, 38);
      return { n, common: Math.round(common), odd: Math.round(bigger ? common * k : common / k), bigger };
    },
    item: (isOdd, plan) => iqBasicShapeItem(plan.n, isOdd ? plan.odd : plan.common)
  }, plan => 'שלוש הצורות באותו גודל - הצורה שנבחרה ' + (plan.bigger ? 'גדולה' : 'קטנה') + ' מהן.');
  if (def.key === 'count-dots') return iqBasicBuild(def, {
    plan: () => { const ks = shuffle([2, 3, 4, 5, 6, 7]), common = ks[0], odd = ks.find(k => Math.abs(k - common) >= 2); return { common, odd }; },
    item: (isOdd, plan) => { const dots = iqBasicScatter(isOdd ? plan.odd : plan.common); return dots && { kind: 'basic', figure: 'dots', size: 100, strokeWidth: IQ_BASIC_SW, dots, color: iqBasicColour() }; }
  }, plan => 'בשלוש התמונות יש ' + plan.common + ' נקודות - בתמונה שנבחרה יש ' + plan.odd + ' נקודות.');
  // colour-split
  return iqBasicBuild(def, {
    plan: () => { const cols = shuffle(IQ_ADV_TRIO.slice()).slice(0, 2); return { cols, oddSplit: pickOne([[3, 3], [1, 5]]) }; },
    item: (isOdd, plan) => {
      const split = isOdd ? plan.oddSplit.slice() : [4, 2], flip = Math.random() < 0.5, pts = iqBasicScatter(6);
      if (!pts) return null;
      const colours = shuffle([].concat(Array(split[0]).fill(plan.cols[flip ? 1 : 0]), Array(split[1]).fill(plan.cols[flip ? 0 : 1])));
      return { kind: 'basic', figure: 'split', size: 100, strokeWidth: IQ_BASIC_SW, dots: pts.map((p, i) => ({ p, c: colours[i] })) };
    }
  }, plan => 'בשלוש התמונות יש ארבע נקודות מצבע אחד ושתיים מהצבע השני - בתמונה שנבחרה החלוקה היא ' + plan.oddSplit[0] + ' ו-' + plan.oddSplit[1] + '.');
}

// ----- rendering -----
function iqBasicRender(item){
  let out = '';
  if (item.figure === 'shape'){
    out = item.n === 0 ? iqAdvCircleEl(item, [50, 50], item.R, item.color, IQ_ADV_INK) : iqAdvPolyEl(item, iqBasicPoly(item.n, item.R, item.rot), item.color, IQ_ADV_INK);
  } else if (item.figure === 'dots'){
    item.dots.forEach(p => { out += iqAdvCircleEl(item, p, IQ_BASIC_DOT_R, item.color, IQ_ADV_INK); });
  } else {
    item.dots.forEach(d => { out += iqAdvCircleEl(item, d.p, IQ_BASIC_DOT_R, d.c, IQ_ADV_INK); });
  }
  return iqAdvSvg(item, out);
}

// ----- verification -----
function iqBasicVerify(result){
  const def = iqBasicVariant(result.variant);
  if (!def || !Array.isArray(result.items) || result.items.length !== 4) return false;
  const items = result.items, odd = result.oddIndex;
  if (!items.every(it => it && it.kind === 'basic' && it.size === 100 && Number.isFinite(it.strokeWidth))) return false;
  const dotsOk = pts => Array.isArray(pts) && pts.every(p => Array.isArray(p) && p.length === 2 && iqAdvInTile(p, 15.9)) && (pts.length < 2 || iqAdvMinDist(pts) >= IQ_BASIC_DOT_GAP - 0.1);
  if (def.key === 'count-sides' || def.key === 'size'){
    if (!items.every(it => it.figure === 'shape' && Number.isInteger(it.n) && Number.isFinite(it.R) && typeof it.color === 'string')) return false;
    if (def.key === 'count-sides'){
      if (!items.every(it => it.n >= 3 && it.n <= 6 && it.R === 34)) return false;
      const ns = items.map(it => it.n), common = ns[(odd + 1) % 4];
      return iqAdvLone(ns) === odd && Math.abs(ns[odd] - common) >= 2;
    }
    if (!items.every(it => it.n === items[0].n && [0, 3, 4, 5, 6].includes(it.n) && it.R >= 10 && it.R <= 40)) return false;
    const rs = items.map(it => it.R), common = rs[(odd + 1) % 4], ratio = Math.max(common, rs[odd]) / Math.min(common, rs[odd]);
    return iqAdvLone(rs) === odd && ratio >= 1.55;
  }
  if (def.key === 'count-dots'){
    if (!items.every(it => it.figure === 'dots' && dotsOk(it.dots) && it.dots.length >= 2 && it.dots.length <= 7)) return false;
    const ks = items.map(it => it.dots.length);
    return iqAdvLone(ks) === odd && Math.abs(ks[odd] - ks[(odd + 1) % 4]) >= 2;
  }
  // colour-split
  if (!items.every(it => it.figure === 'split' && Array.isArray(it.dots) && it.dots.length === 6 && dotsOk(it.dots.map(d => d.p)) && it.dots.every(d => IQ_ADV_TRIO.includes(d.c)))) return false;
  const split = it => { const m = {}; it.dots.forEach(d => { m[d.c] = (m[d.c] || 0) + 1; }); return Object.values(m).sort((a, b) => a - b).join(':'); };
  const pair = it => [...new Set(it.dots.map(d => d.c))].sort().join();
  if (items.some(it => new Set(it.dots.map(d => d.c)).size !== 2) || new Set(items.map(pair)).size !== 1) return false;       // the same two colours in every picture
  const sp = items.map(split);
  return iqAdvLone(sp) === odd && sp[(odd + 1) % 4] === '2:4' && ['3:3', '1:5'].includes(sp[odd]);
}

iqOddRegisterFamily({
  key: 'basic',
  minTier: 1,
  maxTier: 3,                                                              // easy questions: levels 1-3 only
  generate: tier => iqOddPickVariant('basic', tier).generate(tier),
  verify: result => iqBasicVerify(result),
  render: item => iqBasicRender(item)
});
iqOddRegisterVariants('basic', IQ_BASIC_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqBasicGenerate(def) })));
