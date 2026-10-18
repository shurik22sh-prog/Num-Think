'use strict';
// Builds the master review sheet: node _tests/review/build.js [samplesPerVariant=6] [seed=1]
// Writes _tests/review/master-review.html. Production code is loaded in a sandbox with EVERY family and variant switched on
// (only inside that sandbox - the shipped defaults are not touched). Each question is shown the way the game shows it:
// four option tiles at the phone size (60px tile, 43px picture) and at the desktop size (84px tile, 72px picture);
// the odd one is marked, and the Hebrew sentence the game would show after a correct answer sits underneath.
// Open it on the phone as well: the real test of legibility is the actual screen.

const fs = require('fs');
const path = require('path');
const H = require('../harness');

const perVariant = Number(process.argv[2] || 6), seed = Number(process.argv[3] || 1);
const p = H.loadProject();
p.seed(seed);
const families = p.evalIn('IQ_ODD_FAMILIES'), variants = p.evalIn('IQ_ODD_VARIANTS');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const NOTES = {
  orientation: 'סיבוב מול שיקוף (תמונת ראי)',
  ratio: 'מספר הנקודות הפנימיות מול מספר הצלעות',
  symmetry: 'צורה סימטרית מול צורה עם פינה אחת שזזה',
  parts: 'חלוקה לחלקים שווים (חופפים) מול חלוקה לא שווה',
  props: 'תכונה גאומטרית משותפת (צלעות שוות, מקבילות, זוויות ישרות)',
  topology: 'חורים סגורים בצורות רשת; שרשרת חרוזים מחוברת מול שבורה',
  stack: 'סדר הנחה של צורות חופפות',
  net: 'קשרים בין נקודות ברשת'
};
let body = '', toc = '';
const rows = [];
for (const fam of families){
  // families without registered variants (symmetry) pick their own design from the tier: show one question per tier
  const list = variants[fam.key] || [{ key: 'tiers 1-6', minTier: 1, enabled: true, generate: t => fam.generate(t), perTier: true }];
  list.forEach(v => {
    const tier = Math.max(v.minTier || 1, fam.minTier || 1);
    const entries = [];
    for (let i = 0; i < perVariant; i++){
      entries.push(v.generate(v.perTier ? 1 + (i % 6) : tier));
    }
    const shippedOn = (fam.enabled && v.enabled !== false);
    const id = fam.key + '-' + v.key;
    toc += '<li><a href="#' + id + '">' + esc(fam.key) + ' / ' + esc(v.key) + '</a> <span class="tag ' + (shippedOn ? 'on' : 'off') + '">' + (shippedOn ? 'פעיל במשחק' : 'כבוי') + '</span></li>';
    rows.push([fam.key, v.key, tier, shippedOn]);
    let sec = '<section id="' + id + '"><h2>' + esc(fam.key) + ' / ' + esc(v.key) + ' <span class="tag ' + (shippedOn ? 'on' : 'off') + '">' + (shippedOn ? 'פעיל במשחק' : 'כבוי עד הסקירה') + '</span></h2>';
    sec += '<p class="meta">רמה ראשונה: ' + tier + ' · ' + esc(NOTES[fam.key] || '') + '</p>';
    sec += '<p class="expl">' + esc(entries[0].explanation) + '</p>';
    entries.forEach((r, qi) => {
      const tiles = (size, tile) => r.items.map((it, i) => '<div class="tile ' + (i === r.oddIndex ? 'odd' : '') + '" style="width:' + tile + 'px;height:' + tile + 'px"><div style="width:' + size + 'px;height:' + size + 'px">' + p.ctx.iqOddRenderItem(it).replace(/width="\d+" height="\d+"/, 'width="' + size + '" height="' + size + '"') + '</div></div>').join('');
      sec += '<div class="q"><span class="n">' + (qi + 1) + '</span><div class="row phone">' + tiles(43.2, 60) + '</div><div class="row desk">' + tiles(72, 84) + '</div></div>';
    });
    body += sec + '</section>';
  });
}

const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>סקירה כוללת – איזו צורה שונה מהשאר?</title><style>' +
  'body{font-family:Assistant,Arial,sans-serif;background:#f5f6fb;color:#1a1a2e;margin:0;padding:16px;max-width:980px;margin-inline:auto}' +
  'h1{font-size:22px}h2{font-size:17px;margin:22px 0 4px}.meta{color:#555;margin:2px 0}.expl{background:#fff;border-radius:8px;padding:8px 12px;margin:6px 0 10px}' +
  '.tag{font-size:12px;border-radius:10px;padding:1px 8px;margin-inline-start:6px}.tag.on{background:#d9f5e3;color:#116a36}.tag.off{background:#eee;color:#666}' +
  '.q{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:8px 0;padding:8px;background:#fff;border-radius:10px}.n{width:18px;color:#888;font-size:12px}' +
  '.row{display:flex;gap:6px}.tile{display:flex;align-items:center;justify-content:center;background:#fff;border:2px solid #d5d8ea;border-radius:12px;box-sizing:border-box}.tile.odd{border-color:#16a34a;background:#eafaf0}' +
  '.hint{color:#555;font-size:14px}li{margin:3px 0}@media(max-width:600px){.desk{display:none}}' +
  '</style></head><body><h1>סקירה כוללת של "איזו צורה שונה מהשאר?"</h1>' +
  '<p class="hint">בכל שאלה הצורה השונה מסומנת בירוק. הצורות מוצגות בגודל הטלפון (מימין/למעלה) ובגודל המחשב. במסך צר מוצג רק גודל הטלפון. בדקו: האם ברור מה שונה? האם הניסוח מתחת לכותרת מתאים? האם משהו קטן מדי?</p>' +
  '<ul>' + toc + '</ul>' + body + '</body></html>';
const out = path.join(__dirname, 'master-review.html');
fs.writeFileSync(out, html);
console.log('wrote', out, '|', rows.length, 'variants,', rows.length * perVariant, 'questions, ' + Math.round(html.length / 1024) + ' KB');
