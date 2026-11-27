// RuneLite's Login Screen plugin, cloned from net.runelite.client.plugins.loginscreen (BSD 2-Clause, Copyright (c)
// 2017, Seth <Sethtroll3@gmail.com>, (c) 2018, Adam and RuneLite contributors): LoginScreenPlugin, LoginScreenConfig,
// LoginScreenOverride.
// 2007: LoginScreenOverride is OFF and CUSTOM (OSRS's login screen images are later art); the custom image is the
// app's login.png (sent by the app side as __customLoginScreen); no authenticator box (login index 4) in 2007.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, GameState, keyManager } = rl;
  const GROUP = 'loginscreen';
  const MAX_USERNAME_LENGTH = 254;
  const LoginScreenOverride = { OFF: 'OFF', CUSTOM: 'CUSTOM' };
  const isNullOrEmpty = (s) => s == null || s === '';

  class LoginScreenPlugin {
    constructor() { this.configGroup = GROUP; this.usernameCache = null; this.loadSeq = 0; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.applyUsername();
      keyManager.registerKeyListener(this);
      this.overrideLoginScreen();
    }
    shutDown() {
      if (this.config.syncUsername()) client.getPreferences().setRememberedUsername(this.usernameCache);
      keyManager.unregisterKeyListener(this);
      this.restoreLoginScreen();
      client.setShouldRenderLoginScreenFire(true);
    }
    onConfigChanged(event) {
      if (event.getGroup() === GROUP) this.overrideLoginScreen();
    }
    onGameStateChanged(event) {
      if (!this.config.syncUsername()) return;
      if (event.getGameState() === GameState.LOGIN_SCREEN) {
        this.applyUsername();
      } else if (event.getGameState() === GameState.LOGGED_IN) {
        let username = '';
        if (client.getPreferences().getRememberedUsername() != null) username = client.getUsername();
        if (this.config.username() === username) return;
        this.config.username(username);
      }
    }
    onProfileChanged() {
      // configuation for the account is available now, so update the username
      this.applyUsername();
    }
    applyUsername() {
      if (!this.config.syncUsername()) return;
      const gameState = client.getGameState();
      if (gameState === GameState.LOGIN_SCREEN) {
        const username = this.config.username();
        if (isNullOrEmpty(username)) return;
        // Save it only once
        if (this.usernameCache == null) this.usernameCache = client.getPreferences().getRememberedUsername();
        client.getPreferences().setRememberedUsername(username);
      }
    }
    isEnabledOnLoginScreen() { return true; }
    keyTyped() {}
    keyPressed(e) {
      if (!this.config.pasteEnabled() || client.getGameState() !== GameState.LOGIN_SCREEN) return;
      // enable pasting on macOS with the Command (meta) key
      const isModifierDown = /Mac/.test(navigator.platform) ? e.metaKey : e.ctrlKey;
      if ((e.code === 'KeyV' || e.key === 'v' || e.key === 'V') && isModifierDown) {
        const clip = navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.reject(new Error('no clipboard'));
        clip.then((text) => {
          const data = String(text).trim();
          switch (client.getLoginIndex()) {
            // Username/password form
            case 2:
              if (client.getCurrentLoginField() === 0) {
                // Truncate data to maximum username length if necessary
                client.setUsername(data.substring(0, Math.min(data.length, MAX_USERNAME_LENGTH)));
              }
              break;
            // (no authenticator form in 2007)
            default: break;
          }
        }).catch(() => { /* failed to fetch clipboard data */ });
      }
    }
    keyReleased() {}
    overrideLoginScreen() {
      client.setShouldRenderLoginScreenFire(this.config.showLoginFire());
      const loginScreen = this.config.loginScreen();
      if (loginScreen !== LoginScreenOverride.CUSTOM) {
        this.restoreLoginScreen();
        return;
      }
      const url = rl.configManager.getConfiguration(GROUP, '__customLoginScreen');
      if (!url) return; // (no login.png)
      const seq = ++this.loadSeq;
      const image = new Image();
      image.onload = () => {
        if (seq !== this.loadSeq || this.config.loginScreen() !== LoginScreenOverride.CUSTOM) return;
        client.setLoginScreen(rl.ImageUtil.getImageSpritePixels(image, client));
      };
      image.onerror = () => this.restoreLoginScreen(); // error loading custom login screen
      image.src = url;
    }
    restoreLoginScreen() {
      this.loadSeq++;
      client.setLoginScreen(null);
    }
  }

  const plugin = new LoginScreenPlugin();
  ll.__loginscreen = { plugin, LoginScreenOverride };
  rl.registerPlugin(GROUP, plugin);
})();
