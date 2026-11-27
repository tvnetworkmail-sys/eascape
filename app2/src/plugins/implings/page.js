// RuneLite's Implings plugin, cloned from net.runelite.client.plugins.implings (BSD 2-Clause, Copyright (c) 2017,
// Robin <robin.weymans@gmail.com> and RuneLite contributors): ImplingsPlugin, ImplingsOverlay, Impling, ImplingType,
// ImplingSpawn.
// The 2007 cache's implings (Impetuous Impulses, 11 Jun 2007): the overworld ones (1028-1035, 6053, 6054 in 2007's
// numbering) and Puro-Puro's (6055-6064). No crystal (2019) or lucky (2017) implings.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, HighlightedNpc, WorldPoint, LocalPoint, Perspective } = rl;

  const ImplingType = {};
  for (const [k, name] of [['BABY', 'Baby'], ['YOUNG', 'Young'], ['GOURMET', 'Gourmet'], ['EARTH', 'Earth'], ['ESSENCE', 'Essence'],
    ['ECLECTIC', 'Eclectic'], ['NATURE', 'Nature'], ['MAGPIE', 'Magpie'], ['NINJA', 'Ninja'], ['DRAGON', 'Dragon']]) ImplingType[k] = { key: k, getName: () => name };
  // Impling: type, the overworld NPC and the Puro-Puro one (2007 cache ids)
  const IMPLINGS = new Map();
  [['BABY', 4180, 4190], ['YOUNG', 4181, 4191], ['GOURMET', 4182, 4192], ['EARTH', 4183, 4193], ['ESSENCE', 4184, 4194],
    ['ECLECTIC', 4185, 4195], ['NATURE', 4186, 4196], ['MAGPIE', 4187, 4197], ['NINJA', 4188, 4198], ['DRAGON', 4189, 4199]]
    .forEach(([t, a, b]) => { const imp = { getImplingType: () => ImplingType[t] }; IMPLINGS.set(a, imp); IMPLINGS.set(b, imp); });
  const findImpling = (npcId) => IMPLINGS.get(npcId) || null;
  const ImplingSpawn = [
    [2563, 4291, 'BABY'], [2563, 4348, 'BABY'], [2569, 4323, 'BABY'], [2571, 4305, 'BABY'],
    [2581, 4300, 'BABY'], [2596, 4296, 'BABY'], [2609, 4339, 'BABY'], [2610, 4304, 'BABY'],
    [2615, 4322, 'BABY'], [2620, 4291, 'BABY'], [2620, 4348, 'BABY'], [2564, 4321, 'YOUNG'],
    [2573, 4330, 'YOUNG'], [2574, 4321, 'YOUNG'], [2590, 4348, 'YOUNG'], [2592, 4291, 'YOUNG'],
    [2595, 4343, 'YOUNG'], [2612, 4327, 'YOUNG'], [2612, 4309, 'YOUNG'], [2619, 4322, 'YOUNG'],
    [2587, 4300, 'YOUNG'], [2568, 4296, 'GOURMET'], [2569, 4327, 'GOURMET'], [2574, 4311, 'GOURMET'],
    [2574, 4311, 'GOURMET'], [2585, 4296, 'GOURMET'], [2597, 4293, 'GOURMET'], [2609, 4317, 'GOURMET'],
    [2615, 4298, 'GOURMET'], [2618, 4321, 'GOURMET'], [2570, 4330, 'EARTH'], [2598, 4340, 'EARTH'],
    [2587, 4342, 'EARTH'], [2612, 4310, 'EARTH'], [2611, 4334, 'EARTH'], [2574, 4317, 'ESSENCE'],
    [2576, 4337, 'ESSENCE'], [2585, 4298, 'ESSENCE'], [2601, 4343, 'ESSENCE'], [2612, 4318, 'ESSENCE'],
    [2567, 4319, 'ECLECTIC'], [2591, 4340, 'ECLECTIC'], [2591, 4295, 'ECLECTIC'], [2615, 4326, 'ECLECTIC'],
  ].map(([x, y, t]) => ({ getSpawnLocation: () => new WorldPoint(x, y, 0), getType: () => ImplingType[t] }));

  const PURO_PURO = (40 << 8) | 67;
  class ImplingsOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.config = config; this.plugin = plugin;
    }
    render(graphics) {
      const player = client.getLocalPlayer();
      if (player == null || player.getWorldLocation().getRegionID() !== PURO_PURO) return null;
      if (this.config.showSpawn()) {
        for (const spawn of ImplingSpawn) {
          if (this.plugin.showImplingType(spawn.getType()) === 'NONE') continue;
          this.drawSpawn(graphics, spawn.getSpawnLocation(), spawn.getType().getName(), this.config.getSpawnColor());
        }
      }
      return null;
    }
    drawSpawn(graphics, point, text, color) {
      // Don't draw spawns if Player is not in range
      if (point.distanceTo(client.getLocalPlayer().getWorldLocation()) >= 32) return;
      const localPoint = LocalPoint.fromWorld(client, point);
      if (localPoint == null) return;
      const poly = Perspective.getCanvasTilePoly(client, localPoint);
      if (poly != null) rl.OverlayUtil.renderPolygon(graphics, poly, color);
      const textPoint = Perspective.getCanvasTextLocation(client, graphics, localPoint, text, 0);
      if (textPoint != null) rl.OverlayUtil.renderTextLocation(graphics, textPoint, text, color);
    }
  }

  class ImplingsPlugin {
    constructor() {
      this.configGroup = 'implings';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.overlay = new ImplingsOverlay(this, this.config);
      this.isTarget = (npc) => {
        const impling = findImpling(npc.getId());
        if (impling != null && this.showImpling(impling)) {
          const color = this.implingColor(impling);
          return HighlightedNpc.builder().npc(npc).highlightColor(color).tile(true).name(true).nameOnMinimap(this.config.showName()).build();
        }
        return null;
      };
    }
    startUp() {
      rl.overlayManager.add(this.overlay);
      rl.npcOverlayService.registerHighlighter(this.isTarget);
    }
    shutDown() {
      rl.npcOverlayService.unregisterHighlighter(this.isTarget);
      rl.overlayManager.remove(this.overlay);
    }
    onConfigChanged(event) {
      if (event.getGroup() !== 'implings') return;
      rl.npcOverlayService.rebuild();
    }
    onNpcSpawned(npcSpawned) {
      const impling = findImpling(npcSpawned.getNpc().getId());
      if (impling != null && this.showImplingType(impling.getImplingType()) === 'NOTIFY') {
        rl.notifier.notify(impling.getImplingType().getName() + ' impling is in the area');
      }
    }
    showImpling(impling) {
      const impMode = this.showImplingType(impling.getImplingType());
      return impMode === 'HIGHLIGHT' || impMode === 'NOTIFY';
    }
    showImplingType(implingType) {
      const m = this.config['show' + implingType.getName()];
      return m ? m() : 'NONE';
    }
    implingColor(impling) { return this.config['get' + impling.getImplingType().getName() + 'Color'](); }
  }

  const plugin = new ImplingsPlugin();
  ll.__implings = { plugin, findImpling, ImplingSpawn };
  rl.registerPlugin('implings', plugin);
})();
