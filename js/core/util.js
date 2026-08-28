// Directions: 0=N 1=NE 2=E 3=SE 4=S 5=SW 6=W 7=NW
export const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
];

export const DIR_NAMES = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

export const T = Object.freeze({
  WALL: 0,
  FLOOR: 1,
  CORRIDOR: 2,
  STAIRS: 3,
  SHOP: 4,
});

export const INV_MAX = 16;

export function dirFromDelta(dx, dy) {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (let i = 0; i < 8; i++) if (DIRS[i].dx === sx && DIRS[i].dy === sy) return i;
  return -1;
}

export function cheb(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function oppositeDir(d) {
  return (d + 4) % 8;
}

export function isDiagonal(d) {
  return d % 2 === 1;
}
