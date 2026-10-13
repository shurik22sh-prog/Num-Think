'use strict';

/* ============ Sound synth (Web Audio API) ============ */
const SoundFX = (function(){
  let ctx = null;
  function ensureCtx(){
    if (!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, startOffset, duration, opts){
    opts = opts || {};
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.value = freq;
    const t0 = c.currentTime + startOffset;
    const peak = opts.peak != null ? opts.peak : 0.25;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function playCorrect(){
    tone(523.25, 0, 0.16, {type:'sine', peak:0.22});
    tone(659.25, 0.09, 0.16, {type:'sine', peak:0.22});
    tone(783.99, 0.18, 0.24, {type:'sine', peak:0.24});
  }

  function playIncorrect(){
    tone(220, 0, 0.18, {type:'triangle', peak:0.2});
    tone(174.6, 0.12, 0.22, {type:'triangle', peak:0.18});
  }

  function playTryAgain(){
    tone(300, 0, 0.12, {type:'sine', peak:0.14});
    tone(240, 0.09, 0.16, {type:'sine', peak:0.12});
  }

  function playWin(){
    const notes = [523.25,587.33,659.25,698.46,783.99,880,987.77,1046.5];
    notes.forEach((f,i) => tone(f, i*0.11, 0.22, {type:'sine', peak:0.22}));
  }

  function playLevelUp(){
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((f,i) => tone(f, i*0.09, 0.2, {type:'sine', peak:0.24}));
  }

  return { playCorrect, playIncorrect, playTryAgain, playWin, playLevelUp, ensureCtx };
})();

// unlock audio context on first interaction (mobile/tablet autoplay policies)
document.addEventListener('pointerdown', () => SoundFX.ensureCtx(), {once:true});

/* ============ Generic helpers ============ */
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randInt(min, max){ // inclusive both ends
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickOne(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ============ Confetti / celebration ============ */
const CONFETTI_COLORS = ['#FF6B6B','#4ECDC4','#FFD93D','#9B5DE5','#06D6A0','#EF476F'];
function launchConfetti(count){
  count = count || 130;
  const layer = document.getElementById('confetti-layer');
  for (let i=0; i<count; i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const left = Math.random()*100;
    const duration = 2.4 + Math.random()*1.8;
    const delay = Math.random()*0.6;
    const color = CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)];
    piece.style.left = left + 'vw';
    piece.style.background = color;
    piece.style.animationDuration = duration + 's';
    piece.style.animationDelay = delay + 's';
    piece.style.width = (6 + Math.random()*8) + 'px';
    piece.style.height = (10 + Math.random()*10) + 'px';
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), (duration+delay)*1000 + 200);
  }
}

function showWinBanner(message, onClose){
  const overlay = document.createElement('div');
  overlay.className = 'win-banner';
  overlay.innerHTML =
    '<div class="win-card">' +
      '<div class="emoji">🏆🎉</div>' +
      '<h2>כל הכבוד!</h2>' +
      '<p>' + message + '</p>' +
      '<button class="btn" style="background:linear-gradient(160deg,var(--green),var(--green-dark));">מעולה!</button>' +
    '</div>';
  document.body.appendChild(overlay);
  launchConfetti();
  SoundFX.playWin();
  overlay.querySelector('button').addEventListener('click', () => {
    overlay.remove();
    if (onClose) onClose();
  });
}

function showToast(text, gradientVars){
  const toast = document.createElement('div');
  toast.className = 'round-toast';
  if (gradientVars) toast.style.background = 'linear-gradient(160deg, var(--'+gradientVars[0]+'), var(--'+gradientVars[1]+'))';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1400);
}

/* ============ Navigation ============ */
// Every screen (menus + activities/games) registers its DOM element under a key,
// and optionally an init function to run each time it's navigated to.
const SCREENS = {};
const INIT_FNS = {};

function registerScreen(key, el){ SCREENS[key] = el; }
function registerInit(key, fn){ INIT_FNS[key] = fn; }

function showScreen(key){
  Object.values(SCREENS).forEach(s => s.classList.add('hidden'));
  SCREENS[key].classList.remove('hidden');
}

function navigateTo(key){
  showScreen(key);
  if (INIT_FNS[key]) INIT_FNS[key]();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.getAttribute('data-nav')));
  });
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.getAttribute('data-back')));
  });
  document.querySelectorAll('[data-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-reset');
      if (INIT_FNS[key]) INIT_FNS[key]();
    });
  });
});
