'use strict';

/* ============ Odd one out: combinations of conditions (family 'combo') ============ */
// Every question here is built so that NO single measurement singles out the odd picture: either the
// rule is a RELATION between two measurements (dots versus axes of symmetry, versus right angles,
// sides versus size, colour step versus mirror), or it is a board that must satisfy several
// constraints at once. Variants (all registered ENABLED):
//   sudoku-box    4x4 boards in four colours: every row, column and 2x2 box holds all four colours; the odd board fails in its boxes
//   sudoku-row    the same; the odd board fails in its rows
//   queens        five marks, one per row and column: no two on a diagonal; the odd board has diagonal pairs
//   knight        five marks, one per row and column: no two a knight's move apart (diagonals allowed); the odd board has such a pair
//   mirror-colour right shape = mirror image of the left AND right colour = the next colour in the cycle; the odd picture steps the colour the other way
//   mirror-shape  the same two rules; the odd picture is turned half a turn instead of mirrored (its colour is right)
//   dots-axes     number of dots is greater than the number of axes of symmetry of the shape; in the odd picture it is not
//   dots-angles   number of dots is smaller than the number of right angles of the shape; in the odd picture it is not
//   size-sides    in each picture of three regular polygons, more sides means bigger; the odd picture has one pair the other way round
// The verifier recomputes every rule from the stored data only.

const IQ_COMBO_VARIANTS = [
  { key: 'dots-axes',     minTier: 4, explanation: 'בשלוש הצורות מספר הנקודות גדול ממספר צירי הסימטריה של הצורה. בצורה שנבחרה מספר הנקודות שווה למספר הצירים.' },
  { key: 'sudoku-box',    minTier: 4, explanation: 'בשלושת הלוחות בכל שורה, בכל עמודה ובכל ריבוע קטן יש את כל ארבעת הצבעים. בלוח שנבחר הריבועים הקטנים אינם כאלה.' },
  { key: 'dots-angles',   minTier: 5, explanation: 'בשלוש הצורות מספר הנקודות קטן ממספר הזוויות הישרות של הצורה. בצורה שנבחרה יש יותר נקודות מזוויות ישרות.' },
  { key: 'size-sides',    minTier: 5, explanation: 'בשלוש התמונות, ככל שלצורה יותר צלעות היא גדולה יותר. בתמונה שנבחרה המחומש קטן מצורה שיש לה פחות צלעות.' },
  { key: 'sudoku-row',    minTier: 5, explanation: 'בשלושת הלוחות בכל שורה, בכל עמודה ובכל ריבוע קטן יש את כל ארבעת הצבעים. בלוח שנבחר יש שורות שבהן צבע חוזר.' },
  { key: 'queens',        minTier: 5, explanation: 'בשלושת הלוחות אין שני סימונים על אותה שורה, עמודה או אלכסון. בלוח שנבחר יש סימונים על אותו אלכסון.' },
  { key: 'mirror-colour', minTier: 5, explanation: 'בשלוש הצורות הצורה הימנית היא תמונת ראי של השמאלית, והצבע הימני הוא הצבע הבא אחרי השמאלי במעגל. בצורה שנבחרה הצבע זז לכיוון ההפוך.' },
  { key: 'mirror-shape',  minTier: 6, explanation: 'בשלוש הצורות הצורה הימנית היא תמונת ראי של השמאלית, והצבע הימני הוא הצבע הבא אחרי השמאלי במעגל. בצורה שנבחרה הצבע נכון, אבל הצורה הימנית מסובבת חצי סיבוב ולא משוקפת.' },
  { key: 'knight',        minTier: 6, explanation: 'בשלושת הלוחות אין שני סימונים במרחק של קפיצת פרש (שני צעדים ועוד צעד). בלוח שנבחר יש זוג כזה.' }
];
const iqComboVariant = key => IQ_COMBO_VARIANTS.find(v => v.key === key);
const IQ_COMBO_DOT_R = 4.5, IQ_COMBO_CLEAR = 8.5, IQ_COMBO_SPACING = 14;

// ===== sudoku boards (4x4, values 0..3) =====
const iqComboCell = i => [i % 4, Math.floor(i / 4)];
const iqComboBoxOf = i => Math.floor(iqComboCell(i)[1] / 2) * 2 + Math.floor(iqComboCell(i)[0] / 2);
const iqComboGroups = {
  rows: Array.from({ length: 4 }, (_, r) => [0, 1, 2, 3].map(c => r * 4 + c)),
  cols: Array.from({ length: 4 }, (_, c) => [0, 1, 2, 3].map(r => r * 4 + c)),
  boxes: Array.from({ length: 4 }, (_, b) => Array.from({ length: 16 }, (_, i) => i).filter(i => iqComboBoxOf(i) === b))
};
const iqComboGroupOk = (board, g) => new Set(g.map(i => board[i])).size === 4;
const iqComboBad = (board, kind) => iqComboGroups[kind].filter(g => !iqComboGroupOk(board, g)).length;
function iqComboFill(active){                                           // random board satisfying the active groups (rows / cols / boxes)
  const board = new Array(16).fill(-1);
  const fits = (i, v) => active.every(kind => iqComboGroups[kind].every(g => !g.includes(i) || g.every(j => j === i || board[j] !== v)));
  const go = i => {
    if (i === 16) return true;
    for (const v of shuffle([0, 1, 2, 3])){
      if (!fits(i, v)) continue;
      board[i] = v;
      if (go(i + 1)) return true;
      board[i] = -1;
    }
    return false;
  };
  return go(0) ? board : null;
}
function iqComboGenSudoku(def){
  const oddKind = def.key === 'sudoku-box' ? 'boxes' : 'rows', active = oddKind === 'boxes' ? ['rows', 'cols'] : ['cols', 'boxes'];
  for (let attempt = 0; attempt < 200; attempt++){
    const oddIndex = randInt(0, 3), boards = [];
    for (let i = 0; i < 4; i++){
      let b = null;
      for (let t = 0; t < 60 && !b; t++){
        b = i === oddIndex ? iqComboFill(active) : iqComboFill(['rows', 'cols', 'boxes']);
        if (b && i === oddIndex && iqComboBad(b, oddKind) < 2) b = null;
      }
      if (!b) break;
      boards.push(b);
    }
    if (boards.length < 4 || new Set(boards.map(b => b.join(''))).size < 4) continue;
    const items = boards.map(b => ({ kind: 'combo', figure: 'sudoku', size: 100, strokeWidth: 1.6, cells: b }));
    const result = { items, oddIndex, family: 'combo', variant: def.key, structureKey: 'combo:' + def.key, explanation: def.explanation };
    if (iqComboVerify(result)) return result;
  }
  throw new Error('iqComboGenSudoku: no valid question for "' + def.key + '".');
}

// ===== five-mark boards (one mark per row and column) =====
const IQ_COMBO_PERMS = (() => {
  const out = [];
  const go = (p, left) => { if (!left.length){ out.push(p); return; } left.forEach((v, i) => go(p.concat([v]), left.filter((_, j) => j !== i))); };
  go([], [0, 1, 2, 3, 4]);
  return out;
})();
function iqComboPairStats(marks){                                        // pairs of marks: same diagonal, touching (king move), knight move
  let diag = 0, king = 0, knight = 0, farDiag = 0;
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++){
    const dx = Math.abs(marks[i][0] - marks[j][0]), dy = Math.abs(marks[i][1] - marks[j][1]);
    if (dx === dy){ diag++; if (dx >= 2) farDiag++; }
    if (Math.max(dx, dy) === 1) king++;
    if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) knight++;
  }
  return { diag, king, knight, farDiag };
}
const iqComboMarksOf = p => p.map((col, row) => [col, row]);
const IQ_COMBO_D4 = [([x, y]) => [x, y], ([x, y]) => [4 - y, x], ([x, y]) => [4 - x, 4 - y], ([x, y]) => [y, 4 - x], ([x, y]) => [4 - x, y], ([x, y]) => [y, x], ([x, y]) => [x, 4 - y], ([x, y]) => [4 - y, 4 - x]];
const iqComboD4Marks = marks => { const f = pickOne(IQ_COMBO_D4); return marks.map(f); };       // the 8 symmetries of the 5x5 board
function iqComboGenMarks(def){
  const queens = def.key === 'queens', stats = IQ_COMBO_PERMS.map(p => iqComboPairStats(iqComboMarksOf(p)));
  const normals = IQ_COMBO_PERMS.filter((p, i) => (queens ? stats[i].diag === 0 : stats[i].knight === 0 && stats[i].diag >= 2));
  const odds = IQ_COMBO_PERMS.filter((p, i) => (queens ? stats[i].diag === 2 && stats[i].farDiag === 2 : stats[i].knight === 1 && stats[i].diag >= 2));
  for (let attempt = 0; attempt < 300; attempt++){
    const oddIndex = randInt(0, 3), chosen = shuffle(normals.slice()).slice(0, 3);
    let n = 0;
    const items = [0, 1, 2, 3].map(i => ({ kind: 'combo', figure: 'marks', size: 100, strokeWidth: 1.6, marks: iqComboD4Marks(iqComboMarksOf(i === oddIndex ? pickOne(odds) : chosen[n++])) }));
    const result = { items, oddIndex, family: 'combo', variant: def.key, structureKey: 'combo:' + def.key, explanation: def.explanation };
    if (new Set(items.map(it => JSON.stringify(it.marks.slice().sort()))).size < 4) continue;
    if (iqComboVerify(result)) return result;
  }
  throw new Error('iqComboGenMarks: no valid question for "' + def.key + '".');
}

// ===== mirror shape + colour step =====
function iqComboDuo(startColour, step, halfTurn, base){
  const blob = base || iqAdvBlob(7, 8, 16, 30);
  const L = iqAdvShift(blob, iqAdvRand(24, 28), iqAdvRand(46, 54)).map(iqAdvPt5);
  const R = L.map(([x, y]) => (halfTurn ? [100 - x, 100 - y] : [100 - x, y]));
  return { L, R, lc: startColour, rc: (startColour + step + 3) % 3 };
}
function iqComboGenDuo(def){
  const shapeVariant = def.key === 'mirror-shape';
  for (let attempt = 0; attempt < 300; attempt++){
    const oddIndex = randInt(0, 3), starts = shuffle([0, 1, 2]);
    const normalStarts = shapeVariant ? [0, 1, 2, 3].map(() => randInt(0, 2)) : starts;
    let n = 0;
    const items = [0, 1, 2, 3].map(i => {
      const blob = iqAdvBlob(7, 8, 16, 30);
      if (!blob) return null;
      const startColour = shapeVariant ? normalStarts[i] : (i === oddIndex ? randInt(0, 2) : starts[n++]);
      const d = iqComboDuo(startColour, i === oddIndex && !shapeVariant ? -1 : 1, i === oddIndex && shapeVariant, blob);
      return { kind: 'combo', figure: 'duo', size: 100, strokeWidth: 2.2, L: d.L, R: d.R, lc: IQ_ADV_TRIO[d.lc], rc: IQ_ADV_TRIO[d.rc] };
    });
    if (items.some(it => !it)) continue;
    const result = { items, oddIndex, family: 'combo', variant: def.key, structureKey: 'combo:' + def.key, explanation: def.explanation };
    if (iqComboVerify(result)) return result;
  }
  throw new Error('iqComboGenDuo: no valid question for "' + def.key + '".');
}

// ===== shapes with dots =====
function iqComboLocalShape(type){
  const f = (a, b) => iqAdvRand(a, b);
  if (type === 'trapezoid'){ const s = f(0.95, 1.15); return [[-15 * s, -22 * s], [15 * s, -22 * s], [30 * s, 22 * s], [-30 * s, 22 * s]]; }
  if (type === 'rectangle'){ const w = f(42, 52), h = f(28, 38); return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]; }
  if (type === 'square'){ const a = f(40, 46); return [[-a / 2, -a / 2], [a / 2, -a / 2], [a / 2, a / 2], [-a / 2, a / 2]]; }
  if (type === 'kite'){ const s = f(0.95, 1.1); return [[0, -36 * s], [22 * s, -6 * s], [0, 30 * s], [-22 * s, -6 * s]]; }
  if (type === 'rhombus'){ const p = f(26, 32), q = f(16, 22); return [[0, -p], [q, 0], [0, p], [-q, 0]]; }
  if (type === 'triangle'){ const R = f(38, 41); return [0, 1, 2].map(i => [R * Math.cos((-90 + i * 120) * IQ_ADV_RAD), R * Math.sin((-90 + i * 120) * IQ_ADV_RAD)]); }
  // right trapezoid: a vertical left side
  const w = f(46, 54), h = f(40, 46), d = f(12, 24);
  return [[-w / 2, h / 2], [w / 2, h / 2], [w / 2 - d, -h / 2], [-w / 2, -h / 2]];
}
function iqComboPlaceDots(poly, n){                                      // dot centres, or null when they cannot sit clear of the outline and of each other
  const c = iqAdvMean(poly);
  for (let attempt = 0; attempt < 40; attempt++){
    const off = iqAdvRand(0, 360);
    for (let r = 16; r >= 6; r -= 1){
      let dots;
      if (n === 1){ dots = [c.slice()]; }
      else if (n === 2){ dots = [-1, 1].map(s => [c[0] + s * r * Math.cos(off * IQ_ADV_RAD) * 0.8, c[1] + s * r * Math.sin(off * IQ_ADV_RAD) * 0.8]); }
      else if (n === 3){ dots = [0, 1, 2].map(i => [c[0] + r * Math.cos((off + i * 120) * IQ_ADV_RAD), c[1] + r * Math.sin((off + i * 120) * IQ_ADV_RAD)]); }
      else { dots = [0, 1, 2, 3].map(i => [c[0] + r * Math.cos((off + i * 90) * IQ_ADV_RAD), c[1] + r * Math.sin((off + i * 90) * IQ_ADV_RAD)]); }
      const q = dots.map(iqAdvPt5);
      if (iqComboDotsClear(poly, q)) return q;
    }
  }
  return null;
}
function iqComboDotsClear(poly, dots){
  if (!dots.every(d => iqAdvPointInPoly(d, poly) && iqAdvEdgeDist(d, poly) >= IQ_COMBO_CLEAR - 0.3)) return false;
  return dots.length < 2 || iqAdvMinDist(dots) >= IQ_COMBO_SPACING - 0.3;
}
function iqComboShapeItem(type, nDots){
  for (let attempt = 0; attempt < 80; attempt++){
    const rot = iqAdvRand(0, 360), local = iqComboLocalShape(type).map(p => iqAdvRot(p, [0, 0], rot));
    const poly = iqAdvShift(local, 50 + iqAdvRand(-3, 3), 50 + iqAdvRand(-3, 3)).map(iqAdvPt5);
    if (!poly.every(p => iqAdvInTile(p, 6))) continue;
    const dots = iqComboPlaceDots(poly, nDots);
    if (dots) return { kind: 'combo', figure: 'dots', size: 100, strokeWidth: 2.2, poly, dots };
  }
  return null;
}
function iqComboAxes(poly){                                              // number of mirror axes (all pass through the centroid)
  const c = iqOddPolyCentroid(poly), hits = [];
  for (let a = 0; a < 180; a += 0.5) if (poly.every(p => { const r = iqAdvReflect(p, c, a); return poly.some(q => iqAdvDist(r, q) <= 1.3); })) hits.push(a);
  let n = 0;
  hits.forEach((a, i) => { if (i === 0 || a - hits[i - 1] > 2) n++; });
  if (hits.length > 1 && hits[hits.length - 1] - hits[0] >= 178 && hits.length > 1) n = Math.max(1, n - 1);       // an axis at ~0 and ~180 degrees is the same axis
  return n;
}
function iqComboRightAngles(poly){
  return poly.filter((p, i) => {
    const a = poly[(i + poly.length - 1) % poly.length], b = poly[(i + 1) % poly.length];
    const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]];
    return Math.abs(Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) / IQ_ADV_RAD - 90) < 3;
  }).length;
}
// four options on a 2x2 grid of (dots, measure) values; `cells` = the three normals, `oddCell` the odd one
const IQ_COMBO_DOT_GRIDS = {
  'dots-axes': [
    { normals: [[2, 'trapezoid'], [3, 'rectangle'], [3, 'kite']], odd: [2, 'rhombus'] },
    { normals: [[2, 'kite'], [3, 'rhombus'], [3, 'trapezoid']], odd: [2, 'rectangle'] },
    { normals: [[3, 'rectangle'], [4, 'triangle'], [4, 'rhombus']], odd: [3, 'triangle'] }
  ],
  'dots-angles': [
    { normals: [[1, 'right-trapezoid'], [1, 'rectangle'], [3, 'square']], odd: [3, 'right-trapezoid'] },
    { normals: [[1, 'right-trapezoid'], [1, 'square'], [3, 'rectangle']], odd: [3, 'right-trapezoid'] }
  ]
};
function iqComboGenDots(def){
  const grids = IQ_COMBO_DOT_GRIDS[def.key];
  for (let attempt = 0; attempt < 300; attempt++){
    const grid = pickOne(grids), oddIndex = randInt(0, 3);
    let n = 0;
    const items = [0, 1, 2, 3].map(i => { const [dots, type] = i === oddIndex ? grid.odd : grid.normals[n++]; return iqComboShapeItem(type, dots); });
    if (items.some(it => !it)) continue;
    const result = { items, oddIndex, family: 'combo', variant: def.key, structureKey: 'combo:' + def.key, explanation: def.explanation };
    if (iqComboVerify(result)) return result;
  }
  throw new Error('iqComboGenDots: no valid question for "' + def.key + '".');
}

// ===== regular polygons: more sides, bigger =====
const IQ_COMBO_SIDES = [3, 5, 6, 8];
const IQ_COMBO_SIZES = [13, 18, 24];
function iqComboRegular(p){ return Array.from({ length: p.n }, (_, i) => [p.c[0] + p.R * Math.cos((p.rot + i * 360 / p.n) * IQ_ADV_RAD), p.c[1] + p.R * Math.sin((p.rot + i * 360 / p.n) * IQ_ADV_RAD)]); }
const iqComboArea = p => 0.5 * p.n * p.R * p.R * Math.sin(2 * Math.PI / p.n);
const iqComboPerim = p => 2 * p.n * p.R * Math.sin(Math.PI / p.n);
function iqComboPlacePolys(specs){                                      // specs: [{n, R}] -> with centres and turns, or null
  for (let attempt = 0; attempt < 400; attempt++){
    const placed = specs.map(s => ({ n: s.n, R: s.R, c: [iqAdvRand(s.R + 4, 96 - s.R), iqAdvRand(s.R + 4, 96 - s.R)].map(iqAdvR5), rot: Math.round(iqAdvRand(0, 360)) }));
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) for (let j = i + 1; j < 3; j++) if (iqAdvDist(placed[i].c, placed[j].c) < placed[i].R + placed[j].R + 6) ok = false;
    if (ok) return placed;
  }
  return null;
}
function iqComboGenSizeSides(def){
  for (let attempt = 0; attempt < 300; attempt++){
    const ring = shuffle(IQ_COMBO_SIDES.slice()), pairs = [[ring[0], ring[1]], [ring[1], ring[2]], [ring[2], ring[3]], [ring[3], ring[0]]];
    const order = shuffle([0, 1, 2, 3]), oddIndex = randInt(0, 3), jit = IQ_COMBO_SIZES.map(v => v + iqAdvRand(-0.5, 0.5));
    const items = pairs.map((pr, k) => {
      const ns = [4].concat(pr).sort((a, b) => a - b);
      let radii = jit.slice();
      if (k === oddIndex){ const lowPair = Math.random() < 0.5; radii = lowPair ? [radii[1], radii[0], radii[2]] : [radii[0], radii[2], radii[1]]; }
      const placed = iqComboPlacePolys(ns.map((n, i) => ({ n, R: radii[i] })));
      return placed && { kind: 'combo', figure: 'polys', size: 100, strokeWidth: 2.2, polys: placed };
    });
    if (items.some(it => !it)) continue;
    const arranged = order.map(k => items[k]), oddAt = order.indexOf(oddIndex);
    const result = { items: arranged, oddIndex: oddAt, family: 'combo', variant: def.key, structureKey: 'combo:' + def.key, explanation: def.explanation };
    if (iqComboVerify(result)) return result;
  }
  throw new Error('iqComboGenSizeSides: no valid question.');
}

function iqComboGenerate(def){
  if (def.key === 'sudoku-box' || def.key === 'sudoku-row') return iqComboGenSudoku(def);
  if (def.key === 'queens' || def.key === 'knight') return iqComboGenMarks(def);
  if (def.key === 'mirror-colour' || def.key === 'mirror-shape') return iqComboGenDuo(def);
  if (def.key === 'size-sides') return iqComboGenSizeSides(def);
  return iqComboGenDots(def);
}

// ----- rendering -----
function iqComboRender(item){
  let out = '';
  if (item.figure === 'sudoku'){
    const cs = 20, o = 10;
    item.cells.forEach((v, i) => { const [x, y] = iqComboCell(i); out += iqAdvRectEl(item, o + x * cs, o + y * cs, cs, cs, IQ_ADV_QUAD[v], '#ffffff', 1.2); });
    out += iqAdvLineEl(item, [o + 2 * cs, o], [o + 2 * cs, o + 4 * cs], IQ_ADV_INK, 3) + iqAdvLineEl(item, [o, o + 2 * cs], [o + 4 * cs, o + 2 * cs], IQ_ADV_INK, 3);
    out += iqAdvRectEl(item, o, o, 4 * cs, 4 * cs, 'none', IQ_ADV_INK, 3);
  } else if (item.figure === 'marks'){
    const cs = 16, o = 10;
    out += iqAdvRectEl(item, o, o, 5 * cs, 5 * cs, '#ffffff', IQ_ADV_INK, 2);
    for (let i = 1; i < 5; i++) out += iqAdvLineEl(item, [o + i * cs, o], [o + i * cs, o + 5 * cs], '#c9c9d8', 1) + iqAdvLineEl(item, [o, o + i * cs], [o + 5 * cs, o + i * cs], '#c9c9d8', 1);
    item.marks.forEach(m => { out += iqAdvCircleEl(item, [o + (m[0] + 0.5) * cs, o + (m[1] + 0.5) * cs], 5.5, IQ_ADV_INK, IQ_ADV_INK, 1); });
  } else if (item.figure === 'duo'){
    out += iqAdvPolyEl(item, item.L, item.lc, IQ_ADV_INK) + iqAdvPolyEl(item, item.R, item.rc, IQ_ADV_INK);
  } else if (item.figure === 'dots'){
    out += iqAdvPolyEl(item, item.poly, '#f2f4fb', IQ_ADV_INK);
    item.dots.forEach(d => { out += iqAdvCircleEl(item, d, IQ_COMBO_DOT_R, IQ_ADV_INK, IQ_ADV_INK, 1); });
  } else {
    item.polys.forEach(p => { out += iqAdvPolyEl(item, iqComboRegular(p), '#dfe7fb', IQ_ADV_INK); });
  }
  return iqAdvSvg(item, out);
}

// ----- verification -----
function iqComboTwoTwo(values){                                          // exactly two distinct values, each shared by two options
  const m = {};
  values.forEach(v => { m[v] = (m[v] || 0) + 1; });
  const counts = Object.values(m);
  return counts.length === 2 && counts[0] === 2 && counts[1] === 2;
}
function iqComboVerify(result){
  const def = iqComboVariant(result.variant);
  if (!def || !Array.isArray(result.items) || result.items.length !== 4) return false;
  const items = result.items, odd = items[result.oddIndex];
  if (!items.every(it => it && it.kind === 'combo' && it.size === 100 && Number.isFinite(it.strokeWidth))) return false;
  if (def.key === 'sudoku-box' || def.key === 'sudoku-row'){
    if (!items.every(it => it.figure === 'sudoku' && Array.isArray(it.cells) && it.cells.length === 16 && it.cells.every(v => Number.isInteger(v) && v >= 0 && v <= 3))) return false;
    const full = it => ['rows', 'cols', 'boxes'].every(k => iqComboBad(it.cells, k) === 0);
    if (!iqOddExactlyOneBreaks(result, full)) return false;
    const oddKind = def.key === 'sudoku-box' ? 'boxes' : 'rows';
    if (iqComboBad(odd.cells, oddKind) < 2) return false;                                      // clearly broken in the intended place
    if (['rows', 'cols', 'boxes'].filter(k => k !== oddKind).some(k => iqComboBad(odd.cells, k) !== 0)) return false;   // and ONLY there
    return new Set(items.map(it => it.cells.join(''))).size === 4;
  }
  if (def.key === 'queens' || def.key === 'knight'){
    const cell = c => Array.isArray(c) && c.length === 2 && c.every(v => Number.isInteger(v) && v >= 0 && v <= 4);
    if (!items.every(it => it.figure === 'marks' && Array.isArray(it.marks) && it.marks.length === 5 && it.marks.every(cell))) return false;
    const perm = it => [0, 1].every(a => new Set(it.marks.map(m => m[a])).size === 5);        // one mark in every row and column
    if (!items.every(perm)) return false;
    const st = items.map(it => iqComboPairStats(it.marks));
    if (def.key === 'queens'){
      if (!iqOddExactlyOneBreaks(result, it => iqComboPairStats(it.marks).diag === 0)) return false;
      if (st[result.oddIndex].farDiag !== st[result.oddIndex].diag || st[result.oddIndex].diag < 2) return false;     // no two marks touch, so touching is no tell-tale
      return iqAdvNoLone(st.map(s => s.knight)) && iqAdvNoLone(st.map(s => s.king));
    }
    if (!iqOddExactlyOneBreaks(result, it => iqComboPairStats(it.marks).knight === 0)) return false;
    if (st.some(s => s.diag < 2)) return false;                                                 // diagonals are allowed and present everywhere: this is not the queens rule
    return iqAdvNoLone(st.map(s => s.diag)) && iqAdvNoLone(st.map(s => s.king));
  }
  if (def.key === 'mirror-colour' || def.key === 'mirror-shape'){
    if (!items.every(it => it.figure === 'duo' && Array.isArray(it.L) && Array.isArray(it.R) && it.L.length === 7 && it.R.length === 7 && IQ_ADV_TRIO.includes(it.lc) && IQ_ADV_TRIO.includes(it.rc))) return false;
    if (!items.every(it => it.L.every(p => iqAdvInTile(p, 6) && p[0] < 48) && it.R.every(p => iqAdvInTile(p, 6) && p[0] > 52))) return false;
    const mirrored = it => iqAdvSetsMatch(it.L.map(([x, y]) => [100 - x, y]), it.R, 0.6);
    const colourOk = it => IQ_ADV_TRIO.indexOf(it.rc) === (IQ_ADV_TRIO.indexOf(it.lc) + 1) % 3;
    if (!iqOddExactlyOneBreaks(result, it => mirrored(it) && colourOk(it))) return false;
    const shapeOnly = def.key === 'mirror-shape';
    if (shapeOnly){
      if (!colourOk(odd) || mirrored(odd)) return false;
      if (!iqAdvSetsMatch(odd.L.map(([x, y]) => [100 - x, 100 - y]), odd.R, 0.6)) return false;     // exactly a half-turn
      if (items.some(it => iqAdvXor(it.L.map(([x, y]) => [100 - x, y]), it.L.map(([x, y]) => [100 - x, 100 - y])) < 0.25)) return false;   // mirror and half-turn really differ
    } else {
      if (!mirrored(odd) || colourOk(odd)) return false;
      if ((IQ_ADV_TRIO.indexOf(odd.rc) + 1) % 3 !== IQ_ADV_TRIO.indexOf(odd.lc)) return false;        // the colour stepped the other way, not "same" or "random"
      const normals = items.filter((_, i) => i !== result.oddIndex);
      if (new Set(normals.map(it => it.lc)).size !== 3) return false;                                // the three normals show the whole cycle
    }
    return iqAdvNoLone(items.map(it => it.lc)) && iqAdvNoLone(items.map(it => it.rc)) && items.every(it => iqAdvAsymmetry(it.L) >= 0.1);
  }
  if (def.key === 'dots-axes' || def.key === 'dots-angles'){
    const axes = def.key === 'dots-axes';
    if (!items.every(it => it.figure === 'dots' && Array.isArray(it.poly) && Array.isArray(it.dots) && it.dots.length >= 1 && it.poly.every(p => iqAdvInTile(p, 5.5)) && iqComboDotsClear(it.poly, it.dots))) return false;
    const measure = it => (axes ? iqComboAxes(it.poly) : iqComboRightAngles(it.poly));
    const holds = it => (axes ? it.dots.length > measure(it) : it.dots.length < measure(it));
    if (!iqOddExactlyOneBreaks(result, holds)) return false;
    // both measurements are tied two-and-two, so neither one alone points at any picture
    if (!iqComboTwoTwo(items.map(it => it.dots.length)) || !iqComboTwoTwo(items.map(measure))) return false;
    return iqAdvNoLone(items.map(it => it.poly.length));
  }
  // size-sides
  const regular = p => p && Number.isInteger(p.n) && [3, 4, 5, 6, 8].includes(p.n) && Number.isFinite(p.R) && Array.isArray(p.c) && p.c.length === 2 && Number.isFinite(p.rot);
  if (!items.every(it => it.figure === 'polys' && Array.isArray(it.polys) && it.polys.length === 3 && it.polys.every(regular))) return false;
  const fits = it => it.polys.every(p => iqAdvInTile(p.c, p.R + 3)) && it.polys.every((p, i) => it.polys.every((q, j) => j <= i || iqAdvDist(p.c, q.c) >= p.R + q.R + 5.5));
  if (!items.every(fits)) return false;
  const pairsOf = it => { const out = []; it.polys.forEach((a, i) => it.polys.forEach((b, j) => { if (a.n < b.n) out.push([a, b]); })); return out; };
  const increasing = it => pairsOf(it).every(([a, b]) => a.R < b.R - 2);
  if (!iqOddExactlyOneBreaks(result, increasing)) return false;
  // every measure of size (radius, area, perimeter) tells the same story for every pair
  const consistent = it => pairsOf(it).every(([a, b]) => (a.R < b.R) === (iqComboArea(a) < iqComboArea(b)) && (a.R < b.R) === (iqComboPerim(a) < iqComboPerim(b)));
  if (!items.every(consistent)) return false;
  if (!items.every(it => new Set(it.polys.map(p => p.n)).size === 3 && it.polys.some(p => p.n === 4))) return false;     // the square is in every picture
  const ns = items.map(it => it.polys.map(p => p.n).filter(n => n !== 4).sort().join());
  if (new Set(ns).size !== 4) return false;
  for (const n of [3, 5, 6, 8]) if (items.filter(it => it.polys.some(p => p.n === n)).length !== 2) return false;      // every other kind of polygon is in exactly two pictures
  const sizes = items.map(it => it.polys.map(p => Math.round(p.R)).sort((a, b) => a - b).join());
  if (new Set(sizes).size !== 1) return false;                                                       // the same three sizes everywhere: size alone is no tell-tale
  // the odd picture has exactly one reversed pair, between neighbours in the side order
  const sorted = odd.polys.slice().sort((a, b) => a.n - b.n);
  const reversed = [[0, 1], [1, 2]].filter(([i, j]) => sorted[i].R > sorted[j].R);
  return reversed.length === 1 && pairsOf(odd).filter(([a, b]) => a.R > b.R).length === 1;
}

iqOddRegisterFamily({
  key: 'combo',
  minTier: 4,
  enabled: true,
  largeTiles: true,                                                        // detailed drawings: 120px tiles on wide screens (see css/iq.css)
  generate: tier => iqOddPickVariant('combo', tier).generate(tier),
  verify: result => iqComboVerify(result),
  render: item => iqComboRender(item)
});
iqOddRegisterVariants('combo', IQ_COMBO_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqComboGenerate(def) })));
