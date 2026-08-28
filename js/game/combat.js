// Combat, experience, death.
import { dirFromDelta } from '../core/util.js';
import { ITEMS, displayName } from '../data/items.js';
import { msg } from './log.js';
import { hasAb, createMonster, createItem } from './spawn.js';
import { freeTilesAround } from './floor.js';
import { explodeAt, dropItemNear, guardianReward, applyHitAbility } from './effects.js';

export const EXP_TABLE = [0, 0];
for (let lv = 2; lv <= 99; lv++) EXP_TABLE[lv] = EXP_TABLE[lv - 1] + Math.round(6 * Math.pow(1.38, lv - 2));

export function expForLevel(lv) {
  return EXP_TABLE[Math.min(99, Math.max(1, lv))];
}

export function calcDamage(rng, atk, def) {
  const base = atk * Math.pow(0.9375, Math.max(0, def));
  return Math.max(1, Math.round(base * (0.875 + rng.next() * 0.25)));
}

export function getWeapon(g) {
  const p = g.player;
  return p.weapon ? p.inv.find((i) => i.uid === p.weapon) || null : null;
}

export function getShield(g) {
  const p = g.player;
  return p.shield ? p.inv.find((i) => i.uid === p.shield) || null : null;
}

export function playerAtk(g) {
  const p = g.player;
  const w = getWeapon(g);
  return p.str + (w ? ITEMS[w.id].atk + (w.plus || 0) : 0) + Math.floor(p.lv / 2);
}

export function playerDef(g) {
  const s = getShield(g);
  return s ? Math.max(0, ITEMS[s.id].def + (s.plus || 0)) : 0;
}

export function computeScore(g) {
  const p = g.player;
  return p.deepest * 1000 + p.gold + p.totalExp;
}

export function angerKeeper(g, m) {
  if (m.angry) return;
  m.angry = true;
  m.aware = 999;
  m.speed = 200;
  msg(g, `${m.name}は おこった！「どろぼうめ！」`, 'bad');
}

export function playerAttack(g, m) {
  const p = g.player;
  g.events.push({ t: 'attack', who: 'p', id: 0, dir: p.dir });
  if (m.keeper && !m.angry) angerKeeper(g, m);
  m.asleep = false;
  m.aware = 15;
  if (!g.rng.chance(0.92)) {
    msg(g, `${p.name}の攻撃！ しかし ${m.name}には 当たらなかった`);
    g.events.push({ t: 'miss', x: m.x, y: m.y });
    return;
  }
  const dmg = calcDamage(g.rng, playerAtk(g), m.def);
  msg(g, `${p.name}の攻撃！ ${m.name}に ${dmg} のダメージ`);
  damageMonster(g, m, dmg, 'player');
}

/** source: 'player' | 'playerIndirect' (exp is granted) | 'other' */
export function damageMonster(g, m, dmg, source = 'other') {
  if (m.hp <= 0) return;
  m.hp -= dmg;
  m.asleep = false;
  if (m.aware < 15) m.aware = 15;
  g.events.push({ t: 'dmg', x: m.x, y: m.y, n: dmg, who: 'm' });
  if (m.hp <= 0) {
    killMonster(g, m, source);
    return;
  }
  if (source === 'player' && hasAb(m, 'split') && g.rng.chance(0.35)) splitMonster(g, m);
}

function splitMonster(g, m) {
  if (g.floor.monsters.length >= 24 || m.splits >= 4) return;
  const spots = freeTilesAround(g, m.x, m.y, 1);
  if (!spots.length) return;
  const c = createMonster(g, m.kind, spots[0].x, spots[0].y, { splits: m.splits + 1 });
  m.splits++;
  c.hp = m.hp;
  c.maxHp = m.maxHp;
  c.aware = 15;
  c.energy = 0;
  msg(g, `${m.name}が 分裂した！`, 'bad');
  g.events.push({ t: 'fx', kind: 'sparkle', x: c.x, y: c.y });
}

export function killMonster(g, m, source = 'other') {
  const f = g.floor;
  const i = f.monsters.indexOf(m);
  if (i >= 0) f.monsters.splice(i, 1);
  m.hp = 0;
  g.events.push({ t: 'die', id: m.id, x: m.x, y: m.y, kind: m.kind });
  msg(g, `${m.name}を たおした！`, 'good');
  if (m.stolen) {
    dropItemNear(g, m.stolen, m.x, m.y);
    msg(g, `${m.name}は ${displayName(m.stolen)}を 落とした`);
    m.stolen = null;
  }
  if (m.stolenGold) {
    dropItemNear(g, createItem(g, 'gold', { amount: m.stolenGold }), m.x, m.y);
    m.stolenGold = 0;
  }
  if (source === 'player' || source === 'playerIndirect') {
    g.player.kills++;
    gainExp(g, m.exp);
  }
  if (m.guardian) guardianReward(g, m);
  if (f.shop && f.shop.keeperId === m.id) {
    f.shop.keeperId = 0;
    msg(g, '店主が いなくなってしまった……');
  }
  if (hasAb(m, 'explode', true)) explodeAt(g, m.x, m.y, m, false);
}

export function gainExp(g, n) {
  const p = g.player;
  if (n <= 0) return;
  p.exp += n;
  p.totalExp += n;
  while (p.lv < 99 && p.exp >= expForLevel(p.lv + 1)) {
    p.lv++;
    const up = p.lv <= 20 ? 5 : 4;
    p.maxHp += up;
    p.hp = Math.min(p.maxHp, p.hp + up);
    msg(g, `レベルが ${p.lv} に 上がった！ 最大 HP が ${up} 上がった`, 'good');
    g.events.push({ t: 'levelup', x: p.x, y: p.y });
  }
}

export function monsterAttack(g, m) {
  const p = g.player;
  m.dir = dirFromDelta(p.x - m.x, p.y - m.y);
  g.events.push({ t: 'attack', who: 'm', id: m.id, dir: m.dir });
  if (!g.rng.chance(m.guardian ? 0.95 : 0.88)) {
    msg(g, `${m.name}の攻撃！ ${p.name}は ひらりと かわした`);
    g.events.push({ t: 'miss', x: p.x, y: p.y });
    return;
  }
  const dmg = calcDamage(g.rng, m.atk, playerDef(g));
  msg(g, `${m.name}の攻撃！ ${p.name}に ${dmg} のダメージ`, 'bad');
  damagePlayer(g, dmg, `${m.name}に やられた`);
  if (g.phase === 'play') applyHitAbility(g, m);
}

export function damagePlayer(g, dmg, cause) {
  const p = g.player;
  p.hp -= dmg;
  g.events.push({ t: 'dmg', x: p.x, y: p.y, n: dmg, who: 'p' });
  if (p.hp <= 0) {
    p.hp = 0;
    die(g, cause);
  }
}

export function die(g, cause) {
  if (g.phase !== 'play') return;
  g.phase = 'dead';
  g.cause = cause;
  g.score = computeScore(g);
  msg(g, `${g.player.name}は たおれてしまった……`, 'bad');
  g.events.push({ t: 'death' });
}
