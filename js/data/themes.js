// Visual themes, one per 10-floor band (rotates afterwards). The labyrinth floats above the clouds
// and climbs towards the stars: dusk -> sunset -> moonlit night -> aurora -> sea of stars.
// floor*/corridor/shop: walkable sky-stone tiles. cloud*: the cloud sea that surrounds them.
// sky/nebula: the dream-space behind unexplored parts. mote: floating magic dust.
export const THEMES = [
  {
    name: 'くもの回廊',
    floorA: '#7b84c4', floorB: '#8189ca', dot: '#a9b1e6',
    corridor: '#6870ab', corridorDot: '#8890c8',
    shopA: '#b08a3e', shopB: '#b9924a',
    cloudBase: '#dfe3fb', cloudLight: '#ffffff', cloudShade: '#b3bcee',
    sky: ['#1b1a4a', '#3b2f7d', '#0e0c2a'],
    nebula: ['#7f6cf0', '#ff8fd6', '#5aa9ff'],
    mote: ['#fff3c4', '#ffc2e8', '#c9f2ff'],
  },
  {
    name: 'ゆうやけの庭',
    floorA: '#b47a69', floorB: '#bc8270', dot: '#dba38f',
    corridor: '#9a6656', corridorDot: '#c08a78',
    shopA: '#c99a3c', shopB: '#d1a447',
    cloudBase: '#ffe1d6', cloudLight: '#fff8f3', cloudShade: '#efad97',
    sky: ['#3a1a4a', '#c0583e', '#1a0c22'],
    nebula: ['#ff7b54', '#ffb703', '#ff5d8f'],
    mote: ['#ffd166', '#ffb3a7', '#fff3c4'],
  },
  {
    name: 'つきよのはし',
    floorA: '#4d5a86', floorB: '#53608d', dot: '#7a87b8',
    corridor: '#3f4b74', corridorDot: '#5d6a97',
    shopA: '#a8873d', shopB: '#b19047',
    cloudBase: '#cfd8ea', cloudLight: '#f4f7ff', cloudShade: '#98a6ca',
    sky: ['#050a1e', '#10204d', '#03060f'],
    nebula: ['#5b8def', '#b4c8ff', '#ffffff'],
    mote: ['#ffffff', '#c9f2ff', '#e0d4ff'],
  },
  {
    name: 'オーロラのとう',
    floorA: '#3f6b6a', floorB: '#467372', dot: '#6faaa5',
    corridor: '#345a59', corridorDot: '#4f8583',
    shopA: '#a8873d', shopB: '#b19047',
    cloudBase: '#d6f0ea', cloudLight: '#f3fffb', cloudShade: '#9bcfc1',
    sky: ['#03121a', '#0b3d3d', '#020a0e'],
    nebula: ['#2fd68f', '#3ad6c0', '#8b5cf6'],
    mote: ['#b8ffe0', '#7cf5b0', '#c9f2ff'],
  },
  {
    name: 'ほしのうみ',
    floorA: '#4a3f80', floorB: '#514688', dot: '#7f74bd',
    corridor: '#3c3369', corridorDot: '#5b5090',
    shopA: '#a8873d', shopB: '#b19047',
    cloudBase: '#e6dcfb', cloudLight: '#fff8ff', cloudShade: '#bba6ec',
    sky: ['#0a0622', '#1d0f44', '#050311'],
    nebula: ['#8b5cf6', '#ff6bd6', '#4cc9f0'],
    mote: ['#ffd166', '#ff9ff3', '#8be9fd'],
  },
];

export function themeIndex(depth) {
  return Math.floor((depth - 1) / 10) % THEMES.length;
}

export function themeFor(depth) {
  return THEMES[themeIndex(depth)];
}
