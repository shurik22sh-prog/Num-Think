'use strict';

/* ============ Odd one out: movement & spatial relations (family 'motion') ============ */
// Three pictures obey one movement rule, one does not. Two kinds of picture:
//   tokens  hollow circle = BEFORE, filled circle of the same colour = AFTER (a star and/or a dashed
//           mirror line are drawn where the rule needs them);
//   maze    a 5x5 grid: dark cells are walls, the blue circle starts, the star is the goal.
// Variants (all registered ENABLED):
//   rot-same      every circle turns about the star by the same angle; in the odd picture one turns differently
//   rot-centre    every circle turns a quarter-turn about the star; in the odd picture the turn is about another point
//   mirror-swap   every filled circle is the mirror image of the hollow one of its colour; in the odd picture two images are swapped
//   mirror-offset every circle is mirrored in the dashed line; in the odd picture one is mirrored in a nearby parallel line
//   maze-short    the shortest way from start to goal has the same length in three mazes; the odd maze is 2 steps shorter or longer
//   maze-long     same, with longer ways (a hidden shortcut makes the odd maze 2 steps shorter)
// The verifier recomputes every rule from the stored coordinates / cells only.

const IQ_MOVE_MARGIN = 11.5, IQ_MOVE_MIN_DIST = 15, IQ_MOVE_R = 7, IQ_MOVE_SW = 2.5, IQ_MOVE_STAR = 9.5;
const IQ_MOVE_RAD_TOL = 1.8, IQ_MOVE_TURN_TOL = 6, IQ_MOVE_MIRROR_TOL = 1.8;
const IQ_MOVE_GRID = 5, IQ_MOVE_CELL = 16, IQ_MOVE_ORIGIN = 10;
const IQ_MOVE_MIRROR_ANGLES = [20, 35, 55, 70, 110, 125, 145, 160];

const IQ_MOVE_VARIANTS = [
  { key: 'rot-same',      minTier: 4, tokens: true, explanation: 'בשלוש הצורות כל שלושת העיגולים מסתובבים סביב הכוכב באותה זווית. בצורה שנבחרה אחד העיגולים מסתובב בזווית אחרת.' },
  { key: 'mirror-swap',   minTier: 4, tokens: true, explanation: 'בשלוש הצורות כל עיגול מלא הוא השתקפות של העיגול הריק באותו צבע בקו המקווקו. בצורה שנבחרה התמונות של שני צבעים הוחלפו.' },
  { key: 'rot-centre',    minTier: 5, tokens: true, explanation: 'בשלוש הצורות הכוכב הוא מרכז הסיבוב. בצורה שנבחרה העיגולים מסתובבים באותה זווית, אבל סביב נקודה אחרת.' },
  { key: 'mirror-offset', minTier: 5, tokens: true, explanation: 'בשלוש הצורות כל העיגולים משתקפים בקו המקווקו. בצורה שנבחרה אחד העיגולים משתקף בקו אחר, מקביל וקרוב.' },
  { key: 'maze-short',    minTier: 5, tokens: false, walls: 8, length: 9,  oddLengths: [7, 11] },
  { key: 'maze-long',     minTier: 6, tokens: false, walls: 9, length: 11, oddLengths: [9] }
];
const iqMoveVariant = key => IQ_MOVE_VARIANTS.find(v => v.key === key);

// ----- rotation pictures -----
// per circle: change of its distance from the star, and the turn (degrees, clockwise) it makes about the star
function iqMoveRotStats(item){
  return item.tokens.map(t => ({ dR: Math.abs(iqAdvDist(item.star, t.to) - iqAdvDist(item.star, t.from)), turn: iqAdvNorm180(iqAdvAngle(item.star, t.to) - iqAdvAngle(item.star, t.from)) }));
}
const iqMoveAngDiff = (a, b) => Math.abs(iqAdvNorm180(a - b));
function iqMoveTokenMarks(item){
  const marks = [];
  item.tokens.forEach(t => { marks.push(t.from, t.to); });
  if (item.star) marks.push(item.star);
  return marks;
}
// the three circles sit at clearly different distances from the star and in clearly different directions (checked on the stored, rounded numbers)
function iqMoveRotationSpread(item){
  const r = item.tokens.map(t => iqAdvDist(item.star, t.from)).sort((a, b) => a - b), a = item.tokens.map(t => iqAdvAngle(item.star, t.from));
  return r[1] - r[0] >= 5.5 && r[2] - r[1] >= 5.5 && [0, 1, 2].every(k => iqMoveAngDiff(a[k], a[(k + 1) % 3]) >= 38);
}
function iqMoveMarksOk(marks){ return marks.every(p => iqAdvInTile(p, IQ_MOVE_MARGIN)) && iqAdvMinDist(marks) >= IQ_MOVE_MIN_DIST; }

// three values in [lo, hi], in random order, at least `gap` apart
function iqMoveSpread3(lo, hi, gap){
  for (let t = 0; t < 50; t++){
    const a = iqAdvRand(lo, hi - 2 * gap), b = a + iqAdvRand(gap, (hi - a) / 2 + gap / 2), c = b + iqAdvRand(gap, Math.max(gap, hi - b));
    if (c <= hi && b - a >= gap && c - b >= gap) return shuffle([a, b, c]);
  }
  return shuffle([lo, lo + gap + 0.5, lo + 2 * gap + 1]);
}
// three directions (degrees), each pair at least `gap` apart, in random order
function iqMoveAngles3(gap){
  const a = iqAdvRand(0, 360), b = a + iqAdvRand(gap, 360 - 2 * gap), c = b + iqAdvRand(gap, 360 - gap - (b - a));
  return shuffle([a, b, c].map(v => v % 360));
}
// builds one rotation picture. turns[k] is circle k's turn about `centreOf(star)` (default: the star itself).
function iqMovePlaceRotation(turns, colors, centreOf, tries){
  for (let attempt = 0; attempt < (tries || 300); attempt++){
    const star = [iqAdvRand(30, 70), iqAdvRand(30, 70)];
    const rads = iqMoveSpread3(18, centreOf ? 34 : 38, 6), angs = iqMoveAngles3(42);                  // distinct distances and directions: no one circle stands out by position
    const centre = centreOf ? centreOf(star) : star;
    const tokens = [0, 1, 2].map(k => {
      const from = [star[0] + rads[k] * Math.cos(angs[k] * IQ_ADV_RAD), star[1] + rads[k] * Math.sin(angs[k] * IQ_ADV_RAD)];
      return { c: colors[k], from: iqAdvPt5(from), to: iqAdvPt5(iqAdvRot(from, centre, turns[k])) };
    });
    const item = { kind: 'motion', figure: 'tokens', size: 100, strokeWidth: IQ_MOVE_SW, star: iqAdvPt5(star), mirror: null, tokens };
    if (!iqMoveMarksOk(iqMoveTokenMarks(item)) || !iqMoveRotationSpread(item)) continue;
    if (centreOf){
      const st = iqMoveRotStats(item);
      if (!st.every((s, k) => s.dR >= 6 && iqMoveAngDiff(s.turn, turns[k]) >= 14)) continue;      // every circle visibly misses the star
    }
    return item;
  }
  return null;
}

// ----- mirror pictures -----
function iqMovePlaceMirror(mode, colors, pair, swapIt, shiftIdx){
  for (let attempt = 0; attempt < 400; attempt++){
    const q = [iqAdvRand(38, 62), iqAdvRand(38, 62)], deg = pickOne(IQ_MOVE_MIRROR_ANGLES), t = deg * IQ_ADV_RAD;
    const u = [Math.cos(t), Math.sin(t)], n = [-Math.sin(t), Math.cos(t)];
    const at = (al, off) => [q[0] + al * u[0] + off * n[0], q[1] + al * u[1] + off * n[1]];
    const toks = [0, 1, 2].map(() => ({ al: iqAdvRand(-36, 36), off: iqAdvRand(10, 30) * (Math.random() < 0.5 ? -1 : 1) }));
    if (mode === 'swap'){
      const dd = iqAdvRand(10, 26), sg = Math.random() < 0.5 ? -1 : 1;
      toks[pair[0]].off = sg * dd; toks[pair[1]].off = sg * dd;                                    // the two swapped colours sit at the same distance, same side
      if (Math.abs(toks[pair[0]].al - toks[pair[1]].al) < 30) continue;
    }
    const from = toks.map(k => at(k.al, k.off));
    const to = toks.map(k => at(k.al, -k.off));
    if (swapIt){ const tmp = to[pair[0]]; to[pair[0]] = to[pair[1]]; to[pair[1]] = tmp; }
    if (shiftIdx !== undefined && shiftIdx !== null){
      const k = toks[shiftIdx], delta = 13 * (Math.random() < 0.5 ? -1 : 1);
      to[shiftIdx] = at(k.al, 2 * delta - k.off);                                                  // mirrored in a parallel line `delta` away
    }
    const tokens = [0, 1, 2].map(k => ({ c: colors[k], from: iqAdvPt5(from[k]), to: iqAdvPt5(to[k]) }));
    const item = { kind: 'motion', figure: 'tokens', size: 100, strokeWidth: IQ_MOVE_SW, star: null, mirror: iqAdvClipLine(q, deg).map(iqAdvPt5), tokens };
    if (iqMoveMarksOk(iqMoveTokenMarks(item))) return item;
  }
  return null;
}
const iqMoveMirrorDeg = item => iqAdvAngle(item.mirror[0], item.mirror[1]);
const iqMoveMirrorErr = (item, t) => iqAdvDist(iqAdvReflect(t.from, item.mirror[0], iqMoveMirrorDeg(item)), t.to);

// ----- mazes -----
const iqMoveCellKey = (x, y) => x + ',' + y;
function iqMoveMazeSolve(walls, s, e){
  const blocked = new Set(walls.map(w => iqMoveCellKey(w[0], w[1])));
  const dist = new Map([[iqMoveCellKey(s[0], s[1]), 0]]), ways = new Map([[iqMoveCellKey(s[0], s[1]), 1]]), queue = [s];
  for (let qi = 0; qi < queue.length; qi++){
    const [x, y] = queue[qi], d = dist.get(iqMoveCellKey(x, y));
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = iqMoveCellKey(nx, ny);
      if (nx < 0 || ny < 0 || nx >= IQ_MOVE_GRID || ny >= IQ_MOVE_GRID || blocked.has(k)) return;
      if (!dist.has(k)){ dist.set(k, d + 1); ways.set(k, ways.get(iqMoveCellKey(x, y))); queue.push([nx, ny]); }
      else if (dist.get(k) === d + 1) ways.set(k, ways.get(k) + ways.get(iqMoveCellKey(x, y)));
    });
  }
  const ek = iqMoveCellKey(e[0], e[1]);
  return dist.has(ek) ? { length: dist.get(ek), ways: ways.get(ek) } : null;
}
const IQ_MOVE_D4 = [([x, y]) => [x, y], ([x, y]) => [4 - y, x], ([x, y]) => [4 - x, 4 - y], ([x, y]) => [y, 4 - x], ([x, y]) => [4 - x, y], ([x, y]) => [y, x], ([x, y]) => [x, 4 - y], ([x, y]) => [4 - y, 4 - x]];
const IQ_MOVE_MAZE_CACHE = {};
const iqMoveMazeKey = m => m.walls.map(w => iqMoveCellKey(w[0], w[1])).sort().join(';') + '|' + m.s + '|' + m.e;
// a lazily built pool of mazes with `walls` walls whose shortest way is `length` steps
function iqMoveMazePool(walls, length){
  const key = walls + ':' + length;
  if (IQ_MOVE_MAZE_CACHE[key]) return IQ_MOVE_MAZE_CACHE[key];
  const pool = [], seen = new Set();
  for (let attempt = 0; attempt < 400000 && pool.length < 60; attempt++){
    const cells = shuffle(Array.from({ length: 25 }, (_, i) => [i % 5, Math.floor(i / 5)]));
    const s = cells[0], e = cells[1], w = cells.slice(2, 2 + walls);
    if (Math.abs(s[0] - e[0]) + Math.abs(s[1] - e[1]) < 3) continue;
    const sol = iqMoveMazeSolve(w, s, e);
    if (!sol || sol.length !== length) continue;
    const m = { walls: w, s, e };
    const canon = IQ_MOVE_D4.map(f => { const t = { walls: w.map(f), s: f(s), e: f(e) }; return iqMoveMazeKey(t); }).sort()[0];
    if (seen.has(canon)) continue;
    seen.add(canon); pool.push(m);
  }
  if (pool.length < 12) throw new Error('iqMoveMazePool: could not build mazes for ' + key);
  IQ_MOVE_MAZE_CACHE[key] = pool;
  return pool;
}
function iqMovePickMaze(walls, length){
  const m = pickOne(iqMoveMazePool(walls, length)), f = pickOne(IQ_MOVE_D4);
  return { kind: 'motion', figure: 'maze', size: 100, strokeWidth: IQ_MOVE_SW, walls: m.walls.map(f), s: f(m.s), e: f(m.e) };
}
function iqMoveMazeStats(item){
  const sol = iqMoveMazeSolve(item.walls, item.s, item.e);
  return { length: sol ? sol.length : -1, ways: sol ? sol.ways : 0, manhattan: Math.abs(item.s[0] - item.e[0]) + Math.abs(item.s[1] - item.e[1]) };
}

// ----- generation -----
function iqMoveGenRotSame(){
  const colors = shuffle(IQ_ADV_TRIO.slice());
  for (let attempt = 0; attempt < 200; attempt++){
    const oddIndex = randInt(0, 3), set = [90, 180, -90];
    const normalTurns = [0, 1, 2].map(() => pickOne(set));
    if (new Set(normalTurns).size < 2) continue;                                                    // the three normals do not all turn alike
    const base = pickOne(set), other = pickOne(set.filter(v => v !== base)), odd = [base, base, base];
    odd[randInt(0, 2)] = other;
    let n = 0;
    const items = [0, 1, 2, 3].map(i => {
      if (i === oddIndex) return iqMovePlaceRotation(odd, colors);
      const t = normalTurns[n++];
      return iqMovePlaceRotation([t, t, t], colors);
    });
    if (items.some(it => !it)) continue;
    return { items, oddIndex, family: 'motion', variant: 'rot-same', structureKey: 'motion:rot-same', explanation: iqMoveVariant('rot-same').explanation };
  }
  throw new Error('iqMoveGenRotSame: no valid question.');
}
function iqMoveGenRotCentre(){
  const colors = shuffle(IQ_ADV_TRIO.slice()), turn = pickOne([90, -90]);
  for (let attempt = 0; attempt < 200; attempt++){
    const oddIndex = randInt(0, 3);
    const offset = () => (Math.random() < 0.5 ? -1 : 1) * iqAdvRand(12, 18);
    const items = [0, 1, 2, 3].map(i => {
      const it = iqMovePlaceRotation([turn, turn, turn], colors, i === oddIndex ? (s => [s[0] + offset(), s[1] + offset()]) : null, i === oddIndex ? 6000 : 300);   // the odd picture has the most constraints
      if (it) it.turn = turn;
      return it;
    });
    if (items.some(it => !it)) continue;
    return { items, oddIndex, family: 'motion', variant: 'rot-centre', structureKey: 'motion:rot-centre', explanation: iqMoveVariant('rot-centre').explanation };
  }
  throw new Error('iqMoveGenRotCentre: no valid question.');
}
function iqMoveGenMirror(mode){
  const colors = shuffle(IQ_ADV_TRIO.slice()), pair = shuffle([0, 1, 2]).slice(0, 2).sort();
  for (let attempt = 0; attempt < 200; attempt++){
    const oddIndex = randInt(0, 3), shiftIdx = randInt(0, 2);
    const items = [0, 1, 2, 3].map(i => mode === 'swap'
      ? iqMovePlaceMirror('swap', colors, pair, i === oddIndex)
      : iqMovePlaceMirror('plain', colors, pair, false, i === oddIndex ? shiftIdx : null));
    if (items.some(it => !it)) continue;
    if (mode === 'swap') items.forEach(it => { it.pair = pair; });
    const key = mode === 'swap' ? 'mirror-swap' : 'mirror-offset';
    return { items, oddIndex, family: 'motion', variant: key, structureKey: 'motion:' + key, explanation: iqMoveVariant(key).explanation };
  }
  throw new Error('iqMoveGenMirror: no valid question.');
}
function iqMoveGenMaze(def){
  for (let attempt = 0; attempt < 300; attempt++){
    const oddIndex = randInt(0, 3), oddLength = pickOne(def.oddLengths);
    const items = [0, 1, 2, 3].map(i => iqMovePickMaze(def.walls, i === oddIndex ? oddLength : def.length));
    const keys = items.map(it => iqMoveMazeKey(it));
    if (new Set(keys).size !== 4) continue;
    const st = items.map(iqMoveMazeStats);
    if (!iqAdvNoLone(st.map(s => s.manhattan)) || !iqAdvNoLone(st.map(s => s.ways))) continue;      // no side measurement points at one maze
    const explanation = 'בשלושת המבוכים הדרך הקצרה ביותר מהעיגול אל הכוכב היא ' + def.length + ' צעדים. במבוך שנבחר היא ' + oddLength + ' צעדים.';
    return { items, oddIndex, family: 'motion', variant: def.key, structureKey: 'motion:' + def.key, explanation };
  }
  throw new Error('iqMoveGenMaze: no valid question for "' + def.key + '".');
}
function iqMoveGenerate(def){
  if (def.key === 'rot-same') return iqMoveGenRotSame();
  if (def.key === 'rot-centre') return iqMoveGenRotCentre();
  if (def.key === 'mirror-swap') return iqMoveGenMirror('swap');
  if (def.key === 'mirror-offset') return iqMoveGenMirror('offset');
  return iqMoveGenMaze(def);
}

// ----- rendering -----
function iqMoveRender(item){
  if (item.figure === 'maze'){
    const k = (item.size || 100) / 100, c = IQ_MOVE_CELL, o = IQ_MOVE_ORIGIN, side = c * IQ_MOVE_GRID;
    let out = iqAdvRectEl(item, o, o, side, side, '#ffffff', IQ_ADV_INK, 2);
    for (let i = 1; i < IQ_MOVE_GRID; i++){
      out += iqAdvLineEl(item, [o + i * c, o], [o + i * c, o + side], '#c9c9d8', 1);
      out += iqAdvLineEl(item, [o, o + i * c], [o + side, o + i * c], '#c9c9d8', 1);
    }
    item.walls.forEach(w => { out += iqAdvRectEl(item, o + w[0] * c, o + w[1] * c, c, c, '#3d3d5c', '#3d3d5c', 1); });
    const centre = cell => [o + (cell[0] + 0.5) * c, o + (cell[1] + 0.5) * c];
    out += iqAdvCircleEl(item, centre(item.s), 6, '#0072B2', IQ_ADV_INK);
    out += iqAdvStarEl(item, centre(item.e), 8.5, '#F0B400');
    return iqAdvSvg(item, out);
  }
  let out = '';
  if (item.mirror) out += iqAdvLineEl(item, item.mirror[0], item.mirror[1], IQ_ADV_INK, 2, '5 4');
  if (item.star) out += iqAdvStarEl(item, item.star, IQ_MOVE_STAR, '#F0B400');
  item.tokens.forEach(t => {
    out += iqAdvCircleEl(item, t.from, IQ_MOVE_R, '#ffffff', t.c);
    out += iqAdvCircleEl(item, t.to, IQ_MOVE_R, t.c, IQ_ADV_INK);
  });
  return iqAdvSvg(item, out);
}

// ----- verification (recomputes the rule from the stored data) -----
function iqMoveItemShape(item, def){
  if (!item || item.kind !== 'motion' || item.size !== 100) return false;
  if (!Number.isFinite(item.strokeWidth)) return false;
  const pt = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  if (!def.tokens){
    const cell = c => Array.isArray(c) && c.length === 2 && c.every(v => Number.isInteger(v) && v >= 0 && v < IQ_MOVE_GRID);
    if (item.figure !== 'maze' || !Array.isArray(item.walls) || item.walls.length !== def.walls || !item.walls.every(cell) || !cell(item.s) || !cell(item.e)) return false;
    const keys = new Set(item.walls.map(w => iqMoveCellKey(w[0], w[1])));
    return keys.size === def.walls && !keys.has(iqMoveCellKey(item.s[0], item.s[1])) && !keys.has(iqMoveCellKey(item.e[0], item.e[1])) && iqMoveCellKey(item.s[0], item.s[1]) !== iqMoveCellKey(item.e[0], item.e[1]);
  }
  if (item.figure !== 'tokens' || !Array.isArray(item.tokens) || item.tokens.length !== 3) return false;
  if (!item.tokens.every(t => t && typeof t.c === 'string' && pt(t.from) && pt(t.to))) return false;
  const wantsStar = def.key === 'rot-same' || def.key === 'rot-centre';
  if (wantsStar ? !pt(item.star) : item.star !== null) return false;
  if (wantsStar && !iqMoveRotationSpread(item)) return false;
  if (!wantsStar && !(Array.isArray(item.mirror) && item.mirror.length === 2 && item.mirror.every(pt))) return false;
  return iqMoveMarksOk(iqMoveTokenMarks(item));
}
function iqMoveVerify(result){
  const def = iqMoveVariant(result.variant);
  if (!def || !Array.isArray(result.items) || result.items.length !== 4) return false;
  if (!result.items.every(it => iqMoveItemShape(it, def))) return false;
  const items = result.items, odd = items[result.oddIndex], normals = items.filter((_, i) => i !== result.oddIndex);
  if (def.key === 'rot-same'){
    const turnsOf = it => iqMoveRotStats(it).map(s => s.turn);
    const holds = it => {
      const st = iqMoveRotStats(it), t = st.map(s => s.turn);
      return st.every(s => s.dR <= IQ_MOVE_RAD_TOL) && iqMoveAngDiff(t[0], t[1]) <= IQ_MOVE_TURN_TOL && iqMoveAngDiff(t[0], t[2]) <= IQ_MOVE_TURN_TOL;
    };
    if (!iqOddExactlyOneBreaks(result, holds)) return false;
    if (!items.every(it => iqMoveRotStats(it).every(s => s.dR <= IQ_MOVE_RAD_TOL))) return false;       // every circle keeps its distance from the star, odd or not
    const q = [90, 180, -90];
    if (!items.every(it => turnsOf(it).every(t => q.some(v => iqMoveAngDiff(t, v) <= IQ_MOVE_TURN_TOL)))) return false;
    const nt = normals.map(it => Math.round(turnsOf(it)[0] / 90) * 90);
    if (new Set(nt.map(v => ((v % 360) + 360) % 360)).size < 2) return false;
    const ot = turnsOf(odd);
    const lone = [0, 1, 2].filter(k => { const r = [0, 1, 2].filter(j => j !== k); return iqMoveAngDiff(ot[r[0]], ot[r[1]]) <= IQ_MOVE_TURN_TOL && r.every(j => iqMoveAngDiff(ot[j], ot[k]) >= 60); });
    return lone.length === 1;
  }
  if (def.key === 'rot-centre'){
    const turn = items[0].turn;
    if (!(turn === 90 || turn === -90) || !items.every(it => it.turn === turn)) return false;
    const holds = it => iqMoveRotStats(it).every(s => s.dR <= IQ_MOVE_RAD_TOL && iqMoveAngDiff(s.turn, turn) <= IQ_MOVE_TURN_TOL);
    if (!iqOddExactlyOneBreaks(result, holds)) return false;
    if (!iqMoveRotStats(odd).every(s => s.dR >= 5.5 && iqMoveAngDiff(s.turn, turn) >= 12)) return false;
    // the odd picture is still ONE rigid quarter-turn - about a point other than the star
    const t = turn * IQ_ADV_RAD, c = Math.cos(t), s = Math.sin(t);
    const centreFrom = tk => {                       // (I - R) C = to - R from
      const a = 1 - c, b = s, det = a * a + b * b, rx = c * tk.from[0] - s * tk.from[1], ry = s * tk.from[0] + c * tk.from[1];
      const vx = tk.to[0] - rx, vy = tk.to[1] - ry;
      return [(a * vx + b * vy) / det, (-b * vx + a * vy) / det];
    };
    const centres = odd.tokens.map(centreFrom);
    if (centres.some(p => iqAdvDist(p, centres[0]) > 1.8)) return false;
    return iqAdvDist(centres[0], odd.star) >= 11;
  }
  if (def.key === 'mirror-swap'){
    const holds = it => it.tokens.every(t => iqMoveMirrorErr(it, t) <= IQ_MOVE_MIRROR_TOL);
    if (!iqOddExactlyOneBreaks(result, holds)) return false;
    const pair = items[0].pair;
    if (!Array.isArray(pair) || pair.length !== 2 || !items.every(it => it.pair && it.pair[0] === pair[0] && it.pair[1] === pair[1])) return false;
    // in every picture the two swapped colours sit at the same distance from the line, on the same side
    if (!items.every(it => { const a = iqAdvSideDist(it.tokens[pair[0]].from, it.mirror[0], iqMoveMirrorDeg(it)), b = iqAdvSideDist(it.tokens[pair[1]].from, it.mirror[0], iqMoveMirrorDeg(it)); return Math.abs(a - b) <= 1.5 && a * b > 0; })) return false;
    // the odd picture keeps the SET of images (only the colours are exchanged)
    const imgs = odd.tokens.map(t => iqAdvReflect(t.from, odd.mirror[0], iqMoveMirrorDeg(odd)));
    if (!iqAdvSetsMatch(imgs, odd.tokens.map(t => t.to), IQ_MOVE_MIRROR_TOL)) return false;
    const bad = odd.tokens.map((t, k) => (iqMoveMirrorErr(odd, t) > IQ_MOVE_MIRROR_TOL ? k : -1)).filter(k => k >= 0);
    return bad.length === 2 && bad[0] === pair[0] && bad[1] === pair[1];
  }
  if (def.key === 'mirror-offset'){
    const holds = it => it.tokens.every(t => iqMoveMirrorErr(it, t) <= IQ_MOVE_MIRROR_TOL);
    if (!iqOddExactlyOneBreaks(result, holds)) return false;
    const errs = odd.tokens.map(t => iqMoveMirrorErr(odd, t)), bad = errs.filter(e => e > IQ_MOVE_MIRROR_TOL);
    if (bad.length !== 1 || bad[0] < 20) return false;
    const t = odd.tokens[errs.findIndex(e => e > IQ_MOVE_MIRROR_TOL)], deg = iqMoveMirrorDeg(odd);
    const seg = iqAdvAngle(t.from, t.to), perp = Math.abs(Math.abs(iqAdvNorm180(seg - deg)) - 90);            // the displaced image is still straight across the line
    return perp <= 4;
  }
  // mazes: three equal shortest-way lengths, the odd one differs by two steps
  const stats = items.map(iqMoveMazeStats);
  if (stats.some(s => s.length < 0)) return false;
  if (!iqOddExactlyOneBreaks(result, it => iqMoveMazeStats(it).length === def.length)) return false;
  if (!def.oddLengths.includes(stats[result.oddIndex].length)) return false;
  if (new Set(items.map(iqMoveMazeKey)).size !== 4) return false;
  return iqAdvNoLone(stats.map(s => s.manhattan)) && iqAdvNoLone(stats.map(s => s.ways));
}

iqOddRegisterFamily({
  key: 'motion',
  minTier: 4,
  enabled: true,
  largeTiles: true,                                                        // detailed drawings: 120px tiles on wide screens (see css/iq.css)
  generate: tier => iqOddPickVariant('motion', tier).generate(tier),
  verify: result => iqMoveVerify(result),
  render: item => iqMoveRender(item)
});
iqOddRegisterVariants('motion', IQ_MOVE_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqMoveGenerate(def) })));
