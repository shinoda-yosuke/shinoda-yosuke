// Floor generation: sector-grid rooms + corridors (Mystery Dungeon style), then population.
import { T, clamp } from '../core/util.js';
import { spawnTable, isGuardianFloor, guardianFor } from '../data/monsters.js';
import { itemPrice } from '../data/items.js';
import { trapTable } from '../data/traps.js';
import { themeIndex } from '../data/themes.js';
import { inRoom, isWalkable, itemAt, trapAt, roomIdAt, tileAt, randomFreeTile, randomRoomTile, isShopTile, freeTilesAround, isOccupied } from './floor.js';
import { createMonster, randomItem, createItem, goldAmount } from './spawn.js';

export const MAP_W = 52;
export const MAP_H = 30;
const COLS = 4;
const ROWS = 3;
const SW = MAP_W / COLS; // 13
const SH = MAP_H / ROWS; // 10

export function generateLayout(rng) {
  for (let i = 0; i < 200; i++) {
    const r = tryLayout(rng);
    if (r) return r;
  }
  throw new Error('layout generation failed');
}

function tryLayout(rng) {
  const tiles = new Array(MAP_W * MAP_H).fill(T.WALL);
  const roomOf = new Array(MAP_W * MAP_H).fill(-1);
  const nodes = [];
  const rooms = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const sx = c * SW;
      const sy = r * SH;
      const node = { c, r, sx, sy, room: null, jx: 0, jy: 0 };
      if (rng.chance(0.82)) {
        const w = rng.int(4, 9);
        const h = rng.int(3, 6);
        const x = rng.int(sx + 1, sx + SW - 1 - w);
        const y = rng.int(sy + 1, sy + SH - 1 - h);
        const room = { id: rooms.length, x, y, w, h, kind: 'normal', node: nodes.length, entered: false, doors: [] };
        rooms.push(room);
        node.room = room;
        for (let yy = y; yy < y + h; yy++) {
          for (let xx = x; xx < x + w; xx++) {
            tiles[yy * MAP_W + xx] = T.FLOOR;
            roomOf[yy * MAP_W + xx] = room.id;
          }
        }
      } else {
        node.jx = rng.int(sx + 2, sx + SW - 3);
        node.jy = rng.int(sy + 2, sy + SH - 3);
      }
      nodes.push(node);
    }
  }
  if (rooms.length < 5) return null;

  // Sector graph: spanning tree + a few extra edges, then prune junction dead-ends.
  const edges = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c + 1 < COLS) edges.push({ a: i, b: i + 1, o: 'h' });
      if (r + 1 < ROWS) edges.push({ a: i, b: i + COLS, o: 'v' });
    }
  }
  rng.shuffle(edges);
  const parent = nodes.map((_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  let chosen = [];
  const rest = [];
  for (const e of edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) {
      parent[ra] = rb;
      chosen.push(e);
    } else rest.push(e);
  }
  for (const e of rest) if (rng.chance(0.2)) chosen.push(e);

  let changed = true;
  while (changed) {
    changed = false;
    const deg = nodes.map(() => 0);
    for (const e of chosen) {
      deg[e.a]++;
      deg[e.b]++;
    }
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].room && deg[i] === 1) {
        chosen = chosen.filter((e) => e.a !== i && e.b !== i);
        changed = true;
        break;
      }
    }
  }
  const deg = nodes.map(() => 0);
  for (const e of chosen) {
    deg[e.a]++;
    deg[e.b]++;
  }
  for (const room of rooms) if (deg[room.node] === 0) return null;

  for (const e of chosen) carve(tiles, rng, nodes[e.a], nodes[e.b], e.o);

  // connectivity (4-dir flood from first room)
  let walkable = 0;
  for (const t of tiles) if (t !== T.WALL) walkable++;
  const seen = new Uint8Array(MAP_W * MAP_H);
  const stack = [[rooms[0].x, rooms[0].y]];
  seen[rooms[0].y * MAP_W + rooms[0].x] = 1;
  let count = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const i = ny * MAP_W + nx;
      if (seen[i] || tiles[i] === T.WALL) continue;
      seen[i] = 1;
      stack.push([nx, ny]);
    }
  }
  if (count !== walkable) return null;

  // doors = corridor tiles orthogonally adjacent to a room
  const f = { w: MAP_W, h: MAP_H, tiles, roomOf };
  for (const room of rooms) {
    const doors = [];
    for (let x = room.x; x < room.x + room.w; x++) {
      if (tileAt(f, x, room.y - 1) !== T.WALL) doors.push({ x, y: room.y - 1 });
      if (tileAt(f, x, room.y + room.h) !== T.WALL) doors.push({ x, y: room.y + room.h });
    }
    for (let y = room.y; y < room.y + room.h; y++) {
      if (tileAt(f, room.x - 1, y) !== T.WALL) doors.push({ x: room.x - 1, y });
      if (tileAt(f, room.x + room.w, y) !== T.WALL) doors.push({ x: room.x + room.w, y });
    }
    room.doors = doors;
    room.deg = deg[room.node];
    delete room.node;
  }
  return { tiles, roomOf, rooms };
}

function hline(tiles, x1, x2, y) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  for (let x = a; x <= b; x++) if (tiles[y * MAP_W + x] === T.WALL) tiles[y * MAP_W + x] = T.CORRIDOR;
}

function vline(tiles, x, y1, y2) {
  const a = Math.min(y1, y2);
  const b = Math.max(y1, y2);
  for (let y = a; y <= b; y++) if (tiles[y * MAP_W + x] === T.WALL) tiles[y * MAP_W + x] = T.CORRIDOR;
}

function carve(tiles, rng, A, B, o) {
  if (o === 'h') {
    const ay = A.room ? rng.int(A.room.y, A.room.y + A.room.h - 1) : A.jy;
    const ax = A.room ? A.room.x + A.room.w : A.jx;
    const by = B.room ? rng.int(B.room.y, B.room.y + B.room.h - 1) : B.jy;
    const bx = B.room ? B.room.x - 1 : B.jx;
    const mx = rng.pick([B.sx - 1, B.sx]);
    hline(tiles, ax, mx, ay);
    vline(tiles, mx, ay, by);
    hline(tiles, mx, bx, by);
  } else {
    const ax = A.room ? rng.int(A.room.x, A.room.x + A.room.w - 1) : A.jx;
    const ay = A.room ? A.room.y + A.room.h : A.jy;
    const bx = B.room ? rng.int(B.room.x, B.room.x + B.room.w - 1) : B.jx;
    const by = B.room ? B.room.y - 1 : B.jy;
    const my = rng.pick([B.sy - 1, B.sy]);
    vline(tiles, ax, ay, my);
    hline(tiles, ax, bx, my);
    vline(tiles, bx, my, by);
  }
}

// ---------------------------------------------------------------------------
// Population
// ---------------------------------------------------------------------------

export function buildFloor(g, depth) {
  const rng = g.rng;
  const lay = generateLayout(rng);
  const f = {
    w: MAP_W,
    h: MAP_H,
    depth,
    tiles: lay.tiles,
    roomOf: lay.roomOf,
    rooms: lay.rooms,
    explored: new Array(MAP_W * MAP_H).fill(0),
    visible: new Array(MAP_W * MAP_H).fill(0),
    items: [],
    traps: [],
    monsters: [],
    stairs: null,
    start: null,
    shop: null,
    mhRoomId: -1,
    mhTriggered: false,
    guardianId: 0,
    lit: false,
    mapped: false,
    theme: themeIndex(depth),
  };
  g.floor = f;
  const rooms = f.rooms;
  const guardianFloor = isGuardianFloor(depth);

  // shop (leaf room with exactly one entrance)
  if (!guardianFloor && depth >= 2 && rng.chance(0.13)) {
    const cands = rooms.filter((r) => r.doors.length === 1 && r.w * r.h >= 12);
    if (cands.length) {
      const r = rng.pick(cands);
      r.kind = 'shop';
      setupShop(g, f, r, depth);
    }
  }
  // monster house
  if (!guardianFloor && depth >= 3 && rng.chance(0.1)) {
    const cands = rooms.filter((r) => r.kind === 'normal' && r.w * r.h >= 20);
    if (cands.length) {
      cands.sort((a, b) => b.w * b.h - a.w * a.h);
      const r = rng.pick(cands.slice(0, 2));
      r.kind = 'mh';
      f.mhRoomId = r.id;
    }
  }

  const normal = rooms.filter((r) => r.kind === 'normal');
  const startRoom = rng.pick(normal);
  const stairCands = rooms.filter((r) => r.kind !== 'shop' && r !== startRoom);
  const stairRoom = rng.pick(stairCands);
  const st = randomRoomTile(g, stairRoom);
  f.tiles[st.y * f.w + st.x] = T.STAIRS;
  f.stairs = { x: st.x, y: st.y };

  const ps = randomRoomTile(g, startRoom, (x, y) => !(x === st.x && y === st.y));
  f.start = { x: ps.x, y: ps.y };
  g.player.x = ps.x;
  g.player.y = ps.y;

  const itemOk = (x, y) =>
    tileAt(f, x, y) !== T.STAIRS &&
    !itemAt(f, x, y) &&
    !isShopTile(f, x, y) &&
    !(x === ps.x && y === ps.y) &&
    roomIdAt(f, x, y) !== f.mhRoomId &&
    (roomIdAt(f, x, y) >= 0 || rng.chance(0.15));

  const nItems = rng.int(4, 7) + (depth > 10 ? 1 : 0);
  for (let i = 0; i < nItems; i++) {
    const t = randomFreeTile(g, itemOk);
    if (t) f.items.push({ x: t.x, y: t.y, item: randomItem(g, depth, { noGold: true }) });
  }
  const nGold = rng.int(1, 3);
  for (let i = 0; i < nGold; i++) {
    const t = randomFreeTile(g, itemOk);
    if (t) f.items.push({ x: t.x, y: t.y, item: createItem(g, 'gold', { amount: goldAmount(g, depth) }) });
  }

  const trapOk = (x, y) =>
    tileAt(f, x, y) !== T.STAIRS &&
    !itemAt(f, x, y) &&
    !trapAt(f, x, y) &&
    !isShopTile(f, x, y) &&
    !(x === ps.x && y === ps.y) &&
    (roomIdAt(f, x, y) >= 0 || rng.chance(0.2));
  const nTraps = Math.min(3 + Math.floor(depth / 3), 12);
  const ttable = trapTable(depth);
  for (let i = 0; i < nTraps; i++) {
    const t = randomFreeTile(g, trapOk);
    if (t) f.traps.push({ x: t.x, y: t.y, id: rng.weighted(ttable), visible: false });
  }

  const monOk = (x, y) =>
    roomIdAt(f, x, y) !== startRoom.id &&
    roomIdAt(f, x, y) !== f.mhRoomId &&
    !isShopTile(f, x, y) &&
    tileAt(f, x, y) !== T.STAIRS;
  const nMon = Math.min(rng.int(4, 6) + Math.floor(depth / 6), 12);
  const mtable = spawnTable(depth);
  for (let i = 0; i < nMon; i++) {
    const t = randomFreeTile(g, monOk);
    if (t) createMonster(g, rng.weighted(mtable), t.x, t.y, { asleep: rng.chance(0.3) });
  }

  if (f.mhRoomId >= 0) {
    const r = rooms[f.mhRoomId];
    const area = r.w * r.h;
    const nm = clamp(Math.floor(area / 5), 6, 14);
    for (let i = 0; i < nm; i++) {
      const t = randomRoomTile(g, r, (x, y) => !isOccupied(g, x, y) && tileAt(f, x, y) !== T.STAIRS);
      if (t) createMonster(g, rng.weighted(mtable), t.x, t.y, { asleep: true });
    }
    const ni = clamp(Math.floor(area / 6), 5, 10);
    for (let i = 0; i < ni; i++) {
      const t = randomRoomTile(g, r, (x, y) => !itemAt(f, x, y) && !trapAt(f, x, y) && tileAt(f, x, y) !== T.STAIRS);
      if (t) f.items.push({ x: t.x, y: t.y, item: randomItem(g, depth + 1) });
    }
  }

  if (guardianFloor) {
    const gf = guardianFor(depth);
    const spots = freeTilesAround(g, st.x, st.y, 2).filter((t) => inRoom(stairRoom, t.x, t.y));
    const t = spots[0] || randomRoomTile(g, stairRoom, (x, y) => !isOccupied(g, x, y) && tileAt(f, x, y) !== T.STAIRS);
    if (t) {
      const m = createMonster(g, gf.id, t.x, t.y, { scale: gf.scale });
      m.aware = 0;
      f.guardianId = m.id;
    }
  }
  return f;
}

function setupShop(g, f, room, depth) {
  const door = room.doors[0];
  const inner = [
    { x: door.x + 1, y: door.y },
    { x: door.x - 1, y: door.y },
    { x: door.x, y: door.y + 1 },
    { x: door.x, y: door.y - 1 },
  ].find((t) => inRoom(room, t.x, t.y));
  if (!inner) {
    room.kind = 'normal';
    return;
  }
  const homeCands = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = inner.x + dx;
      const y = inner.y + dy;
      if ((dx || dy) && inRoom(room, x, y)) homeCands.push({ x, y });
    }
  }
  if (!homeCands.length) {
    room.kind = 'normal';
    return;
  }
  const home = g.rng.pick(homeCands);
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) f.tiles[y * f.w + x] = T.SHOP;
  }
  f.shop = { roomId: room.id, doorX: door.x, doorY: door.y, innerX: inner.x, innerY: inner.y, homeX: home.x, homeY: home.y, keeperId: 0 };
  const keeper = createMonster(g, 'keeper', home.x, home.y);
  keeper.home = { x: home.x, y: home.y };
  keeper.block = { x: inner.x, y: inner.y };
  f.shop.keeperId = keeper.id;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if ((x === inner.x && y === inner.y) || (x === home.x && y === home.y)) continue;
      if (!g.rng.chance(0.55)) continue;
      const item = randomItem(g, depth + 3, { noGold: true });
      item.price = itemPrice(item);
      f.items.push({ x, y, item });
    }
  }
}

export { isWalkable };
