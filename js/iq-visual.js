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
//   3. symmetry - 3 shapes are built by actually mirroring a jagged outline
//      across one of four axes (vertical, horizontal or either diagonal), so they
//      are exactly, not approximately, symmetric; the 4th starts from a symmetric
//      outline and has ONE vertex moved, and is verified to be at least a minimum
//      margin away from symmetry about every one of the four axes.
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
// pixel-identical to one of the "rotation" options. A later 22x20 notch fixed
// the exact-duplicate bug but was still too close to square (only a 2-unit
// difference between its own width and height), so the mirrored option's
// notch - even when mathematically distinct - looked only a few pixels
// different from a normal rotation sharing the same corner. This 22x10 notch
// (over twice as wide as it is tall) makes that difference obvious at a
// glance, not just provable on paper - verified below, by actual geometric
// comparison against all 4 rotations and all 4 rotations of its mirror image,
// not by assumption.
const IQ_ODD_FLAG_BASE = [[-24,-24], [24,-24], [24,14], [2,14], [2,24], [-24,24]];

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
// The notch's inner corner (the "reflex vertex") is the one point, of the 6,
// that sits on NEITHER the min NOR the max of the shape's own bounding box in
// either axis - every other point is a bounding-box extreme. This does NOT
// assume there is exactly one such point; it asserts it, and throws if that
// assumption is ever violated by a future edit to the shape, instead of
// silently picking an arbitrary candidate.
function iqOddReflexVertex(pts){
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const tol = 0.5;
  const candidates = pts.filter(([x,y]) =>
    Math.abs(x-minX) > tol && Math.abs(x-maxX) > tol && Math.abs(y-minY) > tol && Math.abs(y-maxY) > tol);
  if (candidates.length !== 1){
    throw new Error('iqOddReflexVertex: expected exactly 1 reflex vertex, found ' + candidates.length + ' - the shape may have changed shape.');
  }
  return candidates[0];
}
// Which of the 4 quadrants (relative to the polygon's own center) the notch
// currently points toward - this is what a player actually SEES as "which
// corner is cut", independent of exact proportions. Two options whose notch
// sits in the same quadrant are visually confusable even if their polygons
// are mathematically distinct (different notch proportions) - see
// iqOddVerifyExactlyOneOdd, which rejects that case for the orientation rule.
function iqOddNotchQuadrant(pts){
  const p = iqOddReflexVertex(pts);
  return (p[0] >= 0 ? 'R' : 'L') + (p[1] >= 0 ? 'B' : 'T');
}
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
  const missingAngle = rotPool[3]; // the one rotation NOT shown as a "normal" option
  // Mirroring reverses handedness, so mirror(r)'s notch always lands in the
  // SAME quadrant as unmirrored(r+90) - verified empirically against
  // iqOddRotatePoints/iqOddMirrorPoints for this exact shape (not assumed).
  // Solving for the oddRot whose mirrored notch lands where unmirrored
  // (missingAngle) would have - the one quadrant guaranteed unused by the 3
  // normal rotations - guarantees the mirrored option's notch sits in a
  // visually distinct corner from all three, not just a different polygon.
  // This holds at every tier, so there is no separate easy/hard branch here.
  const oddRot = (missingAngle - 90 + 360) % 360;
  const oddIndex = randInt(0, 3);
  const items = normalRots.map(r => ({ kind: 'orientation', pts: iqOddRotatePoints(IQ_ODD_FLAG_BASE, r), color, strokeWidth, size }));
  items.splice(oddIndex, 0, { kind: 'orientation', pts: iqOddRotatePoints(iqOddMirrorPoints(IQ_ODD_FLAG_BASE), oddRot), color, strokeWidth, size });
  return { items, oddIndex, family: 'orientation', variant: 'flag',
    structureKey: 'orientation:flag:rots=' + normalRots.slice().sort((a, b) => a - b).join(',') + ':mirror=' + oddRot,
    explanation: IQ_ODD_ORIENT_EXPLANATION };
}

// ---- orientation, cell-shape variants: a chiral polyomino instead of the flag ----
// Same rule as the flag (three rotations of one shape, one mirror image), but the shape comes from a
// small library of polyominoes written as ASCII patterns ('#' = cell). Each pattern is checked when
// the script loads: edge-connected, no hole, no pinched corner, bounding box at most 4x4 cells, and
// NO rotational and NO mirror symmetry (so a mirror image can never be mistaken for a rotation).
// A cell is 12 flag-units = 21 viewBox units (about 9px on a phone), the same for every pattern.
const IQ_ODD_CELL = 12;
const IQ_ODD_CELL_SHAPES = {
  5: [['####', '#...'], ['####', '.#..'], ['###', '##.'], ['.###', '##..'], ['.#.', '###', '#..']],
  6: [['.###', '##..', '#...'], ['####', '#...', '#...'], ['####', '.#..', '.#..'], ['##..', '.###', '.#..'],
      ['.###', '##..', '.#..'], ['####', '##..'], ['.#..', '####', '#...'], ['####', '#.#.']],
  7: [['.#..', '####', '#...', '#...'], ['...#', '...#', '.###', '##..'], ['##..', '####', '#...'], ['#...', '#...', '####', '#...'],
      ['#...', '####', '#.#.'], ['####', '##..', '#...'], ['.#..', '####', '##..'], ['####', '##..', '.#..']]
};
// variants: key, number of cells, first tier (all enabled; see the registration below).
const IQ_ODD_ORIENT_CELL_VARIANTS = [
  { key: 'cells-5', cells: 5, minTier: 2 },
  { key: 'cells-6', cells: 6, minTier: 3 },
  { key: 'cells-7', cells: 7, minTier: 5 }
];
const IQ_ODD_CELL_MIN_XOR = 0.21;   // smallest allowed difference between any two options, as a share of the shape's area (the accepted flag's own value)
const IQ_ODD_ORIENT_EXPLANATION = 'שלוש הצורות הן אותה צורה מסובבת בזוויות שונות - הצורה שנבחרה היא תמונת ראי (שיקוף), לא סיבוב.';

function iqOddCellSet(pattern){
  const cells = [];
  pattern.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.push([x, y]); });
  return cells;
}
// Boundary of an edge-connected, hole-free, pinch-free cell set as one polygon (collinear points merged),
// centred on its bounding box and scaled to flag-units.
function iqOddCellOutline(cells){
  const has = new Set(cells.map(c => c[0] + ',' + c[1]));
  const next = new Map();
  const edge = (x1, y1, x2, y2) => next.set(x1 + ',' + y1, [x2, y2]);
  cells.forEach(([x, y]) => {
    if (!has.has(x + ',' + (y-1))) edge(x, y, x+1, y);
    if (!has.has((x+1) + ',' + y)) edge(x+1, y, x+1, y+1);
    if (!has.has(x + ',' + (y+1))) edge(x+1, y+1, x, y+1);
    if (!has.has((x-1) + ',' + y)) edge(x, y+1, x, y);
  });
  const start = next.keys().next().value.split(',').map(Number);
  const ring = [start];
  for (let p = next.get(start.join(',')); p[0] !== start[0] || p[1] !== start[1]; p = next.get(p.join(','))) ring.push(p);
  if (ring.length !== next.size) throw new Error('iqOddCellOutline: the cell set does not have a single simple outline.');
  const corners = ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length], b = ring[(i + 1) % ring.length];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
  const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return corners.map(([x, y]) => [(x - cx) * IQ_ODD_CELL, (y - cy) * IQ_ODD_CELL]);
}
// Shape mask on a 3-unit sample grid (16x16 over the +-24 flag-unit tile), even-odd rule. Rotations by
// multiples of 90 degrees keep every edge on a multiple of 6 from the centre, so no sample sits on an edge.
function iqOddPolyMask(pts){
  const bits = [];
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++){
    const px = -22.5 + 3*i, py = -22.5 + 3*j;
    let inside = false;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++){
      const [xa, ya] = pts[a], [xb, yb] = pts[b];
      if ((ya > py) !== (yb > py) && px < (xb - xa) * (py - ya) / (yb - ya) + xa) inside = !inside;
    }
    bits.push(inside ? 1 : 0);
  }
  return bits;
}
function iqOddMaskXor(a, b){ let d = 0, area = 0; for (let i = 0; i < a.length; i++){ if (a[i] !== b[i]) d++; area += a[i]; } return d / area; }
const iqOddCellRotations = pts => [0, 90, 180, 270].map(r => iqOddRotatePoints(pts, r));
// The library, validated once at load: a bad pattern fails loudly here instead of reaching a child.
const IQ_ODD_CELL_LIBRARY = (function(){
  const lib = {};
  Object.keys(IQ_ODD_CELL_SHAPES).forEach(n => {
    lib[n] = IQ_ODD_CELL_SHAPES[n].map((pattern, idx) => {
      const name = 'IQ_ODD_CELL_SHAPES[' + n + '][' + idx + ']';
      const cells = iqOddCellSet(pattern);
      if (cells.length !== Number(n)) throw new Error(name + ' has ' + cells.length + ' cells, expected ' + n + '.');
      if (Math.max(...pattern.map(r => r.length), pattern.length) > 4) throw new Error(name + ' is wider or taller than 4 cells.');
      const key = c => c[0] + ',' + c[1], set = new Set(cells.map(key));
      const seen = new Set([key(cells[0])]), stack = [cells[0]];
      while (stack.length){
        const [x, y] = stack.pop();
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => { const q = [x+dx, y+dy]; if (set.has(key(q)) && !seen.has(key(q))){ seen.add(key(q)); stack.push(q); } });
      }
      if (seen.size !== cells.length) throw new Error(name + ' is not edge-connected.');
      // diagonal-only contact (pinched corner) would make the outline touch itself
      cells.forEach(([x, y]) => [[1,1],[1,-1]].forEach(([dx, dy]) => {
        if (set.has(key([x+dx, y+dy])) && !set.has(key([x+dx, y])) && !set.has(key([x, y+dy]))) throw new Error(name + ' has a pinched corner.');
      }));
      const outline = iqOddCellOutline(cells);            // throws on a hole
      const rots = iqOddCellRotations(outline), mirs = iqOddCellRotations(iqOddMirrorPoints(outline));
      for (let i = 0; i < 4; i++){
        for (let j = i+1; j < 4; j++) if (iqOddPolygonsCongruent(rots[i], rots[j])) throw new Error(name + ' has rotational symmetry.');
        for (let j = 0; j < 4; j++) if (iqOddPolygonsCongruent(rots[i], mirs[j])) throw new Error(name + ' has a mirror axis.');
      }
      return { name, outline, masks: rots.map(iqOddPolyMask), mirrorMasks: mirs.map(iqOddPolyMask) };
    });
  });
  return lib;
})();
// Every usable question of a variant: a library shape, which 3 of its 4 rotations are shown, and which
// mirror-rotation is the odd one - kept only if every two of the four options differ by at least
// IQ_ODD_CELL_MIN_XOR of the shape's area. Computed once per variant.
const IQ_ODD_CELL_STRUCTURES = {};
function iqOddCellStructures(def){
  if (IQ_ODD_CELL_STRUCTURES[def.key]) return IQ_ODD_CELL_STRUCTURES[def.key];
  const list = [];
  IQ_ODD_CELL_LIBRARY[def.cells].forEach((shape, shapeIdx) => {
    for (let missing = 0; missing < 4; missing++) for (let mirrorRot = 0; mirrorRot < 4; mirrorRot++){
      const normals = [0, 1, 2, 3].filter(r => r !== missing);
      const masks = normals.map(r => shape.masks[r]).concat([shape.mirrorMasks[mirrorRot]]);
      let least = Infinity;
      for (let i = 0; i < 4; i++) for (let j = i+1; j < 4; j++) least = Math.min(least, iqOddMaskXor(masks[i], masks[j]));
      if (least >= IQ_ODD_CELL_MIN_XOR) list.push({ shapeIdx, normals, mirrorRot });
    }
  });
  IQ_ODD_CELL_STRUCTURES[def.key] = list;
  return list;
}
function iqOddGenCellOrientation(def){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const q = pickOne(iqOddCellStructures(def));
  const shape = IQ_ODD_CELL_LIBRARY[def.cells][q.shapeIdx];
  const oddIndex = randInt(0, 3);
  const items = shuffle(q.normals.slice()).map(r => ({ kind: 'orientation', pts: iqOddRotatePoints(shape.outline, r*90), color, strokeWidth, size }));
  items.splice(oddIndex, 0, { kind: 'orientation', pts: iqOddRotatePoints(iqOddMirrorPoints(shape.outline), q.mirrorRot*90), color, strokeWidth, size });
  return { items, oddIndex, family: 'orientation', variant: def.key,
    structureKey: 'orientation:' + def.key + ':shape=' + q.shapeIdx + ':rots=' + q.normals.join(',') + ':mirror=' + q.mirrorRot*90,
    explanation: IQ_ODD_ORIENT_EXPLANATION };
}
// Rule check for the cell variants. The reference shape is one of the three normals; the odd option must
// be its mirror image and not a rotation of it, every option must be a library shape of this variant's
// size, and every two options must differ by at least IQ_ODD_CELL_MIN_XOR of the shape's area.
function iqOddVerifyCellOrientation(result, def){
  const odd = result.oddIndex, ref = result.items[odd === 0 ? 1 : 0].pts;
  const refRots = iqOddCellRotations(ref), refMirRots = iqOddCellRotations(iqOddMirrorPoints(ref));
  const isRotation = pts => refRots.some(r => iqOddPolygonsCongruent(pts, r));
  if (!iqOddExactlyOneBreaks(result, it => isRotation(it.pts))) return false;
  if (!refMirRots.some(r => iqOddPolygonsCongruent(result.items[odd].pts, r))) return false;
  const refMask = JSON.stringify(iqOddPolyMask(ref));
  if (!IQ_ODD_CELL_LIBRARY[def.cells].some(s => s.masks.some(m => JSON.stringify(m) === refMask) || s.mirrorMasks.some(m => JSON.stringify(m) === refMask))) return false;
  const masks = result.items.map(it => iqOddPolyMask(it.pts));
  for (let i = 0; i < 4; i++) for (let j = i+1; j < 4; j++) if (iqOddMaskXor(masks[i], masks[j]) < IQ_ODD_CELL_MIN_XOR) return false;
  return true;
}

// ---- equal parts: a whole shape cut into pieces - EQUAL (congruent) in three options, unequal in one ----
// Every option is the same whole (a square or a circle) cut into the same number of pieces. Equal drawings
// come from a small catalog of symmetric cuts; the odd option keeps the cut STYLE of one of the normals
// (strips stay strips, a cross stays a cross, sectors stay sectors) but moves the cut so the pieces are
// clearly unequal (smallest piece at most 0.65 of the largest) while the figure keeps a mirror axis, so
// "the only lopsided drawing" is not the giveaway. The four drawings are always pairwise different.
// Pieces are plain polygons (circle arcs are polygonised, 5 degrees per step) drawn with a dark outline,
// so neighbouring pieces meet in a 3-unit cut line.
const IQ_ODD_PARTS_C = 50, IQ_ODD_PARTS_R = 38;             // tile centre; half side of the square / radius of the circle
const IQ_ODD_PARTS_MAX_RATIO = 0.65;                        // odd option: smallest piece / largest piece
const IQ_ODD_PARTS_EQUAL_RATIO = 0.985;
const IQ_ODD_PARTS_MIN_THICK = 7;                           // 2 x area / perimeter of every piece, in viewBox units
const IQ_ODD_PARTS_EXPLANATION = 'בשלוש הצורות החלוקה היא לחלקים שווים - בצורה שנבחרה החלקים אינם שווים.';

function iqOddPolyArea(pts){
  let a = 0;
  for (let i = 0; i < pts.length; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i+1) % pts.length]; a += x1*y2 - x2*y1; }
  return Math.abs(a) / 2;
}
function iqOddPolyPerimeter(pts){
  return pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i+1) % pts.length][0], p[1] - pts[(i+1) % pts.length][1]), 0);
}
function iqOddPolyCentroid(pts){
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i+1) % pts.length]; const f = x1*y2 - x2*y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; }
  return [cx / (3*a), cy / (3*a)];
}
// two pieces are congruent when area, perimeter and the sorted vertex distances from the centroid agree (translation/rotation/reflection)
function iqOddPiecesCongruent(a, b){
  const sa = iqOddPolyArea(a), sb = iqOddPolyArea(b);
  if (Math.abs(sa - sb) / sa > 0.015 || Math.abs(iqOddPolyPerimeter(a) - iqOddPolyPerimeter(b)) / iqOddPolyPerimeter(a) > 0.015) return false;
  const dist = pts => { const [cx, cy] = iqOddPolyCentroid(pts); return pts.map(q => Math.hypot(q[0] - cx, q[1] - cy)).sort((x, y) => x - y); };
  const da = dist(a), db = dist(b), at = (d, f) => d[Math.min(d.length - 1, Math.floor(f * (d.length - 1)))];
  return [0, 0.5, 1].every(f => Math.abs(at(da, f) - at(db, f)) < 0.6);
}
// ----- builders: pieces as lists of [x, y] in tile coordinates -----
const iqOddSqPt = (fx, fy) => [IQ_ODD_PARTS_C - IQ_ODD_PARTS_R + fx * 2 * IQ_ODD_PARTS_R, IQ_ODD_PARTS_C - IQ_ODD_PARTS_R + fy * 2 * IQ_ODD_PARTS_R];
const iqOddSqRect = (x0, y0, x1, y1) => [iqOddSqPt(x0, y0), iqOddSqPt(x1, y0), iqOddSqPt(x1, y1), iqOddSqPt(x0, y1)];
function iqOddSqStrips(dir, cuts){
  const b = [0].concat(cuts, [1]);
  return b.slice(1).map((e, i) => (dir === 'v' ? iqOddSqRect(b[i], 0, e, 1) : iqOddSqRect(0, b[i], 1, e)));
}
function iqOddSqCross(cx, cy){
  return [iqOddSqRect(0, 0, cx, cy), iqOddSqRect(cx, 0, 1, cy), iqOddSqRect(cx, cy, 1, 1), iqOddSqRect(0, cy, cx, 1)];
}
function iqOddSqDiagonal(kind){
  const [tl, tr, br, bl] = [iqOddSqPt(0, 0), iqOddSqPt(1, 0), iqOddSqPt(1, 1), iqOddSqPt(0, 1)];
  return kind === 'a' ? [[tl, tr, br], [tl, br, bl]] : [[tr, br, bl], [tr, bl, tl]];
}
function iqOddSqX(){
  const [tl, tr, br, bl, m] = [iqOddSqPt(0, 0), iqOddSqPt(1, 0), iqOddSqPt(1, 1), iqOddSqPt(0, 1), iqOddSqPt(0.5, 0.5)];
  return [[tl, tr, m], [tr, br, m], [br, bl, m], [bl, tl, m]];
}
function iqOddCircleArc(a0, a1){                               // points from angle a0 to a1 (degrees) on the circle, at most 5 degrees apart
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 5)), pts = [];
  for (let i = 0; i <= steps; i++){ const a = (a0 + (a1 - a0) * i / steps) * Math.PI / 180; pts.push([IQ_ODD_PARTS_C + IQ_ODD_PARTS_R * Math.cos(a), IQ_ODD_PARTS_C + IQ_ODD_PARTS_R * Math.sin(a)]); }
  return pts;
}
function iqOddCircleSectors(startDeg, angles){                  // sectors from the centre, consecutive, starting at startDeg
  const out = []; let a = startDeg;
  angles.forEach(w => { out.push([[IQ_ODD_PARTS_C, IQ_ODD_PARTS_C]].concat(iqOddCircleArc(a, a + w))); a += w; });
  return out;
}
function iqOddClipHalfPlane(poly, nx, ny, d){                   // keep the part with nx*x + ny*y >= d (coordinates about the tile centre)
  const out = [], f = p => nx * (p[0] - IQ_ODD_PARTS_C) + ny * (p[1] - IQ_ODD_PARTS_C) - d;
  for (let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i+1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)){ const t = fa / (fa - fb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
function iqOddCircleCross(rotDeg, chordOffset){                 // vertical diameter + horizontal line at `chordOffset` below the centre, then rotated
  const whole = iqOddCircleArc(0, 360).slice(0, -1);
  const pieces = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]){
    let q = iqOddClipHalfPlane(whole, sx, 0, 0);
    q = iqOddClipHalfPlane(q, 0, sy, sy * chordOffset);
    pieces.push(q);
  }
  const t = rotDeg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return pieces.map(q => q.map(([x, y]) => { const dx = x - IQ_ODD_PARTS_C, dy = y - IQ_ODD_PARTS_C; return [IQ_ODD_PARTS_C + dx*c - dy*s, IQ_ODD_PARTS_C + dx*s + dy*c]; }));
}
// ----- the catalog: per variant, the equal drawings (id, cut family) and the odd options (family + levels) -----
const IQ_ODD_PARTS_T2 = [0.22, 0.30, 0.36, 0.64, 0.70, 0.78];  // where one cut sits instead of 0.5 (pieces 0.28 .. 0.56 of each other)
const IQ_ODD_PARTS_VARIANTS = [
  { key: 'square-2', n: 2, whole: 'square', minTier: 2,
    equal: [
      { id: 'v', family: 'v', pieces: () => iqOddSqStrips('v', [0.5]) },
      { id: 'h', family: 'h', pieces: () => iqOddSqStrips('h', [0.5]) },
      { id: 'da', family: 'da', pieces: () => iqOddSqDiagonal('a') },
      { id: 'db', family: 'db', pieces: () => iqOddSqDiagonal('b') }],
    odd: [
      { family: 'v', levels: IQ_ODD_PARTS_T2, pieces: t => iqOddSqStrips('v', [t]) },
      { family: 'h', levels: IQ_ODD_PARTS_T2, pieces: t => iqOddSqStrips('h', [t]) }] },
  { key: 'square-4', n: 4, whole: 'square', minTier: 3,
    equal: [
      { id: 'v', family: 'v', pieces: () => iqOddSqStrips('v', [0.25, 0.5, 0.75]) },
      { id: 'h', family: 'h', pieces: () => iqOddSqStrips('h', [0.25, 0.5, 0.75]) },
      { id: 'cross', family: 'cross', pieces: () => iqOddSqCross(0.5, 0.5) },
      { id: 'x', family: 'x', pieces: () => iqOddSqX() }],
    odd: [
      { family: 'v', levels: [0.14, 0.18, 0.32, 0.36], pieces: a => iqOddSqStrips('v', [a, 0.5, 1 - a]) },
      { family: 'h', levels: [0.14, 0.18, 0.32, 0.36], pieces: a => iqOddSqStrips('h', [a, 0.5, 1 - a]) },
      { family: 'cross', levels: IQ_ODD_PARTS_T2.map(t => [0.5, t]).concat(IQ_ODD_PARTS_T2.map(t => [t, 0.5])), pieces: ([cx, cy]) => iqOddSqCross(cx, cy) }] },
  { key: 'circle-3', n: 3, whole: 'circle', minTier: 4,
    equal: [0, 30, 60, 90].map(r => ({ id: 'y' + r, family: 'y', pieces: () => iqOddCircleSectors(r - 90, [120, 120, 120]) })),
    odd: [{ family: 'y', levels: [60, 70, 80].flatMap(a => [0, 60, 120, 180, 240, 300].map(r => [a, r])), pieces: ([a, r]) => iqOddCircleSectors(r - 90 - a / 2, [a, 360 - 2 * a, a]) }] },
  { key: 'circle-4', n: 4, whole: 'circle', minTier: 4,
    equal: [0, 22.5, 45, 67.5].map(r => ({ id: 'c' + r, family: 'cc', pieces: () => iqOddCircleCross(r, 0) })),
    odd: [{ family: 'cc', levels: [0, 45].flatMap(r => [0.30, 0.36, 0.64, 0.70].map(t => [r, (t - 0.5) * 2 * IQ_ODD_PARTS_R])), pieces: ([r, off]) => iqOddCircleCross(r, off) }] }
];
// Every question of a variant: 3 of the equal drawings as the normals + one odd option whose cut family is among them.
const IQ_ODD_PARTS_STRUCTURES = {};
function iqOddPartsStructures(def){
  if (IQ_ODD_PARTS_STRUCTURES[def.key]) return IQ_ODD_PARTS_STRUCTURES[def.key];
  const list = [], ids = def.equal.map(e => e.id);
  for (let skip = 0; skip < ids.length; skip++){
    const normals = ids.filter((_, i) => i !== skip);
    const families = new Set(normals.map(id => def.equal.find(e => e.id === id).family));
    def.odd.forEach((o, oi) => { if (!families.has(o.family)) return; o.levels.forEach((_, li) => list.push({ normals, oddIdx: oi, level: li })); });
  }
  IQ_ODD_PARTS_STRUCTURES[def.key] = list;
  return list;
}
function iqOddGenParts(def){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const q = pickOne(iqOddPartsStructures(def));
  const odd = def.odd[q.oddIdx];
  const items = shuffle(q.normals.slice()).map(id => { const e = def.equal.find(x => x.id === id); return { kind: 'parts', family: e.family, pieces: e.pieces(), color, strokeWidth, size }; });
  const oddIndex = randInt(0, 3);
  items.splice(oddIndex, 0, { kind: 'parts', family: odd.family, pieces: odd.pieces(odd.levels[q.level]), color, strokeWidth, size });
  return { items, oddIndex, family: 'parts', variant: def.key,
    structureKey: 'parts:' + def.key + ':' + q.normals.slice().sort().join('+') + ':' + odd.family + '#' + q.level,
    explanation: IQ_ODD_PARTS_EXPLANATION };
}
function iqOddRenderParts(item){
  const size = item.size || 100, k = size / 100;
  const polys = item.pieces.map(pts => '<polygon points="' + pts.map(([x, y]) => (x*k).toFixed(1) + ',' + (y*k).toFixed(1)).join(' ') + '" fill="' + item.color + '" stroke="#1a1a2e" stroke-width="' + item.strokeWidth + '" stroke-linejoin="round"/>').join('');
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + polys + '</svg>';
}
function iqOddVerifyParts(result){
  const def = IQ_ODD_PARTS_VARIANTS.find(v => v.key === result.variant);
  if (!def) return false;
  const R = IQ_ODD_PARTS_R, C = IQ_ODD_PARTS_C;
  const wholeArea = def.whole === 'square' ? 4*R*R : iqOddPolyArea(iqOddCircleArc(0, 360).slice(0, -1));
  for (const it of result.items){
    if (!Array.isArray(it.pieces) || it.pieces.length !== def.n) return false;
    let total = 0;
    for (const q of it.pieces){
      if (!Array.isArray(q) || q.length < 3 || !q.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))) return false;
      const inside = def.whole === 'square' ? q.every(p => Math.abs(p[0] - C) <= R + 0.01 && Math.abs(p[1] - C) <= R + 0.01) : q.every(p => Math.hypot(p[0] - C, p[1] - C) <= R + 0.01);
      if (!inside) return false;
      const a = iqOddPolyArea(q);
      if (!(2 * a / iqOddPolyPerimeter(q) >= IQ_ODD_PARTS_MIN_THICK)) return false;
      total += a;
    }
    if (Math.abs(total - wholeArea) / wholeArea > 0.006) return false;   // the pieces tile the whole
  }
  const isEqual = it => {
    const areas = it.pieces.map(iqOddPolyArea);
    return Math.min(...areas) / Math.max(...areas) >= IQ_ODD_PARTS_EQUAL_RATIO && it.pieces.every(q => iqOddPiecesCongruent(q, it.pieces[0]));
  };
  if (!iqOddExactlyOneBreaks(result, isEqual)) return false;
  const oddAreas = result.items[result.oddIndex].pieces.map(iqOddPolyArea);
  if (Math.min(...oddAreas) / Math.max(...oddAreas) > IQ_ODD_PARTS_MAX_RATIO) return false;
  // the odd option's cut family also appears among the normals, and the four drawings are pairwise different
  const normals = result.items.filter((_, i) => i !== result.oddIndex);
  if (!normals.some(it => it.family === result.items[result.oddIndex].family)) return false;
  const drawing = it => it.pieces.map(q => iqOddPolyCentroid(q).map(v => v.toFixed(0)).join(',')).sort().join('|');
  return new Set(result.items.map(drawing)).size === 4;
}

// ---- property classification: three shapes share a geometric property, one does not ----
// Quadrilaterals and right-angle triangles. Every shape is built from coordinates with free parameters,
// tilted by a random angle (the same distribution for all four options), and scaled so all four have
// the SAME AREA. Each measured property of each option must be CLEARLY present (within 0.6 degrees /
// 1% length) or CLEARLY absent (angles 12+ degrees off, lengths 15+% apart), so no option is "nearly"
// anything. A property audit then rejects any question where some other property splits the four
// options 3-1 but the lone option is NOT the intended odd one (e.g. a square among rhombi is the only
// shape with right angles, so it would be a second candidate answer).
const IQ_ODD_PROPS_AREA_TOL = 0.02;          // the four areas agree within 2%
const IQ_ODD_PROPS_MAX_EXTENT = 22;          // half the bounding box, in flag-units (tile half-width is 24)
const IQ_ODD_PROPS_MIN_SIDE = 10.5;          // flag-units (= 18 viewBox units, about 8px on a phone tile)
const IQ_ODD_PROPS_ANGLE_EQ = 0.6, IQ_ODD_PROPS_ANGLE_FAR = 12;
const IQ_ODD_PROPS_LEN_EQ = 0.99, IQ_ODD_PROPS_LEN_FAR = 0.85;   // ratio smaller/larger of two lengths
const iqOddRandF = (a, b) => a + Math.random() * (b - a);
const IQ_ODD_DEG = Math.PI / 180;

function iqOddShapeProps(pts){
  const n = pts.length;
  const vec = pts.map((p, i) => { const q = pts[(i+1) % n]; return [q[0] - p[0], q[1] - p[1]]; });
  const len = vec.map(v => Math.hypot(v[0], v[1]));
  const ang = pts.map((p, i) => {
    const a = pts[(i+n-1) % n], b = pts[(i+1) % n], v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]];
    return Math.acos((v1[0]*v2[0] + v1[1]*v2[1]) / (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]))) / IQ_ODD_DEG;
  });
  const lineAngle = (u, v) => Math.acos(Math.min(1, Math.abs(u[0]*v[0] + u[1]*v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])))) / IQ_ODD_DEG;
  let clear = true;
  // right angles: each angle is exactly 90 or clearly not
  if (!ang.every(a => Math.abs(a - 90) <= IQ_ODD_PROPS_ANGLE_EQ || Math.abs(a - 90) >= IQ_ODD_PROPS_ANGLE_FAR)) clear = false;
  // all sides equal, or clearly not (shortest at most 85% of the longest)
  const ratio = Math.min(...len) / Math.max(...len);
  if (!(ratio >= IQ_ODD_PROPS_LEN_EQ || ratio <= IQ_ODD_PROPS_LEN_FAR)) clear = false;
  const props = { n, rightAngles: ang.filter(a => Math.abs(a - 90) <= IQ_ODD_PROPS_ANGLE_EQ).length, equalSidesAll: ratio >= IQ_ODD_PROPS_LEN_EQ, minSide: Math.min(...len) };
  if (n === 4){
    // parallel pairs: each opposite pair is parallel or clearly not
    const par = [[0, 2], [1, 3]].map(([i, j]) => lineAngle(vec[i], vec[j]));
    if (!par.every(a => a <= IQ_ODD_PROPS_ANGLE_EQ || a >= IQ_ODD_PROPS_ANGLE_FAR)) clear = false;
    props.parallelPairs = par.filter(a => a <= IQ_ODD_PROPS_ANGLE_EQ).length;
  }
  // mirror axes: a reflection maps vertex i to vertex (c - i); it is a symmetry when angles and edge lengths correspond,
  // clearly not one when an angle is 8+ degrees off or a length 12+% off; anything in between makes the shape ambiguous
  let axes = 0;
  for (let c = 0; c < n; c++){
    let dAng = 0, rLen = 1;
    for (let i = 0; i < n; i++){
      const m = ((c - i) % n + n) % n, e = ((c - i - 1) % n + n) % n;
      dAng = Math.max(dAng, Math.abs(ang[i] - ang[m]));
      rLen = Math.min(rLen, Math.min(len[i], len[e]) / Math.max(len[i], len[e]));
    }
    if (dAng <= IQ_ODD_PROPS_ANGLE_EQ && rLen >= IQ_ODD_PROPS_LEN_EQ) axes++;
    else if (dAng < 8 && rLen > 0.88) clear = false;
  }
  props.axes = axes;
  props.clear = clear;
  return props;
}
// unit shapes (before tilt and scaling)
const iqOddPropsBuilders = {
  rhombus: () => { const t = iqOddRandF(48, 72) * IQ_ODD_DEG; return [[0, 0], [1, 0], [1 + Math.cos(t), Math.sin(t)], [Math.cos(t), Math.sin(t)]]; },
  parallelogram: () => { const r = iqOddRandF(1.4, 2.1), t = iqOddRandF(48, 72) * IQ_ODD_DEG; return [[0, 0], [r, 0], [r + Math.cos(t), Math.sin(t)], [Math.cos(t), Math.sin(t)]]; },
  rectangle: () => { const r = iqOddRandF(1.4, 2.2); return [[0, 0], [r, 0], [r, 1], [0, 1]]; },
  trapezoid: () => { const top = iqOddRandF(0.35, 0.7), off = iqOddRandF(-0.3, 0.6), h = iqOddRandF(0.6, 0.95); return [[0, 0], [1, 0], [off + top, h], [off, h]]; },
  'right-triangle': () => { const r = iqOddRandF(1.3, 2.3); return [[0, 0], [r, 0], [0, 1]]; },
  'acute-triangle': () => iqOddTriangleFromAngles(iqOddRandF(52, 70), iqOddRandF(52, 70)),
  'obtuse-triangle': () => iqOddTriangleFromAngles(iqOddRandF(104, 124), iqOddRandF(20, 38))
};
// a unit shape whose properties are all unambiguous (shape-level; scale and tilt do not change this); a few redraws are cheap
function iqOddBuildClearShape(type){
  let pts;
  for (let i = 0; i < 40; i++){ pts = iqOddPropsBuilders[type](); if (iqOddShapeProps(pts).clear) return pts; }
  return pts;
}
function iqOddTriangleFromAngles(A, B){
  const a = A * IQ_ODD_DEG, b = B * IQ_ODD_DEG, c = Math.PI - a - b;
  const sa = Math.sin(a), sb = Math.sin(b), sc = Math.sin(c);          // sides opposite A, B, C
  return [[0, 0], [sc, 0], [sb * Math.cos(a), sb * Math.sin(a)]];
}
// variant: key, shape counts, the property that three options have and one lacks, the shapes used, first tier
const IQ_ODD_PROPS_VARIANTS = [
  { key: 'equal-sides', minTier: 3, normal: 'rhombus', odd: ['parallelogram'], has: p => p.equalSidesAll,
    explanation: 'בשלוש הצורות כל ארבע הצלעות שוות באורכן - בצורה שנבחרה הצלעות אינן שוות.' },
  { key: 'two-parallel-pairs', minTier: 4, normal: 'parallelogram', odd: ['trapezoid'], has: p => p.parallelPairs === 2,
    explanation: 'בשלוש הצורות יש שני זוגות של צלעות מקבילות - בצורה שנבחרה יש רק זוג אחד.' },
  { key: 'right-angles', minTier: 4, normal: 'rectangle', odd: ['parallelogram'], has: p => p.rightAngles === 4,
    explanation: 'בשלוש הצורות כל הזוויות ישרות - בצורה שנבחרה אין זוויות ישרות.' },
  { key: 'one-parallel-pair', minTier: 4, normal: 'trapezoid', odd: ['parallelogram'], has: p => p.parallelPairs === 1,
    explanation: 'בשלוש הצורות יש בדיוק זוג אחד של צלעות מקבילות - בצורה שנבחרה יש שני זוגות.' },
  { key: 'right-triangle', minTier: 4, normal: 'right-triangle', odd: ['acute-triangle', 'obtuse-triangle'], has: p => p.rightAngles === 1,
    explanation: 'בכל אחד משלושת המשולשים יש זווית ישרה - במשולש שנבחר אין זווית ישרה.' }
];
const IQ_ODD_PROPS_AUDITED = ['equalSidesAll', 'rightAngles', 'parallelPairs', 'axes'];   // the properties a child can see in the picture
// the property audit: any property splitting the options 3-1 must single out the intended odd option
function iqOddPropsAuditOk(propsList, oddIndex){
  return IQ_ODD_PROPS_AUDITED.every(k => {
    const vals = propsList.map(p => p[k]);
    if (vals.some(v => v === undefined)) return true;
    const groups = {};
    vals.forEach((v, i) => (groups[String(v)] = groups[String(v)] || []).push(i));
    const sizes = Object.values(groups);
    if (sizes.length === 2 && sizes.some(g => g.length === 1) && sizes.some(g => g.length === 3)) return sizes.find(g => g.length === 1)[0] === oddIndex;
    return true;
  });
}
function iqOddPolyExtent(pts){ return Math.max(...pts.map(p => Math.abs(p[0])), ...pts.map(p => Math.abs(p[1]))); }
// one attempt: returns a result or null when a constraint fails (the caller retries)
function iqOddGenPropsCandidate(def){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const oddType = pickOne(def.odd), oddIndex = randInt(0, 3);
  const types = [0, 1, 2, 3].map(i => (i === oddIndex ? oddType : def.normal));
  const raw = types.map(t => {
    const pts = iqOddBuildClearShape(t), a = iqOddRandF(0, 360) * IQ_ODD_DEG, c = Math.cos(a), s = Math.sin(a);
    const rot = pts.map(([x, y]) => [x*c - y*s, x*s + y*c]);
    const xs = rot.map(p => p[0]), ys = rot.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return rot.map(([x, y]) => [x - cx, y - cy]);
  });
  // common area: the largest that lets every option stay inside the extent limit
  const unitArea = raw.map(iqOddPolyArea), ext = raw.map(iqOddPolyExtent);
  const area = Math.min(...raw.map((_, i) => unitArea[i] * Math.pow(IQ_ODD_PROPS_MAX_EXTENT / ext[i], 2)));
  const pts = raw.map((r, i) => { const k = Math.sqrt(area / unitArea[i]); return r.map(([x, y]) => [x*k, y*k]); });
  const props = pts.map(iqOddShapeProps);
  if (!props.every(p => p.clear)) return null;
  if (props.some(p => p.minSide < IQ_ODD_PROPS_MIN_SIDE)) return null;
  if (!iqOddExactlyOneBreaks({ items: props, oddIndex }, def.has)) return null;
  if (!iqOddPropsAuditOk(props, oddIndex)) return null;
  const items = pts.map(p => ({ kind: 'props', pts: p, color, strokeWidth, size }));
  return { items, oddIndex, family: 'props', variant: def.key, structureKey: 'props:' + def.key + ':' + oddType, explanation: def.explanation };
}
function iqOddGenProps(def){
  for (let i = 0; i < 60; i++){ const r = iqOddGenPropsCandidate(def); if (r) return r; }
  throw new Error('iqOddGenProps: no valid "' + def.key + '" question in 60 candidates.');
}
function iqOddVerifyProps(result){
  const def = IQ_ODD_PROPS_VARIANTS.find(v => v.key === result.variant);
  if (!def) return false;
  const n = def.key === 'right-triangle' ? 3 : 4;
  if (!result.items.every(it => Array.isArray(it.pts) && it.pts.length === n && it.pts.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])))) return false;
  if (!result.items.every(it => iqOddPolyExtent(it.pts) <= IQ_ODD_PROPS_MAX_EXTENT + 0.05)) return false;
  const props = result.items.map(it => iqOddShapeProps(it.pts));
  if (!props.every(p => p.clear && p.minSide >= IQ_ODD_PROPS_MIN_SIDE)) return false;
  if (!iqOddExactlyOneBreaks({ items: props, oddIndex: result.oddIndex }, def.has)) return false;
  const areas = result.items.map(it => iqOddPolyArea(it.pts));
  if (Math.max(...areas) / Math.min(...areas) - 1 > IQ_ODD_PROPS_AREA_TOL) return false;
  return iqOddPropsAuditOk(props, result.oddIndex);
}

// ---- topology: holes in cell figures, and chains of beads ----
// Holes: 4x4 grids of cells (20 viewBox units each, about 9px on a phone). Three figures have the same number
// of closed holes, one has a different number. All four have the SAME number of cells, different silhouettes
// (no two congruent under rotation / mirroring), bounding boxes within one cell of each other, and the odd
// figure's outline length lies inside the range of the normals' (so "the most/least ragged one" is not a cue).
// A hole is background completely enclosed by cells; a bay open to the outside is not one. Figures where two
// cells touch only at a corner are excluded, so every hole and every opening is unambiguous.
// Chains: five equal beads. In three options they form ONE chain (neighbours overlap by at least 25% of a
// bead's width); in one the chain is broken into two groups by a visible gap (at least 8 units). Any two beads
// either overlap clearly or are at least 8 units apart, so nothing is "almost touching".
const IQ_ODD_TOPO_CELL = 20, IQ_ODD_TOPO_GRID = 4;
const IQ_ODD_BEAD_R = 8, IQ_ODD_BEAD_N = 5, IQ_ODD_BEAD_MIN_GAP = 8, IQ_ODD_BEAD_MIN_OVERLAP = 0.25;

// ----- cell figures -----
function iqOddFigHoles(cells){                                  // closed holes by flood fill of the outside (4-neighbourhood) on a padded grid
  const set = new Set(cells.map(c => c[0] + ',' + c[1]));
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const seen = new Set([x0 + ',' + y0]), stack = [[x0, y0]];
  while (stack.length){
    const [x, y] = stack.pop();
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || set.has(k) || seen.has(k)) return;
      seen.add(k); stack.push([nx, ny]);
    });
  }
  // count the background regions that were not reached
  const rest = new Set();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){ const k = x + ',' + y; if (!set.has(k) && !seen.has(k)) rest.add(k); }
  let holes = 0;
  while (rest.size){
    holes++;
    const first = rest.values().next().value, st = [first.split(',').map(Number)];
    rest.delete(first);
    while (st.length){
      const [x, y] = st.pop();
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => { const k = (x+dx) + ',' + (y+dy); if (rest.has(k)){ rest.delete(k); st.push([x+dx, y+dy]); } });
    }
  }
  return holes;
}
function iqOddFigValid(cells){                                   // edge-connected, no corner-only contact
  const set = new Set(cells.map(c => c[0] + ',' + c[1]));
  const seen = new Set([cells[0][0] + ',' + cells[0][1]]), stack = [cells[0]];
  while (stack.length){
    const [x, y] = stack.pop();
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => { const k = (x+dx) + ',' + (y+dy); if (set.has(k) && !seen.has(k)){ seen.add(k); stack.push([x+dx, y+dy]); } });
  }
  if (seen.size !== cells.length) return false;
  return cells.every(([x, y]) => [[1,1],[1,-1]].every(([dx, dy]) => !(set.has((x+dx) + ',' + (y+dy)) && !set.has((x+dx) + ',' + y) && !set.has(x + ',' + (y+dy)))));
}
function iqOddFigNormalize(cells){
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(c => [c[0] - mx, c[1] - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
const iqOddFigD4 = [([x, y]) => [x, y], ([x, y]) => [-y, x], ([x, y]) => [-x, -y], ([x, y]) => [y, -x], ([x, y]) => [-x, y], ([x, y]) => [y, x], ([x, y]) => [x, -y], ([x, y]) => [-y, -x]];
function iqOddFigCanon(cells){
  return iqOddFigD4.map(f => iqOddFigNormalize(cells.map(f)).map(c => c.join(',')).join(';')).sort()[0];
}
function iqOddFigPerimeter(cells){
  const set = new Set(cells.map(c => c[0] + ',' + c[1]));
  let p = 0;
  cells.forEach(([x, y]) => [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => { if (!set.has((x+dx) + ',' + (y+dy))) p++; }));
  return p;
}
// all valid 4x4 figures with 8..12 cells, grouped by cell count and hole count, one entry per silhouette
let IQ_ODD_FIG_INDEX = null;
function iqOddFigIndex(){
  if (IQ_ODD_FIG_INDEX) return IQ_ODD_FIG_INDEX;
  const index = {};
  for (let mask = 1; mask < (1 << 16); mask++){
    let k = 0; for (let b = mask; b; b &= b - 1) k++;
    if (k < 8 || k > 12) continue;
    const cells = []; for (let i = 0; i < 16; i++) if (mask & (1 << i)) cells.push([i % 4, Math.floor(i / 4)]);
    if (!iqOddFigValid(cells)) continue;
    const norm = iqOddFigNormalize(cells), h = iqOddFigHoles(cells), key = k + '|' + h;
    const canon = iqOddFigCanon(cells);
    const bucket = index[key] = index[key] || {};
    if (!bucket[canon]) bucket[canon] = { cells: norm, k, holes: h, perimeter: iqOddFigPerimeter(norm), w: Math.max(...norm.map(c => c[0])) + 1, h: Math.max(...norm.map(c => c[1])) + 1 };
  }
  IQ_ODD_FIG_INDEX = index;
  return index;
}
// outline loops of a figure as polygons in tile coordinates (the outer boundary and every hole), figure centred on the tile
function iqOddFigLoops(cells){
  const has = new Set(cells.map(c => c[0] + ',' + c[1])), next = new Map();
  const edge = (x1, y1, x2, y2) => next.set(x1 + ',' + y1, [x2, y2]);
  cells.forEach(([x, y]) => {
    if (!has.has(x + ',' + (y-1))) edge(x, y, x+1, y);
    if (!has.has((x+1) + ',' + y)) edge(x+1, y, x+1, y+1);
    if (!has.has(x + ',' + (y+1))) edge(x+1, y+1, x, y+1);
    if (!has.has((x-1) + ',' + y)) edge(x, y+1, x, y);
  });
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
  const loops = [], used = new Set();
  for (const startKey of next.keys()){
    if (used.has(startKey)) continue;
    const loop = []; let key = startKey;
    while (!used.has(key)){ used.add(key); const p = key.split(',').map(Number); loop.push(p); key = next.get(key).join(','); }
    const corners = loop.filter((p, i) => { const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0; });
    loops.push(corners.map(([x, y]) => [50 + (x - cx) * IQ_ODD_TOPO_CELL, 50 + (y - cy) * IQ_ODD_TOPO_CELL]));
  }
  return loops;
}
function iqOddRenderCells(item){
  const size = item.size || 100, k = size / 100;
  const d = iqOddFigLoops(item.cells).map(l => 'M' + l.map(([x, y]) => (x*k).toFixed(1) + ' ' + (y*k).toFixed(1)).join(' L') + ' Z').join(' ');
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="' + d + '" fill="' + item.color + '" fill-rule="evenodd" stroke="#1a1a2e" stroke-width="' + item.strokeWidth + '" stroke-linejoin="round"/></svg>';
}
// ----- bead chains -----
function iqOddBeadLayout(style, broken){                           // returns 5 centres (about the origin) or null when a distance is ambiguous
  const r = IQ_ODD_BEAD_R, step = () => 2 * r * (1 - iqOddRandF(IQ_ODD_BEAD_MIN_OVERLAP, 0.45));
  let heading = iqOddRandF(0, 2 * Math.PI), pts = [[0, 0]];
  const alpha = iqOddRandF(40, 70) * IQ_ODD_DEG, bend = iqOddRandF(18, 42) * IQ_ODD_DEG * (Math.random() < 0.5 ? -1 : 1);
  const brokenAt = broken ? randInt(0, IQ_ODD_BEAD_N - 2) : -1;
  for (let i = 0; i < IQ_ODD_BEAD_N - 1; i++){
    if (style === 'zigzag') heading += (i % 2 ? -1 : 1) * alpha;
    else if (style === 'arc') heading += bend;
    else if (style === 'free') heading += iqOddRandF(-50, 50) * IQ_ODD_DEG;
    const s = (i === brokenAt) ? 2 * r + iqOddRandF(IQ_ODD_BEAD_MIN_GAP, IQ_ODD_BEAD_MIN_GAP + 5) : step();
    const [x, y] = pts[i];
    pts.push([x + s * Math.cos(heading), y + s * Math.sin(heading)]);
  }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  pts = pts.map(([x, y]) => [x - cx, y - cy]);
  return pts;
}
// number of groups: beads joined by a clear overlap (at least 25% of a bead's width) form a group; null when two beads of
// DIFFERENT groups are closer than the minimum gap (they would look as if they touch)
function iqOddBeadGroups(centers, r){
  const n = centers.length, parent = centers.map((_, i) => i), find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const dist = (i, j) => Math.hypot(centers[i][0] - centers[j][0], centers[i][1] - centers[j][1]);
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) if (dist(i, j) <= 2 * r * (1 - IQ_ODD_BEAD_MIN_OVERLAP) + 1e-6) parent[find(i)] = find(j);
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) if (find(i) !== find(j) && dist(i, j) < 2 * r + IQ_ODD_BEAD_MIN_GAP - 1e-6) return null;
  return new Set(centers.map((_, i) => find(i))).size;
}
function iqOddBeadExtent(centers){ return Math.max(...centers.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1])))) + IQ_ODD_BEAD_R; }
function iqOddRenderBeads(item){
  const size = item.size || 100, k = size / 100;
  const circles = item.centers.map(([x, y]) => '<circle cx="' + ((50 + x)*k).toFixed(1) + '" cy="' + ((50 + y)*k).toFixed(1) + '" r="' + (IQ_ODD_BEAD_R*k).toFixed(1) + '" fill="' + item.color + '" stroke="#1a1a2e" stroke-width="' + item.strokeWidth + '"/>').join('');
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + circles + '</svg>';
}
// ----- variants -----
const IQ_ODD_TOPO_VARIANTS = [
  { key: 'hole-missing', minTier: 3, kind: 'cells', normalHoles: 1, oddHoles: [0],
    explanation: 'בשלוש הצורות יש חור סגור - בצורה שנבחרה אין חור סגור.' },
  { key: 'hole-extra', minTier: 2, kind: 'cells', normalHoles: 0, oddHoles: [1],
    explanation: 'בשלוש הצורות אין חור סגור - בצורה שנבחרה יש חור סגור.' },
  { key: 'chain', minTier: 3, kind: 'beads',
    explanation: 'בשלוש הצורות כל החרוזים מחוברים לשרשרת אחת - בצורה שנבחרה השרשרת שבורה לשני חלקים.' }
];
function iqOddGenTopoCells(def){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100, index = iqOddFigIndex();
  for (let attempt = 0; attempt < 200; attempt++){
    const oddHoles = pickOne(def.oddHoles), ks = [8, 9, 10, 11, 12].filter(k => Object.keys(index[k + '|' + def.normalHoles] || {}).length >= 3 && Object.keys(index[k + '|' + oddHoles] || {}).length >= 1);
    if (!ks.length) continue;
    const k = pickOne(ks);
    const normalPool = Object.values(index[k + '|' + def.normalHoles]), oddPool = Object.values(index[k + '|' + oddHoles]);
    const normals = shuffle(normalPool.slice()).slice(0, 3), odd = pickOne(oddPool);
    const per = normals.map(f => f.perimeter);
    if (odd.perimeter < Math.min(...per) || odd.perimeter > Math.max(...per)) continue;
    const all = normals.concat([odd]);
    if (Math.max(...all.map(f => f.w)) - Math.min(...all.map(f => f.w)) > 1 || Math.max(...all.map(f => f.h)) - Math.min(...all.map(f => f.h)) > 1) continue;
    const oddIndex = randInt(0, 3), order = shuffle(normals.slice());
    order.splice(oddIndex, 0, odd);
    const items = order.map(f => ({ kind: 'topology', figure: 'cells', cells: iqOddFigNormalize(f.cells.map(iqOddFigD4[randInt(0, 7)])), color, strokeWidth, size }));
    return { items, oddIndex, family: 'topology', variant: def.key,
      structureKey: 'topology:' + def.key + ':k=' + k + ':odd=' + oddHoles, explanation: def.explanation };
  }
  throw new Error('iqOddGenTopoCells: no valid question for "' + def.key + '".');
}
function iqOddGenTopoBeads(def){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 2.5, size = 100;
  const styles = ['straight', 'zigzag', 'arc', 'free'];
  for (let attempt = 0; attempt < 400; attempt++){
    const oddIndex = randInt(0, 3);
    const centers = [0, 1, 2, 3].map(i => iqOddBeadLayout(pickOne(styles), i === oddIndex));
    const groups = centers.map(c => iqOddBeadGroups(c, IQ_ODD_BEAD_R));
    if (groups.some(g => g === null)) continue;
    if (!groups.every((g, i) => g === (i === oddIndex ? 2 : 1))) continue;
    const ext = centers.map(iqOddBeadExtent);
    if (Math.max(...ext) > 44) continue;
    const normExt = ext.filter((_, i) => i !== oddIndex);
    if (ext[oddIndex] < Math.min(...normExt) || ext[oddIndex] > Math.max(...normExt)) continue;      // the broken chain is not the widest / narrowest
    return { items: centers.map(c => ({ kind: 'topology', figure: 'beads', centers: c, color, strokeWidth, size })), oddIndex, family: 'topology', variant: def.key,
      structureKey: 'topology:' + def.key, explanation: def.explanation };
  }
  throw new Error('iqOddGenTopoBeads: no valid chain question.');
}
function iqOddGenTopology(def){ return def.kind === 'cells' ? iqOddGenTopoCells(def) : iqOddGenTopoBeads(def); }
function iqOddRenderTopology(item){ return item.figure === 'cells' ? iqOddRenderCells(item) : iqOddRenderBeads(item); }
function iqOddVerifyTopology(result){
  const def = IQ_ODD_TOPO_VARIANTS.find(v => v.key === result.variant);
  if (!def) return false;
  if (!result.items.every(it => it.figure === def.kind)) return false;
  if (def.kind === 'beads'){
    if (!result.items.every(it => Array.isArray(it.centers) && it.centers.length === IQ_ODD_BEAD_N && it.centers.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])))) return false;
    const groups = result.items.map(it => iqOddBeadGroups(it.centers, IQ_ODD_BEAD_R));
    if (groups.some(g => g === null)) return false;
    if (!iqOddExactlyOneBreaks({ items: groups, oddIndex: result.oddIndex }, g => g === 1)) return false;
    if (groups[result.oddIndex] !== 2) return false;
    const ext = result.items.map(it => iqOddBeadExtent(it.centers));
    if (Math.max(...ext) > 44) return false;
    const normExt = ext.filter((_, i) => i !== result.oddIndex);
    return ext[result.oddIndex] >= Math.min(...normExt) && ext[result.oddIndex] <= Math.max(...normExt);
  }
  const figs = result.items.map(it => it.cells);
  if (!figs.every(c => Array.isArray(c) && c.length >= 8 && c.length <= 12 && c.every(p => Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] < IQ_ODD_TOPO_GRID && p[1] < IQ_ODD_TOPO_GRID))) return false;
  if (!figs.every(iqOddFigValid)) return false;
  if (new Set(figs.map(c => c.length)).size !== 1) return false;                        // same number of cells
  if (new Set(figs.map(iqOddFigCanon)).size !== 4) return false;                        // four different silhouettes
  const holes = figs.map(iqOddFigHoles);
  if (!iqOddExactlyOneBreaks({ items: holes, oddIndex: result.oddIndex }, h => h === def.normalHoles)) return false;
  const per = figs.map(iqOddFigPerimeter), normPer = per.filter((_, i) => i !== result.oddIndex);
  if (per[result.oddIndex] < Math.min(...normPer) || per[result.oddIndex] > Math.max(...normPer)) return false;
  const bw = figs.map(c => Math.max(...c.map(p => p[0])) - Math.min(...c.map(p => p[0])) + 1), bh = figs.map(c => Math.max(...c.map(p => p[1])) - Math.min(...c.map(p => p[1])) + 1);
  return Math.max(...bw) - Math.min(...bw) <= 1 && Math.max(...bh) - Math.min(...bh) <= 1;
}

// ---- stacking order: which overlapping shape lies on top of which ----
// Every option shows the same three shapes (circle, square, triangle - each always in its own colour) overlapping
// in all three pairs. In three options they are stacked in the same order (a different arrangement each time);
// in one, two neighbouring layers are swapped. Each pair overlaps by 25-50% of the smaller shape, every shape
// stays at least 45% visible, the union areas of the four pictures agree within 8%, and everything stays inside the tile.
const IQ_ODD_STACK_TYPES = ['circle', 'square', 'triangle'];
const IQ_ODD_STACK_OVERLAP = [0.25, 0.5], IQ_ODD_STACK_MIN_VISIBLE = 0.45, IQ_ODD_STACK_UNION_TOL = 0.08;
function iqOddStackShapeAt(type, cx, cy, rotDeg){
  if (type === 'circle') return { type, cx, cy, r: 17 };
  const rot = rotDeg * IQ_ODD_DEG, base = type === 'square' ? [45, 135, 225, 315].map(a => a * IQ_ODD_DEG) : [-90, 30, 150].map(a => a * IQ_ODD_DEG);
  const R = type === 'square' ? 15 * Math.SQRT2 : 26;
  return { type, pts: base.map(a => [cx + R * Math.cos(a + rot), cy + R * Math.sin(a + rot)]) };
}
function iqOddStackContains(shape, x, y){
  if (shape.type === 'circle') return Math.hypot(x - shape.cx, y - shape.cy) <= shape.r;
  const pts = shape.pts; let inside = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++){
    const [xa, ya] = pts[a], [xb, yb] = pts[b];
    if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}
function iqOddStackInside(shape){
  if (shape.type === 'circle') return shape.cx - shape.r >= 6 && shape.cx + shape.r <= 94 && shape.cy - shape.r >= 6 && shape.cy + shape.r <= 94;
  return shape.pts.every(p => p[0] >= 6 && p[0] <= 94 && p[1] >= 6 && p[1] <= 94);
}
// measurements of a picture: shapes given bottom -> top. Samples on a 2-unit grid (areas are counted in samples).
function iqOddStackMeasure(shapes){
  const n = shapes.length, area = new Array(n).fill(0), visible = new Array(n).fill(0), pair = {};
  let union = 0;
  for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++){
    const x = 2 * i + 1, y = 2 * j + 1, inside = shapes.map(s => iqOddStackContains(s, x, y));
    let top = -1;
    inside.forEach((v, k) => { if (v){ area[k]++; top = k; } });
    if (top >= 0){ union++; visible[top]++; }
    for (let a = 0; a < n; a++) for (let b = a+1; b < n; b++) if (inside[a] && inside[b]) pair[a + ',' + b] = (pair[a + ',' + b] || 0) + 1;
  }
  const overlap = [];
  for (let a = 0; a < n; a++) for (let b = a+1; b < n; b++) overlap.push((pair[a + ',' + b] || 0) / Math.min(area[a], area[b]));
  return { union, overlap, visible: visible.map((v, k) => v / area[k]) };
}
function iqOddStackLayoutOk(m, shapes){
  return shapes.every(iqOddStackInside) && m.overlap.every(o => o >= IQ_ODD_STACK_OVERLAP[0] && o <= IQ_ODD_STACK_OVERLAP[1]) && m.visible.every(v => v >= IQ_ODD_STACK_MIN_VISIBLE);
}
// random arrangement of the three types: the centres form a triangle whose sides are 17-27 units (where a 25-50% overlap is likely),
// centred on the tile with a small shift, then painted in `orderTopFirst` (bottom shape first)
function iqOddStackArrange(orderTopFirst){
  const near = d => d >= 17 && d <= 27;
  let c;
  for (let i = 0; i < 100; i++){
    const a1 = iqOddRandF(0, 2 * Math.PI), d1 = iqOddRandF(17, 27), a2 = iqOddRandF(0, 2 * Math.PI), d2 = iqOddRandF(17, 27);
    const B = [d1 * Math.cos(a1), d1 * Math.sin(a1)], C = [d2 * Math.cos(a2), d2 * Math.sin(a2)];
    if (near(Math.hypot(B[0] - C[0], B[1] - C[1]))){ c = [[0, 0], B, C]; break; }
  }
  if (!c) c = [[0, 0], [22, 0], [11, 19]];
  const mx = (c[0][0] + c[1][0] + c[2][0]) / 3 + iqOddRandF(-4, 4), my = (c[0][1] + c[1][1] + c[2][1]) / 3 + iqOddRandF(-4, 4);
  const types = shuffle(IQ_ODD_STACK_TYPES.slice()), pos = {};
  types.forEach((t, i) => { pos[t] = [50 + c[i][0] - mx, 50 + c[i][1] - my, iqOddRandF(0, 360)]; });
  return orderTopFirst.slice().reverse().map(t => iqOddStackShapeAt(t, pos[t][0], pos[t][1], pos[t][2]));
}
const iqOddStackSignature = shapes => shapes.map(s => s.type).reverse().join('>');           // top first
function iqOddGenStack(def){
  const colors = shuffle(IQ_SHAPE_COLORS.slice()).slice(0, 3), colorOf = {}; IQ_ODD_STACK_TYPES.forEach((t, i) => { colorOf[t] = colors[i]; });
  const normal = shuffle(IQ_ODD_STACK_TYPES.slice());
  const k = randInt(0, 1), odd = normal.slice(); [odd[k], odd[k+1]] = [odd[k+1], odd[k]];
  const oddIndex = randInt(0, 3);
  for (let attempt = 0; attempt < 400; attempt++){
    const picks = [0, 1, 2, 3].map(i => {
      for (let t = 0; t < 60; t++){
        const shapes = iqOddStackArrange(i === oddIndex ? odd : normal), m = iqOddStackMeasure(shapes);
        if (iqOddStackLayoutOk(m, shapes)) return { shapes, m };
      }
      return null;
    });
    if (picks.some(p => p === null)) continue;
    const un = picks.map(p => p.m.union);
    if (Math.max(...un) / Math.min(...un) - 1 > IQ_ODD_STACK_UNION_TOL) continue;
    const items = picks.map(p => ({ kind: 'stack', shapes: p.shapes, colors: colorOf, strokeWidth: 3, size: 100 }));
    return { items, oddIndex, family: 'stack', variant: def.key, structureKey: 'stack:' + def.key + ':' + normal.join('>') + ':swap' + k, explanation: def.explanation };
  }
  throw new Error('iqOddGenStack: no valid question.');
}
function iqOddRenderStack(item){
  const size = item.size || 100, k = size / 100;
  const body = item.shapes.map(s => {
    const fill = item.colors[s.type], stroke = '#1a1a2e', sw = item.strokeWidth;
    if (s.type === 'circle') return '<circle cx="' + (s.cx*k).toFixed(1) + '" cy="' + (s.cy*k).toFixed(1) + '" r="' + (s.r*k).toFixed(1) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    return '<polygon points="' + s.pts.map(([x, y]) => (x*k).toFixed(1) + ',' + (y*k).toFixed(1)).join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
  }).join('');
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
}
const IQ_ODD_STACK_VARIANTS = [
  { key: 'three-shapes', minTier: 4, explanation: 'בשלוש התמונות הצורות מונחות זו על זו באותו סדר - בתמונה שנבחרה שתי צורות מחליפות מקום בסדר.' }
];
function iqOddVerifyStack(result){
  const def = IQ_ODD_STACK_VARIANTS.find(v => v.key === result.variant);
  if (!def) return false;
  const picks = [];
  for (const it of result.items){
    if (!Array.isArray(it.shapes) || it.shapes.length !== 3) return false;
    if (it.shapes.map(s => s.type).slice().sort().join() !== IQ_ODD_STACK_TYPES.slice().sort().join()) return false;
    if (!it.shapes.every(s => s.type === 'circle' ? [s.cx, s.cy, s.r].every(Number.isFinite) : Array.isArray(s.pts) && s.pts.length === (s.type === 'square' ? 4 : 3) && s.pts.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])))) return false;
    if (!IQ_ODD_STACK_TYPES.every(t => it.colors && typeof it.colors[t] === 'string')) return false;
    const m = iqOddStackMeasure(it.shapes);
    if (!iqOddStackLayoutOk(m, it.shapes)) return false;
    picks.push(m);
  }
  const colorSig = result.items.map(it => IQ_ODD_STACK_TYPES.map(t => it.colors[t]).join());
  if (new Set(colorSig).size !== 1) return false;                                      // the same colour for the same shape in all four pictures
  const un = picks.map(m => m.union);
  if (Math.max(...un) / Math.min(...un) - 1 > IQ_ODD_STACK_UNION_TOL) return false;
  const sigs = result.items.map(it => iqOddStackSignature(it.shapes));
  if (!iqOddExactlyOneBreaks({ items: sigs, oddIndex: result.oddIndex }, s => s === sigs[result.oddIndex === 0 ? 1 : 0])) return false;
  // the odd order differs from the common one by swapping two NEIGHBOURING layers
  const a = sigs[result.oddIndex].split('>'), b = sigs[result.oddIndex === 0 ? 1 : 0].split('>');
  const diff = a.map((t, i) => (t !== b[i] ? i : -1)).filter(i => i >= 0);
  if (diff.length !== 2 || diff[1] - diff[0] !== 1) return false;
  return new Set(result.items.map(it => JSON.stringify(it.shapes.map(s => s.type === 'circle' ? [s.cx, s.cy].map(v => v.toFixed(0)) : s.pts.map(p => p.map(v => v.toFixed(0))))))).size === 4;
}

// ---- networks: coloured nodes joined by lines ----
// 'same-links': five coloured nodes joined in a path (e.g. red-blue-green-yellow-purple). Three pictures show
//   the SAME connections laid out differently; in one the last (or first) two nodes are exchanged, which rewires
//   one line and keeps the number of lines and the "who has how many links" pattern.
// 'ring-or-stub': five identical nodes and five lines. In three pictures they form a ring (every node has two
//   links); in one it is a four-node ring with one extra node hanging off it (degrees 3, 2, 2, 2, 1).
// Every picture is drawn without crossing lines; a line never runs close to a node it does not join; nodes are
// at least 24 units apart, and lines at least 16 units long.
const IQ_ODD_NET_R = 8, IQ_ODD_NET_COLORS = ['#E94F37', '#2D7DD2', '#3BB273', '#F2B134', '#8E5BD0'];
function iqOddSegDist(p, a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx*dx + dy*dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0])*dx + (p[1] - a[1])*dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t*dx, p[1] - a[1] - t*dy);
}
function iqOddSegCross(a, b, c, d){
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function iqOddNetDrawingOk(nodes, edges){
  const P = nodes.map(n => [n.x, n.y]), m = IQ_ODD_NET_R + 4;
  if (!P.every(p => p[0] >= m && p[0] <= 100 - m && p[1] >= m && p[1] <= 100 - m)) return false;
  for (let i = 0; i < P.length; i++) for (let j = i+1; j < P.length; j++) if (Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) < 24) return false;
  for (const [a, b] of edges){
    if (Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < 16) return false;
    for (let k = 0; k < P.length; k++) if (k !== a && k !== b && iqOddSegDist(P[k], P[a], P[b]) < IQ_ODD_NET_R + 4) return false;
  }
  for (let i = 0; i < edges.length; i++) for (let j = i+1; j < edges.length; j++){
    const [a, b] = edges[i], [c, d] = edges[j];
    if (a === c || a === d || b === c || b === d) continue;
    if (iqOddSegCross(P[a], P[b], P[c], P[d])) return false;
  }
  return true;
}
const iqOddNetRandPos = () => [iqOddRandF(14, 86), iqOddRandF(14, 86)];
// ----- builders: each returns { nodes: [{x, y, color}], edges: [[i, j]] } or null -----
function iqOddNetPath(sequence, colorOf){                          // sequence: colour keys along the path
  const nodes = sequence.map(k => { const [x, y] = iqOddNetRandPos(); return { x, y, color: colorOf[k] }; });
  const edges = sequence.slice(1).map((_, i) => [i, i + 1]);
  return iqOddNetDrawingOk(nodes, edges) ? { nodes, edges } : null;
}
function iqOddNetRing(color, stub){
  const nc = stub ? 4 : 5, pts = Array.from({ length: nc }, iqOddNetRandPos);
  const cx = pts.reduce((s, p) => s + p[0], 0) / nc, cy = pts.reduce((s, p) => s + p[1], 0) / nc;
  const order = pts.map((p, i) => i).sort((a, b) => Math.atan2(pts[a][1] - cy, pts[a][0] - cx) - Math.atan2(pts[b][1] - cy, pts[b][0] - cx));
  const nodes = order.map(i => ({ x: pts[i][0], y: pts[i][1], color }));
  const edges = nodes.map((_, i) => [i, (i + 1) % nc]);
  if (stub){
    const at = randInt(0, nc - 1), dx = nodes[at].x - cx, dy = nodes[at].y - cy, l = Math.hypot(dx, dy) || 1, len = iqOddRandF(24, 34);
    nodes.push({ x: nodes[at].x + dx / l * len, y: nodes[at].y + dy / l * len, color });
    edges.push([at, nc]);
  }
  return iqOddNetDrawingOk(nodes, edges) ? { nodes, edges } : null;
}
const iqOddNetDegrees = (n, edges) => { const d = new Array(n).fill(0); edges.forEach(([a, b]) => { d[a]++; d[b]++; }); return d; };
// connection signature by colour: sorted "colourA-colourB" pairs (colours are the node identities)
const iqOddNetSignature = pic => pic.edges.map(([a, b]) => [pic.nodes[a].color, pic.nodes[b].color].sort().join('-')).sort().join('|');
const IQ_ODD_NET_VARIANTS = [
  { key: 'ring-or-stub', minTier: 4, explanation: 'בשלוש התמונות כל נקודה מחוברת בדיוק לשתי נקודות אחרות, בטבעת סגורה - בתמונה שנבחרה יש נקודה שמחוברת לשלוש ונקודה שמחוברת רק לאחת.' },
  { key: 'same-links', minTier: 5, explanation: 'בשלוש התמונות אותן נקודות מחוברות זו לזו, רק המיקום שונה - בתמונה שנבחרה שני קווים מחברים נקודות אחרות.' }
];
function iqOddGenNet(def){
  const size = 100, strokeWidth = 3, oddIndex = randInt(0, 3);
  for (let attempt = 0; attempt < 600; attempt++){
    let pics;
    const draw = make => { for (let t = 0; t < 300; t++){ const p = make(); if (p) return p; } return null; };      // each picture is redrawn until it fits
    if (def.key === 'ring-or-stub'){
      const color = pickOne(IQ_SHAPE_COLORS);
      pics = [0, 1, 2, 3].map(i => draw(() => iqOddNetRing(color, i === oddIndex)));
    } else {
      const keys = shuffle(['a', 'b', 'c', 'd', 'e']), colorOf = {}, palette = shuffle(IQ_ODD_NET_COLORS.slice());
      keys.forEach((k, i) => { colorOf[k] = palette[i]; });
      const swapEnd = randInt(0, 1), odd = keys.slice();
      if (swapEnd) [odd[3], odd[4]] = [odd[4], odd[3]]; else [odd[0], odd[1]] = [odd[1], odd[0]];
      pics = [0, 1, 2, 3].map(i => draw(() => iqOddNetPath(i === oddIndex ? odd : keys, colorOf)));
    }
    if (pics.some(p => p === null)) continue;
    const items = pics.map(p => ({ kind: 'net', nodes: p.nodes, edges: p.edges, strokeWidth, size }));
    return { items, oddIndex, family: 'net', variant: def.key, structureKey: 'net:' + def.key, explanation: def.explanation };
  }
  throw new Error('iqOddGenNet: no valid question for "' + def.key + '".');
}
function iqOddRenderNet(item){
  const size = item.size || 100, k = size / 100, P = item.nodes;
  const lines = item.edges.map(([a, b]) => '<line x1="' + (P[a].x*k).toFixed(1) + '" y1="' + (P[a].y*k).toFixed(1) + '" x2="' + (P[b].x*k).toFixed(1) + '" y2="' + (P[b].y*k).toFixed(1) + '" stroke="#1a1a2e" stroke-width="' + item.strokeWidth + '" stroke-linecap="round"/>').join('');
  const dots = P.map(n => '<circle cx="' + (n.x*k).toFixed(1) + '" cy="' + (n.y*k).toFixed(1) + '" r="' + (IQ_ODD_NET_R*k).toFixed(1) + '" fill="' + n.color + '" stroke="#1a1a2e" stroke-width="' + item.strokeWidth + '"/>').join('');
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + lines + dots + '</svg>';
}
function iqOddVerifyNet(result){
  const def = IQ_ODD_NET_VARIANTS.find(v => v.key === result.variant);
  if (!def) return false;
  for (const it of result.items){
    if (!Array.isArray(it.nodes) || it.nodes.length !== 5 || !Array.isArray(it.edges) || it.edges.length !== (def.key === 'ring-or-stub' ? 5 : 4)) return false;
    if (!it.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y) && typeof n.color === 'string')) return false;
    if (!it.edges.every(e => Array.isArray(e) && e.length === 2 && e[0] !== e[1] && e.every(v => Number.isInteger(v) && v >= 0 && v < 5))) return false;
    if (!iqOddNetDrawingOk(it.nodes, it.edges)) return false;
  }
  if (def.key === 'ring-or-stub'){
    const degs = result.items.map(it => iqOddNetDegrees(5, it.edges).slice().sort().join());
    if (!iqOddExactlyOneBreaks({ items: degs, oddIndex: result.oddIndex }, d => d === '2,2,2,2,2')) return false;
    if (degs[result.oddIndex] !== '1,2,2,2,3') return false;
    // a ring is ONE closed loop: connected
    const connected = it => { const seen = new Set([0]), st = [0]; while (st.length){ const v = st.pop(); it.edges.forEach(([a, b]) => { const w = a === v ? b : (b === v ? a : -1); if (w >= 0 && !seen.has(w)){ seen.add(w); st.push(w); } }); } return seen.size === 5; };
    return result.items.every(connected);
  }
  // same-links: same colours everywhere; three identical connection sets; the odd differs by exactly one rewired line
  const palette = result.items.map(it => it.nodes.map(n => n.color).sort().join());
  if (new Set(palette).size !== 1 || new Set(result.items[0].nodes.map(n => n.color)).size !== 5) return false;
  const sigs = result.items.map(iqOddNetSignature);
  if (!iqOddExactlyOneBreaks({ items: sigs, oddIndex: result.oddIndex }, s => s === sigs[result.oddIndex === 0 ? 1 : 0])) return false;
  const a = new Set(sigs[result.oddIndex].split('|')), b = new Set(sigs[result.oddIndex === 0 ? 1 : 0].split('|'));
  const onlyA = [...a].filter(e => !b.has(e)).length, onlyB = [...b].filter(e => !a.has(e)).length;
  if (onlyA !== 1 || onlyB !== 1) return false;
  const deg = it => iqOddNetDegrees(5, it.edges).slice().sort().join();
  return new Set(result.items.map(deg)).size === 1;                       // same pattern of link counts, so no "hub" gives it away
}

// ---- ratio rule: inner dot count vs side count ----
// Three options follow "dots = sides + offset" and one does not. Each design of that
// question is a VARIANT (rule offset x dot placement), listed once in IQ_ODD_RATIO_VARIANTS
// below and registered with the family at the end of this section.
//
// Dot placements - the same in all 4 options of a question:
//   'ring'  dots evenly spaced on a circle (the original layout; the default, so ring items carry no `placement` field)
//   'rows'  dots in centred horizontal rows, 1 row up to 3 dots, 2 rows from 4 (counts per row in IQ_ODD_RATIO_ROWS)
//   'dice'  dots on the pips of a die (centre / diagonal corners / four corners / six-pip layout)
// A shape/dots combination is only usable if every dot marker clears every edge by the
// full margin and no two markers crowd each other (see iqOddRatioPlacementOk).
const IQ_ODD_RATIO_MAX_DOTS = 8;
const IQ_ODD_RATIO_SIDES_MIN = 3, IQ_ODD_RATIO_SIDES_MAX = 7;
// Smallest centre-to-centre distance of two dots: the dot gap of the 4-dots-in-a-triangle
// ring layout (edge-to-edge 5.435 units), which was reviewed on a phone and accepted.
const IQ_ODD_RATIO_MIN_CENTER = 13.435;
const IQ_ODD_RATIO_ROWS = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4] };
const IQ_ODD_RATIO_DICE = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
};
// Largest spacing tried for the rows / dice grids (viewBox units); it shrinks in 0.1 steps until everything fits.
const IQ_ODD_RATIO_PITCH_MAX = { rows: 16, dice: 20 };
const IQ_ODD_RATIO_CLEAR_EPS = 0.05;   // slack for the 0.1 rounding of the drawn outline
const IQ_ODD_RATIO_WRONG_OFFSETS = [-2, -1, 1, 2];   // how far the odd option's count is from the rule value (new variants)

// Where the inner dots sit, as offsets from the polygon's center. The ring radius is
// derived from THIS polygon's own geometry, not a fixed fraction of the circumradius:
// a regular n-gon's incircle radius is r*cos(pi/n), which for a triangle is exactly
// r/2 - so the old fixed r*0.5 put a dot's center precisely on the edge in the
// edge-midpoint direction. The radius is capped so that the whole marker - its own
// radius, half the outline stroke, and a visible gap - fits inside the shape in EVERY
// direction. The marker size stays the same for every shape and every option in a
// question, so it can never hint at which option is the odd one.
// Rows and dice layouts use the largest grid spacing that still passes the same
// clearance test; `centers` is null when no spacing fits (the combination is unusable).
function iqOddRatioLayout(sides, dots, strokeWidth, size, placement){
  size = size || 100;
  placement = placement || 'ring';
  const r = size*0.36;
  const dotR = size*0.04;
  const gap = size*0.03;
  const margin = dotR + strokeWidth/2 + gap;
  if (placement === 'ring'){
    const inradius = r*Math.cos(Math.PI/sides);
    const innerR = Math.min(r*0.5, inradius - margin);
    if (!(innerR > 0)){
      throw new Error('iqOddRatioLayout: no valid dot radius for a ' + sides + '-sided shape (inradius ' + inradius.toFixed(2) + ', margin ' + margin.toFixed(2) + ').');
    }
    const centers = [];
    for (let i = 0; i < dots; i++){
      const rad = (-90 + i*(360/Math.max(dots,1))) * Math.PI/180;
      centers.push([innerR*Math.cos(rad), innerR*Math.sin(rad)]);
    }
    return { r, dotR, gap, margin, innerR, centers };
  }
  return { r, dotR, gap, margin, innerR: null, centers: iqOddRatioGridCenters(sides, dots, placement, r, margin) };
}
// Unit-grid positions (in steps of one pitch, centred on the polygon centre) of a rows / dice layout.
function iqOddRatioUnitPoints(placement, dots){
  if (placement === 'rows'){
    const rows = IQ_ODD_RATIO_ROWS[dots];
    if (!rows) return null;
    const pts = [];
    rows.forEach((count, j) => { for (let i = 0; i < count; i++) pts.push([i - (count-1)/2, j - (rows.length-1)/2]); });
    return pts;
  }
  if (placement === 'dice') return IQ_ODD_RATIO_DICE[dots] || null;
  throw new Error('iqOddRatioLayout: unknown placement "' + placement + '".');
}
function iqOddRatioGridCenters(sides, dots, placement, r, margin){
  const unit = iqOddRatioUnitPoints(placement, dots);
  if (!unit) return null;
  let minUnit = Infinity;
  for (let i = 0; i < unit.length; i++) for (let j = i+1; j < unit.length; j++) minUnit = Math.min(minUnit, Math.hypot(unit[i][0] - unit[j][0], unit[i][1] - unit[j][1]));
  const pitchMin = unit.length < 2 ? 0 : IQ_ODD_RATIO_MIN_CENTER / minUnit;
  for (let k = 0; ; k++){
    const pitch = IQ_ODD_RATIO_PITCH_MAX[placement] - k*0.1;
    if (pitch < pitchMin - 1e-9) return null;
    const centers = unit.map(([a, b]) => [a*pitch, b*pitch]);
    if (iqOddRatioClearance(centers, sides, r) >= margin - IQ_ODD_RATIO_CLEAR_EPS) return centers;
  }
}
// Smallest distance from any dot centre to any edge line of the polygon AS DRAWN (vertices rounded
// to 0.1 exactly like the renderer), so a dot on or near a side is rejected, not mistaken for interior.
function iqOddRatioClearance(centers, sides, r){
  const verts = iqPolygonPoints(0, 0, r, sides, -90).split(' ').map(p => p.split(',').map(Number));
  let least = Infinity;
  for (const [px, py] of centers){
    for (let k = 0; k < verts.length; k++){
      const [x1, y1] = verts[k], [x2, y2] = verts[(k+1) % verts.length];
      const ex = x2 - x1, ey = y2 - y1, len = Math.hypot(ex, ey);
      let nx = -ey/len, ny = ex/len;
      if ((0 - x1)*nx + (0 - y1)*ny < 0){ nx = -nx; ny = -ny; } // inward normal (center is inside)
      least = Math.min(least, (px - x1)*nx + (py - y1)*ny);
    }
  }
  return least;
}
function iqOddRenderRatioShape(sides, dots, color, strokeWidth, size, placement){
  size = size || 100;
  const cx = size/2, cy = size/2;
  const L = iqOddRatioLayout(sides, dots, strokeWidth, size, placement);
  if (!L.centers) throw new Error('iqOddRenderRatioShape: no "' + placement + '" layout fits ' + dots + ' dots in a ' + sides + '-sided shape.');
  const outlinePts = iqPolygonPoints(cx, cy, L.r, sides, -90);
  let inner = '';
  L.centers.forEach(([dx, dy]) => {
    inner += '<circle cx="'+(cx+dx).toFixed(1)+'" cy="'+(cy+dy).toFixed(1)+'" r="'+L.dotR.toFixed(1)+'" fill="#1a1a2e"/>';
  });
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+
    '<polygon points="'+outlinePts+'" fill="'+color+'" stroke="#1a1a2e" stroke-width="'+strokeWidth+'"/>'+inner+'</svg>';
}
// Geometric self-check for the ratio rule: every dot MARKER (not just its center)
// must clear every edge by the same full margin the layout is built with - dot
// radius + half the stroke + the visible gap - and no two markers may crowd each
// other (centre distance >= IQ_ODD_RATIO_MIN_CENTER). Dot counts outside 1..8 and shapes
// outside 3..7 sides are rejected, not laid out.
function iqOddRatioPlacementOk(item){
  if (!Number.isInteger(item.sides) || item.sides < IQ_ODD_RATIO_SIDES_MIN || item.sides > IQ_ODD_RATIO_SIDES_MAX) return false;
  if (!Number.isInteger(item.dots) || item.dots < 1 || item.dots > IQ_ODD_RATIO_MAX_DOTS) return false;
  if (!['ring', 'rows', 'dice'].includes(item.placement || 'ring')) return false;
  const L = iqOddRatioLayout(item.sides, item.dots, item.strokeWidth, item.size, item.placement);
  if (!L.centers || L.centers.length !== item.dots) return false;
  if (iqOddRatioClearance(L.centers, item.sides, L.r) < L.margin - IQ_ODD_RATIO_CLEAR_EPS) return false;
  for (let i = 0; i < L.centers.length; i++){
    for (let j = i+1; j < L.centers.length; j++){
      const dx = L.centers[i][0] - L.centers[j][0], dy = L.centers[i][1] - L.centers[j][1];
      if (Math.hypot(dx, dy) < IQ_ODD_RATIO_MIN_CENTER - 1e-6) return false;
    }
  }
  return true;
}
// Row-count filter (rows placement only): if the odd option has a different number of rows than the
// other three AND those three all have the same number of rows, the row count alone gives the answer away.
function iqOddRatioRowsGiveAway(dotsList, oddIndex){
  const rowCounts = dotsList.map(d => IQ_ODD_RATIO_ROWS[d].length);
  const others = rowCounts.filter((_, i) => i !== oddIndex);
  return others.every(v => v === others[0]) && rowCounts[oddIndex] !== others[0];
}
function iqOddRatioExplanation(offset){
  const rule = { '-2': 'מספר הצלעות פחות 2', '-1': 'מספר הצלעות פחות 1', '0': 'מספר הצלעות', '1': 'מספר הצלעות ועוד 1' }[offset];
  return 'בשלוש הצורות מספר הנקודות הפנימיות הוא בדיוק ' + rule + ' - בצורה שנבחרה היחס הזה לא מתקיים.';
}
function iqOddWrongDotCount(sides){
  const correct = sides - 1;
  return pickOne([correct+1, correct+2, Math.max(0, correct-1)].filter(v => v !== correct));
}
// The original variant: its own tier pools and its own wrong-count policy, kept exactly as it was.
function iqOddGenRatio(tier){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const sidesPool = (tier >= 4) ? [4,5,6,7] : [3,4,5,6];
  const chosenSides = shuffle(sidesPool).slice(0, 4);
  const oddIndex = randInt(0, 3);
  const items = chosenSides.map((sides, i) => {
    const dots = (i === oddIndex) ? iqOddWrongDotCount(sides) : sides - 1;
    return { kind: 'ratio', sides, dots, color, strokeWidth, size };
  });
  return { items, oddIndex, family: 'ratio', variant: 'sides-minus-1-ring',
    structureKey: 'ratio:sides-minus-1-ring:' + items.map(it => it.sides + '/' + it.dots).sort().join(','),
    explanation: iqOddRatioExplanation(-1) };
}
// The other variants: the side counts are any 4 of 3..7 (5 ways), the odd option is any of them and its
// count is the rule value -2, -1, +1 or +2 off. Every such STRUCTURE that passes the placement check
// (and, for rows, the row-count filter) is enumerated once, and one is picked uniformly.
const IQ_ODD_RATIO_STRUCTURES = {};
function iqOddRatioStructures(def){
  if (IQ_ODD_RATIO_STRUCTURES[def.key]) return IQ_ODD_RATIO_STRUCTURES[def.key];
  const usable = (sides, dots) => iqOddRatioPlacementOk({ sides, dots, strokeWidth: 3, size: 100, placement: def.placement });
  const all = [3, 4, 5, 6, 7], list = [];
  for (let skip = 0; skip < all.length; skip++){
    const set = all.filter((_, i) => i !== skip);
    if (!set.every(s => usable(s, s + def.offset))) continue;
    for (const oddSides of set) for (const off of IQ_ODD_RATIO_WRONG_OFFSETS){
      const wrong = oddSides + def.offset + off;
      if (!usable(oddSides, wrong)) continue;
      const dots = set.map(s => (s === oddSides ? wrong : s + def.offset));
      if (def.placement === 'rows' && iqOddRatioRowsGiveAway(dots, set.indexOf(oddSides))) continue;
      list.push({ set, oddSides, wrong });
    }
  }
  IQ_ODD_RATIO_STRUCTURES[def.key] = list;
  return list;
}
function iqOddGenRatioVariant(def){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const q = pickOne(iqOddRatioStructures(def));
  const order = shuffle(q.set.slice());
  const items = order.map(sides => {
    const item = { kind: 'ratio', sides, dots: sides === q.oddSides ? q.wrong : sides + def.offset, color, strokeWidth, size };
    if (def.placement !== 'ring') item.placement = def.placement;
    return item;
  });
  return { items, oddIndex: order.indexOf(q.oddSides), family: 'ratio', variant: def.key,
    structureKey: 'ratio:' + def.key + ':' + items.map(it => it.sides + '/' + it.dots).sort().join(','),
    explanation: iqOddRatioExplanation(def.offset) };
}
// key, rule offset (dots = sides + offset), placement, first tier. The original variant keeps its own generator;
// the others use iqOddGenRatioVariant. All are enabled (registration below); a variant is only asked from its minTier.
const IQ_ODD_RATIO_VARIANTS = [
  { key: 'sides-minus-1-ring', offset: -1, placement: 'ring', minTier: 1, generate: tier => iqOddGenRatio(tier) },
  { key: 'sides-ring',         offset: 0,  placement: 'ring', minTier: 1 },
  { key: 'sides-minus-1-rows', offset: -1, placement: 'rows', minTier: 2 },
  { key: 'sides-minus-1-dice', offset: -1, placement: 'dice', minTier: 2 },
  { key: 'sides-rows',         offset: 0,  placement: 'rows', minTier: 2 },
  { key: 'sides-minus-2-ring', offset: -2, placement: 'ring', minTier: 3 },
  { key: 'sides-minus-2-rows', offset: -2, placement: 'rows', minTier: 3 },
  { key: 'sides-minus-2-dice', offset: -2, placement: 'dice', minTier: 3 },
  { key: 'sides-plus-1-ring',  offset: 1,  placement: 'ring', minTier: 4 },
  { key: 'sides-plus-1-rows',  offset: 1,  placement: 'rows', minTier: 4 }
];

// ---- symmetry rule: three exactly-symmetric outlines vs one with a single moved corner ----
const IQ_ODD_SYM_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
// The coordinates exactly as they are drawn: each rounded to 0.1 and kept as the
// strings that go into the SVG. The renderer and the rendered-margin calculation
// both use this, so they can never disagree about the geometry.
function iqOddBlobPointStrings(radii, size){
  const c = (size || 100) / 2;
  return IQ_ODD_SYM_ANGLES.map((deg, i) => {
    const rad = deg * Math.PI/180;
    return [(c + radii[i]*Math.cos(rad)).toFixed(1), (c + radii[i]*Math.sin(rad)).toFixed(1)];
  });
}
function iqOddRenderBlob(radii, color, strokeWidth, size){
  size = size || 100;
  const pts = iqOddBlobPointStrings(radii, size).map(p => p.join(',')).join(' ');
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+
    '<polygon points="'+pts+'" fill="'+color+'" stroke="#1a1a2e" stroke-width="'+strokeWidth+'" stroke-linejoin="round"/></svg>';
}
// Every symmetry question uses the SAME radius range at every tier (the range is
// never narrowed), and every odd shape must clear a minimum "margin" measured on
// the RENDERED geometry (the rounded coordinates that are actually drawn). Margin =
// for each of the four mirror axes take the largest distance between a vertex's
// mirror image and its mirror partner, then take the smallest of the four: the
// least asymmetry the shape shows against its best axis. An odd shape below the
// floor is nearly symmetric, so the verifier rejects it (the question is
// regenerated) - it is never shown.
const IQ_ODD_SYM_R_MIN = 22, IQ_ODD_SYM_R_MAX = 38;
const IQ_ODD_SYM_MIN_MARGIN = 5;
const IQ_ODD_SYM_EPS = 1e-9;
// The four mirror axes of an 8-point outline with a vertex every 45 degrees
// (indices follow IQ_ODD_SYM_ANGLES), as the vertex pairs each axis swaps. Every
// axis passes through two opposite vertices, which stay where they are.
const IQ_ODD_SYM_AXIS_PAIRS = {
  vertical:   [[0,4], [1,3], [5,7]],   // axis through 90/270
  horizontal: [[1,7], [2,6], [3,5]],   // axis through 0/180
  diag45:     [[0,2], [3,7], [4,6]],   // axis through 45/225
  diag135:    [[0,6], [1,5], [2,4]]    // axis through 135/315
};
const IQ_ODD_SYM_AXES = Object.keys(IQ_ODD_SYM_AXIS_PAIRS);
// Mirror image of a point (x, y), measured from the centre, about each axis. For
// axes at multiples of 45 degrees this is an exact swap/negation, so it stays in
// integer arithmetic. (SVG y points down, so diag45 runs from the top-left to the
// bottom-right and diag135 from the top-right to the bottom-left.)
const IQ_ODD_SYM_AXIS_MIRROR = {
  vertical:   (x, y) => [-x, y],
  horizontal: (x, y) => [x, -y],
  diag45:     (x, y) => [y, x],
  diag135:    (x, y) => [-y, -x]
};
// How each axis is named to the child (shown in the explanation after a correct answer).
const IQ_ODD_SYM_AXIS_TEXT = {
  vertical:   'אנכי',
  horizontal: 'אופקי',
  diag45:     'מוטה, מלמעלה-שמאל למטה-ימין',
  diag135:    'מוטה, מלמעלה-ימין למטה-שמאל'
};
// For each axis, how far the RENDERED shape is from symmetric about it: the
// largest squared distance (an integer, in tenths of a unit squared) between a
// vertex's mirror image and its partner. The drawn coordinates are multiples of
// 0.1, so this is exact integer arithmetic and needs no tolerance. Used by the
// generator AND the verifier, for both the margin floor and the extra-axis check.
function iqOddRenderedAxisSq(radii, size){
  const c = Math.round((size || 100) / 2 * 10);
  const p = iqOddBlobPointStrings(radii, size).map(([x, y]) => [Math.round(Number(x) * 10) - c, Math.round(Number(y) * 10) - c]);
  const out = {};
  IQ_ODD_SYM_AXES.forEach(axis => {
    let worst = 0;
    IQ_ODD_SYM_AXIS_PAIRS[axis].forEach(([i, j]) => {
      const [mx, my] = IQ_ODD_SYM_AXIS_MIRROR[axis](p[i][0], p[i][1]);
      const dx = mx - p[j][0], dy = my - p[j][1];
      worst = Math.max(worst, dx*dx + dy*dy);
    });
    out[axis] = worst;
  });
  return out;
}
// The margin of the RENDERED shape: the smallest of the four axis errors.
function iqOddRenderedMarginSq(radii, size){
  const sq = iqOddRenderedAxisSq(radii, size);
  return Math.min(...IQ_ODD_SYM_AXES.map(a => sq[a]));
}
const iqOddMeetsMarginFloor = radii => iqOddRenderedMarginSq(radii) >= Math.pow(IQ_ODD_SYM_MIN_MARGIN * 10, 2);
// A shape is DRAWN symmetric about an axis when its reflection error is within what
// rounding alone can produce: an exactly symmetric shape is off by at most one tenth
// per coordinate, i.e. at most 2 (measured: its own axis is always exactly 0), so 4
// is twice that worst case. The three "normal" shapes must be drawn symmetric about
// their own axis ONLY - otherwise the player sees a second axis nobody intended
// (and "each shape has one axis" would be untrue of the drawing).
const IQ_ODD_SYM_DRAWN_SQ = 4;
function iqOddDrawnAxes(radii){
  const sq = iqOddRenderedAxisSq(radii);
  return IQ_ODD_SYM_AXES.filter(a => sq[a] <= IQ_ODD_SYM_DRAWN_SQ);
}
// The unrounded radii margin: only used to recognise an EXACTLY symmetric shape
// (all mirror pairs share one radius), never for the floor.
function iqOddSymmetryMargin(radii){
  let margin = Infinity;
  IQ_ODD_SYM_AXES.forEach(axis => {
    let gap = 0;
    IQ_ODD_SYM_AXIS_PAIRS[axis].forEach(([i, j]) => { gap = Math.max(gap, Math.abs(radii[i] - radii[j])); });
    margin = Math.min(margin, gap);
  });
  return margin;
}
// Exactly symmetric BY CONSTRUCTION: each mirror pair is given one shared radius.
function iqOddSymmetricRadii(axis){
  const r = new Array(8).fill(null);
  for (let i = 0; i < 8; i++){
    if (r[i] !== null) continue;
    const pair = IQ_ODD_SYM_AXIS_PAIRS[axis].find(p => p[0] === i || p[1] === i);
    r[i] = IQ_ODD_SYM_R_MIN + Math.random() * (IQ_ODD_SYM_R_MAX - IQ_ODD_SYM_R_MIN);
    if (pair) r[pair[0] === i ? pair[1] : pair[0]] = r[i];
  }
  return r;
}
// Local defect: an otherwise symmetric shape with ONE vertex moved off its mirror
// partner's radius by the defect size. The partner's radius is drawn so the moved
// vertex stays inside the radius range.
function iqOddDefectCandidate(axis, band){
  const r = iqOddSymmetricRadii(axis);
  const pair = pickOne(IQ_ODD_SYM_AXIS_PAIRS[axis]);
  const moved = randInt(0, 1), i = pair[moved], j = pair[1 - moved];
  const gap = band[0] + Math.random() * (band[1] - band[0]);
  const outward = Math.random() < 0.5; // moved vertex further from / closer to the centre than its partner
  const lo = outward ? IQ_ODD_SYM_R_MIN : IQ_ODD_SYM_R_MIN + gap;
  const hi = outward ? IQ_ODD_SYM_R_MAX - gap : IQ_ODD_SYM_R_MAX;
  r[j] = lo + Math.random() * (hi - lo);
  r[i] = outward ? r[j] + gap : r[j] - gap;
  return r;
}
// The moved vertex always breaks the chosen axis by the defect size, but the
// shape can by chance ALSO sit close to symmetric about one of the other three
// axes (measured: about 36-37% of candidates), which the margin floor rejects. That
// rejection happens here, up to IQ_ODD_SYM_MAX_CANDIDATES times, so that
// the shared retry loop (10 attempts) is essentially never exhausted; if every
// candidate failed (measured probability about 1e-13) the last one is returned
// and the verifier rejects it. The number tried is reported on the result.
const IQ_ODD_SYM_MAX_CANDIDATES = 30;
function iqOddDefectRadii(axis, band){
  let r, tried = 0;
  do { r = iqOddDefectCandidate(axis, band); tried++; }
  while (tried < IQ_ODD_SYM_MAX_CANDIDATES && !iqOddMeetsMarginFloor(r));
  return { radii: r, tried };
}
// A normal shape: exactly symmetric about its axis AND drawn symmetric about no other
// axis (measured: about 0.08% of raw candidates are, by rounding coincidence, which
// is rejected here, in the same bounded candidate loop; if every candidate failed
// the last one is returned and the verifier rejects it).
function iqOddSymmetricNormal(axis){
  let r, tried = 0, drawn;
  do { r = iqOddSymmetricRadii(axis); tried++; drawn = iqOddDrawnAxes(r); }
  while (tried < IQ_ODD_SYM_MAX_CANDIDATES && !(drawn.length === 1 && drawn[0] === axis));
  return { radii: r, tried };
}
// Defect size by tier band. It is bounded below by the margin floor at every tier
// and kept close to it: the larger the moved vertex, the more the odd shape's
// overall spread stands out, which would be a shortcut that has nothing to do with
// symmetry (measured when these bands were chosen).
function iqOddSymmetryDefectBand(tier){
  return tier <= 2 ? [7, 8.5] : tier <= 4 ? [6, 7] : [5, 6];
}
// Which axis each shape uses. Difficulty comes mainly from here:
//   tiers 1-2: ONE axis per question (any of the four), shared by every shape;
//   tiers 3-4: the symmetric shapes use TWO different axes (mixed axes);
//   tiers 5-6: the symmetric shapes use THREE different axes, and the odd shape's
//              own near-axis may be any of the four.
function iqOddSymmetryAxisPlan(tier){
  if (tier <= 2){
    const a = pickOne(IQ_ODD_SYM_AXES);
    return { variant: 'axis-fixed', normalAxes: [a, a, a], baseAxis: a };
  }
  if (tier <= 4){
    const [a, b] = shuffle(IQ_ODD_SYM_AXES.slice()).slice(0, 2);
    return { variant: 'axis-mixed-2', normalAxes: shuffle([a, b, pickOne([a, b])]), baseAxis: pickOne([a, b]) };
  }
  return { variant: 'axis-mixed-3', normalAxes: shuffle(IQ_ODD_SYM_AXES.slice()).slice(0, 3), baseAxis: pickOne(IQ_ODD_SYM_AXES) };
}
function iqOddGenSymmetry(tier){
  const color = pickOne(IQ_SHAPE_COLORS), strokeWidth = 3, size = 100;
  const plan = iqOddSymmetryAxisPlan(tier);
  const normals = plan.normalAxes.map(axis => iqOddSymmetricNormal(axis));
  const radiiList = normals.map(n => n.radii);
  const odd = iqOddDefectRadii(plan.baseAxis, iqOddSymmetryDefectBand(tier));
  const oddIndex = randInt(0, 3);
  radiiList.splice(oddIndex, 0, odd.radii);
  const items = radiiList.map(radii => ({ kind: 'symmetry', radii, color, strokeWidth, size }));
  const used = IQ_ODD_SYM_AXES.filter(a => plan.normalAxes.includes(a));
  // each symmetric shape has exactly ONE axis; with mixed axes say so, then list the kinds used
  const axesText = used.length === 1
    ? 'ולכל אחת מהן ציר סימטריה ' + IQ_ODD_SYM_AXIS_TEXT[used[0]]
    : 'ולכל אחת מהן ציר סימטריה אחד. הצירים: ' + used.map(a => IQ_ODD_SYM_AXIS_TEXT[a]).join('; ');
  return { items, oddIndex, family: 'symmetry', variant: plan.variant, candidatesTried: odd.tried, normalCandidatesTried: normals.reduce((s, n) => s + n.tried, 0),
    structureKey: 'symmetry:' + plan.variant + ':normals=' + plan.normalAxes.slice().sort().join('+') + ':defect-axis=' + plan.baseAxis,
    explanation: 'שלוש הצורות סימטריות, ' + axesText + '. בצורה שנבחרה אחת הפינות זזה, ולכן אין לה אף ציר סימטריה.' };
}

// ---- per-family self-verification: EXACTLY one item may break the family's rule ----
// Each family recomputes which option(s) break its rule and returns false unless
// exactly one does AND it is the one the generator named - so an ambiguous
// question (zero or multiple "odd" shapes) is regenerated and can never reach
// the player. The generic dispatch (iqOddGenerate / iqOddVerifyExactlyOneOdd /
// iqOddRenderItem) lives in iq-odd-core.js.
function iqOddExactlyOneBreaks(result, ruleHolds){
  let failCount = 0, failIdx = -1;
  result.items.forEach((it, i) => { if (!ruleHolds(it)){ failCount++; failIdx = i; } });
  return failCount === 1 && failIdx === result.oddIndex;
}
function iqOddVerifyOrientation(result){
  const cellDef = IQ_ODD_ORIENT_CELL_VARIANTS.find(v => v.key === result.variant);
  if (cellDef) return iqOddVerifyCellOrientation(result, cellDef);
  if (!iqOddExactlyOneBreaks(result, it => iqOddIsRotationOfBase(it.pts))) return false;
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
  // Mathematically-distinct polygons can still be visually confusable if
  // their notch sits in the same corner (a child reads "which corner is
  // cut", not exact proportions) - so this additionally rejects a question
  // where the mirrored option's notch quadrant matches any normal option's.
  const oddQuadrant = iqOddNotchQuadrant(result.items[result.oddIndex].pts);
  for (let i = 0; i < result.items.length; i++){
    if (i === result.oddIndex) continue;
    if (iqOddNotchQuadrant(result.items[i].pts) === oddQuadrant) return false;
  }
  return true;
}
function iqOddVerifyRatio(result){
  const def = IQ_ODD_RATIO_VARIANTS.find(v => v.key === result.variant);
  if (!def) return false;
  // exactly the odd option breaks "dots = sides + offset" of THIS variant, and the four side counts differ
  // (so the three that follow the rule determine that one rule and no other straight-line rule)
  if (!iqOddExactlyOneBreaks(result, it => it.dots === it.sides + def.offset)) return false;
  if (new Set(result.items.map(it => it.sides)).size !== result.items.length) return false;
  // one placement for all four options, the variant's own
  if (!result.items.every(it => (it.placement || 'ring') === def.placement)) return false;
  // every marker in all 4 options must sit fully inside its shape with the full safety margin
  for (let i = 0; i < result.items.length; i++){
    if (!iqOddRatioPlacementOk(result.items[i])) return false;
  }
  if (def.placement === 'rows' && iqOddRatioRowsGiveAway(result.items.map(it => it.dots), result.oddIndex)) return false;
  return true;
}
function iqOddVerifySymmetry(result){
  const inRange = r => Array.isArray(r) && r.length === 8 &&
    r.every(v => typeof v === 'number' && v >= IQ_ODD_SYM_R_MIN - IQ_ODD_SYM_EPS && v <= IQ_ODD_SYM_R_MAX + IQ_ODD_SYM_EPS);
  if (!result.items.every(it => inRange(it.radii))) return false;
  // the three normals are EXACTLY symmetric about some axis; exactly one shape is not...
  if (!iqOddExactlyOneBreaks(result, it => iqOddSymmetryMargin(it.radii) <= IQ_ODD_SYM_EPS)) return false;
  // ...no normal is drawn symmetric about a second axis (its own axis is one of them)...
  if (!result.items.every((it, i) => i === result.oddIndex || iqOddDrawnAxes(it.radii).length === 1)) return false;
  // ...and the odd one clears the margin floor on the RENDERED geometry (no tolerance),
  // so it is not merely nearly symmetric
  return iqOddMeetsMarginFloor(result.items[result.oddIndex].radii);
}

// ---- the three families, registered in the order the original code listed them ----
// Every entry resolves the named function at call time (the arrows), exactly as
// the previous if/else chain did.
iqOddRegisterFamily({
  key: 'orientation',
  generate: tier => iqOddPickVariant('orientation', tier).generate(tier),
  verify: result => iqOddVerifyOrientation(result),
  render: item => iqOddRenderPolygon(item.pts, item.color, item.strokeWidth, item.size)
});
iqOddRegisterVariants('orientation', [
  { key: 'flag', minTier: 1, enabled: true, generate: tier => iqOddGenOrientation(tier) }
].concat(IQ_ODD_ORIENT_CELL_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqOddGenCellOrientation(def) }))));
iqOddRegisterFamily({
  key: 'ratio',
  generate: tier => iqOddPickVariant('ratio', tier).generate(tier),
  verify: result => iqOddVerifyRatio(result),
  render: item => iqOddRenderRatioShape(item.sides, item.dots, item.color, item.strokeWidth, item.size, item.placement)
});
iqOddRegisterVariants('ratio', IQ_ODD_RATIO_VARIANTS.map(def => ({
  key: def.key,
  minTier: def.minTier,
  enabled: true,
  generate: def.generate || (() => iqOddGenRatioVariant(def))
})));
iqOddRegisterFamily({
  key: 'symmetry',
  generate: tier => iqOddGenSymmetry(tier),
  verify: result => iqOddVerifySymmetry(result),
  render: item => iqOddRenderBlob(item.radii, item.color, item.strokeWidth, item.size)
});
// equal parts (family and variants enabled; each from its own first tier)
iqOddRegisterFamily({
  key: 'parts',
  minTier: 2,
  generate: tier => iqOddPickVariant('parts', tier).generate(tier),
  verify: result => iqOddVerifyParts(result),
  render: item => iqOddRenderParts(item)
});
iqOddRegisterVariants('parts', IQ_ODD_PARTS_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqOddGenParts(def) })));
// property classification
iqOddRegisterFamily({
  key: 'props',
  minTier: 3,
  generate: tier => iqOddPickVariant('props', tier).generate(tier),
  verify: result => iqOddVerifyProps(result),
  render: item => iqOddRenderPolygon(item.pts, item.color, item.strokeWidth, item.size)
});
iqOddRegisterVariants('props', IQ_ODD_PROPS_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqOddGenProps(def) })));
// topology (holes / chains)
iqOddRegisterFamily({
  key: 'topology',
  minTier: 2,
  generate: tier => iqOddPickVariant('topology', tier).generate(tier),
  verify: result => iqOddVerifyTopology(result),
  render: item => iqOddRenderTopology(item)
});
iqOddRegisterVariants('topology', IQ_ODD_TOPO_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqOddGenTopology(def) })));
// stacking order
iqOddRegisterFamily({
  key: 'stack',
  minTier: 4,
  generate: tier => iqOddPickVariant('stack', tier).generate(tier),
  verify: result => iqOddVerifyStack(result),
  render: item => iqOddRenderStack(item)
});
iqOddRegisterVariants('stack', IQ_ODD_STACK_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqOddGenStack(def) })));
// networks
iqOddRegisterFamily({
  key: 'net',
  minTier: 4,
  generate: tier => iqOddPickVariant('net', tier).generate(tier),
  verify: result => iqOddVerifyNet(result),
  render: item => iqOddRenderNet(item)
});
iqOddRegisterVariants('net', IQ_ODD_NET_VARIANTS.map(def => ({ key: def.key, minTier: def.minTier, enabled: true, generate: () => iqOddGenNet(def) })));

registerIQCategory({
  key: 'oddone',
  icon: '🧐',
  title: 'מה לא שייך?',
  subtitle: 'מצאו את הצורה השונה',
  maxTier: 6,
  renderQuestion(tier, promptEl, optionsEl, onAnswer){
    const { items, oddIndex, explanation, family } = iqOddGenerate(tier);
    optionsEl.classList.toggle('iq-options-large', iqOddFamily(family).largeTiles);   // families with fine detail get bigger tiles on wide screens
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
const IQ_ANALOGY_EVEN_POOL = [4, 6, 8, 10, 12, 14, 16];
// Picks two distinct values from a pool - used everywhere a mechanic needs
// "A's starting count" and "B's starting count" to differ, instead of two
// hardcoded literals that made every question using that mechanic look
// identical except for shape/color (the same bug already fixed elsewhere in
// this file and in iq-matrix3.js: a structural parameter silently never varied).
function iqAnalogyDistinctPair(pool){
  const a = pickOne(pool);
  const b = pickOne(pool.filter(v => v !== a));
  return [a, b];
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
  const [baseA, baseB] = iqAnalogyDistinctPair(IQ_ANALOGY_EVEN_POOL);
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
  const rot = pickOne([60, 90, 120, 150]);
  const scl = pickOne([1.2, 1.3, 1.4, 1.5]);
  const cnt = pickOne([2, 3, 4]);
  const Aprime = Object.assign({}, A, { color: iqPairedColor(A.color), scale: scl, rotation: rot, count: cnt });
  const correctBprime = Object.assign({}, B, { color: iqPairedColor(B.color), scale: scl, rotation: rot, count: cnt });
  const wrongBprimes = [
    Object.assign({}, B, { color: iqPairedColor(B.color), scale: scl, rotation: rot }), // missing the count change
    Object.assign({}, B, { color: iqPairedColor(B.color), scale: scl, count: cnt }),     // missing the rotation
    Object.assign({}, B, { scale: scl, rotation: rot, count: cnt })                       // missing the color change
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_reversedComboTrap(){ // count HALVES and color swaps, together
  const { A, B } = iqAnalogySetupTypes(false);
  const [baseA, baseB] = iqAnalogyDistinctPair(IQ_ANALOGY_EVEN_POOL);
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
function iqAnalogyMech_oddAngleTrap(){ // rotation by an unexpected angle + count halving + a color swap
  const { A, B } = iqAnalogySetupTypes(true);
  const [baseA, baseB] = iqAnalogyDistinctPair(IQ_ANALOGY_EVEN_POOL);
  const oddAngle = pickOne([135, 225, 315]); // deliberately NOT 90 - that's the "usual angle" trap below
  A.count = baseA; B.count = baseB;
  const Aprime = Object.assign({}, A, { rotation: oddAngle, color: iqPairedColor(A.color), count: baseA / 2 });
  const correctBprime = Object.assign({}, B, { rotation: oddAngle, color: iqPairedColor(B.color), count: baseB / 2 });
  const wrongBprimes = [
    Object.assign({}, B, { rotation: 90, color: iqPairedColor(B.color), count: baseB / 2 }),  // assumed the "usual" 90 instead of the odd angle
    Object.assign({}, B, { rotation: oddAngle, color: iqPairedColor(B.color), count: baseB * 2 }),  // doubled instead of halved
    Object.assign({}, B, { rotation: oddAngle, count: baseB / 2 })                                  // forgot the color
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_derivedRotationCount(){ // rotation DERIVED from count (count x 45), count doubles
  const { A, B } = iqAnalogySetupTypes(true);
  const [baseA, baseB] = iqAnalogyDistinctPair([2, 3, 4, 5]);
  A.count = baseA; A.rotation = baseA * 45;
  B.count = baseB; B.rotation = baseB * 45;
  const newCountA = baseA * 2, newCountB = baseB * 2;
  const Aprime = Object.assign({}, A, { count: newCountA, rotation: newCountA * 45 });
  const correctBprime = Object.assign({}, B, { count: newCountB, rotation: newCountB * 45 });
  const wrongBprimes = [
    Object.assign({}, B, { count: newCountB, rotation: baseB * 45 }),          // doubled the count, forgot rotation must scale WITH it
    Object.assign({}, B, { count: newCountB, rotation: newCountB * 45 - 45 }), // close, but didn't quite derive it right
    Object.assign({}, B, { count: baseB, rotation: newCountB * 45 })          // got the derived rotation, forgot to double the count
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_derivedGrowCombo(){ // derived rotation from the doubled count, AND color + size change alongside
  const { A, B } = iqAnalogySetupTypes(true);
  const [baseA, baseB] = iqAnalogyDistinctPair([2, 3, 4, 5]);
  const scl = pickOne([1.2, 1.3, 1.4]);
  A.count = baseA; B.count = baseB;
  const newA = baseA * 2, newB = baseB * 2;
  const Aprime = Object.assign({}, A, { count: newA, rotation: newA * 45, color: iqPairedColor(A.color), scale: scl });
  const correctBprime = Object.assign({}, B, { count: newB, rotation: newB * 45, color: iqPairedColor(B.color), scale: scl });
  const wrongBprimes = [
    Object.assign({}, B, { count: newB, rotation: baseB * 45, color: iqPairedColor(B.color), scale: scl }), // used the OLD count to derive rotation
    Object.assign({}, B, { count: newB, rotation: newB * 45, scale: scl }),                                 // forgot the color
    Object.assign({}, B, { count: newB, rotation: newB * 45, color: iqPairedColor(B.color) })               // forgot the size change
  ];
  return { A, Aprime, B, correctBprime, wrongBprimes };
}
function iqAnalogyMech_derivedHalveCombo(){ // derived rotation, but based on a HALVED count
  const { A, B } = iqAnalogySetupTypes(true);
  const [baseA, baseB] = iqAnalogyDistinctPair(IQ_ANALOGY_EVEN_POOL);
  A.count = baseA; B.count = baseB;
  const newA = baseA / 2, newB = baseB / 2;
  const Aprime = Object.assign({}, A, { count: newA, rotation: newA * 45 });
  const correctBprime = Object.assign({}, B, { count: newB, rotation: newB * 45 });
  const wrongBprimes = [
    Object.assign({}, B, { count: newB, rotation: baseB * 45 }),           // derived the rotation from the OLD count instead of the new one
    Object.assign({}, B, { count: baseB * 2, rotation: (baseB*2) * 45 }),  // doubled instead of halved (rotation consistent with that wrong count)
    Object.assign({}, B, { count: newB, rotation: newB * 45 + 45 })       // right count, close-but-wrong rotation
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
