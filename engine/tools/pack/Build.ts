import { packAll } from '#tools/pack/PackAll.js';
import { printError } from '#/util/Logger.js';

try {
    const modelFlags: number[] = [];
    console.time('pack');
    await packAll(modelFlags);
    console.timeEnd('pack');
} catch (err) {
    if (err instanceof Error) {
        printError(err); console.error((err as Error).stack);
    }

    process.exit(1);
}
