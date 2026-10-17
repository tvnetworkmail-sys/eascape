'use strict';
// Loot Tracker panel, laid out like RuneLite's LootTrackerPanel / LootTrackerBox: the kill
// count at the top, then a box per monster (newest first) with "x kills" in its title bar and
// its drops in rows of five, each with the game's own icon and quantity. No prices (the 2004
// game can't know what items are worth). Right-click a box to reset it.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;

  const state = () => (App.state.pluginState || {}).loottracker || null;
  const command = (action, extra) => App.setConfig('loottracker', 'command', { action, t: Date.now(), ...extra });
  const fmt = (n) => Math.round(n).toLocaleString('en-GB');
  // RuneLite's QuantityFormatter.quantityToStackSize
  const stack = (n) => (n >= 10000000 ? `${Math.floor(n / 1000000)}M` : n >= 100000 ? `${Math.floor(n / 1000)}K` : String(n));

  function box(s, r) {
    // most of first (RuneLite sorts by value, which 2004 doesn't have)
    const items = Object.values(r.items).sort((a, b) => b.quantity - a.quantity);
    const slots = items.map((it) => {
      const icon = s.icons && s.icons[it.id];
      return h('div', { class: 'lt-slot', tip: `${it.name} x ${fmt(it.quantity)}` },
        icon ? h('img', { src: icon, alt: '', draggable: 'false' }) : h('span.lt-noicon', { text: it.name.slice(0, 3) }),
        it.quantity > 1 ? h('span.lt-qty', { text: stack(it.quantity) }) : null);
    });
    while (slots.length % 5) slots.push(h('div.lt-slot'));
    return h('div.lt-box', {
      oncontextmenu: (e) => UI.popup(e, [['Reset', () => command('reset', { name: r.name })]]),
    },
    h('div.lt-title', {},
      h('span.lt-name', { text: r.name }),
      h('span.lt-sub', { text: `x ${r.kills}` })),
    h('div.lt-items', {}, ...slots));
  }

  window.Panels.push({
    id: 'loottracker',
    tooltip: 'Loot Tracker',
    icon: 'loot_icon.png',
    priority: 5,
    visible: () => App.config('lostlite', 'loottrackerPlugin', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const s = state();
      const records = s ? Object.values(s.records || {}) : [];
      const kills = records.reduce((n, r) => n + r.kills, 0);
      // newest first: the order they were first added is kept, so reverse it
      records.reverse();
      root.replaceChildren(h('div.pad.lt', {},
        h('div.lt-overall', { oncontextmenu: (e) => UI.popup(e, [['Reset all', () => command('reset')]]) },
          UI.icon('loot_big.png', { class: 'lt-overall-icon' }),
          h('div', {},
            h('div', {}, h('span.white', { text: 'Total count: ' }), h('span.lt-light', { text: fmt(kills) })))),
        records.length ? null : h('div.small.muted.lt-empty', { text: s && s.account ? 'Kill something to start tracking its loot.' : 'Log in to start tracking loot.' }),
        ...records.map((r) => box(s, r))));
    },
  });
})();
