// Fishing, page side: RuneLite's FishingPlugin / FishingSpotOverlay / FishingOverlay for the
// 2004 game.
//  - each fishing spot near you: its tile outlined in the overlay colour, the icon of its best
//    fish (the game's own inventory icon) and/or its fish by name ("Lobster, Tuna,
//    Swordfish"), from Lost City's spot scripts; or only the kind you're fishing at
//  - RuneLite's panel: "Fishing" in green while you fish, "NOT fishing" in red, "Caught fish:"
//    and "Fish/hr:", counted from the game's "You catch ..." messages
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  // human_harpoon, _lobster, _largenet, _smallnet, _fishing_casting, _fish_onspot, _octopus_pot
  const ANIMS = [618, 619, 620, 621, 622, 623, 1193];
  const CATCH = /^You catch (?:a|an|some) /; // RuneLite's

  let cfg = {};
  let spots = {}; // npc id -> { fish: [{ id, name }], icon }
  let session = null; // { start, last, caught }

  const hex = (c, d) => {
    const m = /([0-9a-f]{6})$/i.exec(String(c || ''));
    return m ? parseInt(m[1], 16) : d;
  };

  function chat(msg) {
    if (!msg || msg.kind !== 'game' || !CATCH.test(String(msg.text || '').replace(/@[a-z0-9~]{3}@/gi, ''))) return;
    const now = performance.now();
    if (!session) session = { start: now, last: now, caught: 0 };
    session.last = now;
    session.caught++;
  }

  function fishing() {
    const c = ll.client;
    const me = c && c[ll.fields.localPlayer];
    return !!me && ANIMS.includes(me[ll.fields.primaryAnim]);
  }

  /** The kind of spot you're fishing at (its fish list), for "only currently fished fish". */
  /** The kind of spot you're fishing at (its fish list), for "only currently fished fish". */
  function currentKind(npcs) {
    const c = ll.client;
    const me = c && c[ll.fields.localPlayer];
    const face = me ? me[ll.fields.faceEntity] : -1;
    if (typeof face !== 'number' || face < 0 || face >= 32768) return null;
    const n = npcs.find((x) => x.index === face);
    const s = n && spots[n.id];
    return s ? s.fish.map((f) => f.id).join(',') : null;
  }

  /** The icon at size percent (nearest pixel), cached per item and size. */
  const scaled = new Map();
  function sizedIcon(id, size) {
    const pct = Math.min(100, Math.max(25, Number(size) || 50));
    const key = `${id}:${pct}`;
    if (scaled.has(key)) return scaled.get(key);
    const src = ll.itemIcon ? ll.itemIcon(id) : null;
    if (!src) return null;
    let out = src;
    if (pct < 100) {
      const w = Math.max(1, Math.round((src.w * pct) / 100));
      const h = Math.max(1, Math.round((src.h * pct) / 100));
      const px = new Int32Array(w * h);
      for (let y = 0; y < h; y++) {
        const sy = Math.min(src.h - 1, Math.floor(((y + 0.5) * src.h) / h));
        for (let x = 0; x < w; x++) {
          const sx = Math.min(src.w - 1, Math.floor(((x + 0.5) * src.w) / w));
          px[y * w + x] = src.px[sy * src.w + sx];
        }
      }
      out = { w, h, px };
    }
    scaled.set(key, out);
    return out;
  }

  function frame(g) {
    if (cfg.showTiles === false && cfg.showIcons === false && cfg.showNames === false) return;
    const npcs = g.npcs();
    const kind = cfg.onlyCurrent ? currentKind(npcs) : null;
    if (cfg.onlyCurrent && !kind) return; // RuneLite: nothing while you aren't fishing
    const colour = hex(cfg.overlayColor, 0x00ffff);
    for (const n of npcs) {
      const s = spots[n.id];
      if (!s) continue;
      if (kind && s.fish.map((f) => f.id).join(',') !== kind) continue;
      const tx = n.x >> 7;
      const tz = n.z >> 7;
      if (cfg.showTiles !== false) {
        const poly = g.tilePoly(tx, tz);
        if (poly) g.polygon(poly, colour, { fillAlpha: 50, width: 1 });
      }
      const h = (n.height | 0) || 60;
      if (cfg.showIcons !== false) {
        const icon = sizedIcon(s.icon, cfg.iconSize);
        const p = icon && g.project(n.x, n.z, h);
        if (p) g.image(icon, p.x - (icon.w >> 1), p.y - (icon.h >> 1));
      }
      if (cfg.showNames) {
        const text = s.fish.map((f) => f.name).join(', ');
        const p = g.project(n.x, n.z, h + 40);
        if (p) g.text(text, p.x - (g.textWidth(text) >> 1), p.y, colour);
      }
    }
  }

  function panels(now) {
    if (!session || cfg.showFishingStats === false) return [];
    if (now - session.last > Math.max(1, Number(cfg.statTimeout) || 5) * 60000) {
      session = null;
      return [];
    }
    const active = fishing();
    const rows = [
      { type: 'title', text: active ? 'Fishing' : 'NOT fishing', colour: active ? 0x00ff00 : 0xff0000 },
      { type: 'line', left: 'Caught fish:', right: String(session.caught) },
    ];
    const ms = now - session.start;
    if (session.caught > 2 && ms > 0) rows.push({ type: 'line', left: 'Fish/hr:', right: String(Math.floor((session.caught * 3600000) / ms)) });
    return [{ name: 'Fishing', size: cfg.panelSize, rows }];
  }

  if (ll.addOverlayPanel) ll.addOverlayPanel('fishing', panels);

  ll.__fishing = { frame, panels, chat, session: () => session };

  ll.registerPlugin('fishing', {
    configure(config) {
      cfg = config || {};
      if (cfg.spots) spots = cfg.spots;
    },
    frame,
    chat,
    stop() {
      session = null;
    },
  });
})();
