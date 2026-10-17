'use strict';
// Title bar + sidebar controller. Panels register themselves in window.Panels with
// { id, tooltip, icon, priority, watch, render(root) }; the tab strip is built in
// priority order like RuneLite's NavigationButton.COMPARATOR.
/* global UI, Panels */

const App = {
  state: {},
  activeId: null,
  rendered: null,

  async init() {
    this.state = await window.lostlite.getState();
    window.lostlite.onEvent((ev) => this.onEvent(ev));
    this.buildTitlebar();
    this.activeId = this.state.activePanel && this.panels().find((p) => p.id === this.state.activePanel) ? this.state.activePanel : null;
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
    }
    if (changed.includes('title')) document.getElementById('title').textContent = this.state.title;
    if (changed.includes('maximized')) this.updateMaxButton();
    if (changed.includes('focused')) document.body.classList.toggle('blurred', !this.state.focused);
    if (changed.includes('activePanel') && this.state.activePanel !== this.activeId) {
      this.activeId = this.state.activePanel;
      this.buildTabs();
      this.renderPanel(true);
      return;
    }
    // A plugin with its own sidebar panel was switched on or off: add or remove its icon.
    if (changed.includes('config')) {
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

  // ---- title bar

  buildTitlebar() {
    document.getElementById('title').textContent = this.state.title || 'EASCape';
    document.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => window.lostlite.window(b.dataset.win)));
    document.getElementById('titlebar').addEventListener('dblclick', (e) => {
      if (!e.target.closest('button')) window.lostlite.window('maximize');
    });
    // Fallback window dragging. Normally the OS handles the title bar as a drag region
    // and these events never arrive; if it doesn't, move the window ourselves.
    const bar = document.getElementById('titlebar');
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.detail > 1 || e.target.closest('button')) return;
      bar.setPointerCapture(e.pointerId); // keeps pointerup coming even outside the window
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
    b.title = this.state.maximized ? 'Restore' : 'Maximize';
    b.innerHTML = this.state.maximized
      ? '<svg viewBox="0 0 10 10"><rect x=".5" y="2.5" width="7" height="7"/><path d="M2.5 2.5V.5h7v7h-2"/></svg>'
      : '<svg viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9"/></svg>';
  },

  buildToolbar() {
    // Sidebar open/close button, like RuneLite's title bar toolbar.
    const tb = document.getElementById('toolbar');
    const open = !!this.activeId;
    const img = UI.icon('sidebar_open.png', { style: open ? '' : 'transform:scaleX(-1)' });
    tb.replaceChildren(UI.h('button', { tip: open ? 'Close sidebar' : 'Open sidebar', onclick: () => this.toggleSidebar() }, img));
  },

  // ---- sidebar

  /** Panels that are showing (plugin panels only while their plugin is on), in your order
   *  (EASCape > Sidebar), then the rest by priority like RuneLite. */
  panels() {
    return this.ordered(Panels.filter((p) => !p.visible || p.visible()));
  },

  ordered(list) {
    const order = String(this.config('lostlite', 'sidebarOrder', '') || '').split(',').filter(Boolean);
    const rank = (p) => {
      const i = order.indexOf(p.id);
      return i < 0 ? 1000 + p.priority : i;
    };
    return list.slice().sort((a, b) => rank(a) - rank(b) || a.priority - b.priority);
  },

  panel() {
    return this.panels().find((p) => p.id === this.activeId);
  },

  buildTabs() {
    const nav = document.getElementById('tabs');
    const shown = this.panels();
    this.tabIds = shown.map((p) => p.id).join(',');
    nav.replaceChildren(...shown.map((p) => {
      const b = UI.h('button', { tip: p.tooltip, class: p.id === this.activeId ? 'active' : null, 'aria-label': p.tooltip }, UI.icon(p.icon));
      b.addEventListener('click', () => this.select(p.id === this.activeId ? null : p.id));
      return b;
    }));
    document.body.classList.toggle('panel-closed', !this.activeId);
    this.buildToolbar();
  },

  select(id) {
    UI.hideTip();
    if (id) this.lastId = id;
    this.activeId = id;
    this.state.activePanel = id;
    window.lostlite.setPanel(id);
    this.buildTabs();
    this.renderPanel(true);
  },

  toggleSidebar() {
    this.select(this.activeId ? null : (this.lastId || 'config'));
  },

  renderPanel(fresh, changed) {
    const root = document.getElementById('panel');
    const p = this.panel();
    if (!p) {
      root.replaceChildren();
      return;
    }
    const scroll = fresh ? 0 : root.scrollTop;
    p.render(root, { fresh, changed: changed || [] });
    root.scrollTop = scroll;
  },

  // ---- helpers shared by panels

  config(group, key, fallback) {
    const v = this.state.config[`${group}.${key}`];
    return v === undefined ? fallback : v;
  },

  setConfig(group, key, value) {
    const k = `${group}.${key}`;
    if (value === undefined) delete this.state.config[k];
    else this.state.config[k] = value;
    window.lostlite.setConfig(group, key, value);
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
