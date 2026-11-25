'use strict';
// Skilling Notifier, game side. Works from what the server says, not from animations: the
// server moves varp 945 (skill_beat) on with every woodcutting or fishing op you run, the first
// click and each roll after it (engine Player.skillBeat; bits 0-1 the skill, 1 woodcutting,
// 2 fishing). When it hasn't moved for the time set, you've stopped, whatever stopped you: the
// tree fell, the spot moved, your inventory filled, you clicked away or got attacked. Then one
// alert: a ding and the screen flash, plus a desktop notification when the window isn't in
// front (as the Logout Notifier), and the window comes back up if it was minimised or behind others.

const SKILLS = { 1: 'woodcutting', 2: 'fishing' };
const NEW_SPELL = 15000; // longer without a beat than this starts a new spell

module.exports = function skillingNotifier(ctx) {
  let off = null;
  let timer = null;
  let name = null;
  let lastBeat = null; // the varp's value last seen
  let skill = null; // 'woodcutting' | 'fishing' while you're at it
  let beats = 0;
  let beatAt = 0;

  const opt = (k) => ctx.config(k);

  function onPlayer(p) {
    name = p.name || name;
    const v = typeof p.skillBeat === 'number' ? p.skillBeat : 0;
    if (v === lastBeat) return;
    const first = lastBeat === null;
    lastBeat = v;
    const kind = SKILLS[v & 3];
    if (first || !v || !kind) return; // (what it was when the plugin started isn't news)
    const now = Date.now();
    if (kind !== skill || now - beatAt > NEW_SPELL) beats = 0;
    skill = kind;
    beats++;
    beatAt = now;
  }

  function tick() {
    if (!skill) return;
    const now = Date.now();
    const delay = Math.max(3, Math.min(60, opt('delay') | 0 || 5)) * 1000;
    if (now - beatAt < delay) return;
    const was = skill;
    const long = beats >= 2; // one op alone (no axe, can't reach) isn't skilling
    skill = null;
    beats = 0;
    if (long && opt(was) !== false) {
      ctx.notify('2006RS', `${name || 'You'} stopped ${was}!`, { sound: true, flash: true, always: true, raise: opt('raise') !== false });
    }
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data) onPlayer(data);
        else if (type === 'login-state') { skill = null; beats = 0; lastBeat = null; } // (the varp starts at 0 each login)
      });
      timer = setInterval(tick, 300);
    },
    stop() {
      if (off) off();
      clearInterval(timer);
      skill = null;
      beats = 0;
    },
  };
};

module.exports.SKILLS = SKILLS;
