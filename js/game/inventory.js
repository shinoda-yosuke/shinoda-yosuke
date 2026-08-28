import { INV_MAX } from '../core/util.js';
import { ITEMS } from '../data/items.js';

export function findInv(g, uid) {
  return g.player.inv.find((i) => i.uid === uid) || null;
}

/** Add an item to the inventory (arrows stack). Returns false when full. */
export function addToInv(g, item) {
  const p = g.player;
  const d = ITEMS[item.id];
  if (d.cat === 'arrow' && !item.price && !item.unpaid) {
    const stack = p.inv.find((i) => i.id === item.id && !i.unpaid && i.count < 99);
    if (stack) {
      const room = 99 - stack.count;
      const n = Math.min(room, item.count);
      stack.count += n;
      item.count -= n;
      if (item.count <= 0) return true;
    }
  }
  if (p.inv.length >= INV_MAX) return false;
  p.inv.push(item);
  return true;
}

export function removeFromInv(g, item) {
  const p = g.player;
  const i = p.inv.indexOf(item);
  if (i >= 0) p.inv.splice(i, 1);
  if (p.weapon === item.uid) p.weapon = null;
  if (p.shield === item.uid) p.shield = null;
}

export function unpaidTotal(g) {
  let t = 0;
  for (const i of g.player.inv) if (i.unpaid) t += i.price || 0;
  return t;
}
