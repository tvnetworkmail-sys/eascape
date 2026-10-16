import fs from 'fs';
import { Worker } from 'worker_threads';

import { collectDefaultMetrics, register } from 'prom-client';

import { packAll } from '#tools/pack/PackAll.js';
import World from '#/engine/World.js';
import TcpServer from '#/server/tcp/TcpServer.js';
import Environment from '#/util/Environment.js';
import { printError, printInfo } from '#/util/Logger.js';
import { startManagementWeb, startWeb } from '#/web.js';
import OnDemand from '#/engine/OnDemand.js';

// EASCape: always pack on startup. It only rebuilds what changed, so after start.bat pulls new
// content it is live straight away (it used to pack only when nothing had been packed yet, which
// left your PC running old scripts after an update).
{
    printInfo('Packing cache (only what changed), please wait until you see the world is ready.');

    try {
        // todo: different logic so the main thread doesn't have to load pack files
        const modelFlags: number[] = [];
        await packAll(modelFlags);
    } catch (err) {
        if (err instanceof Error) {
            printError(err);
        }

        process.exit(1);
    }
}

if (Environment.EASY_STARTUP) {
    new Worker(new URL('./login.ts', import.meta.url));
    new Worker(new URL('./friend.ts', import.meta.url));
    new Worker(new URL('./logger.ts', import.meta.url));
}

await World.start();

const tcpServer = new TcpServer();
tcpServer.start();

await startWeb();
await startManagementWeb();

register.setDefaultLabels({ nodeId: Environment.NODE_ID });
collectDefaultMetrics({ register });

let exiting = false;
function safeExit() {
    if (exiting) {
        return;
    }

    exiting = true;
    World.rebootTimer(0);
}

process.on('SIGINT', safeExit);
process.on('SIGTERM', safeExit);
// EASCape: closing the server window (Windows sends SIGHUP): save everyone first
process.on('SIGHUP', () => {
    World.saveAllNow();
    safeExit();
});

process.on('uncaughtException', function (err) {
    console.error(err, 'Uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error({ promise, reason }, 'Unhandled Rejection at: Promise');
});
