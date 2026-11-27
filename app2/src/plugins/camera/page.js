// RuneLite's Camera plugin, cloned from net.runelite.client.plugins.camera (BSD 2-Clause, Copyright (c) 2018 Abex,
// Wynadorn and RuneLite contributors): CameraPlugin, CameraConfig, ControlFunction.
// The zoom and mouse camera are the client's (the RuneLite core emulates OSRS's for the 2007 client). Left out with the
// 2007 client: the settings zoom slider and its tooltip (no slider in 2007), the zoomLinToExp / zoomExpToLin slider
// callbacks, the pitch relaxer. 2007RS: Draw distance and Hide roofs go to the client as the old Camera plugin did.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, VarClientID, ScriptID, MenuAction, MouseEventButtons, SwingUtilities } = rl;

  const OUTER_LIMIT_MIN = -400;
  const OUTER_LIMIT_MAX = 400;
  const INNER_ZOOM_LIMIT = 1400;
  const DEFAULT_ZOOM_INCREMENT = 25;
  const OPTION_MOUSE = 170; // VarPlayerID.OPTION_MOUSE
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  class CameraPlugin {
    constructor() {
      this.configGroup = 'zoom';
      this.config = rl.configProxy('zoom', () => this.configItems);
      this.controlDown = false; this.rightClick = false; this.middleClick = false; this.menuHasEntries = false;
      this.defaultZoomSmallMin = 0; this.defaultZoomSmallMax = 0; this.defaultZoomBigMin = 0; this.defaultZoomBigMax = 0;
    }

    startUp() {
      this.rightClick = false; this.middleClick = false; this.menuHasEntries = false;
      this.copyConfigs();
      rl.keyManager.registerKeyListener(this);
      rl.mouseManager.registerMouseListener(this);
      if (client.getGameState() === rl.GameState.LOGGED_IN) this.limitsChanged();
      this.apply2007();
    }

    shutDown() {
      client.setCameraMouseButtonMask(0);
      client.setCameraSpeed(1);
      client.setCameraPitchRelaxerEnabled(false);
      client.setInvertYaw(false);
      client.setInvertPitch(false);
      client.setCameraShakeDisabled(false);
      rl.keyManager.unregisterKeyListener(this);
      rl.mouseManager.unregisterMouseListener(this);
      this.controlDown = false;
      this.applyConfigs(false, 0);
      // (2007RS: back to the 2007 game's own draw distance and roofs)
      ll.command({ type: 'roofs', hide: false });
      ll.command({ type: 'draw-distance', tiles: 25 });
    }

    copyConfigs() {
      const config = this.config;
      client.setCameraMouseButtonMask(config.rightClickMovesCamera() && !config.rightClickMenuBlocksCamera() ? (1 << 2) | (1 << 4) : 0);
      client.setCameraSpeed(config.cameraSpeed());
      client.setCameraPitchRelaxerEnabled(config.relaxCameraPitch());
      client.setInvertYaw(config.invertYaw());
      client.setInvertPitch(config.invertPitch());
      client.setCameraShakeDisabled(config.disableCameraShake());
    }

    limitsChanged() {
      this.defaultZoomSmallMin = client.getVarcIntValue(VarClientID.CAMERA_ZOOM_SMALL_MIN);
      this.defaultZoomSmallMax = client.getVarcIntValue(VarClientID.CAMERA_ZOOM_SMALL_MAX);
      this.defaultZoomBigMin = client.getVarcIntValue(VarClientID.CAMERA_ZOOM_BIG_MIN);
      this.defaultZoomBigMax = client.getVarcIntValue(VarClientID.CAMERA_ZOOM_BIG_MAX);
      this.applyConfigs(this.config.innerLimit(), this.config.outerLimit());
    }

    applyConfigs(innerLimit, outerLimitAdj) {
      if (!this.defaultZoomSmallMax) return; // (limits not read yet: not logged in)
      client.setVarcIntValue(VarClientID.CAMERA_ZOOM_SMALL_MAX, innerLimit ? INNER_ZOOM_LIMIT : this.defaultZoomSmallMax);
      client.setVarcIntValue(VarClientID.CAMERA_ZOOM_BIG_MAX, innerLimit ? INNER_ZOOM_LIMIT : this.defaultZoomBigMax);
      outerLimitAdj = clamp(outerLimitAdj, OUTER_LIMIT_MIN, OUTER_LIMIT_MAX);
      client.setVarcIntValue(VarClientID.CAMERA_ZOOM_SMALL_MIN, this.defaultZoomSmallMin - outerLimitAdj);
      client.setVarcIntValue(VarClientID.CAMERA_ZOOM_BIG_MIN, this.defaultZoomBigMin - outerLimitAdj);
    }

    // 2007RS: the old Camera plugin's draw distance and roofs
    apply2007() {
      ll.command({ type: 'roofs', hide: !!this.config.hideRoofs() });
      ll.command({ type: 'draw-distance', tiles: this.config.drawDistance() || 25 });
    }

    onScriptCallbackEvent(event) {
      const intStack = client.getIntStack();
      const intStackSize = client.getIntStackSize();
      switch (event.getEventName()) {
        case 'scrollWheelZoom':
          if (!this.controlDown && this.config.controlFunction() === 'CONTROL_TO_ZOOM') intStack[intStackSize - 1] = 1;
          break;
        case 'scrollWheelZoomIncrement':
          if (this.config.zoomIncrement() !== DEFAULT_ZOOM_INCREMENT) intStack[intStackSize - 1] = this.config.zoomIncrement();
          break;
        default:
          break;
      }
    }

    onScriptPostFired(ev) { if (ev.getScriptId() === ScriptID.CAMERA_SET_ZOOM_LIMITS) this.limitsChanged(); }

    onFocusChanged(event) { if (!event.isFocused()) this.controlDown = false; }

    onConfigChanged(ev) {
      if (ev.getGroup() !== 'zoom') return;
      this.copyConfigs();
      this.applyConfigs(this.config.innerLimit(), this.config.outerLimit());
      this.apply2007();
    }

    // KeyListener
    keyPressed(e) { if (e.key === 'Control') this.controlDown = true; }
    keyReleased(e) {
      if (e.key !== 'Control') return;
      this.controlDown = false;
      if (this.config.controlFunction() === 'CONTROL_TO_RESET') {
        const zoomValue = clamp(this.config.ctrlZoomValue(), OUTER_LIMIT_MIN, INNER_ZOOM_LIMIT);
        client.runScript(ScriptID.CAMERA_DO_ZOOM, zoomValue, zoomValue);
      }
    }

    hasMenuEntries(menuEntries) {
      const A = MenuAction;
      const objects = new Set([A.GAME_OBJECT_FIRST_OPTION, A.GAME_OBJECT_SECOND_OPTION, A.GAME_OBJECT_THIRD_OPTION, A.GAME_OBJECT_FOURTH_OPTION, A.GAME_OBJECT_FIFTH_OPTION,
        A.NPC_FIRST_OPTION, A.NPC_SECOND_OPTION, A.NPC_THIRD_OPTION, A.NPC_FOURTH_OPTION, A.NPC_FIFTH_OPTION,
        A.GROUND_ITEM_FIRST_OPTION, A.GROUND_ITEM_SECOND_OPTION, A.GROUND_ITEM_THIRD_OPTION, A.GROUND_ITEM_FOURTH_OPTION, A.GROUND_ITEM_FIFTH_OPTION,
        A.PLAYER_FIRST_OPTION, A.PLAYER_SECOND_OPTION, A.PLAYER_THIRD_OPTION, A.PLAYER_FOURTH_OPTION, A.PLAYER_FIFTH_OPTION, A.PLAYER_SIXTH_OPTION,
        A.PLAYER_SEVENTH_OPTION, A.PLAYER_EIGHTH_OPTION]);
      // (EXAMINE_ITEM is 1001 in the 2007 client; no SET_HEADING or CC_OP_LOW_PRIORITY)
      const examines = new Set([A.EXAMINE_OBJECT, A.EXAMINE_NPC, A.EXAMINE_ITEM_GROUND, 1001]);
      for (const menuEntry of menuEntries) {
        let action = menuEntry.getType();
        if (action >= 2000) action -= 2000;
        if (action === A.CANCEL || action === A.WALK) continue;
        if (examines.has(action)) { if (this.config.rightClickExamine()) return true; continue; }
        if (objects.has(action)) { if (this.config.rightClickObjects()) return true; continue; }
        return true;
      }
      return false;
    }

    onClientTick() { this.menuHasEntries = this.hasMenuEntries(client.getMenuEntries()); }

    // MouseListener
    mousePressed(mouseEvent) {
      if (SwingUtilities.isRightMouseButton(mouseEvent) && this.config.rightClickMovesCamera()) {
        const oneButton = client.getVarpValue(OPTION_MOUSE) === 1;
        if (!this.menuHasEntries || oneButton) {
          this.rightClick = true;
          mouseEvent = mouseEvent.withButton(MouseEventButtons.BUTTON2);
        }
      } else if (SwingUtilities.isMiddleMouseButton(mouseEvent) && this.config.middleClickMenu()) {
        this.middleClick = true;
        mouseEvent = mouseEvent.withButton(MouseEventButtons.BUTTON3);
      }
      return mouseEvent;
    }

    mouseReleased(mouseEvent) {
      if (this.rightClick) { this.rightClick = false; mouseEvent = mouseEvent.withButton(MouseEventButtons.BUTTON2); }
      if (this.middleClick) { this.middleClick = false; mouseEvent = mouseEvent.withButton(MouseEventButtons.BUTTON3); }
      return mouseEvent;
    }
  }

  rl.registerPlugin('camera', new CameraPlugin());
})();
