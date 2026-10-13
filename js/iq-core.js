'use strict';

/* ============ IQ category registry & shared game loop ============ */
// Each category (number sequences, shape sequences, odd-one-out, analogies,
// matrix completion, letter sequences) registers itself with an icon/title and
// a renderQuestion(tier, promptEl, optionsEl, onAnswer) function. Everything
// else - the menu button, the screen chrome, level/streak tracking and
// persistence, sound, and the multiple-choice click/lock/flash behavior - is
// shared here so every category only has to describe ITS question content.

const IQ_CATEGORIES = [];
const LEVEL_UP_STREAK = 4;
const IQ_MENU_COLOR_CLASSES = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

registerScreen('main', document.getElementById('main-menu'));
registerScreen('iq-menu', document.getElementById('iq-menu'));

function registerIQCategory(def){
  IQ_CATEGORIES.push(Object.assign({ maxTier: 7 }, def));
}

/* ---- progress persistence (per-category tier + streak, kept in localStorage) ---- */
function loadIQProgress(key){
  try {
    const all = JSON.parse(localStorage.getItem('iq_progress_v1') || '{}');
    return all[key] || { tier: 1, streak: 0 };
  } catch (e){
    return { tier: 1, streak: 0 };
  }
}

function saveIQProgress(key, prog){
  try {
    const all = JSON.parse(localStorage.getItem('iq_progress_v1') || '{}');
    all[key] = prog;
    localStorage.setItem('iq_progress_v1', JSON.stringify(all));
  } catch (e){ /* private-browsing / storage disabled - progress just won't persist */ }
}

/* ---- shared multiple-choice rendering (click/lock/flash/sound) ---- */
// options: [{ isCorrect, label? , html? }]
function renderIQMultipleChoice(optionsEl, options, onAnswer){
  let locked = false;
  optionsEl.innerHTML = '';
  shuffle(options).forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'iq-option-btn';
    if (opt.html) btn.innerHTML = opt.html; else { btn.textContent = opt.label; btn.classList.add('iq-option-text'); }
    btn.addEventListener('click', () => {
      if (locked) return;
      if (opt.isCorrect){
        locked = true;
        btn.classList.add('correct');
        SoundFX.playCorrect();
        onAnswer(true);
      } else {
        btn.classList.add('incorrect');
        SoundFX.playIncorrect();
        setTimeout(() => btn.classList.remove('incorrect'), 400);
        onAnswer(false);
      }
    });
    optionsEl.appendChild(btn);
  });
}

/* ---- level display ---- */
function updateIQLevelDisplay(category, prog){
  document.getElementById('iq-' + category.key + '-level-num').textContent = prog.tier;
  if (prog.tier >= category.maxTier){
    document.getElementById('iq-' + category.key + '-streak-label').textContent = 'רמה מקסימלית!';
  } else {
    document.getElementById('iq-' + category.key + '-streak-label').textContent = prog.streak + '/' + LEVEL_UP_STREAK + ' לרמה הבאה';
  }
  const pct = Math.min(100, Math.round((prog.streak / LEVEL_UP_STREAK) * 100));
  document.getElementById('iq-' + category.key + '-streak-fill').style.width = pct + '%';
}

/* ---- the game loop itself ---- */
function askIQQuestion(category){
  const prog = loadIQProgress(category.key);
  updateIQLevelDisplay(category, prog);
  const promptEl = document.getElementById('iq-' + category.key + '-prompt');
  const optionsEl = document.getElementById('iq-' + category.key + '-options');
  document.getElementById('iq-' + category.key + '-explanation').textContent = '';
  document.getElementById('iq-' + category.key + '-next-btn').classList.add('hidden');
  category.renderQuestion(prog.tier, promptEl, optionsEl, (isCorrect) => handleIQAnswer(category, isCorrect));
}

function handleIQAnswer(category, isCorrect){
  const prog = loadIQProgress(category.key);
  if (isCorrect){
    prog.streak++;
    let leveledUp = false;
    if (prog.streak >= LEVEL_UP_STREAK){
      if (prog.tier < category.maxTier){
        prog.tier++;
        leveledUp = true;
      }
      prog.streak = 0;
      saveIQProgress(category.key, prog);
      updateIQLevelDisplay(category, prog);
      if (leveledUp){
        showToast('🌟 עלית לרמה ' + prog.tier + '!', ['green', 'green-dark']);
      } else {
        showToast('🔥 רצף מצוין!', ['orange', 'orange-dark']);
      }
      SoundFX.playLevelUp();
    } else {
      saveIQProgress(category.key, prog);
      updateIQLevelDisplay(category, prog);
    }
    document.getElementById('iq-' + category.key + '-next-btn').classList.remove('hidden');
  } else {
    prog.streak = 0;
    saveIQProgress(category.key, prog);
    updateIQLevelDisplay(category, prog);
    // question stays on screen - the clicked (wrong) button already flashed red and unlocked itself
  }
}

function initIQCategory(category){
  askIQQuestion(category);
}

function resetIQProgressToStart(category){
  saveIQProgress(category.key, { tier: 1, streak: 0 });
  showToast('↩️ ההתקדמות אופסה לרמה 1', ['blue', 'blue-dark']);
  askIQQuestion(category);
}

/* ---- builds the IQ menu grid + every category's screen chrome from the registry ---- */
function buildAllIQScreens(){
  const menuGrid = document.getElementById('iq-menu-grid');
  const screensRoot = document.getElementById('iq-screens-root');

  IQ_CATEGORIES.forEach((category, i) => {
    const colorClass = IQ_MENU_COLOR_CLASSES[i % IQ_MENU_COLOR_CLASSES.length];

    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn ' + colorClass;
    menuBtn.setAttribute('data-nav', 'iq-' + category.key);
    menuBtn.innerHTML =
      '<span class="emoji">' + category.icon + '</span>' +
      '<span>' + category.title + '</span>' +
      '<span class="label-sub">' + category.subtitle + '</span>';
    menuGrid.appendChild(menuBtn);

    const section = document.createElement('section');
    section.id = 'iq-' + category.key;
    section.className = 'activity-screen hidden';
    section.innerHTML =
      '<div class="activity-topbar">' +
        '<button class="btn back" data-back="iq-menu">⬅ חזרה לקטגוריות</button>' +
        '<span class="activity-title">' + category.icon + ' ' + category.title + '</span>' +
        '<button class="btn reset" data-reset="iq-' + category.key + '">🔄 שאלה חדשה</button>' +
      '</div>' +
      '<div class="iq-level-wrap">' +
        '<div class="iq-level-label">רמה <span id="iq-' + category.key + '-level-num">1</span> מתוך ' + category.maxTier +
          ' · <span id="iq-' + category.key + '-streak-label">0/' + LEVEL_UP_STREAK + ' לרמה הבאה</span></div>' +
        '<div class="progress-bar-track"><div class="progress-bar-fill" id="iq-' + category.key + '-streak-fill"></div></div>' +
        '<button class="iq-reset-progress-btn" id="iq-' + category.key + '-reset-progress">↩️ אפס התקדמות לרמה 1</button>' +
      '</div>' +
      '<div class="iq-prompt" id="iq-' + category.key + '-prompt"></div>' +
      '<div class="iq-options-wrap">' +
        '<div class="iq-options-label">בחרו את התשובה הנכונה:</div>' +
        '<div class="iq-options" id="iq-' + category.key + '-options"></div>' +
      '</div>' +
      '<div class="iq-explanation" id="iq-' + category.key + '-explanation"></div>' +
      '<button class="btn iq-next-btn hidden" id="iq-' + category.key + '-next-btn">השאלה הבאה ➡️</button>';
    screensRoot.appendChild(section);

    registerScreen('iq-' + category.key, section);
    registerInit('iq-' + category.key, () => initIQCategory(category));
    section.querySelector('#iq-' + category.key + '-reset-progress')
      .addEventListener('click', () => resetIQProgressToStart(category));
    section.querySelector('#iq-' + category.key + '-next-btn')
      .addEventListener('click', () => {
        document.getElementById('iq-' + category.key + '-next-btn').classList.add('hidden');
        askIQQuestion(category);
      });
  });
}
