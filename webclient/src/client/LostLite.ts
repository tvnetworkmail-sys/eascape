// EASCape: the EASCape app's hooks, built into the client.
//
// LostLite (the RuneLite-style app this comes from) finds its hook points in Lost City's
// downloaded client by the shape of its compressed code and patches them in. Our client
// has them written in instead: the app adds its runtime in front of this file, and the
// client calls window.__lostlite at the same moments the patches did (see each "LostLite"
// comment in Client.ts, PixFont.ts and Model.ts). In a plain browser window.__lostlite
// doesn't exist and every hook does nothing.
//
// The runtime reads the client's own fields by name. Property names are kept when the
// client is built (bundle.ts), so the names below are the real ones from our source.

import ObjType from '#/config/ObjType.js';
import LocType from '#/config/LocType.js';
import IfType from '#/config/IfType.js';
import JString from '#/datastruct/JString.js';
import Pix2D from '#/graphics/Pix2D.js';
import { MiniMenuAction } from '#/client/MiniMenuAction.js';
import { DRAW_RADIUS } from '#/dash3d/DrawDistance.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lostlite(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).__lostlite ?? null;
}

// role -> property name, the same roles LostLite's patcher (src/main/patcher.js) finds
const FIELDS = {
    // camera and stats (findFields)
    cameraPitch: 'orbitCameraPitch',
    cameraYaw: 'orbitCameraYaw',
    statXP: 'statXP',
    statEffectiveLevel: 'statEffectiveLevel',
    statBaseLevel: 'statBaseLevel',
    // menu (patchMenu)
    menuCount: 'menuNumEntries',
    menuOption: 'menuOption',
    menuAction: 'menuAction',
    menuParamB: 'menuParamB',
    menuParamC: 'menuParamC',
    menuParamA: 'menuParamA',
    doAction: 'doAction',
    menuOpen: 'isMenuOpen',
    menuX: 'menuX',
    menuY: 'menuY',
    menuWidth: 'menuWidth',
    mouseX: 'mouseX',
    mouseY: 'mouseY',
    menuArea: 'menuArea',
    // login screen (patchLogin)
    loginScreen: 'loginscreen',
    // EASCape: whether you're logged in (the client's own flag; the runtime used to wait 3
    // seconds without a game tick, so the orbs stayed up on the login screen)
    inGame: 'ingame',
    loginUser: 'loginUser',
    loginPass: 'loginPass',
    // interfaces and items (patchBank)
    mainModal: 'mainModalId',
    invObj: 'linkObjType',
    invCount: 'linkObjNumber',
    objName: 'name',
    objSwap: 'objSwap',
    objReplace: 'objReplace',
    scrollPos: 'scrollPos',
    // chatbox (patchChat)
    socialInputOpen: 'socialInputOpen',
    dialogInputOpen: 'dialogInputOpen',
    closeModal: 'closeModal',
    sideModal: 'sideModalId',
    chatModal: 'chatModalId',
    redrawChat: 'redrawChat',
    // local player and game state (patchPlayer)
    level: 'minusedlevel',
    localPlayer: 'localPlayer',
    primaryAnim: 'primaryAnim',
    entityX: 'x',
    routeX: 'routeX',
    entitySize: 'size',
    entityZ: 'z',
    routeZ: 'routeZ',
    combatCycle: 'combatCycle',
    health: 'health',
    totalHealth: 'totalHealth',
    faceEntity: 'faceEntity',
    playerName: 'name',
    combatLevel: 'combatLevel',
    baseX: 'mapBuildBaseX',
    baseZ: 'mapBuildBaseZ',
    runEnergy: 'runenergy',
    runWeight: 'runweight',
    varps: 'var',
    // private messages (patchSocial)
    friendCount: 'friendCount',
    friendUserhash: 'friendUserhash',
    friendWorld: 'friendNodeId',
    socialRedraw: 'redrawChat',
    socialDialogOpen: 'dialogInputOpen',
    socialInputOpen2: 'socialInputOpen',
    socialInput: 'socialInput',
    socialInputType: 'socialInputType',
    socialUserhash: 'socialUserhash',
    socialInputHeader: 'socialInputHeader',
    friendUsername: 'friendUsername',
    addChat: 'addChat',
    chatType: 'chatType',
    chatUsername: 'chatUsername',
    chatText: 'chatText',
    // overlays and ground items (patchOverlay)
    project: 'getOverlayPos',
    projectX: 'projectX',
    projectY: 'projectY',
    camX: 'camX',
    fontP11: 'p11',
    fontP12: 'p12',
    fontB12: 'b12',
    fontDrawTag: 'drawStringTag',
    fontWidth: 'stringWid',
    groundObj: 'groundObj',
    listHead: 'head',
    listNext: 'next',
    objId: 'id',
    objCost: 'cost',
    objStackable: 'stackable',
    objCount: 'count',
    // NPCs and players (patchEntities)
    npcCount: 'npcCount',
    npcs: 'npc',
    npcIds: 'npcIds',
    npcType: 'type',
    players: 'players',
    playerIds: 'playerIds',
    playerCount: 'playerCount',
    entityHeight: 'height',
    npcName: 'name',
    npcLevel: 'vislevel',
    npcId: 'id',
    // interface buttons and side tabs (patchButtons)
    comButtonType: 'buttonType',
    comButtonText: 'buttonText',
    comId: 'id',
    comType: 'type',
    comChildren: 'children',
    comText: 'text',
    comColour: 'colour',
    comScripts: 'scripts',
    comOperand: 'scriptOperand',
    comHide: 'hide',
    sideIcon: 'sideIcon',
    redrawSide: 'redrawSide',
    activeTab: 'activeIcon',
    redrawIcons: 'redrawIcons',
    // interface layout (patchScroll)
    comWidth: 'width',
    comHeight: 'height',
    comChildX: 'childX',
    comChildY: 'childY',
    comX: 'x',
    comY: 'y',
    comScrollHeight: 'scrollHeight',
    // idle timer, item icons, spot animations (patchIdle, patchIcons, patchSpotanim)
    idleTimer: 'idleTimer',
    iconData: 'data',
    entitySpotanim: 'spotanimId',
    entitySpotanimCycle: 'spotanimLastCycle',
    // scene objects (patchScene)
    sceneWorld: 'world',
    sceneWall: 'wallType',
    sceneDecor: 'decorType',
    sceneLoc: 'sceneType',
    sceneGroundDecor: 'gdType',
    sceneInfo: 'typeCode2',
    locName: 'name',
    locDesc: 'desc',
    // hint arrow (patchHint)
    hintType: 'hintType',
    hintNpc: 'hintNpc',
    hintOffsetX: 'hintOffsetX',
    hintOffsetZ: 'hintOffsetZ',
    hintTileX: 'hintTileX',
    hintTileZ: 'hintTileZ',
    hintHeight: 'hintHeight',
    // menu action numbers (patchActions) and button actions (patchButtons), from MiniMenuAction
    actions: {
        walk: MiniMenuAction.WALK,
        npc: [MiniMenuAction.TGT_NPC, MiniMenuAction.OP_NPC1, MiniMenuAction.OP_NPC2, MiniMenuAction.OP_NPC3, MiniMenuAction.OP_NPC4, MiniMenuAction.OP_NPC5, MiniMenuAction.USEHELD_ONNPC, MiniMenuAction.OP_NPC6],
        npcExamine: MiniMenuAction.OP_NPC6,
        objTake: [MiniMenuAction.TGT_OBJ, MiniMenuAction.OP_OBJ1, MiniMenuAction.OP_OBJ2, MiniMenuAction.OP_OBJ3, MiniMenuAction.OP_OBJ4, MiniMenuAction.OP_OBJ5, MiniMenuAction.USEHELD_ONOBJ],
        objExamine: MiniMenuAction.OP_OBJ6,
        obj: [MiniMenuAction.TGT_OBJ, MiniMenuAction.OP_OBJ1, MiniMenuAction.OP_OBJ2, MiniMenuAction.OP_OBJ3, MiniMenuAction.OP_OBJ4, MiniMenuAction.OP_OBJ5, MiniMenuAction.USEHELD_ONOBJ, MiniMenuAction.OP_OBJ6]
    },
    buttons: {
        ok: MiniMenuAction.IF_BUTTON,
        toggle: MiniMenuAction.TOGGLE_BUTTON,
        select: MiniMenuAction.SELECT_BUTTON,
        pause: MiniMenuAction.PAUSE_BUTTON
    }
};

// what the client offers
const FEATURES = {
    zoom: true,
    drawDistance: DRAW_RADIUS, // built in, always the most the loaded map allows (DrawDistance.ts)
    rotate: true,
    menu: true,
    menuHover: true,
    login: true,
    bank: true,
    chat: true,
    player: true,
    social: true,
    overlay: true,
    entities: true,
    actions: true,
    roofs: true,
    buttons: true,
    hint: true,
    scene: true,
    idle: true,
    scroll: true,
    icons: true,
    spotanim: true,
    drag: true
};

let configured = false;

// tell the runtime what the client has, once, before the first hook runs
export function lostliteConfigure(): void {
    const ll = lostlite();
    if (!ll || configured) {
        return;
    }
    configured = true;
    ll.configure({
        readMethod: 'tcpIn (built in)',
        fields: FIELDS,
        features: FEATURES,
        warnings: [],
        length: 0,
        builtIn: true
    });
    ll.setApi({
        ifList: () => IfType.list,
        obj: (id: number) => ObjType.list(id),
        loopCycle: () => lostliteLoopCycle(),
        toUserhash: (name: string) => JString.toUserhash(name),
        pix: () => ({ pixels: Pix2D.pixels, width: Pix2D.width, height: Pix2D.height }),
        objIcon: (id: number, count: number) => ObjType.getSprite(id, count, 0),
        loc: (id: number) => LocType.list(id),
        // EASCape: send a ::command for a plugin (the Quest Helper panel's ::questhelper)
        command: (cmd: string) => commandSender(cmd)
    });
}

// set by the client: sends a ::command (without the ::) when logged in
let commandSender: (cmd: string) => boolean = () => false;
export function lostliteSetCommandSender(sender: (cmd: string) => boolean): void {
    commandSender = sender;
}

// set by the client (Client.loopCycle is static there)
let loopCycleGetter: () => number = () => 0;
export function lostliteSetLoopCycle(getter: () => number): void {
    loopCycleGetter = getter;
}
function lostliteLoopCycle(): number {
    return loopCycleGetter();
}
