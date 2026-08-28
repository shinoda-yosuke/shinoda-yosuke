// Item effects, traps, explosions, monster on-hit abilities, teleports.
import { DIRS, T, cheb } from '../core/util.js';
import { ITEMS, displayName } from '../data/items.js';
import { MONSTERS, spawnTable } from '../data/monsters.js';
import { TRAPS } from '../data/traps.js';
import { msg } from './log.js';
import { itemAt, monsterAt, roomIdAt, isWalkable, tileAt, freeTilesAround, randomFreeTile, isShopTile, lineTiles, isOccupied } from './floor.js';
import { createMonster, createItem, hasAb, randomEquipment, removeMonster } from './spawn.js';
import { damageMonster, damagePlayer, getWeapon, getShield, calcDamage, playerDef } from './combat.js';
import { updateFov, revealMap } from './fov.js';
import { removeFromInv } from './inventory.js';
import { enterFloor } from './state.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Put an item on the floor at/near (x,y). Returns the spot or null if it vanished. */
export function dropItemNear(g, item, x, y) {
  const f = g.floor;
  const ok = (t) => isWalkable(f, t.x, t.y) && !itemAt(f, t.x, t.y) && tileAt(f, t.x, t.y) !== T.STAIRS;
  const spots = [{ x, y }, ...freeTilesAround(g, x, y, 3, { allowOccupied: true, noItem: true, noStairs: true })].filter(ok);
  if (!spots.length) {
    msg(g, `${displayName(item)}は どこかへ 消えてしまった`);
    return null;
  }
  const s = spots[0];
  f.items.push({ x: s.x, y: s.y, item });
  return s;
}

export function teleportPlayer(g, x, y) {
  const p = g.player;
  p.x = x;
  p.y = y;
  updateFov(g);
  g.events.push({ t: 'fx', kind: 'warp', x, y });
}

export function removeTrap(g, trap) {
  const i = g.floor.traps.indexOf(trap);
  if (i >= 0) g.floor.traps.splice(i, 1);
}

/** Monsters affected by room-wide effects: the whole room, or adjacent tiles in a corridor. */
export function roomTargets(g) {
  const p = g.player;
  const f = g.floor;
  const rid = roomIdAt(f, p.x, p.y);
  return f.monsters.filter((m) => {
    if (cheb(m.x, m.y, p.x, p.y) <= 1) return true;
    return rid >= 0 && roomIdAt(f, m.x, m.y) === rid;
  });
}

export function summonAround(g, x, y, n, opts = {}) {
  const spots = freeTilesAround(g, x, y, 2);
  const table = spawnTable(g.depth);
  let made = 0;
  for (let i = 0; i < n && i < spots.length; i++) {
    if (g.floor.monsters.length >= 26) break;
    const m = createMonster(g, g.rng.weighted(table), spots[i].x, spots[i].y);
    m.aware = opts.awake ? 20 : 0;
    m.energy = 0;
    made++;
  }
  return made;
}

// ---------------------------------------------------------------------------
// herbs
// ---------------------------------------------------------------------------

function healPlayer(g, n, maxUp) {
  const p = g.player;
  if (p.hp >= p.maxHp) {
    p.maxHp += maxUp;
    p.hp = p.maxHp;
    msg(g, `最大 HP が ${maxUp} 上がった！`, 'good');
  } else {
    p.hp = Math.min(p.maxHp, p.hp + n);
    msg(g, 'HP が 回復した', 'good');
  }
}

export function eatHerb(g, item) {
  const p = g.player;
  const d = ITEMS[item.id];
  msg(g, `${p.name}は ${d.name}を 食べた`);
  switch (d.effect) {
    case 'heal':
      healPlayer(g, 30, 1);
      break;
    case 'bigheal':
      healPlayer(g, 100, 2);
      break;
    case 'cure':
      p.str = p.maxStr;
      p.st.sleep = 0;
      p.st.confuse = 0;
      p.st.slow = 0;
      msg(g, 'からだが すっきりした！', 'good');
      break;
    case 'str':
      if (p.maxStr < 40) p.maxStr++;
      p.str = Math.min(p.maxStr, p.str + 1);
      msg(g, `ちからが ${p.str} に 上がった！`, 'good');
      break;
    case 'sleep':
      p.st.sleep = Math.max(p.st.sleep, 5);
      msg(g, `${p.name}は ねむってしまった……`, 'bad');
      break;
    case 'confuse':
      p.st.confuse = Math.max(p.st.confuse, 8);
      msg(g, `${p.name}は 混乱した！`, 'bad');
      break;
    case 'poison':
      if (p.str > 1) {
        p.str--;
        msg(g, `ちからが ${p.str} に 下がった……`, 'bad');
      } else msg(g, 'まずい……');
      break;
    case 'haste':
      p.st.haste = Math.max(p.st.haste, 20);
      p.st.slow = 0;
      msg(g, `${p.name}の 動きが はやくなった！`, 'good');
      break;
    default:
      msg(g, 'しかし なにも起こらなかった');
  }
  g.events.push({ t: 'fx', kind: d.effect === 'heal' || d.effect === 'bigheal' ? 'heal' : 'sparkle', x: p.x, y: p.y });
}

export function herbOnMonster(g, item, m) {
  const d = ITEMS[item.id];
  switch (d.effect) {
    case 'heal':
      m.hp = Math.min(m.maxHp, m.hp + 30);
      msg(g, `${m.name}の HP が 回復した`);
      break;
    case 'bigheal':
      m.hp = m.maxHp;
      msg(g, `${m.name}の HP が 回復した`);
      break;
    case 'cure':
      m.st = { sleep: 0, confuse: 0, slow: 0, haste: 0 };
      msg(g, `${m.name}は 元気になった`);
      break;
    case 'str':
      m.atk += 2;
      msg(g, `${m.name}は 力が わいてきた！`, 'bad');
      break;
    case 'sleep':
      m.st.sleep = Math.max(m.st.sleep, 6);
      msg(g, `${m.name}は ねむった`, 'good');
      break;
    case 'confuse':
      m.st.confuse = Math.max(m.st.confuse, 8);
      msg(g, `${m.name}は 混乱した`, 'good');
      break;
    case 'poison':
      m.atk = Math.max(1, m.atk - 3);
      msg(g, `${m.name}は 弱った`, 'good');
      damageMonster(g, m, 5, 'player');
      break;
    case 'haste':
      m.st.haste = 20;
      m.st.slow = 0;
      msg(g, `${m.name}の 動きが はやくなった！`, 'bad');
      break;
    default:
      break;
  }
  g.events.push({ t: 'fx', kind: 'sparkle', x: m.x, y: m.y });
}

// ---------------------------------------------------------------------------
// scrolls
// ---------------------------------------------------------------------------

export function readScroll(g, item) {
  const p = g.player;
  const f = g.floor;
  const d = ITEMS[item.id];
  msg(g, `${p.name}は ${d.name}を 読んだ`);
  g.events.push({ t: 'fx', kind: 'scroll', x: p.x, y: p.y });
  switch (d.effect) {
    case 'thunder': {
      const ts = roomTargets(g);
      if (!ts.length) msg(g, 'しかし なにも起こらなかった');
      for (const m of ts) {
        msg(g, `いかずちが ${m.name}に 落ちた！`);
        g.events.push({ t: 'fx', kind: 'thunder', x: m.x, y: m.y });
        damageMonster(g, m, 30, 'playerIndirect');
      }
      break;
    }
    case 'map':
      revealMap(f);
      msg(g, 'この階の 地形が 頭に浮かんだ！', 'good');
      break;
    case 'traps': {
      const rid = roomIdAt(f, p.x, p.y);
      let n = 0;
      f.traps = f.traps.filter((t) => {
        if (rid >= 0 && roomIdAt(f, t.x, t.y) === rid) {
          n++;
          return false;
        }
        return true;
      });
      for (const t of f.traps) t.visible = true;
      msg(g, n ? `部屋の罠が ${n} 個 消えた。この階の罠の位置が 分かった` : 'この階の罠の位置が 分かった', 'good');
      break;
    }
    case 'weapon': {
      const w = getWeapon(g);
      if (w) {
        w.plus = (w.plus || 0) + 1;
        msg(g, `${displayName(w)}に なった！`, 'good');
      } else msg(g, 'しかし なにも起こらなかった');
      break;
    }
    case 'shield': {
      const s = getShield(g);
      if (s) {
        s.plus = (s.plus || 0) + 1;
        msg(g, `${displayName(s)}に なった！`, 'good');
      } else msg(g, 'しかし なにも起こらなかった');
      break;
    }
    case 'sleepall': {
      const ts = roomTargets(g);
      if (!ts.length) msg(g, 'しかし なにも起こらなかった');
      for (const m of ts) {
        m.st.sleep = Math.max(m.st.sleep, 8);
        msg(g, `${m.name}は ねむった`, 'good');
      }
      break;
    }
    case 'light':
      f.lit = true;
      msg(g, '迷宮が あかりに 照らされた！', 'good');
      break;
    case 'summon':
      summonAround(g, p.x, p.y, 3, { awake: true });
      msg(g, 'まわりに 敵が あらわれた！', 'bad');
      break;
    case 'stairs': {
      const s = f.stairs;
      const target = !isOccupied(g, s.x, s.y) ? s : freeTilesAround(g, s.x, s.y, 2)[0];
      if (target) {
        teleportPlayer(g, target.x, target.y);
        msg(g, '階段の前に 飛んだ！', 'good');
      } else msg(g, 'しかし なにも起こらなかった');
      break;
    }
    default:
      msg(g, 'しかし なにも起こらなかった');
  }
}

// ---------------------------------------------------------------------------
// staffs
// ---------------------------------------------------------------------------

/** Returns false when the staff could not be used (no turn consumed). */
export function zapStaff(g, item) {
  const p = g.player;
  const d = ITEMS[item.id];
  if (item.charges <= 0) {
    msg(g, `${d.name}は もう 使えない`);
    return false;
  }
  item.charges--;
  msg(g, `${p.name}は ${d.name}を ふった`);
  const line = lineTiles(g.floor, p.x, p.y, p.dir, 10);
  let target = null;
  let last = { x: p.x, y: p.y };
  for (const t of line) {
    last = t;
    const m = monsterAt(g.floor, t.x, t.y);
    if (m) {
      target = m;
      break;
    }
  }
  g.events.push({ t: 'proj', fx: p.x, fy: p.y, tx: last.x, ty: last.y, kind: 'magic' });
  if (!target) {
    msg(g, '光は 何にも 当たらなかった');
    return true;
  }
  staffEffect(g, d.effect, target);
  return true;
}

function staffEffect(g, effect, m) {
  const p = g.player;
  const f = g.floor;
  m.asleep = false;
  if (m.aware < 15) m.aware = 15;
  switch (effect) {
    case 'blow': {
      const { dx, dy } = DIRS[p.dir];
      let moved = 0;
      while (moved < 10) {
        const nx = m.x + dx;
        const ny = m.y + dy;
        if (!isWalkable(f, nx, ny) || isOccupied(g, nx, ny)) break;
        m.x = nx;
        m.y = ny;
        moved++;
      }
      msg(g, `${m.name}は ふきとばされた！`);
      g.events.push({ t: 'fx', kind: 'hit', x: m.x, y: m.y });
      damageMonster(g, m, 5, 'player');
      break;
    }
    case 'slow':
      m.st.slow = 20;
      m.st.haste = 0;
      msg(g, `${m.name}の 動きが おそくなった`, 'good');
      break;
    case 'swap': {
      const mx = m.x;
      const my = m.y;
      m.x = p.x;
      m.y = p.y;
      teleportPlayer(g, mx, my);
      msg(g, `${m.name}と 場所が 入れかわった！`);
      break;
    }
    case 'seal':
      m.sealed = true;
      msg(g, `${m.name}の 特技が 封じられた`, 'good');
      break;
    case 'change': {
      const cands = spawnTable(g.depth).filter((e) => e.v !== m.kind);
      if (!cands.length) {
        msg(g, 'しかし なにも起こらなかった');
        break;
      }
      const id = g.rng.weighted(cands);
      const oldName = m.name;
      removeMonster(g, m);
      const nm = createMonster(g, id, m.x, m.y);
      nm.aware = 15;
      nm.energy = 0;
      msg(g, `${oldName}は ${nm.name}に 変わった！`);
      g.events.push({ t: 'fx', kind: 'sparkle', x: nm.x, y: nm.y });
      break;
    }
    case 'sleep':
      m.st.sleep = Math.max(m.st.sleep, 8);
      msg(g, `${m.name}は ねむった`, 'good');
      break;
    default:
      msg(g, 'しかし なにも起こらなかった');
  }
}

// ---------------------------------------------------------------------------
// throwing
// ---------------------------------------------------------------------------

function thrownDamage(g, item, m) {
  const d = ITEMS[item.id];
  const p = g.player;
  let base;
  if (d.cat === 'arrow') base = d.atk + Math.floor(p.str / 3) + Math.floor(p.lv / 3);
  else if (d.cat === 'weapon') base = d.atk + (item.plus || 0) + 2;
  else if (d.cat === 'shield') base = d.def + (item.plus || 0) + 1;
  else if (d.cat === 'staff') base = 3;
  else base = 1;
  return calcDamage(g.rng, base, m.def);
}

/** Throw/shoot `item` (already detached from the inventory) in the facing direction. */
export function throwAt(g, item, verb = '投げた') {
  const p = g.player;
  const f = g.floor;
  const d = ITEMS[item.id];
  msg(g, `${p.name}は ${displayName(item)}を ${verb}`);
  const line = lineTiles(f, p.x, p.y, p.dir, 10);
  let target = null;
  let last = { x: p.x, y: p.y };
  for (const t of line) {
    last = t;
    const m = monsterAt(f, t.x, t.y);
    if (m) {
      target = m;
      break;
    }
  }
  g.events.push({ t: 'proj', fx: p.x, fy: p.y, tx: last.x, ty: last.y, kind: d.cat === 'arrow' ? 'arrow' : 'item', item: item.id });
  if (target) {
    target.asleep = false;
    if (target.aware < 15) target.aware = 15;
    if (target.keeper && !target.angry) {
      target.angry = true;
      target.aware = 999;
      target.speed = 200;
      msg(g, `${target.name}は おこった！「どろぼうめ！」`, 'bad');
    }
    if (g.rng.chance(0.9)) {
      if (d.cat === 'herb') {
        msg(g, `${displayName(item)}は ${target.name}に 当たった`);
        herbOnMonster(g, item, target);
        return;
      }
      const dmg = thrownDamage(g, item, target);
      msg(g, `${displayName(item)}は ${target.name}に 当たった！ ${dmg} のダメージ`);
      damageMonster(g, target, dmg, 'player');
      if (d.cat === 'arrow') return; // arrows break
      dropItemNear(g, item, target.x, target.y);
      return;
    }
    msg(g, `${displayName(item)}は ${target.name}に 当たらなかった`);
    dropItemNear(g, item, target.x, target.y);
    return;
  }
  dropItemNear(g, item, last.x, last.y);
}

// ---------------------------------------------------------------------------
// traps
// ---------------------------------------------------------------------------

/** Returns { fell: true } when the player dropped to the next floor. */
export function triggerTrap(g, trap) {
  const p = g.player;
  const d = TRAPS[trap.id];
  const wasVisible = trap.visible;
  trap.visible = true;
  if (wasVisible && g.rng.chance(0.5)) {
    msg(g, `${d.name}を よけた！`);
    return {};
  }
  msg(g, `${d.name}だ！`, 'bad');
  g.events.push({ t: 'fx', kind: 'trap', x: p.x, y: p.y });
  switch (trap.id) {
    case 't_pit': {
      // legacy id: an updraft that carries you straight up to the next floor
      msg(g, `${p.name}は つむじ風に 巻き上げられた！`);
      enterFloor(g, g.depth + 1, { fell: true });
      return { fell: true };
    }
    case 't_poison':
      damagePlayer(g, 3, 'どくばりに やられた');
      if (g.phase === 'play' && p.str > 1) {
        p.str--;
        msg(g, `毒で ちからが ${p.str} に 下がった……`, 'bad');
      }
      break;
    case 't_warp': {
      const f = g.floor;
      const t = randomFreeTile(g, (x, y) => !isShopTile(f, x, y) && tileAt(f, x, y) !== T.STAIRS && cheb(x, y, p.x, p.y) > 5);
      if (t) teleportPlayer(g, t.x, t.y);
      msg(g, `${p.name}は どこかへ 飛ばされた！`);
      break;
    }
    case 't_confuse':
      p.st.confuse = Math.max(p.st.confuse, 8);
      msg(g, `${p.name}は 混乱した！`, 'bad');
      break;
    case 't_rust': {
      const s = getShield(g) || getWeapon(g);
      if (s) {
        s.plus = (s.plus || 0) - 1;
        msg(g, `${displayName(s)}に なってしまった……`, 'bad');
      } else msg(g, 'しかし なにも起こらなかった');
      break;
    }
    case 't_sleep':
      p.st.sleep = Math.max(p.st.sleep, 4);
      msg(g, `${p.name}は ねむってしまった……`, 'bad');
      break;
    case 't_mine':
      removeTrap(g, trap);
      explodeAt(g, p.x, p.y, null, true);
      break;
    case 't_summon':
      summonAround(g, p.x, p.y, g.rng.int(2, 3), { awake: true });
      msg(g, 'まわりに 敵が あらわれた！', 'bad');
      break;
    default:
      break;
  }
  return {};
}

/** 3x3 explosion. Mines halve the player's HP (never lethal); monster explosions deal flat damage. */
export function explodeAt(g, x, y, source, isMine) {
  const p = g.player;
  g.events.push({ t: 'fx', kind: 'explosion', x, y });
  msg(g, '大爆発！', 'bad');
  if (cheb(p.x, p.y, x, y) <= 1) {
    if (isMine) {
      const dmg = Math.floor(p.hp / 2);
      if (dmg > 0) {
        p.hp -= dmg;
        g.events.push({ t: 'dmg', x: p.x, y: p.y, n: dmg, who: 'p' });
        msg(g, `${p.name}は ${dmg} のダメージを 受けた`, 'bad');
      }
    } else {
      const dmg = 15 + Math.floor(g.depth / 3);
      msg(g, `${p.name}は 爆発に 巻きこまれた！`, 'bad');
      damagePlayer(g, dmg, `${source ? source.name : '爆発'}の 爆発に 巻きこまれた`);
    }
  }
  for (const m of [...g.floor.monsters]) {
    if (m === source) continue;
    if (cheb(m.x, m.y, x, y) <= 1) damageMonster(g, m, 30, 'playerIndirect');
  }
}

// ---------------------------------------------------------------------------
// monster on-hit abilities
// ---------------------------------------------------------------------------

export function applyHitAbility(g, m) {
  const p = g.player;
  const rng = g.rng;
  if (hasAb(m, 'poisonHit') && rng.chance(0.4) && p.str > 1) {
    p.str--;
    msg(g, `毒で ちからが ${p.str} に 下がった……`, 'bad');
  }
  if (hasAb(m, 'sleepHit') && rng.chance(0.3) && p.st.sleep === 0) {
    p.st.sleep = rng.int(2, 4);
    msg(g, `${p.name}は ねむってしまった……`, 'bad');
  }
  if (hasAb(m, 'confuseHit') && rng.chance(0.35)) {
    p.st.confuse = Math.max(p.st.confuse, 6);
    msg(g, `${p.name}は 混乱した！`, 'bad');
  }
  if (hasAb(m, 'rustHit') && rng.chance(0.4)) {
    const s = getShield(g) || getWeapon(g);
    if (s) {
      s.plus = (s.plus || 0) - 1;
      msg(g, `${displayName(s)}に なってしまった……`, 'bad');
    }
  }
  if (hasAb(m, 'steal') && !m.stolen && !m.stolenGold && rng.chance(0.7)) stealFrom(g, m);
}

function stealFrom(g, m) {
  const p = g.player;
  const cands = p.inv.filter((i) => i.uid !== p.weapon && i.uid !== p.shield && !i.unpaid);
  if (cands.length) {
    const it = g.rng.pick(cands);
    removeFromInv(g, it);
    m.stolen = it;
    msg(g, `${m.name}は ${displayName(it)}を 盗んだ！`, 'bad');
  } else if (p.gold > 0) {
    const n = Math.min(p.gold, 50 + g.depth * 10);
    p.gold -= n;
    m.stolenGold = n;
    msg(g, `${m.name}は ${n} 金貨を 盗んだ！`, 'bad');
  } else return;
  m.flee = 30;
  m.speed = 200;
  m.aware = 999;
}

// ---------------------------------------------------------------------------
// guardians
// ---------------------------------------------------------------------------

export function guardianReward(g, m) {
  msg(g, `番人 ${m.name}を 打ちたおした！`, 'good');
  g.events.push({ t: 'fx', kind: 'victory', x: m.x, y: m.y });
  const eq = randomEquipment(g, g.depth + 8, 2 + Math.floor(g.depth / 20));
  dropItemNear(g, eq, m.x, m.y);
  dropItemNear(g, createItem(g, 'gold', { amount: 200 + 30 * g.depth }), m.x, m.y);
  msg(g, `${displayName(eq)}と 金貨が 落ちている`, 'good');
}

/** Ranged attack by a monster that is aligned with the player. */
export function monsterRanged(g, m) {
  const p = g.player;
  const d = MONSTERS[m.kind];
  msg(g, `${m.name}は ${d.rangedName || 'なにか'}を はなった！`);
  g.events.push({ t: 'proj', fx: m.x, fy: m.y, tx: p.x, ty: p.y, kind: d.rangedFx || 'fire' });
  if (!g.rng.chance(0.85)) {
    msg(g, `${p.name}は かわした`);
    g.events.push({ t: 'miss', x: p.x, y: p.y });
    return;
  }
  const dmg = calcDamage(g.rng, Math.max(1, Math.round(m.atk * 0.8)), playerDef(g));
  msg(g, `${p.name}に ${dmg} のダメージ`, 'bad');
  damagePlayer(g, dmg, `${m.name}の ${d.rangedName || '攻撃'}で やられた`);
  if (g.phase === 'play' && hasAb(m, 'confuseHit') && g.rng.chance(0.35)) {
    p.st.confuse = Math.max(p.st.confuse, 6);
    msg(g, `${p.name}は 混乱した！`, 'bad');
  }
}
