'use strict';
// RuneLite's ScreenMarkerPluginPanel, ScreenMarkerPanel and ScreenMarkerCreationPanel (net.runelite.client.plugins.screenmarkers.ui,
// BSD 2-Clause, Copyright (c) 2018, Kamiel <https://github.com/Kamielvf>, Psikoi <https://github.com/psikoi> and RuneLite
// contributors), drawn from the state the Screen Markers clone (plugins/screenmarkers/page.js) publishes; every change goes
// back to it. The icons' hover / no-colour / locked variants (ImageUtil.alphaOffset / grayscaleImage) are CSS opacity and
// grayscale. The colour pickers are the app's (RuneliteColorPicker: the fill one with alpha, starting at 75 when it's clear).
// NavigationButton: "Screen Markers", panel_icon.png, priority 5.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const IMG = '../plugins/screenmarkers/';
  const act = (action, args) => App.panelAction('screenmarkers', action, args);
  // which marker names are being edited (ScreenMarkerPanel's nameInput editable)
  const editing = new Set();
  const img = (file, cls) => h(`img${cls || ''}`, { src: IMG + file, alt: '', draggable: 'false' });
  const alphaOf = (hex) => parseInt(String(hex).slice(1, 3), 16);
  const rgbHex = (hex) => '#' + String(hex).slice(3);

  function markerPanel(m) {
    const isEditing = editing.has(m.id);
    const nameInput = h('input.smk-name', { type: 'text', spellcheck: 'false', value: m.name, readonly: isEditing ? null : 'readonly' });
    const save = () => { editing.delete(m.id); act('rename', { id: m.id, name: nameInput.value }); };
    const cancel = () => { editing.delete(m.id); App.renderPanel(false); };
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') cancel(); });
    const nameActions = isEditing
      ? h('div.smk-name-actions', {}, h('span.smk-save', { text: 'Save', onclick: save }), h('span.smk-cancel', { text: 'Cancel', onclick: cancel }))
      : h('div.smk-name-actions', {}, h('span.smk-rename', { text: 'Rename', onclick: () => { editing.add(m.id); App.renderPanel(false); } }));
    // border colour / fill colour indicators: the icon with a 3 px bottom border of the colour
    const border = UI.colorButton(m.color, (v) => act('color', { id: m.id, value: v }), { title: m.name + ' Border' });
    border.className = 'smk-indicator';
    border.replaceChildren(img(m.borderThickness === 0 ? 'border_color_icon.png' : 'border_color_icon.png', m.borderThickness === 0 ? '.smk-off' : ''));
    border.style.cssText = m.borderThickness === 0 ? '' : `border-bottom: 3px solid ${rgbHex(m.color)}`;
    UI.tip(border, 'Edit border color');
    const clearFill = alphaOf(m.fill) === 0;
    const fillStart = clearFill ? '#4B' + m.fill.slice(3) : m.fill; // DEFAULT_FILL_OPACITY 75
    const fill = UI.colorButton(fillStart, (v) => act('fill', { id: m.id, value: v }), { alpha: true, title: m.name + ' Fill' });
    fill.className = 'smk-indicator';
    fill.replaceChildren(img('fill_color_icon.png', clearFill ? '.smk-off' : ''));
    fill.style.cssText = clearFill ? '' : `border-bottom: 3px solid ${rgbHex(m.fill)}`;
    UI.tip(fill, 'Edit fill color');
    const thickness = UI.spinner(m.borderThickness, { min: 0 }, (v) => act('thickness', { id: m.id, value: v }));
    thickness.classList.add('smk-thickness');
    UI.tip(thickness, 'Border thickness');
    const label = h('span.smk-icon', { onclick: () => act('labelled', { id: m.id, value: !m.labelled }) }, img('label_icon.png', m.labelled ? '' : '.smk-off'));
    UI.tip(label, m.labelled ? 'Hide label' : 'Show label');
    const visibility = h('span.smk-icon', {
      onclick: () => act('visible', { id: m.id, value: !m.visible }),
      onmouseenter: () => { if (!m.visible) act('preview', { id: m.id, value: true }); },
      onmouseleave: () => { if (!m.visible) act('preview', { id: m.id, value: false }); },
    }, img(m.visible ? 'visible_icon.png' : 'invisible_icon.png'));
    UI.tip(visibility, m.visible ? 'Hide screen marker' : 'Show screen marker');
    const del = h('span.smk-icon', {
      onclick: () => { if (window.confirm('Are you sure you want to permanently delete this screen marker?')) act('delete', { id: m.id }); },
    }, img('delete_icon.png'));
    UI.tip(del, 'Delete screen marker');
    return h('div.smk-marker', {},
      h('div.smk-name-wrapper', {}, nameInput, nameActions),
      h('div.smk-bottom', {},
        h('div.smk-left', {}, border, fill, thickness, label),
        h('div.smk-right', {}, visibility, del)));
  }

  window.Panels.push({
    id: 'screenmarkers',
    tooltip: 'Screen Markers',
    icon: '../../../plugins/screenmarkers/panel_icon.png',
    priority: 5,
    visible: () => App.config('lostlite', 'screenmarkersPlugin', true) !== false,
    watch: ['pluginState'],
    render(root) {
      const st = (App.state.pluginState || {}).screenmarkers || { markers: [], creation: false, confirmLocked: true };
      const empty = st.markers.length === 0;
      const add = h('span.smk-add', { onclick: () => act('add') }, img('add_icon.png'));
      UI.tip(add, 'Add new screen marker');
      const north = h('div.smk-north', {}, h('span.smk-title', { text: 'Screen Markers', style: empty && !st.creation ? 'visibility:hidden' : null }), st.creation ? null : add);
      const view = h('div.smk-view');
      for (const m of st.markers) view.append(markerPanel(m));
      if (empty && !st.creation) view.append(h('div.plugin-error', {}, h('div.plugin-error-title', { text: 'Screen Markers' }), h('div.plugin-error-text', { text: 'Highlight a region on your screen.' })));
      if (st.creation) {
        const confirm = h('span.smk-icon', { onclick: () => { if (!st.confirmLocked) act('confirm'); } }, img('confirm_icon.png', st.confirmLocked ? '.smk-locked' : ''));
        UI.tip(confirm, 'Confirm and save');
        const cancel = h('span.smk-icon', { onclick: () => act('cancel') }, img('cancel_icon.png'));
        UI.tip(cancel, 'Cancel');
        view.append(h('div.smk-creation', {},
          h('span.smk-instructions', { text: st.confirmLocked ? 'Drag in-game to draw' : 'Confirm or cancel to finish.' }),
          h('div.smk-creation-actions', {}, confirm, cancel)));
      }
      root.replaceChildren(h('div.smk-panel', {}, north, view));
    },
  });
})();
