'use strict';

/* ============ Screen registration ============ */
registerScreen('frac-menu', document.getElementById('frac-menu'));
['frac1','frac2','frac3','frac4','frac5','frac6','frac7'].forEach(key => {
  registerScreen(key, document.getElementById(key));
});

const FRAC_ROUND_TARGET = 10;
const FRAC_MAX_LEVEL = 5; // every game plateaus at its hardest setting here rather than growing without bound

function updateFracProgress(prefix, progress, target){
  document.getElementById(prefix + '-progress-text').textContent = progress + ' / ' + target;
  document.getElementById(prefix + '-progress-fill').style.width = Math.round((progress / target) * 100) + '%';
}

// Shared prev/next navigation used by every question-based game (not the
// memory match, which has its own single-board "next level" button instead).
// `history` holds every round generated this session (so a teacher can step
// back through everything already asked); only the LAST entry can ever be
// unanswered. Next either steps forward into already-generated (and so
// already-answered) history, or - only once the live round is answered -
// generates a brand new one.
function updateFracNavButtons(prefix, history, pos){
  document.getElementById(prefix + '-hist-num').textContent = (pos + 1) + ' / ' + history.length;
  document.getElementById(prefix + '-prev-btn').disabled = pos <= 0;
  const canAdvance = pos < history.length - 1 || (history[pos] && history[pos].answered);
  document.getElementById(prefix + '-next-btn').classList.toggle('hidden', !canAdvance);
}

/* ============ Game: number line placement ============ */
// No dead end: every FRAC_ROUND_TARGET correct answers celebrates and moves
// to a harder level (bigger denominators, more whole-number spans) instead of
// stopping, plateauing at FRAC_MAX_LEVEL's settings forever. Advancing to the
// next question is always a manual button press, and every past question
// stays in `frac1History` so it can be revisited with "prev".
let frac1Progress = 0;
let frac1Level = 1;
let frac1History = [];
let frac1Pos = -1;

function frac1ParamsForLevel(level){
  const l = Math.min(level, FRAC_MAX_LEVEL);
  const maxD = [6, 8, 10, 12, 12][l - 1];
  const wholesPool = [[1, 1, 2], [1, 2, 2], [1, 2, 2, 3], [2, 2, 3], [2, 3, 3]][l - 1];
  return { maxD, wholesPool };
}

function initFrac1(){
  frac1Progress = 0;
  frac1Level = 1;
  frac1History = [];
  frac1Pos = -1;
  document.getElementById('frac1-level-num').textContent = frac1Level;
  updateFracProgress('frac1', frac1Progress, FRAC_ROUND_TARGET);
  frac1Advance();
}
registerInit('frac1', initFrac1);

function frac1GenerateRound(){
  const { maxD, wholesPool } = frac1ParamsForLevel(frac1Level);
  const wholes = pickOne(wholesPool);
  const d = pickOne(FRAC_NICE_DENOMS.filter(x => x <= maxD));
  const totalSteps = d * wholes;
  const n = randInt(1, totalSteps - 1);
  return { n, d, wholes, totalSteps, answered: false };
}

function frac1Render(snap, interactive){
  document.getElementById('frac1-prompt').innerHTML =
    '<div class="frac-prompt-label">לחצו על הנקודה הנכונה על הציר:</div>' +
    fracRenderStacked(snap.n, snap.d, { size: 32 });

  const { totalSteps, wholes, n } = snap;
  let dots = '';
  for (let i = 0; i <= totalSteps; i++){
    const pct = (i / totalSteps) * 100;
    const cls = (!interactive && i === n) ? ' frac-line-dot correct' : ' frac-line-dot';
    dots += '<button class="' + cls.trim() + '" style="left:' + pct.toFixed(3) + '%;" data-i="' + i + '"></button>';
  }
  let labels = '';
  for (let w = 0; w <= wholes; w++){
    const pct = (w / wholes) * 100;
    labels += '<span class="frac-line-label" style="left:' + pct.toFixed(3) + '%;">' + w + '</span>';
  }
  const container = document.getElementById('frac1-line');
  container.innerHTML = '<div class="frac-line-track"></div>' + dots + '<div class="frac-line-labels">' + labels + '</div>';

  if (interactive){
    container.querySelectorAll('.frac-line-dot').forEach(dot => {
      dot.addEventListener('click', () => handleFrac1Click(parseInt(dot.getAttribute('data-i'), 10), dot, snap));
    });
  }
  updateFracNavButtons('frac1', frac1History, frac1Pos);
}

function handleFrac1Click(i, dot, snap){
  if (snap.answered) return;
  if (i === snap.n){
    snap.answered = true;
    dot.classList.add('correct');
    SoundFX.playCorrect();
    frac1Progress++;
    updateFracProgress('frac1', frac1Progress, FRAC_ROUND_TARGET);
    if (frac1Progress >= FRAC_ROUND_TARGET){
      frac1Level++;
      document.getElementById('frac1-level-num').textContent = frac1Level;
      showToast('🎉 רצף מצוין! עוברים לרמה ' + frac1Level + '...', ['green', 'green-dark']);
      launchConfetti(60);
      SoundFX.playWin();
      frac1Progress = 0;
      updateFracProgress('frac1', frac1Progress, FRAC_ROUND_TARGET);
    }
    updateFracNavButtons('frac1', frac1History, frac1Pos);
  } else {
    dot.classList.add('incorrect');
    SoundFX.playIncorrect();
    setTimeout(() => dot.classList.remove('incorrect'), 400);
  }
}

function frac1Advance(){
  if (frac1Pos < frac1History.length - 1){
    frac1Pos++;
    const snap = frac1History[frac1Pos];
    frac1Render(snap, !snap.answered); // only the live (last) round can still be unanswered
  } else {
    const snap = frac1GenerateRound();
    frac1History.push(snap);
    frac1Pos = frac1History.length - 1;
    frac1Render(snap, true);
  }
}

function frac1Back(){
  if (frac1Pos > 0){
    frac1Pos--;
    frac1Render(frac1History[frac1Pos], false);
  }
}

document.getElementById('frac1-next-btn').addEventListener('click', frac1Advance);
document.getElementById('frac1-prev-btn').addEventListener('click', frac1Back);
document.getElementById('frac1-reset-progress-btn').addEventListener('click', initFrac1);

/* ============ Game: compare fractions ============ */
// Same manual-advance + full-history pattern as above.
let frac2Progress = 0;
let frac2Level = 1;
let frac2History = [];
let frac2Pos = -1;

function frac2ParamsForLevel(level){
  const l = Math.min(level, FRAC_MAX_LEVEL);
  const maxD = [8, 10, 10, 12, 12][l - 1];
  const closeProb = [0, 0, 0.35, 0.5, 0.65][l - 1];
  return { maxD, closeProb };
}

function initFrac2(){
  frac2Progress = 0;
  frac2Level = 1;
  frac2History = [];
  frac2Pos = -1;
  document.getElementById('frac2-level-num').textContent = frac2Level;
  updateFracProgress('frac2', frac2Progress, FRAC_ROUND_TARGET);
  frac2Advance();
}
registerInit('frac2', initFrac2);

function frac2GenerateRound(){
  const { maxD, closeProb } = frac2ParamsForLevel(frac2Level);
  const left = fracRandomProper(maxD);
  let right;
  if (Math.random() < 0.25){
    const mult = randInt(2, 3);
    right = { n: left.n * mult, d: left.d * mult };
  } else if (Math.random() < closeProb){
    // deliberately close in VALUE but a different denominator - can't be told apart at a glance
    const pool = FRAC_NICE_DENOMS.filter(x => x !== left.d && x <= maxD);
    const d2 = pool.length ? pickOne(pool) : left.d;
    const approxN = Math.round((left.n / left.d) * d2);
    let n2 = approxN + pickOne([-1, 1]);
    n2 = Math.max(1, Math.min(d2 - 1, n2));
    right = { n: n2, d: d2 };
  } else {
    let guard = 0;
    do { right = fracRandomProper(maxD); guard++; }
    while (guard < 30 && fracCompare(left.n, left.d, right.n, right.d) === 0);
  }
  const cmp = fracCompare(left.n, left.d, right.n, right.d);
  return { left, right, cmp, answered: false };
}

function frac2Render(snap, interactive){
  const row = document.getElementById('frac2-row');
  row.innerHTML =
    '<div class="frac-compare-card">' + fracRenderStacked(snap.left.n, snap.left.d, { size: 40, color: '#4C6FFF' }) + '</div>' +
    '<div class="frac-compare-buttons">' +
      '<button class="frac-compare-op-btn" data-op="gt">&gt;</button>' +
      '<button class="frac-compare-op-btn" data-op="eq">=</button>' +
      '<button class="frac-compare-op-btn" data-op="lt">&lt;</button>' +
    '</div>' +
    '<div class="frac-compare-card">' + fracRenderStacked(snap.right.n, snap.right.d, { size: 40, color: '#9B5DE5' }) + '</div>';

  const gtBtn = row.querySelector('[data-op="gt"]');
  const eqBtn = row.querySelector('[data-op="eq"]');
  const ltBtn = row.querySelector('[data-op="lt"]');

  // The DOM order here is [snap.left card, operator buttons, snap.right card].
  // Under this app's RTL layout the FIRST dom child renders RIGHTMOST and the
  // LAST renders LEFTMOST (confirmed elsewhere in this app) - so the card
  // positioned visually on the LEFT is actually snap.right, and the one
  // visually on the RIGHT is snap.left. The intended convention: if the
  // LEFT-shown fraction is bigger, "<" is correct; if the RIGHT-shown
  // fraction is bigger, ">" is correct.
  const screenCmp = fracCompare(snap.right.n, snap.right.d, snap.left.n, snap.left.d); // screen-left vs screen-right
  const correctOp = screenCmp === 0 ? 'eq' : (screenCmp === 1 ? 'lt' : 'gt');

  [gtBtn, eqBtn, ltBtn].forEach(btn => {
    const isCorrect = btn.dataset.op === correctOp;
    if (interactive){
      btn.addEventListener('click', () => handleFrac2Answer(isCorrect, btn, snap));
    } else if (isCorrect){
      btn.classList.add('correct');
    }
  });
  updateFracNavButtons('frac2', frac2History, frac2Pos);
}

function handleFrac2Answer(isCorrect, btn, snap){
  if (snap.answered) return;
  if (isCorrect){
    snap.answered = true;
    btn.classList.add('correct');
    SoundFX.playCorrect();
    frac2Progress++;
    updateFracProgress('frac2', frac2Progress, FRAC_ROUND_TARGET);
    if (frac2Progress >= FRAC_ROUND_TARGET){
      frac2Level++;
      document.getElementById('frac2-level-num').textContent = frac2Level;
      showToast('🎉 רצף מצוין! עוברים לרמה ' + frac2Level + '...', ['green', 'green-dark']);
      launchConfetti(60);
      SoundFX.playWin();
      frac2Progress = 0;
      updateFracProgress('frac2', frac2Progress, FRAC_ROUND_TARGET);
    }
    updateFracNavButtons('frac2', frac2History, frac2Pos);
  } else {
    btn.classList.add('incorrect');
    SoundFX.playIncorrect();
    setTimeout(() => btn.classList.remove('incorrect'), 400);
  }
}

function frac2Advance(){
  if (frac2Pos < frac2History.length - 1){
    frac2Pos++;
    const snap = frac2History[frac2Pos];
    frac2Render(snap, !snap.answered);
  } else {
    const snap = frac2GenerateRound();
    frac2History.push(snap);
    frac2Pos = frac2History.length - 1;
    frac2Render(snap, true);
  }
}

function frac2Back(){
  if (frac2Pos > 0){
    frac2Pos--;
    frac2Render(frac2History[frac2Pos], false);
  }
}

document.getElementById('frac2-next-btn').addEventListener('click', frac2Advance);
document.getElementById('frac2-prev-btn').addEventListener('click', frac2Back);
document.getElementById('frac2-reset-progress-btn').addEventListener('click', initFrac2);

/* ============ Game: ascending order ============ */
// Same manual-advance + full-history pattern. A round here involves several
// clicks (placing every item), so "answered" only flips true once the whole
// round is solved; reviewing a past round shows it fully placed and badged.
let frac3Progress = 0;
let frac3Level = 1;
let frac3History = [];
let frac3Pos = -1;

function frac3ParamsForLevel(level){
  const l = Math.min(level, FRAC_MAX_LEVEL);
  const itemCount = [4, 4, 5, 5, 6][l - 1];
  const maxD = [10, 10, 12, 12, 12][l - 1];
  return { itemCount, maxD };
}

function initFrac3(){
  frac3Progress = 0;
  frac3Level = 1;
  frac3History = [];
  frac3Pos = -1;
  document.getElementById('frac3-level-num').textContent = frac3Level;
  updateFracProgress('frac3', frac3Progress, FRAC_ROUND_TARGET);
  frac3Advance();
}
registerInit('frac3', initFrac3);

function frac3GenerateRound(){
  const { itemCount, maxD } = frac3ParamsForLevel(frac3Level);
  const values = [];
  let guard = 0;
  while (values.length < itemCount && guard < 200){
    guard++;
    const f = fracRandomProper(maxD);
    if (!values.some(v => fracCompare(v.n, v.d, f.n, f.d) === 0)) values.push(f);
  }
  const sorted = values.slice().sort((a, b) => fracCompare(a.n, a.d, b.n, b.d));
  values.forEach(v => { v.rank = sorted.indexOf(v); });
  return { items: shuffle(values), nextRank: 0, answered: false };
}

function frac3Render(snap, interactive){
  const row = document.getElementById('frac3-row');
  row.innerHTML = '';
  snap.items.forEach(item => {
    const card = document.createElement('button');
    card.className = 'frac-order-card';
    card.innerHTML = fracRenderStacked(item.n, item.d, { size: 32, color: '#06D6A0' });
    if (interactive){
      card.addEventListener('click', () => handleFrac3Click(item, card, snap));
    } else {
      card.classList.add('placed');
      const badge = document.createElement('div');
      badge.className = 'frac-order-badge';
      badge.textContent = String(item.rank + 1);
      card.appendChild(badge);
    }
    row.appendChild(card);
  });
  updateFracNavButtons('frac3', frac3History, frac3Pos);
}

function handleFrac3Click(item, card, snap){
  if (card.classList.contains('placed')) return;
  if (item.rank === snap.nextRank){
    card.classList.add('placed');
    const badge = document.createElement('div');
    badge.className = 'frac-order-badge';
    badge.textContent = String(snap.nextRank + 1);
    card.appendChild(badge);
    SoundFX.playCorrect();
    snap.nextRank++;
    if (snap.nextRank >= snap.items.length){
      snap.answered = true;
      frac3Progress++;
      updateFracProgress('frac3', frac3Progress, FRAC_ROUND_TARGET);
      if (frac3Progress >= FRAC_ROUND_TARGET){
        frac3Level++;
        document.getElementById('frac3-level-num').textContent = frac3Level;
        showToast('🎉 רצף מצוין! עוברים לרמה ' + frac3Level + '...', ['green', 'green-dark']);
        launchConfetti(60);
        SoundFX.playWin();
        frac3Progress = 0;
        updateFracProgress('frac3', frac3Progress, FRAC_ROUND_TARGET);
      }
      updateFracNavButtons('frac3', frac3History, frac3Pos);
    }
  } else {
    card.classList.add('incorrect');
    SoundFX.playIncorrect();
    setTimeout(() => card.classList.remove('incorrect'), 400);
  }
}

function frac3Advance(){
  if (frac3Pos < frac3History.length - 1){
    frac3Pos++;
    const snap = frac3History[frac3Pos];
    frac3Render(snap, !snap.answered);
  } else {
    const snap = frac3GenerateRound();
    frac3History.push(snap);
    frac3Pos = frac3History.length - 1;
    frac3Render(snap, true);
  }
}

function frac3Back(){
  if (frac3Pos > 0){
    frac3Pos--;
    frac3Render(frac3History[frac3Pos], false);
  }
}

document.getElementById('frac3-next-btn').addEventListener('click', frac3Advance);
document.getElementById('frac3-prev-btn').addEventListener('click', frac3Back);
document.getElementById('frac3-reset-progress-btn').addEventListener('click', initFrac3);

/* ============ Game: equivalent-fractions memory match ============ */
// Leveling game: clearing a board shows a "next level" button (never jumps
// automatically) that builds a bigger one. At level 1 every text card matches
// its pizza exactly (both show the same reduced n/d) - a simple "does this
// picture look like this fraction" match. From level 2 up, the text card can
// instead show an UNREDUCED equivalent (e.g. "2/8") while the pizza still
// draws the simplest form (1/4) - same value, different digits - so matching
// requires recognizing equivalence, not just reading the denominator off the
// picture. By level 3 the text card always does this.
let frac4Level = 1;
let frac4PairCount = 6;
let frac4Matched = 0;
let frac4Flipped = [];
let frac4Locked = false;

function initFrac4(){
  frac4Level = 1;
  buildFrac4Board();
}
registerInit('frac4', initFrac4);

function buildFrac4Board(){
  frac4Matched = 0;
  frac4Flipped = [];
  frac4Locked = false;
  frac4PairCount = Math.min(6 + (frac4Level - 1) * 2, 10);
  document.getElementById('frac4-level-num').textContent = frac4Level;
  document.getElementById('frac4-progress-text').textContent = '0 / ' + frac4PairCount + ' זוגות';
  document.getElementById('frac4-next-level-btn').classList.add('hidden');

  const targets = [];
  let guard = 0;
  while (targets.length < frac4PairCount && guard < 500){
    guard++;
    const f = fracRandomProper(12);
    const simp = fracSimplify(f.n, f.d);
    if (!targets.some(t => t.n === simp.n && t.d === simp.d)) targets.push(simp);
  }

  const cards = [];
  targets.forEach((t, idx) => {
    let textN = t.n, textD = t.d;
    const forceUnreduced = frac4Level >= 3;
    const maybeUnreduced = frac4Level === 2 && Math.random() < 0.5;
    if (forceUnreduced || maybeUnreduced){
      const mult = randInt(2, 4);
      textN = t.n * mult; textD = t.d * mult;
    }
    cards.push({ pairId: idx, mode: 'text', n: textN, d: textD });
    cards.push({ pairId: idx, mode: 'pizza', n: t.n, d: t.d }); // the pizza always draws the simplest (reduced) form
  });
  shuffle(cards);

  const grid = document.getElementById('frac4-grid');
  grid.innerHTML = '';
  cards.forEach(card => {
    const el = document.createElement('button');
    el.className = 'frac-memory-card';
    const front = card.mode === 'text'
      ? fracRenderStacked(card.n, card.d, { size: 26, color: '#FF8C42' })
      : fracRenderPizzaSVG(card.n, card.d, { size: 100 });
    el.innerHTML = '<div class="frac-memory-back">?</div><div class="frac-memory-front">' + front + '</div>';
    el.addEventListener('click', () => handleFrac4Click(card, el));
    grid.appendChild(el);
  });
}

function handleFrac4Click(card, el){
  if (frac4Locked || el.classList.contains('flipped') || el.classList.contains('matched')) return;
  el.classList.add('flipped');
  frac4Flipped.push({ card, el });

  if (frac4Flipped.length === 2){
    frac4Locked = true;
    const [a, b] = frac4Flipped;
    if (a.card.pairId === b.card.pairId){
      SoundFX.playCorrect();
      a.el.classList.add('matched');
      b.el.classList.add('matched');
      frac4Flipped = [];
      frac4Locked = false;
      frac4Matched++;
      document.getElementById('frac4-progress-text').textContent = frac4Matched + ' / ' + frac4PairCount + ' זוגות';
      if (frac4Matched >= frac4PairCount){
        SoundFX.playWin();
        document.getElementById('frac4-next-level-btn').classList.remove('hidden');
      }
    } else {
      SoundFX.playIncorrect();
      a.el.classList.add('incorrect');
      b.el.classList.add('incorrect');
      setTimeout(() => {
        a.el.classList.remove('flipped', 'incorrect');
        b.el.classList.remove('flipped', 'incorrect');
        frac4Flipped = [];
        frac4Locked = false;
      }, 900);
    }
  }
}

function frac4AdvanceLevel(){
  frac4Level++;
  showToast('🎉 מצאתם הכל! עוברים לרמה ' + frac4Level + '...', ['green', 'green-dark']);
  launchConfetti(60);
  buildFrac4Board();
}

document.getElementById('frac4-next-level-btn').addEventListener('click', frac4AdvanceLevel);
document.getElementById('frac4-reset-progress-btn').addEventListener('click', initFrac4);

/* ============ Game: simplify fractions ============ */
// Same manual-advance + full-history pattern as frac1/2/3.
let frac5Progress = 0;
let frac5Level = 1;
let frac5History = [];
let frac5Pos = -1;

function frac5ParamsForLevel(level){
  const l = Math.min(level, FRAC_MAX_LEVEL);
  const maxD = [8, 8, 10, 10, 12][l - 1];
  const multRange = [[2, 4], [2, 4], [2, 5], [3, 5], [3, 6]][l - 1];
  return { maxD, multRange };
}

function initFrac5(){
  frac5Progress = 0;
  frac5Level = 1;
  frac5History = [];
  frac5Pos = -1;
  document.getElementById('frac5-level-num').textContent = frac5Level;
  updateFracProgress('frac5', frac5Progress, FRAC_ROUND_TARGET);
  frac5Advance();
}
registerInit('frac5', initFrac5);

function frac5GenerateRound(){
  const { maxD, multRange } = frac5ParamsForLevel(frac5Level);
  const raw = fracRandomProper(maxD);
  const base = fracSimplify(raw.n, raw.d); // must already be in lowest terms, or "fully reduced" below would be wrong
  const mult = randInt(multRange[0], multRange[1]);
  const n = base.n * mult, d = base.d * mult;

  const rawDistractors = [];
  const g = fracGcd(n, d);
  for (let f = 2; f < g; f++){
    if (n % f === 0 && d % f === 0){ rawDistractors.push({ n: n / f, d: d / f }); break; }
  }
  rawDistractors.push({ n: base.d, d: base.n });          // swapped numerator/denominator
  rawDistractors.push({ n: base.n + 1, d: base.d });      // off-by-one numerator
  rawDistractors.push({ n: n, d: d });                    // didn't reduce at all

  const seen = new Set([base.n + '/' + base.d]);
  const distractorFracs = [];
  rawDistractors.forEach(f => {
    const label = f.n + '/' + f.d;
    if (!seen.has(label)){ distractorFracs.push(f); seen.add(label); }
  });
  let guard = 0;
  while (distractorFracs.length < 3 && guard < 100){
    guard++;
    const f = { n: randInt(1, 11), d: randInt(2, 12) };
    const label = f.n + '/' + f.d;
    if (!seen.has(label)){ distractorFracs.push(f); seen.add(label); }
  }

  const optionFracs = shuffle([base, ...distractorFracs.slice(0, 3)]);
  return { n, d, base, optionFracs, answered: false };
}

function frac5Render(snap, interactive){
  document.getElementById('frac5-prompt').innerHTML =
    fracRenderStacked(snap.n, snap.d, { size: 32 }) +
    '<div class="frac-prompt-label" dir="ltr">= ?</div>';

  const panel = document.getElementById('frac5-options');
  panel.innerHTML = '';
  snap.optionFracs.forEach(f => {
    const isCorrect = f.n === snap.base.n && f.d === snap.base.d;
    const btn = document.createElement('button');
    btn.className = 'a6-option-btn';
    btn.innerHTML = fracRenderStacked(f.n, f.d, { size: 24, color: '#fff' });
    if (interactive){
      btn.addEventListener('click', () => handleFrac5Answer(isCorrect, btn, snap));
    } else if (isCorrect){
      btn.classList.add('correct');
    }
    panel.appendChild(btn);
  });
  updateFracNavButtons('frac5', frac5History, frac5Pos);
}

function handleFrac5Answer(isCorrect, btn, snap){
  if (snap.answered) return;
  if (isCorrect){
    snap.answered = true;
    btn.classList.add('correct');
    SoundFX.playCorrect();
    frac5Progress++;
    updateFracProgress('frac5', frac5Progress, FRAC_ROUND_TARGET);
    if (frac5Progress >= FRAC_ROUND_TARGET){
      frac5Level++;
      document.getElementById('frac5-level-num').textContent = frac5Level;
      showToast('🎉 רצף מצוין! עוברים לרמה ' + frac5Level + '...', ['green', 'green-dark']);
      launchConfetti(60);
      SoundFX.playWin();
      frac5Progress = 0;
      updateFracProgress('frac5', frac5Progress, FRAC_ROUND_TARGET);
    }
    updateFracNavButtons('frac5', frac5History, frac5Pos);
  } else {
    btn.classList.add('incorrect');
    SoundFX.playIncorrect();
    setTimeout(() => btn.classList.remove('incorrect'), 400);
  }
}

function frac5Advance(){
  if (frac5Pos < frac5History.length - 1){
    frac5Pos++;
    const snap = frac5History[frac5Pos];
    frac5Render(snap, !snap.answered);
  } else {
    const snap = frac5GenerateRound();
    frac5History.push(snap);
    frac5Pos = frac5History.length - 1;
    frac5Render(snap, true);
  }
}

function frac5Back(){
  if (frac5Pos > 0){
    frac5Pos--;
    frac5Render(frac5History[frac5Pos], false);
  }
}

document.getElementById('frac5-next-btn').addEventListener('click', frac5Advance);
document.getElementById('frac5-prev-btn').addEventListener('click', frac5Back);
document.getElementById('frac5-reset-progress-btn').addEventListener('click', initFrac5);

/* ============ Shared: picture <-> fraction round generation ============ */
// Used by BOTH frac6 (picture is the prompt, options are fractions... wait,
// see below - the two games render the SAME generated round in opposite
// directions) - one source of truth for "what picture, what fraction, what
// distractors" so the two games can never drift apart.
const FRAC_PICTURE_TYPES = ['pizza', 'bar', 'grid', 'glass', 'square'];
const FRAC_PICTURE_RENDERERS = {
  pizza: fracRenderPizzaSVG,
  bar: fracRenderBarSVG,
  grid: fracRenderGridSVG,
  glass: fracRenderGlassSVG,
  square: fracRenderSquareGridSVG
};
// Each picture type keeps its own natural proportions (a bar stays wide, a
// glass stays tall) rather than one uniform box forced onto every shape.
const FRAC_PICTURE_RENDER_OPTS = {
  pizza: { size: 90 },
  bar: { width: 100, height: 44 },
  grid: { size: 90 },
  glass: { width: 56, height: 90 },
  square: { size: 90 }
};

function fracPictureParamsForLevel(level){
  const l = Math.min(level, FRAC_MAX_LEVEL);
  const maxD = [8, 10, 10, 12, 12][l - 1];
  const differentDenomProb = [0, 0, 0.4, 0.6, 0.8][l - 1]; // from level 3 up, distractors can use a different denominator (harder to compare at a glance)
  return { maxD, differentDenomProb };
}

// Each picture type draws its denominator from its own appropriate pool - a
// square grid needs a perfect square, an oblong grid needs a multi-row
// factorization, everything else can use any "nice" denominator.
const FRAC_PICTURE_DENOM_POOLS = {
  grid: FRAC_GRID_DENOMS,
  square: FRAC_SQUARE_DENOMS
};

function fracPictureGenerateRound(level){
  const { maxD, differentDenomProb } = fracPictureParamsForLevel(level);
  const type = pickOne(FRAC_PICTURE_TYPES);
  const typePool = FRAC_PICTURE_DENOM_POOLS[type] || FRAC_NICE_DENOMS;
  const denomPool = typePool.filter(x => x <= maxD);
  const pool = denomPool.length ? denomPool : typePool;
  const d = pickOne(pool);
  const n = randInt(1, d - 1);

  const seen = new Set([n + '/' + d]);
  const distractors = [];
  function tryAdd(dn, dd){
    if (dd < 2 || dn < 1 || dn >= dd) return;
    if (Math.abs(dn / dd - n / d) < 1e-9) return; // would look like a second "correct" option
    const label = dn + '/' + dd;
    if (seen.has(label)) return;
    distractors.push({ n: dn, d: dd });
    seen.add(label);
  }

  // Pass 1: respect the level's same-vs-different-denominator preference.
  let guard = 0;
  while (distractors.length < 3 && guard < 150){
    guard++;
    const otherDenoms = pool.filter(x => x !== d);
    const useDifferent = Math.random() < differentDenomProb && otherDenoms.length > 0;
    const dd = useDifferent ? pickOne(otherDenoms) : d;
    tryAdd(randInt(1, dd - 1), dd);
  }
  // Pass 2 (fallback): small denominators (e.g. d=2,3,4) don't have enough
  // distinct same-denom numerators to fill 3 slots - allow ANY denom from
  // this type's pool once the preferred approach runs dry.
  guard = 0;
  while (distractors.length < 3 && guard < 300){
    guard++;
    const dd = pickOne(pool);
    tryAdd(randInt(1, dd - 1), dd);
  }
  // Pass 3 (last resort): widen to this picture type's FULL denominator set
  // (not just the level's maxD cap) - guarantees success while still staying
  // grid-friendly for the grid type.
  guard = 0;
  while (distractors.length < 3 && guard < 300){
    guard++;
    const dd = pickOne(typePool);
    tryAdd(randInt(1, dd - 1), dd);
  }

  const options = shuffle([{ n, d }, ...distractors]);
  return { type, n, d, options, answered: false };
}

/* ============ Game: pick the matching picture ============ */
// The target fraction is the prompt (written numerator/bar/denominator); the
// 4 candidate PICTURES are the options. The picture type is re-rolled every
// round (pizza / chocolate bar / grid / filled glass) so the same fraction
// never keeps showing up as the same kind of drawing. Same manual-advance +
// full-history pattern as frac1/2/3/5.
let frac6Progress = 0;
let frac6Level = 1;
let frac6History = [];
let frac6Pos = -1;

function initFrac6(){
  frac6Progress = 0;
  frac6Level = 1;
  frac6History = [];
  frac6Pos = -1;
  document.getElementById('frac6-level-num').textContent = frac6Level;
  updateFracProgress('frac6', frac6Progress, FRAC_ROUND_TARGET);
  frac6Advance();
}
registerInit('frac6', initFrac6);

function frac6Render(snap, interactive){
  const renderFn = FRAC_PICTURE_RENDERERS[snap.type];
  document.getElementById('frac6-prompt').innerHTML =
    '<div class="frac-prompt-label">בחרו את התמונה המתאימה לשבר:</div>' +
    fracRenderStacked(snap.n, snap.d, { size: 32 });

  const panel = document.getElementById('frac6-options');
  panel.innerHTML = '';
  snap.options.forEach(opt => {
    const isCorrect = opt.n === snap.n && opt.d === snap.d;
    const btn = document.createElement('button');
    btn.className = 'frac-picture-option';
    btn.innerHTML = renderFn(opt.n, opt.d, FRAC_PICTURE_RENDER_OPTS[snap.type]);
    if (interactive){
      btn.addEventListener('click', () => handleFrac6Answer(isCorrect, btn, snap));
    } else if (isCorrect){
      btn.classList.add('correct');
    }
    panel.appendChild(btn);
  });
  updateFracNavButtons('frac6', frac6History, frac6Pos);
}

function handleFrac6Answer(isCorrect, btn, snap){
  if (snap.answered) return;
  if (isCorrect){
    snap.answered = true;
    btn.classList.add('correct');
    SoundFX.playCorrect();
    frac6Progress++;
    updateFracProgress('frac6', frac6Progress, FRAC_ROUND_TARGET);
    if (frac6Progress >= FRAC_ROUND_TARGET){
      frac6Level++;
      document.getElementById('frac6-level-num').textContent = frac6Level;
      showToast('🎉 רצף מצוין! עוברים לרמה ' + frac6Level + '...', ['green', 'green-dark']);
      launchConfetti(60);
      SoundFX.playWin();
      frac6Progress = 0;
      updateFracProgress('frac6', frac6Progress, FRAC_ROUND_TARGET);
    }
    updateFracNavButtons('frac6', frac6History, frac6Pos);
  } else {
    btn.classList.add('incorrect');
    SoundFX.playIncorrect();
    setTimeout(() => btn.classList.remove('incorrect'), 400);
  }
}

function frac6Advance(){
  if (frac6Pos < frac6History.length - 1){
    frac6Pos++;
    const snap = frac6History[frac6Pos];
    frac6Render(snap, !snap.answered);
  } else {
    const snap = fracPictureGenerateRound(frac6Level);
    frac6History.push(snap);
    frac6Pos = frac6History.length - 1;
    frac6Render(snap, true);
  }
}

function frac6Back(){
  if (frac6Pos > 0){
    frac6Pos--;
    frac6Render(frac6History[frac6Pos], false);
  }
}

document.getElementById('frac6-next-btn').addEventListener('click', frac6Advance);
document.getElementById('frac6-prev-btn').addEventListener('click', frac6Back);
document.getElementById('frac6-reset-progress-btn').addEventListener('click', initFrac6);

/* ============ Game: pick the matching fraction ============ */
// The inverse of frac6: a PICTURE is the prompt, and the 4 candidate
// FRACTIONS (written numerator/bar/denominator) are the options. Reuses the
// exact same round generator as frac6, just rendered the other way around,
// so the two games can never disagree about what counts as a valid distractor.
let frac7Progress = 0;
let frac7Level = 1;
let frac7History = [];
let frac7Pos = -1;

function initFrac7(){
  frac7Progress = 0;
  frac7Level = 1;
  frac7History = [];
  frac7Pos = -1;
  document.getElementById('frac7-level-num').textContent = frac7Level;
  updateFracProgress('frac7', frac7Progress, FRAC_ROUND_TARGET);
  frac7Advance();
}
registerInit('frac7', initFrac7);

function frac7Render(snap, interactive){
  const renderFn = FRAC_PICTURE_RENDERERS[snap.type];
  document.getElementById('frac7-prompt').innerHTML =
    '<div class="frac-prompt-label">בחרו את השבר המתאים לתמונה:</div>' +
    renderFn(snap.n, snap.d, FRAC_PICTURE_RENDER_OPTS[snap.type]);

  const panel = document.getElementById('frac7-options');
  panel.innerHTML = '';
  snap.options.forEach(opt => {
    const isCorrect = opt.n === snap.n && opt.d === snap.d;
    const btn = document.createElement('button');
    btn.className = 'a6-option-btn';
    btn.innerHTML = fracRenderStacked(opt.n, opt.d, { size: 24, color: '#fff' });
    if (interactive){
      btn.addEventListener('click', () => handleFrac7Answer(isCorrect, btn, snap));
    } else if (isCorrect){
      btn.classList.add('correct');
    }
    panel.appendChild(btn);
  });
  updateFracNavButtons('frac7', frac7History, frac7Pos);
}

function handleFrac7Answer(isCorrect, btn, snap){
  if (snap.answered) return;
  if (isCorrect){
    snap.answered = true;
    btn.classList.add('correct');
    SoundFX.playCorrect();
    frac7Progress++;
    updateFracProgress('frac7', frac7Progress, FRAC_ROUND_TARGET);
    if (frac7Progress >= FRAC_ROUND_TARGET){
      frac7Level++;
      document.getElementById('frac7-level-num').textContent = frac7Level;
      showToast('🎉 רצף מצוין! עוברים לרמה ' + frac7Level + '...', ['green', 'green-dark']);
      launchConfetti(60);
      SoundFX.playWin();
      frac7Progress = 0;
      updateFracProgress('frac7', frac7Progress, FRAC_ROUND_TARGET);
    }
    updateFracNavButtons('frac7', frac7History, frac7Pos);
  } else {
    btn.classList.add('incorrect');
    SoundFX.playIncorrect();
    setTimeout(() => btn.classList.remove('incorrect'), 400);
  }
}

function frac7Advance(){
  if (frac7Pos < frac7History.length - 1){
    frac7Pos++;
    const snap = frac7History[frac7Pos];
    frac7Render(snap, !snap.answered);
  } else {
    const snap = fracPictureGenerateRound(frac7Level);
    frac7History.push(snap);
    frac7Pos = frac7History.length - 1;
    frac7Render(snap, true);
  }
}

function frac7Back(){
  if (frac7Pos > 0){
    frac7Pos--;
    frac7Render(frac7History[frac7Pos], false);
  }
}

document.getElementById('frac7-next-btn').addEventListener('click', frac7Advance);
document.getElementById('frac7-prev-btn').addEventListener('click', frac7Back);
document.getElementById('frac7-reset-progress-btn').addEventListener('click', initFrac7);
