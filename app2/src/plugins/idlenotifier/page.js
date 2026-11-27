// RuneLite's Idle Notifier plugin, cloned from net.runelite.client.plugins.idlenotifier (BSD 2-Clause,
// Copyright (c) 2016-2018, Abel Briggs, Adam <Adam@sigterm.info> and RuneLite contributors): IdleNotifierPlugin.
// Trimmed for Sept 2007: the animation list keeps the skilling animations that are in the 2007 cache under the
// same id (later reanimations, Forestry, Motherlode, crashed stars, Sailing and other later content left out; the
// 2007 spinning wheel 894 stands in for the later 13138/13139); no six hour logout, oxygen, absorption, Forestry
// group gathering buff or NpcChanged (2007 NPCs that change form keep their combat options). The idle logout is the
// 2007 client's: 4500 client cycles (90 s), so the warning comes 20 s before, at 70 s.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill } = rl;

  const CLIENT_TICK_LENGTH = 20;
  const IDLE_LOGOUT_WARNING_BUFFER = 20000 / CLIENT_TICK_LENGTH;
  const COMBAT_WARNING_MILLIS = 19 * 60 * 1000; // 19 minutes
  const COMBAT_WARNING_CLIENT_TICKS = COMBAT_WARNING_MILLIS / CLIENT_TICK_LENGTH;
  const HIGHEST_MONSTER_ATTACK_SPEED = 8; // Except Scarab Mage, but they are with other monsters
  const FISHING_SPOT = 'Fishing spot';
  const SA_ENERGY = 300; // VarPlayerID.SA_ENERGY
  const FAILEDSPELL_IMPACT = 85; // SpotanimID.FAILEDSPELL_IMPACT

  const ANIMATIONS = new Set([
    /* Woodcutting */ 879, 877, 875, 873, 871, 869, 867, 2846,
    /* Woodcutting: Ents & Canoes */ 3291, 3290, 3289, 3288, 3287, 3286, 3285, 3292, 2390,
    /* Cooking(Fire, Range) */ 897, 896,
    /* Crafting(Gem Cutting, Glassblowing, Spinning, Weaving, Battlestaves, Pottery) */ 890, 891, 892, 888, 889, 887, 886, 885, 2717, 884, 894, 2270, 1249, 883,
    /* Fletching(Cutting, Stringing, Adding feathers and heads) */ 1248,
    /* Smithing(Anvil, Furnace, Cannonballs */ 898, 899, 827,
    /* Fishing */ 620, 621, 623, 619, 618, 622, 1193,
    /* Mining(Normal) */ 625, 626, 627, 629, 628, 624,
    /* Herblore */ 364, 363,
    /* Magic */ 726, 931, 719, 720, 721,
    /* Prayer */ 3705, 1649, 1648, 1650,
    /* Farming */ 2281, 2282, 2280, 2292, 830,
    /* Misc */ 895, 2305, 2793, 2794, 2795, 832,
  ]);

  // our actors are snapshots: Java's reference comparisons become typecode comparisons
  const same = (a, b) => (a == null || b == null ? a == b : a.equals(b)); // eslint-disable-line eqeqeq

  class IdleNotifierPlugin {
    constructor() {
      this.configGroup = 'idlenotifier';
      this.config = rl.configProxy('idlenotifier', () => this.configItems);
      this.lastAnimating = null;
      this.lastAnimation = -1;
      this.lastInteracting = null;
      this.lastInteract = null;
      this.lastMoving = null;
      this.lastPosition = null;
      this.notifyPosition = false;
      this.notifyHitpoints = true;
      this.notifyPrayer = true;
      this.shouldNotifyLowEnergy = false;
      this.shouldNotifyHighEnergy = false;
      this.notifyIdleLogout = true;
      this.lastSpecEnergy = 1000;
      this.lastCombatCountdown = 0;
      this.ready = false;
      this.lastInteractWasCombat = false;
    }
    startUp() {}
    shutDown() {}

    notify(enabled, message) { if (enabled) rl.notifier.notify(message); }

    onAnimationChanged(event) {
      if (client.getGameState() !== 'LOGGED_IN') return;
      const localPlayer = client.getLocalPlayer();
      if (!same(localPlayer, event.getActor())) return;
      const animation = localPlayer.getAnimation();
      if (ANIMATIONS.has(animation)) {
        this.resetTimers();
        this.lastAnimation = animation;
        this.lastAnimating = Date.now();
      } else if (animation === -1) {
        this.lastAnimating = Date.now();
      } else {
        // On unknown animation simply assume the animation is invalid and dont throw notification
        this.lastAnimation = -1;
        this.lastAnimating = null;
      }
    }

    onInteractingChanged(event) {
      const source = event.getSource();
      if (!same(source, client.getLocalPlayer())) return;
      const target = event.getTarget();
      // Reset last interact
      if (target != null) this.lastInteract = null;
      else this.lastInteracting = Date.now();
      // If this is not NPC, do not process as we are not interested in other entities
      if (!(target instanceof rl.NPC)) return;
      this.checkNpcInteraction(target);
    }

    onGameStateChanged(gameStateChanged) {
      this.lastInteracting = null;
      switch (gameStateChanged.getGameState()) {
        case 'LOGIN_SCREEN':
          this.resetTimers();
          // (no LOGGING_IN state here: the login screen readies the next log in)
          this.ready = true;
          break;
        case 'LOGGED_IN':
          if (this.ready) {
            this.ready = false;
            this.resetTimers();
          }
          break;
        default:
      }
    }

    onHitsplatApplied(event) {
      if (!same(event.getActor(), client.getLocalPlayer())) return;
      if (event.getHitsplat().isMine()) this.lastCombatCountdown = HIGHEST_MONSTER_ATTACK_SPEED;
    }

    onGraphicChanged(event) {
      const actor = event.getActor();
      if (!same(actor, client.getLocalPlayer())) return;
      if (actor.getGraphic() === FAILEDSPELL_IMPACT) this.lastCombatCountdown = HIGHEST_MONSTER_ATTACK_SPEED;
    }

    onGameTick() {
      const local = client.getLocalPlayer();
      const waitDuration = this.config.getIdleNotificationDelay();
      this.lastCombatCountdown = Math.max(this.lastCombatCountdown - 1, 0);
      if (local == null
        // If user has clicked in the last second then they're not idle so don't send idle notification
        || Date.now() - client.getMouseLastPressedMillis() < 1000
        || client.getKeyboardIdleTicks() < 10) {
        this.resetTimers();
        return;
      }
      const c = this.config;
      if (this.checkIdleLogout()) this.notify(c.logoutIdle(), 'You are about to log out from idling too long!');
      if (this.checkAnimationIdle(waitDuration, local)) this.notify(c.animationIdle(), 'You are now idle!');
      if (this.checkMovementIdle(waitDuration, local)) this.notify(c.movementIdle(), 'You have stopped moving!');
      if (this.checkInteractionIdle(waitDuration, local)) {
        if (this.lastInteractWasCombat) this.notify(c.interactionIdle(), 'You are now out of combat!');
        else this.notify(c.interactionIdle(), 'You are now idle!');
      }
      if (this.checkLowHitpoints()) this.notify(c.getHitpointsNotification(), 'You have low hitpoints!');
      if (this.checkLowPrayer()) this.notify(c.getPrayerNotification(), 'You have low prayer!');
      if (this.checkLowEnergy()) this.notify(c.getLowEnergyNotification(), 'You have low run energy!');
      if (this.checkHighEnergy()) this.notify(c.getHighEnergyNotification(), 'You have restored run energy!');
      if (this.checkFullSpecEnergy()) this.notify(c.getSpecNotification(), 'You have restored spec energy!');
    }

    checkNpcInteraction(target) {
      const npcMenuActions = target.getComposition().getActions();
      if (npcMenuActions.includes('Attack')) {
        // Player is most likely in combat with attack-able NPC
        this.resetTimers();
        this.lastInteract = target;
        this.lastInteracting = Date.now();
        this.lastInteractWasCombat = true;
      } else if (target.getName() != null && target.getName().includes(FISHING_SPOT)) {
        // Player is fishing
        this.resetTimers();
        this.lastInteract = target;
        this.lastInteracting = Date.now();
        this.lastInteractWasCombat = false;
      }
    }

    checkFullSpecEnergy() {
      const currentSpecEnergy = client.getVarpValue(SA_ENERGY);
      const threshold = this.config.getSpecEnergyThreshold() * 10;
      if (threshold === 0) {
        this.lastSpecEnergy = currentSpecEnergy;
        return false;
      }
      // Check if we have regenerated over the threshold, and that the regen was small enough.
      const notify = this.lastSpecEnergy < threshold && currentSpecEnergy >= threshold && currentSpecEnergy - this.lastSpecEnergy <= 100;
      this.lastSpecEnergy = currentSpecEnergy;
      return notify;
    }

    checkLowHitpoints() {
      const t = this.config.getHitpointsThreshold();
      if (t === 0) return false;
      if (client.getRealSkillLevel(Skill.HITPOINTS) > t) {
        if (client.getBoostedSkillLevel(Skill.HITPOINTS) <= t) {
          if (!this.notifyHitpoints) {
            this.notifyHitpoints = true;
            return true;
          }
        } else {
          this.notifyHitpoints = false;
        }
      }
      return false;
    }

    checkLowPrayer() {
      const t = this.config.getPrayerThreshold();
      if (t === 0) return false;
      if (client.getRealSkillLevel(Skill.PRAYER) > t) {
        if (client.getBoostedSkillLevel(Skill.PRAYER) <= t) {
          if (!this.notifyPrayer) {
            this.notifyPrayer = true;
            return true;
          }
        } else {
          this.notifyPrayer = false;
        }
      }
      return false;
    }

    checkLowEnergy() {
      if (this.config.getLowEnergyThreshold() >= 100) return false;
      if (Math.trunc(client.getEnergy() / 100) <= this.config.getLowEnergyThreshold()) {
        if (this.shouldNotifyLowEnergy) {
          this.shouldNotifyLowEnergy = false;
          return true;
        }
      } else {
        this.shouldNotifyLowEnergy = true;
      }
      return false;
    }

    checkHighEnergy() {
      if (this.config.getHighEnergyThreshold() === 0) return false;
      if (Math.trunc(client.getEnergy() / 100) >= this.config.getHighEnergyThreshold()) {
        if (this.shouldNotifyHighEnergy) {
          this.shouldNotifyHighEnergy = false;
          return true;
        }
      } else {
        this.shouldNotifyHighEnergy = true;
      }
      return false;
    }

    checkInteractionIdle(waitDuration, local) {
      if (this.lastInteract == null) return false;
      const interact = local.getInteracting();
      if (interact == null) {
        if (this.lastInteracting != null && Date.now() >= this.lastInteracting + waitDuration && this.lastCombatCountdown === 0) {
          this.lastInteract = null;
          this.lastInteracting = null;
          // prevent animation notifications from firing too
          this.lastAnimation = -1;
          this.lastAnimating = null;
          return true;
        }
      } else {
        this.lastInteracting = Date.now();
      }
      return false;
    }

    checkIdleLogout() {
      // Check clientside AFK first, because this is required for the server to disconnect you for being first
      const idleClientTicks = Math.min(client.getKeyboardIdleTicks(), client.getMouseIdleTicks());
      if (idleClientTicks < client.getIdleTimeout() - IDLE_LOGOUT_WARNING_BUFFER) {
        this.notifyIdleLogout = true;
        return false;
      }
      // If we are not receiving hitsplats then we can be afk kicked
      if (this.lastCombatCountdown <= 0) {
        const warn = this.notifyIdleLogout;
        this.notifyIdleLogout = false;
        return warn;
      }
      // We are in combat, so now we have to check for the timer that knocks you out of combat
      const lastInteractionAgo = Date.now() - client.getMouseLastPressedMillis();
      if (lastInteractionAgo < COMBAT_WARNING_MILLIS || client.getKeyboardIdleTicks() < COMBAT_WARNING_CLIENT_TICKS) {
        this.notifyIdleLogout = true;
        return false;
      }
      const warn = this.notifyIdleLogout;
      this.notifyIdleLogout = false;
      return warn;
    }

    checkAnimationIdle(waitDuration, local) {
      if (this.lastAnimation === -1) return false;
      const animation = local.getAnimation();
      if (animation === -1) {
        if (this.lastAnimating != null && Date.now() >= this.lastAnimating + waitDuration) {
          this.lastAnimation = -1;
          this.lastAnimating = null;
          // prevent interaction notifications from firing too
          this.lastInteract = null;
          this.lastInteracting = null;
          return true;
        }
      } else {
        this.lastAnimating = Date.now();
      }
      return false;
    }

    checkMovementIdle(waitDuration, local) {
      if (this.lastPosition == null) {
        this.lastPosition = local.getWorldLocation();
        return false;
      }
      const position = local.getWorldLocation();
      if (this.lastPosition.equals(position)) {
        if (this.notifyPosition && local.getAnimation() === -1 && Date.now() >= this.lastMoving + waitDuration) {
          this.notifyPosition = false;
          // Return true only if we weren't just breaking out of an animation
          return this.lastAnimation === -1;
        }
      } else {
        this.notifyPosition = true;
        this.lastPosition = position;
        this.lastMoving = Date.now();
      }
      return false;
    }

    resetTimers() {
      const local = client.getLocalPlayer();
      // Reset animation idle timer
      this.lastAnimating = null;
      const gameState = client.getGameState();
      if (gameState === 'LOGIN_SCREEN' || local == null || local.getAnimation() !== this.lastAnimation) this.lastAnimation = -1;
      // Reset interaction idle timer
      this.lastInteracting = null;
      if (gameState === 'LOGIN_SCREEN' || local == null || !same(local.getInteracting(), this.lastInteract)) this.lastInteract = null;
    }
  }

  rl.registerPlugin('idlenotifier', new IdleNotifierPlugin());
})();
