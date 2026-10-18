'use strict';
// Independent verifiers for the "odd one out" game. They read ONLY the rendered
// SVG strings of the four options (what the child actually sees) and re-derive
// the answer with test-side geometry. Nothing here imports or calls production
// code. Remaining shared assumptions are listed in run.js's report.

// ---------- SVG parsing (strict: unknown tags throw, so nothing is silently ignored) ----------
function parseSvg(str, allowed){
  allowed = allowed || ['svg', 'polygon', 'circle'];
  if (typeof str !== 'string') throw new Error('svg is not a string');
  if (/NaN|undefined|Infinity/.test(str)) throw new Error('svg contains NaN/undefined/Infinity: ' + str.slice(0, 80));
  const out = { viewBox: null, polygons: [], circles: [], tags: [] };
  const tagRe = /<(\/?)(\w+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(str))){
    if (m[1]) continue;
    const tag = m[2];
    out.tags.push(tag);
    if (!allowed.includes(tag)) throw new Error('unsupported svg tag <' + tag + '>');
    const a = {};
    const attrRe = /([\w:-]+)="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(m[3]))) a[am[1]] = am[2];
    if (tag === 'svg') out.viewBox = a.viewBox.trim().split(/\s+/).map(Number);
    else if (tag === 'polygon') out.polygons.push({
      pts: a.points.trim().split(/\s+/).map(p => p.split(',').map(Number)),
      fill: a.fill, stroke: a.stroke, strokeWidth: Number(a['stroke-width'])
    });
    else if (tag === 'circle') out.circles.push({ cx: +a.cx, cy: +a.cy, r: +a.r, fill: a.fill });
  }
  if (!out.viewBox || out.viewBox.length !== 4) throw new Error('svg without viewBox');
  out.center = [out.viewBox[0] + out.viewBox[2] / 2, out.viewBox[1] + out.viewBox[3] / 2];
  out.size = out.viewBox[2];
  return out;
}

// Inferred from the picture alone: circles => dot-count family; otherwise by vertex count.
function inferFamily(parsed4){
  const anyCircles = parsed4.some(p => p.circles.length > 0);
  if (anyCircles) return 'ratio';
  const n = parsed4[0].polygons[0].pts.length;
  if (parsed4.some(p => p.polygons.length !== 1 || p.polygons[0].pts.length !== n)) return 'unknown';
  if (n === 6) return 'orientation';
  if (n === 8) return 'symmetry';
  return 'unknown';
}

// ---------- small geometry ----------
const hyp = Math.hypot;
function rot90(pts, k, c){
  let p = pts;
  for (let i = 0; i < k; i++) p = p.map(([x, y]) => [c[0] - (y - c[1]), c[1] + (x - c[0])]);
  return p;
}
function mirrorX(pts, c){ return pts.map(([x, y]) => [2 * c[0] - x, y]); }
// Same polygon drawn: vertices coincide within tol (1:1) and every polygon edge maps to a polygon edge.
function samePolygon(A, B, tol){
  if (A.length !== B.length) return false;
  const n = A.length, used = new Set(), map = [];
  for (const a of A){
    let best = -1, bd = Infinity;
    B.forEach((b, j) => { const d = hyp(a[0] - b[0], a[1] - b[1]); if (d < bd){ bd = d; best = j; } });
    if (bd > tol || used.has(best)) return false;
    used.add(best); map.push(best);
  }
  for (let i = 0; i < n; i++){
    const d = (map[i] - map[(i + 1) % n] + n) % n;
    if (d !== 1 && d !== n - 1) return false;
  }
  return true;
}
function pointInPolygon(x, y, pts){
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToSegment(px, py, [x1, y1], [x2, y2]){
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return hyp(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ---------- ORIENTATION: rotation classes ----------
// Options are "the same" if one is a rotation (multiple of 90 deg about the tile
// centre) of the other; a mirror image that is NOT a rotation is a different class.
function orientationAnalysis(parsed4){
  const c = parsed4[0].center, TOL = 0.3;
  const polys = parsed4.map(p => p.polygons[0].pts);
  const rotEq = (A, B) => [0, 1, 2, 3].some(k => samePolygon(rot90(A, k, c), B, TOL));
  const mirEq = (A, B) => [0, 1, 2, 3].some(k => samePolygon(rot90(mirrorX(A, c), k, c), B, TOL));
  const cls = [0, 1, 2, 3];
  const find = i => (cls[i] === i ? i : (cls[i] = find(cls[i])));
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (rotEq(polys[i], polys[j])) cls[find(j)] = find(i);
  const groups = {};
  for (let i = 0; i < 4; i++) (groups[find(i)] = groups[find(i)] || []).push(i);
  const classes = Object.values(groups);
  const sizes = classes.map(g => g.length).sort((a, b) => b - a);
  const unique = sizes.length === 2 && sizes[0] === 3 && sizes[1] === 1;
  let oddIndex = null, oddIsMirrorOfMajority = null;
  if (unique){
    oddIndex = classes.find(g => g.length === 1)[0];
    const maj = classes.find(g => g.length === 3)[0];
    oddIsMirrorOfMajority = mirEq(polys[maj], polys[oddIndex]);
  }
  return { sizes, unique, oddIndex, oddIsMirrorOfMajority, polys };
}
// Visual closeness: area of the symmetric difference of two filled polygons, as a
// fraction of one polygon's area (point sampling, 0.5-unit grid).
function xorFraction(A, B){
  const all = A.concat(B), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let inA = 0, diff = 0;
  for (let x = x0; x <= x1; x += 0.5) for (let y = y0; y <= y1; y += 0.5){
    const a = pointInPolygon(x, y, A), b = pointInPolygon(x, y, B);
    if (a) inA++;
    if (a !== b) diff++;
  }
  return diff / inA;
}
function orientationMinXor(polys){
  let min = Infinity;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) min = Math.min(min, xorFraction(polys[i], polys[j]));
  return min;
}

// ---------- RATIO: counts + placement geometry ----------
function ratioAnalysis(parsed4, rule){
  rule = rule || ((sides, dots) => dots === sides - 1);
  const items = parsed4.map(p => {
    const poly = p.polygons[0], sides = poly.pts.length, dots = p.circles.length;
    let minClear = Infinity, minSpacing = Infinity, allInside = true;
    for (const ci of p.circles){
      if (!pointInPolygon(ci.cx, ci.cy, poly.pts)) allInside = false;
      for (let k = 0; k < sides; k++){
        const d = distToSegment(ci.cx, ci.cy, poly.pts[k], poly.pts[(k + 1) % sides]);
        minClear = Math.min(minClear, d - ci.r - poly.strokeWidth / 2); // visible gap between dot and outline stroke
      }
    }
    for (let i = 0; i < p.circles.length; i++) for (let j = i + 1; j < p.circles.length; j++){
      const a = p.circles[i], b = p.circles[j];
      minSpacing = Math.min(minSpacing, hyp(a.cx - b.cx, a.cy - b.cy) - a.r - b.r);
    }
    const minR = p.circles.length ? Math.min(...p.circles.map(ci => ci.r)) : null;
    return { sides, dots, ok: rule(sides, dots), allInside, minClear, minSpacing, minR };
  });
  const bad = items.map((it, i) => (it.ok ? -1 : i)).filter(i => i >= 0);
  return { items, deviating: bad, unique: bad.length === 1, oddIndex: bad.length === 1 ? bad[0] : null };
}

// ---------- SYMMETRY: reflect about the 4 axes through the tile centre ----------
const AXES_DEG = [0, 45, 90, 135];
function blobAnalysis(poly, c){
  const info = poly.map(([x, y]) => ({ x, y, r: hyp(x - c[0], y - c[1]), a: Math.atan2(y - c[1], x - c[0]) }));
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const dev = {};
  for (const deg of AXES_DEG){
    const th = deg * Math.PI / 180;
    let worst = 0;
    for (const p of info){
      const ra = 2 * th - p.a, rx = c[0] + p.r * Math.cos(ra), ry = c[1] + p.r * Math.sin(ra);
      let q = info[0], bq = Infinity;
      for (const cand of info){ const d = Math.abs(wrap(ra - cand.a)); if (d < bq){ bq = d; q = cand; } }
      worst = Math.max(worst, hyp(rx - q.x, ry - q.y));
    }
    dev[deg] = worst;
  }
  return dev; // per axis: largest displacement (SVG units) between a reflected vertex and the real vertex there
}
function symmetryAnalysis(parsed4, tol){
  tol = tol == null ? 0.3 : tol; // coordinates are rounded to 0.1, so exact symmetry shows up to ~0.2
  const items = parsed4.map(p => {
    const dev = blobAnalysis(p.polygons[0].pts, p.center);
    const axes = AXES_DEG.filter(d => dev[d] <= tol);
    return { dev, axes, symmetric: axes.length > 0, margin: Math.min(...AXES_DEG.map(d => dev[d])), maxDevOnBestAxis: Math.min(...AXES_DEG.map(d => dev[d])) };
  });
  const bad = items.map((it, i) => (it.symmetric ? -1 : i)).filter(i => i >= 0);
  return { items, deviating: bad, unique: bad.length === 1, oddIndex: bad.length === 1 ? bad[0] : null };
}

// ---------- RENDERED margin, exact (integer tenths of a unit) ----------
// Independent of production: works from the PARSED SVG points (multiples of 0.1), reflects every
// vertex about each of the four axes through the tile centre, and finds the partner vertex from the
// geometry (a vertex at angle 45*i degrees reflects to angle 2*theta - 45*i). All arithmetic is integer,
// so comparing with 5 units (2500 tenths-squared) needs no tolerance.
function renderedAxisSq(pts, center){
  const cx = Math.round(center[0] * 10), cy = Math.round(center[1] * 10);
  const T = pts.map(([x, y]) => [Math.round(x * 10) - cx, Math.round(y * 10) - cy]);
  const out = {};
  for (const deg of AXES_DEG){
    const cs = Math.round(Math.cos(deg * Math.PI / 90)), sn = Math.round(Math.sin(deg * Math.PI / 90));  // cos/sin of 2*theta, exactly 0 or +-1
    let worst = 0;
    for (let i = 0; i < 8; i++){
      const j = (((deg / 22.5) - i) % 8 + 8) % 8;
      const [x, y] = T[i];
      const dx = (x * cs + y * sn) - T[j][0], dy = (x * sn - y * cs) - T[j][1];
      worst = Math.max(worst, dx * dx + dy * dy);
    }
    out[deg] = worst;
  }
  return out;
}
function renderedMarginSq(pts, center){ return Math.min(...Object.values(renderedAxisSq(pts, center))); }
const renderedMargin = (pts, center) => Math.sqrt(renderedMarginSq(pts, center)) / 10;

// ---------- feature sizes in on-screen pixels ----------
const PX = { phone: 43.2, desktop: 72 }; // measured SVG box inside the option button (60px / 84px tiles)
function featureSizes(parsed){
  const s = parsed.size, out = { strokeUnits: parsed.polygons[0].strokeWidth, minEdgeUnits: Infinity, minDotRadiusUnits: null };
  for (const poly of parsed.polygons) for (let k = 0; k < poly.pts.length; k++){
    const a = poly.pts[k], b = poly.pts[(k + 1) % poly.pts.length];
    out.minEdgeUnits = Math.min(out.minEdgeUnits, hyp(a[0] - b[0], a[1] - b[1]));
  }
  if (parsed.circles.length) out.minDotRadiusUnits = Math.min(...parsed.circles.map(c => c.r));
  out.scale = { phone: PX.phone / s, desktop: PX.desktop / s };
  return out;
}

module.exports = {
  parseSvg, inferFamily, rot90, mirrorX, samePolygon, pointInPolygon, distToSegment,
  orientationAnalysis, orientationMinXor, xorFraction, ratioAnalysis, symmetryAnalysis,
  blobAnalysis, renderedAxisSq, renderedMarginSq, renderedMargin, featureSizes, PX, AXES_DEG
};
