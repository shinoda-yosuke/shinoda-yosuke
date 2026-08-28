// Entry point: wires game logic, renderer, DOM UI, input, and persistence together.
import { newGame } from './game/state.js';
import * as Act from './game/actions.js';
import { Renderer } from './render/renderer.js';
import { Cosmos } from './render/cosmos.js';
import { THEMES } from './data/themes.js';
import { UI, inventoryItems, statusSummary } from './ui/ui.js';
import { saveGame, loadGame, hasSave, clearSave, loadRecords, recordRun } from './storage.js';
import { ITEMS, displayName } from './data/items.js';
import { TRAPS } from './data/traps.js';
import { T, DIRS } from './core/util.js';
import { tileAt, itemAt, roomIdAt, trapAt, canPass } from './game/floor.js';
import { findInv } from './game/inventory.js';

const KEY_DIRS = { ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6, w: 0, d: 2, s: 4, a: 6, k: 0, l: 2, j: 4, h: 6, y: 7, u: 1, b: 5, n: 3 };
const CODE_DIRS = { Numpad8: 0, Numpad9: 1, Numpad6: 2, Numpad3: 3, Numpad2: 4, Numpad1: 5, Numpad4: 6, Numpad7: 7 };

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.stage = document.getElementById('stage');
    this.renderer = new Renderer(this.canvas);
    this.titleCanvas = document.getElementById('title-bg');
    this.titleCosmos = new Cosmos(3);
    this.ui = new UI(this);
    this.g = null;
    this.mode = 'title';
    this.faceMode = false;
    this.dashMode = false;
    this.dashing = null;
    this.sleepTimer = null;
    this.touch = window.matchMedia('(pointer: coarse)').matches;
    this.bind();
    this.applyTouchClass();
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
    this.showTitle();
  }

  // ----------------------------------------------------------------- setup

  bind() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.getElementById('title-new').addEventListener('click', () => this.newGameFromTitle());
    document.getElementById('title-continue').addEventListener('click', () => this.continueGame());
    document.getElementById('title-help').addEventListener('click', () => this.ui.renderHelp());
    document.getElementById('result-retry').addEventListener('click', () => this.startNew());
    document.getElementById('result-title-btn').addEventListener('click', () => this.showTitle());
    document.getElementById('hud-touch-toggle').addEventListener('click', () => {
      this.touch = !this.touch;
      this.applyTouchClass();
      this.resize();
    });
    document.getElementById('hud-help').addEventListener('click', () => this.ui.renderHelp());
    for (const btn of document.querySelectorAll('#dpad button')) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const d = btn.dataset.dir;
        if (d === 'wait') this.cmd('wait');
        else this.onDir(Number(d), this.dashMode);
      });
    }
    const instant = new Set(['attack', 'fire', 'wait', 'dash', 'face']);
    for (const btn of document.querySelectorAll('#actions button')) {
      const name = btn.dataset.cmd;
      // Buttons that open an overlay use click: on touch devices the synthetic click that follows
      // pointerdown would otherwise land on the freshly opened overlay and close it again.
      btn.addEventListener(instant.has(name) ? 'pointerdown' : 'click', (e) => {
        e.preventDefault();
        this.cmd(name);
      });
    }
    document.getElementById('help-close').addEventListener('click', () => this.ui.hideOverlay());
    window.addEventListener('blur', () => this.stopDash());
  }

  applyTouchClass() {
    document.body.classList.toggle('touch', this.touch);
    document.getElementById('touch').classList.toggle('hidden', !this.touch);
  }

  resize() {
    const r = this.stage.getBoundingClientRect();
    this.renderer.resize(Math.max(200, Math.floor(r.width)), Math.max(150, Math.floor(r.height)));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.titleCanvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    this.titleCanvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
  }

  loop(t) {
    if (this.mode === 'title') this.drawTitleBg(t);
    if (this.g) this.renderer.draw(this.g, t);
    requestAnimationFrame((tt) => this.loop(tt));
  }

  /** Slowly drifting starry sky behind the title panel. */
  drawTitleBg(now) {
    const c = this.titleCanvas;
    const ctx = c.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const pad = Math.ceil(140 * dpr);
    this.titleCosmos.draw(ctx, c.width, c.height, now, THEMES[4], Math.sin(now / 23000) * pad * 0.9, Math.cos(now / 29000) * pad * 0.9, pad, pad, dpr);
  }

  // ------------------------------------------------------------ game flow

  showTitle() {
    this.stopDash();
    this.mode = 'title';
    this.ui.closeMenu();
    this.ui.renderTitle({ hasSave: hasSave(), rec: loadRecords() });
  }

  async newGameFromTitle() {
    if (hasSave()) {
      const ok = await this.ui.ask('中断中の 冒険が あります。消して 最初から 始めますか？', { defaultYes: false });
      if (!ok) return;
    }
    this.startNew();
  }

  startNew() {
    clearSave();
    this.g = newGame();
    this.begin();
  }

  continueGame() {
    const g = loadGame();
    if (!g) {
      this.ui.toast('中断データを 読み込めませんでした');
      this.startNew();
      return;
    }
    this.g = g;
    this.begin(true);
  }

  begin(resumed = false) {
    const g = this.g;
    this.mode = 'play';
    this.faceMode = false;
    this.dashMode = false;
    this.ui.hideOverlay();
    this.ui.lastLogN = 0;
    this.renderer.reset(g);
    if (!resumed) this.renderer.applyEvents(g, g.events);
    else this.renderer.banner = { text: `✦ ${g.depth}F ✦`, sub: 'つづきから', t0: performance.now(), t1: performance.now() + 1400 };
    g.events.length = 0;
    this.ui.updateHud(g);
    this.ui.updateLog(g);
    this.resize();
    saveGame(g);
    if (g.player.st.sleep > 0) this.scheduleSleepTurn();
  }

  /** Run one player action and process its consequences. */
  act(fn, opts = {}) {
    if (this.mode !== 'play' || !this.g) return null;
    if (this.ui.blocking && !opts.fromMenu) return null;
    if (this.renderer.busy) this.renderer.finishAnims();
    const g = this.g;
    let res;
    try {
      res = fn(g);
    } catch (err) {
      console.error(err);
      this.ui.toast('エラーが 発生しました（コンソールを確認）');
      return null;
    }
    this.afterAction(res, opts);
    return res;
  }

  afterAction(res, opts) {
    const g = this.g;
    this.renderer.applyEvents(g, g.events, { dash: !!opts.dash });
    g.events.length = 0;
    this.ui.updateHud(g);
    this.ui.updateLog(g);
    if (g.phase === 'dead') {
      this.onDeath();
      return;
    }
    saveGame(g);
    if (res && res.prompt) this.handlePrompt(res.prompt);
    else if (g.player.st.sleep > 0) this.scheduleSleepTurn();
  }

  handlePrompt(pr) {
    this.stopDash();
    switch (pr.type) {
      case 'stairs':
        this.ui.ask('階段を のぼりますか？').then((yes) => {
          if (yes) this.act(Act.descend);
        });
        break;
      case 'buy':
        this.ui
          .ask(pr.canPay ? `「合計 ${pr.total} 金貨だよ。買うかい？」` : `「合計 ${pr.total} 金貨だよ。……お金が 足りないみたいだね」`, { yes: pr.canPay ? '買う' : 'はい', no: 'やめる' })
          .then((yes) => {
            if (yes && pr.canPay) this.act(Act.payShop);
          });
        break;
      case 'sell':
        this.ui.ask(`「${pr.name}なら ${pr.price} 金貨で 買い取るよ。売るかい？」`, { yes: '売る', no: 'やめる' }).then((yes) => {
          if (yes) this.act((g) => Act.sellItem(g, pr.uid));
        });
        break;
      case 'talk':
        this.ui.toast(pr.text);
        break;
      default:
        break;
    }
  }

  onDeath() {
    this.mode = 'dead';
    this.stopDash();
    clearSave();
    const info = recordRun(this.g);
    setTimeout(() => {
      if (this.mode === 'dead') this.ui.renderResult(this.g, info);
    }, 1100);
  }

  scheduleSleepTurn() {
    clearTimeout(this.sleepTimer);
    this.sleepTimer = setTimeout(() => {
      if (this.mode !== 'play' || !this.g || this.g.player.st.sleep <= 0 || this.ui.blocking) return;
      this.act(Act.wait);
    }, 260);
  }

  // ------------------------------------------------------------------ dash

  startDash(dir) {
    this.stopDash();
    this.dashing = { dir, timer: null, first: true };
    const step = () => {
      const g = this.g;
      if (!this.dashing || this.mode !== 'play' || !g) return this.stopDash();
      const p = g.player;
      const f = g.floor;
      const before = { hp: p.hp, room: roomIdAt(f, p.x, p.y), inv: p.inv.length, gold: p.gold, x: p.x, y: p.y, sleep: p.st.sleep, confuse: p.st.confuse };
      const res = this.act((gg) => Act.move(gg, dir), { dash: true });
      if (!res || !res.turn || res.prompt || this.mode !== 'play') return this.stopDash();
      if (p.x === before.x && p.y === before.y) return this.stopDash(); // attacked something
      if (p.hp < before.hp || p.inv.length !== before.inv || p.gold !== before.gold) return this.stopDash();
      if (p.st.sleep !== before.sleep || p.st.confuse !== before.confuse) return this.stopDash();
      if (itemAt(f, p.x, p.y) || trapAt(f, p.x, p.y) || tileAt(f, p.x, p.y) === T.STAIRS) return this.stopDash();
      if (this.monsterInSight()) return this.stopDash();
      const room = roomIdAt(f, p.x, p.y);
      if (room !== before.room) return this.stopDash();
      if (room < 0) {
        let exits = 0;
        for (let d = 0; d < 8; d++) {
          if (!canPass(f, p.x, p.y, d)) continue;
          const nx = p.x + DIRS[d].dx;
          const ny = p.y + DIRS[d].dy;
          if (nx === before.x && ny === before.y) continue;
          exits++;
        }
        if (exits !== 1) return this.stopDash();
      }
      this.dashing.timer = setTimeout(step, 62);
    };
    step();
  }

  stopDash() {
    if (this.dashing) {
      clearTimeout(this.dashing.timer);
      this.dashing = null;
    }
  }

  monsterInSight() {
    const g = this.g;
    const f = g.floor;
    for (const m of f.monsters) {
      if (m.keeper && !m.angry) continue;
      if (f.lit || f.visible[m.y * f.w + m.x]) return true;
    }
    return false;
  }

  // ----------------------------------------------------------------- input

  onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.ui.handleKey(e)) {
      e.preventDefault();
      return;
    }
    if (this.mode === 'title') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hasSave()) this.continueGame();
        else this.startNew();
      } else if (e.key === '?') this.ui.renderHelp();
      return;
    }
    if (this.mode === 'dead') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.startNew();
      }
      return;
    }
    if (this.mode !== 'play') return;
    if (this.dashing) {
      this.stopDash();
      e.preventDefault();
      return;
    }
    const key = e.key;
    const lower = key.length === 1 ? key.toLowerCase() : key;
    let dir = CODE_DIRS[e.code];
    if (dir === undefined) dir = KEY_DIRS[lower];
    if (dir !== undefined) {
      e.preventDefault();
      this.onDir(dir, e.shiftKey || this.dashMode);
      return;
    }
    const handled = this.cmdForKey(key, e.code);
    if (handled) e.preventDefault();
  }

  cmdForKey(key, code) {
    switch (key) {
      case ' ':
        return this.cmd('attack');
      case 'Enter':
        return this.cmd('feet');
      case '.':
      case 'z':
        return this.cmd('wait');
      case 'i':
        return this.cmd('inventory');
      case 'g':
        return this.cmd('feet');
      case 'm':
        return this.cmd('map');
      case 'f':
        return this.cmd('fire');
      case 'c':
        return this.cmd('face');
      case 'x':
        return this.cmd('log');
      case '?':
        return this.cmd('help');
      case 'Escape':
        this.faceMode = false;
        this.dashMode = false;
        this.updateModeButtons();
        return true;
      default:
        if (code === 'Numpad5') return this.cmd('wait');
        return false;
    }
  }

  onDir(dir, dash) {
    if (this.mode !== 'play' || this.ui.blocking) return;
    if (this.faceMode) {
      this.faceMode = false;
      this.updateModeButtons();
      this.act((g) => Act.face(g, dir));
      return;
    }
    if (dash) {
      this.dashMode = false;
      this.updateModeButtons();
      this.startDash(dir);
      return;
    }
    this.act((g) => Act.move(g, dir));
  }

  updateModeButtons() {
    document.querySelector('#actions [data-cmd="dash"]')?.classList.toggle('active', this.dashMode);
    document.querySelector('#actions [data-cmd="face"]')?.classList.toggle('active', this.faceMode);
  }

  cmd(name) {
    if (this.mode !== 'play' || !this.g) return false;
    if (this.ui.blocking) return false;
    switch (name) {
      case 'attack':
        this.act(Act.attack);
        return true;
      case 'wait':
        this.act(Act.wait);
        return true;
      case 'fire':
        this.act((g) => Act.fireArrow(g));
        return true;
      case 'inventory':
        this.openInventory();
        return true;
      case 'feet':
        this.openFeet();
        return true;
      case 'map':
        this.ui.renderMap(this.g, this.renderer);
        return true;
      case 'log':
        this.ui.renderFullLog(this.g);
        return true;
      case 'help':
        this.ui.renderHelp();
        return true;
      case 'dash':
        this.dashMode = !this.dashMode;
        this.faceMode = false;
        this.updateModeButtons();
        this.ui.toast(this.dashMode ? 'ダッシュ： 方向を えらんでください' : 'ダッシュ 解除');
        return true;
      case 'face':
        this.faceMode = !this.faceMode;
        this.dashMode = false;
        this.updateModeButtons();
        this.ui.toast(this.faceMode ? '向き変更： 方向を えらんでください' : '向き変更 解除');
        return true;
      default:
        return false;
    }
  }

  // ----------------------------------------------------------------- menus

  openInventory(index = 0) {
    const g = this.g;
    const items = inventoryItems(g);
    if (!items.length) {
      this.ui.toast('持ち物は なにもない');
      return;
    }
    this.ui.openMenu({
      title: `持ち物（${g.player.inv.length}/16）`,
      footer: statusSummary(g),
      items,
      index,
      onSelect: (uid) => this.openItemActions(uid, items.findIndex((i) => i.value === uid)),
    });
  }

  openItemActions(uid, index) {
    const g = this.g;
    const item = findInv(g, uid);
    if (!item) return;
    const d = ITEMS[item.id];
    const p = g.player;
    const equipped = p.weapon === uid || p.shield === uid;
    const acts = [];
    if (item.unpaid) acts.push({ label: `（未払い ${item.price} 金貨）店主に 話しかけて 払おう`, disabled: true, value: null });
    if (d.cat === 'herb') acts.push({ label: '食べる', value: 'use' });
    if (d.cat === 'scroll') acts.push({ label: '読む', value: 'use' });
    if (d.cat === 'staff') acts.push({ label: 'ふる（向いている方向）', value: 'use' });
    if (d.cat === 'weapon' || d.cat === 'shield') acts.push({ label: equipped ? 'はずす' : '装備する', value: 'equip' });
    if (d.cat === 'arrow') acts.push({ label: '撃つ（向いている方向）', value: 'fire' });
    acts.push({ label: '投げる（向いている方向）', value: 'throw' });
    acts.push({ label: '置く', value: 'drop', disabled: equipped });
    acts.push({ label: 'もどる', value: 'back' });
    this.ui.openMenu({
      title: displayName(item),
      footer: d.desc || '',
      items: acts,
      onSelect: (v) => {
        switch (v) {
          case 'use':
            this.act((gg) => Act.useItem(gg, uid), { fromMenu: true });
            break;
          case 'equip':
            this.act((gg) => Act.equip(gg, uid), { fromMenu: true });
            break;
          case 'fire':
            this.act((gg) => Act.fireArrow(gg, uid), { fromMenu: true });
            break;
          case 'throw':
            this.act((gg) => Act.throwItem(gg, uid), { fromMenu: true });
            break;
          case 'drop':
            this.act((gg) => Act.dropItem(gg, uid), { fromMenu: true });
            break;
          default:
            this.openInventory(index);
        }
      },
      onCancel: () => this.openInventory(index),
    });
  }

  openFeet() {
    const g = this.g;
    const p = g.player;
    const f = g.floor;
    const e = itemAt(f, p.x, p.y);
    const tr = trapAt(f, p.x, p.y);
    const onStairs = tileAt(f, p.x, p.y) === T.STAIRS;
    const items = [];
    if (e) items.push({ label: `${displayName(e.item)}を 拾う${e.item.price ? `（${e.item.price} 金貨）` : ''}`, desc: ITEMS[e.item.id].desc, value: 'pickup' });
    if (onStairs) items.push({ label: '階段を のぼる', value: 'descend' });
    if (tr && tr.visible) items.push({ label: `${TRAPS[tr.id].name}（罠）`, desc: TRAPS[tr.id].desc, disabled: true, value: null });
    if (!items.length) {
      this.ui.toast('足元には 何もない');
      return;
    }
    items.push({ label: 'もどる', value: 'back' });
    this.ui.openMenu({
      title: '足元',
      items,
      onSelect: (v) => {
        if (v === 'pickup') this.act(Act.pickupHere, { fromMenu: true });
        else if (v === 'descend') this.act(Act.descend, { fromMenu: true });
      },
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.starfall = new App();
});
