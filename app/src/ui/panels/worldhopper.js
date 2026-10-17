'use strict';
// Port of RuneLite's WorldSwitcherPanel: sortable header (World, Players, Ping, Activity),
// alternating rows, flag + coloured world number, favourites at the top via right-click.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h, icon } = UI;
  const FAV_KEY = 'favouriteWorlds';
  const view = { sort: 'world', desc: false };

  function favourites() {
    return String(App.config('worldhopper', FAV_KEY, '')).split(',').filter(Boolean).map(Number);
  }

  function setFavourite(id, on) {
    const list = favourites().filter((x) => x !== id);
    if (on) list.push(id);
    App.setConfig('worldhopper', FAV_KEY, list.join(','));
    App.renderPanel(false);
  }

  function header(key, label, cls) {
    const sorted = view.sort === key;
    return h('div', { class: cls }, h('button', {
      class: sorted ? (view.desc ? 'sorted desc' : 'sorted') : null,
      onclick: () => {
        if (view.sort === key) view.desc = !view.desc;
        else { view.sort = key; view.desc = false; }
        App.renderPanel(false);
      },
    }, label, sorted ? icon('arrow_down.png') : null));
  }

  function sortValue(w) {
    const s = App.state;
    switch (view.sort) {
      case 'players': return s.playerCounts && s.playerCounts[w.id] != null ? s.playerCounts[w.id] : -1;
      case 'ping': { const p = s.pings && s.pings[w.id]; return p == null || p < 0 ? Infinity : p; }
      case 'activity': return `${w.region} ${w.members ? 'members' : 'free'}`;
      default: return w.id;
    }
  }

  function render(root) {
    const s = App.state;
    const favs = favourites();
    const list = (s.worlds || []).slice().sort((a, b) => {
      const fa = favs.includes(a.id);
      const fb = favs.includes(b.id);
      if (fa !== fb) return fa ? -1 : 1;
      const va = sortValue(a);
      const vb = sortValue(b);
      const c = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return view.desc ? -c : c;
    });
    const rows = list.map((w, i) => {
      const current = w.id === s.world;
      const fav = favs.includes(w.id);
      const players = s.playerCounts && s.playerCounts[w.id] != null ? String(s.playerCounts[w.id]) : '-';
      const ping = s.pings && s.pings[w.id] != null ? (s.pings[w.id] < 0 ? '-' : `${s.pings[w.id]}ms`) : '';
      const row = h('div.wh-row', { class: i % 2 ? 'wh-row odd' : 'wh-row', tip: current ? 'Current world' : `Switch to world ${w.id}` },
        h('div.wh-col-world', {},
          h('span.fav', { text: fav ? '★' : '' }),
          w.flag ? h('img.flag', { src: `assets/flags/flag_${w.flag}.png`, alt: w.region }) : null,
          h('span.num', { class: `num ${current ? 'current' : w.members ? 'members' : 'free'}`, text: String(w.id) })),
        h('div.wh-col-players', { text: players }),
        h('div.wh-col-ping', { text: ping }),
        h('div.wh-col-act', { text: `${w.region} - ${w.members ? 'Members' : 'Free'}` }));
      row.addEventListener('click', () => { if (!current) window.lostlite.hop(w.id); });
      row.addEventListener('contextmenu', (e) => UI.popup(e, [
        [fav ? 'Remove from favourites' : 'Add to favourites', () => setFavourite(w.id, !fav)],
        ['Switch to this world', () => window.lostlite.hop(w.id)],
      ]));
      return row;
    });
    root.replaceChildren(
      h('div.wh-header', {},
        header('world', 'World', 'wh-col-world'),
        header('players', '#', 'wh-col-players'),
        header('ping', 'Ping', 'wh-col-ping'),
        header('activity', 'Activity', 'wh-col-act')),
      h('div', {}, ...rows),
      h('div.wh-note.small', {}, 'Click a world to switch to it. Log out first: the game reloads on the new world. Right-click to add favourites.'));
  }

  window.Panels.push({
    id: 'worldhopper',
    tooltip: 'World Switcher',
    icon: 'worldhopper_icon.png',
    priority: 3,
    watch: ['world', 'playerCounts', 'pings', 'worlds'],
    render(root, opts) {
      if (opts.fresh) window.lostlite.refreshWorlds();
      render(root);
    },
  });
})();
