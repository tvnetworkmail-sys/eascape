// Time Tracking (farming), page side: every couple of seconds while you're logged in, the
// farming patches' varps as the client has them (the server sends them whenever a patch
// changes), and the item icons the panel asks for (the game's own sprites).
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;
  const VARPS = [504, 505, 506, 508, 515]; // see patches.json
  let on = false;
  let last = '';
  let lastAt = 0;
  let want = [];
  const sent = new Set();

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
    if (!on || !ll.loggedIn || !ll.client || !ll.fields || !ll.fields.varps) return;
    const now = Date.now();
    if (now - lastAt < 2000) return;
    lastAt = now;
    icons();
    const v = ll.client[ll.fields.varps];
    if (!v) return;
    const varps = {};
    for (const id of VARPS) varps[id] = v[id] | 0;
    const key = JSON.stringify(varps);
    if (key === last) return;
    last = key;
    window.postMessage({ __lostlite: true, type: 'farming-varps', data: { varps } }, '*');
  }

  ll.registerPlugin('farming', {
    configure(config) {
      on = true;
      want = (config && config.wantIcons) || [];
      for (const id of [...sent]) if (!want.includes(id)) sent.delete(id);
    },
    frame,
    stop() { on = false; last = ''; },
  });
})();
