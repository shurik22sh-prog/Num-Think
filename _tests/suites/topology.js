'use strict';
// Focused tests of the topology family (key 'topology'): holes in cell figures and chains of beads. Everything is derived from the
// rendered SVG (paths are parsed here, circles via the shared parser) with test-side geometry. Rules under test:
//   - the family and its variants (hole-missing, hole-extra, chain) are registered DISABLED (family minTier 2; variants 3 / 2 / 3);
//   - holes: four figures on a 4x4 grid (cells of 20 units), same number of cells, pairwise non-congruent silhouettes, three with the
//     same number of closed holes and one different, bounding boxes within one cell, the odd figure's outline length inside the
//     range of the normals', no two cells touching only at a corner;
//   - chains: five equal beads (radius 8); three options are one connected group (neighbours overlap by 25%+), one is two groups with a gap
//     of 8+ units between them; the broken chain's extent lies inside the range of the normals' extents;
//   - the explanation names the rule.

const H = require('../harness');
const V = require('../verify');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.TOPO_SAMPLE_SCALE || 1);
const VARIANTS = [
  { key: 'hole-missing', minTier: 3, kind: 'cells', normal: 1, odd: 0, text: 'בשלוש הצורות יש חור סגור - בצורה שנבחרה אין חור סגור.' },
  { key: 'hole-extra', minTier: 2, kind: 'cells', normal: 0, odd: 1, text: 'בשלוש הצורות אין חור סגור - בצורה שנבחרה יש חור סגור.' },
  { key: 'chain', minTier: 3, kind: 'beads', text: 'בשלוש הצורות כל החרוזים מחוברים לשרשרת אחת - בצורה שנבחרה השרשרת שבורה לשני חלקים.' }
];

// ---------- test-side cell geometry ----------
function pathLoops(svg){
  const m = /<path d="([^"]+)" fill="[^"]*" fill-rule="evenodd"/.exec(svg); if (!m) throw new Error('no evenodd path');
  return m[1].split('Z').map(s => s.trim()).filter(Boolean).map(seg => seg.replace(/^M/, '').split(/L/).map(t => t.trim().split(/\s+/).map(Number)));
}
const pointIn = (x, y, pts) => { let inside = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++){ const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside; } return inside; };
function cellsFromLoops(loops){
  const all = loops.flat(); const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0])), minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const w = Math.round((maxX - minX) / 20), h = Math.round((maxY - minY) / 20), cells = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){ const x = minX + (i + 0.5) * 20, y = minY + (j + 0.5) * 20; const n = loops.filter(l => pointIn(x, y, l)).length; if (n % 2 === 1) cells.push([i, j]); }
  return { cells, minX, maxX, minY, maxY, w, h };
}
const key = c => c.join(',');
function holes(cells){
  const set = new Set(cells.map(key)); const W = 6, seen = new Set(['-1,-1']), st = [[-1, -1]];
  while (st.length){ const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (nx < -1 || ny < -1 || nx > W || ny > W || set.has(k) || seen.has(k)) continue; seen.add(k); st.push([nx, ny]); } }
  const rest = new Set(); for (let y = -1; y <= W; y++) for (let x = -1; x <= W; x++){ const k = x + ',' + y; if (!set.has(k) && !seen.has(k)) rest.add(k); }
  let n = 0; while (rest.size){ n++; const f = rest.values().next().value; rest.delete(f); const s2 = [f.split(',').map(Number)]; while (s2.length){ const [x, y] = s2.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const k = (x + dx) + ',' + (y + dy); if (rest.has(k)){ rest.delete(k); s2.push([x + dx, y + dy]); } } } }
  return n;
}
const corner = cells => { const s = new Set(cells.map(key)); return cells.some(([x, y]) => [[1, 1], [1, -1]].some(([dx, dy]) => s.has(key([x + dx, y + dy])) && !s.has(key([x + dx, y])) && !s.has(key([x, y + dy])))); };
const connected = cells => { const s = new Set(cells.map(key)), seen = new Set([key(cells[0])]), st = [cells[0]]; while (st.length){ const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const k = (x + dx) + ',' + (y + dy); if (s.has(k) && !seen.has(k)){ seen.add(k); st.push([x + dx, y + dy]); } } } return seen.size === cells.length; };
const norm = cs => { const mx = Math.min(...cs.map(c => c[0])), my = Math.min(...cs.map(c => c[1])); return cs.map(c => [c[0] - mx, c[1] - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const D4 = [([x, y]) => [x, y], ([x, y]) => [-y, x], ([x, y]) => [-x, -y], ([x, y]) => [y, -x], ([x, y]) => [-x, y], ([x, y]) => [y, x], ([x, y]) => [x, -y], ([x, y]) => [-y, -x]];
const canon = cs => D4.map(f => norm(cs.map(f)).map(key).join(';')).sort()[0];
const perim = cells => { const s = new Set(cells.map(key)); let p = 0; for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!s.has((x + dx) + ',' + (y + dy))) p++; return p; };

function analyzeCells(p, result, v){
  const errs = [], svgs = result.items.map(it => p.ctx.iqOddRenderItem(it));
  let figs; try { figs = svgs.map(s => cellsFromLoops(pathLoops(s))); } catch (x){ return { errs: ['unparseable: ' + x.message] }; }
  figs.forEach((f, i) => {
    if (f.w > 4 || f.h > 4) errs.push('option ' + i + ' wider than 4 cells');
    if (Math.abs((f.minX + f.maxX) / 2 - 50) > 0.2 || Math.abs((f.minY + f.maxY) / 2 - 50) > 0.2) errs.push('option ' + i + ' not centred');
    if (f.cells.length < 8 || f.cells.length > 12) errs.push('option ' + i + ' has ' + f.cells.length + ' cells');
    if (!connected(f.cells)) errs.push('option ' + i + ' not connected'); if (corner(f.cells)) errs.push('option ' + i + ' has a corner-only contact');
  });
  if (errs.length) return { errs };
  if (new Set(figs.map(f => f.cells.length)).size !== 1) errs.push('different cell counts');
  if (new Set(figs.map(f => canon(f.cells))).size !== 4) errs.push('two silhouettes are congruent');
  const hs = figs.map(f => holes(f.cells)), bad = hs.map((h, i) => (h === v.normal ? -1 : i)).filter(i => i >= 0);
  if (bad.length !== 1 || bad[0] !== result.oddIndex || hs[result.oddIndex] !== v.odd) errs.push('holes ' + hs.join() + ' do not single out option ' + result.oddIndex);
  const per = figs.map(f => perim(f.cells)), np = per.filter((_, i) => i !== result.oddIndex);
  if (per[result.oddIndex] < Math.min(...np) || per[result.oddIndex] > Math.max(...np)) errs.push('outline length of the odd (' + per[result.oddIndex] + ') outside the normals\' ' + Math.min(...np) + '..' + Math.max(...np));
  if (Math.max(...figs.map(f => f.w)) - Math.min(...figs.map(f => f.w)) > 1 || Math.max(...figs.map(f => f.h)) - Math.min(...figs.map(f => f.h)) > 1) errs.push('bounding boxes differ by more than a cell');
  return { errs, hs };
}
function analyzeBeads(p, result, v){
  const errs = [], svgs = result.items.map(it => p.ctx.iqOddRenderItem(it));
  let parsed; try { parsed = svgs.map(s => V.parseSvg(s)); } catch (x){ return { errs: ['unparseable: ' + x.message] }; }
  const groups = parsed.map((pa, i) => {
    if (pa.circles.length !== 5 || pa.polygons.length) { errs.push('option ' + i + ': not 5 circles'); return null; }
    if (pa.circles.some(c => Math.abs(c.r - 8) > 0.05)) errs.push('option ' + i + ': bead radius');
    const cs = pa.circles; if (cs.some(c => c.cx - c.r < 3 || c.cx + c.r > 97 || c.cy - c.r < 3 || c.cy + c.r > 97)) errs.push('option ' + i + ': too close to the edge');
    const par = cs.map((_, k) => k), find = k => (par[k] === k ? k : (par[k] = find(par[k]))), d = (a, b) => Math.hypot(cs[a].cx - cs[b].cx, cs[a].cy - cs[b].cy);
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) if (d(a, b) <= 16 * 0.75 + 0.2) par[find(a)] = find(b);
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) if (find(a) !== find(b) && d(a, b) < 16 + 8 - 0.2) errs.push('option ' + i + ': two beads of different groups only ' + (d(a, b) - 16).toFixed(1) + ' apart');
    const ext = Math.max(...cs.map(c => Math.max(Math.abs(c.cx - 50), Math.abs(c.cy - 50) ))) + 8;
    return { n: new Set(cs.map((_, k) => find(k))).size, ext };
  });
  if (errs.length) return { errs };
  groups.forEach((g, i) => { if (g.n !== (i === result.oddIndex ? 2 : 1)) errs.push('option ' + i + ' has ' + g.n + ' groups'); });
  const ne = groups.filter((_, i) => i !== result.oddIndex).map(g => g.ext);
  if (groups[result.oddIndex].ext < Math.min(...ne) - 0.3 || groups[result.oddIndex].ext > Math.max(...ne) + 0.3) errs.push('the broken chain is the widest or narrowest');
  return { errs };
}
function forced(key){
  const p = H.loadProject();
  p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'topology'; });
  if (key) p.evalIn('IQ_ODD_VARIANTS.topology').forEach(x => { x.enabled = x.key === key; });
  return p;
}

function run(){
  test('TOPO-1 registry: family "topology" is ENABLED (minTier 2); variants hole-missing / hole-extra / chain are ENABLED with minTier 3 / 2 / 3', () => {
    const p = H.loadProject(); const fam = p.evalIn('IQ_ODD_FAMILIES').find(f => f.key === 'topology');
    if (!fam) return { pass: false, info: 'family not registered' };
    const reg = p.evalIn('IQ_ODD_VARIANTS').topology; if (!reg) return { pass: false, info: 'no variants' };
    const bad = [];
    if (fam.enabled !== true || fam.minTier !== 2) bad.push('family enabled=' + fam.enabled + ' minTier=' + fam.minTier);
    if (reg.map(x => x.key).join() !== VARIANTS.map(x => x.key).join()) bad.push('keys ' + reg.map(x => x.key).join());
    VARIANTS.forEach(v => { const r = reg.find(x => x.key === v.key); if (!r) return; if (r.enabled !== true) bad.push(v.key + ' not enabled'); if (r.minTier !== v.minTier) bad.push(v.key + ' minTier=' + r.minTier); });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });

  test('TOPO-2 shipped settings: with the real defaults "topology" is asked from tier 2 and never before (3,000 oddone questions)', () => {
    const p = H.loadProject(); p.seed(5); let before = 0, from = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){ const f = p.ctx.iqOddGenerate(t).family; if (f === 'topology'){ if (t < 2) before++; else from++; } }
    return { pass: before === 0 && from > 0, info: 'asked before tier 2: ' + before + ' | asked from tier 2: ' + from };
  });

  VARIANTS.forEach((v, idx) => {
    test('TOPO-' + (3 + idx) + ' ' + v.key + ': ' + Math.round(2000 * SCALE) + ' questions valid by the independent SVG checks, gated by tier', () => {
      const bad = [], pg = forced(v.key);
      for (let t = 1; t <= 6; t++){ let m = null; try { pg.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < v.minTier && !(m && /no enabled (variant|family)/.test(m))) bad.push('tier ' + t + ' should be refused'); if (t >= v.minTier && m) bad.push('tier ' + t + ' should generate: ' + m); }
      const p = forced(v.key); p.seed(150 + idx); const N = Math.round(2000 * SCALE); let invalid = 0; const examples = [], ks = {};
      for (let i = 0; i < N; i++){
        const r = p.ctx.iqOddGenerate(v.minTier);
        const a = v.kind === 'cells' ? analyzeCells(p, r, v) : analyzeBeads(p, r, v);
        const e = a.errs.slice(); if (r.explanation !== v.text) e.push('explanation'); if (r.variant !== v.key) e.push('variant');
        if (e.length){ invalid++; if (examples.length < 3) examples.push(e.join('; ')); }
        ks[r.structureKey] = (ks[r.structureKey] || 0) + 1;
      }
      if (invalid) bad.push(invalid + ' invalid, e.g. ' + examples[0]);
      return { pass: !bad.length, info: N + ' questions, ' + Object.keys(ks).length + ' structure keys' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
    });
  });

  test('TOPO-6 must-reject: different cell counts, congruent silhouettes, a corner-only contact, ambiguous bead distance, a bead chain with all links intact in the odd option, no hole difference', () => {
    const clone = o => JSON.parse(JSON.stringify(o));
    const bad = []; const run1 = (p, label, r) => { let x; try { x = p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ x = 'THREW ' + e.message; } if (x !== 'reject') bad.push(label + ' -> ' + x); };
    const pc = forced('hole-extra'); pc.seed(3); const base = pc.ctx.iqOddGenerate(2); const nIdx = [0, 1, 2, 3].filter(i => i !== base.oddIndex);
    let x; try { x = pc.ctx.iqOddVerifyExactlyOneOdd(base); } catch (e){ x = 'THREW'; } if (x !== true) bad.push('cells control not accepted');
    const cnt = clone(base); cnt.items[nIdx[0]].cells = cnt.items[nIdx[0]].cells.slice(0, -1); run1(pc, 'different cell count', cnt);
    const cong = clone(base); cong.items[nIdx[1]].cells = clone(base.items[nIdx[0]].cells); run1(pc, 'two identical silhouettes', cong);
    const k0 = base.items[0].cells.length, loop = [[1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2]], extra = [[1, 0], [2, 0], [3, 0], [0, 0], [3, 1], [3, 2]]; const pinch = loop.concat(extra).slice(0, k0);   // cells (1,1) and (2,2) touch only at a corner
    if (pc.ctx.iqOddFigValid(pinch) !== false) bad.push('the corner-only figure is not recognised as invalid by the figure check');
    const corner = clone(base); corner.items[nIdx[2]].cells = pinch; run1(pc, 'a corner-only contact', corner);
    const noDiff = clone(base); noDiff.items[base.oddIndex].cells = clone(base.items[nIdx[0]].cells).map(([a, b]) => [b, a]); run1(pc, 'odd without a hole', noDiff);
    const pb = forced('chain'); pb.seed(4); const b0 = pb.ctx.iqOddGenerate(3); const ni = [0, 1, 2, 3].filter(i => i !== b0.oddIndex);
    let y; try { y = pb.ctx.iqOddVerifyExactlyOneOdd(b0); } catch (e){ y = 'THREW'; } if (y !== true) bad.push('chain control not accepted');
    const intact = clone(b0); intact.items[b0.oddIndex].centers = clone(b0.items[ni[0]].centers); run1(pb, 'odd chain unbroken', intact);
    const near = clone(b0); { const c = near.items[b0.oddIndex].centers; const k = c.findIndex((q, i) => i > 0 && Math.hypot(q[0] - c[i - 1][0], q[1] - c[i - 1][1]) > 22); if (k > 0){ const dx = c[k][0] - c[k - 1][0], dy = c[k][1] - c[k - 1][1], L = Math.hypot(dx, dy); for (let j = k; j < c.length; j++){ c[j][0] -= dx / L * (L - 19); c[j][1] -= dy / L * (L - 19); } } } run1(pb, 'gap only 3 units (almost touching)', near);
    const broken2 = clone(b0); broken2.items[ni[1]].centers = clone(b0.items[b0.oddIndex].centers); run1(pb, 'two broken chains', broken2);
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '8 fixtures rejected, both controls accepted' };
  });

  return out;
}

module.exports = { run };
