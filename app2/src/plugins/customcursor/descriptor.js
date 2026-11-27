'use strict';
// RuneLite's Custom Cursor (net.runelite.client.plugins.customcursor), cloned: CustomCursorConfig and
// RuneLite's cursor images. "Custom Image" reads custom-cursor.png from RuneLite's folder, which we
// don't have, so it falls back to the normal cursor as RuneLite does when the file is missing.
module.exports = {
  id: 'customcursor',
  name: 'Custom Cursor',
  description: 'Replaces your mouse cursor image',
  tags: ['cursor', 'mouse'],
  enabledByDefault: false,
  game: './customcursor/game.js',
  page: './customcursor/page.js',
  resources: ['cursor-rs3-gold.png', 'cursor-rs3-silver.png', 'cursor-dragon-dagger.png', 'cursor-dragon-dagger-p.png', 'cursor-trout.png', 'cursor-dragon-scimitar.png'],
  config: {
    group: 'customcursor',
    sections: [],
    items: [
      { key: 'cursorStyle', method: 'selectedCursor', name: 'Cursor', description: 'Select which cursor you wish to use.', type: 'enum', default: 'RS3_GOLD', options: [
        { value: 'RS3_GOLD', label: 'RS3 Gold' }, { value: 'RS3_SILVER', label: 'RS3 Silver' }, { value: 'DRAGON_DAGGER', label: 'Dragon Dagger' },
        { value: 'DRAGON_DAGGER_POISON', label: 'Dragon Dagger (p)' }, { value: 'TROUT', label: 'Trout' }, { value: 'DRAGON_SCIMITAR', label: 'Dragon Scimitar' },
        { value: 'EQUIPPED_WEAPON', label: 'Equipped Weapon' }, { value: 'CUSTOM_IMAGE', label: 'Custom Image' }] },
    ],
  },
};
