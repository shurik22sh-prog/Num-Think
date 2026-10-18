'use strict';
// Tests for variant-level gating (iq-odd-core.js): iqOddRegisterVariants / iqOddPickVariant and the
// result-contract guard. Written BEFORE the implementation: every must-reject case below has to fail
// against code that lacks the rule. A synthetic probe family is registered inside the sandbox only.
//
// Rules under test:
//   - a variant is { key, generate(tier), minTier?, enabled? }; omitted minTier = 1, omitted enabled = FALSE
//     (a variant must be switched on explicitly; "existing approved" variants register with enabled: true);
//   - the picker draws only among enabled, tier-eligible variants and consumes NO randomness when exactly one
//     is eligible (so adding disabled variants can never change a seeded sequence);
//   - a generated result must name a registered AND enabled variant of its family;
//   - families without registered variants (the three existing ones today) are untouched;
//   - default-state guard: every enabled variant in the production registry is on the approved allowlist.

const H = require('../harness');

const out = [];
function test(name, fn){
  try { const r = fn(); out.push({ name, pass: r.pass !== false, info: r.info || null }); }
  catch (e){ out.push({ name, pass: false, info: 'THREW: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
}
const msgOf = fn => { try { fn(); return null; } catch (e){ return String(e && e.message); } };

// Variants that are APPROVED to be enabled by default (existing, working game content), as 'family/variant'.
// Since the activation after the master review: every registered production variant is approved and enabled. A variant
// added later registers disabled (the default) until it is added here on purpose.
const APPROVED_ENABLED = ['orientation/flag', 'orientation/cells-5', 'orientation/cells-6', 'orientation/cells-7',
  'ratio/sides-minus-1-ring', 'ratio/sides-ring', 'ratio/sides-minus-1-rows', 'ratio/sides-minus-1-dice', 'ratio/sides-rows', 'ratio/sides-minus-2-ring', 'ratio/sides-minus-2-rows', 'ratio/sides-minus-2-dice', 'ratio/sides-plus-1-ring', 'ratio/sides-plus-1-rows',
  'parts/square-2', 'parts/square-4', 'parts/circle-3', 'parts/circle-4',
  'props/equal-sides', 'props/two-parallel-pairs', 'props/right-angles', 'props/one-parallel-pair', 'props/right-triangle',
  'topology/hole-missing', 'topology/hole-extra', 'topology/chain', 'stack/three-shapes', 'net/ring-or-stub', 'net/same-links'];
// Families that register their variants in production code (the sandboxes below load those scripts too).
const PRODUCTION_VARIANT_FAMILIES = 'orientation,ratio,parts,props,topology,stack,net';

const SCRIPTS = H.listScripts().filter(s => /core|shapes|iq-visual/.test(s) && !/multiplication/.test(s));
const noop = () => ({});
const probeFamilyDef = (extra) => Object.assign({ key: 'vprobe', generate: () => null, verify: () => true, render: () => '<svg/>' }, extra || {});
const nextRandom = p => p.evalIn('Math.random()');
function fresh(){
  const p = H.loadProject({ scripts: SCRIPTS });
  p.ctx.iqOddRegisterFamily(probeFamilyDef());
  return p;
}
const V = (key, extra) => Object.assign({ key, generate: noop }, extra || {});

function run(){
  test('VAR-1 the variant API exists in the core', () => {
    const p = H.loadProject({ scripts: SCRIPTS });
    const have = ['iqOddRegisterVariants', 'iqOddPickVariant'].map(n => typeof p.ctx[n] === 'function');
    return { pass: have.every(Boolean) && p.evalIn('typeof IQ_ODD_VARIANTS') === 'object', info: 'iqOddRegisterVariants, iqOddPickVariant, IQ_ODD_VARIANTS present: ' + have.join(',') };
  });

  test('VAR-2 malformed variant registrations throw a clear error naming the problem, and register nothing', () => {
    const cases = [
      ['family key empty', '', [V('a')], /family key must be a non-empty string/],
      ['family key a number', 123, [V('a')], /family key must be a non-empty string/],
      ['unknown family', 'nope', [V('a')], /unknown family "nope"/],
      ['list is not an array', 'vprobe', 'a', /non-empty array/],
      ['list is empty', 'vprobe', [], /non-empty array/],
      ['entry is null', 'vprobe', [null], /variant 0 is not an object/],
      ['key missing', 'vprobe', [{ generate: noop }], /"key" must be a non-empty string/],
      ['key empty', 'vprobe', [V('')], /"key" must be a non-empty string/],
      ['key whitespace', 'vprobe', [V('  ')], /"key" must be a non-empty string/],
      ['key a number', 'vprobe', [V(5)], /"key" must be a non-empty string/],
      ['duplicate keys', 'vprobe', [V('a'), V('a')], /duplicate variant "a"/],
      ['generate missing', 'vprobe', [{ key: 'a' }], /"generate" must be a function/],
      ['generate a string', 'vprobe', [V('a', { generate: 'x' })], /"generate" must be a function/],
      ['minTier "abc"', 'vprobe', [V('a', { minTier: 'abc' })], /"minTier" must be a finite number/],
      ['minTier NaN', 'vprobe', [V('a', { minTier: NaN })], /"minTier" must be a finite number/],
      ['minTier Infinity', 'vprobe', [V('a', { minTier: Infinity })], /"minTier" must be a finite number/],
      ['minTier null', 'vprobe', [V('a', { minTier: null })], /"minTier" must be a finite number/],
      ['minTier explicitly undefined', 'vprobe', [V('a', { minTier: undefined })], /"minTier" must be a finite number/],
      ['enabled "true" (string)', 'vprobe', [V('a', { enabled: 'true' })], /"enabled" must be a boolean/],
      ['enabled 1', 'vprobe', [V('a', { enabled: 1 })], /"enabled" must be a boolean/],
      ['enabled null', 'vprobe', [V('a', { enabled: null })], /"enabled" must be a boolean/],
      ['enabled explicitly undefined', 'vprobe', [V('a', { enabled: undefined })], /"enabled" must be a boolean/],
      ['a bad entry after a good one', 'vprobe', [V('a'), V('b', { enabled: 'yes' })], /"enabled" must be a boolean/]
    ];
    const p = fresh(); const bad = [];
    for (const [label, fam, list, re] of cases){
      const m = msgOf(() => p.ctx.iqOddRegisterVariants(fam, list));
      if (!(m && re.test(m))) bad.push(label + ' -> ' + m);
    }
    const nothing = p.evalIn("Object.keys(IQ_ODD_VARIANTS).join()") === PRODUCTION_VARIANT_FAMILIES; // only what production itself registered (the ratio family), nothing from the failed attempts
    const afterFail = msgOf(() => p.ctx.iqOddPickVariant('vprobe', 1));
    return { pass: !bad.length && nothing && /no variants registered/.test(afterFail || ''), info: cases.length + ' cases; only the production registration remains: ' + nothing + (bad.length ? '; WRONG: ' + bad.join(' | ') : '') };
  });

  test('VAR-3 valid registration: defaults are minTier 1 and enabled FALSE; explicit values kept; a second registration for the same family is rejected', () => {
    const p = fresh();
    p.ctx.iqOddRegisterVariants('vprobe', [V('plain'), V('on', { enabled: true }), V('late', { enabled: true, minTier: 4 }), V('half', { minTier: 2.5 })]);
    const f = k => p.evalIn("IQ_ODD_VARIANTS.vprobe").find(v => v.key === k);
    const ok = f('plain').enabled === false && f('plain').minTier === 1 && f('on').enabled === true && f('late').minTier === 4 && f('half').minTier === 2.5 && f('half').enabled === false;
    const again = msgOf(() => p.ctx.iqOddRegisterVariants('vprobe', [V('other')]));
    return { pass: ok && /already registered/.test(again || ''), info: 'omitted enabled -> ' + f('plain').enabled + ', omitted minTier -> ' + f('plain').minTier + ' | second registration: ' + again };
  });

  test('VAR-4 picker: no eligible variant is a clear error; disabled and not-yet-unlocked variants are never picked', () => {
    const p = fresh();
    p.ctx.iqOddRegisterVariants('vprobe', [V('off'), V('on', { enabled: true }), V('late', { enabled: true, minTier: 4 })]);
    const none = (() => { const q = fresh(); q.ctx.iqOddRegisterVariants('vprobe', [V('off')]); return msgOf(() => q.ctx.iqOddPickVariant('vprobe', 3)); })();
    p.seed(1);
    const seenLow = new Set(), seenHigh = new Set();
    for (let i = 0; i < 2000; i++){ seenLow.add(p.ctx.iqOddPickVariant('vprobe', 2).key); seenHigh.add(p.ctx.iqOddPickVariant('vprobe', 5).key); }
    const low = [...seenLow].sort().join(','), high = [...seenHigh].sort().join(',');
    return { pass: /no enabled variant for family "vprobe" at tier 3/.test(none || '') && low === 'on' && high === 'late,on', info: 'none eligible -> "' + none + '" | tier 2 picks: ' + low + ' | tier 5 picks: ' + high };
  });

  test('VAR-5 picker draws NO randomness when exactly one variant is eligible (adding disabled variants cannot change a seeded sequence), and exactly one draw when several are', () => {
    const mk = list => { const p = fresh(); p.ctx.iqOddRegisterVariants('vprobe', list); return p; };
    const onlyOne = mk([V('on', { enabled: true })]), withDisabled = mk([V('on', { enabled: true }), V('x'), V('y', { minTier: 3, enabled: true })]), reference = mk([V('on', { enabled: true })]);
    for (const p of [onlyOne, withDisabled, reference]) p.seed(77);
    for (let i = 0; i < 25; i++){ onlyOne.ctx.iqOddPickVariant('vprobe', 1); withDisabled.ctx.iqOddPickVariant('vprobe', 1); }
    const a = nextRandom(onlyOne), b = nextRandom(withDisabled), c = nextRandom(reference);
    const two = mk([V('a', { enabled: true }), V('b', { enabled: true })]), ref2 = mk([V('a', { enabled: true })]);
    two.seed(77); ref2.seed(77);
    for (let i = 0; i < 25; i++) two.ctx.iqOddPickVariant('vprobe', 1);
    for (let i = 0; i < 25; i++) nextRandom(ref2);                       // exactly one draw per pick
    const d = nextRandom(two), e = nextRandom(ref2);
    return { pass: a === c && b === c && d === e, info: 'single eligible: random stream untouched (' + [a === c, b === c] + '); two eligible: one draw per pick (' + (d === e) + ')' };
  });

  test('VAR-6 with two eligible variants both are used about equally (4,000 picks, +-3 points) and the sequence is deterministic under a seed', () => {
    const seq = seed => { const p = fresh(); p.ctx.iqOddRegisterVariants('vprobe', [V('a', { enabled: true }), V('b', { enabled: true })]); p.seed(seed); const r = []; for (let i = 0; i < 4000; i++) r.push(p.ctx.iqOddPickVariant('vprobe', 1).key); return r; };
    const s1 = seq(3), s2 = seq(3), s3 = seq(4);
    const shareA = s1.filter(x => x === 'a').length / s1.length;
    return { pass: Math.abs(shareA - 0.5) < 0.03 && s1.join() === s2.join() && s1.join() !== s3.join(), info: 'share of "a" ' + (100 * shareA).toFixed(1) + '%; same seed identical; different seed differs' };
  });

  test('VAR-7 variants can be switched on inside a sandbox (the review-sheet and test mechanism) and the switch takes effect immediately', () => {
    const p = fresh(); p.ctx.iqOddRegisterVariants('vprobe', [V('on', { enabled: true }), V('later')]);
    p.seed(9);
    const before = new Set(); for (let i = 0; i < 300; i++) before.add(p.ctx.iqOddPickVariant('vprobe', 1).key);
    p.evalIn("IQ_ODD_VARIANTS.vprobe").find(v => v.key === 'later').enabled = true;
    const after = new Set(); for (let i = 0; i < 300; i++) after.add(p.ctx.iqOddPickVariant('vprobe', 1).key);
    return { pass: [...before].join() === 'on' && [...after].sort().join() === 'later,on', info: 'before: ' + [...before] + ' | after enabling: ' + [...after].sort() };
  });

  // ---- result-contract guard, exercised through the real iqOddGenerate ----
  function guardProject(variantList, resultVariant){
    const p = fresh();
    const calls = { gen: 0, ver: 0 };
    p.evalIn('IQ_ODD_FAMILIES').forEach(f => { f.enabled = f.key === 'vprobe'; });
    // replace the probe family's functions so the generated result names the requested variant
    const fam = p.evalIn("IQ_ODD_FAMILIES").find(f => f.key === 'vprobe');
    const result = () => ({ family: 'vprobe', variant: resultVariant, items: [0, 1, 2, 3].map(() => ({ kind: 'vprobe' })), oddIndex: 1, explanation: 'x' });
    fam.generate = () => { calls.gen++; return result(); };
    fam.verify = () => { calls.ver++; return true; };
    if (variantList) p.ctx.iqOddRegisterVariants('vprobe', variantList);
    return { p, calls };
  }
  test('VAR-8 a generated result must name a registered AND enabled variant: disabled, unknown and missing variant names are rejected at once (generator called once, verifier never reached)', () => {
    const list = [V('on', { enabled: true }), V('off')];
    const cases = [['names a DISABLED variant', 'off', /variant "off" is not enabled/], ['names an UNKNOWN variant', 'ghost', /variant "ghost" is not a registered variant/],
      ['names no variant (undefined)', undefined, /is not a registered variant/], ['names a non-string variant', 7, /is not a registered variant/]];
    const bad = [];
    for (const [label, v, re] of cases){
      const { p, calls } = guardProject(list, v);
      const m = msgOf(() => p.ctx.iqOddGenerate(1));
      if (!(m && /invalid result/.test(m) && re.test(m) && calls.gen === 1 && calls.ver === 0)) bad.push(label + ' -> ' + m + ' gen=' + calls.gen + ' ver=' + calls.ver);
    }
    return { pass: !bad.length, info: cases.length + ' cases' + (bad.length ? '; WRONG: ' + bad.join(' | ') : '') };
  });
  test('VAR-9 an enabled variant\'s result is accepted unchanged; a family WITHOUT registered variants is not affected by the guard', () => {
    const { p, calls } = guardProject([V('on', { enabled: true }), V('off')], 'on');
    const r = p.ctx.iqOddGenerate(1);
    const none = guardProject(null, 'anything-goes');
    const r2 = none.p.ctx.iqOddGenerate(1);
    return { pass: r.variant === 'on' && calls.gen === 1 && r2.variant === 'anything-goes', info: 'accepted variant "' + r.variant + '"; family without variants accepted its result as before' };
  });

  test('VAR-10 the three existing families still generate on every tier with no error (3,000 questions): the guard and the registry do not touch them', () => {
    const p = H.loadProject({ scripts: SCRIPTS }); p.seed(21); let ok = 0;
    for (let t = 1; t <= 6; t++) for (let i = 0; i < 500; i++){ p.ctx.iqOddGenerate(t); ok++; }
    return { pass: ok === 3000, info: ok + ' questions generated' };
  });

  test('VAR-11 default-state guard: in the production registry every ENABLED variant is on the approved allowlist (today only ratio/sides-minus-1-ring)', () => {
    const p = H.loadProject({ scripts: SCRIPTS });
    const reg = p.evalIn('IQ_ODD_VARIANTS');
    const enabled = [];
    for (const fam of Object.keys(reg)) for (const v of reg[fam]) if (v.enabled) enabled.push(fam + '/' + v.key);
    const unapproved = enabled.filter(k => !APPROVED_ENABLED.includes(k));
    const stale = APPROVED_ENABLED.filter(k => !enabled.includes(k));
    return { pass: !unapproved.length && !stale.length, info: 'registered families with variants: ' + (Object.keys(reg).join(',') || 'none') + ' | enabled: ' + (enabled.join(',') || 'none') + ' | enabled but not approved: ' + (unapproved.join(',') || 'none') + ' | approved but not enabled/registered: ' + (stale.join(',') || 'none') };
  });

  return out;
}

module.exports = { run };
