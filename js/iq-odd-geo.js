'use strict';

/* ============ Odd one out (advanced families): shared geometry & drawing helpers ============ */
// Used by the four advanced families (motion, relation, assembly, combo). Pure helpers only:
// no family is registered here. Loaded after iq-visual.js (it reuses the shared polygon
// helpers declared there) and before the family files.
// Conventions: tile coordinates 0..100, y points DOWN, angles in degrees; a positive turn is
// CLOCKWISE as seen on screen. Stored coordinates sit on a half-unit grid (iqAdvR5), and every
// check that reads them back uses a tolerance that covers that rounding.

const IQ_ADV_INK = '#1a1a2e';
const IQ_ADV_TRIO = ['#D55E00', '#0072B2', '#009E73'];                    // colour-blind safe: vermillion, blue, bluish green
const IQ_ADV_QUAD = ['#D55E00', '#0072B2', '#009E73', '#F0E442'];         // + yellow, for the four-colour boards
const IQ_ADV_RAD = Math.PI / 180;

const iqAdvRand = (a, b) => a + Math.random() * (b - a);
const iqAdvR5 = v => Math.round(v * 2) / 2;
const iqAdvPt5 = p => [iqAdvR5(p[0]), iqAdvR5(p[1])];
const iqAdvDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const iqAdvInTile = (p, m) => p[0] >= m && p[0] <= 100 - m && p[1] >= m && p[1] <= 100 - m;
function iqAdvAngle(c, p){ return Math.atan2(p[1] - c[1], p[0] - c[0]) / IQ_ADV_RAD; }
function iqAdvNorm180(a){ while (a > 180) a -= 360; while (a <= -180) a += 360; return a; }
function iqAdvRot(p, c, deg){
  const t = deg * IQ_ADV_RAD, x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * Math.cos(t) - y * Math.sin(t), c[1] + x * Math.sin(t) + y * Math.cos(t)];
}
// mirror image of p in the line through q at angle `deg`
function iqAdvReflect(p, q, deg){
  const t = deg * IQ_ADV_RAD, ux = Math.cos(t), uy = Math.sin(t), x = p[0] - q[0], y = p[1] - q[1], dot = x * ux + y * uy;
  return [q[0] + 2 * dot * ux - x, q[1] + 2 * dot * uy - y];
}
// signed distance of p from the line through q at angle `deg` (positive on the clockwise-normal side)
function iqAdvSideDist(p, q, deg){
  const t = deg * IQ_ADV_RAD;
  return -(p[0] - q[0]) * Math.sin(t) + (p[1] - q[1]) * Math.cos(t);
}
// the infinite line through q at angle deg, clipped to the tile box
function iqAdvClipLine(q, deg){
  const t = deg * IQ_ADV_RAD, u = [Math.cos(t), Math.sin(t)];
  let lo = -1e9, hi = 1e9;
  for (let a = 0; a < 2; a++){
    if (Math.abs(u[a]) < 1e-9) continue;
    const t1 = (1.5 - q[a]) / u[a], t2 = (98.5 - q[a]) / u[a];            // the line stops just inside the tile, so its round ends are not cut off
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
  }
  return [[q[0] + u[0] * lo, q[1] + u[1] * lo], [q[0] + u[0] * hi, q[1] + u[1] * hi]];
}
function iqAdvMinDist(points){
  let m = Infinity;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) m = Math.min(m, iqAdvDist(points[i], points[j]));
  return m;
}

// ----- polygons -----
function iqAdvHull(points){                                                // convex hull (monotone chain), vertices only
  const P = points.map(p => p.slice()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()){ while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}
function iqAdvBBox(points){
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
const iqAdvBBoxRect = pts => { const b = iqAdvBBox(pts); return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]; };
function iqAdvMean(points){ return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length]; }
function iqAdvEdgeDist(p, poly){
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) m = Math.min(m, iqOddSegDist(p, poly[i], poly[(i + 1) % poly.length]));
  return m;
}
function iqAdvPointInPoly(p, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
// a simple polygon: no two non-adjacent edges cross
function iqAdvSimplePoly(poly){
  const n = poly.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++){
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    if (iqOddSegCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
  }
  return true;
}
// two vertex lists are the same set of points within `tol` (any order)
function iqAdvSetsMatch(P, Q, tol){
  if (P.length !== Q.length) return false;
  const used = new Array(Q.length).fill(false);
  const go = i => {
    if (i === P.length) return true;
    for (let j = 0; j < Q.length; j++){
      if (used[j] || iqAdvDist(P[i], Q[j]) > tol) continue;
      used[j] = true;
      if (go(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return go(0);
}
// largest distance from a vertex of P to the nearest vertex of Q (a one-sided mismatch)
const iqAdvMismatch = (P, Q) => Math.max(...P.map(p => Math.min(...Q.map(q => iqAdvDist(p, q)))));
// share of polygon A's area that lies in exactly one of A, B (sampled on a grid; 0 = identical outlines)
function iqAdvXor(A, B, step){
  step = step || 1.5;
  const all = A.concat(B), box = iqAdvBBox(all);
  let diff = 0, area = 0;
  for (let y = box.y0 + step / 2; y < box.y1; y += step) for (let x = box.x0 + step / 2; x < box.x1; x += step){
    const a = iqAdvPointInPoly([x, y], A), b = iqAdvPointInPoly([x, y], B);
    if (a) area++;
    if (a !== b) diff++;
  }
  return area ? diff / area : 1;
}
// how far a polygon is from being mirror-symmetric: the smallest XOR share against its own reflection over axes through its centre
function iqAdvAsymmetry(poly){
  const c = iqAdvMean(poly);
  let best = Infinity;
  for (let a = 0; a < 180; a += 10) best = Math.min(best, iqAdvXor(poly, poly.map(p => iqAdvReflect(p, c, a)), 2.5));
  return best;
}
// a random star-shaped polygon about the origin: vertex radii between rMin and rMax, consecutive angles at least `gap` apart
function iqAdvBlob(nv, rMin, rMax, gap){
  const slack = 360 - nv * gap;
  if (slack < 0) return null;
  for (let attempt = 0; attempt < 40; attempt++){
    const w = Array.from({ length: nv }, () => -Math.log(1 - Math.random())), total = w.reduce((s, v) => s + v, 0);
    let a = Math.random() * 360;
    const poly = w.map(v => { const r = iqAdvRand(rMin, rMax), p = [r * Math.cos(a * IQ_ADV_RAD), r * Math.sin(a * IQ_ADV_RAD)]; a += gap + slack * v / total; return p; });
    if (iqAdvSimplePoly(poly)) return poly;
  }
  return null;
}
const iqAdvShift = (poly, dx, dy) => poly.map(p => [p[0] + dx, p[1] + dy]);

// ----- helper for "an alternative rule that points at the wrong option" -----
// If exactly three of the four values are equal, the lone different one is singled out by that
// measurement alone. Returns its index, or -1 when no option is isolated.
function iqAdvLone(values){
  const keys = values.map(v => JSON.stringify(v));
  for (let i = 0; i < 4; i++){
    const rest = keys.filter((_, j) => j !== i);
    if (rest.every(k => k === rest[0]) && keys[i] !== rest[0]) return i;
  }
  return -1;
}
// true when a measurement is harmless: it isolates no option
const iqAdvNoLone = values => iqAdvLone(values) === -1;

// ----- SVG pieces (coordinates scaled by the item's size/100) -----
const iqAdvF = v => (+v).toFixed(1);
function iqAdvSvg(item, inner){
  const size = item.size || 100;
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}
function iqAdvPolyEl(item, pts, fill, stroke, extra){
  const k = (item.size || 100) / 100;
  return '<polygon points="' + pts.map(p => iqAdvF(p[0] * k) + ',' + iqAdvF(p[1] * k)).join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + item.strokeWidth + '" stroke-linejoin="round"' + (extra || '') + '/>';
}
function iqAdvCircleEl(item, c, r, fill, stroke, sw){
  const k = (item.size || 100) / 100;
  return '<circle cx="' + iqAdvF(c[0] * k) + '" cy="' + iqAdvF(c[1] * k) + '" r="' + iqAdvF(r * k) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (sw === undefined ? item.strokeWidth : sw) + '"/>';
}
function iqAdvLineEl(item, a, b, stroke, sw, dash){
  const k = (item.size || 100) / 100;
  return '<line x1="' + iqAdvF(a[0] * k) + '" y1="' + iqAdvF(a[1] * k) + '" x2="' + iqAdvF(b[0] * k) + '" y2="' + iqAdvF(b[1] * k) + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linecap="round"/>';
}
function iqAdvStarEl(item, c, R, fill){
  const pts = [];
  for (let i = 0; i < 10; i++){ const r = i % 2 ? R * 0.42 : R, a = (-90 + i * 36) * IQ_ADV_RAD; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return iqAdvPolyEl(item, pts, fill, IQ_ADV_INK);
}
function iqAdvRectEl(item, x, y, w, h, fill, stroke, sw){
  const k = (item.size || 100) / 100;
  return '<rect x="' + iqAdvF(x * k) + '" y="' + iqAdvF(y * k) + '" width="' + iqAdvF(w * k) + '" height="' + iqAdvF(h * k) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
}
