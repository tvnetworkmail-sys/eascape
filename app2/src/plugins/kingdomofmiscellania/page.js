// RuneLite's Kingdom of Miscellania plugin, cloned from net.runelite.client.plugins.kingdomofmiscellania (BSD 2-Clause,
// Copyright (c) 2018, Infinitay <https://github.com/Infinitay> and RuneLite contributors): KingdomPlugin, KingdomCounter.
// 2007 data: varbits MISC_APPROVAL 72 and MISC_COFFERS 74 and varp MISC_QUEST 359 have the same ids in the 2007 cache
// (misc_approval: varp 361 bits 18-24; misc_coffers: varp 362 bits 0-26). ItemID.POH_TREASURE_TEAK is the 2007 cache's
// teak_chest_8150 (9432). Royal Trouble is not on our server, so the base withdrawal and approval decay apply.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Counter, GameState, QuantityFormatter } = rl;

  const GROUP = 'kingdomofmiscellania';
  const KINGDOM_REGION = new Set([10044, 10300]);
  const CONFIG_LAST_CHANGED_KEY = 'lastChanged';
  const CONFIG_COFFER_KEY = 'coffer';
  const CONFIG_APPROVAL_KEY = 'approval';
  const MAX_WITHDRAWAL_BASE = 50000;
  const MAX_WITHDRAWAL_ROYAL_TROUBLE = 75000;
  const APPROVAL_DECREMENT_BASE = 0.025;
  const APPROVAL_DECREMENT_ROYAL_TROUBLE = 0.010;
  const MAX_APPROVAL = 127;
  const MISC_APPROVAL = 72;
  const MISC_COFFERS = 74;
  const MISC_QUEST = 359;
  const POH_TREASURE_TEAK = 9432;
  const DAY = 86400000;

  const getApprovalPercent = (approval) => Math.trunc((approval * 100) / MAX_APPROVAL);

  class KingdomCounter extends Counter {
    constructor(image, plugin) {
      super(image, plugin, plugin.getApproval());
      this.plugin = plugin;
    }
    getText() { return getApprovalPercent(this.plugin.getApproval()) + '%'; }
    getTooltip() {
      return 'Approval: ' + this.plugin.getApproval() + '/' + MAX_APPROVAL + '</br>'
        + 'Coffer: ' + QuantityFormatter.quantityToStackSize(this.plugin.getCoffer());
    }
  }

  class KingdomPlugin {
    constructor() { this.configGroup = GROUP; this.counter = null; this.loggingIn = false; }

    startUp() { this.config = rl.configProxy(GROUP, () => this.configItems); }
    shutDown() { this.removeKingdomInfobox(); }

    onVarbitChanged(event) {
      if (event.getVarbitId() === MISC_COFFERS || event.getVarbitId() === MISC_APPROVAL) {
        const coffer = client.getVarbitValue(MISC_COFFERS);
        const approval = client.getVarbitValue(MISC_APPROVAL);
        if (this.isThroneOfMiscellaniaCompleted()
          && (this.isInKingdom() || (coffer > 0 && approval > 0))
          && (this.getCoffer() !== coffer || this.getApproval() !== approval)) {
          this.setLastChanged(Date.now());
          this.setCoffer(coffer);
          this.setApproval(approval);
        }
      } else if (event.getVarpId() === MISC_QUEST) {
        this.processInfobox();
      }
    }

    onGameStateChanged(event) {
      if (event.getGameState() === GameState.LOGGED_IN) this.processInfobox();
      else if (event.getGameState() === GameState.LOGGING_IN) this.loggingIn = true;
    }

    onGameTick() {
      if (this.loggingIn) {
        this.loggingIn = false;
        this.createNotification();
      }
    }

    processInfobox() {
      if (client.getGameState() === GameState.LOGGED_IN && this.isThroneOfMiscellaniaCompleted() && this.isInKingdom()) this.addKingdomInfobox();
      else this.removeKingdomInfobox();
    }

    createNotification() {
      if (!this.config.shouldSendNotifications() || !this.isThroneOfMiscellaniaCompleted()) return;
      const lastChanged = this.getLastChanged();
      if (lastChanged == null) return; // values not yet set: visit Miscellania
      const estimatedCoffer = this.estimateCoffer(lastChanged, this.getCoffer());
      const estimatedApproval = this.estimateApproval(lastChanged, this.getApproval());
      if (estimatedCoffer < this.config.getCofferThreshold() || getApprovalPercent(estimatedApproval) < this.config.getApprovalThreshold()) {
        this.sendChatMessage(`Your Kingdom of Miscellania approval is ${getApprovalPercent(estimatedApproval)}%, and your coffer has ${QuantityFormatter.quantityToStackSize(estimatedCoffer)} coins.`);
      }
    }

    addKingdomInfobox() {
      if (this.counter == null) {
        this.counter = new KingdomCounter(rl.itemManager.getImage(POH_TREASURE_TEAK), this);
        rl.infoBoxManager.addInfoBox(this.counter);
      }
    }

    removeKingdomInfobox() {
      if (this.counter != null) {
        rl.infoBoxManager.removeInfoBox(this.counter);
        this.counter = null;
      }
    }

    estimateCoffer(lastChanged, lastCoffer) {
      const daysSince = KingdomPlugin.getNumbersOfDaysPassed(lastChanged);
      const maxDailyWithdrawal = this.isRoyalTroubleCompleted() ? MAX_WITHDRAWAL_ROYAL_TROUBLE : MAX_WITHDRAWAL_BASE;
      const maxDailyThreshold = maxDailyWithdrawal * 10;
      for (let i = 0; i < daysSince; i++) lastCoffer -= lastCoffer > maxDailyThreshold ? maxDailyWithdrawal : Math.trunc(lastCoffer / 10);
      return lastCoffer;
    }

    estimateApproval(lastChanged, lastApproval) {
      const daysSince = KingdomPlugin.getNumbersOfDaysPassed(lastChanged);
      const dailyPercentage = this.isRoyalTroubleCompleted() ? APPROVAL_DECREMENT_ROYAL_TROUBLE : APPROVAL_DECREMENT_BASE;
      lastApproval -= Math.trunc(Math.fround(Math.fround(daysSince * dailyPercentage) * MAX_APPROVAL));
      return Math.max(lastApproval, 0);
    }

    // Instant.truncatedTo(ChronoUnit.DAYS): UTC days
    static getNumbersOfDaysPassed(lastChanged) {
      return Math.floor(Date.now() / DAY) - Math.floor(lastChanged / DAY);
    }

    isInKingdom() {
      return client.getLocalPlayer() != null && KINGDOM_REGION.has(client.getLocalPlayer().getWorldLocation().getRegionID());
    }
    isThroneOfMiscellaniaCompleted() { return client.getVarpValue(MISC_QUEST) > 0; }
    isRoyalTroubleCompleted() { return false; } // (Royal Trouble: not on our server)

    sendChatMessage(chatMessage) {
      // ChatMessageBuilder HIGHLIGHT, as a CONSOLE message
      client.addChatMessage('CONSOLE', '', chatMessage, null);
    }

    getLastChanged() {
      const v = rl.configManager.getRSProfileConfiguration(GROUP, CONFIG_LAST_CHANGED_KEY);
      return v == null || v === '' ? null : Number(v);
    }
    setLastChanged(t) { rl.configManager.setRSProfileConfiguration(GROUP, CONFIG_LAST_CHANGED_KEY, t); }
    getCoffer() { const v = rl.configManager.getRSProfileConfiguration(GROUP, CONFIG_COFFER_KEY); return v == null ? 0 : Number(v) | 0; }
    setCoffer(c) { rl.configManager.setRSProfileConfiguration(GROUP, CONFIG_COFFER_KEY, c); }
    getApproval() { const v = rl.configManager.getRSProfileConfiguration(GROUP, CONFIG_APPROVAL_KEY); return v == null ? 0 : Number(v) | 0; }
    setApproval(a) { rl.configManager.setRSProfileConfiguration(GROUP, CONFIG_APPROVAL_KEY, a); }
  }

  const plugin = new KingdomPlugin();
  rl.registerPlugin(GROUP, plugin);
  ll.kingdomTest = { plugin, KingdomCounter };
})();
