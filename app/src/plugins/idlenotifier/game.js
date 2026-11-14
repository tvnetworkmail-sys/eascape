'use strict';
// Logout Notifier, game side. Works from the game's own idle timer (the 2004 game asks the
// server to log you out after 90 seconds without mouse or key input in the game; in combat
// the server waits until the fight is over). At the time set, one alert: a ding and the
// screen flash, plus a desktop notification when the window isn't in front.

const LOGOUT_AFTER = 90 * 1000;

module.exports = function logoutNotifier(ctx) {
  let off = null;
  let timer = null;
  let loggedIn = false;
  let name = null;
  let lastInput = Date.now();
  let warned = false;
  let gameIdle = null; // { ms, at } from the game's timer, when it reports one

  const opt = (k) => ctx.config(k);

  function onInput() {
    lastInput = Date.now();
    warned = false;
  }

  function tick() {
    if (!loggedIn) return;
    const now = Date.now();
    const warn = Math.max(1, Math.min(85, opt('logoutWarning') | 0 || 10)) * 1000;
    const idleFor = gameIdle ? gameIdle.ms + (now - gameIdle.at) : now - lastInput;
    if (!warned && idleFor >= LOGOUT_AFTER - warn && idleFor < LOGOUT_AFTER + 60000) {
      warned = true;
      const left = Math.max(1, Math.round((LOGOUT_AFTER - idleFor) / 1000));
      ctx.notify('2006RS', `${name || 'You'} will be logged out in ${left} second${left === 1 ? '' : 's'}!`, { sound: true, flash: true, always: true });
    }
  }

  const inputs = ['keydown', 'mousedown', 'mousemove', 'wheel'];

  return {
    start() {
      lastInput = Date.now();
      for (const t of inputs) window.addEventListener(t, onInput, true);
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data) {
          loggedIn = true; // player data only comes while logged in
          name = data.name || name;
        } else if (type === 'idle' && data && typeof data.ms === 'number') {
          if (data.ms < 2000) warned = false; // you touched the game again
          gameIdle = { ms: data.ms, at: Date.now() };
        } else if (type === 'login-state') {
          loggedIn = !!data;
          lastInput = Date.now();
          gameIdle = null;
          warned = false;
        }
      });
      timer = setInterval(tick, 300);
    },
    stop() {
      if (off) off();
      clearInterval(timer);
      for (const t of inputs) window.removeEventListener(t, onInput, true);
    },
  };
};

module.exports.LOGOUT_AFTER = LOGOUT_AFTER;
