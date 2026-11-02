// Tears of Guthix, page side: the tears you've collected this visit (varp 449, bits 12-20), shown
// while you're collecting (bit 6), as an info box and a panel.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;
  let cfg = {};
  const BOWL = 4704; // tog_bowl (pack/obj.pack)
  const VARP = 449; // tog_minigame

  function state() {
    const c = ll.client;
    const f = ll.fields;
    const varps = c && f.varps ? c[f.varps] : null;
    if (!varps || !ll.loggedIn) return null;
    const v = varps[VARP] | 0;
    if (((v >>> 6) & 1) !== 1) return null;
    return { tears: (v >>> 12) & 0x1ff };
  }

  function boxes() {
    if (cfg.showInfobox === false) return [];
    const s = state();
    if (!s) return [];
    const img = ll.itemIcon ? ll.itemIcon(BOWL) : null;
    return [{ name: 'Tears of Guthix', kind: 'tears', group: 'Other', priority: 0, image: img, text: String(s.tears), colour: 0x00ffff, tooltip: `Tears collected: ${s.tears}` }];
  }

  function panels() {
    if (cfg.showPanel === false) return [];
    const s = state();
    if (!s) return [];
    return [{
      name: 'Tears of Guthix',
      size: cfg.panelSize,
      rows: [
        { type: 'title', text: 'Tears of Guthix', colour: 0x00ffff },
        { type: 'line', left: 'Tears collected:', right: String(s.tears) },
      ],
    }];
  }

  if (ll.addInfoBoxes) ll.addInfoBoxes('tears', boxes);
  if (ll.addOverlayPanel) ll.addOverlayPanel('tears', panels);
  ll.__tears = { state, boxes, panels };

  ll.registerPlugin('tears', {
    configure(config) {
      cfg = config || {};
    },
  });
})();
