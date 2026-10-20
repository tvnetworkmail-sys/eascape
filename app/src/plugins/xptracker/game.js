'use strict';
// XP Tracker, tracking side (runs with the game view): RuneLite's XpTrackerPlugin, XpState,
// XpStateSingle and XpPauseState (BSD 2-Clause; see descriptor.js) for the 2006 game's skills.
//
// Each skill keeps its start XP, the XP gained before and since the last "Reset/hr", the time
// it has been trained (only while it isn't paused) and its last 10 actions (for actions left).
// A skill shows in the panel once it gains XP. Pausing: by hand, on logout (if set) and after
// "Auto pause after" minutes without XP; any XP gain unpauses it. Saved per account (if "Save
// between sessions" is on) and reported to the sidebar panel every second; the skills added
// to the canvas go to the page side (page.js) to draw.
const descriptor = require('./descriptor');

const SKILLS = ['attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic',
  'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting', 'smithing',
  'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft'];
const COMBAT = new Set(['attack', 'strength', 'defence', 'hitpoints', 'ranged']);

// Experience table, levels 1..99 (and 200M at the top, like RuneLite's MAX_SKILL_XP)
const XP = [0, 0];
for (let lvl = 1, pts = 0; lvl < 99; lvl++) {
  pts += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
  XP.push(Math.floor(pts / 4)); // XP[level] = XP needed for that level
}
const MAX_XP = 200000000;
const levelFor = (xp) => {
  let l = 1;
  while (l < 99 && xp >= XP[l + 1]) l++;
  return l;
};

function newState(startXp) {
  return { startXp, before: 0, since: 0, time: 0, actions: 0, actionsSince: 0, history: null, historyIndex: 0, lastChange: 0, startLevelXp: 0, endLevelXp: 0 };
}

const gained = (s) => s.before + s.since;
const current = (s) => s.startXp + gained(s);
const seconds = (s) => Math.max(60, Math.floor(s.time / 1000));
const hourly = (s, v) => Math.floor((1 / (seconds(s) / 3600)) * v);

function updateGoals(s, xp) {
  const lvl = levelFor(xp);
  s.startLevelXp = XP[lvl];
  s.endLevelXp = lvl < 99 ? XP[lvl + 1] : MAX_XP;
}

/** XpStateSingle.update: true when the XP changed. */
function update(s, xp) {
  const action = xp - current(s);
  if (action === 0) return false;
  if (s.history) s.history[s.historyIndex] = action;
  else s.history = new Array(10).fill(action);
  s.historyIndex = (s.historyIndex + 1) % 10;
  s.actions++;
  s.actionsSince++;
  s.since = xp - (s.startXp + s.before);
  s.lastChange = Date.now();
  return true;
}

function resetPerHour(s) {
  s.actionsSince = 0;
  s.before += s.since;
  s.since = 0;
  s.lastChange = Date.now();
  s.time = 0;
}

/** RuneLite's time to goal, in its three formats. */
function timeTill(s, type) {
  const secs = s.since > 0 ? Math.floor(((s.endLevelXp - current(s)) * seconds(s)) / s.since) : -1;
  if (secs < 0) return '∞';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const hoursTotal = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  const p = (n) => String(n).padStart(2, '0');
  if (type === 'days' && days > 1) return `${days} days ${p(hours)}:${p(mins)}:${p(ss)}`;
  if (type === 'days' && days === 1) return `1 day ${p(hours)}:${p(mins)}:${p(ss)}`;
  if ((type === 'days' || type === 'hours') && hoursTotal > 1) return `${hoursTotal} hours ${p(mins)}:${p(ss)}`;
  if ((type === 'days' || type === 'hours') && hoursTotal === 1) return `1 hour ${p(mins)}:${p(ss)}`;
  if (hoursTotal > 0) return `${hoursTotal}:${p(mins)}:${p(ss)}`;
  return `${p(mins)}:${p(ss)}`;
}

function actionsLeft(s) {
  if (!s.history) return Infinity;
  const total = s.history.reduce((a, b) => a + b, 0);
  if (total <= 0) return Infinity;
  const left = (s.endLevelXp - current(s)) * s.history.length;
  return Math.ceil(left / total);
}

/** RuneLite's XpSnapshotSingle, as plain data for the panel and the page. */
function snapshot(s) {
  const goal = s.endLevelXp - s.startLevelXp;
  return {
    xp: current(s),
    startLevel: levelFor(s.startLevelXp),
    endLevel: s.endLevelXp >= MAX_XP ? 100 : levelFor(s.endLevelXp),
    endIsMax: s.endLevelXp >= MAX_XP,
    xpGained: gained(s),
    xpLeft: s.endLevelXp - current(s),
    xpHour: hourly(s, s.since),
    progress: goal > 0 ? ((current(s) - s.startLevelXp) / goal) * 100 : 100,
    actions: s.actions,
    actionsLeft: actionsLeft(s),
    actionsHour: hourly(s, s.actionsSince),
    ttl: timeTill(s, 'days'),
    ttlHours: timeTill(s, 'hours'),
    ttlShort: timeTill(s, 'short'),
    lastChange: s.lastChange,
  };
}

module.exports = function xpTracker(ctx) {
  let off = null;
  let timer = null;
  let account = null;
  let skills = {}; // skill -> state
  let overall = null;
  let shown = []; // skills in the panel, in the order they first gained XP
  let paused = {}; // skill or '' (overall) -> Set of reasons: manual, logout, timeout
  let pauseXp = {}; // skill -> { xp, lastChange } (XpPauseStateSingle)
  let canvas = []; // skills drawn on the game view
  let compact = []; // skills shown compact in the panel
  let loggedIn = false;
  let initialised = false; // the first stats after login have been read
  let lastStats = null;
  let lastTick = 0;
  let lastSave = 0;
  let rawStats = null; // the last stats the game sent, for an account loaded after them

  const cfg = (key) => {
    const v = ctx.config(key);
    if (v !== undefined) return v;
    const item = descriptor.config.items.find((i) => i.key === key);
    return item ? item.default : undefined;
  };
  const isPaused = (k) => !!(paused[k] && paused[k].size);
  const pause = (k, why) => (paused[k] || (paused[k] = new Set())).add(why);

  // ---------------------------------------------------------------- saving

  function save() {
    if (!account || !cfg('saveState')) return;
    const all = Object.assign({}, ctx.state('saves', {}));
    all[account] = { skills, overall, shown, canvas, compact };
    ctx.setState('saves', all);
    lastSave = Date.now();
  }

  /** The last tracker's save ({ start, xp, active, actions, lastGain } per skill). */
  function fromOld(old) {
    const out = {};
    for (const [k, t] of Object.entries(old || {})) {
      if (!t || !Number.isFinite(t.start) || !Number.isFinite(t.xp)) continue;
      const s = newState(t.start);
      s.since = t.xp - t.start;
      s.time = t.active || 0;
      s.actions = s.actionsSince = t.actions || 0;
      s.lastChange = t.lastGain || 0;
      if (s.actions > 0 && s.since > 0) s.history = new Array(10).fill(Math.max(1, Math.round(s.since / s.actions)));
      updateGoals(s, t.xp);
      out[k] = s;
    }
    return out;
  }

  function load(name) {
    save();
    account = String(name || '').toLowerCase() || null;
    skills = {};
    overall = null;
    shown = [];
    canvas = [];
    compact = [];
    paused = {};
    pauseXp = {};
    initialised = false;
    lastStats = null;
    if (account && cfg('saveState')) {
      const saved = (ctx.state('saves', {}) || {})[account];
      if (saved && saved.skills) {
        skills = saved.skills;
        overall = saved.overall || null;
        shown = (saved.shown || []).filter((k) => skills[k]);
        canvas = (saved.canvas || []).filter((k) => skills[k]);
        compact = saved.compact || [];
      } else {
        const old = (ctx.state('sessions', {}) || {})[account];
        if (old) {
          skills = fromOld(old);
          shown = Object.keys(skills).sort((a, b) => skills[a].lastChange - skills[b].lastChange);
          ctx.log(`carried over ${shown.length} skill(s) from the old tracker`);
        }
      }
    }
    report();
    if (rawStats) onStats(rawStats);
  }

  // ---------------------------------------------------------------- tracking

  function onStats(stats) {
    if (!Array.isArray(stats) || !account) return;
    const by = {};
    for (const s of stats) if (SKILLS.includes(s.skill)) by[s.skill] = s.xp;
    // the game fills your stats in just after logging in: wait for a reading with XP in
    if (!Object.values(by).some((v) => v > 0)) return;
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    if (!initialised) {
      // First reading this login: XP gained somewhere else since the save isn't ours.
      for (const [k, xp] of Object.entries(by)) {
        const s = skills[k];
        if (!s) {
          skills[k] = newState(xp);
        } else if (xp < current(s)) {
          skills[k] = newState(xp);
          shown = shown.filter((x) => x !== k);
        } else if (xp > current(s)) {
          s.startXp += xp - current(s);
        }
        updateGoals(skills[k], xp);
        pauseXp[k] = { xp, lastChange: Date.now() };
      }
      if (!overall || total < current(overall)) overall = newState(total);
      else if (total > current(overall)) overall.startXp += total - current(overall);
      pauseXp[''] = { xp: total, lastChange: Date.now() };
      initialised = true;
      lastStats = by;
      report();
      return;
    }
    let changed = false;
    for (const [k, xp] of Object.entries(by)) {
      if (lastStats && lastStats[k] === xp) continue;
      let s = skills[k];
      if (!s || current(s) > xp) {
        skills[k] = s = newState(xp); // less XP than before: start again
        updateGoals(s, xp);
        continue;
      }
      if (cfg('hideMaxed') && levelFor(xp) >= 99) continue;
      if (update(s, xp)) {
        updateGoals(s, xp);
        if (!shown.includes(k)) shown.push(k);
        else if (cfg('prioritizeRecentXpSkills')) shown = [...shown.filter((x) => x !== k), k];
        changed = true;
      }
    }
    if (overall && total !== current(overall)) {
      if (total < current(overall)) overall = newState(total);
      else update(overall, total);
      updateGoals(overall, Math.min(total, MAX_XP));
    }
    lastStats = by;
    if (changed) {
      save();
      report();
    }
  }

  /** Once a second: pauses, the trained time and the per hour resets (onGameTick). */
  function tick() {
    const now = Date.now();
    const delta = lastTick ? Math.max(0, Math.min(10000, now - lastTick)) : 0;
    lastTick = now;
    if (!account || !initialised) return;
    const pauseAfter = (Number(cfg('pauseSkillAfter')) || 0) * 60000;
    const resetAfter = (Number(cfg('resetSkillRateAfter')) || 0) * 60000;
    const keys = [...Object.keys(skills), ''];
    for (const k of keys) {
      const s = k ? skills[k] : overall;
      if (!s) continue;
      const p = pauseXp[k] || (pauseXp[k] = { xp: current(s), lastChange: now });
      if (p.xp !== current(s)) {
        p.xp = current(s);
        p.lastChange = now;
        if (paused[k]) paused[k].clear();
      } else if (pauseAfter > 0 && p.lastChange && now - p.lastChange >= pauseAfter) {
        pause(k, 'timeout');
      }
      if (!loggedIn && cfg('pauseOnLogout')) pause(k, 'logout');
      else if (paused[k]) paused[k].delete('logout');
      if (!isPaused(k) && s.since > 0) {
        s.time += delta;
        if (resetAfter > 0 && s.lastChange && now - s.lastChange >= resetAfter) resetPerHour(s);
      }
    }
    if (now - lastSave > 60000) save(); // RuneLite saves every minute
    report();
  }

  // ---------------------------------------------------------------- panel actions

  function command(cmd) {
    if (!cmd || typeof cmd.action !== 'string') return;
    const k = cmd.skill;
    const all = cmd.skill === undefined;
    switch (cmd.action) {
      case 'reset': // RuneLite resetSkillState: start again from the current XP
        for (const x of all ? Object.keys(skills) : [k]) {
          if (!skills[x]) continue;
          skills[x] = newState(current(skills[x]));
          updateGoals(skills[x], current(skills[x]));
        }
        shown = all ? [] : shown.filter((x) => x !== k);
        canvas = all ? [] : canvas.filter((x) => x !== k);
        if (all && overall) overall = newState(current(overall));
        break;
      case 'resetOthers':
        for (const x of shown) if (x !== k && skills[x]) skills[x] = newState(current(skills[x]));
        shown = shown.filter((x) => x === k);
        canvas = canvas.filter((x) => x === k);
        break;
      case 'resetPerHour':
        for (const x of all ? Object.keys(skills) : [k]) if (skills[x]) resetPerHour(skills[x]);
        if (all && overall) resetPerHour(overall);
        break;
      case 'pause':
        for (const x of all ? [...shown, ''] : [k]) pause(x, 'manual');
        break;
      case 'unpause':
        for (const x of all ? [...shown, ''] : [k]) {
          if (paused[x]) paused[x].clear();
          if (pauseXp[x]) pauseXp[x].lastChange = Date.now();
        }
        break;
      case 'canvas':
        canvas = canvas.includes(k) ? canvas.filter((x) => x !== k) : [...canvas, k];
        break;
      case 'compact':
        compact = compact.includes(k) ? compact.filter((x) => x !== k) : [...compact, k];
        break;
      default:
        return;
    }
    save();
    report();
  }

  // ---------------------------------------------------------------- reporting

  function report() {
    const list = shown.filter((k) => skills[k] && !(cfg('hideMaxed') && levelFor(current(skills[k])) >= 99))
      .map((k) => Object.assign(snapshot(skills[k]), { skill: k, paused: isPaused(k), combat: COMBAT.has(k), canvas: canvas.includes(k), compact: compact.includes(k) }));
    const total = overall ? snapshot(overall) : null;
    ctx.report({ account, loggedIn, skills: list, total: total && Object.assign(total, { paused: isPaused('') }) });
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = cfg(it.key);
    config.boxes = list.filter((s) => s.canvas);
    ctx.sendToGame({ type: 'plugin-config', id: 'xptracker', enabled: true, config });
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data && data.name && String(data.name).toLowerCase() !== account) load(data.name);
        else if (type === 'stats') {
          if (!loggedIn) loggedIn = true;
          rawStats = data;
          onStats(data);
        } else if (type === 'login-state') {
          loggedIn = !!data;
          if (!loggedIn) {
            initialised = false; // the next login's first reading isn't a gain
            lastStats = null;
            rawStats = null;
            save();
          }
        }
      });
      timer = setInterval(tick, 1000);
      report();
    },
    stop() {
      save();
      if (off) off();
      if (timer) clearInterval(timer);
      ctx.report(null);
      ctx.sendToGame({ type: 'plugin-config', id: 'xptracker', enabled: false });
    },
    configChanged(key) {
      if (key === 'command') {
        command(ctx.config('command'));
        return;
      }
      if (key === 'saves' || key === 'sessions') return;
      report();
    },
    gameReady: () => report(),
  };
};

module.exports.SKILLS = SKILLS;
