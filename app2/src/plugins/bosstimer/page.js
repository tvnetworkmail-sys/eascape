// RuneLite's Boss Timers plugin, cloned from net.runelite.client.plugins.bosstimer (BSD 2-Clause, Copyright (c) 2016-2017,
// Cameron Moberg <Moberg@tuta.io> and RuneLite contributors): BossTimersPlugin, Boss, RespawnTimer.
// Era-trim (22 Sep 2007): the 2007 bosses only, by their 2007 cache NPC ids (the God Wars ones differ from OSRS's).
// RuneLite's icons are the boss pets (2014+): each gets a 2007 drop of the boss instead (hilts, KBD / KQ heads, the
// Dagannoth Kings' rings, Chaos Elemental's dragon 2h, Giant Mole's claw). No Brutus bell, Hueycoatl or Mad Angel
// (NpcChanged) cases: those bosses are 2023+.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { Timer } = rl;

  const SECONDS = 1000;
  const GAME_TICKS = 600;
  const MILLIS = 1;
  class Boss {
    constructor(name, id, period, unit, itemSpriteId, ignoreDead = false) {
      this.name = name; this.id = id; this.spawnTime = period * unit; this.itemSpriteId = itemSpriteId; this.ignoreDead = ignoreDead;
    }
    getId() { return this.id; }
    getSpawnTime() { return this.spawnTime; }
    getItemSpriteId() { return this.itemSpriteId; }
    isIgnoreDead() { return this.ignoreDead; }
    static find(id) { return Boss.bosses.get(id) || null; }
  }
  Boss.values = [
    new Boss('GENERAL_GRAARDOR', 3966, 90, SECONDS, 10524), // gwd_general_graardor_6260, bandos hilt
    new Boss('KRIL_TSUTSAROTH', 3918, 90, SECONDS, 10528), // gwd_k_ril_tsutsaroth_6203, zamorak hilt
    new Boss('KREEARRA', 3934, 90, SECONDS, 10522), // gwd_kree_arra_6222, armadyl hilt
    new Boss('COMMANDER_ZILYANA', 3956, 90, SECONDS, 10526), // gwd_commander_zilyana_6247, saradomin hilt
    new Boss('CHAOS_ELEMENTAL', 3200, 14, GAME_TICKS, 7158), // chaoselemental, dragon 2h sword
    new Boss('KING_BLACK_DRAGON', 50, 9, SECONDS, 9303), // king_dragon, kbd heads
    new Boss('DAGANNOTH_PRIME', 2882, 90, SECONDS, 6731), // dagcave_magic_boss, seers ring
    new Boss('DAGANNOTH_REX', 2883, 90, SECONDS, 6737), // dagcave_melee_boss, berserker ring
    new Boss('DAGANNOTH_SUPREME', 2881, 90, SECONDS, 6733), // dagcave_ranged_boss, archers ring
    new Boss('GIANT_MOLE', 3340, 9000, MILLIS, 7416), // mole_giant, mole claw
    new Boss('KALPHITE_QUEEN', 1160, 30, SECONDS, 9304), // kalphite_flyingqueen, kq head
  ];
  Boss.bosses = new Map(Boss.values.map((b) => [b.getId(), b]));
  for (const b of Boss.values) Boss[b.name] = b;

  class RespawnTimer extends Timer {
    constructor(boss, bossImage, plugin) { super(boss.getSpawnTime(), bossImage, plugin); this.boss = boss; }
    getBoss() { return this.boss; }
  }

  class BossTimersPlugin {
    constructor() { this.configGroup = 'bosstimer'; }
    startUp() {}
    shutDown() { rl.infoBoxManager.removeIf((t) => t instanceof RespawnTimer); }
    onNpcDespawned(npcDespawned) {
      const npc = npcDespawned.getNpc();
      const boss = Boss.find(npc.getId());
      if (boss != null && (boss.isIgnoreDead() || rl.npcUtil.isDying(npc))) this.createTimer(npc, boss);
    }
    createTimer(npc, boss) {
      this.clearTimer(boss);
      const timer = new RespawnTimer(boss, rl.itemManager.getImage(boss.getItemSpriteId()), this);
      timer.setTooltip(npc.getName());
      rl.infoBoxManager.addInfoBox(timer);
    }
    clearTimer(boss) { rl.infoBoxManager.removeIf((t) => t instanceof RespawnTimer && t.getBoss() === boss); }
  }

  const plugin = new BossTimersPlugin();
  ll.__bosstimer = { plugin, Boss, RespawnTimer };
  rl.registerPlugin('bosstimer', plugin);
})();
