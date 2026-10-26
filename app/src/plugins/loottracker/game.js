'use strict';
// Loot Tracker, sidebar side: adds up the loot the page side sees per monster (RuneLite's
// LootTrackerRecord), keeps it (per account, if "Remember loot" is on) and reports it to the
// Loot Tracker panel.
const descriptor = require('./descriptor');
const clues = require('./clues.json');

// RuneLite's LootTrackerMapping: every clue scroll of a tier is one item ("Clue scroll
// (easy)"), though each clue step is its own item in the game, so they add up together.
const CANON = { Easy: 2677, Medium: 2801, Hard: 2722 };
// the stack steps the game's pictures change at (the runtime's iconStep): icons are kept as
// "id:step", so a pile of 1,791 coins shows the big pile
const STEPS = [10000, 1000, 250, 100, 25, 10, 5, 4, 3, 2];
const step = (n) => STEPS.find((s) => (n | 0) >= s) || 1;
function canonical(it) {
  const tier = clues[it.id];
  if (!tier || !CANON[tier] || !/^clue scroll/i.test(String(it.name || ''))) return it;
  return Object.assign({}, it, { id: CANON[tier], name: `Clue scroll (${tier.toLowerCase()})` });
}

/** Saved records from before the mapping: fold their clue scrolls together. */
function migrate(records) {
  for (const r of Object.values(records || {})) {
    const items = {};
    for (const it of Object.values(r.items || {})) {
      const c = canonical(it);
      const have = items[c.id] || (items[c.id] = { id: c.id, name: c.name, quantity: 0 });
      have.quantity += it.quantity || 0;
    }
    r.items = items;
  }
  return records;
}

module.exports = function lootTracker(ctx) {
  let off = null;
  let records = {}; // name -> { name, level, kills, items: { id: { id, name, quantity } } }
  let icons = {};
  let account = null;

  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    config.clues = clues;
    config.wantIcons = wanted();
    ctx.sendToGame({ type: 'plugin-config', id: 'loottracker', enabled, config });
  }

  function load(name) {
    account = String(name || '').toLowerCase() || null;
    const all = ctx.state('records', {});
    records = migrate((account && ctx.config('syncPanel') !== false && all[account]) || {});
    icons = ctx.state('icons', {}) || {};
    report();
  }

  function save() {
    if (!account || ctx.config('syncPanel') === false) return;
    const all = Object.assign({}, ctx.state('records', {}));
    all[account] = records;
    ctx.setState('records', all);
  }

  /** The totals whose stack picture we haven't got yet. */
  function wanted() {
    const out = [];
    for (const r of Object.values(records)) {
      for (const it of Object.values(r.items)) {
        const s = step(it.quantity);
        if (!icons[`${it.id}:${s}`]) out.push([it.id, s]);
      }
    }
    return out.slice(0, 200);
  }

  function report() {
    ctx.report({ records, icons, account });
  }

  function add(loot) {
    const r = records[loot.name] || (records[loot.name] = { name: loot.name, level: loot.level, kills: 0, items: {} });
    r.kills++;
    for (const raw of loot.items) {
      const it = canonical(raw);
      const have = r.items[it.id] || (r.items[it.id] = { id: it.id, name: it.name, quantity: 0 });
      have.quantity += it.quantity || 1;
      const k = `${raw.id}:${raw.step || step(raw.quantity)}`;
      if (raw.icon && !icons[k]) icons[k] = raw.icon;
      const ck = `${it.id}:${raw.step || step(raw.quantity)}`;
      if (it.id !== raw.id && icons[k] && !icons[ck]) icons[ck] = icons[k];
    }
    ctx.setState('icons', icons);
    save();
    report();
    if (wanted().length) send(true); // ask for the new totals' pictures
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data && data.name && String(data.name).toLowerCase() !== account) load(data.name);
        else if (type === 'loot' && data && Array.isArray(data.items)) add(data);
        else if (type === 'loot-icon' && data && data.id >= 0 && data.url && !icons[`${data.id}:${data.step || 1}`]) {
          icons[`${data.id}:${data.step || 1}`] = data.url;
          ctx.setState('icons', icons);
          report();
        }
      });
      icons = ctx.state('icons', {}) || {};
      send(true);
      report();
    },
    stop() {
      if (off) off();
      send(false);
    },
    configChanged(key) {
      if (key === 'command') {
        const cmd = ctx.config('command');
        if (cmd && cmd.action === 'reset') {
          if (cmd.name) delete records[cmd.name];
          else records = {};
          save();
          report();
        }
        return;
      }
      send(true);
      report();
    },
    gameReady: () => send(true),
  };
};
