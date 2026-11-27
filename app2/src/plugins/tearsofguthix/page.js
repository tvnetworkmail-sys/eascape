// RuneLite's Tears Of Guthix plugin, cloned from net.runelite.client.plugins.tearsofguthix (BSD 2-Clause, Copyright
// (c) 2018, Infinitay <https://github.com/Infinitay>, (c) 2020, cgati and RuneLite contributors): TearsOfGuthixPlugin,
// TearsOfGuthixOverlay. ObjectID.TOG_WEEPING_WALL_GOOD_R / _L and _BAD_R / _L are the same loc ids in the 2007 cache
// (tog_weeping_wall_good_r 6661, bad_r 6662, good_l 6665, bad_l 6666).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, ProgressPieComponent, ColorUtil, GameState } = rl;

  const TOG_REGION = 12948;
  const TOG_WEEPING_WALL_GOOD_R = 6661;
  const TOG_WEEPING_WALL_BAD_R = 6662;
  const TOG_WEEPING_WALL_GOOD_L = 6665;
  const TOG_WEEPING_WALL_BAD_L = 6666;
  const MAX_TIME = 9000; // Duration.ofSeconds(9)

  class TearsOfGuthixOverlay extends Overlay {
    constructor(config, plugin) {
      super(plugin);
      this.config = config; this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    getName() { return 'TearsOfGuthixOverlay'; }
    render(graphics) {
      if (this.plugin.streams.size === 0) return null;
      const blueTearsFill = this.config.getBlueTearsColor();
      const greenTearsFill = this.config.getGreenTearsColor();
      const blueTearsBorder = ColorUtil.colorWithAlpha(blueTearsFill, 255);
      const greenTearsBorder = ColorUtil.colorWithAlpha(greenTearsFill, 255);
      this.plugin.streams.forEach((timer, object) => {
        if ((object.getId() === TOG_WEEPING_WALL_BAD_R || object.getId() === TOG_WEEPING_WALL_BAD_L) && !this.config.showGreenTearsTimer()) return;
        const position = object.getCanvasLocation(100);
        if (!position) return;
        const progressPie = new ProgressPieComponent();
        progressPie.setDiameter(15);
        if (object.getId() === TOG_WEEPING_WALL_GOOD_R || object.getId() === TOG_WEEPING_WALL_GOOD_L) {
          progressPie.setFill(blueTearsFill);
          progressPie.setBorderColor(blueTearsBorder);
        } else if (object.getId() === TOG_WEEPING_WALL_BAD_R || object.getId() === TOG_WEEPING_WALL_BAD_L) {
          progressPie.setFill(greenTearsFill);
          progressPie.setBorderColor(greenTearsBorder);
        }
        progressPie.setPosition(position);
        const duration = Date.now() - timer;
        progressPie.setProgress(1 - (duration < MAX_TIME ? duration / MAX_TIME : 1));
        progressPie.render(graphics);
      });
      return null;
    }
  }

  class TearsOfGuthixPlugin {
    constructor() {
      this.configGroup = 'tearsofguthix';
      this.streams = new Map(); // DecorativeObject -> Instant
    }
    startUp() {
      this.config = rl.configProxy('tearsofguthix', () => this.configItems);
      this.overlay = this.overlay || new TearsOfGuthixOverlay(this.config, this);
      rl.overlayManager.add(this.overlay);
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      this.streams.clear();
    }
    onGameStateChanged(event) {
      switch (event.getGameState()) {
        case GameState.LOADING:
        case GameState.LOGIN_SCREEN:
        case GameState.HOPPING:
          this.streams.clear();
          break;
        default:
      }
    }
    onDecorativeObjectSpawned(event) {
      const object = event.getDecorativeObject();
      const id = object.getId();
      if (id === TOG_WEEPING_WALL_GOOD_R || id === TOG_WEEPING_WALL_GOOD_L || id === TOG_WEEPING_WALL_BAD_R || id === TOG_WEEPING_WALL_BAD_L) {
        if (client.getLocalPlayer().getWorldLocation().getRegionID() === TOG_REGION) this.streams.set(object, Date.now());
      }
    }
    onDecorativeObjectDespawned(event) {
      if (this.streams.size === 0) return;
      this.streams.delete(event.getDecorativeObject());
    }
  }

  rl.registerPlugin('tearsofguthix', new TearsOfGuthixPlugin());
})();
