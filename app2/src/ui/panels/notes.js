'use strict';
// RuneLite's NotesPanel (net.runelite.client.plugins.notes, BSD 2-Clause, Copyright (c) 2018,
// Charlie Waters and RuneLite contributors): a word-wrapping text area on DARKER_GRAY with 10 px
// padding inside a 10 px border, saved to notes.notesData when it loses the focus; Ctrl+Z / Ctrl+Y
// undo and redo (the browser's own). NavigationButton: "Notes", notes_icon.png, priority 7.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  window.Panels.push({
    id: 'notes',
    tooltip: 'Notes',
    icon: 'notes_icon.png',
    priority: 7,
    fill: true,
    watch: [],
    visible: () => App.config('lostlite', 'notesPlugin', true) !== false,
    render(root) {
      const editor = h('textarea.notes-editor', { spellcheck: 'false' });
      editor.value = App.config('notes', 'notesData', '') || '';
      editor.addEventListener('blur', () => App.setConfig('notes', 'notesData', editor.value));
      root.replaceChildren(h('div.notes-panel', {}, h('div.notes-container', {}, editor)));
    },
  });
})();
