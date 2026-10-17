'use strict';
// Clue Scroll, sidebar side: notices which clue you're carrying (from the inventory data),
// works out the answer from clues.json and sends it to the page side (page.js), which draws
// it; also puts the spot on the world map.
const fs = require('fs');
const path = require('path');

const CLUES = JSON.parse(fs.readFileSync(path.join(__dirname, 'clues.json'), 'utf8'));
const PUZZLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'puzzle.json'), 'utf8'));
const LABELS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'assets', 'worldmap', 'labels.json'), 'utf8'));
const FLOORS = ['', 'upstairs', '2 floors up', '3 floors up'];

/** "near Lumbridge": the closest place name on the world map. */
function near(x, z) {
  let best = null;
  let dist = 1e9;
  for (const l of LABELS) {
    const d = Math.hypot(l.x - x, l.z - z) / (l.size === 2 ? 2.5 : 1); // big areas count from further
    if (d < dist) {
      dist = d;
      best = l;
    }
  }
  return best && dist < 120 ? best.text.join(' ') : null;
}

/** "upstairs near Lumbridge" - where, in words (no tile numbers). */
function where(x, z, level) {
  const n = near(x, z);
  const floor = FLOORS[level] ? FLOORS[level].trim().replace(/[()]/g, '') : '';
  return [floor, n ? `near ${n}` : ''].filter(Boolean).join(' ');
}

/** Everything the page side shows for one clue. */
function solve(id, inv = []) {
  const c = CLUES[id];
  if (!c) return null;
  const tier = c.tier[0].toUpperCase() + c.tier.slice(1);
  const out = { id: Number(id), title: `Clue scroll (${c.tier})`, lines: [], tiles: [], npcIds: [], npc: null };
  // The scroll's own text already says where to go for riddles, searches and NPCs, so
  // those only get the highlight, arrow and map marker; map and coordinate clues (whose text
  // doesn't name a place) get the place in words.
  const spot = (verb, say) => {
    if (c.x === undefined) return;
    if (say) {
      const w = where(c.x, c.z, c.level || 0);
      out.lines.push(w ? `${verb} ${w}` : `${verb} at the marked spot`);
    }
    out.tiles.push({ x: c.x, z: c.z, level: c.level || 0, label: verb === 'Dig' ? 'Dig here' : 'Search here' });
  };
  switch (c.kind) {
    case 'coordinate':
      out.title = `Coordinate clue (${c.tier})`;
      out.lines.push(c.text);
      spot('Dig', true);
      break;
    case 'map':
      out.title = `Map clue (${c.tier})`;
      spot(c.action === 'search' ? 'Search' : 'Dig', true);
      break;
    case 'dig':
      out.lines.push(c.text);
      spot('Dig', false);
      break;
    case 'search':
      out.lines.push(c.text);
      if (c.key && !inv.some((it) => it && it.id === c.key.id)) {
        // locked: an NPC drops the key while you carry this clue
        out.lines.push(`Kill ${c.key.from} for the key`);
        if (c.object) out.lines.push(`then search the ${c.object.toLowerCase()}`);
        out.npcIds = c.key.npcIds || [];
        out.npc = c.key.from.replace(/^any /, '');
      } else if (c.object) {
        out.lines.push(c.key ? `You have the key: search the ${c.object.toLowerCase()}` : `Search the ${c.object.toLowerCase()}`);
      }
      spot('Search', false);
      break;
    case 'npc': {
      out.lines.push(c.text);
      // Only when the scroll doesn't name them already ("Speak to Hans ...").
      if (!String(c.text || '').toLowerCase().includes(String(c.npc).toLowerCase())) out.lines.push(`Talk to ${c.npc}`);
      out.npcIds = c.npcIds || [];
      out.npc = c.npc;
      for (const sp of (c.spawns || []).slice(0, 6)) out.tiles.push({ x: sp.x, z: sp.z, level: sp.level, label: c.npc, mapOnly: true });
      break;
    }
    case 'challenge':
      out.title = `Challenge scroll (${c.tier})`;
      out.lines.push(c.text, `Answer: ${c.answer}`);
      break;
    case 'puzzle':
      out.title = `Puzzle box (${c.tier})`;
      out.lines.push('Solve the puzzle box, then hand it back.');
      if (c.npc) {
        out.lines.push(`Give it to ${c.npc}`);
        out.npcIds = c.npcIds || [];
        out.npc = c.npc;
      }
      break;
    default:
      out.lines.push(c.text || 'Unknown clue');
  }
  if (c.guardian) out.lines.push(`A ${c.guardian} will attack when you dig: kill it, then dig again.`);
  out.tier = tier;
  return out;
}

module.exports = function clueScroll(ctx) {
  let off = null;
  let current = null;
  let lastState = null;

  function send() {
    ctx.sendToGame({
      type: 'plugin-config',
      id: 'cluescroll',
      enabled: true,
      config: {
        clue: current,
        puzzle: PUZZLE,
        solvePuzzle: ctx.config('solvePuzzle'),
        displayHintArrows: ctx.config('displayHintArrows'),
        highlight: ctx.config('highlight'),
        highlightColor: ctx.config('highlightColor'),
      },
    });
    const markers = current && ctx.config('showOnMap') ? current.tiles.map((t) => ({ x: t.x, z: t.z, level: t.level, label: t.label })) : [];
    window.dispatchEvent(new CustomEvent('lostlite-map-markers', { detail: { source: 'cluescroll', markers } }));
  }

  function fromItems(items) {
    const inv = (items && items.inventory) || [];
    // A challenge scroll (or puzzle box) is the step you're on, so it comes before the clue
    // it was handed out for (you carry both: the anagram and the Zoo keeper's question)
    const rank = (id) => ({ challenge: 0, puzzle: 1 }[CLUES[id].kind] ?? 2);
    let found = null;
    for (const it of inv) {
      if (it && CLUES[it.id] && (found === null || rank(it.id) < rank(found))) found = it.id;
    }
    const key = found !== null && CLUES[found].key && inv.some((it) => it && it.id === CLUES[found].key.id);
    const state = found === null ? null : `${found}:${key ? 1 : 0}`;
    if (state === lastState) return;
    lastState = state;
    current = found === null ? null : solve(found, inv);
    if (current) ctx.log(`Clue: ${CLUES[found].name}`);
    send();
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'items') fromItems(data);
        else if (type === 'login-state' && !data) {
          current = null;
          lastState = null;
          send();
        }
      });
      send();
    },
    stop() {
      if (off) off();
      current = null;
      window.dispatchEvent(new CustomEvent('lostlite-map-markers', { detail: { source: 'cluescroll', markers: [] } }));
      ctx.sendToGame({ type: 'plugin-config', id: 'cluescroll', enabled: false });
    },
    configChanged: () => send(),
    gameReady: () => send(),
  };
};

module.exports.solve = solve;
module.exports.CLUES = CLUES;
