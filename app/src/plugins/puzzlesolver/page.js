// Puzzle Solver, page side (ours, after RuneLite's Puzzle Solver): while Monkey Madness's
// reinitialisation panel is open (inter_214, its 5x5 grid com_3 = 11130), reads its pieces, solves
// it with the Clue Scroll plugin's sliding puzzle solver (cluescroll/page.js, ll.__puzzleSolve,
// which also does the puzzle boxes) and marks the next piece to click with a box and how many
// clicks are left. It solves again whenever the pieces change, so a wrong click just gets a new
// solution. The finished picture is the pieces in the order of their item numbers
// (content/pack/obj.pack: reinitialisation_01..24), the gap last.
(() => {
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;
  const PUZZLES = [{ root: 11126, grid: 11130 }]; // Monkey Madness (puzzle boxes: the Clue Scroll plugin)
  const GAP = 24;

  let cfg = {};
  let enabled = false;
  let lastKey = '';
  let solution = null;
  let mark = null; // { com, obj, left }

  const rgb = (hex) => {
    const n = parseInt(String(hex || '#00ff00').replace('#', '').slice(-6), 16);
    return Number.isFinite(n) ? n : 0x00ff00;
  };

  function read() {
    mark = null;
    const c = ll.client;
    const f = ll.fields;
    if (!enabled || !c || !ll.loggedIn || !f.mainModal || !f.invObj || !ll.api || !ll.api.ifList) return;
    const root = c[f.mainModal];
    const p = PUZZLES.find((q) => q.root === root);
    if (!p) return;
    const com = ll.api.ifList()[p.grid];
    const objs = com && com[f.invObj];
    if (!objs || objs.length < 25) return;
    const ids = [];
    for (let i = 0; i < 25; i++) ids.push((objs[i] | 0) - 1);
    const present = ids.filter((id) => id >= 0);
    if (present.length !== 24) return;
    const order = present.slice().sort((a, b) => a - b);
    const board = ids.map((id) => (id >= 0 ? order.indexOf(id) : GAP));
    const key = board.join(',');
    if (key !== lastKey) {
      lastKey = key;
      solution = typeof ll.__puzzleSolve === 'function' ? ll.__puzzleSolve(board) : null;
    }
    if (!solution || !solution.length) return;
    mark = { com: p.grid, obj: ids[solution[0]], left: solution.length };
  }

  function itemText(obj, com) {
    if (!mark || com !== mark.com || obj !== mark.obj) return null;
    const colour = rgb(cfg.colour);
    return { text: cfg.movesLeft === false ? '' : String(mark.left), colour, outline: colour };
  }

  if (ll.addItemText) ll.addItemText('puzzlesolver', itemText);

  ll.registerPlugin('puzzlesolver', {
    configure(c) {
      cfg = c || {};
      enabled = true;
    },
    frame: read,
    stop() {
      enabled = false;
      mark = null;
    },
  });
})();
