// Tiny DOM helpers. No framework.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'path', 'line', 'circle', 'rect', 'ellipse', 'polyline', 'polygon', 'text', 'defs', 'linearGradient', 'stop', 'clipPath', 'title']);

function build(ns, tag, attrs, kids) {
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (!ns && (k === 'value' || k === 'checked' || k === 'disabled')) el[k] = v;
    else el.setAttribute(k === 'className' ? 'class' : k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

/** h('div', {class:'x', onClick}, 'text', child, [more]) */
export const h = (tag, attrs, ...kids) => build(SVG_TAGS.has(tag) ? SVG_NS : null, tag, attrs, kids);
/** Force SVG namespace (for tags like <a>/<text> inside SVG). */
export const s = (tag, attrs, ...kids) => build(SVG_NS, tag, attrs, kids);

// ── Icons (inline SVG paths, 24×24 stroke) ──
const ICONS = {
  today: 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 14h3v3H8z',
  log: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11',
  plans: 'M4 5h16M4 12h16M4 19h10',
  progress: 'M3 20h18M6 16l4-5 4 3 5-7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 6l6 6-6 6',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  dots: 'M12 6h.01M12 12h.01M12 18h.01',
  note: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  play: 'M7 5l12 7-12 7z',
  pause: 'M8 5v14M16 5v14',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  timer: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6 0 4-4 6-4 12 0 4 3 7 7 7z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
};
export function icon(name, attrs = {}) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', ...attrs },
  h('path', { d: ICONS[name] || '' }));
}

// ── Toasts ──
let toastWrap;
export function toast(msg, { ms = 2200, cls = '' } = {}) {
  if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap' }); document.body.append(toastWrap); }
  const t = h('div', { class: `toast ${cls}`, role: 'status' }, msg);
  toastWrap.append(t);
  setTimeout(() => t.remove(), ms);
}

// ── Modal (bottom sheet) ──
export function modal(content, { title, center = false, onClose } = {}) {
  const root = document.getElementById('overlay-root');
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: `modal ${center ? 'center' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
    title ? h('div', { class: 'modal-head' }, h('h2', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: close }, icon('x'))) : null,
    content);
  const back = h('div', { class: 'modal-back', onClick: e => { if (e.target === back) close(); } }, box);
  document.addEventListener('keydown', onKey);
  root.append(back);
  return close;
}

export function confirmDialog(message, { ok = 'OK', danger = false } = {}) {
  return new Promise(resolve => {
    let result = false;
    const close = modal(h('div', { class: 'stack' },
      h('p', { style: { margin: 0 } }, message),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onClick: () => close() }, 'Cancel'),
        h('button', { class: `btn grow ${danger ? 'danger' : 'primary'}`, onClick: () => { result = true; close(); } }, ok))),
    { center: true, onClose: () => resolve(result) });
  });
}

export function pageHead(title, { back, right } = {}) {
  return h('header', { class: 'page-head' },
    h('div', { class: 'row grow' },
      back ? h('a', { class: 'icon-btn back', href: back, 'aria-label': 'Back' }, icon('back')) : null,
      h('h1', { class: 'grow' }, title)),
    right || null);
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s2 = sec % 60;
  return hrs ? `${hrs}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}` : `${m}:${String(s2).padStart(2, '0')}`;
}
export function fmtDate(ms, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(ms).toLocaleDateString(undefined, opts);
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
