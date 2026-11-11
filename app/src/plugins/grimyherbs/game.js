'use strict';
// Grimy Herbs, game side: turns the client's grimy herb names on and off (webclient ObjType reads
// this attribute whenever it looks an item up, so the change shows at once).
module.exports = function grimyHerbs() {
  const set = (on) => {
    if (on) document.documentElement.setAttribute('data-eascape-grimy', 'on');
    else document.documentElement.removeAttribute('data-eascape-grimy');
  };
  return {
    start() { set(true); },
    gameReady() { set(true); },
    stop() { set(false); },
  };
};
