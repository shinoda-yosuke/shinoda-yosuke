// Visual themes, one per 10-floor band (rotates afterwards).
// sky: gradient of the dream-space behind the map, nebula: cloud colours, mote: floating magic dust.
export const THEMES = [
  {
    name: 'お城の地下',
    floorA: '#3f3a63', floorB: '#47416d', dot: '#5b5488',
    wall: '#221d3a', wallEdge: '#6c63a8', wallFace: '#352e56', wallLine: '#17132a',
    shopA: '#5e4b2c', shopB: '#6a5531', corridor: '#312c4e', corridorDot: '#3f395f',
    sky: ['#0d0a24', '#17113d', '#070512'],
    nebula: ['#6d4fe0', '#d63384', '#3a86ff'],
    mote: ['#ffd166', '#f9a8d4', '#c9f2ff'],
  },
  {
    name: 'いばらの森',
    floorA: '#2c4c3a', floorB: '#325542', dot: '#43705a',
    wall: '#152a1f', wallEdge: '#5fb07a', wallFace: '#244334', wallLine: '#0e1c14',
    shopA: '#5e4b2c', shopB: '#6a5531', corridor: '#213a2c', corridorDot: '#2c4a38',
    sky: ['#06120f', '#0e2a24', '#04090a'],
    nebula: ['#2fd68f', '#3aa0d6', '#d6c23f'],
    mote: ['#b8ff8a', '#ffe08a', '#7cf5b0'],
  },
  {
    name: 'かがみの氷室',
    floorA: '#2e4c66', floorB: '#345672', dot: '#4c7594',
    wall: '#16283e', wallEdge: '#7cc4e6', wallFace: '#25405c', wallLine: '#0e1a28',
    shopA: '#5e4b2c', shopB: '#6a5531', corridor: '#20374a', corridorDot: '#2b485f',
    sky: ['#07111f', '#122c4a', '#040913'],
    nebula: ['#7be0ff', '#b39ddb', '#ffffff'],
    mote: ['#ffffff', '#c9f2ff', '#e0d4ff'],
  },
  {
    name: 'すなの宝物庫',
    floorA: '#6f5c3a', floorB: '#786540', dot: '#8c7853',
    wall: '#3d321f', wallEdge: '#d9b25f', wallFace: '#5b4a2f', wallLine: '#292013',
    shopA: '#4a3f6b', shopB: '#524676', corridor: '#4f4229', corridorDot: '#5f5033',
    sky: ['#160f0a', '#2e2110', '#0a0705'],
    nebula: ['#ffb703', '#ff7b54', '#d63384'],
    mote: ['#ffd166', '#fff3c4', '#ff9f43'],
  },
  {
    name: 'ほしぞらの塔',
    floorA: '#2b2550', floorB: '#312b5c', dot: '#4d4590',
    wall: '#15112c', wallEdge: '#9c8ce6', wallFace: '#251f45', wallLine: '#0c0a1c',
    shopA: '#5e4b2c', shopB: '#6a5531', corridor: '#1f1a3c', corridorDot: '#2c264d',
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
