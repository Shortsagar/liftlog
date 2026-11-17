// Today: resume an in-progress workout, today's plan day, quick start, recent sessions.
import { h, icon, fmtDate } from '../ui.js';
import { app } from '../state.js';
import { allSessions, getDraft, startWorkout } from '../repo.js';
import { sessionVolume, toDisplay } from '../model.js';
import { byId } from '../../data/exercises.js';
import { activeContext, startPlanDay, skipDay } from '../plan-store.js';
import { progress } from '../plans.js';
import { go } from '../state.js';

function planCard(ctx, hasDraft) {
  const { plan, active, today } = ctx;
  const pr = progress(plan, active);
  const bar = h('div', { style: { margin: '10px 0 14px' } },
    h('div', { class: 'row between small', style: { marginBottom: '6px' } },
      h('span', {}, active.completedAt ? 'All weeks done' : `Week ${pr.week} of ${pr.totalWeeks}`),
      h('span', { class: 'muted tnum' }, `${pr.done}/${pr.total} workouts done`)),
    h('div', { class: 'progress-bar' }, h('i', { style: { width: `${Math.round(pr.pct * 100)}%` } })));
  if (!today) {
    return h('div', { class: 'card today-plan' },
      h('div', { class: 'small muted' }, plan.name), h('h2', {}, 'Plan complete!'), bar,
      h('a', { class: 'btn block', href: '#/plans' }, 'Pick your next plan'));
  }
  const d = today.dayDef;
  return h('div', { class: 'card today-plan' },
    h('div', { class: 'row between' },
      h('div', {}, h('div', { class: 'small', style: { color: 'var(--accent)', fontWeight: 700 } }, "TODAY'S WORKOUT"), h('h2', {}, d.name)),
      h('a', { class: 'chip', href: `#/plan/${encodeURIComponent(plan.id)}` }, plan.name)),
    bar,
    h('ul', { class: 'plan-ex' }, ...d.exercises.map(e => h('li', {},
      h('span', {}, byId(e.exId)?.name || e.exId), h('span', { class: 'muted tnum' }, `${e.sets} × ${e.reps}`)))),
    hasDraft ? null : h('button', { class: 'btn primary block lg', onClick: () => startPlanDay(plan, today.week, today.day) }, icon('play'), 'Start workout'),
    hasDraft ? null : h('button', { class: 'btn ghost block sm', style: { marginTop: '6px' }, onClick: async () => { await skipDay(); go('#/today'); } }, 'Skip this day'));
}

function backupNudge(sessions) {
  const last = app.settings.lastBackupAt;
  if (sessions.filter(s => !s.sample).length < 5 || (last && Date.now() - last < 30 * 86400e3)) return null;
  return h('a', { class: 'card tap backup-nudge row', href: '#/settings', style: { textDecoration: 'none', color: 'inherit', marginTop: '12px' } },
    icon('download', { width: 22, height: 22, style: 'color: var(--warn); flex: none' }),
    h('div', { class: 'grow' }, h('b', {}, last ? 'Time for a backup' : 'Back up your workouts'),
      h('div', { class: 'small muted' }, 'Your history lives only on this phone. Export a copy in Settings.')),
    icon('chevron', { width: 18, height: 18, class: 'muted' }));
}

export async function render() {
  const [draft, sessions, ctx] = await Promise.all([getDraft(), allSessions(), activeContext()]);
  const unit = app.settings.unit;
  const greet = (() => { const hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; })();

  return h('div', {},
    h('header', { class: 'page-head' },
      h('div', {}, h('div', { class: 'muted small' }, fmtDate(Date.now(), { weekday: 'long', month: 'long', day: 'numeric' })), h('h1', {}, greet))),
    draft ? h('a', { class: 'card tap', href: '#/log', style: { display: 'block', textDecoration: 'none', color: 'inherit', borderColor: 'var(--accent)' } },
      h('div', { class: 'row between' },
        h('div', {}, h('div', { class: 'small', style: { color: 'var(--accent)', fontWeight: 700 } }, 'IN PROGRESS'), h('h2', {}, draft.name)),
        h('span', { class: 'btn primary sm' }, 'Resume'))) : null,
    ctx ? planCard(ctx, !!draft) : h('a', { class: 'card tap', href: '#/plans', style: { display: 'block', textDecoration: 'none', color: 'inherit' } },
      h('h2', {}, 'Pick a plan'),
      h('p', { class: 'muted small', style: { margin: '4px 0 0' } }, 'Follow a free structured program day by day: Full Body, PPL, Upper/Lower, 5×5 or Dumbbell Home.')),
    !draft ? h('div', { class: 'card' },
      h('h2', {}, ctx ? 'Something different?' : 'Quick start'),
      h('p', { class: 'muted small', style: { margin: '4px 0 12px' } }, 'Log a one-off workout and add exercises as you go.'),
      h('button', { class: `btn ${ctx ? '' : 'primary'} block`, onClick: () => startWorkout({ name: 'Workout', exercises: [] }) }, icon('plus'), 'Start empty workout')) : null,
    backupNudge(sessions),
    h('div', { class: 'section-title' }, 'Recent'),
    sessions.length ? h('div', { class: 'card list', style: { padding: '0 16px' } },
      ...sessions.slice(0, 3).map(s => h('a', { class: 'list-item', href: `#/session/${s.id}`, style: { textDecoration: 'none', color: 'inherit' } },
        h('div', { class: 'grow' }, h('b', {}, s.name), h('div', { class: 'small muted' }, fmtDate(s.date), ' · ', `${Math.round(toDisplay(sessionVolume(s), unit)).toLocaleString()} ${unit}`)),
        s.prs?.length ? h('span', { class: 'chip accent' }, 'PR') : null,
        icon('chevron', { width: 18, height: 18, class: 'muted' }))))
      : h('div', { class: 'card empty' }, 'No workouts yet. Your history will show up here.'));
}
