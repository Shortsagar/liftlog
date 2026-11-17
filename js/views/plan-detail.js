// Plan detail: weeks → days → exercises; start/stop; start any day.
import { h, icon, pageHead, confirmDialog, toast } from '../ui.js';
import { go } from '../state.js';
import { byId } from '../../data/exercises.js';
import { getPlan, getActive, activate, setActive, startPlanDay, deletePlan } from '../plan-store.js';
import { progress, posKey } from '../plans.js';

export async function render(id) {
  const plan = await getPlan(id);
  if (!plan) return h('div', {}, pageHead('Plan not found', { back: '#/plans' }));
  const active = await getActive();
  const isActive = active?.planId === plan.id;
  const doneKeys = new Set(isActive ? active.done.map(posKey) : []);
  let week = isActive ? Math.min(active.week, plan.weeks.length - 1) : 0;

  const weekTabs = h('div', { class: 'week-tabs', role: 'tablist', 'aria-label': 'Weeks' });
  const daysEl = h('div');

  const drawWeek = () => {
    weekTabs.replaceChildren(...plan.weeks.map((w, i) => h('button', {
      role: 'tab', 'aria-selected': String(i === week), class: 'week-tab',
      onClick: () => { week = i; drawWeek(); } }, `W${i + 1}`)));
    weekTabs.children[week]?.scrollIntoView({ block: 'nearest', inline: 'center' });
    daysEl.replaceChildren(...plan.weeks[week].days.map((d, di) => {
      const key = posKey({ week, day: di });
      const isNext = isActive && !active.completedAt && active.week === week && active.day === di;
      return h('div', { class: 'card', style: isNext ? { borderColor: 'var(--accent)' } : {} },
        h('div', { class: 'row between' },
          h('div', {}, h('div', { class: 'small muted' }, `Day ${di + 1}`), h('h3', {}, d.name)),
          doneKeys.has(key) ? h('span', { class: 'chip good' }, icon('check', { width: 14, height: 14 }), 'Done')
            : isNext ? h('span', { class: 'chip accent' }, 'Next') : null),
        h('ul', { class: 'plan-ex' }, ...d.exercises.map(e => h('li', {},
          h('span', {}, byId(e.exId)?.name || e.exId), h('span', { class: 'muted tnum' }, `${e.sets} × ${e.reps}`)))),
        h('button', { class: `btn sm ${isNext ? 'primary' : ''}`, onClick: () => startPlanDay(plan, week, di) }, icon('play'), isNext ? 'Start workout' : 'Start this day'));
    }));
  };
  drawWeek();

  const pr = isActive ? progress(plan, active) : null;
  return h('div', {},
    pageHead(plan.name, { back: '#/plans', right: h('a', { class: 'btn sm', href: `#/plan-edit/${plan.builtIn ? 'copy:' : ''}${encodeURIComponent(plan.id)}` }, plan.builtIn ? 'Customize' : 'Edit') }),
    h('div', { class: 'card' },
      plan.summary ? h('p', { style: { margin: '0 0 12px' } }, plan.summary) : null,
      pr ? h('div', { style: { marginBottom: '12px' } },
        h('div', { class: 'row between small', style: { marginBottom: '6px' } },
          h('b', {}, active.completedAt ? 'Plan complete!' : `Week ${pr.week} of ${pr.totalWeeks}`), h('span', { class: 'muted tnum' }, `${pr.done}/${pr.total} workouts done`)),
        h('div', { class: 'progress-bar' }, h('i', { style: { width: `${Math.round(pr.pct * 100)}%` } }))) : null,
      isActive
        ? h('button', { class: 'btn ghost danger block', onClick: async () => {
          if (!await confirmDialog(`Stop following ${plan.name}? Your logged workouts stay in your history.`, { ok: 'Stop plan', danger: true })) return;
          await setActive(null); toast('Plan stopped'); go(location.hash);
        } }, 'Stop this plan')
        : h('button', { class: 'btn primary block lg', onClick: async () => {
          if (active && !await confirmDialog('This replaces your current plan. Progress on it is kept in history. Continue?', { ok: 'Start plan' })) return;
          await activate(plan); toast(`Started ${plan.name}`); go('#/today');
        } }, 'Start plan')),
    h('div', { class: 'section-title' }, 'Schedule'),
    weekTabs,
    daysEl,
    !plan.builtIn ? h('button', { class: 'btn ghost danger block', style: { marginTop: '16px' }, onClick: async () => {
      if (!await confirmDialog(`Delete "${plan.name}"? Logged workouts are kept.`, { ok: 'Delete', danger: true })) return;
      await deletePlan(plan.id); go('#/plans');
    } }, icon('trash'), 'Delete plan') : null);
}
