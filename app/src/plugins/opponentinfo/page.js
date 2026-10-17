// Opponent Information, page side: RuneLite's OpponentInfoPlugin / OpponentInfoOverlay
// (BSD 2-Clause, Copyright (c) 2016-2018, Adam <Adam@sigterm.info> and RuneLite
// contributors). The opponent is whoever you're interacting with, kept for 5 seconds after
// (RuneLite's WAIT). The 2004 game sends the real hitpoints with each hit, so the bar shows
// them exactly ("16/30") once the opponent has been hit. Drawn as a panel by Info Boxes.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const WAIT = 5000;
  const HP_GREEN = 'rgba(0,146,54,0.902)';
  const HP_RED = 'rgba(102,15,16,0.902)';

  let cfg = {};
  let last = null; // { type, index, name, health, total, time }

  const strip = (s) => String(s || '').replace(/@[a-z0-9~]{3}@/gi, '');

  function find(c, type, index) {
    try {
      const list = type === 'npc' ? ll.readNpcs(c) : ll.readPlayers(c);
      return list.find((e) => e.index === index) || null;
    } catch {
      return null;
    }
  }

  function percent(v) {
    return `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
  }

  function panels(now) {
    const c = ll.client;
    const me = c && ll.fields.localPlayer ? c[ll.fields.localPlayer] : null;
    if (!me) {
      last = null;
      return [];
    }
    const face = me[ll.fields.faceEntity];
    const target = typeof face !== 'number' || face < 0 ? null : face >= 32768 ? { type: 'player', index: face - 32768 } : { type: 'npc', index: face };
    if (target) {
      const e = find(c, target.type, target.index);
      if (e && e.name) {
        if (!last || last.type !== target.type || last.index !== target.index) last = { type: target.type, index: target.index, health: 0, total: 0 };
        last.name = strip(e.name);
        if (e.totalHealth > 0) {
          last.health = e.health;
          last.total = e.totalHealth;
        }
        last.time = now;
      }
    } else if (last) {
      // keep it while it's still fighting, then for RuneLite's 5 seconds
      const e = find(c, last.type, last.index);
      if (e && e.inCombat) {
        last.time = now;
        if (e.totalHealth > 0) {
          last.health = e.health;
          last.total = e.totalHealth;
        }
      }
      if (!e || now - last.time > WAIT) last = null;
    }
    // Like RuneLite: nothing until there's a health bar to show
    if (!last || !last.total || cfg.showOpponentHealthOverlay === false) return [];
    const style = cfg.hitpointsDisplayStyle || 'hitpoints';
    const frac = last.health / last.total;
    const text = style === 'percentage' ? percent(frac) : style === 'both' ? `${last.health}/${last.total} (${percent(frac)})` : `${last.health}/${last.total}`;
    return [{ name: 'Opponent info', size: cfg.panelSize, rows: [{ type: 'title', text: last.name }, { type: 'bar', fraction: frac, text, fg: HP_GREEN, bg: HP_RED }] }];
  }

  ll.__opponent = { panels, last: () => last };
  if (ll.addOverlayPanel) ll.addOverlayPanel('opponentinfo', panels);

  ll.registerPlugin('opponentinfo', {
    configure(config) {
      cfg = config || {};
    },
    stop() {
      last = null;
    },
  });
})();
