// Body weight log with trend chart.
import { h, icon, pageHead, fmtDate, toast, confirmDialog } from '../ui.js';
import { app, go } from '../state.js';
import { toDisplay, fromDisplay, parseNum } from '../model.js';
import { movingAverage } from '../progress.js';
import { lineChart, tableView } from '../chart.js';
import { newId } from '../workout.js';

const w1 = (kg, unit) => Math.round(toDisplay(kg, unit) * 10) / 10;
const isoDay = ms => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export async function render() {
  const unit = app.settings.unit;
  const entries = (await app.db.all('bodyweight')).sort((a, b) => a.date - b.date);
  const last = entries[entries.length - 1];

  const wIn = h('input', { class: 'input', inputmode: 'decimal', placeholder: last ? String(w1(last.kg, unit)) : unit, 'aria-label': `Body weight in ${unit}` });
  const dIn = h('input', { class: 'input', type: 'date', value: isoDay(Date.now()), max: isoDay(Date.now()), 'aria-label': 'Date' });
  const save = async () => {
    const v = parseNum(wIn.value);
    if (v == null || v < 20 || v > 700) { toast(`Enter a weight in ${unit}`); wIn.focus(); return; }
    const [y, m, d] = dIn.value.split('-').map(Number);
    const date = new Date(y, m - 1, d, 8).getTime();
    await app.db.put('bodyweight', { id: newId(), date, kg: fromDisplay(v, unit) });
    toast('Weight logged');
    go('#/body');
  };

  const chart = h('div');
  const pts = entries.map(e => ({ x: e.date, y: w1(e.kg, unit) }));
  if (pts.length >= 2) {
    lineChart(chart, {
      series: [
        { name: 'Weigh-ins', color: 'var(--series-2)', points: pts, label: false },
        { name: '7-entry average', color: 'var(--series-1)', points: movingAverage(pts, 7).map(p => ({ x: p.x, y: Math.round(p.y * 10) / 10 })), markers: false },
      ],
      yFmt: v => String(Math.round(v * 10) / 10), unit,
    });
  }

  const change = entries.length >= 2 ? toDisplay(last.kg - entries[0].kg, unit) : null;
  return h('div', {},
    pageHead('Body weight', { back: '#/progress' }),
    h('div', { class: 'card stack' },
      h('div', { class: 'row' },
        h('div', { class: 'grow field' }, h('label', {}, `Weight (${unit})`), wIn),
        h('div', { class: 'field', style: { width: '46%' } }, h('label', {}, 'Date'), dIn)),
      h('button', { class: 'btn primary block', onClick: save }, icon('plus'), 'Log weight')),
    entries.length >= 2 ? h('div', {},
      h('div', { class: 'section-title' }, 'Trend'),
      h('div', { class: 'card' },
        h('div', { class: 'row between small', style: { marginBottom: '8px' } },
          h('span', { class: 'muted' }, `Since ${fmtDate(entries[0].date)}`),
          h('b', { class: 'tnum' }, `${change > 0 ? '+' : ''}${Math.round(change * 10) / 10} ${unit}`)),
        chart,
        tableView(['Date', `Weight (${unit})`], [...entries].reverse().map(e => [fmtDate(e.date), w1(e.kg, unit)])))) : null,
    entries.length ? h('div', {}, h('div', { class: 'section-title' }, 'Entries'),
      h('div', { class: 'card list', style: { padding: '0 16px' } }, ...[...entries].reverse().slice(0, 15).map(e => h('div', { class: 'list-item' },
        h('div', { class: 'grow' }, h('b', { class: 'tnum' }, `${w1(e.kg, unit)} ${unit}`), h('div', { class: 'small muted' }, fmtDate(e.date))),
        h('button', { class: 'icon-btn', 'aria-label': `Delete ${fmtDate(e.date)} entry`, onClick: async () => {
          if (!await confirmDialog(`Delete the ${fmtDate(e.date)} weigh-in?`, { ok: 'Delete', danger: true })) return;
          await app.db.del('bodyweight', e.id); go('#/body');
        } }, icon('trash')))))) : h('div', { class: 'card empty' }, 'Log a few weigh-ins to see your trend.'));
}
