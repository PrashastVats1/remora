/**
 * Generates icon16.png, icon48.png, and icon128.png for the Remura extension.
 * Uses only Node.js built-in modules — no external dependencies.
 *
 * The icon is a shield shape filled with the Remura accent colour (#e63946)
 * on a dark background (#0e0e0e).
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = resolve(__dirname, '../icons');
mkdirSync(OUT_DIR, { recursive: true });

// Colours
const BG      = [0x0e, 0x0e, 0x0e, 0xff]; // #0e0e0e
const ACCENT  = [0xe6, 0x39, 0x46, 0xff]; // #e63946
const CHECK   = [0xff, 0xff, 0xff, 0xff]; // white checkmark

// ─── CRC32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── PNG chunk builder ────────────────────────────────────────────────────────
function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

// ─── PNG encoder ─────────────────────────────────────────────────────────────
function encodePng(pixels, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // colour type: RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Raw scanline data (filter byte 0 per row)
  const raw = Buffer.allocUnsafe(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const px = pixels[y * width + x];
      const base = y * (1 + width * 3) + 1 + x * 3;
      raw[base]     = px[0];
      raw[base + 1] = px[1];
      raw[base + 2] = px[2];
    }
  }

  const idat = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Icon drawing ─────────────────────────────────────────────────────────────
/**
 * Draws a shield icon with a centered checkmark at the given size.
 * Returns a flat pixel array (row-major, each pixel is [R, G, B]).
 */
function drawShield(size) {
  const pixels = Array.from({ length: size * size }, () => [...BG]);

  const cx = size / 2;
  const cy = size / 2;

  // Shield: roughly a rectangle that narrows into a point at the bottom
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - cx) / (size * 0.42); // normalised -1..1
      const ny = (y - cy) / (size * 0.48);

      // Shield shape: wide at top, tapers to point at bottom
      // Top half: rounded rectangle
      // Bottom half: triangle
      let inside = false;
      if (ny <= 0.1) {
        // Upper region — rounded rect-ish
        inside = Math.abs(nx) <= (1 - ny * 0.15) && ny >= -1;
      } else {
        // Lower region — taper toward point
        const maxX = 1 - ny;
        inside = Math.abs(nx) <= maxX && ny <= 1;
      }

      if (inside) {
        pixels[y * size + x] = [...ACCENT];
      }
    }
  }

  // Checkmark — drawn as a simple stroke
  const sw = Math.max(1, Math.round(size * 0.065)); // stroke width
  const checks = buildCheckmark(size);
  for (const [px, py] of checks) {
    for (let dy = -sw; dy <= sw; dy++) {
      for (let dx = -sw; dx <= sw; dx++) {
        const tx = Math.round(px) + dx;
        const ty = Math.round(py) + dy;
        if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
          pixels[ty * size + tx] = [...CHECK];
        }
      }
    }
  }

  return pixels;
}

/** Returns pixel coords for a checkmark centred in a `size`×`size` grid. */
function buildCheckmark(size) {
  const points = [];
  // Left leg: from (0.25, 0.55) to (0.43, 0.72) in normalised coords
  // Right leg: from (0.43, 0.72) to (0.72, 0.34)
  const segs = [
    [0.26, 0.54, 0.43, 0.70],
    [0.43, 0.70, 0.73, 0.33],
  ];
  for (const [x0, y0, x1, y1] of segs) {
    const steps = Math.ceil(Math.hypot((x1 - x0) * size, (y1 - y0) * size) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push([x0 * size + (x1 - x0) * size * t, y0 * size + (y1 - y0) * size * t]);
    }
  }
  return points;
}

// ─── Generate files ────────────────────────────────────────────────────────────
for (const size of [16, 48, 128]) {
  const pixels = drawShield(size);
  const png = encodePng(pixels, size, size);
  const out = resolve(OUT_DIR, `icon${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ icons/icon${size}.png  (${png.length} bytes)`);
}
