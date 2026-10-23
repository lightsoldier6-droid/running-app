// Carica gli script di RunPlan in un contesto Node isolato, con un DOM finto che assorbe
// tutto (getElementById, addEventListener...), così si possono testare i calcoli senza browser.
// init.js non viene caricato: avvierebbe il rendering.
// le date delle corse sono in ora locale italiana: i test devono dare lo stesso risultato ovunque girino
process.env.TZ = 'Europe/Rome';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function fake() {
  const f = function () { return proxy; };
  const proxy = new Proxy(f, {
    get(_, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (k === 'forEach' || k === 'addEventListener' || k === 'removeEventListener') return () => {};
      if (k === 'length') return 0;
      if (k === 'value' || k === 'textContent' || k === 'innerHTML') return '';
      if (k === 'then') return undefined; // non è una Promise
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
  });
  return proxy;
}

function loadApp({ now = '2026-10-23T15:00:00+02:00', storage = {} } = {}) {
  const store = new Map(Object.entries(storage).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k), clear: () => store.clear(), key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const T = new Date(now).getTime();
  class FixedDate extends Date { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  const dom = fake();
  const firebase = { initializeApp() {}, auth: () => ({ onAuthStateChanged() {}, currentUser: null }),
    firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ onSnapshot: () => () => {}, set: async () => {} }) }) }), { FieldValue: { serverTimestamp: () => 0 } }) };
  const ctx = { console, localStorage, sessionStorage: localStorage, firebase, document: dom, navigator: {}, location: { reload() {} },
    Date: FixedDate, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, alert() {}, confirm: () => true,
    Math, JSON, TextDecoder, TextEncoder, DataView, ArrayBuffer, Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array,
    BigInt, Intl, URL, Blob: class {}, fetch: async () => { throw new Error('offline'); }, requestAnimationFrame: () => 0 };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="((?:data|gym-bridge|js\/[a-z-]+)\.js)"><\/script>/g)].map(m => m[1]).filter(f => f !== 'js/init.js');
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return { ctx, run: code => vm.runInContext(code, ctx), store, files };
}

module.exports = { loadApp, ROOT };
