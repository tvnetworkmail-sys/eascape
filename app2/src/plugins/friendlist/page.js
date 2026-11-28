// RuneLite's Friend List plugin, cloned from net.runelite.client.plugins.friendlist (BSD 2-Clause, Copyright (c) 2018,
// Connor <contact@connor-parks.email> and RuneLite contributors): FriendListPlugin.
// 2007: the friends (550) and ignore (551) tabs' titles are 550:2 / 551:2 (display-only setText); the core posts
// ScriptPostFired FRIENDS_UPDATE / IGNORE_UPDATE when the lists change (corea.js). The limits are the 2007 client's
// (friends 100 free / 200 members, ignores 100; OSRS's are 200 / 400 and 100 / 400) and membership is the client's
// members flag (OSRS: the ACCOUNT_CREDIT varp). The 2007 client has no pending-login queue (it adds the "has logged
// in." line as the status arrives), so a hidden friend's login / logout line is dropped from the chat box instead.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, WidgetUtil, InterfaceID, ScriptID, MenuAction, configManager } = rl;

  const MAX_FRIENDS_P2P = 200;
  const MAX_FRIENDS_F2P = 100;
  const MAX_IGNORES_P2P = 100;
  const MAX_IGNORES_F2P = 100;
  const HIDE_NOTIFICATIONS = 'Hide notifications';
  const SHOW_NOTIFICATIONS = 'Show notifications';
  const GROUP = 'friendlist';

  class FriendListPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.config = rl.configProxy(GROUP, () => this.configItems);
    }
    startUp() {}
    shutDown() {
      const world = client.getWorld();
      this.setFriendsListTitle('Friends List - World ' + world);
      this.setIgnoreListTitle('Ignore List - World ' + world);
    }
    onScriptPostFired(event) {
      if (event.getScriptId() === ScriptID.FRIENDS_UPDATE) {
        const world = client.getWorld();
        const isMember = client.isMembers();
        const friendCount = client.getFriendContainer().getCount();
        if (friendCount >= 0) {
          const limit = isMember ? MAX_FRIENDS_P2P : MAX_FRIENDS_F2P;
          this.setFriendsListTitle('Friends - W' + world + ' (' + friendCount + '/' + limit + ')');
        }
      } else if (event.getScriptId() === ScriptID.IGNORE_UPDATE) {
        const world = client.getWorld();
        const isMember = client.isMembers();
        const ignoreCount = client.getIgnoreContainer().getCount();
        if (ignoreCount >= 0) {
          const limit = isMember ? MAX_IGNORES_P2P : MAX_IGNORES_F2P;
          this.setIgnoreListTitle('Ignores - W' + world + ' (' + ignoreCount + '/' + limit + ')');
        }
      }
    }
    onChatMessage(message) {
      if (message.getType() !== 'LOGINLOGOUTNOTIFICATION') return;
      const messageNode = message.getMessageNode();
      // get the player name out of the notification
      const value = messageNode.getValue();
      const name = value.substring(0, value.indexOf(' '));
      // 2007: the hidden friend's line is dropped (RuneLite removes the pending login)
      if (this.isHideNotification(Text.toJagexName(name))) { message.drop(); return; }
      if (this.config.showWorldOnLogin()) {
        const player = this.findFriend(name);
        if (player != null && player.getWorld() > 0) messageNode.setValue(value + ` (World ${player.getWorld()})`);
      }
    }
    onMenuEntryAdded(event) {
      const groupId = WidgetUtil.componentToInterface(event.getActionParam1());
      // Look for "Message" on friends list (2006RS-2: the 2006 friends list's Message is the client's MESSAGE_PRIVATE
      // entry, 902, with no component in its arguments; seen through if2006.js as 10000 + 902)
      const friendsMessage = ll.c2007 ? groupId === InterfaceID.FRIENDS : event.getType() === 10902 || event.getType() === 12902;
      if (friendsMessage && event.getOption() === 'Message') {
        const friend = Text.toJagexName(Text.removeTags(event.getTarget()));
        client.createMenuEntry(-1)
          .setOption(this.isHideNotification(friend) ? SHOW_NOTIFICATIONS : HIDE_NOTIFICATIONS)
          .setType(MenuAction.RUNELITE)
          .setTarget(event.getTarget()) // Preserve color codes here
          .onClick(() => {
            const hidden = this.isHideNotification(friend);
            this.setHideNotifications(friend, !hidden);
            rl.chatMessageManager.queue(rl.QueuedMessage.builder()
              .type('CONSOLE')
              .value('Login notifications for ' + friend + ' are now ' + (hidden ? 'shown.' : 'hidden.'))
              .build());
          });
      }
    }
    setFriendsListTitle(title) {
      const w = client.getWidget(InterfaceID.Friends.HEADER);
      if (w != null) w.setText(title);
    }
    setIgnoreListTitle(title) {
      const w = client.getWidget(InterfaceID.Ignore.HEADER);
      if (w != null) w.setText(title);
    }
    findFriend(name) {
      const friendContainer = client.getFriendContainer();
      if (friendContainer != null) return friendContainer.findByName(Text.removeTags(name));
      return null;
    }
    setHideNotifications(friend, hide) {
      if (hide) configManager.setConfiguration(GROUP, 'hidenotification_' + friend, true);
      else configManager.unsetConfiguration(GROUP, 'hidenotification_' + friend);
    }
    isHideNotification(friend) {
      const v = configManager.getConfiguration(GROUP, 'hidenotification_' + friend);
      return v === true || v === 'true';
    }
  }

  const plugin = new FriendListPlugin();
  ll.__friendlist = { plugin };
  rl.registerPlugin('friendlist', plugin);
})();
