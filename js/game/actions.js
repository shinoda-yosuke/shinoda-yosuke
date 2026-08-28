// Player actions. Every function returns { turn: boolean, prompt?: {...}, floor?: true }.
import { DIRS, T } from '../core/util.js';
import { ITEMS, displayName, sellPrice, itemPrice } from '../data/items.js';
import { TRAPS } from '../data/traps.js';
import { msg } from './log.js';
import { monsterAt, itemAt, trapAt, canPass, canAttackDir, tileAt, roomIdAt, isShopTile, isOccupied } from './floor.js';
import { updateFov } from './fov.js';
import { playerAttack } from './combat.js';
import { eatHerb, readScroll, zapStaff, throwAt, triggerTrap } from './effects.js';
import { findInv, addToInv, removeFromInv, unpaidTotal } from './inventory.js';
import { endPlayerAction } from './turn.js';
import { enterFloor } from './state.js';

const NO_TURN = Object.freeze({ turn: false });

function finish(g, opts) {
  endPlayerAction(g, opts);
  return { turn: true };
}

/** finish(), adding a stairs prompt when the player ended up on the stairs somewhere new. */
function finishMoved(g, before) {
  const out = finish(g);
  const p = g.player;
  if (g.phase === 'play' && (p.x !== before.x || p.y !== before.y) && tileAt(g.floor, p.x, p.y) === T.STAIRS) {
    out.prompt = { type: 'stairs' };
  }
  return out;
}

function keeperGoHome(g) {
  const f = g.floor;
  if (!f.shop) return;
  const k = f.monsters.find((m) => m.id === f.shop.keeperId);
  if (!k || k.angry || !k.home) return;
  if ((k.x !== k.home.x || k.y !== k.home.y) && !isOccupied(g, k.home.x, k.home.y)) {
    k.x = k.home.x;
    k.y = k.home.y;
  }
}

export function shopTalk(g) {
  const total = unpaidTotal(g);
  if (total > 0) return { type: 'buy', total, canPay: g.player.gold >= total };
  keeperGoHome(g);
  return { type: 'talk', text: '「いらっしゃい！ ゆっくり 見ていってね」' };
}

function tryPickup(g, e) {
  const p = g.player;
  const f = g.floor;
  const item = e.item;
  const d = ITEMS[item.id];
  if (d.cat === 'gold') {
    p.gold += item.amount;
    f.items.splice(f.items.indexOf(e), 1);
    msg(g, `${item.amount} 金貨を 手に入れた`, 'good');
    g.events.push({ t: 'fx', kind: 'gold', x: p.x, y: p.y });
    return true;
  }
  const merch = !!item.price;
  if (!addToInv(g, item)) {
    msg(g, `${displayName(item)}の 上に 乗った。持ち物が いっぱいだ`);
    return false;
  }
  f.items.splice(f.items.indexOf(e), 1);
  if (merch) {
    item.unpaid = true;
    msg(g, `${displayName(item)}を 手に取った（${item.price} 金貨）`);
  } else msg(g, `${displayName(item)}を 拾った`);
  return true;
}

/** Things that happen when the player lands on a tile. Returns { fell } when a pit dropped us. */
function arrive(g) {
  const p = g.player;
  const f = g.floor;
  updateFov(g);
  const e = itemAt(f, p.x, p.y);
  if (e) tryPickup(g, e);
  const rid = roomIdAt(f, p.x, p.y);
  if (rid >= 0 && rid === f.mhRoomId && !f.mhTriggered) {
    f.mhTriggered = true;
    msg(g, 'モンスターハウスだ！', 'bad');
    g.events.push({ t: 'fx', kind: 'alert', x: p.x, y: p.y });
    for (const m of f.monsters) {
      if (roomIdAt(f, m.x, m.y) === rid) {
        m.asleep = false;
        m.aware = 30;
      }
    }
  }
  if (f.shop && rid === f.shop.roomId && !f.shop.greeted) {
    f.shop.greeted = true;
    msg(g, '「いらっしゃい！ ゆっくり 見ていってね」');
  }
  const tr = trapAt(f, p.x, p.y);
  if (tr) return triggerTrap(g, tr);
  return {};
}

export function move(g, dir) {
  const p = g.player;
  const f = g.floor;
  if (g.phase !== 'play') return NO_TURN;
  if (p.st.sleep > 0) return wait(g);
  if (p.st.confuse > 0 && g.rng.chance(0.75)) dir = g.rng.int(0, 7);
  const { dx, dy } = DIRS[dir];
  const nx = p.x + dx;
  const ny = p.y + dy;
  const m = monsterAt(f, nx, ny);
  if (m) {
    p.dir = dir;
    if (!canAttackDir(f, p.x, p.y, dir)) return NO_TURN;
    if (m.keeper && !m.angry) return { turn: false, prompt: shopTalk(g) };
    playerAttack(g, m);
    return finish(g);
  }
  if (!canPass(f, p.x, p.y, dir)) {
    p.dir = dir;
    return NO_TURN;
  }
  const before = { x: p.x, y: p.y };
  p.dir = dir;
  p.x = nx;
  p.y = ny;
  p.steps++;
  const r = arrive(g);
  if (r.fell) return finish(g, { skipMonsters: true });
  return finishMoved(g, before);
}

export function attack(g) {
  const p = g.player;
  const f = g.floor;
  if (g.phase !== 'play') return NO_TURN;
  if (p.st.sleep > 0) return wait(g);
  const dir = p.st.confuse > 0 && g.rng.chance(0.5) ? g.rng.int(0, 7) : p.dir;
  if (!canAttackDir(f, p.x, p.y, dir)) {
    msg(g, 'そちらには 攻撃できない');
    return NO_TURN;
  }
  const nx = p.x + DIRS[dir].dx;
  const ny = p.y + DIRS[dir].dy;
  const m = monsterAt(f, nx, ny);
  if (m) playerAttack(g, m);
  else {
    g.events.push({ t: 'attack', who: 'p', id: 0, dir });
    const tr = trapAt(f, nx, ny);
    if (tr && !tr.visible) {
      tr.visible = true;
      msg(g, `${TRAPS[tr.id].name}を 見つけた！`, 'good');
    } else msg(g, `${p.name}は 素振りした`);
  }
  return finish(g);
}

export function wait(g) {
  if (g.phase !== 'play') return NO_TURN;
  return finish(g);
}

export function face(g, dir) {
  g.player.dir = dir;
  return NO_TURN;
}

function confusedAim(g) {
  const p = g.player;
  if (p.st.confuse > 0 && g.rng.chance(0.5)) p.dir = g.rng.int(0, 7);
}

export function useItem(g, uid) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const item = findInv(g, uid);
  if (!item) return NO_TURN;
  if (item.unpaid) {
    msg(g, 'まだ お金を 払っていない');
    return NO_TURN;
  }
  if (p.st.sleep > 0) return wait(g);
  const d = ITEMS[item.id];
  const before = { x: p.x, y: p.y };
  switch (d.cat) {
    case 'herb':
      removeFromInv(g, item);
      eatHerb(g, item);
      return finish(g);
    case 'scroll':
      removeFromInv(g, item);
      readScroll(g, item);
      return finishMoved(g, before);
    case 'staff':
      confusedAim(g);
      if (!zapStaff(g, item)) return NO_TURN;
      return finishMoved(g, before);
    case 'weapon':
    case 'shield':
      return equip(g, uid);
    case 'arrow':
      return fireArrow(g, uid);
    default:
      return NO_TURN;
  }
}

export function equip(g, uid) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const item = findInv(g, uid);
  if (!item) return NO_TURN;
  if (item.unpaid) {
    msg(g, 'まだ お金を 払っていない');
    return NO_TURN;
  }
  const d = ITEMS[item.id];
  const slot = d.cat === 'weapon' ? 'weapon' : d.cat === 'shield' ? 'shield' : null;
  if (!slot) return NO_TURN;
  if (p[slot] === uid) {
    p[slot] = null;
    msg(g, `${displayName(item)}を はずした`);
  } else {
    p[slot] = uid;
    msg(g, `${displayName(item)}を 装備した`, 'good');
  }
  g.events.push({ t: 'fx', kind: 'equip', x: p.x, y: p.y });
  return finish(g);
}

function detachOne(g, item) {
  const d = ITEMS[item.id];
  if (d.cat === 'arrow' && item.count > 1) {
    item.count--;
    return { ...item, uid: g.nextId++, count: 1 };
  }
  removeFromInv(g, item);
  return item;
}

export function throwItem(g, uid) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const item = findInv(g, uid);
  if (!item) return NO_TURN;
  if (item.unpaid) {
    msg(g, 'まだ お金を 払っていない');
    return NO_TURN;
  }
  if (p.st.sleep > 0) return wait(g);
  confusedAim(g);
  throwAt(g, detachOne(g, item), '投げた');
  return finish(g);
}

export function fireArrow(g, uid) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const item = uid ? findInv(g, uid) : p.inv.find((i) => ITEMS[i.id].cat === 'arrow' && !i.unpaid);
  if (!item || ITEMS[item.id].cat !== 'arrow') {
    msg(g, '矢を 持っていない');
    return NO_TURN;
  }
  if (item.unpaid) {
    msg(g, 'まだ お金を 払っていない');
    return NO_TURN;
  }
  if (p.st.sleep > 0) return wait(g);
  confusedAim(g);
  throwAt(g, detachOne(g, item), '放った');
  return finish(g);
}

export function dropItem(g, uid) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const f = g.floor;
  const item = findInv(g, uid);
  if (!item) return NO_TURN;
  if (p.weapon === uid || p.shield === uid) {
    msg(g, '装備している物は 置けない');
    return NO_TURN;
  }
  if (itemAt(f, p.x, p.y) || tileAt(f, p.x, p.y) === T.STAIRS) {
    msg(g, 'ここには 置けない');
    return NO_TURN;
  }
  if (f.shop && isShopTile(f, p.x, p.y)) {
    const s = f.shop;
    if ((p.x === s.innerX && p.y === s.innerY) || (p.x === s.doorX && p.y === s.doorY)) {
      msg(g, 'ここには 置けない');
      return NO_TURN;
    }
    if (item.unpaid) {
      item.unpaid = false;
      removeFromInv(g, item);
      f.items.push({ x: p.x, y: p.y, item });
      msg(g, `${displayName(item)}を 棚に 戻した`);
      return finish(g);
    }
    if (s.keeperId) {
      return { turn: false, prompt: { type: 'sell', uid, price: sellPrice(item), name: displayName(item) } };
    }
  }
  removeFromInv(g, item);
  f.items.push({ x: p.x, y: p.y, item });
  msg(g, `${displayName(item)}を 置いた`);
  return finish(g);
}

export function sellItem(g, uid) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const f = g.floor;
  const item = findInv(g, uid);
  if (!item) return NO_TURN;
  if (itemAt(f, p.x, p.y)) {
    msg(g, 'ここには 置けない');
    return NO_TURN;
  }
  const price = sellPrice(item);
  removeFromInv(g, item);
  item.price = itemPrice(item);
  f.items.push({ x: p.x, y: p.y, item });
  p.gold += price;
  msg(g, `${displayName(item)}を ${price} 金貨で 売った`, 'good');
  g.events.push({ t: 'fx', kind: 'gold', x: p.x, y: p.y });
  return finish(g);
}

export function payShop(g) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const total = unpaidTotal(g);
  if (total <= 0) return NO_TURN;
  if (p.gold < total) {
    msg(g, '「お金が 足りないよ」');
    return NO_TURN;
  }
  p.gold -= total;
  for (const i of p.inv) {
    if (i.unpaid) {
      i.unpaid = false;
      delete i.price;
    }
  }
  msg(g, `${total} 金貨を 払った。「ありがとう！ また来てね」`, 'good');
  g.events.push({ t: 'fx', kind: 'gold', x: p.x, y: p.y });
  keeperGoHome(g);
  return NO_TURN;
}

export function pickupHere(g) {
  if (g.phase !== 'play') return NO_TURN;
  const p = g.player;
  const e = itemAt(g.floor, p.x, p.y);
  if (!e) {
    msg(g, '足元には 何もない');
    return NO_TURN;
  }
  if (!tryPickup(g, e)) return NO_TURN;
  return finish(g);
}

export function descend(g) {
  if (g.phase !== 'play') return NO_TURN;
  enterFloor(g, g.depth + 1);
  return { turn: false, floor: true };
}
