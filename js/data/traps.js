// Trap definitions. Hidden until stepped on, revealed by swinging at the tile, or by わなけしのページ.
export const TRAPS = {
  t_pit: { name: 'かぜのわな', depth: [1, 999], w: 8, tint: '#c9f2ff', desc: 'つむじ風に巻き上げられて、次の階へ。' },
  t_poison: { name: 'どくばり', depth: [1, 999], w: 10, tint: '#7b2cbf', desc: '毒の針が刺さり、ちからが下がる。' },
  t_warp: { name: 'ワープのわな', depth: [1, 999], w: 8, tint: '#3a86ff', desc: 'この階のどこかへ飛ばされる。' },
  t_confuse: { name: 'まよいのわな', depth: [2, 999], w: 8, tint: '#f9a8d4', desc: 'しばらく混乱する。' },
  t_rust: { name: 'さびのわな', depth: [4, 999], w: 7, tint: '#b5651d', desc: '盾（なければ武器）が錆びて -1。' },
  t_sleep: { name: 'ねむりのわな', depth: [4, 999], w: 6, tint: '#8b5cf6', desc: 'しばらく眠ってしまう。' },
  t_mine: { name: 'じらい', depth: [6, 999], w: 6, tint: '#e63946', desc: '爆発して HP が半分に。周りの敵も巻き込む。' },
  t_summon: { name: 'しょうかんのわな', depth: [6, 999], w: 5, tint: '#57cc99', desc: '周りに敵があらわれる。' },
};

export function trapTable(depth) {
  const out = [];
  for (const [id, d] of Object.entries(TRAPS)) {
    if (depth >= d.depth[0] && depth <= d.depth[1]) out.push({ w: d.w, v: id });
  }
  return out;
}
