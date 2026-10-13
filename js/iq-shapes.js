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

// spec: {type, color, rotation, scale, count, size, marker}
// `marker` draws a small dark dot fixed to the shape (at its "top" before rotation
// is applied), inside the same rotated group as the shape - so it spins together
// with it. That single off-center dot has no symmetry of its own, which is what
// makes an otherwise-symmetric shape's exact rotation readable at a glance. Use
// marker:true on every spec in any question where rotation is the thing being asked.
function renderShapeSVG(spec){
  const type = spec.type || 'circle';
  const color = spec.color || IQ_SHAPE_COLORS[0];
  const rotation = spec.rotation || 0;
  const scale = spec.scale || 1;
  const count = spec.count || 1;
  const size = spec.size || 80;
  const cx = size / 2, cy = size / 2;
  const baseR = size * 0.32 * scale;

  let inner = '';
  if (count <= 1){
    inner = iqShapeMarkup(type, cx, cy, baseR, color);
    if (spec.marker){
      const markerR = size * 0.055;
      const markerDist = baseR + markerR + 3;
      inner += '<circle cx="'+cx.toFixed(1)+'" cy="'+(cy - markerDist).toFixed(1)+'" r="'+markerR.toFixed(1)+'" fill="#3A3352"/>';
    }
  } else {
    // Spacing must shrink as count grows, or shapes drift past the viewBox edges
    // and get silently clipped (invisible) - this keeps every copy on-screen.
    const maxWidth = size * 0.82;
    const gap = maxWidth / count;
    const smallR = Math.min(baseR * 0.55, gap * 0.42);
    const totalW = gap * (count - 1);
    const startX = cx - totalW / 2;
    for (let i = 0; i < count; i++){
      inner += iqShapeMarkup(type, startX + i * gap, cy, smallR, color);
    }
  }

  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+
    '<g transform="rotate('+rotation+' '+cx+' '+cy+')">'+inner+'</g>'+
  '</svg>';
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
