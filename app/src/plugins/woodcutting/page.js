// Woodcutting (and, through ll.__skilling, Mining), page side: RuneLite's WoodcuttingPlugin
// and MiningPlugin (BSD 2-Clause, Copyright (c) 2017, Seth <Sethtroll3@gmail.com> /
// (c) 2019, Danny <DannysPVM@gmail.com> and RuneLite contributors) for the 2004 game:
//   - session stats: RuneLite's panel ("Woodcutting" in green while you're chopping, "NOT
//     woodcutting" in red, then "Logs cut:" and "Logs/hr:"), counted from the game's
//     "You get some ... logs." messages; reset after the "Reset stats" minutes
//   - respawn timers: when a tree near you turns into a stump, RuneLite's yellow / orange pie
//     fills up on it until it grows back. Lost City's times (trees.dbrow); an ordinary tree
//     grows back after 120-199 ticks, so its pie turns green once it could be back.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const TICK = 600;

  ll.__skilling = function skilling(opts) {
    let cfg = {};
    let table = {};
    let session = null; // { start, last, count }
    const seen = new Map(); // "x,y,level" -> loc id last seen there
    const respawns = new Map(); // "x,y,level" -> { x, y, level, start, min, max }
    let lastScan = 0;
    let logged = 0; // a few lines in the log, so a missing pie can be traced
    const log = (m) => {
      if (logged++ < 20) window.postMessage({ __lostlite: true, type: 'log', data: `[${opts.id}] ${m}` }, '*');
    };

    function chat(msg) {
      if (!msg || msg.kind !== 'game' || !opts.message.test(String(msg.text || ''))) return;
      const now = performance.now();
      if (!session) session = { start: now, last: now, count: 0 };
      session.count++;
      session.last = now;
    }

    function scan(g, now) {
      if (now - lastScan < TICK) return;
      lastScan = now;
      const me = g.player();
      if (!me) return;
      const px = me.x >> 7;
      const pz = me.z >> 7;
      const near = new Set();
      for (let x = Math.max(0, px - 15); x <= Math.min(103, px + 15); x++) {
        for (let z = Math.max(0, pz - 15); z <= Math.min(103, pz + 15); z++) {
          const key = `${g.baseX + x},${g.baseZ + z},${g.level}`;
          near.add(key);
          const here = g.locs(x, z).find((l) => l.kind === 'scenery' && table[l.id]);
          const before = seen.get(key);
          if (here) {
            if (before === undefined) log(`${table[here.id].name} (${here.id}) at ${key}`);
            seen.set(key, here.id);
            respawns.delete(key); // it's back
          } else if (before !== undefined) {
            // it was a tree (rock) here a moment ago and now it isn't: cut down (mined out)
            seen.delete(key);
            const t = table[before];
            respawns.set(key, { x: g.baseX + x, y: g.baseZ + z, level: g.level, start: now, min: t.min * TICK, max: t.max * TICK });
            log(`${t.name} gone at ${key}: respawn timer ${t.min}-${t.max} ticks`);
          }
        }
      }
      for (const key of seen.keys()) if (!near.has(key)) seen.delete(key); // out of range: forget
      for (const [key, r] of respawns) if (now - r.start > r.max + 2000) respawns.delete(key);
    }

    function frame(g) {
      const now = performance.now();
      scan(g, now);
      if (session && now - session.last > Math.max(1, Number(cfg.statTimeout) || 5) * 60000) session = null;
    }

    /** The pies, at screen size (drawn by Info Boxes on its overlay). */
    function pies(g) {
      if (opts.respawnKey && cfg[opts.respawnKey] === false) return [];
      const now = performance.now();
      const out = [];
      for (const r of respawns.values()) {
        if (r.level !== g.level) continue;
        const sx = r.x - g.baseX;
        const sz = r.y - g.baseZ;
        if (sx < 0 || sz < 0 || sx > 103 || sz > 103) continue;
        const pt = g.project(sx * 128 + 64, sz * 128 + 64, 0);
        if (!pt) continue;
        const progress = Math.min(1, (now - r.start) / r.max);
        const maybeBack = r.min < r.max && now - r.start >= r.min;
        out.push({ op: 'pie', x: pt.x, y: pt.y, progress, fill: maybeBack ? 'rgba(0,255,0,1)' : 'rgba(255,255,0,1)', border: maybeBack ? 'rgba(0,100,0,1)' : 'rgba(255,200,0,1)', diameter: 25 });
      }
      return out;
    }

    function panels(now) {
      if (!session || cfg[opts.statsKey] === false) return [];
      const c = ll.client;
      const me = c && c[ll.fields.localPlayer];
      const anim = me && ll.fields.primaryAnim ? me[ll.fields.primaryAnim] : -1;
      const active = opts.anims.includes(anim);
      const rows = [{ type: 'title', text: active ? opts.title : `NOT ${opts.title.toLowerCase()}`, colour: active ? 0x00ff00 : 0xff0000 }];
      rows.push({ type: 'line', left: opts.countLabel, right: String(session.count) });
      const ms = now - session.start;
      if (session.count >= 3 && ms > 0) rows.push({ type: 'line', left: opts.rateLabel, right: String(Math.floor((session.count * 3600000) / ms)) });
      return [{ name: opts.title, size: cfg.panelSize, rows }];
    }

    if (ll.addOverlayPanel) ll.addOverlayPanel(opts.id, panels);
    if (ll.addScreenDraw) ll.addScreenDraw(opts.id, pies);

    ll.registerPlugin(opts.id, {
      configure(config) {
        cfg = config || {};
        if (cfg.table) {
          table = cfg.table;
          log(`${Object.keys(table).length} kinds known`);
        }
      },
      chat,
      frame,
      stop() {
        session = null;
        respawns.clear();
        seen.clear();
      },
    });
    return { session: () => session, respawns, seen, chat, pies, panels };
  };

  ll.__woodcutting = ll.__skilling({
    id: 'woodcutting', title: 'Woodcutting', statsKey: 'showWoodcuttingStats', respawnKey: 'showRespawnTimers',
    message: /^You get some .*logs?\.$/,
    countLabel: 'Logs cut:', rateLabel: 'Logs/hr:',
    // human_woodcutting_* (Lost City pack/seq.pack)
    anims: [867, 869, 871, 873, 875, 877, 879, 2846], // 2846: dragon axe (377)
  });
})();
