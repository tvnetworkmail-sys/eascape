import fs from 'fs';
import path from 'path';

import ejs from 'ejs';
import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import FastifyView from '@fastify/view';
import FastifyWebsocket from '@fastify/websocket';
import { register } from 'prom-client';

import { CrcBuffer, CrcTable } from '#/cache/CrcTable.js';

import OnDemand from '#/engine/OnDemand.js';
import World from '#/engine/World.js';
import { MAX_SHOT_BYTES, receiveBotShot } from '#/engine/entity/tracking/BotShots.js';
import { lookup as hiscoreLookup, killTable, npcNames, npcRecords, BOSSES } from '#/engine/Hiscores.js';

import NullClientSocket from '#/server/NullClientSocket.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

import WSClientSocket from '#/server/ws/WSClientSocket.js';

import Environment from '#/util/Environment.js';
import { tryParseInt } from '#/util/TryParse.js';

const fastify = Fastify({
    // logger: true
});

fastify.register(FastifyView, {
    engine: {
        ejs
    },
    root: 'view'
});

await fastify.register(FastifyWebsocket, {
    options: {
        maxPayload: 1600,
        perMessageDeflate: false,
        verifyClient: function (info, next) {
            if (Environment.WEB_ALLOWED_ORIGIN && info.req.headers.origin !== Environment.WEB_ALLOWED_ORIGIN) {
                next(false);
                return;
            }

            next(true);
        }
    }
});

// general routes

fastify.route({
    method: 'GET',
    url: '/',
    handler: (_req, reply) => {
        return reply.redirect('/rs2.cgi', 302);
    },
    wsHandler: (socket, req) => {
        const client = new WSClientSocket(
            {
                send(data: Uint8Array) {
                    socket.send(data);
                },
                close() {
                    socket.close();
                },
                terminate() {
                    socket.terminate();
                }
            },
            req.socket.remoteAddress ?? 'unknown'
        );
        // EASCape: the app adds EASCapeApp/<version> to its user agent; only it can switch on the
        // app's extras (::appextras)
        client.isApp = /EASCapeApp\//.test(String(req.headers['user-agent'] ?? ''));

        socket.on('message', (message: Buffer<ArrayBufferLike>) => {
            try {
                if (client.state === -1 || client.remaining <= 0) {
                    client.terminate();
                    return;
                }

                client.buffer(message);

                if (client.state === 0) {
                    World.onClientData(client);
                } else if (client.state === 2) {
                    OnDemand.onClientData(client);
                }
            } catch {
                socket.terminate();
            }
        });

        socket.on('close', () => {
            client.state = -1;
            OnDemand.onClientClosed(client);

            if (client.player) {
                client.player.addSessionLog(LoggerEventType.ENGINE, 'WS socket closed');
                client.player.client = new NullClientSocket();
            }
        });

        socket.on('error', () => {
            socket.terminate();
        });
    }
});

// EASCape: the web client page (the 274 engine's /rs2.cgi, which the 377 engine doesn't have yet)
fastify.get<{ Querystring: { lowmem?: string } }>('/rs2.cgi', async (req, reply) => {
    const lowmem = tryParseInt(req.query.lowmem, 0);

    // the client file's time stamp goes on its address, so a browser fetches a new client as
    // soon as one is pulled instead of running the copy it saved earlier
    let version = 0;
    try {
        version = Math.floor(fs.statSync('public/client/client.js').mtimeMs);
    } catch {
        version = Date.now();
    }

    // EASCape: the newest app's version (this repo's app/package.json), for the game's "Your app
    // needs updating" notice
    let appVersion = '';
    try {
        appVersion = String(JSON.parse(fs.readFileSync('../app/package.json', 'utf8')).version || '');
    } catch {
        appVersion = '';
    }

    return reply.viewAsync('client.ejs', {
        appVersion,
        nodeid: Environment.NODE_ID,
        members: Environment.NODE_MEMBERS,
        lowmem,
        version
    });
});

// EASCape: one player's hiscores, for the app's Hiscore panel (engine/Hiscores.ts)
fastify.get<{ Params: { name: string } }>('/hiscores/player/:name', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const result = await hiscoreLookup(decodeURIComponent(req.params.name || '').slice(0, 12));
    if (!result) {
        reply.code(404);
        return { error: 'not found' };
    }
    return result;
});

// EASCape: the Boss kills and NPC kills tables (engine/Hiscores.ts): ?table=<boss key>, npc:<name>
// or npc:all, from ?rank= or around ?name=; and the lists for the hiscores' menu and NPC drop-down
fastify.get<{ Querystring: { table?: string; rank?: string; name?: string; count?: string } }>('/hiscores/kills', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const result = await killTable(String(req.query.table ?? '').slice(0, 64), {
        rank: Number(req.query.rank) || 1,
        name: req.query.name ? String(req.query.name).slice(0, 12) : undefined,
        count: Number(req.query.count) || 25
    });
    if (!result) {
        reply.code(404);
        return { error: 'not found' };
    }
    return result;
});

fastify.get('/hiscores/kills/tables', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { bosses: BOSSES.map(b => ({ key: b.key, name: b.name })), npcs: npcNames() };
});

fastify.get('/hiscores/kills/records', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return await npcRecords();
});

// cache routes

fastify.get('/crc:cachebust', async (_req, reply) => {
    reply.send(CrcBuffer.data);
});

fastify.get<{ Params: { crc: string } }>('/title:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[1]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 1));
});

fastify.get<{ Params: { crc: string } }>('/config:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[2]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 2));
});

fastify.get<{ Params: { crc: string } }>('/interface:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[3]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 3));
});

fastify.get<{ Params: { crc: string } }>('/media:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[4]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 4));
});

fastify.get<{ Params: { crc: string } }>('/versionlist:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[5]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 5));
});

fastify.get<{ Params: { crc: string } }>('/textures:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[6]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 6));
});

fastify.get<{ Params: { crc: string } }>('/wordenc:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[7]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 7));
});

fastify.get<{ Params: { crc: string } }>('/sounds:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[8]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 8));
});

// EASCape: a suspected bot's client sends its screenshot here when the game asks for one
// (engine/entity/tracking/BotShots.ts); the token in the address is what the game gave it
fastify.addContentTypeParser('image/jpeg', { parseAs: 'buffer', bodyLimit: MAX_SHOT_BYTES }, (_req, body, done) => done(null, body));
fastify.post<{ Params: { token: string } }>('/botshot/:token', async (req, reply) => {
    const ok = /^[0-9a-f]{32}$/.test(req.params.token) && Buffer.isBuffer(req.body) && receiveBotShot(req.params.token, req.body);
    reply.status(ok ? 204 : 404).send();
});

fastify.register(FastifyStatic, {
    root: path.join(process.cwd(), 'public')
});

export async function startWeb() {
    await fastify.listen({ port: Environment.WEB_PORT, host: '0.0.0.0' });
}

// management routes

const management = Fastify();

management.register(FastifyView, {
    engine: {
        ejs
    },
    root: 'view'
});

management.get('/prometheus', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
});

export async function startManagementWeb() {
    await management.listen({ port: Environment.WEB_MANAGEMENT_PORT, host: '0.0.0.0' });
}
