// Canvas renderer: tiles, entities, animations, lantern light, minimap.
import { T, DIRS, cheb } from '../core/util.js';
import { THEMES } from '../data/themes.js';
import { ITEMS } from '../data/items.js';
import { TRAPS } from '../data/traps.js';
import { MONSTERS } from '../data/monsters.js';
import { getSprite, getTile } from './sprites.js';
import { Cosmos } from './cosmos.js';

const MOVE_MS = 110;
const DASH_MS = 55;
const LUNGE_MS = 160;
const FX_MS = { heal: 700, sparkle: 600, scroll: 600, thunder: 450, hit: 300, warp: 500, trap: 400, explosion: 550, alert: 900, gold: 600, equip: 400, victory: 1400 };

const FONT = "'DotGothic16', 'Courier New', monospace";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.tileCss = 32;
    this.tile = 32;
    this.pos = new Map(); // entity id -> last logical position
    this.tweens = [];
    this.lunges = [];
    this.projs = [];
    this.fx = [];
    this.ghosts = [];
    this.banner = null;
    this.shakeUntil = 0;
    this.lockUntil = 0;
    this.faceHint = true;
    this.now = performance.now();
    this.cosmos = new Cosmos(11);
    this.motes = [];
    this.lastNow = 0;
    this.cloudCache = new Map();
    this.fog = null; // per-tile cloud cover over explored-but-unseen tiles (1 = clouded)
  }

  resize(cssW, cssH) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.tileCss = cssW < 520 ? 28 : cssW < 900 ? 32 : 36;
    this.canvas.width = Math.max(1, Math.floor(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * this.dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.tile = this.tileCss * this.dpr;
    this.ctx.imageSmoothingEnabled = false;
  }

  reset(g) {
    this.pos.clear();
    this.tweens = [];
    this.lunges = [];
    this.projs = [];
    this.fx = [];
    this.ghosts = [];
    this.lockUntil = 0;
    this.fog = null;
    if (!g) return;
    this.pos.set(0, { x: g.player.x, y: g.player.y });
    for (const m of g.floor.monsters) this.pos.set(m.id, { x: m.x, y: m.y });
  }

  get busy() {
    return performance.now() < this.lockUntil;
  }

  finishAnims() {
    this.tweens = [];
    this.lunges = [];
    this.projs = [];
    this.lockUntil = 0;
  }

  /** Schedule animations for the events produced by one action. */
  applyEvents(g, events, opts = {}) {
    const now = performance.now();
    const moveMs = opts.dash ? DASH_MS : MOVE_MS;
    let cursor = now;
    let maxEnd = now;

    const floorEv = events.find((e) => e.t === 'floor');
    if (floorEv) {
      this.reset(g);
      const th = THEMES[g.floor.theme];
      this.banner = { text: `✦ ${floorEv.depth}F ✦`, sub: th.name, t0: now, t1: now + 1500 };
    } else {
      const seen = new Set();
      const ents = [{ id: 0, x: g.player.x, y: g.player.y }];
      for (const m of g.floor.monsters) ents.push({ id: m.id, x: m.x, y: m.y });
      for (const e of ents) {
        seen.add(e.id);
        const old = this.pos.get(e.id);
        if (old && (old.x !== e.x || old.y !== e.y) && cheb(old.x, old.y, e.x, e.y) <= 2) {
          this.tweens.push({ id: e.id, fx: old.x, fy: old.y, tx: e.x, ty: e.y, t0: now, t1: now + moveMs });
          maxEnd = Math.max(maxEnd, now + moveMs);
        }
        this.pos.set(e.id, { x: e.x, y: e.y });
      }
      for (const id of [...this.pos.keys()]) if (!seen.has(id)) this.pos.delete(id);
    }

    for (const ev of events) {
      switch (ev.t) {
        case 'attack': {
          const id = ev.who === 'p' ? 0 : ev.id;
          this.lunges.push({ id, dir: ev.dir, t0: cursor, t1: cursor + LUNGE_MS });
          maxEnd = Math.max(maxEnd, cursor + LUNGE_MS);
          cursor += 70;
          break;
        }
        case 'dmg':
          this.fx.push({ type: 'text', text: String(ev.n), color: ev.who === 'p' ? '#ff6b6b' : '#ffffff', x: ev.x, y: ev.y, t0: cursor + 40, t1: cursor + 750 });
          break;
        case 'miss':
          this.fx.push({ type: 'text', text: 'miss', color: '#b8c0cc', x: ev.x, y: ev.y, t0: cursor + 40, t1: cursor + 600 });
          break;
        case 'proj': {
          const d = Math.max(1, cheb(ev.fx, ev.fy, ev.tx, ev.ty));
          const dur = 70 + 32 * d;
          this.projs.push({ ...ev, t0: cursor, t1: cursor + dur });
          cursor += dur;
          maxEnd = Math.max(maxEnd, cursor);
          break;
        }
        case 'die':
          this.ghosts.push({ kind: ev.kind, x: ev.x, y: ev.y, t0: cursor, t1: cursor + 280 });
          this.pos.delete(ev.id);
          cursor += 30;
          break;
        case 'fx': {
          const dur = FX_MS[ev.kind] || 500;
          this.fx.push({ type: ev.kind, x: ev.x, y: ev.y, t0: cursor, t1: cursor + dur });
          if (ev.kind === 'explosion') this.shakeUntil = cursor + 320;
          break;
        }
        case 'levelup':
          this.fx.push({ type: 'text', text: 'LEVEL UP!', color: '#ffd166', x: ev.x, y: ev.y - 0.6, t0: cursor, t1: cursor + 1100, big: true });
          break;
        default:
          break;
      }
    }
    this.lockUntil = Math.max(this.lockUntil, maxEnd);
  }

  // ------------------------------------------------------------------ helpers

  renderPos(id, lx, ly, now) {
    let x = lx;
    let y = ly;
    for (const tw of this.tweens) {
      if (tw.id !== id) continue;
      const k = Math.min(1, Math.max(0, (now - tw.t0) / (tw.t1 - tw.t0)));
      x = tw.fx + (tw.tx - tw.fx) * k;
      y = tw.fy + (tw.ty - tw.fy) * k;
    }
    for (const lg of this.lunges) {
      if (lg.id !== id || now < lg.t0) continue;
      const k = Math.min(1, (now - lg.t0) / (lg.t1 - lg.t0));
      const a = Math.sin(k * Math.PI) * 0.35;
      x += DIRS[lg.dir].dx * a;
      y += DIRS[lg.dir].dy * a;
    }
    return { x, y };
  }

  prune(now) {
    this.tweens = this.tweens.filter((t) => now < t.t1);
    this.lunges = this.lunges.filter((t) => now < t.t1);
    this.projs = this.projs.filter((t) => now < t.t1);
    this.fx = this.fx.filter((t) => now < t.t1);
    this.ghosts = this.ghosts.filter((t) => now < t.t1);
    if (this.banner && now > this.banner.t1) this.banner = null;
  }

  // --------------------------------------------------------------------- draw

  draw(g, now = performance.now()) {
    this.now = now;
    this.prune(now);
    const dt = Math.min(0.1, this.lastNow ? (now - this.lastNow) / 1000 : 0.016);
    this.lastNow = now;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ts = this.tile;
    const f = g.floor;
    const p = g.player;
    const th = THEMES[f.theme];

    ctx.imageSmoothingEnabled = false;
    const pp = this.renderPos(0, p.x, p.y, now);
    let camX = pp.x + 0.5 - W / ts / 2;
    let camY = pp.y + 0.5 - H / ts / 2;
    if (now < this.shakeUntil) {
      camX += (Math.random() - 0.5) * 0.25;
      camY += (Math.random() - 0.5) * 0.25;
    }

    // dream-space behind the unexplored parts of the map (slow parallax)
    {
      const par = 0.08;
      const padX = Math.ceil(Math.max(W, f.w * ts) * par) + 8;
      const padY = Math.ceil(Math.max(H, f.h * ts) * par) + 8;
      this.cosmos.draw(ctx, W, H, now, th, camX * ts * par, camY * ts * par, padX, padY, this.dpr);
    }
    const toX = (tx) => Math.round((tx - camX) * ts);
    const toY = (ty) => Math.round((ty - camY) * ts);

    const x0 = Math.floor(camX) - 1;
    const y0 = Math.floor(camY) - 1;
    const x1 = Math.ceil(camX + W / ts) + 1;
    const y1 = Math.ceil(camY + H / ts) + 1;

    this.updateFog(g, dt);

    // walkable sky-stone platforms first, then the cloud sea that surrounds them
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h) continue;
        const i = ty * f.w + tx;
        if (!f.explored[i]) continue;
        const t = f.tiles[i];
        if (t === T.WALL) continue;
        let img;
        if (t === T.SHOP) img = getTile(f.theme, 'shop');
        else if (t === T.CORRIDOR) img = getTile(f.theme, 'corridor');
        else img = getTile(f.theme, (tx + ty) % 2 === 0 ? 'floorA' : 'floorB');
        const dx = toX(tx);
        const dy = toY(ty);
        ctx.drawImage(img, dx, dy, ts, ts);
        // clouds above cast a soft shadow onto the platform
        if (ty > 0 && f.tiles[i - f.w] === T.WALL) {
          ctx.fillStyle = 'rgba(20, 16, 60, 0.28)';
          ctx.fillRect(dx, dy, ts, ts * 0.12);
          ctx.fillStyle = 'rgba(20, 16, 60, 0.14)';
          ctx.fillRect(dx, dy + ts * 0.12, ts, ts * 0.12);
        }
      }
    }
    this.drawClouds(ctx, g, now, toX, toY, ts, x0, y0, x1, y1);

    // stairs: soft pulsing glow (drawn after the tiles so it spills over the neighbours)
    if (f.stairs && f.explored[f.stairs.y * f.w + f.stairs.x]) {
      const sx = toX(f.stairs.x);
      const sy = toY(f.stairs.y);
      const pulse = 0.28 + 0.14 * Math.sin(now / 480);
      const gl = ctx.createRadialGradient(sx + ts / 2, sy + ts / 2, ts * 0.1, sx + ts / 2, sy + ts / 2, ts * 1.15);
      gl.addColorStop(0, `rgba(170, 236, 255, ${pulse})`);
      gl.addColorStop(1, 'rgba(170, 236, 255, 0)');
      ctx.fillStyle = gl;
      ctx.fillRect(sx - ts * 0.7, sy - ts * 0.7, ts * 2.4, ts * 2.4);
      ctx.drawImage(getSprite('stairs'), sx, sy, ts, ts);
      const tw = Math.sin(now / 300);
      if (tw > 0.6) this.sparkle(ctx, sx + ts * 0.5, sy + ts * 0.45, ts * 0.2 * (tw - 0.6) * 2.5, '#eafcff');
    }

    // traps (revealed)
    for (const tr of f.traps) {
      if (!tr.visible || !f.explored[tr.y * f.w + tr.x]) continue;
      ctx.drawImage(getSprite('trap', { tint: TRAPS[tr.id].tint }), toX(tr.x), toY(tr.y), ts, ts);
    }

    // items
    for (const e of f.items) {
      const i = e.y * f.w + e.x;
      if (!f.explored[i] && !f.lit) continue;
      const d = ITEMS[e.item.id];
      ctx.drawImage(getSprite(d.sprite, { tint: d.tint }), toX(e.x), toY(e.y), ts, ts);
      const tw = Math.sin(now / 420 + e.x * 7.3 + e.y * 13.1);
      if (tw > 0.9) this.sparkle(ctx, toX(e.x) + ts * 0.78, toY(e.y) + ts * 0.22, ts * 1.6 * (tw - 0.9), '#fff8d6');
      if (e.item.price) {
        this.text(ctx, `${e.item.price}G`, toX(e.x) + ts / 2, toY(e.y) + ts * 0.18, ts * 0.32, '#ffd166', true);
      }
    }

    // facing hint (tile in front of the player)
    if (this.faceHint && g.phase === 'play') {
      const d = DIRS[p.dir];
      ctx.fillStyle = 'rgba(255,230,160,0.18)';
      ctx.fillRect(toX(p.x + d.dx) + ts * 0.3, toY(p.y + d.dy) + ts * 0.3, ts * 0.4, ts * 0.4);
    }

    // explored-but-unseen tiles hide under the same clouds as the walls (they part as you approach)
    this.drawFog(ctx, g, now, toX, toY, ts, x0, y0, x1, y1);

    // monsters
    for (const m of f.monsters) {
      const i = m.y * f.w + m.x;
      if (!f.lit && !f.visible[i]) continue;
      const def = MONSTERS[m.kind];
      const rp = this.renderPos(m.id, m.x, m.y, now);
      const flip = m.dir === 5 || m.dir === 6 || m.dir === 7;
      const dx = toX(rp.x);
      const dy = toY(rp.y);
      if (m.guardian) {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.18)';
        ctx.beginPath();
        ctx.arc(dx + ts / 2, dy + ts * 0.85, ts * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(getSprite(def.sprite, { pal: def.pal, flip }), dx, dy, ts, ts);
      if (m.asleep || m.st.sleep > 0) this.text(ctx, 'z', dx + ts * 0.8, dy + ts * 0.15, ts * 0.4, '#a8dadc');
      else if (m.st.confuse > 0) this.text(ctx, '?', dx + ts * 0.8, dy + ts * 0.15, ts * 0.4, '#f9a8d4');
      if (m.hp < m.maxHp) {
        const w = ts * 0.7;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(dx + ts * 0.15, dy - ts * 0.08, w, ts * 0.08);
        ctx.fillStyle = m.hp / m.maxHp > 0.5 ? '#57cc99' : m.hp / m.maxHp > 0.25 ? '#ffd166' : '#e63946';
        ctx.fillRect(dx + ts * 0.15, dy - ts * 0.08, w * (m.hp / m.maxHp), ts * 0.08);
      }
    }

    // ghosts (dying)
    for (const gh of this.ghosts) {
      const k = (now - gh.t0) / (gh.t1 - gh.t0);
      if (k < 0) continue;
      const def = MONSTERS[gh.kind];
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(getSprite(def ? def.sprite : 'koropon', { pal: def && def.pal }), toX(gh.x), toY(gh.y - k * 0.4), ts, ts);
      ctx.globalAlpha = 1;
    }

    // player
    {
      const sprite = p.dir === 0 || p.dir === 1 || p.dir === 7 ? 'lumi_u' : p.dir === 2 || p.dir === 3 ? 'lumi_r' : p.dir === 5 || p.dir === 6 ? 'lumi_r' : 'lumi_d';
      const flip = p.dir === 5 || p.dir === 6;
      const dx = toX(pp.x);
      const dy = toY(pp.y);
      if (g.phase === 'dead') ctx.globalAlpha = 0.5;
      ctx.drawImage(getSprite(sprite, { flip }), dx, dy, ts, ts);
      ctx.globalAlpha = 1;
      if (p.st.sleep > 0) this.text(ctx, 'z', dx + ts * 0.8, dy + ts * 0.15, ts * 0.4, '#a8dadc');
      else if (p.st.confuse > 0) this.text(ctx, '?', dx + ts * 0.8, dy + ts * 0.15, ts * 0.4, '#f9a8d4');
    }

    // lantern light
    {
      const cx = toX(pp.x) + ts / 2;
      const cy = toY(pp.y) + ts / 2;
      const flicker = 1 + Math.sin(now / 90) * 0.02 + Math.sin(now / 37) * 0.01;
      const warm = ctx.createRadialGradient(cx, cy, ts * 0.2, cx, cy, ts * 3.2 * flicker);
      warm.addColorStop(0, 'rgba(255, 214, 160, 0.2)');
      warm.addColorStop(1, 'rgba(255, 214, 160, 0)');
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, W, H);
      const dark = ctx.createRadialGradient(cx, cy, ts * 3.5, cx, cy, ts * 9.5);
      dark.addColorStop(0, 'rgba(8, 4, 24, 0)');
      dark.addColorStop(1, 'rgba(8, 4, 24, 0.6)');
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawMotes(ctx, g, now, dt, toX, toY, ts);

    // projectiles
    for (const pr of this.projs) {
      const k = Math.min(1, Math.max(0, (now - pr.t0) / (pr.t1 - pr.t0)));
      const x = pr.fx + (pr.tx - pr.fx) * k;
      const y = pr.fy + (pr.ty - pr.fy) * k;
      const cx = toX(x) + ts / 2;
      const cy = toY(y) + ts / 2;
      if (pr.kind === 'arrow') {
        ctx.strokeStyle = '#e8d8b0';
        ctx.lineWidth = Math.max(1, ts * 0.08);
        const ang = Math.atan2(pr.ty - pr.fy, pr.tx - pr.fx);
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(ang) * ts * 0.35, cy - Math.sin(ang) * ts * 0.35);
        ctx.lineTo(cx + Math.cos(ang) * ts * 0.35, cy + Math.sin(ang) * ts * 0.35);
        ctx.stroke();
      } else if (pr.kind === 'item') {
        const d = ITEMS[pr.item];
        if (d) ctx.drawImage(getSprite(d.sprite, { tint: d.tint }), toX(x), toY(y) - ts * 0.3 * Math.sin(k * Math.PI), ts, ts);
      } else {
        const col = pr.kind === 'fire' ? '#ff9f43' : pr.kind === 'star' ? '#ffd166' : '#c77dff';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // effects
    for (const e of this.fx) {
      if (now < e.t0) continue;
      const k = Math.min(1, (now - e.t0) / (e.t1 - e.t0));
      const cx = toX(e.x) + ts / 2;
      const cy = toY(e.y) + ts / 2;
      switch (e.type) {
        case 'text': {
          const rise = e.big ? ts * 0.9 : ts * 0.7;
          ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          this.text(ctx, e.text, cx, cy - ts * 0.35 - rise * k, e.big ? ts * 0.45 : ts * 0.5, e.color, true);
          ctx.globalAlpha = 1;
          break;
        }
        case 'explosion': {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = '#ff9f43';
          ctx.beginPath();
          ctx.arc(cx, cy, ts * (0.4 + k * 1.4), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff3c4';
          ctx.beginPath();
          ctx.arc(cx, cy, ts * (0.2 + k * 0.8), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'thunder': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = '#fff3a0';
          ctx.lineWidth = Math.max(2, ts * 0.12);
          ctx.beginPath();
          ctx.moveTo(cx + ts * 0.2, cy - ts * 2.5);
          ctx.lineTo(cx - ts * 0.15, cy - ts * 0.8);
          ctx.lineTo(cx + ts * 0.2, cy - ts * 0.6);
          ctx.lineTo(cx - ts * 0.1, cy + ts * 0.3);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'heal':
        case 'sparkle':
        case 'scroll':
        case 'gold':
        case 'equip':
        case 'victory':
        case 'warp': {
          const col = e.type === 'heal' ? '#7cf5b0' : e.type === 'gold' ? '#ffd166' : e.type === 'warp' ? '#7be0ff' : e.type === 'victory' ? '#ffd166' : '#f9a8d4';
          ctx.fillStyle = col;
          ctx.globalAlpha = 1 - k;
          const n = e.type === 'victory' ? 12 : 6;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + k * 2;
            const r = ts * (0.2 + k * (e.type === 'victory' ? 1.6 : 0.8));
            ctx.fillRect(cx + Math.cos(a) * r - ts * 0.05, cy + Math.sin(a) * r - ts * 0.05 - k * ts * 0.3, ts * 0.1, ts * 0.1);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'hit':
        case 'trap': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = e.type === 'trap' ? '#e63946' : '#ffffff';
          ctx.lineWidth = Math.max(1, ts * 0.06);
          ctx.beginPath();
          ctx.arc(cx, cy, ts * (0.2 + k * 0.5), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'alert': {
          ctx.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
          this.text(ctx, '!', cx, cy - ts * 0.9 - Math.sin(k * Math.PI * 4) * ts * 0.1, ts * 0.9, '#e63946', true);
          ctx.globalAlpha = 1;
          break;
        }
        default:
          break;
      }
    }

    this.drawMinimap(g, W, H);

    if (this.banner) {
      const k = (now - this.banner.t0) / (this.banner.t1 - this.banner.t0);
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.fillStyle = 'rgba(5,4,12,0.6)';
      ctx.fillRect(0, H / 2 - ts * 1.3, W, ts * 2.6);
      this.text(ctx, this.banner.text, W / 2, H / 2 - ts * 0.35, ts * 1.1, '#fff6e5', true);
      this.text(ctx, this.banner.sub, W / 2, H / 2 + ts * 0.55, ts * 0.5, '#ffd166', true);
      ctx.globalAlpha = 1;
    }
  }

  /** Pre-rendered cloud puff (2x2 tiles, centred) for a theme / tile size / variant. */
  cloudPuff(theme, ts, variant) {
    const key = `${theme.name}|${Math.round(ts * 10)}|${variant}`;
    let c = this.cloudCache.get(key);
    if (c) return c;
    const size = Math.ceil(ts * 2);
    c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = size / 2;
    const cy = size / 2;
    const base = [
      [0, 0, 0.58],
      [-0.3, 0.14, 0.36],
      [0.3, 0.1, 0.4],
      [0.05, -0.26, 0.34],
    ];
    const puffs = base.map(([x, y, r], i) => [
      x + (((variant * 7 + i * 3) % 5) - 2) * 0.02,
      y + (((variant * 5 + i * 7) % 5) - 2) * 0.02,
      r + (((variant + i) % 3) - 1) * 0.03,
    ]);
    const pctx = c.getContext('2d');
    const layer = (color, ox, oy, rs) => {
      pctx.fillStyle = color;
      for (const [x, y, r] of puffs) {
        pctx.beginPath();
        pctx.arc(cx + x * ts + ox, cy + y * ts + oy, r * ts * rs, 0, Math.PI * 2);
        pctx.fill();
      }
    };
    layer(theme.cloudShade, 0, ts * 0.1, 1);
    layer(theme.cloudBase, 0, 0, 1);
    layer(theme.cloudLight, -ts * 0.06, -ts * 0.1, 0.62);
    this.cloudCache.set(key, c);
    return c;
  }

  /** One bobbing cloud puff centred on tile (tx,ty). Leaves ctx.globalAlpha set to `alpha`. */
  puffAt(ctx, th, ts, tx, ty, now, toX, toY, alpha) {
    const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
    const puff = this.cloudPuff(th, ts, h & 3);
    const bob = Math.sin(now / 1700 + (h % 628) / 100) * ts * 0.03;
    ctx.globalAlpha = alpha;
    ctx.drawImage(puff, toX(tx) - ts * 0.5, toY(ty) - ts * 0.5 + bob);
  }

  /** Explored wall tiles are drawn as a gently bobbing sea of clouds. */
  drawClouds(ctx, g, now, toX, toY, ts, x0, y0, x1, y1) {
    const f = g.floor;
    const th = THEMES[f.theme];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h) continue;
        const i = ty * f.w + tx;
        if (!f.explored[i] || f.tiles[i] !== T.WALL) continue;
        this.puffAt(ctx, th, ts, tx, ty, now, toX, toY, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Cloud cover over explored tiles: eases towards 0 where visible, 1 where not. */
  updateFog(g, dt) {
    const f = g.floor;
    const n = f.w * f.h;
    if (!this.fog || this.fog.length !== n) this.fog = new Float32Array(n).fill(1);
    const fog = this.fog;
    const kOpen = 1 - Math.exp(-dt * 9);
    const kClose = 1 - Math.exp(-dt * 4.5);
    for (let i = 0; i < n; i++) {
      const target = f.visible[i] ? 0 : 1;
      const cur = fog[i];
      if (cur === target) continue;
      let v = cur + (target - cur) * (target === 0 ? kOpen : kClose);
      if (Math.abs(v - target) < 0.01) v = target;
      fog[i] = v;
    }
  }

  /** Same clouds as the walls, laid over explored-but-unseen platforms (with fade). */
  drawFog(ctx, g, now, toX, toY, ts, x0, y0, x1, y1) {
    const f = g.floor;
    const th = THEMES[f.theme];
    const fog = this.fog;
    if (!fog) return;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h) continue;
        const i = ty * f.w + tx;
        if (!f.explored[i] || f.tiles[i] === T.WALL) continue;
        const a = fog[i];
        if (a <= 0.01) continue;
        this.puffAt(ctx, th, ts, tx, ty, now, toX, toY, a);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Four-point twinkle. */
  sparkle(ctx, cx, cy, r, color) {
    if (r <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(cx - r, cy - r * 0.18, r * 2, r * 0.36);
    ctx.fillRect(cx - r * 0.18, cy - r, r * 0.36, r * 2);
  }

  /** Floating magic dust around the player (render-only, uses Math.random). */
  drawMotes(ctx, g, now, dt, toX, toY, ts) {
    const f = g.floor;
    const p = g.player;
    const th = THEMES[f.theme];
    while (this.motes.length < 34) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 6;
      this.motes.push({
        x: p.x + 0.5 + Math.cos(a) * r,
        y: p.y + 0.5 + Math.sin(a) * r,
        vy: -(0.12 + Math.random() * 0.2),
        ph: Math.random() * Math.PI * 2,
        life: 0,
        max: 2.5 + Math.random() * 3,
        c: th.mote[Math.floor(Math.random() * th.mote.length)],
        s: 0.05 + Math.random() * 0.07,
      });
    }
    for (const m of this.motes) {
      m.life += dt;
      m.y += m.vy * dt;
      m.x += Math.sin(now / 900 + m.ph) * 0.18 * dt;
    }
    this.motes = this.motes.filter((m) => m.life < m.max && cheb(m.x, m.y, p.x, p.y) < 12);
    for (const m of this.motes) {
      const tx = Math.floor(m.x);
      const ty = Math.floor(m.y);
      if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h || !f.explored[ty * f.w + tx]) continue;
      const k = m.life / m.max;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
      ctx.fillStyle = m.c;
      const r = ts * m.s;
      const cx = toX(m.x);
      const cy = toY(m.y);
      ctx.fillRect(cx - r / 2, cy - r / 2, r, r);
      if (m.s > 0.095) {
        ctx.fillRect(cx - r, cy - r * 0.15, r * 2, r * 0.3);
        ctx.fillRect(cx - r * 0.15, cy - r, r * 0.3, r * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  text(ctx, str, x, y, size, color, center = false) {
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = center ? 'center' : 'left';
    ctx.lineWidth = Math.max(2, size * 0.18);
    ctx.strokeStyle = 'rgba(10,8,20,0.9)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  drawMinimap(g, W, H) {
    const ctx = this.ctx;
    const f = g.floor;
    const s = Math.max(2, Math.round(this.dpr * (this.tileCss < 32 ? 2 : 2.5)));
    const mw = f.w * s;
    const mh = f.h * s;
    const ox = W - mw - 8 * this.dpr;
    const oy = 8 * this.dpr;
    ctx.fillStyle = 'rgba(12, 8, 32, 0.42)';
    ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = Math.max(1, this.dpr * 0.8);
    ctx.strokeRect(ox - 4, oy - 4, mw + 8, mh + 8);
    this.drawMapInto(ctx, g, ox, oy, s, false);
  }

  /** Shared by the corner minimap and the full-screen map overlay. */
  drawMapInto(ctx, g, ox, oy, s, detailed) {
    const f = g.floor;
    const p = g.player;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const i = y * f.w + x;
        if (!f.explored[i]) continue;
        const t = f.tiles[i];
        if (t === T.WALL) {
          if (detailed) {
            ctx.fillStyle = 'rgba(225, 230, 255, 0.35)';
            ctx.fillRect(ox + x * s, oy + y * s, s, s);
          }
          continue;
        }
        ctx.fillStyle = t === T.SHOP ? 'rgba(255,209,102,0.75)' : t === T.CORRIDOR ? 'rgba(170,165,200,0.55)' : 'rgba(210,205,235,0.75)';
        if (f.visible[i]) ctx.fillStyle = t === T.SHOP ? '#ffd166' : '#eef';
        ctx.fillRect(ox + x * s, oy + y * s, s, s);
        if (t === T.STAIRS) {
          ctx.fillStyle = '#57cc99';
          ctx.fillRect(ox + x * s, oy + y * s, s, s);
        }
      }
    }
    for (const tr of f.traps) {
      if (!tr.visible) continue;
      ctx.fillStyle = '#e63946';
      ctx.fillRect(ox + tr.x * s, oy + tr.y * s, s, s);
    }
    for (const e of f.items) {
      if (!f.explored[e.y * f.w + e.x] && !f.lit) continue;
      ctx.fillStyle = '#7be0ff';
      ctx.fillRect(ox + e.x * s, oy + e.y * s, s, s);
    }
    for (const m of f.monsters) {
      if (!f.lit && !f.visible[m.y * f.w + m.x]) continue;
      ctx.fillStyle = m.keeper && !m.angry ? '#ffd166' : '#ff4d5a';
      ctx.fillRect(ox + m.x * s - (detailed ? 1 : 0), oy + m.y * s - (detailed ? 1 : 0), s + (detailed ? 2 : 0), s + (detailed ? 2 : 0));
    }
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#ffffff' : '#ffd166';
    ctx.fillRect(ox + p.x * s - 1, oy + p.y * s - 1, s + 2, s + 2);
  }
}
