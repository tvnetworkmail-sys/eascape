// Offline check: what the web client writes for each 377 interaction message is read back
// correctly by the 377 server's own decoders.
import EnginePacket from '../../engine/src/io/Packet.js';
import ClientGameProt from '../../engine/src/network/game/client/ClientGameProt.js';
import OpLocDecoder from '../../engine/src/network/game/client/codec/OpLocDecoder.js';
import OpObjDecoder from '../../engine/src/network/game/client/codec/OpObjDecoder.js';
import OpNpcDecoder from '../../engine/src/network/game/client/codec/OpNpcDecoder.js';
import OpPlayerDecoder from '../../engine/src/network/game/client/codec/OpPlayerDecoder.js';
import OpHeldDecoder from '../../engine/src/network/game/client/codec/OpHeldDecoder.js';
import InvButtonDecoder from '../../engine/src/network/game/client/codec/InvButtonDecoder.js';

import Packet from '#/io/Packet.js';
import { writeInvButton, writeOpHeld, writeOpLoc, writeOpNpc, writeOpObj, writeOpPlayer } from '#/io/OpWrites.js';

let bad = 0;
function check(name: string, write: (out: Packet) => void, decode: (buf: EnginePacket) => object, expect: Record<string, number>) {
    const out = new Packet(new Uint8Array(64));
    write(out);
    const msg = decode(new EnginePacket(out.data.slice(0, out.pos))) as Record<string, number>;
    const wrong = Object.entries(expect).filter(([k, v]) => msg[k] !== v);
    if (wrong.length) {
        bad++;
        console.log(`  ! ${name}: ${wrong.map(([k, v]) => `${k} ${msg[k]} != ${v}`).join(', ')}`);
    }
}
const prots: Record<string, ClientGameProt[]> = {
    loc: [ClientGameProt.OPLOC1, ClientGameProt.OPLOC2, ClientGameProt.OPLOC3, ClientGameProt.OPLOC4, ClientGameProt.OPLOC5],
    obj: [ClientGameProt.OPOBJ1, ClientGameProt.OPOBJ2, ClientGameProt.OPOBJ3, ClientGameProt.OPOBJ4, ClientGameProt.OPOBJ5],
    npc: [ClientGameProt.OPNPC1, ClientGameProt.OPNPC2, ClientGameProt.OPNPC3, ClientGameProt.OPNPC4, ClientGameProt.OPNPC5],
    player: [ClientGameProt.OPPLAYER1, ClientGameProt.OPPLAYER2, ClientGameProt.OPPLAYER3, ClientGameProt.OPPLAYER4, ClientGameProt.OPPLAYER5],
    held: [ClientGameProt.OPHELD1, ClientGameProt.OPHELD2, ClientGameProt.OPHELD3, ClientGameProt.OPHELD4, ClientGameProt.OPHELD5],
    inv: [ClientGameProt.INV_BUTTON1, ClientGameProt.INV_BUTTON2, ClientGameProt.INV_BUTTON3, ClientGameProt.INV_BUTTON4, ClientGameProt.INV_BUTTON5]
};
for (let op = 1; op <= 5; op++) {
    const [x, z, id, slot, com] = [3222 + op, 3218 - op, 1234 + op, 7 + op, 3214 + op];
    check(`oploc${op}`, o => writeOpLoc(o, op, x, z, id), b => new OpLocDecoder(prots.loc[op - 1], op).decode(b), { x, z, loc: id });
    check(`opobj${op}`, o => writeOpObj(o, op, x, z, id), b => new OpObjDecoder(prots.obj[op - 1], op).decode(b), { x, z, obj: id });
    check(`opnpc${op}`, o => writeOpNpc(o, op, slot), b => new OpNpcDecoder(prots.npc[op - 1], op).decode(b), { npcSlot: slot });
    check(`opplayer${op}`, o => writeOpPlayer(o, op, slot), b => new OpPlayerDecoder(prots.player[op - 1], op).decode(b), { playerSlot: slot });
    check(`opheld${op}`, o => writeOpHeld(o, op, id, slot, com), b => new OpHeldDecoder(prots.held[op - 1], op).decode(b), { obj: id, slot, com });
    check(`invbutton${op}`, o => writeInvButton(o, op, id, slot, com), b => new InvButtonDecoder(prots.inv[op - 1], op).decode(b), { obj: id, slot, com });
}
console.log(bad ? `${bad} message(s) wrong` : 'all interaction messages read back correctly');
process.exit(bad ? 1 : 0);
