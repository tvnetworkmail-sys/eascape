'use strict';
// The hotkey system (Phase 3.6): RuneLite's KeyManager and HotkeyListener for the game
// window. Plugins register a hotkey by its setting ("hotkey" settings, set with the
// "Press a key..." button), and get pressed() when it goes down and released() when it
// comes up (when() can limit it to moments it applies, like the bank being open),
// once per press (held keys don't repeat). A hotkey can be a key with modifiers
// ("Ctrl+M") or a modifier on its own ("Alt", RuneLite's ModifierlessKeybind), which fires
// only when nothing else is held with it. A matched key is kept from the game (so Tab
// doesn't also move focus, and a letter isn't typed into the chat) unless the plugin says
// otherwise.
const MODS = { Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta' };

/** "Ctrl+Shift+M" -> { key: 'm', ctrl, shift, alt, meta, modifier }; '' / null -> null. */
function parse(spec) {
  if (!spec || typeof spec !== 'string') return null;
  const parts = spec.split('+');
  const key = parts.pop();
  if (!key) return null;
  const mods = new Set(parts);
  const modifier = Object.values(MODS).includes(key);
  return {
    key: key.toLowerCase(),
    ctrl: mods.has('Ctrl') || key === 'Ctrl',
    shift: mods.has('Shift') || key === 'Shift',
    alt: mods.has('Alt') || key === 'Alt',
    meta: mods.has('Meta') || key === 'Meta',
    modifier,
  };
}

const keyName = (e) => (MODS[e.key] || e.key).toLowerCase();

/** Does this key event press the hotkey? */
function matches(e, spec) {
  const h = typeof spec === 'string' ? parse(spec) : spec;
  if (!h) return false;
  return keyName(e) === h.key && e.ctrlKey === h.ctrl && e.shiftKey === h.shift && e.altKey === h.alt && e.metaKey === h.meta;
}

function createManager(win) {
  const entries = new Set(); // { spec: () => string, pressed, released, consume, held }

  function down(e) {
    for (const en of [...entries]) {
      if (en.held) {
        // a held hotkey's own key repeating: still ours
        if (keyName(e) === en.held.key && en.consume) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        continue;
      }
      const h = parse(en.spec());
      if (!h || !matches(e, h) || (en.when && !en.when())) continue;
      if (e.repeat) continue;
      en.held = h;
      if (en.consume) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      try {
        if (en.pressed) en.pressed(e);
      } catch {
        /* a plugin's handler never breaks the keyboard */
      }
    }
  }

  function up(e) {
    for (const en of [...entries]) {
      if (!en.held || keyName(e) !== en.held.key) continue;
      en.held = null;
      try {
        if (en.released) en.released(e);
      } catch {
        /* ignore */
      }
    }
  }

  function blur() {
    for (const en of entries) {
      if (!en.held) continue;
      en.held = null;
      try {
        if (en.released) en.released(null);
      } catch {
        /* ignore */
      }
    }
  }

  let listening = false;
  function listen() {
    if (listening || !win) return;
    listening = true;
    win.addEventListener('keydown', down, true);
    win.addEventListener('keyup', up, true);
    win.addEventListener('blur', blur);
  }

  return {
    /** Register a hotkey: spec() returns its current setting. Returns a function that removes it. */
    add(spec, { pressed, released, consume = true, when = null } = {}) {
      const en = { spec: typeof spec === 'function' ? spec : () => spec, pressed, released, consume, when, held: null };
      entries.add(en);
      listen();
      return () => entries.delete(en);
    },
    down,
    up,
    blur,
    size: () => entries.size,
  };
}

module.exports = { parse, matches, createManager };
