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
import NpcType from '#/config/NpcType.js';
import VarBitType from '#/config/VarBitType.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Pix32 from '#/graphics/Pix32.js';
import SdView from '#/client/SdView.js';
import World from '#/dash3d/World.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// EASCape: is this the app, and older than the newest one the server knows (app/package.json)?
// Apps from before the app told the page its version count as 0.1.0, the version they all had.
export function appNeedsUpdate(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    if (!g.__lostlite || typeof g.EASCAPE_APP_VERSION !== 'string' || !g.EASCAPE_APP_VERSION) {
        return false;
    }
    const have = String(g.__lostliteAppVersion || '0.1.0').split('.').map((n: string) => parseInt(n, 10) || 0);
    const want = g.EASCAPE_APP_VERSION.split('.').map((n: string) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        if ((have[i] ?? 0) !== (want[i] ?? 0)) {
            return (have[i] ?? 0) < (want[i] ?? 0);
        }
    }
    return false;
}

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
        obj: [MiniMenuAction.TGT_OBJ, MiniMenuAction.OP_OBJ1, MiniMenuAction.OP_OBJ2, MiniMenuAction.OP_OBJ3, MiniMenuAction.OP_OBJ4, MiniMenuAction.OP_OBJ5, MiniMenuAction.USEHELD_ONOBJ, MiniMenuAction.OP_OBJ6],
        // EASCape: for the HiScore plugin's Lookup (players' options, chat names' Add ignore, friends' Message)
        player: [MiniMenuAction.OP_PLAYER1, MiniMenuAction.OP_PLAYER2, MiniMenuAction.OP_PLAYER3, MiniMenuAction.OP_PLAYER4, MiniMenuAction.OP_PLAYER5],
        chatIgnore: MiniMenuAction.IGNORELIST_ADD,
        friendMessage: MiniMenuAction.MESSAGE_PRIVATE
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
    World.locHook = lostliteLoc; // 2006RS-2: the app's loc events
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
        // (an id past the end would read garbage forever: null instead)
        obj: (id: number) => (id >= 0 && id < ObjType.numDefinitions ? ObjType.list(id) : null),
        loopCycle: () => lostliteLoopCycle(),
        toUserhash: (name: string) => JString.toUserhash(name),
        pix: () => ({ pixels: Pix2D.pixels, width: Pix2D.width, height: Pix2D.height, x: 4, y: 4, w: 512, h: 334 }),
        objIcon: (id: number, count: number) => (id >= 0 && id < ObjType.numDefinitions ? ObjType.getSprite(id, count, 0) : null),
        loc: (id: number) => (id >= 0 && id < LocType.numDefinitions ? LocType.list(id) : null),
        // EASCape: send a ::command for a plugin (the Quest Helper panel's ::questhelper)
        command: (cmd: string) => commandSender(cmd),
        // 2006RS-2: the rest of the 2007 client's bridge (2007scape webclient LostLite.ts), for this client
        ...bridgeApi()
    });
}

// ---------------------------------------------------------------------------------------------
// 2006RS-2: the bridge the 2007RS app's plugins read the game through (2007scape's LostLite.ts,
// setApi), written for this client. The names and the shapes they return are the 2007 client's;
// what's read is this client's own state. Interfaces are the 377 ones: a component is its own id
// (IfType.list[id]), an "interface" (group) is the root layer the server opens (bank 5292,
// inventory 3213 ...). Ids the 2007 app hardcodes (packed group << 16 | child) are above 65535 and
// find nothing here, so a 2007-only interface lookup answers null instead of hitting a 2006
// component by accident. Where this client has no such thing, the call returns a safe empty value
// (noted on each).
// ---------------------------------------------------------------------------------------------

// the live client, set by Client.llHook (its fields are private: read by name, kept by bundle.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
let cl: Any = null;
export function lostliteSetClient(client: unknown): void {
    cl = client;
}

const IF_SIZE = 65536;
function ifGet(id: number): IfType | null {
    if (typeof id !== 'number' || !(id >= 0) || id >= IF_SIZE) {
        return null;
    }
    return IfType.list[id | 0] ?? null;
}

// the root layer a component is in (its interface)
function rootOf(c: IfType): IfType {
    let cur: IfType = c;
    for (let guard = 0; guard < 32; guard++) {
        if (cur.layerId === -1 || cur.layerId === cur.id) {
            return cur;
        }
        const up = IfType.list[cur.layerId];
        if (!up) {
            return cur;
        }
        cur = up;
    }
    return cur;
}

// the interfaces open now: [root id, modal mode (0 modal, 1 not: tabs and the overlay), area]
// area: 0 the game view, 1 the side panel, 2 the chat box
function openRoots(): [number, number, number][] {
    const out: [number, number, number][] = [];
    if (!cl || !cl.ingame) {
        return out;
    }
    if (cl.mainModalId !== -1) out.push([cl.mainModalId, 0, 0]);
    if (cl.mainOverlayId !== -1) out.push([cl.mainOverlayId, 1, 0]);
    if (cl.sideModalId !== -1) out.push([cl.sideModalId, 0, 1]);
    if (cl.chatModalId !== -1) out.push([cl.chatModalId, 0, 2]);
    const icons: number[] = cl.sideIcon || [];
    for (let tab = 0; tab < icons.length; tab++) {
        if (icons[tab] !== -1) out.push([icons[tab], 1, 1]);
    }
    return out;
}

function ifOpen(group: number): boolean {
    return group >= 0 && openRoots().some((r) => r[0] === group);
}

// where an area's interfaces are drawn on the canvas
function areaOrigin(area: number): [number, number] {
    if (area === 1) return [cl ? cl.sideX | 0 : 553, 205];
    if (area === 2) return [cl ? cl.frameChatX | 0 : 17, cl ? cl.frameChatY | 0 : 357];
    return [4, 4];
}
function areaSize(area: number): [number, number] {
    if (area === 1) return [190, 261];
    if (area === 2) return [479, 96];
    return [512, 334];
}

// the root's area while it is open and shown (a side tab only while it is the active one)
function rootArea(root: number): number {
    if (!cl || !cl.ingame) return -1;
    if (root === cl.mainModalId || (root === cl.mainOverlayId && cl.mainModalId === -1)) return 0;
    if (root === cl.chatModalId) return 2;
    if (root === cl.sideModalId) return 1;
    if (cl.sideModalId === -1 && cl.sideIcon && cl.sideIcon[cl.activeIcon] === root) return 1;
    return -1;
}

// a component's place on the canvas as drawInterface puts it (its layers' childX / Y, less their
// scroll), or null while its interface isn't drawn
function comScreenPos(c: IfType): [number, number] | null {
    let x = 0;
    let y = 0;
    let cur: IfType = c;
    for (let guard = 0; guard < 32; guard++) {
        if (cur.layerId === -1 || cur.layerId === cur.id) {
            const area = rootArea(cur.id);
            if (area < 0) return null;
            const o = areaOrigin(area);
            return [x + o[0], y + o[1]];
        }
        const layer: IfType | undefined = IfType.list[cur.layerId];
        if (!layer || !layer.children || !layer.childX || !layer.childY) return null;
        const i = layer.children.indexOf(cur.id);
        if (i < 0) return null;
        x += layer.childX[i] + cur.x;
        y += layer.childY[i] + cur.y;
        if (layer.layerId !== -1 && layer.layerId !== layer.id) y -= layer.scrollPos; // a nested layer's own scroll
        cur = layer;
    }
    return null;
}

// a component is drawn: it and every layer it's in are shown, and its interface is on screen
function comVisible(id: number): boolean {
    let c = ifGet(id);
    for (let guard = 0; c && guard < 32; guard++) {
        if (c.hide) return false;
        if (c.layerId === -1 || c.layerId === c.id) return rootArea(c.id) >= 0;
        c = IfType.list[c.layerId] ?? null;
    }
    return false;
}

function shownText(c: IfType): string {
    const t = c.text2 && c.text2.length > 0 && cl && typeof cl.getIfActive === 'function' && safe(() => cl.getIfActive(c), false) ? c.text2 : c.text;
    return t ?? '';
}

function safe<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

function comInfo(c: IfType | null): Any {
    if (!c) return null;
    let ox = c.x;
    let oy = c.y;
    const layer = c.layerId !== -1 && c.layerId !== c.id ? IfType.list[c.layerId] : null;
    if (layer && layer.children && layer.childX && layer.childY) {
        const i = layer.children.indexOf(c.id);
        if (i >= 0) {
            ox += layer.childX[i];
            oy += layer.childY[i];
        }
    }
    return {
        id: c.id,
        layer: layer ? layer.id : -1,
        type: c.type,
        buttonType: c.buttonType,
        buttonText: c.buttonText,
        pausable: c.buttonType === 6,
        text: c.text,
        text2: c.text2,
        shown: shownText(c),
        colour: c.colour,
        ox,
        oy,
        hide: c.hide,
        x: ox,
        y: oy,
        screen: comScreenPos(c),
        width: c.width,
        height: c.height,
        marginX: c.marginX,
        marginY: c.marginY,
        scripts: c.scripts,
        scriptOperand: c.scriptOperand,
        ops: c.iop,
        // as the 2007 client's inv cache: the item id (-1 empty), not 377's id + 1
        linkObjType: c.linkObjType ? Array.from(c.linkObjType, (v) => v - 1) : null,
        linkObjNumber: c.linkObjNumber,
        scrollHeight: c.scrollHeight,
        scrollPos: c.scrollPos,
        modelId: c.model1Id,
        modelType: c.model1Type,
        // 377 only: the component's children (a layer's), for walking an interface
        children: c.children ? c.children.slice() : null
    };
}

// every component of an open interface (the root and everything under it)
function comsOf(root: number): Any[] {
    if (!ifOpen(root)) return [];
    const out: Any[] = [];
    const walk = (id: number, depth: number): void => {
        const c = IfType.list[id];
        if (!c || depth > 32) return;
        out.push(comInfo(c));
        if (c.type === 0 && c.children) for (const ch of c.children) walk(ch, depth + 1);
    };
    walk(root, 0);
    return out;
}

function redrawFor(c: IfType | null): void {
    if (!cl || !c) return;
    const area = rootArea(rootOf(c).id);
    if (area === 1) {
        cl.redrawSide = true;
    } else if (area === 2) {
        cl.redrawChat = true;
    }
}

// the inventories the 2007 client keeps by inv id, read from the 377 components that show them
const INV_COMS: Record<number, number> = { 93: 3214, 94: 1688, 95: 5382 };
function inv(id: number): Any {
    const c = ifGet(INV_COMS[id] ?? -1);
    if (!c || !c.linkObjType || !c.linkObjNumber) return null;
    const ids: number[] = [];
    const counts: number[] = [];
    for (let i = 0; i < c.linkObjType.length; i++) {
        ids.push(c.linkObjType[i] - 1);
        counts.push(c.linkObjType[i] > 0 ? c.linkObjNumber[i] : 0);
    }
    return { ids, counts };
}

function groundItems(level: number, x: number, z: number): Any {
    const list = cl?.groundObj?.[level]?.[x]?.[z];
    if (!list) return null;
    const out: { id: number; count: number }[] = [];
    // (walked by hand: the list's own cursor is the client's)
    for (let n: Any = list.sentinel.next; n && n !== list.sentinel; n = n.next) out.push({ id: n.id, count: n.count });
    return out;
}

// locs on a scene tile: k 0 wall, 1 wall decoration, 2 scenery, 3 ground decoration
function locsAt(level: number, x: number, z: number): Any[] {
    const out: Any[] = [];
    const w = cl?.world;
    if (!w || x < 0 || z < 0 || x > 103 || z > 103) return out;
    const tags = [w.wallType(level, x, z), w.decorType(level, z, x), w.sceneType(level, x, z), w.gdType(level, x, z)];
    for (let k = 0; k < 4; k++) {
        const tag = tags[k];
        if (!tag) continue;
        const info = w.typeCode2(level, x, z, tag);
        out.push({ k, id: (tag >> 14) & 0x7fff, tag, shape: info & 0x1f, angle: (info >> 6) & 3 });
    }
    return out;
}

// RuneLite's GameTick: PLAYER_INFO comes once every server tick
let serverTicks = 0;
export function lostliteServerTick(): void {
    serverTicks++;
}

// ItemSpawned / ItemDespawned / ItemQuantityChanged: Client.showObject runs each time a tile's obj
// stack changes; the stack is compared with what it held before, by world position
const itemTiles = new Map<number, { id: number; count: number }[]>();
let itemQueue: Any[] = [];
let itemBase = -1;
const itemKey = (level: number, wx: number, wz: number): number => (level << 28) | (wx << 14) | wz;
export function lostliteObjShown(level: number, x: number, z: number): void {
    if (!cl || !lostlite()) return;
    const wx = cl.mapBuildBaseX + x;
    const wz = cl.mapBuildBaseZ + z;
    const key = itemKey(level, wx, wz);
    if (itemQueue.length > 4096) itemQueue = [];
    const before = itemTiles.get(key) ?? [];
    const now = groundItems(level, x, z) ?? [];
    if (now.length) itemTiles.set(key, now);
    else itemTiles.delete(key);
    const left = before.slice();
    for (const o of now) {
        const i = left.findIndex((b) => b.id === o.id && b.count === o.count);
        if (i >= 0) {
            left.splice(i, 1);
            continue;
        }
        const j = left.findIndex((b) => b.id === o.id);
        if (j >= 0) {
            itemQueue.push({ type: 'quantity', id: o.id, oldQuantity: left[j].count, newQuantity: o.count, level, wx, wz });
            left.splice(j, 1);
        } else {
            itemQueue.push({ type: 'spawn', id: o.id, quantity: o.count, level, wx, wz });
        }
    }
    for (const b of left) itemQueue.push({ type: 'despawn', id: b.id, quantity: b.count, level, wx, wz });
}
function itemEvents(): Any[] {
    if (!cl || !cl.ingame) {
        itemTiles.clear();
        itemQueue = [];
        itemBase = -1;
        return [];
    }
    const base = (cl.mapBuildBaseX << 16) | cl.mapBuildBaseZ;
    if (base !== itemBase) {
        itemBase = base;
        for (const [key, list] of itemTiles) {
            const level = key >>> 28;
            const wx = (key >>> 14) & 0x3fff;
            const wz = key & 0x3fff;
            const x = wx - cl.mapBuildBaseX;
            const z = wz - cl.mapBuildBaseZ;
            if (x < 0 || z < 0 || x >= 104 || z >= 104) {
                itemTiles.delete(key);
                for (const b of list) itemQueue.push({ type: 'despawn', id: b.id, quantity: b.count, level, wx, wz });
            }
        }
    }
    const out = itemQueue;
    itemQueue = [];
    return out;
}

// every loc added to the scene or taken off it (World.locHook), for RuneLite's Wall/Decorative/
// Game/GroundObject Spawned and Despawned. A scene reset queues { reset: true }.
let locQueue: Any[] = [];
const LOC_QUEUE_MAX = 100000;
export function lostliteLoc(k: number, level: number, x: number, z: number, typecode: number, info: number, spawned: boolean): void {
    if (!cl || !lostlite()) return;
    if (k < 0) {
        locQueue = [{ reset: true }];
        return;
    }
    if (locQueue.length >= LOC_QUEUE_MAX) return;
    locQueue.push({ k, level, sx: x, sz: z, wx: cl.mapBuildBaseX + x, wz: cl.mapBuildBaseZ + z, id: (typecode >> 14) & 0x7fff, tag: typecode, shape: info & 0x1f, angle: (info >> 6) & 3, spawned });
}
function locEvents(): Any[] {
    const out = locQueue;
    locQueue = [];
    return out;
}

// RuneLite's WidgetItem: the items each shown inventory component has, where they're drawn,
// flat [id, quantity, component, slot, x, y, ...] (worked out from the components as drawInterface
// lays them out)
function widgetItems(): Int32Array {
    const out: number[] = [];
    for (const [root] of openRoots()) {
        if (rootArea(root) < 0) continue;
        const walk = (id: number, depth: number): void => {
            const c = IfType.list[id];
            if (!c || depth > 32 || c.hide) return;
            if (c.type === 0 && c.children) {
                for (const ch of c.children) walk(ch, depth + 1);
                return;
            }
            if (c.type !== 2 || !c.linkObjType || !c.linkObjNumber) return;
            const p = comScreenPos(c);
            if (!p) return;
            let slot = 0;
            for (let row = 0; row < c.height; row++) {
                for (let col = 0; col < c.width; col++, slot++) {
                    if (slot >= c.linkObjType.length || c.linkObjType[slot] <= 0) continue;
                    let sx = p[0] + col * (c.marginX + 32);
                    let sy = p[1] + row * (c.marginY + 32);
                    if (slot < 20 && c.invBackgroundX && c.invBackgroundY) {
                        sx += c.invBackgroundX[slot];
                        sy += c.invBackgroundY[slot];
                    }
                    out.push(c.linkObjType[slot] - 1, c.linkObjNumber[slot], c.id, slot, sx, sy);
                }
            }
        };
        walk(root, 0);
    }
    return Int32Array.from(out);
}

function componentTable(): number[] {
    const out: number[] = [];
    for (const [root, mode] of openRoots()) out.push(root, mode);
    return out;
}

// [interface, modal mode, x, y, width, height] for each interface on screen now
function subRects(): number[] {
    const out: number[] = [];
    for (const [root, mode] of openRoots()) {
        const area = rootArea(root);
        if (area < 0) continue;
        const o = areaOrigin(area);
        const s = areaSize(area);
        out.push(root, mode, o[0], o[1], s[0], s[1]);
    }
    return out;
}

// RuneLite's WidgetLoaded / WidgetClosed: the open interfaces compared each client cycle
let lastOpen = new Map<number, number>();
export function lostlitePollWidgets(): void {
    const ll = lostlite();
    if (!ll || !configured) return;
    const now = new Map<number, number>();
    for (const [root, mode] of openRoots()) now.set(root, mode);
    if (now.size === lastOpen.size && [...now.keys()].every((k) => lastOpen.has(k))) return;
    const before = lastOpen;
    lastOpen = now;
    for (const [root, mode] of before) {
        if (!now.has(root) && typeof ll.widgetClosed === 'function') safe(() => ll.widgetClosed(root, true, mode), undefined);
    }
    for (const root of now.keys()) {
        if (!before.has(root) && typeof ll.widgetLoaded === 'function') safe(() => ll.widgetLoaded(root), undefined);
    }
}

// RuneLite's SoundEffectPlayed .consume() (the Music plugin's mutes): false drops the sound
export function lostliteSound(kind: string, id: number): boolean {
    const ll = lostlite();
    if (!ll || !configured || typeof ll.onSound !== 'function') return true;
    return safe(() => ll.onSound(kind, id | 0, null, -1) !== false, true);
}

// RuneLite's CommandExecuted: "::name args" typed in the chat box (true: a plugin took it)
export function lostliteCommand(text: string): boolean {
    const ll = lostlite();
    if (!ll || !configured || typeof ll.chatCommand !== 'function') return false;
    return safe(() => ll.chatCommand(text) === true, false);
}

// the app's hint arrow (setHint), shown while the server shows none
let appHint: Any = null;
function applyHint(): void {
    if (!cl || !appHint) return;
    if (appHint.npc !== undefined) {
        cl.hintType = 1;
        cl.hintNpc = appHint.npc | 0;
    } else if (appHint.player !== undefined) {
        cl.hintType = 10;
        cl.hintPlayer = appHint.player | 0;
    } else {
        cl.hintType = 2;
        cl.hintOffsetX = 64;
        cl.hintOffsetZ = 64;
        cl.hintTileX = appHint.x | 0;
        cl.hintTileZ = appHint.z | 0;
        cl.hintHeight = (appHint.height | 0) >> 1;
    }
}
function setHint(h: Any): boolean {
    if (!cl) return false;
    if (!h) {
        if (appHint) cl.hintType = 0;
        appHint = null;
        return true;
    }
    if (cl.hintType !== 0 && !appHint) return false; // the server's own arrow is up
    appHint = h.npc !== undefined ? { npc: h.npc } : h.player !== undefined ? { player: h.player } : { x: h.x, z: h.z, height: h.height || 0 };
    applyHint();
    return true;
}

const CHAT_TYPES_KEPT = 100;
function removeChat(types: number[], text?: string): number {
    if (!cl) return 0;
    const drop = new Set((types || []).map((t) => t | 0));
    let only = -1;
    if (text !== undefined && text !== null) {
        for (let i = CHAT_TYPES_KEPT - 1; i >= 0 && only < 0; i--) {
            if (cl.chatText[i] !== null && drop.has(cl.chatType[i]) && cl.chatText[i] === String(text)) only = i;
        }
        if (only < 0) return 0;
    }
    let n = 0;
    let removed = 0;
    for (let i = 0; i < CHAT_TYPES_KEPT; i++) {
        if (cl.chatText[i] === null) continue;
        if (only < 0 ? drop.has(cl.chatType[i]) : i === only) {
            removed++;
            continue;
        }
        cl.chatType[n] = cl.chatType[i];
        cl.chatUsername[n] = cl.chatUsername[i];
        cl.chatText[n] = cl.chatText[i];
        n++;
    }
    for (let i = n; i < CHAT_TYPES_KEPT; i++) {
        cl.chatText[i] = null;
        cl.chatUsername[i] = null;
    }
    if (removed > 0) cl.redrawChat = true;
    return removed;
}

// the minimap's centre on the canvas (Client.minimapDrawDot: 94 + 4, 83 - 4 in its area at mapX, 4)
function minimapPoint(fineX: number, fineZ: number): { x: number; y: number } | null {
    const me = cl?.localPlayer;
    if (!me) return null;
    const dx = ((fineX / 32) | 0) - ((me.x / 32) | 0);
    const dy = ((fineZ / 32) | 0) - ((me.z / 32) | 0);
    if (dx * dx + dy * dy > 6400) return null;
    const angle = (cl.orbitCameraYaw + cl.macroMinimapAngle) & 0x7ff;
    const sin = ((Pix3D.sinTable[angle] * 256) / (cl.macroMinimapZoom + 256)) | 0;
    const cos = ((Pix3D.cosTable[angle] * 256) / (cl.macroMinimapZoom + 256)) | 0;
    const px = (dy * sin + dx * cos) >> 16;
    const py = (dy * cos - dx * sin) >> 16;
    return { x: (cl.mapX | 0) + 98 + px, y: 4 + 79 - py };
}

const MAPDOT_FIELDS = ['mapdots1', 'mapdots2', 'mapdots3', 'mapdots4', 'mapdots5'];
const mapDotsOwn: (Pix32 | null)[] = [];
let varbitDefsCache: Int32Array | null = null;

function bridgeApi(): Any {
    return {
        iop: (id: number) => {
            const t = id >= 0 && id < ObjType.numDefinitions ? ObjType.list(id) : null;
            return t && t.iop ? Array.from(t.iop, (o) => (o == null ? null : String(o))) : [null, null, null, null, null];
        },
        npcType: (id: number) => {
            const t = id >= 0 && id < NpcType.numDefinitions ? safe(() => NpcType.list(id), null) : null;
            return t ? { id, name: t.name, ops: t.op ? Array.from(t.op, (o) => (o == null ? null : String(o))) : [null, null, null, null, null], level: t.vislevel, size: t.size, multinpc: t.multinpc ? Array.from(t.multinpc) : null } : null;
        },
        tickCount: () => serverTicks,
        fps: () => (cl ? cl.fps | 0 : 0),
        // client cycles of 20 ms since the last key / mouse input (this client keeps one time for both:
        // idleTimer, performance.now() of the last input; so lastPressed is the last input of any
        // kind, as Date.now() time); it logs out after 90 s (4500 cycles)
        idle: () => {
            const ms = cl ? Math.max(0, performance.now() - cl.idleTimer) : 0;
            return { keyboard: (ms / 20) | 0, mouse: (ms / 20) | 0, lastPressed: Date.now() - ms, timeout: 4500 };
        },
        isFriend: (name: string) => !!(cl && safe(() => cl.isFriend(String(name)), false)),
        // no clan chat in 2006 (it came in 2007)
        friendsChat: () => null,
        friendsChatInfo: () => null,
        world: () => (cl ? cl.constructor.nodeId | 0 : 0), // Client.nodeId (the page's world)
        friends: () => {
            const out: Any[] = [];
            for (let i = 0; cl && i < cl.friendCount; i++) out.push({ name: cl.friendUsername[i] ?? '', world: cl.friendNodeId[i] | 0 });
            return out;
        },
        ignores: () => {
            const out: Any[] = [];
            for (let i = 0; cl && i < cl.ignoreCount; i++) out.push({ name: JString.toScreenName(JString.toRawUsername(cl.ignoreUserhash[i])) });
            return out;
        },
        members: () => !!(cl && cl.membersAccount === 1),
        // the minimap dots (0 item, 1 NPC, 2 player, 3 friend, 4 team) replaced by RGB pixels, or put back (null)
        mapDot: (i: number, px: number[] | null, w: number, h: number) => {
            if (!cl || i < 0 || i >= MAPDOT_FIELDS.length) return false;
            if (mapDotsOwn.length === 0) for (const f of MAPDOT_FIELDS) mapDotsOwn.push(cl[f]);
            if (px) {
                const p = new Pix32(w, h);
                p.data.set(Int32Array.from(px).subarray(0, w * h));
                cl[MAPDOT_FIELDS[i]] = p;
            } else {
                cl[MAPDOT_FIELDS[i]] = mapDotsOwn[i];
            }
            return true;
        },
        mapDotCount: () => MAPDOT_FIELDS.length,
        // the minimap's zoom isn't adjustable in this client: always the 4 pixels a tile it draws
        minimapZoom: () => 4,
        dest: () => ({ x: cl ? cl.minimapFlagX : 0, z: cl ? cl.minimapFlagZ : 0 }),
        // 2007 cache sprites (archive 8): this client has none
        sprite: () => false,
        inv,
        groundItems,
        itemEvents,
        locEvents,
        locsAt,
        setHint,
        hint: () => appHint,
        com: (id: number) => comInfo(ifGet(id)),
        comsOf,
        comVisible,
        // an interface's mount (the component it's opened in): 377 opens roots straight into the
        // game view, side panel or chat box, so there is none
        subMount: () => -1,
        setScroll: (id: number, pos: number) => {
            const c = ifGet(id);
            if (c) {
                c.scrollPos = pos | 0;
                redrawFor(c);
            }
        },
        setObjs: (id: number, ids: Any, counts: Any) => {
            const c = ifGet(id);
            if (!c) return null;
            const before = { ids: c.linkObjType ? Array.from(c.linkObjType, (v) => v - 1) : null, counts: c.linkObjNumber };
            if (ids) c.linkObjType = Int32Array.from(ids, (v: number) => (v >= 0 ? v + 1 : 0));
            if (counts) c.linkObjNumber = Int32Array.from(counts);
            redrawFor(c);
            return before;
        },
        setText: (id: number, text: string) => {
            const c = ifGet(id);
            if (c) {
                c.text = String(text);
                redrawFor(c);
            }
        },
        setHidden: (id: number, hidden: boolean) => {
            const c = ifGet(id);
            if (c) {
                c.hide = !!hidden;
                redrawFor(c);
            }
        },
        // script-made children: 377 interfaces have none
        comChildren: () => null,
        setChildText: () => undefined,
        setChildColour: () => undefined,
        setColour: (id: number, rgb: number) => {
            const c = ifGet(id);
            if (c) {
                c.colour = rgb | 0;
                redrawFor(c);
            }
        },
        // a component's place: 377 keeps it in its layer's childX / childY
        setPosition: (id: number, x: number, y: number) => {
            const c = ifGet(id);
            const layer = c && c.layerId !== -1 ? IfType.list[c.layerId] : null;
            if (!c || !layer || !layer.children || !layer.childX || !layer.childY) return;
            const i = layer.children.indexOf(c.id);
            if (i >= 0) {
                layer.childX[i] = (x | 0) - c.x;
                layer.childY[i] = (y | 0) - c.y;
                redrawFor(c);
            }
        },
        comTextWidth: (id: number, text: string): number => {
            const c = ifGet(id);
            return c && c.font ? c.font.stringWid(String(text)) : -1;
        },
        setSize: (id: number, width: number, height: number) => {
            const c = ifGet(id);
            if (c) {
                c.width = width | 0;
                c.height = height | 0;
                redrawFor(c);
            }
        },
        redraw: (id: number) => redrawFor(ifGet(id)),
        // the draw distance is built in (DrawDistance.ts: always the most the loaded map allows)
        drawDistance: () => undefined,
        // the login screen: no fire / background switch in this client (the title is the 2006 one)
        loginFire: () => undefined,
        loginBackground: () => undefined,
        loginIndex: () => (cl && !cl.ingame ? cl.loginscreen : -1),
        loginField: () => (cl ? cl.loginSelect : 0),
        loginUsername: () => (cl ? cl.loginUser : ''),
        setLoginUsername: (u: string) => {
            if (cl) cl.loginUser = String(u).slice(0, 12);
        },
        projectiles: () => {
            const out: number[] = [];
            const list = cl?.projectiles;
            for (let n: Any = list ? list.sentinel.next : null; n && n !== list.sentinel; n = n.next) out.push(n.spotanim ? n.spotanim.id : -1, n.x | 0, n.z | 0, n.y | 0, n.level);
            return out;
        },
        graphicsObjects: () => {
            const out: number[] = [];
            const list = cl?.spotanims;
            for (let n: Any = list ? list.sentinel.next : null; n && n !== list.sentinel; n = n.next) out.push(n.type ? n.type.id : -1, n.x, n.z, n.y, n.level);
            return out;
        },
        tileSetting: (level: number, x: number, z: number) => cl?.mapl?.[level]?.[x]?.[z] ?? 0,
        collisionFlag: (level: number, x: number, z: number) => (x >= 0 && z >= 0 && x < 104 && z < 104 ? cl?.collision?.[level]?.flags[x * 104 + z] ?? 0 : 0),
        camera: () => (cl ? { x: cl.camX, y: cl.camY, z: cl.camZ, pitch: cl.camPitch, yaw: cl.camYaw, scale: Pix3D.zoom } : null),
        // not in this client (no shake switch): the view shakes as the server asks
        cameraShakeDisabled: () => undefined,
        openTab: (tab: number) => {
            if (!cl || !cl.ingame || !(tab >= 0 && tab < cl.sideIcon.length) || cl.sideIcon[tab] === -1) return false;
            cl.activeIcon = tab | 0;
            cl.redrawSide = true;
            cl.redrawIcons = true;
            return true;
        },
        // a sound effect played locally, as the server's SYNTH_SOUND would (nothing is sent)
        playSound: (id: number): boolean => {
            if (!cl || !(id >= 0) || !cl.waveEnabled || cl.waveCount >= 50) return false;
            cl.waveIds[cl.waveCount] = id | 0;
            cl.waveLoops[cl.waveCount] = 1;
            cl.waveDelay[cl.waveCount] = 0;
            cl.waveCount++;
            return true;
        },
        // Tab to reply: the game's own "Enter message to send to <name>" for a friend who is online
        pmReply: (name: string): boolean => {
            if (!cl || !cl.ingame || typeof name !== 'string' || !name || name.length > 12 || cl.socialInputOpen || cl.dialogInputOpen) return false;
            const hash = JString.toUserhash(name);
            for (let i = 0; i < cl.friendCount; i++) {
                if (cl.friendUserhash[i] === hash && cl.friendNodeId[i] > 0) {
                    cl.redrawChat = true;
                    cl.socialInputOpen = true;
                    cl.socialInput = '';
                    cl.socialInputType = 3;
                    cl.socialUserhash = cl.friendUserhash[i];
                    cl.socialInputHeader = 'Enter message to send to ' + cl.friendUsername[i];
                    return true;
                }
            }
            return false;
        },
        // client variables (varc / varcstr) are 2007 clientscript state: none in this client
        varc: () => 0,
        varcStr: () => null,
        varcStrs: () => [],
        // a chat line put back by the app, past the app's own chat hook (no ChatMessage for it)
        addChatQuiet: (type: number, text: string, sender: string) => {
            if (!cl) return;
            const add = Object.getPrototypeOf(cl).addChat;
            if (typeof add === 'function') add.call(cl, type | 0, String(text ?? ''), String(sender ?? ''));
        },
        removeChat,
        // no loc ambient sounds in this client (377)
        ambientMute: () => undefined,
        varbit: (id: number) => {
            const t = VarBitType.list[id];
            if (!t || !cl || t.basevar < 0) return 0;
            const v = cl.var[t.basevar] | 0;
            const n = t.endbit - t.startbit;
            return (v >> t.startbit) & (n >= 31 ? -1 : (1 << (n + 1)) - 1);
        },
        varbitDefs: () => {
            if (varbitDefsCache && varbitDefsCache.length) return varbitDefsCache;
            const out: number[] = [];
            VarBitType.list.forEach((t, id) => {
                if (t && t.basevar >= 0) out.push(id, t.basevar, t.startbit, t.endbit);
            });
            varbitDefsCache = Int32Array.from(out);
            return varbitDefsCache;
        },
        widgetItems,
        ifOpen,
        componentTable,
        subRects,
        // the display: this client's FPS counter (no HD renderer or canvas scaling switch here; the app scales the page)
        display: (o: Any) => {
            if (cl && o && typeof o.fps === 'boolean') cl.showFps = o.fps;
        },
        displayState: () => ({ scale: 'off', hd: false, hdPending: null, hdAvailable: false, fps: !!(cl && cl.showFps), christmas: false, snow: false, snowing: false }),
        sdres: (on: boolean) => SdView.set(!!on),
        stretch: (o: Any) => {
            if (typeof o?.['increasedResolution'] === 'boolean') SdView.set(o['increasedResolution']);
        },
        stretchedDimensions: () => ({ width: 765, height: 503 }),
        view: () => ({ x: 4, y: 4, w: 512, h: 334 }),
        minimapPoint,
        // the chat bar's Report Abuse text (display only; null puts the client's own back)
        reportText: (text?: string | null) => {
            if (text !== undefined) {
                reportText = text === null ? null : String(text).slice(0, 40);
                if (cl) cl.redrawChatMode = true;
            }
            return reportText;
        }
    };
}

// the chat bar's Report Abuse button's text: the app's (Report Button plugin: the time) or the client's own
let reportText: string | null = null;
export function lostliteReportText(own: string): string {
    return reportText ?? own;
}

// every client cycle while the app is on: the app's hint arrow and the open interfaces
export function lostliteCycle(): void {
    if (appHint && cl && cl.hintType === 0) applyHint();
    lostlitePollWidgets();
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
