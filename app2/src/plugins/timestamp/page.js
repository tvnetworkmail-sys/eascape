// RuneLite's Chat Timestamps, cloned from net.runelite.client.plugins.timestamp (BSD 2-Clause,
// Copyright (c) 2018, Seth <Sethtroll3@gmail.com> and RuneLite contributors): TimestampPlugin.
// RuneLite stamps each line in the chat box's chatMessageBuilding script, before the name; the 2007
// chat box has no such script, so the stamp goes at the start of the message text (after the name
// on player chat). The 2007 chat box is always opaque: the opaque colour is used.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;

  /** java.text.SimpleDateFormat for the letters RuneLite documents (y M d H h m s a), quotes kept literal */
  function simpleDateFormat(pattern) {
    if (!/^[^']*('[^']*'[^']*)*$/.test(pattern)) throw new Error('bad pattern');
    return (date) => pattern.replace(/'([^']*)'|y+|M+|d+|H+|h+|m+|s+|a/g, (tok, lit) => {
      if (lit !== undefined) return lit;
      const n = tok.length;
      const pad = (v) => String(v).padStart(n, '0');
      switch (tok[0]) {
        case 'y': return n === 2 ? String(date.getFullYear()).slice(-2) : pad(date.getFullYear());
        case 'M': return pad(date.getMonth() + 1);
        case 'd': return pad(date.getDate());
        case 'H': return pad(date.getHours());
        case 'h': return pad(date.getHours() % 12 || 12);
        case 'm': return pad(date.getMinutes());
        case 's': return pad(date.getSeconds());
        case 'a': return date.getHours() < 12 ? 'AM' : 'PM';
        default: return tok;
      }
    });
  }

  class TimestampPlugin {
    constructor() { this.configGroup = 'timestamp'; this.config = rl.configProxy('timestamp', () => this.configItems); this.formatter = null; }
    startUp() { this.updateFormatter(); }
    shutDown() { this.formatter = null; }
    onConfigChanged() { this.updateFormatter(); }
    onChatMessage(e) {
      if (!this.formatter || e.msg.replace === false) return;
      let ts = this.formatter(new Date(e.getTimestamp() * 1000));
      const colour = this.config.opaqueTimestamp();
      if (colour) ts = `${ll.colourTag(colour.getRGB() & 0xffffff)}${ts}@end@`;
      e.setMessage(`${ts} ${e.msg.replace === undefined || e.msg.replace === null ? e.getMessage() : e.msg.replace}`);
    }
    updateFormatter() {
      try { this.formatter = simpleDateFormat(this.config.timestampFormat() || '[HH:mm]'); this.formatter(new Date()); } catch { this.formatter = simpleDateFormat('[HH:mm]'); }
    }
  }
  rl.registerPlugin('timestamp', new TimestampPlugin());
})();
