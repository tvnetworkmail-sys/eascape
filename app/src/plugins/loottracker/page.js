// Loot Tracker, page side: RuneLite's LootTrackerPlugin (BSD 2-Clause, Copyright (c) 2018,
// Psikoi <https://github.com/psikoi> and RuneLite contributors) for the 2004 game, which
// doesn't send a loot event: a monster (or player) you were fighting dies, and what appears
// on the ground where it fell in the next few seconds is its loot. RuneLite's other sources,
// by its event names: Treasure Trails ("Clue Scroll (Medium)"), pickpocketing (the NPC's
// name), "Casket", "Bird nest", "Crystal Chest", "Rogues' Chest", "Fishing Trawler",
// "Barrows" and "Kingdom of Miscellania" (the last ones from their reward windows). Like
// RuneLite, skilling (logs, ore, fish) isn't loot. The items and the game's own item icons go
// to the sidebar side, which keeps the totals.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const WINDOW = 8000; // drops land when the death animation ends
  const QUIET = 1200; // a kill's loot is sent once nothing new has landed for this long

  let cfg = {};
  let target = null; // { index, name } of the NPC you're fighting
  const kills = []; // { index, name, x, y, level, size, time, before: Set, items: Map, lastNew }
  const dying = new Set();
  const iconPending = new Set();
  let lastScan = 0;
  // Treasure Trails: the tier of the clue (or casket) you last carried, and a reward to read
  const REWARD_INV = 6963; // trail_reward:inv (Lost City pack/interface.pack), 3 x 2
  let clueTier = null;
  let pendingClue = 0;
  let clueInvBefore = null;

  function countInv() {
    const inv = ll.readContainer ? ll.readContainer(ll.ITEMS.inventory, 28) : null;
    const m = new Map();
    for (const it of inv || []) if (it) m.set(it.id, (m.get(it.id) || 0) + (it.quantity || 1));
    return m;
  }

  const strip = (s) => String(s || '').replace(/@[a-z0-9~]{3}@/gi, '').trim();

  function groundAround(g, k) {
    const out = new Map(); // "x,y,id,n" -> { id, n, x, y }
    for (let x = k.x - 1; x <= k.x + k.size; x++) {
      for (let y = k.y - 1; y <= k.y + k.size; y++) {
        const sx = x - g.baseX;
        const sz = y - g.baseZ;
        if (sx < 0 || sz < 0 || sx > 103 || sz > 103) continue;
        const list = g.groundItems(sx, sz) || [];
        const count = new Map();
        for (const o of list) {
          const c = (count.get(o.id) || 0) + 1;
          count.set(o.id, c);
          out.set(`${x},${y},${o.id},${c}`, { id: o.id, n: o.count, x, y });
        }
      }
    }
    return out;
  }

  /** The item's icon as a PNG for the sidebar (the runtime's, drawn by the game itself), for
   *  a stack of n: coins, tokens and the like change picture as the stack grows. */
  const step = (n) => (ll.iconStep ? ll.iconStep(n) : 1);
  function iconUrl(id, n = 1) {
    const key = `${id}:${step(n)}`;
    const url = ll.itemIconUrl ? ll.itemIconUrl(id, n) : null;
    if (url) iconPending.delete(key);
    else iconPending.add(key);
    return url;
  }

  function send(k) {
    const items = [...k.items.values()].map((it) => {
      const info = ll.itemInfo(it.id);
      return { id: it.id, name: info.name, quantity: it.n, icon: iconUrl(it.id, it.n), step: step(it.n) };
    });
    if (!items.length) return;
    window.postMessage({ __lostlite: true, type: 'loot', data: { name: k.name, level: k.level, items } }, '*');
  }

  // ---- events RuneLite tracks besides kills (LootTrackerPlugin), those the 2004 game has or
  // the 2005/2006 game (rev 377) will have. Item and window ids are Jagex's and the same in
  // both revisions (Lost City pack/obj.pack, pack/interface.pack).
  const CASKET = 405; // RuneLite CASKET_EVENT "Casket" (big net fishing)
  const BIRD_NESTS = [5070, 5071, 5072, 5073, 5074, 7413]; // "Bird nest" (Search)
  const TRAWLER = 4564; // trawler_catch: "Fishing Trawler"
  const TRAIL = 6960; // trail_reward: the clue reward window (Barrows' too, as in RuneLite)
  const BARROWS_REGION = 14231; // the Barrows tunnels and chest
  const MISC_REGIONS = [10044, 10300]; // Miscellania and Etceteria (Advisor Ghrim's collection)
  // RuneLite's CHEST_EVENT_TYPES: the chests that are in this game
  const CHESTS = { 11573: 'Crystal Chest', 13117: "Rogues' Chest" };
  const CHEST_MESSAGES = [/^You find some treasure in the chest!/, /^You find (a|some)([a-z\s]*) inside\./];
  // windows that hold items but aren't loot: bank, trade, shops, duels, bank PIN, tool store,
  // ticket exchanges, Mage Training Arena shop, deposit box
  const NOT_LOOT = new Set([5292, 3323, 3443, 3824, 6412, 6575, 6733, 7424, 14924, 15614, 11367, 11942, 15944, 4465, 2156, 994]);
  const HISTORY = 650; // inventory "before" a message: as it was a tick ago

  const invHistory = []; // [{ t, inv: Map }]
  let lastInv = null;
  const pending = []; // inventory events: { name, base: Map, due, until, ignore: Set }
  let attempt = null; // pickpocketing: the inventory when you started { t, inv }
  let modalSeen = -1; // the main window already counted (until it closes)
  let modalOpened = 0;
  let region = -1;

  const titleCase = (s) => String(s).replace(/\b[a-z]/g, (m) => m.toUpperCase());

  function invAgo(ms) {
    const t = performance.now() - ms;
    let best = null;
    for (const h of invHistory) if (h.t <= t) best = h;
    return (best || invHistory[0] || { inv: countInv() }).inv;
  }

  function gains(before, after, ignore) {
    const items = new Map();
    for (const [id, n] of after) {
      const d = n - ((before && before.get(id)) || 0);
      if (d > 0 && !(ignore && ignore.has(id))) {
        items.set(`inv,${id}`, { id, n: d });
        iconUrl(id);
      }
    }
    return items;
  }

  /** What arrives in your pack over the next tick or two is this event's loot. */
  function invEvent(name, base, ignore) {
    const now = performance.now();
    pending.push({ name, base: base || invAgo(HISTORY), due: now + 1200, until: now + 3000, ignore });
  }

  function chat(msg) {
    if (!msg || msg.kind !== 'game') return;
    const text = strip(msg.text);
    // "Well done you've completed the Treasure Trail!": the reward window opens with the items
    if (/^Well done you've completed the Treasure Trail!/.test(text)) {
      pendingClue = performance.now();
      clueInvBefore = invAgo(HISTORY);
      return;
    }
    // Pickpocketing: "You attempt to pick the man's pocket." ... "You pick the man's pocket."
    if (/^You attempt to pick /.test(text)) {
      attempt = { t: performance.now(), inv: countInv() };
      return;
    }
    const pick = /^You pick (the )?(.+?)'s? pocket/.exec(text); // RuneLite's PICKPOCKET_REGEX
    if (pick) {
      const base = attempt && performance.now() - attempt.t < 5000 ? attempt.inv : invAgo(HISTORY);
      attempt = null;
      // its own entry, apart from the same NPC's kills (RuneLite keeps PICKPOCKET records apart)
      invEvent(`${titleCase(pick[2])} (pickpocket)`, base);
      return;
    }
    if (CHEST_MESSAGES.some((re) => re.test(text)) && CHESTS[region]) {
      invEvent(CHESTS[region]);
    }
  }

  /** Every 200 ms: keep a short inventory history, spot caskets and bird nests being opened,
   *  and finish the events waiting on their items. */
  function watchInventory(now) {
    const inv = countInv();
    invHistory.push({ t: now, inv });
    while (invHistory.length > 20) invHistory.shift();
    // not while a window is open (banking or selling a casket isn't opening it)
    const windowOpen = ll.modalItems ? !!ll.modalItems() : false;
    if (lastInv && !windowOpen) {
      const lost = (id) => (inv.get(id) || 0) < (lastInv.get(id) || 0);
      const opened = lost(CASKET) ? 'Casket' : BIRD_NESTS.some(lost) ? 'Bird nest' : null;
      if (opened) {
        const ignore = new Set(opened === 'Casket' ? [CASKET] : BIRD_NESTS);
        const items = gains(lastInv, inv, ignore);
        if (items.size) send({ name: opened, level: 0, items });
      }
    }
    lastInv = inv;
    for (let i = pending.length - 1; i >= 0; i--) {
      const e = pending[i];
      if (now < e.due) continue;
      const items = gains(e.base, inv, e.ignore);
      if (items.size || now >= e.until) {
        pending.splice(i, 1);
        if (items.size) send({ name: e.name, level: 0, items });
      }
    }
  }

  /** Reward windows: Treasure Trails, Fishing Trawler, Barrows, Kingdom of Miscellania. */
  function watchWindows(now) {
    const m = ll.modalItems ? ll.modalItems() : null;
    if (!m) {
      modalSeen = -1;
      modalOpened = 0;
      return;
    }
    if (modalSeen === m.root) return;
    if (!modalOpened) modalOpened = now;
    if (!m.items.length) {
      if (now - modalOpened > 3000) modalSeen = m.root; // an empty window: nothing to count
      return;
    }
    let name = null;
    if (m.root === TRAIL && pendingClue) {
      name = `Clue Scroll (${clueTier || 'Unknown'})`; // RuneLite's event name for these
      pendingClue = 0;
    } else if (m.root === TRAWLER) name = 'Fishing Trawler';
    else if (region === BARROWS_REGION && !NOT_LOOT.has(m.root)) name = 'Barrows';
    else if (MISC_REGIONS.includes(region) && !NOT_LOOT.has(m.root)) name = 'Kingdom of Miscellania';
    modalSeen = m.root;
    if (!name) return;
    const k = { name, level: 0, items: new Map() };
    m.items.forEach((it, i) => {
      k.items.set(`win,${i}`, { id: it.id, n: it.quantity || 1 });
      iconUrl(it.id, it.quantity || 1);
    });
    send(k);
  }

  function watchClues(now) {
    const clues = cfg.clues || {};
    const inv = ll.readContainer ? ll.readContainer(ll.ITEMS.inventory, 28) : null;
    if (inv) for (const it of inv) if (it && clues[it.id]) clueTier = clues[it.id];
    if (!pendingClue) return;
    const reward = ll.readContainer ? ll.readContainer(REWARD_INV, 6) : null;
    const items = (reward || []).filter((it) => it && it.id >= 0);
    if (items.length) {
      pendingClue = 0;
      modalSeen = TRAIL; // counted here: not again by watchWindows
      const k = { name: `Clue Scroll (${clueTier || 'Unknown'})`, level: 0, items: new Map() };
      items.forEach((it, i) => {
        k.items.set(`clue,${i}`, { id: it.id, n: it.quantity || 1 });
        iconUrl(it.id, it.quantity || 1);
      });
      send(k);
    } else if (now - pendingClue > 2500) {
      // missed the window (the server moves the reward into your pack straight away): what
      // was added to your inventory since the message is the reward
      pendingClue = 0;
      const k = { name: `Clue Scroll (${clueTier || 'Unknown'})`, level: 0, items: gains(clueInvBefore, countInv(), new Set(Object.keys(clues).map(Number))) };
      if (k.items.size) send(k);
    }
  }

  function frame(g) {
    const now = performance.now();
    watchClues(now);
    // icons that weren't ready: send them as they come
    for (const key of [...iconPending]) {
      const [id, n] = key.split(':').map(Number);
      const url = iconUrl(id, n);
      if (url) window.postMessage({ __lostlite: true, type: 'loot-icon', data: { id, step: n, url } }, '*');
    }
    if (now - lastScan < 200) return;
    lastScan = now;
    const c = g.client;
    const me = c[ll.fields.localPlayer];
    if (!me) return;
    region = (((g.baseX + (me[ll.fields.entityX] >> 7)) >> 6) << 8) | ((g.baseZ + (me[ll.fields.entityZ] >> 7)) >> 6);
    watchInventory(now);
    watchWindows(now);
    // who you're fighting: an NPC, or (faceEntity >= 32768) a player, RuneLite's PvP loot
    const face = me[ll.fields.faceEntity];
    const npcs = g.npcs();
    const players = g.players ? g.players() : [];
    if (typeof face === 'number' && face >= 0) {
      const pvp = face >= 32768;
      const index = pvp ? face - 32768 : face;
      const n = (pvp ? players : npcs).find((x) => x.index === index);
      if (n && n.name) target = { kind: pvp ? 'player' : 'npc', index, name: strip(n.name), time: now };
    }
    if (target && now - target.time > 15000) target = null;
    // the one you were fighting at 0 hitpoints: it's dying
    for (const n of [...npcs, ...players]) {
      const kind = n.kind || 'npc';
      const key = `${kind},${n.index}`;
      const dead = n.totalHealth > 0 && n.health === 0;
      if (!dead) {
        dying.delete(key);
        continue;
      }
      if (dying.has(key) || !target || target.index !== n.index || target.kind !== kind) continue;
      dying.add(key);
      const k = { index: n.index, name: strip(n.name), level: n.level, x: g.baseX + (n.x >> 7), y: g.baseZ + (n.z >> 7), size: n.size || 1, time: now, items: new Map(), lastNew: 0 };
      k.before = groundAround(g, k);
      kills.push(k);
      target = null;
    }
    // what lands where they fell
    for (let i = kills.length - 1; i >= 0; i--) {
      const k = kills[i];
      if (now - k.time < WINDOW) {
        for (const [key, it] of groundAround(g, k)) {
          if (k.before.has(key) || k.items.has(key)) continue;
          k.items.set(key, it);
          k.lastNew = now;
          iconUrl(it.id, it.n); // ask the game to draw it now
        }
      }
      if ((k.lastNew && now - k.lastNew > QUIET) || now - k.time >= WINDOW) {
        kills.splice(i, 1);
        send(k);
      }
    }
  }

  ll.__lootTracker = { kills, frame, chat, pending, target: () => target, region: () => region };

  ll.registerPlugin('loottracker', {
    configure(config) {
      cfg = config || {};
      // the panel's totals want the picture for their stack size
      for (const [id, n] of cfg.wantIcons || []) iconUrl(id, n);
    },
    frame,
    chat,
    stop() {
      kills.length = 0;
      pending.length = 0;
      invHistory.length = 0;
      lastInv = null;
      target = null;
    },
  });
})();
