'use strict';
// Info Boxes panel: which boxes to show (with Select all), how they look, and how to move
// them. The settings are the Info Boxes plugin's own (also under Configuration).
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const GROUP = 'infoboxes';

  function plugin() {
    return (App.state.plugins || []).find((p) => p.id === 'infoboxes') || null;
  }

  function kinds(p) {
    return p.config.items.filter((i) => i.key.startsWith('show_')).sort((a, b) => a.position - b.position);
  }

  /** RuneLite-style checkbox that can also be half ticked. */
  function triBox(state, onchange) {
    const b = UI.checkbox(state === true, onchange);
    if (state === 'mixed') b.setAttribute('aria-checked', 'mixed');
    return b;
  }

  function section(title, items) {
    return h('div.cfg-section', {},
      h('div.cfg-section-header', {}, h('span.sname', { text: title })),
      h('div.cfg-section-body', {}, ...items.map((it) => window.ConfigUI.item(GROUP, it))));
  }

  window.Panels.push({
    id: 'infoboxes',
    tooltip: 'Info Boxes',
    icon: 'infobox_icon.png',
    priority: 5,
    visible: () => App.config('lostlite', 'infoboxesPlugin', true) !== false,
    watch: ['config', 'plugins'],
    render(root) {
      const p = plugin();
      if (!p || !window.ConfigUI) {
        root.replaceChildren(h('div.pad', {}, h('div.small.muted', { text: 'Loading...' })));
        return;
      }
      // Every kind of box: this plugin's own, then the ones other plugins add (each with
      // its own setting, e.g. Timers & Buffs' "Antifire timer").
      const list = kinds(p).map((it) => ({ group: GROUP, it, from: null }));
      for (const other of App.state.plugins || []) {
        if (other.id === p.id || !Array.isArray(other.infoboxes)) continue;
        for (const key of other.infoboxes) {
          const it = other.config.items.find((i) => i.key === key);
          if (it) list.push({ group: other.config.group, it, from: other });
        }
      }
      const on = list.map((x) => App.config(x.group, x.it.key, x.it.default) !== false);
      const all = on.every(Boolean) ? true : on.some(Boolean) ? 'mixed' : false;
      const setAll = (v) => {
        for (const x of list) App.setConfig(x.group, x.it.key, v);
        App.renderPanel(false);
      };
      const rows = [];
      let lastFrom;
      list.forEach((x, i) => {
        if (x.from !== lastFrom) {
          lastFrom = x.from;
          if (x.from) {
            rows.push(h('div.small.muted.ib-from', { text: x.from.enabled === false ? `${x.from.name} (plugin off)` : x.from.name }));
          }
        }
        rows.push(h('div.cfg-item.ib-kind', { tip: x.it.description },
          h('span.label', { text: x.it.name }),
          UI.checkbox(on[i], (v) => { App.setConfig(x.group, x.it.key, v); App.renderPanel(false); })));
      });
      const byKey = (keys) => p.config.items.filter((i) => keys.includes(i.section)).sort((a, b) => a.position - b.position);
      root.replaceChildren(h('div.pad.ib', {},
        h('div.qh-title.bold', { text: 'Info Boxes' }),
        h('div.cfg-item.ib-all', {},
          h('span.label.bold', { text: 'Select all' }),
          triBox(all, () => setAll(all !== true))),
        h('div.ib-kinds', {}, ...rows),
        section('Boosts', byKey(['boosts'])),
        section('Logout timer', byKey(['logout'])),
        section('Prayer potion', byKey(['prayer'])),
        section('Layout', byKey(['look'])),
        section('Hint arrow', byKey(['hint'])),
        h('div.small.muted.ib-help', {},
          h('div', { text: 'Boxes are grouped by what they are (boosts, potions, prayer, spells...), each group in its own row.' }),
          h('div', { text: 'Hold Alt and drag a group (or a panel like the opponent\'s health bar) to put it where you want it.' }),
          h('div', { text: 'Alt + right-click one to put it back at the top left.' })),
        h('button.btn.block.ib-reset', {
          onclick: () => {
            App.setConfig(GROUP, 'layout', undefined);
          },
        }, 'Reset layout')));
    },
  });
})();
