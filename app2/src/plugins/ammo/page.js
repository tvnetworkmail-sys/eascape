// RuneLite's Ammo plugin, cloned from net.runelite.client.plugins.ammo (BSD 2-Clause, Copyright (c) 2019, Hydrox6
// <ikada@protonmail.ch> and RuneLite contributors): AmmoPlugin, AmmoCounter.
// Trimmed for Sept 2007: no Dizana's quiver (2024) and its varps.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Counter, QuantityFormatter, InventoryID } = rl;
  // EquipmentInventorySlot
  const WEAPON = 3;
  const AMMO = 13;

  class AmmoCounter extends Counter {
    constructor(plugin, itemID, count, name, image) { super(image, plugin, count); this.itemID = itemID; this.name = name; }
    getItemID() { return this.itemID; }
    getText() { return QuantityFormatter.quantityToRSDecimalStack(this.getCount()); }
    getTooltip() { return this.name; }
  }

  class AmmoPlugin {
    constructor() { this.counterBox = null; }
    startUp() {
      const container = client.getItemContainer(InventoryID.WORN);
      if (container != null) this.checkInventory(container);
    }
    shutDown() {
      rl.infoBoxManager.removeInfoBox(this.counterBox);
      this.counterBox = null;
    }
    onItemContainerChanged(event) {
      if (event.getContainerId() !== InventoryID.WORN) return;
      this.checkInventory(event.getItemContainer());
    }
    checkInventory(equipment) {
      // (no Dizana's quiver in 2007)
      // Check for weapon slot items. This overrides the ammo slot,
      // as the player will use the thrown weapon (eg. chinchompas, knives, darts)
      const weapon = equipment.getItem(WEAPON);
      if (weapon != null && weapon.getId() >= 0) {
        const weaponComp = rl.itemManager.getItemComposition(weapon.getId());
        if (weaponComp.isStackable()) {
          this.updateInfobox(weapon, weaponComp);
          return;
        }
      }
      const ammo = equipment.getItem(AMMO);
      if (ammo == null || ammo.getId() < 0) {
        this.removeInfobox();
        return;
      }
      const comp = rl.itemManager.getItemComposition(ammo.getId());
      if (!comp.isStackable()) {
        this.removeInfobox();
        return;
      }
      this.updateInfobox(ammo, comp);
    }
    updateInfobox(item, comp) {
      if (this.counterBox != null && this.counterBox.getItemID() === item.getId()) {
        this.counterBox.setCount(item.getQuantity());
        return;
      }
      this.removeInfobox();
      // (itemManager.getImage(id, 5, false): the icon as a stack of 5)
      const image = rl.itemManager.getImage(item.getId(), 5);
      this.counterBox = new AmmoCounter(this, item.getId(), item.getQuantity(), comp.getName(), image);
      rl.infoBoxManager.addInfoBox(this.counterBox);
    }
    removeInfobox() {
      rl.infoBoxManager.removeInfoBox(this.counterBox);
      this.counterBox = null;
    }
  }

  const plugin = new AmmoPlugin();
  ll.__ammo = { plugin };
  rl.registerPlugin('ammo', plugin);
})();
