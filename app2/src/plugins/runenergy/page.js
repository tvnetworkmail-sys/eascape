// RuneLite's Run Energy plugin, cloned from net.runelite.client.plugins.runenergy (BSD 2-Clause, Copyright (c) 2018,
// Sean Dewar and RuneLite contributors): RunEnergyPlugin, RunEnergyOverlay, RunEnergyConfig.
// Era-trim: no graceful (2015), stamina potions (2015) or Ring of endurance (2018), so no graceful recovery boost, the
// ring's charge tracking and message, or the destroy check. 2007's run energy is the 2007 rule our server runs
// (Player.updateEnergy): a running tick costs 67 + 67 x weight / 64 units (weight 0..64 kg), a resting tick gives
// agility / 6 + 8 (OSRS's 2023 rework changed both). 2007 has no run orb widget: the tooltip shows over our Status Orbs'
// run orb (rl.statusOrbs), and "replace orb text" writes into the energy text the 2007 client shows, the Options tab's
// run button "%1%" (261:27), display-only, put back on shut down.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Overlay, OverlayPosition, OverlayLayer, Tooltip } = rl;
  const GROUP_NAME = 'runenergy';
  const RUNENERGY_TEXT = (261 << 16) | 27;
  const GAME_TICK_LENGTH = 600;
  const pad2 = (n) => String(n).padStart(2, '0');

  class RunEnergyOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render() {
      if (!rl.statusOrbs.shown('run')) return null;
      const bounds = rl.statusOrbs.bounds('run');
      if (bounds.getX() <= 0) return null;
      const mousePosition = client.getMouseCanvasPosition();
      if ((mousePosition && bounds.contains(mousePosition.getX(), mousePosition.getY())) || rl.statusOrbs.hovered('run')) {
        let sb = `Weight: ${client.getWeight()} kg</br>`;
        if (this.plugin.energyConfig.replaceOrbText()) sb += `Run Energy: ${Math.trunc(client.getEnergy() / 100)}%`;
        else sb += `Run Time Remaining: ${this.plugin.getEstimatedRunTimeRemaining(false)}`;
        const secondsUntil100 = this.plugin.getEstimatedRecoverTimeRemaining();
        if (secondsUntil100 > 0) {
          const minutes = Math.floor(secondsUntil100 / 60.0);
          const seconds = Math.floor(secondsUntil100 - minutes * 60.0);
          sb += `</br>100% Energy In: ${minutes}:${pad2(seconds)}`;
        }
        rl.tooltipManager.add(new Tooltip(sb));
      }
      return null;
    }
  }

  class RunEnergyPlugin {
    constructor() { this.configGroup = GROUP_NAME; this.localPlayerRunningToDestination = false; this.prevLocalPlayerLocation = null; this.originalText = null; }
    startUp() {
      this.energyConfig = rl.configProxy(GROUP_NAME, () => this.configItems);
      this.energyOverlay = new RunEnergyOverlay(this);
      rl.overlayManager.add(this.energyOverlay);
    }
    shutDown() {
      rl.overlayManager.remove(this.energyOverlay);
      this.localPlayerRunningToDestination = false;
      this.prevLocalPlayerLocation = null;
      this.resetRunOrbText();
    }
    onGameTick() {
      const local = client.getLocalPlayer();
      this.localPlayerRunningToDestination = this.prevLocalPlayerLocation != null && client.getLocalDestinationLocation() != null
        && !!local && this.prevLocalPlayerLocation.distanceTo(local.getWorldLocation()) > 1;
      if (local != null) this.prevLocalPlayerLocation = local.getWorldLocation();
      // (ScriptPostFired ORBS_UPDATE_RUNENERGY: 2007 has no orb script; the text is rewritten each tick)
      if (this.energyConfig.replaceOrbText()) this.setRunOrbText(this.getEstimatedRunTimeRemaining(true));
    }
    onConfigChanged(event) {
      if (event.getGroup() === GROUP_NAME && !this.energyConfig.replaceOrbText()) this.resetRunOrbText();
    }
    setRunOrbText(text) {
      const runOrbText = client.getWidget(RUNENERGY_TEXT);
      if (runOrbText == null) return;
      if (this.originalText == null) this.originalText = (ll.api && ll.api.com && (ll.api.com(RUNENERGY_TEXT) || {}).text) || '%1%';
      runOrbText.setText(text);
    }
    resetRunOrbText() {
      // (2007: the component's own "%1%", which the client fills with the energy)
      if (this.originalText == null) return;
      const w = client.getWidget(RUNENERGY_TEXT);
      if (w != null) w.setText(this.originalText);
      this.originalText = null;
    }
    getEstimatedRunTimeRemaining(inSeconds) {
      const effectiveWeight = Math.min(Math.max(client.getWeight(), 0), 64);
      const energyUnitsLost = Math.trunc(67 + (67 * effectiveWeight) / 64);
      const ticksLeft = Math.ceil(client.getEnergy() / energyUnitsLost);
      const secondsLeft = (ticksLeft * GAME_TICK_LENGTH) / 1000.0;
      if (inSeconds) return `${Math.floor(secondsLeft)}s`;
      const minutes = Math.floor(secondsLeft / 60.0);
      const seconds = Math.floor(secondsLeft - minutes * 60.0);
      return `${minutes}:${pad2(seconds)}`;
    }
    getEstimatedRecoverTimeRemaining() {
      if (this.localPlayerRunningToDestination) return -1;
      const recoverRate = (Math.trunc(client.getRealSkillLevel(Skill.AGILITY) / 6) + 8) / (GAME_TICK_LENGTH / 1000.0);
      const secondsLeft = (10000 - client.getEnergy()) / recoverRate;
      return Math.trunc(secondsLeft);
    }
  }

  const plugin = new RunEnergyPlugin();
  ll.__runenergy = { plugin, RunEnergyOverlay };
  rl.registerPlugin('runenergy', plugin);
})();
