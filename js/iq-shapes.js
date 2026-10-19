'use strict';

/* ============ Shared SVG shape renderer for IQ visual questions ============ */
// Every visual IQ category (shape sequences, odd-one-out, analogies, matrices)
// draws its shapes through this one function, so a "shape spec" object
// {type, color, rotation, scale, count} is the common currency between them.

const IQ_SHAPE_TYPES = ['circle', 'square', 'triangle', 'pentagon', 'hexagon', 'star', 'arrow'];
const IQ_SHAPE_COLORS = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#9B5DE5', '#06D6A0', '#4C6FFF', '#FF8C42', '#F45B9E'];

const IQ_SHAPE_TYPE_NAMES = {
  circle: 'עיגול', square: 'ריבוע', triangle: 'משולש',
  pentagon: 'מחומש', hexagon: 'משושה', star: 'כוכב', arrow: 'חץ'
};
// Shapes with a built-in, unambiguous "facing direction" - no two rotation
// amounts ever look alike, so rotation questions can use them with no marker
// at all. This mirrors the real gifted-test convention (rotating arrows) rather
// than rotating plain symmetric polygons.
const IQ_DIRECTIONAL_SHAPES = ['arrow'];
const IQ_COLOR_NAMES = {
  '#FF6B6B': 'אדום', '#4ECDC4': 'טורקיז', '#FFD93D': 'צהוב', '#9B5DE5': 'סגול',
  '#06D6A0': 'ירוק', '#4C6FFF': 'כחול', '#FF8C42': 'כתום', '#F45B9E': 'ורוד'
};

// Rotational symmetry angle for each shape - rotating by a multiple of this angle
// looks IDENTICAL to not rotating at all. A circle is symmetric under every
// angle (so it must never be used in a rotation-based question at all); the
// others just need rotation amounts that avoid their own symmetry angle.
const IQ_ROTATION_SYMMETRY = { circle: 1, square: 90, triangle: 120, pentagon: 72, hexagon: 60, star: 72, arrow: 360 };
const IQ_SHAPE_MARGIN = 0.125;   // share of the size added on every side of the drawing area (room for scale 1.5 with its outline)
const IQ_ROTATABLE_SHAPES = IQ_SHAPE_TYPES.filter(t => t !== 'circle');

// `hasMarker` means the shape is drawn with the orientation dot (see renderShapeSVG) -
// that single fixed dot has NO rotational symmetry of its own, so once it's present
// every rotation (mod 360) looks genuinely different, regardless of the shape's
// own symmetry. Without a marker, a symmetric shape's rotation can't be read at
// all, so equivalence falls back to the shape's own symmetry angle.
function iqNormalizedRotation(type, rotation, hasMarker){
  if (type === 'circle' && !hasMarker) return 0; // an unmarked circle looks the same at any rotation
  const sym = hasMarker ? 360 : (IQ_ROTATION_SYMMETRY[type] || 360);
  return ((rotation % sym) + sym) % sym;
}

function iqPolygonPoints(cx, cy, r, sides, rotDeg){
  const pts = [];
  const rot = (rotDeg || 0) * Math.PI / 180;
  for (let i = 0; i < sides; i++){
    const a = rot + (i * 2 * Math.PI / sides);
    pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
  }
  return pts.join(' ');
}

function iqStarPoints(cx, cy, rOuter, rInner, points, rotDeg){
  const pts = [];
  const rot = (rotDeg || 0) * Math.PI / 180;
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++){
    const r = (i % 2 === 0) ? rOuter : rInner;
    const a = rot + i * step;
    pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
  }
  return pts.join(' ');
}

// Classic 7-point arrow (shaft + head), pointing "up" at rotation 0 - matches
// the real gifted-test rotating-arrow series exactly.
function iqArrowPoints(cx, cy, r){
  const pts = [
    [cx, cy - r],
    [cx + r*0.55, cy - r*0.15],
    [cx + r*0.22, cy - r*0.15],
    [cx + r*0.22, cy + r*0.75],
    [cx - r*0.22, cy + r*0.75],
    [cx - r*0.22, cy - r*0.15],
    [cx - r*0.55, cy - r*0.15]
  ];
  return pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
}

function iqShapeMarkup(type, cx, cy, r, color){
  switch (type){
    case 'arrow':
      return '<polygon points="'+iqArrowPoints(cx, cy, r)+'" fill="'+color+'"/>';
    case 'square': {
      const s = r * 1.5;
      return '<rect x="'+(cx - s/2).toFixed(1)+'" y="'+(cy - s/2).toFixed(1)+'" width="'+s.toFixed(1)+'" height="'+s.toFixed(1)+'" rx="6" fill="'+color+'"/>';
    }
    case 'triangle':
      return '<polygon points="'+iqPolygonPoints(cx, cy, r, 3, -90)+'" fill="'+color+'"/>';
    case 'pentagon':
      return '<polygon points="'+iqPolygonPoints(cx, cy, r, 5, -90)+'" fill="'+color+'"/>';
    case 'hexagon':
      return '<polygon points="'+iqPolygonPoints(cx, cy, r, 6, 0)+'" fill="'+color+'"/>';
    case 'star':
      return '<polygon points="'+iqStarPoints(cx, cy, r, r*0.42, 5, -90)+'" fill="'+color+'"/>';
    case 'circle':
    default:
      return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+color+'"/>';
  }
}

// Every shape is drawn as a COMPOUND figure of at least two merged elements, never
// a single flat icon: a large semi-transparent OUTER frame (the shape's own type,
// held static) with a smaller SOLID inner copy of the same type sunk inside it,
// independently rotated - so rotation is always read relative to a fixed
// reference, never in isolation. Non-polygon types (circle/star/arrow) fall back
// to a circular outer frame around the same rotated inner shape.
const IQ_TYPE_SIDES = { triangle: 3, square: 4, pentagon: 5, hexagon: 6 };

function iqRichShapeUnit(type, color, rotation, scale, size){
  const cx = size / 2, cy = size / 2;
  const sides = IQ_TYPE_SIDES[type];
  const outerR = size * 0.40 * scale, innerR = size * 0.23 * scale;
  if (sides){
    const outerPts = iqPolygonPoints(cx, cy, outerR, sides, -90);
    const innerPts = iqPolygonPoints(cx, cy, innerR, sides, -90 + rotation);
    return '<polygon points="'+outerPts+'" fill="'+color+'" fill-opacity="0.14" stroke="'+color+'" stroke-width="3"/>'+
      '<polygon points="'+innerPts+'" fill="'+color+'" stroke="'+color+'" stroke-width="2.5"/>';
  }
  const outer = '<circle cx="'+cx+'" cy="'+cy+'" r="'+outerR+'" fill="'+color+'" fill-opacity="0.14" stroke="'+color+'" stroke-width="3"/>';
  const inner = '<g transform="rotate('+rotation+' '+cx+' '+cy+')">'+iqShapeMarkup(type, cx, cy, innerR, color)+'</g>';
  return outer + inner;
}

// spec: {type, color, rotation, scale, count, size, marker}
// `marker` draws a small dark dot fixed to the shape (at its "top" before rotation
// is applied) - that single off-center dot has no symmetry of its own, which is
// what makes an otherwise-symmetric shape's exact rotation readable at a glance
// even before accounting for the nested-shape rendering above. Use marker:true on
// every spec in any question where rotation is the thing being asked.
function renderShapeSVG(spec){
  const type = spec.type || 'circle';
  const color = spec.color || IQ_SHAPE_COLORS[0];
  const rotation = spec.rotation || 0;
  const scale = spec.scale || 1;
  const count = spec.count || 1;
  const size = spec.size || 80;
  const cx = size / 2, cy = size / 2;

  let inner = '';
  if (count <= 1){
    inner = iqRichShapeUnit(type, color, rotation, scale, size);
  } else {
    // Spacing must shrink as count grows, or shapes drift past the viewBox edges
    // and get silently clipped (invisible) - this keeps every copy on-screen.
    // Crucially, the UNIT'S OWN SIZE must also be capped to fit inside its
    // allotted gap (same safety margin the old flat-icon renderer used) - a
    // fixed shrink factor isn't enough once there are 3-4 copies, since the
    // gap shrinks with count but a fixed factor doesn't, causing overlap.
    // The copies are sized as scale x a base size that leaves room for the largest scale any game uses (1.5): the
    // spacing no longer swallows the scale (it used to cap every copy at the same size, so a "bigger" group looked exactly
    // like a normal one and two answers that differed only in size looked identical). The drawing area is wider than the
    // nominal box (IQ_SHAPE_MARGIN), which is where the extra room comes from.
    const maxWidth = size * (1 + 2 * IQ_SHAPE_MARGIN) * 0.88;
    const gap = maxWidth / count;
    const baseFit = Math.min(1, (gap * 1.05 / size) / 1.5);
    const unitScale = scale * baseFit;
    const startX = cx - (gap * (count - 1)) / 2;
    for (let i = 0; i < count; i++){
      const dx = (startX + i * gap - cx).toFixed(1);
      inner += '<g transform="translate('+dx+' 0)">'+iqRichShapeUnit(type, color, rotation, unitScale, size)+'</g>';
    }
  }
  if (spec.marker && count <= 1){
    const markerR = size * 0.045;
    const dist = size * 0.23 * scale + markerR + 3;
    const rad = (rotation - 90) * Math.PI / 180;
    const mx = cx + dist * Math.cos(rad), my = cy + dist * Math.sin(rad);
    inner += '<circle cx="'+mx.toFixed(1)+'" cy="'+my.toFixed(1)+'" r="'+markerR.toFixed(1)+'" fill="#3A3352"/>';
  }

  // The drawing area is a little larger than the nominal size: a shape at scale 1.5 (the largest any game uses) has an outer radius of
  // 0.6 x size plus its outline, which would be cut off at the edge of a size x size box. Every shape gets the same margin, so the relative
  // sizes of shapes in one question stay exactly what the generators made them.
  const m = size * IQ_SHAPE_MARGIN;
  return '<svg viewBox="'+(-m)+' '+(-m)+' '+(size + 2*m)+' '+(size + 2*m)+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>';
}

function iqSpecsEqual(a, b){
  return a.type === b.type && a.color === b.color &&
    iqNormalizedRotation(a.type, a.rotation||0, a.marker) === iqNormalizedRotation(b.type, b.rotation||0, b.marker) &&
    (a.scale||1) === (b.scale||1) && (a.count||1) === (b.count||1);
}

/* ============ Composite multi-part figures (position-rearrangement questions) ============ */
// A different animal from the single-shape specs above: here a "figure" is
// several small, independently-colored PARTS sitting in fixed slot positions,
// and the thing being tested is WHICH PART ENDS UP IN WHICH SLOT - a spatial
// permutation - rather than any one shape's own color/rotation/size. This is
// what a real composite-figure matrix question (parts rearranged within a
// fixed layout) actually tests, as opposed to every other category here which
// varies a single shape's own attributes.
const IQ_COMPOSITE_SLOTS_3 = [{x:40,y:24},{x:20,y:58},{x:60,y:58}];
const IQ_COMPOSITE_SLOTS_4 = [{x:24,y:24},{x:56,y:24},{x:24,y:56},{x:56,y:56}];
const IQ_COMPOSITE_SLOTS_5 = [{x:40,y:14},{x:66,y:34},{x:56,y:64},{x:24,y:64},{x:14,y:34}];
const IQ_COMPOSITE_SLOTS_6 = [{x:18,y:20},{x:40,y:20},{x:62,y:20},{x:18,y:60},{x:40,y:60},{x:62,y:60}];
const IQ_COMPOSITE_PART_TYPES = ['square', 'triangle', 'circle', 'hexagon', 'pentagon', 'star'];

function iqCompositeSlots(n){
  if (n >= 6) return IQ_COMPOSITE_SLOTS_6;
  if (n >= 5) return IQ_COMPOSITE_SLOTS_5;
  if (n >= 4) return IQ_COMPOSITE_SLOTS_4;
  return IQ_COMPOSITE_SLOTS_3;
}

function iqRandomPermutation(n, excludeIdentity){
  let perm;
  let guard = 0;
  do {
    perm = shuffle(Array.from({ length: n }, (_, i) => i));
    guard++;
  } while (excludeIdentity && guard < 30 && perm.every((v, i) => v === i));
  return perm;
}

function iqInvertPermutation(perm){
  const inv = new Array(perm.length);
  perm.forEach((dest, i) => { inv[dest] = i; });
  return inv;
}

function iqApplyPermToParts(parts, perm){
  const out = new Array(parts.length);
  perm.forEach((dest, i) => { out[dest] = parts[i]; });
  return out;
}

function iqRandomParts(n){
  const types = shuffle(IQ_COMPOSITE_PART_TYPES.slice()).slice(0, n);
  const colors = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, n);
  return types.map((t, i) => ({ type: t, color: colors[i] }));
}

function iqCompositeEqual(a, b){
  return a.length === b.length && a.every((p, i) => p.type === b[i].type && p.color === b[i].color);
}

function iqSanitizeCompositeDistractors(correct, distractors, n){
  const kept = [];
  distractors.forEach(d => {
    if (!iqCompositeEqual(correct, d) && !kept.some(k => iqCompositeEqual(k, d))) kept.push(d);
  });
  let guard = 0;
  while (kept.length < 3 && guard < 50){
    guard++;
    const filler = iqRandomParts(n);
    if (!iqCompositeEqual(correct, filler) && !kept.some(k => iqCompositeEqual(k, filler))) kept.push(filler);
  }
  return kept.slice(0, 3);
}

// parts must already be in slot order: parts[i] sits at slot i.
function renderCompositeSVG(parts, n, size){
  size = size || 80;
  const slots = iqCompositeSlots(n);
  const r = n >= 6 ? 10 : (n >= 5 ? 11 : (n >= 4 ? 13 : 16));
  let inner = '';
  parts.forEach((p, i) => { inner += iqShapeMarkup(p.type, slots[i].x, slots[i].y, r, p.color); });
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>';
}
