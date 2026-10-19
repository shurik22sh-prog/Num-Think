'use strict';
// Focused tests of the three reasoning families: overlay, balance, induce. Rules are re-derived here with test-side code:
//   overlay: the 27 cells of each picture are read from the rendered SVG (dark = coloured) and the operation is found by
//            trying all five operations cell by cell: every picture shows exactly one operation, three are alike, one differs;
//   balance: weights are read from the rendered SVG (circle / square / triangle by colour and shape, scale by height, side by position)
//            and consistency is decided by BRUTE FORCE over whole-number weights (not by the cross-product rule of the game);
//   induce:  the rule library is rebuilt here; each picture's two examples are matched against all 23 rules; the numbers of marks
//            drawn in the SVG are compared with the stored counts.
// Also: registry, level gating, must-reject fixtures.

const H = require('../harness');
const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const SCALE = Number(process.env.LOGIC_SAMPLE_SCALE || 1);
const N = Math.max(60, Math.round(500 * SCALE));
const lone = vals => { const k = vals.map(v => JSON.stringify(v)); for (let i = 0; i < 4; i++){ const rest = k.filter((_, j) => j !== i); if (rest.every(x => x === rest[0]) && k[i] !== rest[0]) return i; } return -1; };
const PLAN = { overlay: ['hidden-op', 4], balance: ['consistent-scales', 4], induce: ['two-step-rule', 5] };

function forced(fam){ const p = H.loadProject(); p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === fam; }); return p; }
function svgErrors(svg){
  const errs = [];
  if (!/^<svg viewBox="0 0 100 100" width="100" height="100"/.test(svg) || !/<\/svg>$/.test(svg)) errs.push('not a 100x100 svg');
  if (/NaN|undefined|Infinity|null/.test(svg)) errs.push('NaN in svg');
  const nums = [...svg.matchAll(/\b(?:x|y|cx|cy|x1|y1|x2|y2)="(-?[\d.]+)"/g)].map(m => +m[1]);
  const pts = [...svg.matchAll(/points="([^"]*)"/g)].flatMap(m => m[1].split(/[ ,]+/).filter(Boolean).map(Number));
  if ([...nums, ...pts].some(v => !Number.isFinite(v) || v < -0.5 || v > 100.5)) errs.push('outside the tile');
  return errs;
}
const OPS = { xor: (a, b) => (a !== b ? 1 : 0), and: (a, b) => (a && b ? 1 : 0), or: (a, b) => (a || b ? 1 : 0), anb: (a, b) => (a && !b ? 1 : 0), bna: (a, b) => (b && !a ? 1 : 0) };

// ----- overlay -----
function overlayCells(svg){
  const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="[\d.]+" fill="(#[0-9a-fA-F]{6})"/g)];
  if (rects.length !== 27) return null;
  const bits = rects.map(m => (m[3].toLowerCase() === '#1a1a2e' ? 1 : 0));
  return [bits.slice(0, 9), bits.slice(9, 18), bits.slice(18, 27)];
}
const overlayOps = g => Object.keys(OPS).filter(k => g[2].every((v, i) => v === OPS[k](g[0][i], g[1][i])));

// ----- balance -----
function balanceFrom(svg){                                                  // 3 scales x (left counts, right counts) read from the drawing
  const scales = [0, 1, 2].map(() => ({ left: [0, 0, 0], right: [0, 0, 0] }));
  const put = (kind, x, cy) => { const s = scales[Math.min(2, Math.floor(cy / 33))]; (x < 50 ? s.left : s.right)[kind]++; };
  [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+" fill="#D55E00"/g)].forEach(m => put(0, +m[1], +m[2]));
  [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="[\d.]+" fill="#0072B2"/g)].forEach(m => put(1, +m[1] + +m[3] / 2, +m[2] + 3.7));
  [...svg.matchAll(/<polygon points="([^"]*)" fill="#009E73"/g)].forEach(m => { const P = m[1].trim().split(' ').map(q => q.split(',').map(Number)); put(2, P.reduce((s, q) => s + q[0], 0) / 3, P.reduce((s, q) => s + q[1], 0) / 3); });
  return scales;
}
const BRUTE_MAX = 40;
function solvable(scales){                                                  // some whole-number weights (1..40) balance every scale
  for (let a = 1; a <= BRUTE_MAX; a++) for (let b = 1; b <= BRUTE_MAX; b++) for (let c = 1; c <= BRUTE_MAX; c++){
    const w = [a, b, c];
    if (scales.every(s => s.left.reduce((t, v, i) => t + v * w[i], 0) === s.right.reduce((t, v, i) => t + v * w[i], 0))) return true;
  }
  return false;
}

// ----- induce -----
const A = ['shape', 'colour', 'count', 'fill'], OP = { shape: ['+1', '-1'], colour: ['+1', '-1'], count: ['+1', '+2', 'x2'], fill: ['flip'] };
const stepApply = (attr, op, v) => { if (attr === 'fill') return 1 - v; if (attr === 'count'){ const n = op === '+1' ? v + 1 : op === '+2' ? v + 2 : v * 2; return n >= 1 && n <= 6 ? n : null; } return ((v + (op === '+1' ? 1 : 2)) % 3); };
const RULES = []; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) OP[A[i]].forEach(o1 => OP[A[j]].forEach(o2 => RULES.push([[A[i], o1], [A[j], o2]])));
const runRule = (rule, st) => { const o = Object.assign({}, st); for (const [a, op] of rule){ const v = stepApply(a, op, st[a]); if (v === null) return null; o[a] = v; } return o; };
const sameState = (a, b) => A.every(k => a[k] === b[k]);
const fitting = pairs => RULES.filter(r => pairs.every(p => { const o = runRule(r, p.from); return o && sameState(o, p.to); }));
const ruleKey = r => r.map(s => s.join(' ')).join('|');

function run(){
  test('LOG-1 registry: overlay (level 4), balance (level 4) and induce (level 5) are ENABLED, ask for large tiles, one variant each', () => {
    const p = H.loadProject(), fams = p.evalIn('IQ_ODD_FAMILIES'), reg = p.evalIn('IQ_ODD_VARIANTS'), bad = [];
    Object.keys(PLAN).forEach(k => {
      const f = fams.find(x => x.key === k), [v, t] = PLAN[k];
      if (!f){ bad.push(k + ' missing'); return; }
      if (f.enabled !== true || f.minTier !== t || f.largeTiles !== true) bad.push(k + ' enabled=' + f.enabled + ' minTier=' + f.minTier + ' large=' + f.largeTiles);
      const vs = reg[k] || [];
      if (vs.length !== 1 || vs[0].key !== v || vs[0].enabled !== true || vs[0].minTier !== t) bad.push(k + ' variants ' + JSON.stringify(vs.map(x => x.key + ':' + x.minTier)));
    });
    return { pass: !bad.length, info: bad.length ? 'WRONG: ' + bad.join(' | ') : 'ok' };
  });
  const gate = (fam, minTier, bad) => { const p = forced(fam); for (let t = 1; t <= 6; t++){ let m = null; try { p.ctx.iqOddGenerate(t); } catch (e){ m = String(e.message); } if (t < minTier && !(m && /no enabled/.test(m))) bad.push('level ' + t + ' should be refused'); if (t >= minTier && m) bad.push('level ' + t + ': ' + m); } };

  test('LOG-2 overlay/hidden-op: ' + N + ' questions; the cells read from the SVG show exactly one operation per picture, three alike and one different', () => {
    const bad = []; gate('overlay', 4, bad);
    const p = forced('overlay'); p.seed(71); let invalid = 0, ex = null; const pairs = {};
    for (let i = 0; i < N; i++){
      const r = p.ctx.iqOddGenerate(4), svgs = r.items.map(it => p.ctx.iqOddRenderItem(it)), errs = [];
      svgs.forEach(s => svgErrors(s).forEach(e => errs.push(e)));
      const grids = svgs.map(overlayCells);
      if (grids.some(g => !g)) errs.push('cells not readable');
      else {
        const sets = grids.map(overlayOps);
        if (sets.some(s => s.length !== 1)) errs.push('a picture does not show exactly one operation: ' + sets.map(s => s.join('/')).join(' | '));
        else {
          const ops = sets.map(s => s[0]);
          if (lone(ops) !== r.oddIndex) errs.push('operations ' + ops.join(',') + ' do not single out picture ' + r.oddIndex);
          pairs[ops[(r.oddIndex + 1) % 4] + '>' + ops[r.oddIndex]] = 1;
          const pop = g => g.map(b => b.reduce((s, v) => s + v, 0));
          [0, 1, 2].forEach(k => { if (lone(grids.map(g => pop(g)[k])) >= 0) errs.push('cell count of pattern ' + k + ' singles out a picture'); });
          if (new Set(grids.map(g => g.flat().join(''))).size !== 4) errs.push('two pictures alike');
        }
      }
      if (errs.length){ invalid++; ex = ex || errs[0]; }
    }
    if (invalid) bad.push(invalid + ' invalid, e.g. ' + ex);
    if (Object.keys(pairs).length < 18) bad.push('only ' + Object.keys(pairs).length + ' of 20 operation pairs seen');
    return { pass: !bad.length, info: N + ' questions | operation pairs seen ' + Object.keys(pairs).length + '/20' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('LOG-3 balance/consistent-scales: ' + Math.round(N / 2) + ' questions; brute-force weights balance all three scales in three pictures and in none of the odd one, yet any two of its scales', () => {
    const bad = []; gate('balance', 4, bad);
    const p = forced('balance'); p.seed(72); let invalid = 0, ex = null;
    for (let i = 0; i < Math.round(N / 2); i++){
      const r = p.ctx.iqOddGenerate(4), svgs = r.items.map(it => p.ctx.iqOddRenderItem(it)), errs = [];
      svgs.forEach(s => svgErrors(s).forEach(e => errs.push(e)));
      const tiles = svgs.map(balanceFrom);
      tiles.forEach((t, k) => {
        const total = t.reduce((s, x) => s + x.left.reduce((a, b) => a + b, 0) + x.right.reduce((a, b) => a + b, 0), 0), stored = r.items[k].scales.reduce((s, x) => s + x.left.reduce((a, b) => a + b, 0) + x.right.reduce((a, b) => a + b, 0), 0);
        if (total !== stored) errs.push('weights drawn ' + total + ' but stored ' + stored);
        if (t.some(s => s.left.reduce((a, b) => a + b, 0) > 4 || s.right.reduce((a, b) => a + b, 0) > 4 || s.left.some((v, q) => v && s.right[q]))) errs.push('a pan is overloaded or a kind sits on both sides');
        const ok = solvable(t);
        if (ok === (k === r.oddIndex)) errs.push('picture ' + k + (ok ? ' has balancing weights' : ' has no balancing weights'));
        if (k === r.oddIndex && ![[0, 1], [0, 2], [1, 2]].every(([a, b]) => solvable([t[a], t[b]]))) errs.push('two scales of the odd picture already contradict');
        if (t.some(s => s.left.every(v => !v) || s.right.every(v => !v))) errs.push('an empty pan');
      });
      const totals = r.items.map(it => it.scales.reduce((s, x) => s + x.left.reduce((a, b) => a + b, 0) + x.right.reduce((a, b) => a + b, 0), 0));
      if (lone(totals) >= 0) errs.push('the number of weights singles out a picture');
      if (errs.length){ invalid++; ex = ex || errs[0]; }
    }
    if (invalid) bad.push(invalid + ' invalid, e.g. ' + ex);
    return { pass: !bad.length, info: Math.round(N / 2) + ' questions' + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('LOG-4 induce/two-step-rule: ' + N + ' questions; each picture\'s two examples fit exactly one of 23 rules, three pictures share it, the odd rule differs in one step; marks drawn = marks stored', () => {
    const bad = []; gate('induce', 5, bad);
    if (RULES.length !== 23) bad.push('rule library has ' + RULES.length + ' rules');
    const p = forced('induce'); p.seed(73); let invalid = 0, ex = null; const seen = new Set();
    for (let i = 0; i < N; i++){
      const r = p.ctx.iqOddGenerate(5), svgs = r.items.map(it => p.ctx.iqOddRenderItem(it)), errs = [];
      svgs.forEach(s => svgErrors(s).forEach(e => errs.push(e)));
      const fits = r.items.map(it => fitting(it.pairs));
      if (fits.some(f => f.length !== 1)) errs.push('a picture does not identify exactly one rule');
      else {
        const keys = fits.map(f => ruleKey(f[0]));
        if (lone(keys) !== r.oddIndex) errs.push('rules do not single out picture ' + r.oddIndex);
        const a = fits[(r.oddIndex + 1) % 4][0], b = fits[r.oddIndex][0];
        if (a.filter(s => b.some(t => t[0] === s[0] && t[1] === s[1])).length !== 1) errs.push('rules do not share exactly one step');
        fits.forEach((f, k) => { if (f[0].some(s => s[0] === 'count') && fitting([r.items[k].pairs[0]]).length < 2) errs.push('a number rule is already clear from one example'); });
        seen.add(keys[(r.oddIndex + 1) % 4]);
      }
      r.items.forEach((it, k) => {
        const stored = it.pairs.reduce((s, q) => s + q.from.count + q.to.count, 0);
        const drawn = (svgs[k].match(/<(?:circle|rect|polygon)\b/g) || []).length - (svgs[k].match(/<line\b/g) ? 0 : 0);
        if (drawn !== stored) errs.push('marks drawn ' + drawn + ' vs stored ' + stored);
      });
      if (errs.length){ invalid++; ex = ex || errs[0]; }
    }
    if (invalid) bad.push(invalid + ' invalid, e.g. ' + ex);
    return { pass: !bad.length, info: N + ' questions | different common rules seen: ' + seen.size + (bad.length ? ' | WRONG: ' + bad.join(' | ') : '') };
  });
  test('LOG-5 must-reject: an odd picture with the common operation, an odd scale picture that balances, two broken rule pictures, a wrong picture marked', () => {
    const clone = o => JSON.parse(JSON.stringify(o)), bad = [];
    const verdict = (p, r) => { try { return p.ctx.iqOddVerifyExactlyOneOdd(r) === true ? 'accept' : 'reject'; } catch (e){ return 'THREW ' + e.message; } };
    const chk = (label, p, r, want) => { const v = verdict(p, r); if (v !== want) bad.push(label + ' -> ' + v); };
    { const p = forced('overlay'); p.seed(5); const r = p.ctx.iqOddGenerate(4); chk('overlay control', p, r, 'accept');
      const same = clone(r); same.items[r.oddIndex] = clone(same.items[(r.oddIndex + 1) % 4]); same.items[r.oddIndex].a = same.items[r.oddIndex].a.slice().reverse(); chk('overlay odd picture uses the common operation', p, same, 'reject');
      const wrong = clone(r); wrong.oddIndex = (r.oddIndex + 1) % 4; chk('overlay wrong picture marked', p, wrong, 'reject'); }
    { const p = forced('balance'); p.seed(6); const r = p.ctx.iqOddGenerate(4); chk('balance control', p, r, 'accept');
      const fine = clone(r); fine.items[r.oddIndex] = clone(fine.items[(r.oddIndex + 1) % 4]); fine.items[r.oddIndex].scales.reverse(); chk('balance odd picture that balances', p, fine, 'reject'); }
    { const p = forced('induce'); p.seed(7); const r = p.ctx.iqOddGenerate(5); chk('induce control', p, r, 'accept');
      const two = clone(r); const n = two.items[(r.oddIndex + 1) % 4]; n.pairs[0].to.shape = (n.pairs[0].to.shape + 1) % 3; chk('induce a normal picture breaks too', p, two, 'reject'); }
    return { pass: !bad.length, info: bad.length ? 'NOT REJECTED: ' + bad.join(' | ') : '3 controls accepted, 5 broken fixtures rejected' };
  });
  return out;
}

module.exports = { run };
