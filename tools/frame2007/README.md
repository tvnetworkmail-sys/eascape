# The 2007 interface

`build.py <cache468 dir>` turns the August 2007 cache's fixed game frame (interface 548, read with
`if3_468.py`) and its sprites into our sprites `content/sprites/f2007_*`. The client
(`webclient/src/client/Client.ts`, "the 2007 interface") draws them instead of the 2006 frame while
the app's "2007 interface" plugin is on: side panel at 547,205, minimap at 545,4, chat at 20,362,
the 2007 tab bars (icons, the selected tab's red stone) and chat buttons (All and Game filter the
chat; Clan only shows its name, there being no clan chat in 2006).
