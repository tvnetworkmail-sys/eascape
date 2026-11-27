'use strict';
// RuneLite's Notes plugin (net.runelite.client.plugins.notes), cloned 1:1: NotesConfig (one hidden
// item, notesData) and NotesPanel (ui/panels/notes.js). No game part.
module.exports = {
  id: 'notes',
  name: 'Notes',
  description: 'Enable the Notes panel',
  tags: ['panel'],
  enabledByDefault: true,
  config: {
    group: 'notes',
    sections: [],
    items: [{ key: 'notesData', name: '', description: '', type: 'string', default: '', hidden: true }],
  },
};
