// Crystal Bow, page side: watches the bow you wield and the shots used in its present tenth
// (varp 801), and warns once per tenth when warnAt or fewer shots are left.
(() => {
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;
  const VARP = 801; // crystal_bow_shots
  const PER_TENTH = 250;
  // the crystal bows (2006 ids): new 4212, full 4214, 9/10 to 1/10 4215-4223
  const NAMES = { 4214: 'full', 4215: '9/10', 4216: '8/10', 4217: '7/10', 4218: '6/10', 4219: '5/10', 4220: '4/10', 4221: '3/10', 4222: '2/10', 4223: '1/10' };
  let on = false;
  let cfg = {};
  let warned = null; // the bow and tenth already warned about

  function frame() {
    if (!on || !ll.loggedIn) return;
    const c = ll.client;
    const f = ll.fields;
    const varps = c && f.varps ? c[f.varps] : null;
    if (!varps) return;
    const worn = ll.readContainer ? ll.readContainer(ll.ITEMS.equipment, 14) : null;
    const weapon = worn ? worn[3] : null;
    if (!weapon || !NAMES[weapon.id]) return;
    const used = varps[VARP] | 0;
    const left = PER_TENTH - used;
    const warnAt = Math.max(1, cfg.warnAt | 0 || 10);
    const key = `${weapon.id}`;
    if (left > warnAt) {
      if (warned === key) warned = null;
      return;
    }
    if (warned === key || left <= 0) return;
    warned = key;
    const last = weapon.id === 4223;
    const text = last
      ? `Your crystal bow has ${left} shot${left === 1 ? '' : 's'} left before it reverts to a seed.`
      : `Your crystal bow has ${left} shot${left === 1 ? '' : 's'} left before it loses 250 charges.`;
    if (ll.gameMessage) ll.gameMessage(text);
    window.postMessage({ __lostlite: true, type: 'crystalbow-warn', data: { text } }, '*');
  }

  ll.registerPlugin('crystalbow', {
    configure(config) {
      cfg = config || {};
      on = true;
    },
    frame,
    stop() {
      on = false;
      warned = null;
    },
  });
})();
