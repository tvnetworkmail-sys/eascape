// Agility, page side: RuneLite's AgilityPlugin / AgilityOverlay / LapCounterOverlay for the
// 2004 game.
//  - clickboxes: each course obstacle near you is outlined in the overlay colour with a faint
//    fill (darker under the mouse); shortcuts too, in red when your Agility is too low
//  - laps: the game doesn't send the course's progress, so a lap is seen as RuneLite sees
//    one: the last obstacle's XP and the lap bonus arriving together (from Lost City's
//    scripts) while you're at that course; RuneLite's panel: "Total Laps:", "Laps until
//    goal:" (the next level), "Laps per hour:" (the last 30 laps), hidden after "Hide lap count"
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const MAX_DISTANCE = 2350; // RuneLite's, in fine units (about 18 tiles)
  const RED = 0xff0000; // SHORTCUT_HIGH_LEVEL_COLOR

  let cfg = {};
  let courses = [];
  const courseOf = new Map(); // loc id -> course
  let shortcuts = {}; // loc id -> level
  let shortcutAt = {}; // 'x,z' -> level, where one loc is two shortcuts (RuneLite's WorldPoint)
  let found = []; // [{ typecode, x, z, level }] near you, from the last scan
  let lastScan = 0;
  let session = null; // { course, laps, last, times: [], lapsTill }
  let lastXp = -1;

  const hex = (c, d) => {
    const m = /([0-9a-f]{6})$/i.exec(String(c || ''));
    return m ? parseInt(m[1], 16) : d;
  };
  const darker = (rgb) => (Math.floor(((rgb >> 16) & 255) * 0.7) << 16) | (Math.floor(((rgb >> 8) & 255) * 0.7) << 8) | Math.floor((rgb & 255) * 0.7);

  /** XP needed for a level (the game's own formula). */
  function xpFor(level) {
    let pts = 0;
    for (let l = 1; l < level; l++) pts += Math.floor(l + 300 * Math.pow(2, l / 7));
    return Math.floor(pts / 4);
  }

  function agilityStat() {
    const stats = ll.readStats ? ll.readStats() : null;
    return stats ? stats.find((s) => s.skill === 'agility') : null;
  }

  function scan(g, now) {
    if (now - lastScan < 600) return;
    lastScan = now;
    found = [];
    const me = g.player();
    if (!me) return;
    const px = me.x >> 7;
    const pz = me.z >> 7;
    const r = Math.ceil(MAX_DISTANCE / 128);
    for (let x = Math.max(0, px - r); x <= Math.min(103, px + r); x++) {
      for (let z = Math.max(0, pz - r); z <= Math.min(103, pz + r); z++) {
        for (const l of g.locs(x, z)) {
          const course = courseOf.get(l.id);
          let level = shortcuts[l.id];
          if (level !== undefined && shortcutAt[`${g.baseX + x},${g.baseZ + z}`] !== undefined) level = shortcutAt[`${g.baseX + x},${g.baseZ + z}`];
          if (!course && level === undefined) continue;
          found.push({ typecode: l.typecode, x, z, shortcut: !course, level: level || 0, course });
        }
      }
    }
  }

  function inside(pts, mx, my) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if ((pts[i].y > my) !== (pts[j].y > my) && mx < ((pts[j].x - pts[i].x) * (my - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x) c = !c;
    }
    return c;
  }

  function laps(now) {
    const st = agilityStat();
    if (!st) return;
    if (lastXp < 0 || st.xp < lastXp) {
      lastXp = st.xp; // first look, or a new account
      return;
    }
    const gained = st.xp - lastXp;
    if (!gained) return;
    lastXp = st.xp;
    // whole XP in the game, tenths in the scripts: within one either way
    for (const course of courses) {
      if (!course.finishXp || Math.abs(gained - course.finishXp / 10) > 1) continue;
      if (found.some((o) => o.course === course)) lap(course, now, st);
    }
  }

  function lap(course, now, st) {
    if (!session || session.course !== course.name) session = { course: course.name, laps: 0, last: 0, times: [], lapsTill: 0 };
    if (session.last) {
      session.times.push(now - session.last);
      if (session.times.length > 30) session.times.shift(); // RuneLite keeps the last 30
    }
    session.last = now;
    session.laps++;
    if (st) {
      const goal = xpFor(Math.min(99, st.level) + 1);
      session.lapsTill = st.level >= 99 || !course.lapXp ? 0 : Math.ceil(((goal - st.xp) * 10) / course.lapXp);
    }
  }

  function frame(g) {
    const now = performance.now();
    scan(g, now); // also tells which course you're at, for the laps
    laps(now);
    if (cfg.showClickboxes === false && cfg.highlightShortcuts === false) return;
    const colour = hex(cfg.overlayColor, 0x00ff00);
    const st = agilityStat();
    const me = g.player();
    for (const o of found) {
      if (o.shortcut ? cfg.highlightShortcuts === false : cfg.showClickboxes === false) continue;
      if (me && Math.hypot(o.x * 128 + 64 - me.x, o.z * 128 + 64 - me.z) >= MAX_DISTANCE) continue;
      const hull = g.hull(o.typecode);
      if (!hull || hull.length < 3) continue;
      let rgb = o.shortcut && st && o.level > st.level ? RED : colour;
      if (ll.mouse.inView && inside(hull, ll.mouse.x, ll.mouse.y)) rgb = darker(rgb);
      g.polygon(hull, rgb, { fill: rgb, fillAlpha: 51, width: 1 }); // RuneLite: alpha / 5
    }
  }

  function panels(now) {
    if (cfg.showLapCount === false || !session || !session.last) return [];
    if (now - session.last >= Math.max(1, Number(cfg.lapTimeout) || 5) * 60000) {
      session.last = 0; // RuneLite times the session out
      return [];
    }
    const rows = [{ type: 'line', left: 'Total Laps:', right: String(session.laps) }];
    if (cfg.lapsToLevel !== false && session.lapsTill > 0) rows.push({ type: 'line', left: 'Laps until goal:', right: String(session.lapsTill) });
    if (cfg.lapsPerHour !== false && session.times.length) {
      const avg = session.times.reduce((a, b) => a + b, 0) / session.times.length;
      const perHour = Math.floor(3600000 / avg);
      if (perHour > 0) rows.push({ type: 'line', left: 'Laps per hour:', right: String(perHour) });
    }
    return [{ name: 'Agility', size: cfg.panelSize, rows }];
  }

  if (ll.addOverlayPanel) ll.addOverlayPanel('agility', panels);

  ll.__agility = { frame, panels, found: () => found, session: () => session, xpFor };

  ll.registerPlugin('agility', {
    configure(config) {
      cfg = config || {};
      if (cfg.data) {
        courses = cfg.data.courses || [];
        shortcuts = cfg.data.shortcuts || {};
        shortcutAt = cfg.data.shortcutAt || {};
        courseOf.clear();
        for (const c of courses) for (const id of c.locs) courseOf.set(id, c);
        lastScan = 0;
      }
    },
    frame,
    stop() {
      found = [];
      session = null;
      lastXp = -1;
    },
  });
})();
