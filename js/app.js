// Boot + hash router + tab bar.
import { h, icon, toast, closeModals } from './ui.js';
import { app, initState, applyTheme } from './state.js';
import * as rest from './timer.js';
import { leaveView, disposeTree, latestRunner, revertDelta } from './lifecycle.js';

const TABS = [
  ['#/today', 'Today', 'today'],
  ['#/log', 'Log', 'log'],
  ['#/plans', 'Plans', 'plans'],
  ['#/progress', 'Progress', 'progress'],
  ['#/settings', 'Settings', 'settings'],
];

// route pattern → lazy view module. Each module exports `render(params) => Promise<Node>`.
const ROUTES = [
  [/^#\/today$/, () => import('./views/today.js')],
  [/^#\/log$/, () => import('./views/log.js')],
  [/^#\/plans$/, () => import('./views/plans.js')],
  [/^#\/plan\/([^/]+)$/, () => import('./views/plan-detail.js')],
  [/^#\/plan-edit\/([^/]+)$/, () => import('./views/plan-edit.js')],
  [/^#\/progress$/, () => import('./views/progress.js')],
  [/^#\/exercise\/([^/]+)$/, () => import('./views/exercise.js')],
  [/^#\/session\/([^/]+)(?:\/(new))?$/, () => import('./views/session.js')],
  [/^#\/library$/, () => import('./views/library.js')],
  [/^#\/body$/, () => import('./views/body.js')],
  [/^#\/settings$/, () => import('./views/settings.js')],
];

const runLatest = latestRunner();
let renderedHash = location.hash || '#/today';
let renderedIdx = -1;        // history index of the entry currently on screen (stored in history.state)
let revertPending = false;   // the next hashchange is our own step back after a blocked navigation
function route() {
  const hash = location.hash || '#/today';
  if (revertPending && hash === renderedHash) { revertPending = false; return Promise.resolve(); }
  return runLatest(async current => {
    try { await leaveView(); }
    catch (e) {
      // Step back to the entry still on screen rather than rewriting the new one,
      // which would leave a duplicate entry and make the next Back tap do nothing.
      const delta = revertDelta(history.state, renderedIdx);
      if (delta) { revertPending = true; history.go(delta); }
      toast('Your changes could not be saved. Retry or export before leaving.', { ms: 6000 });
      return;
    }
    if (!current()) return;
    closeModals();
    const root = document.getElementById('app');
    const match = ROUTES.find(([re]) => re.test(hash));
    if (!match) { location.replace('#/today'); return; }
    try {
      const params = hash.match(match[0]).slice(1).map(v => v == null ? v : decodeURIComponent(v));
      const mod = await match[1]();
      if (!current()) return;
      const node = await mod.render(...params);
      if (!current()) { await leaveView(); disposeTree(node); return; }
      disposeTree(root);
      root.replaceChildren(node);
      renderedHash = hash;
      renderedIdx = Number.isInteger(history.state?.idx) ? history.state.idx : renderedIdx + 1;
      if (history.state?.idx !== renderedIdx) history.replaceState({ ...(history.state || {}), idx: renderedIdx }, '', location.href);
      await updateTabs(hash);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      if (!current()) return;
      await leaveView().catch(() => {});
      disposeTree(root);
      root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, 'Something went wrong'), h('p', {}, String(e.message || e))));
    }
  });
}

export async function updateTabs(hash = location.hash) {
  const draft = await app.db.kvGet('draft', null);
  document.body.classList.toggle('logging', !!draft);
  if (hash !== (location.hash || '#/today')) return;
  const nav = document.getElementById('tabs');
  nav.replaceChildren(...TABS.map(([href, label, ic]) => {
    const active = hash.startsWith(href) ||
      (href === '#/plans' && /^#\/plan/.test(hash)) ||
      (href === '#/progress' && /^#\/(exercise|session|body)/.test(hash));
    return h('a', { href, 'aria-current': active ? 'page' : null }, icon(ic),
      href === '#/log' && draft ? h('i', { class: 'dot', 'aria-label': 'workout in progress' }) : null, label);
  }));
}

// ── Offline / install support ──
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const offerUpdate = w => {
      const bar = h('button', { class: 'update-bar', onClick: () => { bar.disabled = true; w.postMessage('SKIP_WAITING'); } },
        'Update ready — tap to reload');
      document.body.append(bar);
    };
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w); });
    });
    // check for a new version when the app comes back to the foreground
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(e => console.warn('Service worker registration failed', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (reloading) return;
    reloading = true;
    try { await leaveView(); location.reload(); }
    catch { reloading = false; toast('Update downloaded. Save or export your workout before reloading.', { ms: 6000 }); }
  });
}

/** Ask the browser not to evict our data (important on iOS). Granted silently for installed apps on most browsers. */
export async function requestPersistence() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

async function boot() {
  await initState();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  await rest.restore();
  if (app.db.kind === 'memory') document.body.prepend(h('div', { class: 'storage-warning', role: 'alert' }, 'Temporary storage only: your workouts will be lost when this app closes. Export a backup before leaving.'));
  window.addEventListener('hashchange', route);
  await route();
  registerSW();
  if ((await app.db.all('sessions')).length && navigator.storage?.persisted && !(await navigator.storage.persisted())) requestPersistence();
}

boot().catch(e => {
  document.getElementById('app').replaceChildren(h('div', { class: 'empty' }, h('h1', {}, 'Storage could not be opened'), h('p', {}, e.message), h('p', {}, 'Your stored data has not been reset. Close other LiftLog windows and retry.'), h('button', { class: 'btn primary', onClick: () => location.reload() }, 'Retry')));
});
