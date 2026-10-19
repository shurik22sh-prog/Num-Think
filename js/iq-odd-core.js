'use strict';

/* ============ Odd one out: family registry & generic dispatch ============ */
// A "family" is one kind of odd-one-out question (orientation, ratio, symmetry,
// ...). Each registers { key, generate(tier), verify(result), render(item) }
// plus optional { minTier, maxTier, enabled, largeTiles }, and everything generic - choosing which
// family to ask, the verify-and-retry loop, rendering an item by its `kind` -
// lives here, so adding a family never means editing a chain of if/else.
// Loaded before iq-visual.js, which registers the families.
//
// Result shape (returned by generate): { items[4], oddIndex, family, variant,
// structureKey, explanation }. Every item carries `kind` = its family key,
// which is what iqOddRenderItem dispatches on.

const IQ_ODD_FAMILIES = [];
// Variants, per family: { key, generate(tier), minTier, enabled } (see iqOddRegisterVariants).
// A family that registers no variants is unaffected by everything below.
const IQ_ODD_VARIANTS = {};
// Variety: the next question never uses the family of the previous one, and a family never repeats its
// previous design, whenever another choice exists. `IQ_ODD_AVOID_REPEAT` can be switched off (tests that
// compare seeded sequences with an older build do so inside their sandbox).
let IQ_ODD_AVOID_REPEAT = true;
const IQ_ODD_LAST = { family: null, variants: {} };

// Registration is checked once, at load time, so a malformed family fails loudly
// there instead of silently never being asked (or crashing on a child's screen).
// `minTier` and `enabled` may be omitted (defaults 1 / true), but if the property
// is present - even as undefined - it must be valid.
function iqOddRegisterFamily(def){
  if (!def || typeof def !== 'object') throw new Error('iqOddRegisterFamily: expected a definition object.');
  if (typeof def.key !== 'string' || !def.key.trim()) throw new Error('iqOddRegisterFamily: "key" must be a non-empty string.');
  ['generate', 'verify', 'render'].forEach(field => {
    if (typeof def[field] !== 'function') throw new Error('iqOddRegisterFamily "' + def.key + '": "' + field + '" must be a function.');
  });
  if ('minTier' in def && !Number.isFinite(def.minTier)) throw new Error('iqOddRegisterFamily "' + def.key + '": "minTier" must be a finite number.');
  if ('maxTier' in def && !(Number.isFinite(def.maxTier) || def.maxTier === Infinity)) throw new Error('iqOddRegisterFamily "' + def.key + '": "maxTier" must be a number.');
  if ('enabled' in def && typeof def.enabled !== 'boolean') throw new Error('iqOddRegisterFamily "' + def.key + '": "enabled" must be a boolean.');
  if ('largeTiles' in def && typeof def.largeTiles !== 'boolean') throw new Error('iqOddRegisterFamily "' + def.key + '": "largeTiles" must be a boolean.');
  if (IQ_ODD_FAMILIES.some(f => f.key === def.key)) throw new Error('iqOddRegisterFamily: duplicate family "' + def.key + '"');
  IQ_ODD_FAMILIES.push(Object.assign({ minTier: 1, maxTier: Infinity, enabled: true, largeTiles: false }, def));
}

// A generator's result must be well-formed BEFORE it is verified: the verifier
// dispatches on result.family and assumes the shape. A malformed result is a
// generator defect, not a rare unlucky draw, so it throws at once - no retry
// (which would hide the defect), no repair, no switching to another family.
function iqOddAssertValidResult(result, family){
  const fail = why => { throw new Error('iqOddGenerate: family "' + family.key + '" returned an invalid result: ' + why + '.'); };
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail('not an object');
  if (result.family !== family.key) fail('result.family is ' + JSON.stringify(result.family) + ', expected "' + family.key + '"');
  // A family that has registered variants may only deliver results of a registered AND enabled one,
  // so a disabled variant cannot reach a player through any path.
  if (Object.prototype.hasOwnProperty.call(IQ_ODD_VARIANTS, family.key)){
    const variant = IQ_ODD_VARIANTS[family.key].find(v => v.key === result.variant);
    if (!variant) fail('variant ' + JSON.stringify(result.variant) + ' is not a registered variant of this family');
    if (!variant.enabled) fail('variant "' + variant.key + '" is not enabled');
  }
  if (!Array.isArray(result.items) || result.items.length !== 4) fail('items must be an array of exactly 4');
  result.items.forEach((item, i) => {
    if (!item || typeof item !== 'object') fail('item ' + i + ' is not an object');
    if (item.kind !== family.key) fail('item ' + i + ' has kind ' + JSON.stringify(item.kind) + ', expected "' + family.key + '"');
  });
  if (!Number.isInteger(result.oddIndex) || result.oddIndex < 0 || result.oddIndex > 3) fail('oddIndex must be an integer from 0 to 3');
  if (typeof result.explanation !== 'string' || !result.explanation.trim()) fail('explanation must be a non-empty string');
}

function iqOddFamily(key){
  const family = IQ_ODD_FAMILIES.find(f => f.key === key);
  if (!family) throw new Error('iqOdd: unknown family "' + key + '"');
  return family;
}

// A family with several question designs ("variants") registers them ONCE, after the
// family itself: iqOddRegisterVariants('ratio', [{ key, generate(tier), minTier?, enabled? }]).
// Omitted `minTier` means 1; omitted `enabled` means FALSE - a variant is only live when it
// says so explicitly (variants that are already part of the working game register
// with enabled: true; new ones stay off until they are reviewed and switched on).
// The objects stay mutable so tests and review sheets can switch variants on in a sandbox.
function iqOddRegisterVariants(familyKey, list){
  if (typeof familyKey !== 'string' || !familyKey.trim()) throw new Error('iqOddRegisterVariants: family key must be a non-empty string.');
  iqOddFamily(familyKey); // throws a clear "unknown family" error
  if (Object.prototype.hasOwnProperty.call(IQ_ODD_VARIANTS, familyKey)) throw new Error('iqOddRegisterVariants "' + familyKey + '": variants are already registered for this family.');
  if (!Array.isArray(list) || !list.length) throw new Error('iqOddRegisterVariants "' + familyKey + '": a non-empty array of variants is required.');
  const seen = new Set();
  const entries = list.map((def, i) => {
    if (!def || typeof def !== 'object') throw new Error('iqOddRegisterVariants "' + familyKey + '": variant ' + i + ' is not an object.');
    if (typeof def.key !== 'string' || !def.key.trim()) throw new Error('iqOddRegisterVariants "' + familyKey + '": variant ' + i + ': "key" must be a non-empty string.');
    if (seen.has(def.key)) throw new Error('iqOddRegisterVariants "' + familyKey + '": duplicate variant "' + def.key + '".');
    seen.add(def.key);
    const where = 'iqOddRegisterVariants "' + familyKey + '" variant "' + def.key + '": ';
    if (typeof def.generate !== 'function') throw new Error(where + '"generate" must be a function.');
    if ('minTier' in def && !Number.isFinite(def.minTier)) throw new Error(where + '"minTier" must be a finite number.');
    if ('enabled' in def && typeof def.enabled !== 'boolean') throw new Error(where + '"enabled" must be a boolean.');
    return Object.assign({ minTier: 1, enabled: false }, def);
  });
  IQ_ODD_VARIANTS[familyKey] = entries; // only after every entry validated, so a failure registers nothing
}

// Picks among the enabled variants unlocked at this tier. With exactly ONE eligible
// variant no randomness is consumed, so registering extra (disabled or locked)
// variants never changes a seeded sequence.
function iqOddPickVariant(familyKey, tier){
  if (!Object.prototype.hasOwnProperty.call(IQ_ODD_VARIANTS, familyKey)) throw new Error('iqOddPickVariant: no variants registered for family "' + familyKey + '".');
  const eligible = IQ_ODD_VARIANTS[familyKey].filter(v => v.enabled && v.minTier <= tier);
  if (!eligible.length) throw new Error('iqOddPickVariant: no enabled variant for family "' + familyKey + '" at tier ' + tier + '.');
  const fresh = IQ_ODD_AVOID_REPEAT ? eligible.filter(v => v.key !== IQ_ODD_LAST.variants[familyKey]) : eligible;
  const pool = fresh.length ? fresh : eligible;
  return pool.length === 1 ? pool[0] : pickOne(pool);
}

// Recomputes which option(s) break the family's rule (see each family's verify).
function iqOddVerifyExactlyOneOdd(result){
  return iqOddFamily(result.family).verify(result);
}

function iqOddGenerate(tier){
  // The RULE FAMILY is randomized on every single question - never locked to the
  // tier - so a run of questions at the same level never repeats the same
  // underlying logic five times in a row. The tier only scales each family's
  // OWN internal difficulty knob, so "same level" still means "equally hard",
  // just via whichever rule got picked this time.
  const eligible = IQ_ODD_FAMILIES.filter(f => f.enabled && f.minTier <= tier && tier <= f.maxTier);
  if (!eligible.length) throw new Error('iqOddGenerate: no enabled family for tier ' + tier + '.');
  const fresh = IQ_ODD_AVOID_REPEAT ? eligible.filter(f => f.key !== IQ_ODD_LAST.family) : eligible;
  const family = pickOne(fresh.length ? fresh : eligible);
  let result, guard = 0;
  do {
    result = family.generate(tier);
    iqOddAssertValidResult(result, family);
    guard++;
  } while (guard < 10 && !iqOddVerifyExactlyOneOdd(result));
  if (!iqOddVerifyExactlyOneOdd(result)){
    // Clear, loud failure instead of silently handing the player an ambiguous
    // question - this should be unreachable with a verified-chiral base shape
    // and working ratio/symmetry generators, so reaching it means something
    // regressed and needs fixing, not a case to paper over.
    throw new Error('iqOddGenerate: failed to produce a valid "' + family.key + '" question after ' + guard + ' attempts (tier ' + tier + ').');
  }
  IQ_ODD_LAST.family = result.family;
  if (result.variant) IQ_ODD_LAST.variants[result.family] = result.variant;
  return result;
}

function iqOddRenderItem(item){
  return iqOddFamily(item.kind).render(item);
}
