'use strict';
// Farming tracker, app side: decodes the patch varps the page reports (patches.json), keeps
// each account's patches (saved, so the panel still knows them while you're logged out) and
// works out about when each crop is grown. Growth comes on the server's 5-minute ticks
// (flowers every tick, allotments and hops every 2nd, herbs every 4th), shifted by an offset
// the client isn't told, so the times are estimates: from the moment the tracker saw the
// patch's stage change, one interval per stage still to grow.
const DATA = require('./patches.json');

const KINDS = ['weeds', 'growing', 'watered', 'diseased', 'dead', 'grown'];

function decodePatch(p, varps) {
  const raw = ((varps[p.varp] | 0) >>> p.start) & ((1 << (p.end - p.start + 1)) - 1);
  const table = DATA.decode[DATA.types[p.type].key] || {};
  const packed = table[raw];
  if (packed === undefined || packed < 0) return { raw, unknown: true };
  const crop = Math.floor(packed / 1000);
  const kind = Math.floor(packed / 100) % 10;
  const stage = packed % 100;
  return { raw, crop, kind, stage };
}

/** The last growing stage of a crop in this patch type (from the decode table). */
function lastStage(type, crop) {
  const table = DATA.decode[DATA.types[type].key] || {};
  let max = 0;
  for (const packed of Object.values(table)) {
    if (packed < 0 || Math.floor(packed / 1000) !== crop) continue;
    const k = Math.floor(packed / 100) % 10;
    if (k === 1 || k === 2 || k === 3) max = Math.max(max, packed % 100);
  }
  return max;
}

function describe(p, s, now) {
  const type = DATA.types[p.type];
  const intervalMs = type.ticks * DATA.tickMinutes * 60000;
  const out = { index: p.index, place: p.place, type: p.type, typeTitle: type.title, seen: s.seen };
  if (!s.state || s.state.unknown) return Object.assign(out, { status: 'unknown', text: 'Unknown' });
  const { crop, kind, stage } = s.state;
  if (crop === 0) {
    // weeds: stage 0 raked clear, up to 3 fully overgrown (farming.rs2: they grow back on an empty patch)
    return Object.assign(out, stage === 0 ? { status: 'empty', text: 'Empty (raked)' } : { status: 'weeds', text: stage >= 3 ? 'Weeds' : 'Weeds growing back' });
  }
  const c = DATA.crops[crop];
  out.crop = c ? c.name : `crop ${crop}`;
  if (kind === 5) return Object.assign(out, { status: 'grown', text: 'Grown', readyAt: s.changed });
  if (kind === 4) return Object.assign(out, { status: 'dead', text: 'Dead' });
  if (kind === 3) return Object.assign(out, { status: 'diseased', text: 'Diseased' });
  const left = lastStage(p.type, crop) - stage + 1; // the last tick turns it grown
  const readyAt = (s.changed || now) + left * intervalMs;
  out.readyAt = readyAt;
  out.total = (lastStage(p.type, crop) + 1) * intervalMs;
  out.progress = Math.max(0, Math.min(1, 1 - (readyAt - now) / out.total));
  return Object.assign(out, { status: kind === 2 ? 'watered' : 'growing', text: readyAt <= now ? 'Should be grown' : 'Growing' });
}

module.exports = function farming(ctx) {
  let off = null;
  let timer = null;
  let account = null;
  let patches = {}; // index -> { state, raw, changed, seen }
  const notified = new Set();

  const saves = () => Object.assign({}, ctx.state('saves', {}));
  function load(name) {
    const key = String(name || '').toLowerCase();
    if (!key || key === account) return;
    save();
    account = key;
    patches = Object.assign({}, saves()[key] || {});
    report();
  }
  function save() {
    if (!account) return;
    const all = saves();
    all[account] = patches;
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
      } else {
        prev.seen = now;
      }
    }
    if (changed) save();
    report();
  }

  function report() {
    const now = Date.now();
    const list = DATA.patches.map((p) => describe(p, patches[p.index] || {}, now));
    if (ctx.config('notify')) {
      for (const d of list) {
        const id = `${account}:${d.index}:${patches[d.index] && patches[d.index].changed}`;
        if (d.readyAt && d.readyAt <= now && d.status !== 'dead' && d.status !== 'diseased' && !notified.has(id)) {
          notified.add(id);
          if (ctx.notify) ctx.notify('Farming', `Your ${d.crop} in ${d.place} should be grown.`);
        }
      }
    }
    ctx.report({ account, patches: list, now });
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data && data.name) load(data.name);
        else if (type === 'farming-varps' && data && data.varps) onVarps(data.varps);
        else if (type === 'login-state' && !data) save();
      });
      timer = setInterval(report, 30000);
      report();
    },
    stop() {
      save();
      if (off) off();
      if (timer) clearInterval(timer);
      ctx.report(null);
    },
    configChanged: () => report(),
    gameReady: () => report(),
  };
};

module.exports.decodePatch = decodePatch;
module.exports.lastStage = lastStage;
module.exports.DATA = DATA;
module.exports.KINDS = KINDS;
