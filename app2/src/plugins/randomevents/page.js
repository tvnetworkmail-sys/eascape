// RuneLite's Random Events plugin, cloned from net.runelite.client.plugins.randomevents (BSD 2-Clause, Copyright (c)
// 2018, Adam <Adam@sigterm.info> and RuneLite contributors): RandomEventPlugin, RandomEventConfig.
// 2007 NPC ids: found by name in the 2007 cache (core client hook `npcType`). OSRS has a separate Mysterious Old Man for
// each event he invites you to (maze, mime, surprise exam, pinball); 2007 has one (410, underwater 3352), so those
// invitations come as the Mysterious Old Man. Evil Bob's prison invitation is the Talk-to Evil Bob (2479), the drill
// demon's Sergeant Damien (2790), the gravedigger's Leo (3508), the quiz's Quiz Master (2477), the evil twin's Postie
// Pete (3805). Era-trim: no Count Check (2023). Notifications are checkboxes: a specific one, else "all events".
// The 2007 NPC menu opcodes aren't contiguous (17, 38, 34, 32, 4), so the op check is by set.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, MenuAction } = rl;
  const GROUP = 'randomevents';

  const NpcID = {
    MACRO_BEEKEEPER_INVITATION: 4416, MACRO_COMBILOCK_PIRATE: 2308, MACRO_JEKYLL: 2540, MACRO_JEKYLL_UNDERWATER: 3359, MACRO_DWARF: 956,
    MACRO_EVIL_BOB_OUTSIDE: 2478, MACRO_EVIL_BOB_PRISON: 2479, MACRO_FORESTER_INVITATION: 2458, MACRO_FROG_CRIER: 2472,
    MACRO_GENI: 409, MACRO_GENI_UNDERWATER: 3351, MACRO_GILES: 2538, MACRO_GILES_UNDERWATER: 3358, MACRO_GRAVEDIGGER_INVITATION: 3508,
    MACRO_MILES: 2537, MACRO_MILES_UNDERWATER: 3357, MACRO_MYSTERIOUS_OLD_MAN: 410, MACRO_MYSTERIOUS_OLD_MAN_UNDERWATER: 3352,
    MACRO_NILES: 2536, MACRO_NILES_UNDERWATER: 3356, MACRO_PILLORY_GUARD: 2791, GRAB_POSTMAN: 3805, MACRO_MAGNESON_INVITATION: 2477,
    MACRO_HIGHWAYMAN: 2476, MACRO_HIGHWAYMAN_UNDERWATER: 3355, MACRO_SANDWICH_LADY_NPC: 3117, MACRO_DRILLDEMON_INVITATION: 2790,
  };
  const EVENT_NPCS = new Set(Object.values(NpcID));
  const EVENT_OPTIONS = new Set(['Talk-to', 'Dismiss']);
  const NPC_OPS = new Set([MenuAction.NPC_FIRST_OPTION, MenuAction.NPC_SECOND_OPTION, MenuAction.NPC_THIRD_OPTION, MenuAction.NPC_FOURTH_OPTION, MenuAction.NPC_FIFTH_OPTION].map((m) => (m && m.getId ? m.getId() : m)));
  const RANDOM_EVENT_TIMEOUT = 150;
  const sameNpc = (a, b) => !!a && !!b && (a === b || (a.getIndex && b.getIndex && a.getIndex() === b.getIndex()));

  class RandomEventPlugin {
    constructor() { this.configGroup = GROUP; this.currentRandomEvent = null; this.lastNotificationTick = -RANDOM_EVENT_TIMEOUT; }
    startUp() { this.config = rl.configProxy(GROUP, () => this.configItems); }
    shutDown() { this.lastNotificationTick = 0; this.currentRandomEvent = null; }
    onInteractingChanged(event) {
      const source = event.getSource();
      const target = event.getTarget();
      const player = client.getLocalPlayer();
      // (our actors are snapshots: the local player is matched by name, the NPC by index)
      const targetIsPlayer = !!target && !!player && !(target instanceof rl.NPC) && target.getName() === player.getName();
      if (player == null || !targetIsPlayer || sameNpc(player.getInteracting(), source) || !(source instanceof rl.NPC) || !EVENT_NPCS.has(source.getId())) return;
      this.currentRandomEvent = source;
      if (client.getTickCount() - this.lastNotificationTick > RANDOM_EVENT_TIMEOUT) {
        this.lastNotificationTick = client.getTickCount();
        if (this.shouldNotify(source.getId())) rl.notifier.notify('Random event spawned: ' + source.getName());
      }
    }
    onNpcDespawned(e) { if (sameNpc(e.getNpc(), this.currentRandomEvent)) this.currentRandomEvent = null; }
    onMenuEntryAdded(event) {
      if (NPC_OPS.has(event.getType()) && EVENT_OPTIONS.has(event.getOption())) {
        const npc = event.getMenuEntry().getNpc();
        if (npc != null && EVENT_NPCS.has(npc.getId()) && !sameNpc(npc, this.currentRandomEvent) && this.config.removeMenuOptions()) {
          const entries = client.getMenuEntries();
          client.setMenuEntries(entries.slice(0, entries.length - 1));
        }
      }
    }
    shouldNotify(id) {
      const c = this.config;
      let notification = null;
      switch (id) {
        case NpcID.MACRO_BEEKEEPER_INVITATION: notification = c.notifyBeekeeper(); break;
        case NpcID.MACRO_COMBILOCK_PIRATE: notification = c.notifyArnav(); break;
        case NpcID.MACRO_DWARF: notification = c.notifyDwarf(); break;
        case NpcID.MACRO_DRILLDEMON_INVITATION: notification = c.notifyDemon(); break;
        case NpcID.MACRO_FORESTER_INVITATION: notification = c.notifyForester(); break;
        case NpcID.MACRO_FROG_CRIER: notification = c.notifyFrog(); break;
        case NpcID.MACRO_GENI: case NpcID.MACRO_GENI_UNDERWATER: notification = c.notifyGenie(); break;
        case NpcID.MACRO_GILES: case NpcID.MACRO_GILES_UNDERWATER: case NpcID.MACRO_NILES: case NpcID.MACRO_NILES_UNDERWATER:
        case NpcID.MACRO_MILES: case NpcID.MACRO_MILES_UNDERWATER: notification = c.notifyCerters(); break;
        case NpcID.MACRO_JEKYLL: case NpcID.MACRO_JEKYLL_UNDERWATER: notification = c.notifyJekyll(); break;
        case NpcID.MACRO_EVIL_BOB_OUTSIDE: notification = c.notifyBob(); break;
        case NpcID.MACRO_EVIL_BOB_PRISON: notification = c.notifyPrison(); break;
        case NpcID.MACRO_GRAVEDIGGER_INVITATION: notification = c.notifyGravedigger(); break;
        // (2007: one Mysterious Old Man also invites to the maze, mime, surprise exam and pinball)
        case NpcID.MACRO_MYSTERIOUS_OLD_MAN: case NpcID.MACRO_MYSTERIOUS_OLD_MAN_UNDERWATER:
          notification = c.notifyMoM() || c.notifyMaze() || c.notifyMime() || c.notifyDunce() || c.notifyFlippa(); break;
        case NpcID.MACRO_PILLORY_GUARD: notification = c.notifyPillory(); break;
        case NpcID.GRAB_POSTMAN: notification = c.notifyTwin(); break;
        case NpcID.MACRO_MAGNESON_INVITATION: notification = c.notifyQuiz(); break;
        case NpcID.MACRO_HIGHWAYMAN: case NpcID.MACRO_HIGHWAYMAN_UNDERWATER: notification = c.notifyTurpentine(); break;
        case NpcID.MACRO_SANDWICH_LADY_NPC: notification = c.notifySandwich(); break;
        default: break;
      }
      if (notification) return true;
      return c.notifyAllEvents();
    }
  }

  const plugin = new RandomEventPlugin();
  ll.__randomevents = { plugin, NpcID };
  rl.registerPlugin('randomevents', plugin);
})();
