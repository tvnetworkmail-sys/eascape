'use strict';
// Login Screen's "Remember password" (the user's own feature, kept by request beside RuneLite's
// Login Screen): the main.js IPC handlers' rules, kept apart from Electron so they can be tested.
// Remembered password: only the game page's login plugin asks for it, only when
// "Remember password" is ticked. Unticking it deletes the stored password straight away.

/**
 * @param {{ secrets: { getPassword(): string, setPassword(p: string): boolean, clear(): boolean },
 *           isGamePage: (sender: unknown) => boolean, enabled: () => boolean, ticked: () => boolean }} o
 */
function loginPasswordHandlers({ secrets, isGamePage, enabled, ticked }) {
  return {
    get(e) {
      if (!isGamePage(e && e.sender)) return '';
      if (!enabled() || !ticked()) return '';
      return secrets.getPassword();
    },
    set(e, pass) {
      if (!isGamePage(e && e.sender)) return false;
      if (!pass || !ticked()) return secrets.clear();
      return secrets.setPassword(pass);
    },
    /** config.onChange: unticking "Remember password" deletes the stored password straight away */
    configChanged(c) {
      if (c && c.group === 'loginscreen' && c.key === 'rememberPassword' && !c.value) secrets.clear();
    },
  };
}

module.exports = { loginPasswordHandlers };
