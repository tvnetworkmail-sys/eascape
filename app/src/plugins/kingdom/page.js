// Kingdom of Miscellania, page side: the approval info box (RuneLite's KingdomCounter).
(() => {
  const ll = window.__lostlite;
  if (!ll) return;
  let cfg = {};
  const COINS = 995;
  // RuneLite's KINGDOM_REGION: Miscellania (10044) and Etceteria (10300)
  const REGIONS = new Set([10044, 10300]);

  function state() {
    const c = ll.client;
    const f = ll.fields;
    const varps = c && f.varps ? c[f.varps] : null;
    const me = c && f.localPlayer ? c[f.localPlayer] : null;
    if (!varps || !me || !ll.loggedIn) return null;
    const x = (c[f.baseX] | 0) + (me[f.entityX] >> 7);
    const y = (c[f.baseZ] | 0) + (me[f.entityZ] >> 7);
    const region = ((x >> 6) << 8) | (y >> 6);
    const approval = ((varps[361] | 0) >>> 18) & 0x7f;
    const coffer = (varps[362] | 0) & 0x7ffffff;
    return { region, approval, coffer, percent: Math.floor((approval * 100) / 127) };
  }

  function boxes() {
    const s = state();
    if (!s) return [];
    if (!cfg.showInfoboxAnywhere && !REGIONS.has(s.region)) return [];
    const img = ll.itemIcon ? ll.itemIcon(COINS, 10000) : null;
    return [{ name: 'Kingdom of Miscellania', priority: 0, image: img, text: `${s.percent}%`, colour: 0xffffff, tooltip: `Favor: ${s.percent}%\nCoffer: ${s.coffer.toLocaleString('en-GB')}` }];
  }

  if (ll.addInfoBoxes) ll.addInfoBoxes('kingdom', boxes);
  ll.__kingdom = { state, boxes };

  ll.registerPlugin('kingdom', {
    configure(config) {
      cfg = config || {};
    },
  });
})();
