// Clue Scroll, page side: port of RuneLite's ClueScrollOverlay / ClueScrollWorldOverlay.
// Draws the answer panel in the top-left of the game view, outlines the NPC to talk to or
// the tile to dig or search, and points the game's hint arrow at it.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  const PANEL_W = 190;
  const PAD = 4;
  const LINE = 14;
  const TITLE = 0xff981f;
  const TEXT = 0xffffff;
  const BG = 0x463d32; // RuneLite's panel background (70, 61, 50) at alpha 156
  const BORDER = 0x382c22;

  let cfg = {};

  function rgb(hex) {
    const n = parseInt(String(hex || '#ff9040').replace('#', '').slice(-6), 16);
    return Number.isFinite(n) ? n : 0xff9040;
  }

  /** Word-wraps text to the panel width with the game's font. */
  function wrap(g, text, width) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && g.textWidth(next) > width) {
          out.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  function panel(g, clue) {
    const width = PANEL_W - PAD * 2;
    const rows = [{ text: clue.title, colour: TITLE }];
    for (const l of clue.lines) for (const w of wrap(g, l, width)) rows.push({ text: w, colour: TEXT });
    const h = rows.length * LINE + PAD * 2;
    const x = 4;
    const y = 4;
    g.fillRect(x, y, PANEL_W, h, BG, 156);
    g.rect(x, y, PANEL_W - 1, h - 1, BORDER, 200);
    rows.forEach((r, i) => g.text(r.text, x + PAD, y + PAD + (i + 1) * LINE - 3, r.colour));
  }

  function frame(g) {
    const clue = cfg.clue;
    if (!clue) {
      g.setHint(null);
      return;
    }
    panel(g, clue);
    const colour = rgb(cfg.highlightColor);
    let hint = null;
    let hintDist = 1e9;
    const me = g.player();
    // NPC to talk to
    if (clue.npcIds && clue.npcIds.length) {
      const ids = new Set(clue.npcIds);
      for (const npc of g.npcs()) {
        if (!ids.has(npc.id)) continue;
        if (cfg.highlight) {
          const hull = g.hull(npc.typecode);
          if (hull) g.polygon(hull, colour, { fillAlpha: 30, width: 2 });
          const p = g.project(npc.x, npc.z, npc.height + 40);
          if (p && npc.name) {
            const w = g.textWidth(npc.name);
            g.text(npc.name, p.x - (w >> 1), p.y, colour);
          }
        }
        const d = me ? Math.hypot(npc.x - me.x, npc.z - me.z) : 0;
        if (d < hintDist) {
          hintDist = d;
          hint = { npc: npc.index };
        }
      }
    }
    // Spot to dig or search (when it's on this floor and in the loaded area)
    for (const t of clue.tiles || []) {
      if (t.mapOnly || t.level !== g.level) continue;
      const sx = t.x - g.baseX;
      const sz = t.z - g.baseZ;
      if (sx < 0 || sz < 0 || sx > 103 || sz > 103) continue;
      if (cfg.highlight) {
        const poly = g.tilePoly(sx, sz);
        if (poly) g.polygon(poly, colour, { fillAlpha: 40, width: 2 });
        const p = g.project(sx * 128 + 64, sz * 128 + 64, 60);
        if (p) {
          const w = g.textWidth(t.label);
          g.text(t.label, p.x - (w >> 1), p.y, colour);
        }
      }
      if (!hint) hint = { x: t.x, z: t.z, height: 0 };
    }
    // Spot further away on this floor: point at it anyway; the arrow shows at the edge of
    // the loaded area once you're near.
    if (!hint) {
      const t = (clue.tiles || []).find((x) => !x.mapOnly && x.level === g.level);
      if (t) hint = { x: t.x, z: t.z, height: 0 };
    }
    g.setHint(cfg.displayHintArrows ? hint : null);
  }


  // ---------------------------------------------------------------- puzzle solver
  //
  // The 2004 puzzle boxes are 5 x 5 sliding puzzles (24 pieces, the gap ends bottom right).
  // Solved the classic way, one piece (or pair) at a time, each placement found by a
  // breadth-first search over just the pieces being placed and the gap, with the finished
  // pieces locked: rows 1-3 left to right (the last two of a row together), then the bottom
  // two rows column by column (each column's pair together), then the last 2 x 2 square.
  // Fast (a few milliseconds) and always finds a solution; not the shortest one.

  const N = 5;
  const CELLS = 25;
  const GAP = 24;

  function neighbours(i) {
    const out = [];
    const r = (i / N) | 0;
    const c = i % N;
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    return out;
  }
  const NB = Array.from({ length: CELLS }, (_, i) => neighbours(i));

  /** Moves the gap so `tiles` reach their own cells; returns the gap's path. */
  function place(board, tiles, locked) {
    const k = tiles.length;
    const pos = tiles.map((t) => board.indexOf(t));
    const gap = board.indexOf(GAP);
    const encode = (ps, g) => ps.reduce((a, p) => a * CELLS + p, g);
    const done = (ps) => ps.every((p, i) => p === tiles[i]);
    if (done(pos)) return [];
    const start = encode(pos, gap);
    const prev = new Map([[start, -1]]);
    const via = new Map();
    let queue = [[pos, gap]];
    let found = null;
    while (queue.length && found === null) {
      const next = [];
      for (const [ps, g] of queue) {
        for (const n of NB[g]) {
          if (locked[n]) continue;
          const np = ps.map((p) => (p === n ? g : p));
          const code = encode(np, n);
          if (prev.has(code)) continue;
          prev.set(code, encode(ps, g));
          via.set(code, n);
          if (done(np)) {
            found = code;
            break;
          }
          next.push([np, n]);
        }
        if (found !== null) break;
      }
      queue = next;
    }
    if (found === null) return null;
    const path = [];
    for (let code = found; code !== start; code = prev.get(code)) path.push(via.get(code));
    path.reverse();
    return path;
  }

  /** board: 25 cells, piece numbers 0-23 (where they belong) and 24 for the gap.
   *  Returns the cells to click, in order (each slides that piece into the gap). */
  function solvePuzzle(start) {
    const board = start.slice();
    const locked = new Array(CELLS).fill(false);
    const moves = [];
    const run = (tiles) => {
      const path = place(board, tiles, locked);
      if (path === null) return false;
      for (const cell of path) {
        const g = board.indexOf(GAP);
        board[g] = board[cell];
        board[cell] = GAP;
        moves.push(cell);
      }
      for (const t of tiles) locked[t] = true;
      return true;
    };
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) if (!run([r * N + c])) return null;
      if (!run([r * N + 3, r * N + 4])) return null;
    }
    for (let c = 0; c < 3; c++) if (!run([15 + c, 20 + c])) return null;
    if (!run([18, 19, 23])) return null;
    return moves;
  }

  let solved = { key: '', moves: null };

  function puzzleBoard(g) {
    const pz = cfg.puzzle;
    if (!pz || !pz.inv) return null;
    const c = g.client;
    const f = ll.fields;
    if (!f.mainModal || c[f.mainModal] !== pz.root) return null;
    const com = ll.bankCom(pz.inv);
    if (!com || !com[f.invObj]) return null;
    const objs = com[f.invObj];
    const board = [];
    let gaps = 0;
    for (let i = 0; i < CELLS; i++) {
      const raw = objs[i] | 0;
      if (raw <= 0) {
        board.push(GAP);
        gaps++;
        continue;
      }
      const n = pz.pieces[raw - 1];
      if (n === undefined) return null;
      board.push(n);
    }
    return gaps === 1 ? board : null;
  }

  // Where the puzzle's 5 x 5 grid is drawn (trail_puzzle: the inventory at 171, 54, 32 px
  // slots 5 px apart).
  const GRID = { x: 171, y: 54, step: 37, size: 32 };

  function cellBox(i) {
    return { x: GRID.x + (i % N) * GRID.step, y: GRID.y + ((i / N) | 0) * GRID.step };
  }

  function arrow(g, from, to, colour) {
    const a = cellBox(from);
    const b = cellBox(to);
    const x0 = a.x + 16;
    const y0 = a.y + 16;
    const x1 = b.x + 16;
    const y1 = b.y + 16;
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    const ex = x0 + dx * 14;
    const ey = y0 + dy * 14;
    for (const o of [-1, 0, 1]) g.line(x0 + (dy ? o : 0), y0 + (dx ? o : 0), ex + (dy ? o : 0), ey + (dx ? o : 0), colour);
    // head
    for (let k = 0; k < 6; k++) {
      g.line(ex - dx * k + (dy ? -k : 0), ey - dy * k + (dx ? -k : 0), ex - dx * k + (dy ? k : 0), ey - dy * k + (dx ? k : 0), colour);
    }
  }

  function frameUI(g) {
    if (!cfg.solvePuzzle) return;
    // Drawn above the interface, so not over a right-click menu.
    if (ll.fields.menuOpen && g.client[ll.fields.menuOpen]) return;
    const board = puzzleBoard(g);
    if (!board) return;
    const key = board.join(',');
    if (key !== solved.key) {
      // Following the plan? Then just drop the move that was made.
      if (solved.moves && solved.moves.length && solved.next === key) {
        solved.moves = solved.moves.slice(1);
      } else {
        solved.moves = solvePuzzle(board);
      }
      solved.key = key;
      solved.next = null;
      if (solved.moves && solved.moves.length) {
        const b = board.slice();
        const gap = b.indexOf(GAP);
        b[gap] = b[solved.moves[0]];
        b[solved.moves[0]] = GAP;
        solved.next = b.join(',');
      }
    }
    const moves = solved.moves;
    const status = !moves ? 'Puzzle solver: no solution found' : moves.length ? `Puzzle solver: ${moves.length} moves left` : 'Puzzle solved! Close it and hand it back.';
    const w = g.textWidth(status);
    g.fillRect(GRID.x - 2, GRID.y - 16, Math.max(w + 6, 5 * GRID.step), 14, BG, 180);
    g.text(status, GRID.x + 1, GRID.y - 5, moves && !moves.length ? 0x00ff00 : 0xffff00);
    if (!moves || !moves.length) return;
    // The next three clicks: 1 is outlined and has an arrow to where it slides.
    let gap = board.indexOf(GAP);
    for (let k = 0; k < Math.min(3, moves.length); k++) {
      const cell = moves[k];
      const b = cellBox(cell);
      const colour = k === 0 ? 0xffff00 : k === 1 ? 0xffa500 : 0xff6000;
      g.rect(b.x, b.y, GRID.size - 1, GRID.size - 1, colour);
      if (k === 0) {
        g.rect(b.x + 1, b.y + 1, GRID.size - 3, GRID.size - 3, colour);
        arrow(g, cell, gap, colour);
      } else {
        g.text(String(k + 1), b.x + 3, b.y + 13, colour);
      }
      gap = cell;
    }
  }

  ll.__puzzleSolve = solvePuzzle;

  ll.registerPlugin('cluescroll', {
    configure(config) {
      cfg = config || {};
    },
    frame,
    frameUI,
    stop() {
      cfg = {};
      if (ll.client) ll.setHint(ll.client, null);
    },
  });
})();
