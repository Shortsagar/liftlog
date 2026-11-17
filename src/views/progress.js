import { disposeTree } from '../lifecycle.js';
// Progress tab: overview (week, plan, volume, body), history, exercises.
import { h, icon, pageHead, fmtDate, fmtDuration } from '../ui.js';
import { app } from '../state.js';
import { byId } from '../../database/exercises.js';
import { allSessions } from '../repo.js';
import { activeContext } from '../plan-store.js';
import { progress as planProgress } from '../plans.js';
import { weeklySummary, sessionVolume, toDisplay, setLabel } from '../model.js';
import { weeklyVolumes, exercisesSummary, bestEver } from '../progress.js';
import { barChart, tableView } from '../chart.js';

let tab = 'overview';
const compact = n => (n >= 10000 ? `${+(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : Math.round(n).toLocaleString());
const w1 = (kg, unit) => Math.round(toDisplay(kg, unit) * 10) / 10;

export async function render() {
  const [sessions, ctx, bw] = await Promise.all([allSessions(), activeContext(), app.db.all('bodyweight')]);
  const body = h('div');
  const tabs = h('div', { class: 'seg seg-block', role: 'tablist', 'aria-label': 'Progress sections' });
  const draw = () => {
    tabs.replaceChildren(...[['overview', 'Overview'], ['history', 'History'], ['exercises', 'Exercises']].map(([k, label]) =>
      h('button', { role: 'tab', 'aria-selected': String(tab === k), 'aria-pressed': String(tab === k), onClick: () => { tab = k; draw(); } }, label)));
    disposeTree(body);
    body.replaceChildren(tab === 'overview' ? overview(sessions, ctx, bw) : tab === 'history' ? history(sessions) : exercises(sessions));
  };
  draw();
  return h('div', {}, pageHead('Progress'), tabs, body);
}

function overview(sessions, ctx, bw) {
  const unit = app.settings.unit;
  const wk = weeklySummary(sessions);
  const vols = weeklyVolumes(sessions, Date.now(), 8);
  const volChart = h('div');
  barChart(volChart, {
    bars: vols.map((v, i) => ({
      label: i === vols.length - 1 ? 'This wk' : fmtDate(v.weekStart, { month: 'short', day: 'numeric' }),
      y: Math.round(toDisplay(v.volumeKg, unit)),
      highlight: i === vols.length - 1,
      tipTitle: `Week of ${fmtDate(v.weekStart, { month: 'short', day: 'numeric' })}`,
      tipLines: [['Volume', `${Math.round(toDisplay(v.volumeKg, unit)).toLocaleString()} ${unit}`], ['Workouts', String(v.workouts)]],
    })),
    yFmt: compact,
  });
  const pr = ctx ? planProgress(ctx.plan, ctx.active) : null;
  const lastBw = [...bw].sort((a, b) => b.date - a.date)[0];

  return h('div', {},
    h('div', { class: 'section-title' }, 'This week'),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' }, h('b', {}, wk.workouts), h('span', {}, 'Workouts')),
      h('div', { class: 'stat' }, h('b', {}, compact(toDisplay(wk.volumeKg, unit))), h('span', {}, `Volume (${unit})`)),
      h('div', { class: 'stat' }, h('b', {}, wk.streakWeeks, icon('flame', { class: 'stat-ic' })), h('span', {}, `Week streak`))),
    pr ? h('a', { class: 'card tap', href: `#/plan/${encodeURIComponent(ctx.plan.id)}`, style: { display: 'block', textDecoration: 'none', color: 'inherit', marginTop: '12px' } },
      h('div', { class: 'row between' }, h('h3', {}, ctx.plan.name), h('span', { class: 'small muted tnum' }, `${pr.done}/${pr.total} workouts done`)),
      h('div', { class: 'small', style: { margin: '6px 0' } }, ctx.active.completedAt ? 'Plan complete' : `Week ${pr.week} of ${pr.totalWeeks}`),
      h('div', { class: 'progress-bar' }, h('i', { style: { width: `${Math.round(pr.pct * 100)}%` } }))) : null,
    h('div', { class: 'section-title' }, `Weekly volume (${unit})`),
    h('div', { class: 'card' }, volChart,
      tableView(['Week of', 'Workouts', `Volume (${unit})`], vols.map(v => [fmtDate(v.weekStart, { month: 'short', day: 'numeric' }), v.workouts, Math.round(toDisplay(v.volumeKg, unit)).toLocaleString()]))),
    h('div', { class: 'section-title' }, 'Body weight'),
    h('a', { class: 'card tap row between', href: '#/body', style: { textDecoration: 'none', color: 'inherit' } },
      h('div', {}, lastBw ? h('b', { class: 'tnum', style: { fontSize: '1.3rem' } }, `${w1(lastBw.kg, unit)} ${unit}`) : h('b', {}, 'Log your weight'),
        h('div', { class: 'small muted' }, lastBw ? `Last logged ${fmtDate(lastBw.date)}` : 'Track your trend over time')),
      icon('chevron', { width: 20, height: 20, class: 'muted' })),
    sessions.length ? null : h('div', { class: 'card empty', style: { marginTop: '12px' } }, 'Finish a workout to see your progress here. Want to look around first? Load sample data in Settings.'));
}

function history(sessions) {
  if (!sessions.length) return h('div', { class: 'card empty', style: { marginTop: '12px' } }, 'No workouts yet.');
  const unit = app.settings.unit;
  const list = h('div');
  let shown = 0, lastMonth = '';
  const more = h('button', { class: 'btn block', style: { marginTop: '12px' } }, 'Show more');
  const add = () => {
    const chunk = sessions.slice(shown, shown + 25);
    let card = list.lastElementChild?.classList.contains('list') ? list.lastElementChild : null;
    for (const s of chunk) {
      const m = fmtDate(s.date, { month: 'long', year: 'numeric' });
      if (m !== lastMonth) { lastMonth = m; list.append(h('div', { class: 'section-title' }, m)); card = h('div', { class: 'card list', style: { padding: '0 16px' } }); list.append(card); }
      card.append(h('a', { class: 'list-item', href: `#/session/${s.id}`, style: { textDecoration: 'none', color: 'inherit' } },
        h('div', { class: 'date-badge' }, h('b', {}, new Date(s.date).getDate()), h('span', {}, fmtDate(s.date, { weekday: 'short' }))),
        h('div', { class: 'grow' }, h('b', {}, s.name),
          h('div', { class: 'small muted tnum' }, `${fmtDuration(s.durationSec || 0)} · ${Math.round(toDisplay(sessionVolume(s), unit)).toLocaleString()} ${unit} · ${s.exercises.length} exercise${s.exercises.length === 1 ? "" : "s"}`)),
        s.prs?.length ? h('span', { class: 'chip accent' }, icon('trophy', { width: 12, height: 12 }), new Set(s.prs.map(p => p.exId)).size) : null,
        icon('chevron', { width: 18, height: 18, class: 'muted' })));
    }
    shown += chunk.length;
    more.classList.toggle('hidden', shown >= sessions.length);
  };
  more.addEventListener('click', add);
  add();
  return h('div', {}, list, more);
}

function exercises(sessions) {
  const sum = exercisesSummary(sessions);
  if (!sum.length) return h('div', { class: 'card empty', style: { marginTop: '12px' } }, 'Exercises you log will appear here.');
  const unit = app.settings.unit;
  return h('div', { class: 'card list', style: { padding: '0 16px', marginTop: '12px' } }, ...sum.map(x => {
    const ex = byId(x.exId);
    const best = bestEver(sessions, x.exId);
    const bestTxt = ex && (ex.bodyweight || ex.metric === 'seconds')
      ? setLabel(x.exId, { w: 0, r: best.reps.value }, unit)
      : `${toDisplay(best.weight.value, unit)} ${unit} · e1RM ${Math.round(toDisplay(best.e1rm.value, unit))}`;
    return h('a', { class: 'list-item', href: `#/exercise/${x.exId}`, style: { textDecoration: 'none', color: 'inherit' } },
      h('div', { class: 'grow' }, h('b', {}, ex?.name || x.exId),
        h('div', { class: 'small muted tnum' }, `Best ${bestTxt} · ${x.count} session${x.count > 1 ? 's' : ''}`)),
      icon('chevron', { width: 18, height: 18, class: 'muted' }));
  }));
}
