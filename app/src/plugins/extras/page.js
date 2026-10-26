// EASCape Extras, page side: tells the server to switch the app's extras on (::appextras on)
// after each login, and off when the plugin is switched off. The server only takes this from
// the app (its user agent says EASCapeApp/), so the web game can't switch them on.
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
    if (send('appextras on')) sentFor = since;
  }

  ll.registerPlugin('extras', {
    configure() {
      on = true;
    },
    frame,
    stop() {
      if (on && ll.loggedIn) send('appextras off');
      on = false;
      sentFor = null;
      since = 0;
    },
  });
})();
