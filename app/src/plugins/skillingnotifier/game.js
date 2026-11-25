'use strict';
// Skilling Notifier, game side. Works from your player's animation, as the runtime reports it:
// the axe swing while woodcutting and the net, rod, harpoon, cage or pot while fishing. The
// runtime only reports the player when something changes, and the game plays the animation
// again every few ticks with short pauses between, so you have stopped once it has been off
// for the time set. Then one alert: a ding and the screen flash, plus a
// desktop notification when the window isn't in front (as the Logout Notifier).

// seq ids from content/pack/seq.pack
const WOODCUTTING = [867, 869, 871, 873, 875, 877, 879, 2846]; // rune .. bronze axe, dragon axe
const FISHING = [618, 619, 620, 621, 622, 623, 1193]; // harpoon, lobster cage, big net, small net, rod casting, rod, octopus pot
const MIN_ACTIVE = 2000; // a swing or a cast or two isn't enough to count as skilling
const NEW_SPELL = 15000; // longer without the animation than this starts a new spell

module.exports = function skillingNotifier(ctx) {
  let off = null;
  let timer = null;
  let name = null;
  let skill = null; // 'woodcutting' | 'fishing' while you're at it
  let on = false; // the skilling animation is playing now
  let since = 0;
  let offAt = 0;

  const opt = (k) => ctx.config(k);

  function onPlayer(p) {
    name = p.name || name;
    const a = typeof p.animation === 'number' ? p.animation : -1;
    const kind = WOODCUTTING.includes(a) ? 'woodcutting' : FISHING.includes(a) ? 'fishing' : null;
    const now = Date.now();
    if (kind) {
      if (kind !== skill || (!on && now - offAt > NEW_SPELL)) since = now;
      skill = kind;
      on = true;
    } else if (on) {
      on = false;
      offAt = now;
    }
  }

  function tick() {
    if (!skill || on) return;
    const now = Date.now();
    const delay = Math.max(2, Math.min(60, opt('delay') | 0 || 5)) * 1000;
    if (now - offAt < delay) return;
    const was = skill;
    const long = offAt - since >= MIN_ACTIVE;
    skill = null;
    if (long && opt(was) !== false) {
      ctx.notify('2006RS', `${name || 'You'} stopped ${was}!`, { sound: true, flash: true, always: true });
    }
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data) onPlayer(data);
        else if (type === 'login-state' && !data) { skill = null; on = false; } // logged out: nothing to say
      });
      timer = setInterval(tick, 300);
    },
    stop() {
      if (off) off();
      clearInterval(timer);
      skill = null;
      on = false;
    },
  };
};

module.exports.WOODCUTTING = WOODCUTTING;
module.exports.FISHING = FISHING;
