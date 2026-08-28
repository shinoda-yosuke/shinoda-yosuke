// Creating monsters and items.
import { MONSTERS, depthScale } from '../data/monsters.js';
import { ITEMS, CATEGORY_WEIGHTS, itemsOfCategory } from '../data/items.js';

export function createMonster(g, kind, x, y, opts = {}) {
  const d = MONSTERS[kind];
  if (!d) throw new Error(`unknown monster ${kind}`);
  const special = d.guardian || d.keeper || kind === 'banpei';
  const sc = opts.scale ?? (special ? 1 : depthScale(g.depth));
  const m = {
    id: g.nextId++,
    kind,
    name: d.name,
    x,
    y,
    dir: 4,
    maxHp: Math.max(1, Math.round(d.hp * sc)),
    hp: 0,
    atk: Math.max(1, Math.round(d.atk * sc)),
    def: Math.round(d.def * (1 + (sc - 1) * 0.5)),
    exp: Math.round(d.exp * sc),
    speed: d.speed,
    energy: 0,
    asleep: !!opts.asleep,
    aware: 0,
    st: { sleep: 0, confuse: 0, slow: 0, haste: 0 },
    sealed: false,
    stolen: null,
    stolenGold: 0,
    flee: 0,
    wander: null,
    stuck: 0,
    splits: opts.splits || 0,
    summonCd: 3,
    guardian: !!d.guardian,
    keeper: !!d.keeper,
    angry: false,
    home: null,
    block: null,
  };
  m.hp = m.maxHp;
  g.floor.monsters.push(m);
  return m;
}

export function removeMonster(g, m) {
  const i = g.floor.monsters.indexOf(m);
  if (i >= 0) g.floor.monsters.splice(i, 1);
}

/** Does monster m have ability ab? Sealed monsters lose abilities (phase/explode are innate). */
export function hasAb(m, ab, ignoreSeal = false) {
  const d = MONSTERS[m.kind];
  if (!d || !d.ab || !d.ab.includes(ab)) return false;
  if (m.sealed && !ignoreSeal && ab !== 'phase' && ab !== 'explode') return false;
  return true;
}

function rollPlus(rng) {
  const r = rng.next();
  if (r < 0.6) return 0;
  if (r < 0.85) return 1;
  if (r < 0.95) return 2;
  return 3;
}

export function createItem(g, id, opts = {}) {
  const d = ITEMS[id];
  if (!d) throw new Error(`unknown item ${id}`);
  const it = { uid: g.nextId++, id };
  if (d.cat === 'weapon' || d.cat === 'shield') it.plus = opts.plus ?? rollPlus(g.rng);
  if (d.cat === 'arrow') it.count = opts.count ?? g.rng.int(d.stack[0], d.stack[1]);
  if (d.cat === 'staff') it.charges = opts.charges ?? g.rng.int(d.charges[0], d.charges[1]);
  if (d.cat === 'gold') it.amount = opts.amount ?? 10;
  return it;
}

export function goldAmount(g, depth) {
  return g.rng.int(10, 40) + depth * g.rng.int(4, 12);
}

/** Random floor item for a depth. opts.noGold excludes gold, opts.cat forces a category. */
export function randomItem(g, depth, opts = {}) {
  let cat = opts.cat;
  if (!cat) {
    const table = opts.noGold ? CATEGORY_WEIGHTS.filter((c) => c.v !== 'gold') : CATEGORY_WEIGHTS;
    cat = g.rng.weighted(table);
  }
  if (cat === 'gold') return createItem(g, 'gold', { amount: goldAmount(g, depth) });
  const id = g.rng.weighted(itemsOfCategory(cat, depth));
  return createItem(g, id);
}

/** A good piece of equipment for guardian rewards: one of the top-2 tiers available at depth. */
export function randomEquipment(g, depth, plus) {
  const cat = g.rng.chance(0.5) ? 'weapon' : 'shield';
  const key = cat === 'weapon' ? 'atk' : 'def';
  const ids = itemsOfCategory(cat, depth)
    .map((e) => e.v)
    .sort((a, b) => ITEMS[b][key] - ITEMS[a][key]);
  const id = g.rng.pick(ids.slice(0, 2));
  return createItem(g, id, { plus });
}
