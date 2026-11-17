// Rest timer (bottom sheet) + beep/vibrate. State persisted in kv 'rest' as {endsAt, total}.
import { h, icon, fmtDuration, reportError } from './ui.js';
import { app } from './state.js';
import { remainingSec, adjustEnd } from './timer-core.js';

let state = null;      // {endsAt, total}
let tickId = null;
let sheet, timeEl, ringEl, labelEl;
let ctx = null;        // AudioContext
let hideTimer = null;

/** Must be called from a user gesture (iOS) so later beeps can play. */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    // play a silent blip to fully unlock on iOS
    const o = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.01);
  } catch { /* no audio */ }
}

export function beep(times = 3) {
  if (!app.settings.sound || !ctx) return;
  try {
    const t0 = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = i === times - 1 ? 1320 : 880;
      const t = t0 + i * 0.28;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.25);
    }
  } catch { /* ignore */ }
}

function buzz() {
  if (app.settings.vibrate && navigator.vibrate) { try { navigator.vibrate([250, 120, 250, 120, 400]); } catch { /* */ } }
}

const R = 20, C = 2 * Math.PI * R;
function mount() {
  if (sheet) return;
  ringEl = h('circle', { cx: 24, cy: 24, r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 4,
    'stroke-linecap': 'round', 'stroke-dasharray': C, transform: 'rotate(-90 24 24)' });
  timeEl = h('div', { class: 'time', role: 'timer', 'aria-live': 'off' }, '0:00');
  labelEl = h('div', { class: 'small muted' }, 'Rest');
  sheet = h('div', { class: 'rest-sheet', 'aria-label': 'Rest timer' },
    h('svg', { class: 'ring', viewBox: '0 0 48 48' },
      h('circle', { cx: 24, cy: 24, r: R, fill: 'none', stroke: 'var(--surface-2)', 'stroke-width': 4 }), ringEl),
    h('div', { class: 'grow' }, labelEl, timeEl),
    h('button', { class: 'btn sm', onClick: () => adjust(-15), 'aria-label': 'Subtract 15 seconds' }, '−15'),
    h('button', { class: 'btn sm', onClick: () => adjust(15), 'aria-label': 'Add 15 seconds' }, '+15'),
    h('button', { class: 'icon-btn', onClick: stop, 'aria-label': 'Skip rest' }, icon('x')));
  document.body.append(sheet);
}

function render() {
  if (!sheet) return;
  const left = remainingSec(state);
  timeEl.textContent = fmtDuration(left);
  const frac = state && state.total ? left / state.total : 0;
  ringEl.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
}

function tick() {
  if (!state) return;
  render();
  if (Date.now() >= state.endsAt) finish();
}

function finish() {
  clearInterval(tickId); tickId = null;
  state = null;
  app.db.kvSet('rest', null).catch(reportError);
  timeEl.textContent = 'Go!';
  labelEl.textContent = 'Rest over';
  sheet.classList.add('done');
  ringEl.setAttribute('stroke-dashoffset', String(C));
  beep(); buzz();
  document.body.classList.remove('flash'); void document.body.offsetWidth; document.body.classList.add('flash');
  hideTimer = setTimeout(hide, 4000);
}

function hide() { sheet?.classList.remove('show', 'done'); document.body.classList.remove('flash', 'resting'); }

function run() {
  mount();
  clearTimeout(hideTimer);
  sheet.classList.remove('done');
  labelEl.textContent = 'Rest';
  sheet.classList.add('show');
  document.body.classList.add('resting');
  render();
  clearInterval(tickId);
  tickId = setInterval(tick, 250);
}

export function start(sec = app.settings.restSec) {
  state = { endsAt: Date.now() + sec * 1000, total: sec };
  app.db.kvSet('rest', state).catch(reportError);
  run();
}

export function adjust(delta) {
  if (!state) return;
  state = adjustEnd(state, delta);
  app.db.kvSet('rest', state).catch(reportError);
  render();
}

export function stop({ persist = true } = {}) {
  clearTimeout(hideTimer);
  clearInterval(tickId); tickId = null;
  state = null;
  if (persist) app.db.kvSet('rest', null).catch(reportError);
  hide();
}

export const isRunning = () => !!state;

/** Resume a timer that was running before a reload. */
export async function restore() {
  const saved = await app.db.kvGet('rest', null);
  if (saved && saved.endsAt > Date.now()) { state = saved; run(); }
  else if (saved) app.db.kvSet('rest', null).catch(reportError);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
