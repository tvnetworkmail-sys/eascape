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
    345: 6965, // the clue scroll's text -> trail_cluelong (trail_clue_read.rs2 full_trail_readclue)
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
    [P(550, 2)]: 5067, // friends list title -> friends:com_1 ("Friends List")
    [P(551, 2)]: 5717, // ignore list title -> ignore:com_1 ("Ignore List")
    [P(381, 1)]: 195, // Wilderness level text -> wilderness_overlay:com_1 ("Level: %1")
    [P(381, 2)]: 196, // its layer -> wilderness_overlay:com_2
  };
  // the clue scroll's eight lines: 2007 345:1-8 -> trail_cluelong:com_2-9 (6968-6975)
  for (let n = 1; n <= 8; n++) coms[P(345, n)] = 6967 + n;

  // 2007 inv id -> the 2006 component that shows it
  const invs = {
    93: 3214, // inv -> inventory:inv
    94: 1688, // worn -> wornitems:worn
    95: 5382, // bank -> bank_main:bank
    140: 6980, // trail_puzzleinv -> trail_puzzle:com_2
    221: 11130, // reinitialisation_inv -> inter_214:com_3
  };

  const rev = {};
  const grev = {};
  const build = () => {
    for (const k of Object.keys(rev)) delete rev[k];
    for (const [k, v] of Object.entries(coms)) rev[v] = Number(k);
    for (const k of Object.keys(grev)) delete grev[k];
    for (const [k, v] of Object.entries(groups)) if (grev[v] === undefined) grev[v] = Number(k);
  };
  build();

  const isPacked = (id) => typeof id === 'number' && id > 0xffff;
  // a 2007 packed id -> 2006 component (-1: none); a 2006 id as it is
  const com = (id) => (isPacked(id) ? (coms[id >>> 0] !== undefined ? coms[id >>> 0] : -1) : id);
  const group = (g) => (typeof g === 'number' && groups[g] !== undefined ? groups[g] : g);
  const back = (id) => (rev[id] !== undefined ? rev[id] : id);
  const groupBack = (g) => (grev[g] !== undefined ? grev[g] : g);

  // WidgetLoaded / WidgetClosed come from the client with the 2006 root: the plugins get the 2007 group
  for (const name of ['widgetLoaded', 'widgetClosed']) {
    let fn = ll[name];
    Object.defineProperty(ll, name, {
      configurable: true,
      get: () => (typeof fn === 'function' ? (g, ...rest) => fn(groupBack(g), ...rest) : fn),
      set: (v) => { fn = v; },
    });
  }

  const api = {
    groups, coms, invs, com, group, back, groupBack,
    /** add entries (2007 packed or group -> 2006); plugins may extend the table for what only they use */
    add(table) {
      if (table.groups) Object.assign(groups, table.groups);
      if (table.coms) Object.assign(coms, table.coms);
      if (table.invs) Object.assign(invs, table.invs);
      build();
    },
  };
  ll.if2006 = api;

  // ---- menu entries: the RuneLite core and its plugins read and write menu opcodes as the 2007 client's (RuneLite's
  // MenuAction of that client: OPLOC1 7, OPNPC1 17, OPHELD1 28 ...). The 2006 client's are its MiniMenuAction values
  // (webclient src/client/MiniMenuAction.ts). The arguments are in the same order on both (identifier: the NPC index,
  // obj id or loc tag; param0: the slot or x; param1: the component or z). rlMenuArrays(c) is the runtime's
  // menuArrays(c) with the opcodes (and a component in param1) seen as 2007's; writes go back as 2006's.
  const OPS06 = {
    625: 7, 721: 35, 743: 51, 357: 33, 1071: 1004, 1381: 1005, 899: 24, 810: 26, // loc 1-5, examine, spell, use item on
    242: 17, 209: 38, 309: 34, 852: 32, 793: 4, 1714: 1002, 240: 19, 829: 48, // npc
    139: 5, 778: 22, 617: 41, 224: 57, 662: 3, 1152: 1006, 370: 25, 111: 46, // ground obj
    639: 30, 499: 58, 27: 29, 387: 45, 185: 37, 131: 23, 275: 14, // player 1-5, spell, use item on
    694: 28, 962: 9, 795: 2, 681: 21, 100: 18, 1328: 1001, 563: 39, 398: 42, 102: 12, // held 1-5, examine, spell, use on, use
    582: 6, 113: 8, 555: 49, 331: 44, 354: 13, // inv buttons 1-5
    718: 10, 1106: 1007, // walk, cancel
  };
  // 2006 opcodes with no 2007 twin (if buttons, accept trade / duel, friends list...): seen as 10000 + the opcode
  const OTHER06 = new Set([957, 507, 231, 274, 737, 435, 225, 997, 524, 605, 47, 513, 884, 902]);
  const OPS07 = {};
  for (const [k, v] of Object.entries(OPS06)) OPS07[v] = Number(k);
  // opcodes whose param1 is a component (held items, inv buttons)
  const COM_PARAM = new Set([694, 962, 795, 681, 100, 1328, 563, 398, 102, 582, 113, 555, 331, 354]);
  const opRead = (v) => {
    let t = v | 0; let pri = 0;
    if (t >= 2000 && t < 10000) { t -= 2000; pri = 2000; }
    if (OPS06[t] !== undefined) return OPS06[t] + pri;
    if (OTHER06.has(t)) return 10000 + t + pri;
    return v;
  };
  const opWrite = (v) => {
    let t = v | 0; let pri = 0;
    if (t >= 10000) { t -= 10000; if (t >= 2000) { t -= 2000; pri = 2000; } return t + pri; }
    if (t >= 2000 && t < 3500 && OPS07[t - 2000] !== undefined) { t -= 2000; pri = 2000; }
    return OPS07[t] !== undefined ? OPS07[t] + pri : v;
  };
  const isIndex = (k) => typeof k === 'string' && /^\d+$/.test(k);
  const proxies = new WeakMap();
  const viewOf = (target, get, set) => {
    let p = proxies.get(target);
    if (p) return p;
    p = new Proxy(target, {
      get(t, k) { if (isIndex(k)) return get(t, +k); const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; },
      set(t, k, v) { if (isIndex(k)) { set(t, +k, v); return true; } return Reflect.set(t, k, v, t); },
    });
    proxies.set(target, p);
    return p;
  };
  ll.rlMenuArrays = function (c) {
    const arr = ll.menuArrays(c);
    if (ll.c2007) return arr;
    const act = arr[1];
    const comParam = (i) => { let t = act[i] | 0; if (t >= 2000) t -= 2000; return COM_PARAM.has(t); };
    return [arr[0],
      viewOf(act, (t, i) => opRead(t[i]), (t, i, v) => { t[i] = opWrite(v); }),
      arr[2], arr[3],
      viewOf(arr[4], (t, i) => (comParam(i) ? back(t[i]) : t[i]), (t, i, v) => { t[i] = comParam(i) ? com(v) : v; })];
  };
  ll.if2006.menuOp = { read: opRead, write: opWrite };

  // wrap the bridge once the client gives it (setApi), only for the 2006 client
  const setApi = ll.setApi.bind(ll);
  ll.setApi = function (raw) {
    if (ll.c2007 || !raw || raw.__if2006) return setApi(raw);
    const a = Object.assign({}, raw, { __if2006: true });
    // an obj / loc id past the end of the 2006 tables makes the client read garbage forever (ObjType.list): answer
    // null for those (the class's numDefinitions, read off a real type)
    const guard = (k) => {
      if (!raw[k]) return;
      let max = -1;
      a[k] = (id, ...rest) => {
        if (max < 0) { try { const t = raw[k](0); max = t && t.constructor && t.constructor.numDefinitions ? t.constructor.numDefinitions : 0; } catch { max = 0; } }
        return typeof id === 'number' && id >= 0 && (max === 0 || id < max) ? raw[k](id, ...rest) : null;
      };
    };
    guard('obj');
    guard('loc');
    if (raw.objIcon && a.obj) a.objIcon = (id, count) => (a.obj(id) ? raw.objIcon(id, count) : null);
    if (raw.iop && a.obj) a.iop = (id) => (a.obj(id) ? raw.iop(id) : [null, null, null, null, null]);
    const wrapInfo = (asked, info) => {
      if (!info || !isPacked(asked)) return info;
      const out = Object.assign({}, info, { id: asked, raw: info.id });
      if (typeof info.layer === 'number' && info.layer >= 0) out.layer = back(info.layer);
      return out;
    };
    // components the 2006 client draws itself rather than as an interface: answered here, written through a bridge call
    const virtual = {
      // the chat bar's Report Abuse text (Client draws it; bridge reportText)
      [P(548, 26)]: raw.reportText ? {
        info: () => { const t = raw.reportText() || 'Report Abuse'; return { id: P(548, 26), layer: -1, type: 4, text: t, shown: t, screen: [404, 457], x: 404, y: 457, width: 110, height: 22, colour: 0xffffff, hide: false }; },
        setText: (t) => raw.reportText(t == null || t === 'Report Abuse' ? null : String(t)),
      } : null,
    };
    const virt = (id) => (isPacked(id) && virtual[id >>> 0]) || null;
    if (raw.com) a.com = (id) => { const v = virt(id); return v ? v.info() : wrapInfo(id, raw.com(com(id))); };
    if (raw.comVisible) a.comVisible = (id) => { if (virt(id)) return true; const c = com(id); return c >= 0 && raw.comVisible(c); };
    if (raw.setText) a.setText = (id, t) => { const v = virt(id); if (v) return v.setText(t); const c = com(id); return c >= 0 ? raw.setText(c, t) : null; };
    for (const k of [ 'setHidden', 'setColour', 'setPosition', 'setSize', 'redraw', 'setScroll', 'comTextWidth', 'comChildren']) {
      if (raw[k]) a[k] = (id, ...rest) => { const c = com(id); return c >= 0 ? raw[k](c, ...rest) : k === 'comTextWidth' ? -1 : null; };
    }
    if (raw.setObjs) a.setObjs = (id, ids, counts) => { const c = com(id); return c >= 0 ? raw.setObjs(c, ids, counts) : null; };
    if (raw.ifOpen) a.ifOpen = (g) => raw.ifOpen(group(g));
    if (raw.comsOf) a.comsOf = (g) => raw.comsOf(group(g)).map((i) => (i && rev[i.id] !== undefined ? Object.assign({}, i, { id: rev[i.id], raw: i.id }) : i));
    if (raw.componentTable) a.componentTable = () => { const t = raw.componentTable(); for (let i = 0; i < t.length; i += 2) t[i] = groupBack(t[i]); return t; };
    if (raw.subRects) a.subRects = () => { const t = raw.subRects(); for (let i = 0; i < t.length; i += 6) t[i] = groupBack(t[i]); return t; };
    if (raw.widgetItems) a.widgetItems = () => { const w = Int32Array.from(raw.widgetItems()); for (let i = 2; i < w.length; i += 6) w[i] = back(w[i]) | 0; return w; };
    if (raw.com) {
      // inventories by 2007 inv id: the items of the component that shows them (its linkObjType is id + 1; the 2007 inv
      // cache's ids are the id, -1 empty)
      a.inv = (id) => {
        const c = invs[id] !== undefined ? raw.com(invs[id]) : null;
        if (c && c.linkObjType) return { ids: Array.from(c.linkObjType, (v) => v - 1), counts: Array.from(c.linkObjNumber || [], (n, i) => (c.linkObjType[i] > 0 ? n : 0)) };
        return raw.inv ? raw.inv(id) : null;
      };
    }
    return setApi(a);
  };
})();
