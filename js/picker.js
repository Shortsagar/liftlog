// Exercise picker sheet with search.
import { h, modal } from './ui.js';
import { EXERCISES, muscleLabel } from '../data/exercises.js';

const EQUIP = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', bodyweight: 'Bodyweight' };

export function pickExercise({ title = 'Choose exercise', exclude = [] } = {}) {
  return new Promise(resolve => {
    let chosen = null;
    const list = h('div', { class: 'list' });
    const input = h('input', { class: 'input', type: 'search', placeholder: 'Search exercises or muscles', 'aria-label': 'Search exercises' });
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const items = EXERCISES.filter(e => !exclude.includes(e.id)).filter(e => !q ||
        e.name.toLowerCase().includes(q) || [...e.primary, ...e.secondary].some(m => muscleLabel(m).toLowerCase().includes(q)) ||
        e.equipment.includes(q));
      list.replaceChildren(...(items.length ? items.map(e => h('button', { class: 'pick-item', onClick: () => { chosen = e.id; close(); } },
        h('b', {}, e.name),
        h('span', { class: 'small muted' }, `${e.primary.map(muscleLabel).join(', ')} · ${EQUIP[e.equipment]}`))) : [h('p', { class: 'empty' }, 'No matches')]));
    };
    input.addEventListener('input', draw);
    draw();
    const close = modal(h('div', {}, h('div', { class: 'search' }, input), list), { title, onClose: () => resolve(chosen) });
    setTimeout(() => input.focus(), 50);
  });
}
