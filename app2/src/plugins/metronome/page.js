// RuneLite's Metronome plugin, cloned from net.runelite.client.plugins.metronome (BSD 2-Clause, Copyright (c) 2018,
// SomeoneWithAnInternetConnection and RuneLite contributors): MetronomePlugin.
// 2007: OSRS's GE_UP_AMOUNT / GE_DOWN_AMOUNT sounds (the GE is Nov 2007) aren't in the cache, so the tick is the
// 2007 quiz_select sound (1263) and the tock safeclick (948). client.playSoundEffect plays them locally (corea.js);
// the 2007 client mixes sounds at the player's sound effect volume, so the volumes here only turn each sound on or off
// (0), and there is no Preferences volume to swap.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client } = rl;
  const SoundEffectID = { GE_UP_AMOUNT: 1263, GE_DOWN_AMOUNT: 948 };

  class MetronomePlugin {
    constructor() {
      this.configGroup = 'metronome';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.tickCounter = 0;
      this.shouldTock = false;
    }
    startUp() {}
    shutDown() { this.tickCounter = 0; this.shouldTock = false; }
    onGameTick() {
      if (this.config.tickCount() === 0) return;
      if (++this.tickCounter % this.config.tickCount() === 0) {
        if (this.shouldTock && this.config.tockVolume() > 0) client.playSoundEffect(SoundEffectID.GE_DOWN_AMOUNT, this.config.tockVolume());
        else if (this.config.tickVolume() > 0) client.playSoundEffect(SoundEffectID.GE_UP_AMOUNT, this.config.tickVolume());
        this.shouldTock = !this.shouldTock;
      }
    }
  }

  const plugin = new MetronomePlugin();
  ll.__metronome = { plugin, SoundEffectID };
  rl.registerPlugin('metronome', plugin);
})();
