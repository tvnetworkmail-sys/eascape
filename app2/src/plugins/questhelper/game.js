'use strict';
// Quest Helper, game side: runs the progress engine on what the page reports, picks the
// current step, finds the walking route to it, and keeps the sidebar panel up to date.
// 2007RS: every quest is followed by its app guide (guides.json). Each quest's stage comes live
// from the server (::appquests, from EASCape: page.js asks for each guide's variables and reads
// them), so the step is always right; without them (an older server) it is pieced together from
// the quest list, the journal and conversations as before.
// 2007RS: guides for quests not in the game yet (notInGame, from EASCape) are listed to read,
// with no current step, highlights or route.
const descriptor = require('./descriptor');
const { QuestEngine } = require('./engine');
const progress = require('./progress.json');
const guides = require('./guides.json');

/** The varp ids to ask the server for: each guide's quest variable and the other variables its
 * rules read (guides.json live / vars, { id, lo, hi }), each id once. */
// 2007RS: and the variables the route links' quest requirements read (requires.json), so a route only
// takes a door or shortcut the player can use
const requires = require('./requires.json');
const routeTerms = requires.flatMap((r) => r.req.flat()).map((t) => t.not || t);
const routeIds = [...new Set(routeTerms.filter((t) => t.id !== undefined).map((t) => t.id))].sort((a, b) => a - b);
// ...and the levels and items some need (stat:, inv:/worn:/has:): sent with each route search
const routeStats = [...new Set(routeTerms.filter((t) => t.stat).map((t) => t.stat))];
const routeObjs = [...new Set(routeTerms.filter((t) => t.objs).flatMap((t) => t.objs))];
// (the most of an item any link asks for: counts are capped there, so a route isn't searched again
// for every coin picked up)
const routeObjMax = {};
for (const t of routeTerms) if (t.objs) for (const id of t.objs) routeObjMax[id] = Math.max(routeObjMax[id] || 1, t.n || 1);
const liveIds = [...new Set(Object.values(guides).filter((g) => !g.notInGame).flatMap((g) => [g.live, ...Object.values(g.vars || {})]).filter(Boolean).map((v) => v.id).concat(routeIds))].sort((a, b) => a - b);

module.exports = function questHelper(ctx) {
  const engine = new QuestEngine({ progress, guides });
  let unlocks = []; // ways across the routes may use ("fairyrings"), from the page
  let liveSynced = false; // the server's quest values have arrived since logging in
  let off = null;
  let account = null;
  let pos = null;
  const have = { inv: {}, worn: {}, pos: null, npcs: new Set() };
  let stats = null; // { skill: current level } (the runtime's stats), for the route links that need a level
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
    liveSynced = false;
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
    // (each quest's stage before this input: the quest list's colour can move a quest a moment
    // before its live value arrives, in the same input, and that still counts as the server's move)
    const before = d.varps ? Object.fromEntries(Object.keys(guides).map((k) => [k, engine.state.quests[k] ? engine.state.quests[k].stage : 0])) : null;
    let moved = [];
    if (d.list) moved = moved.concat(engine.questList(d.list));
    if (d.journal && d.journal.lines && d.journal.lines.length) {
      const r = engine.journal(d.journal.lines, have.inv);
      if (r) moved.push(r.quest);
    }
    if (d.dialogue) moved = moved.concat(engine.dialogue(d.dialogue));
    for (const m of d.messages || []) moved = moved.concat(engine.message(m));
    // the quest variables the server sends live (last, so they win; EASCape). The first values
    // after logging in aren't moves you made: they don't auto start anything.
    let liveMoved = [];
    if (d.varps) {
      moved = moved.concat(engine.live(d.varps));
      liveMoved = Object.keys(guides).filter((k) => engine.state.quests[k] && engine.state.quests[k].live && engine.state.quests[k].stage !== before[k]);
      if (!liveSynced) {
        liveSynced = true;
        liveMoved = [];
      }
    }
    have.npcs = new Set(d.npcs || []);
    if (Array.isArray(d.unlocks)) unlocks = d.unlocks;
    if (moved.length) {
      markDirty();
      // Auto start: a guided quest that just moved on becomes the one we show (a quest the server
      // says just started or moved on counts too: the conversation that started it has often
      // closed before the server's new value arrives).
      if (ctx.config('autoStart')) {
        const k = moved.find((q) => guides[q] && engine.status(q) === 'started');
        const k2 = k && (d.dialogue || d.journal || liveMoved.includes(k)) ? k : liveMoved.find((q) => guides[q] && engine.status(q) === 'started');
        if (k2 && k2 !== selected()) select(k2);
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
    // (next to the NPC, or anywhere along a big object: its south-west corner is the step's place)
    const near = step.reach || (step.locAt ? Math.max(1, ...(step.locSize || [1, 1])) : step.npc ? 1 : 0);
    // (the route links' quest variables: a route found before one changed may use a link it can't now)
    const vars = engine.raw ? Object.fromEntries(routeIds.filter((id) => engine.raw[id] !== undefined).map((id) => [id, engine.raw[id] | 0])) : null;
    // (and the levels and items they need: only those, so a route isn't searched again for every item)
    const need = { stats: stats ? Object.fromEntries(routeStats.filter((k) => stats[k] !== undefined).map((k) => [k, stats[k]])) : null, inv: {}, worn: {} };
    for (const id of routeObjs) {
      if (have.inv[id]) need.inv[id] = Math.min(have.inv[id], routeObjMax[id]);
      if (have.worn[id]) need.worn[id] = true;
    }
    if (!account) need.inv = null;
    const key = `${step.at.join(',')}|${near}|${unlocks.join(',')}|${vars ? Object.values(vars).join(',') : ''}|${JSON.stringify(need)}`;
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
    ctx.invoke('route-find', { from, to: { x: step.at[0], z: step.at[1], level: step.at[2] }, near, allow: unlocks, vars, have: need }).then((r) => {
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
    const away = !!(key && guides[key].notInGame);
    current = key && account && !away ? engine.current(key, have) : null;
    const step = current && current.step ? current.step : null;
    const r = step ? routeFor(step) : null;
    const pts = remainingPts(r);
    const config = {
      listComs: Object.fromEntries(Object.entries(progress.quests).filter(([, q]) => q.com).map(([k, q]) => [k, q.com])),
      journal: progress.journal,
      // 2007RS: the same, as the 2007 client's component ids (app/tools/quests/com2007.py)
      listComs2007: Object.fromEntries(Object.entries(progress.quests).filter(([, q]) => q.com2007).map(([k, q]) => [k, q.com2007])),
      journal2007: progress.journal2007,
      live: liveIds,
      step: step ? { npc: step.npc, locAt: step.locAt, locSize: step.locSize, obj: step.obj, at: step.at, options: step.options, dig: step.dig } : null,
      route: ctx.config('showRoute') ? pts : null,
      showRoute: !!ctx.config('showRoute'),
      hintArrow: !!ctx.config('hintArrow'),
      highlight: !!ctx.config('highlight'),
      markOptions: !!ctx.config('markOptions'),
      colour: ctx.config('colour'),
      devMarkDone: !!ctx.config('devMarkDone'), // DEV / TESTING ONLY (remove when testing is done)
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
    const quests = Object.entries(progress.quests).map(([k, q]) => ({ key: k, name: q.name, status: guides[k] && guides[k].notInGame ? 'not in game' : engine.status(k), guide: !!guides[k] }));
    for (const [k, g] of Object.entries(guides)) if (g.notInGame && !progress.quests[k]) quests.push({ key: k, name: g.name, status: 'not in game', guide: true, away: true });
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
        status: g.notInGame ? 'not in game' : engine.status(key),
        notInGame: !!g.notInGame,
        stage: q.stage,
        sure: !!q.sure,
        live: !!q.live,
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
    if (!key || guides[key].notInGame) return;
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
        else if (type === 'stats' && Array.isArray(data)) {
          stats = Object.fromEntries(data.map((st) => [st.skill, st.boosted || st.level]));
          update(true);
        }
        else if (type === 'player') onPlayer(data);
        else if (type === 'bank-items') {
          engine.bank(data);
          markDirty();
          update();
        } else if (type === 'login-state' && !data) {
          flush();
          account = null;
          liveSynced = false;
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
