'use strict';
// The shell: RuneLite's ClientUI. Title pane with the ClientToolbarPanel (sidebar toggle) and the
// window buttons; the sidebar is a JTabbedPane on the right whose tabs can all be deselected (only
// the icon strip shows) and which the toolbar button hides altogether. Panels register in
// window.Panels with { id, tooltip, icon, priority, watch, render(root, opts), visible? }; tabs go
// in NavigationButton.COMPARATOR order (priority, then tooltip).
/* global UI, Panels */

const App = {
  state: {},
  activeId: null,
  sidebarOpen: true,

  async init() {
    this.state = await window.lostlite.getState();
    window.lostlite.onEvent((ev) => this.onEvent(ev));
    this.buildTitlebar();
    this.activeId = this.state.activePanel && this.panels().find((p) => p.id === this.state.activePanel) ? this.state.activePanel : null;
    this.sidebarOpen = this.state.sidebarOpen !== false;
    document.body.classList.toggle('maximized', !!this.state.maximized);
    this.buildTabs();
    this.renderPanel(true);
  },

  // ---- events from main

  onEvent(ev) {
    let changed = [];
    if (ev.type === 'patch') {
      Object.assign(this.state, ev.data);
      changed = Object.keys(ev.data);
    } else if (ev.type === 'config') {
      const k = `${ev.data.group}.${ev.data.key}`;
      if (ev.data.value === undefined) delete this.state.config[k];
      else this.state.config[k] = ev.data.value;
      changed = ['config', `config:${k}`];
    } else if (ev.type === 'log') {
      this.state.log = [...(this.state.log || []), ev.data].slice(-200);
      changed = ['log'];
    } else if (ev.type === 'toast') {
      UI.toast(ev.data.title, ev.data.body);
      return;
    }
    if (changed.includes('title')) document.getElementById('title').textContent = this.state.title;
    if (changed.includes('maximized')) {
      this.updateMaxButton();
      document.body.classList.toggle('maximized', !!this.state.maximized);
    }
    if (changed.includes('focused')) document.body.classList.toggle('blurred', !this.state.focused);
    if ((changed.includes('activePanel') && this.state.activePanel !== this.activeId)
      || (changed.includes('sidebarOpen') && this.state.sidebarOpen !== this.sidebarOpen)) {
      this.activeId = this.state.activePanel;
      this.sidebarOpen = this.state.sidebarOpen !== false;
      this.buildTabs();
      this.renderPanel(true);
      return;
    }
    // A plugin with its own sidebar panel was switched on or off: add or remove its tab.
    if (changed.includes('config') || changed.includes('plugins')) {
      const ids = this.panels().map((p) => p.id).join(',');
      if (ids !== this.tabIds) {
        if (this.activeId && !this.panels().some((p) => p.id === this.activeId)) {
          this.select(null);
          return;
        }
        this.buildTabs();
      }
    }
    const panel = this.panel();
    if (panel && changed.some((k) => (panel.watch || []).includes(k))) this.renderPanel(false, changed);
  },

  // ---- title pane

  buildTitlebar() {
    document.getElementById('title').textContent = this.state.title || '2006RS-2';
    document.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => window.lostlite.window(b.dataset.win)));
    const bar = document.getElementById('titlebar');
    bar.addEventListener('dblclick', (e) => {
      if (!e.target.closest('button')) window.lostlite.window('maximize');
    });
    // Fallback window dragging. Normally the OS handles the title bar as a drag region
    // and these events never arrive; if it doesn't, move the window ourselves.
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.detail > 1 || e.target.closest('button')) return;
      bar.setPointerCapture(e.pointerId);
      window.lostlite.window('drag-start');
      const up = () => {
        window.lostlite.window('drag-end');
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('lostpointercapture', up);
      };
      bar.addEventListener('pointerup', up);
      bar.addEventListener('lostpointercapture', up);
    });
    this.updateMaxButton();
  },

  updateMaxButton() {
    const b = document.getElementById('max-btn');
    b.setAttribute('aria-label', this.state.maximized ? 'Restore' : 'Maximize');
    // FlatWindowMaximizeIcon / FlatWindowRestoreIcon, symbol height 10, centred in 33 x 23
    b.innerHTML = this.state.maximized
      ? '<svg viewBox="0 0 33 23"><rect x="11.5" y="8.5" width="7" height="7" fill="none" stroke="currentColor"/><path d="M13.5 8.5v-2h7v7h-2" fill="none" stroke="currentColor"/></svg>'
      : '<svg viewBox="0 0 33 23"><rect x="11.5" y="6.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>';
  },

  buildToolbar() {
    // ClientToolbarPanel: the sidebar button (priority 100) shows open.png flipped while the
    // sidebar is open ("Close sidebar"), open.png while it's closed ("Open sidebar").
    const tb = document.getElementById('toolbar');
    const img = UI.icon(this.sidebarOpen ? 'sidebar_close.png' : 'sidebar_open.png');
    tb.replaceChildren(UI.h('button', { tip: this.sidebarOpen ? 'Close sidebar' : 'Open sidebar', onclick: () => this.toggleSidebar() }, img));
    // Screenshot's title bar NavigationButton "Take screenshot" (priority 0: before the sidebar button), its popup
    // "Open screenshot folder..." on right click
    if (this.config('lostlite', 'screenshotPlugin', true) !== false) {
      const shot = UI.h('button', {
        tip: 'Take screenshot',
        onclick: () => this.panelAction('screenshot', 'take'),
        oncontextmenu: (e) => UI.popup(e, [['Open screenshot folder...', () => this.panelAction('screenshot', 'openFolder')]]),
      }, UI.h('img', { src: '../plugins/screenshot/screenshot.png', alt: '', draggable: 'false' }));
      tb.prepend(shot);
    }
  },

  // ---- sidebar

  /** NavigationButtons of the plugins that are on, in NavigationButton.COMPARATOR order:
   *  priority, then tooltip (String.compareTo). */
  panels() {
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    return Panels.filter((p) => !p.visible || p.visible()).sort((a, b) => a.priority - b.priority || cmp(a.tooltip, b.tooltip));
  },

  panel() {
    return this.sidebarOpen ? this.panels().find((p) => p.id === this.activeId) : null;
  },

  buildTabs() {
    const nav = document.getElementById('tabs');
    const shown = this.panels();
    this.tabIds = shown.map((p) => p.id).join(',');
    nav.replaceChildren(...shown.map((p) => {
      const b = UI.h('button', { tip: p.tooltip, class: p.id === this.activeId ? 'active' : null, 'aria-label': p.tooltip }, UI.icon(p.icon));
      // deselectable: clicking the selected tab closes its panel, leaving the icon strip
      b.addEventListener('mousedown', (e) => { if (e.button === 0) this.select(p.id === this.activeId ? null : p.id); });
      if (p.popup) b.addEventListener('contextmenu', (e) => UI.popup(e, p.popup()));
      return b;
    }));
    document.body.classList.toggle('sidebar-closed', !this.sidebarOpen);
    document.body.classList.toggle('panel-closed', !this.activeId);
    this.buildToolbar();
  },

  select(id) {
    UI.hideTip();
    this.activeId = id;
    this.state.activePanel = id;
    window.lostlite.setPanel(id);
    this.buildTabs();
    this.renderPanel(true);
  },

  toggleSidebar() {
    UI.hideTip();
    this.sidebarOpen = !this.sidebarOpen;
    this.state.sidebarOpen = this.sidebarOpen;
    window.lostlite.setSidebar(this.sidebarOpen);
    this.buildTabs();
    this.renderPanel(true);
  },

  renderPanel(fresh, changed) {
    const root = document.getElementById('panel');
    const p = this.panel();
    if (!p) {
      root.replaceChildren();
      return;
    }
    const scroll = fresh ? 0 : root.scrollTop;
    root.classList.toggle('fill', !!p.fill);
    p.render(root, { fresh, changed: changed || [] });
    root.scrollTop = scroll;
  },

  // ---- helpers shared by panels

  config(group, key, fallback) {
    const v = this.state.config[`${group}.${key}`];
    return v === undefined ? fallback : v;
  },

  /** A RuneLite clone's panel acting on its plugin (in the game page): { action, ...args } */
  panelAction(id, action, args = {}) {
    window.lostlite.panelAction(id, { ...args, action });
  },

  setConfig(group, key, value) {
    const k = `${group}.${key}`;
    if (value === undefined) delete this.state.config[k];
    else this.state.config[k] = value;
    if (value === undefined) window.lostlite.unsetConfig(group, key);
    else window.lostlite.setConfig(group, key, value);
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
