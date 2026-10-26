'use strict';
// Farming tracker panel (after RuneLite's Time Tracking farming tab; see
// plugins/farming/descriptor.js): every patch by type, what's in it, its state and about when
// it's grown, with a bar for growing crops. The tracking is plugins/farming/game.js.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const state = () => (App.state.pluginState || {}).farming || null;
  const COLOURS = { grown: '#00c000', growing: '#ff981f', watered: '#5ba3ff', diseased: '#b39b27', dead: '#a04040', weeds: '#888', empty: '#888', unknown: '#666' };

  function when(ms, now) {
    const left = ms - now;
    if (left <= 0) return 'should be grown now';
    const min = Math.ceil(left / 60000);
    if (min < 60) return `in about ${min} min`;
    const hrs = Math.floor(min / 60);
    return `in about ${hrs} h ${min % 60} min`;
  }

  function row(p, now) {
    const colour = COLOURS[p.status] || '#888';
    let detail = p.text;
    if ((p.status === 'growing' || p.status === 'watered') && p.readyAt) detail = `Grown ${when(p.readyAt, now)}${p.status === 'watered' ? ' (watered)' : ''}`;
    const title = p.crop ? `${p.crop[0].toUpperCase()}${p.crop.slice(1)}` : p.text;
    return h('div.xp-box', {},
      h('div.xp-line', {}, h('span', { text: p.place }), h('span', { text: title, style: `color:${colour}` })),
      h('div.small.muted', { text: p.crop ? detail : '' }),
      p.progress !== undefined && (p.status === 'growing' || p.status === 'watered')
        ? h('div.xp-bar', {}, h('div.xp-bar-fill', { style: `width:${Math.round(p.progress * 100)}%;background:${colour}` }))
        : null);
  }

  window.Panels.push({
    id: 'farming',
    tooltip: 'Farming',
    icon: '../skills/farming.png',
    priority: 5,
    visible: () => App.config('lostlite', 'farmingPlugin', true) !== false,
    watch: ['pluginState', 'loggedIn'],
    render(root) {
      const st = state();
      if (!st || !st.account) {
        root.replaceChildren(h('div.xp-panel', {}, h('div.small.muted.xp-empty', { text: 'Log in to track your farming patches.' })));
        return;
      }
      const now = Date.now();
      const groups = [];
      for (const p of st.patches || []) {
        let g = groups.find((x) => x.type === p.type);
        if (!g) groups.push(g = { type: p.type, title: p.typeTitle, items: [] });
        g.items.push(p);
      }
      root.replaceChildren(h('div.xp-panel', {},
        h('div.small.muted', { text: 'Times are estimates: the tracker sees a patch change when you\'re logged in, and counts from there.' }),
        ...groups.flatMap((g) => [h('div.qh-title', { text: g.title, style: 'margin-top:8px' }), ...g.items.map((p) => row(p, now))])));
    },
  });
})();
