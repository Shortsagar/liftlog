// Generates the app icons (PNG + SVG) with no dependencies: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../icons/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const BG = [15, 17, 21], ACCENT = [255, 106, 61], BAR = [236, 238, 241];

// Barbell glyph in a 0..1 box, centred. scale shrinks it (maskable safe zone).
function glyph(scale) {
  const S = v => 0.5 + (v - 0.5) * scale;
  const R = (x0, y0, x1, y1, r, color) => ({ x0: S(x0), y0: S(y0), x1: S(x1), y1: S(y1), r: r * scale, color });
  const parts = [R(0.14, 0.475, 0.86, 0.525, 0.02, BAR)];
  for (const m of [false, true]) {
    const X = x => (m ? 1 - x : x);
    const rect = (x0, y0, x1, y1, r, c) => { const a = X(x0), b = X(x1); parts.push(R(Math.min(a, b), y0, Math.max(a, b), y1, r, c)); };
    rect(0.22, 0.27, 0.30, 0.73, 0.035, ACCENT); // big plate
    rect(0.31, 0.35, 0.37, 0.65, 0.03, ACCENT);  // small plate
    rect(0.38, 0.44, 0.40, 0.56, 0.008, BAR);    // collar
  }
  return parts;
}

function inRoundRect(x, y, p) {
  if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return false;
  const r = p.r, cx = Math.min(Math.max(x, p.x0 + r), p.x1 - r), cy = Math.min(Math.max(y, p.y0 + r), p.y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size, { radius, scale }) {
  const parts = glyph(scale);
  const bg = { x0: 0, y0: 0, x1: 1, y1: 1, r: radius };
  const px = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let rr = 0, gg = 0, bb = 0, aa = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = (i + (sx + 0.5) / SS) / size, y = (j + (sy + 0.5) / SS) / size;
      if (!inRoundRect(x, y, bg)) continue;
      let c = BG;
      for (const p of parts) if (inRoundRect(x, y, p)) c = p.color;
      rr += c[0]; gg += c[1]; bb += c[2]; aa += 255;
    }
    const n = SS * SS, k = (j * size + i) * 4, cov = aa / 255 || 1;
    px[k] = rr / cov; px[k + 1] = gg / cov; px[k + 2] = bb / cov; px[k + 3] = aa / n;
  }
  return png(size, px);
}

// ── minimal PNG encoder ──
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync(OUT + 'icon-192.png', render(192, { radius: 0.22, scale: 1 }));
writeFileSync(OUT + 'icon-512.png', render(512, { radius: 0.22, scale: 1 }));
writeFileSync(OUT + 'icon-maskable-512.png', render(512, { radius: 0, scale: 0.72 }));
writeFileSync(OUT + 'apple-touch-icon.png', render(180, { radius: 0, scale: 0.9 }));

// SVG favicon from the same geometry
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const svgParts = glyph(1).map(p => `<rect x="${(p.x0 * 64).toFixed(2)}" y="${(p.y0 * 64).toFixed(2)}" width="${((p.x1 - p.x0) * 64).toFixed(2)}" height="${((p.y1 - p.y0) * 64).toFixed(2)}" rx="${(p.r * 64).toFixed(2)}" fill="${hex(p.color)}"/>`).join('');
writeFileSync(OUT + 'icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${hex(BG)}"/>${svgParts}</svg>\n`);
console.log('icons written to', OUT);
