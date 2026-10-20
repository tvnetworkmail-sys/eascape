'use strict';
// Quest Helper panel, after RuneLite's QuestHelperPanel: a searchable quest list (with
// each quest's status), and for the quest being helped: the current step in a box at the
// top, then the items you need (with what you have), and every section of steps with the
// done ones dimmed. Right-click a step to say "I'm on this step" if the guide got lost.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h, icon } = UI;
  const view = { search: '', open: {} };
  const STATUS = {
    done: { text: 'Completed', cls: 'green' },
    started: { text: 'In progress', cls: 'qh-yellow' },
    'not started': { text: 'Not started', cls: 'qh-red' },
    unknown: { text: '', cls: 'muted' },
  };

  function state() {
    return (App.state.pluginState || {}).questhelper || null;
  }

  function command(action, extra) {
    App.setConfig('questhelper', 'command', { action, t: Date.now(), ...extra });
  }

  function select(key) {
    App.setConfig('questhelper', 'selected', key || '');
  }

  function itemRow(it) {
    const enough = it.have >= it.need;
    const banked = !enough && it.bank != null && it.have + it.bank >= it.need;
    const cls = enough ? 'green' : banked ? 'qh-yellow' : 'qh-red';
    const count = it.need > 1 ? `${Math.min(it.have, it.need)}/${it.need} ` : '';
    const tipText = [it.tip, banked ? 'In your bank' : null].filter(Boolean).join('\n');
    return h('div.small.qh-item', { class: `small qh-item ${cls}`, tip: tipText || null }, `${count}${it.name}`, banked ? h('span.muted', { text: ' (bank)' }) : null);
  }

  function section(key, title, body, openByDefault = true) {
    const isOpen = view.open[key] === undefined ? openByDefault : view.open[key];
    const sec = h('div', { class: isOpen ? 'cfg-section' : 'cfg-section closed' },
      h('div.cfg-section-header', {
        onclick: () => {
          view.open[key] = !sec.classList.contains('closed') ? false : true;
          sec.classList.toggle('closed');
        },
      }, h('span.arrow', {}, UI.icon('arrow_right.png')), h('span.sname', { text: title })),
      h('div.cfg-section-body', {}, ...body));
    return sec;
  }

  function questList(s, root) {
    const q = view.search.toLowerCase();
    const rows = s.quests
      .slice()
      .sort((a, b) => (b.guide - a.guide) || a.name.localeCompare(b.name));
    const list = h('div.qh-list', {}, ...rows.map((x) => {
      const st = STATUS[x.status] || STATUS.unknown;
      return h('div', {
        hidden: !!q && !x.name.toLowerCase().includes(q),
        class: `qh-quest${x.guide ? '' : ' disabled'}`,
        tip: x.guide ? null : 'No guide for this quest yet',
        onclick: x.guide ? () => select(x.key) : null,
      }, h('span', { class: `qh-qname ${x.guide ? 'white' : 'muted'}`, text: x.name }), h('span', { class: `small ${st.cls}`, text: st.text }));
    }));
    const search = UI.searchField(view.search, (v) => {
      view.search = v;
      const needle = v.toLowerCase();
      for (const row of list.children) row.hidden = !!needle && !row.firstChild.textContent.toLowerCase().includes(needle);
    }, 'Search quests');
    return [
      h('div.qh-title.bold', { text: 'Quest Helper' }),
      s.loggedIn ? null : h('div.small.muted.qh-note', { text: 'Log in to see your quests.' }),
      h('div.qh-search', {}, search),
      list,
    ];
  }

  function currentBox(v) {
    let body;
    if (v.done) body = [h('div.green', { text: 'Quest complete!' })];
    else if (v.server && !v.following) {
      body = [h('div.small', { text: 'Not following this quest in game.' }),
        h('button.btn.qh-unpin', { onclick: () => command('follow') }, 'Follow this quest')];
    } else if (v.server && !v.text) body = [h('div.small', { text: 'Waiting for the game...' })];
    else if (v.waiting) body = [h('div.small', { text: 'Waiting for your quest list... (open the quest tab in game if this stays)' })];
    else if (v.unknown || !v.text) body = [h('div.small', { text: 'Not sure where you are in this quest. Open its quest journal and the guide will catch up.' })];
    else {
      body = [h('div.qh-steptext', { text: v.text })];
      if (v.stepItems.length) body.push(h('div.qh-stepitems', {}, ...v.stepItems.map(itemRow)));
      if (v.options && v.options.length) body.push(h('div.small.muted', { text: `Pick: ${v.options.join(' / ')}` }));
      if (!v.sure) body.push(h('div.small.qh-yellow.qh-note', { text: 'Open the quest journal so the guide can check where you are.' }));
      if (v.pinned) body.push(h('button.btn.qh-unpin', { onclick: () => command('unpin') }, 'Follow the quest again'));
      if (v.noRoute) body.push(h('div.small.muted', { text: 'No walking route from here.' }));
    }
    return h('div.qh-current', {}, h('div.small.qh-label', { text: 'Current step' }), ...body);
  }

  function questPage(s, v) {
    const out = [
      h('div.qh-head', {},
        h('button.icon-btn', { tip: 'Back to the quest list', onclick: () => select('') }, icon('config_back_icon.png')),
        h('div.qh-title.bold', { text: v.name })),
      h('div.small', { class: `small ${(STATUS[v.status] || STATUS.unknown).cls}`, text: (STATUS[v.status] || STATUS.unknown).text }),
      currentBox(v),
    ];
    if (v.required.length || v.recommended.length || v.skills.length) {
      const body = [];
      if (v.required.length) body.push(h('div.small.muted', { text: 'Items needed' }), ...v.required.map(itemRow));
      if (v.recommended.length) body.push(h('div.small.muted.qh-gap', { text: 'Recommended' }), ...v.recommended.map(itemRow));
      if (v.skills.length) body.push(h('div.small.muted.qh-gap', { text: 'Skills' }), ...v.skills.map((t) => h('div.small', { text: t })));
      if (!v.bankKnown) body.push(h('div.small.muted.qh-gap', { text: 'Open your bank once to include what is in it.' }));
      out.push(section(`${v.key}:req`, 'Requirements', body));
    }
    for (const sec of v.sections) {
      out.push(section(`${v.key}:${sec.title}`, sec.title, sec.steps.map((st) => h('div', {
        class: `qh-step${st.current ? ' current' : ''}${st.done ? ' done' : ''}`,
        // the server knows where you are in its guides: no "I'm on this step"
        oncontextmenu: v.server ? null : (e) => UI.popup(e, [["I'm on this step", () => command('pin', { step: st.id })]]),
      }, st.text))));
    }
    if (v.start && v.status !== 'done') out.push(h('div.small.muted.qh-gap', { text: `Start: ${v.start}` }));
    if (v.rewards && v.rewards.length) out.push(section(`${v.key}:rewards`, 'Rewards', v.rewards.map((r) => h('div.small', { text: r })), false));
    out.push(h('div.small.muted.qh-credit', { text: v.server ? 'Guides based on RuneLite\'s Quest Helper by Zoinkwiz; your progress comes from the server.' : 'Guides based on RuneLite\'s Quest Helper by Zoinkwiz, for the 2004 quests.' }));
    return out;
  }

  window.Panels.push({
    id: 'questhelper',
    tooltip: 'Quest Helper',
    icon: 'quest_icon.png',
    priority: 2,
    visible: () => App.config('lostlite', 'questhelperPlugin', true) !== false,
    watch: ['pluginState', 'config'],
    render(root) {
      const s = state();
      if (!s) {
        root.replaceChildren(h('div.pad', {}, h('div.qh-title.bold', { text: 'Quest Helper' }), h('div.small.muted', { text: 'Waiting for the game...' })));
        return;
      }
      // Keep typing in the search box when the panel redraws with new game data.
      const focused = document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
      root.replaceChildren(h('div.pad.qh', {}, ...(s.view ? questPage(s, s.view) : questList(s, root))));
      if (focused) {
        const input = root.querySelector('.text-field input');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }
    },
  });
})();
