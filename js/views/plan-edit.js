// Custom plan builder. Route: #/plan-edit/new | #/plan-edit/<id> | #/plan-edit/copy:<builtInId>
import { h, icon, pageHead, toast } from '../ui.js';
import { go } from '../state.js';
import { byId } from '../../data/exercises.js';
import { getPlan, savePlan, activate } from '../plan-store.js';
import { buildCustomPlan, validatePlanForm, editableWeeks } from '../plans.js';
import { pickExercise } from '../picker.js';
import { newId } from '../workout.js';
import { defaultTarget } from '../workout.js';

export async function render(param) {
  let form, id, title;
  if (param === 'new') {
    id = 'custom-' + newId(); title = 'Build a plan';
    form = { name: '', weeks: 8, days: [{ name: 'Day 1', exercises: [] }] };
  } else {
    const copy = param.startsWith('copy:');
    const src = await getPlan(copy ? param.slice(5) : param);
    if (!src) return h('div', {}, pageHead('Plan not found', { back: '#/plans' }));
    id = copy ? 'custom-' + newId() : src.id;
    title = copy ? 'Customize plan' : 'Edit plan';
    form = {
      name: copy ? `${src.name} (custom)` : src.name, summary: src.summary || '',
      weeks: src.weeks.length,
      templateWeeks: editableWeeks(src.weeks),
      days: [],
    };
  }

  if (form.templateWeeks) form.days = form.templateWeeks[0].days;
  const weekPicker = form.templateWeeks ? h('select', { class: 'input', 'aria-label': 'Week to edit', onChange: e => { form.days = form.templateWeeks[Number(e.target.value)].days; drawDays(); } }, ...form.templateWeeks.map((_, i) => h('option', { value: i }, `Week ${i + 1}`))) : null;

  const daysEl = h('div');
  const errEl = h('div', { class: 'form-errors', role: 'alert' });

  const drawDays = () => daysEl.replaceChildren(...form.days.map((d, di) => h('div', { class: 'card' },
    h('div', { class: 'row' },
      h('input', { class: 'input grow', value: d.name, 'aria-label': `Day ${di + 1} name`, onInput: e => { d.name = e.target.value; } }),
      di > 0 ? h('button', { class: 'icon-btn', 'aria-label': 'Move day up', onClick: () => { form.days.splice(di - 1, 0, form.days.splice(di, 1)[0]); drawDays(); } }, icon('back', { style: 'transform: rotate(90deg)' })) : null,
      h('button', { class: 'icon-btn', 'aria-label': `Delete ${d.name || 'day'}`, onClick: () => { form.days.splice(di, 1); drawDays(); } }, icon('trash'))),
    h('div', { class: 'edit-ex-list' }, ...d.exercises.map((e, ei) => h('div', { class: 'edit-ex' },
      h('button', { class: 'edit-ex-name', onClick: async () => {
        const nid = await pickExercise({ title: 'Replace with…' }); if (nid) { e.exId = nid; drawDays(); }
      } }, byId(e.exId)?.name || e.exId),
      h('input', { class: 'input mini', inputmode: 'numeric', value: e.sets, 'aria-label': 'Sets', onInput: ev => { e.sets = Number(ev.target.value) || 1; } }),
      h('span', { class: 'muted' }, '×'),
      h('input', { class: 'input mini wide', value: e.reps, 'aria-label': 'Reps', onInput: ev => { e.reps = ev.target.value; } }),
      h('button', { class: 'icon-btn', 'aria-label': `Remove ${byId(e.exId)?.name}`, onClick: () => { d.exercises.splice(ei, 1); drawDays(); } }, icon('x'))))),
    h('button', { class: 'btn sm', style: { marginTop: '8px' }, onClick: async () => {
      const nid = await pickExercise({ title: 'Add exercise', exclude: d.exercises.map(x => x.exId) });
      if (nid) { d.exercises.push({ exId: nid, ...defaultTarget(nid) }); drawDays(); }
    } }, icon('plus'), 'Add exercise'))));
  drawDays();

  const save = async startNow => {
    const errs = validatePlanForm(form);
    errEl.replaceChildren(...errs.map(e => h('div', {}, e)));
    if (errs.length) { errEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const plan = await savePlan(buildCustomPlan({ id, ...form }));
    if (plan.id !== id && !startNow) toast('Saved as a revised copy; your active workout schedule is preserved', { ms: 4500 });
    if (startNow) { await activate(plan); toast(`Started ${plan.name}`); go('#/today'); }
    else { if (plan.id === id) toast('Plan saved'); go(`#/plan/${encodeURIComponent(plan.id)}`); }
  };

  return h('div', {},
    pageHead(title, { back: '#/plans' }),
    h('div', { class: 'card stack' },
      h('div', { class: 'field' }, h('label', { for: 'pname' }, 'Plan name'),
        h('input', { id: 'pname', class: 'input', value: form.name, placeholder: 'e.g. My 4-day split', onInput: e => { form.name = e.target.value; } })),
      h('div', { class: 'field' }, h('label', { for: 'pweeks' }, 'Length (weeks)'),
        h('input', { id: 'pweeks', class: 'input', inputmode: 'numeric', value: form.weeks, onInput: e => { form.weeks = Number(e.target.value); } })),
      h('p', { class: 'small muted', style: { margin: 0 } }, form.templateWeeks ? 'Edit each week separately. Added weeks repeat the existing schedule. Saving schedule changes to an active plan creates a revised copy.' : 'Set up one week of training days. It repeats for every week of the plan.')),
    h('div', { class: 'section-title' }, 'Training days'),
    weekPicker,
    daysEl,
    h('button', { class: 'btn block', style: { marginTop: '12px' }, onClick: () => { form.days.push({ name: `Day ${form.days.length + 1}`, exercises: [] }); drawDays(); } }, icon('plus'), 'Add day'),
    errEl,
    h('div', { class: 'stack', style: { marginTop: '16px' } },
      h('button', { class: 'btn primary block lg', onClick: () => save(true) }, 'Save & start plan'),
      h('button', { class: 'btn block', onClick: () => save(false) }, 'Save')));
}
