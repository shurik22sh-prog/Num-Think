'use strict';

/* ============ Odd one out: assembly & disassembly (family 'assembly') ============ */
// Figures made of unit cells. Three pictures obey one rule about folding, taking away or fitting
// pieces, one does not. Variants (all registered ENABLED):
//   cube-net      six cells that fold into a closed cube; the odd picture does not fold
//   remove-sym-v  take away the starred piece and what is left is mirror-symmetric (always about a vertical axis); the odd leftover is not
//   remove-sym    the same, with the axis of symmetry varying (vertical, horizontal or diagonal)
//   tiling        three tetromino pieces fit exactly into the 12-cell body; in the odd picture they cannot
// The verifier recomputes every rule (folding by rolling a die, symmetry by testing reflections,
// tilings by exhaustive search) from the stored cells only.

const IQ_ASM_VARIANTS = [
  { key: 'cube-net',     minTier: 4, explanation: 'בשלוש הצורות אפשר לקפל את המשבצות לקובייה סגורה. בצורה שנבחרה אי אפשר – שתי משבצות נופלות על אותה פאה.' },
  { key: 'remove-sym-v', minTier: 4, explanation: 'בשלוש הצורות, אם מורידים את החלק המסומן בכוכב, מה שנשאר סימטרי. בצורה שנבחרה מה שנשאר אינו סימטרי.' },
  { key: 'remove-sym',   minTier: 5, explanation: 'בשלוש הצורות, אם מורידים את החלק המסומן בכוכב, מה שנשאר סימטרי בציר כלשהו. בצורה שנבחרה מה שנשאר אינו סימטרי.' },
  { key: 'tiling',       minTier: 6, explanation: 'בשלוש הצורות שלושת החלקים מתרצפים בדיוק לגוף. בצורה שנבחרה אי אפשר לרצף את הגוף בחלקים האלה.' }
];
const iqAsmVariant = key => IQ_ASM_VARIANTS.find(v => v.key === key);
const IQ_ASM_FILLS = ['#8EC5FF', '#9EE0B8', '#D8B4F8', '#FFB3A7'];                    // no yellow: the starred piece is yellow
const IQ_ASM_MARK = '#F0B400';
const iqAsmKey = c => c[0] + ',' + c[1];
const iqAsmSet = cells => new Set(cells.map(iqAsmKey));
const iqAsmSortYX = cells => cells.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const iqAsmNeighbours = ([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];

// ----- polyomino helpers -----
let IQ_ASM_HEXOMINOES = null;
function iqAsmHexominoes(){                                              // the 35 free hexominoes, each one normalised
  if (IQ_ASM_HEXOMINOES) return IQ_ASM_HEXOMINOES;
  let level = new Map([[iqOddFigCanon([[0, 0]]), [[0, 0]]]]);
  for (let n = 2; n <= 6; n++){
    const next = new Map();
    level.forEach(cells => {
      const have = iqAsmSet(cells);
      cells.forEach(c => iqAsmNeighbours(c).forEach(nb => {
        if (have.has(iqAsmKey(nb))) return;
        const grown = iqOddFigNormalize(cells.concat([nb])), key = iqOddFigCanon(grown);
        if (!next.has(key)) next.set(key, grown);
      }));
    });
    level = next;
  }
  IQ_ASM_HEXOMINOES = [...level.values()];
  return IQ_ASM_HEXOMINOES;
}
function iqAsmHas2x2(cells){
  const s = iqAsmSet(cells);
  return cells.some(([x, y]) => s.has(iqAsmKey([x + 1, y])) && s.has(iqAsmKey([x, y + 1])) && s.has(iqAsmKey([x + 1, y + 1])));
}
// does the net fold into a cube? Roll a die over the cells; every cell must land a different face.
function iqAsmFoldsToCube(cells){
  if (cells.length !== 6 || iqAsmHas2x2(cells)) return false;
  const have = iqAsmSet(cells), seen = new Set(), bottoms = [];
  const roll = (d, dx, dy) => {
    if (dx === 1) return { b: d.e, e: d.t, t: d.w, w: d.b, n: d.n, s: d.s };
    if (dx === -1) return { b: d.w, w: d.t, t: d.e, e: d.b, n: d.n, s: d.s };
    if (dy === -1) return { b: d.n, n: d.t, t: d.s, s: d.b, e: d.e, w: d.w };
    return { b: d.s, s: d.t, t: d.n, n: d.b, e: d.e, w: d.w };
  };
  const visit = (c, d) => {
    seen.add(iqAsmKey(c)); bottoms.push(d.b);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nb = [c[0] + dx, c[1] + dy];
      if (have.has(iqAsmKey(nb)) && !seen.has(iqAsmKey(nb))) visit(nb, roll(d, dx, dy));
    });
  };
  visit(cells[0], { b: 0, t: 1, n: 2, s: 3, e: 4, w: 5 });
  return seen.size === 6 && new Set(bottoms).size === 6;
}
function iqAsmLongestRun(cells){
  const s = iqAsmSet(cells);
  let best = 1;
  cells.forEach(([x, y]) => [[1, 0], [0, 1]].forEach(([dx, dy]) => {
    if (s.has(iqAsmKey([x - dx, y - dy]))) return;
    let n = 1;
    while (s.has(iqAsmKey([x + dx * n, y + dy * n]))) n++;
    best = Math.max(best, n);
  }));
  return best;
}
const iqAsmFrame = cells => { const b = iqAdvBBox(cells); return [b.x1 - b.x0 + 1, b.y1 - b.y0 + 1].sort().join('x'); };
const iqAsmRandomOrient = cells => iqOddFigNormalize(cells.map(pickOne(iqOddFigD4)));
// a piece shown at most two cells tall, so three pieces fit one under the other in the column beside the body
const iqAsmWideOrient = cells => pickOne(iqOddFigD4.map(f => iqOddFigNormalize(cells.map(f))).filter(o => Math.max(...o.map(c => c[1])) <= 1));

// reflections of a cell set inside a 5x5 frame: the four axis families, every position
function iqAsmReflections(){
  const out = [];
  for (let a = 0; a <= 8; a++){
    out.push({ kind: 'V', f: ([x, y]) => [a - x, y] });
    out.push({ kind: 'H', f: ([x, y]) => [x, a - y] });
  }
  for (let t = -4; t <= 4; t++) out.push({ kind: 'D', f: ([x, y]) => [y + t, x - t] });
  for (let t = 0; t <= 8; t++) out.push({ kind: 'A', f: ([x, y]) => [t - y, t - x] });
  return out;
}
const IQ_ASM_REFLECTIONS = iqAsmReflections();
// symmetric difference of the set and its image under each reflection; the symmetries are those with 0
function iqAsmMismatches(cells){
  const s = iqAsmSet(cells);
  return IQ_ASM_REFLECTIONS.map(r => {
    const img = cells.map(r.f), is = iqAsmSet(img);
    let d = 0;
    img.forEach(c => { if (!s.has(iqAsmKey(c))) d++; });
    cells.forEach(c => { if (!is.has(iqAsmKey(c))) d++; });
    return { kind: r.kind, d };
  });
}
const iqAsmSymmetryKinds = cells => [...new Set(iqAsmMismatches(cells).filter(m => m.d === 0).map(m => m.kind))];
const iqAsmAsymmetry = cells => Math.min(...iqAsmMismatches(cells).map(m => m.d));

// ----- 12-cell figures with a removable L-tromino -----
const IQ_ASM_L_TROMINOES = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]]];
function iqAsmGrowSet(n, symmetry){                                    // random edge-connected n-cell set inside the 5x5 frame (symmetric under `symmetry` when given)
  const inFrame = c => c[0] >= 0 && c[1] >= 0 && c[0] <= 4 && c[1] <= 4;
  const orbit = c => { const o = symmetry ? [c, symmetry(c)] : [c]; return o.filter((p, i) => inFrame(p) && o.findIndex(q => iqAsmKey(q) === iqAsmKey(p)) === i); };
  for (let attempt = 0; attempt < 300; attempt++){
    const cells = [], have = new Set();
    const addOrbit = c => { const fresh = orbit(c).filter(p => !have.has(iqAsmKey(p))); fresh.forEach(p => { have.add(iqAsmKey(p)); cells.push(p); }); return fresh.length; };
    addOrbit([randInt(0, 4), randInt(0, 4)]);
    for (let guard = 0; cells.length < n && guard < 80; guard++){
      const nb = pickOne(iqAsmNeighbours(pickOne(cells)));
      if (!inFrame(nb) || cells.length + orbit(nb).filter(p => !have.has(iqAsmKey(p))).length > n) continue;
      addOrbit(nb);
    }
    if (cells.length === n && iqOddFigValid(cells)) return cells;
  }
  return null;
}
const IQ_ASM_AXES = { V: ([x, y]) => [4 - x, y], H: ([x, y]) => [x, 4 - y], D: ([x, y]) => [y, x], A: ([x, y]) => [4 - y, 4 - x] };
function iqAsmWithPiece(rest){                                          // attach an L-tromino so that the 12 cells form one figure with no reflection symmetry
  const have = iqAsmSet(rest), options = [];
  IQ_ASM_L_TROMINOES.forEach(shape => {
    for (let ox = 0; ox <= 3; ox++) for (let oy = 0; oy <= 3; oy++){
      const piece = shape.map(([x, y]) => [x + ox, y + oy]);
      if (piece.some(c => have.has(iqAsmKey(c)))) continue;
      if (!piece.some(c => iqAsmNeighbours(c).some(nb => have.has(iqAsmKey(nb))))) continue;
      const all = rest.concat(piece);
      if (!iqOddFigValid(all) || iqAsmSymmetryKinds(all).length) continue;
      options.push(piece);
    }
  });
  return options.length ? pickOne(options) : null;
}
function iqAsmRemovalItem(rest, piece, fill){
  const cells = rest.concat(piece);
  return { kind: 'assembly', figure: 'removal', size: 100, strokeWidth: 2, fill, cells: cells.map(c => c.slice()), marked: piece.map(c => c.slice()) };
}
function iqAsmGenRemoval(def){
  const axisKinds = def.key === 'remove-sym-v' ? ['V'] : ['V', 'H', 'D', 'A'];
  for (let attempt = 0; attempt < 120; attempt++){
    const oddIndex = randInt(0, 3), fill = pickOne(IQ_ASM_FILLS), items = [];
    let ok = true;
    for (let i = 0; i < 4 && ok; i++){
      let item = null;
      for (let t = 0; t < 60 && !item; t++){
        if (i === oddIndex){
          const rest = iqAsmGrowSet(9, null);
          if (!rest || iqAsmAsymmetry(rest) < 6 || iqAsmFrame(rest) === '1x1') continue;
          const piece = iqAsmWithPiece(rest);
          if (piece) item = iqAsmRemovalItem(rest, piece, fill);
        } else {
          const kind = pickOne(axisKinds), rest = iqAsmGrowSet(9, IQ_ASM_AXES[kind]);
          if (!rest || !iqAsmSymmetryKinds(rest).length) continue;
          const b = iqAdvBBox(rest);
          if (b.x1 - b.x0 < 2 || b.y1 - b.y0 < 2) continue;
          const piece = iqAsmWithPiece(rest);
          if (piece) item = iqAsmRemovalItem(rest, piece, fill);
        }
      }
      if (!item) ok = false; else items.push(item);
    }
    if (!ok) continue;
    const result = { items, oddIndex, family: 'assembly', variant: def.key, structureKey: 'assembly:' + def.key, explanation: def.explanation };
    if (iqAsmVerify(result)) return result;
  }
  throw new Error('iqAsmGenRemoval: no valid question for "' + def.key + '".');
}

// ----- cube nets -----
function iqAsmNetPools(){
  const all = iqAsmHexominoes(), nets = all.filter(iqAsmFoldsToCube);
  const flat = all.filter(c => !iqAsmFoldsToCube(c) && !iqAsmHas2x2(c) && iqAsmLongestRun(c) <= 4);       // no block and no line of five to give it away
  return { nets, flat };
}
function iqAsmGenNet(def){
  const pools = iqAsmNetPools();
  for (let attempt = 0; attempt < 200; attempt++){
    const oddIndex = randInt(0, 3), fill = pickOne(IQ_ASM_FILLS), chosen = shuffle(pools.nets.slice()).slice(0, 3);
    let n = 0;
    const items = [0, 1, 2, 3].map(i => {
      const cells = i === oddIndex ? pickOne(pools.flat) : chosen[n++];
      return { kind: 'assembly', figure: 'net', size: 100, strokeWidth: 2, fill, cells: iqAsmRandomOrient(cells) };
    });
    const result = { items, oddIndex, family: 'assembly', variant: def.key, structureKey: 'assembly:' + def.key, explanation: def.explanation };
    if (iqAsmVerify(result)) return result;
  }
  throw new Error('iqAsmGenNet: no valid question.');
}

// ----- tilings -----
const IQ_ASM_TETROS = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]], L: [[0, 0], [0, 1], [0, 2], [1, 2]]
};
const IQ_ASM_TETRO_CANON = (() => { const m = {}; Object.keys(IQ_ASM_TETROS).forEach(k => { m[iqOddFigCanon(IQ_ASM_TETROS[k])] = k; }); return m; })();
const iqAsmTetroType = cells => IQ_ASM_TETRO_CANON[iqOddFigCanon(cells)] || null;
function iqAsmOrientations(cells){
  const seen = new Map();
  iqOddFigD4.forEach(f => { const o = iqAsmSortYX(iqOddFigNormalize(cells.map(f))); seen.set(o.map(iqAsmKey).join(';'), o); });
  return [...seen.values()];
}
// can these pieces (turning and flipping allowed) cover the body exactly?
function iqAsmTileable(body, pieces){
  const orient = pieces.map(iqAsmOrientations), have = iqAsmSet(body), order = iqAsmSortYX(body), covered = new Set(), used = pieces.map(() => false);
  if (pieces.reduce((s, p) => s + p.length, 0) !== body.length) return false;
  const go = () => {
    const first = order.find(c => !covered.has(iqAsmKey(c)));
    if (!first) return true;
    for (let i = 0; i < pieces.length; i++){
      if (used[i]) continue;
      for (const o of orient[i]){
        const dx = first[0] - o[0][0], dy = first[1] - o[0][1], placed = o.map(c => [c[0] + dx, c[1] + dy]);
        if (!placed.every(c => have.has(iqAsmKey(c)) && !covered.has(iqAsmKey(c)))) continue;
        used[i] = true; placed.forEach(c => covered.add(iqAsmKey(c)));
        if (go()) return true;
        used[i] = false; placed.forEach(c => covered.delete(iqAsmKey(c)));
      }
    }
    return false;
  };
  return go();
}
// a checkerboard argument: the pieces cover a fixed number of dark cells (the T covers 1 or 3), so a body with another count is trivially impossible
function iqAsmParityFeasible(body, types){
  const dark = body.filter(c => (c[0] + c[1]) % 2 === 0).length;
  const fixed = types.filter(t => t !== 'T').length * 2, hasT = types.includes('T');
  return hasT ? (dark === fixed + 1 || dark === fixed + 3) : dark === fixed;
}
let IQ_ASM_BODIES = null;
function iqAsmBodies(){                                                  // every valid 12-cell body in a 4x4 frame (4 cells removed)
  if (IQ_ASM_BODIES) return IQ_ASM_BODIES;
  const all = Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)]), out = [];
  for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) for (let c = b + 1; c < 16; c++) for (let d = c + 1; d < 16; d++){
    const body = all.filter((_, i) => i !== a && i !== b && i !== c && i !== d);
    if (iqOddFigValid(body)) out.push(body);
  }
  IQ_ASM_BODIES = out;
  return out;
}
const IQ_ASM_TILE_CACHE = {};
function iqAsmTilingSplit(types){                                         // bodies that tile with these three pieces / that do not (but pass the parity argument)
  const key = types.slice().sort().join('');
  if (IQ_ASM_TILE_CACHE[key]) return IQ_ASM_TILE_CACHE[key];
  const pieces = types.map(t => IQ_ASM_TETROS[t]), yes = [], no = [];
  iqAsmBodies().forEach(b => {
    if (iqAsmTileable(b, pieces)) yes.push(b);
    else if (iqAsmParityFeasible(b, types)) no.push(b);
  });
  IQ_ASM_TILE_CACHE[key] = { yes, no };
  return IQ_ASM_TILE_CACHE[key];
}
const iqAsmPerimeter = cells => iqOddFigPerimeter(cells);
function iqAsmGenTiling(def){
  const typeNames = Object.keys(IQ_ASM_TETROS);
  const triples = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) triples.push([typeNames[a], typeNames[b], typeNames[c]]);
  for (let attempt = 0; attempt < 300; attempt++){
    const oddIndex = randInt(0, 3), sets = [0, 1, 2, 3].map(() => shuffle(pickOne(triples).slice()));
    const colors = shuffle(IQ_ADV_TRIO.slice());
    const items = [];
    let ok = true;
    for (let i = 0; i < 4 && ok; i++){
      const split = iqAsmTilingSplit(sets[i]), pool = i === oddIndex ? split.no : split.yes;
      if (!pool.length){ ok = false; break; }
      items.push({
        kind: 'assembly', figure: 'tiling', size: 100, strokeWidth: 1.6,
        body: pickOne(pool).map(c => c.slice()),
        pieces: sets[i].map((t, k) => ({ cells: iqAsmWideOrient(IQ_ASM_TETROS[t]), color: colors[k] }))
      });
    }
    if (!ok) continue;
    const result = { items, oddIndex, family: 'assembly', variant: def.key, structureKey: 'assembly:' + def.key, explanation: def.explanation };
    if (iqAsmVerify(result)) return result;
  }
  throw new Error('iqAsmGenTiling: no valid question.');
}
function iqAsmGenerate(def){
  if (def.key === 'cube-net') return iqAsmGenNet(def);
  if (def.key === 'tiling') return iqAsmGenTiling(def);
  return iqAsmGenRemoval(def);
}

// ----- rendering -----
function iqAsmDrawCells(item, cells, cs, x0, y0, fill, stroke, sw){
  return cells.map(([x, y]) => iqAdvRectEl(item, x0 + x * cs, y0 + y * cs, cs, cs, fill, stroke, sw)).join('');
}
function iqAsmRender(item){
  let out = '';
  if (item.figure === 'net'){
    const b = iqAdvBBox(item.cells), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, cs = 16;
    out += iqAsmDrawCells(item, item.cells.map(c => [c[0] - b.x0, c[1] - b.y0]), cs, 50 - w * cs / 2, 50 - h * cs / 2, item.fill, IQ_ADV_INK, 2);
  } else if (item.figure === 'removal'){
    const b = iqAdvBBox(item.cells), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, cs = 16, x0 = 50 - w * cs / 2, y0 = 50 - h * cs / 2;
    const marked = iqAsmSet(item.marked), shift = c => [c[0] - b.x0, c[1] - b.y0];
    out += iqAsmDrawCells(item, item.cells.filter(c => !marked.has(iqAsmKey(c))).map(shift), cs, x0, y0, item.fill, IQ_ADV_INK, 2);
    item.marked.map(shift).forEach(c => {
      const centre = [x0 + (c[0] + 0.5) * cs, y0 + (c[1] + 0.5) * cs];
      out += iqAdvRectEl(item, x0 + c[0] * cs, y0 + c[1] * cs, cs, cs, IQ_ASM_MARK, IQ_ADV_INK, 2) + iqAdvStarEl(item, centre, 5.5, IQ_ADV_INK);
    });
  } else {
    out += iqAsmDrawCells(item, item.body, 11, 5, 28, '#cfd8e8', IQ_ADV_INK, 1.6);
    const ys = [12, 40, 68];
    item.pieces.forEach((p, k) => {
      const b = iqAdvBBox(p.cells), w = b.x1 - b.x0 + 1, cs = 9;
      out += iqAsmDrawCells(item, p.cells.map(c => [c[0] - b.x0, c[1] - b.y0]), cs, 75 - w * cs / 2, ys[k], p.color, IQ_ADV_INK, 1.4);
    });
  }
  return iqAdvSvg(item, out);
}

// ----- verification -----
function iqAsmCells(C, lo, hi){
  return Array.isArray(C) && C.length > 0 && C.every(c => Array.isArray(c) && c.length === 2 && c.every(v => Number.isInteger(v) && v >= lo && v <= hi)) && iqAsmSet(C).size === C.length;
}
function iqAsmVerify(result){
  const def = iqAsmVariant(result.variant);
  if (!def || !Array.isArray(result.items) || result.items.length !== 4) return false;
  const items = result.items, odd = items[result.oddIndex];
  if (!items.every(it => it && it.kind === 'assembly' && it.size === 100 && Number.isFinite(it.strokeWidth))) return false;
  if (def.key === 'cube-net'){
    if (!items.every(it => it.figure === 'net' && iqAsmCells(it.cells, 0, 5) && it.cells.length === 6 && iqOddFigValid(it.cells))) return false;
    if (!iqOddExactlyOneBreaks(result, it => iqAsmFoldsToCube(it.cells))) return false;
    if (iqAsmHas2x2(odd.cells) || iqAsmLongestRun(odd.cells) > 4) return false;                    // no "block" or "line of five" tell-tale
    const canon = items.map(it => iqOddFigCanon(it.cells));
    if (new Set(canon).size !== 4) return false;
    return iqAdvNoLone(items.map(it => iqAsmFrame(it.cells))) && iqAdvNoLone(items.map(it => iqAsmLongestRun(it.cells)));
  }
  if (def.key === 'tiling'){
    if (!items.every(it => it.figure === 'tiling' && iqAsmCells(it.body, 0, 3) && it.body.length === 12 && iqOddFigValid(it.body))) return false;
    if (!items.every(it => Array.isArray(it.pieces) && it.pieces.length === 3 && it.pieces.every(p => p && typeof p.color === 'string' && iqAsmCells(p.cells, 0, 3) && p.cells.length === 4 && iqAsmTetroType(p.cells)))) return false;
    const types = it => it.pieces.map(p => iqAsmTetroType(p.cells));
    if (!items.every(it => new Set(types(it)).size === 3)) return false;
    if (!iqOddExactlyOneBreaks(result, it => iqAsmTileable(it.body, it.pieces.map(p => p.cells)))) return false;
    if (!iqAsmParityFeasible(odd.body, types(odd))) return false;                                 // the odd body is not ruled out by counting dark cells
    const names = Object.keys(IQ_ASM_TETROS);
    return names.every(n => iqAdvNoLone(items.map(it => types(it).includes(n)))) && iqAdvNoLone(items.map(it => iqAsmPerimeter(it.body)));
  }
  // remove-sym / remove-sym-v
  if (!items.every(it => it.figure === 'removal' && iqAsmCells(it.cells, 0, 4) && it.cells.length === 12 && iqAsmCells(it.marked, 0, 4) && it.marked.length === 3 && iqOddFigValid(it.cells))) return false;
  const have = it => iqAsmSet(it.cells);
  if (!items.every(it => it.marked.every(c => have(it).has(iqAsmKey(c))))) return false;
  const isL = cells => { const b = iqAdvBBox(cells); return b.x1 - b.x0 === 1 && b.y1 - b.y0 === 1; };
  if (!items.every(it => isL(it.marked))) return false;
  const rest = it => { const m = iqAsmSet(it.marked); return it.cells.filter(c => !m.has(iqAsmKey(c))); };
  if (!iqOddExactlyOneBreaks(result, it => iqAsmSymmetryKinds(rest(it)).length > 0)) return false;
  if (!items.every(it => iqAsmSymmetryKinds(it.cells).length === 0)) return false;                  // the whole figure is never symmetric
  if (iqAsmAsymmetry(rest(odd)) < 6) return false;                                                  // the odd leftover is clearly not symmetric
  const normals = items.filter((_, i) => i !== result.oddIndex);
  if (def.key === 'remove-sym-v') return normals.every(it => iqAsmSymmetryKinds(rest(it)).includes('V'));
  return iqAdvNoLone(items.map(it => iqAsmFrame(it.cells)));
}

iqOddRegisterFamily({
  key: 'assembly',
  minTier: 4,
  enabled: true,
  largeTiles: true,                                                        // detailed drawings: 120px tiles on wide screens (see css/iq.css)
  generate: tier => iqOddPickVariant('assembly', tier).generate(tier),
  verify: result => iqAsmVerify(result),
  render: item => iqAsmRender(item)
});
iqOddRegisterVariants('assembly', IQ_ASM_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqAsmGenerate(def) })));
