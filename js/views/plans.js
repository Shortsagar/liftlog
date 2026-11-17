// Plan library.
import { h, icon, pageHead } from '../ui.js';
import { PLANS } from '../../data/plans.js';
import { customPlans, activeContext } from '../plan-store.js';
import { progress } from '../plans.js';
import { startWorkout } from '../repo.js';

export function planCard(p, { active, ctx } = {}) {
  const weeks = p.weeks.length;
  const perWeek = p.daysPerWeek || p.weeks[0]?.days.length || 0;
  const pr = active && ctx ? progress(ctx.plan, ctx.active) : null;
  return h('a', { class: 'card tap', href: `#/plan/${encodeURIComponent(p.id)}`, style: { display: 'block', textDecoration: 'none', color: 'inherit', ...(active ? { borderColor: 'var(--accent)' } : {}) } },
    h('div', { class: 'row between' }, h('h2', {}, p.name), active ? h('span', { class: 'chip accent' }, 'Active') : null),
    h('div', { class: 'row', style: { gap: '6px', margin: '8px 0', flexWrap: 'wrap' } },
      p.level ? h('span', { class: 'chip' }, p.level) : null,
      h('span', { class: 'chip' }, `${perWeek}×/week`),
      h('span', { class: 'chip' }, `${weeks} week${weeks > 1 ? 's' : ''}`),
      !p.builtIn ? h('span', { class: 'chip' }, 'Custom') : null),
    p.summary ? h('p', { class: 'small muted', style: { margin: 0 } }, p.summary) : null,
    pr ? h('div', { style: { marginTop: '12px' } },
      h('div', { class: 'row between small', style: { marginBottom: '6px' } },
        h('span', {}, ctx.active.completedAt ? 'Completed' : `Week ${pr.week} of ${pr.totalWeeks}`), h('span', { class: 'muted tnum' }, `${pr.done}/${pr.total} workouts`)),
      h('div', { class: 'progress-bar' }, h('i', { style: { width: `${Math.round(pr.pct * 100)}%` } }))) : null);
}

export async function render() {
  const [custom, ctx] = await Promise.all([customPlans(), activeContext()]);
  const activeId = ctx?.plan.id;
  const others = PLANS.filter(p => p.id !== activeId);

  return h('div', {},
    pageHead('Plans'),
    ctx ? h('div', {}, h('div', { class: 'section-title', style: { marginTop: 0 } }, 'Your plan'), planCard(ctx.plan, { active: true, ctx })) : null,
    h('div', { class: 'section-title' }, 'Free plans'),
    ...others.map(p => planCard(p)),
    h('div', { class: 'section-title' }, 'My plans'),
    ...custom.filter(p => p.id !== activeId).map(p => planCard(p)),
    h('div', { class: 'stack', style: { marginTop: custom.length ? '12px' : 0 } },
      h('a', { class: 'btn block', href: '#/plan-edit/new' }, icon('plus'), 'Build a custom plan'),
      h('button', { class: 'btn ghost block', onClick: () => startWorkout({ name: 'Workout', exercises: [] }) }, 'Start a one-off workout')),
    h('div', { class: 'section-title' }, 'Exercises'),
    h('a', { class: 'btn block', href: '#/library' }, 'Exercise library & form guides'));
}
