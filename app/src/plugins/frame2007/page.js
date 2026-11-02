// 2006 interface, page side: the later tab icons (ll.icons2006), and tells the server to show the 2007 combat tabs (::appcombat07 on)
// after each login, and 2006's again when the plugin is switched off. The server only takes this
// from the app (its user agent says EASCapeApp/). The game frame stays 2006's.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  let on = false;
  let sentFor = null; // the login we last switched them on for
  let since = 0;

  function send(text) {
    return !!(ll.api && ll.api.command && ll.api.command(text));
  }

  function frame() {
    if (!on) return;
    if (!ll.loggedIn) {
      sentFor = null;
      since = 0;
      return;
    }
    if (sentFor) return;
    // give the game a moment after login before sending
    if (!since) since = Date.now();
    if (Date.now() - since < 1500) return;
    if (send('appcombat07 on')) sentFor = since;
  }

  ll.registerPlugin('frame2007', {
    configure() {
      on = true;
      ll.icons2006 = true; // the client draws the later tab icons (Client.ts drawSideIcon)
    },
    frame,
    stop() {
      ll.icons2006 = false;
      if (on && ll.loggedIn) send('appcombat07 off');
      on = false;
      sentFor = null;
      since = 0;
    },
  });
})();
