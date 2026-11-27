// RuneLite core pieces for the 2007 client that OSRS has as widgets or varbits (read only):
// - rl.statusOrbs: 2007 has no orb widgets (OSRS's InterfaceID.Orbs). Our Status Orbs plugin draws its own orbs above
//   the game canvas, on an arc round the minimap (orbs/game.js: ORB 60 x 28, circle r 13, ARC 643,84 r 89; hitpoints at
//   202 degrees, prayer 180, run 158, special 136). bounds(key) is the orb's rectangle like the OSRS orb widget's,
//   circle(key) its circle, shown(key) whether that orb is drawn now.
// - rl.Prayer and client.isPrayerActive: OSRS's Prayer enum on its PRAYER_* varbits; 2007 keeps each prayer's on-state
//   in a varp of its own (the prayer tab's script1: prayer0-17 = varps 83-100, Sharp Eye .. Mystic Might 862-867,
//   Chivalry 1052, Piety 1053). Prayer.getVarbit() answers that varp; later prayers are left out.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Rectangle } = rl;

  const ORB = { w: 60, h: 28, r: 13 };
  // must match orbs/game.js's ARC (the 2007 minimap's centre 643,84; orbs at radius 89)
  const ARC = { x: 643, y: 84, radius: 89 };
  const ANGLES = { hitpoints: 202, prayer: 180, run: 158, special: 136 };
  const centre = (key) => {
    const deg = ANGLES[key];
    return { x: Math.round(ARC.x + ARC.radius * Math.cos((deg * Math.PI) / 180)), y: Math.round(ARC.y + ARC.radius * Math.sin((deg * Math.PI) / 180)) };
  };
  const statusOrbs = {
    keys: () => Object.keys(ANGLES),
    /** the orb's rectangle on the game canvas (text box at the left, circle at the right, as an OSRS orb widget) */
    bounds(key) {
      if (!(key in ANGLES)) return null;
      const c = centre(key);
      return new Rectangle(c.x - (ORB.w - ORB.r - 2), c.y - ORB.h / 2, ORB.w, ORB.h);
    },
    /** the orb's circle: centre x, y and radius */
    circle(key) {
      if (!(key in ANGLES)) return null;
      const c = centre(key);
      return { x: c.x, y: c.y, r: ORB.r };
    },
    /** whether Status Orbs draws that orb now (a shown orb canvas over its rectangle) */
    shown(key) { return !!statusOrbs.element(key); },
    /** whether the mouse is over that orb (the orb's canvas takes the mouse, so the game's mouse position stops at its edge) */
    hovered(key) { const el = statusOrbs.element(key); return !!el && !!el.matches && el.matches(':hover'); },
    element(key) {
      const b = statusOrbs.bounds(key);
      if (!b || typeof document === 'undefined' || !document.querySelectorAll) return null;
      const canvas = document.getElementById && document.getElementById('canvas');
      if (!canvas || !canvas.getBoundingClientRect) return null;
      const r = canvas.getBoundingClientRect();
      if (!r.width) return null;
      const sx = r.width / 765; const sy = r.height / 503;
      for (const el of document.querySelectorAll('canvas.ll-orb')) {
        if (el.style.display === 'none') continue;
        const e = el.getBoundingClientRect();
        const cx = (e.left + e.width / 2 - r.left) / sx; const cy = (e.top + e.height / 2 - r.top) / sy;
        if (b.contains(Math.round(cx), Math.round(cy))) return el;
      }
      return null;
    },
  };

  const PRAYERS = [
    ['THICK_SKIN', 83], ['BURST_OF_STRENGTH', 84], ['CLARITY_OF_THOUGHT', 85], ['SHARP_EYE', 862], ['MYSTIC_WILL', 863],
    ['ROCK_SKIN', 86], ['SUPERHUMAN_STRENGTH', 87], ['IMPROVED_REFLEXES', 88], ['RAPID_RESTORE', 89], ['RAPID_HEAL', 90],
    ['PROTECT_ITEM', 91], ['HAWK_EYE', 864], ['MYSTIC_LORE', 865], ['STEEL_SKIN', 92], ['ULTIMATE_STRENGTH', 93],
    ['INCREDIBLE_REFLEXES', 94], ['PROTECT_FROM_MAGIC', 95], ['PROTECT_FROM_MISSILES', 96], ['PROTECT_FROM_MELEE', 97],
    ['EAGLE_EYE', 866], ['MYSTIC_MIGHT', 867], ['RETRIBUTION', 98], ['REDEMPTION', 99], ['SMITE', 100], ['CHIVALRY', 1052],
    ['PIETY', 1053],
  ];
  const Prayer = {};
  PRAYERS.forEach(([name, varp], ordinal) => {
    Prayer[name] = { name: () => name, ordinal: () => ordinal, toString: () => name, getVarbit: () => varp, getVarp: () => varp };
  });
  Prayer.values = () => PRAYERS.map(([n]) => Prayer[n]);
  Prayer.valueOf = (n) => Prayer[n];

  Object.assign(client, {
    isPrayerActive(p) { return !!p && client.getVarpValue(p.getVarp()) === 1; },
  });
  // java.awt.geom.Arc2D (OPEN / CHORD / PIE): angles in degrees, counter-clockwise from 3 o'clock, as Java
  class Arc2D {
    constructor(x, y, w, h, start, extent, type) { Object.assign(this, { x, y, width: w, height: h, start, extent, type: type == null ? 0 : type }); }
  }
  Arc2D.OPEN = 0; Arc2D.CHORD = 1; Arc2D.PIE = 2;
  Arc2D.Double = Arc2D;
  const basePath = rl.Graphics2D.prototype._path;
  rl.Graphics2D.prototype._path = function _path(shape) {
    if (!(shape instanceof Arc2D)) return basePath.call(this, shape);
    const c = this.ctx;
    const cx = shape.x + shape.width / 2; const cy = shape.y + shape.height / 2;
    const a0 = (-shape.start * Math.PI) / 180; const a1 = (-(shape.start + shape.extent) * Math.PI) / 180;
    c.beginPath();
    if (shape.type === Arc2D.PIE) c.moveTo(cx, cy);
    c.ellipse(cx, cy, shape.width / 2, shape.height / 2, 0, a0, a1, shape.extent > 0);
    if (shape.type !== Arc2D.OPEN) c.closePath();
    return true;
  };

  // Buttons OSRS has as widgets (a plugin's createChild GRAPHIC with an op) that the 2007 interfaces lack: the plugin
  // draws the button in an overlay, and its op goes on top of the menu while the mouse is over it, as a widget op.
  // add({ visible(), bounds(), option(), target(), onClick() }) -> the button; remove(button)
  const buttons = new Set();
  if (ll.menuBuildHooks) {
    ll.menuBuildHooks.push((c) => {
      if (!buttons.size || client.isMenuOpen() || !ll.fields) return;
      const m = client.getMouseCanvasPosition();
      for (const b of buttons) {
        if (!b.visible() || !b.bounds().contains(m.getX(), m.getY())) continue;
        const target = b.target ? b.target() : '';
        ll.insertMenuEntry(c, c[ll.fields.menuCount] | 0, b.option() + (target ? ` @or1@${target}` : ''), () => b.onClick());
        return;
      }
    });
  }
  const widgetButtons = { add(b) { buttons.add(b); return b; }, remove(b) { buttons.delete(b); } };

  // WorldArea.distanceTo(WorldPoint | WorldArea): Chebyshev distance between the closest tiles (MAX_VALUE across planes)
  if (rl.WorldArea && !rl.WorldArea.prototype.distanceTo) {
    rl.WorldArea.prototype.distanceTo = function distanceTo(o) {
      const ow = o.width || 1; const oh = o.height || 1; const op = o.plane != null ? o.plane : o.getPlane();
      if (op !== this.plane) return 2147483647;
      const dx = Math.max(0, Math.max(this.x - (o.x + ow - 1), o.x - (this.x + this.width - 1)));
      const dy = Math.max(0, Math.max(this.y - (o.y + oh - 1), o.y - (this.y + this.height - 1)));
      return Math.max(dx, dy);
    };
  }

  // ItemManager.getItemStats: RuneLite reads OSRS's item_stats.json; the 2007 bonuses are our server's obj params
  // (itemstats.js, generated by app/tools/runelite/itemstats.py). ItemStats / ItemEquipmentStats as RuneLite's.
  const STAT_KEYS = ['astab', 'aslash', 'acrush', 'amagic', 'arange', 'dstab', 'dslash', 'dcrush', 'dmagic', 'drange', 'str', 'rstr', 'prayer', 'aspeed'];
  class ItemEquipmentStats {
    constructor(slot, isTwoHanded, vals) {
      this.slot = slot; this.twoHanded = !!isTwoHanded; this.mdmg = 0;
      STAT_KEYS.forEach((k, i) => { this[k] = vals[i] | 0; });
    }
    getSlot() { return this.slot; } isTwoHanded() { return this.twoHanded; }
    getAstab() { return this.astab; } getAslash() { return this.aslash; } getAcrush() { return this.acrush; } getAmagic() { return this.amagic; } getArange() { return this.arange; }
    getDstab() { return this.dstab; } getDslash() { return this.dslash; } getDcrush() { return this.dcrush; } getDmagic() { return this.dmagic; } getDrange() { return this.drange; }
    getStr() { return this.str; } getRstr() { return this.rstr; } getMdmg() { return this.mdmg; } getPrayer() { return this.prayer; } getAspeed() { return this.aspeed; }
  }
  class ItemStats {
    constructor(row) { this.equipable = true; this.weight = row[2]; this.equipment = new ItemEquipmentStats(row[0], !!row[1], row.slice(3)); }
    isEquipable() { return this.equipable; } getWeight() { return this.weight; } getEquipment() { return this.equipment; }
  }
  const statsCache = new Map();
  rl.itemManager.getItemStats = (id) => {
    const data = rl.ITEM_STATS_2007;
    if (!data) return null;
    const canon = rl.itemManager.canonicalize(id);
    if (!statsCache.has(canon)) statsCache.set(canon, data[canon] ? new ItemStats(data[canon]) : null);
    return statsCache.get(canon);
  };
  // WorldPoint.distanceTo2D / isInArea2D, WorldArea.contains2D
  if (rl.WorldPoint && !rl.WorldPoint.prototype.distanceTo2D) {
    rl.WorldPoint.prototype.distanceTo2D = function distanceTo2D(o) { return Math.max(Math.abs(this.x - o.x), Math.abs(this.y - o.y)); };
    rl.WorldArea.prototype.contains2D = function contains2D(p) { return p.x >= this.x && p.x < this.x + this.width && p.y >= this.y && p.y < this.y + this.height; };
    rl.WorldPoint.prototype.isInArea2D = function isInArea2D(...areas) { return areas.some((a) => a.contains2D(this)); };
  }
  // OverlayManager.saveOverlay: saves the overlay's location and size (Screen Markers)
  if (!rl.overlayManager.saveOverlay) rl.overlayManager.saveOverlay = (o) => { o.savedSize = !!o.preferredSize; rl.overlayManager.save(o); };
  // Perspective.getMiniMapImageLocation: the image centred on the point's minimap location
  if (rl.Perspective && !rl.Perspective.getMiniMapImageLocation) {
    rl.Perspective.getMiniMapImageLocation = (c, lp, image) => {
      const m = rl.Perspective.localToMinimap(c, lp);
      if (!m || !image) return null;
      return new rl.Point(m.getX() - Math.trunc((image.width | 0) / 2), m.getY() - Math.trunc((image.height | 0) / 2));
    };
  }
  // ColorUtil.colorLerp
  if (!rl.ColorUtil.colorLerp) {
    rl.ColorUtil.colorLerp = (a, b, t) => {
      const w = 1 - t;
      return new rl.Color(Math.round(a.getRed() * w + b.getRed() * t), Math.round(a.getGreen() * w + b.getGreen() * t), Math.round(a.getBlue() * w + b.getBlue() * t), Math.round(a.getAlpha() * w + b.getAlpha() * t));
    };
  }

  // ---------------------------------------------------------------- OSRS-style XP drops (2007 has none)
  // Written from how the OSRS client's XP drops behave (its xpdrops interface, InterfaceID.XpDrops = group 122): an XP
  // counter box (total XP, or the most recent skill's XP) at the top of the game view, and each gain rising from below up
  // to it with its skill icon, one drop per game tick with every skill gained that tick (or one per skill when not
  // grouped). OSRS keeps the settings in varbits set from the XP orb's Setup; 2007 has no orb (and no XP drops), so the
  // counter and drops only exist while the XP Drop plugin is on (rl.xpDrops.setActive), their settings are that plugin's
  // "2007RS" section (group xpdrop), and rl.xpDrops.varbit(VarbitID.XPDROPS_*) answers them (the 2007 cache's own
  // varbits with those ids mean other things). For RuneLite's XP Drop plugin: each new drop posts ScriptPreFired
  // XPDROPS_SETDROPSIZE (996) with the drop's widget id at intStack[size - 4]; client.getWidget(DROPS_n) is that drop (child
  // 0 its text, the others its skill icons, by Staticons sprite id), and its writes (text colour, removing icons) are
  // display-only. client.runScript(XPDROP_DISABLED (2091), skill ordinal, xp) shows a drop with no XP gained (fake drop).
  // client.getEnum(XPDROP_COLORS (1169)) gives the colour setting's colours. The counter and drops are one overlay,
  // RuneLite's EXPERIENCE_TRACKER_WIDGET (a WidgetOverlay: movable, snapped to the setting's top corner).
  {
    const { Overlay, OverlayPosition, Dimension, FontManager, Color, SkillIconManager, Skill, eventBus, overlayManager, GameState } = rl;
    const XD = { CONTAINER: 0x007a0004, COUNTER: 0x007a000a, DROPS_0: 0x007a0012, SLOTS: 7 };
    const SCRIPT = { XPDROPS_SETDROPSIZE: 996, XPDROP_DISABLED: 2091 };
    const XPDROP_COLORS = 1169;
    const COLOURS = [['WHITE', 'White', 0xffffff], ['LILAC', 'Lilac', 0xc8a0ff], ['CYAN', 'Cyan', 0x00ffff], ['JADE', 'Jade', 0x00ff99],
      ['LIME', 'Lime', 0x99ff00], ['YELLOW', 'Yellow', 0xffff00], ['ORANGE', 'Orange', 0xff9900], ['PINK', 'Pink', 0xff80c0]];
    // OSRS's Staticons / Staticons2 sprite ids per skill (what the drop icons' getSpriteId answers)
    const STATICON = { ATTACK: 197, STRENGTH: 198, DEFENCE: 199, RANGED: 200, PRAYER: 201, MAGIC: 202, HITPOINTS: 203, AGILITY: 204, HERBLORE: 205,
      THIEVING: 206, CRAFTING: 207, FLETCHING: 208, MINING: 209, SMITHING: 210, FISHING: 211, COOKING: 212, FIREMAKING: 213, WOODCUTTING: 214,
      RUNECRAFT: 215, SLAYER: 216, FARMING: 217, HUNTER: 220, CONSTRUCTION: 221 };
    const STATICON_TOTAL = 222;
    const ITEMS = [
      { key: 'xpDropsEnabled', type: 'boolean', default: true },
      { key: 'xpDropsPosition', type: 'enum', default: 'RIGHT' },
      { key: 'xpDropsSize', type: 'enum', default: 'LARGEST' },
      { key: 'xpDropsDuration', type: 'enum', default: 'DEFAULT' },
      { key: 'xpDropsCounter', type: 'enum', default: 'TOTAL' },
      { key: 'xpDropsColour', type: 'enum', default: 'WHITE' },
      { key: 'xpDropsGroup', type: 'boolean', default: true },
    ];
    const cfg = rl.configProxy('xpdrop', ITEMS);
    const idx = (v, list) => Math.max(0, list.indexOf(v));
    // the OSRS varbits' values
    const varbit = (id) => {
      switch (id) {
        case 4692: return idx(cfg.xpDropsPosition(), ['RIGHT', 'CENTRE', 'LEFT']); // XPDROPS_POSITION
        case 4693: return idx(cfg.xpDropsSize(), ['SMALLEST', 'MEDIUM', 'LARGEST']); // XPDROPS_SIZE
        case 4694: return idx(cfg.xpDropsDuration(), ['DEFAULT', 'LONGER', 'LONGEST']); // XPDROPS_DURATION
        case 4695: return idx(cfg.xpDropsColour(), COLOURS.map((c) => c[0])); // XPDROPS_COLOUR
        case 4696: return cfg.xpDropsGroup() ? 0 : 1; // XPDROPS_GROUPSKILLS
        case 4697: return { TOTAL: 0, RECENT: 1, OFF: 30 }[cfg.xpDropsCounter()] | 0; // XPDROPS_COUNTER_TYPE (30 off)
        case 4698: return 0; // XPDROPS_PROGRESS_TYPE (no progress bar)
        case 4702: return state.active && cfg.xpDropsEnabled() ? 1 : 0; // XPDROPS_ENABLED (only with XP Drop on)
        default: return 0;
      }
    };
    const FONTS = [() => FontManager.small, () => FontManager.runescape, () => FontManager.bold];
    const LINE = [13, 15, 16];
    const TRAVEL = [100, 150, 200]; // px the drops rise before reaching the counter
    const SPEED = 50; // px per second (one pixel per 20 ms client cycle)
    const COUNTER = { w: 119, h: 24 };
    const ICON = 16;
    const state = { active: false, prev: null, pending: new Map(), drops: [], slot: 0, recentSkill: null, stack: null, pinnedTop: 0 };
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const fmt = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const defaultColour = () => COLOURS[varbit(4695)][2];
    const iconWidget = (drop, skill) => ({
      getId: () => drop.id, getSpriteId: () => STATICON[skill.name], getSkill: () => skill, isHidden: () => false, getType: () => 5,
    });
    const makeDrop = (gains, fake) => {
      const slot = state.slot; state.slot = (state.slot + 1) % XD.SLOTS;
      const drop = { id: XD.DROPS_0 + slot, slot, gains, total: gains.reduce((s, g) => s + g.xp, 0), colour: defaultColour(), born: now(), fake: !!fake };
      const text = {
        getId: () => drop.id, getType: () => 4, getText: () => fmt(drop.total), isHidden: () => false,
        getTextColor: () => drop.colour, setTextColor(c) { drop.colour = c & 0xffffff; return this; },
      };
      drop.children = [text, ...gains.map((g) => iconWidget(drop, g.skill))];
      drop.widget = { getId: () => drop.id, getChildren: () => drop.children, isHidden: () => false, getType: () => 0 };
      // a new drop starts at the bottom, or under the last one while that one is still in the way
      const size = varbit(4693);
      const bottom = TRAVEL[varbit(4694)];
      const last = state.drops[state.drops.length - 1];
      drop.start = last ? Math.max(bottom, dropY(last) + LINE[size]) : bottom;
      state.drops = state.drops.filter((d) => d.slot !== slot);
      state.drops.push(drop);
      // [proc,xpdrops_setdropsize](component, size, ...): RuneLite's XP Drop plugin recolours the drop here
      state.stack = [drop.id, size, 0, 0];
      try { eventBus.post('ScriptPreFired', { getScriptId: () => SCRIPT.XPDROPS_SETDROPSIZE, getScriptEvent: () => null }); } finally { state.stack = null; }
      return drop;
    };
    // a drop's y below the counter's bottom edge (0 = reached the counter)
    const dropY = (d) => d.start - (SPEED * (now() - d.born)) / 1000;
    const flush = () => {
      if (!state.pending.size) return;
      const gains = Skill.values().filter((s) => state.pending.has(s)).map((s) => ({ skill: s, xp: state.pending.get(s) }));
      state.pending.clear();
      if (!varbit(4702)) return;
      if (varbit(4696) === 0) makeDrop(gains);
      else for (const g of gains) makeDrop([g]);
    };
    const core = {
      subscribePriority: 1000, // before the plugins: the drops of a tick are made before their GameTick
      // the last-known XP per skill survives scene loads (LOADING on a teleport); only a log out / in (or a world hop's
      // re-login) forgets it, so the first gain after a map load still makes its drop
      onGameStateChanged(e) {
        const gs = e.getGameState();
        if (gs === GameState.LOGIN_SCREEN || gs === GameState.LOGGING_IN || gs === GameState.HOPPING) { state.prev = null; state.pending.clear(); state.drops = []; }
      },
      onStatChanged(e) {
        const skill = e.getSkill();
        if (!state.prev) state.prev = new Map();
        const before = state.prev.get(skill);
        state.prev.set(skill, e.getXp());
        if (before === undefined || e.getXp() <= before) return;
        state.pending.set(skill, (state.pending.get(skill) || 0) + (e.getXp() - before));
        state.recentSkill = skill;
      },
      onGameTick() { flush(); tracker.updatePosition(); },
    };
    eventBus.register(core);

    // the counter and drops: RuneLite's EXPERIENCE_TRACKER_WIDGET overlay (XpTrackerWidgetOverlay)
    class XpTrackerWidgetOverlay extends Overlay {
      constructor() { super(null); this.setPosition(OverlayPosition.TOP_RIGHT); this.setPriority(100); this.widgetScale = true; }
      getName() { return 'EXPERIENCE_TRACKER_WIDGET'; }
      updatePosition() {
        const p = [OverlayPosition.TOP_RIGHT, OverlayPosition.TOP_CENTER, OverlayPosition.TOP_LEFT][varbit(4692)];
        if (p !== this.position) this.setPosition(p);
      }
      render(g) {
        if (!client.getGameState || client.getGameState() !== GameState.LOGGED_IN || !varbit(4702)) return null;
        const size = varbit(4693);
        const font = FONTS[size]();
        const line = LINE[size];
        const counterType = varbit(4697);
        const counterH = counterType === 30 ? 0 : COUNTER.h;
        const w = COUNTER.w;
        const h = counterH + TRAVEL[varbit(4694)] + line;
        const align = varbit(4692); // 0 right, 1 centre, 2 left
        const colour = new Color(defaultColour());
        g.setFont(font);
        const fm = g.getFontMetrics(font);
        const shadowed = (s, x, y, c) => { g.setColor(Color.BLACK); g.drawString(s, x + 1, y + 1); g.setColor(c); g.drawString(s, x, y); };
        if (counterH) {
          g.setColor(new Color(0x3e, 0x35, 0x29, 200)); g.fillRect(0, 0, w, counterH);
          g.setColor(new Color(0x5a, 0x52, 0x45)); g.drawRect(0, 0, w - 1, counterH - 1);
          const skill = counterType === 1 ? state.recentSkill : null;
          let xp = 0;
          if (skill) xp = client.getSkillExperience(skill);
          else for (const s of Skill.values()) xp += client.getSkillExperience(s) | 0;
          const icon = SkillIconManager.getSkillImage(skill || { name: 'OVERALL' }, true);
          if (icon && icon.complete !== false) g.drawImage(icon, 4, Math.trunc((counterH - ICON) / 2), ICON, ICON);
          const s = fmt(xp);
          shadowed(s, w - 4 - fm.stringWidth(s), Math.trunc((counterH + font.ascent) / 2), colour);
        }
        // the drops, cut off where they reach the counter
        state.drops = state.drops.filter((d) => dropY(d) > -line);
        g.setClip && g.setClip(new rl.Rectangle(Math.round(g.tx), Math.round(g.ty + counterH * g.scale), 4096, Math.round((h - counterH) * g.scale)));
        for (const d of state.drops) {
          const y = counterH + dropY(d);
          const icons = d.children.slice(1).filter((c) => c != null);
          const text = d.children[0] ? d.children[0].getText() : '';
          const tw = fm.stringWidth(text);
          const total = tw + icons.length * (ICON + 2) + (icons.length ? 2 : 0);
          let x = align === 0 ? w - total : align === 1 ? Math.trunc((w - total) / 2) : 0;
          for (const ic of icons) {
            const img = SkillIconManager.getSkillImage(ic.getSkill(), true);
            if (img && img.complete !== false) g.drawImage(img, x, Math.round(y + (line - ICON) / 2), ICON, ICON);
            x += ICON + 2;
          }
          if (icons.length) x += 2;
          shadowed(text, x, Math.round(y + line - 3), new Color(d.colour));
        }
        g.setClip && g.setClip(null);
        return new Dimension(w, h);
      }
    }
    const tracker = new XpTrackerWidgetOverlay();
    overlayManager.add(tracker);

    // client hooks for the drops (additive: other ids go to the core's own)
    const baseGetWidget = client.getWidget.bind(client);
    const baseRunScript = client.runScript ? client.runScript.bind(client) : () => {};
    const baseStack = client.getIntStack ? client.getIntStack.bind(client) : () => [];
    const baseStackSize = client.getIntStackSize ? client.getIntStackSize.bind(client) : () => 0;
    Object.assign(client, {
      getWidget(group, child) {
        const packed = child === undefined ? group : ((group << 16) | child);
        if (packed >= XD.DROPS_0 && packed < XD.DROPS_0 + XD.SLOTS) {
          const d = state.drops.find((x) => x.id === packed);
          return d ? d.widget : null;
        }
        if (packed === XD.CONTAINER) {
          const b = tracker.getBounds();
          return { getId: () => packed, isHidden: () => !varbit(4702) || !b.width, getBounds: () => b, getChildren: () => [] };
        }
        return baseGetWidget(group, child);
      },
      runScript(id, ...args) {
        if (id === SCRIPT.XPDROP_DISABLED) {
          const skill = Skill.values()[args[0] | 0];
          if (skill && varbit(4702)) makeDrop([{ skill, xp: args[1] | 0 }], true);
          return;
        }
        baseRunScript(id, ...args);
      },
      getIntStack() { return state.stack || baseStack(); },
      getIntStackSize() { return state.stack ? state.stack.length : baseStackSize(); },
      getEnum(id) {
        if (id !== XPDROP_COLORS) return null;
        return { getId: () => id, getIntValue: (k) => (COLOURS[k] ? COLOURS[k][2] : -1), getIntVals: () => COLOURS.map((c) => c[2]), getKeys: () => COLOURS.map((_, i) => i), size: () => COLOURS.length };
      },
    });
    /** the XP Drop plugin's startUp / shutDown: the counter and drops exist only while it is on */
    const setActive = (on) => { state.active = !!on; if (!on) { state.drops = []; state.pending.clear(); } };
    rl.xpDrops = { varbit, state, tracker, setActive, STATICON, STATICON_TOTAL, COLOURS, XpTrackerWidgetOverlay };
    Object.assign(rl.ScriptID || {}, SCRIPT);
  }

  // Client.getWorldType (Skill Calculator): the current world's types from the server's world list (rl.worldService),
  // as a Set of WorldType names; MEMBERS from the player's membership while the list isn't in
  if (!client.getWorldType) {
    client.getWorldType = () => {
      const types = new Set();
      let w = null;
      try {
        const r = rl.worldService && rl.worldService.getWorlds();
        w = r ? r.getWorlds().find((x) => x.getId() === client.getWorld()) : null;
      } catch { w = null; }
      if (w) for (const t of w.getTypes()) types.add(t);
      else if (client.isMembers && client.isMembers()) types.add('MEMBERS');
      return types;
    };
  }

  Object.assign(rl, { statusOrbs, Prayer, Arc2D, widgetButtons, ItemStats, ItemEquipmentStats });
})();
