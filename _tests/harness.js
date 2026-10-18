'use strict';
// Test harness: loads the project's own scripts, UNMODIFIED, into an isolated
// `vm` context with a fake DOM and a seeded Math.random. Nothing here edits or
// wraps production files on disk; any monkey-patching (e.g. counting generator
// calls) happens inside the sandbox only and is the caller's explicit choice.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ---------- seeded randomness ----------
function mulberry32(seed){
  let a = seed | 0;
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- reading project sources (working tree or a git ref) ----------
function readSource(ref, rel){
  if (!ref) return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return execFileSync('git', ['show', ref + ':' + rel.replace(/\\/g, '/')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
// The script list and order come from index.html itself, never hardcoded here.
function listScripts(ref){
  const html = readSource(ref, 'index.html');
  return [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(m => m[1]);
}

// ---------- fake DOM ----------
// Strict by default: touching an API the fake does not implement throws, so a
// test can never silently pass on a stub that swallowed the call. `lenient`
// (used only for the "do all scripts load" check) tolerates unknown members.
class FakeEl {
  constructor(doc, tag, id){
    this.doc = doc; this.tagName = String(tag || 'div').toUpperCase(); this.id = id || '';
    this.children = []; this.parent = null; this._html = ''; this.textContent = '';
    this.style = {}; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.disabled = false;
    this.classSet = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => this.classSet.add(x)),
      remove: (...c) => c.forEach(x => this.classSet.delete(x)),
      contains: c => this.classSet.has(c),
      toggle: (c, force) => {
        const want = force === undefined ? !this.classSet.has(c) : !!force;
        if (want) this.classSet.add(c); else this.classSet.delete(c);
        return want;
      }
    };
  }
  get className(){ return [...this.classSet].join(' '); }
  set className(v){ this.classSet = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get innerHTML(){ return this._html; }
  set innerHTML(v){ this._html = String(v); this.children = []; }
  appendChild(c){ this.children.push(c); c.parent = this; return c; }
  remove(){ if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; }
  addEventListener(type, fn){ (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(){}
  click(){ (this.listeners.click || []).slice().forEach(fn => fn({ target: this })); }
  setAttribute(k, v){ this.attrs[k] = String(v); }
  getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; }
  querySelector(){ return null; }
  querySelectorAll(){ return []; }
}

function makeDocument(lenient){
  const byId = new Map();
  const wrap = el => lenient
    ? new Proxy(el, { get(t, k){ if (k in t) return t[k]; if (typeof k === 'symbol') return undefined; return () => undefined; } })
    : el;
  const doc = {
    body: null,
    getElementById(id){ if (!byId.has(id)) byId.set(id, wrap(new FakeEl(doc, 'div', id))); return byId.get(id); },
    createElement(tag){ return wrap(new FakeEl(doc, tag)); },
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; }
  };
  doc.body = wrap(new FakeEl(doc, 'body'));
  return doc;
}

function makeLocalStorage(){
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    _dump: () => Object.fromEntries(m)
  };
}

// Web Audio is irrelevant to correctness; a callable null-object absorbs it.
function nullObject(){
  const f = function(){ return p; };
  const p = new Proxy(f, {
    get(t, k){ if (k === Symbol.toPrimitive) return () => 0; if (typeof k === 'symbol') return undefined; return p; },
    set(){ return true; },
    apply(){ return p; }
  });
  return p;
}

// ---------- the loader ----------
function loadProject(opts){
  opts = opts || {};
  const ref = opts.ref || null;
  const timers = [];
  const doc = makeDocument(!!opts.lenient);
  const ls = makeLocalStorage();
  const sandbox = {
    console, document: doc, localStorage: ls,
    setTimeout: fn => { timers.push(fn); return timers.length; },
    clearTimeout(){},
    __rand: mulberry32(1)
  };
  sandbox.window = sandbox;
  sandbox.AudioContext = function(){ return nullObject(); };
  const ctx = vm.createContext(sandbox);
  // Math inside the context is the context's own intrinsic; the host's is untouched.
  vm.runInContext('Math.random = function(){ return __rand(); };', ctx);

  const scripts = opts.scripts || listScripts(ref);
  const sha = {};
  for (const rel of scripts){
    const src = readSource(ref, rel);
    sha[rel] = crypto.createHash('sha1').update(src).digest('hex').slice(0, 12);
    vm.runInContext(src, ctx, { filename: (ref || 'worktree') + ':' + rel });
  }
  return {
    ref, scripts, sha, ctx, sandbox, doc, localStorage: ls,
    seed(n){ sandbox.__rand = mulberry32(n); },
    evalIn(code){ return vm.runInContext(code, ctx); },
    flushTimers(){ const t = timers.splice(0); t.forEach(fn => fn()); }
  };
}

// ---------- repo state (so every report states what was actually tested) ----------
function gitInfo(){
  const run = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  const head = run(['rev-parse', 'HEAD']);
  const dirty = run(['status', '--porcelain']).split('\n').filter(Boolean);
  const productionDirty = dirty.filter(l => !/^\?\? _tests\/|^\?\? _tests$/.test(l));
  return { head, dirtyEntries: dirty, productionDirty };
}

module.exports = { ROOT, mulberry32, readSource, listScripts, loadProject, gitInfo, FakeEl };
