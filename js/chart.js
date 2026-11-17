// Small dependency-free SVG charts: line (multi-series, one y-axis) and bar (single series).
// Charts size themselves to their container (ResizeObserver) and ship a tap/hover tooltip.
import { h, s } from './ui.js';
import { niceTicks } from './progress.js';

const PAD = { l: 40, r: 14, t: 10, b: 24 };
const fmtDay = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function frame(container, height, draw) {
  container.classList.add('chart');
  const svgHost = h('div', { class: 'chart-svg' });
  const tip = h('div', { class: 'chart-tip', role: 'status', 'aria-live': 'polite' });
  container.append(svgHost, tip);
  let w = 0;
  const render = () => {
    const nw = Math.round(container.clientWidth);
    if (!nw || nw === w) return;
    w = nw;
    svgHost.replaceChildren(draw(w, height, tip));
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(render).observe(container);
  requestAnimationFrame(render);
  setTimeout(render, 30); // fallback when frames are paused (background tab)
}

function showTip(tip, x, y, w, lines) {
  tip.replaceChildren(...lines.map(([label, value, color], i) => h('div', { class: i === 0 ? 'tip-title' : 'tip-row' },
    color ? h('i', { class: 'tip-swatch', style: { background: color } }) : null,
    h('span', {}, label), value != null ? h('b', {}, value) : null)));
  tip.style.display = 'block';
  const tw = tip.offsetWidth;
  tip.style.left = `${Math.min(Math.max(4, x - tw / 2), w - tw - 4)}px`;
  tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
}

/**
 * series: [{ name, color, points: [{x, y}] }]  — all on ONE y scale.
 * opts: { height, yFmt, unit, smooth }
 */
export function lineChart(container, { series, height = 190, yFmt = v => String(v), unit = '', integer = false }) {
  const all = series.flatMap(se => se.points);
  if (!all.length) { container.append(h('p', { class: 'empty small' }, 'No data yet.')); return; }
  if (series.length > 1) {
    container.append(h('div', { class: 'chart-legend' }, ...series.map(se =>
      h('span', {}, h('i', { class: `legend-swatch ${se.dashed ? 'dashed' : ''}`, style: { background: se.color } }), se.name))));
  }
  frame(container, height, (W, H, tip) => {
    const xs = all.map(p => p.x), ys = all.map(p => p.y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    if (x0 === x1) { x0 -= 86400e3; x1 += 86400e3; }
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 4, integer);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const X = x => PAD.l + ((x - x0) / (x1 - x0)) * iw;
    const Y = y => PAD.t + (1 - (y - y0) / (y1 - y0)) * ih;
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `${series.map(se => se.name).join(' and ')} over time` });
    // grid + y labels
    for (const t of ticks) {
      svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: Y(t), y2: Y(t), class: 'grid' }));
      svg.append(s('text', { x: PAD.l - 6, y: Y(t) + 4, class: 'axis', 'text-anchor': 'end' }, yFmt(t)));
    }
    // x labels: first, middle, last
    const xl = [x0, (x0 + x1) / 2, x1];
    xl.forEach((x, i) => svg.append(s('text', { x: X(x), y: H - 6, class: 'axis', 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle' }, fmtDay(x))));
    // lines + markers
    for (const se of series) {
      const pts = [...se.points].sort((a, b) => a.x - b.x);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
      svg.append(s('path', { d, class: `series-line ${se.dashed ? 'dashed' : ''}`, stroke: se.color }));
      if (se.markers !== false && pts.length <= 40) {
        for (const p of pts) svg.append(s('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: se.color, class: 'series-dot' }));
      }
      const last = pts[pts.length - 1];
      if (se.label !== false) svg.append(s('text', { x: Math.min(X(last.x), W - PAD.r), y: Y(last.y) - 9, class: 'direct-label', 'text-anchor': 'end' }, yFmt(last.y)));
    }
    // crosshair + tooltip
    const cross = s('line', { y1: PAD.t, y2: PAD.t + ih, class: 'crosshair', style: 'display:none' });
    const focus = series.map(se => s('circle', { r: 5, fill: se.color, class: 'focus-dot', style: 'display:none' }));
    svg.append(cross, ...focus);
    const uniqX = [...new Set(all.map(p => p.x))].sort((a, b) => a - b);
    const hit = s('rect', { x: PAD.l - 10, y: 0, width: iw + 20, height: H, fill: 'transparent', style: 'cursor: crosshair; touch-action: pan-y' });
    const at = ev => {
      const r = svg.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const xv = uniqX.reduce((b, x) => (Math.abs(X(x) - px) < Math.abs(X(b) - px) ? x : b), uniqX[0]);
      cross.setAttribute('x1', X(xv)); cross.setAttribute('x2', X(xv)); cross.style.display = '';
      const lines = [[fmtDay(xv)]];
      let topY = H;
      series.forEach((se, i) => {
        const p = se.points.find(q => q.x === xv);
        if (!p) { focus[i].style.display = 'none'; return; }
        focus[i].setAttribute('cx', X(p.x)); focus[i].setAttribute('cy', Y(p.y)); focus[i].style.display = '';
        topY = Math.min(topY, Y(p.y));
        lines.push([se.name, `${yFmt(p.y)}${unit ? ' ' + unit : ''}`, se.color]);
      });
      showTip(tip, X(xv), topY, W, lines);
    };
    hit.addEventListener('pointermove', at);
    hit.addEventListener('pointerdown', at);
    hit.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') { cross.style.display = 'none'; focus.forEach(f => (f.style.display = 'none')); tip.style.display = 'none'; } });
    svg.append(hit);
    return svg;
  });
}

/** bars: [{ label, y, tip? , highlight? }] single series. */
export function barChart(container, { bars, height = 150, yFmt = v => String(v), color = 'var(--series-1)' }) {
  frame(container, height, (W, H, tip) => {
    const ticks = niceTicks(0, Math.max(1, ...bars.map(b => b.y)), 3);
    const y1 = ticks[ticks.length - 1];
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const Y = y => PAD.t + (1 - y / y1) * ih;
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Weekly volume bar chart' });
    for (const t of ticks) {
      svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: Y(t), y2: Y(t), class: 'grid' }));
      svg.append(s('text', { x: PAD.l - 6, y: Y(t) + 4, class: 'axis', 'text-anchor': 'end' }, yFmt(t)));
    }
    const slot = iw / bars.length, bw = Math.max(6, Math.min(36, slot - 2 - slot * 0.25));
    bars.forEach((b, i) => {
      const cx = PAD.l + slot * i + slot / 2, x = cx - bw / 2, top = Y(b.y), base = Y(0);
      const r = Math.min(4, bw / 2, base - top);
      const d = b.y > 0
        ? `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z`
        : `M${x},${base - 1}H${x + bw}`;
      const bar = s('path', { d, fill: color, class: `bar ${b.highlight ? 'hl' : ''}`, stroke: b.y > 0 ? 'none' : color });
      svg.append(bar);
      if (i === 0 || i === bars.length - 1 || bars.length <= 6) svg.append(s('text', { x: cx, y: H - 6, class: 'axis', 'text-anchor': 'middle' }, b.label));
      const hit = s('rect', { x: PAD.l + slot * i, y: 0, width: slot, height: H, fill: 'transparent' });
      const show = () => showTip(tip, cx, top, W, [[b.tipTitle || b.label], ...(b.tipLines || [['Value', yFmt(b.y)]])]);
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') tip.style.display = 'none'; });
      svg.append(hit);
    });
    return svg;
  });
}

/** Accessible table view under a chart. rows: [[...cells]] */
export function tableView(headers, rows, summary = 'Show as table') {
  return h('details', { class: 'chart-table' }, h('summary', {}, summary),
    h('table', {}, h('thead', {}, h('tr', {}, ...headers.map(x => h('th', {}, x)))),
      h('tbody', {}, ...rows.map(r => h('tr', {}, ...r.map(c => h('td', {}, c)))))));
}
