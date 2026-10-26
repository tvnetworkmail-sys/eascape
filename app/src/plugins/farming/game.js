'use strict';
// Time Tracking (farming), app side: RuneLite's FarmingTracker for our patches. It decodes the
// patch varps the page reports (patches.json), keeps each account's patches (saved, so the
// panel knows them while you're logged out) and predicts them (PatchPrediction: the produce,
// crop state, stage of stages and when it's done). Growth comes on the server's 5-minute ticks
// (flowers every tick, allotments and hops every 2nd, herbs every 4th), shifted by an offset the
// client isn't told, so "done" times count from when the tracker saw the patch change.
const DATA = require('./patches.json');

function decodePatch(p, varps) {
  const raw = ((varps[p.varp] | 0) >>> p.start) & ((1 << (p.end - p.start + 1)) - 1);
  const table = DATA.decode[DATA.types[p.type].key] || {};
  const packed = table[raw];
  if (packed === undefined || packed < 0) return { raw, unknown: true };
  return { raw, crop: Math.floor(packed / 1000), kind: Math.floor(packed / 100) % 10, stage: packed % 100 };
}

/** The last growing stage of a crop in this patch type (from the decode table). */
function lastStage(type, crop) {
  const table = DATA.decode[DATA.types[type].key] || {};
  let max = 0;
  for (const packed of Object.values(table)) {
    if (packed < 0 || Math.floor(packed / 1000) !== crop) continue;
    const k = Math.floor(packed / 100) % 10;
    if (k >= 1 && k <= 3) max = Math.max(max, packed % 100);
  }
  return max;
}

const title = (n) => String(n).replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

/** RuneLite's PatchPrediction: { produce, item, cropState, stage, stages, doneEstimate (ms) } or null */
function predict(p, s) {
  if (!s || !s.state || s.state.unknown) return null;
  const { crop, kind, stage } = s.state;
  const interval = DATA.types[p.type].ticks * DATA.tickMinutes * 60000;
  const since = s.changed || Date.now();
  if (crop === 0) {
    // weeds (RuneLite's Produce.WEEDS, always GROWING): stage 0 raked clear, up to 3 fully
    // overgrown; they grow back a stage a tick, so "done" is when they're back to full
    return { produce: 'Weeds', weeds: true, ignore: true, item: DATA.weeds, cropState: 'GROWING', stage, stages: 4, doneEstimate: since + (3 - stage) * interval };
  }
  const c = DATA.crops[crop] || {};
  const last = lastStage(p.type, crop);
  const out = { produce: title(c.name || `crop ${crop}`), item: c.item || null, stage: Math.min(stage, last + 1), stages: last + 2 };
  if (c.name === 'scarecrow') out.ignore = true; // RuneLite's Produce.SCARECROW: left out of the overview like weeds
  if (kind === 5) return Object.assign(out, { cropState: 'HARVESTABLE', stage: out.stages - 1, doneEstimate: since });
  if (kind === 4) return Object.assign(out, { cropState: 'DEAD', doneEstimate: since });
  if (kind === 3) return Object.assign(out, { cropState: 'DISEASED', doneEstimate: since });
  return Object.assign(out, { cropState: 'GROWING', watered: kind === 2, doneEstimate: since + (last - stage + 1) * interval });
}

module.exports = function farming(ctx) {
  let off = null;
  let timer = null;
  let account = null;
  let patches = {}; // index -> { state, raw, changed, seen }
  let icons = {};
  let notify = {}; // index -> true (the bell)
  const told = new Set();

  const saves = () => Object.assign({}, ctx.state('saves', {}));
  const wantIcons = () => {
    const ids = new Set([DATA.weeds, DATA.overviewIcon, ...Object.values(DATA.types).map((t) => t.icon)]);
    for (const c of Object.values(DATA.crops)) if (c.item) ids.add(c.item);
    return [...ids].filter((id) => !icons[id]);
  };
  const toPage = (enabled) => ctx.sendToGame({ type: 'plugin-config', id: 'farming', enabled, config: enabled ? { wantIcons: wantIcons() } : {} });

  function load(name) {
    const key = String(name || '').toLowerCase();
    if (!key || key === account) return;
    save();
    account = key;
    const saved = saves()[key] || {};
    patches = Object.assign({}, saved.patches || {});
    notify = Object.assign({}, saved.notify || {});
    report();
  }
  function save() {
    if (!account) return;
    const all = saves();
    all[account] = { patches, notify };
    ctx.setState('saves', all);
  }

  function onVarps(varps) {
    if (!account) return;
    const now = Date.now();
    let changed = false;
    for (const p of DATA.patches) {
      const state = decodePatch(p, varps);
      const prev = patches[p.index];
      if (!prev || prev.raw !== state.raw) {
        patches[p.index] = { state, raw: state.raw, changed: now, seen: now };
        changed = true;
      } else prev.seen = now;
    }
    if (changed) save();
    report();
  }

  function report() {
    const now = Date.now();
    const list = DATA.patches.map((p) => ({ index: p.index, type: p.type, title: p.place, notify: !!notify[p.index], prediction: predict(p, patches[p.index]) }));
    for (const d of list) {
      const pr = d.prediction;
      if (!d.notify || !pr || pr.weeds || pr.doneEstimate > now) continue;
      const id = `${account}:${d.index}:${patches[d.index] && patches[d.index].changed}`;
      if (told.has(id)) continue;
      told.add(id);
      // RuneLite's wording (FarmingTracker.sendNotification)
      if (ctx.notify && pr.cropState !== 'DEAD' && pr.cropState !== 'DISEASED') ctx.notify('Time Tracking', `Your ${pr.produce} is ready to harvest in ${d.title}.`);
    }
    ctx.report({ account, patches: list, types: DATA.types, tabOrder: DATA.tabOrder, overviewIcon: DATA.overviewIcon, weedsIcon: DATA.weeds, icons, timeFormatMode: ctx.config('timeFormatMode') || 'ABSOLUTE_24H' });
  }

  function command(c) {
    if (!c || typeof c !== 'object') return;
    if (c.action === 'notify' && c.index) {
      if (c.on) notify[c.index] = true; else delete notify[c.index];
      save();
      report();
    }
  }

  return {
    start() {
      icons = Object.assign({}, ctx.state('icons', {}));
      toPage(true);
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data && data.name) load(data.name);
        else if (type === 'farming-varps' && data && data.varps) onVarps(data.varps);
        else if (type === 'farming-icon' && data && data.id >= 0 && data.url && !icons[data.id]) {
          icons[data.id] = data.url;
          ctx.setState('icons', icons);
          report();
        } else if (type === 'login-state' && !data) save();
      });
      timer = setInterval(report, 10000); // RuneLite's update interval (getUpdateInterval: 10 seconds)
      report();
    },
    stop() {
      save();
      if (off) off();
      if (timer) clearInterval(timer);
      ctx.report(null);
      toPage(false);
    },
    configChanged(key) {
      if (key === 'command') { command(ctx.config('command')); return; }
      if (key === 'saves' || key === 'icons') return;
      report();
    },
    gameReady: () => { toPage(true); report(); },
  };
};

module.exports.decodePatch = decodePatch;
module.exports.lastStage = lastStage;
module.exports.predict = predict;
module.exports.DATA = DATA;
