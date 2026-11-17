// The logging screen — the hot path. Keep it fast: no full re-render on typing.
import { h, icon, modal, confirmDialog, fmtDuration, toast, saveJSONFile } from '../ui.js';
import { app, weightInc, go } from '../state.js';
import { byId } from '../../data/exercises.js';
import { toDisplay, fromDisplay, parseNum, detectPRs, setLabel, bestSet } from '../model.js';
import { addSet, makeEntry, finalizeSession, targetLow, defaultTarget, propagate, stepBase } from '../workout.js';
import * as rest from '../timer.js';
import { pickExercise } from '../picker.js';
import { allSessions, saveSession, getDraft, setDraft } from '../repo.js';
import { onLeave, disposeTree } from '../lifecycle.js';
import { saveQueue } from '../save-queue.js';
import { exportAll, backupFilename } from '../backup.js';
import { mountDemo } from '../demo.js';

let draft = null;
let listEl = null;
let saving = false;
let saveStatus;
const writes = saveQueue(setDraft, message => { if (saveStatus) saveStatus.textContent = message; }, { delay: 300 });
const save = () => { if (draft) writes.save(draft); };
function flush() { return writes.flush(); }
async function recoverDraft() {
  const backup = await exportAll(app.db);
  backup.kv = backup.kv.filter(x => x.id !== 'draft');
  backup.kv.push({ id: 'draft', value: structuredClone(draft) });
  if (await saveJSONFile(backup, backupFilename())) toast('Backup with this workout saved');
}
const round2 = n => Math.round(n * 100) / 100;

export async function render() {
  draft = await getDraft();
  if (!draft) return emptyState();

  const clock = h('div', { class: 'clock' }, fmtDuration((Date.now() - draft.date) / 1000));
  const clockId = setInterval(() => { clock.textContent = fmtDuration((Date.now() - draft.date) / 1000); }, 1000);
  const onHide = () => { if (document.hidden) flush().catch(() => {}); };
  const onPageHide = () => flush().catch(() => {});
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  onLeave(async () => {
    await flush();
    clearInterval(clockId);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
  });

  saveStatus = h('span', { role: 'status', class: 'small' }, 'Saved');
  const title = h('input', { value: draft.name, 'aria-label': 'Workout name', onInput: e => { draft.name = e.target.value; save(); } });
  listEl = h('div', { class: 'ex-list' });
  drawList();

  return h('div', { class: 'log' },
    h('div', { class: 'log-head' },
      h('div', { class: 'title' }, title, clock),
      h('button', { class: 'btn primary sm', onClick: finish }, 'Finish')),
    h('div', { class: 'row', style: { marginBottom: '12px' } }, saveStatus, h('button', { class: 'btn sm', onClick: () => { save(); return flush(); } }, 'Retry save'), h('button', { class: 'btn sm', onClick: recoverDraft }, 'Export backup')),
    listEl,
    h('button', { class: 'btn block', style: { marginTop: '12px' }, onClick: addExercise }, icon('plus'), 'Add exercise'),
    h('div', { class: 'field', style: { marginTop: '16px' } },
      h('label', { for: 'wnotes' }, 'Workout notes'),
      h('textarea', { id: 'wnotes', class: 'input', placeholder: 'How did it feel?', onInput: e => { draft.notes = e.target.value; save(); } }, draft.notes || '')),
    h('button', { class: 'btn primary lg block', style: { marginTop: '16px' }, onClick: finish }, icon('check'), 'Finish workout'),
    h('button', { class: 'btn ghost danger block', style: { marginTop: '8px' }, onClick: discard }, 'Discard workout'));
}

function emptyState() {
  return h('div', {},
    h('header', { class: 'page-head' }, h('h1', {}, 'Log')),
    h('div', { class: 'card empty' },
      h('p', {}, 'No workout in progress.'),
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary block', onClick: startEmpty }, icon('plus'), 'Start empty workout'),
        h('a', { class: 'btn block', href: '#/today' }, "Go to today's workout"))));
}

async function startEmpty() {
  const { startWorkout } = await import('../repo.js');
  await startWorkout({ name: 'Workout', exercises: [] });
}

function drawList() {
  disposeTree(listEl);
  listEl.replaceChildren(...draft.exercises.map((e, i) => card(e, i)));
  if (!draft.exercises.length) listEl.append(h('div', { class: 'card empty' }, 'Add your first exercise below.'));
}

function lastText(e) {
  if (!e.last?.length) return null;
  const top = bestSet(e.last) || e.last[0];
  return `Last: ${setLabel(e.exId, top, app.settings.unit)}${e.last.length > 1 ? ` · ${e.last.length} sets` : ''}`;
}

function card(e, i) {
  const ex = byId(e.exId) || { name: e.exId, primary: [], secondary: [], cues: [], metric: 'reps' };
  const unit = app.settings.unit;
  const timed = ex.metric === 'seconds';
  const target = e.target?.reps ? `${e.target.sets || e.sets.length} × ${e.target.reps}` : null;
  const meta = [target && `Target ${target}`, lastText(e)].filter(Boolean).join(' · ');

  const grid = h('div', { class: 'set-grid' },
    h('div', { class: 'hdr' }, 'Set'),
    h('div', { class: 'hdr' }, ex.bodyweight ? `+${unit}` : unit),
    h('div', { class: 'hdr' }, timed ? 'Sec' : 'Reps'),
    h('div', { class: 'hdr' }, 'Done'));
  e.sets.forEach((s, j) => grid.append(setRow(e, s, j, ex)));

  const notesBox = h('textarea', { class: `input notes-input ${e.notes ? '' : 'hidden'}`, placeholder: 'Notes for this exercise',
    'aria-label': `${ex.name} notes`, onInput: ev => { e.notes = ev.target.value; save(); } }, e.notes || '');

  const demo = h('div', { class: 'ex-demo' });
  mountDemo(demo, ex);

  return h('section', { class: 'card ex-card', 'aria-label': ex.name },
    h('div', { class: 'ex-top' },
      h('div', { class: 'grow' }, h('h3', {}, ex.name), meta ? h('div', { class: 'ex-meta' }, meta) : null),
      h('button', { class: 'icon-btn', 'aria-label': `${ex.name} options`, onClick: () => exMenu(i) }, icon('dots'))),
    demo,
    grid,
    notesBox,
    h('div', { class: 'ex-actions' },
      h('button', { class: 'btn sm', onClick: () => { addSet(e); save(); redrawCard(i); } }, icon('plus'), 'Add set'),
      h('button', { class: 'btn sm', onClick: () => { notesBox.classList.toggle('hidden'); notesBox.focus(); } }, icon('note'), 'Note')));
}

function redrawCard(i) {
  const old = listEl.children[i];
  if (old) { disposeTree(old); old.replaceWith(card(draft.exercises[i], i)); }
}

function stepper({ value, step, placeholder, mode, label, field, onChange, base }) {
  const input = h('input', { type: 'text', inputmode: mode, value: value ?? '', placeholder, 'aria-label': label,
    enterkeyhint: 'done', autocomplete: 'off', dataset: { field } });
  input.addEventListener('input', () => { const n = parseNum(input.value); onChange(n !== null && n <= 1e6 ? n : null); });
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') input.blur(); });
  const bump = d => {
    const cur = parseNum(input.value) ?? base();
    const n = Math.min(1e6, Math.max(0, round2(cur + d)));
    input.value = String(n);
    onChange(n);
  };
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': `Decrease ${label}`, onClick: () => bump(-step) }, '−'),
    input,
    h('button', { type: 'button', 'aria-label': `Increase ${label}`, onClick: () => bump(step) }, '+'));
}

/** Change set j's field, carry it down to following untouched sets, and update their inputs. */
function changeField(e, j, field, val, rowEl, toInput) {
  const old = e.sets[j][field];
  e.sets[j][field] = val;
  const changed = propagate(e.sets, j, field, old, val);
  if (changed.length) {
    const inputs = rowEl.closest('.set-grid').querySelectorAll(`input[data-field="${field}"]`);
    for (const k of changed) if (inputs[k]) inputs[k].value = toInput(val) ?? '';
  }
  save();
}

function setRow(e, s, j, ex) {
  const unit = app.settings.unit;
  const timed = ex.metric === 'seconds';
  const row = h('div', { class: `set-row ${s.done ? 'done' : ''}` });
  const w = stepper({
    value: toDisplay(s.w, unit), step: weightInc(), mode: 'decimal', field: 'w',
    placeholder: ex.bodyweight ? 'BW' : '', label: `set ${j + 1} weight`,
    base: () => toDisplay(stepBase(e.sets, j, 'w'), unit),
    onChange: n => changeField(e, j, 'w', n == null ? null : fromDisplay(n, unit), w, v => toDisplay(v, unit)),
  });
  const r = stepper({
    value: s.r, step: timed ? 5 : 1, mode: 'numeric', field: 'r',
    placeholder: String(targetLow(e.target?.reps) ?? ''), label: `set ${j + 1} ${timed ? 'seconds' : 'reps'}`,
    base: () => stepBase(e.sets, j, 'r'),
    onChange: n => changeField(e, j, 'r', n == null ? null : Math.round(n), r, v => v),
  });
  const check = h('button', { class: 'check', 'aria-label': `Mark set ${j + 1} done`, 'aria-pressed': String(!!s.done),
    onClick: () => {
      rest.unlockAudio();
      if (!s.done && (s.r == null || s.r === 0)) {
        const t = targetLow(e.target?.reps);
        if (!t) { toast(timed ? 'Enter seconds first' : 'Enter reps first'); return; }
        s.r = t; r.querySelector('input').value = String(t);
      }
      s.done = !s.done;
      row.classList.toggle('done', s.done);
      check.setAttribute('aria-pressed', String(s.done));
      if (s.done && navigator.vibrate && app.settings.vibrate) { try { navigator.vibrate(15); } catch { /* */ } }
      if (s.done && app.settings.autoRest) rest.start();
      save();
    } }, icon('check'));
  const num = h('button', { class: 'set-num', 'aria-label': `Set ${j + 1} options`, onClick: () => setMenu(e, j) }, String(j + 1));
  row.append(num, w, r, check);
  return row;
}

function setMenu(e, j) {
  const i = draft.exercises.indexOf(e);
  const close = modal(h('div', { class: 'stack' },
    h('button', { class: 'btn block', onClick: () => { if (e.sets.length >= 100) { toast('Maximum 100 sets'); return; } e.sets.splice(j + 1, 0, { ...e.sets[j], done: false }); save(); redrawCard(i); close(); } }, 'Duplicate set'),
    h('button', { class: 'btn danger block', onClick: () => { e.sets.splice(j, 1); save(); redrawCard(i); close(); } }, icon('trash'), `Remove set ${j + 1}`)),
  { title: `Set ${j + 1}` });
}

function exMenu(i) {
  const e = draft.exercises[i];
  const ex = byId(e.exId);
  const close = modal(h('div', { class: 'stack' },
    h('button', { class: 'btn block', onClick: async () => { close(); await swap(i); } }, icon('swap'), 'Swap exercise'),
    h('a', { class: 'btn block', href: `#/exercise/${e.exId}`, onClick: () => { close(); } }, 'History & progress'),
    i > 0 ? h('button', { class: 'btn block', onClick: () => { move(i, -1); close(); } }, 'Move up') : null,
    i < draft.exercises.length - 1 ? h('button', { class: 'btn block', onClick: () => { move(i, 1); close(); } }, 'Move down') : null,
    h('button', { class: 'btn danger block', onClick: async () => {
      close();
      if (e.sets.some(s => s.done) && !await confirmDialog(`Remove ${ex?.name || 'exercise'} and its logged sets?`, { ok: 'Remove', danger: true })) return;
      draft.exercises.splice(i, 1); save(); drawList();
    } }, icon('trash'), 'Remove exercise')),
  { title: ex?.name || 'Exercise' });
}

function move(i, d) {
  const [x] = draft.exercises.splice(i, 1);
  draft.exercises.splice(i + d, 0, x);
  save(); drawList();
}

async function swap(i) {
  const old = draft.exercises[i];
  const id = await pickExercise({ title: 'Swap for…', exclude: [old.exId] });
  if (!id) return;
  const sessions = await allSessions();
  const target = { sets: old.target?.sets || old.sets.length || 1, reps: byId(id)?.metric === byId(old.exId)?.metric ? (old.target?.reps || defaultTarget(id).reps) : defaultTarget(id).reps };
  const fresh = makeEntry(id, target, sessions);
  // keep set count the user already had
  while (fresh.sets.length < old.sets.length) addSet(fresh);
  fresh.sets.length = Math.max(1, old.sets.length);
  fresh.notes = old.notes;
  draft.exercises[i] = fresh;
  save(); redrawCard(i);
}

async function addExercise() {
  const id = await pickExercise({ title: 'Add exercise', exclude: draft.exercises.map(e => e.exId) });
  if (!id) return;
  draft.exercises.push(makeEntry(id, null, await allSessions()));
  save(); drawList();
  listEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function clearDraft() {
  await writes.flush().catch(() => {});
  await app.db.atomic(['kv'], tx => { tx.put('kv', { id: 'draft', value: null }); tx.put('kv', { id: 'rest', value: null }); });
  draft = null;
  rest.stop({ persist: false });
  // Reset a previously rejected queue after an intentional discard.
  writes.reset();
}
async function discard() {
  if (saving) return;
  saving = true;
  try {
    if (!await confirmDialog('Discard this workout? Logged sets will be lost.', { ok: 'Discard', danger: true })) return;
    await clearDraft();
    go('#/today');
  } finally { saving = false; }
}
async function finish() {
  if (saving || !draft) return;
  saving = true;
  const log = listEl.closest('.log');
  try {
    const all = draft.exercises.flatMap(e => e.sets);
    const done = all.filter(s => s.done && s.r > 0).length;
    if (!done) {
      if (await confirmDialog('No sets are checked off yet. Discard this workout?', { ok: 'Discard', danger: true })) { await clearDraft(); go('#/today'); }
      return;
    }
    const undone = all.length - done;
    if (undone && !await confirmDialog(`${undone} unchecked set${undone > 1 ? 's' : ''} won't be saved. Finish workout?`, { ok: 'Finish' })) return;
    log.inert = true;
    save(); await flush();
    const session = finalizeSession(draft);
    session.prs = detectPRs(session, await allSessions());
    await saveSession(session);
    draft = null;
    rest.stop({ persist: false });
    go(`#/session/${session.id}/new`);
  } finally { saving = false; log.inert = false; }
}
