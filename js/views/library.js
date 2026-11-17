// Exercise library: every exercise with its form animation.
import { h, pageHead } from '../ui.js';
import { EXERCISES, muscleLabel } from '../../data/exercises.js';
import { createFigure } from '../figure.js';
import { openDemo } from '../demo.js';
import { onLeave } from '../app.js';

export async function render() {
  const figs = [];
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Search exercises or muscles', 'aria-label': 'Search exercises' });
  const grid = h('div', { class: 'lib-grid' });
  const tiles = EXERCISES.filter(ex => ex.anim).map(ex => {
    const fig = createFigure(ex);
    figs.push(fig);
    const tile = h('button', { class: 'lib-tile', type: 'button', onClick: () => openDemo(ex) },
      fig.el,
      h('b', {}, ex.name),
      h('span', { class: 'small muted' }, ex.primary.map(muscleLabel).join(', ')));
    tile.__text = `${ex.name} ${[...ex.primary, ...ex.secondary].map(muscleLabel).join(' ')} ${ex.equipment}`.toLowerCase();
    return tile;
  });
  grid.append(...tiles);
  q.addEventListener('input', () => {
    const t = q.value.trim().toLowerCase();
    for (const tile of tiles) tile.classList.toggle('hidden', !!t && !tile.__text.includes(t));
  });
  onLeave(() => figs.forEach(f => f.destroy()));
  return h('div', {}, pageHead('Exercise library', { back: '#/plans' }), h('div', { style: { marginBottom: '12px' } }, q), grid);
}
