// Shared app state: the open store and settings. Views import from here.
import { openStore } from './db.js';

export const DEFAULT_SETTINGS = {
  unit: 'lb',          // 'lb' | 'kg'
  incLb: 5,            // weight stepper increment in lb (2.5 or 5)
  incKg: 2.5,          // weight stepper increment in kg (1.25 or 2.5)
  restSec: 90,         // default rest timer
  autoRest: true,      // start rest timer when a set is checked
  sound: true,
  vibrate: true,
  theme: 'dark',       // 'dark' | 'light' | 'system'
  showDemos: true,     // form animation on each logging card
  lastBackupAt: null,
};

export const app = { db: null, settings: { ...DEFAULT_SETTINGS } };

export async function initState(backend) {
  app.db = await openStore(backend);
  app.settings = { ...DEFAULT_SETTINGS, ...(await app.db.kvGet('settings', {})) };
  return app;
}

export async function saveSettings(patch) {
  const next = await app.db.atomic(['kv'], tx => {
    const settings = { ...DEFAULT_SETTINGS, ...tx.get('kv', 'settings')?.value, ...patch };
    tx.put('kv', { id: 'settings', value: settings });
    return settings;
  }, { keys: { kv: ['settings'] } });
  Object.assign(app.settings, next);
  applyTheme();
}

export function applyTheme() {
  if (typeof document === 'undefined') return;
  const t = app.settings.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1115' : '#f4f5f7');
}

export const weightInc = () => (app.settings.unit === 'kg' ? app.settings.incKg : app.settings.incLb);
export const go = hash => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };
