import { machineInfo } from './machines.js';
import { onDispose } from './lifecycle.js';
// Form demo block: animated figure + target muscles + cues. Tap the figure to enlarge.
import { h, icon, modal } from './ui.js';
import { muscleLabel } from '../data/exercises.js';
import { createFigure } from './figure.js';
import { app } from './state.js';

export function musclesLine(ex) {
  const p = ex.primary.map(muscleLabel).join(', ');
  const s = ex.secondary.map(muscleLabel).join(', ');
  return h('div', { class: 'small muscles' },
    h('span', { class: 'm-primary' }, h('i', { class: 'swatch p' }), 'Primary: ', h('b', {}, p || '—')),
    s ? h('span', { class: 'm-secondary' }, h('i', { class: 'swatch s' }), 'Secondary: ', s) : null);
}

function playBtn(fig) {
  const btn = h('button', { class: 'demo-play', type: 'button' });
  const sync = playing => {
    btn.replaceChildren(icon(playing ? 'pause' : 'play'));
    btn.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
  };
  btn.addEventListener('click', e => { e.stopPropagation(); fig.toggle(); });
  const prev = fig.onchange;
  fig.onchange = p => { prev && prev(p); sync(p); };
  sync(fig.playing);
  return btn;
}

export function openDemo(ex) {
  const fig = createFigure(ex, { className: 'figure-lg' });
  const close = modal(h('div', { class: 'stack' },
    fig ? h('div', { class: 'demo-stage' }, fig.el, playBtn(fig)) : null,
    machineInfo(ex.anim) ? h('p', { class: 'small machine-guide' }, h('b', {}, 'Look for: '), machineInfo(ex.anim).hint, h('span', { class: 'muted', style: { display: 'block', marginTop: '4px' } }, 'Typical machine shown; designs vary by gym.')) : null,
    musclesLine(ex),
    h('ol', { class: 'cues lg' }, ...ex.cues.map(c => h('li', {}, c))),
    h('a', { class: 'btn block', href: `#/exercise/${ex.id}`, onClick: () => close() }, 'History & progress')),
  { title: ex.name, onClose: () => fig?.destroy() });
}

/** Compact demo for the logging card. */
export function mountDemo(el, ex) {
  if (app.settings.showDemos === false || !ex.anim) { el.append(musclesLine(ex)); return; }
  const fig = createFigure(ex);
  onDispose(el, () => fig.destroy());
  const stage = h('button', { class: 'demo-fig', type: 'button', 'aria-label': `Enlarge ${ex.name} form demo`, onClick: () => openDemo(ex) }, fig.el);
  el.append(h('div', { class: 'demo' },
    h('div', { class: 'demo-figwrap' }, stage, playBtn(fig)),
    h('div', { class: 'demo-info' },
      musclesLine(ex),
      h('ul', { class: 'cues' }, ...ex.cues.map(c => h('li', {}, c))))));
}
