// Ground Markers, page side: RuneLite's GroundMarkerPlugin / GroundMarkerOverlay (BSD
// 2-Clause, Copyright (c) 2018, TheLonelyDev and RuneLite contributors). Shift + right-click
// the ground: "Mark tile" / "Unmark tile". Tiles are kept as world tiles and level.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  let cfg = {};
  let points = [];
  let hoverTile = null; // world tile under the mouse, from the last frame

  const hex = (c, d) => {
    const m = /([0-9a-f]{6})$/i.exec(String(c || ''));
    return m ? parseInt(m[1], 16) : d;
  };
  const same = (a, b) => a.x === b.x && a.y === b.y && a.level === b.level;

  function save() {
    window.postMessage({ __lostlite: true, type: 'groundmarkers-points', data: points }, '*');
  }

  function frame(g) {
    const m = ll.mouse;
    hoverTile = null;
    if (m.inView) {
      const t = g.tileAt(m.x, m.y);
      if (t) hoverTile = { x: g.baseX + t.x, y: g.baseZ + t.z, level: g.level };
    }
    const width = Math.max(0, Number(cfg.borderWidth === undefined ? 2 : cfg.borderWidth));
    const fill = Math.max(0, Math.min(255, Number(cfg.fillOpacity === undefined ? 50 : cfg.fillOpacity)));
    for (const p of points) {
      if (p.level !== g.level) continue;
      const sx = p.x - g.baseX;
      const sz = p.y - g.baseZ;
      if (sx < 0 || sz < 0 || sx > 103 || sz > 103) continue;
      const poly = g.tilePoly(sx, sz);
      if (!poly) continue;
      const colour = p.color ? hex(p.color, 0xffff00) : hex(cfg.markerColor, 0xffff00);
      g.polygon(poly, colour, { fillAlpha: Math.round((fill / 255) * 256), width, strokeAlpha: width > 0 ? 256 : 0 });
    }
  }

  /** Shift + right-click: "Mark tile" / "Unmark tile" under Walk here. */
  function menuAfter(c, arrays, rt) {
    if (!rt.shiftDown || !hoverTile) return;
    const opt = arrays[0];
    const n = c[ll.fields.menuCount];
    let walk = -1;
    for (let i = 0; i < n; i++) if (String(opt[i]) === 'Walk here') walk = i;
    if (walk < 0) return;
    const tile = Object.assign({}, hoverTile);
    const marked = points.some((p) => same(p, tile));
    rt.insertMenuEntry(c, walk, marked ? 'Unmark tile' : 'Mark tile', () => {
      if (points.some((p) => same(p, tile))) points = points.filter((p) => !same(p, tile));
      else points.push(tile);
      save();
    });
  }

  ll.__groundMarkers = { points: () => points, hover: () => hoverTile };

  ll.registerPlugin('groundmarkers', {
    configure(config) {
      cfg = config || {};
      if (Array.isArray(cfg.points)) points = cfg.points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    },
    frame,
    menuAfter,
    stop() {
      hoverTile = null;
    },
  });
})();
