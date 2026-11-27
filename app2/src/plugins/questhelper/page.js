// Quest Helper, page side. Two jobs:
//   1. Read quest progress: each guided quest's variables, which the server sends live once
//      asked (::appquests), and what the game shows (the quest list colours, the quest journal
//      when it's open, conversation text, game messages, NPCs about); send it to the game-side
//      engine when it changes.
//   2. Draw the current step: the NPC, object or item to use, the route to walk there (a
//      line on the ground, like RuneLite's Quest Helper with Shortest Path), the game's
//      hint arrow, and the dialogue option to pick.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  let cfg = {};
  let lastSent = '';
  let lastPoll = 0;
  let loginAt = 0;
  let chatTop = null; // the newest chat line we have seen
  let liveAsked = ''; // the ::appquests request sent this login (the varp ids; EASCape)
  let liveSince = 0;
  // 2007RS: the server sends the n-th variable asked for to client varp 1600 + n (Player.ts
  // APP_QUEST_BASE), not its own id: the 2007 client gives its own varps other meanings
  const LIVE_BASE = 1600;
  // ...and how many it is sending to client varp 1900 (Player.ts APP_QUEST_MARK; 0 after a login)
  const LIVE_MARK = 1900;
  let liveMarked = false; // this server sends the count (an older one doesn't: read without it)
  let liveResent = 0; // times the list was asked for again after the server lost it
  const command = (text) => !!(ll.api && ll.api.command && ll.api.command(text));
  const RED = 0xff0000;
  const YELLOW = 0xffff00;
  const GREEN = 0x00ff00;

  function rgb(hex, fallback) {
    const n = parseInt(String(hex || '').replace('#', '').slice(-6), 16);
    return Number.isFinite(n) ? n : fallback;
  }

  function list() {
    return ll.api && ll.api.ifList ? ll.api.ifList() : null;
  }

  function textOf(com) {
    const f = ll.fields;
    if (!com) return '';
    const t = f.comText ? com[f.comText] : null;
    return typeof t === 'string' ? t : '';
  }

  /** Text of every visible text component under an interface, in order. */
  function texts(rootId) {
    const f = ll.fields;
    if (ll.c2007 && ll.api && ll.api.comsOf) {
      // 2007RS: the interface's components, shown ones only, top to bottom
      return ll.api.comsOf(rootId).filter((x) => x && x.text && !x.hide && ll.api.comVisible(x.id)).sort((a, b) => a.y - b.y || a.x - b.x)
        .map((x) => ({ com: x, text: String(x.text).replace(/<[^>]*>/g, ''), button: x.buttonType }));
    }
    const L = list();
    if (!L || !f.comChildren) return [];
    const out = [];
    const walk = (com, depth) => {
      if (!com || depth > 5 || (f.comHide && com[f.comHide])) return;
      const t = textOf(com);
      if (t) out.push({ com, text: t, button: com[f.comButtonType] });
      for (const ch of com[f.comChildren] || []) walk(L[ch], depth + 1);
    };
    walk(L[rootId], 0);
    return out;
  }

  /** The quest list's colour. The server sends 5 bits per channel, so green arrives as
   *  0x00f800, not 0x00ff00: go by which channels are lit. */
  function colourName(v) {
    if (typeof v !== 'number') return null;
    const r = (v >> 16) & 255;
    const gr = (v >> 8) & 255;
    const b = v & 255;
    if (b > 100) return null;
    if (r > 160 && gr > 160) return 'yellow';
    if (r > 160 && gr < 100) return 'red';
    if (gr > 160 && r < 100) return 'green';
    return null;
  }

  /** New game messages since last time (type 0 lines at the top of the chat history). */
  function newMessages(c) {
    const f = ll.fields;
    const types = c[f.chatType];
    const textsArr = c[f.chatText];
    if (!types || !textsArr) return [];
    const top = `${textsArr[0]}|${textsArr[1]}|${textsArr[2]}`;
    if (chatTop === null) {
      chatTop = top;
      return [];
    }
    if (top === chatTop) return [];
    const out = [];
    for (let i = 0; i < 20; i++) {
      if (`${textsArr[i]}|${textsArr[i + 1]}|${textsArr[i + 2]}` === chatTop) break;
      if (types[i] === 0 && textsArr[i]) out.push(String(textsArr[i]));
    }
    chatTop = top;
    return out;
  }

  function poll(g) {
    const c = g.client;
    const f = ll.fields;
    const now = performance.now();
    if (now - lastPoll < 250) return;
    lastPoll = now;
    const data = { list: {}, journal: null, dialogue: null, npcs: [], unlocks: [] };
    const vars = f.varps ? c[f.varps] : null;
    // EASCape: what the routes may use: the fairy rings once Fairytale II reaches 40, the Godfather's
    // permission (varp 776 queencure_multi, fairy2_queencure_quest in bits 0-6)
    data.unlocks = vars && ll.loggedIn && ((vars[776] | 0) & 127) >= 40 ? ['fairyrings'] : [];
    const L = list();
    // The quest list starts out all red; the server colours it just after login. Wait a
    // moment before believing it, or every quest would look not started.
    if (!ll.loggedIn) loginAt = 0;
    else if (!loginAt) loginAt = now;
    if (ll.c2007 && ll.api && ll.api.com) {
      // 2007RS: the 2007 quest list (274) and journal (275), by the 2007 client's component ids
      const text07 = (id) => {
        const x = ll.api.com(id);
        return x && typeof x.text === 'string' ? x.text.replace(/<[^>]*>/g, '') : '';
      };
      if (loginAt && now - loginAt > 6000) {
        for (const [key, id] of Object.entries(cfg.listComs2007 || {})) {
          const x = ll.api.com(id);
          const name = x && colourName(x.colour);
          if (name) data.list[key] = name;
        }
      }
      const j = cfg.journal2007;
      if (j && c[f.mainModal] === j.root) {
        data.journal = { title: text07(j.title), lines: j.lines.map(text07).filter(Boolean) };
      }
    } else {
      if (L && f.comColour && loginAt && now - loginAt > 6000) {
        for (const [key, id] of Object.entries(cfg.listComs || {})) {
          const com = L[id];
          const name = com && colourName(com[f.comColour]);
          if (name) data.list[key] = name;
        }
      }
      if (cfg.journal && f.mainModal && c[f.mainModal] === cfg.journal.root) {
        const lines = cfg.journal.lines.map((id) => textOf(L && L[id])).filter(Boolean);
        data.journal = { title: textOf(L && L[cfg.journal.title]), lines };
      }
    }
    if (f.chatModal && c[f.chatModal] >= 0) {
      // what's said, not the options on offer (picking one is what moves a quest on)
      data.dialogue = texts(c[f.chatModal]).filter((t) => t.button !== 1).map((t) => t.text).join(' ');
    }
    // EASCape: ask the server to send each guide's variables as they change (::appquests, app
    // only), then read them from the client: the quest's real stage, live.
    // 2007RS: the server also says how many it is sending (client varp LIVE_MARK, reset to 0 at
    // every login). The client stays "logged in" through a reconnect, even to a server that was
    // restarted and has forgotten the list, so the app asks again whenever that count isn't the
    // one it asked for, and only reads the values while it is.
    const want = (cfg.live || []).join(',');
    const wantCount = want ? want.split(',').length : 0;
    const mark = vars ? vars[LIVE_MARK] | 0 : 0;
    if (mark) liveMarked = true;
    const registered = !liveMarked || mark === wantCount;
    if (!ll.loggedIn) {
      liveAsked = '';
      liveSince = 0;
    } else if (want && liveAsked === want && !registered && now - liveSince >= 4000) {
      // the server lost the list (restarted, or a new login it took as a reconnect): ask again
      liveAsked = '';
      liveSince = now - 1500;
      liveResent++;
    }
    if (ll.loggedIn && want && liveAsked !== want) {
      if (!liveSince) liveSince = now;
      // a command is a chat line (80 characters at most), so the ids go a few at a time: the
      // first line replaces the list, the rest (+...) add to it, in order
      const chunks = [];
      for (const id of want.split(',')) {
        const last = chunks[chunks.length - 1];
        if (last && last.length + id.length < 60) chunks[chunks.length - 1] = `${last},${id}`;
        else chunks.push(id);
      }
      if (now - liveSince >= 1500 && chunks.every((s, i) => command(`appquests ${i ? '+' : ''}${s}`))) {
        liveAsked = want;
        liveSince = now; // the server answers within a tick or two: read them after that
      }
    }
    if (liveAsked && registered && now - liveSince >= 2000 && vars) {
      data.varps = {};
      liveAsked.split(',').forEach((id, slot) => {
        data.varps[id] = vars[LIVE_BASE + slot] | 0;
      });
    }
    const ids = new Set();
    for (const n of g.npcs()) ids.add(n.id);
    data.npcs = [...ids].sort((a, b) => a - b);
    const key = JSON.stringify(data);
    const msgs = newMessages(c);
    if (key !== lastSent || msgs.length) {
      lastSent = key;
      data.messages = msgs;
      window.postMessage({ __lostlite: true, type: 'questhelper-input', data }, '*');
    }
  }

  // ---------------------------------------------------------------- drawing

  function local(g, wx, wz) {
    return { x: (wx - g.baseX) * 128 + 64, z: (wz - g.baseZ) * 128 + 64 };
  }

  function inScene(g, wx, wz) {
    const sx = wx - g.baseX;
    const sz = wz - g.baseZ;
    return sx >= 0 && sz >= 0 && sx < 104 && sz < 104;
  }

  /** The route as a line on the ground, through the corners on this floor. */
  function drawRoute(g, colour) {
    const pts = cfg.route || [];
    const p0 = g.player();
    const me = p0 ? { x: g.baseX + (p0.x >> 7), z: g.baseZ + (p0.z >> 7) } : null;
    const reach = Math.max(10, (ll.radius || 25) - 2);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a.level !== g.level || b.level !== g.level) continue;
      if (a.via) continue; // stairs / ladder / trapdoor: a jump, not a walk
      if (!inScene(g, a.x, a.z) && !inScene(g, b.x, b.z)) continue;
      // walk the segment a few squares at a time, so it follows the ground's height
      const steps = Math.max(1, Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z)));
      let prev = null;
      for (let s = 0; s <= steps; s++) {
        const wx = a.x + ((b.x - a.x) * s) / steps;
        const wz = a.z + ((b.z - a.z) * s) / steps;
        // only where the game draws the ground (its draw distance), not out in the dark
        if (!inScene(g, Math.round(wx), Math.round(wz)) || !me || Math.max(Math.abs(wx - me.x), Math.abs(wz - me.z)) > reach) {
          prev = null;
          continue;
        }
        const l = local(g, wx, wz);
        const p = g.project(l.x, l.z, 0);
        if (p && prev) {
          g.line(prev.x, prev.y, p.x, p.y, colour);
          g.line(prev.x, prev.y + 1, p.x, p.y + 1, colour);
        }
        prev = p;
      }
    }
    // stairs and ladders on the way: mark the square
    for (const p of pts) {
      if (!p.via || p.level !== g.level || !inScene(g, p.x, p.z)) continue;
      const poly = g.tilePoly(p.x - g.baseX, p.z - g.baseZ);
      if (poly) g.polygon(poly, colour, { fillAlpha: 50, width: 1 });
    }
  }

  function frame(g) {
    poll(g);
    const s = cfg.step;
    if (!s) {
      if (marked.length || marked07.length) markOptions(g, { options: [] });
      if (cfg.hinted) {
        g.setHint(null);
        cfg.hinted = false;
      }
      return;
    }
    const colour = rgb(cfg.colour, 0x00ffff);
    if (cfg.showRoute) drawRoute(g, colour);
    let hint = null;
    const me = g.player();
    // NPCs to talk to / use something on
    if (s.npc && s.npc.length) {
      const ids = new Set(s.npc);
      let best = 1e9;
      for (const n of g.npcs()) {
        if (!ids.has(n.id)) continue;
        if (cfg.highlight) {
          const hull = g.hull(n.typecode);
          if (hull) g.polygon(hull, colour, { fillAlpha: 30, width: 2 });
          else {
            const poly = g.areaPoly(n.x, n.z, n.size);
            if (poly) g.polygon(poly, colour, { fillAlpha: 30, width: 2 });
          }
        }
        const d = me ? Math.hypot(n.x - me.x, n.z - me.z) : 0;
        if (d < best) {
          best = d;
          hint = { npc: n.index };
        }
      }
    }
    // Object (scenery) to use: its squares
    if (s.locAt && s.locAt[2] === g.level && inScene(g, s.locAt[0], s.locAt[1]) && cfg.highlight) {
      const size = s.locSize || [1, 1];
      for (let i = 0; i < size[0]; i++) {
        for (let j = 0; j < size[1]; j++) {
          const poly = g.tilePoly(s.locAt[0] - g.baseX + i, s.locAt[1] - g.baseZ + j);
          if (poly) g.polygon(poly, colour, { fillAlpha: 45, width: 2 });
        }
      }
    }
    // Ground item to pick up: every square it's lying on nearby
    if (s.obj && s.obj.length && cfg.highlight) {
      const want = new Set(s.obj);
      const cx = s.at ? s.at[0] - g.baseX : 52;
      const cz = s.at ? s.at[1] - g.baseZ : 52;
      for (let x = Math.max(0, cx - 12); x < Math.min(104, cx + 13); x++) {
        for (let z = Math.max(0, cz - 12); z < Math.min(104, cz + 13); z++) {
          const items = g.groundItems(x, z);
          if (!items || !items.some((it) => want.has(it.id))) continue;
          const poly = g.tilePoly(x, z);
          if (poly) g.polygon(poly, colour, { fillAlpha: 60, width: 2 });
          if (!hint) hint = { x: x + g.baseX, z: z + g.baseZ, height: 0 };
        }
      }
    }
    if (!hint && s.at && s.at[2] === g.level) hint = { x: s.at[0], z: s.at[1], height: 0 };
    // When the target is far away, point the arrow at where the route leaves the loaded area.
    if (hint && hint.x !== undefined && !inScene(g, hint.x, hint.z) && cfg.route) {
      const next = cfg.route.find((p) => p.level === g.level && inScene(g, p.x, p.z) && p !== cfg.route[0]);
      const far = [...cfg.route].reverse().find((p) => p.level === g.level && inScene(g, p.x, p.z));
      if (far || next) hint = { x: (far || next).x, z: (far || next).z, height: 0 };
    }
    if (cfg.hintArrow) {
      g.setHint(hint);
      cfg.hinted = true;
    } else if (cfg.hinted) {
      g.setHint(null);
      cfg.hinted = false;
    }
    if (s.dig && s.at && s.at[2] === g.level && inScene(g, s.at[0], s.at[1])) {
      const p = g.project(...Object.values(local(g, s.at[0], s.at[1])), 40);
      if (p) g.text('Dig here', p.x - (g.textWidth('Dig here') >> 1), p.y, colour);
    }
    markOptions(g, s);
  }

  /** The dialogue option(s) this step wants: shown in green, like Quest Helper does. */
  const MARK = '@gre@';
  let marked = [];
  // 2007RS: the 2007 option texts, by component id (ll.api.setText; colours as <col=...>)
  const MARK07 = '<col=00ff00>';
  let marked07 = [];
  function markOptions2007(g, s) {
    const f = ll.fields;
    const c = g.client;
    const want = cfg.markOptions ? (s.options || []).map((o) => norm(o)) : [];
    const plain = (t) => norm(String(t).replace(/<[^>]*>/g, '').replace(/^\d\. /, ''));
    for (const id of marked07) {
      const x = ll.api.com(id);
      if (x && typeof x.text === 'string' && x.text.includes(MARK07) && !want.includes(plain(x.text))) ll.api.setText(id, x.text.replace(MARK07, ''));
    }
    marked07 = marked07.filter((id) => {
      const x = ll.api.com(id);
      return x && typeof x.text === 'string' && x.text.includes(MARK07);
    });
    const root = c[f.chatModal];
    if (!want.length || !(root >= 0)) return;
    for (const x of ll.api.comsOf(root)) {
      if (!x || !x.text || x.hide || !(x.pausable || x.buttonType === 1) || x.text.includes(MARK07)) continue;
      if (!want.includes(plain(x.text))) continue;
      const num = /^(\d\. )/.exec(x.text);
      ll.api.setText(x.id, num ? num[1] + MARK07 + x.text.slice(num[1].length) : MARK07 + x.text);
      marked07.push(x.id);
    }
  }

  function markOptions(g, s) {
    const f = ll.fields;
    const c = g.client;
    if (ll.c2007 && ll.api && ll.api.comsOf) return markOptions2007(g, s);
    const want = cfg.markOptions ? (s.options || []).map((o) => norm(o)) : [];
    const plain = (t) => norm(t.replace(/^\d\. /, ''));
    // take marks off options this step doesn't want (any more)
    for (const m of marked) {
      const t = m.com[f.comText];
      if (typeof t === 'string' && t.includes(MARK) && !want.includes(plain(t.replace(MARK, '')))) {
        m.com[f.comText] = t.replace(MARK, '');
        if (f.redrawChat) c[f.redrawChat] = true;
      }
    }
    marked = marked.filter((m) => typeof m.com[f.comText] === 'string' && m.com[f.comText].includes(MARK));
    if (!want.length || !cfg.markOptions || !f.chatModal || !(c[f.chatModal] >= 0) || !f.comText) return;
    for (const t of texts(c[f.chatModal])) {
      if (t.button !== 1 || t.text.includes(MARK)) continue;
      if (!want.includes(plain(t.text))) continue;
      const num = /^(\d\. )/.exec(t.text);
      t.com[f.comText] = num ? num[1] + MARK + t.text.slice(num[1].length) : MARK + t.text;
      marked.push({ com: t.com });
      if (f.redrawChat) c[f.redrawChat] = true;
    }
  }

  function norm(s) {
    return String(s).replace(/@[a-z0-9]{3}@/gi, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }


  // ---- DEV / TESTING ONLY: right-click a quest in the quest list -> "Mark done" (sends
  // ::questdone, which only works while the server is in test mode) and "Mark undone" (sends
  // ::questreset: back to not started, to test it again). Remove this, its option in
  // descriptor.js and devMarkDone in game.js when testing is done (battle plan reminder).
  const QUEST_DONE_KEYS = {"Black Knights' Fortress": "spy", "Cook's Assistant": "cookquest", "Demon Slayer": "demonstart", "Rune Mysteries Quest": "runemysteries", "Doric's Quest": "doricquest", "The Restless Ghost": "prieststart", "Goblin Diplomacy": "goblinquest", "Ernest the Chicken": "haunted", "Imp Catcher": "imp", "Pirate's Treasure": "hunt", "Prince Ali Rescue": "princequest", "Romeo & Juliet": "rjquest", "Sheep Shearer": "sheep", "The Knight's Sword": "squire", "Vampire Slayer": "vampire", "Witch's Potion": "hetty", "Watch Tower": "itwatchtower", "Waterfall Quest": "waterfall_quest", "Witch's House": "ballquest", "Biohazard": "biohazard", "Digsite Quest": "itexamlevel", "Big Chompy Bird Hunting": "chompybird", "Dwarf Cannon": "mcannon", "Family Crest": "crestquest", "Fight Arena": "arenaquest", "Fishing Contest": "fishingcompo", "Gertrude's Cat": "fluffs", "The Grand Tree": "grandtree", "Hazeel Cult": "hazeelcultquest", "Heroes Quest": "heroquest", "Jungle Potion": "junglepotion", "Legends Quest": "legendsquest", "Lost City": "zanaris", "Merlin's Crystal": "arthur", "Monk's Friend": "drunkmonkquest", "Murder Mystery": "murderquest", "Observatory Quest": "itgronigen", "Plague City": "elenaquest", "Scorpion Catcher": "scorpcatcher", "Sea Slug Quest": "seaslugquest", "Sheep Herder": "sheepherderquest", "Shilo Village": "zombiequeen", "Temple of Ikov": "ikov", "The Tourist Trap": "desertrescue", "Tree Gnome Village": "treequest", "Tribal Totem": "totemquest", "Underground Pass": "upass", "Dragon Slayer": "dragonquest", "Druidic Ritual": "druidquest", "Priest in Peril": "priestperil", "Nature Spirit": "naturespirit", "Death Plateau": "death_equiproom", "Troll Stronghold": "troll_quest", "Troll Romance": "troll_love", "The Golem": "golem_a", "Desert Treasure": "deserttreasure", "A Fairy Tale Pt. 1": "fairytale1", "Fairytale II - Cure a Queen": "fairytale2", "Holy Grail": "grail", "Shield of Arrav": "blackarmgang", "Eadgar's Ruse": "eadgar", "Horror from the Deep": "horror", "Shades of Mort'ton": "mortton", "Regicide": "regicide", "Tai Bwo Wannai Trio": "tbwt", "The Fremennik Trials": "viking", "Monkey Madness": "mm", "Throne of Miscellania": "misc", "Haunted Mine": "hauntedmine", "In Search of the Myreque": "routequest"};
  // 2007RS: the 2007 quest list's names for the quests it calls differently, and the quests
  // EASCape added after 2006 (::questdone knows them). Quests our game doesn't have get no entry.
  Object.assign(QUEST_DONE_KEYS, {
    'Rune Mysteries': 'runemysteries', 'Between a Rock...': 'dwarfrock', 'Creature of Fenkenstrain': 'fenkenstrain',
    'The Digsite': 'itexamlevel', 'Fairytale I - Growing Pains': 'fairytale1', 'The Feud': 'feud', 'Ghosts Ahoy': 'ghostsahoy',
    "Icthlarin's Little Helper": 'ics', 'Mountain Daughter': 'mdaughter', 'One Small Favour': 'onesmallfavour',
    'Roving Elves': 'roving', 'Sea Slug': 'seaslugquest', 'Watchtower': 'itwatchtower',
  });
  const QUEST_LIST_2007 = 274;
  function menu(c, arrays, rt) {
    if (!cfg.devMarkDone || !ll.api || !ll.api.command) return;
    const f = rt.fields;
    const n = c[f.menuCount];
    for (let i = n - 1; i >= 0; i--) {
      let text = String(arrays[0][i] || '');
      let colour = null; // the line's colour in the list: red not started, yellow started, green done
      if (ll.c2007) {
        // the 2007 list's lines say "Read Journal"; the quest is the line's own text
        const com = arrays[4][i];
        if (text !== 'Read Journal' || com >>> 16 !== QUEST_LIST_2007 || !ll.api.com) continue;
        const info = ll.api.com(com);
        text = String((info && info.text) || '').replace(/<[^>]*>/g, '').trim();
        colour = info ? colourName(info.colour) : null;
      } else {
        const L = list();
        const com = L && f.comColour ? L[arrays[4][i]] : null;
        colour = com ? colourName(com[f.comColour]) : null;
      }
      const key = QUEST_DONE_KEYS[text];
      if (!key) continue;
      // the menu lists bottom up: "Mark done" above "Mark undone". A colour we can't tell gets both.
      if (colour !== 'green') rt.insertMenuEntry(c, i, `Mark done @lre@${text}`, () => ll.api.command(`questdone ${key}`));
      if (colour !== 'red') rt.insertMenuEntry(c, i, `Mark undone @lre@${text}`, () => ll.api.command(`questreset ${key}`));
      return;
    }
  }

  ll.registerPlugin('questhelper', {
    menu,
    configure(config) {
      const hinted = cfg.hinted;
      cfg = config || {};
      cfg.hinted = hinted;
      if (!cfg.step && ll.client && hinted) {
        ll.setHint(ll.client, null);
        cfg.hinted = false;
      }
    },
    frame,
    stop() {
      if (ll.client && cfg.hinted) ll.setHint(ll.client, null);
      cfg = {};
    },
  });

  ll.__questHelper = { texts, newMessages, poll: (g) => { lastPoll = 0; poll(g); }, live: () => ({ asked: liveAsked, ids: (cfg.live || []).length, mark: ll.client && ll.fields.varps ? ll.client[ll.fields.varps][LIVE_MARK] | 0 : null, marked: liveMarked, resent: liveResent }) };
})();
