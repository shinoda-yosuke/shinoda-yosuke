// DOM side of the UI: HUD, message log, list menus, yes/no dialogs, overlays.
import { ITEMS, displayName, CAT_LABEL } from '../data/items.js';
import { computeScore, playerAtk, playerDef, expForLevel } from '../game/combat.js';
import { drawSpriteTo } from '../render/sprites.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(app) {
    this.app = app;
    this.menu = null;
    this.dialog = null;
    this.overlay = null;
    this.lastLogN = 0;
    this.el = {
      hudFloor: $('hud-floor'),
      hudLv: $('hud-lv'),
      hudHpBar: $('hud-hpbar'),
      hudHp: $('hud-hp'),
      hudStr: $('hud-str'),
      hudGold: $('hud-gold'),
      hudTurn: $('hud-turn'),
      hudStatus: $('hud-status'),
      hudEquip: $('hud-equip'),
      log: $('log'),
      menu: $('menu'),
      menuTitle: $('menu-title'),
      menuList: $('menu-list'),
      menuDesc: $('menu-desc'),
      dialog: $('dialog'),
      dialogText: $('dialog-text'),
      dialogYes: $('dialog-yes'),
      dialogNo: $('dialog-no'),
      title: $('overlay-title'),
      result: $('overlay-result'),
      map: $('overlay-map'),
      mapCanvas: $('mapcanvas'),
      logOverlay: $('overlay-log'),
      logFull: $('log-full'),
      help: $('overlay-help'),
      toast: $('toast'),
    };
    this.el.dialogYes.addEventListener('click', () => this.resolveDialog(true));
    this.el.dialogNo.addEventListener('click', () => this.resolveDialog(false));
    this.openedAt = 0;
    for (const ov of [this.el.map, this.el.logOverlay, this.el.help]) {
      ov.addEventListener('click', (e) => {
        if (e.target.classList.contains('close')) this.hideOverlay();
        else if (e.target === ov && performance.now() - this.openedAt > 400) this.hideOverlay();
      });
    }
    this.el.menu.addEventListener('click', (e) => {
      if (e.target === this.el.menu && performance.now() - this.openedAt > 400) this.cancelMenu();
    });
  }

  /** True while something modal is open that should swallow game input. */
  get blocking() {
    return !!(this.menu || this.dialog || this.overlay);
  }

  // ------------------------------------------------------------------- HUD

  updateHud(g) {
    const p = g.player;
    const e = this.el;
    e.hudFloor.textContent = `B${g.depth}F`;
    e.hudLv.textContent = `Lv ${p.lv}`;
    const ratio = p.maxHp ? p.hp / p.maxHp : 0;
    e.hudHpBar.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
    e.hudHpBar.className = ratio > 0.5 ? 'ok' : ratio > 0.25 ? 'warn' : 'danger';
    e.hudHp.textContent = `${p.hp}/${p.maxHp}`;
    e.hudStr.textContent = `ちから ${p.str}${p.str < p.maxStr ? `/${p.maxStr}` : ''}`;
    e.hudGold.textContent = `${p.gold} G`;
    e.hudTurn.textContent = `T${g.turn}`;
    const st = [];
    if (p.st.sleep > 0) st.push(['ねむり', 'sleep']);
    if (p.st.confuse > 0) st.push(['こんらん', 'confuse']);
    if (p.st.haste > 0) st.push(['はやい', 'haste']);
    if (p.st.slow > 0) st.push(['おそい', 'slow']);
    e.hudStatus.innerHTML = st.map(([t, c]) => `<span class="chip ${c}">${t}</span>`).join('');
    const w = p.weapon ? p.inv.find((i) => i.uid === p.weapon) : null;
    const s = p.shield ? p.inv.find((i) => i.uid === p.shield) : null;
    e.hudEquip.textContent = `${w ? displayName(w) : '武器なし'} ／ ${s ? displayName(s) : '盾なし'}`;
  }

  updateLog(g) {
    const items = g.log.slice(-4);
    this.el.log.innerHTML = items
      .map((m, i) => `<div class="msg ${m.kind}${m.n > this.lastLogN ? ' new' : ''}" style="opacity:${0.55 + (i / Math.max(1, items.length - 1)) * 0.45}">${escapeHtml(m.text)}</div>`)
      .join('');
    this.lastLogN = g.logCount || 0;
  }

  toast(text, ms = 1600) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------------ menus

  /** items: [{ label, desc, value, disabled, right }] */
  openMenu({ title, items, onSelect, onCancel, index = 0, footer = '' }) {
    this.menu = { title, items, onSelect, onCancel, index: Math.min(index, Math.max(0, items.length - 1)) };
    this.el.menuTitle.textContent = title;
    this.el.menu.querySelector('.menu-footer').textContent = footer;
    this.renderMenu();
    this.openedAt = performance.now();
    this.el.menu.classList.remove('hidden');
  }

  renderMenu() {
    const m = this.menu;
    if (!m) return;
    this.el.menuList.innerHTML = m.items
      .map(
        (it, i) =>
          `<li class="${i === m.index ? 'sel' : ''}${it.disabled ? ' disabled' : ''}" data-i="${i}">` +
          `<span class="label">${escapeHtml(it.label)}</span>${it.right ? `<span class="right">${escapeHtml(it.right)}</span>` : ''}</li>`,
      )
      .join('');
    for (const li of this.el.menuList.querySelectorAll('li')) {
      li.addEventListener('click', () => {
        m.index = Number(li.dataset.i);
        this.selectMenu();
      });
    }
    const cur = m.items[m.index];
    this.el.menuDesc.textContent = cur ? cur.desc || '' : '';
    const sel = this.el.menuList.querySelector('li.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  moveMenu(delta) {
    const m = this.menu;
    if (!m || !m.items.length) return;
    m.index = (m.index + delta + m.items.length) % m.items.length;
    this.renderMenu();
  }

  selectMenu() {
    const m = this.menu;
    if (!m) return;
    const it = m.items[m.index];
    if (!it || it.disabled) return;
    this.closeMenu();
    m.onSelect(it.value, it);
  }

  cancelMenu() {
    const m = this.menu;
    this.closeMenu();
    if (m && m.onCancel) m.onCancel();
  }

  closeMenu() {
    this.menu = null;
    this.el.menu.classList.add('hidden');
  }

  // ----------------------------------------------------------------- dialog

  ask(text, { yes = 'はい', no = 'いいえ', defaultYes = true } = {}) {
    return new Promise((resolve) => {
      this.dialog = { resolve, focus: defaultYes ? 0 : 1 };
      this.el.dialogText.textContent = text;
      this.el.dialogYes.textContent = yes;
      this.el.dialogNo.textContent = no;
      this.renderDialogFocus();
      this.el.dialog.classList.remove('hidden');
    });
  }

  renderDialogFocus() {
    if (!this.dialog) return;
    this.el.dialogYes.classList.toggle('focus', this.dialog.focus === 0);
    this.el.dialogNo.classList.toggle('focus', this.dialog.focus === 1);
  }

  resolveDialog(v) {
    const d = this.dialog;
    if (!d) return;
    this.dialog = null;
    this.el.dialog.classList.add('hidden');
    d.resolve(v);
  }

  // --------------------------------------------------------------- overlays

  showOverlay(name) {
    this.hideOverlay();
    this.overlay = name;
    this.openedAt = performance.now();
    const el = { map: this.el.map, log: this.el.logOverlay, help: this.el.help, title: this.el.title, result: this.el.result }[name];
    if (el) el.classList.remove('hidden');
  }

  hideOverlay() {
    for (const el of [this.el.map, this.el.logOverlay, this.el.help, this.el.title, this.el.result]) el.classList.add('hidden');
    this.overlay = null;
  }

  renderTitle({ hasSave, rec }) {
    const t = this.el.title;
    t.querySelector('#title-continue').classList.toggle('hidden', !hasSave);
    const best = rec && rec.best;
    t.querySelector('#title-record').textContent = best
      ? `これまでの記録： 最深 B${best.depth}F ／ 最高スコア ${best.score.toLocaleString()} ／ ${rec.plays} 回の冒険`
      : 'まだ 冒険の記録は ありません';
    const c = t.querySelector('#title-sprite');
    if (c) {
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      drawSpriteTo(ctx, 'lumi_d', 0, 0, c.width);
    }
    this.showOverlay('title');
  }

  renderResult(g, info) {
    const p = g.player;
    const r = this.el.result;
    r.querySelector('#result-title').textContent = `ルミは B${g.depth}F で たおれた……`;
    r.querySelector('#result-cause').textContent = g.cause || '';
    const rows = [
      ['到達した階', `B${p.deepest}F`],
      ['レベル', `${p.lv}`],
      ['たおした敵', `${p.kills}`],
      ['ターン数', `${g.turn}`],
      ['所持金', `${p.gold} G`],
      ['スコア', `${(g.score || computeScore(g)).toLocaleString()}`],
    ];
    r.querySelector('#result-table').innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
    const badge = r.querySelector('#result-badge');
    if (info && (info.isNewDepth || info.isNewScore)) {
      badge.textContent = info.isNewDepth ? '最深記録 更新！' : '最高スコア 更新！';
      badge.classList.remove('hidden');
    } else badge.classList.add('hidden');
    this.showOverlay('result');
  }

  renderMap(g, renderer) {
    const c = this.el.mapCanvas;
    const panel = c.parentElement;
    const cssW = Math.min(window.innerWidth - 32, 900);
    const cssH = Math.min(window.innerHeight - 120, 560);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const s = Math.max(2, Math.floor(Math.min((cssW * dpr) / g.floor.w, (cssH * dpr) / g.floor.h)));
    c.width = g.floor.w * s + 8;
    c.height = g.floor.h * s + 8;
    c.style.width = `${c.width / dpr}px`;
    c.style.height = `${c.height / dpr}px`;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b0a14';
    ctx.fillRect(0, 0, c.width, c.height);
    renderer.drawMapInto(ctx, g, 4, 4, s, true);
    panel.querySelector('.map-caption').textContent = `B${g.depth}F ── 白: 部屋  灰: 通路  緑: 階段  水色: アイテム  赤: 敵/罠  黄: 店`;
    this.showOverlay('map');
  }

  renderFullLog(g) {
    this.el.logFull.innerHTML = g.log
      .slice(-60)
      .map((m) => `<li class="${m.kind}"><span class="t">T${m.t}</span>${escapeHtml(m.text)}</li>`)
      .join('');
    this.showOverlay('log');
    this.el.logFull.scrollTop = this.el.logFull.scrollHeight;
  }

  renderHelp() {
    this.showOverlay('help');
  }

  // ------------------------------------------------------------------ input

  /** Returns true when the key was consumed by a modal element. */
  handleKey(e) {
    const k = e.key;
    if (this.dialog) {
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'h' || k === 'l' || k === 'Tab') {
        this.dialog.focus = this.dialog.focus === 0 ? 1 : 0;
        this.renderDialogFocus();
      } else if (k === 'Enter' || k === ' ') this.resolveDialog(this.dialog.focus === 0);
      else if (k === 'y' || k === 'Y') this.resolveDialog(true);
      else if (k === 'Escape' || k === 'n' || k === 'N' || k === 'Backspace') this.resolveDialog(false);
      return true;
    }
    if (this.menu) {
      if (k === 'ArrowUp' || k === 'k' || k === 'w') this.moveMenu(-1);
      else if (k === 'ArrowDown' || k === 'j' || k === 's') this.moveMenu(1);
      else if (k === 'Enter' || k === ' ' || k === 'ArrowRight' || k === 'l') this.selectMenu();
      else if (k === 'Escape' || k === 'Backspace' || k === 'x' || k === 'i' || k === 'ArrowLeft' || k === 'h') this.cancelMenu();
      return true;
    }
    if (this.overlay === 'map' || this.overlay === 'log' || this.overlay === 'help') {
      if (k === 'Escape' || k === 'm' || k === 'x' || k === '?' || k === 'Enter' || k === ' ') this.hideOverlay();
      return true;
    }
    return false;
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Build inventory menu entries. */
export function inventoryItems(g) {
  const p = g.player;
  return p.inv.map((it) => {
    const d = ITEMS[it.id];
    let label = displayName(it);
    if (it.uid === p.weapon || it.uid === p.shield) label = `Ｅ ${label}`;
    const right = it.unpaid ? `${it.price}G 未払い` : CAT_LABEL[d.cat] || '';
    let desc = d.desc || '';
    if (d.cat === 'weapon') desc = `攻撃 +${d.atk + (it.plus || 0)}。${desc}`;
    if (d.cat === 'shield') desc = `防御 +${d.def + (it.plus || 0)}。${desc}`;
    if (d.cat === 'arrow') desc = `いりょく ${d.atk}。${desc}`;
    return { label, right, desc, value: it.uid };
  });
}

export function statusSummary(g) {
  const p = g.player;
  const next = p.lv < 99 ? expForLevel(p.lv + 1) - p.exp : 0;
  return `攻撃 ${playerAtk(g)} ／ 防御 ${playerDef(g)} ／ 次のレベルまで ${next} exp`;
}
