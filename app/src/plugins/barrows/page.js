// Barrows Brothers, page side: hands the settings to the EASCape client, which draws the
// minimap letters, the brothers panel, the prayer drain timer and the puzzle answer itself.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;
  ll.barrows = { enabled: false };
  ll.registerPlugin('barrows', {
    configure(config) {
      ll.barrows = Object.assign({ enabled: true }, config || {});
    },
    stop() {
      ll.barrows = { enabled: false };
    },
  });
})();
