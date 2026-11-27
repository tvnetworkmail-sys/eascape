// RuneLite's Custom Cursor, cloned from net.runelite.client.plugins.customcursor (BSD 2-Clause,
// Copyright (c) 2018, Plinko60 and RuneLite contributors): CustomCursorPlugin, CustomCursor. ClientUI
// sets the cursor on the client; here it's the game canvas (a stylesheet rule, so the overlay
// renderer's resize cursors still win while you resize).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const FILES = { RS3_GOLD: 'cursor-rs3-gold.png', RS3_SILVER: 'cursor-rs3-silver.png', DRAGON_DAGGER: 'cursor-dragon-dagger.png',
    DRAGON_DAGGER_POISON: 'cursor-dragon-dagger-p.png', TROUT: 'cursor-trout.png', DRAGON_SCIMITAR: 'cursor-dragon-scimitar.png' };
  const WEAPON_SLOT = 3;

  class CustomCursorPlugin {
    constructor() { this.configGroup = 'customcursor'; this.config = rl.configProxy('customcursor', () => this.configItems); this.lastWeapon = null; }
    setCursor(url) {
      let st = document.getElementById('rl-customcursor');
      if (!url) { if (st) st.remove(); return; }
      if (!st) { st = document.createElement('style'); st.id = 'rl-customcursor'; document.head.appendChild(st); }
      st.textContent = `#canvas { cursor: url(${url}) 0 0, auto; }`;
    }
    startUp() { this.updateCursor(); }
    shutDown() { this.setCursor(null); }
    onConfigChanged() { this.updateCursor(); }
    onGameTick() {
      // ItemContainerChanged (worn) for "Equipped Weapon"
      if (this.config.selectedCursor() !== 'EQUIPPED_WEAPON') return;
      const eq = rl.client.getItemContainer('EQUIPMENT');
      const w = eq && eq.getItem(WEAPON_SLOT) ? eq.getItem(WEAPON_SLOT).getId() : -1;
      if (w !== this.lastWeapon) this.updateCursor();
    }
    updateCursor() {
      const sel = this.config.selectedCursor();
      if (sel === 'CUSTOM_IMAGE') { this.setCursor(null); return; }
      if (sel === 'EQUIPPED_WEAPON') {
        const eq = rl.client.getItemContainer('EQUIPMENT');
        const item = eq && eq.getItem(WEAPON_SLOT);
        this.lastWeapon = item ? item.getId() : -1;
        const url = item && ll.itemIconUrl ? ll.itemIconUrl(item.getId(), 1) : null;
        this.setCursor(url);
        return;
      }
      const img = this.resources[FILES[sel]];
      this.setCursor(img ? img.src : null);
    }
  }
  rl.registerPlugin('customcursor', new CustomCursorPlugin());
})();
