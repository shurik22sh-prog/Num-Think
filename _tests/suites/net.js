'use strict';
// Focused tests of the network family (key 'net'): five nodes joined by lines. Variants:
//   ring-or-stub: three pictures are a ring of five identical nodes (every node has two links); one is a ring of four plus a node hanging off it;
//   same-links:   five differently coloured nodes in a path; three pictures show the same connections laid out differently, one has one line rewired.
// Everything is derived from the rendered SVG (circles via the shared parser, lines with a regex) with test-side geometry. Rules under test:
//   - the family and both variants are registered DISABLED (family minTier 4; variants 4 and 5);
//   - five nodes of radius 8 each, lines join node centres; no crossing lines; no line runs within 12 units of a node it does not join;
//     nodes at least 24 units apart (23.8 after rounding), lines at least 16 long; everything inside the tile;
//   - ring-or-stub: degree rule as above and every picture connected; same-links: one palette of five colours, three pictures with the same
//     connection set by colour, the odd one differs by exactly one line, and the pattern of link counts (1,2,2,2,1) is the same in all four.

const H = require('../harness');
const V = require('../verify');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.NET_SAMPLE_SCALE || 1);
const VARIANTS = [
  { key: 'ring-or-stub', minTier: 4, edges: 5, text: 'בשלוש התמונות כל נקודה מחוברת בדיוק לשתי נקודות אחרות, בטבעת סגורה - בתמונה שנבחרה יש נקודה שמחוברת לשלוש ונקודה שמחוברת רק לאחת.' },
  { key: 'same-links', minTier: 5, edges: 4, text: 'בשלוש התמונות אותן נקודות מחוברות זו לזו, רק המיקום שונה - בתמונה שנבחרה שני קווים מחברים נקודות אחרות.' }
];
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const cross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };

function picture(svg){
  const pa = V.parseSvg(svg, ['svg', 'circle', 'line']);
  const nodes = pa.circles.map(c => ({ x: c.cx, y: c.cy, r: c.r, fill: c.fill }));
  const lines = [...svg.matchAll(/<line\b([^>]*)\/>/g)].map(m => { const g = k => +new RegExp(k + '="([^"]*)"').exec(m[1])[1]; return [[g('x1'), g('y1')], [g('x2'), g('y2')]]; });
  const edges = lines.map(([p, q]) => { const find = pt => nodes.findIndex(n => Math.hypot(n.x - pt[0], n.y - pt[1]) < 0.2); return [find(p), find(q)]; });
  return { nodes, edges, lines };
}
function analyze(p, result, v){
  const errs = [], pics = [];
  try { result.items.forEach(it => pics.push(picture(p.ctx.iqOddRenderItem(it)))); } catch (e){ return { errs: ['unparseable: ' + e.message] }; }
  pics.forEach((pc, i) => {
    if (pc.nodes.length !== 5 || pc.nodes.some(n => Math.abs(n.r - 8) > 0.05)) errs.push('picture ' + i + ': not 5 nodes of radius 8');
    if (pc.edges.length !== v.edges || pc.edges.some(e => e[0] < 0 || e[1] < 0 || e[0] === e[1])) errs.push('picture ' + i + ': lines do not join node centres (' + pc.edges.length + ' lines)');
    if (errs.length) return;
    const P = pc.nodes.map(n => [n.x, n.y]);
    if (P.some(q => q[0] < 12 || q[0] > 88 || q[1] < 12 || q[1] > 88)) errs.push('picture ' + i + ': node too close to the edge');
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) if (Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < 23.8) errs.push('picture ' + i + ': two nodes closer than 24');
    pc.edges.forEach(([a, b]) => { if (Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < 15.8) errs.push('picture ' + i + ': a line shorter than 16'); for (let k = 0; k < 5; k++) if (k !== a && k !== b && segDist(P[k], P[a], P[b]) < 11.8) errs.push('picture ' + i + ': a line passes within 12 of a node'); });
    for (let a = 0; a < pc.edges.length; a++) for (let b = a + 1; b < pc.edges.length; b++) { const [x, y] = pc.edges[a], [z, w] = pc.edges[b]; if (new Set([x, y, z, w]).size === 4 && cross(P[x], P[y], P[z], P[w])) errs.push('picture ' + i + ': crossing lines'); }
  });
  if (errs.length) return { errs };
  const deg = pc => { const d = [0, 0, 0, 0, 0]; pc.edges.forEach(([a, b]) => { d[a]++; d[b]++; }); return d; };
  if (v.key === 'ring-or-stub'){
    const ds = pics.map(pc => deg(pc).slice().sort().join());
    const bad = ds.map((d, i) => (d === '2,2,2,2,2' ? -1 : i)).filter(i => i >= 0);
    if (bad.length !== 1 || bad[0] !== result.oddIndex || ds[bad[0]] !== '1,2,2,2,3') errs.push('degree patterns ' + ds.join(' | '));
    pics.forEach((pc, i) => { const seen = new Set([0]), st = [0]; while (st.length){ const x = st.pop(); pc.edges.forEach(([a, b]) => { const w = a === x ? b : (b === x ? a : -1); if (w >= 0 && !seen.has(w)){ seen.add(w); st.push(w); } }); } if (seen.size !== 5) errs.push('picture ' + i + ' is not connected'); });
  } else {
    const cols = pics.map(pc => pc.nodes.map(n => n.fill)); const pal = cols.map(c => c.slice().sort().join());
    if (new Set(pal).size !== 1 || new Set(cols[0]).size !== 5) errs.push('palette differs or colours repeat');
    const sig = pics.map(pc => pc.edges.map(([a, b]) => [pc.nodes[a].fill, pc.nodes[b].fill].sort().join('-')).sort().join('|'));
    const counts = {}; sig.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    const common = Object.keys(counts).find(s => counts[s] === 3);
    if (!common) errs.push('not three pictures with the same connections');
    else {
      const oddIdx = sig.findIndex(s => s !== common);
      if (oddIdx !== result.oddIndex) errs.push('SVG-derived odd ' + oddIdx + ' != ' + result.oddIndex);
      const A = new Set(sig[oddIdx].split('|')), B = new Set(common.split('|'));
      if ([...A].filter(e => !B.has(e)).length !== 1 || [...B].filter(e => !A.has(e)).length !== 1) errs.push('the odd picture does not differ by exactly one rewired line');
    }
    if (new Set(pics.map(pc => deg(pc).slice().sort().join())).size !== 1) errs.push('link-count patterns differ');
    // three layouts of the common connections must really differ
    const layouts = new Set(pics.map(pc => pc.nodes.map(n => Math.round(n.x / 8) + ',' + Math.round(n.y / 8)).join(';'))); if (layouts.size !== 4) errs.push('two pictures have the same layout');
  }
  if (result.explanation !== v.text) errs.push('explanation');
  return { errs, pics };
}
function forced(key){ const p = H.loadProject(); p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'net'; }); if (key) p.evalIn('IQ_ODD_VARIANTS.net').forEach(x => { x.enabled = x.key === key; }); return p; }

function run(){
  test('NET-1 registry: family "net" is ENABLED (minTier 4); variants ring-or-stub / same-links are ENABLED with minTier 4 / 5', () => {
    const p = H.loadProject(); const fam = p.evalIn('IQ_ODD_FAMILIES').find(f => f.key === 'net'); if (!fam) return { pass: false, info: 'family not registered' };
    const reg = p.evalIn('IQ_ODD_VARIANTS').net; if (!reg) return { pass: false, info: 'no variants' };
    const bad = []; if (fam.enabled !== true || fam.minTier !== 4) bad.push('family enabled=' + fam.enabled + ' minTier=' + fam.minTier);
    if (reg.map(x => x.key).join() !== VARIANTS.map(x => x.key).join()) bad.push('keys ' + reg.map(x => x.key).join());
    VARIANTS.forEach(v => { const r = reg.find(x => x.key === v.key); if (!r) return; if (r.enabled !== true) bad.push(v.key + ' not enabled'); if (r.minTier !== v.minTier) bad.push(v.key + ' minTier=' + r.minTier); });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });
  test('NET-2 shipped settings: with the real defaults "net" is asked from tier 4 and never before (3,000 oddone questions)', () => {
    const p = H.loadProject(); p.seed(5); let before = 0, from = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){ const f = p.ctx.iqOddGenerate(t).family; if (f === 'net'){ if (t < 4) before++; else from++; } }
    return { pass: before === 0 && from > 0, info: 'asked before tier 4: ' + before + ' | asked from tier 4: ' + from };
  });

  VARIANTS.forEach((v, idx) => {
    test('NET-' + (3 + idx) + ' ' + v.key + ': ' + Math.round(1500 * SCALE) + ' questions valid by the independent SVG checks, gated by tier', () => {
      const bad = [], pg = forced(v.key);
      for (let t = 1; t <= 6; t++){ let m = null; try { pg.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < v.minTier && !(m && /no enabled (variant|family)/.test(m))) bad.push('tier ' + t + ' should be refused'); if (t >= v.minTier && m) bad.push('tier ' + t + ' should generate: ' + m); }
      const p = forced(v.key); p.seed(230 + idx); const N = Math.round(1500 * SCALE); let invalid = 0; const examples = []; let lenBot = 0;
      for (let i = 0; i < N; i++){
        const r = p.ctx.iqOddGenerate(v.minTier), a = analyze(p, r, v);
        if (a.errs.length){ invalid++; if (examples.length < 3) examples.push(a.errs.join('; ')); continue; }
        const total = a.pics.map(pc => pc.lines.reduce((s, [q, w]) => s + Math.hypot(q[0] - w[0], q[1] - w[1]), 0)), mx = total.indexOf(Math.max(...total)), mn = total.indexOf(Math.min(...total));
        if (mx === r.oddIndex || mn === r.oddIndex) lenBot += 0.5;
      }
      if (invalid) bad.push(invalid + ' invalid, e.g. ' + examples[0]);
      return { pass: !bad.length, info: N + ' questions | the picture with the longest/shortest total line length is the odd in ' + (100 * lenBot / N).toFixed(1) + '% (chance 25%)' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });
  test('NET-5 must-reject: crossing lines, a line through a node, two nodes touching, a hub instead of a path, two rewired lines, all four alike', () => {
    const clone = o => JSON.parse(JSON.stringify(o)); const bad = [];
    const verdict = (p, r) => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW ' + e.message; } };
    const must = (p, l, r) => { const x = verdict(p, r); if (x !== 'reject') bad.push(l + ' -> ' + x); };
    const pr = forced('ring-or-stub'); pr.seed(3); const rb = pr.ctx.iqOddGenerate(4); const rn = [0, 1, 2, 3].filter(i => i !== rb.oddIndex);
    if (verdict(pr, rb) !== 'accept') bad.push('ring control not accepted');
    const cr = clone(rb); { const it = cr.items[rn[0]]; it.nodes = [{ x: 20, y: 20, color: it.nodes[0].color }, { x: 80, y: 80, color: it.nodes[0].color }, { x: 80, y: 20, color: it.nodes[0].color }, { x: 20, y: 80, color: it.nodes[0].color }, { x: 50, y: 50, color: it.nodes[0].color }]; it.edges = [[0, 1], [2, 3], [3, 4], [4, 2], [0, 2]]; } must(pr, 'crossing diagonals', cr);
    const through = clone(rb); { const it = through.items[rn[0]]; it.nodes[4] = Object.assign({}, it.nodes[4], { x: (it.nodes[it.edges[0][0]].x + it.nodes[it.edges[0][1]].x) / 2, y: (it.nodes[it.edges[0][0]].y + it.nodes[it.edges[0][1]].y) / 2 }); } must(pr, 'a node on a line', through);
    const touch = clone(rb); touch.items[rn[1]].nodes[1].x = touch.items[rn[1]].nodes[0].x + 6; touch.items[rn[1]].nodes[1].y = touch.items[rn[1]].nodes[0].y; must(pr, 'two nodes touching', touch);
    const alike = clone(rb); alike.items[rb.oddIndex] = clone(rb.items[rn[0]]); must(pr, 'all four rings', alike);
    const ps = forced('same-links'); ps.seed(4); const sb = ps.ctx.iqOddGenerate(5); const sn = [0, 1, 2, 3].filter(i => i !== sb.oddIndex);
    if (verdict(ps, sb) !== 'accept') bad.push('path control not accepted');
    const two = clone(sb); { const o = two.items[sb.oddIndex]; o.edges = [[o.edges[0][0], o.edges[2][1]], [o.edges[1][0], o.edges[3][1]], o.edges[2], o.edges[3]]; } must(ps, 'two lines rewired', two);
    const hub = clone(sb); { const it = hub.items[sn[0]]; it.edges = [[0, 1], [0, 2], [0, 3], [0, 4]]; } must(ps, 'a hub instead of a path in a normal', hub);
    const same = clone(sb); same.items[sb.oddIndex].edges = clone(sb.items[sn[0]].edges); same.items[sb.oddIndex].nodes = clone(sb.items[sn[0]].nodes); same.items[sb.oddIndex].nodes.forEach((n, i) => { n.x = Math.min(88, n.x + 3 * i); }); must(ps, 'the odd picture has the common connections', same);
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '7 fixtures rejected, both controls accepted' };
  });
  return out;
}

module.exports = { run };
