// RuneLite's Stretched Mode plugin, cloned from net.runelite.client.plugins.stretchedmode (BSD 2-Clause,
// Copyright (c) 2018, Lotto <https://github.com/devLotto> and RuneLite contributors): StretchedModePlugin.
// TranslateMouseListener / TranslateMouseWheelListener aren't needed: the 2007 client already maps the mouse
// through the canvas's on-screen size on each axis. The stretching itself (RuneLite's injected client and
// Hooks.draw) is the client's DisplayScale.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client } = rl;

  class StretchedModePlugin {
    constructor() {
      this.configGroup = 'stretchedmode';
      this.config = rl.configProxy('stretchedmode', () => this.configItems);
    }

    startUp() {
      client.setStretchedEnabled(true);
      this.updateConfig();
    }

    shutDown() {
      client.setStretchedEnabled(false);
      client.setStretchedIncreasedResolution(true); // 2007RS: back to the client's default
      client.invalidateStretching(true);
    }

    // (no ResizeableChanged: the 2007 client has fixed mode only)

    onConfigChanged(event) {
      if (event.getGroup() !== 'stretchedmode') return;
      this.updateConfig();
    }

    updateConfig() {
      client.setStretchedIntegerScaling(this.config.integerScaling());
      client.setStretchedKeepAspectRatio(this.config.keepAspectRatio());
      client.setStretchedFast(this.config.increasedPerformance());
      client.setScalingFactor(this.config.scalingFactor());
      client.setStretchedIncreasedResolution(this.config.increasedResolution()); // 2007RS

      client.invalidateStretching(true);
    }
  }

  rl.registerPlugin('stretchedmode', new StretchedModePlugin());
})();
