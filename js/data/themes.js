// Visual themes, one per 10-floor band (rotates afterwards).
export const THEMES = [
  {
    name: 'お城の地下', floorA: '#3d3757', floorB: '#443e60', dot: '#514a72',
    wall: '#211d33', wallEdge: '#5b5486', wallFace: '#332e4d', wallLine: '#181427',
    shopA: '#5a4a2e', shopB: '#63522f', corridor: '#2e2a45', corridorDot: '#3a3554',
  },
  {
    name: 'いばらの森', floorA: '#2f4a35', floorB: '#35533b', dot: '#41654a',
    wall: '#1a2a1d', wallEdge: '#4c7a55', wallFace: '#27402c', wallLine: '#111c13',
    shopA: '#5a4a2e', shopB: '#63522f', corridor: '#243528', corridorDot: '#2e4433',
  },
  {
    name: 'かがみの氷室', floorA: '#2f4a5e', floorB: '#365468', dot: '#4a6f88',
    wall: '#18283a', wallEdge: '#6aa9c9', wallFace: '#274058', wallLine: '#0f1a26',
    shopA: '#5a4a2e', shopB: '#63522f', corridor: '#223646', corridorDot: '#2c4658',
  },
  {
    name: 'すなの宝物庫', floorA: '#6b5a3a', floorB: '#746240', dot: '#857250',
    wall: '#3a3020', wallEdge: '#c9a55a', wallFace: '#574830', wallLine: '#271f13',
    shopA: '#4a3f6b', shopB: '#524676', corridor: '#4d412a', corridorDot: '#5c4e33',
  },
  {
    name: 'ほしぞらの塔', floorA: '#2a2547', floorB: '#302b52', dot: '#4a4380',
    wall: '#15122a', wallEdge: '#8b7ad6', wallFace: '#241f40', wallLine: '#0d0b1c',
    shopA: '#5a4a2e', shopB: '#63522f', corridor: '#1f1b38', corridorDot: '#2b2648',
  },
];

export function themeIndex(depth) {
  return Math.floor((depth - 1) / 10) % THEMES.length;
}

export function themeFor(depth) {
  return THEMES[themeIndex(depth)];
}
