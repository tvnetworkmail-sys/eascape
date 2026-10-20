// LostLite in-page runtime. Prepended to the live client.js, so it runs in the game
// page's own JS context. The one-line hook in the packet reader calls tick(client) many
// times per frame while connected; that both captures the Client instance and tells us
// whether you are logged in. State is read through the field map the patcher discovered
// and reported to the app with window.postMessage (picked up by the game preload).
// Commands come back the same way ({ __lostliteCmd: ... }).
(function () {
  'use strict';
  if (window.__lostlite) return;

  const SKILLS = ['attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic',
    'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting', 'smithing',
    'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft'];
  const LOGOUT_AFTER_MS = 3000;

  /** Andrew's monotone chain convex hull. */
  function convexHull(points) {
    const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function post(type, data) {
    try {
      window.postMessage({ __lostlite: true, type, data }, '*');
    } catch (e) { /* never let reporting break the game */ }
  }

  const ll = {
    client: null,
    info: null,
    fields: {},
    zoom: 1,
    far: 3500, // model far clip; the patched renderer reads this every frame
    radius: 25, // tiles drawn around the camera (baked into the patched client)
    vis: null, // { world, method, args } of the visibility pre-calculation
    visTimer: 0,
    recomputing: false,
    lastTick: 0,
    loggedIn: false,
    lastStats: null,

    configure(info) {
      this.info = info;
      this.fields = info.fields || {};
      if (info.features && info.features.drawDistance) this.radius = info.features.drawDistance;
      this.updateFar();
      post('runtime-ready', info);
      setInterval(() => this.poll(), 300);
    },

    // Called from the packet reader. Must stay as cheap as possible.
    tick(client) {
      this.lastTick = performance.now();
      if (this.client !== client) {
        this.client = client;
        post('hooked', { fields: Object.keys(this.fields) });
        this.hookChat(client);
      }
      if (this.iconQueue.size) this.drawIcons();
    },

    // ---- item icons: the game's own 32 x 32 inventory icon for an item, as ARGB pixels
    // ({ w, h, px }, 0 = see-through). Drawn by the client between frames (asked for here,
    // ready on a later frame), then kept.
    iconCache: new Map(),
    iconQueue: new Set(),

    itemIcon(id) {
      const c = this.iconCache.get(id);
      if (c && c.px) return c;
      // Not drawn yet, or the item's model hadn't loaded (the web client fetches models as
      // they're needed): ask again every second for a while.
      const now = performance.now();
      if (c && (c.tries >= 60 || now < c.retryAt)) return null;
      if (this.api && this.api.objIcon && this.fields.iconData) this.iconQueue.add(id);
      else if (!this.iconsMissing) {
        this.iconsMissing = true;
        post('log', `item icons unavailable (draw: ${!!(this.api && this.api.objIcon)}, pixels: ${!!this.fields.iconData})`);
      }
      return null;
    },

    /** The item's icon as a PNG data URL, for sidebar panels (3.7: icons come from the 2004
     *  client itself). null until the game has drawn it; ask again on a later frame. */
    iconUrls: new Map(),
    itemIconUrl(id) {
      if (this.iconUrls.has(id)) return this.iconUrls.get(id);
      const icon = this.itemIcon(id);
      if (!icon || typeof document === 'undefined' || !document.createElement) return null;
      try {
        const cv = document.createElement('canvas');
        cv.width = icon.w;
        cv.height = icon.h;
        const cx = cv.getContext('2d');
        const img = cx.createImageData(icon.w, icon.h);
        for (let i = 0; i < icon.px.length; i++) {
          const p = icon.px[i];
          img.data[i * 4] = (p >> 16) & 255;
          img.data[i * 4 + 1] = (p >> 8) & 255;
          img.data[i * 4 + 2] = p & 255;
          img.data[i * 4 + 3] = (p >>> 24) & 255;
        }
        cx.putImageData(img, 0, 0);
        const url = cv.toDataURL('image/png');
        this.iconUrls.set(id, url);
        return url;
      } catch {
        return null;
      }
    },

    drawIcons() {
      const now = performance.now();
      for (const id of this.iconQueue) {
        this.iconQueue.delete(id);
        let icon = null;
        try {
          const sprite = this.api.objIcon(id, 1);
          const data = sprite && sprite[this.fields.iconData];
          if (data && data.length === 1024) {
            const px = new Array(1024);
            let any = false;
            for (let i = 0; i < 1024; i++) {
              px[i] = data[i] === 0 ? 0 : (0xff000000 | data[i]) >>> 0;
              if (data[i] > 1) any = true;
            }
            if (any) icon = { w: 32, h: 32, px };
          }
        } catch (e) {
          post('runtime-error', `item icon ${id}: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`);
        }
        const before = this.iconCache.get(id);
        const tries = ((before && before.tries) || 0) + 1;
        this.iconCache.set(id, icon || { tries, retryAt: now + 1000 });
        // say once how it went, so a missing picture can be traced in the log
        if (icon || tries === 1 || tries === 60) post('log', `item icon ${id}: ${icon ? 'drawn' : `not ready (try ${tries})`}`);
      }
    },

    // ---- info boxes from other plugins: each provider is called every frame and returns
    // boxes ({ name, priority, image, text, colour, tooltip }) for the Info Boxes plugin.
    infoBoxProviders: new Map(),

    addInfoBoxes(id, fn) {
      this.infoBoxProviders.set(id, fn);
    },

    // ---- overlay panels (RuneLite's OverlayPanel, e.g. Opponent Information): each provider
    // returns panels ({ name, rows: [{ type: 'title', text } | { type: 'bar', fraction, text,
    // fg, bg }] }); the Info Boxes plugin places, draws and moves them with the boxes.
    overlayPanels: new Map(),

    addOverlayPanel(id, fn) {
      this.overlayPanels.set(id, fn);
    },

    // ---- things drawn in the world at screen size (RuneLite's ProgressPieComponent and
    // the like): fn(g) returns ops in game view pixels, e.g. { op: 'pie', x, y, progress,
    // fill, border, diameter }. Drawn by the Info Boxes plugin under the boxes.
    screenDraws: new Map(),

    addScreenDraw(id, fn) {
      this.screenDraws.set(id, fn);
    },

    // ---- text drawn on inventory items (RuneLite's WidgetItemOverlay, e.g. the Slayer
    // plugin's count on the enchanted gem): each provider gets (objId, componentId) and
    // returns { text, colour } or null. Called by the client as it draws each item.
    itemTextProviders: new Map(),

    addItemText(id, fn) {
      this.itemTextProviders.set(id, fn);
    },

    itemText(obj, com) {
      for (const [id, fn] of this.itemTextProviders) {
        const pl = this.pagePlugins.get(id);
        if (pl && !pl.enabled) continue;
        try {
          const r = fn(obj, com);
          if (r && r.text) return r;
        } catch {
          /* never stop the game drawing its items */
        }
      }
      return null;
    },

    // ---- chat messages (2.7): every line the game adds to the chat box, as it's added.
    // addChat(type, text, sender): 0 game message, 1 public (with a crown), 2 public,
    // 3 private from, 4 trade request, 5 friend logged in/out, 6 private to, 7 private from
    // a moderator, 8 duel request.
    CHAT_KINDS: ['game', 'public', 'public', 'private', 'trade', 'friend', 'private-sent', 'private', 'duel'],

    hookChat(c) {
      const f = this.fields;
      if (!f.addChat || typeof c[f.addChat] !== 'function') return;
      const orig = c[f.addChat];
      const self = this;
      c[f.addChat] = function addChat(type, text, sender) {
        let replaced = null;
        try {
          replaced = self.onChat(type, text, sender);
        } catch {
          /* never stop the game adding its message */
        }
        // a plugin can change the line (RuneLite's setRuneLiteFormatMessage, for !task)
        if (typeof replaced === 'string') return orig.call(this, type, replaced, sender);
        return orig.apply(this, arguments);
      };
    },

    onChat(type, text, sender) {
      const strip = (s) => String(s == null ? '' : s).replace(/@[a-z0-9~]{3}@/gi, '');
      const msg = {
        type: type | 0,
        kind: this.CHAT_KINDS[type | 0] || 'other',
        name: strip(sender).replace(/^@cr\d@/, '') || null,
        crown: /^@cr(\d)@/.test(String(sender || '')) ? +/^@cr(\d)@/.exec(String(sender))[1] : 0,
        text: strip(text),
        time: Date.now(),
        own: !!this.addingOwn, // a line LostLite added itself (a notification)
      };
      this.chatLog.push(msg);
      if (this.chatLog.length > 100) this.chatLog.shift();
      for (const p of this.activePlugins) {
        if (!p.impl.chat) continue;
        try {
          p.impl.chat(msg);
        } catch (e) {
          post('runtime-error', `${p.id} chat: ${e && e.message}`);
        }
      }
      post('chat', msg);
      return typeof msg.replace === 'string' ? msg.replace : null;
    },

    chatLog: [],

    /** A message of our own in the chat box, as a game message. */
    gameMessage(text) {
      const c = this.client;
      const f = this.fields;
      if (!c || !f.addChat || typeof c[f.addChat] !== 'function') return;
      const clean = String(text).replace(/@/g, '').slice(0, 120);
      try {
        this.addingOwn = true;
        c[f.addChat](0, clean, '');
        if (f.redrawChat) c[f.redrawChat] = true;
      } catch (e) {
        post('runtime-error', `game message: ${e && e.message}`);
      } finally {
        this.addingOwn = false;
      }
    },

    read(name) {
      const f = this.fields[name];
      return f && this.client ? this.client[f] : undefined;
    },

    poll() {
      try {
        const now = performance.now();
        const loggedIn = !!this.client && now - this.lastTick < LOGOUT_AFTER_MS;
        if (loggedIn !== this.loggedIn) {
          this.loggedIn = loggedIn;
          this.lastStats = null;
          post('login-state', loggedIn);
          if (loggedIn) this.saveLogin();
          else this.lastScreen = -1;
        }
        if (loggedIn) {
          this.pollStats();
          this.pollIdle();
          this.pollPlayer();
          this.pollItems();
          if (this.watchEntities) this.pollEntities();
        } else {
          this.lastPlayer = null;
          this.lastItems = null;
        }
      } catch (e) {
        post('runtime-error', String((e && e.message) || e));
      }
    },

    /** How long since your last mouse or key input in the game (the game's own timer, which
     * asks the server to log you out at 90 s). Posted once a second as 'idle'. */
    idleMs() {
      const t = this.read('idleTimer');
      return typeof t === 'number' && t > 0 ? Math.max(0, performance.now() - t) : null;
    },

    pollIdle() {
      const ms = this.idleMs();
      if (ms === null) return;
      const s = Math.floor(ms / 1000);
      if (s === this.lastIdle) return;
      this.lastIdle = s;
      post('idle', { ms: Math.round(ms) });
    },

    // ---- screen flash for notifications (RuneLite's "Flash" notification setting)
    flashState: null,

    startFlash(cmd) {
      const m = /([0-9a-f]{8}|[0-9a-f]{6})$/i.exec(String(cmd.colour || ''));
      let rgb = 0xff0000;
      let alpha = 70;
      if (m && m[1].length === 8) {
        alpha = parseInt(m[1].slice(0, 2), 16);
        rgb = parseInt(m[1].slice(2), 16);
      } else if (m) rgb = parseInt(m[1], 16);
      const t = this.read('idleTimer');
      this.flashState = { start: performance.now(), once: cmd.mode === 'once', rgb, alpha: Math.max(1, Math.min(256, alpha)), input: typeof t === 'number' ? t : null };
    },

    drawFlash(c) {
      const fl = this.flashState;
      if (!fl || !this.api || !this.api.pix) return;
      const now = performance.now();
      const t = this.read('idleTimer');
      // until cancelled: any mouse or key input in the game stops it; once: two seconds
      if ((fl.once && now - fl.start > 2000) || (!fl.once && typeof t === 'number' && fl.input !== null && t > fl.input)) {
        this.flashState = null;
        return;
      }
      if ((now - fl.start) % 1000 >= 500) return; // on half a second, off half a second
      const pix = this.api.pix();
      if (!pix || !pix.pixels) return;
      const d = pix.pixels;
      const a = fl.alpha;
      const na = 256 - a;
      const rb = (fl.rgb & 0xff00ff) * a;
      const gg = (fl.rgb & 0xff00) * a;
      for (let i = 0, n = pix.width * pix.height; i < n; i++) {
        const v = d[i];
        d[i] = (((rb + (v & 0xff00ff) * na) & 0xff00ff00) | ((gg + (v & 0xff00) * na) & 0xff0000)) >>> 8;
      }
    },

    /** Your stats now: [{ skill, index, xp, level, boosted }], or null. */
    readStats() {
      const xp = this.read('statXP');
      const base = this.read('statBaseLevel');
      const boosted = this.read('statEffectiveLevel');
      if (!xp || !base) return null;
      const stats = [];
      for (let i = 0; i < SKILLS.length; i++) {
        if (!SKILLS[i]) continue;
        stats.push({ skill: SKILLS[i], index: i, xp: xp[i] | 0, level: base[i] | 0, boosted: boosted ? boosted[i] | 0 : 0 });
      }
      return stats;
    },

    pollStats() {
      const stats = this.readStats();
      if (!stats) return;
      const key = stats.map((s) => s.xp + ':' + s.boosted).join(',');
      if (key !== this.lastStats) {
        this.lastStats = key;
        post('stats', stats);
      }
    },

    // ---- local player (2.1) and run energy, weight, prayer, special attack (2.10)

    lastPlayer: null,
    lastPos: null,

    pollPlayer() {
      const c = this.client;
      const f = this.fields;
      const p = f.localPlayer && c[f.localPlayer];
      if (!p) return;
      const tileX = (p[f.entityX] >> 7);
      const tileZ = (p[f.entityZ] >> 7);
      const x = (c[f.baseX] | 0) + tileX;
      const y = (c[f.baseZ] | 0) + tileZ;
      const plane = c[f.level] | 0;
      const loop = this.api && this.api.loopCycle ? this.api.loopCycle() : 0;
      const face = p[f.faceEntity];
      const boosted = this.read('statEffectiveLevel');
      const base = this.read('statBaseLevel');
      const varps = c[f.varps];
      const moved = this.lastPos && (this.lastPos.x !== p[f.entityX] || this.lastPos.z !== p[f.entityZ]);
      this.lastPos = { x: p[f.entityX], z: p[f.entityZ] };
      const anim = p[f.primaryAnim];
      const data = {
        name: typeof p[f.playerName] === 'string' ? p[f.playerName] : null,
        combatLevel: p[f.combatLevel] | 0,
        x, y, plane,
        // Scene (local) tile and the 8x8 zone / 64x64 map square, as RuneLite's dev tools show
        sceneX: tileX, sceneY: tileZ,
        region: ((x >> 6) << 8) | (y >> 6),
        animation: typeof anim === 'number' ? anim : -1,
        moving: !!moved,
        // The game only sends health with a hit; the stat is always current.
        hitpoints: boosted ? boosted[3] | 0 : null,
        maxHitpoints: base ? base[3] | 0 : null,
        inCombat: typeof p[f.combatCycle] === 'number' && p[f.combatCycle] > loop,
        hitHealth: p[f.health] | 0,
        hitTotal: p[f.totalHealth] | 0,
        // faceEntity: -1 nobody, < 32768 an NPC index, otherwise a player index + 32768
        interacting: typeof face !== 'number' || face < 0 ? null : face >= 32768 ? { type: 'player', index: face - 32768 } : { type: 'npc', index: face },
        runEnergy: c[f.runEnergy] | 0,
        weight: c[f.runWeight] | 0,
        prayer: boosted ? boosted[5] | 0 : null,
        maxPrayer: base ? base[5] | 0 : null,
        specialAttack: varps ? Math.round((varps[300] | 0) / 10) : null,
        specialAttackOn: varps ? (varps[301] | 0) === 1 : null,
        runOn: varps ? (varps[this.RUN.varp] | 0) === 1 : null,
        specialAvailable: this.fields.sideIcon ? this.specBar() >= 0 : null,
      };
      const key = JSON.stringify(data);
      if (key !== this.lastPlayer) {
        this.lastPlayer = key;
        post('player', data);
      }
    },

    // ---- NPCs and players around you (2.2), for the Developer Tools panel

    watchEntities: false,
    lastEntities: null,

    pollEntities() {
      const c = this.client;
      const f = this.fields;
      const me = c[f.localPlayer];
      if (!me || !f.npcs) return;
      const bx = c[f.baseX] | 0;
      const bz = c[f.baseZ] | 0;
      const dist = (e) => Math.max(Math.abs((e.x >> 7) - (me[f.entityX] >> 7)), Math.abs((e.z >> 7) - (me[f.entityZ] >> 7)));
      const slim = (e) => ({
        index: e.index, id: e.id, name: e.name, level: e.level, x: bx + (e.x >> 7), y: bz + (e.z >> 7), distance: dist(e),
        animation: e.animation, inCombat: e.inCombat, health: e.totalHealth ? `${e.health}/${e.totalHealth}` : null,
        interacting: e.interacting,
      });
      const npcs = this.readNpcs(c).map(slim).sort((a, b) => a.distance - b.distance).slice(0, 30);
      const players = this.readPlayers(c).map(slim).sort((a, b) => a.distance - b.distance).slice(0, 30);
      const px = me[f.entityX] >> 7;
      const pz = me[f.entityZ] >> 7;
      const objects = this.readObjects(c, 10)
        .filter((o) => o.name && o.name !== 'null')
        .map((o) => ({ kind: o.kind, id: o.id, name: o.name, x: bx + o.x, y: bz + o.z, distance: Math.max(Math.abs(o.x - px), Math.abs(o.z - pz)) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 30);
      const data = { npcs, players, objects, npcCount: c[f.npcCount] | 0, playerCount: c[f.playerCount] | 0 };
      const key = JSON.stringify(data);
      if (key !== this.lastEntities) {
        this.lastEntities = key;
        post('entities', data);
      }
    },

    // ---- objects in the scene (2.5): walls (and doors), wall decorations, scenery (trees,
    // rocks, chests ...) and ground decorations, read from the game's own scene.

    LOC_KINDS: ['wall', 'decor', 'scenery', 'ground'],
    locNames: new Map(),

    /** The loc's name ("Oak", "Door"), or ''. */
    locName(id) {
      if (!this.locNames.has(id)) {
        let name = '';
        try {
          const t = this.api && this.api.loc ? this.api.loc(id) : null;
          name = t && this.fields.locName ? String(t[this.fields.locName] || '') : '';
        } catch {
          /* unknown loc */
        }
        this.locNames.set(id, name);
      }
      return this.locNames.get(id);
    },

    /** Locs on scene tile (x, z) of a level: [{ kind, id, name, x, z, shape, angle, typecode }]. */
    locsAt(c, level, x, z) {
      const f = this.fields;
      const w = f.sceneWorld && c[f.sceneWorld];
      if (!w || x < 0 || z < 0 || x > 103 || z > 103) return [];
      const out = [];
      const calls = [
        [f.sceneWall, x, z],
        [f.sceneDecor, z, x], // this one takes (level, z, x)
        [f.sceneLoc, x, z],
        [f.sceneGroundDecor, x, z],
      ];
      for (let k = 0; k < 4; k++) {
        const [m, a, b] = calls[k];
        if (!m || typeof w[m] !== 'function') continue;
        const typecode = w[m](level, a, b) | 0;
        if (!typecode) continue;
        const id = (typecode >> 14) & 0x7fff;
        const info = f.sceneInfo && typeof w[f.sceneInfo] === 'function' ? w[f.sceneInfo](level, x, z, typecode) : -1;
        out.push({ kind: this.LOC_KINDS[k], id, name: this.locName(id), x, z, level, shape: info & 0x1f, angle: (info >> 6) & 3, typecode });
      }
      return out;
    },

    /** Every loc within `radius` squares of you on your level. */
    readObjects(c, radius = 15) {
      const f = this.fields;
      const me = c && c[f.localPlayer];
      if (!me || !f.sceneWorld) return [];
      const level = c[f.level] | 0;
      const px = me[f.entityX] >> 7;
      const pz = me[f.entityZ] >> 7;
      const out = [];
      for (let x = Math.max(0, px - radius); x <= Math.min(103, px + radius); x++) {
        for (let z = Math.max(0, pz - radius); z <= Math.min(103, pz + radius); z++) out.push(...this.locsAt(c, level, x, z));
      }
      return out;
    },

    // ---- inventory and worn equipment (2.3)

    ITEMS: { inventory: 3214, equipment: 1688 },
    EQUIPMENT_SLOTS: ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', null, 'legs', null, 'gloves', 'boots', null, 'ring', 'ammo'],
    lastItems: null,

    readContainer(id, size) {
      const com = this.bankCom(id);
      const f = this.fields;
      if (!com || !com[f.invObj]) return null;
      const objs = com[f.invObj];
      const counts = com[f.invCount];
      const out = [];
      for (let i = 0; i < size && i < objs.length; i++) {
        const raw = objs[i] | 0;
        if (raw <= 0) {
          out.push(null);
          continue;
        }
        const id2 = raw - 1;
        out.push({ id: id2, quantity: counts ? counts[i] | 0 : 1, name: this.itemLabel(id2) });
      }
      return out;
    },

    /** The open main window (c[mainModal]) and every item shown in its item grids: what a
     *  reward window (Treasure Trail, Fishing Trawler, Barrows...) holds. null when none is open. */
    modalItems() {
      const c = this.client;
      const f = this.fields;
      if (!c || !this.loggedIn || !f.mainModal || !f.invObj) return null;
      const root = c[f.mainModal];
      if (typeof root !== 'number' || root < 0) return null;
      const list = this.api && this.api.ifList ? this.api.ifList() : null;
      if (!list || !list[root]) return null;
      const items = [];
      const seen = new Set();
      const walk = (com, depth) => {
        if (!com || depth > 6 || seen.has(com)) return;
        seen.add(com);
        const objs = com[f.invObj];
        if (objs && objs.length) {
          const counts = com[f.invCount];
          for (let i = 0; i < objs.length; i++) {
            const raw = objs[i] | 0;
            if (raw > 0) items.push({ id: raw - 1, quantity: counts ? counts[i] | 0 || 1 : 1 });
          }
        }
        if (f.comChildren) for (const ch of com[f.comChildren] || []) walk(list[ch], depth + 1);
      };
      walk(list[root], 0);
      return { root, items };
    },

    pollItems() {
      if (!this.api || !this.api.ifList || !this.fields.invObj) return;
      const inventory = this.readContainer(this.ITEMS.inventory, 28);
      const worn = this.readContainer(this.ITEMS.equipment, 14);
      const equipment = {};
      if (worn) this.EQUIPMENT_SLOTS.forEach((slot, i) => { if (slot) equipment[slot] = worn[i] || null; });
      const data = { inventory: inventory || [], equipment };
      const key = JSON.stringify(data);
      if (key !== this.lastItems) {
        this.lastItems = key;
        post('items', data);
      }
    },

    // ---- camera

    updateFar() {
      // Original: 3500 units for 25 tiles. Scale with the draw radius and with zooming out,
      // so a zoomed-out camera still draws everything inside the radius.
      this.far = Math.round(3500 * (this.radius / 25) * Math.max(1, this.zoom));
    },

    /** Called by the client's visibility pre-calculation (the World class, at startup). */
    visCalc(world, method, args) {
      if (this.recomputing) return;
      this.vis = { world, method, args: Array.prototype.slice.call(args) };
      if (this.zoom !== 1) this.scheduleVis();
    },

    /**
     * Re-runs the visibility pre-calculation for the current zoom, so tiles the camera can
     * now see aren't culled. The client passes distances for 9 pitch steps computed as
     * (angle * 3 + 600) * sin(angle); we scale the distance part by the zoom.
     */
    scheduleVis() {
      clearTimeout(this.visTimer);
      this.visTimer = setTimeout(() => {
        const v = this.vis;
        if (!v) return;
        const distance = new Int32Array(9);
        for (let x = 0; x < 9; x++) {
          const angle = x * 32 + 128 + 15;
          const sin = Math.sin((angle * Math.PI) / 1024) * 65536 | 0;
          distance[x] = (Math.round((angle * 3 + 600) * this.zoom) * sin) >> 16;
        }
        this.recomputing = true;
        try {
          v.world[v.method](distance, ...v.args.slice(1));
        } catch (e) {
          post('runtime-error', 'visibility: ' + String((e && e.message) || e));
        } finally {
          this.recomputing = false;
        }
      }, 300);
    },

    // ---- login screen
    //
    // title(c) runs every frame while the title/login screen is drawn. It reports which
    // screen is showing (so the tick boxes appear only on the login box), fills in a
    // remembered username/password when the login box opens, and keeps hold of the client
    // so the details can be saved once you're actually logged in.

    hideUser: false,
    login: { rememberUser: false, rememberPass: false, user: '', pass: '' },
    titleClient: null,
    lastScreen: -1,

    title(c) {
      const f = this.fields;
      this.titleClient = c;
      if (!f.loginScreen) return;
      const screen = c[f.loginScreen];
      if (screen === this.lastScreen) return;
      this.lastScreen = screen;
      post('login-screen', screen);
      if (screen === 2) this.prefill(c);
    },

    prefill(c) {
      const f = this.fields;
      const l = this.login;
      try {
        if (l.rememberUser && l.user && !c[f.loginUser]) c[f.loginUser] = l.user;
        if (l.rememberPass && l.pass && !c[f.loginPass]) c[f.loginPass] = l.pass;
      } catch (e) {
        post('runtime-error', 'login prefill: ' + String((e && e.message) || e));
      }
    },

    /** Called when you log in: hand the typed details to the plugin to remember. */
    saveLogin() {
      const c = this.titleClient || this.client;
      const f = this.fields;
      if (!c || !f.loginUser) return;
      this.lastScreen = -1;
      post('login-save', { user: String(c[f.loginUser] || ''), pass: this.login.rememberPass ? String(c[f.loginPass] || '') : '' });
    },

    // ---- bank search
    //
    // The bank's item list (an inventory component) is kept exactly as the server writes
    // it. While a search is active, the component's item and count arrays are replaced by
    // views that show only matching items, packed from the top. Server updates still
    // write through to the real arrays (by real slot). Menu entries for the bank are
    // translated back to real slots before they run, so a click always withdraws the item
    // you clicked. Dragging to rearrange is switched off while searching.

    api: null,
    BANK: { modal: 5292, inv: 5382, title: 5383, scroll: 5385 },
    bank: { open: false, query: '', installed: null, map: [], ph: [], dirty: true, names: new Map(), placeholders: false, layout: null, layoutKey: '' },

    setApi(api) {
      const first = !this.api || !this.api.ifList;
      this.api = Object.assign(this.api || {}, api);
      if (api.ifList && first && this.fields.mainModal) setInterval(() => this.bankCheck(), 100);
    },

    /** The deepest scrollable layer under (mx, my) (whole-game pixels) in an open interface,
     *  scrolled by one wheel notch (dir 1 down, -1 up). True if one was there. */
    wheelScroll(mx, my, dir) {
      const c = this.client;
      const f = this.fields;
      if (!c || !this.loggedIn || !f.comScrollHeight || !f.comChildren || !this.api || !this.api.ifList) return false;
      const list = this.api.ifList();
      if (!list) return false;
      const STEP = 45;
      const find = (com, x, y, scroll, depth) => {
        if (!com || depth > 8 || com[f.comType] !== 0 || !com[f.comChildren] || com[f.comHide]) return null;
        if (mx < x || my < y || mx > x + com[f.comWidth] || my > y + com[f.comHeight]) return null;
        const kids = com[f.comChildren];
        const cxs = com[f.comChildX];
        const cys = com[f.comChildY];
        if (!cxs || !cys) return null;
        let found = null;
        for (let i = 0; i < kids.length; i++) {
          const ch = list[kids[i]];
          if (!ch || ch[f.comType] !== 0) continue;
          const x2 = cxs[i] + x + (ch[f.comX] | 0);
          const y2 = cys[i] + y - scroll + (ch[f.comY] | 0);
          const inner = find(ch, x2, y2, ch[f.scrollPos] | 0, depth + 1);
          if (inner) return inner;
          if (ch[f.comScrollHeight] > ch[f.comHeight] && !ch[f.comHide] && mx >= x2 && my >= y2 && mx < x2 + ch[f.comWidth] + 16 && my < y2 + ch[f.comHeight]) found = found || ch;
        }
        return found;
      };
      const side = typeof c[f.sideModal] === 'number' && c[f.sideModal] !== -1 ? c[f.sideModal] : f.sideIcon && f.activeTab && c[f.sideIcon] ? c[f.sideIcon][c[f.activeTab]] : -1;
      const roots = [[c[f.mainModal], 4, 4, null], [side, 553, 205, f.redrawSide], [f.chatModal ? c[f.chatModal] : -1, 17, 357, f.redrawChat]];
      for (const [id, x, y, redraw] of roots) {
        if (typeof id !== 'number' || id < 0) continue;
        const layer = find(list[id], x, y, 0, 0);
        if (!layer) continue;
        const max = Math.max(0, layer[f.comScrollHeight] - layer[f.comHeight]);
        layer[f.scrollPos] = Math.max(0, Math.min(max, (layer[f.scrollPos] | 0) + dir * STEP));
        if (redraw) c[redraw] = true;
        return true;
      }
      return false;
    },

    bankCom(id) {
      try {
        const list = this.api && this.api.ifList();
        return list ? list[id] : null;
      } catch {
        return null;
      }
    },

    labels: new Map(),

    /** The item's name as the game shows it ("Bronze axe"). */
    itemLabel(id) {
      if (!this.labels.has(id)) {
        let name = '';
        try {
          const o = this.api.obj(id);
          name = String((o && o[this.fields.objName]) || '');
        } catch { /* unknown item */ }
        this.labels.set(id, name);
      }
      return this.labels.get(id);
    },

    /** Lower-case name, for searching. */
    itemName(id) {
      const cache = this.bank.names;
      if (!cache.has(id)) cache.set(id, this.itemLabel(id).toLowerCase());
      return cache.get(id);
    },

    bankCheck() {
      const c = this.client;
      const open = !!(c && this.loggedIn && c[this.fields.mainModal] === this.BANK.modal);
      if (open !== this.bank.open) {
        this.bank.open = open;
        post('bank-open', open);
        if (!open) {
          this.bankSearch('');
          this.bankUninstall();
        }
      }
      if (open) {
        if (this.bank.placeholders && !this.bank.installed) this.bankApply();
        this.bankReport();
      }
    },

    /** What's in the bank (for the Quest Helper's "in your bank"), when it changes. */
    bankReport() {
      const f = this.fields;
      const b = this.bank;
      const com = b.installed ? null : this.bankCom(this.BANK.inv);
      const items = b.installed ? b.installed.items : com && com[f.invObj];
      const counts = b.installed ? b.installed.counts : com && com[f.invCount];
      if (!items || !counts) return;
      const out = [];
      for (let i = 0; i < items.length; i++) if (items[i] > 0) out.push({ id: items[i] - 1, quantity: counts[i] | 0 });
      const key = out.map((x) => `${x.id}:${x.quantity}`).join(',');
      if (key !== b.reported) {
        b.reported = key;
        post('bank-items', out);
      }
    },

    // ---- the bank as LostLite shows it: the search (bank search) and placeholders.
    //
    // With placeholders on, LostLite keeps the bank's layout itself (b.layout, item ids in
    // order, saved per account by the Bank plugin): an item you take all of out stays in its
    // place as a faded placeholder, and putting it back fills that place again (the server
    // puts it at the end). b.map[display slot] is the real slot, or -1 for a placeholder
    // (b.ph[display slot] is its item). Dragging items rearranges LostLite's layout; the
    // server's own order isn't changed (see invDrag).

    bankRecompute() {
      const b = this.bank;
      const real = b.installed.items;
      const slotOf = new Map();
      const order = [];
      for (let i = 0; i < real.length; i++) {
        const id = real[i] - 1;
        if (id >= 0 && !slotOf.has(id)) {
          slotOf.set(id, i);
          order.push(id);
        }
      }
      let layout = order;
      if (b.placeholders) {
        const seen = new Set();
        layout = [];
        for (const id of b.layout || []) {
          if (seen.has(id) || !(id >= 0)) continue;
          seen.add(id);
          layout.push(id);
        }
        for (const id of order) if (!seen.has(id)) layout.push(id);
        // never more places than the bank has slots: the oldest placeholders at the end go
        for (let i = layout.length - 1; layout.length > real.length && i >= 0; i--) if (!slotOf.has(layout[i])) layout.splice(i, 1);
        const key = layout.join(',');
        if (key !== b.layoutKey) {
          b.layoutKey = key;
          b.layout = layout;
          post('bank-layout', layout);
        }
      }
      const map = [];
      const ph = [];
      for (const id of layout) {
        if (b.query && !this.itemName(id).includes(b.query)) continue;
        const slot = slotOf.has(id) ? slotOf.get(id) : -1;
        map.push(slot);
        ph.push(slot < 0 ? id : -1);
      }
      b.map = map;
      b.ph = ph;
      b.dirty = false;
      if (b.query) post('bank-count', map.length);
    },

    bankView(real) {
      const self = this;
      const b = this.bank;
      return new Proxy({}, {
        get(_t, k) {
          if (typeof k === 'string' && k.length < 8 && /^\d+$/.test(k)) {
            if (b.dirty) self.bankRecompute();
            const i = +k;
            return i < b.map.length && b.map[i] >= 0 ? real[b.map[i]] : 0;
          }
          if (k === 'length') return real.length;
          const v = real[k];
          return typeof v === 'function' ? v.bind(real) : v;
        },
        set(_t, k, v) {
          // The server writes by real slot.
          real[k] = v;
          b.dirty = true;
          return true;
        },
        has(_t, k) { return k in real; },
      });
    },

    bankInstall() {
      const b = this.bank;
      const f = this.fields;
      if (b.installed) return true;
      const com = this.bankCom(this.BANK.inv);
      if (!com || !com[f.invObj] || !com[f.invCount]) return false;
      b.installed = {
        com,
        items: com[f.invObj],
        counts: com[f.invCount],
        swap: com[f.objSwap],
        replace: com[f.objReplace],
      };
      com[f.invObj] = this.bankView(b.installed.items);
      com[f.invCount] = this.bankView(b.installed.counts);
      b.dirty = true;
      return true;
    },

    bankUninstall() {
      const b = this.bank;
      const f = this.fields;
      if (!b.installed) return;
      const i = b.installed;
      i.com[f.invObj] = i.items;
      i.com[f.invCount] = i.counts;
      i.com[f.objSwap] = i.swap;
      i.com[f.objReplace] = i.replace;
      b.installed = null;
      b.map = [];
      b.ph = [];
    },

    /** Puts LostLite's bank view on (search or placeholders) or takes it off. */
    bankApply() {
      const b = this.bank;
      const f = this.fields;
      if (!b.query && !b.placeholders) {
        this.bankUninstall();
        return;
      }
      if (!b.open || !this.bankInstall()) return;
      const i = b.installed;
      // no rearranging while searching (the slots shown are only some of the bank)
      i.com[f.objSwap] = b.query ? false : i.swap;
      i.com[f.objReplace] = b.query ? false : i.replace;
      b.dirty = true;
      this.bankRecompute();
    },

    /** From the Bank plugin: placeholders on or off, and this account's saved layout. */
    bankLayout(cmd) {
      const b = this.bank;
      b.placeholders = !!cmd.placeholders && !!(this.info && this.info.features && this.info.features.drag);
      if (Array.isArray(cmd.layout)) {
        b.layout = cmd.layout.filter((x) => Number.isInteger(x) && x >= 0);
        b.layoutKey = b.layout.join(',');
      }
      if (b.open) this.bankApply();
    },

    /** A drag inside an inventory ended over another slot (patchDrag). True = done here. */
    invDrag(com, from, to, mode) {
      const b = this.bank;
      if (com !== this.BANK.inv || !b.installed) return false;
      if (b.query || !b.placeholders) return true; // the search shows only some slots
      if (b.dirty) this.bankRecompute();
      const layout = b.layout.slice();
      if (from < 0 || from >= layout.length || to < 0) return true;
      const target = Math.min(to, layout.length - 1);
      if (to >= layout.length) {
        layout.push(layout.splice(from, 1)[0]); // onto the empty slots: to the end
      } else if (mode === 1) {
        layout.splice(target, 0, layout.splice(from, 1)[0]); // insert
      } else {
        [layout[from], layout[target]] = [layout[target], layout[from]]; // swap
      }
      b.layout = layout;
      b.dirty = true;
      this.bankRecompute();
      return true;
    },

    /** Takes a placeholder away ("Release"). */
    bankRelease(id) {
      const b = this.bank;
      if (!b.layout) return;
      b.layout = b.layout.filter((x) => x !== id);
      b.dirty = true;
      if (b.installed) this.bankRecompute();
    },

    /** Where the open bank's slots are on the game view: { x, y, clip } or null. */
    bankSlots() {
      const c = this.client;
      const f = this.fields;
      if (!c || !f.comChildren || !f.comChildX || !this.api || !this.api.ifList) return null;
      const list = this.api.ifList();
      const want = this.BANK.inv;
      let out = null;
      const walk = (com, x, y, clip, depth) => {
        if (!com || out || depth > 8 || com[f.comHide]) return;
        const kids = com[f.comChildren];
        const cxs = com[f.comChildX];
        const cys = com[f.comChildY];
        if (!kids || !cxs || !cys) return;
        const scroll = com[f.scrollPos] | 0;
        for (let i = 0; i < kids.length && !out; i++) {
          const ch = list[kids[i]];
          if (!ch) continue;
          const x2 = x + cxs[i] + (ch[f.comX] | 0);
          const y2 = y + cys[i] - scroll + (ch[f.comY] | 0);
          if (kids[i] === want) out = { x: x2, y: y2, clip };
          else if (ch[f.comType] === 0) walk(ch, x2, y2, { x0: Math.max(clip.x0, x2), y0: Math.max(clip.y0, y2), x1: Math.min(clip.x1, x2 + ch[f.comWidth]), y1: Math.min(clip.y1, y2 + ch[f.comHeight]) }, depth + 1);
        }
      };
      const root = list[c[f.mainModal]];
      // the main interface is drawn at (4, 4) on the canvas, which is (0, 0) on the game view
      if (root) walk(root, 0, 0, { x0: 0, y0: 0, x1: 512, y1: 334 }, 0);
      return out;
    },

    BANK_GRID: { cols: 8, dx: 32 + 15, dy: 32 + 6 }, // bank_main:inv, width 8, margin 15,6

    /** Display slot under view point (x, y), or -1. */
    bankSlotAt(x, y) {
      const s = this.bankSlots();
      if (!s || x < s.clip.x0 || y < s.clip.y0 || x >= s.clip.x1 || y >= s.clip.y1) return -1;
      const G = this.BANK_GRID;
      const col = Math.floor((x - s.x) / G.dx);
      const row = Math.floor((y - s.y) / G.dy);
      if (col < 0 || col >= G.cols || row < 0) return -1;
      if (x - s.x - col * G.dx >= 32 || y - s.y - row * G.dy >= 32) return -1;
      return row * G.cols + col;
    },

    /** Draws the placeholders (faded icon, "0") over the open bank. */
    bankDrawPlaceholders(g) {
      const b = this.bank;
      if (!b.installed || !b.placeholders || !b.ph) return;
      if (b.dirty) this.bankRecompute();
      if (!b.ph.some((x) => x >= 0)) return;
      const s = this.bankSlots();
      if (!s) return;
      const G = this.BANK_GRID;
      const { x0, y0, x1, y1 } = s.clip;
      for (let i = 0; i < b.ph.length; i++) {
        const id = b.ph[i];
        if (id < 0) continue;
        const x = s.x + (i % G.cols) * G.dx;
        const y = s.y + Math.floor(i / G.cols) * G.dy;
        if (y + 32 <= y0 || y >= y1 || x + 32 <= x0 || x >= x1) continue;
        const icon = this.itemIcon(id);
        if (icon) {
          // cut to the bank's scroll area, like the game clips its own icons
          const top = Math.max(0, y0 - y);
          const bottom = Math.min(icon.h, y1 - y);
          if (bottom <= top) continue;
          const part = top === 0 && bottom === icon.h ? icon : { w: icon.w, h: bottom - top, px: (icon.px.subarray || icon.px.slice).call(icon.px, top * icon.w, bottom * icon.w) }; // the icon's pixels can be a plain array
          g.image(part, x, y + top, 96);
        }
        if (y + 9 > y0 && y + 10 < y1) g.text('0', x, y + 9, 0xffff00);
      }
    },

    /** The title text field is found by its value, the first time it's needed. */
    bankTitle(text) {
      const com = this.bankCom(this.BANK.title);
      if (!com) return;
      const b = this.bank;
      if (!b.titleKey) {
        for (const k of Object.keys(com)) {
          if (typeof com[k] === 'string' && /bank/i.test(com[k])) {
            b.titleKey = k;
            b.titleText = com[k];
            break;
          }
        }
      }
      if (b.titleKey) com[b.titleKey] = text === null ? b.titleText : text;
    },

    bankSearch(query) {
      const b = this.bank;
      const q = String(query || '').toLowerCase().trim();
      const was = b.query;
      b.query = q;
      if (!q) {
        this.bankApply();
        this.bankTitle(null);
        post('bank-count', -1);
        return;
      }
      if (!was) {
        const layer = this.bankCom(this.BANK.scroll);
        if (layer) layer[this.fields.scrollPos] = 0;
      }
      this.bankApply();
      this.bankTitle('Showing items: @red@' + q);
    },

    /** A placeholder under the mouse gets "Release". (Bank entries keep the displayed slot,
     *  which the game also uses to pick up a dragged item; bankRealSlot swaps in the real slot
     *  when one is chosen.) */
    bankRemapMenu(c) {
      const b = this.bank;
      if (!b.installed) return;
      if (b.dirty) this.bankRecompute();
      const f = this.fields;
      if (!b.placeholders || !f.mouseX) return;
      const slot = this.bankSlotAt(c[f.mouseX] - 4, c[f.mouseY] - 4);
      const id = slot >= 0 && b.ph ? b.ph[slot] : -1;
      if (id === undefined || id < 0) return;
      const self = this;
      // under Cancel, so a left click on a placeholder doesn't release it
      this.insertMenuEntry(c, 0, `Release @lre@${this.itemLabel(id)}`, () => self.bankRelease(id));
    },

    // ---- right-click menu (2.8)
    //
    // The client keeps the menu in five parallel arrays; entry count - 1 is the top entry,
    // which is what a left click does. menuBuilt() runs every frame right after the client
    // builds and sorts the menu, and applies the active rules:
    //   hide:  remove matching entries
    //   swaps: move the first matching entry for the same target to the top
    // A rule is { option, target } with lower-case text and * wildcards.

    menuRules: { hide: [], swaps: [], shiftSwaps: [], customize: { left: false, shift: false } },
    shiftDown: false,
    altDown: false,
    ctrlDown: false,
    CUSTOM_ACTION: 9999, // action id of entries LostLite adds; menuClick() handles them
    custom: new Map(),

    menuArrays(c) {
      const f = this.fields;
      return [c[f.menuOption], c[f.menuAction], c[f.menuParamA], c[f.menuParamB], c[f.menuParamC]];
    },

    /**
     * "Pickpocket @yel@Man @gre@(level-2)" -> { option: 'pickpocket', target: 'man', kind: 'npc' }
     * The colour tag in front of the name says what it is: yellow NPC, white player, cyan
     * object, light red item.
     */
    parseEntry(text) {
      const raw = String(text == null ? '' : text);
      const at = raw.indexOf('@');
      const tag = at < 0 ? '' : raw.slice(at + 1, at + 4).toLowerCase();
      const kind = { yel: 'npc', whi: 'player', cya: 'object', lre: 'item' }[tag] || '';
      const option = (at < 0 ? raw : raw.slice(0, at)).trim().toLowerCase();
      const target = (at < 0 ? '' : raw.slice(at))
        .replace(/@[a-z0-9]{3}@/gi, '')
        .replace(/\s*\((?:level|skill)-\d+\)\s*$/i, '')
        .trim()
        .toLowerCase();
      return { option, target, kind };
    },

    matchText(pattern, value) {
      if (pattern === '*' || pattern === '') return true;
      if (!pattern.includes('*')) return pattern === value;
      const re = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      return re.test(value);
    },

    matches(rule, e) {
      return (!rule.kind || rule.kind === e.kind) && this.matchText(rule.option, e.option) && this.matchText(rule.target, e.target);
    },

    /** Read-only snapshot of the current menu, top entry first. */
    getMenu() {
      const c = this.client;
      const f = this.fields;
      if (!c || !f.menuCount) return [];
      const [opt, act, a, b, cc] = this.menuArrays(c);
      const out = [];
      for (let i = c[f.menuCount] - 1; i >= 0; i--) out.push({ text: opt[i], action: act[i], a: a[i], b: b[i], c: cc[i], ...this.parseEntry(opt[i]) });
      return out;
    },

    menuBuilt(c) {
      this.pluginEntries.clear();
      if (this.bank.installed) this.bankRemapMenu(c);
      // Page plugins get the menu twice: menu() before the swap rules (to change what the
      // left click is) and menuAfter() once everything else is done (cosmetic changes like
      // colours and counts, which would otherwise stop the swap rules recognising entries).
      this.pluginMenu(c, 'menu');
      this.applyMenuRules(c);
      this.pluginMenu(c, 'menuAfter');
    },

    // Menu entries added by page plugins: text -> click handler, rebuilt with every menu.
    pluginEntries: new Map(),

    /**
     * Adds an entry at index `at` (pushing the entries above it up) with the same target
     * parameters as the entry that was there. onClick runs when it's chosen.
     */
    insertMenuEntry(c, at, text, onClick) {
      const f = this.fields;
      const arrays = this.menuArrays(c);
      let n = c[f.menuCount];
      if (n >= 499) return;
      for (const arr of arrays) for (let j = n; j > at; j--) arr[j] = arr[j - 1];
      arrays[0][at] = text;
      arrays[1][at] = this.CUSTOM_ACTION;
      c[f.menuCount] = n + 1;
      this.pluginEntries.set(text + '|' + arrays[2][at] + '|' + arrays[3][at] + '|' + arrays[4][at], onClick);
    },

    pluginMenu(c, which) {
      for (const p of this.activePlugins) {
        if (!p.impl[which]) continue;
        try {
          p.impl[which](c, this.menuArrays(c), this);
        } catch (e) {
          post('runtime-error', `${p.id} menu: ${e && e.message}`);
        }
      }
    },

    applyMenuRules(c) {
      const rules = this.menuRules;
      const shift = this.shiftDown;
      const customize = shift && (rules.customize.left || rules.customize.shift);
      if (!rules.hide.length && !rules.swaps.length && !(shift && rules.shiftSwaps.length) && !customize) return;
      try {
        const arrays = this.menuArrays(c);
        if (rules.hide.length) this.hideEntries(c, arrays);
        const swaps = shift && rules.shiftSwaps.length ? rules.shiftSwaps.concat(rules.swaps) : rules.swaps;
        if (swaps.length) this.swapTop(c, arrays, swaps);
        if (customize) this.addCustomizeEntries(c, arrays);
      } catch (e) {
        post('runtime-error', 'menu: ' + String((e && e.message) || e));
      }
    },

    hideEntries(c, arrays) {
      const f = this.fields;
      let n = c[f.menuCount];
      for (let i = n - 1; i >= 1; i--) {
        const e = this.parseEntry(arrays[0][i]);
        if (this.menuRules.hide.some((r) => this.matches(r, e))) {
          for (const arr of arrays) for (let j = i; j < n - 1; j++) arr[j] = arr[j + 1];
          n--;
        }
      }
      c[f.menuCount] = n;
    },

    moveToTop(arrays, i, top) {
      for (const arr of arrays) {
        const v = arr[i];
        for (let j = i; j < top; j++) arr[j] = arr[j + 1];
        arr[top] = v;
      }
    },

    swapTop(c, arrays, swaps) {
      const n = c[this.fields.menuCount];
      if (n < 2) return;
      const top = n - 1;
      const t = this.parseEntry(arrays[0][top]);
      for (const r of swaps) {
        if ((r.kind && r.kind !== t.kind) || !this.matchText(r.target, t.target)) continue;
        // "<default>": you chose the game's own left click for this target; no swaps apply.
        if (r.option === '<default>') return;
        if (this.matchText(r.option, t.option)) return; // already the left-click option
        for (let i = top - 1; i >= 1; i--) {
          const e = this.parseEntry(arrays[0][i]);
          if (r.option === 'walk here') {
            // "Walk here" has no target; it walks to the tile under the mouse.
            if (e.option !== 'walk here') continue;
          } else {
            // Same target instance: identical parameters and target name.
            if (arrays[2][i] !== arrays[2][top] || arrays[3][i] !== arrays[3][top] || arrays[4][i] !== arrays[4][top]) continue;
            if (e.target !== t.target || !this.matchText(r.option, e.option)) continue;
          }
          this.moveToTop(arrays, i, top);
          return;
        }
      }
      this.swapBuried(c, arrays, swaps);
    },

    /**
     * The left click is something other than the target you set a swap for, but only because
     * the game put it under "Walk here" or a ground item: it lowers Attack on NPCs above your
     * level, and items lying under an NPC go on top. A swap you set for that NPC (or object)
     * by name still wins then, as long as no other NPC, player or object is above it.
     */
    swapBuried(c, arrays, swaps) {
      const top = c[this.fields.menuCount] - 1;
      const named = swaps.filter((r) => r.target && r.target !== '*' && r.option !== 'walk here');
      if (!named.length) return;
      for (let i = top; i >= 1; i--) {
        if (arrays[1][i] === this.CUSTOM_ACTION) continue;
        const e = this.parseEntry(arrays[0][i]);
        if (e.option === 'walk here' || e.kind === 'item' || !e.kind) continue;
        // The highest NPC, player or object under the mouse: only its swaps count.
        const rule = named.find((r) => (!r.kind || r.kind === e.kind) && this.matchText(r.target, e.target));
        if (!rule || rule.option === '<default>') return;
        for (let j = i; j >= 1; j--) {
          if (arrays[1][j] === this.CUSTOM_ACTION) continue;
          if (arrays[2][j] !== arrays[2][i] || arrays[3][j] !== arrays[3][i] || arrays[4][j] !== arrays[4][i]) continue;
          const o = this.parseEntry(arrays[0][j]);
          if (o.target !== e.target || !this.matchText(rule.option, o.option)) continue;
          this.moveToTop(arrays, j, top);
          return;
        }
        return;
      }
    },

    /**
     * While Shift is held (RuneLite's "customizable left-click / shift-click"), add an entry
     * for every option of each NPC, object and item, under its Examine entry, the way
     * RuneLite's menu swapper did before it had sub-menus:
     *   Swap left click Talk-to Banker / Swap shift click Talk-to Banker / ... / Reset ...
     * Clicking one saves the choice (menuClick reports it to the plugin).
     */
    addCustomizeEntries(c, arrays) {
      const f = this.fields;
      const want = this.menuRules.customize;
      const chosen = this.menuRules.chosen || {};
      this.custom.clear();
      let n = c[f.menuCount];
      for (let i = n - 1; i >= 1; i--) {
        if (arrays[1][i] === this.CUSTOM_ACTION) continue;
        const raw = String(arrays[0][i]);
        const e = this.parseEntry(raw);
        if (e.option !== 'examine' || !e.kind || e.kind === 'player') continue;
        const shown = raw.slice(raw.indexOf('@'));
        const name = shown.replace(/@[a-z0-9]{3}@/gi, '').replace(/\s*\((?:level|skill)-\d+\)\s*$/i, '').trim();
        // The target's options are the other entries for the same thing, in menu order.
        const options = [];
        for (let j = n - 1; j >= 1; j--) {
          if (j === i || arrays[1][j] === this.CUSTOM_ACTION) continue;
          if (arrays[2][j] !== arrays[2][i] || arrays[3][j] !== arrays[3][i] || arrays[4][j] !== arrays[4][i]) continue;
          const o = this.parseEntry(arrays[0][j]);
          if (o.target !== e.target || o.option === 'examine' || (o.option.startsWith('use ') && o.option.endsWith(' with'))) continue;
          const label = String(arrays[0][j]).slice(0, String(arrays[0][j]).indexOf('@')).trim();
          if (label && !options.includes(label)) options.push(label);
        }
        // Entries in display order (top first). Each insert below Examine pushes the earlier
        // ones up, so inserting them in list order leaves them top to bottom.
        const add = [];
        for (const which of ['left', 'shift']) {
          if (!want[which]) continue;
          const current = chosen[`${which}|${e.kind}|${e.target}`];
          for (const o of options) {
            if (current && current.toLowerCase() === o.toLowerCase()) continue;
            add.push({ text: `Swap ${which} click ${o} ${shown}`, choice: { kind: e.kind, target: e.target, name, shift: which === 'shift', option: o } });
          }
          if (current && current !== '<default>') {
            add.push({ text: `Reset ${which} click ${shown}`, choice: { kind: e.kind, target: e.target, name, shift: which === 'shift', option: null } });
          }
        }
        // Group like RuneLite: left/shift pairs per option.
        add.sort((x, y) => {
          const ox = x.choice.option === null ? 99 : options.indexOf(x.choice.option);
          const oy = y.choice.option === null ? 99 : options.indexOf(y.choice.option);
          return ox - oy || (x.choice.shift ? 1 : 0) - (y.choice.shift ? 1 : 0);
        });
        for (let k = 0; k < add.length; k++) {
          if (n >= 499) break;
          const entry = add[k];
          for (const arr of arrays) for (let j = n; j > i; j--) arr[j] = arr[j - 1];
          arrays[0][i] = entry.text;
          arrays[1][i] = this.CUSTOM_ACTION;
          n++;
          this.custom.set(entry.text + '|' + arrays[2][i] + '|' + arrays[3][i] + '|' + arrays[4][i], entry.choice);
        }
      }
      c[f.menuCount] = n;
    },

    customInfo(c, index) {
      const [opt, , a, b, cc] = this.menuArrays(c);
      return this.custom.get(opt[index] + '|' + a[index] + '|' + b[index] + '|' + cc[index]) || null;
    },

    /** Called at the start of the client's doAction(index). True = handled here. */
    /** The chosen entry is on LostLite's bank view: point it at the real slot. */
    bankRealSlot(c, index) {
      const b = this.bank;
      if (!b.installed) return;
      const f = this.fields;
      if (c[f.menuParamC][index] !== this.BANK.inv) return;
      if (b.dirty) this.bankRecompute();
      const real = b.map[c[f.menuParamB][index]];
      c[f.menuParamB][index] = real === undefined || real < 0 ? -1 : real;
    },

    menuClick(c, index) {
      try {
        const act = c[this.fields.menuAction];
        if (act[index] !== this.CUSTOM_ACTION) this.bankRealSlot(c, index);
        if (act[index] !== this.CUSTOM_ACTION) return false;
        const [opt, , pa, pb, pc] = this.menuArrays(c);
        const handler = this.pluginEntries.get(opt[index] + '|' + pa[index] + '|' + pb[index] + '|' + pc[index]);
        if (handler) {
          handler();
          return true;
        }
        const choice = this.customInfo(c, index);
        if (choice) post('menu-choose', choice);
        return true;
      } catch (e) {
        post('runtime-error', 'menu click: ' + String((e && e.message) || e));
        return false;
      }
    },

    /** Close the game's menu after a choice. Only for menus over the 3D view, which is
     *  redrawn every frame; menus over the side panel or chatbox close when the mouse leaves. */
    closeMenu() {
      const c = this.client;
      const f = this.fields;
      if (c && f.menuOpen && c[f.menuOpen] && c[f.menuArea] === 0) c[f.menuOpen] = false;
    },

    rotate(dx, dy) {
      const yawF = this.fields.cameraYaw;
      const pitchF = this.fields.cameraPitch;
      if (!this.client || !yawF || !pitchF) return;
      const c = this.client;
      c[yawF] = ((c[yawF] + Math.round(dx)) % 2048 + 2048) % 2048;
      c[pitchF] = Math.max(128, Math.min(383, Math.round(c[pitchF] + dy)));
    },

    // ---- overlays and page-side plugins (Phase 3)
    //
    // Plugins that draw on the game or change its menu have a "page" part running here, in
    // the game's own context, registered with registerPlugin(id, impl). The plugin's
    // sidebar-side half switches it on and sends its settings ('plugin-config'). impl can
    // have: configure(config), frame(g), frameUI(g), menu(c, arrays), menuAfter(c, arrays),
    // mouseDown(x, y, button) / mouseUp(x, y, button) / mouseMove(x, y) -> true to keep it
    // from the game, key(e, down), chat(msg), stop().
    //
    // frame(g) is called by the client once per frame, after it has drawn the 3D view and
    // its own overlays and before it copies the view to the screen. g draws straight into
    // the view's pixels (512 x 334, view coordinates; the view sits at 4, 4 on the canvas).

    pagePlugins: new Map(),
    activePlugins: [],
    mouse: { x: -1, y: -1, inView: false },

    registerPlugin(id, impl) {
      this.pagePlugins.set(id, { id, impl, enabled: false });
    },

    refreshActive() {
      this.activePlugins = [...this.pagePlugins.values()].filter((p) => p.enabled);
    },

    pluginConfig(cmd) {
      const p = this.pagePlugins.get(cmd.id);
      if (!p) return;
      const was = p.enabled;
      p.enabled = !!cmd.enabled;
      try {
        if (p.enabled && cmd.config && p.impl.configure) p.impl.configure(cmd.config);
        if (was && !p.enabled && p.impl.stop) p.impl.stop();
      } catch (e) {
        post('runtime-error', `${cmd.id}: ${e && e.message}`);
      }
      this.refreshActive();
    },

    /** layer 0: world overlays, under the open interface and menu; 1: over them. */
    frame(c, layer) {
      if (layer === 1 && this.flashState) {
        try {
          this.drawFlash(c);
        } catch {
          this.flashState = null;
        }
      }
      const placeholders = layer === 1 && !!this.bank.installed && this.bank.placeholders;
      if ((!this.activePlugins.length && !placeholders) || !this.api || !this.api.pix) return;
      // Nothing here may ever stop the game drawing its frame.
      let g = null;
      try {
        g = this.graphics(c);
      } catch (e) {
        if (!this.graphicsFailed) post('runtime-error', `overlay: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`);
        this.graphicsFailed = true;
      }
      if (!g) return;
      if (placeholders) {
        try {
          this.bankDrawPlaceholders(g);
        } catch (e) {
          if (!this.placeholdersFailed) post('runtime-error', `bank placeholders: ${e && e.message}`);
          this.placeholdersFailed = true;
        }
      }
      const method = layer === 1 ? 'frameUI' : 'frame';
      for (const p of this.activePlugins) {
        if (!p.impl[method]) continue;
        try {
          p.impl[method](g);
        } catch (e) {
          if (!p.failed) post('runtime-error', `${p.id} overlay: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`);
          p.failed = true;
        }
      }
      if (layer === 0) return;
      // Hulls asked for this frame are collected while the next frame's scene is drawn.
      this.hulls.clear();
      const want = this.hullWant;
      this.hullWant = this.hullNext;
      this.hullNext = want;
      this.hullNext.clear();
      this.hullWanted = this.hullWant.size > 0;
    },

    // ---- model hulls: the convex hull of an NPC's or player's model on screen, taken as
    // the client draws it (see patchEntities). Typecodes: NPC 0x20000000 + (index << 14),
    // player index << 14 (you: 2047 << 14).
    hullWanted: false,
    hullWant: new Set(),
    hullNext: new Set(),
    hulls: new Map(),

    modelDrawn(model, typecode, sx, sy, count) {
      if (!this.hullWant.has(typecode)) return;
      const pts = [];
      for (let i = 0; i < count; i++) if (sx[i] !== -5000) pts.push({ x: sx[i], y: sy[i] });
      if (pts.length < 3) return;
      this.hulls.set(typecode, convexHull(pts));
    },

    // Colour tags: "@~xx@" in game text (menus, overlay text) means colour number xx.
    tagColours: [],
    tagIndex: new Map(),

    /** '@~xx@' tag for an 0xRRGGBB colour, usable in any text the game draws. */
    colourTag(rgb) {
      rgb &= 0xffffff;
      let i = this.tagIndex.get(rgb);
      if (i === undefined) {
        i = this.tagColours.length;
        if (i >= 36 * 36) return '@whi@';
        this.tagColours.push(rgb);
        this.tagIndex.set(rgb, i);
      }
      return '@~' + i.toString(36).padStart(2, '0') + '@';
    },

    tagColour(tag) {
      const i = parseInt(tag.slice(1), 36);
      const v = this.tagColours[i];
      return v === undefined ? -1 : v;
    },

    /** Drawing helpers for one frame. */
    graphics(c) {
      const f = this.fields;
      const pix = this.api.pix();
      if (!pix || !pix.pixels || pix.width !== 512) return null;
      const self = this;
      const data = pix.pixels;
      const W = pix.width;
      const H = pix.height;
      const blend = (i, rgb, a) => {
        if (a >= 256) {
          data[i] = rgb;
          return;
        }
        const d = data[i];
        const na = 256 - a;
        data[i] = ((((rgb & 0xff00ff) * a + (d & 0xff00ff) * na) & 0xff00ff00) | (((rgb & 0xff00) * a + (d & 0xff00) * na) & 0xff0000)) >>> 8;
      };
      const fonts = { small: c[f.fontP11], regular: c[f.fontP12], bold: c[f.fontB12] };
      const g = {
        client: c,
        width: W,
        height: H,
        mouse: this.mouse,
        loop: this.api.loopCycle ? this.api.loopCycle() : 0,
        level: c[f.level] | 0,
        baseX: c[f.baseX] | 0,
        baseZ: c[f.baseZ] | 0,
        /** Fine scene coordinates (128 per tile) and height above the ground -> view point. */
        project(x, z, height) {
          c[f.project](x, z, height | 0);
          const px = c[f.projectX];
          const py = c[f.projectY];
          return px === -1 && py === -1 ? null : { x: px, y: py };
        },
        /** The four corners of a scene tile (or size x size tiles), or null if off screen. */
        tilePoly(tx, tz, size = 1) {
          const x0 = tx * 128;
          const z0 = tz * 128;
          const x1 = x0 + size * 128;
          const z1 = z0 + size * 128;
          const pts = [g.project(x0, z0, 0), g.project(x1, z0, 0), g.project(x1, z1, 0), g.project(x0, z1, 0)];
          return pts.every(Boolean) ? pts : null;
        },
        /** The scene tile under view point (mx, my), searching around you; or null. */
        tileAt(mx, my, radius = 20) {
          const me = c[f.localPlayer];
          if (!me) return null;
          const px = me[f.entityX] >> 7;
          const pz = me[f.entityZ] >> 7;
          const inside = (pts) => {
            let sign = 0;
            for (let i = 0; i < 4; i++) {
              const a = pts[i];
              const b = pts[(i + 1) % 4];
              const cr = (b.x - a.x) * (my - a.y) - (b.y - a.y) * (mx - a.x);
              if (cr !== 0) {
                if (sign && Math.sign(cr) !== sign) return false;
                sign = Math.sign(cr);
              }
            }
            return true;
          };
          let best = null;
          for (let x = Math.max(0, px - radius); x <= Math.min(103, px + radius); x++) {
            for (let z = Math.max(0, pz - radius); z <= Math.min(103, pz + radius); z++) {
              const pts = g.tilePoly(x, z);
              if (!pts || !inside(pts)) continue;
              // nearer tiles are drawn over farther ones: keep the one closest to you
              const d = Math.abs(x - px) + Math.abs(z - pz);
              if (!best || d < best.d) best = { x, z, d };
            }
          }
          return best ? { x: best.x, z: best.z } : null;
        },
        /** A size x size area centred on fine scene point (x, z), like RuneLite's tile area. */
        areaPoly(x, z, size = 1) {
          const r = size * 64;
          const pts = [g.project(x - r, z - r, 0), g.project(x + r, z - r, 0), g.project(x + r, z + r, 0), g.project(x - r, z + r, 0)];
          return pts.every(Boolean) ? pts : null;
        },
        textWidth(str, font = 'small') {
          const fo = fonts[font];
          return fo ? fo[f.fontWidth](str) : 0;
        },
        /** Text with the game's own font; y is the baseline. Colour tags work. */
        text(str, x, y, rgb, { font = 'small', shadow = true, outline = false } = {}) {
          const fo = fonts[font];
          if (!fo) return;
          if (outline) {
            const plain = String(str).replace(/@[~a-z0-9]{3}@/gi, '');
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fo[f.fontDrawTag](plain, x + dx, y + dy, 0, false);
            fo[f.fontDrawTag](str, x, y, rgb, false);
          } else {
            fo[f.fontDrawTag](str, x, y, rgb, shadow);
          }
        },
        /** An image { w, h, px: ARGB pixels (alpha in the top byte) } with its top left at x, y. */
        image(img, x, y, alpha = 256) {
          if (!img || !img.px) return;
          x |= 0;
          y |= 0;
          for (let yy = 0; yy < img.h; yy++) {
            const sy = y + yy;
            if (sy < 0 || sy >= H) continue;
            for (let xx = 0; xx < img.w; xx++) {
              const sx = x + xx;
              if (sx < 0 || sx >= W) continue;
              const p = img.px[yy * img.w + xx];
              const a = (((p >>> 24) * alpha) >> 8) + 1;
              if (a > 1) blend(sy * W + sx, p & 0xffffff, a >= 256 ? 256 : a);
            }
          }
        },
        fillRect(x, y, w, h, rgb, alpha = 256) {
          let x0 = Math.max(0, x | 0);
          let y0 = Math.max(0, y | 0);
          const x1 = Math.min(W, (x + w) | 0);
          const y1 = Math.min(H, (y + h) | 0);
          for (let yy = y0; yy < y1; yy++) for (let xx = x0, i = yy * W + x0; xx < x1; xx++, i++) blend(i, rgb, alpha);
        },
        /** 1px outline; the rectangle covers x..x+w, y..y+h like Java's drawRect. */
        rect(x, y, w, h, rgb, alpha = 256) {
          g.line(x, y, x + w, y, rgb, alpha);
          g.line(x, y + h, x + w, y + h, rgb, alpha);
          g.line(x, y + 1, x, y + h - 1, rgb, alpha);
          g.line(x + w, y + 1, x + w, y + h - 1, rgb, alpha);
        },
        line(x0, y0, x1, y1, rgb, alpha = 256) {
          x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
          const dx = Math.abs(x1 - x0);
          const dy = -Math.abs(y1 - y0);
          const sx = x0 < x1 ? 1 : -1;
          const sy = y0 < y1 ? 1 : -1;
          let err = dx + dy;
          for (let n = 0; n < 4000; n++) {
            if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) blend(y0 * W + x0, rgb, alpha);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
          }
        },
        /** RuneLite's renderPolygon: outline in rgb, filled with the same colour at low alpha. */
        polygon(pts, rgb, { fillAlpha = 50, strokeAlpha = 256, fill = rgb, width = 1 } = {}) {
          if (fillAlpha > 0) {
            let minY = H;
            let maxY = 0;
            for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
            minY = Math.max(0, Math.floor(minY));
            maxY = Math.min(H - 1, Math.ceil(maxY));
            for (let y = minY; y <= maxY; y++) {
              const xs = [];
              for (let k = 0; k < pts.length; k++) {
                const a = pts[k];
                const b = pts[(k + 1) % pts.length];
                if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
              }
              xs.sort((p, q) => p - q);
              for (let k = 0; k + 1 < xs.length; k += 2) {
                const xa = Math.max(0, Math.ceil(xs[k]));
                const xb = Math.min(W - 1, Math.floor(xs[k + 1]));
                for (let x = xa, i = y * W + xa; x <= xb; x++, i++) blend(i, fill, fillAlpha);
              }
            }
          }
          if (strokeAlpha <= 0 || width <= 0) return;
          // Thicker borders: the outline drawn again offset around the pixel.
          const offs = width <= 1 ? [[0, 0]] : width <= 2 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
          for (let k = 0; k < pts.length; k++) {
            const a = pts[k];
            const b = pts[(k + 1) % pts.length];
            for (const [ox, oy] of offs) g.line(a.x + ox, a.y + oy, b.x + ox, b.y + oy, rgb, strokeAlpha);
          }
        },
        /** Ground items on scene tile (x, z) of the current level: [{ id, count }] bottom to top. */
        groundItems(x, z) {
          const levels = c[f.groundObj];
          const list = levels && levels[g.level] && levels[g.level][x] && levels[g.level][x][z];
          if (!list) return null;
          const out = [];
          for (let o = list[f.listHead](); o !== null && o !== undefined; o = list[f.listNext]()) out.push({ id: o[f.objId], count: o[f.objCount] });
          return out;
        },
        /** Convex hull of an entity's model this frame (asked for one frame ahead). */
        hull(typecode) {
          self.hullNext.add(typecode);
          return self.hulls.get(typecode) || null;
        },
        npcs: () => self.readNpcs(c),
        /** Objects on a scene tile of this level (walls, decorations, scenery, ground decor). */
        locs: (x, z) => self.locsAt(c, c[f.level] | 0, x, z),
        players: () => self.readPlayers(c),
        item: (id) => self.itemInfo(id),
        player: () => {
          const p = c[f.localPlayer];
          return p ? { x: p[f.entityX], z: p[f.entityZ] } : null;
        },
        colourTag: (rgb) => self.colourTag(rgb),
        setHint: (h) => self.setHint(c, h),
      };
      return g;
    },

    /** NPCs in the scene (2.2). x/z are fine scene units, trueX/trueZ the tile it's moving to. */
    readNpcs(c) {
      const f = this.fields;
      const out = [];
      if (!f.npcs || !c[f.npcs]) return out;
      const list = c[f.npcs];
      const ids = c[f.npcIds];
      const count = c[f.npcCount] | 0;
      for (let i = 0; i < count; i++) {
        const index = ids[i];
        const n = list[index];
        const t = n && n[f.npcType];
        if (!t) continue;
        out.push(this.entityInfo(n, {
          index, typecode: (0x20000000 + (index << 14)) | 0, kind: 'npc',
          id: t[f.npcId], name: t[f.npcName] == null ? null : String(t[f.npcName]), level: t[f.npcLevel] | 0,
        }));
      }
      return out;
    },

    /** Other players in the scene (2.2). */
    readPlayers(c) {
      const f = this.fields;
      const out = [];
      if (!f.players || !c[f.players]) return out;
      const list = c[f.players];
      const ids = c[f.playerIds];
      const count = c[f.playerCount] | 0;
      for (let i = 0; i < count; i++) {
        const index = ids[i];
        const p = list[index];
        if (!p || typeof p[f.playerName] !== 'string') continue;
        out.push(this.entityInfo(p, { index, typecode: index << 14, kind: 'player', name: p[f.playerName], level: p[f.combatLevel] | 0 }));
      }
      return out;
    },

    entityInfo(e, base) {
      const f = this.fields;
      const loop = this.api && this.api.loopCycle ? this.api.loopCycle() : 0;
      const face = e[f.faceEntity];
      base.entity = e;
      base.x = e[f.entityX] | 0;
      base.z = e[f.entityZ] | 0;
      base.size = e[f.entitySize] | 0 || 1;
      base.height = e[f.entityHeight] | 0;
      base.trueX = e[f.routeX] ? e[f.routeX][0] : base.x >> 7;
      base.trueZ = e[f.routeZ] ? e[f.routeZ][0] : base.z >> 7;
      base.animation = typeof e[f.primaryAnim] === 'number' ? e[f.primaryAnim] : -1;
      base.inCombat = typeof e[f.combatCycle] === 'number' && e[f.combatCycle] > loop;
      base.health = e[f.health] | 0;
      base.totalHealth = e[f.totalHealth] | 0;
      base.interacting = typeof face !== 'number' || face < 0 ? null : face >= 32768 ? { type: 'player', index: face - 32768 } : { type: 'npc', index: face };
      return base;
    },

    // ---- the game's hint arrow, for plugins (Clue Helper). Only ever changes the arrow LostLite
    // set itself, so a quest's own arrow from the server is left alone.
    hintSet: null,

    /** h: { npc: index } | { x, z, height } (world tile) | null */
    setHint(c, h) {
      const f = this.fields;
      if (!c || !f.hintType) return;
      const ours = this.hintSet;
      const current = c[f.hintType] === 1 ? `n${c[f.hintNpc]}` : c[f.hintType] === 2 ? `t${c[f.hintTileX]},${c[f.hintTileZ]}` : '';
      if (!h) {
        if (ours && current === ours) c[f.hintType] = 0;
        this.hintSet = null;
        return;
      }
      // Don't take over an arrow the server put up (one we didn't set).
      if (c[f.hintType] !== 0 && current !== ours) return;
      if (h.npc !== undefined) {
        c[f.hintType] = 1;
        c[f.hintNpc] = h.npc;
        this.hintSet = `n${h.npc}`;
      } else {
        c[f.hintType] = 2;
        c[f.hintOffsetX] = 64;
        c[f.hintOffsetZ] = 64;
        c[f.hintTileX] = h.x;
        c[f.hintTileZ] = h.z;
        c[f.hintHeight] = h.height || 0;
        this.hintSet = `t${h.x},${h.z}`;
      }
    },

    itemInfoCache: new Map(),

    /** { name, cost, stackable } for an item id (2.11). */
    itemInfo(id) {
      let v = this.itemInfoCache.get(id);
      if (!v) {
        const f = this.fields;
        let o = null;
        try { o = this.api.obj(id); } catch { /* unknown item */ }
        v = { id, name: o ? String(o[f.objName] || '') : '', cost: o ? o[f.objCost] | 0 : 0, stackable: !!(o && o[f.objStackable]) };
        this.itemInfoCache.set(id, v);
      }
      return v;
    },

    hideRoofs: false,

    // ---- status orbs: the game's own buttons, pressed the way a click on them would
    // (revision 274 interface ids from Lost City's content: controls tab Walk 151 / Run 152,
    // and the special attack bar of each weapon's combat tab).
    RUN: { walk: 151, run: 152, varp: 173 },
    SPEC: { energyVarp: 300, onVarp: 301 },
    SPECBARS: [[425, 7462, 7474], [1698, 7487, 7499], [1749, 7512, 7524], [1764, 7537, 7549], [2276, 7562, 7574], [2423, 7587, 7599],
      [3796, 7612, 7624], [4446, 7637, 7649], [4679, 7662, 7674], [4705, 7687, 7699], [5570, 7712, 7724], [5855, 7737, 7749],
      [7762, 7788, 7800], [8460, 8481, 8493]], // [combat tab, bar, bar layer]

    /** Runs a button press through the client's own doAction, like clicking it. */
    pressButton(comId, kind) {
      const c = this.client;
      const f = this.fields;
      if (!c || !this.loggedIn || !f.doAction || !f.buttons || typeof c[f.doAction] !== 'function') return false;
      const action = f.buttons[kind];
      if (action === undefined) return false;
      const arrays = this.menuArrays(c);
      const i = Math.min(c[f.menuCount] | 0, 498); // a spare slot above the current menu
      const saved = arrays.map((arr) => arr[i]);
      arrays[0][i] = '';
      arrays[1][i] = action;
      arrays[2][i] = 0;
      arrays[3][i] = 0;
      arrays[4][i] = comId;
      try {
        c[f.doAction](i);
      } catch (e) {
        post('runtime-error', `button ${comId}: ${e && e.message}`);
      } finally {
        arrays.forEach((arr, k) => { arr[i] = saved[k]; });
      }
      return true;
    },

    /** The special attack bar showing in the combat tab, or -1 (weapon has no special). */
    specBar() {
      const c = this.client;
      const f = this.fields;
      const tab = c && c[f.sideIcon] ? c[f.sideIcon][0] : -1;
      const list = this.api && this.api.ifList ? this.api.ifList() : null;
      if (!list) return -1;
      for (const [root, bar, layer] of this.SPECBARS) {
        if (root !== tab) continue;
        const com = list[layer];
        return com && !com[f.comHide] ? bar : -1;
      }
      return -1;
    },

    /**
     * The Walk and Run buttons: the select buttons that set varp 173 (option_run) to 0 and 1.
     * Found in the interface list itself, so they're right whatever ids the world's
     * interfaces use; the 274 content ids are the fallback.
     */
    runButtons() {
      if (this.runFound) return this.runFound;
      const f = this.fields;
      const list = this.api && this.api.ifList ? this.api.ifList() : null;
      const found = { walk: -1, run: -1 };
      if (list && f.comScripts && f.comOperand) {
        for (let id = 0; id < list.length; id++) {
          const com = list[id];
          if (!com || com[f.comButtonType] !== 5) continue;
          const sc = com[f.comScripts];
          const op = com[f.comOperand];
          if (!sc || !sc[0] || sc[0][0] !== 5 || sc[0][1] !== this.RUN.varp || !op) continue;
          if (op[0] === 0) found.walk = id;
          else if (op[0] === 1) found.run = id;
        }
      }
      if (found.walk < 0 || found.run < 0) {
        post('log', `Run buttons not found in the interfaces (walk ${found.walk}, run ${found.run}); using ${this.RUN.walk}/${this.RUN.run}`);
        return { walk: this.RUN.walk, run: this.RUN.run };
      }
      post('log', `Run buttons: walk ${found.walk}, run ${found.run}`);
      this.runFound = found;
      return found;
    },

    orb(which) {
      const c = this.client;
      const f = this.fields;
      if (!c || !this.loggedIn) return;
      const varps = c[f.varps];
      if (which === 'run') {
        const b = this.runButtons();
        const running = !!(varps && varps[this.RUN.varp] === 1);
        const id = running ? b.walk : b.run;
        post('log', `Run orb: ${running ? 'walk' : 'run'} (button ${id})`);
        this.pressButton(id, 'select');
      } else if (which === 'spec') {
        const bar = this.specBar();
        if (bar >= 0) this.pressButton(bar, 'ok');
      } else if (which === 'prayer') {
        // Open the prayer tab, as clicking its icon does.
        if (c[f.sideIcon] && c[f.sideIcon][5] !== -1) {
          c[f.activeTab] = 5;
          c[f.redrawSide] = true;
          c[f.redrawIcons] = true;
        }
      }
    },
    chatPrompt: null,

    /** Esc: what the Close Window button does, for the open main or side interface. */
    closeInterface() {
      const c = this.client;
      const f = this.fields;
      if (!c || !this.loggedIn || !f.closeModal || !f.mainModal || typeof c[f.closeModal] !== 'function') return;
      if (c[f.dialogInputOpen] || c[f.socialInputOpen]) return; // the game's own typing prompts
      if (c[f.mainModal] === -1 && c[f.sideModal] === -1) return;
      try {
        c[f.closeModal]();
      } catch (e) {
        post('runtime-error', `close interface: ${e && e.message}`);
      }
    },

    /** Name of the last player who sent you a private message, from the chat history. */
    lastPrivateSender() {
      const c = this.client;
      const f = this.fields;
      const types = c[f.chatType];
      const names = c[f.chatUsername];
      if (!types || !names) return null;
      for (let i = 0; i < types.length && i < 100; i++) {
        // 3: "From name: ..." (7 is the same from a moderator, with a crown tag)
        if ((types[i] === 3 || types[i] === 7) && names[i]) return String(names[i]).replace(/^@cr\d@/, '');
      }
      return null;
    },

    /** Tab: open the game's own "Enter message to send to <name>" prompt for the last PM. */
    replyLast() {
      const c = this.client;
      const f = this.fields;
      if (!c || !this.loggedIn || !f.socialUserhash || !this.api || !this.api.toUserhash) return;
      if (c[f.socialInputOpen2] || c[f.socialDialogOpen] || this.chatPrompt) return; // already typing in a prompt
      const name = this.lastPrivateSender();
      if (!name) return;
      try {
        const hash = this.api.toUserhash(name);
        const count = c[f.friendCount] | 0;
        let friend = -1;
        for (let i = 0; i < count; i++) {
          if (c[f.friendUserhash][i] === hash) {
            friend = i;
            break;
          }
        }
        // Same rule as the friends list's own Message option: friends who are online.
        if (friend === -1 || !(c[f.friendWorld][friend] > 0)) {
          if (typeof c[f.addChat] === 'function') c[f.addChat](0, `${name} is not online on your friends list, so you can't reply.`, '');
          return;
        }
        c[f.socialRedraw] = true;
        c[f.socialDialogOpen] = false;
        c[f.socialInputOpen2] = true;
        c[f.socialInput] = '';
        c[f.socialInputType] = 3;
        c[f.socialUserhash] = c[f.friendUserhash][friend];
        c[f.socialInputHeader] = 'Enter message to send to ' + c[f.friendUsername][friend];
      } catch (e) {
        post('runtime-error', `tab to reply: ${e && e.message}`);
      }
    },

    command(cmd) {
      if (cmd.type === 'zoom' && typeof cmd.value === 'number' && isFinite(cmd.value)) {
        const z = Math.max(0.2, Math.min(4, cmd.value));
        if (z !== this.zoom) {
          this.zoom = z;
          this.updateFar();
          this.scheduleVis();
        }
      } else if (cmd.type === 'rotate' && isFinite(cmd.dx) && isFinite(cmd.dy)) {
        this.rotate(cmd.dx, cmd.dy);
      } else if (cmd.type === 'bank-search') {
        this.bankSearch(cmd.query);
      } else if (cmd.type === 'bank-layout') {
        this.bankLayout(cmd);
      } else if (cmd.type === 'login-config') {
        this.hideUser = !!cmd.hideUser;
        this.login = {
          rememberUser: !!cmd.rememberUser,
          rememberPass: !!cmd.rememberPass,
          user: typeof cmd.user === 'string' ? cmd.user : '',
          pass: typeof cmd.pass === 'string' ? cmd.pass : '',
        };
        // The plugin may have started after the login screen was first reported: repeat it.
        if (this.lastScreen !== -1 && !this.loggedIn) post('login-screen', this.lastScreen);
        // If the login box is already open with empty fields, fill them now.
        const c = this.titleClient;
        if (c && this.fields.loginScreen && c[this.fields.loginScreen] === 2 && !this.loggedIn) this.prefill(c);
      } else if (cmd.type === 'chat-prompt') {
        // [line 1, line 2] drawn by the game's own chatbox prompt code, or null.
        const l = cmd.lines;
        const next = Array.isArray(l) && l.length === 2 ? [String(l[0]), String(l[1])] : null;
        const same = (a, b) => (a === b) || (a && b && a[0] === b[0] && a[1] === b[1]);
        if (!same(next, this.chatPrompt)) {
          this.chatPrompt = next;
          const c = this.client;
          if (c && this.fields.redrawChat) c[this.fields.redrawChat] = true;
        }
      } else if (cmd.type === 'plugin-config' && typeof cmd.id === 'string') {
        this.pluginConfig(cmd);
      } else if (cmd.type === 'flash') {
        if (cmd.mode === 'off') this.flashState = null;
        else this.startFlash(cmd);
      } else if (cmd.type === 'game-message' && typeof cmd.text === 'string') {
        this.gameMessage(cmd.text);
      } else if (cmd.type === 'orb' && typeof cmd.which === 'string') {
        this.orb(cmd.which);
      } else if (cmd.type === 'roofs') {
        this.hideRoofs = !!cmd.hide;
      } else if (cmd.type === 'watch-entities') {
        this.watchEntities = !!cmd.on;
        this.lastEntities = null;
      } else if (cmd.type === 'reply-last') {
        this.replyLast();
      } else if (cmd.type === 'close-interface') {
        this.closeInterface();
      } else if (cmd.type === 'menu-close') {
        this.closeMenu();
      } else if (cmd.type === 'menu-rules') {
        const clean = (list) => (Array.isArray(list) ? list : [])
          .filter((r) => r && typeof r.option === 'string' && typeof r.target === 'string')
          .map((r) => ({ option: r.option.toLowerCase().trim(), target: r.target.toLowerCase().trim(), kind: typeof r.kind === 'string' ? r.kind : '' }));
        const cz = cmd.customize || {};
        const chosen = {};
        if (cmd.chosen && typeof cmd.chosen === 'object') for (const [k, v] of Object.entries(cmd.chosen)) if (typeof v === 'string') chosen[k] = v;
        this.menuRules = { hide: clean(cmd.hide), swaps: clean(cmd.swaps), shiftSwaps: clean(cmd.shiftSwaps), customize: { left: !!cz.left, shift: !!cz.shift }, chosen };
      }
    },
  };

  // Shift state for shift-click swaps (keys go to the game frame, where this runs).
  // Modifier keys held, for menu options that appear while one is held.
  const MODS = { Shift: 'shiftDown', Alt: 'altDown', Control: 'ctrlDown' };
  window.addEventListener('keydown', (e) => { if (MODS[e.key]) ll[MODS[e.key]] = true; }, true);
  window.addEventListener('keyup', (e) => { if (MODS[e.key]) ll[MODS[e.key]] = false; }, true);
  window.addEventListener('blur', () => {
    ll.shiftDown = false;
    ll.altDown = false;
    ll.ctrlDown = false;
    for (const p of ll.activePlugins) if (p.impl.blur) try { p.impl.blur(); } catch (e) { /* ignore */ }
  });

  // Mouse position in game-view pixels, and clicks for page plugins (before the game sees them).
  function viewPoint(e) {
    const cv = document.getElementById('canvas');
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((e.clientX - r.left) * 765) / r.width - 4, y: ((e.clientY - r.top) * 503) / r.height - 4 };
  }
  window.addEventListener('mousemove', (e) => {
    const p = viewPoint(e);
    if (!p) return;
    ll.mouse.x = p.x | 0;
    ll.mouse.y = p.y | 0;
    ll.mouse.inView = p.x >= 0 && p.y >= 0 && p.x < 512 && p.y < 334;
    for (const pl of ll.activePlugins) {
      if (!pl.impl.mouseMove) continue;
      let eaten = false;
      try { eaten = pl.impl.mouseMove(p.x | 0, p.y | 0, e); } catch (err) { /* ignore */ }
      if (eaten) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true);
  // The mouse wheel scrolls the scrollable part of an interface under the mouse (the bank,
  // skill guides, quest journal, chat-box interfaces), as in later versions of the game:
  // the same scroll position the game's own scroll bar moves.
  window.addEventListener('wheel', (e) => {
    if (e.defaultPrevented || !e.deltaY) return;
    const p = viewPoint(e);
    if (!p) return;
    let done = false;
    try {
      done = ll.wheelScroll(p.x + 4, p.y + 4, Math.sign(e.deltaY));
    } catch (err) {
      if (!ll.wheelFailed) post('runtime-error', `wheel: ${err && err.message}`);
      ll.wheelFailed = true;
    }
    if (done) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, { capture: true, passive: false });
  window.addEventListener('mouseup', (e) => {
    const p = viewPoint(e);
    if (!p) return;
    for (const pl of ll.activePlugins) {
      if (!pl.impl.mouseUp) continue;
      let eaten = false;
      try { eaten = pl.impl.mouseUp(p.x | 0, p.y | 0, e.button, e); } catch (err) { post('runtime-error', `${pl.id} mouse: ${err && err.message}`); }
      if (eaten) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true);
  window.addEventListener('mousedown', (e) => {
    const p = viewPoint(e);
    if (!p || !ll.activePlugins.length) return;
    for (const pl of ll.activePlugins) {
      if (!pl.impl.mouseDown) continue;
      let eaten = false;
      try { eaten = pl.impl.mouseDown(p.x | 0, p.y | 0, e.button, e); } catch (err) { post('runtime-error', `${pl.id} click: ${err && err.message}`); }
      if (eaten) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true);
  for (const type of ['keydown', 'keyup']) {
    window.addEventListener(type, (e) => {
      for (const pl of ll.activePlugins) {
        if (!pl.impl.key) continue;
        let eaten = false;
        try { eaten = pl.impl.key(e, type === 'keydown'); } catch (err) { /* ignore */ }
        if (eaten) e.preventDefault();
        if (eaten === 'stop') {
          // Used up by the plugin: the game doesn't see this key at all.
          e.stopImmediatePropagation();
          return;
        }
      }
    }, true);
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (e.source === window && m && typeof m.__lostliteCmd === 'object') ll.command(m.__lostliteCmd);
  });

  // Nothing LostLite does may ever stop the game: every call the patched client makes into
  // the runtime is wrapped, and a failure is logged (once per hook) instead of thrown into
  // the game's loop, which would freeze it.
  for (const name of ['tick', 'title', 'frame', 'modelDrawn', 'menuBuilt', 'menuClick', 'visCalc', 'tagColour', 'invDrag']) {
    const fn = ll[name];
    if (typeof fn !== 'function') continue;
    let reported = false;
    ll[name] = function guarded() {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        if (!reported) {
          reported = true;
          post('runtime-error', `${name}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
        }
        return name === 'tagColour' ? 0xffffff : undefined;
      }
    };
  }

  Object.defineProperty(window, '__lostlite', { value: ll, writable: false, enumerable: false });
})();
