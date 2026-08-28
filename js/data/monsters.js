// Monster definitions. All names/designs are original (storybook-fantasy flavour).
// depth: [min, max] floors where the monster spawns naturally.
// ab (abilities): erratic, ranged, steal, poisonHit, sleepHit, confuseHit, rustHit,
//                 split, explode, phase, summon
export const MONSTERS = {
  koropon: {
    name: 'コロポン', hp: 6, atk: 2, def: 0, exp: 2, speed: 100, depth: [1, 6], w: 12,
    sprite: 'koropon',
    desc: 'あめ玉みたいにぷるぷるした、迷宮でいちばん弱いいきもの。',
  },
  patapata: {
    name: 'パタパタ', hp: 6, atk: 3, def: 0, exp: 3, speed: 100, depth: [1, 7], w: 10,
    sprite: 'patapata', ab: ['erratic'],
    desc: '本のページが命を持ったコウモリ。ふらふら飛ぶので動きが読めない。',
  },
  togekurumi: {
    name: 'トゲくるみ', hp: 10, atk: 3, def: 3, exp: 4, speed: 50, depth: [1, 8], w: 9,
    sprite: 'kurumi',
    desc: 'かたい殻にトゲが生えたくるみ。のろいが打たれ強い。',
  },
  rousoku: {
    name: 'ロウソクぼうず', hp: 8, atk: 4, def: 1, exp: 5, speed: 100, depth: [2, 9], w: 9,
    sprite: 'rousoku', ab: ['ranged'], rangedName: 'ほのお', rangedFx: 'fire',
    desc: 'ゆらゆら燃えるロウソクの小鬼。離れたところから火を吐く。',
  },
  kabocha: {
    name: 'カボチャあたま', hp: 16, atk: 6, def: 2, exp: 9, speed: 100, depth: [4, 13], w: 10,
    sprite: 'kabocha',
    desc: 'にやりと笑うカボチャ頭のかかし。見た目どおり力が強い。',
  },
  kasasagi: {
    name: 'ぬすみカササギ', hp: 12, atk: 4, def: 2, exp: 10, speed: 100, depth: [5, 16], w: 7,
    sprite: 'kasasagi', ab: ['steal'],
    desc: '光るものが大好きな鳥。持ち物を盗んで逃げる。倒せば取り返せる。',
  },
  ibara: {
    name: 'いばらのツル', hp: 18, atk: 5, def: 3, exp: 10, speed: 50, depth: [5, 15], w: 8,
    sprite: 'ibara', ab: ['poisonHit'],
    desc: '城をおおう茨の一部。トゲには毒があり、ちからを奪う。',
  },
  kagami: {
    name: 'かがみゴースト', hp: 14, atk: 7, def: 1, exp: 12, speed: 100, depth: [7, 18], w: 8,
    sprite: 'kagami', ab: ['phase'],
    desc: '鏡から抜け出したおばけ。壁の中をすり抜けて近づいてくる。',
  },
  yousei: {
    name: 'ねむりようせい', hp: 14, atk: 4, def: 3, exp: 16, speed: 100, depth: [9, 20], w: 7,
    sprite: 'yousei', ab: ['sleepHit'],
    desc: 'ふわふわ舞う小さな妖精。りんぷんを浴びると眠ってしまう。',
  },
  teacup: {
    name: 'ティーカップきし', hp: 26, atk: 10, def: 7, exp: 20, speed: 100, depth: [10, 22], w: 9,
    sprite: 'teacup',
    desc: 'ティーカップのよろいをまとった騎士。守りが固い。',
  },
  ningyou: {
    name: 'ふたごにんぎょう', hp: 18, atk: 8, def: 3, exp: 14, speed: 100, depth: [11, 24], w: 8,
    sprite: 'ningyou', ab: ['split'],
    desc: 'なぐられると分裂する人形。数が増える前に倒したい。',
  },
  sabikarasu: {
    name: 'さびカラス', hp: 20, atk: 8, def: 4, exp: 18, speed: 100, depth: [12, 26], w: 8,
    sprite: 'karasu', ab: ['rustHit'],
    desc: 'くちばしが錆びたカラス。つつかれると盾が錆びる。',
  },
  pudding: {
    name: 'ばくだんプリン', hp: 22, atk: 7, def: 3, exp: 24, speed: 100, depth: [15, 30], w: 7,
    sprite: 'pudding', ab: ['explode'],
    desc: '導火線つきのプリン。倒すと爆発して周りを巻き込む。',
  },
  glasswolf: {
    name: 'ガラスのオオカミ', hp: 30, atk: 10, def: 5, exp: 30, speed: 200, depth: [16, 32], w: 8,
    sprite: 'wolf',
    desc: '透き通った体のオオカミ。とても足が速い。',
  },
  neko: {
    name: 'まじょのつかいネコ', hp: 28, atk: 11, def: 5, exp: 32, speed: 100, depth: [18, 36], w: 8,
    sprite: 'neko', ab: ['ranged', 'confuseHit'], rangedName: 'まほうのたま', rangedFx: 'magic',
    desc: '魔女につかえる黒猫。魔法の玉を放ち、ひっかかれると混乱する。',
  },
  ookurumi: {
    name: 'おおくるみ', hp: 50, atk: 15, def: 10, exp: 45, speed: 50, depth: [20, 40], w: 7,
    sprite: 'kurumi', pal: 'big',
    desc: '巨大に育ったトゲくるみ。とにかく固くて、一撃が重い。',
  },
  ryu: {
    name: 'ほしくずのりゅう', hp: 60, atk: 20, def: 8, exp: 80, speed: 100, depth: [28, 999], w: 7,
    sprite: 'ryu', ab: ['ranged'], rangedName: 'ほしのいき', rangedFx: 'star',
    desc: '星のかけらから生まれた小さな竜。星の息を吐く。',
  },
  yorukishi: {
    name: 'よるのきし', hp: 70, atk: 24, def: 12, exp: 100, speed: 100, depth: [30, 999], w: 7,
    sprite: 'teacup', pal: 'night',
    desc: '夜そのものをまとった騎士。迷宮の深部を守る。',
  },

  // --- special (never in the natural spawn table) ---
  keeper: {
    name: 'てんしゅ', hp: 400, atk: 45, def: 25, exp: 0, speed: 100,
    sprite: 'keeper', keeper: true,
    desc: '迷宮の店の主人。おこらせてはいけない。',
  },
  banpei: {
    name: 'ばんぺい', hp: 120, atk: 30, def: 15, exp: 0, speed: 200,
    sprite: 'teacup', pal: 'guard',
    desc: '店の番兵。どろぼうをどこまでも追いかける。',
  },

  // --- guardians (every 10 floors) ---
  g_pumpkin: {
    name: 'カボチャおう', hp: 60, atk: 12, def: 5, exp: 120, speed: 100,
    sprite: 'g_pumpkin', guardian: true, ab: ['summon'], summons: ['koropon', 'kabocha'],
    desc: '10 階の番人。手下のカボチャを呼び出す。',
  },
  g_thorn: {
    name: 'いばらのじょおう', hp: 130, atk: 20, def: 9, exp: 300, speed: 100,
    sprite: 'g_thorn', guardian: true, ab: ['poisonHit', 'summon'], summons: ['ibara', 'kasasagi'],
    desc: '20 階の番人。毒の茨で城を包む。',
  },
  g_glass: {
    name: 'ガラスのきし', hp: 180, atk: 28, def: 13, exp: 600, speed: 200,
    sprite: 'teacup', pal: 'glass', guardian: true,
    desc: '30 階の番人。ガラスのよろいはすばやく、硬い。',
  },
  g_mirror: {
    name: 'かがみのまじょ', hp: 240, atk: 32, def: 12, exp: 1000, speed: 100,
    sprite: 'g_mirror', guardian: true, ab: ['ranged', 'confuseHit', 'summon'],
    rangedName: 'かがみのひかり', rangedFx: 'magic', summons: ['kagami', 'neko'],
    desc: '40 階の番人。鏡の魔法でまどわせる。',
  },
};

export const GUARDIAN_ORDER = ['g_pumpkin', 'g_thorn', 'g_glass', 'g_mirror'];

export function isGuardianFloor(depth) {
  return depth > 0 && depth % 10 === 0;
}

/** Guardian id + stat multiplier for a guardian floor. */
export function guardianFor(depth) {
  const n = depth / 10 - 1;
  const id = GUARDIAN_ORDER[n % GUARDIAN_ORDER.length];
  const cycle = Math.floor(n / GUARDIAN_ORDER.length);
  return { id, scale: 1 + cycle * 0.6 };
}

/** Natural spawn candidates at a depth: [{ w, v: id }] */
export function spawnTable(depth) {
  const out = [];
  for (const [id, d] of Object.entries(MONSTERS)) {
    if (!d.depth) continue;
    const [lo, hi] = d.depth;
    const late = depth > 30 && hi >= 24; // late game: keep the deep pool around forever
    if (depth >= lo && (depth <= hi || late)) out.push({ w: d.w || 5, v: id });
  }
  if (out.length === 0) out.push({ w: 1, v: 'koropon' });
  return out;
}

/** Stat multiplier applied to regular monsters (endless scaling past 30F). */
export function depthScale(depth) {
  return depth > 30 ? 1 + (depth - 30) * 0.05 : 1;
}
