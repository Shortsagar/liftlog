// Boot + hash router + tab bar.
import { h, icon } from './ui.js';
import { app, initState, applyTheme } from './state.js';
import * as rest from './timer.js';
import './plan-store.js'; // registers plan advancement on workout save

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

let cleanup = null;
export function onLeave(fn) { cleanup = fn; }

async function route() {
  const hash = location.hash || '#/today';
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const root = document.getElementById('app');
  const match = ROUTES.find(([re]) => re.test(hash));
  if (!match) { location.replace('#/today'); return; }
  const params = hash.match(match[0]).slice(1).map(v => (v == null ? v : decodeURIComponent(v)));
  try {
    const mod = await match[1]();
    const node = await mod.render(...params);
    root.replaceChildren(node);
  } catch (e) {
    console.error(e);
    root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, 'Something went wrong'), h('p', {}, String(e.message || e))));
  }
  updateTabs(hash);
  window.scrollTo(0, 0);
}

export async function updateTabs(hash = location.hash) {
  const draft = await app.db.kvGet('draft', null);
  document.body.classList.toggle('logging', !!draft);
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
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

/** Ask the browser not to evict our data (important on iOS). Granted silently for installed apps on most browsers. */
export async function requestPersistence() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

async function boot() {
  await initState();
  applyTheme();
  rest.restore();
  window.addEventListener('hashchange', route);
  await route();
  registerSW();
  if ((await app.db.all('sessions')).length && navigator.storage?.persisted && !(await navigator.storage.persisted())) requestPersistence();
}

boot();
