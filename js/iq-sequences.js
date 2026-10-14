'use strict';

/* ============ Shared numeric distractor sanitizer ============ */
// Each pattern below proposes a handful of "plausible mistake" candidates
// (repeat the last term, use the wrong operation, off-by-one, etc). This just
// dedupes them against the correct answer and each other, then pads with
// nearby random values in the rare case fewer than 3 unique ones survive.
function iqSanitizeNumberDistractors(next, candidates, fallbackSpread){
  const seen = new Set([next]);
  const out = [];
  candidates.forEach(v => {
    v = Math.round(v);
    if (!seen.has(v)){ out.push(v); seen.add(v); }
  });
  let guard = 0;
  while (out.length < 3 && guard < 50){
    guard++;
    const v = next + randInt(-fallbackSpread, fallbackSpread) || 1;
    if (!seen.has(v)){ out.push(v); seen.add(v); }
  }
  return out.slice(0, 3);
}

function iqIsPrime(n){
  if (n < 2) return false;
  for (let i = 2; i*i <= n; i++){ if (n % i === 0) return false; }
  return true;
}
function iqFirstPrimesFrom(startIdx, count){
  const primes = [];
  let n = 2;
  while (primes.length < startIdx + count){
    if (iqIsPrime(n)) primes.push(n);
    n++;
  }
  return primes.slice(startIdx, startIdx + count);
}

/* ============ Category: number sequences ("what comes next?") ============ */
// Difficulty ladder is pushed well beyond plain arithmetic - even tier 1 requires
// recognizing squares, primes, or a growing gap, not just "add the same number".
// Distractors are the classic mistake for each pattern type (wrong operation,
// assumed-constant gap, off-by-one), not just random nearby noise.
function generateNumberSequence(tier){
  let terms, next, candidates;

  if (tier === 1){
    const subtype = pickOne(['squares', 'secondOrder', 'primes']);
    if (subtype === 'squares'){
      const startN = randInt(1, 5);
      terms = [];
      for (let n = startN; n < startN+4; n++) terms.push(n*n);
      next = (startN+4) * (startN+4);
      candidates = [
        terms[3] + (terms[3]-terms[2]), // extended the last gap linearly (missed that gaps grow)
        next - 1,
        next + 2
      ];
    } else if (subtype === 'secondOrder'){
      // second-order arithmetic: the gaps between terms grow by a fixed amount
      const start = randInt(1, 5);
      let delta = randInt(1, 3);
      const deltaStep = randInt(1, 2);
      terms = [start];
      for (let i = 0; i < 4; i++){
        terms.push(terms[terms.length-1] + delta);
        delta += deltaStep;
      }
      next = terms[terms.length-1] + delta;
      candidates = [
        terms[3] + (delta - deltaStep), // forgot to grow the gap this last step
        next - deltaStep,
        next + deltaStep
      ];
    } else {
      // prime numbers - tests number sense beyond any fixed arithmetic operation
      const startIdx = randInt(0, 3);
      const primes = iqFirstPrimesFrom(startIdx, 5);
      terms = primes.slice(0, 4);
      next = primes[4];
      candidates = [
        terms[3] + (terms[3]-terms[2]), // assumed a constant gap (primes gaps aren't constant)
        next + 1,
        next - 2
      ];
    }

  } else if (tier === 2){
    const subtype = pickOne(['cubes', 'triangular', 'bigGeometric']);
    if (subtype === 'cubes'){
      const startN = randInt(1, 4);
      terms = [];
      for (let n = startN; n < startN+4; n++) terms.push(n*n*n);
      next = Math.pow(startN+4, 3);
      candidates = [
        terms[3] + (terms[3]-terms[2]), // treated it like a constant/linear gap
        next - 1,
        next + 3
      ];
    } else if (subtype === 'triangular'){
      // triangular numbers T(n) = n(n+1)/2: 1,3,6,10,15,21,...
      const tri = n => n*(n+1)/2;
      const startN = randInt(1, 4);
      terms = [];
      for (let n = startN; n < startN+4; n++) terms.push(tri(n));
      next = tri(startN+4);
      candidates = [
        terms[3] + (terms[3]-terms[2]),
        next - 1,
        next + 2
      ];
    } else {
      // geometric with a steeper ratio (x4 or x5)
      const start = randInt(1, 3);
      const ratio = pickOne([4, 5]);
      terms = [start, start*ratio, start*ratio*ratio, start*ratio*ratio*ratio];
      next = start * Math.pow(ratio, 4);
      const otherRatio = ratio === 4 ? 5 : 4;
      candidates = [
        terms[3] + (terms[3]-terms[2]),
        terms[3] * otherRatio,
        terms[3] + terms[2]
      ];
    }

  } else if (tier === 3){
    const subtype = pickOne(['tribonacci', 'oscillatingBig', 'primeSquares']);
    if (subtype === 'tribonacci'){
      // each term is the sum of the THREE terms before it
      const a = randInt(1, 3), b = randInt(1, 4), c = randInt(2, 5);
      const t4 = a+b+c, t5 = b+c+t4;
      terms = [a, b, c, t4];
      next = t5;
      candidates = [t4 + a, t4 * 2, c + t4];
    } else if (subtype === 'oscillatingBig'){
      // bigger alternating +up/-down deltas with net growth
      const d1 = randInt(10, 16), d2 = -randInt(4, 8);
      const start = randInt(10, 25);
      terms = [start];
      const deltas = [d1, d2, d1];
      deltas.forEach(d => terms.push(terms[terms.length-1] + d));
      next = terms[terms.length-1] + d2;
      candidates = [terms[3] + d1, next - 1, next + 1];
    } else {
      // squares of consecutive primes: 4,9,25,49,121,...
      const startIdx = randInt(0, 2);
      const primes = iqFirstPrimesFrom(startIdx, 5);
      terms = primes.slice(0, 4).map(p => p*p);
      next = primes[4] * primes[4];
      candidates = [
        terms[3] + (terms[3]-terms[2]),
        next - 4,
        next + 6
      ];
    }

  } else if (tier === 4){
    const subtype = pickOne(['alternatingHard', 'growingRatio', 'digitSum']);
    if (subtype === 'alternatingHard'){
      // alternating x(3 or 4) then -k, with bigger numbers than the tier-3 oscillation.
      // k is capped relative to start*m so the first subtraction can never reach 0 or below
      // (the only risky step - every later value is bigger, since it's freshly multiplied).
      const m = pickOne([3, 4]);
      const start = randInt(3, 6);
      const k = randInt(1, Math.max(1, Math.floor((start*m) / 2)));
      const seq = [start];
      const ops = [x => x*m, x => x-k, x => x*m, x => x-k, x => x*m];
      ops.forEach(op => seq.push(op(seq[seq.length-1])));
      terms = seq.slice(0, 4);
      next = seq[4];
      candidates = [seq[3] - k, next + 2, next - 3];
    } else if (subtype === 'growingRatio'){
      // increasing multiplier starting from x3 (steeper than the classic factorial-like x2 start)
      const start = randInt(1, 2);
      let mult = 3;
      const seq = [start];
      for (let i = 0; i < 4; i++){ seq.push(seq[seq.length-1] * mult); mult++; }
      terms = seq.slice(0, 4);
      next = seq[4];
      candidates = [terms[3] * 2, terms[3] + terms[2], next - terms[3]];
    } else {
      // digit-sum chain: each term = previous term + sum of its own digits
      const digitSum = n => String(n).split('').reduce((s, d) => s + (+d), 0);
      const start = randInt(15, 40);
      terms = [start];
      for (let i = 0; i < 3; i++){
        const prev = terms[terms.length-1];
        terms.push(prev + digitSum(prev));
      }
      const last = terms[terms.length-1];
      next = last + digitSum(last);
      candidates = [terms[3] + 1, terms[3] + 2, next + digitSum(next)];
    }

  } else if (tier === 5){
    const subtype = pickOne(['thirdOrder', 'interleavedAdvanced']);
    if (subtype === 'thirdOrder'){
      // third-order arithmetic: even the GAP BETWEEN THE GAPS grows by a constant
      // (cubic-like growth) - the hardest, least obvious pattern in the set.
      const start = randInt(1, 4);
      let delta = randInt(2, 4);
      let deltaStep = randInt(1, 2);
      const deltaStepGrowth = 1;
      terms = [start];
      for (let i = 0; i < 4; i++){
        terms.push(terms[terms.length-1] + delta);
        delta += deltaStep;
        deltaStep += deltaStepGrowth;
      }
      next = terms[terms.length-1] + delta;
      candidates = [
        terms[3] + (delta - deltaStep), // grew the gap, but forgot the gap's own growth just accelerated
        next - deltaStep,
        next + deltaStep
      ];
    } else {
      // two interleaved sequences of DIFFERENT kinds (one geometric, one arithmetic) -
      // much trickier to disentangle than two arithmetic tracks.
      const ratio = pickOne([2, 3]);
      const stepB = randInt(3, 8);
      const startA = randInt(1, 3), startB = randInt(1, 15);
      const a0 = startA, a1 = startA*ratio, a2 = startA*ratio*ratio;
      const b0 = startB, b1 = startB + stepB;
      terms = [a0, b0, a1, b1, a2];
      next = b1 + stepB;
      candidates = [
        a2 + (a2 - a1),   // kept following the geometric (A) track
        terms[3] + stepB, // repeated the B step against the wrong term
        next + ratio
      ];
    }

  } else if (tier === 6){
    const subtype = pickOne(['quarticGrowth', 'tripleInterleaved']);
    if (subtype === 'quarticGrowth'){
      // fourth-order arithmetic: even the growth of the growth of the gap grows
      // by a constant - one level beyond tier 5's third-order pattern.
      const e = randInt(1, 2);
      let d3 = randInt(1, 2), d2 = randInt(1, 2), d = randInt(1, 2);
      const start = randInt(1, 3);
      terms = [start];
      for (let i = 0; i < 4; i++){
        terms.push(terms[terms.length-1] + d);
        d += d2; d2 += d3; d3 += e;
      }
      next = terms[terms.length-1] + d;
      candidates = [
        terms[3] + (d - d2), // grew the gap, but missed the last second-order bump
        next - d3,
        next + d3
      ];
    } else {
      // three interleaved arithmetic tracks at once (A,B,C,A,B,C,...) - shown two
      // full rounds, asked for the third A - a genuine step up from tier 5's
      // two-track interleaving.
      const stepA = randInt(2, 4), stepB = randInt(1, 3), stepC = randInt(2, 5);
      const startA = randInt(1, 5), startB = randInt(1, 6), startC = randInt(1, 4);
      const a1 = startA + stepA, b1 = startB + stepB, c1 = startC + stepC;
      const a2 = a1 + stepA;
      terms = [startA, startB, startC, a1, b1, c1];
      next = a2;
      candidates = [
        a1 + stepB, // used track B's step against track A
        a1 + stepC, // used track C's step against track A
        a2 + 1
      ];
    }

  } else { // tier 7 (hardest)
    const subtype = pickOne(['recursiveLinear', 'primePartialSums']);
    if (subtype === 'recursiveLinear'){
      // each term = 2 x previous + the one before that (a linear recurrence,
      // like Pell numbers) - no visible constant gap or ratio to fall back on.
      const t0 = randInt(1, 3), t1 = randInt(1, 4);
      const t2 = 2*t1 + t0, t3 = 2*t2 + t1, t4 = 2*t3 + t2;
      terms = [t0, t1, t2, t3];
      next = t4;
      candidates = [
        t3 + t2,        // used simple Fibonacci-style addition, forgot the x2
        2*t3 + t1,      // used the wrong "two terms back"
        next + 1
      ];
    } else {
      // running (cumulative) sum of consecutive primes: 2, 5, 10, 17, 28, 41, ...
      const allPrimes = iqFirstPrimesFrom(0, 10);
      const sums = [];
      let running = 0;
      for (let i = 0; i < 10; i++){ running += allPrimes[i]; sums.push(running); }
      const offset = randInt(0, 3);
      terms = sums.slice(offset, offset+4);
      next = sums[offset+4];
      candidates = [
        terms[3] + (terms[3]-terms[2]), // assumed a constant gap
        next - allPrimes[offset+3],     // off by one prime term
        next + 2
      ];
    }
  }

  const spread = Math.max(3, Math.round(Math.abs(next) * 0.2) + 2);
  const distractors = iqSanitizeNumberDistractors(next, candidates, spread);
  return { terms, next, distractors };
}

registerIQCategory({
  key: 'numseq',
  icon: '🔢',
  title: 'סדרות מספרים',
  subtitle: 'מה המספר הבא?',
  renderQuestion(tier, promptEl, optionsEl, onAnswer){
    const { terms, next, distractors } = generateNumberSequence(tier);
    promptEl.innerHTML =
      '<div class="iq-prompt-label">השלימו את הסדרה:</div>' +
      '<div class="iq-sequence-row" dir="ltr">' +
        terms.map(t => '<div class="iq-tile">' + t + '</div>').join('') +
        '<div class="iq-tile iq-tile-blank">?</div>' +
      '</div>';

    const options = [{ label: String(next), isCorrect: true }]
      .concat(distractors.map(v => ({ label: String(v), isCorrect: false })));
    renderIQMultipleChoice(optionsEl, options, onAnswer);
  }
});
