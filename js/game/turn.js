// Turn processing after a player action.
import { cheb } from '../core/util.js';
import { spawnTable } from '../data/monsters.js';
import { monstersPhase } from './ai.js';
import { updateFov, isVisible } from './fov.js';
import { msg } from './log.js';
import { randomFreeTile, isShopTile, freeTilesAround } from './floor.js';
import { createMonster } from './spawn.js';
import { angerKeeper } from './combat.js';

export function playerSpeed(p) {
  if (p.st.haste > 0) return 200;
  if (p.st.slow > 0) return 50;
  return 100;
}

const STATUS_END = {
  sleep: '目が さめた！',
  confuse: '混乱が おさまった',
  haste: '動きが ふつうに 戻った',
  slow: '動きが ふつうに 戻った',
};

/** Called after any turn-consuming player action. */
export function endPlayerAction(g, opts = {}) {
  const p = g.player;
  checkTheft(g);
  p.energy -= 100;
  let skip = !!opts.skipMonsters;
  let guard = 0;
  while (p.energy < 100 && g.phase === 'play' && guard++ < 8) {
    if (!skip) monstersPhase(g);
    skip = false;
    if (g.phase !== 'play') break;
    tickTurn(g);
    p.energy += playerSpeed(p);
  }
  if (g.phase === 'play') updateFov(g);
}

function tickTurn(g) {
  const p = g.player;
  const f = g.floor;
  g.turn++;
  p.turns++;
  for (const k of ['sleep', 'confuse', 'haste', 'slow']) {
    if (p.st[k] > 0) {
      p.st[k]--;
      if (p.st[k] === 0) msg(g, STATUS_END[k]);
    }
  }
  // natural regeneration
  if (p.hp < p.maxHp) {
    p.regen += p.maxHp / 150 + 0.02;
    if (p.regen >= 1) {
      const n = Math.floor(p.regen);
      p.hp = Math.min(p.maxHp, p.hp + n);
      p.regen -= n;
    }
  } else p.regen = 0;

  for (const m of f.monsters) {
    for (const k of ['sleep', 'confuse', 'haste', 'slow']) if (m.st[k] > 0) m.st[k]--;
  }

  // occasional new arrivals, out of sight
  const cap = Math.min(4 + Math.floor(g.depth / 2), 12);
  const n = f.monsters.filter((m) => !m.keeper).length;
  if (n < cap && g.rng.chance(1 / 45)) {
    const t = randomFreeTile(g, (x, y) => !isVisible(g, x, y) && !isShopTile(f, x, y) && cheb(x, y, p.x, p.y) > 6);
    if (t) {
      const m = createMonster(g, g.rng.weighted(spawnTable(g.depth)), t.x, t.y);
      m.energy = 0;
    }
  }
}

/** Leaving the shop area with unpaid goods. */
export function checkTheft(g) {
  const p = g.player;
  const f = g.floor;
  if (!f.shop) return;
  const unpaid = p.inv.filter((i) => i.unpaid);
  if (!unpaid.length) return;
  if (isShopTile(f, p.x, p.y)) return;
  for (const i of unpaid) {
    i.unpaid = false;
    delete i.price;
  }
  msg(g, '「どろぼう！ つかまえろ！」', 'bad');
  g.events.push({ t: 'fx', kind: 'alert', x: p.x, y: p.y });
  const keeper = f.monsters.find((m) => m.id === f.shop.keeperId);
  if (keeper) angerKeeper(g, keeper);
  const spots = freeTilesAround(g, p.x, p.y, 3);
  for (let i = 0; i < 2 && i < spots.length; i++) {
    const m = createMonster(g, 'banpei', spots[i].x, spots[i].y);
    m.aware = 999;
  }
  msg(g, 'ばんぺいが かけつけてきた！', 'bad');
}
