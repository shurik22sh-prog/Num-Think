'use strict';

/* ============ Odd one out: two insight families (solid, trace) ============ */
// Questions that need an idea, not a comparison of pictures.
//   solid   one cube is shown from a corner in four pictures. Three pictures are the same cube
//           (six different marks, one on each face) seen from different corners; one picture cannot
//           belong to that cube - its faces are in the wrong order (a mirror image) or it shows two
//           faces that are opposite each other. The player has to build the cube in the mind from the views.
//   trace   four line drawings. Three can be drawn in one stroke, without lifting the pencil and without
//           going over a line twice; one cannot. The reason is the number of points where an odd number
//           of lines meet (0 or 2: possible, more: impossible) - the number of lines and points is equal everywhere.
// Both are registered ENABLED. The verifier recomputes everything from the stored data only.

// ===== solid: views of a cube =====
const IQ_SOLID_COLOURS = ['#D55E00', '#0072B2', '#009E73', '#F0B400', '#9B5DE5', '#E75480', '#56B4E9', '#7A7A8C'];
const IQ_SOLID_SHAPES = ['circle', 'square', 'triangle', 'cross', 'diamond', 'bar', 'ring', 'dot3'];
const IQ_SOLID_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const iqSolidDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const iqSolidCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// the 24 ordered face-direction triples (top, left, right) of a right-handed corner
const IQ_SOLID_TRIPLES = (() => {
  const out = [];
  IQ_SOLID_DIRS.forEach((u, iu) => IQ_SOLID_DIRS.forEach((v, iv) => {
    if (iqSolidDot(u, v) !== 0) return;
    const w = iqSolidCross(u, v), iw = IQ_SOLID_DIRS.findIndex(d => d[0] === w[0] && d[1] === w[1] && d[2] === w[2]);
    out.push([iu, iv, iw]);
  }));
  return out;
})();
const IQ_SOLID_TRIPLE_SET = new Set(IQ_SOLID_TRIPLES.map(t => t.join()));
const iqSolidOpposite = d => d ^ 1;                                        // directions come in opposite pairs 0/1, 2/3, 4/5

// can ONE cube (a different mark on each of its six faces) show all these views? views: [[top, left, right]] of mark ids
function iqSolidConsistent(views){
  const marks = [...new Set([].concat(...views))];
  if (marks.length > 6) return false;
  const assign = {}, used = new Array(6).fill(false);
  const fine = () => views.every(v => !v.every(m => m in assign) || IQ_SOLID_TRIPLE_SET.has(v.map(m => assign[m]).join()));
  const go = i => {
    if (i === marks.length) return true;
    for (let d = 0; d < 6; d++){
      if (used[d]) continue;
      assign[marks[i]] = d; used[d] = true;
      if (fine() && go(i + 1)) return true;
      used[d] = false; delete assign[marks[i]];
    }
    return false;
  };
  return go(0);
}
const iqSolidMarkOk = m => Number.isInteger(m) && m >= 0 && m < IQ_SOLID_SHAPES.length;

function iqSolidGenerate(){
  const E = 'בשלוש התמונות מוצגת אותה קובייה מפינות שונות. ';
  for (let attempt = 0; attempt < 600; attempt++){
    const marks = shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 6), face = shuffle(marks.slice());          // face[d] = the mark on the face in direction d
    const corners = {};
    IQ_SOLID_TRIPLES.forEach(t => { const k = t.slice().sort().join(); (corners[k] = corners[k] || []).push(t); });
    const keys = shuffle(Object.keys(corners));
    const view = k => pickOne(corners[k]).map(d => face[d]);
    const normals = keys.slice(0, 3).map(view);
    if (new Set([].concat(...normals)).size < 5) continue;                                              // the three views together show (almost) every mark
    const t4 = pickOne(corners[keys[3]]), mirror = Math.random() < 0.5;
    const odd = mirror ? [face[t4[0]], face[t4[2]], face[t4[1]]] : [face[t4[0]], face[t4[1]], face[iqSolidOpposite(t4[0])]];
    const oddIndex = randInt(0, 3), items = [];
    let n = 0;
    for (let i = 0; i < 4; i++) items.push({ kind: 'solid', figure: 'corner', size: 100, strokeWidth: 2, faces: i === oddIndex ? odd : normals[n++] });
    const result = { items, oddIndex, family: 'solid', variant: 'cube-views', structureKey: 'solid:cube-views',
      explanation: E + (mirror ? 'בתמונה שנבחרה שלוש הפאות מסודרות סביב הפינה בסדר הפוך, ולכן היא לא יכולה להיות אותה קובייה.' : 'בתמונה שנבחרה מופיעות יחד שתי פאות שהן מנוגדות זו לזו בקובייה, וזה לא יכול לקרות.') };
    if (iqSolidVerify(result)) return result;
  }
  throw new Error('iqSolidGenerate: no valid question.');
}
function iqSolidVerify(result){
  const items = result.items;
  if (!Array.isArray(items) || items.length !== 4) return false;
  if (!items.every(it => it && it.kind === 'solid' && it.figure === 'corner' && it.size === 100 && Number.isFinite(it.strokeWidth) && Array.isArray(it.faces) && it.faces.length === 3 && it.faces.every(iqSolidMarkOk) && new Set(it.faces).size === 3)) return false;
  const views = items.map(it => it.faces);
  if (new Set(views.map(v => v.slice().sort().join())).size !== 4) return false;                       // four different corners
  const fits = [0, 1, 2, 3].filter(i => iqSolidConsistent(views.filter((_, j) => j !== i)));          // leaving one picture out leaves a cube that fits the rest
  if (fits.length !== 1 || fits[0] !== result.oddIndex) return false;
  if (iqSolidConsistent(views)) return false;                                                           // all four cannot be one cube
  return new Set([].concat(...views.filter((_, j) => j !== result.oddIndex))).size >= 5;
}
function iqSolidGlyph(item, shape, cx, cy, r){
  const ink = IQ_ADV_INK, sw = 1.6, k = (item.size || 100) / 100;
  const P = pts => iqAdvPolyEl(item, pts, ink, ink);
  if (shape === 'circle') return iqAdvCircleEl(item, [cx, cy], r, ink, ink, sw);
  if (shape === 'ring') return iqAdvCircleEl(item, [cx, cy], r, 'none', ink, 2.4);
  if (shape === 'square') return iqAdvRectEl(item, cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, ink, ink, sw);
  if (shape === 'triangle') return P([[cx, cy - r], [cx + r, cy + r * 0.8], [cx - r, cy + r * 0.8]]);
  if (shape === 'diamond') return P([[cx, cy - r * 1.15], [cx + r * 0.9, cy], [cx, cy + r * 1.15], [cx - r * 0.9, cy]]);
  if (shape === 'bar') return iqAdvRectEl(item, cx - r, cy - r * 0.3, r * 2, r * 0.6, ink, ink, sw);
  if (shape === 'dot3') return [-0.8, 0, 0.8].map(d => iqAdvCircleEl(item, [cx + d * r, cy], r * 0.3, ink, ink, 1)).join('');
  const t = r * 0.32;                                                                                    // cross
  return P([[cx - t, cy - r], [cx + t, cy - r], [cx + t, cy - t], [cx + r, cy - t], [cx + r, cy + t], [cx + t, cy + t], [cx + t, cy + r], [cx - t, cy + r], [cx - t, cy + t], [cx - r, cy + t], [cx - r, cy - t], [cx - t, cy - t]]);
}
function iqSolidRender(item){
  const e = 34, a = e * Math.cos(Math.PI / 6), b = e / 2, N = [50, 50];
  const top = [N, [N[0] - a, N[1] - b], [N[0], N[1] - 2 * b], [N[0] + a, N[1] - b]];
  const left = [N, [N[0] - a, N[1] - b], [N[0] - a, N[1] - b + e], [N[0], N[1] + e]];
  const right = [N, [N[0] + a, N[1] - b], [N[0] + a, N[1] - b + e], [N[0], N[1] + e]];
  const centres = [[N[0], N[1] - b], [N[0] - a / 2, N[1] + (e - b) / 2], [N[0] + a / 2, N[1] + (e - b) / 2]];
  let out = '';
  [top, left, right].forEach((poly, i) => {
    const m = item.faces[i];
    out += iqAdvPolyEl(item, poly, IQ_SOLID_COLOURS[m], IQ_ADV_INK) + iqSolidGlyph(item, IQ_SOLID_SHAPES[m], centres[i][0], centres[i][1], 7);
  });
  return iqAdvSvg(item, out);
}

// ===== trace: drawings that can be traced in one stroke =====
const IQ_TRACE_MIN_NODE_GAP = 22, IQ_TRACE_CLEAR = 9, IQ_TRACE_MARGIN = 12, IQ_TRACE_MIN_EDGE = 18;
function iqTraceDegrees(item){
  const d = new Array(item.nodes.length).fill(0);
  item.edges.forEach(([a, b]) => { d[a]++; d[b]++; });
  return d;
}
function iqTraceConnected(item){
  const seen = new Set([0]), stack = [0];
  while (stack.length){ const v = stack.pop(); item.edges.forEach(([a, b]) => { const w = a === v ? b : (b === v ? a : -1); if (w >= 0 && !seen.has(w)){ seen.add(w); stack.push(w); } }); }
  return seen.size === item.nodes.length;
}
const iqTraceOddCount = item => iqTraceDegrees(item).filter(d => d % 2 === 1).length;
const iqTraceDrawable = item => iqTraceConnected(item) && iqTraceOddCount(item) <= 2;                // Euler: connected, at most two odd points
function iqTraceDrawingOk(item){
  const P = item.nodes;
  if (!P.every(p => iqAdvInTile(p, IQ_TRACE_MARGIN - 0.1)) || iqAdvMinDist(P) < IQ_TRACE_MIN_NODE_GAP - 0.1) return false;
  const E = item.edges;
  if (new Set(E.map(([a, b]) => Math.min(a, b) + ',' + Math.max(a, b))).size !== E.length) return false;
  for (const [a, b] of E){
    if (a === b || iqAdvDist(P[a], P[b]) < IQ_TRACE_MIN_EDGE) return false;
    for (let k = 0; k < P.length; k++) if (k !== a && k !== b && iqOddSegDist(P[k], P[a], P[b]) < IQ_TRACE_CLEAR) return false;
  }
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++){
    const [a, b] = E[i], [c, d] = E[j];
    if (a === c || a === d || b === c || b === d) continue;
    if (iqOddSegCross(P[a], P[b], P[c], P[d])) return false;
  }
  return true;
}
// one drawing with n points and m lines that is (wantDrawable) drawable in one stroke or not
function iqTraceDraw(n, m, wantDrawable){
  for (let attempt = 0; attempt < 4000; attempt++){
    const nodes = [];
    for (let t = 0; t < 300 && nodes.length < n; t++){
      const p = [iqAdvR5(iqAdvRand(IQ_TRACE_MARGIN, 100 - IQ_TRACE_MARGIN)), iqAdvR5(iqAdvRand(IQ_TRACE_MARGIN, 100 - IQ_TRACE_MARGIN))];
      if (nodes.every(q => iqAdvDist(p, q) >= IQ_TRACE_MIN_NODE_GAP)) nodes.push(p);
    }
    if (nodes.length !== n) continue;
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    const edges = [];
    for (const [a, b] of shuffle(pairs)){
      if (edges.length === m) break;
      const trial = { nodes, edges: edges.concat([[a, b]]) };
      if (iqTraceDrawingOkPartial(trial)) edges.push([a, b]);
    }
    const item = { kind: 'trace', figure: 'graph', size: 100, strokeWidth: 3, nodes, edges };
    if (edges.length !== m || !iqTraceDrawingOk(item) || !iqTraceConnected(item)) continue;
    const odd = iqTraceOddCount(item);
    if (wantDrawable ? odd > 2 : odd < 4) continue;
    return item;
  }
  return null;
}
const iqTraceDrawingOkPartial = trial => iqTraceDrawingOk(trial);
function iqTraceShape(item){
  const d = iqTraceDegrees(item);
  return { maxDeg: Math.max(...d), leaves: d.filter(x => x === 1).length, hubs: d.filter(x => x >= 4).length };
}
function iqTraceGenerate(){
  for (let attempt = 0; attempt < 200; attempt++){
    const n = randInt(6, 7), m = randInt(n + 2, n + 4), oddIndex = randInt(0, 3);
    const items = [0, 1, 2, 3].map(i => iqTraceDraw(n, m, i !== oddIndex));
    if (items.some(it => !it)) continue;
    const bad = iqTraceOddCount(items[oddIndex]);
    const result = { items, oddIndex, family: 'trace', variant: 'one-stroke', structureKey: 'trace:one-stroke',
      explanation: 'בשלושת הציורים אפשר לעבור על כל הקווים ברצף אחד, בלי להרים עט ובלי לעבור על קו פעמיים. בציור שנבחר אי אפשר - יש בו ' + bad + ' נקודות שמתחברים אליהן מספר אי־זוגי של קווים.' };
    if (iqTraceVerify(result)) return result;
  }
  throw new Error('iqTraceGenerate: no valid question.');
}
function iqTraceVerify(result){
  const items = result.items;
  if (!Array.isArray(items) || items.length !== 4) return false;
  const pt = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  if (!items.every(it => it && it.kind === 'trace' && it.figure === 'graph' && it.size === 100 && Number.isFinite(it.strokeWidth) && Array.isArray(it.nodes) && it.nodes.length >= 5 && it.nodes.length <= 8 && it.nodes.every(pt) &&
      Array.isArray(it.edges) && it.edges.every(e => Array.isArray(e) && e.length === 2 && e.every(v => Number.isInteger(v) && v >= 0 && v < it.nodes.length)))) return false;
  if (!items.every(iqTraceDrawingOk) || !items.every(iqTraceConnected)) return false;
  if (new Set(items.map(it => it.nodes.length)).size !== 1 || new Set(items.map(it => it.edges.length)).size !== 1) return false;     // same number of points and lines everywhere
  if (!iqOddExactlyOneBreaks(result, iqTraceDrawable)) return false;
  if (iqTraceOddCount(items[result.oddIndex]) < 4) return false;
  const shapes = items.map(iqTraceShape);
  return ['maxDeg', 'leaves', 'hubs'].every(k => iqAdvNoLone(shapes.map(s => s[k])));                    // no side measurement points at one drawing
}
function iqTraceRender(item){
  let out = item.edges.map(([a, b]) => iqAdvLineEl(item, item.nodes[a], item.nodes[b], IQ_ADV_INK, item.strokeWidth)).join('');
  out += item.nodes.map(p => iqAdvCircleEl(item, p, 4.5, IQ_ADV_INK, IQ_ADV_INK, 1)).join('');
  return iqAdvSvg(item, out);
}

iqOddRegisterFamily({
  key: 'solid',
  minTier: 4,
  largeTiles: true,
  generate: tier => iqOddPickVariant('solid', tier).generate(tier),
  verify: result => iqSolidVerify(result),
  render: item => iqSolidRender(item)
});
iqOddRegisterVariants('solid', [{ key: 'cube-views', minTier: 4, enabled: true, generate: () => iqSolidGenerate() }]);
iqOddRegisterFamily({
  key: 'trace',
  minTier: 3,
  largeTiles: true,
  generate: tier => iqOddPickVariant('trace', tier).generate(tier),
  verify: result => iqTraceVerify(result),
  render: item => iqTraceRender(item)
});
iqOddRegisterVariants('trace', [{ key: 'one-stroke', minTier: 3, enabled: true, generate: () => iqTraceGenerate() }]);
