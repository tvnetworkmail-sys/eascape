'use strict';
// RuneLite's WorldSwitcherPanel, WorldTableHeader and WorldTableRow (net.runelite.client.plugins.worldhopper, BSD
// 2-Clause, Copyright (c) 2018, Psikoi <https://github.com/psikoi> and RuneLite contributors), drawn from the rows
// the World Hopper clone (plugins/worldhopper/page.js) publishes; hops, favourites and refresh go back to it.
// NavigationButton: "World Switcher", worldhopper/icon.png, priority 3 (shown while "Show world switcher sidebar").
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const IMG = '../plugins/worldhopper/';
  const act = (action, args) => App.panelAction('worldhopper', action, args);
  // WorldTableRow colours
  const CURRENT_WORLD = 'rgb(66,227,17)';
  const DANGEROUS_WORLD = 'rgb(251,62,62)';
  const BETA_WORLD = 'rgb(79,145,255)';
  const MEMBERS_WORLD = 'rgb(210,193,53)';
  const FREE_WORLD = 'rgb(200,200,200)';
  const SEASONAL_WORLD = 'rgb(133,177,178)';
  const PVP_ARENA_WORLD = 'rgb(144,179,255)';
  const QUEST_SPEEDRUNNING_WORLD = 'rgb(94,213,201)';
  const FRESH_START_WORLD = 'rgb(255,211,83)';
  const LOCATION_US_WEST = -73;
  const LOCATION_US_EAST = -42;
  // WorldSwitcherPanel's order (kept while the app runs, as the Swing panel's fields)
  const view = { orderIndex: 'WORLD', ascendingOrder: true };

  function getFlag(region, worldLocation) {
    switch (region) {
      case 'UNITED_STATES_OF_AMERICA':
        return worldLocation === LOCATION_US_WEST ? 'flag_us_west.png' : worldLocation === LOCATION_US_EAST ? 'flag_us_east.png' : 'flag_us.png';
      case 'UNITED_KINGDOM': return 'flag_uk.png';
      case 'AUSTRALIA': return 'flag_aus.png';
      default: return null;
    }
  }

  function activityColour(r) {
    if (r.current) return CURRENT_WORLD;
    const t = new Set(r.types);
    if (t.has('PVP') || t.has('HIGH_RISK') || t.has('DEADMAN') || t.has('HARDCORE_MAIN')) return DANGEROUS_WORLD;
    if (t.has('SEASONAL') || t.has('TOURNAMENT')) return SEASONAL_WORLD;
    if (t.has('NOSAVE_MODE') || t.has('BETA_WORLD') || t.has('LEGACY_ONLY')) return BETA_WORLD;
    if (t.has('PVP_ARENA')) return PVP_ARENA_WORLD;
    if (t.has('QUEST_SPEEDRUNNING')) return QUEST_SPEEDRUNNING_WORLD;
    if (t.has('FRESH_START_WORLD')) return FRESH_START_WORLD;
    return '#fff';
  }

  // WorldTableRow.playerCountString (null: our server publishes no count)
  const playerCountString = (n) => (n == null ? '-' : n < 0 ? 'OFF' : String(n));

  // WorldSwitcherPanel.updateList: order by the column (nulls last), then favourites first
  function sorted(rows) {
    const key = {
      PING: (r) => (r.ping > 0 ? r.ping : null),
      WORLD: (r) => r.id,
      PLAYERS: (r) => r.players,
      ACTIVITY: (r) => (r.activity !== '-' ? r.activity : null),
    }[view.orderIndex];
    const cmp = (a, b) => {
      const va = key(a); const vb = key(b);
      if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
      const c = typeof va === 'string' ? (va < vb ? -1 : va > vb ? 1 : 0) : va - vb;
      return view.ascendingOrder ? c : -c;
    };
    return rows.slice().sort(cmp).sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }

  // WorldTableHeader: title, arrow (highlighted down / up when ordering, faded up otherwise), right-click "Refresh worlds"
  function header(order, title, width) {
    const on = view.orderIndex === order;
    const arrow = h('img', { src: `${IMG}arrow_down.png`, alt: '', draggable: 'false', class: on ? (view.ascendingOrder ? 'on' : 'on up') : 'up faded' });
    return h('div.wh-th', {
      class: on ? 'wh-th ordering' : 'wh-th',
      style: width ? `width:${width}px;flex:none` : 'flex:1',
      onmousedown: (e) => {
        if (e.button !== 0) return;
        view.ascendingOrder = view.orderIndex !== order || !view.ascendingOrder;
        view.orderIndex = order;
        App.renderPanel(false);
      },
      oncontextmenu: (e) => UI.popup(e, [['Refresh worlds', () => act('refresh')]]),
    }, h('span', { text: title }), arrow);
  }

  function row(r, i, showPing) {
    const flag = getFlag(r.region, r.location);
    const white = r.current ? CURRENT_WORLD : '#fff';
    const el = h('div.wh-row', { class: i % 2 === 0 ? 'wh-row odd' : 'wh-row' },
      h('div.wh-world', {},
        flag ? h('img', { src: IMG + flag, alt: '', draggable: 'false' }) : null,
        h('span', { text: String(r.id), style: `color:${r.current ? CURRENT_WORLD : r.types.includes('MEMBERS') ? MEMBERS_WORLD : FREE_WORLD}` })),
      h('div.wh-players', { text: playerCountString(r.players), style: `color:${white}` }),
      h('div.wh-activity', { text: r.activity, style: `color:${activityColour(r)}`, tip: r.activity && r.activity.length > 16 ? r.activity : null }),
      h('div.wh-ping', { text: !showPing || r.ping == null || r.ping <= 0 ? '-' : String(r.ping), style: `color:${white}` }));
    el.addEventListener('dblclick', () => act('hop', { id: r.id }));
    el.addEventListener('contextmenu', (e) => UI.popup(e, [
      [r.favorite ? `Remove ${r.id} from favorites` : `Add ${r.id} to favorites`, () => act('favorite', { id: r.id, add: !r.favorite })],
    ]));
    return el;
  }

  window.Panels.push({
    id: 'worldhopper',
    tooltip: 'World Switcher',
    icon: '../../../plugins/worldhopper/icon.png',
    priority: 3,
    visible: () => App.config('lostlite', 'worldhopperPlugin', true) !== false && App.config('worldhopper', 'showSidebar', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const st = (App.state.pluginState || {}).worldhopper || { rows: [] };
      const showPing = App.config('worldhopper', 'ping', true) !== false;
      root.replaceChildren(h('div.wh-panel', {},
        h('div.wh-header', {},
          header('WORLD', 'World', 60),
          header('PLAYERS', '#', 40),
          header('ACTIVITY', 'Activity', 0),
          header('PING', 'Ping', 47)),
        h('div.wh-list', {}, ...sorted(st.rows).map((r, i) => row(r, i, showPing)))));
    },
  });
})();
