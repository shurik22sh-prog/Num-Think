'use strict';

/* ============ Odd one out: relations between two shapes (family 'relation') ============ */
// Every picture shows an ORIGINAL (hollow) and an IMAGE (filled). Three pictures obey one relation
// between them, one does not. Variants (all registered ENABLED):
//   mirror-diag   the image is the mirror image of the original in the dashed (slanted) line; in the odd picture it is also turned 45 degrees
//   double-mirror the image comes from reflecting in the BLUE line and then the RED one; in the odd picture the order is reversed
//   hull-bbox     the image is the convex hull of the original (the smallest convex shape around it); in the odd picture it is the bounding rectangle
//   hull-missing  the image is the convex hull of the original; in the odd picture the most protruding tip is missing from it
//   homothety     the image is the original enlarged from the marked + point; in the odd picture it is enlarged from another point
//   self-replace  every filled cell of the 2x2 pattern is replaced by a copy of the pattern; in the odd picture the copies are turned
// The verifier recomputes every relation from the stored coordinates / cells only.

const IQ_REL_MARGIN = 6;
const IQ_REL_MIRROR_TOL = 2, IQ_REL_DOUBLE_TOL = 3, IQ_REL_HULL_TOL = 1.8, IQ_REL_RAY_ANGLE_TOL = 4.5, IQ_REL_RAY_RATIO_TOL = 0.1;
const IQ_REL_FILLS = ['#8EC5FF', '#9EE0B8', '#FFD07F', '#D8B4F8', '#FFB3A7'];
const IQ_REL_BLUE = '#0072B2', IQ_REL_RED = '#D55E00';
const IQ_REL_HOMOTHETY_K = [1.5, 1.6, 1.8, 2];

const IQ_REL_VARIANTS = [
  { key: 'mirror-diag',   minTier: 4, explanation: 'בשלוש הצורות הצורה המלאה היא תמונת ראי מדויקת של הצורה הריקה בקו המקווקו. בצורה שנבחרה היא תמונת ראי שגם הוסתובבה.' },
  { key: 'hull-bbox',     minTier: 4, explanation: 'בשלוש הצורות הצורה המלאה היא המעטפת הקמורה של הצורה הריקה (הצורה הקמורה הקטנה ביותר שמכילה אותה). בצורה שנבחרה היא המלבן החוסם.' },
  { key: 'hull-missing',  minTier: 5, explanation: 'בשלוש הצורות הצורה המלאה עוברת דרך כל קצוות הקוצים של הצורה הריקה. בצורה שנבחרה חסר קצה של קוץ אחד.' },
  { key: 'homothety',     minTier: 5, explanation: 'בשלוש הצורות הצורה המלאה היא הגדלה של הצורה הריקה מהנקודה המסומנת ב-+. בצורה שנבחרה ההגדלה היא מנקודה אחרת.' },
  { key: 'double-mirror', minTier: 6, explanation: 'בשלוש הצורות הצורה המלאה מתקבלת מהריקה בשיקוף בקו הכחול ואחריו בקו האדום. בצורה שנבחרה הסדר הפוך.' },
  { key: 'self-replace',  minTier: 6, explanation: 'בשלוש הצורות כל משבצת מלאה בדפוס הקטן הוחלפה בעותק שלו. בצורה שנבחרה העותקים מסובבים.' }
];
const iqRelVariant = key => IQ_REL_VARIANTS.find(v => v.key === key);
const iqRelRound = poly => poly.map(iqAdvPt5);
const iqRelInTile = poly => poly.every(p => iqAdvInTile(p, IQ_REL_MARGIN));
function iqRelDisjoint(a, b){                                           // no crossing edges and neither polygon inside the other
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++)
    if (iqOddSegCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return false;
  return !a.some(p => iqAdvPointInPoly(p, b)) && !b.some(p => iqAdvPointInPoly(p, a));
}
const iqRelPlace = (poly, c) => iqAdvShift(poly, c[0], c[1]);

// ----- stars (concave outlines whose tips are exactly the vertices of the convex hull) -----
function iqRelStar(k, tipMin, tipMax, longTip){
  for (let attempt = 0; attempt < 300; attempt++){
    const base = iqAdvRand(0, 360), tips = [], radii = [];
    for (let i = 0; i < k; i++){
      const a = base + i * 360 / k + iqAdvRand(-10, 10), r = iqAdvRand(tipMin, tipMax);
      radii.push(r); tips.push(a);
    }
    if (longTip !== undefined) radii[longTip.index] = longTip.radius;
    const poly = [], hullPts = [];
    for (let i = 0; i < k; i++){
      const a = tips[i], r = radii[i], n = (i + 1) % k;
      const tip = [r * Math.cos(a * IQ_ADV_RAD), r * Math.sin(a * IQ_ADV_RAD)];
      const midA = (a + (tips[n] + (n === 0 ? 360 : 0))) / 2 + iqAdvRand(-6, 6), nr = iqAdvRand(0.36, 0.52) * Math.min(r, radii[n]);
      poly.push(tip, [nr * Math.cos(midA * IQ_ADV_RAD), nr * Math.sin(midA * IQ_ADV_RAD)]);
      hullPts.push(tip);
    }
    const h = iqAdvHull(poly);
    if (h.length === k && iqAdvSimplePoly(poly) && iqAdvSetsMatch(h, hullPts, 1e-6)) return { poly, tips: hullPts };
  }
  return null;
}
function iqRelRectStar(a, b){                                           // four tips at the corners of an upright rectangle: the hull is a rectangle
  const j = () => iqAdvRand(-1.2, 1.2), f = iqAdvRand(0.3, 0.45);
  const tips = [[-a, -b], [a, -b], [a, b], [-a, b]];
  const poly = [tips[0], [j(), -b * f + j()], tips[1], [a * f + j(), j()], tips[2], [j(), b * f + j()], tips[3], [-a * f + j(), j()]];
  return iqAdvSimplePoly(poly) && iqAdvHull(poly).length === 4 ? { poly, tips } : null;
}
// how far a tip sticks out beyond the hull of all the OTHER tips
function iqRelProtrusions(tips){
  return tips.map((t, i) => {
    const others = tips.filter((_, j) => j !== i), h = iqAdvHull(others);
    if (h.length < 3) return 0;
    return iqAdvPointInPoly(t, h) ? 0 : iqAdvEdgeDist(t, h);
  });
}

// ----- pictures -----
function iqRelItem(figure, fill, extra){
  return Object.assign({ kind: 'relation', figure, size: 100, strokeWidth: 2.2, fill }, extra);
}
// mirror-diag: original on one side of a slanted line, image on the other
function iqRelMirrorOne(fill, turned){
  for (let attempt = 0; attempt < 300; attempt++){
    const q = [iqAdvRand(40, 60), iqAdvRand(40, 60)], deg = (Math.random() < 0.5 ? iqAdvRand(25, 65) : iqAdvRand(115, 155));
    const t = deg * IQ_ADV_RAD, u = [Math.cos(t), Math.sin(t)], n = [-Math.sin(t), Math.cos(t)];
    const side = Math.random() < 0.5 ? -1 : 1, dd = iqAdvRand(18, 26), al = iqAdvRand(-14, 14);
    const centre = [q[0] + al * u[0] + side * dd * n[0], q[1] + al * u[1] + side * dd * n[1]];
    const blob = iqAdvBlob(7, 7, 15, 30);
    if (!blob || iqAdvAsymmetry(blob) < 0.15) continue;
    const L = iqRelPlace(blob, centre);
    let R = L.map(p => iqAdvReflect(p, q, deg));
    if (turned){ const c = iqAdvMean(R), a = (Math.random() < 0.5 ? -45 : 45); R = R.map(p => iqAdvRot(p, c, a)); }
    if (!iqRelInTile(L) || !iqRelInTile(R)) continue;
    if (!L.every(p => Math.abs(iqAdvSideDist(p, q, deg)) >= 4) || !R.every(p => Math.abs(iqAdvSideDist(p, q, deg)) >= 2)) continue;
    return iqRelItem('mirror', fill, { line: iqAdvClipLine(q, deg).map(iqAdvPt5), L: iqRelRound(L), R: iqRelRound(R) });
  }
  return null;
}
// double-mirror: two lines through O; the image is the original reflected in blue then red (or red then blue)
function iqRelDoubleOne(fill, sign, reversed){
  for (let attempt = 0; attempt < 400; attempt++){
    const O = [iqAdvRand(44, 56), iqAdvRand(44, 56)], blueDeg = iqAdvRand(0, 180), phi = sign * iqAdvRand(32, 70), redDeg = blueDeg + phi;
    const blob = iqAdvBlob(7, 7, 11, 30);
    if (!blob || iqAdvAsymmetry(blob) < 0.15) continue;
    const ang = iqAdvRand(0, 360), dist = iqAdvRand(22, 26);
    const L = iqRelPlace(blob, [O[0] + dist * Math.cos(ang * IQ_ADV_RAD), O[1] + dist * Math.sin(ang * IQ_ADV_RAD)]);
    const refl = (poly, deg) => poly.map(p => iqAdvReflect(p, O, deg));
    const R = reversed ? refl(refl(L, redDeg), blueDeg) : refl(refl(L, blueDeg), redDeg);
    if (!iqRelInTile(L) || !iqRelInTile(R) || !iqRelDisjoint(L, R)) continue;
    return iqRelItem('double', fill, { lines: [{ c: IQ_REL_BLUE, p: iqAdvClipLine(O, blueDeg).map(iqAdvPt5) }, { c: IQ_REL_RED, p: iqAdvClipLine(O, redDeg).map(iqAdvPt5) }], L: iqRelRound(L), R: iqRelRound(R) });
  }
  return null;
}
// hull pictures: a concave star on the left, its image on the right (same scale, same orientation)
function iqRelHullOne(fill, star, kind){
  for (let attempt = 0; attempt < 100; attempt++){
    const c = [iqAdvRand(28, 32), iqAdvRand(46, 54)], dx = iqAdvRand(37, 42), dy = iqAdvRand(-8, 8);
    const L = iqRelPlace(star.poly, c), tips = iqRelPlace(star.tips, c);
    let R;
    if (kind === 'hull') R = iqAdvHull(L);
    else if (kind === 'bbox') R = iqAdvBBoxRect(L);
    else {                                                                   // 'missing': the hull of every tip but the most protruding one
      const pr = iqRelProtrusions(tips), big = pr.indexOf(Math.max(...pr));
      R = iqAdvHull(tips.filter((_, i) => i !== big));
    }
    R = iqAdvShift(R, dx, dy);
    if (!iqRelInTile(L) || !iqRelInTile(R)) continue;
    return iqRelItem('hull', fill, { L: iqRelRound(L), R: iqRelRound(R) });
  }
  return null;
}
// homothety: the image is the original scaled by k about O
function iqRelHomothetyOne(fill, k, otherCentre){
  for (let outer = 0; outer < 40; outer++){
    const nv = randInt(3, 5), blob = iqAdvBlob(nv, 9, 13, 70);
    if (!blob) continue;
    for (let attempt = 0; attempt < 30; attempt++){
      const O = [iqAdvRand(12, 88), iqAdvRand(12, 88)], ang = iqAdvRand(0, 360), dist = iqAdvRand(18, 36);
      const L = iqRelPlace(blob, [O[0] + dist * Math.cos(ang * IQ_ADV_RAD), O[1] + dist * Math.sin(ang * IQ_ADV_RAD)]);
      let C = O;
      if (otherCentre){ const a = iqAdvRand(0, 360), m = iqAdvRand(28, 38); C = [O[0] + m * Math.cos(a * IQ_ADV_RAD), O[1] + m * Math.sin(a * IQ_ADV_RAD)]; }
      const R = L.map(p => [C[0] + k * (p[0] - C[0]), C[1] + k * (p[1] - C[1])]);
      if (!iqRelInTile(L) || !iqRelInTile(R) || !iqRelDisjoint(L, R)) continue;
      const item = iqRelItem('homothety', fill, { o: iqAdvPt5(O), k, L: iqRelRound(L), R: iqRelRound(R) });
      if (!iqAdvInTile(item.o, 5) || item.L.some(p => iqAdvDist(item.o, p) < 14)) continue;
      if (otherCentre ? iqRelHomothetyDeviations(item).some(d => d < 8) : !iqRelHomothetyHolds(item)) continue;
      return item;
    }
  }
  return null;
}
function iqRelHomothetyDeviations(item){                               // per vertex: angle between the rays O->original and O->image
  return item.L.map((p, i) => Math.abs(iqAdvNorm180(iqAdvAngle(item.o, item.R[i]) - iqAdvAngle(item.o, p))));
}
function iqRelHomothetyHolds(item){
  return item.L.every((p, i) => {
    const dl = iqAdvDist(item.o, p), dr = iqAdvDist(item.o, item.R[i]);
    return dl >= 12 && Math.abs(dr / dl - item.k) <= IQ_REL_RAY_RATIO_TOL * item.k && Math.abs(iqAdvNorm180(iqAdvAngle(item.o, item.R[i]) - iqAdvAngle(item.o, p))) <= IQ_REL_RAY_ANGLE_TOL;
  });
}

// ----- 2x2 pattern replaced by copies of itself -----
// every pattern of 2 or 3 of the 4 cells of a 2x2 block (6 + 4); a quarter-turn of a copy always changes it
const IQ_REL_PATTERNS = (() => {
  const cells = [[0, 0], [1, 0], [0, 1], [1, 1]], out = [];
  for (let m = 1; m < 16; m++){ const pat = cells.filter((_, i) => m & (1 << i)); if (pat.length === 2 || pat.length === 3) out.push(pat); }
  return out;
})();
const iqRelTurnCell = ([x, y], cw) => (cw ? [1 - y, x] : [y, 1 - x]);        // a quarter-turn of one cell inside a 2x2 block
function iqRelReplace(pattern, copyTurn){                                  // copyTurn: null | 'cw' | 'ccw'
  const copy = copyTurn ? pattern.map(c => iqRelTurnCell(c, copyTurn === 'cw')) : pattern;
  const out = [];
  pattern.forEach(([bx, by]) => copy.forEach(([x, y]) => out.push([bx * 2 + x, by * 2 + y])));
  return out;
}
const iqRelCellKey = cells => cells.map(c => c[0] + ',' + c[1]).sort().join(';');
function iqRelGenSelfReplace(){
  for (let attempt = 0; attempt < 200; attempt++){
    const patterns = shuffle(IQ_REL_PATTERNS.map(p => p.map(c => c.slice()))).slice(0, 4);
    if (!iqAdvNoLone(patterns.map(p => p.length))) continue;                                  // the number of filled cells must not single out a picture
    const fill = pickOne(IQ_REL_FILLS), oddIndex = randInt(0, 3), turn = Math.random() < 0.5 ? 'cw' : 'ccw';
    const items = patterns.map((pat, i) => iqRelItem('grid', fill, { L: pat, R: iqRelReplace(pat, i === oddIndex ? turn : null) }));
    return { items, oddIndex, family: 'relation', variant: 'self-replace', structureKey: 'relation:self-replace', explanation: iqRelVariant('self-replace').explanation };
  }
  throw new Error('iqRelGenSelfReplace: no valid question.');
}

// ----- question generators -----
function iqRelBuild(def, makeItems){
  for (let attempt = 0; attempt < 60; attempt++){
    const oddIndex = randInt(0, 3), fill = pickOne(IQ_REL_FILLS), items = makeItems(oddIndex, fill);
    if (!items || items.some(it => !it)) continue;
    const result = { items, oddIndex, family: 'relation', variant: def.key, structureKey: 'relation:' + def.key, explanation: def.explanation };
    if (iqRelVerify(result)) return result;
  }
  throw new Error('iqRelBuild: no valid question for "' + def.key + '".');
}
function iqRelGenerate(def){
  if (def.key === 'self-replace') return iqRelGenSelfReplace();
  if (def.key === 'mirror-diag') return iqRelBuild(def, (oddIndex, fill) => [0, 1, 2, 3].map(i => iqRelMirrorOne(fill, i === oddIndex)));
  if (def.key === 'double-mirror') return iqRelBuild(def, (oddIndex, fill) => [0, 1, 2, 3].map(i => iqRelDoubleOne(fill, Math.random() < 0.5 ? -1 : 1, i === oddIndex)));
  if (def.key === 'homothety'){
    const k = pickOne(IQ_REL_HOMOTHETY_K);
    return iqRelBuild(def, (oddIndex, fill) => [0, 1, 2, 3].map(i => iqRelHomothetyOne(fill, k, i === oddIndex)));
  }
  if (def.key === 'hull-bbox'){
    return iqRelBuild(def, (oddIndex, fill) => {
      const rectAt = pickOne([0, 1, 2, 3].filter(i => i !== oddIndex));
      return [0, 1, 2, 3].map(i => {
        if (i === oddIndex){
          for (let t = 0; t < 40; t++){
            const star = iqRelStar(randInt(5, 7), 10, 17);
            if (!star) continue;
            const hullArea = iqOddPolyArea(iqAdvHull(star.poly)), box = iqAdvBBoxRect(star.poly);
            if (iqOddPolyArea(box) / hullArea < 1.35) continue;
            return iqRelHullOne(fill, star, 'bbox');
          }
          return null;
        }
        const star = i === rectAt ? iqRelRectStar(iqAdvRand(12, 17), iqAdvRand(10, 15)) : iqRelStar(randInt(5, 7), 10, 17);
        return star && iqRelHullOne(fill, star, 'hull');
      });
    });
  }
  // hull-missing
  return iqRelBuild(def, (oddIndex, fill) => [0, 1, 2, 3].map(i => {
    for (let t = 0; t < 60; t++){
      const k = i === oddIndex ? randInt(6, 7) : randInt(5, 7);
      const star = i === oddIndex ? iqRelStar(k, 10, 15, { index: randInt(0, k - 1), radius: iqAdvRand(19, 22) }) : iqRelStar(k, 10, 17);
      if (!star) continue;
      if (i === oddIndex){
        const pr = iqRelProtrusions(star.tips).slice().sort((a, b) => b - a);
        if (pr[0] < 9 || pr[0] < 1.7 * pr[1]) continue;
      }
      return iqRelHullOne(fill, star, i === oddIndex ? 'missing' : 'hull');
    }
    return null;
  }));
}

// ----- rendering -----
function iqRelRender(item){
  let out = '';
  if (item.figure === 'grid'){
    const draw = (cells, size, x0, y0, n) => {
      let s = '';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){
        const on = cells.some(c => c[0] === x && c[1] === y);
        s += iqAdvRectEl(item, x0 + x * size, y0 + y * size, size, size, on ? item.fill : '#ffffff', on ? IQ_ADV_INK : '#c9c9d8', on ? 1.6 : 1);
      }
      return s;
    };
    out += draw(item.L, 11, 6, 39, 2) + draw(item.R, 14, 36, 22, 4);
    return iqAdvSvg(item, out);
  }
  if (item.figure === 'mirror') out += iqAdvLineEl(item, item.line[0], item.line[1], IQ_ADV_INK, 2, '5 4');
  if (item.figure === 'double') item.lines.forEach(l => { out += iqAdvLineEl(item, l.p[0], l.p[1], l.c, 2); });
  if (item.figure === 'homothety'){
    const o = item.o;
    out += iqAdvLineEl(item, [o[0] - 4.5, o[1]], [o[0] + 4.5, o[1]], IQ_ADV_INK, 2.2) + iqAdvLineEl(item, [o[0], o[1] - 4.5], [o[0], o[1] + 4.5], IQ_ADV_INK, 2.2);
  }
  out += iqAdvPolyEl(item, item.L, '#ffffff', IQ_ADV_INK) + iqAdvPolyEl(item, item.R, item.fill, IQ_ADV_INK);
  return iqAdvSvg(item, out);
}

// ----- verification -----
function iqRelHullHolds(item){                                           // is the image the hull of the original, moved by some vector?
  const H = iqAdvHull(item.L);
  if (H.length !== item.R.length) return false;
  return item.R.some(r => { const dx = r[0] - H[0][0], dy = r[1] - H[0][1]; return iqAdvSetsMatch(H.map(p => [p[0] + dx, p[1] + dy]), item.R, IQ_REL_HULL_TOL); });
}
function iqRelBoxHolds(item){
  const B = iqAdvBBoxRect(item.L);
  return item.R.length === 4 && item.R.some(r => { const dx = r[0] - B[0][0], dy = r[1] - B[0][1]; return iqAdvSetsMatch(B.map(p => [p[0] + dx, p[1] + dy]), item.R, IQ_REL_HULL_TOL); });
}
function iqRelLineOf(l){ return [l.p[0], iqAdvAngle(l.p[0], l.p[1])]; }
function iqRelItemShape(item, def){
  if (!item || item.kind !== 'relation' || item.size !== 100 || !Number.isFinite(item.strokeWidth) || typeof item.fill !== 'string') return false;
  const pt = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const poly = P => Array.isArray(P) && P.length >= 3 && P.every(pt);
  if (def.key === 'self-replace'){
    const cells = (C, n) => Array.isArray(C) && C.every(c => Array.isArray(c) && c.length === 2 && c.every(v => Number.isInteger(v) && v >= 0 && v < n));
    return item.figure === 'grid' && cells(item.L, 2) && cells(item.R, 4) && (item.L.length === 2 || item.L.length === 3) && item.R.length === item.L.length * item.L.length;
  }
  if (!poly(item.L) || !poly(item.R) || !iqRelInTile(item.L) || !iqRelInTile(item.R)) return false;
  if (def.key === 'mirror-diag') return item.figure === 'mirror' && Array.isArray(item.line) && item.line.length === 2 && item.line.every(pt);
  if (def.key === 'double-mirror') return item.figure === 'double' && Array.isArray(item.lines) && item.lines.length === 2 && item.lines.every(l => l && typeof l.c === 'string' && Array.isArray(l.p) && l.p.length === 2 && l.p.every(pt)) && iqRelDisjoint(item.L, item.R);
  if (def.key === 'homothety') return item.figure === 'homothety' && pt(item.o) && IQ_REL_HOMOTHETY_K.includes(item.k) && item.L.length === item.R.length && iqRelDisjoint(item.L, item.R);
  return item.figure === 'hull' && iqAdvSimplePoly(item.L);
}
function iqRelVerify(result){
  const def = iqRelVariant(result.variant);
  if (!def || !Array.isArray(result.items) || result.items.length !== 4) return false;
  if (!result.items.every(it => iqRelItemShape(it, def))) return false;
  const items = result.items, odd = items[result.oddIndex], normals = items.filter((_, i) => i !== result.oddIndex);
  if (items.some(it => it.fill !== items[0].fill)) return false;
  if (def.key === 'mirror-diag'){
    const reflected = it => it.L.map(p => iqAdvReflect(p, it.line[0], iqAdvAngle(it.line[0], it.line[1])));
    if (!iqOddExactlyOneBreaks(result, it => iqAdvSetsMatch(reflected(it), it.R, IQ_REL_MIRROR_TOL))) return false;
    // the odd image differs clearly in outline, and no original is near-symmetric (so a turned image cannot pass for a mirror image)
    return iqAdvXor(reflected(odd), odd.R) >= 0.3 && items.every(it => iqAdvAsymmetry(it.L) >= 0.12);
  }
  if (def.key === 'double-mirror'){
    const image = (it, redFirst) => {
      const [b, r] = [iqRelLineOf(it.lines[0]), iqRelLineOf(it.lines[1])];
      const refl = (poly, ln) => poly.map(p => iqAdvReflect(p, ln[0], ln[1]));
      return redFirst ? refl(refl(it.L, r), b) : refl(refl(it.L, b), r);
    };
    const matches = (it, redFirst) => iqAdvSetsMatch(image(it, redFirst), it.R, IQ_REL_DOUBLE_TOL);
    if (!iqOddExactlyOneBreaks(result, it => matches(it, false))) return false;
    if (!matches(odd, true) || iqAdvXor(image(odd, false), odd.R) < 0.3) return false;   // the odd picture is exactly the reversed order, and visibly not the right one
    if (items.some(it => iqRelLineOf(it.lines[0])[1] === iqRelLineOf(it.lines[1])[1])) return false;
    if (items.some(it => it.lines[0].c !== IQ_REL_BLUE || it.lines[1].c !== IQ_REL_RED)) return false;
    // which way the image turned (clockwise or not) must not point at one picture
    const dir = items.map(it => { const s = Math.sign(iqAdvNorm180(2 * (iqRelLineOf(it.lines[1])[1] - iqRelLineOf(it.lines[0])[1]))); return it === odd ? -s : s; });
    return iqAdvNoLone(dir);
  }
  if (def.key === 'hull-bbox'){
    if (!iqOddExactlyOneBreaks(result, iqRelHullHolds)) return false;
    if (!iqRelBoxHolds(odd) || iqOddPolyArea(odd.R) / iqOddPolyArea(iqAdvHull(odd.L)) < 1.3) return false;
    const rect = it => it.R.length === 4 && iqAdvHull(it.R).length === 4 && it.R.every((p, i) => { const q = it.R[(i + 1) % 4]; return Math.abs(p[0] - q[0]) <= 0.8 || Math.abs(p[1] - q[1]) <= 0.8; });
    const flags = items.map(rect);
    if (!iqAdvNoLone(flags) || flags.filter(Boolean).length !== 2) return false;           // "the image is a rectangle" holds for exactly two pictures: no cue
    return iqAdvNoLone(items.map(it => it.R.length));
  }
  if (def.key === 'hull-missing'){
    if (!iqOddExactlyOneBreaks(result, iqRelHullHolds)) return false;
    const H = iqAdvHull(odd.L), pr = iqRelProtrusions(H), big = pr.indexOf(Math.max(...pr)), sorted = pr.slice().sort((a, b) => b - a);
    if (sorted[0] < 9 || sorted[0] < 1.7 * sorted[1]) return false;
    // the odd image is the hull of every tip but the most protruding one
    const rest = iqAdvHull(H.filter((_, i) => i !== big));
    const fits = odd.R.some(r => { const dx = r[0] - rest[0][0], dy = r[1] - rest[0][1]; return iqAdvSetsMatch(rest.map(p => [p[0] + dx, p[1] + dy]), odd.R, IQ_REL_HULL_TOL); });
    return fits && iqAdvNoLone(items.map(it => it.R.length)) && items.every(it => iqAdvHull(it.L).length === it.L.length / 2);
  }
  if (def.key === 'homothety'){
    const k = items[0].k;
    if (!items.every(it => it.k === k)) return false;
    if (!iqOddExactlyOneBreaks(result, iqRelHomothetyHolds)) return false;
    return iqRelHomothetyDeviations(odd).every(d => d >= 7);
  }
  // self-replace
  const correct = it => iqRelCellKey(iqRelReplace(it.L, null));
  if (!iqOddExactlyOneBreaks(result, it => iqRelCellKey(it.R) === correct(it))) return false;
  if (new Set(items.map(it => iqRelCellKey(it.L))).size !== 4 || !iqAdvNoLone(items.map(it => it.L.length))) return false;
  const k = iqRelCellKey(odd.R);
  return k === iqRelCellKey(iqRelReplace(odd.L, 'cw')) || k === iqRelCellKey(iqRelReplace(odd.L, 'ccw'));
}

iqOddRegisterFamily({
  key: 'relation',
  minTier: 4,
  enabled: true,
  largeTiles: true,                                                        // detailed drawings: 120px tiles on wide screens (see css/iq.css)
  generate: tier => iqOddPickVariant('relation', tier).generate(tier),
  verify: result => iqRelVerify(result),
  render: item => iqRelRender(item)
});
iqOddRegisterVariants('relation', IQ_REL_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqRelGenerate(def) })));
