// RuneLite's Friend Notes plugin, cloned from net.runelite.client.plugins.friendnotes (BSD 2-Clause, Copyright (c) 2018,
// Rheon <https://github.com/Rheon-D> and RuneLite contributors): FriendNotesPlugin, FriendNoteOverlay, HoveredFriend.
// 2007: "Add Note" / "Edit Note" on the friends tab's (550) Message and the ignore tab's (551) Delete entries, the note
// typed in the chat box prompt (ChatboxPanelManager), the tooltip on hover. Notes are config keys (friendNotes:
// note_<name>), so nothing goes to the server. Gap: the note icon after the name (Show icons) needs OSRS's
// friendsChatSetText script callback, which the 2007 friends script doesn't have, so the setting does nothing yet;
// no display name changes in 2007 (NameableNameChanged never comes).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, WidgetUtil, InterfaceID, MenuAction, configManager, Overlay, tooltipManager, Tooltip, overlayManager, chatboxPanelManager } = rl;

  const CONFIG_GROUP = 'friendNotes';
  const CHARACTER_LIMIT = 128;
  const KEY_PREFIX = 'note_';
  const ADD_NOTE = 'Add Note';
  const EDIT_NOTE = 'Edit Note';
  const NOTE_PROMPT_FORMAT = (name, limit) => `${name}'s Notes<br>` + rl.ColorUtil.prependColorTag(`(Limit ${limit} Characters)`, new rl.Color(0, 0, 170));

  class HoveredFriend {
    constructor(friendName, note) { this.friendName = friendName; this.note = note; }
    getFriendName() { return this.friendName; }
    getNote() { return this.note; }
  }

  class FriendNoteOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; }
    render() {
      if (client.isMenuOpen()) return null;
      // Add a friend note tooltip to a hovered friend list entry
      const hovered = this.plugin.getHoveredFriend();
      if (hovered != null) tooltipManager.add(new Tooltip(hovered.getNote()));
      return null;
    }
  }

  class FriendNotesPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.config = rl.configProxy(CONFIG_GROUP, () => this.configItems);
      this.hoveredFriend = null;
      this.overlay = new FriendNoteOverlay(this);
    }
    getHoveredFriend() { return this.hoveredFriend; }
    startUp() { overlayManager.add(this.overlay); }
    shutDown() { overlayManager.remove(this.overlay); }
    onConfigChanged() {}
    /** Set a friend note, or unset by passing a null/empty note. */
    setFriendNote(displayName, note) {
      if (!note) configManager.unsetConfiguration(CONFIG_GROUP, KEY_PREFIX + displayName);
      else configManager.setConfiguration(CONFIG_GROUP, KEY_PREFIX + displayName, note);
    }
    /** Get the friend note of a display name, or null if no friend note exists for it. */
    getFriendNote(displayName) {
      const v = configManager.getConfiguration(CONFIG_GROUP, KEY_PREFIX + displayName);
      return v == null ? null : String(v);
    }
    migrateFriendNote(currentDisplayName, prevDisplayName) {
      if (this.getFriendNote(currentDisplayName) == null) {
        const prevNote = this.getFriendNote(prevDisplayName);
        if (prevNote != null) { this.setFriendNote(prevDisplayName, null); this.setFriendNote(currentDisplayName, prevNote); }
      }
    }
    /** Set the currently hovered display name, if a friend note exists for it. */
    setHoveredFriend(displayName) {
      this.hoveredFriend = null;
      if (displayName) {
        const note = this.getFriendNote(displayName);
        if (note != null) this.hoveredFriend = new HoveredFriend(displayName, note);
      }
    }
    onMenuEntryAdded(event) {
      const groupId = WidgetUtil.componentToInterface(event.getActionParam1());
      // 2006RS-2: the 2006 friends and ignore lists' entries are the client's MESSAGE_PRIVATE (902) and IGNORELIST_DEL (884,
      // "Remove") with no component in their arguments, seen through if2006.js as 10000 + the opcode (+2000 priority)
      const t = typeof event.getType === 'function' ? event.getType() : -1;
      const is06 = (code) => t === 10000 + code || t === 12000 + code;
      if ((groupId === InterfaceID.FRIENDS || is06(902)) && event.getOption() === 'Message'
        || (groupId === InterfaceID.IGNORE && event.getOption() === 'Delete') || (is06(884) && event.getOption() === 'Remove')) {
        this.setHoveredFriend(Text.toJagexName(Text.removeTags(event.getTarget())));
        client.createMenuEntry(-1)
          .setOption(this.hoveredFriend == null || this.hoveredFriend.getNote() == null ? ADD_NOTE : EDIT_NOTE)
          .setType(MenuAction.RUNELITE)
          .setTarget(event.getTarget()) // Preserve color codes here
          .onClick((e) => {
            const sanitizedTarget = Text.toJagexName(Text.removeTags(e.getTarget()));
            const note = this.getFriendNote(sanitizedTarget);
            chatboxPanelManager.openTextInput(NOTE_PROMPT_FORMAT(sanitizedTarget, CHARACTER_LIMIT))
              .value(note || '')
              .onDone((content) => {
                if (content == null) return;
                content = Text.removeTags(content).trim();
                this.setFriendNote(sanitizedTarget, content);
              }).build();
          });
      } else if (this.hoveredFriend != null) {
        this.hoveredFriend = null;
      }
    }
    onNameableNameChanged(event) {
      const nameable = event.getNameable();
      if (nameable.getPrevName() != null) this.migrateFriendNote(Text.toJagexName(nameable.getName()), Text.toJagexName(nameable.getPrevName()));
    }
    onRemovedFriend(event) {
      this.setFriendNote(Text.toJagexName(event.getNameable().getName()), null);
    }
  }

  const plugin = new FriendNotesPlugin();
  ll.__friendnotes = { plugin, NOTE_PROMPT_FORMAT };
  rl.registerPlugin('friendnotes', plugin);
})();
