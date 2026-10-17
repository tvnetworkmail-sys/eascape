'use strict';
// Idle Notifier, game side (RuneLite's IdleNotifierPlugin, for the 2004 game). Works from the
// player data the runtime reports: the action animation, who you are fighting, hitpoints,
// prayer, run and special attack energy; and the game's own idle timer for the idle logout
// (the 2004 game asks the server to log you out after 90 seconds without mouse or key input
// in the game; in combat the server waits until the fight is over).

const LOGOUT_AFTER = 90 * 1000;
const MIN_ACTIVE = 1500; // a skilling animation must run this long to count (not eating once)

module.exports = function idleNotifier(ctx) {
  let off = null;
  let timer = null;
  let loggedIn = false;
  let name = null;
  let lastInput = Date.now();
  let logoutWarned = false;
  let gameIdle = null; // { ms, at } from the game's timer, when it reports one
  // animation
  let anim = -1;
  let activeSince = 0;
  let animEnded = 0;
  let animPending = false;
  // combat
  let fighting = false;
  let fightEnded = 0;
  let fightPending = false;
  let hadHit = false;
  // thresholds: notify once on the way down, again only after going back up
  const below = { hitpoints: false, prayer: false, energy: false, spec: true };

  const opt = (k) => ctx.config(k);
  const who = () => name || 'You';
  const send = (text) => ctx.notify('EASCape', text);

  function onInput() {
    lastInput = Date.now();
    logoutWarned = false;
  }

  function onPlayer(p) {
    if (!p) return;
    const now = Date.now();
    loggedIn = true; // player data only comes while logged in
    name = p.name || name;
    // Animation: a long enough action that then stops.
    const a = typeof p.animation === 'number' ? p.animation : -1;
    if (a !== anim) {
      if (a !== -1 && anim === -1) {
        // a new action, or the same one carrying on after a short gap between swings
        if (!activeSince || now - animEnded > 1200) activeSince = now;
        animPending = false;
      }
      if (a === -1 && anim !== -1) {
        animEnded = now;
        animPending = now - activeSince >= MIN_ACTIVE;
      }
      anim = a;
    }
    // Interaction: fighting an NPC, then not. Facing an NPC alone could be talking to it
    // (a banker): it only counts once there's been a hit.
    const f = !!(p.interacting && p.interacting.type === 'npc') || !!p.inCombat;
    if (f && p.inCombat) hadHit = true;
    if (f !== fighting) {
      if (!f) {
        fightEnded = now;
        fightPending = hadHit;
        hadHit = false;
      } else {
        fightPending = false;
        if (p.inCombat) animPending = false; // a combat swing isn't skilling
      }
      fighting = f;
    }
    // Thresholds
    check('hitpoints', p.hitpoints, opt('hitpoints'), (v, t) => v <= t && t > 0, `${who()} has low hitpoints!`);
    check('prayer', p.prayer, opt('prayer'), (v, t) => v <= t && t > 0, `${who()} has low prayer!`);
    check('energy', p.runEnergy, opt('lowEnergy'), (v, t) => v <= t && t < 100, `${who()} has low run energy!`);
    // special attack: notify when it comes back up to the threshold
    const spec = p.specialAttack;
    const t = opt('specEnergy');
    if (typeof spec === 'number' && t > 0) {
      if (spec >= t && below.spec) {
        below.spec = false;
        send(`${who()} has restored special attack energy!`);
      } else if (spec < t) below.spec = true;
    }
  }

  function check(key, value, threshold, isLow, text) {
    if (typeof value !== 'number' || !threshold && threshold !== 0) return;
    if (isLow(value, threshold)) {
      if (!below[key]) {
        below[key] = true;
        send(text);
      }
    } else {
      below[key] = false;
    }
  }

  function tick() {
    if (!loggedIn) return;
    const now = Date.now();
    const delay = Math.max(0, opt('timeout') | 0);
    if (animPending && anim === -1 && now - animEnded >= delay) {
      animPending = false;
      activeSince = 0;
      if (opt('animationIdle')) send(`${who()} is now idle!`);
    }
    if (fightPending && !fighting && now - fightEnded >= delay) {
      fightPending = false;
      if (opt('interactionIdle')) send(`${who()} is now out of combat!`);
    }
    const warn = Math.max(1, Math.min(85, opt('logoutWarning') | 0 || 20)) * 1000;
    const idleFor = gameIdle ? gameIdle.ms + (now - gameIdle.at) : now - lastInput;
    if (opt('logoutIdle') && !logoutWarned && idleFor >= LOGOUT_AFTER - warn && idleFor < LOGOUT_AFTER + 60000) {
      logoutWarned = true;
      send(`${who()} is about to log out from idling too long!`);
    }
  }

  const inputs = ['keydown', 'mousedown', 'mousemove', 'wheel'];

  return {
    start() {
      lastInput = Date.now();
      for (const t of inputs) window.addEventListener(t, onInput, true);
      off = ctx.onRuntime((type, data) => {
        if (type === 'player') onPlayer(data);
        else if (type === 'idle' && data && typeof data.ms === 'number') {
          if (data.ms < 2000) logoutWarned = false; // you touched the game again
          gameIdle = { ms: data.ms, at: Date.now() };
        }
        else if (type === 'login-state') {
          loggedIn = !!data;
          lastInput = Date.now();
          gameIdle = null;
          logoutWarned = false;
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
