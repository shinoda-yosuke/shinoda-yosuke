// Game state: creation, floor transitions, (de)serialization.
import { RNG } from '../core/rng.js';
import { buildFloor } from './dungeon.js';
import { updateFov } from './fov.js';
import { msg } from './log.js';
import { createItem } from './spawn.js';
import { themeFor } from '../data/themes.js';
import { isGuardianFloor } from '../data/monsters.js';

export const SAVE_VERSION = 1;

export function newGame(seed) {
  if (seed === undefined) seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const g = {
    v: SAVE_VERSION,
    seed,
    rng: new RNG(seed),
    phase: 'play',
    turn: 0,
    depth: 0,
    nextId: 1,
    log: [],
    logCount: 0,
    events: [],
    cause: '',
    score: 0,
    startedAt: Date.now(),
    player: {
      name: 'ルミ',
      x: 0,
      y: 0,
      dir: 4,
      hp: 15,
      maxHp: 15,
      lv: 1,
      exp: 0,
      totalExp: 0,
      str: 8,
      maxStr: 8,
      gold: 0,
      inv: [],
      weapon: null,
      shield: null,
      st: { sleep: 0, confuse: 0, haste: 0, slow: 0 },
      energy: 100,
      regen: 0,
      kills: 0,
      turns: 0,
      steps: 0,
      deepest: 1,
    },
    floor: null,
  };
  const knife = createItem(g, 'w_knife', { plus: 0 });
  g.player.inv.push(knife);
  g.player.weapon = knife.uid;
  g.player.inv.push(createItem(g, 'h_heal'));
  g.player.inv.push(createItem(g, 'a_wood', { count: 8 }));
  msg(g, '星が降った夜——。ルミは ランタンを手に、雲の上の迷宮へ 足を踏み入れた。', 'floor');
  enterFloor(g, 1);
  return g;
}

export function enterFloor(g, depth, opts = {}) {
  const p = g.player;
  g.depth = depth;
  if (depth > p.deepest) p.deepest = depth;
  p.energy = 100;
  // whatever you carried out of a shop is yours now
  for (const i of p.inv) {
    if (i.unpaid) {
      i.unpaid = false;
      delete i.price;
    }
  }
  buildFloor(g, depth);
  updateFov(g);
  g.events.push({ t: 'floor', depth });
  const th = themeFor(depth);
  msg(g, opts.fell ? `${depth}F へ 吹き上げられた ── ${th.name}` : `${depth}F ── ${th.name}`, 'floor');
  if (isGuardianFloor(depth)) msg(g, 'この階には 番人の 気配がする……', 'bad');
}

export function serialize(g) {
  const { events, ...rest } = g;
  const floor = { ...g.floor, visible: undefined };
  return JSON.stringify({ ...rest, floor });
}

export function deserialize(str) {
  let g;
  try {
    g = JSON.parse(str);
  } catch {
    return null;
  }
  if (!g || g.v !== SAVE_VERSION || !g.floor || !g.player) return null;
  g.rng = RNG.from(g.rng);
  g.events = [];
  g.floor.visible = new Array(g.floor.w * g.floor.h).fill(0);
  updateFov(g);
  return g;
}
