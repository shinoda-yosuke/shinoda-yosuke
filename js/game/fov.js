// Mystery-Dungeon style visibility: whole room when inside a room, 8 neighbours in corridors.
import { T } from '../core/util.js';
import { roomIdAt } from './floor.js';

export function updateFov(g) {
  const f = g.floor;
  const p = g.player;
  if (!f.visible || f.visible.length !== f.w * f.h) f.visible = new Array(f.w * f.h).fill(0);
  else f.visible.fill(0);
  const mark = (x, y) => {
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
    const i = y * f.w + x;
    f.visible[i] = 1;
    f.explored[i] = 1;
  };
  const rid = roomIdAt(f, p.x, p.y);
  if (rid >= 0) {
    const r = f.rooms[rid];
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) mark(x, y);
    r.entered = true;
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(p.x + dx, p.y + dy);
}

export function isVisible(g, x, y) {
  const f = g.floor;
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return false;
  return f.visible[y * f.w + x] === 1;
}

export function canSeeMonster(g, m) {
  return g.floor.lit || isVisible(g, m.x, m.y);
}

/** ちずのページ: reveal all walkable tiles plus their surrounding walls. */
export function revealMap(f) {
  f.mapped = true;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      if (f.tiles[y * f.w + x] === T.WALL) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= f.w || yy >= f.h) continue;
          f.explored[yy * f.w + xx] = 1;
        }
      }
    }
  }
}
