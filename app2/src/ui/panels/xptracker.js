'use strict';
// RuneLite's XpPanel and XpInfoBox (net.runelite.client.plugins.xptracker, BSD 2-Clause, Copyright (c) 2017,
// Cameron <moberg@tuta.io>, Adam <Adam@sigterm.info> and RuneLite contributors), drawn from the state the XP Tracker
// clone (plugins/xptracker/page.js) publishes; every menu item, click and drag goes back to the plugin.
// NavigationButton: "XP Tracker", /skill_icons/overall.png, priority 2.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const SKILL_ICONS = '../plugins/runelite/assets/';
  const act = (action, args) => App.panelAction('xptracker', action, args);
  const rgb = (n) => `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
  // java.awt.Color.darker (DimmableJPanel)
  const darker = (n) => rgb((Math.floor(((n >> 16) & 255) * 0.7) << 16) | (Math.floor(((n >> 8) & 255) * 0.7) << 8) | Math.floor((n & 255) * 0.7));
  const BAR_BG = (61 << 16) | (56 << 8) | 49;

  // XpInfoBox.htmlLabel: the key in LIGHT_GRAY, the value in white
  const label = (key, value) => h('div.xpt-label', {}, h('span.xpt-key', { text: key }), h('span', { text: value }));

  function progressBar(b, color) {
    const fg = b.dimmed ? darker(color) : rgb(color);
    const bg = b.dimmed ? darker(BAR_BG) : rgb(BAR_BG);
    const pct = Math.max(0, Math.min(100, b.value));
    const bar = h('div.xpt-bar', { style: `background:${bg}`, tip: b.tooltip },
      h('div.xpt-bar-fill', { style: `width:${pct}%;background:${fg}` }),
      ...b.positions.filter((p) => p > pct).map((p) => h('div.xpt-bar-mark', { style: `left:${p}%;background:${fg}` })),
      h('span.xpt-bar-left', { text: b.left, class: b.dimmed ? 'dim' : null }),
      h('span.xpt-bar-center', { text: b.dimmed ? 'Paused' : b.center }),
      h('span.xpt-bar-right', { text: b.right, class: b.dimmed ? 'dim' : null }));
    return bar;
  }

  let dragSkill = null;
  function infoBox(s, index) {
    const menu = (e) => UI.popup(e, [
      ['Reset', () => act('reset', { skill: s.skill })],
      ['Reset others', () => act('resetOthers', { skill: s.skill })],
      ['Reset/hr', () => act('resetPerHour', { skill: s.skill })],
      [s.pauseText, () => act('pause', { skill: s.skill })],
      [s.canvas ? 'Remove from canvas' : 'Add to canvas', () => act('canvas', { skill: s.skill })],
    ]);
    const container = h('div.xpt-container', {
      draggable: 'true',
      oncontextmenu: menu,
      onclick: (e) => { if (e.button === 0) act('compact', { skill: s.skill }); },
      ondragstart: (e) => { dragSkill = s.skill; e.dataTransfer.effectAllowed = 'move'; },
      ondragover: (e) => { if (dragSkill) e.preventDefault(); },
      ondrop: (e) => { e.preventDefault(); if (dragSkill && dragSkill !== s.skill) act('reorder', { skill: dragSkill, position: index }); dragSkill = null; },
      ondragend: () => { dragSkill = null; },
    },
    s.compact ? null : h('div.xpt-header', {},
      h('div.xpt-icon', {}, h('img', { src: `${SKILL_ICONS}skill_icons/${s.skill.toLowerCase()}.png`, alt: '', draggable: 'false' })),
      h('div.xpt-stats', {}, ...s.labels.map((l) => (l ? label(l[0], l[1]) : h('div.xpt-label'))))),
    h(`div.xpt-progress${s.compact ? '.compact' : ''}`, {},
      s.compact ? h('div.xpt-icon-small', {}, h('img', { src: `${SKILL_ICONS}skill_icons_small/${s.skill.toLowerCase()}.png`, alt: '', draggable: 'false' })) : null,
      progressBar(s.bar, s.color)));
    return h('div.xpt-box', {}, container);
  }

  window.Panels.push({
    id: 'xptracker',
    tooltip: 'XP Tracker',
    icon: '../../../plugins/runelite/assets/skill_icons/overall.png',
    priority: 2,
    visible: () => App.config('lostlite', 'xptrackerPlugin', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const st = (App.state.pluginState || {}).xptracker || { overallVisible: false, overall: ['0', '0'], boxes: [] };
      const overall = h('div.xpt-overall', {
        oncontextmenu: (e) => UI.popup(e, [
          ['Reset All', () => act('resetAll')],
          ['Reset All/hr', () => act('resetAllPerHour')],
          ['Pause All', () => act('pauseAll')],
          ['Unpause All', () => act('unpauseAll')],
        ]),
      },
      h('img', { src: `${SKILL_ICONS}skill_icons/overall.png`, alt: '', draggable: 'false' }),
      h('div.xpt-overall-info', {}, label('Gained: ', st.overall[0]), label('Per hour: ', st.overall[1])));
      root.replaceChildren(h('div.xpt-panel', {},
        st.overallVisible ? overall : null,
        h('div.xpt-boxes', {}, ...st.boxes.map(infoBox)),
        st.overallVisible ? null : h('div.plugin-error', {}, h('div.plugin-error-title', { text: 'Exp trackers' }), h('div.plugin-error-text', { text: 'You have not gained experience yet.' }))));
    },
  });
})();
