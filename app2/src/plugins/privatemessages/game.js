'use strict';
// Game-side half of Private Messages: the reply key. The in-page runtime finds the last
// sender in the chat history and opens the game's private message prompt.

module.exports = function privateMessages(ctx) {
  let off = null;
  return {
    start() {
      // kept from the game: Tab would otherwise move keyboard focus off it
      off = ctx.hotkey('replyHotkey', { when: () => !!ctx.canvas(), pressed: () => ctx.sendToGame({ type: 'reply-last' }) });
    },
    stop() {
      if (off) off();
      off = null;
    },
  };
};
