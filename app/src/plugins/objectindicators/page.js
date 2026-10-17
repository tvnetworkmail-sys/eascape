// Object Markers, page side: RuneLite's ObjectIndicatorsPlugin / ObjectIndicatorsOverlay
// (BSD 2-Clause, Copyright (c) 2018, Tomas Slusny <slusnucky@gmail.com> and RuneLite
// contributors). Shift + right-click an object: "Mark object" / "Unmark object". Marked
// objects (kept by id, name and world tile) get their model's hull outlined in the marker
// colour over RuneLite's faint black fill, and/or their tile.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  let cfg = {};
  let objects = []; // [{ id, name, x, y, level, color }]

  const hex = (c, d) => {
    const m = /([0-9a-f]{6})$/i.exec(String(c || ''));
    return m ? parseInt(m[1], 16) : d;
  };
  const same = (a, b) => a.id === b.id && a.x === b.x && a.y === b.y && a.level === b.level;
  const strip = (s) => String(s || '').replace(/@[a-z0-9~]{3}@/gi, '').trim();

  function save() {
    window.postMessage({ __lostlite: true, type: 'objectindicators-objects', data: objects }, '*');
  }

  function frame(g) {
    const width = Math.max(1, Number(cfg.borderWidth === undefined ? 2 : cfg.borderWidth));
    for (const o of objects) {
      if (o.level !== g.level) continue;
      const sx = o.x - g.baseX;
      const sz = o.y - g.baseZ;
      if (sx < 0 || sz < 0 || sx > 103 || sz > 103) continue;
      const loc = g.locs(sx, sz).find((l) => l.id === o.id);
      if (!loc) continue; // not there right now (a door opened, a tree cut down)
      const colour = o.color ? hex(o.color, 0xffff00) : hex(cfg.markerColor, 0xffff00);
      let drew = false;
      if (cfg.highlightHull !== false) {
        const hull = g.hull(loc.typecode);
        if (hull && hull.length > 2) {
          g.polygon(hull, colour, { fill: 0x000000, fillAlpha: 50, width });
          drew = true;
        }
      }
      if (cfg.highlightTile || (cfg.highlightHull !== false && !drew)) {
        const poly = g.tilePoly(sx, sz);
        if (poly) g.polygon(poly, colour, { fill: 0x000000, fillAlpha: 50, width });
      }
    }
  }

  /** Shift + right-click: "Mark object" / "Unmark object" under each object's Examine. */
  function menuAfter(c, arrays, rt) {
    if (!rt.shiftDown) return;
    const f = ll.fields;
    const [opt, , a, b, cc] = arrays;
    const n = c[f.menuCount];
    const base = { x: c[f.baseX] | 0, y: c[f.baseZ] | 0, level: c[f.level] | 0 };
    const found = [];
    for (let i = 0; i < n; i++) {
      const text = String(opt[i]);
      if (!text.startsWith('Examine @cya@')) continue;
      found.push({ i, id: (a[i] >> 14) & 0x7fff, x: base.x + b[i], y: base.y + cc[i], level: base.level, name: strip(text.slice(8)), shown: text.slice(8) });
    }
    for (const o of found) {
      const marked = objects.some((x) => same(x, o));
      rt.insertMenuEntry(c, o.i, `${marked ? 'Unmark object' : 'Mark object'} ${o.shown}`, () => {
        if (objects.some((x) => same(x, o))) objects = objects.filter((x) => !same(x, o));
        else objects.push({ id: o.id, name: o.name, x: o.x, y: o.y, level: o.level });
        save();
      });
    }
  }

  ll.__objectMarkers = { objects: () => objects };

  ll.registerPlugin('objectindicators', {
    configure(config) {
      cfg = config || {};
      if (Array.isArray(cfg.objects)) objects = cfg.objects.filter((o) => o && Number.isFinite(o.id));
    },
    frame,
    menuAfter,
  });
})();
