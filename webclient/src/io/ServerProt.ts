// Server -> client message numbers for revision 377 (from the 377 server, ServerGameProt and
// ServerGameZoneProt). Sizes from the 377 client (Protocol.SERVERPROT_LENGTH).
export const enum ServerProt {
    // interfaces
    IF_OPENCHAT = 109,
    IF_OPENMAIN_SIDE = 128,
    IF_CLOSE = 29,
    IF_SETICON = 10,
    IF_SHOWICON = 252,
    IF_OPENMAIN = 159,
    IF_OPENSIDE = 246,
    IF_OPENOVERLAY = 50,

    // updating interfaces
    IF_SETCOLOUR = 218,
    IF_SETHIDE = 82,
    IF_SETOBJECT = 21,
    IF_SETMODEL = 216,
    IF_SETANIM = 2,
    IF_SETPLAYERHEAD = 255,
    IF_SETTEXT = 232,
    IF_SETNPCHEAD = 162,
    IF_SETPOSITION = 166,
    IF_SETSCROLLPOS = 200,

    // tutorial area
    TUT_FLASH = 238,
    TUT_OPEN = 158,

    // inventory
    UPDATE_INV_STOP_TRANSMIT = 219,
    UPDATE_INV_FULL = 206,
    UPDATE_INV_PARTIAL = 134,

    // camera control
    CAM_LOOKAT = 167,
    CAM_SHAKE = 67,
    CAM_MOVETO = 3,
    CAM_RESET = 148,

    // entity updates
    NPC_INFO = 71,
    PLAYER_INFO = 90,

    // social
    FRIENDLIST_LOADED = 251,
    MESSAGE_GAME = 63,
    UPDATE_IGNORELIST = 226,
    CHAT_FILTER_SETTINGS = 201,
    MESSAGE_PRIVATE = 135,
    UPDATE_FRIENDLIST = 78,

    // misc
    UNSET_MAP_FLAG = 61,
    UPDATE_RUNWEIGHT = 174,
    HINT_ARROW = 199,
    UPDATE_REBOOT_TIMER = 190,
    UPDATE_STAT = 49,
    UPDATE_RUNENERGY = 125,
    RESET_ANIMS = 13,
    UPDATE_PID = 126,
    LAST_LOGIN_INFO = 76,
    LOGOUT = 5,
    P_COUNTDIALOG = 58,
    SET_MULTIWAY = 233,
    SET_PLAYER_OP = 157,
    MINIMAP_TOGGLE = 156,

    // maps
    REBUILD_NORMAL = 222,

    // vars
    VARP_SMALL = 182,
    VARP_LARGE = 115,
    VARP_SYNC = 113,

    // audio
    SYNTH_SOUND = 26,
    MIDI_SONG = 220,
    MIDI_JINGLE = 249,

    // zones
    UPDATE_ZONE_PARTIAL_FOLLOWS = 75,
    UPDATE_ZONE_FULL_FOLLOWS = 40,
    UPDATE_ZONE_PARTIAL_ENCLOSED = 183,

    // zone protocol
    P_LOCMERGE = 203,
    LOC_ANIM = 142,
    OBJ_DEL = 208,
    OBJ_REVEAL = 106,
    LOC_ADD_CHANGE = 152,
    MAP_PROJANIM = 181,
    LOC_DEL = 88,
    OBJ_COUNT = 121,
    MAP_ANIM = 59,
    OBJ_ADD = 107,
    // new in 377
    IF_OPENFULL = 253,
    IF_SETANGLE = 186,
    IF_SETROTATION = 18,
    P_NAMEDIALOG = 6,
    REBUILD_REGION = 53,
    SOUND_AREA = 41,
};

// prettier-ignore
export const ServerProtSizes = [
    0, 0, 4, 6, 0, 0, 0, 0, 0, 0,
    3, 0, 0, 0, 0, 0, 0, 0, 6, 0,
    0, 6, 0, 0, 0, 0, 5, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 4, 0, 0, 0, 0, 0, 0, 0, 6,
    2, 0, 0, -2, 0, 0, 0, 0, 0, 6,
    0, 0, 0, -1, 0, 0, 0, 4, 0, 0,
    0, -2, 0, 0, 0, 2, 23, 0, 9, 0,
    0, 0, 3, 0, 0, 0, 0, 0, 2, 0,
    -2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 7, 5, 0, 2,
    0, 0, 0, 0, 0, 6, 0, 0, 0, 0,
    0, 7, 0, 0, 0, 1, 3, 0, 4, 0,
    0, 0, 0, 0, -2, -1, 0, 0, 0, 0,
    0, 0, 4, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 4, 0, 0, 0, 1, -1, 2, 2,
    0, 0, 4, 0, 0, 0, 6, 6, 0, 0,
    0, 0, 0, 0, 2, 0, 0, 0, 0, 0,
    0, 15, 3, -2, 0, 0, 8, 6, 0, 0,
    2, 0, 0, 0, 0, 0, 0, 0, 0, 6,
    4, 3, 0, 14, 0, 0, -2, 0, 3, 0,
    0, 0, 0, 0, 0, 0, 4, 0, 4, 2,
    2, 0, 4, 0, 0, 0, -2, 0, 0, 0,
    0, 0, -2, 1, 0, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 0, 0, 2, 0, 0, 5,
    0, 1, 1, 4, 0, 2, 0
];
