// Farming tracker, page side: every couple of seconds while you're logged in, the farming
// patches' varps as the client has them (the server sends them whenever a patch changes).
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;
  const VARPS = [504, 505, 506, 508, 515]; // see patches.json
  let on = false;
  let last = '';
  let lastAt = 0;

  function frame() {
    if (!on || !ll.loggedIn || !ll.client || !ll.fields || !ll.fields.varps) return;
    const now = Date.now();
    if (now - lastAt < 2000) return;
    lastAt = now;
    const v = ll.client[ll.fields.varps];
    if (!v) return;
    const varps = {};
    for (const id of VARPS) varps[id] = v[id] | 0;
    const key = JSON.stringify(varps);
    if (key === last && now % 60000 > 2000) return; // unchanged (but say so once a minute)
    last = key;
    window.postMessage({ __lostlite: true, type: 'farming-varps', data: { varps } }, '*');
  }

  ll.registerPlugin('farming', {
    configure() { on = true; },
    frame,
    stop() { on = false; last = ''; },
  });
})();
