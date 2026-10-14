'use strict';

/* ============ Category: 3x3 shape-grid puzzles (hand-authored 10-stage syllabus) ============ */
// Unlike the procedural `matrix` category (js/iq-visual.js), every stage here is a
// DISTINCT hand-designed logical mechanism rather than one engine parameterized by
// axis count. The grid is always a fixed 3x3; difficulty climbs through the LOGIC
// (tier === stage number), never grid size.
//
// VISUAL LANGUAGE (every stage, no exceptions): every cell is a COMPOUND figure of
// at least two merged elements - never a single flat shape. Two concrete patterns
// recur throughout:
//   (a) "nested shape" - a large semi-transparent OUTER frame (the shape's static
//       reference) with a smaller solid/patterned INNER shape sunk inside it,
//       independently rotated/filled - so rotation is always read relative to a
//       fixed frame, never in isolation.
//   (b) "boolean overlay" - two real overlapping polygons merged via true SVG
//       geometry (a <mask> for AND - only the literal intersection area is
//       filled; drawing both for OR; an evenodd <path> for XOR - the overlapping
//       area visibly cancels out) rather than an abstract bit diagram.
// Distractors are built from the mechanism itself (wrong boolean operation, inner
// left unrotated, borrowed a neighboring row/column's value) so every wrong answer
// corresponds to a genuine, specific mistake rather than a random decoy.

let iqm3PatternSeq = 0;

const IQM3_SIDES_TYPE = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' };
function iqm3ClampSides(n){ return Math.max(3, Math.min(6, n)); }

/* ---- fill styles (empty outline / diagonal hatch / solid) for an inner shape ---- */
function iqm3HatchDef(color){
  const id = 'iqm3hatch' + (iqm3PatternSeq++);
  const defs = '<pattern id="'+id+'" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
    '<rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="'+color+'" stroke-width="3.2"/></pattern>';
  return { id, defs };
}
function iqm3FillFor(style, color){
  if (style === 'empty') return { fillAttr: 'none', defs: '' };
  if (style === 'striped'){ const h = iqm3HatchDef(color); return { fillAttr: 'url(#'+h.id+')', defs: '<defs>'+h.defs+'</defs>' }; }
  return { fillAttr: color, defs: '' };
}

/* ---- the core "nested shape" primitive: transparent outer frame + inner payload ---- */
function iqm3NestedPolygon(outerSides, innerSides, innerRotation, fillAttr, defs, color, size){
  size = size || 100;
  const cx = size/2, cy = size/2, outerR = size*0.40, innerR = size*0.23;
  const outerPts = iqPolygonPoints(cx, cy, outerR, outerSides, -90);
  const innerPts = iqPolygonPoints(cx, cy, innerR, innerSides, -90 + innerRotation);
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+defs+
    '<polygon points="'+outerPts+'" fill="'+color+'" fill-opacity="0.14" stroke="'+color+'" stroke-width="3"/>'+
    '<polygon points="'+innerPts+'" fill="'+fillAttr+'" stroke="'+color+'" stroke-width="2.5"/>'+
  '</svg>';
}

/* ============ Stage 1 - sides-count (column) x fill-density (row), as a nested shape ============ */
// The inner shape is always sunk 45 degrees relative to the static outer frame -
// so "forgetting to rotate the inner shape" becomes a genuine, visible distractor.
function iqm3Stage1Shape(sides, fillStyle, color, size, innerRotation){
  const { fillAttr, defs } = iqm3FillFor(fillStyle, color);
  return iqm3NestedPolygon(sides, sides, innerRotation === undefined ? 45 : innerRotation, fillAttr, defs, color, size);
}
function iqm3Stage1(){
  const color = pickOne(IQ_SHAPE_COLORS);
  const sidesByCol = shuffle([3, 4, 5, 6]).slice(0, 3);   // which 3 shapes, in which column order - varies every question
  const fillByRow = shuffle(['empty', 'striped', 'solid']); // which fill-density goes with which row - varies every question
  const innerRotation = pickOne([45, 90]);                 // how far the inner shape is sunk relative to the frame
  const shown = [];
  for (let r = 0; r < 3; r++){
    for (let c = 0; c < 3; c++){
      if (r === 2 && c === 2) continue;
      shown.push(iqm3Stage1Shape(sidesByCol[c], fillByRow[r], color, 100, innerRotation));
    }
  }
  const correctHtml = iqm3Stage1Shape(sidesByCol[2], fillByRow[2], color, 100, innerRotation);
  const distractorHtmls = [
    iqm3Stage1Shape(sidesByCol[2], fillByRow[2], color, 100, 0), // forgot to rotate the inner shape (left aligned with the frame)
    iqm3Stage1Shape(sidesByCol[2], fillByRow[1], color, 100, innerRotation),    // right shape, didn't finish advancing fill
    iqm3Stage1Shape(sidesByCol[0], fillByRow[2], color, 100, innerRotation)     // reverted sides back to the first column entirely
  ];
  return { shown, correctHtml, distractorHtmls };
}

/* ============ Stage 2 - inner token count = row + column, inside a bold frame ============ */
const IQM3_STAGE2_SIDES = [4, 5, 6];
function iqm3RenderCountedFrame(sides, color, count, size){
  size = size || 100;
  const cx = size/2, cy = size/2, r = size*0.40;
  const pts = iqPolygonPoints(cx, cy, r, sides, -90);
  let inner = '<polygon points="'+pts+'" fill="'+color+'" fill-opacity="0.16" stroke="'+color+'" stroke-width="3"/>';
  if (count > 0){
    const tokenColor = '#3A3352';
    const spread = r*1.05;
    const gap = count > 1 ? spread/(count-1) : 0;
    const startX = cx - (gap*(count-1))/2;
    const tokenR = size*0.065;
    for (let i = 0; i < count; i++){
      inner += '<polygon points="'+iqStarPoints(startX+i*gap, cy, tokenR, tokenR*0.42, 5, -90)+'" fill="'+tokenColor+'"/>';
    }
  }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>';
}
function iqm3Stage2(){
  const sidesByRow = shuffle(IQM3_STAGE2_SIDES.slice());
  const color = pickOne(IQ_SHAPE_COLORS);
  const shown = [];
  for (let r = 0; r < 3; r++){
    for (let c = 0; c < 3; c++){
      if (r === 2 && c === 2) continue;
      shown.push(iqm3RenderCountedFrame(sidesByRow[r], color, r+c, 100));
    }
  }
  const correctHtml = iqm3RenderCountedFrame(sidesByRow[2], color, 4, 100);
  const distractorHtmls = [
    iqm3RenderCountedFrame(sidesByRow[2], color, 3, 100), // right frame, under-counted by one
    iqm3RenderCountedFrame(sidesByRow[1], color, 4, 100), // right count, previous row's frame
    iqm3RenderCountedFrame(sidesByRow[2], color, 5, 100)  // right frame, over-counted by one
  ];
  return { shown, correctHtml, distractorHtmls };
}

/* ============ Stage 3 - fixed frame (row) + accumulating rotated satellites (column) ============ */
function iqm3FrameWithSatellites(frameSides, frameColor, satType, satCount, satColor, size){
  size = size || 100;
  const cx = size/2, cy = size*0.40, outerR = size*0.30;
  const framePts = iqPolygonPoints(cx, cy, outerR, frameSides, -90);
  let inner = '<polygon points="'+framePts+'" fill="'+frameColor+'" fill-opacity="0.16" stroke="'+frameColor+'" stroke-width="3"/>';
  if (satCount > 0){
    const satY = size*0.80, satR = size*0.085, spread = size*0.58;
    const gap = satCount > 1 ? spread/(satCount-1) : 0;
    const startX = cx - (gap*(satCount-1))/2;
    for (let i = 0; i < satCount; i++){
      const sx = startX + i*gap;
      inner += '<g transform="rotate(20 '+sx.toFixed(1)+' '+satY+')">'+iqShapeMarkup(satType, sx, satY, satR, satColor)+'</g>';
    }
  }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>';
}
function iqm3Stage3(){
  const frameColor = pickOne(IQ_SHAPE_COLORS);
  const satColor = pickOne(IQ_SHAPE_COLORS.filter(c => c !== frameColor));
  const frameSidesByRow = shuffle([3,4,5,6]).slice(0,3);
  const satTypes = shuffle(['star', 'triangle', 'pentagon']);
  const shown = [];
  for (let r = 0; r < 3; r++){
    for (let c = 0; c < 3; c++){
      if (r === 2 && c === 2) continue;
      shown.push(iqm3FrameWithSatellites(frameSidesByRow[r], frameColor, satTypes[c], c+1, satColor, 100));
    }
  }
  const correctHtml = iqm3FrameWithSatellites(frameSidesByRow[2], frameColor, satTypes[2], 3, satColor, 100);
  const distractorHtmls = [
    iqm3FrameWithSatellites(frameSidesByRow[2], frameColor, satTypes[0], 3, satColor, 100), // wrong satellite species
    iqm3FrameWithSatellites(frameSidesByRow[2], frameColor, satTypes[2], 2, satColor, 100), // incomplete satellite count
    iqm3FrameWithSatellites(frameSidesByRow[1], frameColor, satTypes[2], 3, satColor, 100)  // previous row's frame
  ];
  return { shown, correctHtml, distractorHtmls };
}

/* ============ Stage 4 - rotated-diamond marker cycles between 3 frame vertices (column) x frame color (row) ============ */
const IQM3_TRI_VERTEX_ANGLES = [-90, 30, 150];
function iqm3TriVertex(cx, cy, r, slot){
  const a = IQM3_TRI_VERTEX_ANGLES[slot % 3] * Math.PI / 180;
  return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
}
function iqm3TriangleFrameWithToken(frameColor, slots, size){
  size = size || 100;
  const cx = size/2, cy = size/2, r = size*0.38;
  const pts = iqPolygonPoints(cx, cy, r, 3, -90);
  const dSize = size*0.11;
  let tokens = '';
  (Array.isArray(slots) ? slots : [slots]).forEach(slot => {
    const v = iqm3TriVertex(cx, cy, r, slot);
    tokens += '<rect x="'+(-dSize/2).toFixed(1)+'" y="'+(-dSize/2).toFixed(1)+'" width="'+dSize.toFixed(1)+'" height="'+dSize.toFixed(1)+
      '" fill="#3A3352" transform="translate('+v[0].toFixed(1)+' '+v[1].toFixed(1)+') rotate(45)"/>';
  });
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+
    '<polygon points="'+pts+'" fill="'+frameColor+'" fill-opacity="0.18" stroke="'+frameColor+'" stroke-width="3"/>'+tokens+'</svg>';
}
function iqm3Stage4(){
  const rowColors = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 3);
  const slotOrder = shuffle([0, 1, 2]); // which vertex-slot goes with which column - varies every question
  const shown = [];
  for (let r = 0; r < 3; r++){
    for (let c = 0; c < 3; c++){
      if (r === 2 && c === 2) continue;
      shown.push(iqm3TriangleFrameWithToken(rowColors[r], slotOrder[c], 100));
    }
  }
  const correctHtml = iqm3TriangleFrameWithToken(rowColors[2], slotOrder[2], 100);
  const distractorHtmls = [
    iqm3TriangleFrameWithToken(rowColors[2], slotOrder[0], 100),    // right color, marker reset to this round's first slot (cycled by row instead of column)
    iqm3TriangleFrameWithToken(rowColors[1], slotOrder[2], 100),    // right slot, previous row's color
    iqm3TriangleFrameWithToken(rowColors[2], [slotOrder[1], slotOrder[2]], 100) // rule "half-applied" - token left in two slots at once
  ];
  return { shown, correctHtml, distractorHtmls };
}

/* ============ Shared boolean-overlay engine (stages 5, 6, 9) ============ */
// Two REAL overlapping polygons, merged with true SVG geometry: AND uses a <mask>
// so only the literal intersection area is filled; OR simply draws both; XOR uses
// an evenodd <path> so the overlapping area visibly cancels out. Rotation offsets
// are chosen to avoid each shape's own rotational symmetry angle, so two
// "different" rotations never silently collapse into the same outline.
function iqm3OverlayPair(size){
  size = size || 100;
  const cx = size/2, cy = size/2, r = size*0.30;
  const sides = pickOne([3, 4, 5]);
  const rot1 = pickOne([0, 15, 30]);
  const rot2 = rot1 + pickOne([30, 45, 60]);
  return { cx, cy, r, sides, rot1, rot2 };
}
function iqm3OverlayPts(cfg, rot){ return iqPolygonPoints(cfg.cx, cfg.cy, cfg.r, cfg.sides, rot - 90); }
function iqm3PtsToPathD(ptsStr){
  const pts = ptsStr.trim().split(' ');
  return 'M' + pts[0] + ' L' + pts.slice(1).join(' L') + ' Z';
}
function iqm3Source(cfg, which, color, size, frameColor){
  size = size || 100;
  const cx = size/2, cy = size/2;
  let out = '';
  if (frameColor){ const fr = size*0.46; out += '<circle cx="'+cx+'" cy="'+cy+'" r="'+fr+'" fill="'+frameColor+'" fill-opacity="0.18" stroke="'+frameColor+'" stroke-width="3"/>'; }
  const pts = iqm3OverlayPts(cfg, which === 'A' ? cfg.rot1 : cfg.rot2);
  out += '<polygon points="'+pts+'" fill="'+color+'" fill-opacity="0.65" stroke="'+color+'" stroke-width="2.5"/>';
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+out+'</svg>';
}
function iqm3Merge(cfg, op, color, size, frameColor){
  size = size || 100;
  const cx = size/2, cy = size/2;
  let out = '';
  if (frameColor){ const fr = size*0.46; out += '<circle cx="'+cx+'" cy="'+cy+'" r="'+fr+'" fill="'+frameColor+'" fill-opacity="0.18" stroke="'+frameColor+'" stroke-width="3"/>'; }
  const ptsA = iqm3OverlayPts(cfg, cfg.rot1), ptsB = iqm3OverlayPts(cfg, cfg.rot2);
  if (op === 'xor'){
    out += '<path d="'+iqm3PtsToPathD(ptsA)+' '+iqm3PtsToPathD(ptsB)+'" fill="'+color+'" fill-rule="evenodd" stroke="'+color+'" stroke-width="2"/>';
  } else if (op === 'and'){
    const maskId = 'iqm3mask' + (iqm3PatternSeq++);
    out += '<defs><mask id="'+maskId+'"><rect width="'+size+'" height="'+size+'" fill="black"/><polygon points="'+ptsB+'" fill="white"/></mask></defs>'+
      '<polygon points="'+ptsA+'" fill="'+color+'" mask="url(#'+maskId+')"/>';
  } else { // or
    out += '<polygon points="'+ptsA+'" fill="'+color+'" fill-opacity="0.65"/><polygon points="'+ptsB+'" fill="'+color+'" fill-opacity="0.65"/>';
  }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+out+'</svg>';
}

/* ============ Stage 5 - true geometric AND (intersection) of the row's first two shapes ============ */
function iqm3Stage5(){
  const color = pickOne(IQ_SHAPE_COLORS);
  const rows = [0,1,2].map(() => iqm3OverlayPair(100));
  const shown = [];
  for (let r = 0; r < 3; r++){
    shown.push(iqm3Source(rows[r], 'A', color, 100));
    shown.push(iqm3Source(rows[r], 'B', color, 100));
    if (r < 2) shown.push(iqm3Merge(rows[r], 'and', color, 100));
  }
  const target = rows[2];
  const correctHtml = iqm3Merge(target, 'and', color, 100);
  const distractorHtmls = [
    iqm3Merge(target, 'or', color, 100),   // used the union instead of the intersection
    iqm3Merge(target, 'xor', color, 100),  // used the symmetric difference instead
    iqm3Source(target, 'B', color, 100)    // ignored the first shape entirely
  ];
  return { shown, correctHtml, distractorHtmls };
}

/* ============ Stage 6 - true geometric XOR (overlap visibly cancels) - harder than AND ============ */
function iqm3Stage6(){
  const color = pickOne(IQ_SHAPE_COLORS);
  const rows = [0,1,2].map(() => iqm3OverlayPair(100));
  const shown = [];
  for (let r = 0; r < 3; r++){
    shown.push(iqm3Source(rows[r], 'A', color, 100));
    shown.push(iqm3Source(rows[r], 'B', color, 100));
    if (r < 2) shown.push(iqm3Merge(rows[r], 'xor', color, 100));
  }
  const target = rows[2];
  const wrongRotation = Object.assign({}, target, { rot2: target.rot1 + 15 }); // used the wrong rotation offset
  const distractorHtmls = [
    iqm3Merge(target, 'and', color, 100),
    iqm3Merge(target, 'or', color, 100),
    iqm3Merge(wrongRotation, 'xor', color, 100)
  ];
  return { shown, correctHtml: iqm3Merge(target, 'xor', color, 100), distractorHtmls };
}

/* ============ Stage 7 - modular double-diagonal assignment + non-linear rotation table (nested-shape render) ============ */
// Reuses the shared nested-shape renderer (js/iq-shapes.js) that every other IQ
// visual category now draws through, just forced to this game's larger cell size.
function iqm3RichShapeSVG(spec){
  return renderShapeSVG(Object.assign({ size: 100 }, spec));
}
function iqm3Stage7(){
  const shapePool = shuffle(IQ_ROTATABLE_SHAPES.slice()).slice(0, 3);
  const colorPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 3);
  const rotSteps = [150, 40, 120];       // deliberately non-monotonic - not a simple formula
  const rotStepsLinear = [0, 40, 80];    // the "naive linear" mistake table
  const kOf = (r, c) => ((r - c) % 3 + 3) % 3;
  const grid = [];
  for (let r = 0; r < 3; r++){
    const row = [];
    for (let c = 0; c < 3; c++) row.push({ type: shapePool[(r+c) % 3], color: colorPool[r], rotation: rotSteps[kOf(r,c)], marker: true });
    grid.push(row);
  }
  const shown = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++){ if (r === 2 && c === 2) continue; shown.push(iqm3RichShapeSVG(grid[r][c])); }
  const correct = grid[2][2];
  const distractors = [
    Object.assign({}, correct, { rotation: rotStepsLinear[kOf(2,2)] }),
    { type: shapePool[(2+2-1+3) % 3], color: correct.color, rotation: correct.rotation, marker: true },
    Object.assign({}, correct, { color: colorPool[(2-1+3) % 3] })
  ];
  const safe = iqSanitizeDistractors(correct, distractors);
  return { shown, correctHtml: iqm3RichShapeSVG(correct), distractorHtmls: safe.map(d => iqm3RichShapeSVG(d)) };
}

/* ============ Stage 8 - conditional (if-then) rule: color depends on matching the row's reference type ============ */
function iqm3Stage8(){
  const colorMatch = '#06D6A0', colorOther = '#9aa0b4';
  const typeA = pickOne(IQ_SHAPE_TYPES);
  const typeB = pickOne(IQ_SHAPE_TYPES.filter(t => t !== typeA));
  const typeOf = (r, c) => ((r + c) % 2 === 0) ? typeA : typeB;
  const refType = [0, 1, 2].map(r => typeOf(r, 0));
  const colorOf = (r, c) => typeOf(r, c) === refType[r] ? colorMatch : colorOther;
  const grid = [];
  for (let r = 0; r < 3; r++){
    const row = [];
    for (let c = 0; c < 3; c++) row.push({ type: typeOf(r,c), color: colorOf(r,c) });
    grid.push(row);
  }
  const shown = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++){ if (r === 2 && c === 2) continue; shown.push(iqm3RichShapeSVG(grid[r][c])); }
  const correct = grid[2][2];
  const invertedColor = correct.color === colorMatch ? colorOther : colorMatch;
  const otherType = correct.type === typeA ? typeB : typeA;
  const distractors = [
    { type: correct.type, color: invertedColor },
    { type: otherType, color: correct.color },
    { type: otherType, color: invertedColor }
  ];
  return { shown, correctHtml: iqm3RichShapeSVG(correct), distractorHtmls: distractors.map(d => iqm3RichShapeSVG(d)) };
}

/* ============ Stage 9 - boolean XOR overlay + an independent frame-color channel (two things to verify at once) ============ */
function iqm3Stage9(){
  const rowColors = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 3);
  const shapeColor = '#3A3352';
  const rows = [0, 1, 2].map(() => iqm3OverlayPair(100));
  const shown = [];
  for (let r = 0; r < 3; r++){
    shown.push(iqm3Source(rows[r], 'A', shapeColor, 100, rowColors[r]));
    shown.push(iqm3Source(rows[r], 'B', shapeColor, 100, rowColors[r]));
    if (r < 2) shown.push(iqm3Merge(rows[r], 'xor', shapeColor, 100, rowColors[r]));
  }
  const target = rows[2];
  const correctHtml = iqm3Merge(target, 'xor', shapeColor, 100, rowColors[2]);
  const distractorHtmls = [
    iqm3Merge(target, 'xor', shapeColor, 100, rowColors[1]), // right shape, previous row's frame color
    iqm3Merge(target, 'and', shapeColor, 100, rowColors[2]), // right frame color, wrong boolean operation
    iqm3Merge(target, 'or', shapeColor, 100, rowColors[2])   // right frame color, wrong boolean operation
  ];
  return { shown, correctHtml, distractorHtmls };
}

/* ============ Stage 10 - full multi-attribute derivation: sides sum, rotation sum, color XOR (nested-shape render) ============ */
function iqm3Stage10(){
  const COLOR_X = pickOne(IQ_SHAPE_COLORS);
  const COLOR_Y = pickOne(IQ_SHAPE_COLORS.filter(c => c !== COLOR_X));
  const ROT_CHOICES = [0,30,60,90,120,150,180,210,240,270,300,330];

  function buildRow(){
    const sidesA = randInt(3,5), sidesB = randInt(3,5);
    const bitA = Math.random() < 0.5 ? 0 : 1;
    const bitB = Math.random() < 0.5 ? 0 : 1;
    const rotA = pickOne(ROT_CHOICES), rotB = pickOne(ROT_CHOICES);
    const specA = { type: IQM3_SIDES_TYPE[sidesA], color: bitA ? COLOR_Y : COLOR_X, rotation: rotA, marker: true, sides: sidesA };
    const specB = { type: IQM3_SIDES_TYPE[sidesB], color: bitB ? COLOR_Y : COLOR_X, rotation: rotB, marker: true, sides: sidesB };
    const sidesC = iqm3ClampSides(sidesA + sidesB - 2);
    const rotC = ((rotA + rotB) % 360 + 360) % 360;
    const bitC = bitA ^ bitB;
    const specC = { type: IQM3_SIDES_TYPE[sidesC], color: bitC ? COLOR_Y : COLOR_X, rotation: rotC, marker: true, sides: sidesC };
    return { specA, specB, specC };
  }

  const row0 = buildRow(), row1 = buildRow(), row2 = buildRow();
  const shown = [
    iqm3RichShapeSVG(row0.specA), iqm3RichShapeSVG(row0.specB), iqm3RichShapeSVG(row0.specC),
    iqm3RichShapeSVG(row1.specA), iqm3RichShapeSVG(row1.specB), iqm3RichShapeSVG(row1.specC),
    iqm3RichShapeSVG(row2.specA), iqm3RichShapeSVG(row2.specB)
  ];
  const correct = row2.specC;
  const avgSides = iqm3ClampSides(Math.round((row2.specA.sides + row2.specB.sides) / 2));
  const distractors = [
    { type: IQM3_SIDES_TYPE[avgSides], color: correct.color, rotation: correct.rotation, marker: true },
    { type: correct.type, color: correct.color, rotation: ((row2.specA.rotation - row2.specB.rotation) % 360 + 360) % 360, marker: true },
    { type: correct.type, color: correct.color === COLOR_X ? COLOR_Y : COLOR_X, rotation: correct.rotation, marker: true }
  ];
  const safe = iqSanitizeDistractors(correct, distractors);
  return { shown, correctHtml: iqm3RichShapeSVG(correct), distractorHtmls: safe.map(d => iqm3RichShapeSVG(d)) };
}

function generateMatrix3(tier){
  switch (tier){
    case 1: return iqm3Stage1();
    case 2: return iqm3Stage2();
    case 3: return iqm3Stage3();
    case 4: return iqm3Stage4();
    case 5: return iqm3Stage5();
    case 6: return iqm3Stage6();
    case 7: return iqm3Stage7();
    case 8: return iqm3Stage8();
    case 9: return iqm3Stage9();
    default: return iqm3Stage10();
  }
}

// ============ Merged category: "השלמת הרצף" ============
// Tiers 1-10 are this file's hand-authored 3x3 syllabus (iqm3Stage1..10) - a
// fixed grid size with ever-more-sophisticated LOGIC. Tiers 11-17 continue
// straight into js/iq-visual.js's procedural engine (generateMatrix, defined
// there) via generateMatrix(tier-10), which escalates by GRID SIZE instead
// (4x4 up through 6x6) - so the single category reads as one continuous
// difficulty ramp: "start small and tricky, then get bigger and tricker".
registerIQCategory({
  key: 'matrix',
  icon: '🧩',
  title: 'השלמת הרצף',
  subtitle: 'מה משלים את הריבוע?',
  maxTier: 17,
  renderQuestion(tier, promptEl, optionsEl, onAnswer){
    if (tier <= 10){
      const result = generateMatrix3(tier);
      let html = '<div class="iq-prompt-label">מה משלים את הריבוע?</div>' +
        '<div class="iq-matrix-grid" style="grid-template-columns:repeat(3,1fr);">';
      result.shown.forEach(cellHtml => {
        html += '<div class="iq-tile iq-tile-shape iq-matrix-cell">' + cellHtml + '</div>';
      });
      html += '<div class="iq-tile iq-tile-blank iq-matrix-cell">?</div></div>';
      promptEl.innerHTML = html;
      const options = [{ html: result.correctHtml, isCorrect: true }]
        .concat(result.distractorHtmls.map(h => ({ html: h, isCorrect: false })));
      renderIQMultipleChoice(optionsEl, options, onAnswer);
      return;
    }

    const result = generateMatrix(tier - 10);

    if (result.kind === 'composite'){
      const { n, A, Aprime, B, correct, distractors } = result;
      promptEl.innerHTML =
        '<div class="iq-prompt-label">מה משלים את הריבוע?</div>' +
        '<div class="iq-matrix-grid" style="grid-template-columns:repeat(2,1fr);">' +
          '<div class="iq-tile iq-tile-shape iq-matrix-cell">'+renderCompositeSVG(A, n)+'</div>' +
          '<div class="iq-tile iq-tile-shape iq-matrix-cell">'+renderCompositeSVG(Aprime, n)+'</div>' +
          '<div class="iq-tile iq-tile-shape iq-matrix-cell">'+renderCompositeSVG(B, n)+'</div>' +
          '<div class="iq-tile iq-tile-blank iq-matrix-cell">?</div>' +
        '</div>';
      const options = [{ html: renderCompositeSVG(correct, n), isCorrect: true }]
        .concat(distractors.map(d => ({ html: renderCompositeSVG(d, n), isCorrect: false })));
      renderIQMultipleChoice(optionsEl, options, onAnswer);
      return;
    }

    const { grid, N, correct, distractors } = result;
    let html = '<div class="iq-prompt-label">מה משלים את הריבוע?</div>' +
      '<div class="iq-matrix-grid" style="grid-template-columns:repeat('+N+',1fr);">';
    for (let r=0; r<N; r++){
      for (let c=0; c<N; c++){
        if (r === N-1 && c === N-1){
          html += '<div class="iq-tile iq-tile-blank iq-matrix-cell">?</div>';
        } else {
          html += '<div class="iq-tile iq-tile-shape iq-matrix-cell">'+renderShapeSVG(grid[r][c])+'</div>';
        }
      }
    }
    html += '</div>';
    promptEl.innerHTML = html;

    const safeDistractors = iqSanitizeDistractors(correct, distractors);
    const options = [{ html: renderShapeSVG(correct), isCorrect: true }]
      .concat(safeDistractors.map(d => ({ html: renderShapeSVG(d), isCorrect: false })));
    renderIQMultipleChoice(optionsEl, options, onAnswer);
  }
});
