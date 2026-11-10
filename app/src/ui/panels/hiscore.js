'use strict';
// HiScore panel: RuneLite's HiscorePanel (BSD 2-Clause; see plugins/hiscore/descriptor.js). A
// search bar (Enter to look up), then the skills in RuneLite's grid (three across, its order),
// then combat and total level. Hover a skill for its rank and experience. EASCape has one
// hiscore, so no endpoint tabs; the lookup itself is plugins/hiscore/game.js.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;

  // HiscorePanel.SKILLS, the skills this game has (no construction, hunter or sailing)
  const GRID = ['attack', 'hitpoints', 'mining', 'strength', 'agility', 'smithing', 'defence', 'herblore', 'fishing',
    'ranged', 'thieving', 'cooking', 'prayer', 'crafting', 'firemaking', 'magic', 'fletching', 'woodcutting',
    'runecraft', 'slayer', 'farming'];
  const NAME = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const state = () => (App.state.pluginState || {}).hiscore || null;
  const fmt = (n) => Number(n).toLocaleString('en-GB');

  // Experience.getLevelForXp, up to 126 for virtual levels
  const XP = [0];
  for (let lvl = 1, pts = 0; lvl < 127; lvl++) {
    pts += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    XP.push(Math.floor(pts / 4));
  }
  function levelFor(xp, level) {
    if (!App.config('hiscore', 'virtualLevels', true) || level < 99) return level;
    let l = 99;
    while (l < 126 && xp >= XP[l]) l++;
    return l;
  }
  // Experience.getCombatLevelPrecise (the 2006 formula)
  function combat(sk) {
    const lv = (s) => (sk[s] ? sk[s].level : 1);
    const base = 0.25 * (lv('defence') + lv('hitpoints') + Math.floor(lv('prayer') / 2));
    const melee = 0.325 * (lv('attack') + lv('strength'));
    const range = 0.325 * Math.floor(lv('ranged') * 1.5);
    const mage = 0.325 * Math.floor(lv('magic') * 1.5);
    return base + Math.max(melee, range, mage);
  }

  let input = null;
  function searchBar() {
    if (!input) {
      input = UI.searchField('', () => {}, 'Search a player');
      input.input.maxLength = 12;
      input.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') App.setConfig('hiscore', 'command', { action: 'lookup', name: input.input.value, t: Date.now() });
      });
    }
    return input;
  }

  function cell(icon, text, tip) {
    return h('div.hs-cell', { tip }, UI.icon(`../hiscore/${icon}.png`), h('span', { text }));
  }

  window.Panels.push({
    id: 'hiscore',
    tooltip: 'Hiscore',
    icon: 'hiscore_icon.png',
    priority: 5,
    visible: () => App.config('lostlite', 'hiscorePlugin', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const s = state() || {};
      const bar = searchBar();
      if (s.name && document.activeElement !== bar.input && bar.input.value !== s.name) {
        bar.input.value = s.name;
        bar.classList.add('has-text');
      }
      const r = s.result;
      const sk = (r && r.skills) || {};
      const grid = GRID.map((name) => {
        const v = sk[name];
        if (!v) return cell(name, '--', NAME(name));
        const rank = v.rank === -1 ? 'Unranked' : fmt(v.rank);
        const lvl = levelFor(v.xp, v.level);
        const next = lvl < 126 ? XP[lvl] : null;
        return cell(name, String(lvl), `${NAME(name)}\nRank: ${rank}\nExperience: ${fmt(v.xp)}${next ? `\nRemaining XP: ${fmt(next - v.xp)}` : ''}`);
      });
      const cmb = r ? combat(sk) : null;
      const overall = r ? r.overall : null;
      let message = null;
      if (s.loading) message = 'Loading...';
      else if (s.error === 'not found') message = 'No hiscores found for that player.';
      else if (s.error) message = 'Could not reach the hiscores.';
      root.replaceChildren(h('div.pad.hs', {},
        bar,
        message ? h('div.small.muted.hs-msg', { text: message }) : null,
        r ? h('div.hs-name.white', { text: r.name }) : null,
        h('div.hs-grid', {}, ...grid),
        h('div.hs-grid.hs-totals', {},
          cell('combat', cmb === null ? '--' : String(Math.floor(cmb)), cmb === null ? 'Combat' : `Combat\nExact Combat Level: ${cmb.toFixed(2)}`),
          cell('overall', overall ? fmt(overall.level) : '--', overall ? `Overall\nRank: ${overall.rank === -1 ? 'Unranked' : fmt(overall.rank)}\nExperience: ${fmt(overall.xp)}` : 'Overall'))));
      if (!s.name && !s.loading) bar.input.focus();
    },
  });
})();
