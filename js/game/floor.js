// Floor/grid helpers. Pure functions over the floor object.
import { DIRS, T, cheb } from '../core/util.js';

export function inBounds(f, x, y) {
  return x >= 0 && y >= 0 && x < f.w && y < f.h;
}

export function tileAt(f, x, y) {
  return inBounds(f, x, y) ? f.tiles[y * f.w + x] : T.WALL;
}

export function isWalkable(f, x, y) {
  return tileAt(f, x, y) !== T.WALL;
}

export function roomIdAt(f, x, y) {
  return inBounds(f, x, y) ? f.roomOf[y * f.w + x] : -1;
}

export function monsterAt(f, x, y) {
  for (const m of f.monsters) if (m.x === x && m.y === y) return m;
  return null;
}

export function itemAt(f, x, y) {
  for (const e of f.items) if (e.x === x && e.y === y) return e;
  return null;
}

export function trapAt(f, x, y) {
  for (const t of f.traps) if (t.x === x && t.y === y) return t;
  return null;
}

export function isPlayerAt(g, x, y) {
  return g.player.x === x && g.player.y === y;
}

export function isOccupied(g, x, y) {
  return isPlayerAt(g, x, y) || monsterAt(g.floor, x, y) !== null;
}

export function inRoom(room, x, y) {
  return x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
}

export function sameRoom(f, a, b) {
  const ra = roomIdAt(f, a.x, a.y);
  return ra >= 0 && ra === roomIdAt(f, b.x, b.y);
}

/** Can something standing on (x,y) step towards dir? Diagonal moves may not cut wall corners. */
export function canPass(f, x, y, dir, phase = false) {
  const { dx, dy } = DIRS[dir];
  const nx = x + dx;
  const ny = y + dy;
  if (!inBounds(f, nx, ny)) return false;
  if (phase) return true;
  if (!isWalkable(f, nx, ny)) return false;
  if (dx !== 0 && dy !== 0 && (!isWalkable(f, x + dx, y) || !isWalkable(f, x, y + dy))) return false;
  return true;
}

/** Attack rule: diagonal attacks cannot cut corners; the target tile itself may be a wall (ghosts). */
export function canAttackDir(f, x, y, dir) {
  const { dx, dy } = DIRS[dir];
  if (!inBounds(f, x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0 && (!isWalkable(f, x + dx, y) || !isWalkable(f, x, y + dy))) return false;
  return true;
}

/** BFS distance field (8-dir, corner rule) from (sx,sy). -1 = unreachable. */
export function bfs(f, sx, sy) {
  const n = f.w * f.h;
  const dist = new Int16Array(n).fill(-1);
  const qx = new Int16Array(n);
  const qy = new Int16Array(n);
  let head = 0;
  let tail = 0;
  dist[sy * f.w + sx] = 0;
  qx[tail] = sx;
  qy[tail] = sy;
  tail++;
  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    head++;
    const d = dist[y * f.w + x];
    for (let dir = 0; dir < 8; dir++) {
      if (!canPass(f, x, y, dir)) continue;
      const nx = x + DIRS[dir].dx;
      const ny = y + DIRS[dir].dy;
      const i = ny * f.w + nx;
      if (dist[i] !== -1) continue;
      dist[i] = d + 1;
      qx[tail] = nx;
      qy[tail] = ny;
      tail++;
    }
  }
  return dist;
}

/** Straight line of walkable tiles from (x,y) towards dir, excluding start, stopping before a wall. */
export function lineTiles(f, x, y, dir, max = 10) {
  const out = [];
  const { dx, dy } = DIRS[dir];
  let cx = x;
  let cy = y;
  for (let i = 0; i < max; i++) {
    cx += dx;
    cy += dy;
    if (!isWalkable(f, cx, cy)) break;
    out.push({ x: cx, y: cy });
  }
  return out;
}

export function isShopTile(f, x, y) {
  if (!f.shop) return false;
  const r = f.rooms[f.shop.roomId];
  return inRoom(r, x, y) || (x === f.shop.doorX && y === f.shop.doorY);
}

/** Random unoccupied walkable tile satisfying pred(x,y). */
export function randomFreeTile(g, pred) {
  const f = g.floor;
  for (let i = 0; i < 400; i++) {
    const x = g.rng.int(0, f.w - 1);
    const y = g.rng.int(0, f.h - 1);
    if (!isWalkable(f, x, y) || isOccupied(g, x, y)) continue;
    if (pred && !pred(x, y)) continue;
    return { x, y };
  }
  const c = [];
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      if (isWalkable(f, x, y) && !isOccupied(g, x, y) && (!pred || pred(x, y))) c.push({ x, y });
    }
  }
  return c.length ? g.rng.pick(c) : null;
}

/** Random tile inside a room satisfying pred. */
export function randomRoomTile(g, room, pred) {
  const c = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (!pred || pred(x, y)) c.push({ x, y });
    }
  }
  return c.length ? g.rng.pick(c) : null;
}

/** Walkable tiles around (x,y) up to radius, nearest ring first, shuffled within a ring. */
export function freeTilesAround(g, x, y, radius = 1, opts = {}) {
  const f = g.floor;
  const out = [];
  for (let r = 1; r <= radius; r++) {
    const ring = [];
    for (let yy = y - r; yy <= y + r; yy++) {
      for (let xx = x - r; xx <= x + r; xx++) {
        if (cheb(x, y, xx, yy) !== r) continue;
        if (!isWalkable(f, xx, yy)) continue;
        if (!opts.allowOccupied && isOccupied(g, xx, yy)) continue;
        if (opts.noItem && itemAt(f, xx, yy)) continue;
        if (opts.noStairs && tileAt(f, xx, yy) === T.STAIRS) continue;
        ring.push({ x: xx, y: yy });
      }
    }
    g.rng.shuffle(ring);
    out.push(...ring);
  }
  return out;
}
