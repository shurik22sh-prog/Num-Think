'use strict';

/* ============ Odd one out: three reasoning families (overlay, balance, induce) ============ */
// Questions where each picture hides a small piece of logic that has to be worked out.
//   overlay  each picture shows two 3x3 patterns and a third one made from them by one cell-by-cell operation
//            (only the first is coloured / only one of the two is coloured / both / at least one ...).
//            Three pictures use the SAME operation, one uses another. The operation is never named.
//   balance  each picture shows three balanced scales with three kinds of weights. In three pictures the scales
//            are all true for some fixed weights of the three kinds; in one picture they contradict each other
//            (any two of its scales are fine, all three together are impossible).
//   induce   each picture shows two examples "before -> after" of a hidden two-step rule on a group of marks
//            (the shape, colour, number or fill changes). Three pictures follow the same rule; in one picture the
//            rule differs in exactly one step. The two examples together identify the rule uniquely.
// All three are registered ENABLED. The verifier recomputes every rule from the stored data only.

// ===== overlay =====
const IQ_OVERLAY_OPS = {
  xor: (a, b) => a ^ b, and: (a, b) => a & b, or: (a, b) => a | b, anb: (a, b) => a & (1 - b), bna: (a, b) => b & (1 - a)
};
const IQ_OVERLAY_TEXT = {
  xor: 'התא צבוע כאשר רק אחד משני הדפוסים הראשונים צבוע בו', and: 'התא צבוע כאשר שני הדפוסים הראשונים צבועים בו',
  or: 'התא צבוע כאשר לפחות אחד משני הדפוסים הראשונים צבוע בו', anb: 'התא צבוע כאשר הדפוס הראשון צבוע בו והשני לא', bna: 'התא צבוע כאשר הדפוס השני צבוע בו והראשון לא'
};
const iqOverlayPop = bits => bits.reduce((s, v) => s + v, 0);
const iqOverlayBits = v => Array.isArray(v) && v.length === 9 && v.every(x => x === 0 || x === 1);
const iqOverlayConsistent = item => Object.keys(IQ_OVERLAY_OPS).filter(k => item.r.every((v, i) => v === IQ_OVERLAY_OPS[k](item.a[i], item.b[i])));
function iqOverlayTile(op){
  for (let attempt = 0; attempt < 400; attempt++){
    const bits = () => Array.from({ length: 9 }, () => (Math.random() < 0.5 ? 1 : 0));
    const a = bits(), b = bits(), r = a.map((v, i) => IQ_OVERLAY_OPS[op](v, b[i]));
    const item = { kind: 'overlay', figure: 'grids', size: 100, strokeWidth: 1.6, a, b, r };
    if ([a, b].some(x => iqOverlayPop(x) < 3 || iqOverlayPop(x) > 6) || iqOverlayPop(r) < 2 || iqOverlayPop(r) > 7) continue;
    const ok = iqOverlayConsistent(item);
    if (ok.length === 1 && ok[0] === op) return item;                                                  // this picture alone tells which operation it is
  }
  return null;
}
function iqOverlayGenerate(){
  for (let attempt = 0; attempt < 200; attempt++){
    const ops = shuffle(Object.keys(IQ_OVERLAY_OPS)), common = ops[0], other = ops[1], oddIndex = randInt(0, 3);
    const items = [0, 1, 2, 3].map(i => iqOverlayTile(i === oddIndex ? other : common));
    if (items.some(it => !it)) continue;
    const result = { items, oddIndex, family: 'overlay', variant: 'hidden-op', structureKey: 'overlay:' + common + '/' + other,
      explanation: 'בשלוש התמונות הדפוס השלישי מתקבל משני הראשונים באותה פעולה: ' + IQ_OVERLAY_TEXT[common] + '. בתמונה שנבחרה הפעולה שונה: ' + IQ_OVERLAY_TEXT[other] + '.' };
    if (iqOverlayVerify(result)) return result;
  }
  throw new Error('iqOverlayGenerate: no valid question.');
}
function iqOverlayVerify(result){
  const items = result.items;
  if (!Array.isArray(items) || items.length !== 4) return false;
  if (!items.every(it => it && it.kind === 'overlay' && it.figure === 'grids' && it.size === 100 && Number.isFinite(it.strokeWidth) && iqOverlayBits(it.a) && iqOverlayBits(it.b) && iqOverlayBits(it.r))) return false;
  const sets = items.map(iqOverlayConsistent);
  if (!sets.every(s => s.length === 1)) return false;                                                   // every picture shows exactly one operation
  const ops = sets.map(s => s[0]);
  if (lone4(ops) !== result.oddIndex) return false;                                                      // three the same, one different
  if (new Set(items.map(it => it.a.join('') + it.b.join('') + it.r.join(''))).size !== 4) return false;
  return iqAdvNoLone(items.map(it => iqOverlayPop(it.r))) && iqAdvNoLone(items.map(it => iqOverlayPop(it.a))) && iqAdvNoLone(items.map(it => iqOverlayPop(it.b)));
}
const lone4 = iqAdvLone;
function iqOverlayRender(item){
  const c = 8.6, gap = 9, w = 3 * c, total = 3 * w + 2 * gap, x0 = (100 - total) / 2, y0 = 50 - w / 2;
  let out = '';
  [item.a, item.b, item.r].forEach((bits, g) => {
    const gx = x0 + g * (w + gap);
    bits.forEach((v, i) => { out += iqAdvRectEl(item, gx + (i % 3) * c, y0 + Math.floor(i / 3) * c, c, c, v ? IQ_ADV_INK : '#ffffff', '#8a8fb0', 1.2); });
  });
  const ax = x0 + 2 * w + gap + gap / 2;
  out += iqAdvCircleEl(item, [x0 + w + gap / 2, 50], 1.8, '#8a8fb0', '#8a8fb0', 1);                      // a neutral dot: the operation is not named
  out += iqAdvLineEl(item, [ax - 3, 50], [ax + 3, 50], '#8a8fb0', 1.6) + iqAdvLineEl(item, [ax + 0.6, 47.4], [ax + 3, 50], '#8a8fb0', 1.6) + iqAdvLineEl(item, [ax + 0.6, 52.6], [ax + 3, 50], '#8a8fb0', 1.6);
  return iqAdvSvg(item, out);
}

// ===== balance =====
// every possible scale: counts of three kinds of weights on each side, no kind on both sides, at most 4 weights per side
const IQ_BALANCE_SCALES = (() => {
  const out = [], side = [];
  for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++) for (let c = 0; c <= 3; c++) if (a + b + c <= 4) side.push([a, b, c]);
  side.forEach(l => side.forEach(r => {
    if (l.every(v => v === 0) || r.every(v => v === 0) || l.some((v, i) => v > 0 && r[i] > 0)) return;
    out.push({ left: l, right: r, d: l.map((v, i) => v - r[i]) });
  }));
  return out;
})();
const iqBalanceCross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const iqBalanceZero = v => v.every(x => x === 0);
const iqBalancePositive = n => n.every(x => x > 0) || n.every(x => x < 0);
// can the three scales all be balanced with positive weights for the three kinds?
function iqBalanceConsistent(rows){
  let n = null;
  for (let i = 0; i < rows.length && !n; i++) for (let j = i + 1; j < rows.length && !n; j++){ const c = iqBalanceCross(rows[i], rows[j]); if (!iqBalanceZero(c)) n = c; }
  if (!n){                                                                                              // all scales say the same thing (rank 1)
    const r = rows.find(v => !iqBalanceZero(v));
    return !r || (r.some(x => x > 0) && r.some(x => x < 0));
  }
  return iqBalancePositive(n) && rows.every(v => v[0] * n[0] + v[1] * n[1] + v[2] * n[2] === 0);
}
const iqBalanceRank = rows => {
  if (rows.every(iqBalanceZero)) return 0;
  let two = false;
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) if (!iqBalanceZero(iqBalanceCross(rows[i], rows[j]))) two = true;
  if (!two) return 1;
  const [a, b, c] = rows, det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  return det === 0 ? 2 : 3;
};
function iqBalanceTile(consistent){
  for (let attempt = 0; attempt < 600; attempt++){
    let scales;
    if (consistent){
      const w = [randInt(1, 6), randInt(1, 6), randInt(1, 6)], fit = IQ_BALANCE_SCALES.filter(s => s.d[0] * w[0] + s.d[1] * w[1] + s.d[2] * w[2] === 0);
      if (fit.length < 6) continue;
      scales = [pickOne(fit), pickOne(fit), pickOne(fit)];
      if (iqBalanceRank(scales.map(s => s.d)) !== 2) continue;                                          // two independent scales fix the weights up to a scale
    } else {
      scales = [pickOne(IQ_BALANCE_SCALES), pickOne(IQ_BALANCE_SCALES), pickOne(IQ_BALANCE_SCALES)];
      const rows = scales.map(s => s.d);
      if (iqBalanceRank(rows) !== 3) continue;
      if (![[0, 1], [0, 2], [1, 2]].every(([i, j]) => iqBalancePositive(iqBalanceCross(rows[i], rows[j])))) continue;   // any TWO of the scales can be true together
    }
    if (new Set(scales.map(s => JSON.stringify([s.left, s.right]))).size !== 3) continue;
    const used = [0, 1, 2].filter(t => scales.some(s => s.left[t] || s.right[t]));
    if (used.length !== 3) continue;                                                                    // all three kinds of weights appear
    return { kind: 'balance', figure: 'scales', size: 100, strokeWidth: 2, scales: scales.map(s => ({ left: s.left.slice(), right: s.right.slice() })) };
  }
  return null;
}
const iqBalanceRows = item => item.scales.map(s => s.left.map((v, i) => v - s.right[i]));
const iqBalanceTotal = item => item.scales.reduce((s, x) => s + x.left.reduce((p, q) => p + q, 0) + x.right.reduce((p, q) => p + q, 0), 0);
function iqBalanceGenerate(){
  for (let attempt = 0; attempt < 300; attempt++){
    const oddIndex = randInt(0, 3), items = [0, 1, 2, 3].map(i => iqBalanceTile(i !== oddIndex));
    if (items.some(it => !it)) continue;
    const result = { items, oddIndex, family: 'balance', variant: 'consistent-scales', structureKey: 'balance:consistent-scales',
      explanation: 'בשלוש התמונות שלושת המאזניים נכונים יחד - לכל סוג משקולת יש משקל קבוע. בתמונה שנבחרה אי אפשר: כל שני מאזניים מתאימים זה לזה, אבל שלושתם יחד סותרים.' };
    if (iqBalanceVerify(result)) return result;
  }
  throw new Error('iqBalanceGenerate: no valid question.');
}
function iqBalanceVerify(result){
  const items = result.items, cnt = v => Array.isArray(v) && v.length === 3 && v.every(x => Number.isInteger(x) && x >= 0 && x <= 3);
  if (!Array.isArray(items) || items.length !== 4) return false;
  if (!items.every(it => it && it.kind === 'balance' && it.figure === 'scales' && it.size === 100 && Number.isFinite(it.strokeWidth) && Array.isArray(it.scales) && it.scales.length === 3 &&
      it.scales.every(s => s && cnt(s.left) && cnt(s.right) && s.left.reduce((p, q) => p + q, 0) <= 4 && s.right.reduce((p, q) => p + q, 0) <= 4 && s.left.some(x => x) && s.right.some(x => x) && !s.left.some((v, i) => v && s.right[i])))) return false;
  if (!iqOddExactlyOneBreaks(result, it => iqBalanceConsistent(iqBalanceRows(it)))) return false;
  const odd = iqBalanceRows(items[result.oddIndex]);
  if (iqBalanceRank(odd) !== 3 || ![[0, 1], [0, 2], [1, 2]].every(([i, j]) => iqBalancePositive(iqBalanceCross(odd[i], odd[j])))) return false;   // the contradiction needs all three scales
  if (!items.every((it, i) => i === result.oddIndex || iqBalanceRank(iqBalanceRows(it)) === 2)) return false;
  return iqAdvNoLone(items.map(iqBalanceTotal)) && new Set(items.map(it => JSON.stringify(it.scales))).size === 4;
}
function iqBalanceWeight(item, kind, cx, cy){
  const r = 3.7, ink = IQ_ADV_INK, col = IQ_ADV_QUAD[kind];
  if (kind === 0) return iqAdvCircleEl(item, [cx, cy], r, col, ink, 1.4);
  if (kind === 1) return iqAdvRectEl(item, cx - r, cy - r, 2 * r, 2 * r, col, ink, 1.4);
  return iqAdvPolyEl(item, [[cx, cy - r * 1.05], [cx + r * 1.1, cy + r * 0.85], [cx - r * 1.1, cy + r * 0.85]], col, ink);
}
function iqBalanceRender(item){
  let out = '';
  item.scales.forEach((s, k) => {
    const y = 14 + k * 32, beam = y + 9;                                                                  // weights sit on the pans, the beam is below them
    out += iqAdvLineEl(item, [14, beam], [86, beam], IQ_ADV_INK, 2.4) + iqAdvPolyEl(item, [[50, beam], [45, beam + 8], [55, beam + 8]], IQ_ADV_INK, IQ_ADV_INK);
    [[s.left, 30], [s.right, 70]].forEach(([counts, cx]) => {
      const list = []; counts.forEach((n, kind) => { for (let i = 0; i < n; i++) list.push(kind); });
      const x0 = cx - (list.length * 8.4) / 2 + 4.2;
      list.forEach((kind, i) => { out += iqBalanceWeight(item, kind, x0 + i * 8.4, beam - 5); });
      out += iqAdvLineEl(item, [cx - 17, beam], [cx + 17, beam], IQ_ADV_INK, 2.4);
    });
  });
  return iqAdvSvg(item, out);
}

// ===== induce =====
const IQ_INDUCE_ATTRS = ['shape', 'colour', 'count', 'fill'];
const IQ_INDUCE_OPS = { shape: ['+1', '-1'], colour: ['+1', '-1'], count: ['+1', '+2', 'x2'], fill: ['flip'] };
function iqInduceApply(attr, op, v){
  if (attr === 'shape' || attr === 'colour') return (v + (op === '+1' ? 1 : 2)) % 3;
  if (attr === 'fill') return 1 - v;
  const n = op === '+1' ? v + 1 : (op === '+2' ? v + 2 : v * 2);
  return n >= 1 && n <= 6 ? n : null;
}
// every rule = two steps on two different attributes
const IQ_INDUCE_RULES = (() => {
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) IQ_INDUCE_OPS[IQ_INDUCE_ATTRS[i]].forEach(o1 => IQ_INDUCE_OPS[IQ_INDUCE_ATTRS[j]].forEach(o2 => out.push([[IQ_INDUCE_ATTRS[i], o1], [IQ_INDUCE_ATTRS[j], o2]])));
  return out;
})();
const iqInduceKey = rule => rule.map(s => s.join(' ')).join(' | ');
function iqInduceRun(rule, st){
  const out = Object.assign({}, st);
  for (const [attr, op] of rule){ const v = iqInduceApply(attr, op, st[attr]); if (v === null) return null; out[attr] = v; }
  return out;
}
const iqInduceSame = (a, b) => IQ_INDUCE_ATTRS.every(k => a[k] === b[k]);
const iqInduceState = s => s && Number.isInteger(s.shape) && s.shape >= 0 && s.shape < 3 && Number.isInteger(s.colour) && s.colour >= 0 && s.colour < 3 && Number.isInteger(s.count) && s.count >= 1 && s.count <= 6 && (s.fill === 0 || s.fill === 1);
const iqInduceFits = pairs => IQ_INDUCE_RULES.filter(rule => pairs.every(p => { const r = iqInduceRun(rule, p.from); return r && iqInduceSame(r, p.to); }));
const iqInduceRandomState = () => ({ shape: randInt(0, 2), colour: randInt(0, 2), count: randInt(1, 4), fill: randInt(0, 1) });
function iqInduceTile(rule){
  for (let attempt = 0; attempt < 400; attempt++){
    const pairs = [0, 1].map(() => { const from = iqInduceRandomState(), to = iqInduceRun(rule, from); return to && { from, to }; });
    if (pairs.some(p => !p) || iqInduceSame(pairs[0].from, pairs[1].from)) continue;
    const fits = iqInduceFits(pairs);
    if (fits.length !== 1 || iqInduceKey(fits[0]) !== iqInduceKey(rule)) continue;                      // the two examples together identify exactly this rule
    if (rule.some(st => st[0] === 'count') && iqInduceFits([pairs[0]]).length < 2) continue;           // with a number step, one example alone is not enough
    return { kind: 'induce', figure: 'examples', size: 100, strokeWidth: 2, pairs };
  }
  return null;
}
// a rule that differs from `rule` in exactly one step
function iqInduceNeighbours(rule){
  const key = iqInduceKey(rule);
  return IQ_INDUCE_RULES.filter(r => r.filter(s => rule.some(t => t[0] === s[0] && t[1] === s[1])).length === 1 && iqInduceKey(r) !== key);
}
const IQ_INDUCE_NAMES = { shape: ['צורה', 'הצורה עוברת לצורה הבאה (עיגול, ריבוע, משולש, ושוב עיגול)', 'הצורה עוברת לצורה הקודמת'], colour: ['צבע', 'הצבע עובר לצבע הבא (כתום, כחול, ירוק, ושוב כתום)', 'הצבע עובר לצבע הקודם'], count: ['מספר', '', ''], fill: ['מילוי', 'הצורות מתמלאות אם היו ריקות, ומתרוקנות אם היו מלאות', ''] };
function iqInduceText(rule){
  return rule.map(([attr, op]) => {
    if (attr === 'count') return op === '+1' ? 'מספר הצורות גדל ב-1' : (op === '+2' ? 'מספר הצורות גדל ב-2' : 'מספר הצורות מוכפל פי 2');
    if (attr === 'fill') return IQ_INDUCE_NAMES.fill[1];
    return IQ_INDUCE_NAMES[attr][op === '+1' ? 1 : 2];
  }).join(', ובנוסף ');
}
function iqInduceGenerate(){
  for (let attempt = 0; attempt < 200; attempt++){
    const common = pickOne(IQ_INDUCE_RULES.filter(r => r.some(st => st[0] === 'count'))), other = pickOne(iqInduceNeighbours(common)), oddIndex = randInt(0, 3);
    const items = [0, 1, 2, 3].map(i => iqInduceTile(i === oddIndex ? other : common));
    if (items.some(it => !it)) continue;
    const result = { items, oddIndex, family: 'induce', variant: 'two-step-rule', structureKey: 'induce:' + iqInduceKey(common),
      explanation: 'בשלוש התמונות הכלל הוא: ' + iqInduceText(common) + '. בתמונה שנבחרה הכלל שונה באחד משני הצעדים: ' + iqInduceText(other) + '.' };
    if (iqInduceVerify(result)) return result;
  }
  throw new Error('iqInduceGenerate: no valid question.');
}
function iqInduceVerify(result){
  const items = result.items;
  if (!Array.isArray(items) || items.length !== 4) return false;
  if (!items.every(it => it && it.kind === 'induce' && it.figure === 'examples' && it.size === 100 && Number.isFinite(it.strokeWidth) && Array.isArray(it.pairs) && it.pairs.length === 2 && it.pairs.every(p => p && iqInduceState(p.from) && iqInduceState(p.to)))) return false;
  const fits = items.map(it => iqInduceFits(it.pairs));
  if (!fits.every(f => f.length === 1)) return false;                                                    // each picture shows exactly one rule
  const keys = fits.map(f => iqInduceKey(f[0]));
  if (iqAdvLone(keys) !== result.oddIndex) return false;
  const a = fits[(result.oddIndex + 1) % 4][0], b = fits[result.oddIndex][0];
  if (a.filter(s => b.some(t => t[0] === s[0] && t[1] === s[1])).length !== 1) return false;            // the rules share exactly one step
  return items.every((it, i) => !iqInduceSame(it.pairs[0].from, it.pairs[1].from) && (!fits[i][0].some(st => st[0] === 'count') || iqInduceFits([it.pairs[0]]).length >= 2));
}
function iqInduceFigure(item, st, cx, cy){
  const r = 4.3, step = 11, rows = st.count <= 3 ? 1 : 2, perRow = rows === 1 ? st.count : 3;
  let out = '';
  for (let i = 0; i < st.count; i++){
    const row = Math.floor(i / 3), inRow = rows === 1 ? st.count : (row === 0 ? 3 : st.count - 3), idx = rows === 1 ? i : i % 3;
    const x = cx + (idx - (inRow - 1) / 2) * step, y = cy + (rows === 1 ? 0 : (row - 0.5) * step);
    const col = IQ_ADV_TRIO[st.colour], fill = st.fill ? col : '#ffffff', sw = st.fill ? 1.2 : 2.2, stroke = st.fill ? IQ_ADV_INK : col;
    if (st.shape === 0) out += iqAdvCircleEl(item, [x, y], r, fill, stroke, sw);
    else if (st.shape === 1) out += iqAdvRectEl(item, x - r, y - r, 2 * r, 2 * r, fill, stroke, sw);
    else out += iqAdvPolyEl(item, [[x, y - r * 1.1], [x + r * 1.15, y + r * 0.9], [x - r * 1.15, y + r * 0.9]], fill, stroke);
  }
  void perRow;
  return out;
}
function iqInduceRender(item){
  let out = '';
  item.pairs.forEach((p, k) => {
    const y = 28 + k * 44;
    out += iqInduceFigure(item, p.from, 24, y) + iqInduceFigure(item, p.to, 76, y);
    out += iqAdvLineEl(item, [42, y], [58, y], IQ_ADV_INK, 2) + iqAdvLineEl(item, [53.5, y - 3.5], [58, y], IQ_ADV_INK, 2) + iqAdvLineEl(item, [53.5, y + 3.5], [58, y], IQ_ADV_INK, 2);
  });
  return iqAdvSvg(item, out);
}

iqOddRegisterFamily({ key: 'overlay', minTier: 4, largeTiles: true, generate: tier => iqOddPickVariant('overlay', tier).generate(tier), verify: iqOverlayVerify, render: iqOverlayRender });
iqOddRegisterVariants('overlay', [{ key: 'hidden-op', minTier: 4, enabled: true, generate: () => iqOverlayGenerate() }]);
iqOddRegisterFamily({ key: 'balance', minTier: 4, largeTiles: true, generate: tier => iqOddPickVariant('balance', tier).generate(tier), verify: iqBalanceVerify, render: iqBalanceRender });
iqOddRegisterVariants('balance', [{ key: 'consistent-scales', minTier: 4, enabled: true, generate: () => iqBalanceGenerate() }]);
iqOddRegisterFamily({ key: 'induce', minTier: 5, largeTiles: true, generate: tier => iqOddPickVariant('induce', tier).generate(tier), verify: iqInduceVerify, render: iqInduceRender });
iqOddRegisterVariants('induce', [{ key: 'two-step-rule', minTier: 5, enabled: true, generate: () => iqInduceGenerate() }]);
