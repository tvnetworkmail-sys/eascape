// Info Boxes, page side: RuneLite's InfoBoxOverlay / InfoBoxComponent (BSD 2-Clause,
// Copyright (c) 2016-2017, Adam <Adam@sigterm.info> and RuneLite contributors) drawn over
// the 2004 game view, plus panels other plugins add (Opponent Information).
//
// Boxes go in groups by what they are (Logout timer, Boosts, Potions, Prayer, Spells,
// Other), each group its own row; they start stacked at the top left under any panels. Hold
// Alt and every group and panel gets a yellow outline; drag one to put it anywhere.
// Alt + right-click puts it back. The positions are saved (the sidebar side stores them).
//
// The boxes themselves: Boosts (RuneLite's BoostIndicator), the next boost drop
// (StatChangeIndicator), the idle logout timer, the active prayers and the prayer potion
// reminder (LostLite's own).
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const VIEW_W = 512;
  const VIEW_H = 334;
  const SEPARATOR = 3; // text baseline up from the bottom of a box
  // RuneLite's overlay management colours
  const MOVING = [0xffff00, 100];
  const MOVING_ACTIVE = [0xffff00, 200];

  // Lost City: boosted stats drop back by one every 100 ticks (stat_boost_restore, set at
  // login); the idle logout comes 90 s after the last mouse or key input.
  const BOOST_RESTORE_MS = 100 * 600;
  const LOGOUT_MS = 90 * 1000;

  const COMBAT = ['attack', 'strength', 'defence', 'ranged', 'magic'];
  const NOT_BOOSTED = new Set(['hitpoints', 'prayer']);
  const PRAYERS = ['Thick Skin', 'Burst of Strength', 'Clarity of Thought', 'Rock Skin', 'Superhuman Strength',
    'Improved Reflexes', 'Rapid Restore', 'Rapid Heal', 'Protect Item', 'Steel Skin', 'Ultimate Strength',
    'Incredible Reflexes', 'Protect from Magic', 'Protect from Missiles', 'Protect from Melee'];
  const PRAYER_VARP = 83; // prayer0 .. prayer14 (Lost City pack/varp.pack)
  const PRAYER_POTIONS = [2434, 139, 141, 143]; // Prayer potion(4..1)
  const SUPER_RESTORES = [3024, 3026, 3028, 3030]; // Super restore(4..1)

  let cfg = {};
  let icons = { skills: {}, prayers: [], misc: {} };
  let layout = { pos: {} }; // box or panel name -> { x, y } (game view pixels) once moved

  // state for the boost timer
  let lastBoosted = null;
  let loginAt = 0;
  let boostPhase = null; // a time a boost was seen dropping back (ms, performance.now)

  // interaction state
  let drawn = []; // [{ name, box | panel, x, y, w, h }] from the last frame (game view pixels)
  let drag = null; // { name, dx, dy, x, y }
  let hover = null; // the item under the mouse

  const enabled = (kind) => cfg[`show_${kind}`] !== false;
  const hex = (c, d) => {
    const m = /([0-9a-f]{6})$/i.exec(String(c || ''));
    return m ? parseInt(m[1], 16) : d;
  };
  const size = () => Math.max(16, Math.min(80, Number(cfg.size) || 35));
  const gap = () => Math.max(0, Math.min(20, cfg.gap === undefined ? 1 : Number(cfg.gap) | 0));
  const wrap = () => Math.max(1, Math.min(20, Number(cfg.wrap) || 4));

  function save() {
    window.postMessage({ __lostlite: true, type: 'infobox-layout', data: layout }, '*');
  }

  // ---------------------------------------------------------------- the boxes

  function timeText(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function boxes(now) {
    const out = [];
    const c = ll.client;
    if (!c || !ll.fields.localPlayer || !c[ll.fields.localPlayer]) {
      lastBoosted = null;
      loginAt = 0;
      boostPhase = null;
      providers(now); // they see the logout too (Timers & Buffs pauses some timers)
      return out;
    }
    if (!loginAt) loginAt = now;
    const stats = ll.readStats ? ll.readStats() : null;

    // Logout timer: the game's own idle timer
    if (enabled('logout') && ll.idleMs) {
      const idle = ll.idleMs();
      const from = Math.max(5, Math.min(90, Number(cfg.logoutFrom) || 30)) * 1000;
      if (idle !== null && LOGOUT_MS - idle <= from) {
        const left = LOGOUT_MS - idle;
        out.push({
          name: 'Logout timer', kind: 'logout', group: 'Logout timer', priority: 0, image: icons.misc.hourglass,
          text: timeText(left), colour: left < LOGOUT_MS * 0.1 ? 0xff4040 : 0xffffff,
          tooltip: left > 0 ? `Idle logout in ${Math.ceil(left / 1000)} s (move the mouse or press a key)` : 'Logging out when combat is over',
        });
      }
    }

    if (stats) {
      // Boosts
      const which = cfg.displayBoosts || 'combat';
      const threshold = Number(cfg.boostThreshold) || 0;
      let anyBuff = false;
      const now2 = {};
      for (const s of stats) {
        now2[s.skill] = s.boosted;
        if (NOT_BOOSTED.has(s.skill) || !s.level) continue;
        const prev = lastBoosted && lastBoosted[s.skill];
        // A boosted stat dropping by one towards its level: the restore timer just ran.
        if (typeof prev === 'number' && prev > s.level && s.boosted === prev - 1) boostPhase = now;
        if (s.boosted > s.level) anyBuff = true;
        if (s.boosted === s.level) continue;
        const combat = COMBAT.includes(s.skill);
        if ((which === 'combat' && !combat) || (which === 'noncombat' && combat)) continue;
        if (!enabled('boosts')) continue;
        const diff = s.boosted - s.level;
        const name = s.skill[0].toUpperCase() + s.skill.slice(1);
        out.push({
          name: `Boost ${name}`, kind: 'boosts', group: 'Boosts', priority: 1, image: icons.skills[s.skill],
          text: cfg.relativeBoost ? `${diff > 0 ? '+' : ''}${diff}` : String(s.boosted),
          colour: diff < 0 ? 0xee3333 : diff <= threshold ? 0xffff00 : 0x00ff00,
          tooltip: `${name} boost: ${s.boosted}/${s.level}`,
        });
      }
      lastBoosted = now2;
      // Next boost drop (RuneLite's "next buff change")
      if (enabled('boostTimer') && anyBuff) {
        const phase = boostPhase !== null ? boostPhase : loginAt;
        const left = BOOST_RESTORE_MS - ((now - phase) % BOOST_RESTORE_MS);
        out.push({
          name: 'Next boost drop', kind: 'boostTimer', group: 'Boosts', priority: 2, image: icons.misc.boostup,
          text: timeText(left), colour: 0xffffff,
          tooltip: `Boosted stats drop by one in ${Math.ceil(left / 1000)} s${boostPhase === null ? ' (about: no drop seen yet)' : ''}`,
        });
      }
    }

    // Active prayers
    if (enabled('prayers')) {
      const varps = ll.fields.varps && c[ll.fields.varps];
      if (varps) {
        for (let i = 0; i < PRAYERS.length; i++) {
          if (varps[PRAYER_VARP + i] !== 1) continue;
          out.push({ name: `Prayer ${PRAYERS[i]}`, kind: 'prayers', group: 'Prayer', priority: 3, image: icons.prayers[i], text: '', colour: 0xffffff, tooltip: PRAYERS[i] });
        }
      }
    }
    // Prayer potion reminder (LostLite's own): when a dose won't be wasted, or below a level
    if (enabled('prayerPotion') && stats) {
      const pr = stats.find((x) => x.skill === 'prayer');
      const inv = ll.readContainer ? ll.readContainer(ll.ITEMS.inventory, 28) : null;
      const have = (ids) => !!inv && inv.some((it) => it && ids.includes(it.id));
      const potion = have(PRAYER_POTIONS) ? 'prayer' : have(SUPER_RESTORES) ? 'super' : null;
      if (pr && pr.level > 0 && (potion || cfg.prayerWithout)) {
        const kind = potion || 'prayer';
        // Lost City's stat_heal: prayer potion 7 + 25% of your level, super restore 8 + 25%
        const restore = (kind === 'super' ? 8 : 7) + Math.floor((pr.level * 25) / 100);
        const missing = pr.level - pr.boosted;
        const level = Math.max(0, Math.min(99, Number(cfg.prayerLevel) || 0));
        const due = cfg.prayerMode === 'level' ? pr.boosted <= level : missing >= restore;
        if (due && missing > 0) {
          out.push({
            name: 'Prayer potion', kind: 'prayerPotion', group: 'Prayer', priority: 0,
            image: ll.itemIcon ? ll.itemIcon(kind === 'super' ? 3024 : 2434) : null,
            text: String(pr.boosted), colour: 0xff3333,
            tooltip: potion ? `Drink a ${kind === 'super' ? 'super restore' : 'prayer potion'}: +${Math.min(restore, missing)} prayer (${pr.boosted}/${pr.level})` : `Prayer ${pr.boosted}/${pr.level}: no prayer potion with you`,
          });
        }
      }
    }
    out.push(...providers(now));
    return out;
  }

  /** Boxes from other plugins (Timers & Buffs), while that plugin is on. */
  function providers(now) {
    const out = [];
    for (const [id, fn] of ll.infoBoxProviders || []) {
      const pl = ll.pagePlugins.get(id);
      if (pl && !pl.enabled) continue;
      try {
        for (const b of fn(now) || []) out.push(Object.assign({ priority: 5, colour: 0xffffff, text: '' }, b));
      } catch (e) {
        /* a broken provider never stops the others */
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- layout

  /**
   * Where everything goes this frame. Moved items sit where they were put; the rest stack at
   * the top left like RuneLite's TOP_LEFT corner: panels, then a row (or column) of boxes.
   * In game view pixels; box and panel sizes are screen pixels / k.
   */
  // The groups boxes go in, in the order they stack at the top left. A box says its group;
  // other plugins' boxes go in "Other" unless they say.
  const GROUPS = ['Logout timer', 'Boosts', 'Potions', 'Prayer', 'Spells', 'Other'];

  function arrange(list, panels = []) {
    const s = size() / k;
    const gp = gap() / k;
    const per = wrap();
    const out = [];
    const place = (name, w, h, dx, dy) => {
      const pos = drag && drag.name === name ? drag : layout.pos[name];
      let x = pos ? pos.x : dx;
      let y = pos ? pos.y : dy;
      x = Math.max(0, Math.min(VIEW_W - w, x));
      y = Math.max(0, Math.min(VIEW_H - h, y));
      return { x, y, w, h, moved: !!pos };
    };
    let top = 2;
    for (const p of panels) {
      const at = place(p.name, p.width / k, p.height / k, 2, top);
      if (!at.moved) top += at.h + 2 / k;
      out.push(Object.assign({ name: p.name, panel: p }, at));
    }
    // each group is its own row (or column) of boxes, moved as one
    const by = new Map();
    for (const b of list) {
      const g = GROUPS.includes(b.group) ? b.group : 'Other';
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(b);
    }
    for (const g of GROUPS) {
      const bs = by.get(g);
      if (!bs || !bs.length) continue;
      bs.sort((a, b) => a.priority - b.priority);
      const cols = Math.min(bs.length, per);
      const rows = Math.ceil(bs.length / per);
      const w = (cfg.vertical ? rows : cols) * (s + gp) - gp;
      const h = (cfg.vertical ? cols : rows) * (s + gp) - gp;
      const at = place(g, w, h, 2, top);
      if (!at.moved) top += h + 2 / k;
      const boxes = bs.map((box, i) => {
        const c = i % per;
        const r = Math.floor(i / per);
        return { box, s, x: at.x + (cfg.vertical ? r : c) * (s + gp), y: at.y + (cfg.vertical ? c : r) * (s + gp) };
      });
      out.push(Object.assign({ name: g, group: true, boxes }, at));
    }
    return out;
  }

  // ---------------------------------------------------------------- drawing
  //
  // RuneLite draws its overlays at the screen's own resolution, so a 35 px box is 35 px on
  // screen however big the game is. The 2004 game view is only 512 x 334 and LostLite
  // scales it up, so the boxes go on a see-through canvas laid over the game view instead,
  // drawn with the RuneScape fonts RuneLite uses. Positions are kept in game view pixels
  // (so a layout stays put when the window is resized); sizes are screen pixels.

  let ui = null; // { canvas, ctx }
  let k = 1; // screen (CSS) pixels per game pixel
  let view = { left: 0, top: 0 };
  let ops = []; // what was drawn last frame (for tests and the next paint)
  let lastPaint = 0;
  const bitmaps = new Map(); // image -> canvas
  let fontsReady = false;

  function measure() {
    const cv = document.getElementById('canvas');
    if (!cv || !cv.getBoundingClientRect) {
      k = 1;
      return false;
    }
    const r = cv.getBoundingClientRect();
    if (!r.width) return false;
    k = r.width / 765;
    view = { left: r.left + 4 * k, top: r.top + 4 * k };
    return true;
  }

  function ensureUi() {
    if (ui && ui.canvas.isConnected) return ui;
    if (!document.createElement || !document.body) return null;
    const canvas = document.createElement('canvas');
    canvas.id = 'lostlite-infoboxes';
    const st = canvas.style;
    st.setProperty('position', 'fixed', 'important');
    st.setProperty('pointer-events', 'none', 'important');
    st.setProperty('z-index', '2147483647', 'important');
    st.setProperty('visibility', 'visible', 'important');
    st.setProperty('display', 'block', 'important');
    st.setProperty('margin', '0', 'important');
    document.body.appendChild(canvas); // after the game canvas: on top of it
    ui = { canvas, ctx: canvas.getContext('2d') };
    return ui;
  }

  function loadFonts() {
    if (fontsReady || !cfg.fonts || typeof FontFace === 'undefined' || !document.fonts) return;
    fontsReady = true;
    for (const [name, b64] of Object.entries(cfg.fonts)) {
      try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        new FontFace(name, bytes.buffer).load().then((f) => document.fonts.add(f)).catch(() => {});
      } catch {
        /* falls back to a plain font */
      }
    }
  }

  const FONTS = { small: '16px LLRunescapeSmall, sans-serif', regular: '16px LLRunescape, sans-serif', bold: '16px LLRunescapeBold, sans-serif' };
  function fontFor(s) {
    if (s < 32) return FONTS.small; // RuneLite: boxes under 32 px use the small font
    return FONTS[cfg.font] || FONTS.regular;
  }

  function bitmap(img) {
    if (!img || !img.px || !document.createElement) return null;
    let c = bitmaps.get(img);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = img.w;
    c.height = img.h;
    const cx = c.getContext('2d');
    const data = cx.createImageData(img.w, img.h);
    for (let i = 0; i < img.px.length; i++) {
      const p = img.px[i];
      data.data[i * 4] = (p >> 16) & 255;
      data.data[i * 4 + 1] = (p >> 8) & 255;
      data.data[i * 4 + 2] = p & 255;
      data.data[i * 4 + 3] = (p >>> 24) & 255;
    }
    cx.putImageData(data, 0, 0);
    bitmaps.set(img, c);
    return c;
  }

  const rgba = (rgb, a = 1) => `rgba(${(rgb >> 16) & 255},${(rgb >> 8) & 255},${rgb & 255},${a})`;

  /** RuneLite's BackgroundComponent: the fill, a darker outer and a lighter inner line. */
  function background(x, y, w, h) {
    const rgb = hex(cfg.background, 0x463d32);
    const alpha = Math.max(0, Math.min(100, cfg.backgroundOpacity === undefined ? 61 : Number(cfg.backgroundOpacity))) / 100;
    const r = (rgb >> 16) & 255;
    const gg = (rgb >> 8) & 255;
    const b = rgb & 255;
    const outer = (Math.floor(r * 0.8) << 16) | (Math.floor(gg * 0.8) << 8) | Math.floor(b * 0.8);
    const inner = (Math.min(255, Math.floor(r * 1.2)) << 16) | (Math.min(255, Math.floor(gg * 1.2)) << 8) | Math.min(255, Math.floor(b * 1.2));
    const sa = Math.min(1, alpha * 1.4);
    ops.push({ op: 'fill', x, y, w, h, colour: rgba(rgb, alpha) });
    ops.push({ op: 'stroke', x: x + 0.5, y: y + 0.5, w: w - 1, h: h - 1, colour: rgba(outer, sa) });
    ops.push({ op: 'stroke', x: x + 1.5, y: y + 1.5, w: w - 3, h: h - 3, colour: rgba(inner, sa) });
  }

  // Everything below is in screen pixels from the game view's top left corner.
  function drawBox(p) {
    const { box } = p;
    const x = Math.round(p.x * k);
    const y = Math.round(p.y * k);
    const s = size();
    background(x, y, s, s);
    const img = box.image;
    if (img) {
      // RuneLite only ever shrinks an image to fit, never grows it
      const f = Math.min(1, s / img.w, s / img.h);
      const w = Math.floor(img.w * f);
      const h = Math.floor(img.h * f);
      ops.push({ op: 'image', img, x: x + Math.floor((s - w) / 2), y: y + Math.floor((s - h) / 2), w, h });
    }
    if (box.text) ops.push({ op: 'text', text: box.text, x: x + s / 2, y: y + s - SEPARATOR, colour: rgba(box.colour), font: fontFor(s), outline: !!cfg.outline, align: 'center' });
  }

  /** Panel size (Layout > Panel size): every panel (Opponent Information, Woodcutting, ...)
   *  is drawn at this scale; 1 = RuneLite's size. */
  function panelScale(own) {
    const pct = (x) => {
      const v = Number(x);
      return Number.isFinite(v) && v > 0 ? v / 100 : 1;
    };
    // every panel (Info Boxes > Layout > Panel size) times the plugin's own (its Panel size)
    return Math.max(0.5, Math.min(3, pct(cfg.panelSize) * pct(own)));
  }
  const panelFont = (S) => `${Math.round(16 * S)}px LLRunescape, sans-serif`;

  /** RuneLite's PanelComponent: a title and progress bars on the overlay background. */
  function drawPanel(item) {
    const p = item.panel;
    const S = panelScale(p.size);
    const x = Math.round(item.x * k);
    let y = Math.round(item.y * k);
    const font = panelFont(S);
    const row = 16 * S;
    background(x, y, p.width, p.height);
    y += 2 * S;
    for (const r of p.rows) {
      if (r.type === 'title') {
        ops.push({ op: 'text', text: r.text, x: x + p.width / 2, y: y + 14 * S, colour: rgba(r.colour === undefined ? 0xffffff : r.colour), font, align: 'center' });
        y += row + 2 * S;
      } else if (r.type === 'line') {
        // RuneLite's LineComponent: left text at the left edge, right text at the right
        ops.push({ op: 'text', text: r.left, x: x + 4 * S, y: y + 14 * S, colour: rgba(r.leftColour === undefined ? 0xffffff : r.leftColour), font, align: 'left' });
        ops.push({ op: 'text', text: r.right, x: x + p.width - 4 * S, y: y + 14 * S, colour: rgba(r.rightColour === undefined ? 0xffffff : r.rightColour), font, align: 'right' });
        y += row + 2 * S;
      } else if (r.type === 'bar') {
        const bw = p.width - 4 * S;
        const fill = Math.floor(bw * Math.max(0, Math.min(1, r.fraction)));
        ops.push({ op: 'fill', x: x + 2 * S + fill, y, w: bw - fill, h: row, colour: r.bg });
        ops.push({ op: 'fill', x: x + 2 * S, y, w: fill, h: row, colour: r.fg });
        ops.push({ op: 'text', text: r.text, x: x + 2 * S + bw / 2, y: y + 13 * S, colour: '#fff', font, align: 'center' });
        y += row + 2 * S;
      }
    }
  }

  /** Panels other plugins add: [{ name, rows: [{ type: 'title' | 'bar', ... }] }], sized here. */
  function panels(now) {
    const out = [];
    for (const [id, fn] of ll.overlayPanels || []) {
      const pl = ll.pagePlugins.get(id);
      if (pl && !pl.enabled) continue;
      try {
        for (const p of fn(now) || []) {
          let w = 129; // RuneLite's ComponentConstants.STANDARD_WIDTH
          for (const r of p.rows) {
            if (r.type === 'title') w = Math.max(w, textWidth(r.text) + 8);
            if (r.type === 'line') w = Math.max(w, textWidth(r.left) + textWidth(r.right) + 16);
          }
          const S = panelScale(p.size);
          out.push(Object.assign({}, p, { width: Math.round(w * S), height: Math.round((2 + p.rows.length * 18) * S) }));
        }
      } catch {
        /* a broken panel never stops the others */
      }
    }
    return out;
  }

  function textWidth(text) {
    if (ui && ui.ctx) {
      ui.ctx.font = FONTS.regular;
      return Math.ceil(ui.ctx.measureText(text).width);
    }
    return String(text).length * 7;
  }

  /** Where the game's hint arrow points (an NPC or a tile), in fine scene units; or null. */
  function hintTarget(g) {
    const c = g.client;
    const f = ll.fields;
    if (!f.hintType) return null;
    const type = c[f.hintType] | 0;
    if (type === 1) {
      const n = g.npcs().find((x) => x.index === (c[f.hintNpc] | 0));
      return n ? { x: n.x, z: n.z } : null;
    }
    if (type >= 2 && type <= 6) {
      return { x: ((c[f.hintTileX] | 0) - g.baseX) * 128 + 64, z: ((c[f.hintTileZ] | 0) - g.baseZ) * 128 + 64 };
    }
    return null;
  }

  /** An arrow at the edge of the view towards the hint target, when it's out of sight. */
  function hintArrow(g) {
    const t = hintTarget(g);
    if (!t) return null;
    const W = g.width;
    const H = g.height;
    const inside = t.x >= 128 && t.z >= 128 && t.x <= 13056 && t.z <= 13056;
    const pt = inside ? g.project(t.x, t.z, 0) : null;
    if (pt && pt.x >= 0 && pt.y >= 0 && pt.x <= W && pt.y <= H) return null; // you can see it
    let dx;
    let dy;
    if (pt) {
      dx = pt.x - W / 2;
      dy = pt.y - H / 2;
    } else {
      // behind the camera or outside the loaded area: the direction from the camera
      const c = g.client;
      const f = ll.fields;
      const me = c[f.localPlayer];
      if (!me) return null;
      const yaw = (((c[f.cameraYaw] | 0) & 2047) * Math.PI * 2) / 2048;
      const wx = t.x - me[f.entityX];
      const wz = t.z - me[f.entityZ];
      dx = wz * Math.sin(yaw) + wx * Math.cos(yaw);
      dy = -(wz * Math.cos(yaw) - wx * Math.sin(yaw));
    }
    if (!dx && !dy) return null;
    const m = 16; // from the edge
    const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-9), (H / 2 - m) / Math.abs(dy || 1e-9));
    const colour = /^#?[0-9a-f]{6,8}$/i.test(String(cfg.hintArrowColor || '')) ? `#${String(cfg.hintArrowColor).replace('#', '').slice(-6)}` : '#ffff00';
    return { op: 'arrow', x: W / 2 + dx * s, y: H / 2 + dy * s, angle: Math.atan2(dy, dx), colour };
  }

  function frame(g) {
    ops = [];
    measure();
    const now = performance.now();
    // world things at screen size first (respawn pies), under the boxes
    for (const [id, fn] of ll.screenDraws || []) {
      const pl = ll.pagePlugins.get(id);
      if (pl && !pl.enabled) continue;
      try {
        for (const o of (g && fn(g)) || []) {
          if (o.op === 'pie') ops.push(Object.assign({}, o, { x: o.x * k, y: o.y * k }));
        }
      } catch {
        /* never stops the boxes */
      }
    }
    // Off-screen hint arrow (3.3): the game's hint arrow (or a helper's) points at something
    // you can't see in the view, so an arrow at the edge of the view points the way
    try {
      const a = g && cfg.showHintArrow !== false ? hintArrow(g) : null;
      if (a) ops.push(Object.assign(a, { x: a.x * k, y: a.y * k, size: 12 * Math.max(1, k * 0.75) }));
    } catch {
      /* never stops the boxes */
    }
    // Under an open interface (bank, shop) like RuneLite's, which draws them under widgets
    const c = ll.client;
    const modal = ll.fields.mainModal && c && typeof c[ll.fields.mainModal] === 'number' && c[ll.fields.mainModal] !== -1;
    const list = boxes(now);
    const pans = panels(now);
    drawn = modal ? [] : arrange(list, pans);
    for (const it of drawn) {
      if (it.boxes) for (const p of it.boxes) drawBox(p);
      else drawPanel(it);
    }
  }

  /** After the interface: Alt outlines while moving, and the hovered box's tooltip. */
  function frameUI(g) {
    const mouse = mouseView();
    hover = null;
    if (ll.altDown || drag) {
      for (const it of drawn) {
        const active = drag ? drag.name === it.name : contains(it, mouse.x, mouse.y);
        const col = active ? MOVING_ACTIVE : MOVING;
        ops.push({ op: 'stroke', x: Math.round(it.x * k) + 0.5, y: Math.round(it.y * k) + 0.5, w: Math.round(it.w * k) - 1, h: Math.round(it.h * k) - 1, colour: rgba(col[0], Math.min(1, col[1] / 255)) });
      }
    } else if (mouse.inView && !(ll.fields.menuOpen && g && g.client[ll.fields.menuOpen])) {
      const it = hit(mouse.x, mouse.y);
      hover = it && it.boxes ? it.boxes.find((p) => mouse.x >= p.x && mouse.y >= p.y && mouse.x < p.x + p.s && mouse.y < p.y + p.s) || null : null;
      if (hover && hover.box.tooltip) tooltip(hover.box.tooltip, mouse.x * k, mouse.y * k);
    }
    paint(g);
  }

  /** RuneLite's TooltipComponent: text in a box by the mouse, kept inside the view. */
  function tooltip(text, mx, my) {
    let w = text.length * 7 + 8;
    if (ui && ui.ctx) {
      ui.ctx.font = FONTS.regular;
      w = Math.ceil(ui.ctx.measureText(text).width) + 8;
    }
    const h = 22;
    const vw = VIEW_W * k;
    const vh = VIEW_H * k;
    let x = mx + 12;
    let y = my + 16;
    if (x + w > vw) x = Math.max(0, mx - w - 4);
    if (y + h > vh) y = Math.max(0, my - h - 4);
    background(x, y, w, h);
    ops.push({ op: 'text', text, x: x + 4, y: y + 16, colour: '#fff', font: FONTS.regular, align: 'left' });
  }

  /** Puts last frame's boxes on the overlay canvas. */
  function paint(g) {
    if (!measure()) return;
    const u = ensureUi();
    if (!u || !u.ctx) return;
    loadFonts();
    lastPaint = performance.now();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(VIEW_W * k);
    const h = Math.round(VIEW_H * k);
    const st = u.canvas.style;
    st.setProperty('left', `${view.left}px`, 'important');
    st.setProperty('top', `${view.top}px`, 'important');
    st.setProperty('width', `${w}px`, 'important');
    st.setProperty('height', `${h}px`, 'important');
    if (u.canvas.width !== Math.round(w * dpr) || u.canvas.height !== Math.round(h * dpr)) {
      u.canvas.width = Math.round(w * dpr);
      u.canvas.height = Math.round(h * dpr);
    }
    const cx = u.ctx;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    cx.imageSmoothingEnabled = false;
    for (const o of ops) {
      if (o.op === 'fill') {
        cx.fillStyle = o.colour;
        cx.fillRect(o.x, o.y, o.w, o.h);
      } else if (o.op === 'stroke') {
        cx.strokeStyle = o.colour;
        cx.lineWidth = 1;
        cx.strokeRect(o.x, o.y, o.w, o.h);
      } else if (o.op === 'image') {
        const bm = bitmap(o.img);
        if (bm) cx.drawImage(bm, o.x, o.y, o.w, o.h);
      } else if (o.op === 'arrow') {
        // a filled arrowhead pointing the way, outlined in black
        const r = o.size || 12;
        cx.save();
        cx.translate(o.x, o.y);
        cx.rotate(o.angle);
        cx.beginPath();
        cx.moveTo(r, 0);
        cx.lineTo(-r * 0.8, -r * 0.75);
        cx.lineTo(-r * 0.35, 0);
        cx.lineTo(-r * 0.8, r * 0.75);
        cx.closePath();
        cx.fillStyle = o.colour;
        cx.fill();
        cx.strokeStyle = '#000';
        cx.lineWidth = 1.5;
        cx.stroke();
        cx.restore();
      } else if (o.op === 'pie') {
        // RuneLite's ProgressPieComponent: a filled arc from 12 o'clock, a circle around it
        const r = (o.diameter || 25) / 2;
        cx.beginPath();
        cx.moveTo(o.x, o.y);
        cx.arc(o.x, o.y, r, -Math.PI / 2, -Math.PI / 2 - o.progress * Math.PI * 2, true);
        cx.closePath();
        cx.fillStyle = o.fill;
        cx.fill();
        cx.beginPath();
        cx.arc(o.x, o.y, r, 0, Math.PI * 2);
        cx.strokeStyle = o.border;
        cx.lineWidth = 1;
        cx.stroke();
      } else if (o.op === 'text') {
        cx.font = o.font;
        cx.textAlign = o.align;
        cx.textBaseline = 'alphabetic';
        if (o.outline) {
          cx.fillStyle = '#000';
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) cx.fillText(o.text, Math.round(o.x) + dx, o.y + dy);
        } else {
          cx.fillStyle = '#000';
          cx.fillText(o.text, Math.round(o.x) + 1, o.y + 1); // RuneLite's text shadow
        }
        cx.fillStyle = o.colour;
        cx.fillText(o.text, Math.round(o.x), o.y);
      }
    }
    // The right-click menu goes over the boxes, as in RuneLite
    const c = g && g.client;
    const f = ll.fields;
    if (c && f.menuOpen && c[f.menuOpen] && c[f.menuArea] === 0 && f.menuX) {
      const n = c[f.menuCount] | 0;
      cx.clearRect(c[f.menuX] * k, c[f.menuY] * k, (c[f.menuWidth] | 0) * k, (n * 15 + 22) * k);
    }
  }

  // Nothing drawn for a moment (logged out, loading): clear the overlay.
  if (typeof setInterval === 'function') {
    setInterval(() => {
      if (ui && ui.ctx && performance.now() - lastPaint > 300) {
        ui.ctx.setTransform(1, 0, 0, 1, 0, 0);
        ui.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
        lastPaint = Infinity;
      }
    }, 250);
  }

  // The mouse in game view pixels, to the fraction (the game's own is whole pixels). Kept
  // up to date from every mouse event the runtime hands the plugin, and from moves.
  const mouseAt = { x: -1, y: -1, inView: false };
  function track(e) {
    if (!e || typeof e.clientX !== 'number' || !measure()) return;
    mouseAt.x = (e.clientX - view.left) / k;
    mouseAt.y = (e.clientY - view.top) / k;
    mouseAt.inView = mouseAt.x >= 0 && mouseAt.y >= 0 && mouseAt.x < VIEW_W && mouseAt.y < VIEW_H;
  }
  if (window.addEventListener) window.addEventListener('mousemove', track, true);
  const mouseView = () => (mouseAt.x >= 0 || mouseAt.y >= 0 ? mouseAt : ll.mouse);

  const contains = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  /** The box or panel under a point (the one drawn last, on top). */
  function hit(x, y) {
    for (let i = drawn.length - 1; i >= 0; i--) if (contains(drawn[i], x, y)) return drawn[i];
    return null;
  }

  // ---------------------------------------------------------------- moving
  // RuneLite's OverlayRenderer: hold Alt, drag; Alt + right-click resets. Every box and panel
  // moves on its own.

  function mouseDown(x0, y0, button, e) {
    track(e);
    if (!ll.altDown) return false;
    const m = mouseView();
    const x = m === ll.mouse ? x0 : m.x;
    const y = m === ll.mouse ? y0 : m.y;
    const it = hit(x, y);
    if (!it) return false;
    if (button === 2) {
      delete layout.pos[it.name];
      save();
      return true;
    }
    if (button !== 0) return false;
    drag = { name: it.name, dx: x - it.x, dy: y - it.y, x: it.x, y: it.y };
    return true;
  }

  function mouseMove(x0, y0, e) {
    track(e); // the runtime stops this event before our own listener while dragging
    if (!drag) return false;
    const m = mouseView();
    const x = m === ll.mouse ? x0 : m.x;
    const y = m === ll.mouse ? y0 : m.y;
    drag.x = x - drag.dx;
    drag.y = y - drag.dy;
    return true;
  }

  function mouseUp(x0, y0, button, e) {
    track(e);
    if (!drag) return false;
    const d = drag;
    drag = null;
    const it = drawn.find((x) => x.name === d.name);
    layout.pos[d.name] = { x: Math.round((it ? it.x : d.x) * 10) / 10, y: Math.round((it ? it.y : d.y) * 10) / 10 };
    save();
    return true;
  }

  ll.__infoBoxes = { boxes, arrange, hit, layout: () => layout, drawn: () => drawn, ops: () => ops, scale: () => k };

  ll.registerPlugin('infoboxes', {
    configure(config) {
      cfg = config || {};
      if (cfg.icons) icons = cfg.icons;
      // (layouts saved by 0.18, in groups, start again from the top left)
      if (cfg.layout && typeof cfg.layout === 'object' && cfg.layout.pos) {
        layout = { pos: JSON.parse(JSON.stringify(cfg.layout.pos)) };
      } else if (!cfg.layout || typeof cfg.layout !== 'object' || !cfg.layout.pos) {
        layout = { pos: {} };
      }
    },
    frame,
    frameUI,
    mouseDown,
    mouseMove,
    mouseUp,
    blur() {
      drag = null;
    },
    stop() {
      drawn = [];
      drag = null;
    },
  });
})();
