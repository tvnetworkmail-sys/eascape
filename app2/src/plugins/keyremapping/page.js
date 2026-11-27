// RuneLite's Key Remapping plugin, cloned from net.runelite.client.plugins.keyremapping (BSD 2-Clause, Copyright (c)
// 2018, Adam <Adam@sigterm.info> and RuneLite contributors): KeyRemappingPlugin, KeyRemappingListener.
// 2007: the chat box is interface 137 in the frame's chat layer (548:90) with its input line at 137:1 ("Name:
// <col=0000ff>text*"), drawn by its scripts from varc string 1 (CHATINPUT). OSRS's setChatboxInput / blockChatInput
// script callbacks don't exist, so "Press Enter to Chat..." is put back into 137:1 each client tick while not typing
// (display only), and the typed characters are consumed before the client sees them (the core's keyTyped). Dialogs:
// isDialogOpen is the chat layer hidden (a dialogue on the frame's chat modal layer) or the client's chat prompt up
// (varc 5: an amount, a name or a PM); chatboxFocused is false while such a prompt or the app's chat box prompt takes
// the typing, as OSRS's input fields do. isOptionsDialogOpen: the 2007 option dialogues 228 / 230 / 232 / 234 (OSRS:
// Chatmenu.OPTIONS). No bank PIN, world map search, report or name change inputs in 2007. Keys are remapped with the
// core's KeyEvent.setKeyCode (the client reads the event's keyCode); the F-keys are 2007's own fixed tab keys.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, VarClientID, KeyEvent, ModifierlessKeybind, ColorUtil, Color } = rl;

  const PRESS_ENTER_TO_CHAT = 'Press Enter to Chat...';
  const CHATBOX_INPUT = (137 << 16) | 1;
  const CHAT_LAYER = (548 << 16) | 90;
  const OPTION_DIALOGS = [228, 230, 232, 234];
  const CHAT_TYPED_TEXT_OPAQUE_BACKGROUND = new Color(0, 0, 255); // JagexColors

  class KeyRemappingListener {
    constructor(plugin) { this.plugin = plugin; this.config = plugin.config; this.modified = new Map(); this.blockedChars = new Set(); }
    keyTyped(e) {
      const keyChar = e.getKeyChar();
      if (keyChar != null && this.blockedChars.has(keyChar) && this.plugin.chatboxFocused()) { e.consume(); return; }
      // (OSRS: the blockChatInput callback stops the chat input taking characters while not typing)
      if (keyChar != null && !this.plugin.isTyping() && this.plugin.chatboxFocused() && !this.plugin.isDialogOpen()) e.consume();
    }
    keyPressed(e) {
      const plugin = this.plugin; const config = this.config;
      const matches = (bind) => ModifierlessKeybind.matches(bind, e);
      if (!plugin.chatboxFocused()) return;
      if (!plugin.isTyping()) {
        let mappedKeyCode = KeyEvent.VK_UNDEFINED;
        if (config.cameraRemap()) {
          if (matches(config.up())) mappedKeyCode = KeyEvent.VK_UP;
          else if (matches(config.down())) mappedKeyCode = KeyEvent.VK_DOWN;
          else if (matches(config.left())) mappedKeyCode = KeyEvent.VK_LEFT;
          else if (matches(config.right())) mappedKeyCode = KeyEvent.VK_RIGHT;
        }
        // In addition to the above checks, the F-key remapping shouldn't
        // activate when dialogs are open which listen for number keys
        // to select options
        if (config.fkeyRemap() && !plugin.isDialogOpen()) {
          const fkeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'];
          const i = fkeys.findIndex((k) => matches(config[k]()));
          if (i >= 0) mappedKeyCode = KeyEvent.VK_F1 + i;
          else if (matches(config.esc())) mappedKeyCode = KeyEvent.VK_ESCAPE;
        }
        // Do not remap to space key when the options dialog is open, since the options dialog never
        // listens for space, and the remapped key may be one of keys it listens for.
        if (plugin.isDialogOpen() && !plugin.isOptionsDialogOpen() && matches(config.space())) mappedKeyCode = KeyEvent.VK_SPACE;
        if (!plugin.isOptionsDialogOpen() && matches(config.control())) mappedKeyCode = KeyEvent.VK_CONTROL;
        if (mappedKeyCode !== KeyEvent.VK_UNDEFINED && mappedKeyCode !== e.getKeyCode()) {
          const keyChar = e.getKeyChar();
          this.modified.set(e.getKeyCode(), mappedKeyCode);
          e.setKeyCode(mappedKeyCode);
          // arrow keys and fkeys do not have a character
          e.setKeyChar(KeyEvent.CHAR_UNDEFINED);
          // If this key event has a valid key char then a key typed event may be received next, we must block it
          if (keyChar != null) this.blockedChars.add(keyChar);
        }
        switch (e.getKeyCode()) {
          case KeyEvent.VK_ENTER:
          case KeyEvent.VK_SLASH:
          case KeyEvent.VK_COLON:
            // refocus chatbox
            plugin.setTyping(true);
            plugin.unlockChat();
            break;
          default:
        }
      } else {
        switch (e.getKeyCode()) {
          case KeyEvent.VK_ESCAPE:
            // When exiting typing mode, block the escape key so that it doesn't trigger the in-game hotkeys
            e.consume();
            plugin.setTyping(false);
            client.setVarcStrValue(VarClientID.CHATINPUT, '');
            plugin.lockChat();
            break;
          case KeyEvent.VK_ENTER:
            plugin.setTyping(false);
            plugin.lockChat();
            break;
          case KeyEvent.VK_BACK_SPACE:
            // Only lock chat on backspace when the typed text is now empty (the client's script runs after us, so
            // the text is still one character long then)
            if (String(client.getVarcStrValue(VarClientID.CHATINPUT) || '').length <= 1) {
              plugin.setTyping(false);
              plugin.lockChat();
            }
            break;
          default:
        }
      }
    }
    keyReleased(e) {
      const keyCode = e.getKeyCode();
      const keyChar = e.getKeyChar();
      if (keyChar != null) this.blockedChars.delete(keyChar);
      const mappedKeyCode = this.modified.get(keyCode);
      if (mappedKeyCode !== undefined) {
        this.modified.delete(keyCode);
        e.setKeyCode(mappedKeyCode);
        e.setKeyChar(KeyEvent.CHAR_UNDEFINED);
      }
    }
  }

  class KeyRemappingPlugin {
    constructor() {
      this.configGroup = 'keyremapping';
      this.config = rl.configProxy('keyremapping', () => this.configItems);
      this.typing = false;
      this.inputListener = new KeyRemappingListener(this);
    }
    startUp() {
      this.typing = false;
      rl.keyManager.registerKeyListener(this.inputListener);
      if (client.getGameState() === 'LOGGED_IN') {
        this.lockChat();
        // Clear any typed text
        client.setVarcStrValue(VarClientID.CHATINPUT, '');
      }
    }
    shutDown() {
      if (client.getGameState() === 'LOGGED_IN') this.unlockChat();
      rl.keyManager.unregisterKeyListener(this.inputListener);
    }
    isTyping() { return this.typing; }
    setTyping(t) { this.typing = t; }
    /** Check if something other than the chatbox is accepting key input. */
    chatboxFocused() {
      if (client.getGameState() !== 'LOGGED_IN' || !ll.api.ifOpen(137)) return false;
      if (client.getVarcIntValue(VarClientID.MESLAYERMODE) > 0) return false; // the client's chat prompt has the typing
      if (rl.chatboxPanelManager && rl.chatboxPanelManager.getCurrentInput()) return false; // and the app's
      return true;
    }
    /** Check if a dialog is open that will grab numerical input, to prevent F-key remapping from triggering. */
    isDialogOpen() {
      const layer = ll.api.com(CHAT_LAYER);
      return !layer || layer.hide || client.getVarcIntValue(VarClientID.MESLAYERMODE) > 0;
    }
    isOptionsDialogOpen() { return OPTION_DIALOGS.some((g) => ll.api.ifOpen(g)); }
    // (OSRS's setChatboxInput callback: the chat box's script rewrites the input line, so it's put back each tick)
    onClientTick() {
      if (!this.typing && client.getGameState() === 'LOGGED_IN') {
        const w = client.getWidget(CHATBOX_INPUT);
        if (w && !w.getText().endsWith(PRESS_ENTER_TO_CHAT)) this.setChatboxWidgetInput(w, PRESS_ENTER_TO_CHAT);
      }
    }
    lockChat() {
      const chatboxInput = client.getWidget(CHATBOX_INPUT);
      if (chatboxInput != null) this.setChatboxWidgetInput(chatboxInput, PRESS_ENTER_TO_CHAT);
    }
    unlockChat() {
      const chatboxInput = client.getWidget(CHATBOX_INPUT);
      if (chatboxInput != null && client.getGameState() === 'LOGGED_IN') {
        this.setChatboxWidgetInput(chatboxInput, ColorUtil.wrapWithColorTag((client.getVarcStrValue(VarClientID.CHATINPUT) || '') + '*', CHAT_TYPED_TEXT_OPAQUE_BACKGROUND));
      }
    }
    setChatboxWidgetInput(widget, input) {
      const text = widget.getText();
      const idx = text.indexOf(':');
      if (idx !== -1) widget.setText(text.slice(0, idx) + ': ' + input);
    }
  }

  const plugin = new KeyRemappingPlugin();
  ll.__keyremapping = { plugin };
  rl.registerPlugin('keyremapping', plugin);
})();
