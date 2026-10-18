'use strict';
// Focused tests of the stacking-order family (key 'stack', variant 'three-shapes'): three overlapping shapes (circle, square, triangle);
// three pictures stack them in the same order, one swaps two neighbouring layers. Everything is derived from the rendered SVG
// (the painting order is the order of the tags; overlaps are measured on a 1-unit grid) with test-side geometry. Rules under test:
//   - family and variant are registered DISABLED (family minTier 4, variant minTier 4);
//   - every picture has exactly a circle, a square and a triangle, each always in the same colour across the four pictures;
//   - each pair overlaps by 25-50% of the smaller shape (3% slack for the sampling), every shape is at least 45% visible (42% with slack),
//     everything stays inside the tile, the union areas agree within 10%;
//   - exactly one picture has a different top-to-bottom order, and it differs from the others by swapping two neighbouring layers.

const H = require('../harness');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.STACK_SAMPLE_SCALE || 1);
const TEXT = 'בשלוש התמונות הצורות מונחות זו על זו באותו סדר - בתמונה שנבחרה שתי צורות מחליפות מקום בסדר.';

function parsePicture(svg){
  const tags = [...svg.matchAll(/<(circle|polygon)\b([^>]*)\/>/g)];
  return tags.map(m => {
    const attr = k => { const a = new RegExp(k + '="([^"]*)"').exec(m[2]); return a ? a[1] : null; };
    if (m[1] === 'circle') return { type: 'circle', cx: +attr('cx'), cy: +attr('cy'), r: +attr('r'), fill: attr('fill'), sw: +attr('stroke-width') };
    const pts = attr('points').trim().split(/\s+/).map(p => p.split(',').map(Number));
    return { type: pts.length === 4 ? 'square' : 'triangle', pts, fill: attr('fill'), sw: +attr('stroke-width'), n: pts.length };
  });
}
const inside = (s, x, y) => { if (s.type === 'circle') return Math.hypot(x - s.cx, y - s.cy) <= s.r; let c = false; for (let a = 0, b = s.pts.length - 1; a < s.pts.length; b = a++){ const [xa, ya] = s.pts[a], [xb, yb] = s.pts[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
function measure(shapes){            // fine 1-unit grid, shapes bottom -> top
  const n = shapes.length, area = [0, 0, 0], vis = [0, 0, 0], pair = {}; let union = 0;
  for (let j = 0; j < 100; j++) for (let i = 0; i < 100; i++){
    const x = i + 0.5, y = j + 0.5, ins = shapes.map(s => inside(s, x, y)); let top = -1;
    ins.forEach((v, k) => { if (v){ area[k]++; top = k; } });
    if (top >= 0){ union++; vis[top]++; }
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (ins[a] && ins[b]) pair[a + ',' + b] = (pair[a + ',' + b] || 0) + 1;
  }
  const ov = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) ov.push((pair[a + ',' + b] || 0) / Math.min(area[a], area[b]));
  return { union, ov, visible: vis.map((v, k) => v / area[k]), vis };
}
function analyze(p, result){
  const errs = [], pics = result.items.map(it => parsePicture(p.ctx.iqOddRenderItem(it)));
  const ms = pics.map((sh, i) => {
    if (sh.length !== 3 || [...new Set(sh.map(s => s.type))].sort().join() !== 'circle,square,triangle'){ errs.push('picture ' + i + ': not circle+square+triangle'); return null; }
    if (sh.some(s => s.sw < 3)) errs.push('picture ' + i + ': outline thinner than 3');
    const m = measure(sh);
    if (m.ov.some(o => o < 0.22 || o > 0.53)) errs.push('picture ' + i + ': overlaps ' + m.ov.map(o => o.toFixed(2)).join('/'));
    if (m.visible.some(v => v < 0.42)) errs.push('picture ' + i + ': a shape is only ' + Math.min(...m.visible).toFixed(2) + ' visible');
    const pts = sh.flatMap(s => (s.type === 'circle' ? [[s.cx - s.r, s.cy - s.r], [s.cx + s.r, s.cy + s.r]] : s.pts));
    if (pts.some(q => q[0] < 5 || q[0] > 95 || q[1] < 5 || q[1] > 95)) errs.push('picture ' + i + ': outside the tile');
    return m;
  });
  if (errs.length) return { errs };
  const colourOf = pics.map(sh => ['circle', 'square', 'triangle'].map(t => sh.find(s => s.type === t).fill).join());
  if (new Set(colourOf).size !== 1) errs.push('a shape changes colour between pictures');
  if (new Set(colourOf[0].split(',')).size !== 3) errs.push('two shapes share a colour');
  const un = ms.map(m => m.union); if (Math.max(...un) / Math.min(...un) - 1 > 0.10) errs.push('union areas differ by ' + (100 * (Math.max(...un) / Math.min(...un) - 1)).toFixed(1) + '%');
  const sig = pics.map(sh => sh.map(s => s.type).reverse());            // top first
  const key = sig.map(s => s.join('>')), counts = {}; key.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
  const common = Object.keys(counts).find(k => counts[k] === 3);
  if (!common) errs.push('not three pictures with one common order: ' + key.join(' | '));
  else {
    const oddIdx = key.findIndex(k => k !== common);
    if (oddIdx !== result.oddIndex) errs.push('SVG-derived odd ' + oddIdx + ' != ' + result.oddIndex);
    const a = sig[oddIdx], b = common.split('>'); const diff = a.map((t, i) => (t !== b[i] ? i : -1)).filter(i => i >= 0);
    if (diff.length !== 2 || diff[1] - diff[0] !== 1 || a[diff[0]] !== b[diff[1]] || a[diff[1]] !== b[diff[0]]) errs.push('the odd order is not a swap of neighbouring layers');
  }
  if (result.explanation !== TEXT) errs.push('explanation');
  return { errs, ms, sig, colours: colourOf[0].split(',') };
}
function forced(){ const p = H.loadProject(); p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'stack'; }); p.evalIn('IQ_ODD_VARIANTS.stack').forEach(v => { v.enabled = true; }); return p; }

function run(){
  test('STACK-1 registry: family "stack" and variant "three-shapes" are ENABLED, both minTier 4', () => {
    const p = H.loadProject(); const fam = p.evalIn('IQ_ODD_FAMILIES').find(f => f.key === 'stack');
    if (!fam) return { pass: false, info: 'family not registered' };
    const reg = p.evalIn('IQ_ODD_VARIANTS').stack; if (!reg) return { pass: false, info: 'no variants' };
    const bad = []; if (fam.enabled !== true || fam.minTier !== 4) bad.push('family enabled=' + fam.enabled + ' minTier=' + fam.minTier);
    if (reg.length !== 1 || reg[0].key !== 'three-shapes' || reg[0].enabled !== true || reg[0].minTier !== 4) bad.push('variant ' + JSON.stringify(reg.map(v => [v.key, v.enabled, v.minTier])));
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });
  test('STACK-2 shipped settings: with the real defaults "stack" is asked from tier 4 and never before (3,000 oddone questions)', () => {
    const p = H.loadProject(); p.seed(8); let before = 0, from = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){ const f = p.ctx.iqOddGenerate(t).family; if (f === 'stack'){ if (t < 4) before++; else from++; } }
    return { pass: before === 0 && from > 0, info: 'asked before tier 4: ' + before + ' | asked from tier 4: ' + from };
  });
  test('STACK-3 three-shapes: ' + Math.round(300 * SCALE) + ' questions valid by the independent SVG checks, gated by tier; reports the visible-area shortcut', () => {
    const bad = [], pg = H.loadProject(); pg.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'stack'; }); pg.evalIn('IQ_ODD_VARIANTS.stack').forEach(v => { v.enabled = true; });
    for (let t = 1; t <= 6; t++){ let m = null; try { pg.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < 4 && !(m && /no enabled (variant|family)/.test(m))) bad.push('tier ' + t + ' should be refused'); if (t >= 4 && m) bad.push('tier ' + t + ' should generate: ' + m); }
    const p = forced(); p.seed(210); const N = Math.round(300 * SCALE); let invalid = 0; const examples = [], keys = new Set(); let areaBot = 0, topBot = 0;
    for (let i = 0; i < N; i++){
      const r = p.ctx.iqOddGenerate(4); keys.add(r.structureKey);
      const a = analyze(p, r);
      if (a.errs.length){ invalid++; if (examples.length < 3) examples.push(a.errs.join('; ')); continue; }
      // shortcut bots: the picture whose most visible shape differs from the other three; the picture whose TOP shape differs
      const topV = a.ms.map(m => m.vis.indexOf(Math.max(...m.vis))), single = vals => { const g = {}; vals.forEach((v, k) => (g[v] = g[v] || []).push(k)); const s = Object.values(g); return (s.length === 2 && s.some(x => x.length === 1)) ? s.find(x => x.length === 1)[0] : -1; };
      if (single(topV) === r.oddIndex) areaBot++;
      if (single(a.sig.map(s => s[0])) === r.oddIndex) topBot++;
    }
    if (invalid) bad.push(invalid + ' invalid, e.g. ' + examples[0]);
    return { pass: !bad.length, info: N + ' questions, ' + keys.size + ' of 12 order/swap structures | the picture with a different most-visible shape is the odd in ' + (100 * areaBot / N).toFixed(1) + '% | the picture with a different top shape is the odd in ' + (100 * topBot / N).toFixed(1) + '%' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('STACK-4 must-reject: all four the same order, two different, a non-neighbouring change impossible with 3 layers, a colour that changes, a missing overlap, a shape cut off the tile', () => {
    const p = forced(); p.seed(9); const clone = o => JSON.parse(JSON.stringify(o));
    const base = p.ctx.iqOddGenerate(4); const nIdx = [0, 1, 2, 3].filter(i => i !== base.oddIndex);
    const verdict = r => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW ' + e.message; } };
    const bad = [], must = (l, r) => { const x = verdict(r); if (x !== 'reject') bad.push(l + ' -> ' + x); };
    if (verdict(base) !== 'accept') bad.push('control not accepted');
    const same = clone(base); same.items[base.oddIndex].shapes = same.items[nIdx[0]].shapes.map((s, i) => Object.assign({}, clone(s))); must('four pictures alike (odd copied from a normal)', same);
    const swap = clone(base); const s2 = swap.items[nIdx[1]].shapes; swap.items[nIdx[1]].shapes = [s2[1], s2[0], s2[2]]; must('two different pictures', swap);
    const col = clone(base); col.items[nIdx[0]].colors = { circle: '#000000', square: col.items[nIdx[0]].colors.square, triangle: col.items[nIdx[0]].colors.triangle }; must('a shape changes colour', col);
    const apart = clone(base); { const s = apart.items[nIdx[2]].shapes; s.forEach(sh => { if (sh.type === 'circle'){ sh.cx = 10; sh.cy = 10; } }); } must('circle moved away (no overlap)', apart);
    const off = clone(base); { const s = off.items[nIdx[0]].shapes; s.forEach(sh => { if (sh.type === 'circle') sh.cx = 95; }); } must('a shape cut off by the tile edge', off);
    const two = clone(base); two.items[nIdx[0]] = clone(base.items[base.oddIndex]); must('two odd pictures', two);
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '6 fixtures rejected, control accepted' };
  });
  return out;
}

module.exports = { run };
