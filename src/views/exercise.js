// Per-exercise progress: bests, chart of top-set weight + estimated 1RM, PR history, recent sessions.
import { h, icon, pageHead, fmtDate } from '../ui.js';
import { app } from '../state.js';
import { byId } from '../../database/exercises.js';
import { allSessions } from '../repo.js';
import { toDisplay, setLabel, prLabel, repsBased } from '../model.js';
import { exerciseSeries, bestEver } from '../progress.js';
import { lineChart, tableView } from '../chart.js';
import { mountDemo } from '../demo.js';

const fmt1 = v => String(Math.round(v * 10) / 10);

export async function render(exId) {
  const ex = byId(exId);
  if (!ex) return h('div', {}, pageHead('Unknown exercise', { back: '#/progress' }));
  const unit = app.settings.unit;
  const sessions = await allSessions();
  const series = exerciseSeries(sessions, exId);
  const best = bestEver(sessions, exId);
  const rb = repsBased(exId);
  const metric = ex.metric === 'seconds' ? 'seconds' : 'reps';

  const demo = h('div', { class: 'card' });
  mountDemo(demo, ex);

  if (!series.length) {
    return h('div', {}, pageHead(ex.name, { back: '#/progress' }), demo,
      h('div', { class: 'card empty' }, `No ${ex.name} sets logged yet. Your chart and PRs will appear here.`));
  }

  const chart = h('div');
  if (rb) {
    lineChart(chart, { series: [{ name: `Best ${metric}`, color: 'var(--series-2)', points: series.map(p => ({ x: p.date, y: p.reps })) }], yFmt: fmt1, unit: metric === 'seconds' ? 's' : 'reps', integer: true });
  } else {
    lineChart(chart, {
      series: [
        { name: 'Est. 1RM', color: 'var(--series-1)', points: series.map(p => ({ x: p.date, y: Math.round(toDisplay(p.e1rm, unit) * 10) / 10 })) },
        { name: 'Top set', color: 'var(--series-2)', points: series.map(p => ({ x: p.date, y: toDisplay(p.topW, unit) })) },
      ],
      yFmt: fmt1, unit,
    });
  }

  const prs = sessions.flatMap(s => (s.prs || []).filter(p => p.exId === exId).map(p => ({ ...p, date: s.date, sessionId: s.id })));
  const recent = sessions.filter(s => s.exercises.some(e => e.exId === exId)).slice(0, 8);

  return h('div', {},
    pageHead(ex.name, { back: '#/progress' }),
    h('div', { class: 'stat-grid' },
      rb ? h('div', { class: 'stat' }, h('b', {}, best.reps.value), h('span', {}, `Best ${metric}`))
        : h('div', { class: 'stat' }, h('b', {}, fmt1(toDisplay(best.weight.value, unit))), h('span', {}, `Heaviest (${unit})`)),
      rb ? h('div', { class: 'stat' }, h('b', {}, series.length), h('span', {}, 'Sessions'))
        : h('div', { class: 'stat' }, h('b', {}, Math.round(toDisplay(best.e1rm.value, unit))), h('span', {}, `Est. 1RM (${unit})`)),
      h('div', { class: 'stat' }, h('b', {}, prs.length), h('span', {}, 'PRs'))),
    h('div', { class: 'section-title' }, rb ? `Best ${metric} per session` : `Top set & estimated 1RM (${unit})`),
    h('div', { class: 'card' }, chart,
      !rb ? h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, 'Estimated 1RM uses the Epley formula: weight × (1 + reps ÷ 30).') : null,
      tableView(rb ? ['Date', metric] : ['Date', `Top set (${unit})`, `Est. 1RM (${unit})`],
        [...series].reverse().map(p => rb ? [fmtDate(p.date), p.reps] : [fmtDate(p.date), fmt1(toDisplay(p.topW, unit)), Math.round(toDisplay(p.e1rm, unit))]))),
    prs.length ? h('div', {}, h('div', { class: 'section-title' }, 'Personal records'),
      h('div', { class: 'card list', style: { padding: '0 16px' } }, ...prs.slice(0, 10).map(p => h('a', { class: 'list-item', href: `#/session/${p.sessionId}`, style: { textDecoration: 'none', color: 'inherit' } },
        icon('trophy', { width: 18, height: 18, style: 'color: var(--accent); flex: none' }),
        h('div', { class: 'grow' }, prLabel(p, unit).replace(`${ex.name}: `, '')),
        h('span', { class: 'small muted' }, fmtDate(p.date)))))) : null,
    h('div', { class: 'section-title' }, 'Recent sessions'),
    h('div', { class: 'card list', style: { padding: '0 16px' } }, ...recent.map(s => h('a', { class: 'list-item', href: `#/session/${s.id}`, style: { textDecoration: 'none', color: 'inherit' } },
      h('div', { class: 'grow' }, h('b', {}, fmtDate(s.date)),
        h('div', { class: 'small muted tnum' }, s.exercises.filter(e => e.exId === exId).flatMap(e => e.sets).map(st => setLabel(exId, st, unit)).join(' · '))),
      icon('chevron', { width: 18, height: 18, class: 'muted' })))),
    h('div', { class: 'section-title' }, 'Form'),
    demo);
}
