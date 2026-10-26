'use strict';
// Time Tracking panel, farming part (RuneLite's TimeTrackingPanel, OverviewTabPanel and
// FarmingTabPanel; BSD 2-Clause, see plugins/farming/descriptor.js): a row of item-icon tabs
// (Overview, then a tab per patch type), and per patch a box with the crop's icon, "Region
// (Patch)", when it's done, a bell and a thin progress bar in the crop state's colour. The
// tracking is plugins/farming/game.js.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const state = () => (App.state.pluginState || {}).farming || null;
  const view = { tab: 'overview' };
  try { view.tab = localStorage.getItem('farming.tab') || 'overview'; } catch (e) { /* no storage */ }

  // CropState colours (ColorScheme), drawn .darker() on the bar as RuneLite does (Color.darker: x0.7)
  const darker = ([r, g, b]) => `rgb(${Math.floor(r * 0.7)},${Math.floor(g * 0.7)},${Math.floor(b * 0.7)})`;
  const COLOURS = { HARVESTABLE: [55, 240, 70], GROWING: [55, 240, 70], DISEASED: [230, 198, 30], DEAD: [230, 30, 30], EMPTY: [77, 77, 77] };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = (n) => String(n).padStart(2, '0');

  /** TabContentPanel.getFormattedEstimate */
  function formatted(ms, mode) {
    const secs = Math.max(0, Math.floor((ms - Date.now()) / 1000));
    if (mode === 'RELATIVE') {
      const dur = Math.floor((secs + 59) / 60);
      const m = dur % 60;
      const hrs = Math.floor(dur / 60) % 24;
      const d = Math.floor(dur / 1440);
      return `in ${d > 0 ? `${d}d ` : ''}${hrs > 0 ? `${hrs}h ` : ''}${m > 0 ? `${m}m ` : ''}`;
    }
    const end = new Date(Date.now() + secs * 1000);
    const day = end.getDay() !== new Date().getDay() ? `${DAYS[end.getDay()]} ` : '';
    let t;
    if (mode === 'ABSOLUTE_12H') {
      const hr = end.getHours() % 12 || 12;
      t = `${hr}:${pad(end.getMinutes())} ${end.getHours() < 12 ? 'AM' : 'PM'}`;
    } else t = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
    return `${day}at ${t}`;
  }

  const icon = (st, id) => {
    const url = st.icons && id != null && st.icons[id];
    return url ? h('img', { src: url, alt: '', draggable: 'false' }) : null;
  };
  const select = (tab) => {
    view.tab = tab;
    try { localStorage.setItem('farming.tab', tab); } catch (e) { /* no storage */ }
    App.renderPanel(true);
  };
  const command = (c) => App.setConfig('farming', 'command', Object.assign({ t: Date.now() }, c));

  /** FarmingTabPanel.update, for one patch */
  function patchBox(st, p) {
    const pr = p.prediction;
    let estimate;
    let bar = null;
    let ico;
    if (!pr) {
      ico = icon(st, st.weedsIcon);
      estimate = 'Unknown';
    } else {
      ico = icon(st, pr.item);
      if (pr.cropState === 'HARVESTABLE') estimate = 'Done';
      else if (pr.cropState === 'GROWING') estimate = pr.doneEstimate < Date.now() ? 'Done' : `Done ${formatted(pr.doneEstimate, st.timeFormatMode)}`;
      else if (pr.cropState === 'DISEASED') estimate = 'Diseased';
      else if (pr.cropState === 'DEAD') estimate = 'Dead';
      else estimate = 'Empty';
      // hide any fully grown weeds' progress bar
      if (!pr.weeds || pr.stage < pr.stages - 1) {
        const max = pr.stages - 1;
        const pct = max > 0 ? Math.round((pr.stage / max) * 100) : 0;
        bar = h('div.tt-bar', {}, h('div', { style: `width:${pct}%;background:${darker(COLOURS[pr.cropState] || COLOURS.EMPTY)}` }));
      }
    }
    const bell = h('button.tt-bell', {
      tip: p.notify ? 'Disable notifications' : 'Enable notifications',
      onclick: () => command({ action: 'notify', index: p.index, on: !p.notify }),
    }, h('img', { src: `assets/icons/${p.notify ? 'farming_notify_selected_icon' : 'farming_notify_icon'}.png`, alt: '' }));
    return h('div.tt-box', {},
      h('div.tt-row', {},
        h('div.tt-icon', { tip: pr ? pr.produce : 'Unknown state' }, ico),
        h('div.tt-text', {}, h('div.small.tt-title', { text: p.title }), h('div.small.tt-sub', { text: estimate })),
        bell),
      bar);
  }

  /** OverviewTabPanel: a box per patch type with FarmingTracker's summary, click to open its tab */
  function overviewBox(st, type) {
    const t = st.types[type];
    const list = st.patches.filter((p) => p.type === type);
    let allUnknown = true;
    let allEmpty = true;
    let latest = 0;
    for (const p of list) {
      const pr = p.prediction;
      if (!pr || pr.item == null) continue;
      allUnknown = false;
      if (pr.ignore || pr.cropState === 'EMPTY') continue;
      allEmpty = false;
      latest = Math.max(latest, pr.doneEstimate);
    }
    let status = 'Unknown';
    let colour = '';
    if (!allUnknown && allEmpty) status = 'Empty';
    else if (!allUnknown && latest <= Date.now()) { status = 'Ready'; colour = 'color:rgb(55,240,70)'; } else if (!allUnknown) status = `Ready ${formatted(latest, st.timeFormatMode)}`;
    return h('div.tt-box.tt-click', { onclick: () => select(String(type)) },
      h('div.tt-row', {},
        h('div.tt-icon', {}, icon(st, t.icon)),
        h('div.tt-text', {}, h('div.small.tt-title', { text: t.title }), h('div.small.tt-sub', { text: status, style: colour })),
        h('img.tt-arrow', { src: 'assets/icons/timetracking_arrow_right.png', alt: '' })));
  }

  window.Panels.push({
    id: 'farming',
    tooltip: 'Time Tracking',
    icon: 'timetracking_watch.png',
    priority: 5,
    visible: () => App.config('lostlite', 'farmingPlugin', true) !== false,
    watch: ['pluginState', 'loggedIn'],
    render(root) {
      const st = state();
      if (!st || !st.account) {
        root.replaceChildren(h('div.xp-panel', {}, h('div.small.muted.xp-empty', { text: 'Log in to track your farming patches.' })));
        return;
      }
      const order = st.tabOrder || Object.keys(st.types).map(Number);
      if (view.tab !== 'overview' && !st.types[view.tab]) view.tab = 'overview';
      const tab = (key, id, tip) => h('button', { class: view.tab === key ? 'mtab selected' : 'mtab', tip, onclick: () => select(key) }, icon(st, id) || h('span.small', { text: tip.slice(0, 2) }));
      const tabs = h('div.mtabs.tt-tabs', {}, tab('overview', st.overviewIcon, 'Overview'), ...order.map((k) => tab(String(k), st.types[k].icon, st.types[k].title)));
      const body = view.tab === 'overview'
        ? order.map((k) => overviewBox(st, k))
        : st.patches.filter((p) => String(p.type) === view.tab).map((p) => patchBox(st, p));
      root.replaceChildren(h('div.tt-panel', {}, tabs, h('div.tt-list', {}, ...body)));
    },
  });
})();
