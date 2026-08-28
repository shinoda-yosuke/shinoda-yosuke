// Seeded PRNG (mulberry32). State is a single uint32 so it serializes trivially.
export class RNG {
  constructor(seed = Date.now()) {
    this.s = seed >>> 0;
  }

  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** integer in [min, max] inclusive */
  int(min, max) {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** entries: [{ w: weight, v: value }] */
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e.w;
    let r = this.next() * total;
    for (const e of entries) {
      r -= e.w;
      if (r < 0) return e.v;
    }
    return entries[entries.length - 1].v;
  }

  toJSON() {
    return { s: this.s };
  }

  static from(obj) {
    const r = new RNG(0);
    r.s = (obj && obj.s) >>> 0;
    return r;
  }
}
