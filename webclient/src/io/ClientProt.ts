// Client -> server message numbers for revision 377 (from the 377 server, ClientGameProt).
export const enum ClientProt {
    NO_TIMEOUT = 40, // index: 6 - NXT naming

    IDLE_TIMER = 202, // index: 30
    EVENT_MOUSE_CLICK = 19, // index: 31
    EVENT_MOUSE_MOVE = 171, // index: 32
    EVENT_APPLET_FOCUS = 187, // index: 33
    EVENT_CAMERA_POSITION = 140, // index: 35

    ANTICHEAT_OPLOGIC1 = 95, // index: 60
    ANTICHEAT_OPLOGIC2 = 165, // index: 61
    ANTICHEAT_OPLOGIC3 = 157, // index: 62
    ANTICHEAT_OPLOGIC4 = 222, // index: 63
    ANTICHEAT_OPLOGIC5 = 126, // index: 64
    // ANTICHEAT_OPLOGIC6: not in 377
    // ANTICHEAT_OPLOGIC7: not in 377
    // ANTICHEAT_OPLOGIC8: not in 377
    // ANTICHEAT_OPLOGIC9: not in 377

    ANTICHEAT_CYCLELOGIC1 = 244, // index: 70
    ANTICHEAT_CYCLELOGIC2 = 168, // index: 71
    ANTICHEAT_CYCLELOGIC3 = 197, // index: 72
    ANTICHEAT_CYCLELOGIC4 = 173, // index: 73
    ANTICHEAT_CYCLELOGIC5 = 248, // index: 74
    ANTICHEAT_CYCLELOGIC6 = 22, // index: 75
    // ANTICHEAT_CYCLELOGIC7: not in 377

    OPOBJ1 = 77, // index: 80 - NXT naming
    OPOBJ2 = 100, // index: 81 - NXT naming
    OPOBJ3 = 71, // index: 82 - NXT naming
    OPOBJ4 = 54, // index: 83 - NXT naming
    OPOBJ5 = 230, // index: 84 - NXT naming
    OPOBJT = 83, // index: 88 - NXT naming
    OPOBJU = 211, // index: 89 - NXT naming

    OPNPC1 = 112, // index: 100 - NXT naming
    OPNPC2 = 67, // index: 101 - NXT naming
    OPNPC3 = 13, // index: 102 - NXT naming
    OPNPC4 = 42, // index: 103 - NXT naming
    OPNPC5 = 8, // index: 104 - NXT naming
    OPNPCT = 104, // index: 108 - NXT naming
    OPNPCU = 57, // index: 109 - NXT naming

    OPLOC1 = 181, // index: 120 - NXT naming
    OPLOC2 = 241, // index: 121 - NXT naming
    OPLOC3 = 50, // index: 122 - NXT naming
    OPLOC4 = 136, // index: 123 - NXT naming
    OPLOC5 = 55, // index: 124 - NXT naming
    OPLOCT = 210, // index: 128 - NXT naming
    OPLOCU = 152, // index: 129 - NXT naming

    OPPLAYER1 = 245, // index: 140 - NXT naming
    OPPLAYER2 = 233, // index: 141 - NXT naming
    OPPLAYER3 = 194, // index: 142 - NXT naming
    OPPLAYER4 = 116, // index: 143 - NXT naming
    OPPLAYER5 = 45, // index: 144 - NXT naming
    OPPLAYERT = 31, // index: 148 - NXT naming
    OPPLAYERU = 143, // index: 149 - NXT naming

    OPHELD1 = 203, // index: 160 - name based on runescript trigger
    OPHELD2 = 24, // index: 161 - name based on runescript trigger
    OPHELD3 = 161, // index: 162 - name based on runescript trigger
    OPHELD4 = 228, // index: 163 - name based on runescript trigger
    OPHELD5 = 4, // index: 164 - name based on runescript trigger
    OPHELDT = 36, // index: 168 - name based on runescript trigger
    OPHELDU = 1, // index: 169 - name based on runescript trigger

    INV_BUTTON1 = 3, // index: 190 - NXT has "IF_BUTTON1" but for our interface system, this makes more sense
    INV_BUTTON2 = 177, // index: 191 - NXT has "IF_BUTTON2" but for our interface system, this makes more sense
    INV_BUTTON3 = 91, // index: 192 - NXT has "IF_BUTTON3" but for our interface system, this makes more sense
    INV_BUTTON4 = 231, // index: 193 - NXT has "IF_BUTTON4" but for our interface system, this makes more sense
    INV_BUTTON5 = 158, // index: 194 - NXT has "IF_BUTTON5" but for our interface system, this makes more sense

    IF_BUTTON = 79, // index: 200 - NXT naming
    RESUME_PAUSEBUTTON = 226, // index: 201 - NXT naming
    CLOSE_MODAL = 110, // index: 202 - NXT naming
    RESUME_P_COUNTDIALOG = 75, // index: 203 - NXT naming
    TUT_CLICKSIDE = 119, // index: 204

    MAP_BUILD_COMPLETE = 6, // index: 241 - NXT naming
    MOVE_OPCLICK = 247, // index: 242 - comes with OP packets, name based on other MOVE packets
    SEND_SNAPSHOT = 184, // index: 243 - NXT naming
    MOVE_MINIMAPCLICK = 213, // index: 244 - NXT naming
    INV_BUTTOND = 123, // index: 245 - NXT has "IF_BUTTOND" but for our interface system, this makes more sense
    IGNORELIST_DEL = 160, // index: 246 - NXT naming
    IGNORELIST_ADD = 217, // index: 247 - NXT naming
    IDK_SAVEDESIGN = 163, // index: 248 - based on function name
    CHAT_SETMODE = 176, // index: 249 - NXT naming
    MESSAGE_PRIVATE = 227, // index: 250 - NXT naming
    FRIENDLIST_DEL = 141, // index: 251 - NXT naming
    FRIENDLIST_ADD = 120, // index: 252 - NXT naming
    CLIENT_CHEAT = 56, // index: 253 - NXT naming
    MESSAGE_PUBLIC = 49, // index: 254 - NXT naming
    MOVE_GAMECLICK = 28, // index: 255 - NXT naming

    // new in 377
    EVENT_HAS_WINDOW = 78,
    EVENT_SYNTH_ERROR = 80,
    RESUME_P_NAMEDIALOG = 206,
};
