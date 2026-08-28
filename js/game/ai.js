// Monster behaviour.
import { DIRS, cheb, dirFromDelta } from '../core/util.js';
import { MONSTERS } from '../data/monsters.js';
import { canPass, canAttackDir, isOccupied, roomIdAt, bfs, isWalkable, monsterAt, sameRoom, freeTilesAround, randomRoomTile } from './floor.js';
import { monsterAttack } from './combat.js';
import { hasAb, createMonster, removeMonster } from './spawn.js';
import { monsterRanged } from './effects.js';
import { canSeeMonster } from './fov.js';
import { msg } from './log.js';

export function effSpeed(m) {
  let s = m.speed;
  if (m.st.haste > 0) s *= 2;
  if (m.st.slow > 0) s = Math.max(50, s / 2);
  return s;
}

export function monstersPhase(g) {
  const p = g.player;
  const f = g.floor;
  const dist = bfs(f, p.x, p.y);
  const list = [...f.monsters];
  for (const m of list) {
    if (m.hp <= 0 || !f.monsters.includes(m)) continue;
    m.energy += effSpeed(m);
    let guard = 0;
    while (m.energy >= 100 && m.hp > 0 && g.phase === 'play' && f.monsters.includes(m) && guard++ < 4) {
      m.energy -= 100;
      actMonster(g, m, dist);
    }
  }
}

function canMove(g, m, d) {
  const { dx, dy } = DIRS[d];
  return canPass(g.floor, m.x, m.y, d, hasAb(m, 'phase', true)) && !isOccupied(g, m.x + dx, m.y + dy);
}

function step(g, m, d) {
  m.x += DIRS[d].dx;
  m.y += DIRS[d].dy;
  m.dir = d;
}

function actMonster(g, m, dist) {
  const p = g.player;
  const f = g.floor;
  if (m.st.sleep > 0) return;
  if (m.keeper) {
    keeperAct(g, m, dist);
    return;
  }
  const dToP = cheb(m.x, m.y, p.x, p.y);
  if (m.asleep) {
    const wake = (dToP <= 1 && g.rng.chance(0.5)) || (sameRoom(f, m, p) && g.rng.chance(0.03));
    if (!wake) return;
    m.asleep = false;
    m.aware = 15;
  }
  const inMh = f.mhTriggered && roomIdAt(f, m.x, m.y) === f.mhRoomId;
  const sees = sameRoom(f, m, p) || dToP <= 2 || inMh;
  if (sees) {
    if (m.aware < 15) m.aware = 15;
  } else if (m.aware > 0 && m.aware < 900) m.aware--;

  if (m.st.confuse > 0) {
    const d = g.rng.int(0, 7);
    if (canMove(g, m, d)) step(g, m, d);
    return;
  }
  if (m.flee > 0) {
    m.flee--;
    if (m.flee === 0 || (!sees && dToP > 6 && g.rng.chance(0.3))) {
      escape(g, m);
      return;
    }
    fleeStep(g, m, dist);
    return;
  }
  if (m.aware <= 0) {
    wander(g, m);
    return;
  }
  // --- aware ---
  if (hasAb(m, 'summon') && dToP <= 6) {
    if (m.summonCd <= 0) {
      if (summonMinion(g, m)) {
        m.summonCd = 7;
        return;
      }
    } else m.summonCd--;
  }
  if (dToP <= 1) {
    const d = dirFromDelta(p.x - m.x, p.y - m.y);
    if (canAttackDir(f, m.x, m.y, d)) {
      monsterAttack(g, m);
      return;
    }
  }
  if (hasAb(m, 'ranged') && dToP >= 2 && dToP <= 5 && g.rng.chance(0.6) && alignedAndClear(g, m)) {
    monsterRanged(g, m);
    return;
  }
  if (hasAb(m, 'erratic', true) && g.rng.chance(0.4)) {
    const d = g.rng.int(0, 7);
    if (canMove(g, m, d)) step(g, m, d);
    return;
  }
  chaseStep(g, m, dist);
}

function alignedAndClear(g, m) {
  const p = g.player;
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
  const d = dirFromDelta(dx, dy);
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  let x = m.x;
  let y = m.y;
  for (let i = 1; i < n; i++) {
    x += DIRS[d].dx;
    y += DIRS[d].dy;
    if (!isWalkable(g.floor, x, y) || monsterAt(g.floor, x, y)) return false;
  }
  m.dir = d;
  return true;
}

/** Step to a neighbouring tile with a strictly smaller BFS distance to the player. */
function chaseStep(g, m, dist) {
  const f = g.floor;
  const p = g.player;
  if (hasAb(m, 'phase', true)) {
    greedyStep(g, m, p.x, p.y);
    return;
  }
  const here = dist[m.y * f.w + m.x];
  if (here < 0) {
    greedyStep(g, m, p.x, p.y);
    return;
  }
  const dirs = g.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  let best = -1;
  let bestD = here;
  let equal = -1;
  for (const d of dirs) {
    if (!canMove(g, m, d)) continue;
    const nd = dist[(m.y + DIRS[d].dy) * f.w + (m.x + DIRS[d].dx)];
    if (nd < 0) continue;
    if (nd < bestD) {
      bestD = nd;
      best = d;
    } else if (nd === here && equal < 0) equal = d;
  }
  if (best >= 0) step(g, m, best);
  else if (equal >= 0 && g.rng.chance(0.5)) step(g, m, equal);
}

/** Greedy Chebyshev step (used by wall-walkers and as a fallback). */
function greedyStep(g, m, tx, ty) {
  const dirs = g.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  const cur = cheb(m.x, m.y, tx, ty);
  let best = -1;
  let bestD = cur;
  for (const d of dirs) {
    if (!canMove(g, m, d)) continue;
    const nd = cheb(m.x + DIRS[d].dx, m.y + DIRS[d].dy, tx, ty);
    if (nd < bestD) {
      bestD = nd;
      best = d;
    }
  }
  if (best >= 0) {
    step(g, m, best);
    return true;
  }
  return false;
}

function fleeStep(g, m, dist) {
  const f = g.floor;
  const dirs = g.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  const here = dist[m.y * f.w + m.x];
  let best = -1;
  let bestD = here;
  for (const d of dirs) {
    if (!canMove(g, m, d)) continue;
    const nd = dist[(m.y + DIRS[d].dy) * f.w + (m.x + DIRS[d].dx)];
    if (nd > bestD) {
      bestD = nd;
      best = d;
    }
  }
  if (best >= 0) step(g, m, best);
  else {
    const d = g.rng.int(0, 7);
    if (canMove(g, m, d)) step(g, m, d);
  }
}

function escape(g, m) {
  if (canSeeMonster(g, m)) msg(g, `${m.name}は 迷宮の どこかへ 逃げていった……`, 'bad');
  removeMonster(g, m);
}

function wander(g, m) {
  const f = g.floor;
  if (!m.wander || (m.x === m.wander.x && m.y === m.wander.y) || m.stuck > 3) {
    const room = g.rng.pick(f.rooms);
    const t = randomRoomTile(g, room);
    m.wander = t ? { x: t.x, y: t.y } : null;
    m.stuck = 0;
    if (!m.wander) return;
  }
  if (g.rng.chance(0.15)) return; // idle a little
  if (hasAb(m, 'phase', true)) {
    if (!greedyStep(g, m, m.wander.x, m.wander.y)) m.stuck++;
    return;
  }
  const dist = bfs(f, m.wander.x, m.wander.y);
  const here = dist[m.y * f.w + m.x];
  if (here < 0) {
    m.stuck = 99;
    return;
  }
  const dirs = g.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  let best = -1;
  let bestD = here;
  for (const d of dirs) {
    if (!canMove(g, m, d)) continue;
    const nd = dist[(m.y + DIRS[d].dy) * f.w + (m.x + DIRS[d].dx)];
    if (nd >= 0 && nd < bestD) {
      bestD = nd;
      best = d;
    }
  }
  if (best >= 0) step(g, m, best);
  else m.stuck++;
}

function summonMinion(g, m) {
  const d = MONSTERS[m.kind];
  if (!d.summons || g.floor.monsters.length >= 24) return false;
  const spots = freeTilesAround(g, m.x, m.y, 1);
  if (!spots.length) return false;
  const c = createMonster(g, g.rng.pick(d.summons), spots[0].x, spots[0].y);
  c.aware = 20;
  c.energy = 0;
  msg(g, `${m.name}は 手下を 呼んだ！`, 'bad');
  g.events.push({ t: 'fx', kind: 'sparkle', x: c.x, y: c.y });
  return true;
}

function keeperAct(g, m, dist) {
  const p = g.player;
  const f = g.floor;
  if (m.angry) {
    m.aware = 999;
    const dToP = cheb(m.x, m.y, p.x, p.y);
    if (dToP <= 1) {
      const d = dirFromDelta(p.x - m.x, p.y - m.y);
      if (canAttackDir(f, m.x, m.y, d)) {
        monsterAttack(g, m);
        return;
      }
    }
    chaseStep(g, m, dist);
    return;
  }
  if (!m.home || !m.block) return;
  const wantBlock = p.inv.some((i) => i.unpaid);
  const target = wantBlock ? m.block : m.home;
  if (m.x === target.x && m.y === target.y) return;
  if (!isOccupied(g, target.x, target.y)) {
    m.x = target.x;
    m.y = target.y;
    if (wantBlock) msg(g, `${m.name}が 入り口の前に 立った`);
  }
}
