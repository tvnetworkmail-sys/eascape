// XP Drops, page side: drawn into the game view like the modern game's XP drops (which
// RuneLite's XP Drop plugin builds on): a total XP counter in the top right corner, and each
// gain rising up to it with the skill's icon, in the game's own bold font.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const VIEW_W = 512;
  const BOX_Y = 4;
  const BOX_H = 18;
  const LINE = 16; // one drop's height
  const RISE = 96; // how far a drop travels to reach the counter
  const SETTLE = 2000; // after logging in the game fills in your stats: none of that is a gain

  let cfg = {};
  let icons = {};
  let last = null; // skill -> xp
  let seenAt = null; // when you were first seen logged in
  let drops = []; // { gains: [{skill, amount}], born }

  const rgbOf = (c) => {
    const m = /([0-9a-f]{6})$/i.exec(String(c || ''));
    return m ? parseInt(m[1], 16) : 0xffffff;
  };
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function watch(now) {
    const c = ll.client;
    const me = c && ll.fields.localPlayer ? c[ll.fields.localPlayer] : null;
    if (!me) {
      last = null;
      seenAt = null;
      drops = [];
      return null;
    }
    if (seenAt === null) seenAt = now;
    const stats = ll.readStats();
    if (!stats) return null;
    const by = {};
    for (const s of stats) by[s.skill] = s.xp;
    if (!last || now - seenAt < SETTLE) {
      last = by;
      return stats;
    }
    const gains = [];
    for (const s of stats) {
      const before = last[s.skill];
      if (typeof before === 'number' && s.xp > before) gains.push({ skill: s.skill, amount: s.xp - before });
    }
    last = by;
    if (gains.length) {
      if (cfg.groupDrops !== false) drops.push({ gains, born: now });
      else for (const g of gains) drops.push({ gains: [g], born: now });
    }
    return stats;
  }

  function frame(g) {
    const now = performance.now();
    const stats = watch(now);
    if (!stats) return;
    const colour = rgbOf(cfg.colour);
    const right = VIEW_W - 6;
    let top = BOX_Y + BOX_H; // drops disappear into the counter (or the top of the view)
    if (cfg.showCounter !== false) {
      const total = stats.reduce((n, s) => n + s.xp, 0);
      const label = `XP: ${fmt(total)}`;
      const w = Math.max(90, g.textWidth(label, 'bold') + 10);
      g.fillRect(right - w, BOX_Y, w, BOX_H, 0x000000, 150);
      g.rect(right - w, BOX_Y, w, BOX_H, 0x5a5245);
      g.text(label, right - 5 - g.textWidth(label, 'bold'), BOX_Y + 14, 0xffffff, { font: 'bold' });
    } else {
      top = BOX_Y;
    }
    // Each drop starts below the counter and rises at a steady speed; one that comes right
    // after another starts a line lower so they never overlap (the modern game queues them).
    const ms = Math.max(500, Number(cfg.duration) || 2000);
    const speed = RISE / ms;
    const start = top + RISE;
    let lowest = -Infinity;
    const keep = [];
    for (const d of drops) {
      if (d.y0 === undefined) d.y0 = Math.max(start, lowest + LINE);
      const y = Math.round(d.y0 - (now - d.born) * speed); // the drop's top
      lowest = Math.max(lowest, y);
      if (y < top) continue; // reached the counter
      keep.push(d);
      const total = d.gains.reduce((n, x) => n + x.amount, 0);
      const text = fmt(total);
      let x = right - 5 - g.textWidth(text, 'bold');
      if (y < top + 2) continue;
      g.text(text, x, y + 13, colour, { font: 'bold' });
      if (cfg.showIcons !== false) {
        for (let k = d.gains.length - 1; k >= 0; k--) {
          const ic = icons[d.gains[k].skill];
          if (!ic) continue;
          x -= ic.w + 2;
          g.image(ic, x, y + Math.round((LINE - ic.h) / 2));
        }
      }
    }
    drops = keep;
  }

  ll.__xpDrops = { drops: () => drops, rgbOf, fmt };

  ll.registerPlugin('xpdrops', {
    configure(config) {
      cfg = config || {};
      if (cfg.icons) icons = cfg.icons;
    },
    frame,
    stop() {
      cfg = {};
      drops = [];
      last = null;
      seenAt = null;
    },
  });
})();
