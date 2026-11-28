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
    // the option dialogues (2007 228 / 230 / 232 / 234: 2-5 options) -> multi2..multi5 and the duplicates of 4 and 5
    228: 2459, 230: 2469, 232: [2480, 19894], 234: [2492, 19906],
    287: 11126, // Monkey Madness reinitialisation puzzle -> inter_214
    345: 6965, // the clue scroll's text -> trail_cluelong (trail_clue_read.rs2 full_trail_readclue)
    426: 20357, // fairy ring code screen (2007scape's copy of our fairyrings.if) -> fairyrings
    620: 20786, // fairy ring travel log (2007scape's copy of our fairyrings_log.if) -> fairyrings_log
    381: 193, // wilderness level overlay -> wilderness_overlay
    275: 297, // quest / diary scroll -> questscroll
    335: 3323, // trade -> trademain
    336: 3321, // trade side -> tradeside
    300: 3824, // shop -> shop_template
    301: 3822, // shop side -> shop_template_side
    24: 4535, // Barrows brothers overlay -> inter_98 (barrows.rs2 if_openoverlay(inter_98))
    25: 4543, // Barrows door puzzle -> inter_99 (barrows.rs2 barrows_puzzle_open)
    // the reward window, clue and Barrows chest alike -> trail_reward (trail_reward.rs2) and barrows_chest (barrows.rs2)
    364: [6960, 20261],
    367: 4564, // Fishing Trawler's reward -> trawler_catch (trawler_win.rs2)
    392: 21226, // Miscellania's collected resources -> misc_collect (managing_miscellania.rs2)
    // the NPC dialogues with 1-4 lines (2007 241-244, read by rl.npcChatText) -> npcchat1-4 (~chatnpc), and the
    // player's (2007 64-67) -> chat1-4 (~chatplayer): the same layout, head 0, name 1, lines 2.., continue last
    241: 4882, 242: 4887, 243: 4893, 244: 4900,
    64: 968, 65: 973, 66: 979, 67: 986,
    366: 11908, // Fishing Trawler's overlay -> inter_231 (trawler_overlay.rs2 if_openoverlay(inter_231))
    464: 147, // the emote tab -> controls (2006's emotes are on the player controls tab: player_controls.rs2)
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
    [P(239, 0)]: 4262, // music track list (scroll layer) -> music:com_0
    [P(239, 177)]: 5450, // "Playing:" -> music:com_178
    [P(381, 1)]: 195, // Wilderness level text -> wilderness_overlay:com_1 ("Level: %1")
    [P(381, 2)]: 196, // its layer -> wilderness_overlay:com_2
    [P(261, 27)]: 149, // the run energy text "%1%" -> controls:com_1 (script runenergy; the options tab's on 2007)
    // the Trawler overlay's catch and time texts -> inter_231:com_28 ("N fish") and com_29 ("N mins")
    [P(366, 13)]: 11937, [P(366, 14)]: 11938,
    // the emote tab and its buttons (the plugins' 464:n, as Clue Scroll's EMOTES) -> controls and its emote buttons
    // (player_controls.rs2's if_buttons: com_20 yes, com_21 no, com_16 bow ... com_77 the Lost Tribe's goblin dance)
    [P(464, 0)]: 665, // (the emotes' scrolling layer, controls:com_40)
    [P(464, 1)]: 168, [P(464, 2)]: 169, [P(464, 3)]: 164, [P(464, 4)]: 165, [P(464, 5)]: 162, [P(464, 6)]: 163,
    [P(464, 7)]: 13370, [P(464, 8)]: 171, [P(464, 9)]: 167, [P(464, 10)]: 170, [P(464, 11)]: 13366, [P(464, 12)]: 13368,
    [P(464, 13)]: 166, [P(464, 14)]: 13363, [P(464, 15)]: 13364, [P(464, 16)]: 13365, [P(464, 17)]: 161, [P(464, 18)]: 11100,
    [P(464, 19)]: 13362, [P(464, 20)]: 13367, [P(464, 21)]: 172, [P(464, 22)]: 13369, [P(464, 23)]: 13383, [P(464, 24)]: 13384,
  };
  // the clue scroll's eight lines: 2007 345:1-8 -> trail_cluelong:com_2-9 (6968-6975)
  for (let n = 1; n <= 8; n++) coms[P(345, n)] = 6967 + n;

  // whole interfaces 2007scape copied from ours, component for component in the .if's order: 2007 child n is the 2006
  // component (root + 1 + n), as content/pack/interface.pack numbers them
  const ranges = {
    426: { base: 20358, count: 20760 - 20358 }, // fairyrings.if
    620: { base: 20787, count: 21226 - 20787 }, // fairyrings_log.if
    // (the Barrows overlay and puzzle: 2007's are the same layout as ours, child n is com_n: the puzzle's question
    // models are com_1-3 and its answers com_6-8, as RuneLite's BarrowsPlugin reads 25:1 and 25:6-8)
    24: { base: 4536, count: 7 }, // inter_98:com_0-6
    25: { base: 4544, count: 14 }, // inter_99:com_0-13
    // the dialogues (see groups): npcchat1-4 and chat1-4, com_n at root + 1 + n
    241: { base: 4883, count: 4 }, 242: { base: 4888, count: 5 }, 243: { base: 4894, count: 6 }, 244: { base: 4901, count: 6 },
    64: { base: 969, count: 4 }, 65: { base: 974, count: 5 }, 66: { base: 980, count: 6 }, 67: { base: 987, count: 6 },
  };

  // 2007 inv id -> the 2006 component that shows it
  const invs = {
    93: 3214, // inv -> inventory:inv
    94: 1688, // worn -> wornitems:worn
    95: 5382, // bank -> bank_main:bank
    140: 6980, // trail_puzzleinv -> trail_puzzle:com_2
    221: 11130, // reinitialisation_inv -> inter_214:com_3
    141: [6963, 20298], // trail_rewardinv -> trail_reward:inv or barrows_chest:inv (whichever is open)
    0: 4640, // trawler_rewardinv -> trawler_catch:inv
    415: 21230, // misc_collectinv -> misc_collect:inv (managing_miscellania.rs2 inv_transmit)
  };

  const rev = {};
  const grev = {};
  const build = () => {
    for (const k of Object.keys(rev)) delete rev[k];
    for (const [k, v] of Object.entries(coms)) rev[v] = Number(k);
    for (const k of Object.keys(grev)) delete grev[k];
    for (const [k, v] of Object.entries(groups)) for (const x of [].concat(v)) if (grev[x] === undefined) grev[x] = Number(k);
  };
  build();

  const isPacked = (id) => typeof id === 'number' && id > 0xffff;
  // a 2007 packed id -> 2006 component (-1: none); a 2006 id as it is
  const inRange = (id) => { const r = ranges[id >>> 16]; const n = id & 0xffff; return r && n < r.count ? r.base + n : -1; };
  const com = (id) => (isPacked(id) ? (coms[id >>> 0] !== undefined ? coms[id >>> 0] : inRange(id >>> 0)) : id);
  // (a group can stand for several 2006 interfaces: an array; ifOpen is any of them, comsOf the first open one)
  const group = (g) => (typeof g === 'number' && groups[g] !== undefined ? groups[g] : g);
  const back = (id) => {
    if (rev[id] !== undefined) return rev[id];
    for (const [g, r] of Object.entries(ranges)) if (id >= r.base && id < r.base + r.count) return P(Number(g), id - r.base);
    return id;
  };
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
      // the chat box's input line, "Name: text*" (Client draws it; bridge chatInputText puts the app's text in place of
      // what's typed: Key Remapping's "Press Enter to Chat...")
      [P(137, 1)]: raw.chatInputText ? {
        info: () => {
          const c = ll.client; const me = c && c.localPlayer; const name = (me && me.name) || '';
          const shown = raw.chatInputText() ?? ((c && c.chatInput) || '') + '*';
          const t = `${name}: <col=0000ff>${shown}</col>`;
          return { id: P(137, 1), layer: P(548, 90), type: 4, text: t, shown: t, screen: [21, 437], x: 4, y: 80, width: 470, height: 15, colour: 0, hide: false };
        },
        setText: (t) => {
          const s = String(t == null ? '' : t); const i = s.indexOf(':');
          const typed = (i >= 0 ? s.slice(i + 1) : s).replace(/<[^>]*>/g, '').replace(/^ /, '');
          const c = ll.client;
          raw.chatInputText(c && typed === (c.chatInput || '') + '*' ? null : typed);
        },
      } : null,
      // the chat box (2007's chat layer 548:90): hidden while a dialogue covers it (the 2006 chat modal)
      [P(548, 90)]: {
        info: () => { const c = ll.client; return { id: P(548, 90), layer: -1, type: 0, text: null, shown: '', screen: [17, 357], x: 17, y: 357, width: 479, height: 96, colour: 0, hide: !c || !c.ingame || c.chatModalId !== -1 }; },
        setText: () => {},
      },
    };
    const virt = (id) => (isPacked(id) && virtual[id >>> 0]) || null;
    if (raw.com) a.com = (id) => { const v = virt(id); return v ? v.info() : wrapInfo(id, raw.com(com(id))); };
    if (raw.comVisible) a.comVisible = (id) => { if (virt(id)) return true; const c = com(id); return c >= 0 && raw.comVisible(c); };
    if (raw.setText) a.setText = (id, t) => { const v = virt(id); if (v) return v.setText(t); const c = com(id); return c >= 0 ? raw.setText(c, t) : null; };
    for (const k of [ 'setHidden', 'setColour', 'setPosition', 'setSize', 'redraw', 'setScroll', 'comTextWidth', 'comChildren']) {
      if (raw[k]) a[k] = (id, ...rest) => { const c = com(id); return c >= 0 ? raw[k](c, ...rest) : k === 'comTextWidth' ? -1 : null; };
    }
    if (raw.setObjs) a.setObjs = (id, ids, counts) => { const c = com(id); return c >= 0 ? raw.setObjs(c, ids, counts) : null; };
    // interfaces the 2006 client draws itself: the chat box (2007 137) is there while you're logged in
    const virtualGroups = { 137: () => !!(ll.client && ll.client.ingame) };
    const openOf = (g) => { const t = group(g); return Array.isArray(t) ? t.find((x) => raw.ifOpen(x)) ?? t[0] : t; };
    if (raw.ifOpen) a.ifOpen = (g) => (virtualGroups[g] ? virtualGroups[g]() : Array.isArray(group(g)) ? group(g).some((x) => raw.ifOpen(x)) : raw.ifOpen(group(g)));
    if (raw.comsOf) a.comsOf = (g) => raw.comsOf(openOf(g)).map((i) => { if (!i) return i; const b = back(i.id); return b !== i.id ? Object.assign({}, i, { id: b, raw: i.id, layer: i.layer >= 0 ? back(i.layer) : i.layer }) : i; });
    if (raw.componentTable) a.componentTable = () => { const t = raw.componentTable(); for (let i = 0; i < t.length; i += 2) t[i] = groupBack(t[i]); return t; };
    if (raw.subRects) a.subRects = () => { const t = raw.subRects(); for (let i = 0; i < t.length; i += 6) t[i] = groupBack(t[i]); return t; };
    if (raw.widgetItems) a.widgetItems = () => { const w = Int32Array.from(raw.widgetItems()); for (let i = 2; i < w.length; i += 6) w[i] = back(w[i]) | 0; return w; };
    if (raw.com) {
      // inventories by 2007 inv id: the items of the component that shows them (its linkObjType is id + 1; the 2007 inv
      // cache's ids are the id, -1 empty)
      a.inv = (id) => {
        const ids = invs[id] !== undefined ? [].concat(invs[id]) : [];
        const shown = ids.filter((x) => !raw.comVisible || raw.comVisible(x));
        const c = (shown.length ? shown : ids).map((x) => raw.com(x)).find((x) => x && x.linkObjType) || null;
        if (c && c.linkObjType) return { ids: Array.from(c.linkObjType, (v) => v - 1), counts: Array.from(c.linkObjNumber || [], (n, i) => (c.linkObjType[i] > 0 ? n : 0)) };
        return raw.inv ? raw.inv(id) : null;
      };
    }
    // ---- the game's size on screen (2007scape's DisplayScale, which the 2006 client hasn't got): the app's Game size
    // setting (display({ scale: 'off' | 'pixel' | 'smooth' })) and RuneLite's stretched mode (stretch(o): fill the
    // window, keep the aspect ratio, whole-number steps, fast = hard pixel edges), done on the canvas's CSS size
    const DS = { mode: 'off', stretched: { enabled: false, fast: false, integerScaling: false, keepAspectRatio: false, scalingFactor: 50 } };
    const canvasEl = () => document.getElementById('canvas');
    const stretchedDimensions = () => {
      const c = canvasEl(); const realW = c ? c.width || 765 : 765; const realH = c ? c.height || 503 : 503;
      let w = window.innerWidth | 0; let h = window.innerHeight | 0;
      if (DS.stretched.keepAspectRatio) {
        const ar = realW / realH; const tw = Math.trunc(h * ar);
        if (tw > w) h = Math.trunc(w / ar); else w = tw;
      }
      if (DS.stretched.integerScaling) {
        if (w > realW) w -= w % realW;
        if (h > realH) h -= h % realH;
      }
      return { width: w, height: h };
    };
    const applyScale = () => {
      const c = canvasEl();
      if (!c) return;
      if (DS.stretched.enabled) {
        const d = stretchedDimensions();
        c.style.imageRendering = DS.stretched.fast ? 'pixelated' : 'auto';
        c.style.width = `${d.width}px`; c.style.height = `${d.height}px`;
        return;
      }
      c.style.imageRendering = DS.mode === 'smooth' ? 'auto' : 'pixelated';
      if (DS.mode === 'off') { c.style.width = ''; c.style.height = ''; return; }
      let k = Math.min(window.innerWidth / (c.width || 765), window.innerHeight / (c.height || 503));
      if (DS.mode === 'pixel') { const dpr = window.devicePixelRatio || 1; const whole = Math.floor(k * dpr) / dpr; if (whole >= 1 && whole >= k * 0.9) k = whole; }
      c.style.width = `${(c.width || 765) * k}px`; c.style.height = `${(c.height || 503) * k}px`;
    };
    window.addEventListener('resize', applyScale);
    a.display = (o) => {
      if (o && (o.scale === 'off' || o.scale === 'pixel' || o.scale === 'smooth')) { DS.mode = o.scale; applyScale(); }
      if (raw.display) raw.display(o);
    };
    a.displayState = () => Object.assign({}, raw.displayState ? raw.displayState() : {}, { scale: DS.mode });
    a.stretch = (o) => {
      if (raw.stretch) raw.stretch(o); // (SD increased resolution)
      Object.assign(DS.stretched, { enabled: !!(o && o.enabled), fast: !!(o && o.fast), integerScaling: !!(o && o.integerScaling), keepAspectRatio: !!(o && o.keepAspectRatio), scalingFactor: (o && o.scalingFactor) | 0 });
      applyScale();
    };
    a.stretchedDimensions = () => (DS.stretched.enabled ? stretchedDimensions() : { width: 765, height: 503 });
    return setApi(a);
  };
})();
