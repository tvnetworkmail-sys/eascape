// Ground Items, page side: port of RuneLite's GroundItemsPlugin and GroundItemsOverlay.
// Runs inside the game page (added after the LostLite runtime). The sidebar half
// (game.js) sends the settings and saves list changes.
//
// 2004 differences: no Grand Exchange, so "Value" is the item's shop value and HA is 60%
// of it; no ownership or tradeable flags in the 2004 client.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  const MAX_DISTANCE = 2500; // fine units from the player, as RuneLite
  const OFFSET_Z = 20;
  const STRING_GAP = 15;
  const RECTANGLE_SIZE = 8;
  const TEXT_HEIGHT = 12; // p11 line height
  const COINS = new Set([995]);
  // Menu action numbers for ground item entries (ops 1-5, examine, cast on, use on) differ
  // between client builds; the patcher reads them from the client (fields.actions).
  let OBJ_ACTIONS = new Set();
  let TAKE_ACTIONS = new Set();
  let WALK = -1;
  function loadActions() {
    const a = ll.fields && ll.fields.actions;
    if (!a || OBJ_ACTIONS.size) return;
    OBJ_ACTIONS = new Set(a.obj);
    TAKE_ACTIONS = new Set(a.objTake);
    WALK = a.walk;
  }
  const WHITE = 0xffffff;
  const BLACK = 0x000000;

  let cfg = {};
  let hidden = [];
  let highlighted = [];
  let hotkey = { key: 'Alt', mods: [] };
  let hotKeyPressed = false;
  let hideAll = false;
  let lastPress = 0;
  // Click boxes found while drawing the last frame (only while the hotkey is held).
  let boxes = { text: null, hidden: null, highlight: null };

  // ---------------------------------------------------------------- lists

  /** RuneLite's ItemThreshold: "Bones", "Coins > 100", "Rune*", "Feather < 50". */
  function parseThreshold(entry) {
    let e = String(entry || '').trim();
    if (!e) return null;
    let inequality = '>';
    let qty = 0;
    const m = /^(.*?)\s*([<>])\s*(\d+)\s*$/.exec(e);
    if (m) {
      e = m[1];
      inequality = m[2];
      qty = parseInt(m[3], 10) || 0;
    }
    const name = e.trim().toLowerCase();
    const wildcard = name.includes('*');
    const re = wildcard ? new RegExp('^' + name.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$') : null;
    return { name, wildcard, re, holds: (n) => (inequality === '<' ? n < qty : n > qty) };
  }

  function parseList(csv) {
    return String(csv || '').split(',').map(parseThreshold).filter(Boolean);
  }

  const NONE = 0;
  const WILDCARD = 1;
  const EXACT = 2;

  function listMatch(list, item) {
    const name = item.name.toLowerCase();
    for (const t of list) if (!t.wildcard && t.name === name && t.holds(item.quantity)) return EXACT;
    for (const t of list) if (t.wildcard && t.re.test(name) && t.holds(item.quantity)) return WILDCARD;
    return NONE;
  }

  const HIGHLIGHTED = 1;
  const HIDDEN = 2;

  function hiddenOrHighlighted(item) {
    const hl = listMatch(highlighted, item);
    if (hl === EXACT) return HIGHLIGHTED;
    const hi = listMatch(hidden, item);
    if (hi === EXACT) return HIDDEN;
    if (hl === WILDCARD) return HIGHLIGHTED;
    if (hi === WILDCARD) return HIDDEN;
    return NONE;
  }

  // 2004 has no way to know what an item is really worth, so (your call) no prices or price
  // colours: an item is highlighted, hidden or plain.
  function colourOf(item) {
    const state = hiddenOrHighlighted(item);
    item.highlighted = state === HIGHLIGHTED;
    item.hidden = state === HIDDEN;
    item.colour = item.highlighted ? rgb(cfg.highlightedColor) : item.hidden ? rgb(cfg.hiddenColor) : rgb(cfg.defaultColor);
    return item;
  }

  function rgb(hex) {
    const n = parseInt(String(hex || '#ffffff').replace('#', '').slice(-6), 16);
    return Number.isFinite(n) ? n : WHITE;
  }

  /** RuneLite's updateList: toggle a name on one list, and take it off the other. */
  function updateList(name, toHidden) {
    const split = (csv) => String(csv || '').split(',').map((x) => x.trim()).filter(Boolean);
    const hiddenSet = split(cfg.hiddenItems);
    const highlightSet = split(cfg.highlightedItems);
    const same = (x) => x.toLowerCase() === name.toLowerCase();
    if (toHidden) removeWhere(highlightSet, same);
    else removeWhere(hiddenSet, same);
    const items = toHidden ? hiddenSet : highlightSet;
    if (!removeWhere(items, same)) items.push(name);
    cfg.hiddenItems = hiddenSet.join(', ');
    cfg.highlightedItems = highlightSet.join(', ');
    hidden = parseList(cfg.hiddenItems);
    highlighted = parseList(cfg.highlightedItems);
    window.postMessage({ __lostlite: true, type: 'grounditems-lists', data: { hiddenItems: cfg.hiddenItems, highlightedItems: cfg.highlightedItems } }, '*');
  }

  function removeWhere(arr, fn) {
    let removed = false;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (fn(arr[i])) {
        arr.splice(i, 1);
        removed = true;
      }
    }
    return removed;
  }

  // ---------------------------------------------------------------- formatting

  /** RuneLite's QuantityFormatter.quantityToStackSize. */
  function stackSize(q) {
    if (q < 0) return '-' + stackSize(-q);
    if (q < 10000) return q.toLocaleString('en-US', { maximumFractionDigits: 3 });
    const suffixes = ['', 'K', 'M', 'B'];
    let suffix = '';
    let div = 1;
    for (let i = suffixes.length - 1; i >= 0; i--) {
      div = Math.pow(10, i * 3);
      if (q / div >= 1) {
        suffix = suffixes[i];
        break;
      }
    }
    let s = (q / div).toLocaleString('en-US', { maximumFractionDigits: 3 });
    s = s.length > 4 ? s.slice(0, 4) : s;
    return (s.endsWith('.') ? s.slice(0, 3) : s) + suffix;
  }

  function label(item) {
    let s = item.name;
    if (item.quantity > 1) s += ` (${stackSize(item.quantity)})`;
    return s;
  }

  // ---------------------------------------------------------------- despawn timers
  //
  // The game doesn't say when an item will disappear, so (like RuneLite) the timer only shows
  // for items we saw appear: something you dropped (it left your inventory and landed next
  // to you) lasts 300 ticks; a monster's drop (it appeared where the monster died) lasts
  // 200 ticks. Those are Lost City's times (^lootdrop_duration 200, drops 1.5 x that); a
  // tick is 0.6 s. Other items (already there, or someone else's) get no timer.

  const TICK = 600;
  const DROP_TICKS = 300;
  const LOOT_TICKS = 200;
  const spawns = new Map(); // "x,z,level,id" -> end time (ms)
  let present = new Set();
  let sceneKey = '';
  let sceneAt = 0;
  let invBefore = null;
  const lost = new Map(); // item id -> when it left the inventory
  const deaths = []; // { x, z, t }
  const dying = new Set(); // npc indexes already counted
  let lastTrack = 0;

  function trackDespawns(g) {
    const now = performance.now();
    if (now - lastTrack < 100) return;
    lastTrack = now;
    const me = g.player();
    if (!me) return;
    const key = `${g.baseX},${g.baseZ},${g.level}`;
    if (key !== sceneKey) {
      // a new area loaded: everything appears at once, none of it is new
      sceneKey = key;
      sceneAt = now;
    }
    // what left the inventory
    const inv = ll.readContainer ? ll.readContainer(ll.ITEMS.inventory, 28) : null;
    if (inv) {
      const counts = new Map();
      for (const it of inv) if (it) counts.set(it.id, (counts.get(it.id) || 0) + (it.quantity || 1));
      if (invBefore) for (const [id, n] of invBefore) if ((counts.get(id) || 0) < n) lost.set(id, now);
      invBefore = counts;
    }
    // where monsters died
    for (const n of g.npcs()) {
      if (n.totalHealth > 0 && n.health === 0) {
        if (!dying.has(n.index)) {
          dying.add(n.index);
          deaths.push({ x: g.baseX + (n.x >> 7), z: g.baseZ + (n.z >> 7), size: n.size || 1, t: now });
        }
      } else dying.delete(n.index);
    }
    while (deaths.length && now - deaths[0].t > 8000) deaths.shift();
    // items now on the ground around you
    const px = me.x >> 7;
    const pz = me.z >> 7;
    const mx = g.baseX + px;
    const mz = g.baseZ + pz;
    const curr = new Set();
    for (let x = Math.max(0, px - 30); x <= Math.min(103, px + 30); x++) {
      for (let z = Math.max(0, pz - 30); z <= Math.min(103, pz + 30); z++) {
        const raw = g.groundItems(x, z);
        if (!raw || !raw.length) continue;
        const wx = g.baseX + x;
        const wz = g.baseZ + z;
        for (const o of raw) {
          const k = `${wx},${wz},${g.level},${o.id}`;
          curr.add(k);
          if (present.has(k) || spawns.has(k) || now - sceneAt < 1500) continue;
          const dropped = lost.has(o.id) && now - lost.get(o.id) < 2000 && Math.max(Math.abs(wx - mx), Math.abs(wz - mz)) <= 1;
          const loot = deaths.some((d) => wx >= d.x - 1 && wx <= d.x + d.size && wz >= d.z - 1 && wz <= d.z + d.size);
          if (dropped) spawns.set(k, now + DROP_TICKS * TICK);
          else if (loot) spawns.set(k, now + LOOT_TICKS * TICK);
        }
      }
    }
    // gone (picked up, or vanished): forget it; out of sight: keep it until its time is up
    for (const [k, end] of spawns) {
      const [x, z, lv] = k.split(',').map(Number);
      const looked = lv === g.level && Math.abs(x - mx) <= 30 && Math.abs(z - mz) <= 30;
      if (end < now - 5000 || (looked && !curr.has(k) && now - sceneAt > 1500)) spawns.delete(k);
    }
    present = curr;
  }

  /** " (1:23)" / " (138 ticks)" for an item we saw appear, or ''. */
  function despawnText(g, item) {
    const mode = cfg.despawnTimer || 'seconds';
    if (mode === 'off') return '';
    const end = spawns.get(`${g.baseX + item.x},${g.baseZ + item.z},${g.level},${item.id}`);
    if (!end) return '';
    const left = Math.max(0, end - performance.now());
    if (mode === 'ticks') return ` (${Math.ceil(left / TICK)})`;
    const s = Math.ceil(left / 1000);
    return ` (${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')})`;
  }

  // ---------------------------------------------------------------- collecting

  /** Items on scene tile (x, z), same ids merged like RuneLite, in pile order. */
  function tileItems(g, x, z) {
    const raw = g.groundItems(x, z);
    if (!raw || !raw.length) return null;
    const byId = new Map();
    for (const o of raw) {
      const have = byId.get(o.id);
      if (have) have.quantity += o.count;
      else byId.set(o.id, { id: o.id, quantity: o.count, x, z });
    }
    const out = [];
    for (const it of byId.values()) {
      const info = g.item(it.id);
      it.name = info.name || `Item ${it.id}`;
      it.stackable = info.stackable;
      out.push(colourOf(it));
    }
    return out;
  }

  // ---------------------------------------------------------------- drawing

  function inBox(b, m) {
    return b && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
  }

  /** RuneLite's drawRectangle: shadow, outline, fill when on the list, then - or +. */
  function drawBox(g, b, colour, inList, hiddenBox) {
    g.rect(b.x + 1, b.y + 1, b.w, b.h, BLACK);
    g.rect(b.x, b.y, b.w, b.h, colour);
    if (inList) g.fillRect(b.x, b.y, b.w + 1, b.h + 1, colour);
    const midY = b.y + (b.h >> 1);
    g.line(b.x + 2, midY, b.x + b.w - 2, midY, WHITE);
    if (!hiddenBox) {
      const midX = b.x + (b.w >> 1);
      g.line(midX, b.y + 2, midX, b.y + b.h - 2, WHITE);
    }
  }

  function frame(g) {
    trackDespawns(g);
    const overlayMode = cfg.itemHighlightMode;
    const dontShowOverlay = (overlayMode === 'menu' || overlayMode === 'none' || hideAll) && !hotKeyPressed;
    if (dontShowOverlay && !cfg.highlightTiles) {
      boxes = { text: null, hidden: null, highlight: null };
      return;
    }
    const me = g.player();
    if (!me) return;
    const mouse = g.mouse;
    const pressed = hotKeyPressed;
    const radius = Math.ceil(MAX_DISTANCE / 128);
    const px = me.x >> 7;
    const pz = me.z >> 7;
    const drawn = [];
    for (let x = Math.max(0, px - radius); x <= Math.min(103, px + radius); x++) {
      for (let z = Math.max(0, pz - radius); z <= Math.min(103, pz + radius); z++) {
        const cx = x * 128 + 64;
        const cz = z * 128 + 64;
        if (Math.hypot(cx - me.x, cz - me.z) > MAX_DISTANCE) continue;
        const items = tileItems(g, x, z);
        if (!items) continue;
        let offset = 0;
        for (const item of items) {
          if (!item.highlighted && !pressed) {
            if (item.hidden) continue;
            if (cfg.showHighlightedOnly) continue;
          }
          if (cfg.highlightTiles) {
            const poly = g.tilePoly(x, z);
            if (poly) g.polygon(poly, item.colour);
          }
          if (dontShowOverlay) continue;
          const text = label(item) + despawnText(g, item);
          const p = g.project(cx, cz, OFFSET_Z);
          if (!p) continue;
          const w = g.textWidth(text);
          drawn.push({ item, text, x: p.x - (w >> 1), y: p.y - STRING_GAP * offset, w });
          offset++;
        }
      }
    }

    // While the hotkey is held, work out which label the mouse is over (drawn last, on top).
    const found = { text: null, hidden: null, highlight: null };
    let top = null;
    if (pressed) {
      for (const d of drawn) {
        d.bounds = { x: d.x - 2, y: d.y - TEXT_HEIGHT - 2, w: d.w + 4, h: TEXT_HEIGHT + 4 };
        d.hiddenBox = { x: d.bounds.x + d.bounds.w + 2, y: d.y - ((RECTANGLE_SIZE + TEXT_HEIGHT) >> 1), w: RECTANGLE_SIZE, h: RECTANGLE_SIZE };
        d.highlightBox = { x: d.hiddenBox.x + RECTANGLE_SIZE + 2, y: d.hiddenBox.y, w: RECTANGLE_SIZE, h: RECTANGLE_SIZE };
        if (top) continue;
        if (inBox(d.bounds, mouse)) found.text = d;
        else if (inBox(d.hiddenBox, mouse)) found.hidden = d;
        else if (inBox(d.highlightBox, mouse)) found.highlight = d;
        else continue;
        top = d;
      }
      if (top) {
        drawn.splice(drawn.indexOf(top), 1);
        drawn.push(top);
      }
    }
    boxes = found;

    for (const d of drawn) {
      const colour = d.item.colour;
      if (pressed) {
        const isTop = d === top;
        if (isTop && (inBox(d.bounds, mouse) || inBox(d.hiddenBox, mouse) || inBox(d.highlightBox, mouse))) {
          // RuneLite's BackgroundComponent: translucent panel colour with a darker border.
          g.fillRect(d.bounds.x, d.bounds.y, d.bounds.w, d.bounds.h, 0x463d32, 156);
          g.rect(d.bounds.x, d.bounds.y, d.bounds.w - 1, d.bounds.h - 1, 0x382c22, 200);
        }
        drawBox(g, d.hiddenBox, isTop && inBox(d.hiddenBox, mouse) ? 0xff0000 : colour, d.item.hidden, true);
        drawBox(g, d.highlightBox, isTop && inBox(d.highlightBox, mouse) ? 0x00ff00 : colour, d.item.highlighted, false);
      }
      g.text(d.text, d.x, d.y, colour, { outline: !!cfg.textOutline });
    }
  }

  // ---------------------------------------------------------------- menu

  /** Ground item entries in the menu, with the item each one is for. */
  function groundEntries(c, arrays, rt) {
    loadActions();
    const f = rt.fields;
    const n = c[f.menuCount] | 0;
    const [opt, act, pa, pb, pc] = arrays;
    const level = c[f.level] | 0;
    const tileCache = new Map();
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = act[i] >= 2000 ? act[i] - 2000 : act[i];
      if (!OBJ_ACTIONS.has(a) || String(opt[i]).indexOf('@lre@') < 0) continue;
      const key = pb[i] * 1000 + pc[i];
      if (!tileCache.has(key)) {
        const levels = c[f.groundObj];
        const list = levels && levels[level] && levels[level][pb[i]] && levels[level][pb[i]][pc[i]];
        const by = new Map();
        if (list) for (let o = list[f.listHead](); o; o = list[f.listNext]()) by.set(o[f.objId], (by.get(o[f.objId]) || 0) + o[f.objCount]);
        tileCache.set(key, by);
      }
      const id = pa[i];
      const quantity = tileCache.get(key).get(id) || 1;
      const info = rt.itemInfo(id);
      const item = colourOf({
        id, quantity, name: info.name, stackable: info.stackable,
      });
      out.push({ i, action: a, item });
    }
    return out;
  }

  /** Before the swap rules: hidden items lose the left click (RuneLite's deprioritize). */
  function menuBefore(c, arrays, rt) {
    if (!cfg.deprioritizeHiddenItems) return;
    const f = rt.fields;
    const n = c[f.menuCount] | 0;
    const act = arrays[1];
    const deprioritised = groundEntries(c, arrays, rt)
      .filter((e) => e.item.hidden && !e.item.highlighted && TAKE_ACTIONS.has(e.action))
      .map((e) => e.i);
    if (!deprioritised.length) return;
    // Deprioritised entries go below "Walk here", so they're never the left click. (The
    // menu is bottom first: index 0 is Cancel, the last index is the left click.)
    let walk = -1;
    for (let i = 0; i < n; i++) if (act[i] === WALK || act[i] === WALK + 2000) walk = i;
    const low = new Set(deprioritised.filter((i) => i > walk));
    if (!low.size) return;
    const order = [];
    for (let i = 0; i < n; i++) {
      if (low.has(i)) continue;
      order.push(i);
      // Just below Walk here; with no Walk here, just above Cancel.
      if (i === walk) for (const d of [...low].sort((x, y) => x - y)) order.splice(order.length - 1, 0, d);
      else if (walk < 0 && i === 0) for (const d of [...low].sort((x, y) => x - y)) order.push(d);
    }
    const copy = arrays.map((arr) => order.map((i) => arr[i]));
    for (let q = 0; q < arrays.length; q++) for (let k = 0; k < n; k++) arrays[q][k] = copy[q][k];
  }

  /** After the swap rules: colours, quantities and collapsing duplicates. */
  function menu(c, arrays, rt) {
    const f = rt.fields;
    const n = c[f.menuCount] | 0;
    if (!n) return;
    const [opt, act, pa, pb, pc] = arrays;
    const recolourMode = cfg.itemHighlightMode === 'menu' || cfg.itemHighlightMode === 'both';
    for (const { i, item } of groundEntries(c, arrays, rt)) {
      let text = String(opt[i]);
      const at = text.indexOf('@lre@');
      const canRecolour = item.highlighted || (item.hidden && cfg.recolorMenuHiddenItems);
      if (recolourMode && canRecolour && item.colour !== rgb(cfg.defaultColor)) {
        const tag = rt.colourTag(item.colour);
        const mode = cfg.menuHighlightMode;
        if (mode === 'both' || mode === 'name') text = text.slice(0, at) + tag + text.slice(at + 5);
        if (mode === 'both' || mode === 'option') text = tag + text;
      }
      if (cfg.showMenuItemQuantities && item.stackable && item.quantity > 1) text += ` (${item.quantity})`;
      opt[i] = text;
    }
    if (cfg.collapseEntries) {
      // Identical ground item entries (same option, item and tile) become one "... x N".
      const seen = new Map();
      const keep = [];
      for (let i = n - 1; i >= 0; i--) {
        const a = act[i] >= 2000 ? act[i] - 2000 : act[i];
        const key = OBJ_ACTIONS.has(a) ? `${opt[i]}|${act[i]}|${pa[i]}|${pb[i]}|${pc[i]}` : null;
        if (key && seen.has(key)) {
          seen.get(key).count++;
          continue;
        }
        const row = { i, count: 1 };
        if (key) seen.set(key, row);
        keep.push(row);
      }
      if (keep.length !== n) {
        keep.reverse();
        const copy = arrays.map((arr) => keep.map((r) => arr[r.i]));
        keep.forEach((r, k) => {
          for (let q = 0; q < arrays.length; q++) arrays[q][k] = copy[q][k];
          if (r.count > 1) arrays[0][k] = `${arrays[0][k]} x ${r.count}`;
        });
        c[f.menuCount] = keep.length;
      }
    }
  }

  // ---------------------------------------------------------------- input

  function hotkeyMatches(e) {
    const key = e.key === 'Control' ? 'Ctrl' : e.key;
    return key.toLowerCase() === hotkey.key.toLowerCase();
  }

  function key(e, down) {
    if (!hotkeyMatches(e)) return false;
    if (down) {
      if (e.repeat) return true;
      // RuneLite's GroundItemHotkeyListener, including double-tap to hide everything.
      const now = performance.now();
      if (hideAll) {
        hideAll = false;
        hotKeyPressed = true;
        lastPress = 0;
      } else if (lastPress && !hotKeyPressed && cfg.doubleTapDelay > 0 && now - lastPress < cfg.doubleTapDelay) {
        hideAll = true;
        lastPress = 0;
      } else {
        hotKeyPressed = true;
        lastPress = now;
      }
    } else {
      hotKeyPressed = false;
      boxes = { text: null, hidden: null, highlight: null };
    }
    // Alt on its own would otherwise move focus to the window menu on Windows.
    return hotkey.key === 'Alt';
  }

  function mouseDown(x, y, button) {
    if (!hotKeyPressed) return false;
    const m = { x, y };
    if (button === 0) {
      if (boxes.hidden && inBox(boxes.hidden.hiddenBox, m)) {
        updateList(boxes.hidden.item.name, true);
        return true;
      }
      if (boxes.highlight && inBox(boxes.highlight.highlightBox, m)) {
        updateList(boxes.highlight.item.name, false);
        return true;
      }
      if (boxes.text && inBox(boxes.text.bounds, m)) {
        updateList(boxes.text.item.name, false);
        return true;
      }
    } else if (button === 2) {
      if (boxes.text && inBox(boxes.text.bounds, m)) {
        updateList(boxes.text.item.name, true);
        return true;
      }
    }
    return false;
  }

  ll.registerPlugin('grounditems', {
    configure(config) {
      cfg = config || {};
      hidden = parseList(cfg.hiddenItems);
      highlighted = parseList(cfg.highlightedItems);
      const parts = String(cfg.hotkey || 'Alt').split('+');
      hotkey = { key: parts.pop() || 'Alt', mods: parts };
    },
    frame,
    menu: menuBefore,
    menuAfter: menu,
    key,
    mouseDown,
    blur() {
      hotKeyPressed = false;
    },
    stop() {
      hotKeyPressed = false;
      hideAll = false;
    },
  });

  // For tests
  ll.__groundItems = { parseList, listMatch, stackSize, label, updateList: (n, h) => updateList(n, h), state: () => ({ cfg, hotKeyPressed, hideAll }) };
})();
