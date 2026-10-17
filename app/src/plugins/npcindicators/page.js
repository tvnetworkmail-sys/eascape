// NPC Indicators, page side: port of RuneLite's NpcIndicatorsPlugin and NpcSceneOverlay.
// Highlights NPCs by name (with * wildcards) or by tagging single NPCs: hold Alt (the tag
// key setting), right-click an NPC and choose Tag / Tag-All. The hull is the outline of the NPC's model
// as the game draws it, like RuneLite.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  // NPC menu action numbers (ops 1-5, examine, cast on, use on; each can also be +2000)
  // differ between client builds; the patcher reads them from the client (fields.actions).
  let NPC_ACTIONS = new Set();
  let EXAMINE = -1;
  function loadActions() {
    const a = ll.fields && ll.fields.actions;
    if (!a || NPC_ACTIONS.size) return;
    NPC_ACTIONS = new Set(a.npc);
    EXAMINE = a.npcExamine;
  }

  let cfg = {};
  let names = [];
  let tags = new Set(); // NPC indexes tagged this session (RuneLite clears them on login)
  let lastLoggedIn = false;
  let hullMisses = 0;
  let hullReported = false;

  function rgb(hex) {
    const n = parseInt(String(hex || '#00ffff').replace('#', '').slice(-6), 16);
    return Number.isFinite(n) ? n : 0x00ffff;
  }

  function parseNames(csv) {
    return String(csv || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).map((name) => ({
      name,
      re: name.includes('*') ? new RegExp('^' + name.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$') : null,
    }));
  }

  function nameMatch(name) {
    const n = String(name || '').toLowerCase();
    return names.some((x) => (x.re ? x.re.test(n) : x.name === n));
  }

  function exactMatch(name) {
    const n = String(name || '').toLowerCase();
    return names.some((x) => !x.re && x.name === n);
  }

  function wildcardOnly(name) {
    const n = String(name || '').toLowerCase();
    return names.some((x) => x.re && x.re.test(n) && x.name !== n);
  }

  function isHighlighted(npc) {
    return tags.has(npc.index) || (npc.name && nameMatch(npc.name));
  }

  function isDying(npc) {
    return npc.totalHealth > 0 && npc.health === 0 && npc.inCombat;
  }

  function saveNames(list) {
    cfg.npcToHighlight = list.join(', ');
    names = parseNames(cfg.npcToHighlight);
    window.postMessage({ __lostlite: true, type: 'npcindicators-list', data: cfg.npcToHighlight }, '*');
  }

  // ---------------------------------------------------------------- overlay

  function frame(g) {
    const loggedIn = ll.loggedIn;
    if (loggedIn && !lastLoggedIn) tags.clear();
    lastLoggedIn = loggedIn;
    const colour = rgb(cfg.npcColor);
    const fill = rgb(cfg.fillColor);
    const fillAlpha = Math.max(0, Math.min(255, Number(cfg.fillOpacity) | 0));
    const width = Math.max(1, Math.min(3, Number(cfg.borderWidth) | 0));
    const style = { fill, fillAlpha, width };
    for (const npc of g.npcs()) {
      if (!isHighlighted(npc)) continue;
      if (cfg.ignoreDeadNpcs && isDying(npc)) continue;
      if (cfg.highlightHull) {
        const hull = g.hull(npc.typecode);
        if (hull) {
          g.polygon(hull, colour, style);
          hullMisses = 0;
        } else if (++hullMisses === 300 && !hullReported) {
          // Highlighted NPCs on screen but no model outline for a while: say so in the log.
          hullReported = true;
          window.postMessage({ __lostlite: true, type: 'log', data: '[npcindicators] no NPC model outlines captured yet' }, '*');
        }
      }
      if (cfg.highlightTile) {
        const poly = g.areaPoly(npc.x, npc.z, npc.size);
        if (poly) g.polygon(poly, colour, style);
      }
      if (cfg.highlightTrueTile) {
        // The tile the server has the NPC on (it may still be walking there).
        const poly = g.areaPoly(npc.trueX * 128 + npc.size * 64, npc.trueZ * 128 + npc.size * 64, npc.size);
        if (poly) g.polygon(poly, colour, style);
      }
      if (cfg.highlightSouthWestTile) {
        const poly = g.tilePoly((npc.x - (npc.size - 1) * 64) >> 7, (npc.z - (npc.size - 1) * 64) >> 7, 1);
        if (poly) g.polygon(poly, colour, style);
      }
      if (cfg.highlightSouthWestTrueTile) {
        const poly = g.tilePoly(npc.trueX, npc.trueZ, 1);
        if (poly) g.polygon(poly, colour, style);
      }
      if (cfg.drawNames && npc.name) {
        const p = g.project(npc.x, npc.z, npc.height + 40);
        if (p) {
          const w = g.textWidth(npc.name);
          g.text(npc.name, p.x - (w >> 1), p.y, colour);
        }
      }
    }
  }

  // ---------------------------------------------------------------- menu

  function npcAt(rt, c, index) {
    const f = rt.fields;
    const n = c[f.npcs] && c[f.npcs][index];
    const t = n && n[f.npcType];
    if (!t) return null;
    return rt.entityInfo(n, { index, name: t[f.npcName] == null ? null : String(t[f.npcName]), level: t[f.npcLevel] | 0 });
  }

  /** "Attack @yel@Goblin @gre@(level-2)" recoloured by style: name, level or both. */
  function recolour(text, tag, style) {
    const at = text.indexOf('@yel@');
    if (at < 0) return text;
    const option = text.slice(0, at);
    const target = text.slice(at);
    const lvl = target.search(/ @[a-z0-9~]{3}@\(level-\d+\)\s*$/i);
    const name = lvl >= 0 ? target.slice(0, lvl) : target;
    const level = lvl >= 0 ? target.slice(lvl) : '';
    const plainName = name.replace(/@[a-z0-9~]{3}@/gi, '');
    if (style === 'both') return option + tag + plainName + level.replace(/@[a-z0-9~]{3}@/gi, '');
    if (style === 'name') return option + tag + plainName + level;
    if (style === 'level') return option + name + (level ? ' ' + tag + level.replace(/@[a-z0-9~]{3}@/gi, '').trim() : '');
    return text;
  }

  function menuAfter(c, arrays, rt) {
    loadActions();
    const f = rt.fields;
    const [opt, act, pa] = arrays;
    const colourTag = rt.colourTag(rgb(cfg.npcColor));
    const examines = [];
    for (let i = (c[f.menuCount] | 0) - 1; i >= 0; i--) {
      if (act[i] === rt.CUSTOM_ACTION) continue;
      const a = act[i] >= 2000 ? act[i] - 2000 : act[i];
      if (!NPC_ACTIONS.has(a)) continue;
      const npc = npcAt(rt, c, pa[i]);
      if (!npc) continue;
      if (a === EXAMINE) examines.push({ i, npc });
      if (cfg.highlightMenuStyle !== 'none' && isHighlighted(npc) && !(cfg.ignoreDeadNpcs && isDying(npc))) {
        opt[i] = recolour(String(opt[i]), colourTag, cfg.highlightMenuStyle);
      }
    }
    // Tag key (Alt by default; RuneLite uses Shift) + right-click: Tag / Tag-All under
    // each NPC's Examine.
    const held = { shift: rt.shiftDown, alt: rt.altDown, ctrl: rt.ctrlDown }[cfg.tagKey || 'alt'];
    if (!held) return;
    for (const { i, npc } of examines) {
      if (!npc.name) continue;
      const shown = String(opt[i]).slice(String(opt[i]).indexOf('@'));
      const tagged = tags.has(npc.index);
      const entries = [[`${tagged ? 'Un-tag' : 'Tag'} ${shown}`, () => {
        if (tags.has(npc.index)) tags.delete(npc.index);
        else tags.add(npc.index);
        window.postMessage({ __lostlite: true, type: 'log', data: `[npcindicators] ${tags.has(npc.index) ? 'Tagged' : 'Un-tagged'} ${npc.name} (#${npc.index})` }, '*');
      }]];
      // Untag-All isn't offered for NPCs highlighted only by a wildcard (it can't remove those).
      if (!wildcardOnly(npc.name)) {
        const exact = exactMatch(npc.name);
        entries.push([`${exact ? 'Un-tag-All' : 'Tag-All'} ${shown}`, () => {
          const list = String(cfg.npcToHighlight || '').split(',').map((x) => x.trim()).filter(Boolean);
          const kept = list.filter((x) => x.toLowerCase() !== npc.name.toLowerCase());
          if (kept.length === list.length) kept.push(npc.name);
          saveNames(kept);
        }]);
      }
      // Inserting at Examine's index puts each new entry just below it (and below the ones
      // inserted before it), so they read Tag, Tag-All from the top.
      for (const [text, onClick] of entries) rt.insertMenuEntry(c, i, text, onClick);
    }
  }

  ll.registerPlugin('npcindicators', {
    configure(config) {
      cfg = config || {};
      names = parseNames(cfg.npcToHighlight);
    },
    frame,
    menuAfter,
    stop() {
      tags.clear();
    },
  });

  ll.__npcIndicators = { recolour, tags: () => tags };
})();
