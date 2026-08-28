// Dream-space background: gradient sky, nebula clouds, twinkling stars and shooting stars.
// Used behind the unexplored parts of the map (with parallax) and on the title screen.

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const STAR_COLORS = ['#ffffff', '#ffe9a8', '#bfefff', '#ffc2e8'];

export class Cosmos {
  constructor(seed = 1) {
    this.seed = seed;
    this.neb = null;
    this.nebKey = '';
    const rnd = mulberry(seed);
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({ x: rnd(), y: rnd(), r: 0.7 + rnd() * 1.5, ph: rnd() * 6.283, sp: 0.5 + rnd() * 2, c: rnd() });
    }
    this.rnd = mulberry(seed ^ 0x9e3779b9);
    this.shot = null;
    this.nextShot = 1500;
  }

  /** Pre-rendered sky + nebula + faint static stars for a given size/theme. */
  ensureNebula(w, h, theme) {
    const key = `${w}x${h}|${theme.name}`;
    if (this.neb && this.nebKey === key) return this.neb;
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    const ctx = c.getContext('2d');
    const sky = theme.sky;
    const grad = ctx.createLinearGradient(0, 0, w * 0.35, h);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(0.5, sky[1]);
    grad.addColorStop(1, sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const rnd = mulberry(this.seed + 977);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const cx = rnd() * w;
      const cy = rnd() * h;
      const rad = (0.16 + rnd() * 0.3) * Math.max(w, h);
      const col = theme.nebula[i % theme.nebula.length];
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, rgba(col, 0.2));
      rg.addColorStop(0.45, rgba(col, 0.07));
      rg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    const density = Math.round((w * h) / 9000);
    for (let i = 0; i < density; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = rnd() < 0.85 ? 1 : 2;
      ctx.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.4})`;
      ctx.fillRect(x, y, r, r);
    }
    this.neb = c;
    this.nebKey = key;
    return c;
  }

  /**
   * Fill (0,0,W,H). shiftX/Y: parallax offset in device px (|shift| <= pad); pad: extra canvas margin;
   * scale: device pixel ratio for star sizes.
   */
  draw(ctx, W, H, now, theme, shiftX = 0, shiftY = 0, padX = 0, padY = 0, scale = 1) {
    const sw = W + padX * 2;
    const sh = H + padY * 2;
    const neb = this.ensureNebula(sw, sh, theme);
    ctx.drawImage(neb, -padX - shiftX, -padY - shiftY);

    const t = now / 1000;
    for (const s of this.stars) {
      const x = ((((s.x * sw - shiftX) % sw) + sw) % sw) - padX;
      const y = ((((s.y * sh - shiftY) % sh) + sh) % sh) - padY;
      if (x < -6 || y < -6 || x > W + 6 || y > H + 6) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      const r = s.r * scale;
      ctx.globalAlpha = 0.3 + 0.7 * tw;
      ctx.fillStyle = STAR_COLORS[s.c < 0.6 ? 0 : s.c < 0.8 ? 1 : s.c < 0.92 ? 2 : 3];
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
      if (s.r > 1.6 && tw > 0.75) {
        ctx.globalAlpha = (tw - 0.75) * 3.2;
        ctx.fillRect(x - r * 2.2, y - r * 0.2, r * 4.4, r * 0.4);
        ctx.fillRect(x - r * 0.2, y - r * 2.2, r * 0.4, r * 4.4);
      }
    }
    ctx.globalAlpha = 1;

    // shooting star
    if (!this.shot && now > this.nextShot) {
      const r = this.rnd;
      const ang = 0.45 + r() * 0.6;
      this.shot = {
        x: r() * W,
        y: r() * H * 0.6,
        ang: r() < 0.5 ? ang : Math.PI - ang,
        dist: (0.25 + r() * 0.25) * Math.max(W, H),
        len: (90 + r() * 120) * scale,
        t0: now,
        dur: 650 + r() * 450,
      };
    }
    if (this.shot) {
      const s = this.shot;
      const k = (now - s.t0) / s.dur;
      if (k >= 1) {
        this.shot = null;
        this.nextShot = now + 3500 + this.rnd() * 6000;
      } else {
        const hx = s.x + Math.cos(s.ang) * s.dist * k;
        const hy = s.y + Math.sin(s.ang) * s.dist * k;
        const tx = hx - Math.cos(s.ang) * s.len;
        const ty = hy - Math.sin(s.ang) * s.len;
        const a = Math.sin(k * Math.PI);
        const grad = ctx.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, `rgba(255,250,220,${0.9 * a})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, 1.6 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(hx, hy, 1.7 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
