'use strict';
// RuneLite's SkillCalculatorPanel, UICalculatorInputArea, SkillCalculator (its slot list), UIActionSlot and
// UICombinedActionSlot (net.runelite.client.plugins.skillcalculator, BSD 2-Clause, Copyright (c) 2018, Kruithne
// <kruithne@gmail.com>, Psikoi <https://github.com/psikoi> and RuneLite contributors), drawn from the state the Skill
// Calculator clone (plugins/skillcalculator/page.js) publishes; every input goes back to it. The search bar filters the
// drawn slots here, as RuneLite's onSearch adds / removes the slot components. Text fields send their value on Enter
// (moving on to the related field, as RuneLite's action listeners do) and when they lose focus.
// NavigationButton: "Skill Calculator", calc.png, priority 6.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const ICONS = '../plugins/runelite/assets/';
  const act = (action, args) => App.panelAction('skillcalculator', action, args);
  let search = '';
  let searchReset = -1;
  let focusNext = null; // the field to focus after the next render (requestFocusInWindow)

  // UICalculatorInputArea.addComponent: a label over a FlatTextField
  function field(key, label, value, next) {
    const input = h('input.skc-input', { type: 'text', spellcheck: 'false', 'data-key': key });
    input.value = String(value);
    let sent = false;
    const send = () => { if (!sent) { sent = true; act(key, { value: input.value }); } };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { focusNext = next || null; send(); if (!next) input.blur(); }
    });
    input.addEventListener('blur', () => { if (!sent && input.value !== String(value)) send(); });
    return h('div.skc-field', {}, h('div.skc-label', { text: label }), h('div.skc-flat', {}, input));
  }

  function slotPanel(s) {
    const el = h(`div.skc-slot.${s.border}${s.selected ? '.selected' : ''}`, {
      'data-name': s.name.toLowerCase(),
      onmousedown: (e) => { if (e.button === 0) act('slot', { index: s.i, shift: e.shiftKey }); },
    },
    h('div.skc-icon', {}, s.icon ? h('img', { src: s.icon, alt: '', draggable: 'false' }) : null),
    h('div.skc-info', {}, h('div.skc-name', { text: s.name }), h('div.skc-actions', { text: s.text })));
    return el;
  }

  function applySearch(list) {
    const q = search.toLowerCase();
    for (const el of list.querySelectorAll('.skc-slot')) el.style.display = el.dataset.name.includes(q) ? '' : 'none';
  }

  window.Panels.push({
    id: 'skillcalculator',
    tooltip: 'Skill Calculator',
    icon: '../../../plugins/skillcalculator/calc.png',
    priority: 6,
    visible: () => App.config('lostlite', 'skillcalculatorPlugin', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const st = (App.state.pluginState || {}).skillcalculator;
      if (!st) { root.replaceChildren(h('div.skc-panel')); return; }
      if (st.searchReset !== searchReset) { searchReset = st.searchReset; search = ''; }
      // the MaterialTabGroup: GridLayout(0, 6, 7, 7) of small skill icons
      const tabs = h('div.skc-tabs', {}, ...st.tabs.map((name, i) => h(`button.mtab.skc-tab${st.selected === i ? '.selected' : ''}`, {
        onclick: () => act('tab', { index: i }),
      }, h('img', { src: `${ICONS}skill_icons_small/${name.toLowerCase()}.png`, alt: name, draggable: 'false' }))));
      const parts = [tabs];
      if (st.open) {
        const inp = st.input;
        const targetXP = field('targetXP', 'Target Experience', inp.targetXP);
        UI.tip(targetXP.querySelector('input'), inp.neededXP);
        const mult = UI.spinner(inp.multiplier, { min: 1, max: 32, unit: 'x' }, (v) => act('multiplier', { value: String(v) }));
        parts.push(h('div.skc-inputs', {},
          field('currentLevel', 'Current Level', inp.currentLevel, 'targetLevel'),
          field('currentXP', 'Current Experience', inp.currentXP, 'targetXP'),
          field('targetLevel', 'Target Level', inp.targetLevel),
          targetXP,
          h('div.skc-field', {}, h('div.skc-label', { text: 'XP Multiplier' }), mult)));
        const list = h('div.skc-list');
        for (const b of st.bonuses) {
          list.append(h('div.skc-bonus', {}, h('span.skc-bonus-label', { text: b.label }), UI.checkbox(b.on, (v) => act('bonus', { id: b.id, value: v }))));
        }
        if (st.bonuses.length) list.append(h('div.skc-gap'));
        list.append(h('div.skc-combined', {},
          h('div.skc-icon', {}, st.combined.icon ? h('img', { src: st.combined.icon, alt: '', draggable: 'false' }) : null),
          h('div.skc-info', {}, h('div.skc-name', { text: st.combined.title }), h('div.skc-actions', { text: st.combined.text }))));
        const sb = UI.searchField(search, (v) => { search = v; applySearch(list); });
        sb.classList.add('skc-search');
        list.append(sb);
        if (st.empty) list.append(h('div.skc-empty', { text: 'No F2P actions to show.' }));
        for (const s of st.slots) list.append(slotPanel(s));
        applySearch(list);
        parts.push(list);
      }
      const hadSearchFocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('.skc-search');
      root.replaceChildren(h('div.skc-panel', {}, ...parts));
      if (hadSearchFocus) { const i = root.querySelector('.skc-search input'); if (i) i.focus(); }
      if (focusNext) { const i = root.querySelector(`input[data-key="${focusNext}"]`); focusNext = null; if (i) { i.focus(); i.select(); } }
    },
  });
})();
