'use strict';
// Quest Helper, game side: runs the progress engine on what the page reports, picks the
// current step, finds the walking route to it, and keeps the sidebar panel up to date.
const descriptor = require('./descriptor');
const { QuestEngine } = require('./engine');
const progress = require('./progress.json');
const guides = require('./guides.json');

module.exports = function questHelper(ctx) {
  const engine = new QuestEngine({ progress, guides });
  let off = null;
  let account = null;
  let pos = null;
  const have = { inv: {}, worn: {}, pos: null, npcs: new Set() };
  let route = null; // { key, tiles }
  let routeKey = '';
  let lastRouteAt = 0;
  let dirty = false;
  let saveTimer = null;
  let lastCommand = null;
  let current = null;

  // ---- saving: per account, in this profile's settings

  function allSaved() {
    const v = ctx.state('progress', {});
    return v && typeof v === 'object' ? v : {};
  }

  function useAccount(name) {
    const key = String(name || '').toLowerCase();
    if (!key || key === account) return;
    flush();
    account = key;
    engine.load(allSaved()[account]);
    route = null;
    routeKey = '';
    update();
  }

  function markDirty() {
    dirty = true;
    if (!saveTimer) saveTimer = setTimeout(flush, 2000);
  }

  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty || !account) return;
    dirty = false;
    const all = allSaved();
    all[account] = engine.save();
    ctx.setState('progress', all);
  }

  // ---- what's selected

  function selected() {
    const s = ctx.config('selected');
    return typeof s === 'string' && guides[s] ? s : null;
  }

  function select(key) {
    ctx.setState('selected', key || '');
  }

  // ---- inputs

  function onInput(d) {
    if (!d || !account) return;
    let moved = [];
    if (d.list) moved = moved.concat(engine.questList(d.list));
    if (d.journal && d.journal.lines && d.journal.lines.length) {
      const r = engine.journal(d.journal.lines);
      if (r) moved.push(r.quest);
    }
    if (d.dialogue) moved = moved.concat(engine.dialogue(d.dialogue));
    for (const m of d.messages || []) moved = moved.concat(engine.message(m));
    have.npcs = new Set(d.npcs || []);
    if (moved.length) {
      markDirty();
      // Auto start: a guided quest that just moved on becomes the one we show.
      if (ctx.config('autoStart')) {
        const k = moved.find((q) => guides[q] && engine.status(q) === 'started');
        if (k && k !== selected() && (d.dialogue || d.journal)) select(k);
      }
    }
    update();
  }

  function onItems(items) {
    have.inv = {};
    have.worn = {};
    for (const it of (items && items.inventory) || []) if (it && it.id >= 0) have.inv[it.id] = (have.inv[it.id] || 0) + (it.quantity || 1);
    for (const it of Object.values((items && items.equipment) || {})) if (it && it.id >= 0) have.worn[it.id] = true;
    update();
  }

  function onPlayer(p) {
    if (!p) return;
    if (p.name) useAccount(p.name);
    pos = { x: p.x, z: p.y, level: p.plane };
    have.pos = pos;
    update(true);
  }

  // ---- routes

  let routeBusy = false;

  /** The route to the step (worked out in the background; null until it arrives). */
  function routeFor(step) {
    if (!ctx.config('showRoute') && !ctx.config('showMapRoute')) return null;
    if (!step || !step.at || !pos) return null;
    const near = step.npc ? 1 : step.locAt ? 1 : 0;
    const key = `${step.at.join(',')}|${near}`;
    const now = Date.now();
    const same = route && route.key === key;
    const onRoute = same && route.tiles.some((t) => t.level === pos.level && Math.max(Math.abs(t.x - pos.x), Math.abs(t.z - pos.z)) <= 3);
    if (onRoute) return route;
    // (a failed search costs most: don't repeat it for a while)
    if (same && now - lastRouteAt < (route.tiles.length ? 1500 : 10000)) return route;
    if (routeBusy) return same ? route : null;
    routeBusy = true;
    lastRouteAt = now;
    const from = { ...pos };
    ctx.invoke('route-find', { from, to: { x: step.at[0], z: step.at[1], level: step.at[2] }, near }).then((r) => {
      routeBusy = false;
      route = { key, tiles: (r && r.tiles) || [], pts: (r && r.pts) || [] };
      lastRouteAt = Date.now();
      update();
    }, (e) => {
      routeBusy = false;
      ctx.log(`route: ${e && e.message}`);
    });
    return same ? route : null;
  }

  /** The route's corner points from where you are now (drops the part already walked). */
  function remainingPts(r) {
    if (!r || !r.pts || !r.pts.length || !pos) return [];
    let near = -1;
    let bd = Infinity;
    r.tiles.forEach((t, i) => {
      if (t.level !== pos.level) return;
      const d = Math.max(Math.abs(t.x - pos.x), Math.abs(t.z - pos.z));
      if (d < bd) {
        bd = d;
        near = i;
      }
    });
    if (near < 0) return r.pts;
    const rest = r.pts.filter((p) => p.i > near);
    return [r.tiles[near], ...rest];
  }

  /** The route from where you are now (drops the part already walked). */
  function remaining(r) {
    if (!r || !r.tiles.length || !pos) return [];
    let best = 0;
    let bd = Infinity;
    r.tiles.forEach((t, i) => {
      if (t.level !== pos.level) return;
      const d = Math.max(Math.abs(t.x - pos.x), Math.abs(t.z - pos.z));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return r.tiles.slice(best);
  }

  // ---- output

  let lastSent = '';
  let lastPanel = '';
  let pending = false;

  function update(soon) {
    if (soon) {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        update();
      }, 200);
      return;
    }
    const key = selected();
    current = key && account ? engine.current(key, have) : null;
    const step = current && current.step ? current.step : null;
    const r = step ? routeFor(step) : null;
    const pts = remainingPts(r);
    const config = {
      listComs: Object.fromEntries(Object.entries(progress.quests).filter(([, q]) => q.com).map(([k, q]) => [k, q.com])),
      journal: progress.journal,
      step: step ? { npc: step.npc, locAt: step.locAt, locSize: step.locSize, obj: step.obj, at: step.at, options: step.options, dig: step.dig } : null,
      route: ctx.config('showRoute') ? pts : null,
      showRoute: !!ctx.config('showRoute'),
      hintArrow: !!ctx.config('hintArrow'),
      highlight: !!ctx.config('highlight'),
      markOptions: !!ctx.config('markOptions'),
      colour: ctx.config('colour'),
    };
    const s = JSON.stringify(config);
    if (s !== lastSent) {
      lastSent = s;
      ctx.sendToGame({ type: 'plugin-config', id: 'questhelper', enabled: true, config });
      const markers = step && step.at && ctx.config('showMapRoute') ? [{ x: step.at[0], z: step.at[1], level: step.at[2], label: guides[key].name }] : [];
      const lines = ctx.config('showMapRoute') && pts.length > 1 ? [pts] : [];
      window.dispatchEvent(new CustomEvent('lostlite-map-markers', { detail: { source: 'questhelper', markers, lines } }));
    }
    report(key);
  }

  function report(key) {
    const quests = Object.entries(progress.quests).map(([k, q]) => ({ key: k, name: q.name, status: engine.status(k), guide: !!guides[k] }));
    let view = null;
    if (key) {
      const g = guides[key];
      const q = engine.quest(key);
      const order = [];
      for (const sec of g.sections) for (const id of sec.steps) order.push(id);
      const at = current && current.id ? order.indexOf(current.id) : -1;
      view = {
        key,
        name: g.name,
        difficulty: g.difficulty,
        start: g.start,
        status: engine.status(key),
        stage: q.stage,
        sure: !!q.sure,
        pinned: !!(current && current.pinned),
        unknown: !!(current && current.unknown),
        waiting: !!(current && current.waiting),
        done: !!(current && current.done),
        current: current && current.id,
        text: current && current.step ? current.step.text : null,
        stepItems: current && current.step ? engine.itemList(key, current.step.items, have) : [],
        options: current && current.step ? current.step.options : [],
        sections: g.sections.map((sec) => ({
          title: sec.title,
          steps: sec.steps.map((id) => ({ id, text: g.steps[id].text, current: id === (current && current.id), done: at >= 0 && order.indexOf(id) < at })),
        })),
        required: engine.itemList(key, g.required, have),
        recommended: engine.itemList(key, g.recommended, have),
        skills: g.skills,
        rewards: g.rewards,
        bankKnown: !!engine.state.bank,
        noRoute: !!(current && current.step && current.step.at && route && route.tiles && !route.tiles.length),
      };
    }
    const st = { account, selected: key, quests, view, loggedIn: !!account };
    const s = JSON.stringify(st);
    if (s !== lastPanel) {
      lastPanel = s;
      ctx.report(st);
    }
  }

  function onCommand() {
    const c = ctx.config('command');
    if (!c || typeof c !== 'object' || c.t === lastCommand) return;
    lastCommand = c.t;
    const key = selected();
    if (!key) return;
    if (c.action === 'pin') engine.pin(key, c.step);
    else if (c.action === 'unpin') engine.pin(key, null);
    else if (c.action === 'reset') engine.setStage(key, 0);
    markDirty();
    update();
  }

  return {
    start() {
      lastCommand = (ctx.config('command') || {}).t;
      off = ctx.onRuntime((type, data) => {
        if (type === 'questhelper-input') onInput(data);
        else if (type === 'items') onItems(data);
        else if (type === 'player') onPlayer(data);
        else if (type === 'bank-items') {
          engine.bank(data);
          markDirty();
          update();
        } else if (type === 'login-state' && !data) {
          flush();
          account = null;
          update();
        }
      });
      update();
    },
    stop() {
      if (off) off();
      flush();
      window.dispatchEvent(new CustomEvent('lostlite-map-markers', { detail: { source: 'questhelper', markers: [], lines: [] } }));
      ctx.sendToGame({ type: 'plugin-config', id: 'questhelper', enabled: false });
      ctx.report(null);
    },
    configChanged(key) {
      if (key === 'command') onCommand();
      else if (key !== 'progress') {
        route = null;
        update();
      }
    },
    gameReady: () => {
      lastSent = '';
      update();
    },
  };
};

module.exports.descriptor = descriptor;
