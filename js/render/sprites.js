// Rasterises bitmaps from spriteData.js into cached offscreen canvases; procedural theme tiles.
import { SPRITES, PALETTE, VARIANTS } from './spriteData.js';
import { THEMES } from '../data/themes.js';

export const SIZE = 16;
const cache = new Map();
const tileCache = new Map();

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${r},${g},${b})`;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * getSprite(name, { tint, pal, flip }) -> 16x16 canvas.
 *  tint: colour for 'T' (and its shade for 'U'); pal: VARIANTS key; flip: mirror horizontally.
 */
export function getSprite(name, opts = {}) {
  const key = `${name}|${opts.tint || ''}|${opts.pal || ''}|${opts.flip ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  const rows = SPRITES[name] || SPRITES.trap;
  const over = opts.pal ? VARIANTS[opts.pal] || {} : {};
  const tint = opts.tint || '#c9d1d9';
  const tintShade = shade(tint, 0.65);
  c = makeCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  for (let y = 0; y < SIZE; y++) {
    const row = rows[y];
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let col;
      if (ch === 'T') col = tint;
      else if (ch === 'U') col = tintShade;
      else col = over[ch] || PALETTE[ch] || '#ff00ff';
      ctx.fillStyle = col;
      ctx.fillRect(opts.flip ? SIZE - 1 - x : x, y, 1, 1);
    }
  }
  cache.set(key, c);
  return c;
}

/** Procedural 16x16 theme tiles: floorA floorB corridor shop wall wallFace */
export function getTile(themeIdx, kind) {
  const key = `${themeIdx}|${kind}`;
  let c = tileCache.get(key);
  if (c) return c;
  const th = THEMES[themeIdx % THEMES.length];
  c = makeCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  const px = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  switch (kind) {
    case 'floorA':
    case 'floorB': {
      px(0, 0, 16, 16, kind === 'floorA' ? th.floorA : th.floorB);
      px(0, 0, 16, 1, shade(th.floorA, 1.12));
      px(0, 0, 1, 16, shade(th.floorA, 1.12));
      px(0, 15, 16, 1, shade(th.floorA, 0.85));
      px(15, 0, 1, 16, shade(th.floorA, 0.85));
      if (kind === 'floorA') {
        px(4, 5, 1, 1, th.dot);
        px(11, 10, 1, 1, th.dot);
      } else {
        px(9, 4, 1, 1, th.dot);
        px(5, 11, 1, 1, th.dot);
      }
      break;
    }
    case 'corridor':
      px(0, 0, 16, 16, th.corridor);
      px(3, 6, 1, 1, th.corridorDot);
      px(10, 3, 1, 1, th.corridorDot);
      px(7, 12, 1, 1, th.corridorDot);
      px(13, 9, 1, 1, th.corridorDot);
      break;
    case 'shop': {
      px(0, 0, 16, 16, th.shopA);
      px(0, 0, 8, 8, th.shopB);
      px(8, 8, 8, 8, th.shopB);
      px(0, 0, 16, 1, shade(th.shopA, 1.15));
      px(0, 0, 1, 16, shade(th.shopA, 1.15));
      break;
    }
    case 'wall': {
      px(0, 0, 16, 16, th.wall);
      // brick lines
      px(0, 3, 16, 1, th.wallLine);
      px(0, 9, 16, 1, th.wallLine);
      px(0, 15, 16, 1, th.wallLine);
      px(5, 4, 1, 5, th.wallLine);
      px(12, 4, 1, 5, th.wallLine);
      px(2, 10, 1, 5, th.wallLine);
      px(9, 10, 1, 5, th.wallLine);
      px(8, 0, 1, 3, th.wallLine);
      break;
    }
    case 'wallFace': {
      px(0, 0, 16, 16, th.wallFace);
      px(0, 0, 16, 2, th.wallEdge);
      px(0, 6, 16, 1, th.wallLine);
      px(0, 11, 16, 1, th.wallLine);
      px(4, 2, 1, 4, th.wallLine);
      px(11, 7, 1, 4, th.wallLine);
      px(7, 12, 1, 4, th.wallLine);
      px(0, 15, 16, 1, th.wallLine);
      break;
    }
    default:
      px(0, 0, 16, 16, '#ff00ff');
  }
  tileCache.set(key, c);
  return c;
}

/** Draw a sprite scaled onto any 2D context. */
export function drawSpriteTo(ctx, name, x, y, size, opts) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(getSprite(name, opts), x, y, size, size);
}
