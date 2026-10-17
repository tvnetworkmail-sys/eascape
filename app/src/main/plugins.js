'use strict';
// PluginManager (main process half). Knows every plugin, its defaults and whether it is
// enabled. Enabled state lives in config group "lostlite" as "<id>Plugin", the same key
// shape RuneLite uses ("runelite.<name>plugin").
const descriptors = require('../plugins');

// EASCape: plugins come from LostLite, made for the 2004 game. Each stays off until it has
// been checked against the 2006 game (plan step 4.2) and its id is added here.
const CHECKED_2006 = new Set([]);

function notChecked(d) {
  return !d.alwaysOn && !CHECKED_2006.has(d.id);
}

class PluginManager {
  constructor(config) {
    this.config = config;
  }

  list() {
    return descriptors;
  }

  get(id) {
    return descriptors.find((d) => d.id === id);
  }

  isEnabled(id) {
    const d = this.get(id);
    if (!d) return false;
    if (d.alwaysOn) return true;
    if (notChecked(d)) return false;
    return this.config.get('lostlite', `${id}Plugin`, d.enabledByDefault !== false);
  }

  setEnabled(id, on) {
    const d = this.get(id);
    if (!d || d.alwaysOn || notChecked(d)) return;
    this.config.set('lostlite', `${id}Plugin`, !!on);
  }

  /** Value of a plugin setting, falling back to its declared default. */
  value(id, key) {
    const d = this.get(id);
    const item = d && d.config.items.find((i) => i.key === key);
    return this.config.get(d.config.group, key, item ? item.default : undefined);
  }

  /** Everything the sidebar and game need: descriptors (without code paths) and state. */
  snapshot() {
    return descriptors.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      tags: d.tags || [],
      alwaysOn: !!d.alwaysOn,
      notChecked: notChecked(d),
      enabledByDefault: d.enabledByDefault !== false,
      hasGame: !!d.game,
      config: d.config,
      infoboxes: d.infoboxes || null,
      enabled: this.isEnabled(d.id),
    }));
  }
}

module.exports = { PluginManager };
