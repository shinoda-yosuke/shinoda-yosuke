// Item definitions. cat: weapon | shield | arrow | herb | scroll | staff | gold
export const ITEMS = {
  // --- weapons ---
  w_knife: { cat: 'weapon', name: 'ちいさなナイフ', atk: 2, price: 150, depth: [1, 10], w: 10, sprite: 'weapon', tint: '#c9d1d9', desc: '旅立ちの日に持たされた小さなナイフ。' },
  w_broom: { cat: 'weapon', name: 'まほうのほうき', atk: 4, price: 400, depth: [1, 14], w: 8, sprite: 'weapon', tint: '#d4a373', desc: '空は飛べないが、ぶんぶん振ればけっこう痛い。' },
  w_candle: { cat: 'weapon', name: 'ロウソクのつるぎ', atk: 6, price: 800, depth: [6, 24], w: 6, sprite: 'weapon', tint: '#ffb703', desc: '刃のかわりに炎がゆらめく剣。' },
  w_thorn: { cat: 'weapon', name: 'いばらのレイピア', atk: 9, price: 1500, depth: [12, 999], w: 4, sprite: 'weapon', tint: '#57cc99', desc: '茨の女王の庭から折り取った、細身の剣。' },
  w_star: { cat: 'weapon', name: 'ほしふるつるぎ', atk: 12, price: 3000, depth: [20, 999], w: 2, sprite: 'weapon', tint: '#7be0ff', desc: '落ちてきた星をきたえた、伝説の剣。' },

  // --- shields ---
  s_lid: { cat: 'shield', name: 'なべのふた', def: 2, price: 120, depth: [1, 10], w: 10, sprite: 'shield', tint: '#9aa5b1', desc: '台所から持ってきたふた。意外とじょうぶ。' },
  s_book: { cat: 'shield', name: 'まほうのほんのたて', def: 4, price: 500, depth: [3, 16], w: 7, sprite: 'shield', tint: '#c1121f', desc: '分厚い魔法の本。開くと盾になる。' },
  s_mirror: { cat: 'shield', name: 'かがみのたて', def: 6, price: 1200, depth: [9, 28], w: 5, sprite: 'shield', tint: '#a8dadc', desc: '魔法の鏡でできた盾。' },
  s_glass: { cat: 'shield', name: 'ガラスのたて', def: 9, price: 2500, depth: [18, 999], w: 3, sprite: 'shield', tint: '#7be0ff', desc: 'けっして割れないガラスの盾。' },

  // --- arrows ---
  a_wood: { cat: 'arrow', name: '木の矢', atk: 4, price: 15, depth: [1, 999], w: 12, stack: [5, 15], sprite: 'arrow', tint: '#c9a27e', desc: 'まっすぐ飛ぶふつうの矢。' },
  a_silver: { cat: 'arrow', name: '銀の矢', atk: 8, price: 40, depth: [8, 999], w: 6, stack: [3, 8], sprite: 'arrow', tint: '#e0e6eb', desc: '銀色に光る矢。いりょくが高い。' },

  // --- herbs (実) ---
  h_heal: { cat: 'herb', name: 'ひかりの実', price: 100, depth: [1, 999], w: 14, effect: 'heal', sprite: 'herb', tint: '#ffd166', desc: '食べると HP が 30 回復する。HP が満タンなら最大 HP が 1 上がる。' },
  h_bigheal: { cat: 'herb', name: 'つきのしずく', price: 300, depth: [4, 999], w: 6, effect: 'bigheal', sprite: 'herb2', tint: '#a8dadc', desc: '食べると HP が 100 回復する。満タンなら最大 HP が 2 上がる。' },
  h_cure: { cat: 'herb', name: 'きよめの実', price: 200, depth: [3, 999], w: 7, effect: 'cure', sprite: 'herb', tint: '#57cc99', desc: '状態異常を治し、下がったちからを元にもどす。' },
  h_str: { cat: 'herb', name: 'ちからの実', price: 400, depth: [2, 999], w: 6, effect: 'str', sprite: 'herb3', tint: '#e63946', desc: 'ちからが 1 上がる。' },
  h_sleep: { cat: 'herb', name: 'ねむりの実', price: 80, depth: [2, 999], w: 6, effect: 'sleep', sprite: 'herb', tint: '#8b5cf6', desc: '食べると眠ってしまう。投げれば敵を眠らせる。' },
  h_confuse: { cat: 'herb', name: 'くらくらの実', price: 80, depth: [2, 999], w: 6, effect: 'confuse', sprite: 'herb2', tint: '#f9a8d4', desc: '食べると混乱する。投げれば敵を混乱させる。' },
  h_poison: { cat: 'herb', name: 'どくどくの実', price: 60, depth: [3, 999], w: 5, effect: 'poison', sprite: 'herb3', tint: '#7b2cbf', desc: '食べるとちからが下がる。投げれば敵を弱らせる。' },
  h_haste: { cat: 'herb', name: 'はやての実', price: 250, depth: [5, 999], w: 4, effect: 'haste', sprite: 'herb2', tint: '#3a86ff', desc: 'しばらくの間、2 倍の速さで行動できる。' },

  // --- scrolls (ページ) ---
  sc_thunder: { cat: 'scroll', name: 'いかずちのページ', price: 300, depth: [1, 999], w: 9, effect: 'thunder', sprite: 'scroll', tint: '#ffd166', desc: '読むと、部屋の敵すべてに 30 ダメージ。' },
  sc_map: { cat: 'scroll', name: 'ちずのページ', price: 200, depth: [1, 999], w: 9, effect: 'map', sprite: 'scroll', tint: '#c9a27e', desc: 'この階の地形がすべて分かる。' },
  sc_trap: { cat: 'scroll', name: 'わなけしのページ', price: 200, depth: [2, 999], w: 7, effect: 'traps', sprite: 'scroll', tint: '#9aa5b1', desc: '部屋の罠を消し、この階の罠の位置がすべて分かる。' },
  sc_weapon: { cat: 'scroll', name: 'けんのページ', price: 500, depth: [3, 999], w: 6, effect: 'weapon', sprite: 'scroll', tint: '#e63946', desc: '装備している武器が +1 される。' },
  sc_shield: { cat: 'scroll', name: 'たてのページ', price: 500, depth: [3, 999], w: 6, effect: 'shield', sprite: 'scroll', tint: '#3a86ff', desc: '装備している盾が +1 される。' },
  sc_sleep: { cat: 'scroll', name: 'ねむりのうたのページ', price: 300, depth: [4, 999], w: 6, effect: 'sleepall', sprite: 'scroll', tint: '#8b5cf6', desc: '部屋の敵すべてを眠らせる。' },
  sc_light: { cat: 'scroll', name: 'あかりのページ', price: 250, depth: [2, 999], w: 6, effect: 'light', sprite: 'scroll', tint: '#fff8e7', desc: 'この階の敵とアイテムの位置がすべて分かる。' },
  sc_summon: { cat: 'scroll', name: 'おそろしいページ', price: 50, depth: [3, 999], w: 5, effect: 'summon', sprite: 'scroll', tint: '#5c6b7a', desc: '読むと周りに敵があらわれる。売る以外に使い道はない…はず。' },
  sc_stairs: { cat: 'scroll', name: 'かいだんのページ', price: 600, depth: [5, 999], w: 3, effect: 'stairs', sprite: 'scroll', tint: '#57cc99', desc: '読むと、階段のところまで飛ぶ。' },

  // --- staffs (杖) ---
  st_blow: { cat: 'staff', name: 'ふきとばしの杖', price: 600, depth: [2, 999], w: 7, effect: 'blow', charges: [3, 6], sprite: 'staff', tint: '#7be0ff', desc: '魔法の光に当たった敵を吹き飛ばす。' },
  st_slow: { cat: 'staff', name: 'にぶりの杖', price: 500, depth: [3, 999], w: 6, effect: 'slow', charges: [3, 6], sprite: 'staff', tint: '#9aa5b1', desc: '当たった敵の動きをおそくする。' },
  st_swap: { cat: 'staff', name: 'ばしょがえの杖', price: 700, depth: [4, 999], w: 5, effect: 'swap', charges: [3, 6], sprite: 'staff', tint: '#f9a8d4', desc: '当たった敵と場所を入れかわる。' },
  st_seal: { cat: 'staff', name: 'ふういんの杖', price: 700, depth: [6, 999], w: 5, effect: 'seal', charges: [3, 6], sprite: 'staff', tint: '#8b5cf6', desc: '当たった敵の特技を封じる。' },
  st_change: { cat: 'staff', name: 'かわりの杖', price: 800, depth: [6, 999], w: 4, effect: 'change', charges: [3, 6], sprite: 'staff', tint: '#57cc99', desc: '当たった敵を別のモンスターに変える。' },
  st_sleep: { cat: 'staff', name: 'ねむりの杖', price: 800, depth: [5, 999], w: 4, effect: 'sleep', charges: [3, 6], sprite: 'staff', tint: '#3a86ff', desc: '当たった敵を眠らせる。' },

  gold: { cat: 'gold', name: '金貨', price: 0, sprite: 'gold', tint: '#ffd166', desc: '迷宮の店で使えるお金。' },
};

export const CATEGORY_WEIGHTS = [
  { w: 30, v: 'herb' },
  { w: 24, v: 'scroll' },
  { w: 9, v: 'staff' },
  { w: 7, v: 'weapon' },
  { w: 7, v: 'shield' },
  { w: 13, v: 'arrow' },
  { w: 10, v: 'gold' },
];

export const CAT_LABEL = {
  weapon: '武器', shield: '盾', arrow: '矢', herb: '実', scroll: 'ページ', staff: '杖', gold: '金貨',
};

export function isEquipment(item) {
  const c = ITEMS[item.id].cat;
  return c === 'weapon' || c === 'shield';
}

export function displayName(item) {
  const d = ITEMS[item.id];
  if (!d) return '？？？';
  if (d.cat === 'gold') return `${item.amount} 金貨`;
  let s = d.name;
  if (d.cat === 'weapon' || d.cat === 'shield') {
    if (item.plus > 0) s += `+${item.plus}`;
    else if (item.plus < 0) s += `${item.plus}`;
  } else if (d.cat === 'arrow') {
    s += ` ×${item.count}`;
  } else if (d.cat === 'staff') {
    s += `[${item.charges}]`;
  }
  return s;
}

/** Shop buy price of an item instance. */
export function itemPrice(item) {
  const d = ITEMS[item.id];
  if (!d) return 0;
  switch (d.cat) {
    case 'weapon':
    case 'shield':
      return Math.max(10, Math.round(d.price * (1 + 0.25 * (item.plus || 0))));
    case 'arrow':
      return d.price * (item.count || 1);
    case 'staff':
      return d.price + 60 * (item.charges || 0);
    default:
      return d.price;
  }
}

export function sellPrice(item) {
  return Math.floor(itemPrice(item) / 2);
}

/** Candidate item ids of a category eligible at a depth. */
export function itemsOfCategory(cat, depth) {
  const out = [];
  for (const [id, d] of Object.entries(ITEMS)) {
    if (d.cat !== cat || !d.depth) continue;
    if (depth >= d.depth[0] && depth <= d.depth[1]) out.push({ w: d.w || 5, v: id });
  }
  if (out.length === 0) {
    // nothing eligible yet (e.g. very shallow) -> allow the lowest-tier one of that category
    for (const [id, d] of Object.entries(ITEMS)) {
      if (d.cat === cat && d.depth) { out.push({ w: 1, v: id }); break; }
    }
  }
  return out;
}
