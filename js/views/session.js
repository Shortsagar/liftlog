// Session detail / post-workout summary.
import { h, icon, pageHead, fmtDate, fmtDuration, confirmDialog, toast } from '../ui.js';
import { app, go } from '../state.js';
import { byId } from '../../data/exercises.js';
import { sessionVolume, setLabel, prLabel, toDisplay } from '../model.js';
import { getSession, deleteSession } from '../repo.js';
import { celebratePRs } from '../celebrate.js';

export async function render(id, isNew) {
  const s = await getSession(id);
  if (!s) return h('div', {}, pageHead('Not found', { back: '#/progress' }), h('p', { class: 'empty' }, 'This workout no longer exists.'));
  const unit = app.settings.unit;
  const prs = s.prs || [];
  const prSet = new Set(prs.map(p => p.exId));
  const vol = Math.round(toDisplay(sessionVolume(s), unit));
  const setCount = s.exercises.reduce((a, e) => a + e.sets.length, 0);

  if (isNew) setTimeout(() => celebratePRs(prs.filter((p, i, a) => a.findIndex(q => q.exId === p.exId) === i).map(p => `New PR · ${prLabel(p, unit)}`)), 250);

  return h('div', {},
    pageHead(isNew ? 'Workout saved' : s.name, { back: isNew ? '#/today' : '#/progress' }),
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', {}, s.name), prs.length ? h('span', { class: 'chip accent' }, icon('trophy', { width: 14, height: 14 }), `${prSet.size} PR${prSet.size > 1 ? 's' : ''}`) : null),
      h('p', { class: 'muted small', style: { margin: '4px 0 12px' } }, fmtDate(s.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        ' · ', new Date(s.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('b', {}, fmtDuration(s.durationSec || 0)), h('span', {}, 'Duration')),
        h('div', { class: 'stat' }, h('b', {}, vol.toLocaleString()), h('span', {}, `Volume (${unit})`)),
        h('div', { class: 'stat' }, h('b', {}, setCount), h('span', {}, 'Sets')))),
    prs.length ? h('div', { class: 'card' }, h('h3', {}, 'Personal records'),
      h('ul', { style: { margin: '8px 0 0', paddingLeft: '18px' } }, ...prs.map(p => h('li', {}, prLabel(p, unit))))) : null,
    ...s.exercises.map(e => {
      const ex = byId(e.exId);
      return h('a', { class: 'card tap', href: `#/exercise/${e.exId}`, style: { display: 'block', textDecoration: 'none', color: 'inherit' } },
        h('div', { class: 'row between' }, h('h3', {}, ex?.name || e.exId), prSet.has(e.exId) ? h('span', { class: 'chip accent' }, 'PR') : null),
        h('ol', { class: 'tnum', style: { margin: '8px 0 0', paddingLeft: '22px' } }, ...e.sets.map(st => h('li', {}, setLabel(e.exId, st, unit)))),
        e.notes ? h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, e.notes) : null);
    }),
    s.notes ? h('div', { class: 'card' }, h('h3', {}, 'Notes'), h('p', { style: { margin: '6px 0 0' } }, s.notes)) : null,
    isNew ? h('a', { class: 'btn primary block lg', href: '#/today', style: { marginTop: '16px' } }, 'Done') : null,
    !isNew ? h('button', { class: 'btn ghost danger block', style: { marginTop: '16px' }, onClick: async () => {
      if (!await confirmDialog('Delete this workout from your history? This cannot be undone.', { ok: 'Delete', danger: true })) return;
      await deleteSession(s.id); toast('Workout deleted'); go('#/progress');
    } }, icon('trash'), 'Delete workout') : null);
}
