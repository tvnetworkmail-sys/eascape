// Time Tracking (farming), page side: after each login it asks the server for your farming
// growth clock (::appfarming on; only the app may), then every couple of seconds reports the
// patch varps and the clock varps as the client has them (the server sends them whenever they
// change), and the item icons the panel asks for (the game's own sprites).
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;
  let on = false;
  let varpIds = [];
  let last = '';
  let lastAt = 0;
  let want = [];
  let askedFor = null;
  let since = 0;
  const sent = new Set();

  const command = (text) => !!(ll.api && ll.api.command && ll.api.command(text));

  function icons() {
    for (const id of want) {
      if (sent.has(id)) continue;
      const url = ll.itemIconUrl ? ll.itemIconUrl(id, 1) : null;
      if (!url) continue;
      sent.add(id);
      window.postMessage({ __lostlite: true, type: 'farming-icon', data: { id, url } }, '*');
    }
  }

  function frame() {
    if (!on) return;
    if (!ll.loggedIn) {
      askedFor = null;
      since = 0;
      return;
    }
    // a moment after login, ask for the growth clock (as the extras plugin does)
    if (!askedFor) {
      if (!since) since = Date.now();
      if (Date.now() - since >= 1500 && command('appfarming on')) askedFor = since;
    }
    if (!ll.client || !ll.fields || !ll.fields.varps) return;
    const now = Date.now();
    if (now - lastAt < 2000) return;
    lastAt = now;
    icons();
    const v = ll.client[ll.fields.varps];
    if (!v) return;
    const varps = {};
    for (const id of varpIds) varps[id] = v[id] | 0;
    const key = JSON.stringify(varps);
    if (key === last) return;
    last = key;
    window.postMessage({ __lostlite: true, type: 'farming-varps', data: { varps } }, '*');
  }

  ll.registerPlugin('farming', {
    configure(config) {
      on = true;
      want = (config && config.wantIcons) || [];
      varpIds = (config && config.varps) || [];
      last = '';
      for (const id of [...sent]) if (!want.includes(id)) sent.delete(id);
    },
    frame,
    stop() {
      if (on && ll.loggedIn) command('appfarming off');
      on = false;
      last = '';
      askedFor = null;
      since = 0;
    },
  });
})();
