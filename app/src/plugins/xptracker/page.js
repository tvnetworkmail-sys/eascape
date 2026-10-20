// XP Tracker, page side: RuneLite's XpInfoBoxOverlay (BSD 2-Clause, Copyright (c) 2017,
// Adam <Adam@sigterm.info> and RuneLite contributors). A panel on the game view for each
// skill you add to the canvas (right-click its box in the XP Tracker): the two lines chosen
// under Overlay, and the progress bar to the next level in the skill's colour. Drawn, placed
// and moved (hold Alt and drag) by the Info Boxes plugin, like RuneLite's overlays.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  // RuneLite's SkillColor
  const COLOURS = {
    attack: [155, 32, 7], defence: [98, 119, 190], strength: [4, 149, 90], hitpoints: [131, 126, 126],
    ranged: [109, 144, 23], prayer: [159, 147, 35], magic: [50, 80, 193], cooking: [112, 35, 134],
    woodcutting: [52, 140, 37], fletching: [3, 141, 125], fishing: [106, 132, 164], firemaking: [189, 120, 25],
    crafting: [151, 110, 77], smithing: [108, 107, 82], mining: [93, 143, 167], herblore: [7, 133, 9],
    agility: [58, 60, 137], thieving: [108, 52, 87], slayer: [100, 100, 100], farming: [101, 152, 63],
    runecraft: [170, 141, 26],
  };
  const KEYS = { TIME_TO_LEVEL: 'TTL', XP_GAINED: 'XP Gained', XP_HOUR: 'XP/hr', XP_LEFT: 'XP Left', ACTIONS_LEFT: 'Actions', ACTIONS_HOUR: 'Actions/hr', ACTIONS_DONE: 'Actions Done' };

  let cfg = {};

  // RuneLite's QuantityFormatter.quantityToRSDecimalStack(n, true): as it is up to 4 digits,
  // then K / M / B with one decimal (three from a million), rounded down
  function stack(n) {
    if (!Number.isFinite(n)) return 'N/A';
    n = Math.trunc(n);
    if (String(n).length <= 4) return String(n);
    const power = Math.floor(Math.log10(Math.abs(n)));
    const places = power >= 6 ? 3 : 1;
    const f = 10 ** places;
    const v = Math.floor((n / 10 ** (Math.floor(power / 3) * 3)) * f) / f;
    return v.toLocaleString('en-GB', { maximumFractionDigits: places }) + ['', 'K', 'M', 'B'][Math.floor(power / 3)];
  }

  function value(label, s) {
    switch (label) {
      case 'TIME_TO_LEVEL': return s.ttlShort;
      case 'XP_HOUR': return stack(s.xpHour);
      case 'XP_LEFT': return stack(s.xpLeft);
      case 'ACTIONS_LEFT': return stack(s.actionsLeft);
      case 'ACTIONS_HOUR': return stack(s.actionsHour);
      case 'ACTIONS_DONE': return stack(s.actions);
      default: return stack(s.xpGained);
    }
  }

  function panels() {
    const out = [];
    for (const s of cfg.boxes || []) {
      const [r, g, b] = COLOURS[s.skill] || [80, 80, 80];
      const top = cfg.onScreenDisplayMode || 'XP_GAINED';
      const bottom = cfg.onScreenDisplayModeBottom || 'XP_HOUR';
      const name = s.skill[0].toUpperCase() + s.skill.slice(1);
      out.push({
        name: `XP ${name}`,
        rows: [
          { type: 'title', text: name },
          { type: 'line', left: `${KEYS[top]}:`, right: value(top, s) },
          { type: 'line', left: `${KEYS[bottom]}:`, right: value(bottom, s) },
          { type: 'bar', fraction: Math.max(0, Math.min(100, s.progress)) / 100, text: `${(Math.floor(s.progress * 100) / 100).toFixed(2)}%`, fg: `rgba(${r},${g},${b},0.902)`, bg: 'rgba(61,56,49,0.902)' },
        ],
      });
    }
    return out;
  }

  if (ll.addOverlayPanel) ll.addOverlayPanel('xptracker', panels);

  ll.registerPlugin('xptracker', {
    configure(c) {
      cfg = c || {};
    },
    stop() {
      cfg = {};
    },
  });
})();
