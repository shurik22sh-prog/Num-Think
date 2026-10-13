'use strict';

/* ============ Shared fraction math + rendering ============ */
// Every fraction game shares the same gcd/simplify/compare math and the same
// "what does a fraction look like" renderer, so there is exactly one source
// of truth for both.

function fracGcd(a, b){
  a = Math.abs(a); b = Math.abs(b);
  while (b){ const t = b; b = a % b; a = t; }
  return a || 1;
}

function fracSimplify(n, d){
  const g = fracGcd(n, d);
  return { n: n / g, d: d / g };
}

// Compares n1/d1 vs n2/d2 without floating point: -1 if left is smaller, 0 if equal, 1 if left is bigger.
function fracCompare(n1, d1, n2, d2){
  const l = n1 * d2, r = n2 * d1;
  return l === r ? 0 : (l < r ? -1 : 1);
}

// "Nice" denominators that read cleanly - used whenever a game needs a random proper fraction.
const FRAC_NICE_DENOMS = [2, 3, 4, 5, 6, 8, 10, 12];

function fracRandomProper(maxD){
  const pool = FRAC_NICE_DENOMS.filter(d => d <= (maxD || 12));
  const d = pickOne(pool);
  const n = randInt(1, d - 1);
  return { n, d };
}

// Renders a fraction the way it's written on paper: numerator on top, a
// fraction bar, denominator below - never "n/d" inline text. This is how a
// fraction VALUE is written everywhere in this section (the memory-match
// game additionally pairs it against a pizza-slice drawing - see below).
function fracRenderStacked(n, d, opts){
  opts = opts || {};
  const size = opts.size || 28;
  const color = opts.color || 'var(--ink)';
  return '<span class="frac-stack" style="font-size:' + size + 'px; color:' + color + ';">' +
    '<span class="frac-stack-num">' + n + '</span>' +
    '<span class="frac-stack-bar"></span>' +
    '<span class="frac-stack-den">' + d + '</span>' +
  '</span>';
}

/* ---- Pizza-slice drawing (equivalent-fractions memory game only) ---- */
function fracPolar(cx, cy, r, angle){
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function fracPieSlicePath(cx, cy, r, startAngle, endAngle){
  const start = fracPolar(cx, cy, r, startAngle);
  const end = fracPolar(cx, cy, r, endAngle);
  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
  return 'M ' + cx + ' ' + cy + ' L ' + start.x.toFixed(2) + ' ' + start.y.toFixed(2) +
    ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 1 ' + end.x.toFixed(2) + ' ' + end.y.toFixed(2) + ' Z';
}

// Draws a pizza (circle) cut into `d` equal slices, the first `n` topped
// (shaded) - a visual reading of the same fraction fracRenderStacked writes as text.
function fracRenderPizzaSVG(n, d, opts){
  opts = opts || {};
  const size = opts.size || 100;
  const cx = size / 2, cy = size / 2, r = size * 0.44;
  const topped = opts.color || '#FF8C42';
  const plain = '#FFE8CC';
  let inner = '';
  const anglePer = (2 * Math.PI) / d;
  for (let i = 0; i < d; i++){
    const start = -Math.PI / 2 + i * anglePer;
    const end = start + anglePer;
    const fill = i < n ? topped : plain;
    inner += '<path d="' + fracPieSlicePath(cx, cy, r, start, end) + '" fill="' + fill + '" stroke="#fff" stroke-width="2"/>';
  }
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

/* ---- Additional picture types for the "pick the matching picture" game ---- */

// A chocolate-bar-style strip split into `d` equal segments, the first `n`
// shaded - fills left-to-right, so it gets its own brown ("chocolate")
// color rather than the vertical-fill glass's blue.
function fracRenderBarSVG(n, d, opts){
  opts = opts || {};
  const w = opts.width || 110, h = opts.height || 48;
  const shaded = opts.color || '#8B5A2B';
  const empty = '#EDEDF5';
  let inner = '';
  const segW = w / d;
  for (let i = 0; i < d; i++){
    const x = i * segW;
    const fill = i < n ? shaded : empty;
    inner += '<rect x="' + x.toFixed(1) + '" y="0" width="' + segW.toFixed(1) + '" height="' + h + '" fill="' + fill + '" stroke="#fff" stroke-width="2"/>';
  }
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

// Denominators that factor into a reasonably square grid (not just one long row) -
// used only by the grid picture type.
const FRAC_GRID_DENOMS = [4, 6, 8, 10, 12];

function fracGridDims(d){
  let best = { rows: 1, cols: d };
  for (let rows = 1; rows <= d; rows++){
    if (d % rows === 0){
      const cols = d / rows;
      if (Math.abs(rows - cols) < Math.abs(best.rows - best.cols)) best = { rows, cols };
    }
  }
  return best;
}

// An m x n grid of cells (m*n = d), the first `n_` filled - the classic
// textbook "grid fraction" look.
function fracRenderGridSVG(n, d, opts){
  opts = opts || {};
  const size = opts.size || 100;
  const { rows, cols } = fracGridDims(d);
  const cellW = size / cols, cellH = size / rows;
  const shaded = opts.color || '#06D6A0';
  const empty = '#EDEDF5';
  let inner = '';
  for (let i = 0; i < d; i++){
    const r = Math.floor(i / cols), c = i % cols;
    const fill = i < n ? shaded : empty;
    inner += '<rect x="' + (c * cellW).toFixed(1) + '" y="' + (r * cellH).toFixed(1) + '" width="' + cellW.toFixed(1) + '" height="' + cellH.toFixed(1) + '" fill="' + fill + '" stroke="#fff" stroke-width="2"/>';
  }
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

// Denominators that are perfect squares, so the grid below is genuinely N x N
// (both as tall as it is wide) rather than an oblong best-fit rectangle.
const FRAC_SQUARE_DENOMS = [4, 9];

// A true N x N grid (d must be a perfect square), the first `n` filled -
// distinct from the oblong grid above, which can be wider than it is tall.
function fracRenderSquareGridSVG(n, d, opts){
  opts = opts || {};
  const size = opts.size || 100;
  const side = Math.round(Math.sqrt(d));
  const cell = size / side;
  const shaded = opts.color || '#06D6A0';
  const empty = '#EDEDF5';
  let inner = '';
  for (let i = 0; i < d; i++){
    const r = Math.floor(i / side), c = i % side;
    const fill = i < n ? shaded : empty;
    inner += '<rect x="' + (c * cell).toFixed(1) + '" y="' + (r * cell).toFixed(1) + '" width="' + cell.toFixed(1) + '" height="' + cell.toFixed(1) + '" fill="' + fill + '" stroke="#fff" stroke-width="2"/>';
  }
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

// A glass divided into `d` equal horizontal bands, the bottom `n` filled with
// liquid - a vertical (bottom-to-top) "fill level" reading of the same
// fraction, so it keeps the blue that reads as "filling up" (the left-to-right
// bar above is brown instead, to keep the two fill directions visually distinct).
function fracRenderGlassSVG(n, d, opts){
  opts = opts || {};
  const w = opts.width || 64, h = opts.height || 100;
  const liquid = opts.color || '#4C6FFF';
  const bandH = h / d;
  let inner = '';
  for (let i = 0; i < d; i++){
    const yTop = h - (i + 1) * bandH;
    const fill = i < n ? liquid : 'none';
    inner += '<rect x="3" y="' + yTop.toFixed(1) + '" width="' + (w - 6) + '" height="' + bandH.toFixed(1) + '" fill="' + fill + '" stroke="#9aa0b4" stroke-width="1.5"/>';
  }
  inner += '<rect x="3" y="3" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="6" fill="none" stroke="#3A3352" stroke-width="3"/>';
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}
