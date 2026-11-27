'use strict';
// RuneLite's LootTrackerPanel and LootTrackerBox (net.runelite.client.plugins.loottracker, BSD 2-Clause, Copyright (c)
// 2018, Psikoi <https://github.com/psikoi> and RuneLite contributors), drawn from the state the Loot Tracker clone
// (plugins/loottracker/page.js) publishes; every button, click and menu item goes back to the plugin.
// NavigationButton: "Loot Tracker", panel_icon.png, priority 5.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const IMG = '../plugins/loottracker/';
  const act = (action, args) => App.panelAction('loottracker', action, args);
  // the HTML_LABEL_TEMPLATE: the key in LIGHT_GRAY, the value in white
  const label = (key, value) => h('div.ltr-label', {}, h('span.ltr-key', { text: key }), h('span', { text: value }));

  // JOptionPane.showOptionDialog(..., "Are you sure?", YES_NO_OPTION, WARNING_MESSAGE, {"Yes", "No"}, "No")
  function areYouSure(text, yes) {
    const close = () => modal.remove();
    const no = h('button', { text: 'No', onclick: close });
    const modal = h('div.ltr-modal', { onclick: (e) => { if (e.target === modal) close(); } },
      h('div.ltr-dialog', {}, h('div.ltr-dialog-title', { text: 'Are you sure?' }), h('div.ltr-dialog-text', {}, ...[].concat(text)),
        h('div.ltr-dialog-buttons', {}, h('button', { text: 'Yes', onclick: () => { close(); yes(); } }), no)));
    document.body.append(modal);
    no.focus();
  }

  function box(b, st) {
    const menu = (e) => {
      e.preventDefault();
      UI.popup(e, [
        [b.eventIgnored ? 'Include loot' : 'Hide loot', () => act('toggleEvent', { id: b.id })],
        ['Reset', () => areYouSure(st.groupLoot ? `This will permanently delete "${b.title}" loot.` : 'This will delete one kill.', () => act('resetBox', { id: b.id }))],
        ['View details', () => act('details', { id: b.id })],
      ]);
    };
    const slots = [];
    for (let i = 0; i < b.rows * 5; i++) {
      const it = b.items[i];
      slots.push(it
        ? h(`div.ltr-slot${it.ignored ? '.ignored' : ''}`, {
          tip: it.tooltip.join('\n'),
          oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); UI.popup(e, [['Toggle item', () => act('toggleItem', { id: b.id, item: it.id })]]); },
        },
        it.icon ? h('img', { src: it.icon, alt: '', draggable: 'false' }) : null,
        it.quantity ? h('span.ltr-qty', { text: it.quantity }) : null)
        : h('div.ltr-slot'));
    }
    return h(`div.ltr-box${b.collapsed ? '.collapsed' : ''}`, { oncontextmenu: menu },
      h(`div.ltr-title${b.eventIgnored ? '.ignored' : ''}`, { onclick: (e) => { if (e.button === 0) act('toggleBox', { id: b.id }); } },
        h('span.ltr-name', { text: b.title }),
        h('span.ltr-sub', { text: b.subTitle, tip: b.subTitleTip }),
        b.prices ? h('span.ltr-price', { text: b.price, tip: b.priceTip }) : null),
      b.collapsed ? null : h('div.ltr-items', {}, ...slots));
  }

  window.Panels.push({
    id: 'loottracker',
    tooltip: 'Loot Tracker',
    icon: '../../../plugins/loottracker/panel_icon.png',
    priority: 5,
    visible: () => App.config('lostlite', 'loottrackerPlugin', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const st = (App.state.pluginState || {}).loottracker;
      if (!st || !st.hasBoxes) {
        root.replaceChildren(h('div.ltr-panel', {}, h('div.plugin-error', {}, h('div.plugin-error-title', { text: 'Loot tracker' }), h('div.plugin-error-text', { text: 'You have not received any loot yet.' }))));
        return;
      }
      const iconBtn = (img, tip, onclick, cls) => h(`button.ltr-btn${cls || ''}`, { tip, onclick }, h('img', { src: IMG + img, alt: '', draggable: 'false' }));
      const actions = h('div.ltr-actions', {},
        h('div.ltr-actions-left', {},
          st.back ? iconBtn('back_icon.png', null, () => act('back'), '.back') : null,
          h('span.ltr-details-title', { text: st.detailsTitle })),
        h('div.ltr-actions-right', {},
          iconBtn(st.allCollapsed ? 'collapsed.png' : 'expanded.png', st.allCollapsed ? 'Collapse All' : 'Expand All', () => act('collapseAll')),
          iconBtn('grouped_loot_icon.png', 'Group loot by source', () => act('group', { group: true }), st.groupLoot ? '.selected' : '.faded'),
          iconBtn('single_loot_icon.png', 'Show each kill separately', () => act('group', { group: false }), st.groupLoot ? '.faded' : '.selected'),
          iconBtn(st.hideIgnoredItems ? 'invisible_icon.png' : 'visible_icon.png', st.hideIgnoredItems ? 'Hide ignored items' : 'Show ignored items', () => act('hideIgnored', { hide: !st.hideIgnoredItems }))));
      const overall = h('div.ltr-overall', {
        oncontextmenu: (e) => { e.preventDefault(); UI.popup(e, [['Reset All', () => areYouSure(st.back ? `This will permanently delete "${st.detailsTitle}" loot.` : ['This will permanently delete ', h('b', { text: 'all' }), ' loot.'], () => act('resetAll'))]]); },
      },
      st.headerIcon ? h('img.ltr-overall-icon', { src: st.headerIcon, alt: '', draggable: 'false' }) : null,
      h('div.ltr-overall-info', {}, label('Total count: ', st.overall.kills), st.overall.prices ? h('div', { tip: st.overall.tip.join('\n') }, label(st.overall.label, st.overall.value)) : null));
      root.replaceChildren(h('div.ltr-panel', {}, actions, overall, h('div.ltr-logs', {}, ...st.boxes.map((b) => box(b, st)))));
    },
  });
})();
