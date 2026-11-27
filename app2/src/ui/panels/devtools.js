'use strict';
// RuneLite's DevToolsPanel (net.runelite.client.plugins.devtools, BSD 2-Clause, Copyright (c) 2017, Kronos
// <https://github.com/KronosDesign>, (c) 2018, Adam and RuneLite contributors): a two-column grid of DevToolsButtons
// (green while active) from the Developer Tools clone's state (plugins/devtools/page.js); clicks go back to it.
// The Var Inspector frame ("RuneLite Var Inspector": a checkbox per var type, Clear, the log by tick) is shown under
// the grid while its button is active. NavigationButton: "Developer Tools", devtools_icon.png, priority 1.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const act = (action, args) => App.panelAction('devtools', action, args);

  function varInspector(vi) {
    const box = (type, label) => h('label.dt-check', {},
      h('input', { type: 'checkbox', checked: vi.types[type] ? 'checked' : null, onchange: (e) => act('varType', { type, on: e.target.checked }) }),
      h('span', { text: label }));
    const log = h('div.dt-log', {}, ...vi.log.map((l) => (l.header ? h('div.dt-tick', { text: l.header }) : h('div', { text: l.text }))));
    const el = h('div.dt-frame', {},
      h('div.dt-frame-title', { text: 'RuneLite Var Inspector' }),
      h('div.dt-checks', {}, box('VARBIT', 'Varbit'), box('VARP', 'VarPlayer'),
        h('button.dt-btn', { text: 'Clear', onclick: () => act('varClear') })),
      log);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return el;
  }

  window.Panels.push({
    id: 'devtools',
    tooltip: 'Developer Tools',
    icon: '../../../plugins/devtools/devtools_icon.png',
    priority: 1,
    visible: () => App.config('lostlite', 'devtoolsPlugin', false) === true,
    watch: ['pluginState'],
    render(root) {
      const st = (App.state.pluginState || {}).devtools;
      if (!st) { root.replaceChildren(); return; }
      root.replaceChildren(h('div.dt-panel', {},
        h('div.dt-grid', {}, ...st.buttons.map((b) => h('button.dt-btn', {
          class: b.active ? 'dt-btn active' : 'dt-btn', text: b.title, title: b.title,
          onclick: () => act(b.action ? b.id : 'toggle', { id: b.id }),
        }))),
        st.varInspector ? varInspector(st.varInspector) : null));
    },
  });
})();
