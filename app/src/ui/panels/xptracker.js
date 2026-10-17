'use strict';
// XP Tracker panel, laid out like RuneLite's XpPanel: an overall box (gained, per hour),
// then a box per skill trained with its icon, XP gained / XP an hour on the left, XP left /
// actions left on the right, and a progress bar in the skill's colour (Lvl. n, the percent,
// Lvl. n+1; hover it for the time left). Right-click a box to reset.
//
// Each account's tracking is saved on this PC and carries on next time LostLite starts; it
// only goes when you reset it (or a skill goes quiet for the "auto reset" time). The XP an
// hour counts the time you were logged in, not the time LostLite was closed.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const XP = [0];
  for (let lvl = 1, pts = 0; lvl < 99; lvl++) {
    pts += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    XP.push(Math.floor(pts / 4));
  }
  const levelFor = (xp) => {
    let l = 1;
    while (l < 99 && xp >= XP[l]) l++;
    return l;
  };

  // RuneLite's skill colours (the progress bars)
  const COLOURS = {
    attack: [155, 32, 7], defence: [98, 119, 190], strength: [4, 149, 90], hitpoints: [131, 126, 126],
    ranged: [109, 144, 23], prayer: [159, 147, 35], magic: [50, 80, 193], cooking: [112, 35, 134],
    woodcutting: [52, 140, 37], fletching: [3, 141, 125], fishing: [106, 132, 164], firemaking: [189, 120, 25],
    crafting: [151, 110, 77], smithing: [108, 107, 82], mining: [93, 143, 167], herblore: [7, 133, 9],
    agility: [58, 60, 137], thieving: [108, 52, 87], runecraft: [170, 141, 26],
  };

  // skill -> { start, xp, active (ms logged in since the start), actions, lastGain }
  let session = new Map();
  let account = null; // lower-case name of the account being tracked
  let lastStats = null;
  let lastTick = Date.now();
  let dirty = false;
  let savedAt = 0;

  const cfg = (key, fallback) => App.config('xptracker', key, fallback);
  const log = (msg) => window.lostlite.log && window.lostlite.log(`XP Tracker: ${msg}`);

  // ---------------------------------------------------------------- saving

  function allSaved() {
    const v = App.config('xptracker', 'sessions', null);
    return v && typeof v === 'object' ? v : {};
  }

  function save(force, quiet) {
    if (!account || (!dirty && !force)) return;
    const now = Date.now();
    if (!force && now - savedAt < 5000) return;
    savedAt = now;
    dirty = false;
    const all = { ...allSaved() };
    if (session.size) all[account] = Object.fromEntries(session);
    else delete all[account];
    App.setConfig('xptracker', 'sessions', all);
    if (force && !quiet) log(`saved ${session.size} skill(s) for ${account}`);
  }

  function useAccount(name) {
    const key = name ? String(name).toLowerCase() : null;
    if (!key || key === account) return;
    save(true);
    account = key;
    if (App.config('xptracker', 'lastAccount', null) !== key) App.setConfig('xptracker', 'lastAccount', key);
    session = new Map();
    const saved = allSaved()[key];
    if (saved && typeof saved === 'object') {
      for (const [skill, t] of Object.entries(saved)) {
        if (t && Number.isFinite(t.start) && Number.isFinite(t.xp)) session.set(skill, { start: t.start, xp: t.xp, active: t.active || 0, actions: t.actions || 0, lastGain: t.lastGain || 0 });
      }
    }
    lastStats = null;
    log(`${session.size} saved skill(s) for ${key}`);
  }

  /** Before you log in, show the last account's tracking (once the settings are loaded). */
  function restoreLast() {
    if (account || !App.state || !App.state.config) return;
    const last = App.config('xptracker', 'lastAccount', null);
    if (last) useAccount(last);
  }

  // ---------------------------------------------------------------- tracking

  function onStats(stats) {
    if (!Array.isArray(stats) || !account) return;
    const now = Date.now();
    const by = {};
    for (const s of stats) by[s.skill] = s.xp;
    if (!lastStats) {
      // First reading this login: XP gained somewhere else since (another client) isn't ours.
      for (const [skill, t] of session) {
        const xp = by[skill];
        if (typeof xp === 'number' && xp > 0 && xp !== t.xp) {
          t.start += xp - t.xp;
          t.xp = xp;
          dirty = true;
        }
      }
      // the game fills your stats in just after logging in: only take readings with XP in
      if (Object.values(by).some((v) => v > 0)) lastStats = by;
      return;
    }
    for (const [skill, xp] of Object.entries(by)) {
      const before = lastStats[skill];
      if (typeof before !== 'number' || xp <= before) continue;
      let t = session.get(skill);
      const resetMin = cfg('resetAfter', 0);
      if (t && resetMin > 0 && now - t.lastGain > resetMin * 60000) t = null;
      if (!t) {
        t = { start: before, xp: before, active: 0, actions: 0, lastGain: now };
        session.set(skill, t);
      }
      t.xp = xp;
      t.actions++;
      t.lastGain = now;
      dirty = true;
    }
    lastStats = by;
    if (dirty) save(true, true); // every gain straight away, so closing LostLite loses none
  }

  function onLogin(loggedIn) {
    if (!loggedIn) {
      save(true);
      lastStats = null; // the next login's first reading isn't a gain
    }
  }

  /** Adds the time since the last tick to every tracked skill (while logged in). */
  function tick(now = Date.now()) {
    restoreLast();
    const dt = Math.max(0, Math.min(10000, now - lastTick));
    lastTick = now;
    if (!App.state.loggedIn && cfg('pauseOnLogout', true)) return;
    if (!account) return;
    for (const t of session.values()) t.active += dt;
    if (session.size) dirty = true;
    save(false);
  }

  function reset(skill) {
    if (skill) session.delete(skill);
    else session.clear();
    save(true);
    App.renderPanel(false);
  }

  function resetOthers(skill) {
    for (const k of [...session.keys()]) if (k !== skill) session.delete(k);
    save(true);
    App.renderPanel(false);
  }

  window.lostlite.onEvent((ev) => {
    if (ev.type !== 'patch' || !ev.data) return;
    if (ev.data.player && ev.data.player.name) useAccount(ev.data.player.name);
    if ('stats' in ev.data && ev.data.stats) onStats(ev.data.stats);
    if ('loggedIn' in ev.data) onLogin(ev.data.loggedIn);
  });
  setInterval(() => tick(), 1000);
  window.addEventListener('beforeunload', () => save(true));

  // ---------------------------------------------------------------- drawing

  const rate = (t) => (t.xp - t.start) / Math.max(1 / 60, t.active / 3600000);
  const fmt = (n) => Math.round(n).toLocaleString('en-GB');
  // RuneLite's short numbers: 8040, 21.3K, 353.8K, 1.25M
  const short = (n) => (n >= 1e6 ? `${(Math.floor(n / 1e4) / 100).toFixed(2)}M` : n >= 1e4 ? `${(Math.floor(n / 100) / 10).toFixed(1)}K` : String(Math.round(n)));
  function time(hours) {
    if (!Number.isFinite(hours) || hours <= 0) return '--';
    const s = Math.round(hours * 3600);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh > 99 ? '99:59:59+' : `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  const stat = (label, value) => h('div.xp-line', {}, h('span', { text: `${label}: ` }), h('span', { text: value }));

  function box(skill, t) {
    const level = levelFor(t.xp);
    const lo = XP[level - 1] || 0;
    const hi = level >= 99 ? null : XP[level];
    const gained = t.xp - t.start;
    const perHour = rate(t);
    const left = hi === null ? 0 : hi - t.xp;
    const perAction = t.actions ? gained / t.actions : 0;
    const pct = hi === null ? 100 : Math.floor(((t.xp - lo) / (hi - lo)) * 10000) / 100;
    const [r, g, b] = COLOURS[skill] || [80, 80, 80];
    const name = skill[0].toUpperCase() + skill.slice(1);
    const bar = h('div.xp-bar', { tip: hi === null ? `${fmt(t.xp)} XP` : `${fmt(t.xp - lo)}/${fmt(hi - lo)} XP\n${fmt(left)} XP left\nTime left: ${time(left / perHour)}` },
      h('div.xp-bar-fill', { style: `width:${Math.max(0, Math.min(100, pct))}%;background:rgb(${r},${g},${b})` }),
      h('span.xp-bar-text', { text: `Lvl. ${level}` }),
      h('span.xp-bar-pct', { text: `${pct.toFixed(2)}%` }),
      h('span.xp-bar-next', { text: hi === null ? '' : `Lvl. ${level + 1}` }));
    return h('div.xp-box', {
      oncontextmenu: (e) => UI.popup(e, [['Reset', () => reset(skill)], ['Reset others', () => resetOthers(skill)], ['Reset all', () => reset()]]),
    },
    h('div.xp-head', {},
      h('div.xp-iconbox', { tip: name }, UI.icon(`../skills/${skill}.png`, { class: 'xp-icon' })),
      h('div.xp-stats', {},
        h('div', {}, stat('XP Gained', short(gained)), stat('XP/Hour', short(perHour))),
        h('div', {}, stat('XP Left', hi === null ? '-' : short(left)), stat('Actions', perAction > 0 && hi !== null ? short(Math.ceil(left / perAction)) : '-')))),
    bar);
  }

  window.Panels.push({
    id: 'xptracker',
    tooltip: 'XP Tracker',
    icon: 'xp_icon.png',
    priority: 4,
    visible: () => App.config('lostlite', 'xptrackerPlugin', true) !== false,
    watch: ['stats', 'loggedIn'],
    render(root) {
      restoreLast();
      const rows = [...session.entries()].filter(([, t]) => !(cfg('hideMaxed', false) && levelFor(t.xp) >= 99));
      rows.sort((a, b) => b[1].lastGain - a[1].lastGain);
      const totalGained = rows.reduce((n, [, t]) => n + (t.xp - t.start), 0);
      const totalRate = rows.reduce((n, [, t]) => n + rate(t), 0);
      root.replaceChildren(h('div.xp-panel', {},
        h('div.xp-box.xp-overall', { oncontextmenu: (e) => UI.popup(e, [['Reset all', () => reset()]]) },
          h('div.xp-head', {},
            h('div.xp-iconbox', {}, UI.icon('xp_icon.png', { class: 'xp-icon' })),
            h('div.xp-stats.one', {}, stat('Gained', short(totalGained)), stat('Per hour', short(totalRate))))),
        rows.length ? null : h('div.small.muted.xp-empty', { text: App.state.loggedIn ? 'Gain some XP to start tracking.' : 'Log in to start tracking XP.' }),
        ...rows.map(([skill, t]) => box(skill, t))));
    },
  });
  // keep the per hour numbers moving while the panel is open
  setInterval(() => {
    if (App.activeId === 'xptracker') App.renderPanel(false);
  }, 1000);

  window.__xpTracker = { onStats, onLogin, tick, useAccount, save, session: () => session, XP, levelFor, short, rate };
})();
