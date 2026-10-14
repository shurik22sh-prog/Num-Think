'use strict';

/* ============ Shared safety net: make sure 3 distractors are always distinct from the answer and each other ============ */
// Uses iqSpecsEqual (rotation-symmetry-aware) rather than raw JSON comparison,
// so e.g. a square rotated 0deg and 90deg - which render identically - count
// as the same option and never both appear.
function iqSanitizeDistractors(correct, distractors){
  const kept = [];
  distractors.forEach(d => {
    if (!iqSpecsEqual(correct, d) && !kept.some(k => iqSpecsEqual(k, d))) kept.push(d);
  });
  let guard = 0;
  while (kept.length < 3 && guard < 50){
    guard++;
    // If the correct answer carries an orientation marker (a rotation question),
    // keep the filler's shape+marker consistent with it - just a different
    // rotation/color - rather than a jarring random unmarked shape appearing
    // among otherwise-identical rotated siblings.
    const filler = correct.marker
      ? { type: correct.type, color: pickOne(IQ_SHAPE_COLORS), rotation: randInt(0, 359), marker: true }
      : { type: pickOne(IQ_SHAPE_TYPES), color: pickOne(IQ_SHAPE_COLORS) };
    if (!iqSpecsEqual(correct, filler) && !kept.some(k => iqSpecsEqual(k, filler))) kept.push(filler);
  }
  return kept.slice(0, 3);
}

/* ============ Category: shape sequences ("what comes next?") ============ */
// Difficulty ladder shifted up: what used to be the hardest tier (growing count)
// is now the easiest starting point, and every tier above it compounds MORE
// simultaneously-changing attributes (rotation+color, 3-way shape+color,
// alternating-type+growing-count, and finally shape+color+rotation together).
function generateShapeSequence(tier){
  const shape = pickOne(IQ_SHAPE_TYPES.slice(0, 4));
  const baseColor = pickOne(IQ_SHAPE_COLORS);

  if (tier === 1){
    // Two structurally different easy patterns - not the same "growing count"
    // template with just a different shape/color each time.
    const subtype = pickOne(['growingCount', 'colorCycle']);
    if (subtype === 'growingCount'){
      const startCount = randInt(1, 2);
      const frames = [0,1,2,3].map(i => ({ type: shape, color: baseColor, count: startCount+i }));
      const next = { type: shape, color: baseColor, count: startCount+4 };
      const distractors = [
        { type: shape, color: baseColor, count: startCount+5 },
        { type: shape, color: baseColor, count: Math.max(1, startCount+3) },
        { type: shape, color: baseColor, count: Math.max(1, startCount+2) }
      ];
      return { frames, next, distractors };
    }
    // colorCycle: shape and count stay fixed - only the color alternates on a
    // simple 2-step repeating cycle (recognizing repetition, not growth).
    const colorB = pickOne(IQ_SHAPE_COLORS.filter(c => c !== baseColor));
    const cnt = randInt(1, 2);
    const cycleColor = i => (i % 2 === 0) ? baseColor : colorB;
    const frames = [0,1,2,3].map(i => ({ type: shape, color: cycleColor(i), count: cnt }));
    const next = { type: shape, color: cycleColor(4), count: cnt };
    const distractors = [
      { type: shape, color: cycleColor(3), count: cnt },                       // stuck on the previous color
      { type: shape, color: cycleColor(4), count: Math.max(1, cnt+1) },        // right color, wrong count
      { type: pickOne(IQ_SHAPE_TYPES.slice(0,4).filter(t => t !== shape)), color: cycleColor(4), count: cnt } // wrong shape
    ];
    return { frames, next, distractors };
  }

  if (tier === 2){
    // Two independent-pair-of-attributes patterns: rotation+color, or size+color -
    // both "two things changing at once" in the spirit of tier 2, but never the
    // same underlying mechanic twice in a row.
    const subtype = pickOne(['rotationColor', 'sizeColor']);
    if (subtype === 'rotationColor'){
      const useArrow = Math.random() < 0.6;
      const rotShape = useArrow ? pickOne(IQ_DIRECTIONAL_SHAPES) : pickOne(IQ_ROTATABLE_SHAPES);
      const step = pickOne([30, 40, 45, 50, 60, 70]);
      const colorCycle = [baseColor, pickOne(IQ_SHAPE_COLORS.filter(c => c !== baseColor))];
      const spec = (i, rotOverride) => ({
        type: rotShape, color: colorCycle[i % 2],
        rotation: rotOverride != null ? rotOverride : step*i,
        marker: !useArrow
      });
      const frames = [0,1,2,3].map(i => spec(i));
      const next = spec(4);
      const distractors = [
        spec(4, step*3),                  // right color, stale rotation
        { type: rotShape, color: colorCycle[(4+1)%2], rotation: step*4, marker: !useArrow }, // right rotation, wrong color
        { type: rotShape, color: colorCycle[(4+1)%2], rotation: step*3, marker: !useArrow }  // both wrong
      ];
      return { frames, next, distractors };
    }
    // sizeColor: size grows steadily while color alternates every step - two
    // independent attributes, neither one rotation.
    const colorB = pickOne(IQ_SHAPE_COLORS.filter(c => c !== baseColor));
    const startScale = 0.7;
    const scaleStep = pickOne([0.15, 0.2]);
    const cycleColor = i => (i % 2 === 0) ? baseColor : colorB;
    const scaleAt = i => Math.round((startScale + scaleStep*i) * 100) / 100;
    const spec = (i, scaleOverride) => ({ type: shape, color: cycleColor(i), scale: scaleOverride != null ? scaleOverride : scaleAt(i) });
    const frames = [0,1,2,3].map(i => spec(i));
    const next = spec(4);
    const distractors = [
      spec(3, scaleAt(4)),                               // right scale, wrong color phase
      spec(4, scaleAt(3)),                                // right color, stale scale
      spec(4, scaleAt(2))                                 // right color, further-stale scale
    ];
    return { frames, next, distractors };
  }

  if (tier === 3){
    // Two independent-modular-cycle patterns: shape x color, or count x color -
    // same "two cycles running at once" idea, different axis being cycled.
    const subtype = pickOne(['shapeColorCycle', 'countColorCycle']);
    if (subtype === 'shapeColorCycle'){
      const shapePool = shuffle(IQ_SHAPE_TYPES.slice(0, 6)).slice(0, 3);
      const colorPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 2);
      const frames = [0,1,2,3].map(i => ({ type: shapePool[i%3], color: colorPool[i%2] }));
      const next = { type: shapePool[4%3], color: colorPool[4%2] };
      const distractors = [
        { type: shapePool[(4+1)%3], color: colorPool[4%2] },   // wrong shape phase
        { type: shapePool[4%3], color: colorPool[(4+1)%2] },   // wrong color phase
        { type: shapePool[(4+2)%3], color: colorPool[(4+1)%2] } // both wrong
      ];
      return { frames, next, distractors };
    }
    // countColorCycle: count cycles through a pool of 3 values, color through 2,
    // independently - same difficulty, different axis pairing.
    const countPool = shuffle([1, 2, 3]);
    const colorPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 2);
    const frames = [0,1,2,3].map(i => ({ type: shape, color: colorPool[i%2], count: countPool[i%3] }));
    const next = { type: shape, color: colorPool[4%2], count: countPool[4%3] };
    const distractors = [
      { type: shape, color: colorPool[4%2], count: countPool[(4+1)%3] },
      { type: shape, color: colorPool[(4+1)%2], count: countPool[4%3] },
      { type: shape, color: colorPool[(4+1)%2], count: countPool[(4+2)%3] }
    ];
    return { frames, next, distractors };
  }

  if (tier === 4){
    // Two "two attributes compounding together" patterns: alternating type with
    // growing count, or growing rotation with alternating color.
    const subtype = pickOne(['typeCount', 'rotationColor']);
    if (subtype === 'typeCount'){
      // alternating shape-type WITH growing count together (inspired by the real
      // gifted-test's growing, alternating-element figural series)
      const typeA = pickOne(IQ_SHAPE_TYPES.slice(0, 5));
      const typeB = pickOne(IQ_SHAPE_TYPES.slice(0, 5).filter(t => t !== typeA));
      const startCount = randInt(1, 2);
      const spec = (i) => ({ type: i%2===0 ? typeA : typeB, color: baseColor, count: startCount+i });
      const frames = [0,1,2,3].map(spec);
      const next = spec(4);
      const distractors = [
        { type: typeA, color: baseColor, count: startCount+4 },              // wrong type (broke the alternation)
        { type: typeB, color: baseColor, count: startCount+3 },              // right type, forgot the count grew
        { type: typeA, color: baseColor, count: Math.max(1, startCount+3) }  // both wrong
      ];
      return { frames, next, distractors };
    }
    // rotationColor: rotation grows steadily WITH an alternating color - same
    // "two compounding attributes" difficulty, rotation-based this time.
    const rotShape = pickOne(IQ_ROTATABLE_SHAPES);
    const step = pickOne([35, 40, 45]);
    const colorB = pickOne(IQ_SHAPE_COLORS.filter(c => c !== baseColor));
    const cycleColor = i => (i % 2 === 0) ? baseColor : colorB;
    const spec = (i, rotOverride) => ({ type: rotShape, color: cycleColor(i), rotation: rotOverride != null ? rotOverride : step*i, marker: true });
    const frames = [0,1,2,3].map(i => spec(i));
    const next = spec(4);
    const distractors = [
      spec(4, step*3),                                                       // right color, stale rotation
      { type: rotShape, color: cycleColor(3), rotation: step*4, marker: true },  // right rotation, wrong color phase
      { type: rotShape, color: cycleColor(3), rotation: step*3, marker: true }   // both wrong
    ];
    return { frames, next, distractors };
  }

  if (tier === 5){
  // two structurally different hard patterns - three
  // attributes cycling together, or two attributes compounding non-linearly.
  const subtype5 = pickOne(['tripleCycle', 'growingCountRotation']);
  if (subtype5 === 'tripleCycle'){
    // shape-type + color + rotation, all three cycling at once
    const shapesPool = shuffle(IQ_ROTATABLE_SHAPES.slice()).slice(0, 2);
    const colorsPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 2);
    const step = pickOne([40, 50, 60, 70]);
    const spec3 = (i, rotOverride) => ({
      type: shapesPool[i%2], color: colorsPool[i%2],
      rotation: rotOverride != null ? rotOverride : step*i, marker: true
    });
    const frames = [0,1,2,3].map(i => spec3(i));
    const next = spec3(4);
    const distractors = [
      spec3(4, step*3),                                                              // right shape+color, stale rotation
      { type: shapesPool[(4+1)%2], color: colorsPool[4%2], rotation: step*4, marker: true },   // right color+rotation, wrong shape
      { type: shapesPool[4%2], color: colorsPool[(4+1)%2], rotation: step*4, marker: true }    // right shape+rotation, wrong color
    ];
    return { frames, next, distractors };
  }
  // growingCountRotation: count grows by 1 each frame AND rotation grows by an
  // INCREASING step each frame (triangular, non-linear) - a compounding-growth
  // pattern rather than a cyclic one, so it tests a genuinely different skill.
  const rotShape = pickOne(IQ_ROTATABLE_SHAPES);
  const baseStep = pickOne([20, 25, 30]);
  const startCount = 1;
  const rotFor = i => ((i*(i+1))/2) * baseStep;
  const spec5 = (i, rotOverride, countOverride) => ({
    type: rotShape, color: baseColor,
    rotation: rotOverride != null ? rotOverride : rotFor(i),
    count: countOverride != null ? countOverride : (startCount+i),
    marker: true
  });
  const frames = [0,1,2,3].map(i => spec5(i));
  const next = spec5(4);
  const distractors = [
    spec5(4, rotFor(3)),               // right count, forgot rotation keeps accelerating
    spec5(4, undefined, startCount+3), // right rotation, forgot count keeps growing
    spec5(4, baseStep*4)               // used linear growth instead of the real triangular growth
  ];
  return { frames, next, distractors };
  }

  if (tier === 6){
    // one level beyond tier 5: FOUR independent attributes at once (shape+color
    // 2-cycles, count grows, rotation grows), or a long-period cycle (4x3=12)
    // too long to spot by eye within the 5 shown positions - forces genuine
    // rule induction instead of "just continue the visible loop".
    const subtype = pickOne(['fourAttributeCombo', 'longPeriodCycle']);
    if (subtype === 'fourAttributeCombo'){
      const shapesPool = shuffle(IQ_ROTATABLE_SHAPES.slice()).slice(0, 2);
      const colorsPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 2);
      const step = pickOne([30, 40, 50]);
      const startCount = 1;
      const spec = (i, rotOverride, countOverride) => ({
        type: shapesPool[i%2], color: colorsPool[i%2],
        rotation: rotOverride != null ? rotOverride : step*i,
        count: countOverride != null ? countOverride : (startCount+i),
        marker: true
      });
      const frames = [0,1,2,3].map(i => spec(i));
      const next = spec(4);
      const distractors = [
        spec(4, step*3),                     // stale rotation
        spec(4, undefined, startCount+3),    // stale count
        { type: shapesPool[(4+1)%2], color: colorsPool[4%2], rotation: step*4, count: startCount+4, marker: true } // wrong shape phase
      ];
      return { frames, next, distractors };
    }
    // longPeriodCycle: shape cycles through a pool of 4, color through a pool of
    // 3 - combined period 12, so no repeat is visible in the 5 shown positions.
    const shapePool4 = shuffle(IQ_SHAPE_TYPES.slice(0, 6)).slice(0, 4);
    const colorPool3 = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 3);
    const frames = [0,1,2,3].map(i => ({ type: shapePool4[i%4], color: colorPool3[i%3] }));
    const next = { type: shapePool4[4%4], color: colorPool3[4%3] };
    const distractors = [
      { type: shapePool4[(4+1)%4], color: colorPool3[4%3] },
      { type: shapePool4[4%4], color: colorPool3[(4+1)%3] },
      { type: shapePool4[(4+2)%4], color: colorPool3[(4+1)%3] }
    ];
    return { frames, next, distractors };
  }

  // tier 7 (hardest): the hardest combinations yet - triangular (non-linear)
  // rotation growth COMBINED with a 2-way shape+color cycle, or that same
  // non-linear rotation growth combined with both growing count AND cycling color.
  const subtype7 = pickOne(['nonLinearTriple', 'growingCountRotationColor']);
  if (subtype7 === 'nonLinearTriple'){
    const shapesPool = shuffle(IQ_ROTATABLE_SHAPES.slice()).slice(0, 2);
    const colorsPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 2);
    const baseStep = pickOne([15, 20]);
    const rotFor = i => ((i*(i+1))/2) * baseStep;
    const spec = (i, rotOverride) => ({ type: shapesPool[i%2], color: colorsPool[i%2], rotation: rotOverride != null ? rotOverride : rotFor(i), marker: true });
    const frames = [0,1,2,3].map(i => spec(i));
    const next = spec(4);
    const distractors = [
      spec(4, rotFor(3)),                                                                      // stale rotation (forgot the acceleration)
      { type: shapesPool[(4+1)%2], color: colorsPool[4%2], rotation: rotFor(4), marker: true },  // wrong shape phase
      { type: shapesPool[4%2], color: colorsPool[(4+1)%2], rotation: rotFor(4), marker: true }   // wrong color phase
    ];
    return { frames, next, distractors };
  }
  const rotShape = pickOne(IQ_ROTATABLE_SHAPES);
  const colorsPool7 = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 2);
  const baseStep7 = pickOne([15, 20, 25]);
  const startCount7 = 1;
  const rotFor7 = i => ((i*(i+1))/2) * baseStep7;
  const spec7 = (i, rotOverride, countOverride) => ({
    type: rotShape, color: colorsPool7[i%2],
    rotation: rotOverride != null ? rotOverride : rotFor7(i),
    count: countOverride != null ? countOverride : (startCount7+i),
    marker: true
  });
  const frames7 = [0,1,2,3].map(i => spec7(i));
  const next7 = spec7(4);
  const distractors7 = [
    spec7(4, rotFor7(3)),                // stale rotation
    spec7(4, undefined, startCount7+3),  // stale count
    { type: rotShape, color: colorsPool7[3%2], rotation: rotFor7(4), count: startCount7+4, marker: true } // wrong color phase
  ];
  return { frames: frames7, next: next7, distractors: distractors7 };
}

registerIQCategory({
  key: 'shapeseq',
  icon: '🔷',
  title: 'סדרות צורות',
  subtitle: 'מה הצורה הבאה?',
  renderQuestion(tier, promptEl, optionsEl, onAnswer){
    const { frames, next, distractors } = generateShapeSequence(tier);
    promptEl.innerHTML =
      '<div class="iq-prompt-label">השלימו את הסדרה:</div>' +
      '<div class="iq-sequence-row">' +
        frames.map(f => '<div class="iq-tile iq-tile-shape">'+renderShapeSVG(f)+'</div>').join('') +
        '<div class="iq-tile iq-tile-blank">?</div>' +
      '</div>';
    const safeDistractors = iqSanitizeDistractors(next, distractors);
    const options = [{ html: renderShapeSVG(next), isCorrect: true }]
      .concat(safeDistractors.map(d => ({ html: renderShapeSVG(d), isCorrect: false })));
    renderIQMultipleChoice(optionsEl, options, onAnswer);
  }
});

/* ============ Category: odd one out ============ */
// Rebuilt around three hand-picked "gifted-test" rules, each with a single
// changing variable - every other visual parameter (size, fill color, stroke
// width, frame) is held IDENTICAL across all 4 options, so there is never a
// secondary attribute that could make a second option look "odd" too:
//   1. orientation - 3 copies of the same CHIRAL (no symmetry of its own)
//      compound shape at different rotations; the 4th is a mirror image -
//      a mirror of a chiral shape is never reachable by any rotation, so the
//      correct answer is mathematically guaranteed to be unique.
//   2. ratio - every shape has N sides and N inner dots; 3 satisfy
//      dots = sides - 1, the 4th doesn't.
//   3. symmetry - 3 shapes are built by actually mirroring one half of a
//      jagged outline across an axis (so they are exactly, not approximately,
//      symmetric); the 4th is built from independent random radii and
//      verified to carry neither a vertical nor horizontal symmetry axis.
// Every generator is wrapped in a self-verification retry loop (see
// iqOddVerifyExactlyOneOdd) that recomputes which option(s) break the rule and
// regenerates unless EXACTLY one does - so an ambiguous question (zero or
// multiple "odd" shapes) can never reach the player.

// ---- shared asymmetric "flag" shape (orientation rule) ----
// A hexagonal L-shape with NO symmetry of its own. An earlier version of this
// shape (outer 48x48 square minus an exact 24x24 quarter-notch) looked
// asymmetric but actually had a hidden DIAGONAL mirror axis - mirroring it
// across the Y axis produced the exact same polygon (same vertices, opposite
// winding) as rotating the original by 90 degrees, so the "mirror" option was
// pixel-identical to one of the "rotation" options. This shape avoids that by
// making the outer footprint and the notch both asymmetric (48x48 outer, but
// a 22x20 notch offset from the corner) - verified below, by actual geometric
// comparison against all 4 rotations and all 4 rotations of its mirror image,
// not by assumption.
const IQ_ODD_FLAG_BASE = [[-24,-24], [24,-24], [24,4], [2,4], [2,24], [-24,24]];

function iqOddRotatePoints(pts, deg){
  const rad = deg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  return pts.map(([x,y]) => [x*cos - y*sin, x*sin + y*cos]);
}
function iqOddMirrorPoints(pts){ return pts.map(([x,y]) => [-x, y]); }
// True polygon congruence IN PLACE: same vertex set, same cyclic adjacency,
// allowing a different starting vertex and/or the opposite winding direction,
// and tolerant of small floating-point drift. This is "do these literally draw
// the same shape on screen", unlike a naive index-by-index comparison (which
// is exactly what let the old bug slip through - two point lists can describe
// the identical polygon while never matching at the same index).
function iqOddPolygonsCongruent(a, b, tol){
  tol = tol == null ? 0.05 : tol;
  if (a.length !== b.length) return false;
  const n = a.length;
  const close = (p, q) => Math.abs(p[0]-q[0]) < tol && Math.abs(p[1]-q[1]) < tol;
  for (const seq of [b, b.slice().reverse()]){
    for (let shift = 0; shift < n; shift++){
      let ok = true;
      for (let i = 0; i < n; i++){ if (!close(a[i], seq[(i + shift) % n])){ ok = false; break; } }
      if (ok) return true;
    }
  }
  return false;
}
// Rotation-equivalence is checked explicitly against each of the 4 angles the
// game actually uses - never inferred generically - so this only ever says
// "yes" when pts truly matches one specific, known rotation of the base shape.
function iqOddIsRotationOfBase(pts){
  return [0,90,180,270].some(r => iqOddPolygonsCongruent(pts, iqOddRotatePoints(IQ_ODD_FLAG_BASE, r)));
}
// One-time proof (not re-run per question - this is a property of the BASE
// SHAPE itself) that it is genuinely chiral: none of its own 4 rotations
// coincide with each other, and none of them coincide with any of the 4
// rotations of its mirror image either. If this shape is ever edited again,
// this fails LOUDLY the moment the script loads, instead of silently shipping
// ambiguous questions to players.
(function iqOddAssertFlagBaseIsChiral(){
  const rotations = [0,90,180,270].map(r => iqOddRotatePoints(IQ_ODD_FLAG_BASE, r));
  for (let i = 0; i < rotations.length; i++){
    for (let j = i+1; j < rotations.length; j++){
      if (iqOddPolygonsCongruent(rotations[i], rotations[j])){
        throw new Error('IQ_ODD_FLAG_BASE is not chiral: its own rotations ' + (i*90) + 'deg and ' + (j*90) + 'deg are visually identical.');
      }
    }
  }
  const mirrorRotations = [0,90,180,270].map(r => iqOddRotatePoints(iqOddMirrorPoints(IQ_ODD_FLAG_BASE), r));
  for (let i = 0; i < rotations.length; i++){
    for (let j = 0; j < mirrorRotations.length; j++){
      if (iqOddPolygonsCongruent(rotations[i], mirrorRotations[j])){
        throw new Error('IQ_ODD_FLAG_BASE is not chiral: rotation ' + (i*90) + 'deg matches mirror-rotation ' + (j*90) + 'deg.');
      }
    }
  }
})();
function iqOddRenderPolygon(pts, color, strokeWidth, size){
  size = size || 100;
  const cx = size/2, cy = size/2, scale = size*0.42/24;
  const svgPts = pts.map(([x,y]) => (cx+x*scale).toFixed(1)+','+(cy+y*scale).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+
    '<polygon points="'+svgPts+'" fill="'+color+'" stroke="#1a1a2e" stroke-width="'+strokeWidth+'" stroke-linejoin="round"/></svg>';
}
function iqOddGenOrientation(tier){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const rotPool = shuffle([0, 90, 180, 270]);
  const normalRots = rotPool.slice(0, 3);
  const oddRot = (tier >= 4) ? rotPool[3] : 0; // easy tiers: mirror shown upright; harder tiers: mirror at a random 4th angle
  const oddIndex = randInt(0, 3);
  const items = normalRots.map(r => ({ pts: iqOddRotatePoints(IQ_ODD_FLAG_BASE, r), color, strokeWidth, size }));
  items.splice(oddIndex, 0, { pts: iqOddRotatePoints(iqOddMirrorPoints(IQ_ODD_FLAG_BASE), oddRot), color, strokeWidth, size });
  return { items, oddIndex, family: 'orientation', explanation: 'שלוש הצורות הן אותה צורה מסובבת בזוויות שונות - הצורה שנבחרה היא תמונת ראי (שיקוף), לא סיבוב.' };
}

// ---- ratio rule: inner dot count vs side count ----
function iqOddRenderRatioShape(sides, dots, color, strokeWidth, size){
  size = size || 100;
  const cx = size/2, cy = size/2, r = size*0.36;
  const outlinePts = iqPolygonPoints(cx, cy, r, sides, -90);
  let inner = '';
  const dotR = size*0.045, innerR = r*0.5;
  for (let i = 0; i < dots; i++){
    const rad = (-90 + i*(360/Math.max(dots,1))) * Math.PI/180;
    inner += '<circle cx="'+(cx+innerR*Math.cos(rad)).toFixed(1)+'" cy="'+(cy+innerR*Math.sin(rad)).toFixed(1)+'" r="'+dotR.toFixed(1)+'" fill="#1a1a2e"/>';
  }
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+
    '<polygon points="'+outlinePts+'" fill="'+color+'" stroke="#1a1a2e" stroke-width="'+strokeWidth+'"/>'+inner+'</svg>';
}
function iqOddWrongDotCount(sides){
  const correct = sides - 1;
  return pickOne([correct+1, correct+2, Math.max(0, correct-1)].filter(v => v !== correct));
}
function iqOddGenRatio(tier){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const sidesPool = (tier >= 4) ? [4,5,6,7] : [3,4,5,6];
  const chosenSides = shuffle(sidesPool).slice(0, 4);
  const oddIndex = randInt(0, 3);
  const items = chosenSides.map((sides, i) => {
    const dots = (i === oddIndex) ? iqOddWrongDotCount(sides) : sides - 1;
    return { sides, dots, color, strokeWidth, size };
  });
  return { items, oddIndex, family: 'ratio', explanation: 'בשלוש הצורות מספר הנקודות הפנימיות הוא בדיוק מספר הצלעות פחות 1 - בצורה שנבחרה היחס הזה לא מתקיים.' };
}

// ---- symmetry rule: a jagged 8-point outline, mirrored vs independently random ----
const IQ_ODD_SYM_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
function iqOddRenderBlob(radii, color, strokeWidth, size){
  size = size || 100;
  const cx = size/2, cy = size/2;
  const pts = IQ_ODD_SYM_ANGLES.map((deg,i) => {
    const rad = deg * Math.PI/180;
    return (cx+radii[i]*Math.cos(rad)).toFixed(1)+','+(cy+radii[i]*Math.sin(rad)).toFixed(1);
  }).join(' ');
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+
    '<polygon points="'+pts+'" fill="'+color+'" stroke="#1a1a2e" stroke-width="'+strokeWidth+'" stroke-linejoin="round"/></svg>';
}
// With 8 points spaced 45 degrees apart there are FOUR possible mirror axes
// (vertical, horizontal, and the two diagonals) - a shape is only genuinely
// asymmetric if it fails ALL four, not just the first two. Indices follow
// IQ_ODD_SYM_ANGLES = [0,45,90,135,180,225,270,315].
function iqOddRadiiSymmetric(r){
  const tol = 2;
  const close = (a, b) => Math.abs(a - b) < tol;
  const vertical   = close(r[0],r[4]) && close(r[1],r[3]) && close(r[5],r[7]); // axis through 90/270
  const horizontal = close(r[1],r[7]) && close(r[2],r[6]) && close(r[3],r[5]); // axis through 0/180
  const diag45     = close(r[0],r[2]) && close(r[3],r[7]) && close(r[4],r[6]); // axis through 45/225
  const diag135    = close(r[0],r[6]) && close(r[1],r[5]) && close(r[2],r[4]); // axis through 135/315
  return vertical || horizontal || diag45 || diag135;
}
function iqOddGenSymmetry(tier){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  // higher tiers narrow the radius range, so the asymmetric shape's "wrongness" is subtler
  const width = Math.max(6, 16 - (tier-1)*2);
  const minR = 30 - width/2, maxR = 30 + width/2;
  const randR = () => minR + Math.random()*(maxR-minR);
  function buildSymmetric(){
    // build by actually mirroring the right half across the vertical axis - an
    // EXACT symmetry by construction, not an approximate/accidental one.
    const r = new Array(8);
    r[0] = randR(); r[1] = randR(); r[2] = randR(); r[5] = randR(); r[6] = randR();
    r[4] = r[0]; r[3] = r[1]; r[7] = r[5];
    return r;
  }
  function buildAsymmetric(){
    let r, guard = 0;
    do { r = IQ_ODD_SYM_ANGLES.map(randR); guard++; } while (guard < 30 && iqOddRadiiSymmetric(r));
    return r;
  }
  const oddIndex = randInt(0, 3);
  const items = [0,1,2,3].map(i => ({ radii: (i === oddIndex) ? buildAsymmetric() : buildSymmetric(), color, strokeWidth, size }));
  return { items, oddIndex, family: 'symmetry', explanation: 'שלוש הצורות סימטריות (יש להן ציר סימטריה אנכי או אופקי) - הצורה שנבחרה א-סימטרית.' };
}

// ---- generic self-verification: regenerate unless EXACTLY one item breaks its family's rule ----
function iqOddVerifyExactlyOneOdd(result){
  const checkFn = result.family === 'orientation' ? (it => iqOddIsRotationOfBase(it.pts))
    : result.family === 'ratio' ? (it => it.dots === it.sides - 1)
    : (it => iqOddRadiiSymmetric(it.radii));
  let failCount = 0, failIdx = -1;
  result.items.forEach((it, i) => { if (!checkFn(it)){ failCount++; failIdx = i; } });
  if (failCount !== 1 || failIdx !== result.oddIndex) return false;
  if (result.family === 'orientation'){
    // Defense in depth, specific to the orientation rule: also confirm every
    // PAIR of the 4 displayed shapes is visually distinct from every other
    // pair - not just "the odd one differs from the normals", but also "no
    // two normals happen to coincide with each other" either. With a verified
    // chiral base shape this should never trigger, but it's what would have
    // caught the original bug even if iqOddIsRotationOfBase alone had missed it.
    for (let i = 0; i < result.items.length; i++){
      for (let j = i+1; j < result.items.length; j++){
        if (iqOddPolygonsCongruent(result.items[i].pts, result.items[j].pts)) return false;
      }
    }
  }
  return true;
}
function iqOddGenerate(tier){
  // The RULE FAMILY is randomized on every single question - never locked to the
  // tier - so a run of questions at the same level never repeats the same
  // underlying logic five times in a row. The tier only scales each family's
  // OWN internal difficulty knob (see iqOddGen* above), so "same level" still
  // means "equally hard", just via whichever rule got picked this time.
  const family = pickOne(['orientation', 'ratio', 'symmetry']);
  const genFn = family === 'orientation' ? iqOddGenOrientation : family === 'ratio' ? iqOddGenRatio : iqOddGenSymmetry;
  let result, guard = 0;
  do { result = genFn(tier); guard++; } while (guard < 10 && !iqOddVerifyExactlyOneOdd(result));
  if (!iqOddVerifyExactlyOneOdd(result)){
    // Clear, loud failure instead of silently handing the player an ambiguous
    // question - this should be unreachable with a verified-chiral base shape
    // and working ratio/symmetry generators, so reaching it means something
    // regressed and needs fixing, not a case to paper over.
    throw new Error('iqOddGenerate: failed to produce a valid "' + family + '" question after ' + guard + ' attempts (tier ' + tier + ').');
  }
  return result;
}
function iqOddRenderItem(item){
  if (item.pts) return iqOddRenderPolygon(item.pts, item.color, item.strokeWidth, item.size);
  if (item.radii) return iqOddRenderBlob(item.radii, item.color, item.strokeWidth, item.size);
  return iqOddRenderRatioShape(item.sides, item.dots, item.color, item.strokeWidth, item.size);
}

registerIQCategory({
  key: 'oddone',
  icon: '🧐',
  title: 'מה לא שייך?',
  subtitle: 'מצאו את הצורה השונה',
  maxTier: 6,
  renderQuestion(tier, promptEl, optionsEl, onAnswer){
    const { items, oddIndex, explanation } = iqOddGenerate(tier);
    promptEl.innerHTML = '<div class="iq-prompt-text">איזו צורה שונה מהשאר?</div>';
    const options = items.map((item, i) => ({ html: iqOddRenderItem(item), isCorrect: i === oddIndex }));
    renderIQMultipleChoice(optionsEl, options, (isCorrect) => {
      if (isCorrect){
        document.getElementById('iq-oddone-explanation').textContent = explanation;
      }
      onAnswer(isCorrect);
    });
  }
});

/* ============ Category: shape analogies (A:A' :: B:?) ============ */
const IQ_COLOR_PAIRS = [
  ['#FF6B6B', '#4C6FFF'],
  ['#FFD93D', '#06D6A0'],
  ['#9B5DE5', '#FF8C42']
];

function iqPairedColor(color){
  for (const pair of IQ_COLOR_PAIRS){
    if (pair[0] === color) return pair[1];
    if (pair[1] === color) return pair[0];
  }
  return pickOne(IQ_SHAPE_COLORS.filter(c => c !== color));
}

// Rebuilt around a shared POOL of independent mechanics rather than one fixed
// mechanic per tier: every mechanic below is exactly what used to be a single
// tier (or sub-tier) branch, now a standalone function. `tier` only controls
// which mechanics have UNLOCKED so far (each has a minTier) - the mechanic
// actually used for a given question is picked at random from everything
// unlocked at that tier, so a run of questions at the same level mixes
// different underlying rules instead of repeating the same one with new
// shapes every time. Tier 1 still has exactly one mechanic (there was only
// ever one this simple), but from tier 2 up the pool - and therefore the
// variety - keeps growing.
function iqAnalogySetupTypes(usesRotation){
  const useArrowForRotation = usesRotation && Math.random() < 0.6;
  const typePool = usesRotation
    ? (useArrowForRotation ? IQ_DIRECTIONAL_SHAPES : IQ_ROTATABLE_SHAPES)
    : IQ_SHAPE_TYPES.slice(0, 5);
  const typeA = pickOne(typePool);
  const typeB = useArrowForRotation ? typeA : pickOne(typePool.filter(t => t !== typeA));
  const A = { type: typeA, color: pickOne(IQ_SHAPE_COLORS) };
  const B = { type: typeB, color: pickOne(IQ_SHAPE_COLORS) };
  if (usesRotation && !useArrowForRotation){ A.marker = true; B.marker = true; } // orientation dot makes the rotation readable
  return { A, B };
}
function iqAnalogyPickRotationsMod3(){
  // halves land on DIFFERENT remainders mod 3, so B's correct rotation is
  // genuinely different from A's - the rule must be applied, not copied.
  const ROT_BY_MOD3 = [90, 180, 270];
  const evenPool = [4, 6, 8, 10, 12, 14, 16];
  let baseA, baseB, halfA, halfB, guard = 0;
  do {
    baseA = pickOne(evenPool);
    baseB = pickOne(evenPool.filter(v => v !== baseA));
    halfA = baseA / 2; halfB = baseB / 2;
    guard++;
  } while (guard < 30 && halfA % 3 === halfB % 3);
  const rotA = ROT_BY_MOD3[halfA % 3];
  const rotB = ROT_BY_MOD3[halfB % 3];
  const rotNeither = ROT_BY_MOD3.find(r => r !== rotA && r !== rotB);
  return { baseA, baseB, halfA, halfB, rotA, rotB, rotNeither };
}

function iqAnalogyMech_countHalve(){ // count HALVES, not doubles - the reversed-direction trap
  const { A, B } = iqAnalogySetupTypes(false);
  const baseA = 4, baseB = 6;
  A.count = baseA; B.count = baseB;
  const Aprime = Object.assign({}, A, { count: baseA / 2 });
  const correctBprime = Object.assign({}, B, { count: baseB / 2 });
  const wrongBprimes = [
    Object.assign({}, B, { count: baseB * 2 }), // doubled instead of halved - the common trap
    Object.assign({}, B, { count: baseB - 1 }),
    Object.assign({}, B, { count: baseB })
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_fourAttributeCombo(){ // color + size + rotation + count all at once
  const { A, B } = iqAnalogySetupTypes(true);
  const Aprime = Object.assign({}, A, { color: iqPairedColor(A.color), scale: 1.4, rotation: 90, count: 2 });
  const correctBprime = Object.assign({}, B, { color: iqPairedColor(B.color), scale: 1.4, rotation: 90, count: 2 });
  const wrongBprimes = [
    Object.assign({}, B, { color: iqPairedColor(B.color), scale: 1.4, rotation: 90 }), // missing the count change
    Object.assign({}, B, { color: iqPairedColor(B.color), scale: 1.4, count: 2 }),     // missing the rotation
    Object.assign({}, B, { scale: 1.4, rotation: 90, count: 2 })                       // missing the color change
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_reversedComboTrap(){ // count HALVES and color swaps, together
  const { A, B } = iqAnalogySetupTypes(false);
  const baseA = 4, baseB = 6;
  A.count = baseA; B.count = baseB;
  const Aprime = Object.assign({}, A, { count: baseA / 2, color: iqPairedColor(A.color) });
  const correctBprime = Object.assign({}, B, { count: baseB / 2, color: iqPairedColor(B.color) });
  const wrongBprimes = [
    Object.assign({}, B, { count: baseB * 2, color: iqPairedColor(B.color) }), // doubled instead of halved, but got the color right
    Object.assign({}, B, { count: baseB / 2 }),                               // halved correctly, forgot the color
    Object.assign({}, B, { count: baseB, color: iqPairedColor(B.color) })     // forgot to change the count at all
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_oddAngleTrap(){ // rotation by an unexpected 135deg + count halving + a color swap
  const { A, B } = iqAnalogySetupTypes(true);
  const baseA = 4, baseB = 8;
  A.count = baseA; B.count = baseB;
  const Aprime = Object.assign({}, A, { rotation: 135, color: iqPairedColor(A.color), count: baseA / 2 });
  const correctBprime = Object.assign({}, B, { rotation: 135, color: iqPairedColor(B.color), count: baseB / 2 });
  const wrongBprimes = [
    Object.assign({}, B, { rotation: 90, color: iqPairedColor(B.color), count: baseB / 2 }),  // assumed the "usual" 90 instead of 135
    Object.assign({}, B, { rotation: 135, color: iqPairedColor(B.color), count: baseB * 2 }),  // doubled instead of halved
    Object.assign({}, B, { rotation: 135, count: baseB / 2 })                                  // forgot the color
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_derivedRotationCount(){ // rotation DERIVED from count (count x 45), count doubles
  const { A, B } = iqAnalogySetupTypes(true);
  const baseA = 2, baseB = 3;
  A.count = baseA; A.rotation = baseA * 45;
  B.count = baseB; B.rotation = baseB * 45;
  const newCountA = baseA * 2, newCountB = baseB * 2;
  const Aprime = Object.assign({}, A, { count: newCountA, rotation: newCountA * 45 });
  const correctBprime = Object.assign({}, B, { count: newCountB, rotation: newCountB * 45 });
  const wrongBprimes = [
    Object.assign({}, B, { count: newCountB, rotation: baseB * 45 }), // doubled the count, forgot rotation must scale WITH it
    Object.assign({}, B, { count: newCountB, rotation: 90 }),          // guessed a generic rotation instead of the derived one
    Object.assign({}, B, { count: baseB, rotation: newCountB * 45 })   // got the derived rotation, forgot to double the count
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_derivedGrowCombo(){ // derived rotation from the doubled count, AND color + size change alongside
  const { A, B } = iqAnalogySetupTypes(true);
  const baseA = 2, baseB = 3;
  A.count = baseA; B.count = baseB;
  const newA = baseA * 2, newB = baseB * 2;
  const Aprime = Object.assign({}, A, { count: newA, rotation: newA * 45, color: iqPairedColor(A.color), scale: 1.3 });
  const correctBprime = Object.assign({}, B, { count: newB, rotation: newB * 45, color: iqPairedColor(B.color), scale: 1.3 });
  const wrongBprimes = [
    Object.assign({}, B, { count: newB, rotation: baseB * 45, color: iqPairedColor(B.color), scale: 1.3 }), // used the OLD count to derive rotation
    Object.assign({}, B, { count: newB, rotation: newB * 45, scale: 1.3 }),                                 // forgot the color
    Object.assign({}, B, { count: newB, rotation: newB * 45, color: iqPairedColor(B.color) })               // forgot the size change
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_derivedHalveCombo(){ // derived rotation, but based on a HALVED count
  const { A, B } = iqAnalogySetupTypes(true);
  const baseA = 8, baseB = 6;
  A.count = baseA; B.count = baseB;
  const newA = baseA / 2, newB = baseB / 2;
  const Aprime = Object.assign({}, A, { count: newA, rotation: newA * 45 });
  const correctBprime = Object.assign({}, B, { count: newB, rotation: newB * 45 });
  const wrongBprimes = [
    Object.assign({}, B, { count: newB, rotation: baseB * 45 }),           // derived the rotation from the OLD count instead of the new one
    Object.assign({}, B, { count: baseB * 2, rotation: (baseB*2) * 45 }),  // doubled instead of halved (rotation consistent with that wrong count)
    Object.assign({}, B, { count: newB, rotation: 90 })                   // right count, generic wrong rotation
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_conditionalMod3(){ // CONDITIONAL rule - rotation depends on the halved count's remainder mod 3
  const { A, B } = iqAnalogySetupTypes(true);
  const { baseA, baseB, halfA, halfB, rotA, rotB, rotNeither } = iqAnalogyPickRotationsMod3();
  A.count = baseA; B.count = baseB;
  const Aprime = Object.assign({}, A, { count: halfA, rotation: rotA });
  const correctBprime = Object.assign({}, B, { count: halfB, rotation: rotB });
  const wrongBprimes = [
    Object.assign({}, B, { count: halfB, rotation: rotA }),         // copied A's rotation literally instead of re-deriving it for B
    Object.assign({}, B, { count: baseB, rotation: rotB }),         // forgot to halve the count
    Object.assign({}, B, { count: halfB, rotation: rotNeither })    // a plausible but wrong third rotation
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_conditionalMod3Combo(){ // the conditional mod-3 rule, plus a simultaneous color swap AND size growth
  const { A, B } = iqAnalogySetupTypes(true);
  const { baseA, baseB, halfA, halfB, rotA, rotB, rotNeither } = iqAnalogyPickRotationsMod3();
  A.count = baseA; B.count = baseB;
  const Aprime = Object.assign({}, A, { count: halfA, rotation: rotA, color: iqPairedColor(A.color), scale: 1.3 });
  const correctBprime = Object.assign({}, B, { count: halfB, rotation: rotB, color: iqPairedColor(B.color), scale: 1.3 });
  const wrongBprimes = [
    Object.assign({}, B, { count: halfB, rotation: rotA, color: iqPairedColor(B.color), scale: 1.3 }),        // copied A's literal rotation
    Object.assign({}, B, { count: baseB, rotation: rotB, color: iqPairedColor(B.color), scale: 1.3 }),        // forgot to halve the count
    Object.assign({}, B, { count: halfB, rotation: rotNeither, color: iqPairedColor(B.color), scale: 1.3 })   // a plausible but wrong third rotation
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}

const IQ_ANALOGY_MECHANICS = [
  { minTier: 1, fn: iqAnalogyMech_countHalve },
  { minTier: 2, fn: iqAnalogyMech_fourAttributeCombo },
  { minTier: 2, fn: iqAnalogyMech_reversedComboTrap },
  { minTier: 3, fn: iqAnalogyMech_oddAngleTrap },
  { minTier: 3, fn: iqAnalogyMech_derivedRotationCount },
  { minTier: 4, fn: iqAnalogyMech_derivedGrowCombo },
  { minTier: 5, fn: iqAnalogyMech_derivedHalveCombo },
  { minTier: 6, fn: iqAnalogyMech_conditionalMod3 },
  { minTier: 7, fn: iqAnalogyMech_conditionalMod3Combo }
];
function generateAnalogy(tier){
  const pool = IQ_ANALOGY_MECHANICS.filter(m => m.minTier <= tier);
  return pickOne(pool).fn();
}

registerIQCategory({
  key: 'analogy',
  icon: '🔗',
  title: 'אנלוגיות צורות',
  subtitle: 'איזה שינוי מתאים?',
  renderQuestion(tier, promptEl, optionsEl, onAnswer){
    const { A, Aprime, B, correctBprime, wrongBprimes } = generateAnalogy(tier);
    promptEl.innerHTML =
      '<div class="iq-prompt-label">השלימו את האנלוגיה:</div>' +
      '<div class="iq-analogy-row">' +
        '<div class="iq-tile iq-tile-shape">'+renderShapeSVG(A)+'</div>' +
        '<div class="iq-arrow">←</div>' +
        '<div class="iq-tile iq-tile-shape">'+renderShapeSVG(Aprime)+'</div>' +
        '<div class="iq-analogy-sep">::</div>' +
        '<div class="iq-tile iq-tile-shape">'+renderShapeSVG(B)+'</div>' +
        '<div class="iq-arrow">←</div>' +
        '<div class="iq-tile iq-tile-blank">?</div>' +
      '</div>';
    const safeDistractors = iqSanitizeDistractors(correctBprime, wrongBprimes);
    const options = [{ html: renderShapeSVG(correctBprime), isCorrect: true }]
      .concat(safeDistractors.map(d => ({ html: renderShapeSVG(d), isCorrect: false })));
    renderIQMultipleChoice(optionsEl, options, onAnswer);
  }
});

/* ============ Category: matrix completion ============ */
// Modeled on real figure-matrix IQ questions (CogAT figure matrices, Raven's-style
// progressive matrices), with genuinely INDEPENDENT attributes rather than one
// rule in disguise: shape cycles diagonally (depends on row AND column), color
// is fixed per column only, rotation is fixed per row only, count is fixed per
// anti-diagonal only, and (at the hardest tiers) scale adds a fifth axis - each
// one a piece of information that can't be inferred from the others. Difficulty
// climbs via grid size, number of independent axes, and non-linear (triangular)
// growth on the rotation axis.
function generateThreeAxisMatrix(N, growingRotation){
  // Shapes drawn only from rotatable types (never circle) so the per-row
  // rotation always stays legible; marker:true removes any remaining ambiguity
  // regardless of which shape lands where on the diagonal.
  const shapePool = shuffle(IQ_ROTATABLE_SHAPES.slice()).slice(0, N);
  const colorPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, N);
  const baseStep = pickOne([40, 45, 50, 60, 70]);
  const rotFor = (r) => growingRotation ? ((r*(r+1))/2) * baseStep : r * baseStep;

  const grid = [];
  for (let r = 0; r < N; r++){
    const row = [];
    for (let c = 0; c < N; c++){
      row.push({ type: shapePool[(r+c) % N], color: colorPool[c], rotation: rotFor(r), marker: true });
    }
    grid.push(row);
  }

  const correct = grid[N-1][N-1];
  const distractors = [
    Object.assign({}, correct, { rotation: rotFor(N-2) }),                                            // right shape+color, stale (previous row's) rotation
    { type: shapePool[(N-2+N-2) % N], color: correct.color, rotation: correct.rotation, marker: true }, // wrong shape (continued the previous row's diagonal)
    { type: correct.type, color: colorPool[(N-1+N-2) % N], rotation: correct.rotation, marker: true }   // wrong color (treated it as diagonal too)
  ];

  return { grid, N, correct, distractors };
}

// One level beyond the three-axis grid: a FOURTH independent axis (count),
// indexed by the anti-diagonal (r - c) so it can't be inferred from shape
// (r+c diagonal), color (column) or rotation (row) - four pieces of
// information, none derivable from the others.
function generateFourAxisMatrix(N, growingRotation){
  const shapePool = shuffle(IQ_ROTATABLE_SHAPES.slice()).slice(0, N);
  const colorPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, N);
  const countPool = Array.from({ length: N }, (_, i) => i + 1);
  const baseStep = pickOne([35, 40, 45]);
  const rotFor = (r) => growingRotation ? ((r*(r+1))/2) * baseStep : r * baseStep;
  const antiDiag = (r, c) => ((r - c) % N + N) % N;

  const grid = [];
  for (let r = 0; r < N; r++){
    const row = [];
    for (let c = 0; c < N; c++){
      row.push({ type: shapePool[(r+c) % N], color: colorPool[c], rotation: rotFor(r), count: countPool[antiDiag(r, c)], marker: true });
    }
    grid.push(row);
  }

  const correct = grid[N-1][N-1];
  const distractors = [
    Object.assign({}, correct, { rotation: rotFor(N-2) }),                                     // stale rotation
    Object.assign({}, correct, { count: countPool[antiDiag(N-2, N-1)] }),                      // wrong count (borrowed from elsewhere in the grid)
    { type: shapePool[(N-2+N-2) % N], color: correct.color, rotation: correct.rotation, count: correct.count, marker: true } // wrong shape
  ];

  return { grid, N, correct, distractors };
}

// One level beyond even the four-axis grid: a FIFTH independent axis (scale),
// indexed by yet another modular combination (r + 2c) so it reads as its own
// dimension rather than a repeat of shape/color/rotation/count.
function generateFiveAxisMatrix(N, growingRotation){
  const shapePool = shuffle(IQ_ROTATABLE_SHAPES.slice()).slice(0, N);
  const colorPool = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, N);
  const countPool = Array.from({ length: N }, (_, i) => i + 1);
  const scalePool = Array.from({ length: N }, (_, i) => Math.round((0.7 + i * (0.6 / (N-1))) * 100) / 100);
  const baseStep = pickOne([30, 35, 40]);
  const rotFor = (r) => growingRotation ? ((r*(r+1))/2) * baseStep : r * baseStep;
  const antiDiag = (r, c) => ((r - c) % N + N) % N;
  const scaleDiag = (r, c) => ((r + 2*c) % N + N) % N;

  const grid = [];
  for (let r = 0; r < N; r++){
    const row = [];
    for (let c = 0; c < N; c++){
      row.push({
        type: shapePool[(r+c) % N], color: colorPool[c], rotation: rotFor(r),
        count: countPool[antiDiag(r, c)], scale: scalePool[scaleDiag(r, c)], marker: true
      });
    }
    grid.push(row);
  }

  const correct = grid[N-1][N-1];
  const distractors = [
    Object.assign({}, correct, { rotation: rotFor(N-2) }),                      // stale rotation
    Object.assign({}, correct, { count: countPool[antiDiag(N-2, N-1)] }),       // wrong count
    Object.assign({}, correct, { scale: scalePool[scaleDiag(N-2, N-1)] })       // wrong scale
  ];

  return { grid, N, correct, distractors };
}

// Several small colored PARTS sit in fixed slots inside a cell; going from A
// to A' rearranges WHERE each part sits (a spatial permutation), and the same
// rearrangement rule must be applied to B's (differently colored/shaped)
// parts to find the answer. hardMode forces a full derangement (every single
// part must move - nothing stays in place to anchor on), which is far harder
// to read at a glance than a permutation that happens to fix a part or two.
function generateCompositeRearrangeMatrix(n, hardMode){
  let perm = iqRandomPermutation(n, true);
  if (hardMode){
    let guard = 0;
    while (guard < 50 && perm.some((v, i) => v === i)){ perm = iqRandomPermutation(n, true); guard++; }
  }
  const A = iqRandomParts(n);
  const Aprime = iqApplyPermToParts(A, perm);
  const B = iqRandomParts(n);
  const correct = iqApplyPermToParts(B, perm);

  const invPerm = iqInvertPermutation(perm);
  let otherPerm;
  let guard = 0;
  do { otherPerm = iqRandomPermutation(n, true); guard++; }
  while (guard < 30 && otherPerm.join(',') === perm.join(','));

  const distractors = [
    B.slice(),                             // did nothing - no rearrangement at all
    iqApplyPermToParts(B, invPerm),         // undid the rule instead of applying it
    iqApplyPermToParts(B, otherPerm)        // applied a different rearrangement
  ];
  const safeDistractors = iqSanitizeCompositeDistractors(correct, distractors, n);

  return { kind: 'composite', n, A, Aprime, B, correct, distractors: safeDistractors };
}

// Difficulty ladder shifted up again: what used to be tier 5 (three-axis,
// non-linear rotation) is now tier 1, what used to be tier 6/7 (the fourth
// axis) are now tiers 2/3, and four brand-new, harder-still tiers sit above
// that - a genuine fifth axis (scale), then that fifth axis combined with
// non-linear rotation and bigger grids, alongside a composite-rearrangement
// puzzle that escalates in lockstep (more parts, then forced derangements).
function generateMatrix(tier){
  // Every tier mixes the classic Latin-square grid with the composite
  // rearrangement puzzle, so a run of questions at the same level is never
  // just "the same formula with different shapes" - the underlying TASK itself
  // varies too.
  if (Math.random() < 0.35){
    const n = tier <= 2 ? 4 : (tier <= 4 ? 5 : 6);
    const hardMode = tier >= 6;
    return generateCompositeRearrangeMatrix(n, hardMode);
  }
  if (tier === 1) return Object.assign({ kind: 'latin' }, generateThreeAxisMatrix(4, true));  // was the old tier 5
  if (tier === 2){
    // was the old tier 6: a fourth independent axis (count), or a bigger
    // (5x5) three-axis grid with non-linear rotation.
    const pick = pickOne(['fourAxis', 'biggerThreeAxis']);
    return Object.assign({ kind: 'latin' }, pick === 'fourAxis' ? generateFourAxisMatrix(4, false) : generateThreeAxisMatrix(5, true));
  }
  if (tier === 3){
    // was the old tier 7: the fourth axis at 5x5, or a 4x4 four-axis grid with
    // non-linear rotation growth on top.
    const pick = pickOne(['bigFourAxis', 'nonLinearFourAxis']);
    return Object.assign({ kind: 'latin' }, pick === 'bigFourAxis' ? generateFourAxisMatrix(5, false) : generateFourAxisMatrix(4, true));
  }
  if (tier === 4) return Object.assign({ kind: 'latin' }, generateFiveAxisMatrix(4, false)); // NEW: a genuine fifth independent axis (scale)
  if (tier === 5) return Object.assign({ kind: 'latin' }, generateFiveAxisMatrix(5, false)); // NEW: bigger five-axis grid
  if (tier === 6) return Object.assign({ kind: 'latin' }, generateFiveAxisMatrix(4, true));  // NEW: five axes + non-linear rotation
  return Object.assign({ kind: 'latin' }, generateFiveAxisMatrix(5, true));                  // NEW tier 7 (hardest): big + five axes + non-linear rotation
}

// NOTE: this category is no longer registered here - `matrix` (key) is now
// registered once, merged, from js/iq-matrix3.js: tiers 1-10 are the hand-authored
// 3x3 syllabus (iqm3Stage1..10), tiers 11-17 continue into this file's procedural
// NxN axis-combination engine via generateMatrix(tier-10). The generator
// functions above (generateMatrix, generateThreeAxisMatrix, etc.) are kept here
// and called from there.
