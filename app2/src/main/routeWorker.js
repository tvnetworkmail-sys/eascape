'use strict';
// Finds the Quest Helper's walking routes off the game's thread: a long route across the
// map can take a second or so to work out. Messages: { id, from, to, near, allow } -> { id, tiles, pts }.
const { parentPort } = require('worker_threads');
const { load, smooth } = require('../plugins/questhelper/route');

let world = null;
parentPort.on('message', (m) => {
  try {
    if (!world) world = load();
    // Close by: a near-shortest route. Far away: a search that heads for the goal harder, and
    // if that gets lost in a dead end (a goal behind a long detour, such as Mort Myre's Grotto
    // from Falador by way of Paterdomus), a plain shortest-route search.
    // With the fairy rings (allow) the search can look much further, so if that finds nothing,
    // the route on foot. (tools/routes/check.js searches the same way.)
    const allow = Array.isArray(m.allow) ? m.allow.filter((a) => typeof a === 'string') : [];
    const vars = m.vars && typeof m.vars === 'object' ? m.vars : null;
    const have = m.have && typeof m.have === 'object' ? m.have : null;
    const search = (with_) => world.find(m.from, m.to, { near: m.near, maxNodes: 60000, weight: 1.2, allow: with_, vars, have })
      || world.find(m.from, m.to, { near: m.near, maxNodes: 3000000, weight: 2, allow: with_, vars, have })
      || world.find(m.from, m.to, { near: m.near, maxNodes: 1000000, weight: 1, allow: with_, vars, have });
    const tiles = search(allow) || (allow.length ? search([]) : null);
    // corner points for drawing, each with its place in the full route (i)
    const pts = tiles ? smooth(world, tiles).map((p) => ({ ...p, i: tiles.indexOf(p) })) : [];
    parentPort.postMessage({ id: m.id, tiles: tiles || [], pts });
  } catch (e) {
    parentPort.postMessage({ id: m.id, tiles: [], pts: [], error: e.message });
  }
});
