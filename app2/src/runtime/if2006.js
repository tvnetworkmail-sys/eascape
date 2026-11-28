// 2006RS-2: the 2007 interfaces the plugins use, translated to the 2006 (377) ones.
//
// The plugins were written for the 2007 client: they name interfaces as 2007 groups (149 the inventory, 363 the
// clue puzzle) and components as packed ids (group << 16 | child), and inventories by 2007 inv id. The 2006
// client's bridge (webclient LostLite.ts) answers in 377 ids: a component is its own id, an "interface" is the
// root layer the server opens. This sits between the two: every bridge call that takes an interface, a component
// or an inv is wrapped so a 2007 id the table knows is answered from the 2006 component that shows the same thing,
// and the answer carries the 2007 id back (so a plugin comparing ids sees its own). A 2006 id (below 65536, and
// any group the table doesn't name) goes straight through, as the runtime's own 2006 code expects.
//
// The 2006 ids are from content/pack/interface.pack, the invs from content/pack/inv.pack and the scripts that
// transmit them (inv_transmit): see each entry.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || ll.if2006) return;

  const P = (g, c) => ((g << 16) | c) >>> 0;

  // 2007 group -> 2006 root layer
  const groups = {
    149: 3213, // inventory -> inventory
    15: 2005, // bank side -> bank_side
    12: 5292, // bank -> bank_main
    387: 1644, // worn equipment -> wornitems
    320: 3917, // skills -> stats
    271: 5608, // prayer -> prayer
    192: 1151, // spellbook -> magic
    274: 638, // quest list -> questlist
    550: 5065, // friends -> friends
    551: 5715, // ignore -> ignore
    239: 962, // music -> music
    261: 904, // options -> options
    182: 2449, // logout -> logout
    363: 6976, // clue sliding puzzle -> trail_puzzle
    287: 11126, // Monkey Madness reinitialisation puzzle -> inter_214
    203: 6988, // clue text (trail_clue) -> trail_clue
    398: 20357, // fairy rings -> fairyrings
    381: 193, // wilderness level overlay -> wilderness_overlay
    275: 297, // quest / diary scroll -> questscroll
    335: 3323, // trade -> trademain
    336: 3321, // trade side -> tradeside
    300: 3824, // shop -> shop_template
    301: 3822, // shop side -> shop_template_side
  };

  // 2007 packed component -> 2006 component
  const coms = {
    [P(149, 0)]: 3214, // inventory items -> inventory:inv
    [P(15, 0)]: 2006, // bank side items -> bank_side:inv
    [P(12, 1)]: 5382, // bank items -> bank_main:bank
    [P(387, 28)]: 1688, // worn items -> wornitems:worn
    [P(363, 1)]: 6980, // puzzle pieces -> trail_puzzle:com_2 (inv_transmit(trail_puzzleinv, trail_puzzle:com_2), trail_puzzle.rs2)
    [P(287, 2)]: 11130, // MM puzzle pieces -> inter_214:com_3 (mm_puzzle.rs2)
  };

  // 2007 inv id -> the 2006 component that shows it
  const invs = {
    93: 3214, // inv -> inventory:inv
    94: 1688, // worn -> wornitems:worn
    95: 5382, // bank -> bank_main:bank
    140: 6980, // trail_puzzleinv -> trail_puzzle:com_2
    221: 11130, // reinitialisation_inv -> inter_214:com_3
  };

  const rev = {};
  const build = () => {
    for (const k of Object.keys(rev)) delete rev[k];
    for (const [k, v] of Object.entries(coms)) rev[v] = Number(k);
  };
  build();

  const isPacked = (id) => typeof id === 'number' && id > 0xffff;
  // a 2007 packed id -> 2006 component (-1: none); a 2006 id as it is
  const com = (id) => (isPacked(id) ? (coms[id >>> 0] !== undefined ? coms[id >>> 0] : -1) : id);
  const group = (g) => (typeof g === 'number' && groups[g] !== undefined ? groups[g] : g);
  const back = (id) => (rev[id] !== undefined ? rev[id] : id);

  const api = {
    groups, coms, invs, com, group, back,
    /** add entries (2007 packed or group -> 2006); plugins may extend the table for what only they use */
    add(table) {
      if (table.groups) Object.assign(groups, table.groups);
      if (table.coms) Object.assign(coms, table.coms);
      if (table.invs) Object.assign(invs, table.invs);
      build();
    },
  };
  ll.if2006 = api;

  // wrap the bridge once the client gives it (setApi), only for the 2006 client
  const setApi = ll.setApi.bind(ll);
  ll.setApi = function (raw) {
    if (ll.c2007 || !raw || raw.__if2006) return setApi(raw);
    const a = Object.assign({}, raw, { __if2006: true });
    const wrapInfo = (asked, info) => {
      if (!info || !isPacked(asked)) return info;
      const out = Object.assign({}, info, { id: asked, raw: info.id });
      if (typeof info.layer === 'number' && info.layer >= 0) out.layer = back(info.layer);
      return out;
    };
    if (raw.com) a.com = (id) => wrapInfo(id, raw.com(com(id)));
    if (raw.comVisible) a.comVisible = (id) => { const c = com(id); return c >= 0 && raw.comVisible(c); };
    for (const k of ['setText', 'setHidden', 'setColour', 'setPosition', 'setSize', 'redraw', 'setScroll', 'comTextWidth', 'comChildren']) {
      if (raw[k]) a[k] = (id, ...rest) => { const c = com(id); return c >= 0 ? raw[k](c, ...rest) : k === 'comTextWidth' ? -1 : null; };
    }
    if (raw.setObjs) a.setObjs = (id, ids, counts) => { const c = com(id); return c >= 0 ? raw.setObjs(c, ids, counts) : null; };
    if (raw.ifOpen) a.ifOpen = (g) => raw.ifOpen(group(g));
    if (raw.comsOf) a.comsOf = (g) => raw.comsOf(group(g)).map((i) => (i && rev[i.id] !== undefined ? Object.assign({}, i, { id: rev[i.id], raw: i.id }) : i));
    if (raw.widgetItems) a.widgetItems = () => { const w = Int32Array.from(raw.widgetItems()); for (let i = 2; i < w.length; i += 6) w[i] = back(w[i]) | 0; return w; };
    if (raw.com) {
      // inventories by 2007 inv id: the items of the component that shows them (ids as the 2007 inv cache: -1 empty)
      a.inv = (id) => {
        const c = invs[id] !== undefined ? raw.com(invs[id]) : null;
        if (c && c.linkObjType) return { ids: Array.from(c.linkObjType), counts: Array.from(c.linkObjNumber || [], (n, i) => (c.linkObjType[i] >= 0 ? n : 0)) };
        return raw.inv ? raw.inv(id) : null;
      };
    }
    return setApi(a);
  };
})();
