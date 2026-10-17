'use strict';
// Chat Notifications, sidebar side: RuneLite's ChatNotificationsPlugin (BSD 2-Clause,
// Copyright (c) 2018, Hydrox6 <ikada@protonmail.ch> and RuneLite contributors) on the chat
// lines the runtime reads (2.7). Each match is a notification, so it follows
// LostLite > Notifications (desktop, chat box line, screen flash).

module.exports = function chatNotifications(ctx) {
  let off = null;
  let me = null; // your name

  function words() {
    return String(ctx.config('highlightWordsString') || '').split(',').map((w) => w.trim()).filter(Boolean);
  }

  function regexes() {
    const out = [];
    for (const line of String(ctx.config('highlightRegexString') || '').split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(new RegExp(t, 'i'));
      } catch {
        /* not a valid pattern: skipped, like RuneLite */
      }
    }
    return out;
  }

  const hasWord = (text, word) => new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i').test(text);

  function onChat(m) {
    if (!m || typeof m.text !== 'string' || m.own) return; // never our own notification lines
    const from = m.name || '';
    if (me && from && from.toLowerCase() === me.toLowerCase()) return; // your own lines
    const said = from ? `${from}: ${m.text}` : m.text;
    if (m.kind === 'trade' && ctx.config('notifyOnTrade')) return ctx.notify('EASCape', `${from} wishes to trade with you.`);
    if (m.kind === 'duel' && ctx.config('notifyOnDuel')) return ctx.notify('EASCape', `${from} wishes to duel with you.`);
    if (m.kind === 'private' && ctx.config('notifyOnPM')) return ctx.notify('EASCape', `From ${from}: ${m.text}`);
    if (m.kind === 'private-sent') return;
    if (me && ctx.config('notifyOnOwnName') && m.kind !== 'game' && hasWord(m.text, me)) return ctx.notify('EASCape', said);
    if (ctx.config('notifyOnHighlight')) {
      if (words().some((w) => hasWord(m.text, w)) || regexes().some((r) => r.test(m.text))) ctx.notify('EASCape', said);
    }
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'chat') onChat(data);
        else if (type === 'player' && data && data.name) me = data.name;
      });
    },
    stop() {
      if (off) off();
    },
  };
};
