'use strict';
// XP Tracker panel: RuneLite's XpPanel and XpInfoBox (BSD 2-Clause; see
// plugins/xptracker/descriptor.js). The overall box (gained, per hour), then a box per skill
// you've trained: the four labels chosen in the settings, and the progress bar to the next
// level in the skill's colour (Lvl. n, the chosen bar label, Lvl. n+1; hover it for actions
// and the chosen tooltip label). Click a box to make it compact; right-click it for Reset,
// Reset others, Reset/hr, Pause and Add to canvas. The tracking itself is
// plugins/xptracker/game.js; this only draws what it reports.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;

  // RuneLite's SkillColor
  const COLOURS = {
    attack: [155, 32, 7], defence: [98, 119, 190], strength: [4, 149, 90], hitpoints: [131, 126, 126],
    ranged: [109, 144, 23], prayer: [159, 147, 35], magic: [50, 80, 193], cooking: [112, 35, 134],
    woodcutting: [52, 140, 37], fletching: [3, 141, 125], fishing: [106, 132, 164], firemaking: [189, 120, 25],
    crafting: [151, 110, 77], smithing: [108, 107, 82], mining: [93, 143, 167], herblore: [7, 133, 9],
    agility: [58, 60, 137], thieving: [108, 52, 87], slayer: [100, 100, 100], farming: [101, 152, 63],
    runecraft: [170, 141, 26],
  };
  const DEFAULTS = { xpPanelLabel1: 'XP_GAINED', xpPanelLabel2: 'XP_LEFT', xpPanelLabel3: 'XP_HOUR', xpPanelLabel4: 'ACTIONS_LEFT', progressBarLabel: 'PERCENTAGE', progressBarTooltipLabel: 'TIME_TO_LEVEL' };
  const KEYS = { TIME_TO_LEVEL: 'TTL', XP_GAINED: 'XP Gained', XP_HOUR: 'XP/hr', XP_LEFT: 'XP Left', ACTIONS_LEFT: 'Actions', ACTIONS_HOUR: 'Actions/hr', ACTIONS_DONE: 'Actions Done' };
  const ACTIONS = new Set(['ACTIONS_LEFT', 'ACTIONS_HOUR', 'ACTIONS_DONE']);

  const state = () => (App.state.pluginState || {}).xptracker || null;
  const cfg = (key) => App.config('xptracker', key, DEFAULTS[key]);
  const command = (action, skill) => App.setConfig('xptracker', 'command', skill === undefined ? { action, t: Date.now() } : { action, skill, t: Date.now() });

  // RuneLite's QuantityFormatter.quantityToRSDecimalStack(n, true)
  function stack(n) {
    if (!Number.isFinite(n)) return 'N/A';
    n = Math.trunc(n);
    if (String(n).length <= 4) return String(n);
    const power = Math.floor(Math.log10(Math.abs(n)));
    const places = power >= 6 ? 3 : 1;
    const f = 10 ** places;
    const v = Math.floor((n / 10 ** (Math.floor(power / 3) * 3)) * f) / f;
    return v.toLocaleString('en-GB', { maximumFractionDigits: places }) + ['', 'K', 'M', 'B'][Math.floor(power / 3)];
  }
  const pct = (s) => `${(Math.floor(s.progress * 100) / 100).toFixed(2)}%`;

  function value(label, s) {
    switch (label) {
      case 'TIME_TO_LEVEL': return s.ttlShort;
      case 'XP_HOUR': return stack(s.xpHour);
      case 'XP_LEFT': return stack(s.xpLeft);
      case 'ACTIONS_LEFT': return stack(s.actionsLeft);
      case 'ACTIONS_HOUR': return stack(s.actionsHour);
      case 'ACTIONS_DONE': return stack(s.actions);
      default: return stack(s.xpGained);
    }
  }
  /** XpProgressBarLabel */
  function barValue(label, s) {
    if (label === 'TIME_TO_LEVEL') return s.ttl;
    if (label === 'HOURS_TO_LEVEL') return s.ttlHours;
    return pct(s);
  }
  const line = (key, v) => h('div.xp-line', {}, h('span.xp-key', { text: key }), h('span', { text: v }));

  function labelFor(n, s) {
    const label = cfg(`xpPanelLabel${n}`);
    // RuneLite hides the action labels for combat skills
    if (ACTIONS.has(label) && s.combat) return h('div.xp-line');
    return line(`${KEYS[label] || label}: `, value(label, s));
  }

  function bar(s, compact) {
    const [r, g, b] = COLOURS[s.skill] || [80, 80, 80];
    const tipLabel = cfg('progressBarTooltipLabel');
    const tipEnd = `${barValue(tipLabel, s)} ${tipLabel === 'PERCENTAGE' ? 'of goal' : 'till goal lvl'}`;
    const tip = s.combat ? tipEnd : `${stack(s.actions)} Actions done\n${stack(s.actionsHour)} Actions/hr\n${tipEnd}`;
    const name = s.skill[0].toUpperCase() + s.skill.slice(1);
    return h('div.xp-barrow', {},
      compact ? UI.icon(`../skills/${s.skill}.png`, { class: 'xp-icon-small', tip: name }) : null,
      h(`div.xp-bar${s.paused ? '.xp-dimmed' : ''}`, { tip },
        h('div.xp-bar-fill', { style: `width:${Math.max(0, Math.min(100, s.progress))}%;background:rgb(${r},${g},${b})` }),
        h('span.xp-bar-text', { text: `Lvl. ${s.startLevel}` }),
        h('span.xp-bar-pct', { text: barValue(cfg('progressBarLabel'), s) }),
        h('span.xp-bar-next', { text: s.endIsMax ? '200M' : `Lvl. ${s.endLevel}` })));
  }

  function box(s) {
    const name = s.skill[0].toUpperCase() + s.skill.slice(1);
    return h('div.xp-box', {
      onclick: () => command('compact', s.skill),
      oncontextmenu: (e) => UI.popup(e, [
        ['Reset', () => command('reset', s.skill)],
        ['Reset others', () => command('resetOthers', s.skill)],
        ['Reset/hr', () => command('resetPerHour', s.skill)],
        [s.paused ? 'Unpause' : 'Pause', () => command(s.paused ? 'unpause' : 'pause', s.skill)],
        [s.canvas ? 'Remove from canvas' : 'Add to canvas', () => command('canvas', s.skill)],
      ]),
    },
    s.compact ? null : h('div.xp-head', {},
      h('div.xp-iconbox', { tip: name }, UI.icon(`../skills/${s.skill}.png`, { class: 'xp-icon' })),
      h('div.xp-stats', {}, labelFor(1, s), labelFor(2, s), labelFor(3, s), labelFor(4, s))),
    bar(s, s.compact));
  }

  window.Panels.push({
    id: 'xptracker',
    tooltip: 'XP Tracker',
    icon: 'xp_icon.png',
    priority: 4,
    visible: () => App.config('lostlite', 'xptrackerPlugin', true) !== false,
    watch: ['pluginState', 'loggedIn'],
    render(root) {
      const st = state();
      const rows = st ? [...(st.skills || [])] : [];
      // in the order you started training them (RuneLite adds each box at the bottom), or
      // the latest XP first with "Move recently trained skills to top"
      if (cfg('prioritizeRecentXpSkills')) rows.sort((a, b) => b.lastChange - a.lastChange);
      const t = st && st.total;
      root.replaceChildren(h('div.xp-panel', {},
        h('div.xp-box.xp-overall', {
          oncontextmenu: (e) => UI.popup(e, [
            ['Reset All', () => command('reset')],
            ['Reset All/hr', () => command('resetPerHour')],
            ['Pause All', () => command('pause')],
            ['Unpause All', () => command('unpause')],
          ]),
        },
        h('div.xp-head', {},
          h('div.xp-iconbox', {}, UI.icon('xp_icon.png', { class: 'xp-icon' })),
          h('div.xp-stats.one', {}, line('Gained: ', stack(t ? t.xpGained : 0)), line('Per hour: ', stack(t ? t.xpHour : 0))))),
        rows.length ? null : h('div.small.muted.xp-empty', { text: App.state.loggedIn ? 'Gain some XP to start tracking.' : 'Log in to start tracking XP.' }),
        ...rows.map(box)));
    },
  });
})();
