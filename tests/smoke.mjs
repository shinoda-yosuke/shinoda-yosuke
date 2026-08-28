// Smoke test: floor generation invariants + a simple bot that plays many runs.
// Run with: node tests/smoke.mjs [games] [maxSteps]
import { newGame, serialize, deserialize } from '../js/game/state.js';
import * as Act from '../js/game/actions.js';
import { bfs, tileAt, itemAt, monsterAt, canPass, canAttackDir, isShopTile } from '../js/game/floor.js';
import { buildFloor } from '../js/game/dungeon.js';
import { T, DIRS } from '../js/core/util.js';
import { ITEMS } from '../js/data/items.js';
import { MONSTERS } from '../js/data/monsters.js';
import { validateSprites, SPRITES } from '../js/render/spriteData.js';
import { TRAPS } from '../js/data/traps.js';

let failures = 0;
function check(cond, what) {
  if (!cond) {
    failures++;
    if (failures <= 30) console.error('FAIL:', what);
  }
}

// ---------------------------------------------------------------------------
// 0. Sprite bitmaps and data references
// ---------------------------------------------------------------------------
try {
  validateSprites();
} catch (err) {
  check(false, err.message);
}
for (const [id, d] of Object.entries(MONSTERS)) check(SPRITES[d.sprite], `monster ${id}: missing sprite ${d.sprite}`);
for (const [id, d] of Object.entries(ITEMS)) check(SPRITES[d.sprite], `item ${id}: missing sprite ${d.sprite}`);
check(SPRITES.trap && SPRITES.stairs && SPRITES.lumi_d && SPRITES.lumi_u && SPRITES.lumi_r, 'core sprites present');
check(Object.keys(TRAPS).length === 8, 'trap count');
console.log(`sprites: ${Object.keys(SPRITES).length} bitmaps validated (failures=${failures})`);

// ---------------------------------------------------------------------------
// 1. Floor generation invariants
// ---------------------------------------------------------------------------
const t0 = Date.now();
let shops = 0;
let houses = 0;
for (let seed = 1; seed <= 400; seed++) {
  const g = newGame(seed);
  const depth = 1 + (seed % 45);
  if (depth !== 1) {
    g.depth = depth;
    buildFloor(g, depth);
  }
  const f = g.floor;
  const dist = bfs(f, g.player.x, g.player.y);
  check(dist[f.stairs.y * f.w + f.stairs.x] >= 0, `seed ${seed} d${depth}: stairs unreachable`);
  for (let i = 0; i < f.tiles.length; i++) {
    if (f.tiles[i] !== T.WALL) check(dist[i] >= 0, `seed ${seed} d${depth}: unreachable tile ${i}`);
  }
  check(tileAt(f, g.player.x, g.player.y) !== T.WALL, `seed ${seed}: player in wall`);
  const occ = new Set();
  for (const m of f.monsters) {
    const k = `${m.x},${m.y}`;
    check(!occ.has(k), `seed ${seed}: monsters overlap`);
    occ.add(k);
    check(tileAt(f, m.x, m.y) !== T.WALL, `seed ${seed}: monster ${m.kind} in wall`);
    check(!(m.x === g.player.x && m.y === g.player.y), `seed ${seed}: monster on player`);
    check(MONSTERS[m.kind], `seed ${seed}: unknown monster`);
  }
  const io = new Set();
  for (const e of f.items) {
    const k = `${e.x},${e.y}`;
    check(!io.has(k), `seed ${seed}: items overlap`);
    io.add(k);
    check(tileAt(f, e.x, e.y) !== T.STAIRS, `seed ${seed}: item on stairs`);
    check(tileAt(f, e.x, e.y) !== T.WALL, `seed ${seed}: item in wall`);
    check(ITEMS[e.item.id], `seed ${seed}: unknown item ${e.item.id}`);
    if (e.item.price) check(isShopTile(f, e.x, e.y), `seed ${seed}: priced item outside shop`);
  }
  for (const t of f.traps) {
    check(tileAt(f, t.x, t.y) !== T.WALL && tileAt(f, t.x, t.y) !== T.STAIRS, `seed ${seed}: bad trap tile`);
    check(!itemAt(f, t.x, t.y), `seed ${seed}: trap under item`);
    check(!isShopTile(f, t.x, t.y), `seed ${seed}: trap in shop`);
  }
  if (f.shop) {
    shops++;
    const r = f.rooms[f.shop.roomId];
    check(r.doors.length === 1, `seed ${seed}: shop with ${r.doors.length} doors`);
    const k = f.monsters.find((m) => m.id === f.shop.keeperId);
    check(k && k.home && k.block, `seed ${seed}: keeper missing`);
    check(!isShopTile(f, f.stairs.x, f.stairs.y), `seed ${seed}: stairs in shop`);
    check(!isShopTile(f, g.player.x, g.player.y), `seed ${seed}: start in shop`);
  }
  if (f.mhRoomId >= 0) houses++;
  if (depth % 10 === 0) check(f.guardianId > 0, `seed ${seed}: guardian missing at ${depth}`);
  // serialization roundtrip
  const s = serialize(g);
  const g2 = deserialize(s);
  check(g2 && g2.floor.monsters.length === f.monsters.length, `seed ${seed}: roundtrip`);
}
console.log(`generation: 400 floors ok in ${Date.now() - t0}ms (shops=${shops}, monster houses=${houses}, failures=${failures})`);

// ---------------------------------------------------------------------------
// 2. Bot play
// ---------------------------------------------------------------------------
const GAMES = Number(process.argv[2] || 40);
const MAX_STEPS = Number(process.argv[3] || 4000);
const MODE = process.argv[4] || 'rush'; // rush | explore

function handle(g, res) {
  if (!res || !res.prompt) return;
  const pr = res.prompt;
  if (pr.type === 'stairs') Act.descend(g);
  else if (pr.type === 'buy' && pr.canPay) Act.payShop(g);
  else if (pr.type === 'sell' && g.rng.chance(0.5)) Act.sellItem(g, pr.uid);
}

function betterGear(g) {
  const p = g.player;
  for (const it of p.inv) {
    const d = ITEMS[it.id];
    if (it.unpaid) continue;
    if (d.cat === 'weapon') {
      const cur = p.weapon ? p.inv.find((i) => i.uid === p.weapon) : null;
      const curV = cur ? ITEMS[cur.id].atk + (cur.plus || 0) : -1;
      if (d.atk + (it.plus || 0) > curV) return it;
    }
    if (d.cat === 'shield') {
      const cur = p.shield ? p.inv.find((i) => i.uid === p.shield) : null;
      const curV = cur ? ITEMS[cur.id].def + (cur.plus || 0) : -1;
      if (d.def + (it.plus || 0) > curV) return it;
    }
  }
  return null;
}

function botStep(g) {
  const p = g.player;
  const f = g.floor;
  // fight adjacent monsters
  for (let d = 0; d < 8; d++) {
    const m = monsterAt(f, p.x + DIRS[d].dx, p.y + DIRS[d].dy);
    if (m && !(m.keeper && !m.angry) && canAttackDir(f, p.x, p.y, d)) {
      if (p.hp < p.maxHp * 0.35) {
        const h = p.inv.find((i) => !i.unpaid && (ITEMS[i.id].effect === 'heal' || ITEMS[i.id].effect === 'bigheal'));
        if (h) return Act.useItem(g, h.uid);
        const sc = p.inv.find((i) => !i.unpaid && ITEMS[i.id].effect === 'thunder');
        if (sc) return Act.useItem(g, sc.uid);
      }
      return Act.move(g, d);
    }
  }
  const gear = betterGear(g);
  if (gear) return Act.equip(g, gear.uid);
  // exercise random item paths sometimes
  if (g.rng.chance(0.03) && p.inv.length) {
    const it = g.rng.pick(p.inv);
    const r = g.rng.next();
    if (r < 0.4) return Act.useItem(g, it.uid);
    if (r < 0.7) return Act.throwItem(g, it.uid);
    if (r < 0.85) return Act.dropItem(g, it.uid);
    return Act.fireArrow(g);
  }
  if (g.rng.chance(0.02)) return Act.attack(g);
  // explore mode: grab every reachable item on the floor before descending
  let goal = f.stairs;
  if (MODE === 'explore' && p.inv.length < 16) {
    const here = itemAt(f, p.x, p.y);
    if (here && !here.item.price) {
      const r = Act.pickupHere(g);
      if (r.turn) return r;
    }
    const fromP = bfs(f, p.x, p.y);
    let bestI = null;
    let bestD = 1e9;
    for (const e of f.items) {
      if (e.item.price || isShopTile(f, e.x, e.y)) continue;
      if (e.x === p.x && e.y === p.y) continue;
      const d = fromP[e.y * f.w + e.x];
      if (d >= 0 && d < bestD) {
        bestD = d;
        bestI = e;
      }
    }
    if (bestI) goal = bestI;
  }
  if (goal === f.stairs && tileAt(f, p.x, p.y) === T.STAIRS) return Act.descend(g);
  // walk to the goal (bot knows the map)
  const dist = bfs(f, goal.x, goal.y);
  const here = dist[p.y * f.w + p.x];
  let best = -1;
  let bestD = here;
  for (const d of g.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7])) {
    if (!canPass(f, p.x, p.y, d)) continue;
    const nx = p.x + DIRS[d].dx;
    const ny = p.y + DIRS[d].dy;
    const mm = monsterAt(f, nx, ny);
    if (mm && mm.keeper && !mm.angry) continue;
    const nd = dist[ny * f.w + nx];
    if (nd >= 0 && nd < bestD) {
      bestD = nd;
      best = d;
    }
  }
  if (best >= 0) return Act.move(g, best);
  return Act.wait(g);
}

const t1 = Date.now();
const results = [];
const causes = {};
for (let n = 0; n < GAMES; n++) {
  let g = newGame(1000 + n);
  let steps = 0;
  try {
    while (g.phase === 'play' && steps < MAX_STEPS && g.depth < 60) {
      const res = botStep(g);
      handle(g, res);
      g.events.length = 0;
      steps++;
      if (steps % 97 === 0) {
        const g2 = deserialize(serialize(g));
        check(g2, `game ${n}: deserialize failed`);
        g = g2;
      }
      // invariants
      check(g.player.hp <= g.player.maxHp, `game ${n}: hp > maxHp`);
      check(g.player.inv.length <= 16, `game ${n}: inventory overflow`);
      for (const m of g.floor.monsters) check(m.hp > 0, `game ${n}: dead monster lingering (${m.kind})`);
    }
  } catch (err) {
    failures++;
    console.error(`game ${n} threw at step ${steps} depth ${g.depth}:`, err);
  }
  results.push({ depth: g.depth, lv: g.player.lv, steps, turn: g.turn, cause: g.cause, phase: g.phase });
  const c = g.phase === 'dead' ? g.cause : g.phase;
  causes[c] = (causes[c] || 0) + 1;
}
const depths = results.map((r) => r.depth);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`bot: ${GAMES} games in ${Date.now() - t1}ms`);
console.log(`  depth avg=${avg(depths)} min=${Math.min(...depths)} max=${Math.max(...depths)}  lv avg=${avg(results.map((r) => r.lv))}  turns avg=${avg(results.map((r) => r.turn))}`);
console.log('  outcomes:', JSON.stringify(causes));
const hist = {};
for (const d of depths) { const b = `${Math.floor((d - 1) / 5) * 5 + 1}-${Math.floor((d - 1) / 5) * 5 + 5}`; hist[b] = (hist[b] || 0) + 1; }
console.log('  depth histogram:', JSON.stringify(hist));
console.log(failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
