'use strict';
// Self-tests: (1) the harness itself (isolation, determinism, provenance), and
// (2) POSITIVE CONTROLS - hand-built bad questions that each independent
// verifier MUST flag. If a control passes unflagged, the verifier is useless.
// (3) an "agreement table" showing what the CURRENT production verifier does
// with the same bad questions (information, not pass/fail of production).

const fs = require('fs');
const path = require('path');
const H = require('../harness');
const V = require('../verify');

const results = [];
function test(name, fn){
  try {
    const r = fn();
    results.push({ name, pass: r.pass !== false, info: r.info || null });
  } catch (e){
    results.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) });
  }
}

// ---------- test-side fixture builders (do not use production render code) ----------
const FLAG = [[-24, -24], [24, -24], [24, 14], [2, 14], [2, 24], [-24, 24]]; // copied constant, see drift check below
const rotD = (pts, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
const mirD = pts => pts.map(([x, y]) => [-x, y]);
const toTile = pts => pts.map(([x, y]) => [50 + x * 1.75, 50 + y * 1.75]);
const f1 = v => v.toFixed(1);
const SVG_HEAD = '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">';
const polySvg = (pts, extra) => SVG_HEAD + '<polygon points="' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ') + '" fill="#4C6FFF" stroke="#1a1a2e" stroke-width="3"/>' + (extra || '') + '</svg>';
const circleSvg = (cx, cy, r) => '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" fill="#1a1a2e"/>';
const ANG = [0, 45, 90, 135, 180, 225, 270, 315];
const blobPts = radii => ANG.map((d, i) => [50 + radii[i] * Math.cos(d * Math.PI / 180), 50 + radii[i] * Math.sin(d * Math.PI / 180)]);
const blobSvg = radii => polySvg(blobPts(radii));
function ngon(n, r){ const p = []; for (let i = 0; i < n; i++){ const a = (-90 + i * 360 / n) * Math.PI / 180; p.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]); } return p; }
function ratioSvg(sides, dotsPos, dotR){ return polySvg(ngon(sides, 36), dotsPos.map(([x, y]) => circleSvg(x, y, dotR)).join('')); }
function ring(n, rho, cx, cy){ const o = []; for (let i = 0; i < n; i++){ const a = (-90 + i * 360 / n) * Math.PI / 180; o.push([(cx || 50) + rho * Math.cos(a), (cy || 50) + rho * Math.sin(a)]); } return o; }
const parse4 = svgs => svgs.map(s => V.parseSvg(s));

// reflex-vertex quadrant of an oriented flag (±24 coordinates)
function notchQuadrant(pts){
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
  const c = pts.filter(([x, y]) => Math.abs(x - mnx) > .5 && Math.abs(x - mxx) > .5 && Math.abs(y - mny) > .5 && Math.abs(y - mxy) > .5);
  return (c[0][0] >= 0 ? 'R' : 'L') + (c[0][1] >= 0 ? 'B' : 'T');
}

// ---------- 1. harness self-tests ----------
test('H1 same seed -> identical question sequence; different seed -> different', () => {
  const run = seed => { const p = H.loadProject({ scripts: H.listScripts().filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s)) }); p.seed(seed); const out = []; for (let i = 0; i < 200; i++) out.push(p.ctx.iqOddGenerate(1 + (i % 6))); return JSON.stringify(out); };
  const a = run(7), b = run(7), c = run(8);
  return { pass: a === b && a !== c, info: 'sequence length ' + a.length + ' chars' };
});
test('H2 randomness isolated: host Math.random untouched, two sandboxes independent', () => {
  const hostRandom = Math.random;
  const scripts = H.listScripts().filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s));
  const A = H.loadProject({ scripts }), B = H.loadProject({ scripts });
  A.seed(5); B.seed(5);
  for (let i = 0; i < 50; i++) A.ctx.iqOddGenerate(3);        // consume A's stream only
  const b1 = JSON.stringify(B.ctx.iqOddGenerate(3));
  const B2 = H.loadProject({ scripts }); B2.seed(5);
  const b2 = JSON.stringify(B2.ctx.iqOddGenerate(3));
  return { pass: Math.random === hostRandom && b1 === b2, info: 'sandbox B unaffected by sandbox A consumption' };
});
test('H3 loader uses the script list and order from index.html', () => {
  const p = H.loadProject();
  const html = fs.readFileSync(path.join(H.ROOT, 'index.html'), 'utf8');
  const tags = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
  return { pass: JSON.stringify(p.scripts) === JSON.stringify(tags) && p.scripts[0] === 'js/core.js', info: p.scripts.length + ' scripts: ' + p.scripts.join(' ') };
});
test('H4 all scripts in index.html load with the strict DOM (no lenient fallback needed)', () => {
  const p = H.loadProject();
  return { pass: p.evalIn('IQ_CATEGORIES').length > 0, info: 'IQ categories registered: ' + p.evalIn('IQ_CATEGORIES').map(c => c.key).join(',') };
});
test('H5 git reference loader works (0da4c3c) and reports whether sources differ from the working tree', () => {
  const ref = H.loadProject({ ref: '0da4c3c', scripts: H.listScripts('0da4c3c').filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s)) });
  ref.seed(3);
  const q = ref.ctx.iqOddGenerate(2);
  const wtSha = s => require('crypto').createHash('sha1').update(H.readSource(null, s)).digest('hex').slice(0, 12);
  const same = ref.scripts.filter(s => ref.sha[s] !== wtSha(s));
  return { pass: q.items.length === 4, info: 'sources differing from working tree: ' + (same.length ? same.join(',') : 'none') };
});
test('H6 fake DOM is strict: calling an unimplemented API throws', () => {
  const p = H.loadProject({ scripts: ['js/core.js'] });
  let threw = false;
  try { p.doc.getElementById('x').scrollIntoView(); } catch (e){ threw = true; }
  return { pass: threw };
});
test('H7 sandbox-only wrapping of generators does not change output (non-intrusive counting)', () => {
  const scripts = H.listScripts().filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s));
  const plain = H.loadProject({ scripts }), wrapped = H.loadProject({ scripts });
  let calls = 0;
  for (const n of ['iqOddGenOrientation', 'iqOddGenRatio', 'iqOddGenSymmetry']){ const o = wrapped.sandbox[n]; wrapped.sandbox[n] = (...a) => { calls++; return o(...a); }; }
  plain.seed(11); wrapped.seed(11);
  let same = true;
  for (let i = 0; i < 300; i++) if (JSON.stringify(plain.ctx.iqOddGenerate(1 + i % 6)) !== JSON.stringify(wrapped.ctx.iqOddGenerate(1 + i % 6))) same = false;
  // the three wrapped generators are only some of the families now (the newer ones have their own generators), so the count is just required to be non-zero
  return { pass: same && calls > 0, info: 'generator calls counted: ' + calls };
});
test('H8 test-side copy of the flag constant matches production IQ_ODD_FLAG_BASE (drift check)', () => {
  const p = H.loadProject({ scripts: H.listScripts().filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s)) });
  const prod = JSON.stringify(p.evalIn('IQ_ODD_FLAG_BASE'));
  return { pass: prod === JSON.stringify(FLAG), info: prod };
});

// ---------- 2. positive controls for the independent verifiers ----------
const XOR_FLOOR = 0.19; // 90% of the 0.21 the accepted flag achieves; REPORT-ONLY threshold in Step 0

const normalsRots = [0, 90, 180];
const flagN = normalsRots.map(r => rotD(FLAG, r));
const mirrors = [0, 90, 180, 270].map(r => rotD(mirD(FLAG), r));
const xorToNormals = m => Math.min(...flagN.map(n => V.xorFraction(n, m)));
const bestMirrorIdx = [0, 1, 2, 3].map(i => ({ i, d: xorToNormals(mirrors[i]) })).sort((a, b) => b.d - a.d)[0].i;
const normalQuads = flagN.map(notchQuadrant);
const nearDupIdx = [0, 1, 2, 3].find(i => normalQuads.includes(notchQuadrant(mirrors[i])));
const orientSvgs = ptsList => ptsList.map(p => polySvg(toTile(p)));

test('C-ORI-1 valid question (3 rotations + best mirror) -> unique, odd is a mirror, min XOR >= floor', () => {
  const r = V.orientationAnalysis(parse4(orientSvgs([...flagN, mirrors[bestMirrorIdx]])));
  const x = V.orientationMinXor(r.polys);
  return { pass: r.unique && r.oddIndex === 3 && r.oddIsMirrorOfMajority && x >= XOR_FLOOR, info: 'minXor=' + x.toFixed(3) };
});
test('C-ORI-2 four rotations (no odd) must be flagged as not-unique', () => {
  const r = V.orientationAnalysis(parse4(orientSvgs([0, 90, 180, 270].map(d => rotD(FLAG, d)))));
  return { pass: !r.unique, info: 'class sizes ' + r.sizes };
});
test('C-ORI-3 two mirror images (two odd) must be flagged as not-unique', () => {
  const r = V.orientationAnalysis(parse4(orientSvgs([flagN[0], flagN[1], mirrors[0], mirrors[1]])));
  return { pass: !r.unique, info: 'class sizes ' + r.sizes };
});
test('C-ORI-4 shape with hidden diagonal symmetry (mirror == rotation, the original bug) must be flagged', () => {
  const L = [[-24, -24], [24, -24], [24, -4], [-4, -4], [-4, 24], [-24, 24]]; // symmetric about the main diagonal
  const r = V.orientationAnalysis(parse4(orientSvgs([rotD(L, 0), rotD(L, 90), rotD(L, 180), mirD(L)])));
  return { pass: !r.unique, info: 'class sizes ' + r.sizes };
});
test('C-ORI-5 near-duplicate (mirror whose notch sits in the same corner as a normal) is mathematically unique but must be caught by the distance measure', () => {
  const m = mirrors[nearDupIdx];
  const r = V.orientationAnalysis(parse4(orientSvgs([...flagN, m])));
  const x = V.orientationMinXor(r.polys);
  return { pass: r.unique && x < XOR_FLOOR, info: 'unique=' + r.unique + ' minXor=' + x.toFixed(3) + ' (floor ' + XOR_FLOOR + ', valid questions score ~0.21)' };
});

const okRatio = [[3, 2], [4, 3], [5, 4], [6, 5]];
const ratioSvgs = list => list.map(([s, d]) => ratioSvg(s, ring(d, 9, 50, 50), 3));
test('C-RAT-1 valid question (one wrong count) -> unique, geometry clear', () => {
  const l = okRatio.slice(); l[2] = [5, 5];
  const r = V.ratioAnalysis(parse4(ratioSvgs(l)));
  const clr = Math.min(...r.items.map(i => i.minClear));
  return { pass: r.unique && r.oddIndex === 2 && clr >= 2.5, info: 'minClear=' + clr.toFixed(2) };
});
test('C-RAT-2 all four satisfy the rule -> flagged not-unique', () => {
  return { pass: !V.ratioAnalysis(parse4(ratioSvgs(okRatio))).unique };
});
test('C-RAT-3 two options violate the rule -> flagged not-unique', () => {
  const l = okRatio.slice(); l[1] = [4, 4]; l[3] = [6, 3];
  return { pass: !V.ratioAnalysis(parse4(ratioSvgs(l))).unique };
});
test('C-RAT-4 dot centred ON the triangle edge (the original bug: fixed r*0.5 ring) must be flagged by the clearance check', () => {
  const svgs = [ratioSvg(3, ring(2, 18, 50, 50), 3), ...ratioSvgs(okRatio.slice(1))];
  const r = V.ratioAnalysis(parse4(svgs));
  return { pass: r.items[0].minClear < 0, info: 'clearance of that option = ' + r.items[0].minClear.toFixed(2) + ' units' };
});
test('C-RAT-5 dot too close to the outline (1 unit gap) must be flagged below the 2.5-unit clearance floor', () => {
  const svgs = [ratioSvg(3, ring(2, 13.5, 50, 50), 3), ...ratioSvgs(okRatio.slice(1))];
  const r = V.ratioAnalysis(parse4(svgs));
  return { pass: r.items[0].minClear < 2.5, info: 'clearance=' + r.items[0].minClear.toFixed(2) };
});

const symA = [30, 36, 26, 36, 30, 33, 29, 33];  // vertical axis
const symB = [34, 28, 31, 28, 34, 25, 27, 25];  // vertical axis
const symC = [27, 33, 35, 33, 27, 30, 32, 30];  // vertical axis
const diagOnly = [31, 29, 31, 35, 27, 33, 27, 35]; // symmetric about the 45-degree diagonal ONLY
const asymBig = [28, 35, 24, 31, 36, 27, 33, 29];
const asymSmall = symA.map((r, i) => (i === 1 ? r + 1.5 : r)); // one vertex moved by 1.5 units
// a valid post-Step-3 odd: a vertical-symmetric base with ONE vertex moved by 8, margin 6 against every axis (checked below)
const oddMargin6 = [24, 28, 30, 36, 24, 33, 22, 33];
{
  const PAIRS_T = [[[0, 4], [1, 3], [5, 7]], [[1, 7], [2, 6], [3, 5]], [[0, 2], [3, 7], [4, 6]], [[0, 6], [1, 5], [2, 4]]];
  const m = Math.min(...PAIRS_T.map(ps => Math.max(...ps.map(([i, j]) => Math.abs(oddMargin6[i] - oddMargin6[j])))));
  if (Math.abs(m - 6) > 1e-9) throw new Error('selftest fixture oddMargin6 has margin ' + m);
}
const symSvgs = list => list.map(blobSvg);
test('C-SYM-1 valid question (3 symmetric + 1 clearly asymmetric) -> unique', () => {
  const r = V.symmetryAnalysis(parse4(symSvgs([symA, symB, asymBig, symC])));
  return { pass: r.unique && r.oddIndex === 2, info: 'odd margin ' + r.items[2].margin.toFixed(1) + ' units' };
});
test('C-SYM-2 all four symmetric -> flagged not-unique', () => {
  return { pass: !V.symmetryAnalysis(parse4(symSvgs([symA, symB, symC, symA]))).unique };
});
test('C-SYM-3 two asymmetric -> flagged not-unique', () => {
  return { pass: !V.symmetryAnalysis(parse4(symSvgs([symA, asymBig, symC, asymSmall.map((r, i) => (i === 5 ? r + 6 : r))]))).unique };
});
test('C-SYM-4 "asymmetric" option that is symmetric about a DIAGONAL only (the missed-axis bug) must be recognised as symmetric', () => {
  const r = V.symmetryAnalysis(parse4(symSvgs([symA, symB, symC, diagOnly])));
  return { pass: !r.unique && r.items[3].axes.join() === '45', info: 'axes of the diagonal option: ' + r.items[3].axes };
});
test('C-SYM-5 nearly-symmetric odd (vertex moved 1.5 units): reported margin must be ~1.5', () => {
  const r = V.symmetryAnalysis(parse4(symSvgs([symB, symC, asymSmall, symA])));
  const m = r.items[2].margin;
  return { pass: r.unique && Math.abs(m - 1.5) < 0.3, info: 'margin=' + m.toFixed(2) + ' units = ' + (m * V.PX.phone / 100).toFixed(2) + ' px on a phone (no floor selected yet, report only)' };
});

// ---------- 2b. malformed ratio questions injected into the REAL production check ----------
// iqOddRatioPlacementOk computes its own layout via the global iqOddRatioLayout, so bad dot
// positions cannot be passed in as data. Smallest test-only route: inside the SANDBOX ONLY
// (in memory; files on disk are never touched) replace iqOddRatioLayout with a malformed
// version, then call the unmodified production iqOddRatioPlacementOk / iqOddVerifyExactlyOneOdd.
// What this proves: the production CHECK rejects malformed placement. It does not prove the
// production LAYOUT is correct - that is covered by the independent SVG verifier on 120,000
// real questions in the baseline.
const ODD_SCRIPTS = H.listScripts().filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s));
function ratioProd(patch){
  const p = H.loadProject({ scripts: ODD_SCRIPTS });
  const orig = p.sandbox.iqOddRatioLayout;
  if (patch) p.sandbox.iqOddRatioLayout = (...a) => patch(orig(...a), ...a);
  return p;
}
const ratioItem = ([sides, dots]) => ({ kind: 'ratio', sides, dots, color: '#4C6FFF', strokeWidth: 3, size: 100 });
const ratioResult = list => ({ family: 'ratio', variant: 'sides-minus-1-ring', oddIndex: 2, items: list.map(ratioItem) });
const RULE_OK_LIST = [[3, 2], [4, 3], [5, 5], [6, 5]]; // only index 2 (5 sides, 5 dots) breaks dots = sides - 1
// the ORIGINAL bug: dots on a fixed ring of r*0.5, which for a triangle is exactly its inradius
const oldRingForTriangle = (L, sides, dots) => {
  if (sides !== 3) return L;
  const rho = L.r * 0.5, centers = [];
  for (let i = 0; i < dots; i++){ const a = (-90 + i * 360 / Math.max(dots, 1)) * Math.PI / 180; centers.push([rho * Math.cos(a), rho * Math.sin(a)]); }
  return Object.assign({}, L, { innerR: rho, centers });
};
const minCenterDistance = c => { let m = Infinity; for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) m = Math.min(m, hyp2(c[i], c[j])); return m; };
const hyp2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('P-RAT-1 control: unpatched production accepts the valid question (rule stage and placement stage)', () => {
  const p = ratioProd(null), r = ratioResult(RULE_OK_LIST);
  const per = r.items.map(it => p.ctx.iqOddRatioPlacementOk(it));
  return { pass: p.ctx.iqOddVerifyExactlyOneOdd(r) === true && per.every(Boolean), info: 'placement per option ' + per };
});
test('P-RAT-2 original bug injected (triangle dots on the edge) -> production placement check and verifier reject; reason isolated to edge clearance', () => {
  const p = ratioProd(oldRingForTriangle), r = ratioResult(RULE_OK_LIST);
  const per = r.items.map(it => p.ctx.iqOddRatioPlacementOk(it));
  const verdict = p.ctx.iqOddVerifyExactlyOneOdd(r);
  // isolate the reason: (a) the rule stage is satisfied (same items pass with the unpatched layout, P-RAT-1);
  // (b) the malformed option's dots are far apart, so the spacing branch cannot be the cause;
  // (c) the independent verifier, reading the production-rendered SVG, sees the triangle's dot ON the outline.
  const L = p.ctx.iqOddRatioLayout(3, 2, 3, 100);
  const spacingOk = minCenterDistance(L.centers) >= 2 * L.dotR + L.gap;
  const ind = V.ratioAnalysis(parse4(r.items.map(it => p.ctx.iqOddRenderItem(it))));
  const clear = ind.items.map(i => i.minClear);
  const reasonIsEdge = spacingOk && clear[0] < 0 && clear.slice(1).every(c => c >= 2.5) && ind.unique && ind.oddIndex === 2;
  return { pass: per[0] === false && per.slice(1).every(Boolean) && verdict === false && reasonIsEdge,
    info: 'placement per option ' + per + ' | verifier verdict ' + verdict + ' | independent clearances ' + clear.map(c => c.toFixed(2)) };
});
test('P-RAT-3 dots overlapping each other but far from every edge -> rejected by the spacing branch only', () => {
  const squareCluster = (L, sides, dots) => (sides === 4 ? Object.assign({}, L, { centers: [[0, 0], [1, 0], [0, 1]].slice(0, dots) }) : L);
  const p = ratioProd(squareCluster), r = ratioResult(RULE_OK_LIST);
  const per = r.items.map(it => p.ctx.iqOddRatioPlacementOk(it));
  const ind = V.ratioAnalysis(parse4(r.items.map(it => p.ctx.iqOddRenderItem(it))));
  const sq = ind.items[1];
  return { pass: per[1] === false && per.filter((_, i) => i !== 1).every(Boolean) && p.ctx.iqOddVerifyExactlyOneOdd(r) === false && sq.minClear >= 2.5 && sq.minSpacing < 0,
    info: 'placement per option ' + per + ' | independent: edge clearance ' + sq.minClear.toFixed(2) + ', dot spacing ' + sq.minSpacing.toFixed(2) };
});
test('P-RAT-4 boundary: a single triangle dot exactly at the required margin is accepted, 0.2 units closer is rejected', () => {
  const at = shift => (L, sides, dots) => (sides === 3 && dots === 1
    ? Object.assign({}, L, { centers: [[0, L.r * Math.cos(Math.PI / 3) - L.margin + shift]] }) : L);
  const ok = ratioProd(at(0)).ctx.iqOddRatioPlacementOk(ratioItem([3, 1]));
  const bad = ratioProd(at(0.2)).ctx.iqOddRatioPlacementOk(ratioItem([3, 1]));
  return { pass: ok === true && bad === false, info: 'margin = dot radius + half stroke + gap = ' + ratioProd(null).ctx.iqOddRatioLayout(3, 1, 3, 100).margin + ' units' };
});

// ---------- 2c. registry hardening (Step 2): registration and result validation ----------
// Every "must be rejected" case also checks the MESSAGE names the right problem, so a
// rejection for the wrong reason (or an obscure TypeError) does not pass.
const probeDef = extra => Object.assign({ key: 'probe', generate: () => null, verify: () => true, render: () => '<svg/>' }, extra || {});
const msgOf = fn => { try { fn(); return null; } catch (e){ return String(e && e.message); } };
const probeResult = o => Object.assign({ family: 'probe', items: [0, 1, 2, 3].map(() => ({ kind: 'probe' })), oddIndex: 2, explanation: 'probe explanation' }, o || {});
const without = (o, k) => { const c = Object.assign({}, o); delete c[k]; return c; };

test('V-REG-1 malformed registrations throw a clear error naming the problem, and leave the registry unchanged', () => {
  const p = H.loadProject({ scripts: ODD_SCRIPTS });
  const before = p.evalIn('IQ_ODD_FAMILIES.length');
  const cases = [
    ['no argument', undefined, /definition object/], ['null', null, /definition object/], ['string instead of object', 'x', /definition object/],
    ['key missing', without(probeDef(), 'key'), /"key" must be a non-empty string/], ['key empty', probeDef({ key: '' }), /"key" must be a non-empty string/],
    ['key whitespace only', probeDef({ key: '   ' }), /"key" must be a non-empty string/], ['key is a number', probeDef({ key: 123 }), /"key" must be a non-empty string/],
    ['key is an object', probeDef({ key: {} }), /"key" must be a non-empty string/],
    ['generate missing', without(probeDef(), 'generate'), /"generate" must be a function/], ['generate is a string', probeDef({ generate: 'oops' }), /"generate" must be a function/],
    ['generate is null', probeDef({ generate: null }), /"generate" must be a function/],
    ['verify is an object', probeDef({ verify: {} }), /"verify" must be a function/], ['render is a number', probeDef({ render: 5 }), /"render" must be a function/],
    ['minTier "abc"', probeDef({ minTier: 'abc' }), /"minTier" must be a finite number/], ['minTier NaN', probeDef({ minTier: NaN }), /"minTier" must be a finite number/],
    ['minTier Infinity', probeDef({ minTier: Infinity }), /"minTier" must be a finite number/], ['minTier null', probeDef({ minTier: null }), /"minTier" must be a finite number/],
    ['minTier explicitly undefined', probeDef({ minTier: undefined }), /"minTier" must be a finite number/],
    ['enabled "false" (string)', probeDef({ enabled: 'false' }), /"enabled" must be a boolean/], ['enabled 1', probeDef({ enabled: 1 }), /"enabled" must be a boolean/],
    ['enabled null', probeDef({ enabled: null }), /"enabled" must be a boolean/], ['enabled explicitly undefined', probeDef({ enabled: undefined }), /"enabled" must be a boolean/],
    ['duplicate key "ratio"', probeDef({ key: 'ratio' }), /duplicate family "ratio"/]
  ];
  const bad = [];
  for (const [label, def, re] of cases){
    const m = msgOf(() => p.ctx.iqOddRegisterFamily(def));
    if (!m || !re.test(m)) bad.push(label + ' -> ' + m);
  }
  const after = p.evalIn('IQ_ODD_FAMILIES.length');
  return { pass: !bad.length && before === after, info: cases.length + ' cases; registry size ' + before + ' -> ' + after + (bad.length ? '; WRONG: ' + bad.join(' | ') : '') };
});
test('V-REG-2 valid registrations: defaults when omitted, provided values kept, extra fields allowed', () => {
  const p = H.loadProject({ scripts: ODD_SCRIPTS });
  p.ctx.iqOddRegisterFamily(probeDef({ key: 'a' }));
  p.ctx.iqOddRegisterFamily(probeDef({ key: 'b', minTier: 3, enabled: false }));
  p.ctx.iqOddRegisterFamily(probeDef({ key: 'c', minTier: 0 }));
  p.ctx.iqOddRegisterFamily(probeDef({ key: 'd', minTier: 2.5, note: 'extra' }));
  const f = k => p.evalIn('IQ_ODD_FAMILIES').find(x => x.key === k);
  const ok = f('a').minTier === 1 && f('a').enabled === true && f('b').minTier === 3 && f('b').enabled === false && f('c').minTier === 0 && f('d').minTier === 2.5 && f('d').note === 'extra';
  const order = p.evalIn('IQ_ODD_FAMILIES').map(x => x.key).join(',');
  return { pass: ok && order === 'orientation,ratio,symmetry,parts,props,topology,stack,net,a,b,c,d', info: 'registration order ' + order };
});

function probeRun(generates){
  // one enabled probe family whose generator yields the given sequence of results (last one repeats)
  const p = H.loadProject({ scripts: ODD_SCRIPTS });
  const calls = { gen: 0, ver: 0 };
  p.ctx.iqOddRegisterFamily(probeDef({ generate: () => generates[Math.min(calls.gen++, generates.length - 1)], verify: () => { calls.ver++; return true; } }));
  p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'probe'; });
  return { p, calls };
}
test('V-RES-1 invalid generated results throw at once: right message, generator called once (no retry), verifier never reached', () => {
  const cases = [
    ['null', null, /not an object/], ['undefined', undefined, /not an object/], ['array', [], /not an object/], ['string', 'x', /not an object/], ['number', 5, /not an object/],
    ['family names another family', probeResult({ family: 'ratio' }), /result\.family is "ratio", expected "probe"/],
    ['family missing', without(probeResult(), 'family'), /result\.family is undefined, expected "probe"/],
    ['items missing', without(probeResult(), 'items'), /exactly 4/], ['items is a string', probeResult({ items: 'abcd' }), /exactly 4/],
    ['3 items', probeResult({ items: [{ kind: 'probe' }, { kind: 'probe' }, { kind: 'probe' }] }), /exactly 4/],
    ['5 items', probeResult({ items: [0, 1, 2, 3, 4].map(() => ({ kind: 'probe' })) }), /exactly 4/],
    ['item 0 is null', probeResult({ items: [null, { kind: 'probe' }, { kind: 'probe' }, { kind: 'probe' }] }), /item 0 is not an object/],
    ['item 3 is a number', probeResult({ items: [{ kind: 'probe' }, { kind: 'probe' }, { kind: 'probe' }, 7] }), /item 3 is not an object/],
    ['item kind of another family', probeResult({ items: [{ kind: 'probe' }, { kind: 'ratio' }, { kind: 'probe' }, { kind: 'probe' }] }), /item 1 has kind "ratio", expected "probe"/],
    ['item kind missing', probeResult({ items: [{ kind: 'probe' }, { kind: 'probe' }, {}, { kind: 'probe' }] }), /item 2 has kind undefined/],
    ['oddIndex 4', probeResult({ oddIndex: 4 }), /oddIndex/], ['oddIndex -1', probeResult({ oddIndex: -1 }), /oddIndex/], ['oddIndex 1.5', probeResult({ oddIndex: 1.5 }), /oddIndex/],
    ['oddIndex "2" (string)', probeResult({ oddIndex: '2' }), /oddIndex/], ['oddIndex NaN', probeResult({ oddIndex: NaN }), /oddIndex/],
    ['oddIndex missing', without(probeResult(), 'oddIndex'), /oddIndex/], ['oddIndex null', probeResult({ oddIndex: null }), /oddIndex/],
    ['explanation missing', without(probeResult(), 'explanation'), /explanation must be a non-empty string/], ['explanation empty', probeResult({ explanation: '' }), /explanation must be a non-empty string/],
    ['explanation blanks', probeResult({ explanation: '   ' }), /explanation must be a non-empty string/], ['explanation number', probeResult({ explanation: 123 }), /explanation must be a non-empty string/],
    ['explanation null', probeResult({ explanation: null }), /explanation must be a non-empty string/],
    ['invalid first, valid second (no retry may rescue it)', [probeResult({ oddIndex: 9 }), probeResult()], /oddIndex/]
  ];
  const bad = [];
  for (const [label, res, re] of cases){
    const { p, calls } = probeRun(Array.isArray(res) && res.length === 2 && res[0] && res[0].family ? res : [res]);
    const m = msgOf(() => p.ctx.iqOddGenerate(1));
    if (!(m && /invalid result/.test(m) && re.test(m) && calls.gen === 1 && calls.ver === 0)) bad.push(label + ' -> msg=' + m + ' gen=' + calls.gen + ' ver=' + calls.ver);
  }
  return { pass: !bad.length, info: cases.length + ' cases' + (bad.length ? '; WRONG: ' + bad.join(' | ') : '') };
});
test('V-RES-2 a valid result is accepted and returned as-is (same object, not repaired or altered)', () => {
  const res = probeResult(), snapshot = JSON.stringify(res);
  const { p, calls } = probeRun([res]);
  const got = p.ctx.iqOddGenerate(1);
  return { pass: got === res && JSON.stringify(got) === snapshot && calls.gen === 1 && calls.ver >= 1, info: 'generator calls ' + calls.gen + ', verifier calls ' + calls.ver };
});
test('V-RES-3 no fallback and no masking: with real families enabled, a defective family throws only when picked; other families keep returning valid questions', () => {
  const p = H.loadProject({ scripts: ODD_SCRIPTS });
  let probeCalls = 0;
  p.ctx.iqOddRegisterFamily(probeDef({ generate: () => { probeCalls++; return probeResult({ family: 'ratio' }); } }));
  p.seed(21);
  let thrown = 0, returned = 0, wrongMessages = 0, probeResultsReturned = 0;
  for (let i = 0; i < 600; i++){
    try { const r = p.ctx.iqOddGenerate(2); returned++; if (r.family === 'probe') probeResultsReturned++; }
    catch (e){ thrown++; if (!/family "probe" returned an invalid result/.test(e.message)) wrongMessages++; }
  }
  return { pass: thrown > 0 && returned > 0 && thrown === probeCalls && !wrongMessages && !probeResultsReturned,
    info: 'draws 600: valid results returned ' + returned + ', throws ' + thrown + ' (= probe generator calls ' + probeCalls + ', so exactly one call per pick, no retry), wrong messages ' + wrongMessages };
});
test('V-RES-4 the three real families: no validation error in 3,000 draws across tiers 1-6', () => {
  const p = H.loadProject({ scripts: ODD_SCRIPTS });
  p.seed(77);
  let ok = 0;
  for (let tier = 1; tier <= 6; tier++) for (let i = 0; i < 500; i++){ p.ctx.iqOddGenerate(tier); ok++; }
  return { pass: ok === 3000, info: ok + ' questions generated without error' };
});

// ---------- 3. what the CURRENT production verifier does with the same bad questions ----------
function productionAgreement(){
  const p = H.loadProject({ scripts: H.listScripts().filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s)) });
  const ori = list => ({ family: 'orientation', oddIndex: 3, items: list.map(pts => ({ pts, color: '#4C6FFF', strokeWidth: 3, size: 100 })) });
  const sym = (list, odd) => ({ family: 'symmetry', oddIndex: odd, items: list.map(radii => ({ radii, color: '#4C6FFF', strokeWidth: 3, size: 100 })) });
  const rat = list => ({ family: 'ratio', variant: 'sides-minus-1-ring', oddIndex: 2, items: list.map(([sides, dots]) => ({ sides, dots, color: '#4C6FFF', strokeWidth: 3, size: 100 })) });
  const v = r => p.ctx.iqOddVerifyExactlyOneOdd(r);
  const l = okRatio.slice(); l[2] = [5, 5];
  const rows = [
    ['orientation: valid question', v(ori([...flagN, mirrors[bestMirrorIdx]])), true],
    ['orientation: four rotations (no odd)', v(ori([0, 90, 180, 270].map(d => rotD(FLAG, d)))), false],
    ['orientation: two mirror images', v(ori([flagN[0], flagN[1], mirrors[0], mirrors[1]])), false],
    ['orientation: near-duplicate (mirror notch in a normal\'s corner)', v(ori([...flagN, mirrors[nearDupIdx]])), false],
    // Step 3: the verifier now requires a margin of at least 5 units (it used to accept anything above a 2-unit tolerance)
    ['symmetry: valid (one vertex moved, margin 6)', v(sym([symA, symB, symC, oddMargin6], 3)), true],
    ['symmetry: margin 4.0 (accepted by the pre-Step-3 rule, below the new floor)', v(sym([symA, symB, symC, asymBig], 3)), false],
    ['symmetry: odd symmetric about a diagonal only', v(sym([symA, symB, symC, diagOnly], 3)), false],
    ['symmetry: odd with max pair gap 1.5', v(sym([symA, symB, symC, asymSmall], 3)), false],
    ['symmetry: odd with max pair gap 2.5 (accepted before Step 3, below the new floor)', v(sym([symA, symB, symC, symA.map((r, i) => (i === 1 ? r + 2.5 : r))], 3)), false],
    ['ratio: valid', v(rat(l)), true],
    ['ratio: all four satisfy', v(rat(okRatio)), false]
  ];
  return rows.map(([name, got, expected]) => ({ name, productionVerdict: got, expectedVerdict: expected, agrees: got === expected }));
}

function run(){ return { tests: results, productionAgreement: productionAgreement() }; }
module.exports = { run };
