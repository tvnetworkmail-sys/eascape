// HiScore, page side: RuneLite's "Lookup" menu option (HiscorePlugin). On a player's right-click
// menu (Player option) it goes under their options; on a chat name and a friend it goes under
// "Add ignore" and "Message" (Menu option). Clicking it looks the name up in the HiScore panel.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  const LOOKUP = 'Lookup';
  let cfg = {};

  function lookup(name) {
    window.postMessage({ __lostlite: true, type: 'hiscore-lookup', data: name }, '*');
  }

  /** the name in "Trade with @whi@Zezima@gre@(level-126)" / "Add ignore @whi@Zezima" */
  function nameIn(text) {
    const at = String(text).indexOf('@whi@');
    if (at < 0) return '';
    return String(text).slice(at + 5).replace(/@[a-z0-9~]{3}@.*$/i, '').replace(/\(level-\d+\).*$/, '').trim();
  }

  function menuAfter(c, arrays, rt) {
    const a = ll.fields && ll.fields.actions;
    if (!a || !a.player) return;
    const f = rt.fields;
    const [opt, act, pa] = arrays;
    const players = new Set(a.player);
    const lowest = new Map(); // player index -> lowest menu row of their options
    const names = []; // [row, name] for chat names and friends
    for (let i = (c[f.menuCount] | 0) - 1; i >= 0; i--) {
      if (act[i] === rt.CUSTOM_ACTION) continue;
      const action = act[i] >= 2000 ? act[i] - 2000 : act[i];
      if (cfg.playerOption !== false && players.has(action)) {
        lowest.set(pa[i], i);
      } else if (cfg.menuOption !== false && (action === a.chatIgnore || action === a.friendMessage)) {
        names.push([i, nameIn(opt[i])]);
      }
    }
    // from the highest row down, so inserting doesn't move the rows still to do
    const todo = [];
    for (const [index, row] of lowest) {
      const p = c[f.players] && c[f.players][index];
      const name = p && typeof p[f.playerName] === 'string' ? p[f.playerName] : nameIn(opt[row]);
      if (name) todo.push([row, name]);
    }
    for (const [row, name] of names) if (name) todo.push([row, name]);
    todo.sort((x, y) => y[0] - x[0]);
    for (const [row, name] of todo) rt.insertMenuEntry(c, row, `${LOOKUP} @whi@${name}`, () => lookup(name));
  }

  ll.registerPlugin('hiscore', {
    configure(config) {
      cfg = config || {};
    },
    menuAfter,
  });
})();
