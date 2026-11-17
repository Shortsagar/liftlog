import { detectPRs } from '../model.js';
import * as rest from '../timer.js';
// Settings: units, increments, rest timer, feedback, theme, backup/restore, storage, reset.
import { h, pageHead, toast } from '../ui.js';
import { app, saveSettings, go } from '../state.js';
import { fmtDuration, confirmDialog } from '../ui.js';
import { makeSampleHistory } from '../progress.js';
import { exportAll, importAll, readBackupFile, backupFilename } from '../backup.js';
import { requestPersistence } from '../app.js';
import { icon, fmtDate, saveJSONFile } from '../ui.js';

const daysAgo = ms => Math.floor((Date.now() - ms) / 86400e3);

async function exportBackup() {
  const data = await exportAll(app.db);
  if (!await saveJSONFile(data, backupFilename())) return;
  await saveSettings({ lastBackupAt: Date.now() });
  toast(`Backup saved: ${data.sessions.length} workouts`);
  go('#/settings');
}

async function importBackup(fileInput) {
  const f = fileInput.files[0];
  fileInput.value = '';
  if (!f) return;
  let obj;
  try { obj = await readBackupFile(f); } catch (e) { toast(e.message, { ms: 3500 }); return; }
  const ok = await confirmDialog(`Replace ALL data on this device with the backup from ${fmtDate(obj.exportedAt, { month: 'short', day: 'numeric', year: 'numeric' })}? It has ${obj.sessions.length} workout${obj.sessions.length === 1 ? '' : 's'}, ${obj.plans.length} custom plan${obj.plans.length === 1 ? '' : 's'} and ${obj.bodyweight.length} weigh-in${obj.bodyweight.length === 1 ? '' : 's'}. Current data on this device will be overwritten.`, { ok: 'Replace & restore', danger: true });
  if (!ok) return;
  await importAll(app.db, obj);
  rest.stop({ persist: false });
  location.reload();
}

async function resetAll() {
  if (!await confirmDialog('Delete ALL workouts, plans, weigh-ins and settings on this device? Export a backup first if you might want them.', { ok: 'Continue', danger: true })) return;
  if (!await confirmDialog('This cannot be undone. Delete everything?', { ok: 'Delete everything', danger: true })) return;
  await app.db.resetUserData();
  rest.stop({ persist: false });
  location.hash = '#/today';
  location.reload();
}

async function dataSection() {
  const st = app.settings;
  const sessions = await app.db.all('sessions');
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const est = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  const last = st.lastBackupAt;
  const stale = sessions.length && (!last || daysAgo(last) > 30);
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', onChange: e => importBackup(e.target) });
  return h('div', { id: 'data-section' },
    h('div', { class: 'section-title' }, 'Your data'),
    h('div', { class: `card stack ${stale ? 'backup-nudge' : ''}` },
      h('p', { class: 'small', style: { margin: 0 } },
        h('b', {}, last ? `Last backup ${daysAgo(last) === 0 ? 'today' : `${daysAgo(last)} days ago`}` : 'Never backed up'),
        h('span', { class: 'muted' }, ` · ${sessions.length} workouts on this device. Data is stored in this browser without app-level encryption. Backups include workout dates, notes and weigh-ins in readable JSON; share them only with people or storage you trust.`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary grow', onClick: exportBackup }, icon('download'), 'Export backup'),
        h('button', { class: 'btn grow', onClick: () => fileIn.click() }, icon('upload'), 'Import'), fileIn)),
    h('div', { class: 'card list', style: { padding: '0 16px', marginTop: '12px' } },
      rowItem('Storage protection', persisted ? 'Protected — the browser won\'t clear it to free space' : 'Not protected yet — add LiftLog to your Home Screen, then tap Protect',
        persisted ? h('span', { class: 'chip good' }, icon('check', { width: 14, height: 14 }), 'On')
          : h('button', { class: 'btn sm', onClick: async () => { const ok = await requestPersistence(); toast(ok ? 'Storage protected' : 'The browser declined — installing to the Home Screen usually fixes this'); go('#/settings'); } }, 'Protect')),
      est ? rowItem('Space used', `${(est.usage / 1024).toFixed(0)} KB · storage: ${app.db.kind}`, null) : null),
    h('button', { class: 'btn ghost danger block', style: { marginTop: '8px' }, onClick: resetAll }, icon('trash'), 'Reset all data'));
}

async function loadSample() {
  if (!await confirmDialog('Add 8 weeks of sample Upper/Lower workouts and weigh-ins so you can explore charts and PRs? You can remove them again here.', { ok: 'Add sample data' })) return;
  const { sessions, bodyweight } = makeSampleHistory(Date.now());
  await app.db.atomic(['sessions', 'bodyweight'], tx => {
    for (const s of sessions) tx.put('sessions', s);
    for (const b of bodyweight) tx.put('bodyweight', b);
  });
  toast(`Added ${sessions.length} sample workouts`);
}
async function removeSample() {
  const [ss, bw] = await Promise.all([app.db.all('sessions'), app.db.all('bodyweight')]);
  const n = ss.filter(s => s.sample).length;
  if (!n && !bw.some(b => b.sample)) { toast('No sample data to remove'); return; }
  if (!await confirmDialog(`Remove ${n} sample workouts and sample weigh-ins? Your own data is kept.`, { ok: 'Remove', danger: true })) return;
  await app.db.atomic(['sessions', 'bodyweight'], tx => {
    const all = tx.all('sessions');
    for (const s of all) if (s.sample) tx.del('sessions', s.id);
    for (const b of tx.all('bodyweight')) if (b.sample) tx.del('bodyweight', b.id);
    // Repair PRs previously calculated against demo performances by older versions.
    const real = all.filter(s => !s.sample).sort((a, b) => a.date - b.date);
    real.forEach((s, i) => tx.put('sessions', { ...s, prs: detectPRs(s, real.slice(0, i)) }));
  });
  toast('Sample data removed');
}

function seg(options, current, onPick, label) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  const draw = cur => wrap.replaceChildren(...options.map(([v, text]) =>
    h('button', { type: 'button', 'aria-pressed': String(v === cur), onClick: async () => { await onPick(v); draw(v); } }, text)));
  draw(current);
  return wrap;
}
function sw(checked, onChange, label) {
  return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked, 'aria-label': label, onChange: e => onChange(e.target.checked) }), h('span', {}));
}
const rowItem = (title, sub, control) => h('div', { class: 'list-item' },
  h('div', { class: 'grow' }, h('div', {}, title), sub ? h('div', { class: 'small muted' }, sub) : null), control);

function versionProbe() {
  // shows the cached app version (set by the service worker build)
  if (typeof caches !== 'undefined') caches.keys().then(keys => {
    const scope = new URL('../../', import.meta.url).href;
    const prefix = `liftlog-${encodeURIComponent(scope)}-`;
    const v = keys.find(k => k.startsWith(prefix));
    const el = document.getElementById('app-version');
    if (el) el.textContent = v ? `version ${v.slice(prefix.length)} · available offline` : 'not yet cached for offline use';
  }).catch(() => {});
  return null;
}

export async function render() {
  const st = app.settings;
  const incWrap = h('div');
  const drawInc = () => incWrap.replaceChildren(st.unit === 'kg'
    ? seg([[1.25, '1.25'], [2.5, '2.5']], st.incKg, v => saveSettings({ incKg: v }), 'Weight increment')
    : seg([[2.5, '2.5'], [5, '5']], st.incLb, v => saveSettings({ incLb: v }), 'Weight increment'));
  drawInc();

  const restVal = h('b', { class: 'tnum', style: { minWidth: '52px', textAlign: 'center' } }, fmtDuration(st.restSec));
  const bumpRest = async d => { const v = Math.min(600, Math.max(15, st.restSec + d)); await saveSettings({ restSec: v }); restVal.textContent = fmtDuration(v); };

  return h('div', {},
    pageHead('Settings'),
    h('div', { class: 'section-title' }, 'Units'),
    h('div', { class: 'card list', style: { padding: '0 16px' } },
      rowItem('Weight unit', 'History is converted automatically',
        seg([['lb', 'lb'], ['kg', 'kg']], st.unit, async v => { await saveSettings({ unit: v }); drawInc(); }, 'Weight unit')),
      rowItem('Weight +/− step', null, incWrap)),
    h('div', { class: 'section-title' }, 'Rest timer'),
    h('div', { class: 'card list', style: { padding: '0 16px' } },
      rowItem('Default rest', null, h('div', { class: 'row' },
        h('button', { class: 'btn sm', 'aria-label': 'Less rest', onClick: () => bumpRest(-15) }, '−15'), restVal,
        h('button', { class: 'btn sm', 'aria-label': 'More rest', onClick: () => bumpRest(15) }, '+15'))),
      rowItem('Auto-start after a set', null, sw(st.autoRest, v => saveSettings({ autoRest: v }), 'Auto-start rest timer')),
      rowItem('Beep', 'Plays when rest is over', sw(st.sound, v => saveSettings({ sound: v }), 'Beep')),
      rowItem('Vibrate', 'Android only — iPhone doesn\'t allow web vibration', sw(st.vibrate, v => saveSettings({ vibrate: v }), 'Vibrate'))),
    h('div', { class: 'section-title' }, 'Appearance'),
    h('div', { class: 'card list', style: { padding: '0 16px' } },
      rowItem('Theme', null, seg([['dark', 'Dark'], ['light', 'Light'], ['system', 'Auto']], st.theme, v => saveSettings({ theme: v }), 'Theme')),
      rowItem('Form guides while logging', 'Animated demo, muscles and cues on each exercise', sw(st.showDemos !== false, v => saveSettings({ showDemos: v }), 'Form guides while logging'))),
    await dataSection(),
    h('div', { class: 'section-title' }, 'Sample data'),
    h('div', { class: 'card stack' },
      h('p', { class: 'small muted', style: { margin: 0 } }, 'Explore the progress charts before you have history of your own. Sample entries are tagged and removable.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onClick: loadSample }, 'Load sample history'),
        h('button', { class: 'btn ghost danger grow', onClick: removeSample }, 'Remove sample'))),
    h('p', { class: 'small muted', style: { textAlign: 'center', marginTop: '24px' } }, `LiftLog · works offline · no account, no tracking`, h('br'), h('span', { id: 'app-version' }, '')),
    versionProbe());
}
