// Timers & Buffs, page side: RuneLite's TimersAndBuffsPlugin (BSD 2-Clause, Copyright (c)
// 2017, Seth <Sethtroll3@gmail.com> and RuneLite contributors) for the timers the 2004 game
// has. The 2004 server doesn't tell the client about these, so (like RuneLite before varbits)
// they start from what the game says and shows:
//   Antifire     "You drink some of your dragon potion."      600 ticks (anti_fire.rs2)
//   Antipoison   "You drink some of your antipoison potion."  5 poison cycles of 30 ticks;
//                superantipoison (same message, told apart by the potion that went down) 20
//   Charge       "You feel charged with magic power."         350 x 2 ticks (charge.rs2),
//                ends at "Your magical charge fades away."
//   Freeze       bind / snare / entangle landing on you        8 / 16 / 24 ticks, halved
//                with Protect from Magic (pvp_magic.rs2)
//   Stunned      "You've been stunned!"                        8 ticks, 10 by a Hero
// Antifire and antipoison carry on after logging back in (the server keeps them); the
// others end when you log out. Each timer is an info box (see the Info Boxes plugin).
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const TICK = 600;
  const ITEMS = { antipoison: 2446, superantipoison: 2448, antifire: 2452 }; // 4-dose icons
  const ANTIPOISON_IDS = new Set([175, 177, 179, 2446]);
  const SUPER_IDS = new Set([181, 183, 185, 2448]);
  const FREEZE_SPOTANIMS = { 181: ['Bind', 8, 'bind'], 180: ['Snare', 16, 'snare'], 179: ['Entangle', 24, 'entangle'] };
  const PROTECT_MAGIC_VARP = 83 + 12;
  // which info box group each timer goes in (its section in RuneLite's settings)
  const GROUP_OF = { showAntiFire: 'Potions', showAntipoison: 'Potions', showCharge: 'Spells', showFreezes: 'Spells', showPickpocketStun: 'Other' };

  let cfg = {};
  let icons = {};
  const timers = new Map(); // name -> { key, start, end, image(), tooltip, keep }
  let paused = null; // timers kept over a logout: [{ name, left, ... }]
  let lastInv = null;
  const drank = { normal: 0, super: 0 };
  let pendingAntipoison = 0;
  let lastSpot = -1;
  let wasIn = false;

  const on = (key) => cfg[key] !== false;

  function start(name, key, ms, image, keep) {
    const now = performance.now();
    timers.set(name, { name, key, start: now, end: now + ms, image, keep: !!keep });
  }

  function timeText(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------- what starts them

  function chat(msg) {
    if (!msg || msg.kind !== 'game') return;
    const t = String(msg.text || '').trim();
    if (t === 'You drink some of your dragon potion.') {
      start('Antifire', 'showAntiFire', 600 * TICK, () => ll.itemIcon(ITEMS.antifire), true);
    } else if (t === 'You drink some of your antipoison potion.') {
      pendingAntipoison = performance.now(); // which one: see the inventory below
    } else if (t === 'You feel charged with magic power.') {
      start('Charge', 'showCharge', 700 * TICK, () => icons.charge);
    } else if (t === 'Your magical charge fades away.') {
      timers.delete('Charge');
    } else if (t === "You've been stunned!") {
      start('Stunned', 'showPickpocketStun', (heroNearby() ? 10 : 8) * TICK, () => icons.thieving);
    }
  }

  function heroNearby() {
    const c = ll.client;
    const me = c && c[ll.fields.localPlayer];
    const face = me && ll.fields.faceEntity ? me[ll.fields.faceEntity] : -1;
    if (typeof face !== 'number' || face < 0 || face >= 32768) return false;
    try {
      const n = ll.readNpcs(c).find((x) => x.index === face);
      return !!n && /^hero$/i.test(n.name || '');
    } catch {
      return false;
    }
  }

  /** Which antipoison went down a dose (the drink message is the same for both). */
  function watchInventory(now) {
    const inv = ll.readContainer ? ll.readContainer(ll.ITEMS.inventory, 28) : null;
    if (!inv) return;
    const ids = inv.map((it) => (it ? it.id : -1));
    if (lastInv) {
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] === lastInv[i]) continue;
        if (SUPER_IDS.has(lastInv[i])) drank.super = now;
        else if (ANTIPOISON_IDS.has(lastInv[i])) drank.normal = now;
      }
    }
    lastInv = ids;
    if (pendingAntipoison) {
      const isSuper = drank.super && Math.abs(drank.super - pendingAntipoison) < 2000;
      const isNormal = drank.normal && Math.abs(drank.normal - pendingAntipoison) < 2000;
      if (isSuper || isNormal || now - pendingAntipoison > 2000) {
        const cycles = isSuper && !isNormal ? 20 : 5;
        start('Antipoison', 'showAntipoison', cycles * 30 * TICK, () => ll.itemIcon(isSuper && !isNormal ? ITEMS.superantipoison : ITEMS.antipoison), true);
        timers.get('Antipoison').tooltip = isSuper && !isNormal ? 'Superantipoison' : 'Antipoison';
        pendingAntipoison = 0;
      }
    }
  }

  /** A bind, snare or entangle landing on you (RuneLite watches the same spot animations). */
  function watchFreeze(c) {
    const f = ll.fields;
    const me = c[f.localPlayer];
    if (!me || !f.entitySpotanim) return;
    const spot = me[f.entitySpotanim];
    if (spot !== lastSpot) {
      lastSpot = spot;
      const fr = FREEZE_SPOTANIMS[spot];
      if (fr) {
        const varps = f.varps && c[f.varps];
        const protect = varps && varps[PROTECT_MAGIC_VARP] === 1;
        const ticks = protect ? Math.floor(fr[1] / 2) : fr[1];
        start('Freeze', 'showFreezes', ticks * TICK, () => icons[fr[2]]);
        timers.get('Freeze').tooltip = fr[0];
      }
    }
  }

  // ---------------------------------------------------------------- the boxes

  /** Logging out and in (checked from the frames, and on a timer for the login screen,
   * where the game draws no frames). */
  function loginCheck(now) {
    const c = ll.client;
    const loggedIn = !!(c && ll.fields.localPlayer && c[ll.fields.localPlayer]) && ll.loggedIn !== false;
    if (!loggedIn) {
      if (wasIn) {
        // logging out: the server keeps antifire and antipoison going after the next login
        paused = [...timers.values()].filter((t) => t.keep && t.end > now).map((t) => Object.assign({}, t, { left: t.end - now }));
        timers.clear();
        lastInv = null;
        lastSpot = -1;
      }
      wasIn = false;
      return false;
    }
    if (!wasIn) {
      wasIn = true;
      if (paused) for (const t of paused) timers.set(t.name, Object.assign(t, { start: now - (t.end - t.start - t.left), end: now + t.left }));
      paused = null;
    }
    return true;
  }
  if (typeof setInterval === 'function') setInterval(() => loginCheck(performance.now()), 500);

  function boxes(now) {
    if (!loginCheck(now)) return [];
    const c = ll.client;
    watchInventory(now);
    watchFreeze(c);
    const out = [];
    for (const t of [...timers.values()]) {
      const left = t.end - now;
      if (left <= 0) {
        timers.delete(t.name); // RuneLite's Timer.cull
        continue;
      }
      if (!on(t.key)) continue;
      const total = t.end - t.start;
      out.push({
        name: t.name, priority: 4, group: GROUP_OF[t.key] || 'Other', image: t.image ? t.image() : null,
        text: timeText(left),
        colour: left < total * 0.1 ? 0xff3333 : 0xffffff, // RuneLite's Timer: red with 10% left
        tooltip: t.tooltip || t.name,
      });
    }
    return out;
  }

  ll.__timers = { timers, chat, boxes, start, loginCheck };
  if (ll.addInfoBoxes) ll.addInfoBoxes('timersandbuffs', boxes);

  ll.registerPlugin('timersandbuffs', {
    configure(config) {
      cfg = config || {};
      if (cfg.icons) icons = cfg.icons;
    },
    chat,
    stop() {
      timers.clear();
      paused = null;
    },
  });
})();
