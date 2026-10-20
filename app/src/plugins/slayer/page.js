// Slayer, page side: RuneLite's SlayerPlugin, SlayerOverlay and TargetWeaknessOverlay (BSD
// 2-Clause; see descriptor.js).
//   Task infobox:  the task's picture and how many are left; hover for the task. It shows
//                  when the count changes (and when you log in) and goes after "Infobox
//                  expiry" minutes with no kills, like RuneLite's.
//   Count on items: the number left on the enchanted gem.
//   Highlights:    every monster that counts for the task (hull and/or tile).
//   Weakness:      the finishing item over a gargoyle, rockslug, desert lizard or zygomite
//                  once it's low enough for it (this game shows the real hitpoints).
//   !task:         say it in public chat and the line shows your task.
(() => {
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  const VARP_COUNT = 394; // slayer_count (content/pack/varp.pack)
  const VARP_TARGET = 395; // slayer_target
  const GEM = 4155; // slayer_gem, the enchanted gem

  let cfg = {};
  let tasks = {};
  let target = -1;
  let count = -1;
  let initial = 0;
  let activity = 0; // when the infobox was last (re)started
  let loggedIn = false;
  let names = new Set();

  const rgb = (hex) => {
    const n = parseInt(String(hex || '#ff0000').replace('#', '').slice(-6), 16);
    return Number.isFinite(n) ? n : 0xff0000;
  };
  const task = () => (count > 0 ? tasks[target] || null : null);

  /** Reads the task from the varps the server sends; true when it changed. */
  function read() {
    const c = ll.client;
    const varps = c && ll.fields.varps ? c[ll.fields.varps] : null;
    if (!varps || !ll.loggedIn) {
      loggedIn = false;
      return;
    }
    const t = varps[VARP_TARGET] | 0;
    const n = varps[VARP_COUNT] | 0;
    if (!loggedIn) {
      loggedIn = true;
      target = -2; // the first reading after logging in starts the box, like checking the gem
    }
    if (t !== target) {
      target = t;
      count = n;
      initial = n;
      activity = Date.now();
      const tk = tasks[t];
      names = new Set(tk ? tk.npcs.map((x) => x.toLowerCase()) : []);
    } else if (n !== count) {
      count = n;
      if (n > initial) initial = n;
      activity = Date.now();
    }
  }

  function boxes() {
    read();
    const tk = task();
    if (!tk || cfg.infobox === false) return [];
    const timeout = Number(cfg.statTimeout);
    if (timeout > 0 && Date.now() - activity >= timeout * 60000) return [];
    const img = (ll.itemIcon && (ll.itemIcon(tk.icon) || ll.itemIcon(GEM))) || null;
    let tip = tk.name;
    if (initial > 0) tip += `\nStart: ${initial}`;
    return [{ name: 'Slayer task', priority: 0, image: img, text: String(count), colour: 0xffffff, tooltip: tip }];
  }

  function itemText(obj) {
    if (obj !== GEM || cfg.itemoverlay === false) return null;
    read();
    return count > 0 ? { text: String(count), colour: 0xffffff } : null;
  }

  function frame(g) {
    read();
    const tk = task();
    if (!tk) return;
    const colour = rgb(cfg.targetColor);
    const style = { fill: colour, fillAlpha: 21, width: 2 };
    const weak = cfg.weaknessPrompt !== false && tk.weakness ? tk.weakness : null;
    const weakImg = weak && ll.itemIcon ? ll.itemIcon(weak.item) : null;
    for (const npc of g.npcs()) {
      if (!npc.name || !names.has(npc.name.toLowerCase())) continue;
      if (cfg.highlightHull) {
        const hull = g.hull(npc.typecode);
        if (hull) g.polygon(hull, colour, style);
      }
      if (cfg.highlightTile) {
        const poly = g.areaPoly(npc.x, npc.z, npc.size);
        if (poly) g.polygon(poly, colour, style);
      }
      // RuneLite's TargetWeaknessOverlay: the item above the monster at its logical height + 40
      if (weakImg && npc.totalHealth > 0 && npc.health >= 0 && npc.health <= weak.hp) {
        const p = g.project(npc.x, npc.z, npc.height + 40);
        if (p) g.image(weakImg, p.x - (weakImg.w >> 1), p.y - (weakImg.h >> 1));
      }
    }
  }

  /** "!task" said in public chat by you shows your task instead (RuneLite's taskLookup). */
  function chat(msg) {
    if (cfg.taskCommand === false || (msg.kind !== 'public') || String(msg.text).trim().toLowerCase() !== '!task') return;
    const c = ll.client;
    const me = c && ll.fields.localPlayer ? c[ll.fields.localPlayer] : null;
    const myName = me && ll.fields.playerName ? String(me[ll.fields.playerName] || '') : '';
    if (!myName || String(msg.name || '').toLowerCase() !== myName.toLowerCase()) return;
    read();
    const tk = task();
    if (!tk) return;
    const killed = initial - count;
    msg.replace = `Slayer Task: ${tk.name}: ${killed > 0 ? `${killed}/${initial} killed` : `${count} left`}`;
  }

  if (ll.addInfoBoxes) ll.addInfoBoxes('slayer', boxes);
  if (ll.addItemText) ll.addItemText('slayer', itemText);

  ll.registerPlugin('slayer', {
    configure(c) {
      cfg = c || {};
      if (c && c.tasks) tasks = c.tasks;
      target = -2; // look again with the new table
    },
    frame,
    chat,
    stop() {
      names = new Set();
    },
  });
})();
