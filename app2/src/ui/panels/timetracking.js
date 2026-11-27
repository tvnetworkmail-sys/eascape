'use strict';
// RuneLite's TimeTrackingPanel (net.runelite.client.plugins.timetracking, BSD 2-Clause, Copyright (c) 2018, Daniel Teo
// <https://github.com/takuyakanbr>, Psikoi and RuneLite contributors): the MaterialTabGroup of item icons (GridLayout
// 6 columns, 7px gaps, 30x27 tabs, 24px icons), OverviewTabPanel / OverviewItemPanel, FarmingTabPanel / TimeablePanel
// (item icon with the compost / protection overlay icon, title, estimate, notify toggle, ThinProgressBar) and
// ClockTabPanel / TimerPanel / StopwatchPanel, drawn from what the Time Tracking clone (plugins/timetracking/page.js)
// publishes; every click and edit goes back to the plugin.
// NavigationButton: "Time Tracking", watch.png, priority 4.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const IMG = '../plugins/timetracking/';
  const act = (action, args) => App.panelAction('timetracking', action, args);
  const iconCache = {};
  const icons = () => iconCache;
  const itemImg = (id, cls) => (id != null && icons()[id] ? h(`img${cls || ''}`, { src: icons()[id], alt: '', draggable: 'false' }) : null);
  const img = (name, cls) => h(`img${cls || ''}`, { src: IMG + name, alt: '', draggable: 'false' });

  function tabs(st) {
    return h('div.tt-tabs', {}, ...st.tabs.map((t) => h(`button.tt-tab${t.key === st.active ? '.selected' : ''}`, {
      tip: t.name, onclick: () => { if (t.key !== st.active) act('tab', { tab: t.key }); },
    }, itemImg(t.icon))));
  }

  // OverviewItemPanel
  function overviewItem(it) {
    return h('div.tt-ov', { onclick: () => act('tab', { tab: it.tab }) },
      h('div.tt-ov-icon', {}, itemImg(it.icon)),
      h('div.tt-ov-text', {}, h('div.tt-title', { text: it.title }), h('div.tt-status', { text: it.status, style: `color:${it.color}`, 'data-k': `ov-${it.title}` })),
      img('util_arrow_right.png', '.tt-ov-arrow'));
  }

  // TimeablePanel (FarmingTabPanel's rows)
  function patchRow(p, first) {
    if (p.group) return h(`div.tt-group${first ? '.first' : ''}`, { text: p.group });
    return h(`div.tt-timeable${first ? '.first' : ''}`, {},
      h('div.tt-top', {},
        h('div.tt-icons', { tip: p.iconTip }, itemImg(p.icon, '.tt-icon'), p.overlay != null ? itemImg(p.overlay, '.tt-overlay') : null),
        h('div.tt-info', {}, h('div.tt-title.shadow', { text: p.title }), h('div.tt-estimate', { text: p.estimate, 'data-k': `est-${p.key}` })),
        h('button.tt-notify', { tip: p.notify ? 'Disable notifications' : 'Enable notifications', onclick: () => act('notify', { key: p.key, on: !p.notify }) },
          img(p.notify ? 'notify_selected_icon.png' : 'notify_icon.png'))),
      p.progress ? h('div.tt-progress', { style: `background:${p.progress.background}` }, h('div', { style: `width:${p.progress.percent}%;background:${p.progress.color}` })) : null);
  }

  function iconButton(name, tip, onclick, hoverCls) {
    return h(`button.tt-btn${hoverCls || ''}`, { tip, onclick }, img(name));
  }

  // ClockPanel: name field, display field, start/pause + reset (+ loop | lap), delete
  function clockPanel(c, kind) {
    const nameInput = h('input.tt-name', { type: 'text', spellcheck: 'false', value: c.name });
    nameInput.value = c.name;
    nameInput.addEventListener('focus', () => nameInput.select());
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });
    nameInput.addEventListener('blur', () => { if (nameInput.value !== c.name) act('name', { kind, i: c.i, value: nameInput.value }); });
    const display = h('input.tt-display', { type: 'text', spellcheck: 'false', 'data-k': `${kind}-${c.i}`, style: `color:${c.color}` });
    display.value = c.display;
    display.readOnly = kind !== 'timer' || !c.editable;
    if (!display.readOnly) {
      display.addEventListener('focus', () => { display.style.color = 'rgb(115,115,115)'; display.select(); });
      display.addEventListener('keydown', (e) => { if (e.key === 'Enter') display.blur(); });
      display.addEventListener('blur', () => act('duration', { kind, i: c.i, value: display.value }));
    }
    const left = [
      iconButton(c.active ? 'pause_icon.png' : 'start_icon.png', `${c.active ? 'Pause' : 'Start'} ${kind}`, () => act('startPause', { kind, i: c.i })),
      iconButton('reset_icon.png', `Reset ${kind}`, () => act('reset', { kind, i: c.i })),
      kind === 'timer' ? iconButton(c.loop ? 'loop_selected_icon.png' : 'loop_icon.png', 'Loop timer', () => act('loop', { kind, i: c.i })) : iconButton('lap_icon.png', 'Add lap time', () => act('lap', { kind, i: c.i })),
    ];
    const laps = kind === 'stopwatch' && c.laps.length
      ? h('div.tt-laps', {}, ...c.laps.flatMap((l) => l.map((v) => h('div', { text: v })))) : null;
    return h('div.tt-clock', {},
      h('div.tt-name-wrap', {}, nameInput),
      h('div.tt-clock-main', {},
        h('div.tt-clock-content', {}, display, laps),
        h('div.tt-actions', {}, h('div.tt-left', {}, ...left), h('div.tt-right', {}, iconButton('delete_icon.png', `Delete ${kind}`, () => act('delete', { kind, i: c.i }))))));
  }

  function clockTab(cl) {
    const header = (title, type, large, action) => h(`div.tt-header${large ? '.large' : ''}`, {}, h('span', { text: title }),
      h('button.tt-add', { tip: `Add a ${type}`, onclick: () => act(action) }, img('add_icon.png')));
    const info = (text) => h('div.tt-info-panel.shadow', { text });
    return h('div.tt-clocks', {},
      header('Timers', 'timer', false, 'addTimer'),
      ...cl.timers.map((t) => clockPanel(t, 'timer')),
      cl.timers.length ? null : info('Click the + button to add a timer.'),
      header('Stopwatches', 'stopwatch', true, 'addStopwatch'),
      ...cl.stopwatches.map((s) => clockPanel(s, 'stopwatch')),
      cl.stopwatches.length ? null : info('Click the + button to add a stopwatch.'));
  }

  window.Panels.push({
    id: 'timetracking',
    tooltip: 'Time Tracking',
    icon: '../../../plugins/timetracking/watch.png',
    priority: 4,
    visible: () => App.config('lostlite', 'timetrackingPlugin', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const st = (App.state.pluginState || {}).timetracking;
      if (!st) { root.replaceChildren(); return; }
      if (st.icons) Object.assign(iconCache, st.icons);
      let content;
      if (st.overview) content = h('div.tt-overview', {}, ...st.overview.map(overviewItem));
      else if (st.clocks) content = clockTab(st.clocks);
      else content = h('div.tt-farming', {}, ...(st.patches || []).map((p, i) => patchRow(p, i === 0)));
      const tree = h('div.tt-panel', {}, tabs(st), h('div.tt-display-area', {}, content));
      // while a text field is being edited, only the live values change (the Swing panel keeps its fields too)
      const focused = document.activeElement;
      if (focused && root.contains(focused) && focused.tagName === 'INPUT') {
        for (const el of tree.querySelectorAll('[data-k]')) {
          const old = root.querySelector(`[data-k="${el.getAttribute('data-k')}"]`);
          if (!old || old === focused) continue;
          if (old.tagName === 'INPUT') { old.value = el.value; old.style.cssText = el.style.cssText; } else { old.textContent = el.textContent; old.style.cssText = el.style.cssText; }
        }
        return;
      }
      root.replaceChildren(tree);
    },
  });
})();
