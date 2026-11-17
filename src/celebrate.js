// Small PR celebration: SVG confetti burst + toast.
import { h, toast } from './ui.js';

const COLORS = ['#ff6a3d', '#ffc542', '#34c77b', '#4aa8ff', '#ff5ea8', '#ffffff'];

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const W = innerWidth, H = innerHeight;
  const svg = h('svg', { class: 'confetti', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  document.body.append(svg);
  const cx = W / 2, cy = H * 0.35;
  for (let i = 0; i < 70; i++) {
    const r = h('rect', { x: cx, y: cy, width: 6 + Math.random() * 6, height: 3 + Math.random() * 4, rx: 1,
      fill: COLORS[i % COLORS.length] });
    svg.append(r);
    const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * Math.min(W, H) * 0.5;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 80;
    r.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${360 * Math.random()}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx * 1.1}px, ${dy + 260}px) rotate(${720 * Math.random()}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  }
  setTimeout(() => svg.remove(), 2400);
}

export function celebratePRs(lines) {
  if (!lines.length) return;
  confetti();
  if (navigator.vibrate) { try { navigator.vibrate([60, 40, 120]); } catch { /* */ } }
  lines.slice(0, 3).forEach((l, i) => setTimeout(() => toast(l, { ms: 3200, cls: 'pr' }), i * 250));
}
