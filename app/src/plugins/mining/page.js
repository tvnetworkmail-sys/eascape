// Mining, page side: RuneLite's MiningPlugin for the 2004 game, on the shared code in the
// Woodcutting page part (ll.__skilling): "Mining" / "NOT mining", "Total mined:" and
// "Mined/hr:" from the "You manage to mine some ..." messages, and the respawn pie on each
// rock you (or anyone near you) mine out, with Lost City's times (mine.dbrow).
(() => {
  const ll = window.__lostlite;
  if (!ll || !ll.__skilling) return;
  ll.__mining = ll.__skilling({
    id: 'mining', title: 'Mining', statsKey: 'showMiningStats', respawnKey: null,
    message: /^You manage to mine some .+\.$/,
    countLabel: 'Total mined:', rateLabel: 'Mined/hr:',
    // human_mining_* (Lost City pack/seq.pack)
    anims: [624, 625, 626, 627, 628, 629],
  });
})();
