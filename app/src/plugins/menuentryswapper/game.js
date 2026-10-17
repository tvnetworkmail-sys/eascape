'use strict';
// Game-side half of the Menu Entry Swapper. Turns the settings into rules for the in-page
// runtime, which applies them every frame as the client builds its menu.
//
// Like RuneLite's menu swapper before it had sub-menus, holding Shift while right-clicking
// adds "Swap left click <option>" and "Swap shift click <option>" entries for each NPC,
// object and item straight into the game's menu, plus "Reset" once one is set. Choices are
// saved per target name (kind + name, e.g. npc "paladin").
// A choice always wins over the custom wildcard lists for that target, and Reset means
// "the game's own default" (no swaps at all for that target).

/** "pickpocket, man" lines -> [{ option, target }] */
function parseLines(text) {
  const rules = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('#')) continue;
    const comma = t.indexOf(',');
    const option = (comma < 0 ? t : t.slice(0, comma)).trim().toLowerCase();
    const target = (comma < 0 ? '*' : t.slice(comma + 1)).trim().toLowerCase() || '*';
    if (option) rules.push({ option, target });
  }
  return rules;
}

module.exports = function menuEntrySwapper(ctx) {
  let off = null;

  // ---- saved per-target swaps: { "left|npc|banker": "Bank", "shift|object|bank booth": "Use-quickly" }
  function saved() {
    try {
      const v = JSON.parse(ctx.state('entitySwaps', '{}'));
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  }

  function savedRules(which) {
    const out = [];
    for (const [key, option] of Object.entries(saved())) {
      const [w, kind, ...rest] = key.split('|');
      if (w === which) out.push({ option: String(option).toLowerCase(), target: rest.join('|'), kind });
    }
    return out;
  }

  function push() {
    // Your own per-target choices win, then the custom wildcard lines.
    const swaps = savedRules('left').concat(parseLines(ctx.config('customSwaps')));
    const shiftSwaps = savedRules('shift').concat(parseLines(ctx.config('customShiftSwaps')));
    ctx.sendToGame({
      type: 'menu-rules',
      swaps,
      shiftSwaps,
      hide: parseLines(ctx.config('hideOptions')),
      customize: { left: !!ctx.config('leftClickCustomization'), shift: !!ctx.config('shiftClickCustomization') },
      chosen: saved(),
    });
  }

  function keyOf(info) {
    return `${info.shift ? 'shift' : 'left'}|${info.kind}|${info.target}`;
  }

  function choose(info, option) {
    const map = saved();
    // Reset stores "<default>" so a wildcard line doesn't swap this target again.
    map[keyOf(info)] = option === null ? '<default>' : option;
    ctx.setState('entitySwaps', JSON.stringify(map));
    push();
    const which = info.shift ? 'shift' : 'left';
    ctx.log(`${which}-click for ${info.kind} '${info.name}' set to ${option === null ? 'the game default' : `'${option}'`}`);
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'menu-choose' && data) choose(data, data.option);
      });
      push();
    },
    stop() {
      if (off) off();
      ctx.sendToGame({ type: 'menu-rules', swaps: [], shiftSwaps: [], hide: [], customize: {} });
    },
    configChanged: push,
    gameReady: push,
  };
};

module.exports.parseLines = parseLines;
