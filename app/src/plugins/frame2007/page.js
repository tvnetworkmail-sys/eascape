// 2007 interface, page side: the EASCape client draws the 2007 frame while ll.frame2007 is set.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;
  ll.frame2007 = false;
  ll.registerPlugin('frame2007', {
    configure() {
      ll.frame2007 = true;
    },
    stop() {
      ll.frame2007 = false;
    },
  });
})();
