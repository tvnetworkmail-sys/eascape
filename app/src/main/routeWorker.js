'use strict';
// Finds the Quest Helper's walking routes off the game's thread: a long route across the
// map can take a second or so to work out. Messages: { id, from, to, near } -> { id, tiles, pts }.
const { parentPort } = require('worker_threads');
const { load, smooth } = require('../plugins/questhelper/route');

let world = null;
parentPort.on('message', (m) => {
  try {
    if (!world) world = load();
    // Close by: a near-shortest route. Far away: a search that heads for the goal harder.
    const tiles = world.find(m.from, m.to, { near: m.near, maxNodes: 60000, weight: 1.2 })
      || world.find(m.from, m.to, { near: m.near, maxNodes: 3000000, weight: 2 });
    // corner points for drawing, each with its place in the full route (i)
    const pts = tiles ? smooth(world, tiles).map((p) => ({ ...p, i: tiles.indexOf(p) })) : [];
    parentPort.postMessage({ id: m.id, tiles: tiles || [], pts });
  } catch (e) {
    parentPort.postMessage({ id: m.id, tiles: [], pts: [], error: e.message });
  }
});
