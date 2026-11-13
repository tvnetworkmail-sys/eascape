'use strict';
// Test Server panel (ours): only on the test server (world 20, 2006rs.com/test). Search any item and
// add it to your bank, set your levels, switch spellbook, refill or empty your bank and mark every
// quest done. Each button sends one of the test server's own commands through the game page's
// client (main.js 'test-command'); the real worlds ignore them.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const TEST_WORLD = 20;
  // the Stats tab's order, three across
  const SKILLS = ['attack', 'hitpoints', 'mining', 'strength', 'agility', 'smithing', 'defence', 'herblore', 'fishing',
    'ranged', 'thieving', 'cooking', 'prayer', 'crafting', 'firemaking', 'magic', 'fletching', 'woodcutting',
    'runecraft', 'slayer', 'farming'];
  const NAME = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  let items = null;
  let built = null;
  let statusEl = null;
  let picked = null;

  function say(text, bad) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = bad ? 'var(--progress-error)' : 'var(--progress-complete)';
  }

  async function send(cmd, done) {
    if (!App.state.loggedIn) { say('Log in to the test server first.', true); return false; }
    const ok = await window.lostlite.testCommand(cmd);
    if (!ok) say("That didn't go through. Are you logged in?", true);
    else if (done) say(done);
    return ok;
  }

  function button(text, onclick, tipText) {
    return h('button.btn', { text, onclick, tip: tipText, style: 'margin:2px 4px 2px 0' });
  }

  function heading(text) {
    return h('div.white', { text, style: 'margin:12px 0 6px;font-weight:bold' });
  }

  function build() {
    const results = h('div', { style: 'max-height:260px;overflow-y:auto;margin-top:6px;border:1px solid var(--border)' });
    const count = h('input', { type: 'number', min: 1, max: 2147483647, value: 1, style: 'width:90px' });
    const search = UI.searchField('', (q) => show(q), 'Search an item');

    function show(raw) {
      const q = String(raw || '').trim().toLowerCase();
      picked = null;
      results.replaceChildren();
      if (q.length < 2 || !items) return;
      const hits = items.filter((i) => i.name.toLowerCase().includes(q))
        .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1))
        .slice(0, 50);
      for (const it of hits) {
        const img = h('img', { src: `https://2006rs.com/img/market-items/${it.id}.png`, alt: '', style: 'width:32px;height:28px;object-fit:contain;image-rendering:pixelated' });
        img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
        const row = h('div', { style: 'display:flex;align-items:center;gap:6px;padding:2px 6px;cursor:pointer', tip: 'Click to pick it; double-click to add it' }, img, h('span', { text: it.name }));
        row.addEventListener('click', () => {
          for (const r of results.children) r.style.background = '';
          row.style.background = 'var(--darker-gray-hover)';
          picked = it;
        });
        row.addEventListener('dblclick', () => { picked = it; add(); });
        results.append(row);
      }
      if (!hits.length) results.append(h('div.small.muted', { text: 'No items match.', style: 'padding:4px 6px' }));
    }

    function add() {
      const it = picked || (results.firstChild && items && items.find((i) => i.name === results.firstChild.textContent));
      if (!it) { say('Search for an item first.', true); return; }
      const n = Math.max(1, Math.min(2147483647, Math.floor(Number(count.value) || 1)));
      send(`testspawn ${it.id} ${n}`, `Added ${n.toLocaleString('en-GB')} x ${it.name} to your bank.`);
    }
    search.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

    const levels = SKILLS.map((s) => {
      const input = h('input', { type: 'number', min: 1, max: 99, placeholder: '-', style: 'width:42px' });
      input.dataset.skill = s;
      return h('label', { style: 'display:flex;align-items:center;justify-content:space-between;gap:4px', tip: NAME(s) },
        UI.icon(`../skills/${s}.png`, { style: 'width:20px;height:20px' }), input);
    });
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px 10px' }, ...levels);

    async function setStats(pairs) {
      for (const [s, lv] of pairs) if (!(await send(`setstat ${s} ${lv}`))) return;
      say(`Set ${pairs.length} skill${pairs.length === 1 ? '' : 's'}.`);
    }

    statusEl = h('div.small', { style: 'min-height:16px;margin-top:6px' });
    return h('div.pad', {},
      h('div.small.muted', { text: 'The test server is separate from the real game: nothing here carries over.' }),
      heading('Add items to your bank'),
      search,
      h('div', { style: 'display:flex;gap:6px;align-items:center;margin-top:6px' }, h('span.small', { text: 'Amount' }), count, button('Add to bank', add)),
      results,
      heading('Set your levels'),
      h('div.small.muted', { text: 'Or right-click a skill in the game\'s Stats tab.', style: 'margin-bottom:6px' }),
      grid,
      h('div', { style: 'margin-top:6px' },
        button('Set these', () => {
          const pairs = levels.map((l) => l.querySelector('input')).filter((i) => i.value).map((i) => [i.dataset.skill, Math.max(1, Math.min(99, Math.floor(Number(i.value))))]);
          if (!pairs.length) { say('Type a level in at least one skill.', true); return; }
          setStats(pairs);
        }),
        button('All 99', () => setStats(SKILLS.map((s) => [s, 99]))),
        button('All 1', () => setStats(SKILLS.map((s) => [s, s === 'hitpoints' ? 10 : 1])), 'Hitpoints goes to 10')),
      heading('Spellbook'),
      h('div', {},
        button('Ancient Magicks', () => send('spellbookswap ancient', 'Spellbook: Ancient Magicks.')),
        button('Normal', () => send('spellbookswap normal', 'Spellbook: Normal.'))),
      heading('Bank and quests'),
      h('div', {},
        button('Starting kit', () => send('testkit', 'The starting kit was added to your bank.'), 'Potions, food, armour, weapons, runes and ammunition'),
        button('Empty bank', () => { if (window.confirm('Empty your whole bank?')) send('testclearbank', 'Your bank is empty.'); }),
        button('All quests done', () => send('testquests', 'Every quest is done.'))),
      statusEl);
  }

  window.Panels.push({
    id: 'testserver',
    tooltip: 'Test Server',
    icon: 'devtools_icon.png',
    priority: 4,
    visible: () => App.state.world === TEST_WORLD,
    watch: ['world'],
    render(root) {
      if (!built) {
        built = build();
        if (!items) window.lostlite.testItems().then((list) => { items = list; if (!items.length) say("Couldn't load the item list.", true); });
      }
      root.replaceChildren(built);
    },
  });
})();
