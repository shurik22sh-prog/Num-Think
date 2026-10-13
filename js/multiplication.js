'use strict';

/* ============ Screen registration ============ */
registerScreen('mult-menu', document.getElementById('mult-menu'));
for (let i = 1; i <= 6; i++){
  registerScreen(String(i), document.getElementById('activity' + i));
}

/* ============ Shared helpers ============ */
// The corner cell comes LAST (not first) in the DOM so that under RTL layout it
// lands top-left - aligned above the row-number column, which is also moved to
// the end of each data row (see the per-activity table builders below) so it
// renders on the left instead of the right. The column headers themselves are
// built in DESCENDING order (10 down to 1) so that under RTL layout they read
// left-to-right (1 leftmost, 10 rightmost) instead of the native RTL reversal -
// every activity's per-row cell loop below mirrors this same descending order
// so the body columns stay aligned under their headers.
function buildHeaderRow(){
  let html = '<tr>';
  for (let c=10; c>=1; c--) html += '<th data-col="'+c+'">'+c+'</th>';
  html += '<th class="corner"></th></tr>';
  return html;
}

/* ============ Activity 1: Full table ============ */
// Cells are colored as a heatmap by product value (small -> soft yellow, through green, to soft blue).
// Hover/selection use filter+outline overlays (see CSS) rather than overriding background,
// so they stay legible on top of any heat color.
const HEAT_STOPS = [
  [255, 224, 130], // soft yellow (small values)
  [140, 216, 150], // soft green (mid values)
  [100, 155, 215]  // soft blue (large values)
];

function heatColorAt(t){
  const n = HEAT_STOPS.length - 1;
  const scaled = t * n;
  const idx = Math.min(Math.floor(scaled), n - 1);
  const localT = scaled - idx;
  const c0 = HEAT_STOPS[idx], c1 = HEAT_STOPS[idx + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * localT),
    Math.round(c0[1] + (c1[1] - c0[1]) * localT),
    Math.round(c0[2] + (c1[2] - c0[2]) * localT)
  ];
}

function heatColor(v){
  const t = Math.pow((v - 1) / 99, 0.6); // gamma-adjusted so small values (more common) stay distinguishable
  const [r, g, b] = heatColorAt(t);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return { bg: 'rgb('+r+','+g+','+b+')', text: luminance < 150 ? '#fff' : 'var(--ink)' };
}

function buildHeatLegendGradient(){
  const stops = [];
  const steps = 8;
  for (let i=0; i<=steps; i++){
    const t = i / steps;
    const [r, g, b] = heatColorAt(t);
    stops.push('rgb('+r+','+g+','+b+') '+(t*100)+'%');
  }
  return 'linear-gradient(90deg,'+stops.join(',')+')';
}

function initActivity1(){
  document.getElementById('a1-legend-bar').style.background = buildHeatLegendGradient();

  const holder = document.getElementById('a1-table-holder');
  let html = '<table class="mult-table" id="a1-table"><thead>'+buildHeaderRow()+'</thead><tbody>';
  for (let r=1; r<=10; r++){
    html += '<tr>';
    for (let c=10; c>=1; c--){
      const v = r * c;
      const { bg, text } = heatColor(v);
      html += '<td class="full-cell" data-row="'+r+'" data-col="'+c+'" style="background:'+bg+';color:'+text+';">'+v+'</td>';
    }
    html += '<th data-row="'+r+'">'+r+'</th></tr>';
  }
  html += '</tbody></table>';
  holder.innerHTML = html;

  const table = document.getElementById('a1-table');
  let selected = null;

  function setLineHighlight(r, c, on){
    table.querySelectorAll('[data-row="'+r+'"], [data-col="'+c+'"]').forEach(el => {
      if (el.tagName === 'TH' || el.tagName === 'TD'){
        if (on) el.classList.add('hl-line'); else el.classList.remove('hl-line');
      }
    });
  }

  table.querySelectorAll('td.full-cell').forEach(cell => {
    const r = cell.getAttribute('data-row');
    const c = cell.getAttribute('data-col');
    cell.addEventListener('mouseenter', () => setLineHighlight(r, c, true));
    cell.addEventListener('mouseleave', () => setLineHighlight(r, c, false));
    cell.addEventListener('click', () => {
      if (selected) selected.classList.remove('hl-selected');
      if (selected === cell){ selected = null; return; }
      cell.classList.add('hl-selected');
      selected = cell;
    });
  });
}
registerInit('1', initActivity1);

/* ============ Activity 2: Fill in the blanks ============ */
let a2Progress = 0;
function initActivity2(){
  a2Progress = 0;
  updateA2Progress();
  const holder = document.getElementById('a2-table-holder');
  let html = '<table class="mult-table" id="a2-table"><thead>'+buildHeaderRow()+'</thead><tbody>';
  for (let r=1; r<=10; r++){
    html += '<tr>';
    for (let c=10; c>=1; c--){
      html += '<td class="fill-cell" data-row="'+r+'" data-col="'+c+'">'+
        '<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="'+r+'x'+c+'">'+
        '</td>';
    }
    html += '<th>'+r+'</th></tr>';
  }
  html += '</tbody></table>';
  holder.innerHTML = html;

  const table = document.getElementById('a2-table');
  table.querySelectorAll('td.fill-cell').forEach(td => {
    const r = parseInt(td.getAttribute('data-row'), 10);
    const c = parseInt(td.getAttribute('data-col'), 10);
    const expected = r * c;
    const input = td.querySelector('input');

    input.addEventListener('input', () => {
      // digits only
      input.value = input.value.replace(/[^0-9]/g, '');
      const val = input.value;
      if (val === ''){
        input.classList.remove('correct','incorrect');
        return;
      }
      if (val.length < String(expected).length){
        input.classList.remove('correct','incorrect');
        return;
      }
      const num = parseInt(val, 10);
      if (num === expected){
        if (!input.classList.contains('correct')){
          input.classList.remove('incorrect');
          input.classList.add('correct');
          input.disabled = true;
          SoundFX.playCorrect();
          a2Progress++;
          updateA2Progress();
          if (a2Progress === 100){
            setTimeout(() => showWinBanner('השלמתם את כל לוח הכפל!'), 200);
          }
        }
      } else {
        input.classList.remove('correct');
        input.classList.add('incorrect');
        SoundFX.playIncorrect();
      }
    });
  });
}
registerInit('2', initActivity2);

function updateA2Progress(){
  document.getElementById('a2-progress-text').textContent = a2Progress + ' / 100';
  document.getElementById('a2-progress-fill').style.width = a2Progress + '%';
}

/* ============ Activity 3: Drag & drop ============ */
let a3Queue = [];
let a3Pointer = 0;
let a3Progress = 0;

function initActivity3(){
  a3Progress = 0;
  a3Pointer = 0;
  a3Queue = shuffle(Array.from({length:100}, (_, i) => (Math.floor(i/10)+1) * ((i%10)+1)));
  updateA3Progress();

  const holder = document.getElementById('a3-table-holder');
  let html = '<table class="mult-table" id="a3-table"><thead>'+buildHeaderRow()+'</thead><tbody>';
  for (let r=1; r<=10; r++){
    html += '<tr>';
    for (let c=10; c>=1; c--){
      html += '<td class="drag-cell" data-row="'+r+'" data-col="'+c+'"></td>';
    }
    html += '<th>'+r+'</th></tr>';
  }
  html += '</tbody></table>';
  holder.innerHTML = html;

  setA3Target();
  setupDragChip('a3-chip', {
    isActive: () => a3Pointer < a3Queue.length,
    getTarget: () => a3Queue[a3Pointer],
    onCorrect: () => {
      a3Progress++;
      a3Pointer++;
      updateA3Progress();
      setA3Target();
      if (a3Progress === 100){
        setTimeout(() => showWinBanner('השלמתם את כל לוח הכפל!'), 200);
      }
    }
  });
}
registerInit('3', initActivity3);

function setA3Target(){
  const chip = document.getElementById('a3-chip');
  if (a3Pointer >= a3Queue.length){
    chip.textContent = '🎉';
    chip.classList.remove('pulse');
    return;
  }
  chip.textContent = a3Queue[a3Pointer];
  chip.classList.add('pulse');
}

function updateA3Progress(){
  document.getElementById('a3-progress-text').textContent = a3Progress + ' / 100';
  document.getElementById('a3-progress-fill').style.width = a3Progress + '%';
}

// Dragging moves a separate "ghost" clone (pointer-events:none, position:fixed)
// instead of the pointer-captured chip itself. Toggling `position` on an element
// mid-pointer-sequence can make Chromium/tablet browsers emit a spurious
// pointercancel, which would silently abort the drag - the ghost avoids that.
// Shared by activities 3 and 4: `isActive` gates whether a drag may start,
// `getTarget` returns the number currently shown on the chip, and `onCorrect`
// lets the caller update its own progress/round bookkeeping after a good drop.
function setupDragChip(chipId, { isActive, getTarget, onCorrect }){
  const chip = document.getElementById(chipId);
  // avoid stacking multiple listeners across resets
  const freshChip = chip.cloneNode(true);
  chip.parentNode.replaceChild(freshChip, chip);

  let dragging = false;
  let ghost = null;
  let offsetX = 0, offsetY = 0;
  let lastHoverCell = null;
  let activePointerId = null;

  function clearHoverState(){
    if (lastHoverCell){
      lastHoverCell.classList.remove('drop-target-hover');
      lastHoverCell = null;
    }
  }

  function cellUnderPoint(x, y){
    const under = document.elementFromPoint(x, y);
    return under ? under.closest('td.drag-cell') : null;
  }

  function isCellOpen(cell){
    return cell && !cell.classList.contains('filled') && !cell.classList.contains('prefilled');
  }

  function onPointerMove(e){
    if (!dragging || e.pointerId !== activePointerId) return;
    ghost.style.left = (e.clientX - offsetX) + 'px';
    ghost.style.top = (e.clientY - offsetY) + 'px';

    const cell = cellUnderPoint(e.clientX, e.clientY);
    if (cell !== lastHoverCell){
      clearHoverState();
      if (isCellOpen(cell)){
        cell.classList.add('drop-target-hover');
        lastHoverCell = cell;
      }
    }
  }

  function onPointerUp(e){
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    clearHoverState();

    const cell = cellUnderPoint(e.clientX, e.clientY);
    const target = getTarget();
    let correct = false;
    if (isCellOpen(cell)){
      const r = parseInt(cell.getAttribute('data-row'), 10);
      const c = parseInt(cell.getAttribute('data-col'), 10);
      if (r * c === target) correct = true;
    }

    if (correct){
      cell.textContent = target;
      cell.classList.add('filled', 'flash-correct');
      setTimeout(() => cell.classList.remove('flash-correct'), 500);
      SoundFX.playCorrect();

      ghost.remove();
      ghost = null;
      freshChip.style.visibility = 'visible';

      onCorrect(cell);
    } else {
      if (cell){
        cell.classList.add('flash-wrong');
        setTimeout(() => cell.classList.remove('flash-wrong'), 500);
      }
      SoundFX.playTryAgain();
      const homeRect = freshChip.getBoundingClientRect();
      const g = ghost;
      g.style.transition = 'left 0.2s ease, top 0.2s ease';
      g.style.left = homeRect.left + 'px';
      g.style.top = homeRect.top + 'px';
      setTimeout(() => {
        g.remove();
        if (ghost === g) ghost = null;
        freshChip.style.visibility = 'visible';
        freshChip.classList.add('pulse');
      }, 210);
    }
  }

  freshChip.addEventListener('pointerdown', (e) => {
    if (!isActive() || dragging) return;
    dragging = true;
    activePointerId = e.pointerId;
    SoundFX.ensureCtx();
    freshChip.classList.remove('pulse');

    const rect = freshChip.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    ghost = document.createElement('div');
    ghost.className = 'drag-chip dragging';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.textContent = freshChip.textContent;
    document.body.appendChild(ghost);

    freshChip.style.visibility = 'hidden';

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    e.preventDefault();
  });
}

/* ============ Activity 4: Complete the partial board ============ */
let a4Queue = [];
let a4Pointer = 0;
let a4Progress = 0;
let a4Total = 0;
let a4RoundNumber = 0;
let a4DragReady = false;

function initActivity4(){
  a4RoundNumber = 0;
  buildA4Round();
  if (!a4DragReady){
    setupDragChip('a4-chip', {
      isActive: () => a4Pointer < a4Queue.length,
      getTarget: () => a4Queue[a4Pointer],
      onCorrect: () => {
        a4Progress++;
        a4Pointer++;
        updateA4Progress();
        if (a4Pointer >= a4Queue.length){
          setA4Target();
          setTimeout(() => celebrateA4RoundAndContinue(), 200);
        } else {
          setA4Target();
        }
      }
    });
    a4DragReady = true;
  }
}
registerInit('4', initActivity4);

function buildA4Round(){
  a4RoundNumber++;
  document.getElementById('a4-round-number').textContent = a4RoundNumber;

  const coords = [];
  for (let r=1; r<=10; r++){
    for (let c=1; c<=10; c++) coords.push([r, c]);
  }
  shuffle(coords);

  // Each new board starts 20%-60% pre-filled; the rest is left for the child to drag in.
  const prefillPct = 0.20 + Math.random() * 0.40;
  const prefillCount = Math.round(100 * prefillPct);
  const prefilled = new Set(coords.slice(0, prefillCount).map(([r,c]) => r+'_'+c));
  const remaining = coords.slice(prefillCount);

  a4Queue = shuffle(remaining.map(([r,c]) => r*c));
  a4Pointer = 0;
  a4Progress = 0;
  a4Total = a4Queue.length;
  updateA4Progress();

  const holder = document.getElementById('a4-table-holder');
  let html = '<table class="mult-table" id="a4-table"><thead>'+buildHeaderRow()+'</thead><tbody>';
  for (let r=1; r<=10; r++){
    html += '<tr>';
    for (let c=10; c>=1; c--){
      if (prefilled.has(r+'_'+c)){
        html += '<td class="drag-cell prefilled" data-row="'+r+'" data-col="'+c+'">'+(r*c)+'</td>';
      } else {
        html += '<td class="drag-cell" data-row="'+r+'" data-col="'+c+'"></td>';
      }
    }
    html += '<th>'+r+'</th></tr>';
  }
  html += '</tbody></table>';
  holder.innerHTML = html;

  setA4Target();
}

function setA4Target(){
  const chip = document.getElementById('a4-chip');
  if (a4Pointer >= a4Queue.length){
    chip.textContent = '🎉';
    chip.classList.remove('pulse');
    return;
  }
  chip.textContent = a4Queue[a4Pointer];
  chip.classList.add('pulse');
}

function updateA4Progress(){
  document.getElementById('a4-progress-text').textContent = a4Progress + ' / ' + a4Total;
  const pct = a4Total ? Math.round((a4Progress / a4Total) * 100) : 0;
  document.getElementById('a4-progress-fill').style.width = pct + '%';
}

function celebrateA4RoundAndContinue(){
  showToast('🎉 לוח הושלם! מכינים לוח חדש...');
  launchConfetti(60);
  SoundFX.playWin();
  setTimeout(() => buildA4Round(), 1400);
}

/* ============ Activity 5: one glowing cell at a time ============ */
let a5Queue = [];
let a5Pointer = 0;
let a5Progress = 0;

function initActivity5(){
  a5Queue = shuffle(Array.from({length:100}, (_, i) => [Math.floor(i/10)+1, (i%10)+1]));
  a5Pointer = 0;
  a5Progress = 0;
  updateA5Progress();

  const holder = document.getElementById('a5-table-holder');
  let html = '<table class="mult-table" id="a5-table"><thead>'+buildHeaderRow()+'</thead><tbody>';
  for (let r=1; r<=10; r++){
    html += '<tr>';
    for (let c=10; c>=1; c--){
      html += '<td class="seq-cell" data-row="'+r+'" data-col="'+c+'"></td>';
    }
    html += '<th>'+r+'</th></tr>';
  }
  html += '</tbody></table>';
  holder.innerHTML = html;

  activateA5Cell();
}
registerInit('5', initActivity5);

function activateA5Cell(){
  if (a5Pointer >= a5Queue.length) return;
  const [r, c] = a5Queue[a5Pointer];
  const expected = r * c;
  const td = document.querySelector('#a5-table td.seq-cell[data-row="'+r+'"][data-col="'+c+'"]');
  td.classList.add('active');
  td.innerHTML = '<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="'+r+'x'+c+'">';
  const input = td.querySelector('input');
  input.focus();

  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '');
    const val = input.value;
    if (val === '' || val.length < String(expected).length){
      input.classList.remove('incorrect');
      return;
    }
    const num = parseInt(val, 10);
    if (num === expected){
      SoundFX.playCorrect();
      td.classList.remove('active');
      td.classList.add('filled');
      td.textContent = expected;
      a5Progress++;
      a5Pointer++;
      updateA5Progress();
      if (a5Progress === 100){
        setTimeout(() => showWinBanner('השלמתם את כל לוח הכפל!'), 200);
      } else {
        activateA5Cell();
      }
    } else {
      input.classList.add('incorrect');
      SoundFX.playIncorrect();
    }
  });
}

function updateA5Progress(){
  document.getElementById('a5-progress-text').textContent = a5Progress + ' / 100';
  document.getElementById('a5-progress-fill').style.width = a5Progress + '%';
}

/* ============ Activity 6: multiple-choice ============ */
// Board starts randomly filled 0%-80% (so it can land completely empty, as requested).
// One empty cell at a time is quizzed with 4 options; after a random 5-10 correct
// answers the board is swapped for a fresh random one - there's no goal to fill it all.
let a6Queue = [];
let a6RoundIndex = 0;
let a6RoundTarget = 0;
let a6Locked = false;

function initActivity6(){
  buildA6Board();
}
registerInit('6', initActivity6);

function buildA6Board(){
  const coords = [];
  for (let r=1; r<=10; r++){
    for (let c=1; c<=10; c++) coords.push([r, c]);
  }
  shuffle(coords);

  const prefillPct = Math.random() * 0.80; // 0%-80%, so a fully empty board is a real possibility
  const prefillCount = Math.round(100 * prefillPct);
  const prefilled = new Set(coords.slice(0, prefillCount).map(([r,c]) => r+'_'+c));

  a6Queue = coords.slice(prefillCount); // already shuffled - remaining empty cells
  a6RoundIndex = 0;
  a6RoundTarget = 5 + Math.floor(Math.random() * 6); // 5..10 inclusive
  document.getElementById('a6-round-total').textContent = a6RoundTarget;
  document.getElementById('a6-round-current').textContent = 1;

  const holder = document.getElementById('a6-table-holder');
  let html = '<table class="mult-table" id="a6-table"><thead>'+buildHeaderRow()+'</thead><tbody>';
  for (let r=1; r<=10; r++){
    html += '<tr>';
    for (let c=10; c>=1; c--){
      if (prefilled.has(r+'_'+c)){
        html += '<td class="seq-cell filled" data-row="'+r+'" data-col="'+c+'">'+(r*c)+'</td>';
      } else {
        html += '<td class="seq-cell" data-row="'+r+'" data-col="'+c+'"></td>';
      }
    }
    html += '<th>'+r+'</th></tr>';
  }
  html += '</tbody></table>';
  holder.innerHTML = html;

  askA6Question();
}

function generateA6Distractors(r, c, count){
  const target = r * c;
  const candidates = new Set();
  const maybeAdd = (v) => { if (v > 0 && v <= 100 && v !== target) candidates.add(v); };

  // near-miss factor slips (off-by-one on a factor) - the classic multiplication mistakes
  maybeAdd((r - 1) * c);
  maybeAdd((r + 1) * c);
  maybeAdd(r * (c - 1));
  maybeAdd(r * (c + 1));
  maybeAdd((r - 1) * (c - 1));
  maybeAdd((r + 1) * (c + 1));
  maybeAdd(r * r);
  maybeAdd(c * c);
  maybeAdd(target + r);
  maybeAdd(target - r);
  maybeAdd(target + c);
  maybeAdd(target - c);
  maybeAdd(target + 10);
  maybeAdd(target - 10);
  if (target >= 10 && target <= 99){
    const tens = Math.floor(target / 10), ones = target % 10;
    if (tens !== ones) maybeAdd(ones * 10 + tens); // digit-transposition slip, e.g. 56 -> 65
  }

  let pool = shuffle(Array.from(candidates));
  let attempts = 0;
  while (pool.length < count && attempts < 50){
    const v = target + Math.floor(Math.random() * 9) - 4;
    if (v > 0 && v <= 100 && v !== target && !pool.includes(v)) pool.push(v);
    attempts++;
  }
  attempts = 0;
  while (pool.length < count && attempts < 200){
    const v = Math.floor(Math.random() * 100) + 1;
    if (v !== target && !pool.includes(v)) pool.push(v);
    attempts++;
  }
  return pool.slice(0, count);
}

function askA6Question(){
  a6Locked = false;
  if (a6Queue.length === 0){
    celebrateA6BoardAndContinue();
    return;
  }
  const [r, c] = a6Queue.pop();
  const td = document.querySelector('#a6-table td.seq-cell[data-row="'+r+'"][data-col="'+c+'"]');
  td.classList.add('active');

  const target = r * c;
  const options = shuffle([target, ...generateA6Distractors(r, c, 3)]);

  const panel = document.getElementById('a6-options');
  panel.innerHTML = '';
  options.forEach(val => {
    const btn = document.createElement('button');
    btn.className = 'a6-option-btn';
    btn.textContent = val;
    btn.addEventListener('click', () => handleA6Answer(val, target, td, btn));
    panel.appendChild(btn);
  });
}

function handleA6Answer(chosen, target, td, btn){
  if (a6Locked) return;
  if (chosen === target){
    a6Locked = true;
    btn.classList.add('correct');
    SoundFX.playCorrect();
    td.classList.remove('active');
    td.classList.add('filled');
    td.textContent = target;

    a6RoundIndex++;
    setTimeout(() => {
      if (a6RoundIndex >= a6RoundTarget){
        celebrateA6BoardAndContinue();
      } else {
        document.getElementById('a6-round-current').textContent = a6RoundIndex + 1;
        askA6Question();
      }
    }, 500);
  } else {
    btn.classList.add('incorrect');
    SoundFX.playIncorrect();
    setTimeout(() => btn.classList.remove('incorrect'), 400);
  }
}

function celebrateA6BoardAndContinue(){
  showToast('🎉 כל הכבוד! עוברים ללוח חדש...');
  launchConfetti(60);
  SoundFX.playWin();
  document.getElementById('a6-options').innerHTML = '';
  setTimeout(() => buildA6Board(), 1400);
}
